param(
  [string]$InputPath = "$env:APPDATA\com.jarvis.app\training-export.jsonl",
  [string]$OutputPath = "$env:APPDATA\com.jarvis.app\training-export-anonymized.jsonl"
)

if (-not (Test-Path $InputPath)) {
  Write-Error "Input not found: $InputPath"
  exit 1
}

$pattern = '(?i)(sk-[A-Za-z0-9_-]+|C:\\Users\\[^"\s]+|@[\w.-]+\.\w+)'
Get-Content $InputPath | ForEach-Object {
  $_ -replace $pattern, '[redacted]'
} | Set-Content $OutputPath

Write-Host "Wrote anonymized export to $OutputPath"
