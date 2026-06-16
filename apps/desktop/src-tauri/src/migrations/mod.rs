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
    const MIGRATION_V1: &str = "
        CREATE TABLE IF NOT EXISTS trigger_events (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            payload TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_trigger_events_status ON trigger_events(status, created_at);

        CREATE TABLE IF NOT EXISTS ocr_watches (
            id TEXT PRIMARY KEY,
            name TEXT,
            scope TEXT NOT NULL,
            region_json TEXT,
            app_name TEXT,
            interval_ms INTEGER NOT NULL DEFAULT 60000,
            rule_json TEXT NOT NULL,
            action TEXT,
            paused INTEGER NOT NULL DEFAULT 0,
            log_to_notion INTEGER NOT NULL DEFAULT 0,
            create_task_on_match INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS desktop_schedules (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            cron_expr TEXT,
            at_time TEXT,
            days_json TEXT,
            command TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            last_run_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS saved_workflows (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            steps_json TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'user',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    ";

    let migrations: &[(&str, i64)] = &[(MIGRATION_V1, 1)];

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
    fn applies_migration_v1() {
        let path = std::env::temp_dir().join(format!(
            "jarvis-migration-v1-{}",
            std::process::id()
        ));
        let conn = Connection::open(&path).expect("open");
        let version = apply_pending_migrations(&conn, &path).expect("migrate");
        assert_eq!(version, 1);
        let table_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('trigger_events', 'ocr_watches', 'desktop_schedules', 'saved_workflows')",
                [],
                |row| row.get(0),
            )
            .expect("count");
        assert_eq!(table_count, 4);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn creates_meta_table_without_bumping_version() {
        let path = std::env::temp_dir().join(format!("jarvis-migration-test-{}", std::process::id()));
        let conn = Connection::open(&path).expect("open");
        let version = ensure_migration_framework(&conn).expect("framework");
        assert_eq!(version, 0);
        let _ = std::fs::remove_file(path);
    }
}
