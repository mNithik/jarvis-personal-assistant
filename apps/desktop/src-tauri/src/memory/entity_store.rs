use std::path::Path;

use rusqlite::{params, Connection};

use super::recall::store_chunk_with_embedding;
use super::triples::upsert_fact;

pub fn upsert_domain_entity(
    path: &Path,
    domain: &str,
    label: &str,
    metadata_json: &str,
    summary: &str,
    facts: &[(&str, &str)],
) -> Result<i64, String> {
    super::ensure_schema(path)?;
    let profile_id = crate::gateway::profiles::active_profile_id_or_default(path)?;
    let connection = Connection::open(path).map_err(|error| error.to_string())?;

    let entity_id = if let Ok(existing_id) = connection.query_row(
        "SELECT id FROM memory_entities
         WHERE profile_id = ?1 AND domain = ?2 AND lower(label) = lower(?3)",
        params![profile_id, domain, label],
        |row| row.get::<_, i64>(0),
    ) {
        connection
            .execute(
                "UPDATE memory_entities SET metadata_json = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
                params![metadata_json, existing_id],
            )
            .map_err(|error| error.to_string())?;
        existing_id
    } else {
        connection
            .execute(
                "INSERT INTO memory_entities (profile_id, domain, label, metadata_json) VALUES (?1, ?2, ?3, ?4)",
                params![profile_id, domain, label, metadata_json],
            )
            .map_err(|error| error.to_string())?;
        connection.last_insert_rowid()
    };

    for (predicate, value) in facts {
        if !value.trim().is_empty() {
            upsert_fact(&connection, entity_id, predicate, value)?;
        }
    }

    if !summary.trim().is_empty() {
        let profile_id = crate::gateway::profiles::active_profile_id_or_default(path)?;
        connection
            .execute(
                "INSERT INTO memory_documents (profile_id, domain, source, content) VALUES (?1, ?2, 'import', ?3)",
                params![profile_id, domain, summary],
            )
            .map_err(|error| error.to_string())?;
        let document_id = connection.last_insert_rowid();
        store_chunk_with_embedding(
            &connection,
            path,
            document_id,
            Some(entity_id),
            domain,
            summary,
        )?;
    }

    Ok(entity_id)
}

pub fn list_entity_metadata(path: &Path, domain: &str) -> Result<Vec<(i64, String)>, String> {
    super::ensure_schema(path)?;
    let profile_id = crate::gateway::profiles::active_profile_id_or_default(path)?;
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT id, metadata_json
             FROM memory_entities
             WHERE profile_id = ?1 AND domain = ?2
             ORDER BY updated_at DESC",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map(params![profile_id, domain], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(rows)
}
