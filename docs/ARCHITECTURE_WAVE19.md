# Wave 19 architecture — local-first production

Wave 19 hardens Wave 18 MVPs for **local-first** daily use. Cloud sync is optional and deferred; LAN Docker is the default deploy path.

## Tracks

| Track | Outcome | Primary modules |
|-------|---------|-----------------|
| T19-A Local sync deploy | docker-compose + `tools/start-jarvis-sync-local.ps1` | [`services/jarvis-sync`](../../services/jarvis-sync), [SYNC_SERVER.md](./SYNC_SERVER.md) |
| T19-B Signed marketplace | HMAC catalog verify + publish workflow | [`marketplace.rs`](../apps/desktop/src-tauri/src/gateway/marketplace.rs), [`OperatorPanel.tsx`](../apps/desktop/src/ui/settings/OperatorPanel.tsx) |
| T19-C Skill argv parity | Shared `parse_script_argv` in validator + executor | [`skills.rs`](../apps/desktop/src-tauri/src/gateway/skills.rs) |
| T19-D Operator lane | Audit tail + prepare publish package | [`OperatorPanel.tsx`](../apps/desktop/src/ui/settings/OperatorPanel.tsx) |
| T19-E Evals export | Fabric harness writes `evals-summary.json` | [`evals.rs`](../apps/desktop/src-tauri/src/gateway/evals.rs), [`metrics.rs`](../apps/desktop/src-tauri/src/gateway/metrics.rs) |

## T19-A: Local sync (not cloud)

- `docker compose up` in `services/jarvis-sync` with persistent volume
- Desktop endpoint: `http://127.0.0.1:8787` or `http://<lan-ip>:8787`
- Cloud (fly/Railway) documented as **optional future** in SYNC_SERVER.md

## T19-B: Marketplace signatures

When `JARVIS_MARKETPLACE_CATALOG_SECRET` is set, remote catalogs must use:

```json
{ "entries": [ ... ], "mac": "<base64-hmac-sha256>" }
```

Unsigned bundled catalog remains the default for offline installs.

## T19-C: Skill publish

`prepare_skill_publish_cmd` copies an installed skill to `app_data/publish/{id}` and emits catalog JSON + PR instructions.

## Verification

```powershell
npm run verify
cd services/jarvis-sync && cargo test
powershell -File tools/start-jarvis-sync-local.ps1 -Docker
```

Fabric index: F76–F79 in [`f_fabric_index.json`](../apps/desktop/tests/evals/f_fabric_index.json).

## Lab graduation (parallel)

See [LAB_GRADUATION_LOG.md](./LAB_GRADUATION_LOG.md). F70 ambient copilot dogfood starts after v0.1.2 release smoke.
