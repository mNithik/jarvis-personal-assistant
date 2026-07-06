# Wave 17 architecture - Platform follow-through

Wave 17 turns the Wave 16 platform surface into a durable multi-profile system. The focus is not adding isolated features; it is finishing the storage, execution, graph, and sync foundations that the current roadmap already points toward.

Wave 16 established the entry points:

- profiles in `gateway/profiles.rs`
- dynamic skills in `gateway/skills.rs`
- topic graph reads in `memory/topic_graph.rs`
- local sync/export in `gateway/sync.rs`
- ambient copilot and labs graduation hooks in `gateway/ambient.rs`

Wave 17 is where those pieces become coherent and production-safe across profiles, memory, sync, and execution.

## Goals

- Scope state by active profile instead of only swapping `gateway_json`
- Graduate Skill SDK routing into real handler execution with stronger safety boundaries
- Evolve the topic graph from a capped list into a navigable workspace
- Move sync from local encrypted bundle export/import toward hosted reconciliation
- Define the labs graduation path and new eval fabric for post-Wave-16 capabilities

## Non-goals

- No silent cross-profile migration of user content without explicit upgrade handling
- No marketplace rollout before Skill SDK execution and lab graduation foundations exist
- No hosted sync launch before profile-scoped memory bundles have a stable format

## Current platform baseline

| Area | Current implementation | Limitation |
|------|------------------------|------------|
| Profiles | `gateway/profiles.rs`, `user_profiles`, `ACTIVE_PROFILE_KEY` | Profile-scoped memory, skills, ambient, and sync slices shipped (T17-A) |
| Memory graph | `memory/topic_graph.rs`, `TopicGraphCanvas.tsx` | Canvas + drill-down shipped (T17-C); manual link/unlink optional |
| Skills | `gateway/skills.rs`, `skills_executor.rs`, `packages/skill-sdk` | route/http/script/wasm execution shipped (T17-B) |
| Sync | `gateway/sync.rs`, `gateway/sync_remote.rs`, `SyncPanel.tsx` | Local export/import plus hosted push/pull with conflict detection (T17-D) |
| Labs | `gateway/ambient.rs`, F65–F70 fabric | Graduation thresholds documented; defaults off until manual cohort pass |
| Marketplace | `gateway/marketplace.rs`, `InstalledSkillsPanel.tsx` | Bundled catalog install + operator lane summary (T17-F) |

## Track map

| Track | Outcome | Primary modules | Depends on |
|------|---------|-----------------|------------|
| T17-A Profile memory partitions | No cross-profile memory leakage | `migrations/mod.rs`, `memory/*`, `gateway/profiles.rs`, `gateway/sync.rs` | Wave 16 profiles |
| T17-B Skill SDK v2 | Real handler execution with sandbox policy | `gateway/skills.rs`, `agents/command.rs`, `builder/sandbox.rs`, `packages/skill-sdk` | Wave 16 skill routing |
| T17-C Topic graph UI v2 | Interactive graph workspace | `memory/topic_graph.rs`, `commands/wave15.rs`, `jarvisApi.ts`, `TopicGraphPanel.tsx` | T17-A for profile filter |
| T17-D Hosted sync | Remote encrypted sync with reconciliation | new `gateway/sync_remote.rs`, `gateway/sync.rs`, `SyncPanel.tsx` | T17-A bundle shape |
| T17-E Labs graduation | Fabric-backed promotion path for L1-L6 | `tests/evals/f_fabric_index.json`, `gateway/evals.rs`, labs surfaces | T17-B and T17-C inform later labs |
| T17-F Marketplace and project operator | Install/discover/operator lane | skill install surfaces, builder/operator flows | T17-B and T17-E |

## T17-A: Profile memory partitions

This is the Wave 17 foundation. The active profile now scopes goals, graph state, recall documents/chunks, sync bundles, and optional profile-local skills. The remaining work is making that foundation explicit in docs, rollout language, and later Wave 17 consumers.

### Current status

- Migration v8 adds `profile_id` partitioning for `memory_relations` and `user_goals`
- Migration v9 adds `profile_id` partitioning for `ambient_sessions`
- Memory schema now partitions `memory_entities`, `memory_documents`, and `memory_chunks`
- Recall FTS/vector queries and graph queries resolve through the active profile
- Sync export/import now preserves profile-scoped goals, entities, facts, relations, recall documents, and recall chunks
- F61 now has route coverage plus a Rust execution-level memory-isolation check in `gateway/evals.rs`
- Installed skill discovery and runtime keyword matching now support `app_data/skills/{profileId}/`
- Ambient session lookup and ambient suggestion history now resolve through the active profile

