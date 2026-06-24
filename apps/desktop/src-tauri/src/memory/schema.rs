use std::path::Path;

use rusqlite::{Connection, OptionalExtension};

pub const MEMORY_SCHEMA_VERSION: i64 = 3;

fn active_profile_partition_id(connection: &Connection) -> String {
    connection
        .query_row(
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

fn column_exists(connection: &Connection, table: &str, column: &str) -> Result<bool, String> {
    let mut statement = connection
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

pub fn migrate(path: &Path) -> Result<(), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .execute_batch(
            "
            CREATE TABLE IF NOT EXISTS memory_entities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id TEXT NOT NULL DEFAULT 'work',
                domain TEXT NOT NULL,
                label TEXT NOT NULL,
                metadata_json TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS memory_facts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_id INTEGER NOT NULL,
                predicate TEXT NOT NULL,
                object_value TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (entity_id) REFERENCES memory_entities(id)
            );

            CREATE TABLE IF NOT EXISTS memory_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id TEXT NOT NULL DEFAULT 'work',
                domain TEXT NOT NULL,
                source TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS memory_chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id TEXT NOT NULL DEFAULT 'work',
                document_id INTEGER NOT NULL,
                entity_id INTEGER,
                domain TEXT NOT NULL,
                chunk_text TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (document_id) REFERENCES memory_documents(id),
                FOREIGN KEY (entity_id) REFERENCES memory_entities(id)
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS memory_chunks_fts USING fts5(
                chunk_text,
                domain UNINDEXED,
                tokenize='unicode61'
            );

            CREATE TABLE IF NOT EXISTS memory_embeddings (
                chunk_id INTEGER PRIMARY KEY,
                dimensions INTEGER NOT NULL,
                embedding BLOB NOT NULL,
                FOREIGN KEY (chunk_id) REFERENCES memory_chunks(id)
            );

            CREATE INDEX IF NOT EXISTS idx_memory_entities_domain_label
                ON memory_entities(domain, label);
            CREATE INDEX IF NOT EXISTS idx_memory_entities_profile_domain_label
                ON memory_entities(profile_id, domain, label);
            CREATE INDEX IF NOT EXISTS idx_memory_documents_profile_domain
                ON memory_documents(profile_id, domain, created_at);
            CREATE INDEX IF NOT EXISTS idx_memory_chunks_profile_domain
                ON memory_chunks(profile_id, domain, id DESC);
            CREATE INDEX IF NOT EXISTS idx_memory_facts_entity_predicate
                ON memory_facts(entity_id, predicate);

            CREATE TABLE IF NOT EXISTS app_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            ",
        )
        .map_err(|error| error.to_string())?;

    if !column_exists(&connection, "memory_entities", "profile_id")? {
        connection
            .execute("ALTER TABLE memory_entities ADD COLUMN profile_id TEXT", [])
            .map_err(|error| error.to_string())?;
    }
    connection
        .execute(
            "UPDATE memory_entities SET profile_id = ?1 WHERE profile_id IS NULL OR trim(profile_id) = ''",
            [active_profile_partition_id(&connection)],
        )
        .map_err(|error| error.to_string())?;
    if !column_exists(&connection, "memory_documents", "profile_id")? {
        connection
            .execute(
                "ALTER TABLE memory_documents ADD COLUMN profile_id TEXT",
                [],
            )
            .map_err(|error| error.to_string())?;
    }
    connection
        .execute(
            "UPDATE memory_documents SET profile_id = ?1 WHERE profile_id IS NULL OR trim(profile_id) = ''",
            [active_profile_partition_id(&connection)],
        )
        .map_err(|error| error.to_string())?;
    if !column_exists(&connection, "memory_chunks", "profile_id")? {
        connection
            .execute("ALTER TABLE memory_chunks ADD COLUMN profile_id TEXT", [])
            .map_err(|error| error.to_string())?;
    }
    connection
        .execute(
            "UPDATE memory_chunks SET profile_id = ?1 WHERE profile_id IS NULL OR trim(profile_id) = ''",
            [active_profile_partition_id(&connection)],
        )
        .map_err(|error| error.to_string())?;
    connection
        .execute_batch(
            "
            CREATE INDEX IF NOT EXISTS idx_memory_entities_profile_domain_label
                ON memory_entities(profile_id, domain, label);
            CREATE INDEX IF NOT EXISTS idx_memory_documents_profile_domain
                ON memory_documents(profile_id, domain, created_at);
            CREATE INDEX IF NOT EXISTS idx_memory_chunks_profile_domain
                ON memory_chunks(profile_id, domain, id DESC);
            ",
        )
        .map_err(|error| error.to_string())?;

    connection
        .execute(
            "INSERT INTO app_metadata (key, value) VALUES ('memory_schema_version', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            rusqlite::params![MEMORY_SCHEMA_VERSION.to_string()],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}
