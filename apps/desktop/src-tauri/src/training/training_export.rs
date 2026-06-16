use std::path::Path;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingTurnRecord {
    pub phrase: String,
    pub capability_id: String,
    pub route_level: String,
    pub tools: Vec<String>,
    pub success: bool,
    pub latency_ms: u64,
    pub exported_at: String,
}

pub fn load_training_records(export_path: &Path) -> Result<Vec<TrainingTurnRecord>, String> {
    if !export_path.exists() {
        return Ok(Vec::new());
    }
    let raw = std::fs::read_to_string(export_path).map_err(|error| error.to_string())?;
    let mut records = Vec::new();
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let record: TrainingTurnRecord =
            serde_json::from_str(trimmed).map_err(|error| error.to_string())?;
        records.push(record);
    }
    Ok(records)
}

pub fn append_training_record(
    export_path: &Path,
    record: &TrainingTurnRecord,
) -> Result<(), String> {
    if let Some(parent) = export_path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let line = serde_json::to_string(record).map_err(|error| error.to_string())?;
    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(export_path)
        .map_err(|error| error.to_string())?;
    writeln!(file, "{line}").map_err(|error| error.to_string())
}

pub fn anonymize_phrase(phrase: &str) -> String {
    phrase
        .replace("@", "[at]")
        .split_whitespace()
        .map(|token| {
            if token.contains("sk-") || token.starts_with("C:\\Users\\") {
                "[redacted]"
            } else {
                token
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_sensitive_tokens() {
        let cleaned = anonymize_phrase("path C:\\Users\\secret\\file sk-abc123token");
        assert!(!cleaned.contains("sk-abc123token"));
    }
}
