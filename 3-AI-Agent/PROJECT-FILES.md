# Project File Structure & Reference

## 📁 Complete Directory Tree

```
3-AI-Agent/
│
├── 📄 TESTING-COMPLETE.md         ◄─ START HERE (overview of everything)
├── 📄 COMPLETE-GUIDE.md           ◄─ Full documentation (architecture + all commands)
├── 📄 TESTING.md                  ◄─ Detailed testing scenarios & debug commands
├── 📄 QUICK-REF.md                ◄─ 30-second commands (copy-paste ready)
├── 📄 CHEAT-SHEET.md              ◄─ Developer one-liners & troubleshooting
├── 📄 PROJECT-FILES.md            ◄─ This file (directory reference)
│
├── 🚀 start.ps1                   ◄─ Start all services
├── 🛑 stop.ps1                    ◄─ Stop all services
├── 🧪 test-event.ps1             ◄─ Send 1 test event
├── 💪 stress-test.ps1            ◄─ Send 5 test events
├── 📊 logs.ps1                   ◄─ View Docker logs
│
├── docker-compose.yml             ◄─ Service definitions
├── package.json                   ◄─ Monorepo config
├── .env                           ◄─ Configuration (YOUR CREDENTIALS HERE)
├── .env.example                   ◄─ Config template
│
├── apps/
│   ├── agenta/                   ◄─ API Gateway (port 4000)
│   │   ├── src/
│   │   │   ├── index.js           ◄─ Express routes & webhook handler
│   │   │   ├── config.js          ◄─ Load environment variables
│   │   │   ├── db.js             ◄─ PostgreSQL queries
│   │   │   ├── queue.js          ◄─ BullMQ producer
│   │   │   ├── repoMap.js        ◄─ Repo hint → owner/repo mapping
│   │   │   └── services/
│   │   │       └── telegram.js    ◄─ Telegram notification sender
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── worker/                    ◄─ Job Processor
│       ├── src/
│       │   ├── index.js           ◄─ BullMQ worker processor
│       │   ├── config.js          ◄─ Load environment variables
│       │   └── services/
│       │       ├── ollama.js      ◄─ LLM analysis (local Ollama)
│       │       ├── github.js      ◄─ GitHub clone/branch/PR creation
│       │       ├── checks.js      ◄─ Placeholder lint/test checks
│       │       └── sandbox.js     ◄─ Placeholder code inspection/fixing
│       ├── Dockerfile
│       └── package.json
│
└── infra/
    ├── postgres/
    │   └── init.sql               ◄─ Database schema (tables + triggers)
    └── [docker handles rest]

```

---

## 📖 When to Read Which File

### 📚 Documentation Priority

**First Time (5 minutes):**
```
1. QUICK-REF.md (top section: "30-Second Commands")
2. Run: powershell -File start.ps1
3. Run: powershell -File test-event.ps1
```

**Full Understanding (30 minutes):**
```
1. COMPLETE-GUIDE.md (sections: Quick Start → Architecture)
2. TESTING.md (section: Testing Flow)
```

**Daily Use (pick one):**
```
- QUICK-REF.md: If you like speed
- CHEAT-SHEET.md: If you like one-liners
- COMPLETE-GUIDE.md: For detailed reference
```

**Debug Issues:**
```
1. CHEAT-SHEET.md: Quick debugging section
2. TESTING.md: Debug Commands section
3. COMPLETE-GUIDE.md: Troubleshooting section
```

---

## 🚀 Scripts Quick Reference

### start.ps1
**Does:** Start Docker containers + verify health

```powershell
powershell -File start.ps1
```

**Output:**
```
✓ Agenta: HEALTHY
✓ All services started successfully
Services:
  postgres-1         (Healthy)
  redis-1           (Healthy)
  orchestrator-1    (Healthy)
  worker-1          (Started)
```

**When to use:**
- Every morning before testing
- After system restart
- After changes to `.env` credentials

---

### test-event.ps1
**Does:** Send 1 signed error event + poll until completion

```powershell
powershell -File test-event.ps1
```

