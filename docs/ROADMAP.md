# JARVIS product roadmap

## Wave 1 — Phase 0 finish (complete)

- [x] Gateway onboarding banner (easy-mode dry-run)
- [x] Writer/finance cockpit cards with approval hints
- [x] Clipboard/PDF gateway delegation when gateway enabled
- [x] GitHub MCP in daily turns (NL phrases + `mcp github …`)
- [x] Gateway-native clipboard read/write + basic PDF list/search/open in Rust
- [x] TS router: removed basic clipboard read/write and PDF CRUD branches

**Requires gateway ON** for basic clipboard/PDF commands (`read clipboard`, `list pdfs`, etc.).

## Wave 1.5 — UI polish (complete)

- [x] CSS design tokens (`--space-*`, `--radius-*`, surfaces, z-index)
- [x] Launchpad-first home via `HomeSurface` + `HomeHero`
- [x] Single primary cockpit CTA on home
- [x] Gateway trace hidden behind toggle in cockpit
- [x] `SystemDrawerTabs` component (ready for drawer split)
- [x] Full drawer tab split (models / integrations / voice panels) — Wave 2 peel

## Wave 2 — Foundation (S4–S7)

- [x] Peel `JarvisAppRoot.logic.tsx` into hooks (`useJarvisOcr`, `useJarvisModelRouter`, `useJarvisVoiceRuntime`, `useJarvisCommandRouterDeps`, `useJarvisDesktopWorkspaces`, `useJarvisIntegrations`, `useJarvisWorkflows`)
- [x] Split system drawer into tab panels (`DrawerVoicePanel`, `DrawerModelsPanel`, `DrawerIntegrationsPanel`)
- [x] Peel OCR / voice / model router / desktop workspace sections into hooks
- [x] Remove `@ts-nocheck` from `createJarvisCommandRouter.ts` (handler modules typed)
- [x] Gateway execution: Gmail, Calendar, files (`list_recent_files`), PDF summarize, partial email→Notion
- [x] Target: logic <5k lines (current **4,833**), router <5k (current **4,578**), ≥40% gateway-owned evals (**35** route+execution suites; **5/12** Rust execution capabilities with execution golden ≈ **42%**)

See [ARCHITECTURE_WAVE2.md](./ARCHITECTURE_WAVE2.md) for the gateway-on execution matrix.

## Wave 3 — Always-on (S8–S11)

- [x] DB migrations (**user approval required**) — v1: `trigger_events`, `ocr_watches`, `desktop_schedules`, `saved_workflows`
- [x] Windows Service install for `jarvis-service` — `install-jarvis-service.ps1` + SCM entry
- [x] Discord Gateway WebSocket ingress (replaces stub in `gateway/discord.rs`)
- [x] Automation Rust parity without TS handoff — workflows, OCR watches, schedules

See [ARCHITECTURE_WAVE3.md](./ARCHITECTURE_WAVE3.md) for the always-on matrix.

## Wave 4 — Knowledge mesh (S12–S15)

- [x] CAG reload from app data
- [x] Obsidian graph MCP / backlinks in turns
- [x] MCP action packs: Jira, Zapier, HuggingFace (NL routing like GitHub)
- [x] Readwise/Zotero import hardening

See [ARCHITECTURE_WAVE4.md](./ARCHITECTURE_WAVE4.md) for the knowledge recall matrix.

## Wave 5 — Intelligence (S16–S19)

- [x] Training JSONL → anonymize → eval gate
- [x] `ollama create jarvis-router`
- [x] L3/L4 supervisor recovery in production
- [x] Semantic learning panel → SQLite phrase suggestions

See [ARCHITECTURE_WAVE5.md](./ARCHITECTURE_WAVE5.md) for the intelligence loop matrix.

## Wave 6 — Fabric closeout (S20–S22)

- [x] TS router <2k lines (glue only)
- [x] F1–F40 eval closeout (`tests/evals/f_fabric_index.json`)
- [x] Gateway default for new installs
- [x] Architecture docs + paid-mode caps

See [ARCHITECTURE_WAVE6.md](./ARCHITECTURE_WAVE6.md) for the fabric closeout matrix.

