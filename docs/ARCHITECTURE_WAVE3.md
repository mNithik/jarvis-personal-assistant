# Wave 3 architecture — Always-on

Wave 3 moves proactive automation state into SQLite, runs a headless gateway worker as `jarvis-service`, and adds Discord Gateway ingress.

## Always-on matrix

| Capability | Desktop (app open) | `jarvis-service` (SCM) | Storage |
|------------|-------------------|------------------------|---------|
| Proactive heartbeat | `heartbeat.rs` (skipped when service status file present) | `HeadlessGatewayContext::run_proactive_tick_headless` | `HEARTBEAT.md` in app data |
| Trigger queue | `trigger_dispatcher.rs` | `process_trigger_queue_headless` | `trigger_events` table |
| Morning brief | enqueue + dispatch | same | triggers |
| OCR watch ticks | emit + TS scheduler fallback | headless tick + DB watches | `ocr_watches` |
| Desktop schedules | TS timers + DB write-through | `schedule_runner.rs` | `desktop_schedules` |
| Saved workflows | TS + DB write-through | Rust `AutomationAgent` | `saved_workflows` + `routines` |
| Telegram | `telegram.rs` poller | `sync_telegram_bot_headless` + `service.log` lines | gateway config |
| Discord | `discord.rs` Gateway WebSocket | `sync_discord_bot_headless` | gateway config |

## Database (migration v1)

Applied via `migrations/mod.rs` on `init_database`:

- `trigger_events` — proactive/channel job queue
- `ocr_watches` — OCR watch definitions
- `desktop_schedules` — scheduled command rows
- `saved_workflows` — TS-compatible workflow JSON

Import: System drawer → Integrations → **Import automation from browser storage** (one-time, does not delete localStorage).

## Headless runtime

[`gateway/runtime/headless.rs`](../apps/desktop/src-tauri/src/gateway/runtime/headless.rs):

- `HeadlessGatewayContext` — runs `GatewayOrchestrator::run_turn` without Tauri
- `service-status.json` — desktop detects running service and defers proactive dispatch
- `service.log` — sidecar activity log

## Windows service

```powershell
cd apps/desktop/scripts
.\install-jarvis-service.ps1
```

Binary: `jarvis-service` (`src/bin/jarvis_service.rs`). Console dev mode: `jarvis-service --console` or `JARVIS_SERVICE_CONSOLE=1`.

## Discord ingress

Discord uses **Gateway WebSocket** (`wss://gateway.discord.gg`), not HTTP long-poll:

1. `GET /api/v10/gateway`
2. Identify with bot token + message content intent
3. On `MESSAGE_CREATE` → gateway turn → `POST /channels/{id}/messages`

Status: `get_discord_bot_status` Tauri command + Integrations drawer panel.

## Gateway-on automation parity

When gateway is enabled:

- `AutomationAgent` executes `saved_workflows` from SQLite (terminal `StepResult::ok`)
- OCR watch list/start/stop/pause/resume via `agents/ocr_watch.rs` (no TS handoff)
- Desktop schedule list via automation agent

## Evals added

- `f_automation_execution.json`
- `f_ocr_watch_execution.json`
- `f_schedule_execution.json`

## Verify gate

```powershell
cd apps/desktop/src-tauri; cargo test --lib -j 1
cd ../..; npx tsc --noEmit
npm run build
```
