import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

function runCommand(command, args, cwd, timeoutMs = 120000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        child.kill('SIGKILL');
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      finished = true;
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        code,
        output: `${stdout}${stderr}`.trim()
      });
    });

    child.on('error', (err) => {
      finished = true;
      clearTimeout(timer);
      resolve({ ok: false, code: -1, output: String(err.message || err) });
    });
  });
}

export async function runChecks({ repoDir }) {
  const packagePath = path.join(repoDir, 'package.json');
  try {
    const raw = await fs.readFile(packagePath, 'utf8');
    const pkg = JSON.parse(raw);
    const scripts = pkg.scripts || {};

    const ordered = ['check', 'lint', 'test'].filter((scriptName) => Boolean(scripts[scriptName]));
    if (!ordered.length) {
      return {
        ok: true,
        output: 'No npm check/lint/test scripts found; skipped checks.'
      };
    }

    const outputs = [];
    let allGood = true;

    for (const scriptName of ordered) {
      const result = await runCommand('npm', ['run', scriptName], repoDir);
      outputs.push(`npm run ${scriptName}: ${result.ok ? 'ok' : 'failed'}\n${result.output || '(no output)'}`);
      if (!result.ok) {
        allGood = false;
        break;
      }
    }

    return {
      ok: allGood,
      output: outputs.join('\n\n').slice(0, 5000)
    };
  } catch {
    return {
      ok: true,
      output: 'No package.json found at repository root; skipped checks.'
    };
  }
}
