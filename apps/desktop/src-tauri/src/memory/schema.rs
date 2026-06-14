use std::path::Path;

use rusqlite::Connection;

pub const MEMORY_SCHEMA_VERSION: i64 = 1;

pub fn migrate(path: &Path) -> Result<(), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .execute_batch(
            "
            CREATE TABLE IF NOT EXISTS memory_entities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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
                domain TEXT NOT NULL,
                source TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS memory_chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            CREATE INDEX IF NOT EXISTS idx_memory_facts_entity_predicate
                ON memory_facts(entity_id, predicate);

            CREATE TABLE IF NOT EXISTS app_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
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
