# Removes regenerable build caches to free local disk (~11 GB typical).
# Safe to run anytime; next build/dev will recreate artifacts.

$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot

$paths = @(
    (Join-Path $root "apps\desktop\src-tauri\target"),
    (Join-Path $root "apps\desktop\dist"),
    (Join-Path $env:LOCALAPPDATA "jarvis-cargo-target")
)

foreach ($path in $paths) {
    if (Test-Path $path) {
        Remove-Item -Recurse -Force $path
        Write-Host "Removed: $path"
    } else {
        Write-Host "Skip (missing): $path"
    }
}

Write-Host "Done. Run 'npm run tauri dev' or tag a release to rebuild."
