import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

function runGit(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
        return;
      }

      reject(new Error(`git ${args.join(' ')} failed (${code}): ${stderr || stdout}`));
    });
  });
}

async function collectCandidateFiles(rootDir, max = 5000) {
  const candidates = [];
  const stack = [rootDir];

  while (stack.length && candidates.length < max) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') {
        continue;
      }

      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (/\.(js|jsx|ts|tsx|mjs|cjs|py|java|go|rb)$/i.test(entry.name)) {
        candidates.push(fullPath);
      }

      if (candidates.length >= max) break;
    }
  }

  return candidates;
}

function extractKeywords(payload) {
  const source = `${payload.message || ''} ${payload.stackTrace || ''}`.toLowerCase();
  return source
    .replace(/[^a-z0-9_\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 3)
    .slice(0, 12);
}

function extractStackHints(sourceText) {
  const raw = String(sourceText || '').replace(/\\/g, '/').toLowerCase();
  const hints = new Set();
  const matches = raw.match(/[a-z0-9_./-]+\.(js|jsx|ts|tsx|mjs|cjs|py|java|go|rb)/g) || [];

  for (const m of matches) {
    const cleaned = m.replace(/^\.+\//, '').trim();
    if (!cleaned) continue;
    const parts = cleaned.split('/').filter(Boolean);
    if (!parts.length) continue;
    hints.add(parts.slice(-1).join('/'));
    if (parts.length >= 2) hints.add(parts.slice(-2).join('/'));
    if (parts.length >= 3) hints.add(parts.slice(-3).join('/'));
  }

  return Array.from(hints);
}

export async function cloneRepositoryForJob({ owner, repo, token, sandboxRoot }) {
  const repoDir = path.join(sandboxRoot, repo);
  await fs.rm(repoDir, { recursive: true, force: true });
  await fs.mkdir(sandboxRoot, { recursive: true });

  const remote = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
  await runGit(['clone', remote, repoDir], process.cwd());

  return { repoDir };
}

export async function inspectRepository({ mappedRepo, payload, repoDir }) {
  const files = await collectCandidateFiles(repoDir);
  const keywords = extractKeywords(payload);
  const stackHints = extractStackHints(`${payload.stackTrace || ''}\n${payload.message || ''}`);
  const matches = [];

  for (const filePath of files) {
    const relativePath = path.relative(repoDir, filePath);
    const relativeLower = relativePath.replace(/\\/g, '/').toLowerCase();

    const stackHit = stackHints.some((hint) => relativeLower.endsWith(hint));

    if (stackHit) {
      matches.push({ filePath, hitCount: 1000 });
      continue;
    }

    const content = await fs.readFile(filePath, 'utf8');
    const contentLower = content.toLowerCase();
    const keywordHits = keywords.reduce((acc, keyword) => (contentLower.includes(keyword) ? acc + 1 : acc), 0);
    const backendBoost = /(^|\/)backend\//.test(relativeLower) ? 2 : 0;
    const routeBoost = /(^|\/)(routes|controllers|models|middleware)\//.test(relativeLower) ? 1 : 0;
    const hitCount = keywordHits + backendBoost + routeBoost;

    if (hitCount > 0) {
      matches.push({ filePath, hitCount });
    }
  }

  matches.sort((a, b) => b.hitCount - a.hitCount);
  const topMatches = matches.slice(0, 5).map((m) => path.relative(repoDir, m.filePath));

  return {
    summary: `Inspected ${mappedRepo}. Error: ${payload.message}. Candidate files: ${topMatches.join(', ') || 'none found'}`,
    filesTouched: topMatches
  };
}

export async function buildPatchContext({ repoDir, files, maxChars = 12000 }) {
  const selected = (files || []).slice(0, 5);
  const parts = [];
  let used = 0;

  for (const relativePath of selected) {
    const absolutePath = path.join(repoDir, relativePath);
    try {
      const content = await fs.readFile(absolutePath, 'utf8');
      const snippet = content.slice(0, 2500);
      const block = [`FILE: ${relativePath}`, '```', snippet, '```', ''].join('\n');
      if (used + block.length > maxChars) break;
      parts.push(block);
      used += block.length;
    } catch {
      // Ignore unreadable files and continue.
    }
  }

  return parts.join('\n');
}

function extractUnifiedDiff(text) {
  if (!text) return '';

  const fenced = text.match(/```diff\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const rawDiffStart = text.indexOf('diff --git ');
  if (rawDiffStart >= 0) {
    return text.slice(rawDiffStart).trim();
  }

  return '';
}

export async function applyFixSuggestion({ repoDir, payload, llmSuggestion, inspectResult }) {
  const diffText = extractUnifiedDiff(llmSuggestion);
  if (!diffText) {
    return {
      changed: false,
      note: 'No unified diff generated by model; skipped patch apply.'
    };
  }

  const patchPath = path.join(repoDir, '.ai_patch.diff');
  await fs.writeFile(patchPath, `${diffText}\n`, 'utf8');

  try {
    await runGit(['apply', '--whitespace=nowarn', '--recount', patchPath], repoDir);
  } catch (error) {
    await fs.rm(patchPath, { force: true });
    return {
      changed: false,
      note: `Patch apply failed: ${error.message}`
    };
  }

  await fs.rm(patchPath, { force: true });

  const status = await runGit(['status', '--porcelain'], repoDir);
  const changedPaths = status.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter((p) => p && p !== '.ai_patch.diff');

  const sourceChanges = changedPaths.filter((p) => !/\.md$/i.test(p));
  if (!sourceChanges.length) {
    await runGit(['checkout', '--', '.'], repoDir);
    return {
      changed: false,
      note: 'Patch only changed docs/non-source files; reverted.'
    };
  }

  return {
    changed: true,
    note: `Applied patch to: ${sourceChanges.slice(0, 5).join(', ')}`
  };
}
