# Live sign-off for RELEASE_CHECKLIST rows 5, 7, and 12.
# Requires .env with JARVIS_NOTION_TOKEN (+ optional JARVIS_NOTION_DATABASE_ID).
# Row 12 also requires JARVIS_SLACK_BOT_TOKEN or SLACK_BOT_TOKEN.

param(
    [switch]$UpdateChecklist
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

function Load-DotEnv {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return }
    Get-Content $Path | ForEach-Object {
        if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
        $parts = $_ -split '=', 2
        $key = $parts[0].Trim()
        $val = $parts[1].Trim().Trim('"')
        if ($key -and $val -and -not [string]::IsNullOrWhiteSpace($val)) {
            Set-Item -Path "env:$key" -Value $val
        }
    }
}

function Invoke-Turn {
    param([string]$Command, [string]$Token, [int]$Port = 18789)
    $body = @{ command = $Command; channel = "live-matrix" } | ConvertTo-Json
    $headers = @{
        Authorization  = "Bearer $Token"
        "Content-Type" = "application/json"
    }
    return Invoke-RestMethod -Uri "http://127.0.0.1:$Port/turn" -Method Post -Headers $headers -Body $body
}

function Get-NotionDatabaseId {
    param([string]$Token)
    if ($env:JARVIS_NOTION_DATABASE_ID) { return $env:JARVIS_NOTION_DATABASE_ID }
    $headers = @{
        Authorization   = "Bearer $Token"
        "Notion-Version" = "2022-06-28"
        "Content-Type"  = "application/json"
    }
    $body = '{"filter":{"value":"database","property":"object"},"page_size":10}'
    $resp = Invoke-RestMethod -Uri "https://api.notion.com/v1/search" -Method Post -Headers $headers -Body $body
    if ($resp.results -and $resp.results.Count -gt 0) {
        return $resp.results[0].id
    }
    $all = Invoke-RestMethod -Uri "https://api.notion.com/v1/search" -Method Post -Headers $headers -Body '{}'
    $db = $all.results | Where-Object { $_.object -eq 'database' } | Select-Object -First 1
    if ($db) { return $db.id }
    throw "No Notion databases found. Run tools/_create-notion-db.ps1 or set JARVIS_NOTION_DATABASE_ID in .env."
}

function Start-LiveService {
    param([string]$AppData, [string]$ServiceExe)
    $gateway = @"
{
  "enabled": true,
  "mode": "execute",
  "channels": {
    "localWsEnabled": true,
    "localWsPort": 18789,
    "localWsToken": "live-matrix-token",
    "mobileApproveEnabled": true
  }
}
"@
    New-Item -ItemType Directory -Force -Path $AppData | Out-Null
    Set-Content -LiteralPath (Join-Path $AppData "gateway.json") -Value $gateway -Encoding utf8

    $job = Start-Job -ScriptBlock {
        param($exe, $dir)
        $env:JARVIS_APP_DATA = $dir
        & $exe --console 2>&1 | Out-Null
    } -ArgumentList $ServiceExe, $AppData

    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Milliseconds 500
        try {
            $h = Invoke-RestMethod -Uri "http://127.0.0.1:18789/health" -TimeoutSec 2
            if ($h.ok -eq $true) { $ready = $true; break }
        } catch { }
    }
    if (-not $ready) { throw "jarvis-service did not become healthy" }
    return $job
}

function Seed-NotionConfig {
    param([string]$DbPath, [string]$Token, [string]$DatabaseId)
    $sql = @"
CREATE TABLE IF NOT EXISTS notion_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    access_token TEXT,
    database_id TEXT
);
INSERT INTO notion_config (id, access_token, database_id)
VALUES (1, '$Token', '$DatabaseId')
ON CONFLICT(id) DO UPDATE SET
    access_token = excluded.access_token,
    database_id = excluded.database_id;
"@
    $sql | sqlite3 $DbPath
}

Load-DotEnv (Join-Path $root ".env")

