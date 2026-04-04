# AI Agent Pipeline Testing Guide

## 📋 Testing Flow

### Test Scenario 1: Basic End-to-End Flow
**Purpose:** Verify error ingestion → queueing → processing → PR creation → Telegram notification

**Steps:**
1. Start stack (fresh or already running)
2. Send signed webhook with error details
3. Poll status endpoint until `worker_status = 'completed'`
4. Verify PR was created on GitHub
5. Verify Telegram message was received

**Expected Results:**
- Ingest response: `{status: "queued", incomingErrorId: N, jobId: N, mappedRepo: "..."}`
- GET /errors/:id shows `worker_status: "completed"` with real `pr_url`
- Agenta logs: `telegram sent successfully for error N`
- GitHub repo: New PR branch `ai-fix/error-N-{timestamp}`

---

### Test Scenario 2: Repo Mapping Verification
**Purpose:** Test different repo hints resolve to correct GitHub repos

**Test Cases:**
- `repo_hint: "StayRoom"` → maps to `StayRoom`
- `repo_hint: "auth"` → maps to `auth-service`
- `repo_hint: "payment"` → maps to `payment-service`
- `repo_hint: "unknown"` → falls back to `GITHUB_DEFAULT_REPO`

**How to Test:**
Send events with different `repo_hint` values and verify `mapped_repo` field in response.

---

### Test Scenario 3: Ollama Integration
**Purpose:** Verify LLM generates realistic fix suggestions

**Check:**
- `action_summary` contains substantive LLM output (not fallback text)
- Response time reasonable (<5 seconds typically)
- Same error generates varied suggestions (not cached)

**How to Test:**
Send same error twice, compare `action_summary` responses for variation.

---

### Test Scenario 4: Error Handling
**Purpose:** Verify graceful degradation when services unavailable

**Cases:**
1. **Ollama Offline:** Should use fallback error description, continue to PR creation
2. **GitHub Token Invalid:** Should skip PR creation but still complete with null `pr_url`
3. **Telegram Down:** Should log error but not fail callback
4. **Database Offline:** Stack won't start (expected)

---

## 🚀 Quick Start Commands

### 1. Start Stack (Clean)
```powershell
cd "c:\Users\91896\.vscode\AI-Agents\3-AI-Agent"
docker compose down
docker compose up --build -d
Start-Sleep -Seconds 10  # Wait for health checks
```

### 2. Start Stack (Existing)
```powershell
cd "c:\Users\91896\.vscode\AI-Agents\3-AI-Agent"
docker compose up -d
```

### 3. Stop Stack
```powershell
cd "c:\Users\91896\.vscode\AI-Agents\3-AI-Agent"
docker compose down
```

---

## 📤 Send Test Events

### Command Template (Copy-Paste Ready)
```powershell
cd "c:\Users\91896\.vscode\AI-Agents\3-AI-Agent"

$secret = "replace_me"
$payload = @{
    external_id = "test-$(Get-Date -Format 'yyyyMMddHHmmss')"
    source = "github"
    repo_hint = "StayRoom"
    message = "TypeError: Cannot read property of undefined"
    stack_trace = "at processData (index.js:42:15)"
} | ConvertTo-Json -Compress

$bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($secret)
$signature = "sha256=" + (-join ($hmac.ComputeHash($bytes) | ForEach-Object {$_.ToString("x2")}))

$response = Invoke-RestMethod -Uri "http://localhost:4000/ingest/opclaw" -Method Post -Headers @{
    "X-Opclaw-Signature" = $signature
} -ContentType "application/json" -Body $payload

Write-Host "✓ Ingested error #$($response.incomingErrorId)" -ForegroundColor Green
$errorId = $response.incomingErrorId
$response | ConvertTo-Json
```

### Predefined Test Events

**Test 1: ReferenceError**
```powershell
$payload = @{
    external_id = "ref-error-001"
    source = "github"
    repo_hint = "StayRoom"
    message = "ReferenceError: user is not defined"
    stack_trace = "at getUserName (auth.js:15:5)"
}
```

**Test 2: TypeError - Array Access**
```powershell
$payload = @{
    external_id = "type-error-001"
    source = "github"
    repo_hint = "StayRoom"
    message = "TypeError: Cannot read property 'id' of undefined"
    stack_trace = "at parseResponse (utils.js:24:8)"
}
```

**Test 3: JSON Parse Error**
```powershell
$payload = @{
    external_id = "json-error-001"
    source = "github"
    repo_hint = "auth"
    message = "SyntaxError: Unexpected token < in JSON at position 0"
    stack_trace = "at JSON.parse (native)"
}
```

