#!/usr/bin/env powershell
# logs.ps1 - Easy Docker logs viewer with filtering options

param(
    [string]$Service = "all",    # all, orchestrator, worker, redis, postgres
    [int]$Lines = 50,             # Number of lines to show
    [switch]$Follow = $false,     # Live tail (-f)
    [string]$Filter = ""          # Optional grep filter
)

Set-Location "c:\Users\91896\.vscode\AI-Agents\3-AI-Agent"

function Show-Usage {
    Write-Host @"
USAGE: ps1 logs.ps1 [options]

OPTIONS:
  -Service <name>    Service to view: all, orchestrator, worker, redis, postgres (default: all)
  -Lines <num>       Number of lines to show (default: 50)
  -Follow            Live tail logs (Ctrl+C to exit)
  -Filter <pattern>  Filter logs containing pattern (case-insensitive)

EXAMPLES:
  # View last 50 lines of orchestrator
  powershell -File logs.ps1 -Service orchestrator

  # Follow worker logs live
  powershell -File logs.ps1 -Service worker -Follow

  # Show lines containing 'error'
  powershell -File logs.ps1 -Filter "error"

  # Last 20 lines of all services
  powershell -File logs.ps1 -Lines 20

  # Live tail all services filtered by 'telegram'
  powershell -File logs.ps1 -Follow -Filter "telegram"
"@
}

# Build command
$baseCmd = "docker compose logs"

# Add follow flag
if ($Follow) {
    $baseCmd += " -f"
}

# Add lines limit (only if not following)
if (-not $Follow) {
    $baseCmd += " --tail $Lines"
}

# Add service filter
if ($Service -ne "all") {
    $baseCmd += " $Service"
}

Write-Host "Running: $baseCmd" -ForegroundColor DarkGray

# Execute and optionally filter
if ($Filter) {
    Invoke-Expression $baseCmd | Select-String -Pattern $Filter
} else {
    Invoke-Expression $baseCmd
}
