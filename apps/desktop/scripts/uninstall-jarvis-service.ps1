$ErrorActionPreference = "Stop"

$existing = sc.exe query jarvis-service 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "jarvis-service is not installed."
    exit 0
}

Write-Host "Stopping jarvis-service..."
sc.exe stop jarvis-service | Out-Null
Start-Sleep -Seconds 2
sc.exe delete jarvis-service | Out-Null
Write-Host "jarvis-service removed."
