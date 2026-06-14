# One-time setup: keep Rust build output out of OneDrive Documents.
# Restart terminal/Cursor after running.

$cargoDir = Join-Path $env:LOCALAPPDATA "jarvis-cargo-target"
New-Item -ItemType Directory -Force -Path $cargoDir | Out-Null
[System.Environment]::SetEnvironmentVariable("CARGO_TARGET_DIR", $cargoDir, "User")
Write-Host "CARGO_TARGET_DIR set to: $cargoDir"
Write-Host "Run scripts\clean-build-artifacts.ps1 anytime to free disk."
