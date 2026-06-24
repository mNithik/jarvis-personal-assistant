use std::path::Path;

use rusqlite::{params, Connection};

pub fn upsert_fact(
    connection: &Connection,
    entity_id: i64,
    predicate: &str,
    object_value: &str,
) -> Result<(), String> {
    connection
        .execute(
            "DELETE FROM memory_facts WHERE entity_id = ?1 AND predicate = ?2",
            params![entity_id, predicate],
        )
        .map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO memory_facts (entity_id, predicate, object_value) VALUES (?1, ?2, ?3)",
            params![entity_id, predicate, object_value],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn lookup_birthday(path: &Path, query: &str) -> Result<Option<String>, String> {
    let profile_id = crate::gateway::profiles::active_profile_id_or_default(path)?;
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    let normalized = query.trim().to_lowercase();
    let mut statement = connection
        .prepare(
            "SELECT e.label, f.object_value
             FROM memory_entities e
             JOIN memory_facts f ON f.entity_id = e.id
             WHERE e.profile_id = ?1 AND e.domain = 'people' AND f.predicate = 'birthday'
             ORDER BY e.updated_at DESC",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([profile_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    for (label, birthday) in rows {
        if normalized.contains(&label.to_lowercase()) || label.to_lowercase().contains(&normalized)
        {
            return Ok(Some(format!("{label}'s birthday is {birthday}.")));
        }
    }

    Ok(None)
}

pub fn lookup_entity_fact(
    path: &Path,
    entity_query: &str,
    predicate: &str,
) -> Result<Option<String>, String> {
    let profile_id = crate::gateway::profiles::active_profile_id_or_default(path)?;
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    let normalized = entity_query.trim().to_lowercase();
    let mut statement = connection
        .prepare(
            "SELECT e.label, f.object_value
             FROM memory_entities e
             JOIN memory_facts f ON f.entity_id = e.id
             WHERE e.profile_id = ?1 AND f.predicate = ?2
             ORDER BY e.updated_at DESC",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map(params![profile_id, predicate], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    for (label, value) in rows {
        if normalized.contains(&label.to_lowercase()) || label.to_lowercase().contains(&normalized)
        {
            return Ok(Some(format!("{label} {predicate}: {value}.")));
        }
    }

    Ok(None)
}
