#!/usr/bin/env powershell
# stress-test.ps1 - Send multiple test events concurrently and track completion

Set-Location "c:\Users\91896\.vscode\AI-Agents\3-AI-Agent"

$secret = "replace_me"
$testCount = 5  # Number of events to send

Write-Host "=== STRESS TEST: $testCount Events ===" -ForegroundColor Yellow
Write-Host "Sending $testCount error events..." -ForegroundColor Cyan

$events = @()

# Send all events
for ($i = 1; $i -le $testCount; $i++) {
    $payload = @{
        external_id = "stress-test-$i-$(Get-Date -Format 'yyyyMMddHHmmss')"
        source = "github"
        repo_hint = "StayRoom"
        message = "Test error #$i - $(Get-Random -Min 100 -Max 999)"
        stack_trace = "at testFunction (test.js:$i)"
    } | ConvertTo-Json -Compress

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    $hmac = New-Object System.Security.Cryptography.HMACSHA256
    $hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($secret)
    $signature = "sha256=" + (-join ($hmac.ComputeHash($bytes) | ForEach-Object {$_.ToString("x2")}))

    try {
        $response = Invoke-RestMethod -Uri "http://localhost:4000/ingest/opclaw" `
            -Method Post `
            -Headers @{ "X-Opclaw-Signature" = $signature } `
            -ContentType "application/json" `
            -Body $payload `
            -ErrorAction Stop
        
        $events += @{
            errorId = $response.incomingErrorId
            jobId = $response.jobId
            repo = $response.mappedRepo
            timestamp = Get-Date
            status = "queued"
        }
        
        Write-Host "  [$i/$testCount] Error #$($response.incomingErrorId) queued" -ForegroundColor Green
        Start-Sleep -Milliseconds 200  # Small delay between sends
    } catch {
        Write-Host "  [$i/$testCount] FAILED to queue: $_" -ForegroundColor Red
    }
}

Write-Host "`n✓ All $($events.Count) events sent. Polling for completion..`n" -ForegroundColor Green

# Poll all events
$maxAttempts = 60
$completedCount = 0
$failedCount = 0

for ($attempt = 0; $attempt -lt $maxAttempts; $attempt++) {
    $allComplete = $true
    $currentCompleted = 0
    
    foreach ($event in $events) {
        if ($event.status -ne "completed" -and $event.status -ne "failed") {
            try {
                $result = Invoke-RestMethod -Uri "http://localhost:4000/errors/$($event.errorId)" `
                    -Method Get `
                    -ErrorAction SilentlyContinue
                
                if ($result.worker_status -eq "completed") {
                    $event.status = "completed"
                    $event.pr_url = $result.pr_url
                    $currentCompleted++
                } elseif ($result.worker_status -eq "failed") {
                    $event.status = "failed"
                    $currentCompleted++
                } else {
                    $allComplete = $false
                    $event.status = $result.worker_status
                }
            } catch {
                # Still processing
                $allComplete = $false
            }
        } else {
            $currentCompleted++
        }
    }

    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] Progress: $currentCompleted/$($events.Count) completed" -ForegroundColor Cyan
    
    if ($allComplete) {
        break
    }
    
    Start-Sleep -Seconds 1
}

# Print results
Write-Host "`n=== RESULTS ===" -ForegroundColor Yellow
Write-Host ""

$completed = 0
$failed = 0

foreach ($event in $events) {
    if ($event.status -eq "completed") {
        Write-Host "✓ Error #$($event.errorId): COMPLETED" -ForegroundColor Green
        Write-Host "  PR: $($event.pr_url)"
        $completed++
    } elseif ($event.status -eq "failed") {
        Write-Host "✗ Error #$($event.errorId): FAILED" -ForegroundColor Red
        $failed++
    } else {
        Write-Host "? Error #$($event.errorId): TIMEOUT (status: $($event.status))" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "  Completed: $completed/$($events.Count)"
Write-Host "  Failed: $failed/$($events.Count)"

if ($completed -eq $events.Count) {
    Write-Host "`n✓ ALL TESTS PASSED" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n✗ SOME TESTS DID NOT COMPLETE" -ForegroundColor Red
    exit 1
}
