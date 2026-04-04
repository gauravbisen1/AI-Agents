# 3-AI-Agent

This project implements your requested autonomous error-fixing pipeline:

Telegram -> OpenClaw -> Orchestrator API -> Redis/BullMQ -> Agent Worker -> PR -> Telegram reply.

## 1) Flow and Responsibilities

1. Error comes from Telegram via OpenClaw webhook.
2. Orchestrator stores incoming error in Postgres.
3. Orchestrator maps error to repo and enqueues a BullMQ job.
4. Worker consumes job, inspects repo sandbox, and asks Ollama for patch guidance.
5. Worker applies/suggests fix and runs checks.
6. Worker prepares PR metadata and pushes result back to orchestrator.
7. Orchestrator stores final state and is ready to send Telegram reply.

## 2) Components

- Telegram + OpenClaw: inbound error transport and outbound status updates.
- Orchestrator (`apps/orchestrator`): API gateway, persistence, queue producer.
- Redis + BullMQ: decoupled job queue with retries.
- Worker (`apps/worker`): autonomous code triage, fix, checks, PR flow.
- Postgres: audit trail for errors and jobs.
- Ollama (local host): LLM inference for root-cause + patch strategy.
- GitHub API: branch + PR creation (currently placeholder URL generation).
- Local repo sandbox: isolated clone for safe edits and checks.

## 3) Current Implementation Status

Implemented now:
- End-to-end ingestion and queueing.
- DB schema for incoming errors and job lifecycle.
- Worker processor with Ollama call.
- Placeholder hooks for repo inspection, patch application, checks, and PR creation.
- Docker compose for local stack.

Next (to implement):
- Real GitHub API integration (clone, branch, commit, push, PR).
- Real repo mapping (service catalog + ownership metadata).
- Real fix generator and patch apply.
- Real command execution for checks in sandbox.
- Telegram notification sender.

## 4) Quick Start

1. Copy env file:

```bash
cp .env.example .env
```

2. Set required values in `.env`:
- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_DEFAULT_REPO`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `OLLAMA_URL=http://host.docker.internal:11434`

3. Install dependencies:

```bash
npm install
```

4. Start everything with Docker:

```bash
npm run docker:up
```

5. Test ingestion (replace host/port if needed):

```bash
curl -X POST http://localhost:4000/ingest/opclaw \
  -H "Content-Type: application/json" \
  -d '{
    "errorId": "tg-err-001",
    "repoHint": "web-app",
    "message": "TypeError: Cannot read properties of undefined",
    "stackTrace": "at src/pages/home.tsx:42:11"
  }'
```

You should receive `202 queued` and then worker processing logs.

## 5) API Endpoints

- `GET /health`: orchestrator health.
- `POST /ingest/opclaw`: receives OpenClaw normalized Telegram errors.
- `GET /errors/:incomingErrorId`: fetches lifecycle state for one error.
- `POST /callback/worker-result`: receives worker completion/failure updates.

## 6) Step-by-Step Rollout

Step 1 (completed):
- Signature validation now uses raw request body.
- Callback can send Telegram status message.
- Error lifecycle status endpoint added.

Step 2 (completed):
- Docker service healthchecks added for Redis, Postgres, Ollama, and Orchestrator.
- Worker startup now waits until dependencies are healthy.
- Compose configuration validation confirmed.

Step 3 (completed):
- Worker now performs real GitHub operations: clone, branch, commit, push, and PR creation.
- Incident report file (`AI_AGENT_REPORT.md`) is generated in target repo to ensure a reviewable change.
- PR URL is persisted and returned through orchestrator callback and Telegram.

How to verify Step 1:
1. Create `.env` from `.env.example` and set Telegram bot/chat values.
2. Start stack with `npm run docker:up`.
3. POST sample payload to `/ingest/opclaw`.
4. Use returned `incomingErrorId` and call `/errors/:incomingErrorId`.
5. Confirm Telegram receives completion/failure summary.

How to verify Step 3:
1. Set real values for `GITHUB_TOKEN`, `GITHUB_OWNER`, and `GITHUB_DEFAULT_REPO` in `.env`.
2. Restart stack with `docker compose up --build`.
3. Send a test ingest request with `repoHint` set to your real repo name.
4. Confirm a branch and PR are created in GitHub.
5. Confirm PR URL appears in `/errors/:incomingErrorId` and Telegram reply.

## 7) Why This Design Fits Your Flow

- Durable state: every step persisted in Postgres.
- Async reliability: queue-based processing with retry support.
- Tooling flexibility: swap Ollama/llama.cpp without changing queue contract.
- Safe automation: sandbox placeholders make it easy to add guarded auto-fix.
- PR-first output: pipeline is optimized to end with a PR URL and summary.
