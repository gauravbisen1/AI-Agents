import { config } from '../config.js';

export async function sendTelegramResult({ incomingErrorId, status, prUrl, summary }) {
  const hasPlaceholder = [config.telegramBotToken, config.telegramChatId].some((value) =>
    String(value || '').toLowerCase().includes('replace_me')
  );

  if (!config.telegramBotToken || !config.telegramChatId || hasPlaceholder) {
    return { skipped: true, reason: 'missing telegram config' };
  }

  const base = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
  const lines = [
    `AI Agent result for error #${incomingErrorId}`,
    `Status: ${status}`,
    prUrl ? `PR: ${prUrl}` : 'PR: not created',
    '',
    summary ? summary.slice(0, 1500) : 'No summary provided.'
  ];

  const response = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.telegramChatId,
      text: lines.join('\n'),
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`telegram send failed: ${response.status} ${body}`);
  }

  return { skipped: false };
}
