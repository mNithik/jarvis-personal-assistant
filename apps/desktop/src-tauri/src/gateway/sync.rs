use std::collections::HashMap;
use std::fs;
use std::path::Path;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use rusqlite::{params, Connection};

use crate::gateway::config::{load_gateway_config, save_gateway_config, GatewayConfig};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserGoalRecord {
    pub id: String,
    #[serde(default)]
    pub profile_id: Option<String>,
    pub title: String,
    pub description: String,
    pub status: String,
    pub target_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncProfileBundle {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub created_at: String,
    pub gateway_config: GatewayConfig,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncMemoryEntityRecord {
    pub profile_id: String,
    pub domain: String,
    pub label: String,
    pub metadata_json: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncMemoryRelationRecord {
    pub profile_id: String,
    pub subject_domain: String,
    pub subject_label: String,
    pub predicate: String,
    pub object_domain: String,
    pub object_label: String,
    pub confidence: f64,
    pub source: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncMemoryFactRecord {
    pub profile_id: String,
    pub domain: String,
    pub label: String,
    pub predicate: String,
    pub object_value: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncMemoryDocumentRecord {
    pub source_id: i64,
    pub profile_id: String,
    pub domain: String,
    pub source: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncMemoryChunkRecord {
    pub source_id: i64,
    pub source_document_id: i64,
    pub profile_id: String,
    pub entity_domain: Option<String>,
    pub entity_label: Option<String>,
    pub domain: String,
    pub chunk_text: String,
    pub created_at: String,
    pub embedding_dimensions: Option<i64>,
    pub embedding_base64: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncBundle {
    pub exported_at: String,
    pub active_profile_id: Option<String>,
    pub gateway_config: GatewayConfig,
    #[serde(default)]
    pub profiles: Vec<SyncProfileBundle>,
    #[serde(default)]
    pub memory_entities: Vec<SyncMemoryEntityRecord>,
    #[serde(default)]
    pub memory_facts: Vec<SyncMemoryFactRecord>,
    #[serde(default)]
    pub memory_relations: Vec<SyncMemoryRelationRecord>,
    #[serde(default)]
    pub memory_documents: Vec<SyncMemoryDocumentRecord>,
    #[serde(default)]
    pub memory_chunks: Vec<SyncMemoryChunkRecord>,
    pub goals: Vec<UserGoalRecord>,
    pub trigger_recipes: Vec<crate::gateway::trigger_recipes::TriggerRecipeRecord>,
}

fn list_all_user_goals(db_path: &Path) -> Result<Vec<UserGoalRecord>, String> {
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    let mut statement = conn
        .prepare(
            "SELECT id, profile_id, title, description, status, target_date, created_at, updated_at
             FROM user_goals
             ORDER BY profile_id ASC, updated_at DESC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(UserGoalRecord {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                title: row.get(2)?,
                description: row.get(3)?,
                status: row.get(4)?,
                target_date: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn export_memory_entities(db_path: &Path) -> Result<Vec<SyncMemoryEntityRecord>, String> {
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    let mut statement = conn
        .prepare(
            "SELECT profile_id, domain, label, metadata_json, created_at, updated_at
             FROM memory_entities
             ORDER BY profile_id ASC, domain ASC, updated_at DESC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(SyncMemoryEntityRecord {
                profile_id: row.get(0)?,
                domain: row.get(1)?,
                label: row.get(2)?,
                metadata_json: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn export_memory_relations(db_path: &Path) -> Result<Vec<SyncMemoryRelationRecord>, String> {
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    let mut statement = conn
        .prepare(
            "SELECT
                r.profile_id,
                subject.domain,
                subject.label,
                r.predicate,
                object.domain,
                object.label,
                r.confidence,
                r.source
             FROM memory_relations r
             JOIN memory_entities subject ON subject.id = r.subject_entity_id
             JOIN memory_entities object ON object.id = r.object_entity_id
             ORDER BY r.profile_id ASC, r.id ASC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(SyncMemoryRelationRecord {
                profile_id: row.get(0)?,
                subject_domain: row.get(1)?,
                subject_label: row.get(2)?,
                predicate: row.get(3)?,
                object_domain: row.get(4)?,
                object_label: row.get(5)?,
                confidence: row.get(6)?,
                source: row.get(7)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn export_memory_facts(db_path: &Path) -> Result<Vec<SyncMemoryFactRecord>, String> {
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    let mut statement = conn
        .prepare(
            "SELECT
                entity.profile_id,
                entity.domain,
                entity.label,
                fact.predicate,
                fact.object_value
             FROM memory_facts fact
             JOIN memory_entities entity ON entity.id = fact.entity_id
             ORDER BY entity.profile_id ASC, entity.domain ASC, entity.label ASC, fact.predicate ASC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(SyncMemoryFactRecord {
                profile_id: row.get(0)?,
                domain: row.get(1)?,
                label: row.get(2)?,
                predicate: row.get(3)?,
                object_value: row.get(4)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn export_memory_documents(db_path: &Path) -> Result<Vec<SyncMemoryDocumentRecord>, String> {
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    let mut statement = conn
        .prepare(
            "SELECT id, profile_id, domain, source, content, created_at
             FROM memory_documents
             ORDER BY profile_id ASC, id ASC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(SyncMemoryDocumentRecord {
                source_id: row.get(0)?,
                profile_id: row.get(1)?,
                domain: row.get(2)?,
                source: row.get(3)?,
                content: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn export_memory_chunks(db_path: &Path) -> Result<Vec<SyncMemoryChunkRecord>, String> {
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    let mut statement = conn
        .prepare(
            "SELECT
                c.id,
                c.document_id,
                c.profile_id,
                entity.domain,
                entity.label,
                c.domain,
                c.chunk_text,
                c.created_at,
                embedding.dimensions,
                embedding.embedding
             FROM memory_chunks c
             LEFT JOIN memory_entities entity ON entity.id = c.entity_id
             LEFT JOIN memory_embeddings embedding ON embedding.chunk_id = c.id
             ORDER BY c.profile_id ASC, c.id ASC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            let blob = row.get::<_, Option<Vec<u8>>>(9)?;
            Ok(SyncMemoryChunkRecord {
                source_id: row.get(0)?,
                source_document_id: row.get(1)?,
                profile_id: row.get(2)?,
                entity_domain: row.get(3)?,
                entity_label: row.get(4)?,
                domain: row.get(5)?,
                chunk_text: row.get(6)?,
                created_at: row.get(7)?,
                embedding_dimensions: row.get(8)?,
                embedding_base64: blob.map(|bytes| STANDARD.encode(bytes)),
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn upsert_memory_entity_record(
    db_path: &Path,
    entity: &SyncMemoryEntityRecord,
) -> Result<(), String> {
    crate::memory::ensure_schema(db_path)?;
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    if let Ok(existing_id) = conn.query_row(
        "SELECT id FROM memory_entities
         WHERE profile_id = ?1 AND domain = ?2 AND lower(label) = lower(?3)",
        params![entity.profile_id, entity.domain, entity.label],
        |row| row.get::<_, i64>(0),
    ) {
        conn.execute(
            "UPDATE memory_entities
             SET metadata_json = ?1, created_at = ?2, updated_at = ?3
             WHERE id = ?4",
            params![
                entity.metadata_json,
                entity.created_at,
                entity.updated_at,
                existing_id
            ],
        )
        .map_err(|error| error.to_string())?;
    } else {
        conn.execute(
            "INSERT INTO memory_entities (profile_id, domain, label, metadata_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                entity.profile_id,
                entity.domain,
                entity.label,
                entity.metadata_json,
                entity.created_at,
                entity.updated_at
            ],
        )
        .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn find_memory_entity_id(
    conn: &Connection,
    profile_id: &str,
    domain: &str,
    label: &str,
) -> Result<i64, String> {
    conn.query_row(
        "SELECT id FROM memory_entities
         WHERE profile_id = ?1 AND domain = ?2 AND lower(label) = lower(?3)",
        params![profile_id, domain, label],
        |row| row.get::<_, i64>(0),
    )
    .map_err(|_| format!("Missing memory entity {profile_id}:{domain}:{label}"))
}

fn upsert_memory_relation_record(
    db_path: &Path,
    relation: &SyncMemoryRelationRecord,
) -> Result<(), String> {
    crate::memory::topic_graph::ensure_topic_graph_schema(db_path)?;
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    let subject_id = find_memory_entity_id(
        &conn,
        &relation.profile_id,
        &relation.subject_domain,
        &relation.subject_label,
    )?;
    let object_id = find_memory_entity_id(
        &conn,
        &relation.profile_id,
        &relation.object_domain,
        &relation.object_label,
    )?;
    conn.execute(
        "DELETE FROM memory_relations
         WHERE profile_id = ?1 AND subject_entity_id = ?2 AND predicate = ?3 AND object_entity_id = ?4",
        params![relation.profile_id, subject_id, relation.predicate, object_id],
    )
    .map_err(|error| error.to_string())?;
    conn.execute(
        "INSERT INTO memory_relations (profile_id, subject_entity_id, predicate, object_entity_id, confidence, source)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            relation.profile_id,
            subject_id,
            relation.predicate,
            object_id,
            relation.confidence,
            relation.source
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn upsert_memory_fact_record(db_path: &Path, fact: &SyncMemoryFactRecord) -> Result<(), String> {
    crate::memory::ensure_schema(db_path)?;
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    let entity_id = find_memory_entity_id(&conn, &fact.profile_id, &fact.domain, &fact.label)?;
    crate::memory::triples::upsert_fact(&conn, entity_id, &fact.predicate, &fact.object_value)
}

fn upsert_memory_document_record(
    conn: &Connection,
    document: &SyncMemoryDocumentRecord,
) -> Result<i64, String> {
    if let Ok(existing_id) = conn.query_row(
        "SELECT id FROM memory_documents
         WHERE profile_id = ?1 AND domain = ?2 AND source = ?3 AND content = ?4 AND created_at = ?5",
        params![
            document.profile_id,
            document.domain,
            document.source,
            document.content,
            document.created_at
        ],
        |row| row.get::<_, i64>(0),
    ) {
        return Ok(existing_id);
    }

    conn.execute(
        "INSERT INTO memory_documents (profile_id, domain, source, content, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            document.profile_id,
            document.domain,
            document.source,
            document.content,
            document.created_at
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(conn.last_insert_rowid())
}

fn upsert_memory_chunk_record(
    conn: &Connection,
    chunk: &SyncMemoryChunkRecord,
    target_document_id: i64,
) -> Result<i64, String> {
    let entity_id = match (&chunk.entity_domain, &chunk.entity_label) {
        (Some(domain), Some(label)) => Some(find_memory_entity_id(
            conn,
            &chunk.profile_id,
            domain,
            label,
        )?),
        _ => None,
    };
    let existing_id = conn
        .query_row(
            "SELECT id FROM memory_chunks
             WHERE profile_id = ?1
               AND document_id = ?2
               AND ((entity_id IS NULL AND ?3 IS NULL) OR entity_id = ?3)
               AND domain = ?4
               AND chunk_text = ?5
               AND created_at = ?6",
            params![
                chunk.profile_id,
                target_document_id,
                entity_id,
                chunk.domain,
                chunk.chunk_text,
                chunk.created_at
            ],
            |row| row.get::<_, i64>(0),
        )
        .ok();
    let chunk_id = if let Some(existing_id) = existing_id {
        conn.execute(
            "UPDATE memory_chunks
             SET entity_id = ?1, domain = ?2, chunk_text = ?3
             WHERE id = ?4",
            params![entity_id, chunk.domain, chunk.chunk_text, existing_id],
        )
        .map_err(|error| error.to_string())?;
        existing_id
    } else {
        conn.execute(
            "INSERT INTO memory_chunks (profile_id, document_id, entity_id, domain, chunk_text, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                chunk.profile_id,
                target_document_id,
                entity_id,
                chunk.domain,
                chunk.chunk_text,
                chunk.created_at
            ],
        )
        .map_err(|error| error.to_string())?;
        conn.last_insert_rowid()
    };

    conn.execute(
        "INSERT OR REPLACE INTO memory_chunks_fts (rowid, chunk_text, domain) VALUES (?1, ?2, ?3)",
        params![chunk_id, chunk.chunk_text, chunk.domain],
    )
    .map_err(|error| error.to_string())?;

    if let (Some(dimensions), Some(encoded_embedding)) =
        (chunk.embedding_dimensions, chunk.embedding_base64.as_ref())
    {
        let embedding = STANDARD
            .decode(encoded_embedding)
            .map_err(|error| error.to_string())?;
        conn.execute(
            "INSERT INTO memory_embeddings (chunk_id, dimensions, embedding)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(chunk_id) DO UPDATE SET
                dimensions = excluded.dimensions,
                embedding = excluded.embedding",
            params![chunk_id, dimensions, embedding],
        )
        .map_err(|error| error.to_string())?;
    }

    Ok(chunk_id)
}

pub fn list_user_goals(db_path: &Path) -> Result<Vec<UserGoalRecord>, String> {
    let profile_id = crate::gateway::profiles::active_profile_id_or_default(db_path)?;
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    let mut statement = conn
        .prepare(
            "SELECT id, profile_id, title, description, status, target_date, created_at, updated_at
             FROM user_goals
             WHERE profile_id = ?1
             ORDER BY updated_at DESC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([profile_id], |row| {
            Ok(UserGoalRecord {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                title: row.get(2)?,
                description: row.get(3)?,
                status: row.get(4)?,
                target_date: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

pub fn save_user_goal(db_path: &Path, goal: &UserGoalRecord) -> Result<(), String> {
    let profile_id =
        goal.profile_id
            .clone()
            .unwrap_or(crate::gateway::profiles::active_profile_id_or_default(
                db_path,
            )?);
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    conn.execute(
        "INSERT INTO user_goals (id, profile_id, title, description, status, target_date, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
            profile_id = excluded.profile_id,
            title = excluded.title,
            description = excluded.description,
            status = excluded.status,
            target_date = excluded.target_date,
            updated_at = excluded.updated_at",
        params![
            goal.id,
            profile_id,
            goal.title,
            goal.description,
            goal.status,
            goal.target_date,
            goal.created_at,
            goal.updated_at,
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn export_sync_bundle(
    db_path: &Path,
    app_data_dir: &Path,
    passphrase: &str,
) -> Result<String, String> {
    crate::memory::ensure_schema(db_path)?;
    crate::memory::topic_graph::ensure_topic_graph_schema(db_path)?;
    crate::migrations::apply_pending_migrations(
        &Connection::open(db_path).map_err(|error| error.to_string())?,
        db_path,
    )?;
    let profiles = crate::gateway::profiles::list_profiles(db_path)?
        .into_iter()
        .filter_map(|profile| {
            crate::gateway::profiles::profile_gateway_config(db_path, &profile.id)
                .ok()
                .map(|gateway_config| SyncProfileBundle {
                    id: profile.id,
                    name: profile.name,
                    kind: profile.kind,
                    created_at: profile.created_at,
                    gateway_config,
                })
        })
        .collect();
    let bundle = SyncBundle {
        exported_at: chrono::Utc::now().to_rfc3339(),
        active_profile_id: crate::gateway::profiles::get_active_profile_id(db_path)?,
        gateway_config: load_gateway_config(app_data_dir),
        profiles,
        memory_entities: export_memory_entities(db_path)?,
        memory_facts: export_memory_facts(db_path)?,
        memory_relations: export_memory_relations(db_path)?,
        memory_documents: export_memory_documents(db_path)?,
        memory_chunks: export_memory_chunks(db_path)?,
        goals: list_all_user_goals(db_path)?,
        trigger_recipes: crate::gateway::trigger_recipes::list_trigger_recipes(db_path)?,
    };
    let json = serde_json::to_string_pretty(&bundle).map_err(|error| error.to_string())?;
    let encoded = STANDARD.encode(format!("{passphrase}::{json}"));
    let export_dir = app_data_dir.join("sync").join("exports");
    fs::create_dir_all(&export_dir).map_err(|error| error.to_string())?;
    let path = export_dir.join(format!(
        "jarvis-sync-{}.json",
        chrono::Utc::now().timestamp()
    ));
    fs::write(&path, encoded).map_err(|error| error.to_string())?;
    Ok(path.display().to_string())
}

pub fn import_sync_bundle(
    db_path: &Path,
    app_data_dir: &Path,
    bundle_path: &Path,
    passphrase: &str,
) -> Result<String, String> {
    crate::memory::ensure_schema(db_path)?;
    let encoded = fs::read_to_string(bundle_path).map_err(|error| error.to_string())?;
    let decoded = String::from_utf8(
        STANDARD
            .decode(encoded.trim())
            .map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;
    let (expected_prefix, json) = decoded
        .split_once("::")
        .ok_or_else(|| "Invalid sync bundle format.".to_string())?;
    if expected_prefix != passphrase {
        return Err("Sync bundle passphrase mismatch.".to_string());
    }
    let bundle: SyncBundle = serde_json::from_str(json).map_err(|error| error.to_string())?;
    save_gateway_config(app_data_dir, &bundle.gateway_config)?;
    for profile in &bundle.profiles {
        crate::gateway::profiles::upsert_profile(
            db_path,
            &crate::gateway::profiles::UserProfileRecord {
                id: profile.id.clone(),
                name: profile.name.clone(),
                kind: profile.kind.clone(),
                created_at: profile.created_at.clone(),
            },
            &profile.gateway_config,
        )?;
    }
    for entity in &bundle.memory_entities {
        upsert_memory_entity_record(db_path, entity)?;
    }
    for fact in &bundle.memory_facts {
        upsert_memory_fact_record(db_path, fact)?;
    }
    for relation in &bundle.memory_relations {
        upsert_memory_relation_record(db_path, relation)?;
    }
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    let mut document_ids = HashMap::new();
    for document in &bundle.memory_documents {
        let target_document_id = upsert_memory_document_record(&conn, document)?;
        document_ids.insert(document.source_id, target_document_id);
    }
    for chunk in &bundle.memory_chunks {
        let target_document_id = document_ids
            .get(&chunk.source_document_id)
            .copied()
            .ok_or_else(|| format!("Missing memory document {}", chunk.source_document_id))?;
        let _ = upsert_memory_chunk_record(&conn, chunk, target_document_id)?;
    }
    for goal in &bundle.goals {
        save_user_goal(db_path, goal)?;
    }
    for recipe in &bundle.trigger_recipes {
        crate::gateway::trigger_recipes::save_trigger_recipe(db_path, recipe)?;
    }
    if let Some(active_id) = &bundle.active_profile_id {
        let _ = crate::gateway::profiles::switch_profile(db_path, app_data_dir, active_id);
    }
    Ok(format!(
        "Imported sync bundle with {} goal(s), {} memory item(s), {} fact(s), {} relation(s), {} recall document(s), {} recall chunk(s), and {} trigger recipe(s).",
        bundle.goals.len(),
        bundle.memory_entities.len(),
        bundle.memory_facts.len(),
        bundle.memory_relations.len(),
        bundle.memory_documents.len(),
        bundle.memory_chunks.len(),
        bundle.trigger_recipes.len()
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gateway::profiles::{seed_default_profiles, switch_profile};
    use crate::memory::people::upsert_person;
    use crate::memory::travel::{list_travel, upsert_travel};
    use crate::memory::triples::lookup_birthday;
    use crate::memory::{recall_text, remember};
    use crate::models::PersonMemoryRecord;
    use crate::models::TravelMemoryRecord;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_paths() -> (std::path::PathBuf, std::path::PathBuf) {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let db = std::env::temp_dir().join(format!("jarvis-sync-{nanos}.db"));
        let app_data = std::env::temp_dir().join(format!("jarvis-sync-app-{nanos}"));
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

    fn sample_person(name: &str, birthday_label: &str) -> PersonMemoryRecord {
        PersonMemoryRecord {
            id: format!("person-{name}"),
            name: name.to_string(),
            birthday_label: birthday_label.to_string(),
            month: 5,
            day: 10,
            age: None,
            relationship: Some("friend".to_string()),
            gift_notes: vec![],
            contact_notes: vec![],
            last_contact_label: None,
            follow_up_due_label: None,
            follow_up_reason: None,
            reminder_lead_days: 7,
            calendar_linked_at: None,
            source: "manual".to_string(),
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-01T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn user_goals_are_scoped_to_active_profile() {
        let (db_path, app_data_dir) = temp_paths();
        std::fs::create_dir_all(&app_data_dir).expect("dir");
        seed_default_profiles(&db_path, &app_data_dir).expect("seed");

        let now = "2026-01-01T00:00:00Z".to_string();
        save_user_goal(
            &db_path,
            &UserGoalRecord {
                id: "goal-work".to_string(),
                profile_id: None,
                title: "Work goal".to_string(),
                description: String::new(),
                status: "active".to_string(),
                target_date: None,
                created_at: now.clone(),
                updated_at: now.clone(),
            },
        )
        .expect("save work goal");

        switch_profile(&db_path, &app_data_dir, "personal").expect("switch");
        save_user_goal(
            &db_path,
            &UserGoalRecord {
                id: "goal-personal".to_string(),
                profile_id: None,
                title: "Personal goal".to_string(),
                description: String::new(),
                status: "active".to_string(),
                target_date: None,
                created_at: now.clone(),
                updated_at: now.clone(),
            },
        )
        .expect("save personal goal");

        let personal_goals = list_user_goals(&db_path).expect("list personal");
        assert_eq!(personal_goals.len(), 1);
        assert_eq!(personal_goals[0].title, "Personal goal");

        switch_profile(&db_path, &app_data_dir, "work").expect("switch back");
        let work_goals = list_user_goals(&db_path).expect("list work");
        assert_eq!(work_goals.len(), 1);
        assert_eq!(work_goals[0].title, "Work goal");

        let _ = std::fs::remove_file(db_path);
        let _ = std::fs::remove_dir_all(app_data_dir);
    }

    #[test]
    fn sync_bundle_round_trips_profile_memory_and_goals() {
        let (source_db, source_app_data) = temp_paths();
        let (target_db, target_app_data) = temp_paths();
        std::fs::create_dir_all(&source_app_data).expect("source dir");
        std::fs::create_dir_all(&target_app_data).expect("target dir");
        seed_default_profiles(&source_db, &source_app_data).expect("seed source");

        let now = "2026-01-01T00:00:00Z".to_string();
        upsert_travel(&source_db, &sample_trip("Work trip")).expect("work trip");
        upsert_person(&source_db, &sample_person("Alex", "May 10")).expect("work person");
        remember(&source_db, "Work secret launch checklist", "general").expect("work recall");
        save_user_goal(
            &source_db,
            &UserGoalRecord {
                id: "goal-work".to_string(),
                profile_id: Some("work".to_string()),
                title: "Work goal".to_string(),
                description: String::new(),
                status: "active".to_string(),
                target_date: None,
                created_at: now.clone(),
                updated_at: now.clone(),
            },
        )
        .expect("work goal");

        switch_profile(&source_db, &source_app_data, "personal").expect("switch personal");
        upsert_travel(&source_db, &sample_trip("Personal trip")).expect("personal trip");
        remember(&source_db, "Personal dinner reservation", "general").expect("personal recall");
        save_user_goal(
            &source_db,
            &UserGoalRecord {
                id: "goal-personal".to_string(),
                profile_id: Some("personal".to_string()),
                title: "Personal goal".to_string(),
                description: String::new(),
                status: "active".to_string(),
                target_date: None,
                created_at: now.clone(),
                updated_at: now.clone(),
            },
        )
        .expect("personal goal");

        let bundle_path =
            export_sync_bundle(&source_db, &source_app_data, "jarvis").expect("export bundle");

        seed_default_profiles(&target_db, &target_app_data).expect("seed target");
        import_sync_bundle(
            &target_db,
            &target_app_data,
            std::path::Path::new(&bundle_path),
            "jarvis",
        )
        .expect("import bundle");

        let active_profile =
            crate::gateway::profiles::get_active_profile_id(&target_db).expect("active profile");
        assert_eq!(active_profile.as_deref(), Some("personal"));

        let personal_goals = list_user_goals(&target_db).expect("personal goals");
        assert_eq!(personal_goals.len(), 1);
        assert_eq!(personal_goals[0].title, "Personal goal");
        let personal_travel = list_travel(&target_db).expect("personal travel");
        assert_eq!(personal_travel.len(), 1);
        assert_eq!(personal_travel[0].title, "Personal trip");
        let personal_recall =
            recall_text(&target_db, "dinner reservation").expect("personal recall");
        assert!(personal_recall.contains("Personal dinner reservation"));

        switch_profile(&target_db, &target_app_data, "work").expect("switch work");
        let work_goals = list_user_goals(&target_db).expect("work goals");
        assert_eq!(work_goals.len(), 1);
        assert_eq!(work_goals[0].title, "Work goal");
        let work_travel = list_travel(&target_db).expect("work travel");
        assert_eq!(work_travel.len(), 1);
        assert_eq!(work_travel[0].title, "Work trip");
        let work_recall = recall_text(&target_db, "launch checklist").expect("work recall");
        assert!(work_recall.contains("Work secret launch checklist"));
        let birthday = lookup_birthday(&target_db, "Alex").expect("birthday lookup");
        assert_eq!(birthday.as_deref(), Some("Alex's birthday is May 10."));

        let _ = std::fs::remove_file(source_db);
        let _ = std::fs::remove_dir_all(source_app_data);
        let _ = std::fs::remove_file(target_db);
        let _ = std::fs::remove_dir_all(target_app_data);
        let _ = std::fs::remove_file(std::path::Path::new(&bundle_path));
    }
}
