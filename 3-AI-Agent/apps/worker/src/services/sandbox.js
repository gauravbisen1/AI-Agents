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

async function collectCandidateFiles(rootDir, max = 200) {
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
  const matches = [];

  for (const filePath of files) {
    if (matches.length >= 10) break;
    const content = await fs.readFile(filePath, 'utf8');
    const contentLower = content.toLowerCase();
    const hitCount = keywords.reduce((acc, keyword) => (contentLower.includes(keyword) ? acc + 1 : acc), 0);

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

export async function applyFixSuggestion({ repoDir, payload, llmSuggestion, inspectResult }) {
  const fixDocPath = path.join(repoDir, 'AI_AUTOFIX_SUGGESTION.md');
  const report = [
    '# AI Autofix Suggestion',
    '',
    '## Error Message',
    payload.message || 'n/a',
    '',
    '## Stack Trace',
    '```',
    payload.stackTrace || 'n/a',
    '```',
    '',
    '## Candidate Files',
    ...(inspectResult.filesTouched?.length
      ? inspectResult.filesTouched.map((file) => `- ${file}`)
      : ['- none identified']),
    '',
    '## Suggested Fix Plan',
    llmSuggestion || 'n/a',
    ''
  ].join('\n');

  await fs.writeFile(fixDocPath, `${report}\n`, 'utf8');

  return {
    changed: true,
    note: 'Generated AI_AUTOFIX_SUGGESTION.md with repo-specific fix plan.'
  };
}
