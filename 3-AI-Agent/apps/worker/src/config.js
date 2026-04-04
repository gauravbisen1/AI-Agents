import dotenv from 'dotenv';

dotenv.config();

export const config = {
  queueName: process.env.QUEUE_NAME || 'error-triage',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@localhost:5432/ai_agent',
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  githubOwner: process.env.GITHUB_OWNER || '',
  githubToken: process.env.GITHUB_TOKEN || '',
  githubBaseBranch: process.env.GITHUB_BASE_BRANCH || 'main',
  sandboxRoot: process.env.SANDBOX_ROOT || '/tmp/agent-sandbox',
  orchestratorCallbackUrl:
    process.env.ORCHESTRATOR_CALLBACK_URL ||
    'http://orchestrator:4000/callback/worker-result'
};
