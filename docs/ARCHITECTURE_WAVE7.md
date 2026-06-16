# JARVIS Wave 7 architecture

## Legacy retirement slice (S23)

| Intent family | Gateway feature | Eval |
|---------------|-----------------|------|
| Desktop launch/focus | `studyRoutine` | `f_desktop_gateway_routes.json` |
| Screen OCR / screenshot | `screenOcr` | same |
| OCR watch / history | `ocrNotion` | same |

TS `executeIntentRouter` blocks gateway-owned intents via `legacyIntentGuards.ts` + `blockLegacyIntent()` when the matching gateway feature is enabled.

## Sustained slice (S24)

| Item | Implementation |
|------|----------------|
| Telegram headless | `sync_telegram_bot_headless` in `jarvis_service.rs` |
| README | Gateway on for new installs; jarvis-service + Discord WS documented |
| Obsidian API key | Persisted on `mcpHosts[].env.OBSIDIAN_API_KEY`; wizard test calls `test_mcp_host_connection` |
| Service health | `get_jarvis_service_status` reads `service-status.json` |

## Verify gate

```powershell
cd apps/desktop/src-tauri; cargo test --lib -j 1
cd ../..; npx tsc --noEmit
npm run build
```

See [ROADMAP.md](./ROADMAP.md) for Waves 8–10.
