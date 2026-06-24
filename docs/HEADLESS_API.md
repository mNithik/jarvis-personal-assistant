# JARVIS headless API

Local HTTP server on `127.0.0.1` (default port **18789**). Enable it in Gateway settings with **Local turn API** and an optional **Bearer token**.

Current note: the desktop app starts this listener today. `jarvis_service` also syncs a headless local turn API path for service-mode and CI use.

## Authentication

When `gateway.channels.localWsToken` is set, send:

```http
Authorization: Bearer <token>
```

## Endpoints

### `GET /health`

Liveness probe.

**Response:** `{"ok":true}`

### `POST /turn`

Execute a gateway turn.

**Request body:**

```json
{
  "command": "list trigger recipes",
  "channel": "api",
  "sessionId": "optional-session-id"
}
```

**Response:** `GatewayTurnResponse` JSON (`route`, `reply`, `trace`).

### `GET /mobile/brief`

Requires `channels.mobileApproveEnabled`.

**Response:**

```json
{
  "topThree": ["..."],
  "pendingApprovalCount": 0,
  "nextEvent": "Standup (soon)"
}
```

### `GET /mobile/approvals`

Pending approval inbox (same shape as desktop mission control).

### `POST /mobile/approvals/:id/approve`

### `POST /mobile/approvals/:id/deny`

Resolve a pending approval. Council verifier re-runs on approve when enabled.

## Examples

```bash
curl -s http://127.0.0.1:18789/health

curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"morning brief","channel":"api"}' \
  http://127.0.0.1:18789/turn
```

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:18789/mobile/brief" -Headers @{ Authorization = "Bearer $env:TOKEN" }
```

## Service mode

For always-on channels and proactive ticks without the desktop UI, run `jarvis_service` - see [ARCHITECTURE_WAVE3.md](./ARCHITECTURE_WAVE3.md) and `gateway/runtime/headless.rs`.

That service mode is the non-desktop boot path used by the `e2e-api` CI lane.

OpenAPI sketch: [openapi/local-turn-api.yaml](./openapi/local-turn-api.yaml)
