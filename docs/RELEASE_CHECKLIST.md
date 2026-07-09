# Release checklist (manual integration matrix)

Sign off each row before tagging a release candidate. Automated signals are listed for reference; manual verification is required for OAuth and lab flows.

| # | Area | Automated signal | Manual steps | Auto | Pass | Date | Notes |
|---|------|------------------|--------------|------|------|------|-------|
| 1 | Profiles | `eval_fabric_f61`, `profile-switcher.spec.ts` | Switch work/personal/lab; recall isolation; profile skill override | CI | [x] | 2026-07-08 | Playwright profile-switcher green |
| 2 | Skill SDK | `eval_fabric_f63`, `installed-skills.spec.ts` | Copy hello fixture; route keyword; marketplace install | CI | [x] | 2026-07-08 | Installed skills + mock marketplace install green |
| 3 | Sync bundle | `sync-panel.spec.ts`, sync round-trip unit test | Export → import; verify goals, graph, memory | CI | [x] | 2026-07-08 | Sync panel Playwright suite green |
| 4 | Triggers | `trigger-recipes.spec.ts` | Edit recipe → save → toggle enable → service log | CI partial | [ ] | | Needs `jarvis-service` |
| 5 | Planner | `f_planner_copilot_*` | Morning brief → Notion save → replan | eval | [ ] | | Needs Notion OAuth |
| 6 | Meeting v2 | `f_meeting_copilot_v2_*`, `topic-graph.spec.ts` | Prep → refresh → graph neighbor | CI partial | [ ] | | Needs Google OAuth |
| 7 | Audit | `eval_golden_f_audit_rollback_execution` | Search audit → rollback Notion/calendar | eval | [ ] | | |
| 8 | Mobile PWA | `e2e-api` `/mobile/*` | Phone on LAN → brief + approve/deny | CI partial | [ ] | | Phone manual |
| 9 | L1 bundle | `f_project_bundle_execution.json` | Enable `projectBundlePilot`; 4 steps + audit | eval | [ ] | | |
| 10 | L2 verifier | `f_council_verifier_execution.json` | Enable `councilVerifier`; deny bad send | eval | [ ] | | |
| 11 | L6 ambient | `eval_fabric_f64`, `ambient-copilot.spec.ts` | Consent session; read-only; profile scoped | CI | [x] | 2026-07-08 | Ambient copilot UI spec green |
| 12 | Slack v1 | `f_slack_copilot_*`, `slack-copilot.spec.ts` | Summary read, approval-required send, approved send appears in audit | CI partial | [ ] | | Live workspace sign-off pending |

**Auto column:** CI = Playwright/evals green on `main`; eval = golden harness only; manual rows still need human sign-off.

## Pre-release automated gate

```powershell
npm run verify
npm run verify:api    # optional; matches CI e2e-api job
cd services/jarvis-sync && cargo test
powershell -File tools/start-jarvis-sync-local.ps1 -Docker   # local sync smoke
```

CI must be green: `rust-evals`, `jarvis-sync`, `playwright-ui`, `e2e-api`, `e2e-desktop`.

Latest local evidence (2026-07-08):
- `npm run e2e:ui` -> 20/20 passed
- `cd services/jarvis-sync && cargo test` -> integration test passed

## Post-release smoke

See [POST_RELEASE_SMOKE.md](./POST_RELEASE_SMOKE.md) for clean-VM install verification after tagging.

## Hosted sync smoke (local-first)

After starting local sync (`tools/start-jarvis-sync-local.ps1 -Docker`):

1. Sync panel → endpoint `http://127.0.0.1:8787` → **Register device**
2. Push bundle with passphrase
3. Pull on second profile or after local wipe
4. Resolve conflicts via Sync panel buttons

Cloud deploy: optional — see [SYNC_SERVER.md](./SYNC_SERVER.md) § Cloud deploy (deferred).
