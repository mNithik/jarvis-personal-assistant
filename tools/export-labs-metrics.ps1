# Export proactive lab metrics for dogfood evidence

$ErrorActionPreference = "Stop"
$appData = if ($env:JARVIS_APP_DATA) { $env:JARVIS_APP_DATA } else { Join-Path $env:APPDATA "com.nithi.jarvis" }
$metricsDir = Join-Path $appData "metrics"
$outPath = Join-Path $metricsDir "proactive-summary.json"

New-Item -ItemType Directory -Force -Path $metricsDir | Out-Null

$payload = @{
    exportedAt = (Get-Date).ToUniversalTime().ToString("o")
    cycle = "F70-ambientCopilot"
    note = "Weekly export for LAB_GRADUATION_LOG dismiss-rate evidence"
    metrics = @{
        dismissRate = $null
        acceptRate = $null
        autoWriteCount = 0
    }
} | ConvertTo-Json -Depth 4

Set-Content -Path $outPath -Value $payload -Encoding UTF8
Write-Host "Wrote lab metrics template to $outPath" -ForegroundColor Green
Write-Host "Update dismiss/accept rates manually after weekly dogfood review."
