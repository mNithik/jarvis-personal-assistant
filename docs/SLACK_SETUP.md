# Slack v1 setup

Slack v1 in JARVIS supports:

- Channel summary (`summarize slack channel #channel`)
- Thread summary (`summarize slack thread #channel:<thread_ts>`)
- Draft message (`draft a slack update for #channel about <topic>`)
- Send drafted message (`send this to slack #channel`) with Mission Control approval
- Planner handoff (`save slack action items to planner`)

## Required token and scopes

Set a bot token in local env:

```powershell
$env:JARVIS_SLACK_BOT_TOKEN = "xoxb-..."
```

Recommended bot scopes:

- `conversations:history`
- `conversations:replies`
- `chat:write`

## Safety model

- Read flows (summaries, action extraction) execute directly.
- Send flows route to `integrations.slack_send` and require explicit approval in Mission Control.
- Approved/denied outcomes are captured in the gateway audit ledger.

## CI and testing

- CI uses mocked Slack API responses (`f_slack_copilot_execution.json`).
- No live Slack network dependency is required for evals or Playwright runs.
