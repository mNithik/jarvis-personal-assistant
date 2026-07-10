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
| Profile switcher lists work / personal / lab | [x] |
| Sync panel exports bundle with passphrase | [x] |
| Installed skills panel shows bundled catalog | [x] |
| Topic graph panel loads nodes | [x] |
| Mobile approve PWA loads on LAN (`http://<pc-ip>:18789/approve/`) | [x] |

Playwright proxy (2026-07-10): `profile-switcher`, `sync-panel`, `installed-skills`, `topic-graph`, and `e2e-api:service` `/mobile/*` cover the rows above on the v0.1.3 codebase. Spot-check phone on LAN when convenient.

## Automated evidence (2026-07-09)

- `npm run e2e:ui` -> 21/21 passed (includes slack-copilot, ambient, sync, topic-graph)
- `npm run e2e:api:service` -> strict HTTP smoke green
- `tools/run-q4-trust-matrix.ps1` -> automated trust layer green

## v0.1.3 gate

Tagged **v0.1.3** on 2026-07-10 after [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) reached **12/12** and `tools/prepare-v013-release.ps1` passed locally.

**GitHub Release (2026-07-10):** [v0.1.3](https://github.com/mNithik/jarvis-personal-assistant/releases/tag/v0.1.3) published (pre-release) with `JARVIS_0.1.0_x64-setup.exe` and `JARVIS_0.1.0_x64_en-US.msi`.

- `npm run e2e:ui` passed (21/21 specs)
- `cargo test` in `services/jarvis-sync` passed (including register/upload/fetch integration)
- `tools/run-q4-trust-matrix.ps1` automated layer green

## v0.1.4 gate

Wave 22: Slack v2 (archive URL threads + approval-gated file upload), trust polish, F70 dogfood cycle re-opened. Run `tools/prepare-v014-release.ps1` before tagging.

## Hosted sync (local-first)

1. On PC: `powershell -File tools/start-jarvis-sync-local.ps1 -Docker`
2. Sync panel → `http://127.0.0.1:8787` → Register device → Push → Pull

See [SYNC_SERVER.md](./SYNC_SERVER.md).

Record results in [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md).
