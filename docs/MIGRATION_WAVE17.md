# Wave 17 migration guide

## Profile partitions (migrations v8–v9)

On first launch after upgrading, JARVIS runs centralized migrations in [`migrations/mod.rs`](../apps/desktop/src-tauri/src/migrations/mod.rs):

- **v8:** Adds `profile_id` to `memory_relations`, `user_goals`, and recall tables (`memory_entities`, `memory_documents`, `memory_chunks`)
- **v9:** Adds `profile_id` to `ambient_sessions`

Existing rows are assigned to the **active profile at migration time** (typically `work`). Data is not duplicated across profiles.

### Before upgrading

1. Export a sync bundle (Gateway → Sync → Export bundle) with a strong passphrase
2. Note your active profile in Settings

### After upgrading

1. Switch profiles and confirm memory/skills/ambient history stay scoped
2. Import bundle on a new machine to restore profiles, goals, graph, and recall slices

## Skills layout

| Path | Scope |
|------|--------|
| `app_data/skills/<id>/` | Global (all profiles unless overridden) |
| `app_data/skills/<profileId>/<id>/` | Profile-local override |

Profile-local manifests with the same `id` replace global keywords for the active profile.

## Gateway default

New installs seed **gateway enabled** via `gateway_default_install_preset()`. Existing `gateway.json` files are preserved. Use Settings → Agent gateway or “Apply easy mode (dry-run)” to change behavior.

## Labs

All `gateway.labs.*` flags default to **off**. Enable individually in Gateway → Labs. See [LAB_GRADUATION_LOG.md](./LAB_GRADUATION_LOG.md) before promoting defaults.

## Hosted sync

Client push/pull is in [`sync_remote.rs`](../apps/desktop/src-tauri/src/gateway/sync_remote.rs). Deploy the sync server per [SYNC_SERVER.md](./SYNC_SERVER.md) before using remote endpoints.
