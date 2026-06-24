use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VaultSnippet {
    pub path: String,
    pub title: String,
    pub excerpt: String,
}

pub fn search_local_vault(
    vault_path: &Path,
    query: &str,
    limit: usize,
) -> Result<Vec<VaultSnippet>, String> {
    let needle = query.trim().to_lowercase();
    if needle.is_empty() {
        return Ok(Vec::new());
    }
    if !vault_path.is_dir() {
        return Err(format!(
            "Local vault path does not exist: {}",
            vault_path.display()
        ));
    }

    let mut hits = Vec::new();
    collect_markdown_hits(vault_path, vault_path, &needle, &mut hits, limit)?;
    Ok(hits)
}

fn collect_markdown_hits(
    root: &Path,
    current: &Path,
    needle: &str,
    hits: &mut Vec<VaultSnippet>,
    limit: usize,
) -> Result<(), String> {
    if hits.len() >= limit {
        return Ok(());
    }

    let entries = fs::read_dir(current).map_err(|error| error.to_string())?;
    for entry in entries {
        if hits.len() >= limit {
            break;
        }
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            let name = path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("");
            if name.starts_with('.') {
                continue;
            }
            collect_markdown_hits(root, &path, needle, hits, limit)?;
            continue;
        }

        let Some(extension) = path.extension().and_then(|value| value.to_str()) else {
            continue;
        };
        if !matches!(extension.to_lowercase().as_str(), "md" | "markdown" | "txt") {
            continue;
        }

        let raw = fs::read_to_string(&path).map_err(|error| error.to_string())?;
        let haystack = raw.to_lowercase();
        if !haystack.contains(needle) {
            continue;
        }

        let relative = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .display()
            .to_string();
        let title = path
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("note")
            .to_string();
        let excerpt = excerpt_matching_line(&raw, needle);
        hits.push(VaultSnippet {
            path: relative,
            title,
            excerpt,
        });
    }

    Ok(())
}

fn excerpt_matching_line(raw: &str, needle: &str) -> String {
    for line in raw.lines() {
        if line.to_lowercase().contains(needle) {
            let trimmed = line.trim();
            if trimmed.len() > 160 {
                return format!("{}...", &trimmed[..160]);
            }
            return trimmed.to_string();
        }
    }
    raw.lines().next().unwrap_or("").trim().to_string()
}

pub fn resolve_vault_path(configured: &str) -> PathBuf {
    let trimmed = configured.trim();
    if trimmed.is_empty() {
        return PathBuf::new();
    }
    PathBuf::from(trimmed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn finds_markdown_notes_matching_query() {
        let dir = std::env::temp_dir().join(format!("jarvis-vault-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("vault dir");
        fs::write(
            dir.join("project-alpha.md"),
            "# Project Alpha\nBudget review on Friday.",
        )
        .expect("write note");

        let hits = search_local_vault(&dir, "budget", 5).expect("search");
        assert_eq!(hits.len(), 1);
        assert!(hits[0].excerpt.to_lowercase().contains("budget"));

        let _ = fs::remove_dir_all(dir);
    }
}