## Wave 7 — Desktop/OCR + sustained (S23–S24)

- [x] Desktop/OCR/automation UI legacy guards + `f_desktop_gateway_routes.json`
- [x] Telegram headless in `jarvis-service`
- [x] README sync (gateway on for new installs)
- [x] Obsidian API key persistence + MCP connection test
- [x] `ARCHITECTURE_WAVE7.md`

See [ARCHITECTURE_WAVE7.md](./ARCHITECTURE_WAVE7.md).

## Wave 8 — Memory + evals (S25–S26)

- [x] Memory/people/travel intent guards + `f_memory_gateway_routes.json`
- [x] F1/F2/F21/F35 fabric eval gaps closed
- [x] Service health card reads `service-status.json`
- [x] Fabric harness runs `executionEval` files from index

## Wave 9 — Integrations + MCP (S27–S28)

- [x] Spotify/Notion/shell chrome legacy guards
- [x] MCP env passthrough (Jira/HF/Zapier/Obsidian host env)
- [x] Preset connection test UX with missing-token errors
- [x] `jarvis_mcp` proxy expansion (`describe_jarvis_capability`)

## Wave 10 — Router closeout + optional (S29–S32)

- [x] `runCommandGatewayPath.ts` + `runCommandPrelude.ts` extracted from `runCommandRouter`
- [x] Legacy intent guards cover gateway-owned executeIntent kinds
- [x] `cargo test` desktop spawns noop (no VS Code/Explorer left open)
- [x] Email trigger inbox slice (`gmail_label_inbox` trigger + eval routes)
- [x] `useJarvisTrainingMode` + `useJarvisRustMemoryLoader` hooks (logic peel in progress)
- [x] Logic peel complete: `JarvisAppRoot.logic.tsx` is a thin entry (~6 lines); orchestration in `useJarvisAppRoot.tsx` with integrations OAuth/boot in `useJarvisIntegrations`, loaders in `useJarvisShellLoaders`, persistence in `useJarvisShellPersistence`, router bridge in `useJarvisShellRouterBridge`, render in `JarvisAppRoot.render.tsx`
- [x] `executeIntent/` domain modules + dispatcher (`executeIntentRouter.ts` re-export shim)

## Wave 11 — Peel integration + meeting copilot

- [x] Orphaned peel artifacts wired: `JarvisAppRoot.render.tsx`, `useJarvisShellViewModel`, `useJarvisShellRouterBridge`, domain hooks (`useJarvisWorkflows`, `useJarvisVoiceRuntime`, `useJarvisModelRouter`, `useJarvisOcr`, `useJarvisDesktopWorkspaces`, `useJarvisRustMemoryLoader`, `useJarvisTrainingMode`, `useJarvisBuilderAutopilot`), `crossFeatureSuggestions.ts`
- [x] Router deps assembly extracted to `buildJarvisRouterBridgeState.ts` + `jarvisAppRootLegacyImports.ts` (legacy import surface trimmed out of root hook)
- [x] Meeting copilot: `calendar_event_soon` trigger + headless proactive enqueue when calendar token present and event starts within 15 minutes
- [x] Golden routes: `f_meeting_copilot_routes.json` (fabric F41); memory prep phrases + L0 keywords
- [x] Cockpit **Meeting** signal + proactive cross-suggestion when prep memory empty and calendar event imminent
- [x] `useJarvisAppRoot.tsx` line budget (&lt;1,500): peel closed in Wave 12 — thin entry + `useJarvisAppRootComposition.tsx`

## Wave 12 — Peel closeout + copilot depth + always-on hardening

- [x] **Track A — Peel:** `useJarvisShellState`, `useJarvisShellPanelChrome`, `jarvisRouterBridgeContext.build`, `useJarvisRouterBridgeContext`, `useJarvisShellRenderAssembly`; `useJarvisAppRoot.tsx` is a thin entry
- [x] **Track B — Memory UI:** Meeting copilot card in Memory workspace (next meeting, prep status, quick actions)
- [x] **Track C — Calendar prep:** `compose_meeting_copilot_reply` + `MemoryAction::MeetingCopilot` with calendar token enrichment
- [x] **Track F — F42 execution eval:** `f_meeting_copilot_execution.json` + `eval_golden_f_meeting_copilot_execution` (fabric index 42)
- [x] **Track E — Router glue:** `runCommandLegacyPath.ts` extracted; `runCommandRouter.ts` &lt;700 lines; removed `export *` from router glue
- [x] **Track D — Telegram:** headless tests + `service.log` observability; Wave 3 matrix parity

