# Release checklist (manual integration matrix)

Sign off each row before tagging a release candidate. Automated signals are listed for reference; manual verification is required for OAuth and lab flows.

| # | Area | Automated signal | Manual steps | Pass | Date | Notes |
|---|------|------------------|--------------|------|------|-------|
| 1 | Profiles | `eval_fabric_f61`, `profile-switcher.spec.ts` | Switch work/personal/lab; recall isolation; profile skill override | [ ] | | |
| 2 | Skill SDK | `eval_fabric_f63`, `installed-skills.spec.ts` | Copy hello fixture; route keyword; marketplace install | [ ] | | |
| 3 | Sync bundle | `sync-panel.spec.ts`, sync round-trip unit test | Export → import; verify goals, graph, memory | [ ] | | |
| 4 | Triggers | `trigger-recipes.spec.ts` | Edit recipe → save → toggle enable → service log | [ ] | | |
| 5 | Planner | `f_planner_copilot_*` | Morning brief → Notion save → replan | [ ] | | |
| 6 | Meeting v2 | `f_meeting_copilot_v2_*`, `topic-graph.spec.ts` | Prep → refresh → graph neighbor | [ ] | | |
| 7 | Audit | `eval_golden_f_audit_rollback_execution` | Search audit → rollback Notion/calendar | [ ] | | |
| 8 | Mobile PWA | `e2e-api` `/mobile/*` | Phone on LAN → brief + approve/deny | [ ] | | |
| 9 | L1 bundle | `f_project_bundle_execution.json` | Enable `projectBundlePilot`; 4 steps + audit | [ ] | | |
| 10 | L2 verifier | `f_council_verifier_execution.json` | Enable `councilVerifier`; deny bad send | [ ] | | |
| 11 | L6 ambient | `eval_fabric_f64`, `ambient-copilot.spec.ts` | Consent session; read-only; profile scoped | [ ] | | |

## Pre-release automated gate

```powershell
npm run verify
npm run verify:api    # optional; matches CI e2e-api job
```

CI must be green: `rust-evals`, `jarvis-sync`, `playwright-ui`, `e2e-api`, `e2e-desktop`.

## Post-release smoke

See [POST_RELEASE_SMOKE.md](./POST_RELEASE_SMOKE.md) for clean-VM install verification after tagging.

## Hosted sync smoke (Wave 18)

After deploying `services/jarvis-sync`:

1. Sync panel → enter endpoint → **Register device** (or paste token) → Connect
2. Push bundle with passphrase
3. Pull on second device or after local wipe
4. Resolve conflicts via Sync panel buttons
