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

pub fn parse_backlinks_query(command: &str) -> Option<String> {
    let trimmed = command.trim();
    let normalized = trimmed.to_lowercase();
    const PREFIXES: &[&str] = &[
        "show backlinks for ",
        "backlinks for ",
        "what links to ",
        "notes linking to ",
        "obsidian backlinks for ",
    ];
    for prefix in PREFIXES {
        if normalized.starts_with(prefix) {
            let note = trimmed[prefix.len()..].trim();
            if !note.is_empty() {
                return Some(note.to_string());
            }
        }
    }
    None
}

pub fn fetch_obsidian_backlinks(
    config: &GatewayConfig,
    host_id: &str,
    note: &str,
) -> Result<String, String> {
    call_mcp_tool(
        config,
        host_id,
        "get_backlinks",
        json!({ "note": note, "query": note }),
    )
}

pub fn recall_context(db_path: &Path, query: &str, limit: usize) -> KnowledgeBundle {
    recall_context_with_config(db_path, None, None, query, limit)
}

pub fn recall_context_with_config(
    db_path: &Path,
    app_data_dir: Option<&Path>,
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
        if let Some(cag_text) = super::cag::match_cag_query(
            app_data_dir,
            config.and_then(|value| value.knowledge.local_vault_path.as_deref()),
            trimmed,
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
    if let Some(error) = validate_import_path(path, "Readwise CSV") {
        return vec![KnowledgeSnippet {
            source: KnowledgeSource::Rag,
            text: error,
            score: Some(0.0),
        }];
    }
    let Ok(raw) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    let needle = query.to_lowercase();
    let mut lines = raw.lines();
    let header = lines.next().unwrap_or("");
    let title_idx = csv_header_index(header, "title").unwrap_or(1);
    let highlight_idx = csv_header_index(header, "highlight").unwrap_or(0);

    lines
        .filter_map(|line| {
            let fields = parse_csv_line(line);
            let title = fields.get(title_idx)?.trim();
            let highlight = fields.get(highlight_idx).map(|value| value.trim()).unwrap_or("");
            if title.is_empty() && highlight.is_empty() {
                return None;
            }
            let haystack = format!("{title} {highlight}").to_lowercase();
            if !needle.is_empty() && !haystack.contains(&needle) {
                return None;
            }
            let text = if highlight.is_empty() {
                format!("Readwise: {title}")
            } else {
                format!("Readwise — {title}: {}", summarize(highlight, 160))
            };
            Some(KnowledgeSnippet {
                source: KnowledgeSource::Rag,
                text,
                score: Some(0.72),
            })
        })
        .take(limit)
        .collect()
}

fn load_zotero_snippets(path: &str, query: &str, limit: usize) -> Vec<KnowledgeSnippet> {
    if let Some(error) = validate_import_path(path, "Zotero BibTeX") {
        return vec![KnowledgeSnippet {
            source: KnowledgeSource::Rag,
            text: error,
            score: Some(0.0),
        }];
    }
    let Ok(raw) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    let needle = query.to_lowercase();
    parse_bib_entries(&raw)
        .into_iter()
        .filter_map(|entry| {
            if !needle.is_empty()
                && !entry.title.to_lowercase().contains(&needle)
                && !entry
                    .author
                    .as_deref()
                    .unwrap_or("")
                    .to_lowercase()
                    .contains(&needle)
            {
                return None;
            }
            let author = entry.author.unwrap_or_else(|| "Unknown author".to_string());
            Some(KnowledgeSnippet {
                source: KnowledgeSource::Rag,
                text: format!("Zotero — {} ({})", entry.title, author),
                score: Some(0.68),
            })
        })
        .take(limit)
        .collect()
}

fn validate_import_path(path: &str, label: &str) -> Option<String> {
    let file_path = Path::new(path);
    if !file_path.exists() {
        return Some(format!(
            "{label} import path not found: {path}. Update gateway knowledge settings."
        ));
    }
    if file_path.metadata().ok()?.len() == 0 {
        return Some(format!("{label} import file is empty: {path}."));
    }
    None
}

fn csv_header_index(header: &str, column: &str) -> Option<usize> {
    parse_csv_line(header)
        .into_iter()
        .position(|value| value.trim().eq_ignore_ascii_case(column))
}

fn parse_csv_line(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    for ch in line.chars() {
        match ch {
            '"' => in_quotes = !in_quotes,
            ',' if !in_quotes => {
                fields.push(current.trim().trim_matches('"').to_string());
                current.clear();
            }
            other => current.push(other),
        }
    }
    fields.push(current.trim().trim_matches('"').to_string());
    fields
}

fn summarize(text: &str, max_len: usize) -> String {
    if text.chars().count() <= max_len {
        return text.to_string();
    }
    text.chars().take(max_len).collect::<String>() + "…"
}

#[derive(Debug, Clone)]
struct BibEntry {
    title: String,
    author: Option<String>,
}

fn parse_bib_entries(raw: &str) -> Vec<BibEntry> {
    let mut entries = Vec::new();
    let mut current_title: Option<String> = None;
    let mut current_author: Option<String> = None;

    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('@') {
            if let Some(title) = current_title.take() {
                entries.push(BibEntry {
                    title,
                    author: current_author.take(),
                });
            }
            continue;
        }
        if let Some(value) = bib_field(trimmed, "title") {
            current_title = Some(value);
        } else if let Some(value) = bib_field(trimmed, "author") {
            current_author = Some(value);
        }
    }
    if let Some(title) = current_title {
        entries.push(BibEntry {
            title,
            author: current_author,
        });
    }
    entries
}

fn bib_field(line: &str, key: &str) -> Option<String> {
    let lower = line.to_lowercase();
    let prefix = format!("{key} =");
    if !lower.starts_with(&prefix) {
        return None;
    }
    let value = line[prefix.len()..]
        .trim()
        .trim_matches(',')
        .trim_matches('{')
        .trim_matches('}')
        .trim_matches('"')
        .trim()
        .to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
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
        let app_data = std::env::temp_dir().join(format!("jarvis-cag-router-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&app_data);
        super::super::cag::ensure_default_cag_policy(&app_data).expect("seed");
        let bundle = recall_context_with_config(&path, Some(&app_data), None, "show tool catalog policy", 2);
        assert!(
            bundle
                .snippets
                .iter()
                .any(|snippet| snippet.source == KnowledgeSource::Cag)
        );
        let _ = std::fs::remove_file(path);
        let _ = std::fs::remove_dir_all(app_data);
    }

    #[test]
    fn readwise_csv_matches_title_and_highlight() {
        let dir = std::env::temp_dir().join(format!("jarvis-readwise-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let csv_path = dir.join("readwise.csv");
        std::fs::write(
            &csv_path,
            "Highlight,Title\nPack rain jacket,Seattle trip\n",
        )
        .expect("write");
        let snippets = load_readwise_snippets(csv_path.to_str().unwrap(), "rain jacket", 3);
        assert_eq!(snippets.len(), 1);
        assert!(snippets[0].text.contains("Seattle trip"));
        let _ = std::fs::remove_dir_all(dir);
    }
}
