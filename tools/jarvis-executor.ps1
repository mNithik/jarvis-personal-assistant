$ErrorActionPreference = "Stop"

param(
  [Parameter(Mandatory = $true)]
  [string]$JsonPath,

  [Parameter(Mandatory = $true)]
  [string]$MarkdownPath
)

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$inboxDir = Join-Path $workspaceRoot "executor-inbox"
$logPath = Join-Path $inboxDir "executor-log.txt"

New-Item -ItemType Directory -Force -Path $inboxDir | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$jsonName = Split-Path -Leaf $JsonPath
$markdownName = Split-Path -Leaf $MarkdownPath

Copy-Item -LiteralPath $JsonPath -Destination (Join-Path $inboxDir $jsonName) -Force
Copy-Item -LiteralPath $MarkdownPath -Destination (Join-Path $inboxDir $markdownName) -Force

$logEntry = @"
[$timestamp]
Received JSON: $JsonPath
Received Markdown: $MarkdownPath
Copied to inbox: $inboxDir

"@

Add-Content -LiteralPath $logPath -Value $logEntry
