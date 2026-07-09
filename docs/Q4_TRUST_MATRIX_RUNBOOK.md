# Q4 Trust Matrix Runbook

Close all 12 rows in [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) before tagging **v0.1.3**.

## Quick automated gate

```powershell
powershell -File tools/run-q4-trust-matrix.ps1
npm run verify
npm run verify:api
cd services/jarvis-sync && cargo test
```

## Live sign-off (rows 5, 7, 12)

After setting credentials in `.env`:

```powershell
# If no Notion database is shared with the integration yet:
powershell -File tools/_create-notion-db.ps1
# Add printed database id to .env as JARVIS_NOTION_DATABASE_ID

# Add JARVIS_SLACK_BOT_TOKEN for row 12 (see SLACK_SETUP.md)

powershell -File tools/sign-live-matrix-rows.ps1 -UpdateChecklist
```

This runs live planner, audit rollback, and Slack flows via `jarvis-service` + `/turn`, then updates [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md).

Golden harness (Linux CI / Windows workaround): `cargo test --lib -j 1 --no-default-features` in `apps/desktop/src-tauri`.

## Row-by-row manual steps

### Row 4 — Triggers

1. Install service: `powershell -File apps/desktop/scripts/install-jarvis-service.ps1`
2. Gateway → Trigger Recipes: edit schedule/payload → Save
3. Toggle enable; confirm entry in `jarvis-service` log
4. Automated helper: `trigger-recipes.spec.ts`

### Row 5 — Planner

1. System drawer → Integrations: Notion token + database ID
2. `morning brief` → `save plan to notion` → `replan my day`
3. Automated helper: `f_planner_copilot_routes.json`, `f_planner_copilot_execution.json` (fixtures)

### Row 6 — Meeting v2

1. Connect Google Calendar (+ optional Gmail)
2. Meeting copilot: prep → refresh → topic graph neighbor for event title
3. Automated helper: `topic-graph.spec.ts`, `f_meeting_copilot_v2_*`

### Row 7 — Audit rollback

1. Create a Notion or calendar mutation with gateway on
2. Cockpit → audit search → rollback entry
3. Automated helper: `eval_golden_f_audit_rollback_execution`

### Row 8 — Mobile PWA

1. Gateway → Channels: enable local WS + mobile approve; copy `localWsToken`
2. Phone on LAN: `http://<pc-ip>:18789/approve/` → brief + approve/deny
3. Automated helper: `npm run e2e:api:service` (API strict; not a phone substitute)

### Row 9 — L1 bundle

1. Gateway → Labs: enable `projectBundlePilot`
2. Run 4-step bundle; confirm audit refs under `app_data/bundles/`
3. Automated helper: `f_project_bundle_execution.json`

### Row 10 — L2 verifier

1. Gateway → Labs: enable `councilVerifier`
2. Trigger bad-send fixture; confirm Mission Control denies
3. Automated helper: `f_council_verifier_execution.json`

### Row 12 — Slack v1

1. Set `JARVIS_SLACK_BOT_TOKEN` with `conversations:history`, `conversations:replies`, `chat:write`
2. `summarize slack channel #general`
3. `draft a slack update for #general about roadmap`
4. `send this to slack #general` → approve in Mission Control → verify audit row
5. Automated helper: `slack-copilot.spec.ts`, `f_slack_copilot_*`

See [SLACK_SETUP.md](./SLACK_SETUP.md).

## Sign-off workflow

After each row passes manual + automated criteria:

1. Update [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) Pass `[x]`, Date, Notes
2. Commit on `q4/trust-release` branch
3. When 12/12 signed → run [POST_RELEASE_SMOKE.md](./POST_RELEASE_SMOKE.md) → tag `v0.1.3`

## Labs coupling (rows 9–10)

Rows 9–10 require lab flags on. Follow [LAB_GRADUATION_LOG.md](./LAB_GRADUATION_LOG.md) F65/F66 protocols before flipping defaults for new installs.
