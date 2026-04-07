#!/usr/bin/env powershell
# test-event.ps1 - Single test event with automated polling

Set-Location "c:\Users\91896\.vscode\AI-Agents\3-AI-Agent"

$secret = "replace_me"

# Define test payload
$payload = @{
    external_id = "test-$(Get-Date -Format 'yyyyMMddHHmmss')"
    source = "github"
    repo_hint = "StayRoom"
    message = "TypeError: Cannot read property of undefined"
    stack_trace = "at processData (index.js:42:15)"
} | ConvertTo-Json -Compress

Write-Host "Sending test event..." -ForegroundColor Cyan

# Calculate HMAC signature
$bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($secret)
$signature = "sha256=" + (-join ($hmac.ComputeHash($bytes) | ForEach-Object {$_.ToString("x2")}))

# Send webhook
try {
    $response = Invoke-RestMethod -Uri "http://localhost:4000/ingest/opclaw" `
        -Method Post `
        -Headers @{ "X-Opclaw-Signature" = $signature } `
        -ContentType "application/json" `
        -Body $payload `
        -ErrorAction Stop
    
    $errorId = $response.incomingErrorId
    $jobId = $response.jobId
    
    Write-Host "`n✓ Event ingested successfully" -ForegroundColor Green
    Write-Host "  Error ID: $errorId"
    Write-Host "  Job ID: $jobId"
    Write-Host "  Mapped Repo: $($response.mappedRepo)"
    
} catch {
    Write-Host "`n✗ FAILED TO INGEST EVENT" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

# Poll for completion
Write-Host "`nPolling for job completion..." -ForegroundColor Cyan
$maxAttempts = 30
$attemptCount = 0

while ($attemptCount -lt $maxAttempts) {
    try {
        $result = Invoke-RestMethod -Uri "http://localhost:4000/errors/$errorId" `
            -Method Get `
            -ErrorAction SilentlyContinue
        
        if ($result.worker_status) {
            $status = $result.worker_status
            $timestamp = Get-Date -Format "HH:mm:ss"
            Write-Host "[$timestamp] Status: $status" -ForegroundColor Cyan
            
            if ($status -eq "completed") {
                Write-Host "`n✓ JOB COMPLETED" -ForegroundColor Green
                Write-Host "  PR URL: $($result.pr_url)"
                Write-Host "  Branch: $($result.branch_name)"
                Write-Host "  Checks: $($result.checks_status)"
                
                # Show summary snippet
                if ($result.action_summary) {
                    $summary = $result.action_summary.Substring(0, [Math]::Min(200, $result.action_summary.Length))
                    Write-Host "  Summary: $summary..." -ForegroundColor Gray
                }
                
                exit 0
            }
        }
    } catch {
        # Silently retry
    }
    
    $attemptCount++
    Start-Sleep -Milliseconds 1000
}

Write-Host "`n✗ TIMEOUT: Job did not complete in ${maxAttempts}s" -ForegroundColor Red
exit 1
