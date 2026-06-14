use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::OptionalExtension;

const SCHEMA_VERSION_KEY: &str = "schema_version";

pub fn current_schema_version(conn: &rusqlite::Connection) -> Result<i64, String> {
    let raw: Option<String> = conn
        .query_row(
            "SELECT value FROM app_meta WHERE key = ?1",
            [SCHEMA_VERSION_KEY],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    Ok(raw
        .and_then(|value| value.parse::<i64>().ok())
        .unwrap_or(0))
}

pub fn ensure_migration_framework(conn: &rusqlite::Connection) -> Result<i64, String> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        ",
    )
    .map_err(|error| error.to_string())?;

    let version = current_schema_version(conn)?;
    if version == 0 {
        conn.execute(
            "INSERT OR IGNORE INTO app_meta (key, value) VALUES (?1, ?2)",
            rusqlite::params![SCHEMA_VERSION_KEY, "0"],
        )
        .map_err(|error| error.to_string())?;
    }
    Ok(version)
}

pub fn backup_database(db_path: &Path) -> Result<PathBuf, String> {
    let backup_dir = db_path
        .parent()
        .map(|parent| parent.join("backups"))
        .unwrap_or_else(|| PathBuf::from("backups"));
    fs::create_dir_all(&backup_dir).map_err(|error| error.to_string())?;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    let file_name = db_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("jarvis.db");
    let backup_path = backup_dir.join(format!("{file_name}.{stamp}.bak"));
    fs::copy(db_path, &backup_path).map_err(|error| error.to_string())?;
    Ok(backup_path)
}

pub fn apply_pending_migrations(
    conn: &rusqlite::Connection,
    db_path: &Path,
) -> Result<i64, String> {
    let mut version = ensure_migration_framework(conn)?;
    let migrations: &[(&str, i64)] = &[
        // Future numbered migrations go here. Each bump requires explicit user approval before ship.
    ];

    for (sql, target_version) in migrations {
        if version >= *target_version {
            continue;
        }
        let _backup = backup_database(db_path)?;
        conn.execute_batch(sql).map_err(|error| error.to_string())?;
        conn.execute(
            "UPDATE app_meta SET value = ?1 WHERE key = ?2",
            rusqlite::params![target_version.to_string(), SCHEMA_VERSION_KEY],
        )
        .map_err(|error| error.to_string())?;
        version = *target_version;
    }

    Ok(version)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn creates_meta_table_without_bumping_version() {
        let path = std::env::temp_dir().join(format!("jarvis-migration-test-{}", std::process::id()));
        let conn = Connection::open(&path).expect("open");
        let version = ensure_migration_framework(&conn).expect("framework");
        assert_eq!(version, 0);
        let _ = std::fs::remove_file(path);
    }
}
