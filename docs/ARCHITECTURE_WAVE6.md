# Wave 6 architecture — Fabric closeout

Wave 6 retires the monolithic TypeScript router, closes the F1–F40 eval matrix, and makes the gateway the default path for new installs.

## TS router glue (S20)

| File | Role | Lines (approx) |
|------|------|----------------|
| [`createJarvisCommandRouter.ts`](../apps/desktop/src/features/command/createJarvisCommandRouter.ts) | Factory glue only | **< 50** |
| [`executeIntentRouter.ts`](../apps/desktop/src/features/command/executeIntentRouter.ts) | Legacy intent execution |
| [`runCommandRouter.ts`](../apps/desktop/src/features/command/runCommandRouter.ts) | NL routing + gateway delegation |
| [`commandRouterTypes.ts`](../apps/desktop/src/features/command/commandRouterTypes.ts) | Shared deps type |

Regenerate split after major router edits:

```powershell
node apps/desktop/scripts/split-command-router.mjs
```

## F1–F40 eval closeout (S21)

Index: [`tests/evals/f_fabric_index.json`](../apps/desktop/tests/evals/f_fabric_index.json)

- 40 fabric features mapped to capability IDs
- Route goldens wired where available (`eval` field)
- Execution goldens referenced via `executionEval` where applicable
- Rust harness: `eval_golden_f_fabric_index` in [`evals.rs`](../apps/desktop/src-tauri/src/gateway/evals.rs)

Entries without route JSON (F1 voice, F2 wake, F21 model UI, F35 hygiene) are marked `ui_runtime` or `scheduled`.

## Gateway default for new installs (S22)

First launch seeds `{app_data}/gateway.json` via [`ensure_default_gateway_config`](../apps/desktop/src-tauri/src/gateway/config.rs):

- `enabled: true`
- `mode: execute`
- Core features: study, screen OCR, memory, builder
- Proactive: heartbeat + morning brief + OCR watch tick

Override with env `JARVIS_GATEWAY_EASY=1` for dry-run easy mode instead.

## Paid-mode caps

[`GatewayPaidModeConfig`](../apps/desktop/src-tauri/src/gateway/config.rs) (default **off**):

| Field | Default | Purpose |
|-------|---------|---------|
| `enabled` | `false` | Master switch for paid cloud providers |
| `maxDailyRequests` | `0` | Hard daily cap (0 = no paid calls) |
| `requireUserOptIn` | `true` | User must opt in before paid routing |

Free-tier quotas remain in `GatewayQuotaConfig` (Groq, OpenRouter, NIM, Cerebras daily limits).

## Verify gate

```powershell
cd apps/desktop/src-tauri; cargo test --lib -j 1
cd ../..; npx tsc --noEmit
npm run build
```
