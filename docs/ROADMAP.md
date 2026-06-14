# JARVIS product roadmap (Waves 2–6)

Ship-first v0.1 is Track A. This file tracks remaining master-pipeline work.

## Wave 1 (Phase 0 finish) — in progress

- [x] Gateway onboarding banner (easy-mode dry-run)
- [x] Writer/finance cockpit cards with approval hints
- [x] Clipboard/PDF gateway delegation when gateway enabled (via `shouldDelegateToGateway`)
- [ ] GitHub MCP in daily turns (beyond connection probe)
- [ ] Delete redundant TS router branches for PDF/clipboard (Phase 1 S6)

## Wave 2 — Foundation (S4–S7)

- Peel `JarvisAppRoot.logic.tsx` into hooks (voice, OCR, providers)
- Remove `@ts-nocheck` from `createJarvisCommandRouter.ts` in batches
- One intent family deleted per sprint: Gmail → Calendar → files/PDF
- Target: router <5k lines, logic <5k lines, ≥40% gateway-owned evals

## Wave 3 — Always-on (S8–S11)

- DB migrations (user approval required)
- Windows Service install for `jarvis-service`
- Discord long-poll (replace stub in `gateway/discord.rs`)
- Automation Rust parity without TS handoff

## Wave 4 — Knowledge mesh (S12–S15)

- CAG reload from app data
- Obsidian graph MCP / backlinks in turns
- MCP action packs: Jira, Zapier, HuggingFace
- Readwise/Zotero import hardening

## Wave 5 — Intelligence (S16–S19)

- Training JSONL → anonymize → eval gate
- `ollama create jarvis-router`
- L3/L4 supervisor recovery in production
- Semantic learning panel → SQLite phrase suggestions

## Wave 6 — Fabric closeout (S20–S22)

- TS router <2k lines (glue only)
- F1–F40 eval closeout (`tests/evals/f_fabric_index.json`)
- Gateway default for new installs
- Architecture docs + paid-mode caps

## Verify gate (every sprint)

```powershell
cd apps/desktop/src-tauri; cargo test --lib -j 1
cd ../..; npx tsc --noEmit
npm run build
```
