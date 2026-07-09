# Post-release smoke (v0.1.x)

Run on a **clean Windows VM** after installing the `.msi` or `.exe` from GitHub Releases.

## Install

1. Download the latest `v0.1.x` asset from [GitHub Releases](https://github.com/mNithik/jarvis-personal-assistant/releases).
2. Install with default options; launch JARVIS once.
3. Confirm the gateway onboarding dry-run banner appears (gateway on for new installs).

## Automated smoke (optional, from dev machine)

Against a running installed build with gateway HTTP enabled:

```powershell
$env:E2E_BEARER_TOKEN = "<localWsToken from Gateway → Channels>"
npm run e2e:api
```

## Manual spot-check (15 min)

| Check | Pass |
|-------|------|
| Profile switcher lists work / personal / lab | [ ] |
| Sync panel exports bundle with passphrase | [ ] |
| Installed skills panel shows bundled catalog | [ ] |
| Topic graph panel loads nodes | [ ] |
| Mobile approve PWA loads on LAN (`http://<pc-ip>:18789/approve/`) | [ ] |

## Automated evidence (2026-07-09)

- `npm run e2e:ui` -> 21/21 passed (includes slack-copilot, ambient, sync, topic-graph)
- `npm run e2e:api:service` -> strict HTTP smoke green
- `tools/run-q4-trust-matrix.ps1` -> automated trust layer green

## v0.1.3 gate

Tag only after [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) shows **12/12** signed. Current blocker: rows 5, 7, 12 (live OAuth / Slack).


- `npm run e2e:ui` passed (20/20 specs)
- `cargo test` in `services/jarvis-sync` passed (including register/upload/fetch integration)

## Hosted sync (local-first)

1. On PC: `powershell -File tools/start-jarvis-sync-local.ps1 -Docker`
2. Sync panel → `http://127.0.0.1:8787` → Register device → Push → Pull

See [SYNC_SERVER.md](./SYNC_SERVER.md).

Record results in [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md).
