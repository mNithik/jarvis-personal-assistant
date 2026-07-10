# Slack setup (v1 + v2)

Slack in JARVIS supports:

- Channel summary (`summarize slack channel #channel`)
- Thread summary (`summarize slack thread #channel:<thread_ts>` or archive URL)
- Draft message (`draft a slack update for #channel about <topic>`)
- Send drafted message (`send this to slack #channel`) with Mission Control approval
- File upload (`upload file to slack #channel from <path>`) with Mission Control approval
- Planner handoff (`save slack action items to planner`)

## v2 additions (Wave 22)

- **Archive URL parsing** — `summarize slack thread https://<workspace>.slack.com/archives/<channel>/p<ts>` (and `?thread_ts=` query variants)
- **File upload** — `upload file to slack #channel from report.pdf` or `send file to slack #channel report.pdf`

## Required token and scopes

Set a bot token in local env:

```powershell
$env:JARVIS_SLACK_BOT_TOKEN = "xoxb-..."
```

Recommended bot scopes:

- `conversations:history`
- `conversations:replies`
- `chat:write`
- `files:write`

## Safety model

- Read flows (summaries, action extraction) execute directly.
- Send and upload flows route to `integrations.slack_send` and require explicit approval in Mission Control.
- Approved/denied outcomes are captured in the gateway audit ledger.

## CI and testing

- CI uses mocked Slack API responses (`f_slack_copilot_execution.json`, `f_slack_v2_execution.json`).
- Playwright: `slack-copilot.spec.ts`, `slack-v2.spec.ts`.
- No live Slack network dependency is required for evals or Playwright runs.
