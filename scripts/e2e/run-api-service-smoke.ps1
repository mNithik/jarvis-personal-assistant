$ErrorActionPreference = "Stop"

$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $root

$appData = Join-Path $root ".tmp-e2e-api"
New-Item -ItemType Directory -Force -Path $appData | Out-Null

$gatewayConfig = @"
{
  "enabled": true,
  "mode": "execute",
  "channels": {
    "localWsEnabled": true,
    "localWsPort": 18789,
    "localWsToken": "e2e-token",
    "mobileApproveEnabled": true
  }
}
"@

Set-Content -LiteralPath (Join-Path $appData "gateway.json") -Value $gatewayConfig -Encoding utf8

$env:JARVIS_APP_DATA = $appData
$env:E2E_LOCAL_API_HOST = "127.0.0.1"
$env:E2E_LOCAL_API_PORT = "18789"
$env:E2E_BEARER_TOKEN = "e2e-token"
$env:E2E_STRICT = "true"

$serviceExe = $env:JARVIS_SERVICE_EXE
if (-not $serviceExe) {
  $cargoTargetDir = if ($env:CARGO_TARGET_DIR) {
    $env:CARGO_TARGET_DIR
  } else {
    Join-Path $root "apps/desktop/src-tauri/target"
  }
  $serviceExe = Join-Path $cargoTargetDir "debug/jarvis-service.exe"
}
if (-not (Test-Path $serviceExe)) {
  throw "Missing service binary at $serviceExe"
}

$serviceLog = Join-Path $appData "service.log"
$serviceOut = Join-Path $appData "service.out.log"
$serviceErr = Join-Path $appData "service.err.log"
Remove-Item -LiteralPath $serviceLog, $serviceOut, $serviceErr -Force -ErrorAction SilentlyContinue

$service = Start-Job -ScriptBlock {
  param($exePath, $appDataDir, $stdoutPath, $stderrPath)
  $env:JARVIS_APP_DATA = $appDataDir
  & $exePath --console 1>> $stdoutPath 2>> $stderrPath
} -ArgumentList $serviceExe, $appData, $serviceOut, $serviceErr

try {
  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:18789/health" -TimeoutSec 2
      if ($health.ok -eq $true) {
        $ready = $true
        break
      }
    } catch {
    }
  }

  if (-not $ready) {
    if (Test-Path $serviceLog) {
      Write-Host "Service log:"
      Get-Content -LiteralPath $serviceLog
    }
    if (Test-Path $serviceOut) {
      Write-Host "Service stdout:"
      Get-Content -LiteralPath $serviceOut
    }
    if (Test-Path $serviceErr) {
      Write-Host "Service stderr:"
      Get-Content -LiteralPath $serviceErr
    }
    throw "jarvis-service did not become ready on 127.0.0.1:18789"
  }

  node scripts/e2e/run-api-smoke.mjs
} finally {
  if ($service) {
    Stop-Job $service -ErrorAction SilentlyContinue | Out-Null
    Remove-Job $service -Force -ErrorAction SilentlyContinue | Out-Null
  }
}
