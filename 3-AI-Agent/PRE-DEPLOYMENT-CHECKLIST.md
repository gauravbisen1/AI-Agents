# ⚠️ PRE-DEPLOYMENT CHECKLIST

## CRITICAL: Exposed Credentials ⚠️
Your `.env` file contains **REAL, EXPOSED CREDENTIALS**. Before deploying anywhere public:

### Immediate Actions Required:
1. **Rotate GitHub Token** (COMPROMISED - visible in history)
   ```
   Current: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (REDACTED)
   Action: Go to https://github.com/settings/tokens → Delete → Create new
   Update: .env GITHUB_TOKEN
   ```

2. **Rotate Telegram Bot Token** (COMPROMISED - visible in history)
   ```
   Current: xxxxxxxxxx:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (REDACTED)
   Action: https://t.me/BotFather → /revoke → Create new bot
   Update: .env TELEGRAM_BOT_TOKEN
   ```

3. **Generate New Webhook Secret** (COMPROMISED)
   ```
   Current: xxxxxxxxxxxxxxxx (REDACTED)
   Action: Generate random: openssl rand -hex 32
   Update: .env TELEGRAM_WEBHOOK_SECRET
   ```

4. **Rotate Signing Secret** (visible in history)
   ```
   Current: xxxxxxx (REDACTED - weak)
   Action: Generate random: openssl rand -hex 32
   Update: .env OPENCLAW_SIGNING_SECRET
   ```

5. **Add .env to .gitignore** (critical!)
   ```sh
   echo ".env" >> .gitignore
   git rm --cached .env
   git commit -m "Remove .env from tracking"
   ```

---

## ✅ System Health Verification

### Database
- [x] PostgreSQL: **HEALTHY** (tables: incoming_errors, error_jobs)
- [x] Schema initialized correctly
- [x] All migrations applied

### Services
- [x] **agenta** (API Gateway): HEALTHY
  - Port: 4000
  - Health check: `GET /health` → `{"ok": true, "service": "agenta"}`
  
- [x] **worker** (Job Processor): RUNNING
  - Consumes jobs from Redis queue
  - Processes: clone → inspect → fix → test → PR
  
- [x] **Redis**: HEALTHY
  - Port: 6379
  - Queue name: `error-triage`
  
- [x] **PostgreSQL**: HEALTHY
  - Port: 5432
  - Database: `ai_agent`

### API Endpoints
- [x] `GET /` → service info + routes list
- [x] `GET /health` → health check
- [x] `POST /ingest/telegram` → ingestion with secret validation
- [x] `POST /ingest/opclaw` → OpenClaw compatibility
- [x] `GET /errors/:id` → status polling
- [x] `POST /callback/worker-result` → worker callback

---

## 📋 Pre-Production Configuration

### Environment Variables - What Each Does:
```
NODE_ENV=development           # Change to "production" before deploy
PORT=4000                      # API port
DATABASE_URL=...              # Postgres connection
REDIS_URL=...                 # Redis queue broker
OLLAMA_URL=...                # Local LLM (host.docker.internal for Docker)
OLLAMA_MODEL=gemma3:1b        # Model name
ORCHESTRATOR_CALLBACK_URL=... # Worker callback endpoint
GITHUB_TOKEN=...              # ⚠️ ROTATE THIS
GITHUB_OWNER=...              # Your GitHub username
GITHUB_DEFAULT_REPO=...       # Default repo for PRs
GITHUB_BASE_BRANCH=main       # PR target branch
SANDBOX_ROOT=/tmp/...         # Temp dir for cloned repos
TELEGRAM_BOT_TOKEN=...        # ⚠️ ROTATE THIS
TELEGRAM_CHAT_ID=...          # Authorized chat ID
TELEGRAM_WEBHOOK_SECRET=...   # ⚠️ ROTATE THIS
OPENCLAW_SIGNING_SECRET=...   # ⚠️ ROTATE THIS
QUEUE_NAME=error-triage       # Queue identifier
MAX_JOB_ATTEMPTS=2            # Retry attempts
```

---

## 🚀 Deployment Options

