# Quick Reference

## ⚡ 30-Second Commands

### Start Everything
```powershell
cd "c:\Users\91896\.vscode\AI-Agents\3-AI-Agent"
docker compose up -d
docker compose logs -f
```

### Send Test Event
```powershell
cd "c:\Users\91896\.vscode\AI-Agents\3-AI-Agent"
# Copy the full script from TESTING.md → "Command Template"
# Or use: powershell -File test-event.ps1
```

### View Live Logs
```powershell
cd "c:\Users\91896\.vscode\AI-Agents\3-AI-Agent"

# All logs live-tail
docker compose logs -f

# Just orchestrator (API/Telegram)
docker compose logs -f orchestrator

# Just worker (processing)
docker compose logs -f worker
```

### Check Status
```powershell
cd "c:\Users\91896\.vscode\AI-Agents\3-AI-Agent"

# Are containers running?
docker compose ps

# Get latest error
$latest = curl http://localhost:4000/errors/999 2>/dev/null
# (adjust 999 to latest ID)
```

### Stop Everything
```powershell
cd "c:\Users\91896\.vscode\AI-Agents\3-AI-Agent"
docker compose down
```

---

## 🎯 Most Common Test Scenarios

### Scenario 1: Quick Sanity Check (2 min)
1. **Start:** `docker compose up -d` (wait 10 sec)
2. **Check health:** `curl http://localhost:4000/health`
3. **Send event:** Run test event command
4. **Poll:** `curl http://localhost:4000/errors/1`
5. **Verify:** See `"pr_url": "https://github.com/..."`

### Scenario 2: Full E2E with Logs (5 min)
1. **Terminal 1 - Logs:** `docker compose logs -f`
2. **Terminal 2 - Test:**
   - Send event: `powershell -File test-event.ps1`
   - Poll: `curl http://localhost:4000/errors/2`
   - Expected: PR created + "telegram sent successfully"

### Scenario 3: Stress Test (10 min)
1. **Start:** `docker compose up -d`
2. **Run:** `powershell -File stress-test.ps1` (sends 10 events rapidly)
3. **Monitor:** `docker compose logs -f orchestrator`
4. **Verify:** All events reach "completed"

---

## 📊 Docker Compose Cheat Sheet

| Command | Purpose |
|---------|---------|
| `docker compose up -d` | Start all services in background |
| `docker compose up --build -d` | Rebuild images and start |
| `docker compose down` | Stop and remove all containers |
| `docker compose restart orchestrator` | Restart one service |
| `docker compose logs -f` | Follow all logs live |
| `docker compose ps` | Show container status |
| `docker compose exec postgres psql -U postgres -d ai_agent` | Connect to database |
| `docker compose exec redis redis-cli` | Connect to Redis CLI |

---

## 🔗 API Reference

### Ingest Error
```
POST http://localhost:4000/ingest/opclaw
Header: X-Opclaw-Signature: sha256=<hmac-hex>
Body: JSON with external_id, source, repo_hint, message, stack_trace
Response: {status, incomingErrorId, jobId, mappedRepo}
```

### Get Error Status
```
GET http://localhost:4000/errors/{incomingErrorId}
Response: {id, message, worker_status, pr_url, action_summary, ...}
```

### Health Check
```
GET http://localhost:4000/health
Response: {ok: true, service: "orchestrator"}
```

---

## 🔐 Credentials Checklist

Before running tests, verify in `.env`:

- ✅ `GITHUB_TOKEN` - Real GitHub token (or "replace_me" if testing without GitHub)
- ✅ `GITHUB_OWNER` - Your GitHub username
- ✅ `GITHUB_DEFAULT_REPO` - Target repo
- ✅ `TELEGRAM_BOT_TOKEN` - Real Telegram bot token (or "replace_me" if testing without Telegram)
- ✅ `TELEGRAM_CHAT_ID` - Your Telegram chat ID
- ✅ `OPENCLAW_SIGNING_SECRET` - "replace_me" (for testing, use real value in production)
- ✅ `OLLAMA_URL` - `http://host.docker.internal:11434` (for local Ollama)
- ✅ `OLLAMA_MODEL` - `gemma3:1b` (or your installed model)

---

## 📂 Project Structure for Reference

```
3-AI-Agent/
├── docker-compose.yml          ← Start/stop everything
├── .env                        ← Configuration (with real credentials)
├── .env.example                ← Template
├── TESTING.md                  ← This file
├── QUICK-REF.md                ← You are here
├── package.json                ← Monorepo config
├── apps/
│   ├── orchestrator/           ← API gateway + Telegram
│   │   └── src/index.js        ← Routes: /ingest/opclaw, /errors/:id, /callback
│   └── worker/                 ← Job processor + GitHub + Ollama
│       └── src/index.js        ← BullMQ processor
└── infra/
    └── postgres/
        └── init.sql            ← Database schema
```

---

## 🎬 Live Testing Workflow

**Best Practice for Daily Testing:**

```powershell
# Terminal 1: Watch logs
docker compose logs -f orchestrator

# Terminal 2: Run tests
# Copy-paste from TESTING.md
```

**What to Watch For:**
- `orchestrator listening on :4000` ✓ (API ready)
- `worker started` ✓ (processor ready)
- `telegram sent successfully for error N` ✓ (notification sent)
- Any `error` or `Error` ✗ (investigate)

---

## 🚀 Next Steps

1. **Save this file**: You're reading it ✓
2. **Bookmark TESTING.md**: Full reference guide
3. **Test daily**: Use "30-Second Commands" above
4. **Monitor logs**: Always run `docker compose logs -f` in background terminal
5. **Check GitHub**: PRs appear at `https://github.com/gauravbisen1/StayRoom/pulls`
6. **Check Telegram**: Messages arrive at chat `1777880773`

---

## ❓ FAQ

**Q: How fast should events process?**
A: 3-7 seconds total (ingestion → PR creation → Telegram)

**Q: Can I test with GitHub/Telegram disabled?**
A: Yes, set to "replace_me" and logs will show "skipped"

**Q: My Ollama is offline, what happens?**
A: Worker uses fallback error description, still creates PR

**Q: How do I see which events failed?**
A: `docker compose logs worker | grep -i error`

**Q: Can I run tests in parallel?**
A: Yes, queue handles concurrent events fine (tested 5+ simultaneous)

**Q: Where are created PRs?**
A: `https://github.com/gauravbisen1/StayRoom/pulls`

