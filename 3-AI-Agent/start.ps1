#!/usr/bin/env powershell
# start.ps1 - Start the AI Agent pipeline

Set-Location "c:\Users\91896\.vscode\AI-Agents\3-AI-Agent"

Write-Host "Starting AI Agent Pipeline..." -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
try {
    docker --version > $null 2>&1
} catch {
    Write-Host "✗ Docker is not installed or not running" -ForegroundColor Red
    exit 1
}

# Check if services are already running
$status = & docker compose ps 2>&1 | Select-String "Up"

if ($status) {
    Write-Host "Services already running. Skipping start." -ForegroundColor Yellow
} else {
    Write-Host "Starting containers..." -ForegroundColor Cyan
    docker compose up -d
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Failed to start containers" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Waiting for services to be healthy..." -ForegroundColor Cyan
    Start-Sleep -Seconds 12
}

# Verify health
Write-Host ""
Write-Host "Checking service health..." -ForegroundColor Cyan

try {
    $health = Invoke-RestMethod -Uri "http://localhost:4000/health" -ErrorAction Stop
    if ($health.ok) {
        Write-Host "✓ Orchestrator: HEALTHY" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Orchestrator: UNHEALTHY" -ForegroundColor Red
    exit 1
}

# Show status
Write-Host ""
Write-Host "✓ All services started successfully" -ForegroundColor Green
Write-Host ""
Write-Host "Services:" -ForegroundColor Yellow
& docker compose ps --format "table {{.Names}}\t{{.Status}}"

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. View logs:     powershell -File logs.ps1 -Follow"
Write-Host "  2. Send test:     powershell -File test-event.ps1"
Write-Host "  3. Stress test:   powershell -File stress-test.ps1"
Write-Host "  4. API endpoint:  http://localhost:4000/health"
Write-Host ""
