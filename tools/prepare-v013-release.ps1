# Prepare v0.1.3 release tag

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$checklist = Get-Content (Join-Path $root "docs/RELEASE_CHECKLIST.md") -Raw
$unsigned = [regex]::Matches($checklist, '\| \d+ \|[^|]+\|[^|]+\|[^|]+\|[^|]+\| \[ \] \|')
if ($unsigned.Count -gt 0) {
    Write-Host "RELEASE_CHECKLIST has $($unsigned.Count) unsigned row(s). Cannot tag v0.1.3." -ForegroundColor Red
    Write-Host "Run: powershell -File tools/sign-live-matrix-rows.ps1 -UpdateChecklist"
    exit 1
}

Write-Host "All checklist rows signed. Running verify gate..." -ForegroundColor Cyan
npm run verify
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run verify:api
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Push-Location services/jarvis-sync
cargo test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Pop-Location

Write-Host ""
Write-Host "Ready to tag v0.1.3. Next steps:" -ForegroundColor Green
Write-Host "  1. POST_RELEASE_SMOKE on clean Windows VM (docs/POST_RELEASE_SMOKE.md)"
Write-Host "  2. git tag v0.1.3"
Write-Host "  3. git push origin v0.1.3"
