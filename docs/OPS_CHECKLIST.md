# Operations checklist

## Every PR

```powershell
npm run verify
```

Optional before merge:

```powershell
npm run verify:api
```

CI runs: `rust-evals`, `jarvis-sync`, `playwright-ui`, `e2e-api`, `e2e-desktop`.

Local sync smoke: `powershell -File tools/start-jarvis-sync-local.ps1 -Docker`

## Every release candidate

1. Complete [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) manual matrix
2. Review [LAB_GRADUATION_LOG.md](./LAB_GRADUATION_LOG.md)
3. Update [ROADMAP.md](./ROADMAP.md) and wave architecture doc
4. Tag `v0.1.x` → GitHub release workflow

## Documentation sync

| Doc | Align with |
|-----|------------|
| E2E_RUNBOOK | Playwright spec count, CI jobs |
| README | Gateway default, migration link |
| SKILLS.md | Marketplace remote refresh |
| SYNC_SERVER.md | `services/jarvis-sync` API |

## Sync server ops

```powershell
cd services/jarvis-sync
cargo run
# or: docker build -t jarvis-sync services/jarvis-sync
```

## Metrics export (local)

- Proactive: Gateway settings → Operator panel → Export proactive metrics
- Evals: `JARVIS_EVALS_SUMMARY_PATH=./evals-summary.json cargo test gateway::evals::`
