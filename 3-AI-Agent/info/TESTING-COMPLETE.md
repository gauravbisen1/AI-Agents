# Testing & Operations Complete Package

## 📦 What Was Created

Your project now has complete testing and operations documentation + scripts:

### 📖 Documentation Files

| File | Purpose | Best For |
|------|---------|----------|
| **COMPLETE-GUIDE.md** | Full reference with architecture, commands, troubleshooting | First-time setup |
| **TESTING.md** | Detailed testing flows, scenarios, debug commands | QA & validation |
| **QUICK-REF.md** | 30-second commands, API reference | Daily usage |
| **CHEAT-SHEET.md** | One-liners, combos, quick debugging | Developers |
| **THIS FILE** | Overview of everything created | Navigation |

### 🚀 Automation Scripts

| Script | What It Does | Usage |
|--------|-------------|-------|
| **start.ps1** | Start all Docker services, wait for health | `powershell -File start.ps1` |
| **stop.ps1** | Stop all Docker services cleanly | `powershell -File stop.ps1` |
| **test-event.ps1** | Send 1 signed error event, poll until finished | `powershell -File test-event.ps1` |
| **stress-test.ps1** | Send 5 events, track all to completion | `powershell -File stress-test.ps1` |
| **logs.ps1** | View Docker logs with filtering | `powershell -File logs.ps1 -Service orchestrator -Follow` |

---

## 🚀 Getting Started (Choose Your Path)

### Path 1: Complete Beginner
1. Read: **COMPLETE-GUIDE.md** (sections: Quick Start + Architecture)
2. Run: `powershell -File start.ps1`
3. Run: `powershell -File test-event.ps1`
4. Done ✓

### Path 2: Daily Testing
1. Read: **QUICK-REF.md** (just the 30-Second Commands section)
2. Use these scripts daily:
   ```powershell
   powershell -File start.ps1        # Morning
   powershell -File test-event.ps1   # Throughout day
   powershell -File stop.ps1         # End of day
   ```

### Path 3: CI/CD Integration
1. Read: **TESTING.md** (Continuous Integration Testing section)
2. Use: `powershell -File stress-test.ps1` (in pipeline)
3. Exit code 0 = all tests passed

### Path 4: Advanced Debugging
1. Read: **CHEAT-SHEET.md** (Command Combos section)
2. Use: `powershell -File logs.ps1 -Follow`
3. Refer to: **TESTING.md** (Debug Commands section)

---

## 📋 Command Reference by Task

### "I want to START testing"
```powershell
powershell -File start.ps1
```

### "I want to SEND a test error"
```powershell
powershell -File test-event.ps1
```

### "I want to STRESS TEST (5 events)"
```powershell
powershell -File stress-test.ps1
```

### "I want to WATCH logs LIVE"
```powershell
powershell -File logs.ps1 -Follow
```

### "I want to STOP everything"
```powershell
powershell -File stop.ps1
```

### "I want to CHANGE test parameters"
Open `test-event.ps1` and edit these lines:
```powershell
$payload = @{
    external_id = "test-..."      # Change this
    message = "YOUR ERROR HERE"    # Change this
    stack_trace = "YOUR TRACE"     # Change this
    repo_hint = "StayRoom"         # Change this
}
```
Then: `powershell -File test-event.ps1`

### "I want to VIEW/SEARCH logs"
```powershell
# View orchestrator logs
powershell -File logs.ps1 -Service orchestrator

# View worker logs
powershell -File logs.ps1 -Service worker

# Filter for errors
powershell -File logs.ps1 -Filter "error"

# Filter for Telegram
powershell -File logs.ps1 -Service orchestrator -Filter "telegram"

# Live tail with filter
powershell -File logs.ps1 -Follow -Filter "github"
```

### "I want to UPDATE credentials"
```powershell
# Edit:
notepad .env

# Then restart:
powershell -File start.ps1
```

### "I want to CHECK database"
```powershell
docker compose exec postgres psql -U postgres -d ai_agent
# Then: SELECT * FROM incoming_errors;
# Exit: \q
```

### "I want to REBUILD everything"
```powershell
docker compose down
docker compose up --build -d
```

---

## 📊 Testing Flow Summary

```
START
  ↓
powershell -File start.ps1
  ├─ Docker containers start
  ├─ Health checks run
  └─ API listens on :4000
  ↓
powershell -File test-event.ps1
  ├─ Creates signed webhook
  ├─ Sends to /ingest/opclaw
  ├─ Polls /errors/:id
  ├─ Waits for worker to complete
  ├─ Shows PR URL on success
  └─ Exit code 0 = success
  ↓
[Optional] Check:
  ├─ GitHub: https://github.com/gauravbisen1/StayRoom/pulls
  ├─ Telegram: Message in chat
  └─ Database: docker compose exec postgres ...
  ↓
powershell -File stop.ps1
  └─ Clean shutdown
END
```

---

## 🎯 What Each File Does (Under The Hood)

### start.ps1
1. Checks Docker is running
2. Does `docker compose up -d`
3. Waits 12 seconds for health checks
4. Verifies API responds to `/health`
5. Shows container status

### test-event.ps1
1. Creates JSON payload with error details
2. Calculates HMAC-SHA256 signature
3. POSTs to `/ingest/opclaw` with signature header
4. Gets back `incomingErrorId`
5. Polls `/errors/{incomingErrorId}` every 1 second
6. Shows final status when `worker_status == "completed"`
7. Displays PR URL and summary
8. Exits with code 0 (success) or 1 (timeout)

### stress-test.ps1
1. Same as test-event.ps1 but for 5 events
2. Sends all 5 events in parallel
3. Tracks completion of each
4. Shows summary at end
5. Exits 0 if all complete, 1 otherwise