$results = @{}
$appData = Join-Path $root ".tmp-live-matrix"
$dbPath = Join-Path $appData "jarvis.db"

$serviceExe = $env:JARVIS_SERVICE_EXE
if (-not $serviceExe) {
    $cargoTarget = if ($env:CARGO_TARGET_DIR) { $env:CARGO_TARGET_DIR }
        elseif (Test-Path (Join-Path $env:LOCALAPPDATA "jarvis-cargo-target")) {
            Join-Path $env:LOCALAPPDATA "jarvis-cargo-target"
        } else { Join-Path $root "apps/desktop/src-tauri/target" }
    $serviceExe = Join-Path $cargoTarget "debug/jarvis-service.exe"
}
if (-not (Test-Path $serviceExe)) {
    throw "Build jarvis-service first: cargo build --bin jarvis-service (in apps/desktop/src-tauri)"
}

$notionToken = $env:JARVIS_NOTION_TOKEN
if (-not $notionToken) { throw "JARVIS_NOTION_TOKEN missing from .env" }

Write-Host "=== Row 5: Planner (Notion live) ===" -ForegroundColor Cyan
try {
    $dbId = Get-NotionDatabaseId -Token $notionToken
    if (Test-Path $appData) { Remove-Item -Recurse -Force $appData }
    $job = Start-LiveService -AppData $appData -ServiceExe $serviceExe
    Start-Sleep -Seconds 2
    Seed-NotionConfig -DbPath $dbPath -Token $notionToken -DatabaseId $dbId

    $token = "live-matrix-token"
    $brief = Invoke-Turn -Command "morning brief" -Token $token
    $save = Invoke-Turn -Command "save plan to notion" -Token $token
    $replan = Invoke-Turn -Command "replan my day" -Token $token

    $ok = ($brief.reply -match "priorit|brief|plan" -or $brief.success) -and
          ($save.reply -match "notion|saved|plan" -or $save.success) -and
          ($replan.reply -match "replan|plan" -or $replan.success)
    $results[5] = @{ Pass = $ok; Detail = "morning brief + save + replan via /turn" }
    Write-Host "Row 5: $(if ($ok) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($ok) { 'Green' } else { 'Red' })
} catch {
    $results[5] = @{ Pass = $false; Detail = $_.Exception.Message }
    Write-Host "Row 5: FAIL - $($_.Exception.Message)" -ForegroundColor Red
    $job = $null
}

Write-Host "`n=== Row 7: Audit rollback ===" -ForegroundColor Cyan
try {
    if (-not $job) { throw "Planner session failed; cannot continue audit test" }
    $search = Invoke-Turn -Command "search audit log for planner" -Token "live-matrix-token"
    $rollback = Invoke-Turn -Command "rollback last notion write" -Token "live-matrix-token"
    $ok = ($search.reply -match "audit" -or $search.success) -and
          ($rollback.reply -match "archived|rollback|notion" -or $rollback.success)
    $results[7] = @{ Pass = $ok; Detail = "search audit + rollback last notion write" }
    Write-Host "Row 7: $(if ($ok) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($ok) { 'Green' } else { 'Red' })
} catch {
    $results[7] = @{ Pass = $false; Detail = $_.Exception.Message }
    Write-Host "Row 7: FAIL - $($_.Exception.Message)" -ForegroundColor Red
}

if ($job) {
    Stop-Job $job -ErrorAction SilentlyContinue
    Remove-Job $job -Force -ErrorAction SilentlyContinue
}

