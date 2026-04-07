import { config } from '../config.js';
import { logger } from '../logger.js';

async function postTelegram(base, payload, attempts = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timer);
      const bodyText = await response.text();
      let parsed = null;
      try {
        parsed = bodyText ? JSON.parse(bodyText) : null;
      } catch {
        parsed = null;
      }

      // Telegram may return HTTP 200 with { ok: false, description: ... }.
      const telegramOk = parsed?.ok === true;
      if (response.ok && telegramOk) {
        if (attempt > 1) {
          logger.info({ tag: 'telegram', attempt }, 'send ok on retry');
        }
        return;
      }

      const reason = parsed?.description || bodyText || 'unknown telegram error';
      throw new Error(`telegram send failed: ${response.status} ${reason}`);
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      logger.warn({ tag: 'telegram', attempt, err: error }, 'send attempt failed');

      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError || new Error('telegram send failed: unknown error');
}

export async function sendTelegramResult({ incomingErrorId, status, prUrl, summary }) {
  const hasPlaceholder = [config.telegramBotToken, config.telegramChatId].some((value) =>
    String(value || '').toLowerCase().includes('replace_me')
  );

  if (!config.telegramBotToken || !config.telegramChatId || hasPlaceholder) {
    return { skipped: true, reason: 'missing telegram config' };
  }

  const base = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
  const hasPrUrl = Boolean(prUrl && String(prUrl).trim());
  const statusText = String(status || 'unknown').toUpperCase();
  const cleanSummary = String(summary || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12)
    .join('\n');

  const lines = [
    `AI Agent Result`,
    `Error ID: #${incomingErrorId}`,
    `Status: ${statusText}`,
    hasPrUrl ? 'Pull request created successfully.' : 'Pull request not created.',
    hasPrUrl ? `PR: ${prUrl}` : 'PR: not created',
    '',
    'Summary:',
    cleanSummary || 'No summary provided.'
  ];

  await postTelegram(base, {
    chat_id: config.telegramChatId,
    text: lines.join('\n').slice(0, 3500),
    disable_web_page_preview: true
  });

  return { skipped: false };
}
