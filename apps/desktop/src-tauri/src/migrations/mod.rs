use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{Connection, OptionalExtension};

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
    Ok(raw.and_then(|value| value.parse::<i64>().ok()).unwrap_or(0))
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

fn table_exists(conn: &Connection, table: &str) -> Result<bool, String> {
    conn.query_row(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1",
        [table],
        |_| Ok(()),
    )
    .optional()
    .map(|value| value.is_some())
    .map_err(|error| error.to_string())
}

fn column_exists(conn: &Connection, table: &str, column: &str) -> Result<bool, String> {
    let mut statement = conn
        .prepare(&format!("PRAGMA table_info({table})"))
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| error.to_string())?;
    for value in rows {
        if value.map_err(|error| error.to_string())? == column {
            return Ok(true);
        }
    }
    Ok(false)
}

fn current_profile_partition_id(conn: &Connection) -> String {
    conn.query_row(
        "SELECT value FROM app_meta WHERE key = 'active_profile_id'",
        [],
        |row| row.get::<_, String>(0),
    )
    .optional()
    .ok()
    .flatten()
    .filter(|value| !value.trim().is_empty())
    .unwrap_or_else(|| "work".to_string())
}

fn apply_profile_partition_migration(conn: &Connection) -> Result<(), String> {
    let profile_id = current_profile_partition_id(conn);

    if table_exists(conn, "memory_relations")? {
        if !column_exists(conn, "memory_relations", "profile_id")? {
            conn.execute(
                "ALTER TABLE memory_relations ADD COLUMN profile_id TEXT",
                [],
            )
            .map_err(|error| error.to_string())?;
        }
        conn.execute(
            "UPDATE memory_relations SET profile_id = ?1 WHERE profile_id IS NULL OR trim(profile_id) = ''",
            [&profile_id],
        )
        .map_err(|error| error.to_string())?;
        conn.execute_batch(
            "
            CREATE INDEX IF NOT EXISTS idx_memory_relations_profile_subject
                ON memory_relations(profile_id, subject_entity_id, predicate);
            CREATE INDEX IF NOT EXISTS idx_memory_relations_profile_object
                ON memory_relations(profile_id, object_entity_id);
            ",
        )
        .map_err(|error| error.to_string())?;
    }

    if table_exists(conn, "user_goals")? {
        if !column_exists(conn, "user_goals", "profile_id")? {
            conn.execute("ALTER TABLE user_goals ADD COLUMN profile_id TEXT", [])
                .map_err(|error| error.to_string())?;
        }
        conn.execute(
            "UPDATE user_goals SET profile_id = ?1 WHERE profile_id IS NULL OR trim(profile_id) = ''",
            [&profile_id],
        )
        .map_err(|error| error.to_string())?;
        conn.execute_batch(
            "
            CREATE INDEX IF NOT EXISTS idx_user_goals_profile_updated
                ON user_goals(profile_id, updated_at);
            ",
        )
        .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn apply_ambient_profile_partition_migration(conn: &Connection) -> Result<(), String> {
    let profile_id = current_profile_partition_id(conn);

    if table_exists(conn, "ambient_sessions")? {
        if !column_exists(conn, "ambient_sessions", "profile_id")? {
            conn.execute(
                "ALTER TABLE ambient_sessions ADD COLUMN profile_id TEXT",
                [],
            )
            .map_err(|error| error.to_string())?;
        }
        conn.execute(
            "UPDATE ambient_sessions SET profile_id = ?1 WHERE profile_id IS NULL OR trim(profile_id) = ''",
            [&profile_id],
        )
        .map_err(|error| error.to_string())?;
        conn.execute_batch(
            "
            CREATE INDEX IF NOT EXISTS idx_ambient_sessions_profile_started
                ON ambient_sessions(profile_id, started_at DESC);
            ",
        )
        .map_err(|error| error.to_string())?;
    }

    Ok(())
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

    const MIGRATION_V2: &str = "
        CREATE TABLE IF NOT EXISTS day_plans (
            plan_date TEXT PRIMARY KEY,
            top_three_json TEXT NOT NULL,
            full_plan_text TEXT NOT NULL,
            notion_page_id TEXT,
            suggested_actions_json TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    ";

    const MIGRATION_V3: &str = "
        CREATE TABLE IF NOT EXISTS trigger_recipes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            kind TEXT NOT NULL,
            schedule_value TEXT,
            payload_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    ";

    const MIGRATION_V4: &str = "
        CREATE TABLE IF NOT EXISTS memory_relations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject_entity_id INTEGER NOT NULL,
            predicate TEXT NOT NULL,
            object_entity_id INTEGER NOT NULL,
            confidence REAL NOT NULL DEFAULT 1.0,
            source TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_memory_relations_subject
            ON memory_relations(subject_entity_id, predicate);
        CREATE INDEX IF NOT EXISTS idx_memory_relations_object
            ON memory_relations(object_entity_id);

        CREATE TABLE IF NOT EXISTS proactive_nudge_log (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            message TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'shown',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    ";

    const MIGRATION_V5: &str = "
        CREATE TABLE IF NOT EXISTS user_goals (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'active',
            target_date TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    ";

    const MIGRATION_V6: &str = "
        CREATE TABLE IF NOT EXISTS user_profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            kind TEXT NOT NULL,
            gateway_json TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    ";

    const MIGRATION_V7: &str = "
        CREATE TABLE IF NOT EXISTS ambient_sessions (
            id TEXT PRIMARY KEY,
            desktop_project_id TEXT,
            ocr_watch_id TEXT,
            consent_given INTEGER NOT NULL DEFAULT 0,
            started_at TEXT NOT NULL,
            ended_at TEXT
        );
        CREATE TABLE IF NOT EXISTS ambient_suggestion_log (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            message TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'shown',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    ";

    let migrations: &[(&str, i64)] = &[
        (MIGRATION_V1, 1),
        (MIGRATION_V2, 2),
        (MIGRATION_V3, 3),
        (MIGRATION_V4, 4),
        (MIGRATION_V5, 5),
        (MIGRATION_V6, 6),
        (MIGRATION_V7, 7),
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

    if version < 8 {
        let _backup = backup_database(db_path)?;
        apply_profile_partition_migration(conn)?;
        conn.execute(
            "UPDATE app_meta SET value = ?1 WHERE key = ?2",
            rusqlite::params!["8", SCHEMA_VERSION_KEY],
        )
        .map_err(|error| error.to_string())?;
        version = 8;
    }

    if version < 9 {
        let _backup = backup_database(db_path)?;
        apply_ambient_profile_partition_migration(conn)?;
        conn.execute(
            "UPDATE app_meta SET value = ?1 WHERE key = ?2",
            rusqlite::params!["9", SCHEMA_VERSION_KEY],
        )
        .map_err(|error| error.to_string())?;
        version = 9;
    }

    Ok(version)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn applies_migration_v1() {
        let path = std::env::temp_dir().join(format!("jarvis-migration-v1-{}", std::process::id()));
        let conn = Connection::open(&path).expect("open");
        let version = apply_pending_migrations(&conn, &path).expect("migrate");
        assert_eq!(version, 9);
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
        let path =
            std::env::temp_dir().join(format!("jarvis-migration-test-{}", std::process::id()));
        let conn = Connection::open(&path).expect("open");
        let version = ensure_migration_framework(&conn).expect("framework");
        assert_eq!(version, 0);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn applies_profile_partition_migration_v8() {
        let path = std::env::temp_dir().join(format!("jarvis-migration-v8-{}", std::process::id()));
        let conn = Connection::open(&path).expect("open");
        conn.execute_batch(
            "
            CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            INSERT INTO app_meta (key, value) VALUES ('schema_version', '7');
            INSERT INTO app_meta (key, value) VALUES ('active_profile_id', 'personal');
            CREATE TABLE memory_relations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subject_entity_id INTEGER NOT NULL,
                predicate TEXT NOT NULL,
                object_entity_id INTEGER NOT NULL,
                confidence REAL NOT NULL DEFAULT 1.0,
                source TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO memory_relations (subject_entity_id, predicate, object_entity_id, confidence, source)
            VALUES (1, 'related_to', 2, 1.0, 'test');
            CREATE TABLE user_goals (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'active',
                target_date TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO user_goals (id, title, description, status, created_at, updated_at)
            VALUES ('goal-1', 'Goal', '', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
            ",
        )
        .expect("seed");

        let version = apply_pending_migrations(&conn, &path).expect("migrate");
        assert_eq!(version, 9);
        let relation_profile: String = conn
            .query_row(
                "SELECT profile_id FROM memory_relations LIMIT 1",
                [],
                |row| row.get(0),
            )
            .expect("relation profile");
        let goal_profile: String = conn
            .query_row("SELECT profile_id FROM user_goals LIMIT 1", [], |row| {
                row.get(0)
            })
            .expect("goal profile");
        assert_eq!(relation_profile, "personal");
        assert_eq!(goal_profile, "personal");
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn applies_ambient_profile_partition_migration_v9() {
        let path = std::env::temp_dir().join(format!("jarvis-migration-v9-{}", std::process::id()));
        let conn = Connection::open(&path).expect("open");
        conn.execute_batch(
            "
            CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            INSERT INTO app_meta (key, value) VALUES ('schema_version', '8');
            INSERT INTO app_meta (key, value) VALUES ('active_profile_id', 'personal');
            CREATE TABLE ambient_sessions (
                id TEXT PRIMARY KEY,
                desktop_project_id TEXT,
                ocr_watch_id TEXT,
                consent_given INTEGER NOT NULL DEFAULT 0,
                started_at TEXT NOT NULL,
                ended_at TEXT
            );
            INSERT INTO ambient_sessions (id, desktop_project_id, ocr_watch_id, consent_given, started_at)
            VALUES ('ambient-1', 'focus', NULL, 1, CURRENT_TIMESTAMP);
            ",
        )
        .expect("seed");

        let version = apply_pending_migrations(&conn, &path).expect("migrate");
        assert_eq!(version, 9);
        let session_profile: String = conn
            .query_row(
                "SELECT profile_id FROM ambient_sessions WHERE id = 'ambient-1'",
                [],
                |row| row.get(0),
            )
            .expect("session profile");
        assert_eq!(session_profile, "personal");
        let _ = std::fs::remove_file(path);
    }
}
