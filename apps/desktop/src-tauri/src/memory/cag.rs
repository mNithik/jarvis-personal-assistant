use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::SystemTime;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct CagPolicyEntry {
    pub intent: String,
    pub text: String,
}

struct CagCache {
    app_data_dir: PathBuf,
    vault_hint: Option<String>,
    entries: Vec<CagPolicyEntry>,
    loaded_at: SystemTime,
}

static CACHE: OnceLock<Mutex<Option<CagCache>>> = OnceLock::new();

fn cache() -> &'static Mutex<Option<CagCache>> {
    CACHE.get_or_init(|| Mutex::new(None))
}

pub fn cag_policy_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("cag").join("policy.json")
}

pub fn ensure_default_cag_policy(app_data_dir: &Path) -> Result<(), String> {
    let path = cag_policy_path(app_data_dir);
    if path.exists() {
        return Ok(());
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let defaults = default_policy_entries();
    let raw = serde_json::to_string_pretty(&defaults).map_err(|error| error.to_string())?;
    std::fs::write(&path, raw).map_err(|error| error.to_string())?;
    Ok(())
}

pub fn invalidate_cag_cache() {
    if let Ok(mut guard) = cache().lock() {
        *guard = None;
    }
}

pub fn match_cag_query(
    app_data_dir: Option<&Path>,
    vault_hint: Option<&str>,
    query: &str,
) -> Option<String> {
    let normalized = query.to_lowercase();
    let entries = load_policy_entries(app_data_dir, vault_hint);
    for entry in entries {
        if normalized.contains(&entry.intent.to_lowercase()) {
            return Some(entry.text);
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

fn load_policy_entries(
    app_data_dir: Option<&Path>,
    vault_hint: Option<&str>,
) -> Vec<CagPolicyEntry> {
    if let Ok(guard) = cache().lock() {
        if let Some(cached) = guard.as_ref() {
            let same_app = app_data_dir
                .map(|dir| cached.app_data_dir == dir)
                .unwrap_or(false);
            let same_vault = cached.vault_hint.as_deref() == vault_hint;
            if same_app
                && same_vault
                && cached
                    .loaded_at
                    .elapsed()
                    .map(|duration| duration.as_secs() < 30)
                    .unwrap_or(false)
            {
                return cached.entries.clone();
            }
        }
    }

    let mut merged = Vec::new();
    if let Some(app_data_dir) = app_data_dir {
        let _ = ensure_default_cag_policy(app_data_dir);
        merged.extend(read_policy_file(&cag_policy_path(app_data_dir)));
    }
    if let Some(parent) = vault_hint.and_then(|path| Path::new(path).parent()) {
        merged.extend(read_policy_file(&parent.join("cag").join("policy.json")));
    }

    if merged.is_empty() {
        merged = default_policy_entries();
    }

    if let Ok(mut guard) = cache().lock() {
        *guard = Some(CagCache {
            app_data_dir: app_data_dir
                .map(Path::to_path_buf)
                .unwrap_or_else(|| PathBuf::from(".")),
            vault_hint: vault_hint.map(str::to_string),
            entries: merged.clone(),
            loaded_at: SystemTime::now(),
        });
    }

    merged
}

fn read_policy_file(path: &Path) -> Vec<CagPolicyEntry> {
    let Ok(raw) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

fn default_policy_entries() -> Vec<CagPolicyEntry> {
    vec![
        CagPolicyEntry {
            intent: "tool catalog".to_string(),
            text: "Tool catalog policy: confirm destructive desktop actions, prefer local models for personal memory, and route integrations through gateway handoffs.".to_string(),
        },
        CagPolicyEntry {
            intent: "skill policy".to_string(),
            text: "JARVIS skill policy: graph facts beat vector recall for people facts; use RAG for saved notes; local vault and Obsidian MCP fill knowledge gaps.".to_string(),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_policy_from_app_data_dir() {
        let dir = std::env::temp_dir().join(format!("jarvis-cag-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("dir");
        ensure_default_cag_policy(&dir).expect("seed");
        invalidate_cag_cache();
        let matched = match_cag_query(Some(&dir), None, "show tool catalog policy");
        assert!(matched.is_some());
        let _ = std::fs::remove_dir_all(dir);
    }
}