See [ARCHITECTURE_WAVE12.md](./ARCHITECTURE_WAVE12.md).

## Tier Upgrade — Hybrid roadmap (Wave 13+)

Post–Wave 12 tier upgrade: **production (balanced)** + **labs (moonshot)** on shared gateway core.

See [TIER_UPGRADE_VISION.md](./TIER_UPGRADE_VISION.md) for north star, lenses, and phasing.

### Wave 13 — Mission control + trust + email copilot (0–90 days)

- [x] **T13-B (baseline):** `GatewayPolicyClass`, policy resolver, approval gate integration, `audit.log` ledger, `GatewayLabsConfig`, `get_gateway_audit_log` command
- [x] **T13-A Mission control v1:** `MissionControlPanel`, approval inbox, task runs, explainability trace, audit ledger
- [x] **T13-C Email copilot:** triage, draft reply, workspace card (`EmailSections`), L0 routes + execution evals
- [x] **T13-D Memory v2 controls:** pin, forget, correct via entity metadata + `MemoryControlsPanel`
- [x] **T13-E Evals v2:** F43–F48 golden files + harness wired in fabric index (48 entries)
- [x] **T13-F Reliability:** `task_state` bridge, `list_gateway_task_runs`, resume last task, `StepFailureKind`
- [x] **Lab L1:** meeting follow-up project bundle (flag)
- [x] **Lab L2:** council verifier on send (flag)

See [ARCHITECTURE_WAVE13.md](./ARCHITECTURE_WAVE13.md), [TIER_UPGRADE_BALANCED_90D.md](./TIER_UPGRADE_BALANCED_90D.md), [TIER_UPGRADE_MOONSHOT_LABS.md](./TIER_UPGRADE_MOONSHOT_LABS.md).

### Wave 14 — Daily loops + orchestration (3–6 months)

- [x] **T14-T Embedded terminal:** multi-tab Builder PTY (Shell, Claude Code, Codex) + handoff launch
- [x] Day planner copilot (morning brief + dynamic replan; Gmail urgency bump in replan)
- [x] Meeting copilot v2 (prep from related emails, notes, tasks; topic graph auto-link on save)
- [x] Trigger recipe builder UI (schedule/threshold/command editor + presets)
- [x] Audit ledger search + rollback (calendar, notion)
- [x] Lab L1: meeting follow-up project bundle — sequential steps, draft + Notion, proactive trigger (flag)
- [x] Lab L2: council verifier on send — block on approve, F56 evals (flag)
- [x] Lab L3: council runtime vote log for bundles (flag)
- [x] Lab L4: proactive anomaly nudges + Command workspace dismiss (flag)

See [ARCHITECTURE_WAVE15.md](./ARCHITECTURE_WAVE15.md) for Wave 14 graduation matrix and Wave 15 architecture.

### Wave 15 — Platform prep (6–12 months)

- [x] Mobile approve PWA (brief + approval inbox via local API on port 18789)
- [x] Memory topic graph (`memory_relations`, adjacency UI, L0 routes)
- [x] Travel copilot baseline (checklist, timeline, refresh prep)
- [x] Lab L5: world model queries (read-only, flag-gated)
- [x] Optional cloud sync beta (encrypted local export/import of settings + goals + recipes)

### Wave 16+ — Platform

- [ ] Work/personal/lab profiles
- [ ] Skill SDK v1
- [ ] Headless API documentation
- [ ] Lab L6: ambient multimodal copilot

## Verify gate (every sprint)

```powershell
cd apps/desktop/src-tauri; cargo test --lib -j 1 --no-default-features
# On Windows, full default-feature tests may fail with STATUS_ENTRYPOINT_NOT_FOUND; use --no-default-features locally and rely on Linux CI for the full harness.
cd ../..; npx tsc --noEmit
npm --workspace @jarvis/desktop run build
```
