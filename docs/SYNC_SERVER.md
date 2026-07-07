# Jarvis Sync Server

Hosted encrypted bundle store for T17-D. Implements the client contract in [`sync_remote.rs`](../apps/desktop/src-tauri/src/gateway/sync_remote.rs).

## API

| Method | Path | Auth | Body |
|--------|------|------|------|
| POST | `/v1/devices/register` | — | `{ "label": "optional" }` → `{ deviceId, deviceToken }` |
| POST | `/v1/sync/bundles` | Bearer + `X-Jarvis-Device-Id` | Raw base64 bundle blob |
| GET | `/v1/sync/bundles/latest` | Bearer + `X-Jarvis-Device-Id` | Returns blob or 404 |

Headers: `X-Jarvis-Sync-Version: 1`

The server stores **opaque encrypted blobs** only. Passphrase never leaves the desktop client.

## Run locally

```powershell
cd services/jarvis-sync
cargo run
# listens on http://127.0.0.1:8787
```

Register a device:

```powershell
curl -X POST http://127.0.0.1:8787/v1/devices/register -H "Content-Type: application/json" -d "{}"
```

In JARVIS Sync panel: endpoint `http://127.0.0.1:8787` → **Register device** (or paste an existing `deviceToken`) → Connect → Push/Pull.

## Deploy

```powershell
docker build -t jarvis-sync services/jarvis-sync
docker run -p 8787:8787 -e JARVIS_SYNC_BIND=0.0.0.0:8787 jarvis-sync
```

Set `DATABASE_URL` for persistent SQLite (default: `jarvis-sync.db` in working directory).

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `JARVIS_SYNC_BIND` | `127.0.0.1:8787` | Listen address |
| `DATABASE_URL` | `sqlite:jarvis-sync.db` | Device + bundle storage |

## Security

- Use TLS in production (reverse proxy)
- Rotate device tokens by re-registering
- Bundles are client-encrypted; server cannot read profile/memory content