### Option 1: Render (Recommended)
**Cost**: Free for small loads, scales automatically
**Steps**:
1. Create account at [render.com](https://render.com)
2. Connect GitHub repo
3. Create 5 services:
   - **Web Service**: agenta (public)
   - **Background Worker**: worker (private)
   - **Managed DB**: PostgreSQL Postgres 16
   - **Managed Cache**: Redis
   - Attach all 4 as dependencies to web service
4. Add environment variables (use Render secrets for sensitive data)
5. Set webhook URL: `https://<render-web-service-url>/ingest/telegram`
6. Register with Telegram: `curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook...`

### Option 2: Railway
**Cost**: $5/month minimum
**Steps**: Similar to Render, uses `railway.json` config

### Option 3: Self-Hosted (AWS/Azure/DigitalOcean)
**Cost**: $5-20/month minimum
**Required**:
- Docker installed
- Docker Compose
- Reverse proxy (nginx/Caddy)
- SSL certificate (Let's Encrypt)

---

## 🔒 Security Checklist

Before any public deployment:

- [ ] All credentials rotated (GitHub, Telegram, secrets)
- [ ] `.env` added to `.gitignore`
- [ ] No hardcoded secrets in code
- [ ] `NODE_ENV=production`
- [ ] Database user has strong password (not default postgres:postgres)
- [ ] Redis requires password authentication
- [ ] API has rate limiting (if public)
- [ ] Webhook signatures validated (HMAC)
- [ ] HTTPS enabled (SSL certificate)
- [ ] Database backups configured
- [ ] Monitoring/alerting set up
- [ ] Log aggregation configured (CloudWatch, Datadog, etc.)

---

## 🧪 Final Testing Before Deploy

### Test 1: Telegram Ingestion
```powershell
# Send test event
$json = '{
  "message": { "message_id": 999, "chat": { "id": 1777880773 }, "text": "Test error\nrepo: StayRoom\nstack: test" },
  "update_id": 999
}'
curl -X POST http://localhost:4000/ingest/telegram `
  -H "Content-Type: application/json" `
  -H "x-telegram-bot-api-secret-token: abcdefgh" `
  -d $json

# Check status within 30 seconds
curl http://localhost:4000/errors/1
```

### Test 2: Database Persistence
```powershell
docker exec 3-ai-agent-postgres-1 psql -U postgres -d ai_agent -c "SELECT COUNT(*) FROM incoming_errors;"
```

### Test 3: Worker Processing
```powershell
# View worker logs
docker compose logs -f worker
```

### Test 4: Full E2E Flow
- Send Telegram event
- Watch logs: `docker compose logs -f`
- Check PR created in GitHub
- Verify status persists: `GET /errors/{id}`
- Check Telegram receives result

---

## 📦 Docker Image Sizes (Optimization)

Current:
- agenta: ~160MB
- worker: ~165MB

To optimize for production:
```dockerfile
# Use multi-stage build
FROM node:20-alpine AS builder
COPY package*.json ./
RUN npm install

FROM node:20-alpine
COPY --from=builder /app/node_modules ./node_modules
COPY . .
```

---

## 🎯 Hosting Recommendation Summary

| Platform | Ease | Cost | Scaling | Setup Time |
|----------|------|------|---------|-----------|
| **Render** ⭐ | Very Easy | Free → Scale | Auto | 10 min |
| Railway | Easy | $5-20/mo | Auto | 15 min |
| Railway | Easy | $5-20/mo | Auto | 15 min |
| DigitalOcean App | Medium | $12/mo | Manual | 20 min |
| AWS Lambda | Hard | Pay/use | Auto | 1 hour |
| Docker Hub | Hard | $5-20 | Manual | 30 min |

**Recommended**: Start with **Render** (free tier, auto-scaling, minimal config)

---

## ✅ What's Ready

- [x] All code implemented and tested locally
- [x] Database schema ready
- [x] Docker Compose configuration complete
- [x] Dockerfile for both services
- [x] All API endpoints working
- [x] Worker pipeline fully functional
- [x] Error handling and retries in place
- [x] Logging configured
- [x] Service health checks implemented

---

## ❌ What's NOT Ready Yet

- [ ] Credentials rotated
- [ ] .env in .gitignore
- [ ] Production environment selected
- [ ] Hosting account created
- [ ] Services deployed to cloud
- [ ] Telegram webhook registered with public URL
- [ ] Monitoring/alerting set up
- [ ] Database backups scheduled

---

## Next Steps

1. **IMMEDIATE**: Rotate all credentials (see top of this document)
2. **TODAY**: Choose hosting platform (Render recommended)
3. **TODAY**: Create accounts and review pricing
4. **TOMORROW**: Deploy to production
5. **AFTER**: Register Telegram webhook with public URL
6. **AFTER**: Test full end-to-end flow

---

## Support & Troubleshooting

### Common Issues

**"Port 4000 already in use"**
```powershell
docker compose down
docker system prune -f
docker compose up -d
```

**"Database connection failed"**
```powershell
docker compose logs postgres
# Check DATABASE_URL matches docker-compose.yml
```

**"Worker not processing jobs"**
```powershell
docker compose logs worker
# Check REDIS_URL, DATABASE_URL
```

**"Telegram webhook not working"**
```powershell
# Verify webhook registered
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
# Should show: "url": "https://<your-public-url>/ingest/telegram"
```

**"LLM not responding"**
```powershell
# Check Ollama running on host
curl http://localhost:11434
# Verify OLLAMA_URL in .env points to host.docker.internal:11434
```

---

**Status**: ✅ **READY FOR DEPLOYMENT** (after credentials rotation)

Last Updated: April 5, 2026
