use std::path::Path;

use rusqlite::{params, Connection};

use super::entity_store::list_entity_metadata;
use super::schema::migrate;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TopicGraphNode {
    pub entity_id: i64,
    pub domain: String,
    pub label: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TopicGraphEdge {
    pub id: i64,
    pub subject_entity_id: i64,
    pub predicate: String,
    pub object_entity_id: i64,
    pub confidence: f64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TopicGraphBundle {
    pub nodes: Vec<TopicGraphNode>,
    pub edges: Vec<TopicGraphEdge>,
}

pub fn ensure_topic_graph_schema(path: &Path) -> Result<(), String> {
    migrate(path)?;
    crate::migrations::apply_pending_migrations(
        &Connection::open(path).map_err(|error| error.to_string())?,
        path,
    )?;
    Ok(())
}

pub fn upsert_relation(
    path: &Path,
    subject_entity_id: i64,
    predicate: &str,
    object_entity_id: i64,
    source: &str,
) -> Result<(), String> {
    ensure_topic_graph_schema(path)?;
    let profile_id = crate::gateway::profiles::active_profile_id_or_default(path)?;
    let conn = Connection::open(path).map_err(|error| error.to_string())?;
    conn.execute(
        "DELETE FROM memory_relations
         WHERE profile_id = ?1 AND subject_entity_id = ?2 AND predicate = ?3 AND object_entity_id = ?4",
        params![profile_id, subject_entity_id, predicate, object_entity_id],
    )
    .map_err(|error| error.to_string())?;
    conn.execute(
        "INSERT INTO memory_relations (profile_id, subject_entity_id, predicate, object_entity_id, confidence, source)
         VALUES (?1, ?2, ?3, ?4, 1.0, ?5)",
        params![profile_id, subject_entity_id, predicate, object_entity_id, source],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn link_entities_by_label(
    path: &Path,
    subject_label: &str,
    predicate: &str,
    object_label: &str,
    source: &str,
) -> Result<(), String> {
    let subject_id = find_entity_id_by_label(path, subject_label)?;
    let object_id = find_entity_id_by_label(path, object_label)?;
    upsert_relation(path, subject_id, predicate, object_id, source)
}

pub fn unlink_relation(path: &Path, relation_id: i64) -> Result<(), String> {
    ensure_topic_graph_schema(path)?;
    let profile_id = crate::gateway::profiles::active_profile_id_or_default(path)?;
    let conn = Connection::open(path).map_err(|error| error.to_string())?;
    let deleted = conn
        .execute(
            "DELETE FROM memory_relations WHERE profile_id = ?1 AND id = ?2",
            params![profile_id, relation_id],
        )
        .map_err(|error| error.to_string())?;
    if deleted == 0 {
        return Err(format!("No relation {relation_id} found for active profile."));
    }
    Ok(())
}

pub fn unlink_entities_by_label(
    path: &Path,
    subject_label: &str,
    predicate: &str,
    object_label: &str,
) -> Result<(), String> {
    let profile_id = crate::gateway::profiles::active_profile_id_or_default(path)?;
    let subject_id = find_entity_id_by_label(path, subject_label)?;
    let object_id = find_entity_id_by_label(path, object_label)?;
    let conn = Connection::open(path).map_err(|error| error.to_string())?;
    let deleted = conn
        .execute(
            "DELETE FROM memory_relations
             WHERE profile_id = ?1
               AND subject_entity_id = ?2
               AND predicate = ?3
               AND object_entity_id = ?4",
            params![profile_id, subject_id, predicate, object_id],
        )
        .map_err(|error| error.to_string())?;
    if deleted == 0 {
        return Err(format!(
            "No \"{predicate}\" relation between \"{subject_label}\" and \"{object_label}\"."
        ));
    }
    Ok(())
}

fn find_entity_id_by_label(path: &Path, label: &str) -> Result<i64, String> {
    let profile_id = crate::gateway::profiles::active_profile_id_or_default(path)?;
    let conn = Connection::open(path).map_err(|error| error.to_string())?;
    let normalized = label.trim().to_lowercase();
    conn.query_row(
        "SELECT id
         FROM memory_entities
         WHERE profile_id = ?1 AND (lower(label) = ?2 OR lower(label) LIKE ?3)
         LIMIT 1",
        params![profile_id, normalized, format!("%{normalized}%")],
        |row| row.get(0),
    )
    .map_err(|_| format!("No memory entity found for \"{label}\""))
}

pub fn get_topic_graph(path: &Path, limit: usize) -> Result<TopicGraphBundle, String> {
    ensure_topic_graph_schema(path)?;
    let profile_id = crate::gateway::profiles::active_profile_id_or_default(path)?;
    let conn = Connection::open(path).map_err(|error| error.to_string())?;

    let mut nodes = Vec::new();
    let mut statement = conn
        .prepare(
            "SELECT id, domain, label
             FROM memory_entities
             WHERE profile_id = ?1
             ORDER BY updated_at DESC
             LIMIT ?2",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![profile_id, limit as i64], |row| {
            Ok(TopicGraphNode {
                entity_id: row.get(0)?,
                domain: row.get(1)?,
                label: row.get(2)?,
            })
        })
        .map_err(|error| error.to_string())?;
    for row in rows {
        nodes.push(row.map_err(|error| error.to_string())?);
    }

    let mut edges = Vec::new();
    let mut edge_stmt = conn
        .prepare(
            "SELECT id, subject_entity_id, predicate, object_entity_id, confidence
             FROM memory_relations
             WHERE profile_id = ?1
             ORDER BY id DESC
             LIMIT ?2",
        )
        .map_err(|error| error.to_string())?;
    let edge_rows = edge_stmt
        .query_map(params![profile_id, limit as i64], |row| {
            Ok(TopicGraphEdge {
                id: row.get(0)?,
                subject_entity_id: row.get(1)?,
                predicate: row.get(2)?,
                object_entity_id: row.get(3)?,
                confidence: row.get(4)?,
            })
        })
        .map_err(|error| error.to_string())?;
    for row in edge_rows {
        edges.push(row.map_err(|error| error.to_string())?);
    }

    Ok(TopicGraphBundle { nodes, edges })
}

pub fn query_topic_neighbors(path: &Path, query: &str) -> Result<String, String> {
    let graph = get_topic_graph(path, 100)?;
    let needle = query.trim().to_lowercase();
    let anchor = graph
        .nodes
        .iter()
        .find(|node| node.label.to_lowercase().contains(&needle));
    let Some(anchor) = anchor else {
        return Ok(format!("No topic graph node matched \"{query}\"."));
    };

    let mut lines = vec![format!(
        "Connections for {} ({})",
        anchor.label, anchor.domain
    )];
    for edge in &graph.edges {
        if edge.subject_entity_id == anchor.entity_id {
            if let Some(target) = graph
                .nodes
                .iter()
                .find(|node| node.entity_id == edge.object_entity_id)
            {
                lines.push(format!("- {} → {}", edge.predicate, target.label));
            }
        } else if edge.object_entity_id == anchor.entity_id {
            if let Some(source) = graph
                .nodes
                .iter()
                .find(|node| node.entity_id == edge.subject_entity_id)
            {
                lines.push(format!(
                    "- {} ← {} ({})",
                    edge.predicate, source.label, source.domain
                ));
            }
        }
    }
    if lines.len() == 1 {
        lines.push("- No relations recorded yet.".to_string());
    }
    Ok(lines.join("\n"))
}

pub fn infer_relations_from_domains(path: &Path) -> Result<usize, String> {
    ensure_topic_graph_schema(path)?;
    let mut count = 0usize;
    for domain in ["people", "meeting_prep", "travel"] {
        let entities = list_entity_metadata(path, domain)?;
        for (entity_id, metadata_json) in entities {
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(&metadata_json) {
                if let Some(title) = value
                    .get("eventTitle")
                    .or_else(|| value.get("title"))
                    .and_then(|entry| entry.as_str())
                {
                    for other_domain in ["people", "travel"] {
                        if other_domain == domain {
                            continue;
                        }
                        for (other_id, other_json) in list_entity_metadata(path, other_domain)? {
                            if let Ok(other) =
                                serde_json::from_str::<serde_json::Value>(&other_json)
                            {
                                let other_label = other
                                    .get("title")
                                    .or_else(|| other.get("name"))
                                    .and_then(|entry| entry.as_str())
                                    .unwrap_or("");
                                if !other_label.is_empty()
                                    && title.to_lowercase().contains(&other_label.to_lowercase())
                                {
                                    upsert_relation(
                                        path,
                                        entity_id,
                                        "related_to",
                                        other_id,
                                        "auto_infer",
                                    )?;
                                    count += 1;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gateway::profiles::{seed_default_profiles, switch_profile};
    use crate::memory::travel::upsert_travel;
    use crate::models::TravelMemoryRecord;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_paths() -> (std::path::PathBuf, std::path::PathBuf) {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let db = std::env::temp_dir().join(format!("jarvis-topic-graph-{nanos}.db"));
        let app_data = std::env::temp_dir().join(format!("jarvis-topic-graph-app-{nanos}"));
        (db, app_data)
    }

    fn sample_trip(title: &str) -> TravelMemoryRecord {
        TravelMemoryRecord {
            id: format!("trip-{title}"),
            title: title.to_string(),
            source_email_subject: "subject".to_string(),
            transport: None,
            departure: None,
            arrival: None,
            hotel: None,
            check_in: None,
            check_out: None,
            confirmation_code: None,
            calendar_linked_at: None,
            segment_count: 1,
            timeline: vec![],
            checklist: vec![],
            summary: format!("{title} summary"),
            created_at: "2026-01-01T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn topic_graph_scopes_nodes_by_active_profile() {
        let (db_path, app_data_dir) = temp_paths();
        std::fs::create_dir_all(&app_data_dir).expect("dir");
        seed_default_profiles(&db_path, &app_data_dir).expect("seed");
        upsert_travel(&db_path, &sample_trip("Work trip")).expect("work trip");
        switch_profile(&db_path, &app_data_dir, "personal").expect("switch personal");
        upsert_travel(&db_path, &sample_trip("Personal trip")).expect("personal trip");

        let personal_graph = get_topic_graph(&db_path, 20).expect("personal graph");
        assert!(personal_graph
            .nodes
            .iter()
            .any(|node| node.label == "Personal trip"));
        assert!(personal_graph
            .nodes
            .iter()
            .all(|node| node.label != "Work trip"));

        switch_profile(&db_path, &app_data_dir, "work").expect("switch work");
        let work_graph = get_topic_graph(&db_path, 20).expect("work graph");
        assert!(work_graph
            .nodes
            .iter()
            .any(|node| node.label == "Work trip"));
        assert!(work_graph
            .nodes
            .iter()
            .all(|node| node.label != "Personal trip"));

        let _ = std::fs::remove_file(db_path);
        let _ = std::fs::remove_dir_all(app_data_dir);
    }
}
