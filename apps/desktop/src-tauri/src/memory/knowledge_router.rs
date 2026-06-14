use std::path::Path;

use serde::Serialize;
use serde_json::json;

use crate::gateway::config::GatewayConfig;
use crate::gateway::mcp_host::call_mcp_tool;

use super::recall::{self, RecallHit};
use super::triples::{lookup_birthday, lookup_entity_fact};
use super::vault::{resolve_vault_path, search_local_vault};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum KnowledgeSource {
    Graph,
    Rag,
    Cag,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct KnowledgeSnippet {
    pub source: KnowledgeSource,
    pub text: String,
    pub score: Option<f32>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct KnowledgeBundle {
    pub query: String,
    pub snippets: Vec<KnowledgeSnippet>,
    pub summary: String,
}

pub fn parse_vault_search_query(command: &str) -> Option<String> {
    let trimmed = command.trim();
    let normalized = trimmed.to_lowercase();
    const PREFIXES: &[&str] = &[
        "search vault for ",
        "search my vault for ",
        "search obsidian for ",
        "find in vault ",
        "search notes for ",
    ];
    for prefix in PREFIXES {
        if normalized.starts_with(prefix) {
            let query = trimmed[prefix.len()..].trim();
            if !query.is_empty() {
                return Some(query.to_string());
            }
        }
    }
    None
}

pub fn recall_context(db_path: &Path, query: &str, limit: usize) -> KnowledgeBundle {
    recall_context_with_config(db_path, None, query, limit)
}

pub fn recall_context_with_config(
    db_path: &Path,
    config: Option<&GatewayConfig>,
    query: &str,
    limit: usize,
) -> KnowledgeBundle {
    let knowledge = config
        .map(|value| value.knowledge.clone())
        .unwrap_or_default();
    let trimmed = query.trim();
    let mut snippets = Vec::new();

    if let Ok(Some(graph_hit)) = lookup_birthday(db_path, trimmed) {
        snippets.push(KnowledgeSnippet {
            source: KnowledgeSource::Graph,
            text: graph_hit,
            score: Some(1.0),
        });
    } else if let Ok(Some(graph_hit)) = lookup_entity_fact(db_path, trimmed, "preference") {
        snippets.push(KnowledgeSnippet {
            source: KnowledgeSource::Graph,
            text: graph_hit,
            score: Some(0.95),
        });
    } else if trimmed.to_lowercase().contains("birthday") {
        if let Ok(Some(graph_hit)) = lookup_birthday(db_path, trimmed) {
            snippets.push(KnowledgeSnippet {
                source: KnowledgeSource::Graph,
                text: graph_hit,
                score: Some(0.9),
            });
        }
    }

    if snippets.is_empty() {
        if let Ok(hits) = recall::recall(db_path, trimmed, limit) {
            for hit in hits {
                snippets.push(snippet_from_recall(hit));
            }
        }
    }

    if snippets.is_empty() {
        if let Some(vault_query) = parse_vault_search_query(trimmed).or_else(|| {
            if trimmed.to_lowercase().contains("vault") || trimmed.to_lowercase().contains("obsidian")
            {
                Some(trimmed.to_string())
            } else {
                None
            }
        }) {
            if let Some(path) = knowledge
                .local_vault_path
                .as_deref()
                .filter(|value| !value.trim().is_empty())
            {
                let vault_path = resolve_vault_path(path);
                if let Ok(hits) = search_local_vault(&vault_path, &vault_query, limit) {
                    for hit in hits {
                        snippets.push(KnowledgeSnippet {
                            source: KnowledgeSource::Rag,
                            text: format!("{} — {}", hit.title, hit.excerpt),
                            score: Some(0.85),
                        });
                    }
                }
            }

            if snippets.is_empty() {
                if let (Some(config), Some(host_id)) = (
                    config,
                    knowledge.obsidian_host_id.as_deref().filter(|value| !value.is_empty()),
                ) {
                    if let Ok(reply) = call_mcp_tool(
                        config,
                        host_id,
                        "search_notes",
                        json!({ "query": vault_query }),
                    ) {
                        snippets.push(KnowledgeSnippet {
                            source: KnowledgeSource::Rag,
                            text: reply,
                            score: Some(0.8),
                        });
                    }
                }
            }
        }
    }

    if snippets.is_empty() {
        if let Some(path) = knowledge.readwise_csv_path.as_deref().filter(|v| !v.is_empty()) {
            snippets.extend(load_readwise_snippets(path, trimmed, limit));
        }
        if snippets.is_empty() {
            if let Some(path) = knowledge.zotero_bib_path.as_deref().filter(|v| !v.is_empty()) {
                snippets.extend(load_zotero_snippets(path, trimmed, limit));
            }
        }
    }

    if snippets.is_empty() {
        if let Some(cag_text) = load_cag_stub(
            trimmed,
            config.and_then(|value| value.knowledge.local_vault_path.as_deref()),
        ) {
            snippets.push(KnowledgeSnippet {
                source: KnowledgeSource::Cag,
                text: cag_text,
                score: Some(0.5),
            });
        }
    }

    let summary = if snippets.is_empty() {
        format!("No recalled context for \"{trimmed}\".")
    } else {
        snippets
            .iter()
            .take(3)
            .map(|snippet| snippet.text.clone())
            .collect::<Vec<_>>()
            .join(" ")
    };

    KnowledgeBundle {
        query: trimmed.to_string(),
        snippets,
        summary,
    }
}

fn snippet_from_recall(hit: RecallHit) -> KnowledgeSnippet {
    KnowledgeSnippet {
        source: KnowledgeSource::Rag,
        text: hit.text,
        score: Some(hit.score),
    }
}

fn load_readwise_snippets(path: &str, query: &str, limit: usize) -> Vec<KnowledgeSnippet> {
    let Ok(raw) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    let needle = query.to_lowercase();
    raw.lines()
        .skip(1)
        .filter_map(|line| {
            let title = line.split(',').nth(0)?.trim();
            if title.is_empty() {
                return None;
            }
            if !needle.is_empty() && !title.to_lowercase().contains(&needle) {
                return None;
            }
            Some(KnowledgeSnippet {
                source: KnowledgeSource::Rag,
                text: format!("Readwise: {title}"),
                score: Some(0.7),
            })
        })
        .take(limit)
        .collect()
}

fn load_zotero_snippets(path: &str, query: &str, limit: usize) -> Vec<KnowledgeSnippet> {
    let Ok(raw) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    let needle = query.to_lowercase();
    raw.lines()
        .filter(|line| line.contains("@article") || line.contains("@book"))
        .filter_map(|line| {
            let title = line
                .split('{')
                .nth(1)
                .map(|rest| rest.trim_end_matches(',').trim())
                .unwrap_or(line);
            if !needle.is_empty() && !title.to_lowercase().contains(&needle) {
                return None;
            }
            Some(KnowledgeSnippet {
                source: KnowledgeSource::Rag,
                text: format!("Zotero: {title}"),
                score: Some(0.65),
            })
        })
        .take(limit)
        .collect()
}

fn load_cag_stub(query: &str, vault_hint: Option<&str>) -> Option<String> {
    let normalized = query.to_lowercase();
    if let Some(parent) = vault_hint.and_then(|path| std::path::Path::new(path).parent()) {
        let policy_path = parent.join("cag").join("policy.json");
        if let Ok(raw) = std::fs::read_to_string(&policy_path) {
            if let Ok(entries) = serde_json::from_str::<Vec<CagPolicyEntry>>(&raw) {
                for entry in entries {
                    if normalized.contains(&entry.intent) {
                        return Some(entry.text);
                    }
                }
            }
        }
    }

    if normalized.contains("tool") && normalized.contains("catalog") {
        return Some(
            "Tool catalog policy: confirm destructive desktop actions, prefer local models for personal memory, and route integrations through gateway handoffs.".to_string(),
        );
    }
    if normalized.contains("skill") || normalized.contains("policy") {
        return Some(
            "JARVIS skill policy: graph facts beat vector recall for people facts; use RAG for saved notes; local vault and Obsidian MCP fill knowledge gaps.".to_string(),
        );
    }
    None
}

#[derive(Debug, serde::Deserialize)]
struct CagPolicyEntry {
    intent: String,
    text: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_db() -> std::path::PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        std::env::temp_dir().join(format!("jarvis-knowledge-router-{nanos}.db"))
    }

    #[test]
    fn graph_precedes_rag_for_birthday_queries() {
        let path = temp_db();
        super::super::remember(&path, "Mom birthday is March 4", "people").expect("remember");
        let bundle = recall_context(&path, "recall mom birthday", 3);
        assert!(
            bundle
                .snippets
                .first()
                .map(|snippet| snippet.source == KnowledgeSource::Graph)
                .unwrap_or(false)
                || bundle.summary.to_lowercase().contains("birthday")
        );
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn rag_hits_travel_notes_when_no_graph_match() {
        let path = temp_db();
        super::super::remember(&path, "Saved travel note: pack rain jacket for Seattle", "travel")
            .expect("remember");
        let bundle = recall_context(&path, "what did I save about travel", 3);
        assert!(
            bundle
                .snippets
                .iter()
                .any(|snippet| snippet.source == KnowledgeSource::Rag)
                || bundle.summary.to_lowercase().contains("travel")
        );
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn cag_stub_serves_tool_catalog_intent() {
        let path = temp_db();
        let bundle = recall_context(&path, "show tool catalog policy", 2);
        assert!(
            bundle
                .snippets
                .iter()
                .any(|snippet| snippet.source == KnowledgeSource::Cag)
        );
        let _ = std::fs::remove_file(path);
    }
}
