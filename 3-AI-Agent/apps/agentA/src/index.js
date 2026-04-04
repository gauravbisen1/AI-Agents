import express from 'express';
import crypto from 'crypto';
import { config } from './config.js';
import { insertIncomingError, createErrorJob, pool } from './db.js';
import { enqueueErrorJob } from './queue.js';
import { mapToRepo } from './repoMap.js';
import { sendTelegramResult } from './services/telegram.js';

const app = express();
app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    }
  })
);

function isValidOpenClawSignature(rawBody, signature) {
  if (!config.openclawSecret) return true;
  if (!signature) return false;

  const digest = crypto
    .createHmac('sha256', config.openclawSecret)
    .update(rawBody)
    .digest('hex');

  // Extract hex from "sha256=..." format if present
  const signatureHex = signature.startsWith('sha256=') ? signature.slice(7) : signature;

  if (digest.length !== signatureHex.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signatureHex));
}

function isValidTelegramWebhookSecret(secretHeader) {
  if (!config.telegramWebhookSecret) return true;
  if (!secretHeader) return false;
  return secretHeader === config.telegramWebhookSecret;
}

function parseTelegramUpdate(update) {
  const messageObj = update?.message || update?.edited_message;
  const text = String(messageObj?.text || '').trim();
  if (!text) {
    return null;
  }

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  let repoHint = null;
  let stackTrace = '';
  const messageLines = [];

  for (const line of lines) {
    if (/^repo\s*[:=]/i.test(line)) {
      repoHint = line.split(/[:=]/, 2)[1]?.trim() || null;
      continue;
    }

    if (/^stack\s*[:=]/i.test(line)) {
      stackTrace = line.split(/[:=]/, 2)[1]?.trim() || '';
      continue;
    }

    messageLines.push(line);
  }

  return {
    source: 'telegram',
    externalId: String(messageObj?.message_id || update?.update_id || ''),
    repoHint,
    message: messageLines.join('\n') || 'No message provided',
    stackTrace,
    chatId: String(messageObj?.chat?.id || '')
  };
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'agenta' });
});

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'agenta',
    message: 'AI Agent API is running',
    routes: {
      health: 'GET /health',
      ingestOpenClaw: 'POST /ingest/opclaw',
      ingestTelegram: 'POST /ingest/telegram',
      errorStatus: 'GET /errors/:incomingErrorId',
      workerCallback: 'POST /callback/worker-result'
    }
  });
});

app.post('/ingest/opclaw', async (req, res) => {
  try {
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const signature = req.header('x-opclaw-signature') || '';

    if (!isValidOpenClawSignature(rawBody, signature)) {
      return res.status(401).json({ error: 'invalid signature' });
    }

    const payload = {
      source: 'telegram',
      externalId: req.body.errorId || null,
      repoHint: req.body.repoHint || null,
      message: req.body.message || 'No message provided',
      stackTrace: req.body.stackTrace || ''
    };

    const incomingErrorId = await insertIncomingError(payload);
    const mappedRepo = mapToRepo(payload);
    const job = await enqueueErrorJob({ incomingErrorId, mappedRepo, payload });

    await createErrorJob(incomingErrorId, mappedRepo, job.id);

    return res.status(202).json({
      status: 'queued',
      incomingErrorId,
      jobId: job.id,
      mappedRepo
    });
  } catch (error) {
    console.error('ingest failure', error);
    return res.status(500).json({ error: 'failed to ingest error' });
  }
});

app.post('/ingest/telegram', async (req, res) => {
  try {
    const secretHeader = req.header('x-telegram-bot-api-secret-token') || '';
    if (!isValidTelegramWebhookSecret(secretHeader)) {
      return res.status(401).json({ error: 'invalid telegram webhook secret' });
    }

    const payload = parseTelegramUpdate(req.body);
    if (!payload) {
      return res.status(200).json({ status: 'ignored', reason: 'no text message in update' });
    }

    const configuredChatId = String(config.telegramChatId || '').trim();
    const hasConfiguredChatId = configuredChatId && !configuredChatId.toLowerCase().includes('replace_me');

    if (hasConfiguredChatId && payload.chatId !== configuredChatId) {
      return res.status(403).json({ error: 'chat not allowed' });
    }

    const incomingErrorId = await insertIncomingError(payload);
    const mappedRepo = mapToRepo(payload);
    const job = await enqueueErrorJob({ incomingErrorId, mappedRepo, payload });

    await createErrorJob(incomingErrorId, mappedRepo, job.id);

    return res.status(202).json({
      status: 'queued',
      incomingErrorId,
      jobId: job.id,
      mappedRepo
    });
  } catch (error) {
    console.error('telegram ingest failure', error);
    return res.status(500).json({ error: 'failed to ingest telegram update' });
  }
});

app.get('/errors/:incomingErrorId', async (req, res) => {
  try {
    const incomingErrorId = Number(req.params.incomingErrorId);
    if (!Number.isInteger(incomingErrorId)) {
      return res.status(400).json({ error: 'invalid incomingErrorId' });
    }

    const result = await pool.query(
      `
        SELECT e.id,
               e.source,
               e.external_id,
               e.repo_hint,
               e.message,
               e.stack_trace,
               e.status,
               e.created_at,
               j.worker_status,
               j.checks_status,
               j.mapped_repo,
               j.branch_name,
               j.pr_url,
               j.action_summary
        FROM incoming_errors e
        LEFT JOIN error_jobs j ON j.incoming_error_id = e.id
        WHERE e.id = $1
      `,
      [incomingErrorId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('status lookup failure', error);
    return res.status(500).json({ error: 'failed to fetch error status' });
  }
});

app.post('/callback/worker-result', async (req, res) => {
  try {
    const { incomingErrorId, status, prUrl, summary, checksStatus } = req.body;

    await pool.query(
      `
        UPDATE error_jobs
        SET worker_status = $1,
            pr_url = $2,
            action_summary = $3,
            checks_status = COALESCE($4, checks_status)
        WHERE incoming_error_id = $5
      `,
      [status, prUrl || null, summary || null, checksStatus || null, incomingErrorId]
    );

    try {
      const telegramResult = await sendTelegramResult({ incomingErrorId, status, prUrl, summary });
      if (telegramResult.skipped) {
        console.log('telegram skipped (missing config)');
      } else {
        console.log('telegram sent successfully for error', incomingErrorId);
      }
    } catch (telegramError) {
      console.error('telegram send failure', telegramError);
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('callback failure', error);
    return res.status(500).json({ error: 'failed to persist worker result' });
  }
});

app.listen(config.port, () => {
  console.log(`Serverr listening on :${config.port}`);
});
