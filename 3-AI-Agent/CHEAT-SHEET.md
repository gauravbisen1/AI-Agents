# Developer Cheat Sheet

## One-Liners

```powershell
# Start everything
cd c:\Users\91896\.vscode\AI-Agents\3-AI-Agent; powershell -File start.ps1

# Watch logs
powershell -File logs.ps1 -Follow

# Send test event
powershell -File test-event.ps1

# Stress test (5 events)
powershell -File stress-test.ps1

# Stop everything
powershell -File stop.ps1

# Full rebuild
docker compose down; docker compose up --build -d

# Check health
curl http://localhost:4000/health

# Get error status
curl http://localhost:4000/errors/1

# See all running containers
docker compose ps

# Connect to database
docker compose exec postgres psql -U postgres -d ai_agent
```

---

## Command Combos

### "I just woke up, test everything"
```powershell
cd c:\Users\91896\.vscode\AI-Agents\3-AI-Agent
powershell -File stop.ps1
powershell -File start.ps1
Start-Sleep 5
powershell -File stress-test.ps1
```

### "Watch logs while testing"
```powershell
# Terminal 1:
powershell -File logs.ps1 -Follow

# Terminal 2:
powershell -File test-event.ps1
```

### "Test only GitHub functionality"
```powershell
# Set GITHUB_TOKEN in .env, test others as "replace_me"
powershell -File test-event.ps1
# Check PR created: https://github.com/gauravbisen1/StayRoom/pulls
```

### "Test only Telegram functionality"
```powershell
# Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env
powershell -File test-event.ps1
# Check Telegram chat for message
```

### "Find all errors in logs"
```powershell
docker compose logs | Select-String -Pattern "error|fail|ERROR"
```

### "See what services are running"
```powershell
docker compose ps
```

### "Restart just the worker"
```powershell
docker compose restart worker
```

### "See database state"
```powershell
docker compose exec postgres psql -U postgres -d ai_agent -c \
"SELECT id, message, worker_status FROM incoming_errors LEFT JOIN error_jobs USING(incoming_error_id);"
```

---

## Key Concepts

**Ingest (API Input):**
- Endpoint: `POST /ingest/opclaw`
- Signature: HMAC-SHA256 with `X-Opclaw-Signature` header
- Response: `{incomingErrorId, jobId, mappedRepo}`

**Processing (Queue):**
- Queue: BullMQ on Redis
- Job: `{incomingErrorId, mappedRepo, payload}`
- Status: queued → processing → completed/failed

**Output (GitHub + Telegram):**
- PR: Created in GitHub repo with fix suggestions
- Branch: `ai-fix/error-{id}-{timestamp}`
- File: `AI_AGENT_REPORT.md` with LLM analysis
- Telegram: Message sent to chat on completion

---

## Quick Debugging

| Symptom | Check |
|---------|-------|
| API not responding | `curl http://localhost:4000/health` |
| Job not processing | `docker compose logs worker \| grep -i error` |
| PR not created | Check GitHub token in `.env` |
| Telegram not received | Check bot token + chat ID in `.env` |
| Ollama not used | `ollama list` on host machine |
| Database missing | `docker compose logs postgres` |

---

## Reset to Clean State

```powershell
# Delete everything and restart
docker compose down -v
docker compose up --build -d
```

---

## Performance Targets

- Single event: <10s total
- 5 events (stress test): <30s with fallback
- Ollama LLM: 1-3s locally
- GitHub PR creation: 1-2s
- Queue latency: <1s

Check performance:
```powershell
$start = Get-Date
powershell -File test-event.ps1
"Elapsed: $((Get-Date) - $start)"
```

---

## Production Readiness Checklist

- [ ] Real GitHub token (ghp_... format)
- [ ] Real GitHub repo name
- [ ] Real Telegram bot token
- [ ] Real Telegram chat ID
- [ ] OPENCLAW_SIGNING_SECRET set correctly
- [ ] Ollama running with gemma3:1b (or desired model)
- [ ] 5+ stress test events succeed
- [ ] PRs visible on GitHub
- [ ] Telegram messages received in chat
- [ ] Database persists events across restarts

---

## Files Created for Testing

```
3-AI-Agent/
├── TESTING.md              ← Full testing reference
├── QUICK-REF.md           ← Quick commands
├── COMPLETE-GUIDE.md      ← Full documentation
├── CHEAT-SHEET.md         ← You are here
├── start.ps1              ← Start script
├── stop.ps1               ← Stop script
├── logs.ps1               ← Log viewer script
├── test-event.ps1         ← Single event test
├── stress-test.ps1        ← Multiple event test
└── (original files...)
```

---

## Next Level

**Want to customize?**
- Edit `test-event.ps1` to change test payload
- Edit `apps/agenta/src/index.js` for API logic
- Edit `apps/worker/src/index.js` for processing logic
- Edit `.env` for credentials

**Want to monitor?**
- Set up Prometheus + Grafana for metrics
- Add APM (Application Performance Monitoring)
- Set up alert thresholds for failures

**Want to scale?**
- Deploy to Kubernetes
- Use AWS/GCP/Azure managed services
- Set up CI/CD pipeline
- Add load balancing