---

## 🔍 Poll for Job Status

### Poll Until Completion (Auto-Stop)
```powershell
cd "c:\Users\91896\.vscode\AI-Agents\3-AI-Agent"

$errorId = 1  # Replace with your incomingErrorId

Write-Host "Polling error #$errorId..." -ForegroundColor Cyan
for ($i = 0; $i -lt 30; $i++) {
    try {
        $result = Invoke-RestMethod -Uri "http://localhost:4000/errors/$errorId" -Method Get -ErrorAction Stop
        $status = $result.worker_status
        $timestamp = Get-Date -Format "HH:mm:ss"
        
        Write-Host "[$timestamp] Poll $($i+1): $status" -ForegroundColor Cyan
        
        if ($status -eq "completed") {
            Write-Host "`n✓ JOB COMPLETED" -ForegroundColor Green
            Write-Host "PR URL: $($result.pr_url)"
            Write-Host "Branch: $($result.branch_name)"
            Write-Host "Summary: $($result.action_summary.Substring(0, 200))..."
            break
        }
    } catch { 
        Write-Host "Not found yet... (will retry)"
    }
    Start-Sleep -Milliseconds 1000
}
```

### Get Full Job Details
```powershell
$errorId = 1  # Replace with your incomingErrorId
Invoke-RestMethod -Uri "http://localhost:4000/errors/$errorId" -Method Get | ConvertTo-Json -Depth 10
```

---

## 📊 Docker Logs Commands

### View All Logs (Live)
```powershell
cd "c:\Users\91896\.vscode\AI-Agents\3-AI-Agent"
docker compose logs -f
```

### View Specific Service Logs (Live)
```powershell
# Agenta (API gateway + Telegram)
docker compose logs -f agenta

# Worker (Job processor + GitHub + Ollama)
docker compose logs -f worker

# Redis (Queue)
docker compose logs -f redis

# PostgreSQL (Database)
docker compose logs -f postgres
```

### View Last N Lines
```powershell
# Last 50 lines of agenta
docker compose logs agenta --tail 50

# Last 30 lines of worker
docker compose logs worker --tail 30

# All services, last 20 lines
docker compose logs --tail 20
```

### Follow Logs with Grep (Filter)
```powershell
# Show all errors
docker compose logs | Select-String -Pattern "error|Error|ERROR"

# Show Telegram activity
docker compose logs | Select-String -Pattern "telegram"

# Show GitHub activity
docker compose logs | Select-String -Pattern "github|git|branch|PR"

# Live filter for telegram (orchest only)
docker compose logs -f agenta | Select-String -Pattern "telegram"
```

### Check Container Health
```powershell
docker compose ps
# Shows: Container name | Image | Status | Health
```

---

## 🐢 Debug Commands

### Shell into Container
```powershell
# Agenta shell
docker compose exec agenta sh

# Worker shell
docker compose exec worker sh

# PostgreSQL shell
docker compose exec postgres psql -U postgres -d ai_agent
```

### Check Database State
```powershell
# Connect to DB
docker compose exec postgres psql -U postgres -d ai_agent

# Then run SQL:
# List all errors
SELECT id, message, status FROM incoming_errors;

# List all jobs
SELECT incoming_error_id, worker_status, pr_url FROM error_jobs;

# Join view
SELECT 
    e.id, 
    e.message, 
    j.worker_status, 
    j.pr_url 
FROM incoming_errors e 
LEFT JOIN error_jobs j ON j.incoming_error_id = e.id;

# Exit
\q
```

### Check Redis Queue
```powershell
# Connect
docker compose exec redis redis-cli

# List jobs in error-triage queue
LRANGE error-triage:5 0 -1

# Count pending jobs
LLEN error-triage:5

# Exit
exit
```

### Validate Configuration
```powershell
cd "c:\Users\91896\.vscode\AI-Agents\3-AI-Agent"

# Check compose syntax
docker compose config

# Check .env values
Get-Content .env | Select-String -Pattern "^[^#]"

# Run npm syntax check
docker compose exec agenta npm run check
```

---

## 📱 Verify Telegram Delivery

### Option 1: Check Telegram Chat (Manual)
1. Open Telegram app / web
2. Navigate to chat_id: `1777880773`
3. Look for messages titled "AI Agent result for error #N"
4. Expected format:
   ```
   AI Agent result for error #1
   Status: completed
   PR: https://github.com/gauravbisen1/StayRoom/pull/1
   
   [LLM analysis + PR summary]
   ```

### Option 2: Check Logs
```powershell
# Wait for telegram confirmation
docker compose logs agenta | Select-String -Pattern "telegram"

