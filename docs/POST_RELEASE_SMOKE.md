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

## Hosted sync (when server deployed)

1. Deploy `services/jarvis-sync` per [SYNC_SERVER.md](./SYNC_SERVER.md).
2. Sync panel → enter endpoint → **Register device** → Push → Pull on second profile/machine.

Record results in [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md).