**Output:**
```
Sending test event...
✓ Event ingested successfully
  Error ID: 5
  Job ID: 5
  Mapped Repo: StayRoom

Polling for job completion...
[14:23:15] Status: queued
[14:23:16] Status: inspecting
[14:23:18] Status: completed

✓ JOB COMPLETED
  PR URL: https://github.com/gauravbisen1/StayRoom/pull/7
  Branch: ai-fix/error-5-1775308719000
  Summary: Inspected StayRoom. Error: TypeError...
```

**When to use:**
- Quick sanity check
- Daily smoke test
- Test individual changes
- Verify credentials work

**Customize:**
Edit these lines in `test-event.ps1`:
```powershell
$payload = @{
    message = "YOUR ERROR MESSAGE HERE"
    stack_trace = "YOUR STACK HERE"
    repo_hint = "StayRoom"  # Change to test different repos
}
```

---

### stress-test.ps1
**Does:** Send 5 signed error events in parallel + track all to completion

```powershell
powershell -File stress-test.ps1
```

**Output:**
```
=== STRESS TEST: 5 Events ===
  [1/5] Error #10 queued
  [2/5] Error #11 queued
  [3/5] Error #12 queued
  [4/5] Error #13 queued
  [5/5] Error #14 queued

✓ All 5 events sent. Polling for completion...
[14:23:15] Progress: 1/5 completed
[14:23:16] Progress: 2/5 completed
[14:23:18] Progress: 3/5 completed
[14:23:20] Progress: 4/5 completed
[14:23:22] Progress: 5/5 completed

=== RESULTS ===
✓ Error #10: COMPLETED (PR: https://...)
✓ Error #11: COMPLETED (PR: https://...)
✓ Error #12: COMPLETED (PR: https://...)
✓ Error #13: COMPLETED (PR: https://...)
✓ Error #14: COMPLETED (PR: https://...)

Summary:
  Completed: 5/5
  Failed: 0/5

✓ ALL TESTS PASSED
```

**When to use:**
- Load testing
- CI/CD pipeline verification
- Capacity testing
- Before production deployment

---

### logs.ps1
**Does:** View Docker logs with filtering options

```powershell
# View last 50 lines of orchestrator
powershell -File logs.ps1 -Service orchestrator

# Follow all logs live
powershell -File logs.ps1 -Follow

# Filter for errors
powershell -File logs.ps1 -Filter "error"

# Follow worker logs filtered for telegram
powershell -File logs.ps1 -Service worker -Follow -Filter "github"
```

**Options:**
- `-Service`: orchestrator, worker, redis, postgres, or all (default)
- `-Lines`: num (default 50, ignored if -Follow)
- `-Follow`: Live tail (Ctrl+C to exit)
- `-Filter`: Pattern to grep (case-insensitive)

**When to use:**
- Monitor processing in real-time
- Debug failures
- Watch for specific keywords
- Verify service startup

---

### stop.ps1
**Does:** Stop all Docker containers cleanly

```powershell
powershell -File stop.ps1
```

**Output:**
```
Stopping AI Agent Pipeline...

✓ All services stopped successfully

To restart, run: powershell -File start.ps1
```

**When to use:**
- End of day shutdown
- Before making Docker changes
- Freeing up system resources
- Clean restart (run start.ps1 after)

---

## 🔧 Configuration (.env)

**Location:** `.env` (root of 3-AI-Agent folder)

**Edit with:**
```powershell
notepad .env
```

**Key Variables:**

| Variable | Purpose | Example | Testing Value |
|----------|---------|---------|--------|
| `GITHUB_TOKEN` | GitHub authentication | `ghp_xxxxx...` | `replace_me` |
| `GITHUB_OWNER` | GitHub username | `gauravbisen1` | Keep as-is |
| `GITHUB_DEFAULT_REPO` | Target repo for PRs | `StayRoom` | Keep as-is |
| `TELEGRAM_BOT_TOKEN` | Telegram bot auth | `123456:ABCxyz...` | `replace_me` |
| `TELEGRAM_CHAT_ID` | Telegram chat ID | `1234567890` | `replace_me` |
| `OPENCLAW_SIGNING_SECRET` | Webhook signature | `your-secret` | `replace_me` |
| `OLLAMA_URL` | Local LLM endpoint | `http://host.docker.internal:11434` | Keep as-is |
| `OLLAMA_MODEL` | LLM model name | `gemma3:1b` | Keep as-is |

