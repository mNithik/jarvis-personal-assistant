$ErrorActionPreference = 'Stop'
Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $k, $v = $_ -split '=', 2
    if ($k.Trim() -eq 'JARVIS_NOTION_TOKEN') { $token = $v.Trim() }
}
$h = @{
    Authorization = "Bearer $token"
    'Notion-Version' = '2022-06-28'
    'Content-Type' = 'application/json'
}
$s = Invoke-RestMethod -Uri 'https://api.notion.com/v1/search' -Method Post -Headers $h -Body '{}'
$pageId = ($s.results | Where-Object { $_.object -eq 'page' } | Select-Object -First 1).id
if (-not $pageId) { throw 'no page parent for database' }
$body = @{
    parent = @{ type = 'page_id'; page_id = $pageId }
    title = @(@{ type = 'text'; text = @{ content = 'Jarvis Planner Test' } })
    properties = @{ Name = @{ title = @{} } }
} | ConvertTo-Json -Depth 6
$db = Invoke-RestMethod -Uri 'https://api.notion.com/v1/databases' -Method Post -Headers $h -Body $body
Write-Output "created database id=$($db.id)"
