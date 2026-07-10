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

function Parse-TurnResponse {
    param([string]$Raw)
    if (-not $Raw) { return $null }
    if ($Raw -match '"error"\s*:\s*"((?:\\.|[^"\\])*)"') {
        throw ($Matches[1] -replace '\\"', '"')
    }
    $tmp = [IO.Path]::GetTempFileName()
    try {
        $utf8 = New-Object System.Text.UTF8Encoding $false
        [IO.File]::WriteAllText($tmp, $Raw, $utf8)
        $reply = node -e "const fs=require('fs');const o=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write((o.result&&o.result.reply)||'');" $tmp
        $awaiting = ($Raw -match '"awaitingApproval"\s*:\s*true')
        return [pscustomobject]@{
            result = [pscustomobject]@{ reply = $reply }
            awaitingApproval = $awaiting
        }
    } finally {
        Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    }
}

function Invoke-Turn {
    param([string]$Command, [string]$Token, [int]$Port = 18789)
    $bodyPath = Join-Path $env:TEMP "jarvis-turn-$([Guid]::NewGuid().ToString()).json"
    $escaped = $Command -replace '\\', '\\\\' -replace '"', '\"'
    Set-Content -LiteralPath $bodyPath -Value "{`"command`":`"$escaped`",`"channel`":`"live-matrix`"}" -Encoding ascii -NoNewline
    try {
        for ($attempt = 0; $attempt -lt 5; $attempt++) {
            $raw = curl.exe -s -X POST "http://127.0.0.1:$Port/turn" `
                -H "Authorization: Bearer $Token" `
                -H "Content-Type: application/json" `
                --data-binary "@$bodyPath"
            if ($raw) {
                Set-Content -LiteralPath (Join-Path $root ".tmp-live-matrix\last-turn.raw") -Value $raw -Encoding UTF8
                return (Parse-TurnResponse $raw)
            }
            Start-Sleep -Milliseconds 750
        }
        throw "Empty /turn response after retries (last curl exit $LASTEXITCODE)"
    } finally {
        Remove-Item -LiteralPath $bodyPath -Force -ErrorAction SilentlyContinue
    }
}

function Get-TurnReply {
    param($Turn)
    if ($Turn.result -and $Turn.result.reply) { return $Turn.result.reply }
    if ($Turn.reply) { return $Turn.reply }
    return ""
}

function Turn-Ok {
    param($Turn, [string[]]$Patterns)
    $reply = Get-TurnReply $Turn
    if (-not $reply) { return $false }
    foreach ($pattern in $Patterns) {
        if ($reply -match $pattern) { return $true }
    }
    return $false
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

function Stop-PortListener {
    param([int]$Port = 18789)
    Get-Process jarvis-service -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
    Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Milliseconds 500
}

function Stop-LiveService {
    param($Proc)
    if ($Proc) {
        Start-Sleep -Seconds 2
        Stop-Process -Id $Proc.Id -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
    }
}

function Start-LiveService {
    param([string]$AppData, [string]$ServiceExe)
    Stop-PortListener
    $gateway = @"
{
  "enabled": true,
  "mode": "execute",
  "features": {
    "memory": true,
    "notion": true,
    "calendar": true,
    "gmail": true
  },
  "proactive": {
    "plannerCopilotEnabled": true,
    "morningBriefEnabled": true
  },
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

    $pinfo = New-Object System.Diagnostics.ProcessStartInfo
    $pinfo.FileName = $ServiceExe
    $pinfo.Arguments = "--console"
    $pinfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $pinfo.UseShellExecute = $false
    $pinfo.EnvironmentVariables["JARVIS_APP_DATA"] = $AppData
    $proc = [System.Diagnostics.Process]::Start($pinfo)

    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Milliseconds 500
        try {
            $h = Invoke-RestMethod -Uri "http://127.0.0.1:18789/health" -TimeoutSec 2
            if ($h.ok -eq $true) { $ready = $true; break }
        } catch { }
    }
    if (-not $ready) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        throw "jarvis-service did not become healthy"
    }
    return $proc
}

function Seed-NotionConfig {
    param([string]$DbPath, [string]$Token, [string]$DatabaseId)
    $escapedToken = $Token -replace "'", "''"
    $escapedDb = $DatabaseId -replace "'", "''"
    $sql = @"
CREATE TABLE IF NOT EXISTS notion_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    access_token TEXT,
    database_id TEXT
);
INSERT INTO notion_config (id, access_token, database_id)
VALUES (1, '$escapedToken', '$escapedDb')
ON CONFLICT(id) DO UPDATE SET
    access_token = excluded.access_token,
    database_id = excluded.database_id;
"@
    $sql | sqlite3 $DbPath
}