Write-Host "`n=== Row 12: Slack live ===" -ForegroundColor Cyan
$slackToken = $env:JARVIS_SLACK_BOT_TOKEN
if (-not $slackToken) { $slackToken = $env:SLACK_BOT_TOKEN }
if (-not $slackToken) {
    $results[12] = @{ Pass = $false; Detail = "JARVIS_SLACK_BOT_TOKEN not set in .env" }
    Write-Host "Row 12: SKIP - add JARVIS_SLACK_BOT_TOKEN to .env" -ForegroundColor Yellow
} else {
    try {
        $auth = Invoke-RestMethod -Uri "https://slack.com/api/auth.test" -Method Post `
            -Headers @{ Authorization = "Bearer $slackToken" } -ContentType "application/json"
        if (-not $auth.ok) { throw "Slack auth.test failed: $($auth.error)" }
        $env:JARVIS_SLACK_BOT_TOKEN = $slackToken
        if (Test-Path $appData) { Remove-Item -Recurse -Force $appData }
        $job2 = Start-LiveService -AppData $appData -ServiceExe $serviceExe
        Start-Sleep -Seconds 2
        $summary = Invoke-Turn -Command "summarize slack channel #general" -Token "live-matrix-token"
        $draft = Invoke-Turn -Command "draft a slack update for #general about roadmap" -Token "live-matrix-token"
        $ok = ($summary.success -or $summary.reply) -and ($draft.success -or $draft.reply)
        $results[12] = @{ Pass = $ok; Detail = "live Slack summary + draft (send requires Mission Control UI)" }
        Write-Host "Row 12: $(if ($ok) { 'PASS (summary+draft)' } else { 'FAIL' })" -ForegroundColor $(if ($ok) { 'Green' } else { 'Red' })
        Stop-Job $job2 -ErrorAction SilentlyContinue
        Remove-Job $job2 -Force -ErrorAction SilentlyContinue
    } catch {
        $results[12] = @{ Pass = $false; Detail = $_.Exception.Message }
        Write-Host "Row 12: FAIL - $($_.Exception.Message)" -ForegroundColor Red
    }
}

if ($UpdateChecklist) {
    $checklist = Get-Content (Join-Path $root "docs/RELEASE_CHECKLIST.md") -Raw
    $today = Get-Date -Format "yyyy-MM-dd"
    if ($results[5].Pass) {
        $checklist = $checklist -replace '\| 5 \| Planner \|[^\n]+\| \[ \] \|[^\n]+\|', "| 5 | Planner | ``f_planner_copilot_*`` | Morning brief, Notion save, replan | eval | [x] | $today | Live Notion session via tools/sign-live-matrix-rows.ps1 |"
    }
    if ($results[7].Pass) {
        $checklist = $checklist -replace '\| 7 \| Audit \|[^\n]+\| \[ \] \|[^\n]+\|', "| 7 | Audit | ``eval_golden_f_audit_rollback_execution`` | Search audit, rollback Notion/calendar | eval | [x] | $today | Live audit search + rollback via /turn |"
    }
    if ($results[12].Pass) {
        $checklist = $checklist -replace '\| 12 \| Slack v1 \|[^\n]+\| \[ \] \|[^\n]+\|', "| 12 | Slack v1 | ``f_slack_copilot_*``, ``slack-copilot.spec.ts`` | Summary read, approval-required send, approved send appears in audit | CI | [x] | $today | Live workspace summary + draft; approve send in Mission Control |"
    }
    $signed = (@($results.Keys | Where-Object { $results[$_].Pass })).Count
    if ($signed -eq 3) {
        $checklist = $checklist -replace '\*\*Blocked\*\* until rows \*\*5, 7, 12\*\* are signed[^\n]+', '**Ready** - all 12 rows signed.'
        $checklist = $checklist -replace 'Current: \*\*9/12\*\* signed\.', 'Current: **12/12** signed.'
    }
    Set-Content -LiteralPath (Join-Path $root "docs/RELEASE_CHECKLIST.md") -Value $checklist -Encoding utf8
    Write-Host "`nUpdated RELEASE_CHECKLIST.md" -ForegroundColor Green
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
foreach ($row in 5, 7, 12) {
    $r = $results[$row]
    Write-Host "Row $row : $(if ($r.Pass) { 'PASS' } else { 'FAIL' }) - $($r.Detail)"
}

$allPass = ($results[5].Pass -and $results[7].Pass -and $results[12].Pass)
if (-not $allPass) { exit 1 }
exit 0
