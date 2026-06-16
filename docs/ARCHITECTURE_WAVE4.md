# Wave 4 architecture — Knowledge mesh

Wave 4 makes JARVIS knowledge sources reloadable, graph-aware, and routable through MCP action packs.

## Knowledge recall stack

Priority in [`knowledge_router.rs`](../apps/desktop/src-tauri/src/memory/knowledge_router.rs):

1. Graph facts (people birthdays, preferences)
2. Vector RAG (SQLite memory chunks)
3. Local vault filesystem search
4. Obsidian MCP `search_notes`
5. Readwise CSV highlights
6. Zotero BibTeX entries
7. **CAG policy** from app data

## CAG (S12)

- Policy file: `{app_data_dir}/cag/policy.json`
- Seeded on first app launch via [`cag.rs`](../apps/desktop/src-tauri/src/memory/cag.rs)
- Optional override: `{vault_parent}/cag/policy.json`
- Cache invalidated on `save_gateway_config`
- Schema: `[{ "intent": "tool catalog", "text": "..." }]`

## Obsidian graph / backlinks (S13)

- Vault routes include backlink phrases (`backlinks for …`, `what links to …`)
- [`memory_agent.rs`](../apps/desktop/src-tauri/src/agents/memory_agent.rs) calls Obsidian Graph MCP tool `get_backlinks` when host is `obsidian-graph` (default fallback)
- Local vault search unchanged for standard vault queries

## MCP action packs (S14)

NL routing mirrors GitHub across six layers:

| Layer | GitHub + Jira + HF + Zapier |
|-------|----------------------------|
| L0 | [`l0.rs`](../apps/desktop/src-tauri/src/gateway/router/l0.rs) keywords |
| Task loop | `mcp_call` step |
| Agent | [`integrations.rs`](../apps/desktop/src-tauri/src/agents/integrations.rs) `run_mcp` + NL parsers |
| Presets | [`mcp_presets.rs`](../apps/desktop/src-tauri/src/gateway/mcp_presets.rs) |
| TS bridge | [`gatewayBridge.ts`](../apps/desktop/src/features/gateway/gatewayBridge.ts) delegation guards |
| Evals | [`f_mcp_routes.json`](../apps/desktop/tests/evals/f_mcp_routes.json) |

## Readwise / Zotero (S15)

Configured in gateway knowledge settings:

- **Readwise:** CSV with `Highlight` + `Title` columns; matches query against both
- **Zotero:** BibTeX `title` / `author` fields parsed per entry
- Missing or empty import files surface a clear recall snippet instead of silent failure

## Verify gate

```powershell
cd apps/desktop/src-tauri; cargo test --lib -j 1
cd ../..; npx tsc --noEmit
npm run build
```
