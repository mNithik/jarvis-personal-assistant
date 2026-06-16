# JARVIS Wave 2 — Gateway-on execution matrix

When **gateway is enabled** (`gateway.enabled = true`), commands route through the Rust gateway first. Legacy TypeScript handlers are skipped or guarded for capabilities that now execute in Rust.

## Legend

| Symbol | Meaning |
|--------|---------|
| **Rust** | Executes entirely in the gateway (no TS handoff) |
| **Handoff** | Rust plans the step; TS bridge executes side effects |
| **TS legacy** | TypeScript router only (gateway off or feature flag off) |

## Command capabilities

| Capability | Gateway flag | Gateway on | Gateway off |
|------------|--------------|------------|-------------|
| Clipboard read/write | (always when gateway on) | **Rust** | TS legacy |
| PDF list/search/open/read | (always when gateway on) | **Rust** | TS legacy |
| PDF summarize (basic) | (always when gateway on) | **Rust** | TS legacy |
| PDF summarize→Notion, task extract | — | **Handoff** / TS | TS legacy |
| File search / recent files | (always when gateway on) | **Rust** | TS legacy |
| Google search | (always when gateway on) | **Handoff** (browser) | TS legacy |
| Study setup | `studyRoutine` | **Rust** | TS legacy |

## Integrations

| Capability | Gateway flag | Gateway on | Gateway off |
|------------|--------------|------------|-------------|
| Gmail list/search/read | `gmail` | **Rust** (session email store) | TS legacy |
| Gmail open in browser | `gmail` | **Handoff** / TS | TS legacy |
| Calendar list/create/from-email | `calendar` | **Rust** | TS legacy |
| Meeting prep (complex) | `calendar` | **Handoff** / TS | TS legacy |
| Notion list/search/create | `notion` | **Rust** | TS legacy |
| Spotify transport | `spotify` | **Handoff** | TS legacy |
| OCR→Notion (screen read) | `ocrNotion` | **Rust** (read screen) | TS legacy |
| OCR watches / history save | `ocrNotion` | **Handoff** | TS legacy |
| Email→Notion save current/latest | `emailNotion` + `notion` | **Rust** | TS legacy |
| Email→Notion digest/batch/travel/expense | `emailNotion` | **Handoff** | TS legacy |
| GitHub MCP (NL) | MCP host config | **Rust** | TS legacy |

## Memory / builder / supervisor

| Capability | Gateway flag | Gateway on | Gateway off |
|------------|--------------|------------|-------------|
| Daily brief, vault search | `memory` | **Rust** / routed | TS legacy |
| Builder handoff, project checks | `builder` | **Handoff** | TS legacy |
| `then` supervisor chains | — | **Rust** planner | TS legacy |
| Workflows / automations | — | **Rust** (partial) | TS legacy |

## Handoff re-entry guards (Wave 2.3d)

`mapIntegrationHandoffToIntent` returns `null` for handoffs that would duplicate Rust execution:

- `integrations.google` — all actions (Gmail runs in Rust)
- `integrations.calendar` — all actions (Calendar runs in Rust)
- `integrations.email_notion` — `save_current_email`, `save_latest_email`

## Simulation modes

With `dry_run` or `plan_only`, gateway blocks handoffs and legacy execution when `shouldDelegateToGateway` matches.

## Verify gate

```powershell
cd apps/desktop/src-tauri; cargo test --lib -j 1
cd ../..; npx tsc --noEmit
npm run build
```
