#!/usr/bin/env powershell
# stop.ps1 - Stop the AI Agent pipeline

Set-Location "c:\Users\91896\.vscode\AI-Agents\3-AI-Agent"

Write-Host "Stopping AI Agent Pipeline..." -ForegroundColor Yellow
Write-Host ""

docker compose down

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ All services stopped successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to stop services" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "To restart, run: powershell -File start.ps1" -ForegroundColor Cyan
