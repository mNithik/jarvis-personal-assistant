# Jarvis Sync Server

Hosted encrypted bundle store for T17-D. Implements the client contract in [`sync_remote.rs`](../apps/desktop/src-tauri/src/gateway/sync_remote.rs).

**Local-first:** JARVIS does not require cloud. Run sync on your PC or LAN; cloud is optional.

## API

| Method | Path | Auth | Body |
|--------|------|------|------|
| POST | `/v1/devices/register` | — | `{ "label": "optional" }` → `{ deviceId, deviceToken }` |
| POST | `/v1/sync/bundles` | Bearer + `X-Jarvis-Device-Id` | Raw base64 bundle blob |
| GET | `/v1/sync/bundles/latest` | Bearer + `X-Jarvis-Device-Id` | Returns blob or 404 |
| GET | `/v1/sync/bundles/history?limit=10` | Bearer + `X-Jarvis-Device-Id` | Returns version metadata for recent uploads |
| POST | `/v1/sync/tokens/revoke` | Bearer + `X-Jarvis-Device-Id` | `{ "reason": "optional" }` revokes current token |

Headers: `X-Jarvis-Sync-Version: 1`

The server stores **opaque encrypted blobs** only. Passphrase never leaves the desktop client.

## Quick start (local, recommended)

### Option A — PowerShell script

```powershell
# From repo root — cargo run on 0.0.0.0:8787
powershell -File tools/start-jarvis-sync-local.ps1

# Or Docker with persistent volume
powershell -File tools/start-jarvis-sync-local.ps1 -Docker
```

### Option B — docker compose

```powershell
cd services/jarvis-sync
docker compose up --build -d
```

### Option C — cargo run

```powershell
cd services/jarvis-sync
$env:JARVIS_SYNC_BIND = "0.0.0.0:8787"
cargo run --release
```

## Desktop setup

1. Gateway → Sync panel
2. Endpoint: `http://127.0.0.1:8787` (same PC) or `http://<your-pc-lan-ip>:8787` (second device on Wi‑Fi)
3. **Register device** → **Push** → **Pull** on another profile/machine

## LAN smoke checklist

| Step | Pass |
|------|------|
| `curl http://127.0.0.1:8787/health` returns ok | [ ] |
| Register device from Sync panel | [ ] |
| Push bundle with passphrase | [ ] |
| Pull on second profile; goals/memory restored | [ ] |

## Cloud deploy (optional, deferred)

Cloud is **not required**. When you need sync across networks without VPN:

- Deploy container to fly.io or Railway with TLS reverse proxy
- Mount persistent volume for `DATABASE_URL`
- Point desktop at `https://sync.yourdomain.com`

No managed JARVIS cloud is shipped with this repo — you self-host.

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `JARVIS_SYNC_BIND` | `127.0.0.1:8787` | Listen address (`0.0.0.0:8787` for LAN) |
| `DATABASE_URL` | `sqlite:jarvis-sync.db` | Device + bundle storage |

## Security

- LAN-only deploy has no TLS — use only on trusted networks
- Use TLS in production cloud deploy
- Rotate device tokens by re-registering or calling `/v1/sync/tokens/revoke`
- Bundles are client-encrypted; server cannot read profile/memory content
- Server stores latest blob plus upload history metadata for reliability/audit trails
