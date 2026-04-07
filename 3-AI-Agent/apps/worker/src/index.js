import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import pg from 'pg';
import { config } from './config.js';
import { askOllama } from './services/ollama.js';
import { runChecks } from './services/checks.js';
import { cloneRepositoryForJob, inspectRepository, applyFixSuggestion, buildPatchContext } from './services/sandbox.js';
import { buildBranchName, createPullRequest } from './services/github.js';
import { logger } from './logger.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: config.databaseUrl });
const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

function normalizeIncomingMessage(rawMessage) {
  const text = String(rawMessage || '').replace(/\r/g, '');
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) =>
        !/^ai agent result/i.test(line) &&
        !/^ai agent result for error/i.test(line) &&
        !/^status:/i.test(line) &&
        !/^pull request/i.test(line) &&
        !/^pr:/i.test(line) &&
        !/^summary:/i.test(line)
    );

  return lines.slice(0, 10).join('\n').slice(0, 1200) || 'No message provided';
}

async function updateStatus(incomingErrorId, workerStatus, details = {}) {
  await pool.query(
    `
      UPDATE error_jobs
      SET worker_status = $1,
          checks_status = COALESCE($2, checks_status),
          action_summary = COALESCE($3, action_summary),
          branch_name = COALESCE($4, branch_name),
          pr_url = COALESCE($5, pr_url)
      WHERE incoming_error_id = $6
    `,
    [
      workerStatus,
      details.checksStatus || null,
      details.summary || null,
      details.branchName || null,
      details.prUrl || null,
      incomingErrorId
    ]
  );
}

async function postBackToOrchestrator(result, attempts = 3) {
  logger.info(
    {
      tag: 'callback->agenta',
      incomingErrorId: result.incomingErrorId,
      status: result.status,
      url: config.orchestratorCallbackUrl
    },
    'posting'
  );

  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(config.orchestratorCallbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`callback failed: ${response.status} ${body}`);
      }

      return;
    } catch (error) {
      lastError = error;
      logger.warn(
        { tag: 'callback->agenta', incomingErrorId: result.incomingErrorId, attempt, err: error },
        'callback attempt failed'
      );

      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError || new Error('callback failed: unknown error');
}

