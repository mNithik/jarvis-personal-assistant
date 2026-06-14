# JARVIS Desktop App

This is the current Tauri + React desktop app for JARVIS.

## Layout

```text
src/          React frontend, UI workspaces, services, and command handling
src-tauri/    Rust backend commands, local storage, integrations, and Tauri config
dist/         Generated Vite build output
```

## Commands

Run these from the repository root:

```powershell
npm run dev
npm run tauri
npm --workspace @jarvis/desktop run build
cargo check -j 1 --manifest-path apps\desktop\src-tauri\Cargo.toml
```

Run these from this directory if you are working only on the frontend:

```powershell
npm run dev
npm run build
```

## Architecture (Agent Fabric)

```text
Ingress (voice, UI, POST /turn, Telegram, Discord*)
  → Gateway orchestrator (L0–L4 router, budgets, ApprovalGate)
  → Agent mesh (Command, Vision, Memory, Finance, Writer, …)
  → Knowledge plane (graph, RAG, vault, Obsidian MCP, CAG)
  → Egress (TTS, integrations handoff, channel replies)
  → Opt-in training JSONL → local router improvement

* Discord long-poll ships in Phase 2; token can be configured now.
```

New installs can opt into gateway easy mode: set `JARVIS_GATEWAY_EASY=1` before first launch.

Sidecar: `jarvis-service` binary (set `JARVIS_APP_DATA` to app data dir).

Verify gate:

```powershell
cd apps/desktop/src-tauri; cargo test --lib
cd ..; npx tsc --noEmit; npm run build
```
