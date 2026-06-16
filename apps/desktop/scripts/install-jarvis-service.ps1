param(
    [string]$AppData = "$env:APPDATA\com.jarvis.app"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$srcTauri = Join-Path $root "src-tauri"

Write-Host "Building jarvis-service (release)..."
Push-Location $srcTauri
cargo build --release --bin jarvis-service
Pop-Location

$binary = Join-Path $srcTauri "target\release\jarvis-service.exe"
if (-not (Test-Path $binary)) {
    throw "Binary not found at $binary"
}

New-Item -ItemType Directory -Force -Path $AppData | Out-Null

$existing = sc.exe query jarvis-service 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Stopping existing jarvis-service..."
    sc.exe stop jarvis-service | Out-Null
    sc.exe delete jarvis-service | Out-Null
    Start-Sleep -Seconds 2
}

$binPath = "`"$binary`""
Write-Host "Creating Windows service..."
sc.exe create jarvis-service binPath= $binPath start= auto DisplayName= "JARVIS Gateway"
sc.exe description jarvis-service "JARVIS always-on gateway worker (proactive automations and channel ingress)."

[System.Environment]::SetEnvironmentVariable("JARVIS_APP_DATA", $AppData, "Machine")
sc.exe config jarvis-service depend= ""

Write-Host "Starting jarvis-service..."
sc.exe start jarvis-service
Write-Host "jarvis-service installed. App data: $AppData"