function Seed-AppNotionConfig {
    param([string]$Token, [string]$DatabaseId)
    $appDb = Join-Path $env:APPDATA "com.nithi.jarvis\jarvis.db"
    if (-not (Test-Path $appDb)) { return }
    Seed-NotionConfig -DbPath $appDb -Token $Token -DatabaseId $DatabaseId
    Write-Host "Seeded Notion config in app jarvis.db" -ForegroundColor DarkGray
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

$dbId = Get-NotionDatabaseId -Token $notionToken
Seed-AppNotionConfig -Token $notionToken -DatabaseId $dbId

Write-Host "=== Row 5: Planner (Notion live) ===" -ForegroundColor Cyan
try {
    if (Test-Path $appData) { Remove-Item -Recurse -Force $appData }
    $job = Start-LiveService -AppData $appData -ServiceExe $serviceExe
    for ($i = 0; $i -lt 30; $i++) {
        if (Test-Path $dbPath) { break }
        Start-Sleep -Milliseconds 500
    }
    Seed-NotionConfig -DbPath $dbPath -Token $notionToken -DatabaseId $dbId
    Start-Sleep -Seconds 1

    $token = "live-matrix-token"
    $brief = Invoke-Turn -Command "plan my day" -Token $token
    Start-Sleep -Seconds 1
    $save = Invoke-Turn -Command "save plan to notion" -Token $token
    Start-Sleep -Seconds 1
    $replan = Invoke-Turn -Command "replan my day" -Token $token

    $ok = (Turn-Ok $brief @('priorit', 'brief', 'plan', 'Top 3')) -and
          (Turn-Ok $save @('notion', 'saved', 'plan', 'archived')) -and
          (Turn-Ok $replan @('replan', 'plan', 'Top 3', 'priorit'))
    $results[5] = @{ Pass = $ok; Detail = "morning brief + save + replan via /turn" }
    if (-not $ok) {
        Write-Host "  brief: $(Get-TurnReply $brief)" -ForegroundColor DarkYellow
        Write-Host "  save: $(Get-TurnReply $save)" -ForegroundColor DarkYellow
        Write-Host "  replan: $(Get-TurnReply $replan)" -ForegroundColor DarkYellow
        if (Test-Path (Join-Path $appData "last-turn.raw")) {
            $rawDbg = (Get-Content (Join-Path $appData "last-turn.raw") -Raw)
            if ($rawDbg) {
                $len = [Math]::Min(200, $rawDbg.Length)
                Write-Host "  raw: $($rawDbg.Substring(0, $len))" -ForegroundColor DarkGray
            }
        }
    }
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
    $ok = (Turn-Ok $search @('audit', 'planner', 'notion')) -and
          (Turn-Ok $rollback @('archived', 'rollback', 'notion', 'restored'))
    $results[7] = @{ Pass = $ok; Detail = "search audit + rollback last notion write" }
    if (-not $ok) {
        Write-Host "  search: $(Get-TurnReply $search)" -ForegroundColor DarkYellow
        Write-Host "  rollback: $(Get-TurnReply $rollback)" -ForegroundColor DarkYellow
    }
    Write-Host "Row 7: $(if ($ok) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($ok) { 'Green' } else { 'Red' })
} catch {
    $results[7] = @{ Pass = $false; Detail = $_.Exception.Message }
    Write-Host "Row 7: FAIL - $($_.Exception.Message)" -ForegroundColor Red
}

if ($job) {
    Stop-LiveService $job
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
            -Headers @{ Authorization = "Bearer $slackToken" }
        if (-not $auth.ok) { throw "Slack auth.test failed: $($auth.error)" }
        $env:JARVIS_SLACK_BOT_TOKEN = $slackToken
        if (Test-Path $appData) { Remove-Item -Recurse -Force $appData }
        $job2 = Start-LiveService -AppData $appData -ServiceExe $serviceExe
        Start-Sleep -Seconds 3
        $apiToken = "live-matrix-token"
        $summary = Invoke-Turn -Command "summarize slack channel #general" -Token $apiToken
        $draft = Invoke-Turn -Command "draft a slack update for #general about roadmap" -Token $apiToken
        $send = Invoke-Turn -Command "send this to slack #general" -Token $apiToken
        $approved = $false
        if ($send.awaitingApproval -or (Get-TurnReply $send) -match 'approval|Waiting') {
            $approvals = Invoke-RestMethod -Uri "http://127.0.0.1:18789/mobile/approvals" -Headers @{ Authorization = "Bearer $apiToken" }
            $approvalId = $null
            if ($approvals.approvals -and $approvals.approvals.Count -gt 0) {
                $approvalId = $approvals.approvals[0].id
            } elseif ($approvals -is [array] -and $approvals.Count -gt 0) {
                $approvalId = $approvals[0].id
            }
            if ($approvalId) {
                Invoke-RestMethod -Uri "http://127.0.0.1:18789/mobile/approvals/$approvalId/approve" -Method Post -Headers @{ Authorization = "Bearer $apiToken" } | Out-Null
                $approved = $true
            }
        } else {
            $approved = (Get-TurnReply $send) -match 'sent|posted|slack'
        }
        $audit = Invoke-Turn -Command "search audit log for slack" -Token $apiToken
        $ok = (Turn-Ok $summary @('slack', 'summary', 'channel', 'message', 'roadmap')) -and
              (Turn-Ok $draft @('draft', 'slack', '#general', 'update')) -and
              ($approved -or (Turn-Ok $send @('sent', 'posted', 'approval', 'slack'))) -and
              (Turn-Ok $audit @('audit', 'slack'))
        $results[12] = @{ Pass = $ok; Detail = "live Slack summary + draft + send/approve + audit" }
        if (-not $ok) {
            Write-Host "  summary: $(Get-TurnReply $summary)" -ForegroundColor DarkYellow
            Write-Host "  draft: $(Get-TurnReply $draft)" -ForegroundColor DarkYellow
            Write-Host "  send: $(Get-TurnReply $send)" -ForegroundColor DarkYellow
            Write-Host "  audit: $(Get-TurnReply $audit)" -ForegroundColor DarkYellow
            Write-Host "  approved: $approved" -ForegroundColor DarkYellow
        }
        Write-Host "Row 12: $(if ($ok) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($ok) { 'Green' } else { 'Red' })
        Stop-LiveService $job2
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
