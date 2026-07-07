# Wave 18 architecture — platform hardening

Wave 18 turns Wave 17 MVPs into production-grade platform services.

## Tracks

| Track | Outcome | Primary modules |
|-------|---------|-----------------|
| T18-A Hosted sync server | Real `POST/GET /v1/sync/bundles` service | [`services/jarvis-sync`](../../services/jarvis-sync), [`sync_remote.rs`](../apps/desktop/src-tauri/src/gateway/sync_remote.rs) |
| T18-B Remote marketplace | Cached remote catalog + install | [`marketplace.rs`](../apps/desktop/src-tauri/src/gateway/marketplace.rs) |
| T18-C Topic graph writes | Manual link/unlink with profile scope | [`topic_graph.rs`](../apps/desktop/src-tauri/src/memory/topic_graph.rs), [`TopicGraphPanel.tsx`](../apps/desktop/src/ui/workspaces/sections/TopicGraphPanel.tsx) |
| T18-D Skill script hardening | Quoted-arg script parsing | [`skills_executor.rs`](../apps/desktop/src-tauri/src/gateway/skills_executor.rs) |
| T18-E Project operator | Operator dashboard + metrics export | [`OperatorPanel.tsx`](../apps/desktop/src/ui/settings/OperatorPanel.tsx) |
| T18-F Metrics / evals v2 | Proactive metrics + evals summary export | [`metrics.rs`](../apps/desktop/src-tauri/src/gateway/metrics.rs), [`evals.rs`](../apps/desktop/src-tauri/src/gateway/evals.rs) |

## T18-A: Jarvis Sync Server

- Rust axum service in `services/jarvis-sync`
- Device registration: `POST /v1/devices/register`
- Opaque encrypted bundle storage per device
- See [SYNC_SERVER.md](./SYNC_SERVER.md)

## T18-B: Remote marketplace

- `JARVIS_MARKETPLACE_CATALOG_URL` overrides default GitHub raw catalog URL
- Cache at `app_data/marketplace/remote-catalog.json`
- `refresh_marketplace_catalog_cmd` forces network refresh

## T18-C: Topic graph writes

- `link_topic_entities_cmd` / `unlink_topic_relation_cmd`
- Policy: manual source tag; profile-scoped deletes
- Golden: `eval_topic_graph_manual_link_unlink`

## T18-D: Skill executor

- `parse_script_argv` supports quoted arguments for `sh -c "..."`

## T18-E: Operator lane

- Operator panel: task runs, bundles, marketplace lanes, proactive metrics
- Publishing workflow remains manual (validate skill → PR to catalog)

## T18-F: Metrics

- `get_proactive_metrics_cmd` / `export_proactive_metrics_cmd`
- `JARVIS_EVALS_SUMMARY_PATH` env for harness export
- `run_task_execution_file` alias for task-level eval schema

## Verification

- `cargo test` in `services/jarvis-sync`
- Desktop: `eval_export_evals_summary_on_request`, `eval_topic_graph_manual_link_unlink`
- Playwright: `marketplace-operator.spec.ts`
- Manual: [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)
