# Q4 trust matrix automated verification
# Runs Playwright, sync tests, and optional jarvis-service API smoke.
# Manual OAuth / phone / live Slack steps: docs/Q4_TRUST_MATRIX_RUNBOOK.md

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$results = @()

function Add-Result($row, $name, $passed, $detail) {
  $script:results += [pscustomobject]@{
    Row    = $row
    Area   = $name
    Pass   = $passed
    Detail = $detail
  }
}

Write-Host "=== Q4 Trust Matrix automated layer ===" -ForegroundColor Cyan

Write-Host "`n[build] npm run build --workspace @jarvis/desktop"
npm run build --workspace @jarvis/desktop
if ($LASTEXITCODE -ne 0) { throw "desktop build failed" }
Add-Result 0 "build" $true "desktop build ok"

Write-Host "`n[e2e:ui] Playwright UI harness"
npm run e2e:ui
$uiOk = $LASTEXITCODE -eq 0
Add-Result "1-3,11" "profiles/skills/sync/ambient" $uiOk "npm run e2e:ui"
Add-Result 4 "triggers" $uiOk "trigger-recipes.spec.ts UI CRUD, service log separate"
Add-Result 6 "meeting/topic-graph" $uiOk "topic-graph.spec.ts harness, live Google OAuth separate"
Add-Result 12 "slack-v1" $uiOk "slack-copilot.spec.ts harness, live workspace separate"

Write-Host "`n[jarvis-sync] cargo test"
Push-Location services/jarvis-sync
cargo test
$syncOk = $LASTEXITCODE -eq 0
Pop-Location
Add-Result 3 "sync-server" $syncOk "services/jarvis-sync integration test"

$serviceExe = $env:JARVIS_SERVICE_EXE
if (-not $serviceExe) {
  $cargoTargetDir = if ($env:CARGO_TARGET_DIR) {
    $env:CARGO_TARGET_DIR
  } elseif (Test-Path (Join-Path $env:LOCALAPPDATA "jarvis-cargo-target")) {
    Join-Path $env:LOCALAPPDATA "jarvis-cargo-target"
  } else {
    Join-Path $root "apps/desktop/src-tauri/target"
  }
  $serviceExe = Join-Path $cargoTargetDir "debug/jarvis-service.exe"
}

if (Test-Path $serviceExe) {
  $env:JARVIS_SERVICE_EXE = $serviceExe
  Write-Host "`n[e2e:api:service] HTTP mobile/turn smoke"
  npm run e2e:api:service
  $apiOk = $LASTEXITCODE -eq 0
  Add-Result 8 "mobile-pwa-api" $apiOk "e2e-api:service strict, phone LAN manual still required"
} else {
  Add-Result 8 "mobile-pwa-api" $false "jarvis-service.exe not built"
}

$slackToken = $env:JARVIS_SLACK_BOT_TOKEN
if (-not $slackToken) { $slackToken = $env:SLACK_BOT_TOKEN }
if ($slackToken) {
  Write-Host "`n[slack] live token detected, ping auth.test"
  try {
    $body = @{ token = $slackToken } | ConvertTo-Json
    $resp = Invoke-RestMethod -Uri "https://slack.com/api/auth.test" -Method Post -Body $body -ContentType "application/json"
    $slackLive = $resp.ok -eq $true
    Add-Result 12 "slack-live" $slackLive "auth.test ok=$($resp.ok) team=$($resp.team)"
  } catch {
    Add-Result 12 "slack-live" $false $_.Exception.Message
  }
} else {
  Add-Result 12 "slack-live" $false "Set JARVIS_SLACK_BOT_TOKEN for live sign-off"
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
$results | Format-Table -AutoSize

$failed = @($results | Where-Object { -not $_.Pass -and $_.Area -ne "slack-live" })
if ($failed.Count -gt 0) {
  Write-Host "`nAutomated gaps (see Q4_TRUST_MATRIX_RUNBOOK.md for manual steps):" -ForegroundColor Yellow
  $failed | ForEach-Object { Write-Host "  Row $($_.Row) $($_.Area): $($_.Detail)" }
  exit 1
}

Write-Host "`nAll automated checks passed." -ForegroundColor Green
exit 0