### Required changes

- Keep release notes/runbook language honest about the migration and restore semantics
- Extend later Wave 17 consumers so they preserve the same profile boundaries by default

### Migration policy

- Introduce a new migration version for Wave 17 schema changes
- Treat the migration as user-visible and reversible in release notes/runbook language
- Default existing rows into a stable fallback profile namespace rather than dropping or duplicating user data
- Keep migration logic centralized in `migrations/mod.rs`; do not scatter schema branching across UI code

## T17-B: Skill SDK v2

Wave 16 made manifest discovery real. Wave 17 should make execution real.

### Current status

- `route` handlers execute through the existing command-agent handoff path
- Skill execution now has an explicit module boundary in `gateway/skills_executor.rs`
- `http` handlers now support a constrained MVP: local-only `GET` requests with `read` permission
- `script` handlers now support a constrained MVP: `cmd` / `powershell` / `pwsh` entrypoints with `execute` permission and conservative unsafe-token rejection
- Skill manifests now reject invalid `http` and `script` handlers at load time so unsafe or unsupported definitions never enter the active registry
- `wasm` handlers support a constrained MVP: skill-local modules, load-time validation, and bounded execution through `builder/sandbox.rs` (`execute_wasm_file`)
- F63 execution eval covers route, http, script, and wasm handlers

### Scope

- Preserve L0 keyword matching from `match_dynamic_skill()`
- Move handler execution into an explicit executor boundary instead of route-only placeholders
- Support `route`, `http`, and `script` as first-class execution types
- Add Wasm sandbox execution through `builder/sandbox.rs` or a dedicated skill sandbox module
- Enforce permission checks against the safety matrix before execution

### Exit criteria

- Installed skills can be enabled, inspected, and executed from production UI
- Route-only evals expand into execution-backed fabric coverage
- Wasm support is bounded by fuel/time/resource limits

## T17-C: Topic graph UI v2

The existing topic graph works as a useful seed, but it is still a compact adjacency view. Wave 17 turns it into an exploratory tool.

### Scope

- Replace the flat edge list feel in `TopicGraphPanel.tsx` with `TopicGraphCanvas` (SVG adjacency layout)
- Use `queryTopicNeighbors()` for drill-down on node click
- Pagination via **Load more** so the prior 12-edge cap is no longer the UX boundary
- Show active profile label on the panel
- Keep write actions policy-gated when manual link/unlink arrives

## T17-D: Hosted sync

Wave 15 and Wave 16 established local encrypted export/import. Hosted sync should not ship until profile partitions define what is being synchronized.

### Scope

- Remote auth and encrypted store
- Bundle versioning that includes profile-scoped memory
- Conflict handling for goals, recipes, profiles, and memory slices
- UI for account status, last sync, and conflict resolution

## T17-E: Labs graduation

The labs program needs a stronger promotion contract so experimental features can move into balanced mode without guesswork.

### Scope

- Add F65-F70 entries to the fabric plan for post-Wave-16 lanes
- Define measurable promotion thresholds for L1-L6
- Tie each graduation lane to both automated evals and a manual matrix where human judgment still matters
- Keep ambient copilot read-only until graduation criteria explicitly permit anything stronger

## T17-F: Marketplace and project operator

This is intentionally last. It depends on execution safety and graduation confidence more than UI polish.

### Scope

- Catalog/install flow for skills
- Project operator expansion beyond the current pilot surfaces
- Builder workflow updates for publishing and lifecycle management

## Recommended sequencing

1. Finish Path B verification hardening so Wave 16 claims stay honest
2. Land this Wave 17 architecture doc and roadmap split
3. Implement T17-A before any hosted sync or marketplace work
4. Run T17-B and T17-C in parallel once T17-A schema and boundaries are stable
5. Use T17-E to control when T17-F becomes safe to expose broadly

## Verification and planning hooks

- Extend `tests/evals/f_fabric_index.json` with Wave 17 entries after track design stabilizes
- Add at least one memory-isolation golden before calling T17-A complete
- Keep `docs/E2E_RUNBOOK.md` aligned when new manual checks or CI lanes appear
- Keep `docs/ROADMAP.md` as the public sprint view; keep this document as the architecture/dependency view

See [ROADMAP.md](./ROADMAP.md), [ARCHITECTURE_WAVE16.md](./ARCHITECTURE_WAVE16.md), and [TIER_UPGRADE_VISION.md](./TIER_UPGRADE_VISION.md).
