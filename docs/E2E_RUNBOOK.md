# JARVIS E2E Runbook (Wave 14-15 + Wave 16 gate)

Repeatable validation before shipping platform features. Automated layers run in CI where supported; OAuth flows stay manual.

## Prerequisites

| Step | Where |
|------|--------|
| Notion token + database ID | System drawer -> Integrations |
| Google Calendar (+ optional Gmail) | Integrations -> Connect |
| Gateway enabled | Gateway settings |
| Local API token | Gateway -> `localWsToken` (copy for mobile + HTTP smoke) |
| Mobile approve | Gateway -> enable mobile approve + local turn API |
| Lab flags (optional) | Gateway -> Labs section |

Copy [`apps/desktop/e2e/.env.e2e.example`](../apps/desktop/e2e/.env.e2e.example) to `.env.e2e` locally. Never commit secrets.

## Windows test note

Full `cargo test --lib` on Windows may fail with `STATUS_ENTRYPOINT_NOT_FOUND`. Use:

```powershell
cd apps/desktop/src-tauri
cargo test --lib -j 1 --no-default-features
```

Run the complete golden harness (F1-F64) on Linux CI in [evals.yml](../.github/workflows/evals.yml).

## Automated layers

| Layer | Command | Requires |
|-------|---------|----------|
| Rust evals | `cargo test --lib -j 1 --no-default-features` | Linux CI or Windows workaround above |
| HTTP smoke | `npm run e2e:api` or `npm run e2e:api:service` | Running app locally, or headless `jarvis-service` in CI |
| Playwright UI | `npm run e2e:ui` | Starts Vite dev server with Tauri invoke mocks |
| Desktop smoke | `npm run e2e:desktop` | Built debug app + `tauri-driver` + native WebDriver |
| Smoke script syntax | `npm run e2e:smoke:check` | Node only; validates the smoke entrypoints before CI runs them |
| Windows smoke wrapper syntax | `npm run e2e:smoke:check:windows` | Windows PowerShell; parses the `.ps1` smoke wrappers used by CI/manual runs |

Current Playwright harness focus: command preview reasoning, gateway settings persistence, trigger recipe CRUD, profile-local installed skill overrides, profile-scoped sync goals, topic graph canvas + neighbor drill-down, ambient flow, and proactive nudge actions.

## CseGraph dev workflow (local only)

CseGraph is a **development-only** context engine for building JARVIS in Cursor. It is not part of the JARVIS runtime.

| Step | Command |
|------|---------|
| Index once | `csegraph index .` |
| Keep fresh | `csegraph watch .` (or refresh after large refactors) |
| Cursor MCP | `csegraph install --platform cursor` (repo-local `.cursor/mcp.json`, gitignored) |
| Before deep edits | Use MCP `csegraph_minimal` then `csegraph_context` for the task |

Rust grammars: `pip install "csegraph[rust]"`. Local state lives in `.csegraph/` (gitignored).

## HTTP smoke (Layer 2)

1. Start JARVIS (`npm run tauri`).
2. Enable gateway, `channels.localWsEnabled`, and set `localWsToken`.
3. For mobile endpoints, enable `channels.mobileApproveEnabled`.
4. Run:

```powershell
$env:E2E_BEARER_TOKEN = "your-token"
$env:E2E_LOCAL_API_PORT = "18789"
npm run e2e:api
```

For strict manual validation, use:

```powershell
scripts/e2e/smoke-local-api.ps1
```

Checks: `GET /health`, auth gates on `/mobile/brief`, `/mobile/approvals`, and `/turn`, brief JSON shape, approvals list shape, and `POST /turn` response shape.

When `CI=true` or `E2E_STRICT=true`, any missing mobile or turn endpoint becomes a hard failure instead of a skip or warning.

## HTTP CI status

- Current state: `e2e-api` is wired in CI on Windows.
- Boot path: `jarvis-service --console` with seeded `JARVIS_APP_DATA`.
- Strict mode: the CI helper sets `E2E_STRICT=true`, so missing mobile or turn endpoints fail the job.
- Shared repo entrypoint: CI now calls `npm run e2e:api:service` instead of a workflow-only PowerShell command.

The local manual path still exists if you want to smoke test against the desktop app directly.

## Manual integration matrix (Layer 4)

Requires live Google and Notion OAuth. Check each box per release candidate.

- [ ] Planner: morning brief -> save to Notion -> replan (Gmail urgency if connected)
- [ ] Meeting v2: prep -> refresh -> topic graph neighbor for event title
- [ ] Triggers: edit schedule/payload in Trigger Recipe panel -> save -> toggle enable
- [ ] Audit: search audit log -> rollback a Notion/calendar entry
- [ ] L1 bundle: enable `projectBundlePilot` -> run bundle -> 4 steps + audit refs
- [ ] L2 verifier: enable `councilVerifier` -> approve blocked send is denied
- [ ] Mobile PWA: phone on LAN -> `/approve/` -> brief + approve/deny
- [ ] Sync: export bundle -> import with passphrase -> profiles, active profile, goals, graph, and recall memory restored
- [ ] Profiles (Wave 16): switch work/personal/lab -> gateway features change
- [ ] Skill SDK (Wave 16): drop fixture skill -> route matches keyword; verify active-profile skills override global skills with the same id
- [ ] L6 ambient (Wave 16): consent -> focus session -> read-only suggestion, no writes; verify session/suggestion history stays profile-scoped

## Lab graduation manual matrix (F65-F70)

Requires fabric green + cohort judgment before flipping lab defaults.

- [ ] **F65 / L1 bundle:** ≥90% step success on golden fixtures; &lt;5% hard-abort; full audit trail
- [ ] **F66 / L2 verifier:** catches ≥80% injected bad-send fixtures; latency &lt;2× single-agent p95
- [ ] **F67 / L3 council runtime:** vote log present for bundle turns on golden replay
- [ ] **F68 / L4 proactive anomaly:** dismiss &lt;40%; accept &gt;25% over 2-week cohort
- [ ] **F69 / L5 world model:** topic graph canvas + ≥90% read-only golden queries
- [ ] **F70 / L6 ambient:** OCR/voice signal path live; dismiss &lt;40%; zero auto-writes

## Lab flags reference

| Flag | Config key |
|------|------------|
| L1 project bundle | `labs.projectBundlePilot` |
| L2 council verifier | `labs.councilVerifier` |
| L3 council runtime | `labs.councilRuntime` |
| L4 proactive anomaly | `labs.proactiveAnomaly` |
| L5 world model | `labs.worldModelQueries` |
| L6 ambient copilot | `labs.ambientCopilot` |

## Exit criteria (Sprint 0)

- Linux CI: `cargo test --lib --no-default-features` green (`rust-evals` job)
- Playwright: 16 UI specs green (`playwright-ui` job)
- tauri-driver: Windows CI launches a real WebDriver session and passes 4 desktop smoke checks in `scripts/e2e/run-desktop-smoke.mjs` (window title, command input, gateway preview update after routing a command, and gateway trace toggle)
- HTTP smoke passes locally and the `e2e-api` CI job (`npm run e2e:api:service`) stays green
- Manual matrix spot-checked for profiles, skills, ambient, sync, and lab graduation rows below