**After editing:**
```powershell
powershell -File stop.ps1
powershell -File start.ps1
powershell -File test-event.ps1  # Verify new credentials work
```

---

## 📊 API Endpoints

All relative to `http://localhost:4000`

### GET /health
**Check if API is running**

```powershell
curl http://localhost:4000/health
```

Response:
```json
{
  "ok": true,
  "service": "orchestrator"
}
```

### POST /ingest/opclaw
**Submit an error event (internal use by start.ps1 scripts)**

Header: `X-Opclaw-Signature: sha256=<hmac>`

Request body:
```json
{
  "external_id": "error-123",
  "source": "github",
  "repo_hint": "StayRoom",
  "message": "TypeError: Cannot read property",
  "stack_trace": "at func (file.js:123)"
}
```

Response:
```json
{
  "status": "queued",
  "incomingErrorId": 5,
  "jobId": 5,
  "mappedRepo": "StayRoom"
}
```

### GET /errors/:id
**Check error status**

```powershell
curl http://localhost:4000/errors/5
```

Response:
```json
{
  "id": 5,
  "message": "TypeError: Cannot read property",
  "worker_status": "completed",
  "pr_url": "https://github.com/gauravbisen1/StayRoom/pull/7",
  "branch_name": "ai-fix/error-5-1775308719000",
  "action_summary": "Inspected StayRoom...",
  "checks_status": "passed",
  "created_at": "2026-04-04T14:23:15.000Z"
}
```

---

## 🗄️ Database Access

**Connect to PostgreSQL:**
```powershell
docker compose exec postgres psql -U postgres -d ai_agent
```

**View all errors:**
```sql
SELECT id, message, status, created_at FROM incoming_errors;
```

**View all jobs:**
```sql
SELECT incoming_error_id, worker_status, pr_url, branch_name FROM error_jobs;
```

**Join view:**
```sql
SELECT 
  e.id, 
  e.message, 
  j.worker_status, 
  j.pr_url 
FROM incoming_errors e 
LEFT JOIN error_jobs j ON j.incoming_error_id = e.id
ORDER BY e.created_at DESC;
```

**Exit:**
```
\q
```

---

## 🎯 Common Workflows

### Workflow 1: Quick Morning Test
```powershell
# Terminal 1: Watch logs
powershell -File logs.ps1 -Follow

# Terminal 2: In new terminal
powershell -File start.ps1
powershell -File test-event.ps1
```

### Workflow 2: Validate New Credentials
```powershell
# 1. Edit credentials
notepad .env

# 2. Restart
powershell -File stop.ps1
powershell -File start.ps1

# 3. Test
powershell -File test-event.ps1

# 4. Verify:
#    - Output shows PR URL
#    - GitHub shows new PR
#    - Telegram received message (if credentials filled)
```

### Workflow 3: Debug Failed Job
```powershell
# Find error ID from logs, then:
curl http://localhost:4000/errors/5
# Shows current status and latest action_summary

# Or watch logs while processing:
powershell -File logs.ps1 -Service worker -Follow
```

### Workflow 4: Load Test Before Production
```powershell
powershell -File stress-test.ps1

# All 5 should complete without errors
# Check exit code: $LASTEXITCODE should be 0
```

---

## 📋 Checklist Before Production

- [ ] Real GitHub token in `.env` (starts with `ghp_`)
- [ ] Real Telegram bot token in `.env`
- [ ] Real Telegram chat ID in `.env`
- [ ] `powershell -File test-event.ps1` succeeds
- [ ] `powershell -File stress-test.ps1` succeeds (all 5 complete)
- [ ] PRs visible on GitHub
- [ ] Telegram messages received in chat
- [ ] Database has entries (check with psql)
- [ ] Logs show no "error" messages
- [ ] All containers show "Healthy" or "Running"

---

## 🚀 Ready?

1. **Start:** `powershell -File start.ps1`
2. **Test:** `powershell -File test-event.ps1`
3. **Done!** ✓

For questions, read the guides:
- Quick start: **QUICK-REF.md**
- Full details: **COMPLETE-GUIDE.md**
- Debugging: **TESTING.md**

