# HTTP smoke wrapper (PowerShell)
$ErrorActionPreference = "Stop"
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $root
if (-not $env:E2E_STRICT) {
  $env:E2E_STRICT = "true"
}
node scripts/e2e/run-api-smoke.mjs
