# Start jarvis-sync locally for LAN Push/Pull (local-first; no cloud required).
param(
  [switch]$Docker
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$syncDir = Join-Path $repoRoot "services\jarvis-sync"

if ($Docker) {
  Push-Location $syncDir
  try {
    docker compose up --build -d
    Write-Host "jarvis-sync listening on http://127.0.0.1:8787 (LAN: http://<your-pc-ip>:8787)"
    Write-Host "In JARVIS Sync panel: Register device -> Push -> Pull"
  } finally {
    Pop-Location
  }
  exit 0
}

Push-Location $syncDir
try {
  $env:JARVIS_SYNC_BIND = "0.0.0.0:8787"
  cargo run --release
} finally {
  Pop-Location
}
