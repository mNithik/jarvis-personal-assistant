# Prepare v0.1.4 release tag

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$checklist = Get-Content (Join-Path $root "docs/RELEASE_CHECKLIST.md") -Raw
$unsigned = [regex]::Matches($checklist, '\| \d+ \|[^|]+\|[^|]+\|[^|]+\|[^|]+\| \[ \] \|')
if ($unsigned.Count -gt 0) {
    Write-Host "RELEASE_CHECKLIST has $($unsigned.Count) unsigned row(s). Cannot tag v0.1.4." -ForegroundColor Red
    exit 1
}

if ($checklist -notmatch 'Slack v2') {
    Write-Host "RELEASE_CHECKLIST row 13 (Slack v2) not found. Cannot tag v0.1.4." -ForegroundColor Red
    exit 1
}

Write-Host "Checklist includes Slack v2. Running verify gate..." -ForegroundColor Cyan
npm run verify
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run verify:api
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Push-Location services/jarvis-sync
cargo test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Pop-Location

powershell -File tools/run-q4-trust-matrix.ps1
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Ready to tag v0.1.4. Next steps:" -ForegroundColor Green
Write-Host "  1. POST_RELEASE_SMOKE on v0.1.4 RC (docs/POST_RELEASE_SMOKE.md)"
Write-Host "  2. git tag v0.1.4"
Write-Host "  3. git push origin v0.1.4"
