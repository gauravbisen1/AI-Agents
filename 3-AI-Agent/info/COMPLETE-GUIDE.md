# AI Agent Error-Fixing Pipeline - Complete Guide

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [Available Commands](#available-commands)
4. [Testing Guide](#testing-guide)
5. [Docker Management](#docker-management)
6. [File Reference](#file-reference)
7. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### Start the Pipeline (60 seconds)

```powershell
cd "c:\Users\91896\.vscode\AI-Agents\3-AI-Agent"
powershell -File start.ps1
```

**What happens:**
- Docker containers start (PostgreSQL, Redis, Orchestrator API, Worker)
- Health checks verify all services are ready (~10 seconds)
- API listens on `http://localhost:4000`

### Send Your First Test Event

```powershell
powershell -File test-event.ps1
```

**What happens:**
1. Signed webhook sent to `/ingest/opclaw`
2. Event queued in BullMQ
3. Worker picks up job
4. Local Ollama LLM analyzes error
5. GitHub PR created automatically
6. Telegram notification sent
7. Status updates poll until "completed"

Expected time: **3-7 seconds**

### View Live Logs

Terminal 1 (Logs):
```powershell
powershell -File logs.ps1 -Service orchestrator -Follow
```

Terminal 2 (Send tests):
```powershell
powershell -File test-event.ps1
powershell -File stress-test.ps1
```

### Stop When Done

```powershell
powershell -File stop.ps1
```

---

## 🏗️ Architecture Overview

```
┌─────────────┐
│  OpenClaw   │ (GitHub error webhook)
└──────┬──────┘
       │ HMAC-signed POST
       ▼
┌──────────────────────────┐
│   ORCHESTRATOR (API)     │  ◄─ Listens on :4000
├──────────────────────────┤
│ Routes:                  │
│  POST /ingest/opclaw     │  ◄─ Receive errors
│  GET /errors/:id         │  ◄─ Poll status
│  POST /callback/...      │  ◄─ Worker callbacks
└──────┬────────────────────┘
       │ Enqueue job
       │ Update database
       │ Send Telegram
       ▼
┌──────────────────────────┐
│  Redis (BullMQ Queue)    │  ◄─ Durable job queue
└──────┬────────────────────┘
       │ Dequeue
       ▼
┌──────────────────────────┐
│       WORKER             │  ◄─ Async processor
├──────────────────────────┤
│ 1. Call Ollama LLM       │  ◄─ Analyze error
│ 2. Clone GitHub repo     │  ◄─ Get code context
│ 3. Create fix branch     │  ◄─ ai-fix/error-N-xxx
│ 4. Write report file     │  ◄─ AI_AGENT_REPORT.md
│ 5. Create PR on GitHub   │  ◄─ Pull request
│ 6. POST callback         │  ◄─ Notify orchestrator
└──────┬────────────────────┘
       │ Callback
       ▼
┌──────────────────────────┐
│   PostgreSQL Database    │  ◄─ Persist state
├──────────────────────────┤
│ incoming_errors          │  ◄─ Original errors
│ error_jobs               │  ◄─ Job execution state
└──────────────────────────┘

┌──────────────────────────┐
│ Local Ollama (Host)      │  ◄─ LLM inference
│ gemma3:1b model          │
└──────────────────────────┘

┌──────────────────────────┐
│ GitHub (External)        │  ◄─ PR creation
└──────────────────────────┘

┌──────────────────────────┐
│ Telegram Bot (External)  │  ◄─ Notifications
└──────────────────────────┘
```

---

## ⚙️ Available Commands

### Lifecycle Scripts (Easiest)

| Script | Purpose | Example |
|--------|---------|---------|
| `start.ps1` | Start all services | `powershell -File start.ps1` |
| `stop.ps1` | Stop all services | `powershell -File stop.ps1` |
| `logs.ps1` | View/tail logs | `powershell -File logs.ps1 -Follow` |

### Testing Scripts

| Script | Purpose | Example |
|--------|---------|---------|
| `test-event.ps1` | Send 1 event & poll | `powershell -File test-event.ps1` |
| `stress-test.ps1` | Send 5 events & track | `powershell -File stress-test.ps1` |

### Direct Docker Commands

| Command | Purpose |
|---------|---------|
| `docker compose up -d` | Start background |
| `docker compose down` | Stop & remove |
| `docker compose ps` | Show status |
| `docker compose logs -f` | Live tail all |
| `docker compose logs orchestrator` | Specific service |
| `docker compose exec postgres psql -U postgres -d ai_agent` | SQL shell |

### Direct API Calls

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Verify API is running |
| `/ingest/opclaw` | POST | Submit error with signature |
| `/errors/:id` | GET | Get error status & PR URL |
| `/callback/worker-result` | POST | Worker callback (internal) |

---

## 🧪 Testing Guide

### Test 1: Single Event (2 minutes)

```powershell
# Terminal 1: Watch logs
powershell -File logs.ps1 -Service orchestrator -Follow

# Terminal 2: Send event & wait
powershell -File test-event.ps1
```

**Verify:**
- Logs show "telegram sent successfully"
- Command output shows PR URL
- Check GitHub for new PR at https://github.com/gauravbisen1/StayRoom/pulls

### Test 2: Stress Test (5 minutes)

```powershell
# Terminal 1: Monitor all logs
powershell -File logs.ps1 -Follow

# Terminal 2: Send 5 events
powershell -File stress-test.ps1
```

**Verify:**
- All 5 events reach "completed"
- 5 PRs created on GitHub
- Logs show 5 "telegram sent successfully"

### Test 3: Custom Event

```powershell
# Edit payload in test-event.ps1, then:
powershell -File test-event.ps1
```

Change these fields:
- `message`: Your error text
- `stack_trace`: Stack trace
- `repo_hint`: Target repo (StayRoom, auth, payment, etc.)

### Test 4: Repo Mapping

```powershell
# Different repo hints test different mappings
# Edit test-event.ps1 repo_hint and run:

powershell -File test-event.ps1  # Maps "StayRoom" → StayRoom
# Or change to "auth" → auth-service
# Or change to "unknown" → GITHUB_DEFAULT_REPO
```

---

## 🐳 Docker Management

### View Service Status
```powershell
docker compose ps
```

Output:
```
NAME                  IMAGE          STATUS        HEALTH
orchestrator-1        ...orchestr:.. Up 5 minutes  healthy
worker-1              ...worker:..   Up 5 minutes  (no healthcheck)
postgres-1            postgres:16    Up 5 minutes  healthy
redis-1               redis:7        Up 5 minutes  healthy
```

### View Live Logs (All Services)
```powershell
docker compose logs -f
```

### View Specific Service Logs
```powershell
# Orchestrator (API, Telegram)
docker compose logs -f orchestrator

# Worker (Processing, Ollama, GitHub)
docker compose logs -f worker

# Database
docker compose logs -f postgres

# Cache
docker compose logs -f redis
```

### Filter Logs
```powershell
# Show only errors
docker compose logs | Select-String "error|Error|ERROR"

# Show only Telegram activity
docker compose logs orchestrator | Select-String "telegram"

# Show only GitHub activity
docker compose logs worker | Select-String "github|git|PR|branch"
```

### Connect to Database
```powershell
docker compose exec postgres psql -U postgres -d ai_agent

# SQL queries:
SELECT id, message, status FROM incoming_errors;
SELECT incoming_error_id, worker_status, pr_url FROM error_jobs;
\q  # Exit
```

### Connect to Redis
```powershell
docker compose exec redis redis-cli

# Commands:
LRANGE error-triage:5 0 -1    # See pending jobs
LLEN error-triage:5           # Count pending
exit
```

### Rebuild & Restart
```powershell
# Full rebuild
docker compose down
docker compose up --build -d

# Quick restart
docker compose restart

# Restart specific service
docker compose restart worker
```

---

## 📂 File Reference

| File | Purpose | Editable? |
|------|---------|-----------|
| `.env` | Configuration & credentials | ✅ YES |
| `.env.example` | Config template | Reference only |
| `docker-compose.yml` | Service definitions | Usually not needed |
| `package.json` | Dependencies | Usually not needed |
| `apps/orchestrator/src/index.js` | API routes | Advanced users |
| `apps/worker/src/index.js` | Job processor | Advanced users |
| `infra/postgres/init.sql` | Database schema | Reference only |

### Where to Store Credentials

Edit `.env`:
```ini
GITHUB_TOKEN=your-real-github-token
GITHUB_OWNER=your-github-username
GITHUB_DEFAULT_REPO=your-target-repo

TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-chat-id

OPENCLAW_SIGNING_SECRET=your-webhook-secret
```

Then restart: `powershell -File start.ps1`

---

## 🔧 Troubleshooting

### Problem: "Port 4000 already in use"
**Solution:**
```powershell
# Find what's using port 4000
netstat -ano | findstr :4000

# Kill the process (replace PID):
taskkill /PID <PID> /F

# Or just stop Docker
powershell -File stop.ps1
```

### Problem: "Ollama unreachable"
**Solution:**
```powershell
# Make sure Ollama is running locally
ollama list

# If missing, install from: https://ollama.com/download

# Verify port 11434 is open
curl http://localhost:11434/api/tags
```

### Problem: "GitHub token invalid"
**Solution:**
```powershell
# Check .env has real token starting with 'ghp_'
# NOT 'replace_me'

# Create token at: https://github.com/settings/tokens
# Select: repo (full), workflow (optional)

# Update .env and restart
powershell -File start.ps1
```

### Problem: "Telegram send failed"
**Solution:**
```powershell
# Check .env has real token and chat_id
# NOT 'replace_me'

# Verify bot token is valid:
curl "https://api.telegram.org/bot<TOKEN>/getMe"

# Check logs for actual error:
powershell -File logs.ps1 -Service orchestrator -Filter "telegram"
```

### Problem: "Job stuck in 'inspecting' status"
**Solution:**
```powershell
# Logs show worker is hung:
powershell -File logs.ps1 -Service worker

# Restart worker:
docker compose restart worker

# Or full restart:
powershell -File stop.ps1
powershell -File start.ps1
```

### Problem: "Database connection refused"
**Solution:**
```powershell
# Database container crashed. Full restart:
powershell -File stop.ps1
powershell -File start.ps1

# Check logs:
powershell -File logs.ps1 -Service postgres

# If still failing, rebuild:
docker compose down
docker compose up --build -d
```

### Problem: "Signature validation failed"
**Solution:**
```powershell
# Check OPENCLAW_SIGNING_SECRET in .env matches what you're using to sign

# For testing, use: "replace_me"
# Restart after change:
powershell -File start.ps1

# Then test-event.ps1 will auto-sign with "replace_me"
```

---

## 📊 Expected Performance

| Metric | Value |
|--------|-------|
| Ingestion → Queued | <100ms |
| Queued → Processing | <500ms |
| Ollama LLM analysis | 1-3s |
| GitHub clone/branch/commit | 1-2s |
| GitHub PR creation | <1s |
| Callback → Telegram | <1s |
| **Total end-to-end** | **3-7 seconds** |

To measure:
```powershell
$start = Get-Date
powershell -File test-event.ps1
$end = Get-Date
"Total: $($end - $start)"
```

---

## 📈 Monitoring

### Real-Time Dashboard
```powershell
# In one terminal, watch logs:
powershell -File logs.ps1 -Follow

# In another terminal, send events as needed:
powershell -File test-event.ps1
```

### Key Log Lines to Watch For

✅ **Success indicators:**
```
orchestrator listening on :4000
worker started
telegram sent successfully for error N
database initialized
```

❌ **Error indicators:**
```
error|Error|ERROR
failed
connection refused
timeout
```

---

## 🎯 Common Workflows

### Daily Testing
```powershell
# Morning: Start fresh
powershell -File stop.ps1
powershell -File start.ps1

# Throughout day: Send test events
powershell -File test-event.ps1

# Before bed: Stop everything
powershell -File stop.ps1
```

### CI/CD Integration
```powershell
# Run tests in pipeline:
powershell -File test-event.ps1
# Exit code 0 = success, 1 = failure

# Or stress test:
powershell -File stress-test.ps1
```

### Debug Specific Event
```powershell
# Find error ID from logs, then:
curl http://localhost:4000/errors/42 | ConvertTo-Json

# Or poll:
powershell -File logs.ps1 -Service orchestrator -Filter "error 42"
```

---

## 📞 Support

For issues not covered here:
1. Check Docker logs: `powershell -File logs.ps1 -Follow`
2. Check database: `docker compose exec postgres psql -U postgres -d ai_agent`
3. Check Docker status: `docker compose ps`
4. Full restart: `powershell -File stop.ps1 && powershell -File start.ps1`

---

## ✅ Verification Checklist

- [ ] Docker installed and running
- [ ] `.env` has credentials (or "replace_me" for testing)
- [ ] `start.ps1` runs without errors
- [ ] `test-event.ps1` shows PR URL
- [ ] Logs show "telegram sent successfully"
- [ ] GitHub shows new PR in target repo
- [ ] Telegram receives message (if credentials filled)

---

**You're ready to test!** Start with:
```powershell
powershell -File start.ps1
powershell -File test-event.ps1
```