# Expected output:
# "telegram sent successfully for error 1"
```

---

## 🔐 Credentials Used in Testing

**Current Configuration:**
```
GITHUB_TOKEN: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (REDACTED)
GITHUB_OWNER: gauravbisen1
GITHUB_DEFAULT_REPO: StayRoom

TELEGRAM_BOT_TOKEN: xxxxxxxxxx:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (REDACTED)
TELEGRAM_CHAT_ID: 1777880773

OPENCLAW_SIGNING_SECRET: replace_me
```

**To Update:**
Edit [.env](.env) and restart: `docker compose up --build -d`

---

## 🎯 Test Checklist

- [ ] Stack starts without errors (`docker compose up -d`)
- [ ] Health endpoint responds: `http://localhost:4000/health`
- [ ] Send signed webhook (`/ingest/opclaw`)
- [ ] Response shows queued status
- [ ] Poll `/errors/:id` until completed
- [ ] `pr_url` is valid GitHub link (not null)
- [ ] `action_summary` contains LLM analysis
- [ ] Agenta logs show "telegram sent successfully"
- [ ] Telegram message received in chat
- [ ] Check PR on GitHub (branch + AI_AGENT_REPORT.md file)

---

## 🚨 Common Issues & Fixes

| Issue | Command to Check | Fix |
|-------|------------------|-----|
| Signature validation fails | `docker compose logs agenta \| grep -i signature` | Ensure OPENCLAW_SIGNING_SECRET matches |
| Ollama unavailable | `docker compose logs worker \| grep -i ollama` | Verify local Ollama running: `ollama list` |
| GitHub token invalid | `docker compose logs worker \| grep -i github` | Update GITHUB_TOKEN in `.env` |
| Telegram send fails | `docker compose logs agenta \| grep -i telegram` | Check TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID |
| Jobs stuck in queue | `docker compose exec redis redis-cli LLEN error-triage:5` | Restart worker: `docker compose restart worker` |
| Database schema mismatch | `docker compose logs postgres` | Run migrations: `docker compose restart postgres` |

---

## 📈 Performance Metrics

**Expected Timings (per event):**
- Ingestion → Queued: <100ms
- Queued → Worker picks up: <500ms
- Worker processes (Ollama + GitHub): 2-5 seconds
- Callback → Telegram sent: <1 second
- **Total end-to-end: 3-7 seconds**

**Check performance:**
```powershell
# Measure full cycle
$start = Get-Date
# [Send event and poll]
$end = Get-Date
"Elapsed: $($end - $start)"
```

---

## 🔄 Continuous Integration Testing

### Script: Run 5 Sequential Tests
```powershell
cd "c:\Users\91896\.vscode\AI-Agents\3-AI-Agent"

for ($n = 1; $n -le 5; $n++) {
    Write-Host "`n=== TEST RUN $n ===" -ForegroundColor Yellow
    
    $secret = "replace_me"
    $payload = @{
        external_id = "batch-test-$n"
        source = "github"
        repo_hint = "StayRoom"
        message = "Test error #$n"
        stack_trace = "at test line $n"
    } | ConvertTo-Json -Compress
    
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    $hmac = New-Object System.Security.Cryptography.HMACSHA256
    $hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($secret)
    $signature = "sha256=" + (-join ($hmac.ComputeHash($bytes) | ForEach-Object {$_.ToString("x2")}))
    
    $response = Invoke-RestMethod -Uri "http://localhost:4000/ingest/opclaw" `
        -Method Post `
        -Headers @{ "X-Opclaw-Signature" = $signature } `
        -ContentType "application/json" `
        -Body $payload
    
    $errorId = $response.incomingErrorId
    Write-Host "Sent error #$errorId, polling..." -ForegroundColor Cyan
    
    # Poll
    $completed = $false
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 500
        $result = Invoke-RestMethod -Uri "http://localhost:4000/errors/$errorId" -Method Get -ErrorAction SilentlyContinue
        if ($result.worker_status -eq "completed") {
            Write-Host "✓ Completed with PR: $($result.pr_url)" -ForegroundColor Green
            $completed = $true
            break
        }
    }
    
    if (-not $completed) {
        Write-Host "✗ TIMEOUT" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 2
}
```