const worker = new Worker(
  config.queueName,
  async (job) => {
    const { incomingErrorId, mappedRepo, payload } = job.data;
    const normalizedPayload = {
      ...payload,
      message: normalizeIncomingMessage(payload?.message)
    };
    logger.info({ tag: 'job:start', incomingErrorId, mappedRepo }, 'started');

    const hasPlaceholderGitHub = [config.githubOwner, config.githubToken].some((value) =>
      String(value || '').toLowerCase().includes('replace_me')
    );

    if (!config.githubOwner || !config.githubToken || hasPlaceholderGitHub) {
      throw new Error('GitHub owner/token are missing or placeholder; cannot run full repo pipeline.');
    }

    logger.info({ tag: 'job:status', incomingErrorId, status: 'inspecting' }, 'updated');
    await updateStatus(incomingErrorId, 'inspecting');
    logger.info({ tag: 'job:clone', incomingErrorId }, 'running');
    const { repoDir } = await cloneRepositoryForJob({
      owner: config.githubOwner,
      repo: mappedRepo,
      token: config.githubToken,
      sandboxRoot: config.sandboxRoot
    });

    logger.info({ tag: 'job:inspect', incomingErrorId }, 'running');
    const inspectResult = await inspectRepository({ mappedRepo, payload: normalizedPayload, repoDir });
    const patchContext = await buildPatchContext({
      repoDir,
      files: inspectResult.filesTouched
    });

    const focusedPath = inspectResult.filesTouched?.[0] || '';
    const prompt = [
      'You are an autonomous debugging engineer.',
      `Repository: ${mappedRepo}`,
      `Error message: ${normalizedPayload.message}`,
      `Stack trace: ${normalizedPayload.stackTrace || 'n/a'}`,
      'Output only a valid unified git diff inside a ```diff fenced block.',
      'Hard requirements:',
      '- Use standard git patch headers: diff --git a/<path> b/<path>, --- a/<path>, +++ b/<path>.',
      '- No prose. No explanation. No plain code blocks.',
      '- Patch must apply cleanly with git apply.',
      '- Edit only existing source files listed below.',
      focusedPath ? `- Prioritize and modify this file first: ${focusedPath}` : '- Prioritize stack-trace matched backend files.',
      '- Keep patch minimal and compilable.',
      '- Do not include explanations or markdown outside the diff block.',
      '- If error mentions "Path text is required" or "text required", check for request-body typos like req.body.texttt and fix to req.body.text.',
      '- If object literal contains duplicate keys (example: user repeated), keep only one key.',
      '- Do not change unrelated frontend files for backend validation errors.',
      '',
      'Candidate file context:',
      patchContext || 'No candidate file content available.'
    ].join('\n');

    logger.info({ tag: 'job:llm', incomingErrorId }, 'running');
    const llmStart = Date.now();
    const llmProgress = setInterval(() => {
      const elapsedSec = Math.round((Date.now() - llmStart) / 1000);
      logger.info({ tag: 'job:llm', incomingErrorId, elapsedSec }, 'still processing');
    }, 10000);

    let llmSuggestion;
    try {
      llmSuggestion = await askOllama(config.ollamaUrl, prompt);
    } finally {
      clearInterval(llmProgress);
      const elapsedSec = Math.round((Date.now() - llmStart) / 1000);
      logger.info({ tag: 'job:llm', incomingErrorId, elapsedSec }, 'completed');
    }
    logger.info({ tag: 'job:fix', incomingErrorId }, 'running');
    const fixResult = await applyFixSuggestion({ repoDir, payload: normalizedPayload, llmSuggestion, inspectResult });
    logger.info({ tag: 'job:checks', incomingErrorId }, 'running');
    const checks = await runChecks({ repoDir });
    const branchName = buildBranchName(incomingErrorId);

    let pr = { prUrl: null, note: 'Skipped PR creation.' };
    if (fixResult.changed) {
      logger.info({ tag: 'job:pr', incomingErrorId, branchName }, 'running');
      pr = await createPullRequest({
        owner: config.githubOwner,
        repo: mappedRepo,
        token: config.githubToken,
        baseBranch: config.githubBaseBranch,
        branchName,
        incomingErrorId,
        sandboxRoot: config.sandboxRoot,
        repoDir,
        llmSuggestion,
        fixNote: fixResult.note,
        checksOutput: checks.output,
        errorMessage: normalizedPayload.message,
        stackTrace: normalizedPayload.stackTrace,
        fixApplied: true
      });
    } else {
      pr.note = 'No source patch applied; PR skipped.';
      logger.info({ tag: 'job:pr', incomingErrorId }, 'skipped no patch');
    }

    const summary = [
      inspectResult.summary,
      `LLM suggestion: ${llmSuggestion.slice(0, 500)}`,
      fixResult.note,
      checks.output,
      pr.note
    ].join('\n');

    await updateStatus(incomingErrorId, 'completed', {
      checksStatus: checks.ok ? 'passed' : 'failed',
      summary,
      branchName,
      prUrl: pr.prUrl
    });
    logger.info({ tag: 'job:done', incomingErrorId, checks: checks.ok ? 'passed' : 'failed' }, 'completed');

    await postBackToOrchestrator({
      incomingErrorId,
      status: 'completed',
      checksStatus: checks.ok ? 'passed' : 'failed',
      prUrl: pr.prUrl,
      summary
    });

    return { ok: true, incomingErrorId, mappedRepo };
  },
  { connection }
);

worker.on('failed', async (job, err) => {
  const incomingErrorId = job?.data?.incomingErrorId;
  if (incomingErrorId) {
    await updateStatus(incomingErrorId, 'failed', {
      checksStatus: 'failed',
      summary: `worker failed: ${err.message}`
    });

    await postBackToOrchestrator({
      incomingErrorId,
      status: 'failed',
      checksStatus: 'failed',
      summary: err.message
    });
  }

  logger.error({ tag: 'job:failed', incomingErrorId: incomingErrorId || 'unknown', err }, 'failed');
});

worker.on('active', (job) => {
  const incomingErrorId = job?.data?.incomingErrorId;
  logger.info({ tag: 'job:active', incomingErrorId: incomingErrorId || 'n/a' }, 'active');
});

worker.on('completed', (job) => {
  const incomingErrorId = job?.data?.incomingErrorId;
  logger.info({ tag: 'job:completed', incomingErrorId: incomingErrorId || 'n/a' }, 'acknowledged');
});

logger.info({ tag: 'worker', queueName: config.queueName }, 'started');
