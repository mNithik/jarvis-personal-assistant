use std::path::Path;

use serde_json::json;

use super::entity_store::list_entity_metadata;
use super::ensure_schema;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryEntityControl {
    pub entity_id: i64,
    pub domain: String,
    pub label: String,
    pub pinned: bool,
    pub forgotten: bool,
    pub confidence: String,
}

fn parse_control(domain: &str, entity_id: i64, metadata_json: &str) -> MemoryEntityControl {
    let value: serde_json::Value =
        serde_json::from_str(metadata_json).unwrap_or_else(|_| json!({}));
    let label = value
        .get("eventTitle")
        .or_else(|| value.get("name"))
        .or_else(|| value.get("title"))
        .and_then(|v| v.as_str())
        .unwrap_or("memory item")
        .to_string();
    MemoryEntityControl {
        entity_id,
        domain: domain.to_string(),
        label,
        pinned: value.get("pinned").and_then(|v| v.as_bool()).unwrap_or(false),
        forgotten: value
            .get("forgotten")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        confidence: value
            .get("confidence")
            .and_then(|v| v.as_str())
            .unwrap_or("medium")
            .to_string(),
    }
}

pub fn list_entity_controls(path: &Path, domain: &str) -> Result<Vec<MemoryEntityControl>, String> {
    Ok(list_entity_metadata(path, domain)?
        .into_iter()
        .filter(|(_, metadata)| {
            let value: serde_json::Value =
                serde_json::from_str(metadata).unwrap_or_else(|_| json!({}));
            !value
                .get("forgotten")
                .and_then(|v| v.as_bool())
                .unwrap_or(false)
        })
        .map(|(entity_id, metadata)| parse_control(domain, entity_id, &metadata))
        .collect())
}

pub fn set_entity_control_flags(
    path: &Path,
    domain: &str,
    entity_id: i64,
    pinned: Option<bool>,
    forgotten: Option<bool>,
    confidence: Option<&str>,
) -> Result<MemoryEntityControl, String> {
    ensure_schema(path)?;
    let connection = rusqlite::Connection::open(path).map_err(|error| error.to_string())?;
    let metadata_json: String = connection
        .query_row(
            "SELECT metadata_json FROM memory_entities WHERE id = ?1 AND domain = ?2",
            rusqlite::params![entity_id, domain],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    let mut value: serde_json::Value =
        serde_json::from_str(&metadata_json).unwrap_or_else(|_| json!({}));
    if let Some(pinned) = pinned {
        value["pinned"] = json!(pinned);
    }
    if let Some(forgotten) = forgotten {
        value["forgotten"] = json!(forgotten);
    }
    if let Some(confidence) = confidence {
        value["confidence"] = json!(confidence);
    }

    let updated = serde_json::to_string(&value).map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE memory_entities SET metadata_json = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2 AND domain = ?3",
            rusqlite::params![updated, entity_id, domain],
        )
        .map_err(|error| error.to_string())?;

    Ok(parse_control(domain, entity_id, &updated))
}

pub fn correct_entity_field(
    path: &Path,
    domain: &str,
    entity_id: i64,
    field: &str,
    new_value: &str,
) -> Result<MemoryEntityControl, String> {
    ensure_schema(path)?;
    let connection = rusqlite::Connection::open(path).map_err(|error| error.to_string())?;
    let metadata_json: String = connection
        .query_row(
            "SELECT metadata_json FROM memory_entities WHERE id = ?1 AND domain = ?2",
            rusqlite::params![entity_id, domain],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    let mut value: serde_json::Value =
        serde_json::from_str(&metadata_json).unwrap_or_else(|_| json!({}));
    value[field] = json!(new_value);
    value["confidence"] = json!("high");
    value["correctedAt"] = json!(chrono::Utc::now().to_rfc3339());

    let updated = serde_json::to_string(&value).map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE memory_entities SET metadata_json = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2 AND domain = ?3",
            rusqlite::params![updated, entity_id, domain],
        )
        .map_err(|error| error.to_string())?;

    Ok(parse_control(domain, entity_id, &updated))
}
