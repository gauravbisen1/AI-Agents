import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import pg from 'pg';
import { config } from './config.js';
import { askOllama } from './services/ollama.js';
import { runChecks } from './services/checks.js';
import { cloneRepositoryForJob, inspectRepository, applyFixSuggestion } from './services/sandbox.js';
import { buildBranchName, createPullRequest } from './services/github.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: config.databaseUrl });
const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

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

async function postBackToOrchestrator(result) {
  await fetch(config.orchestratorCallbackUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result)
  });
}

const worker = new Worker(
  config.queueName,
  async (job) => {
    const { incomingErrorId, mappedRepo, payload } = job.data;

    const hasPlaceholderGitHub = [config.githubOwner, config.githubToken].some((value) =>
      String(value || '').toLowerCase().includes('replace_me')
    );

    if (!config.githubOwner || !config.githubToken || hasPlaceholderGitHub) {
      throw new Error('GitHub owner/token are missing or placeholder; cannot run full repo pipeline.');
    }

    await updateStatus(incomingErrorId, 'inspecting');
    const { repoDir } = await cloneRepositoryForJob({
      owner: config.githubOwner,
      repo: mappedRepo,
      token: config.githubToken,
      sandboxRoot: config.sandboxRoot
    });

    const inspectResult = await inspectRepository({ mappedRepo, payload, repoDir });

    const prompt = [
      'You are an autonomous debugging engineer.',
      `Repository: ${mappedRepo}`,
      `Error message: ${payload.message}`,
      `Stack trace: ${payload.stackTrace || 'n/a'}`,
      'Suggest likely root cause and a safe minimal patch plan.'
    ].join('\n');

    const llmSuggestion = await askOllama(config.ollamaUrl, prompt);
  const fixResult = await applyFixSuggestion({ repoDir, payload, llmSuggestion, inspectResult });
  const checks = await runChecks({ repoDir });
    const branchName = buildBranchName(incomingErrorId);

    const pr = await createPullRequest({
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
      errorMessage: payload.message,
      stackTrace: payload.stackTrace
    });

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

  console.error('job failed', err);
});

console.log('worker started');