### logs.ps1
1. Takes parameters: `-Service`, `-Lines`, `-Follow`, `-Filter`
2. Builds `docker compose logs` command
3. Optional grep/filter by pattern
4. Outputs to console

### stop.ps1
1. Does `docker compose down`
2. Shows confirmation

---

## 🔍 How to Interpret Output

### Successful test-event.ps1 Output
```
Sending test event...

✓ Event ingested successfully
  Error ID: 2
  Job ID: 2
  Mapped Repo: StayRoom

Polling for job completion...
[14:23:15] Status: queued
[14:23:16] Status: inspecting
[14:23:18] Status: completed

✓ JOB COMPLETED
  PR URL: https://github.com/gauravbisen1/StayRoom/pull/5
  Branch: ai-fix/error-2-1775308719000
  Summary: Inspected StayRoom. Error: TypeError...
```

### Successful stress-test.ps1 Output
```
=== STRESS TEST: 5 Events ===
  [1/5] Error #10 queued
  [2/5] Error #11 queued
  [3/5] Error #12 queued
  [4/5] Error #13 queued
  [5/5] Error #14 queued

✓ All 5 events sent. Polling for completion...
Progress: 1/5 completed
Progress: 2/5 completed
Progress: 3/5 completed
Progress: 4/5 completed
Progress: 5/5 completed

=== RESULTS ===
✓ Error #10: COMPLETED
  PR: https://github.com/...
✓ Error #11: COMPLETED
  PR: https://github.com/...
[... etc ...]
Summary:
  Completed: 5/5
  Failed: 0/5

✓ ALL TESTS PASSED
```

---

## 🐳 Understanding Docker Logs

When you run `powershell -File logs.ps1 -Follow`, you'll see:

```
orchestrator-1  | orchestrator listening on :4000
worker-1        | worker started
postgres-1      | database system is ready to accept connections
redis-1         | oO0OoO0OoO0Oo Redis is starting...

# When you send a test event:
orchestrator-1  | [webhook received]
worker-1        | [processing job]
orchestrator-1  | telegram sent successfully for error 1
```

### Good signs:
- ✅ "listening on :4000"
- ✅ "worker started"
- ✅ "telegram sent successfully"
- ✅ "PR created at https://..."

### Bad signs:
- ❌ "error" or "Error" or "ERROR"
- ❌ "connection refused"
- ❌ "timeout"
- ❌ "invalid signature"

---

## 📈 Performance Expectations

When you run **test-event.ps1**:
- Ingestion: <100ms
- Queueing: <500ms
- Processing: 2-5 seconds (Ollama + GitHub)
- Callback: <1s
- **Total: 3-7 seconds typical**

When you run **stress-test.ps1** (5 events):
- All start roughly simultaneously
- Each takes 3-7 seconds
- Total time: ~7-15 seconds for all 5 to complete

---

## 🔐 Credentials Configuration

### Three Credential Levels

**Level 1: Testing (No GitHub/Telegram)**
```ini
GITHUB_TOKEN=replace_me          # PR creation skipped
GITHUB_DEFAULT_REPO=StayRoom

TELEGRAM_BOT_TOKEN=replace_me    # Telegram skipped
TELEGRAM_CHAT_ID=replace_me

OPENCLAW_SIGNING_SECRET=replace_me
```
Result: Error processed but PR creation + Telegram sending skipped

**Level 2: GitHub Only** (Remove "replace_me" from GitHub fields)
```ini
GITHUB_TOKEN=ghp_xxxxxxxxxxxx   # Real token
GITHUB_DEFAULT_REPO=StayRoom

TELEGRAM_BOT_TOKEN=replace_me    # Telegram still skipped
TELEGRAM_CHAT_ID=replace_me
```
Result: PRs created on GitHub, Telegram skipped

**Level 3: Full (GitHub + Telegram)** (All real values)
```ini
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
GITHUB_DEFAULT_REPO=StayRoom

TELEGRAM_BOT_TOKEN=xxxxxxxxxxxx
TELEGRAM_CHAT_ID=1234567890
```
Result: PRs created + Telegram messages sent

### How to Update Credentials
```powershell
# Edit .env file
notepad .env

# Change values, then restart:
powershell -File stop.ps1
powershell -File start.ps1

# Verify with test:
powershell -File test-event.ps1
```

---

## 📞 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Scripts won't run | Check execution policy: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` |
| "Port already in use" | `powershell -File stop.ps1` or restart Docker |
| "Ollama unreachable" | Make sure local Ollama is running: `ollama list` |
| "GitHub PR not created" | Check GITHUB_TOKEN in .env (should start with `ghp_`) |
| "Telegram not received" | Check TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env |
| "Job stuck processing" | Restart: `docker compose restart worker` |
| "Database connection error" | Full restart: `powershell -File stop.ps1 && powershell -File start.ps1` |

---

## 🎓 Learning Path

1. **Start here:** QUICK-REF.md (5 min read)
2. **Then run:** `powershell -File start.ps1`
3. **Then test:** `powershell -File test-event.ps1`
4. **For details:** COMPLETE-GUIDE.md (thorough reference)
5. **For debugging:** TESTING.md (all debug commands)
6. **For speed:** CHEAT-SHEET.md (one-liners)

---

## 🚀 You're Ready!

Everything is set up. Pick one:

**Just want to test?**
```powershell
powershell -File start.ps1
powershell -File test-event.ps1
```

**Want full reference?**
Open: `COMPLETE-GUIDE.md`

**Want quick commands?**
Open: `QUICK-REF.md`

**Want all the details?**
Open: `TESTING.md`

**Want one-liners?**
Open: `CHEAT-SHEET.md`

---

**Happy testing!** 🎉

