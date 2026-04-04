import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  queueName: process.env.QUEUE_NAME || 'error-triage',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@localhost:5432/ai_agent',
  openclawSecret: process.env.OPENCLAW_SIGNING_SECRET || '',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || ''
};
