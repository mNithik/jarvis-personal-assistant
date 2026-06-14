use std::collections::HashMap;
use std::path::Path;

use rusqlite::{params, Connection};

use super::embed::{blob_to_embedding, cosine_similarity, embed_text, embedding_to_blob};

#[derive(Debug, Clone)]
pub struct RecallHit {
    pub chunk_id: i64,
    pub text: String,
    pub domain: String,
    pub score: f32,
}

pub fn recall(path: &Path, query: &str, limit: usize) -> Result<Vec<RecallHit>, String> {
    let mut ranked: HashMap<i64, RecallHit> = HashMap::new();

    for (rank, hit) in fts_search(path, query, limit * 2)?.into_iter().enumerate() {
        let score = 1.0 / (60.0 + rank as f32);
        merge_hit(&mut ranked, hit, score);
    }

    if let Ok(query_vector) = embed_text(path, query) {
        for (rank, hit) in vector_search(path, &query_vector, limit * 2)?
            .into_iter()
            .enumerate()
        {
            let score = 1.0 / (60.0 + rank as f32);
            merge_hit(&mut ranked, hit, score);
        }
    }

    let mut hits: Vec<RecallHit> = ranked.into_values().collect();
    hits.sort_by(|left, right| {
        right
            .score
            .partial_cmp(&left.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    hits.truncate(limit);
    Ok(hits)
}

fn merge_hit(map: &mut HashMap<i64, RecallHit>, hit: RecallHit, score: f32) {
    map.entry(hit.chunk_id)
        .and_modify(|existing| existing.score += score)
        .or_insert(RecallHit {
            chunk_id: hit.chunk_id,
            text: hit.text,
            domain: hit.domain,
            score,
        });
}

fn fts_search(path: &Path, query: &str, limit: usize) -> Result<Vec<RecallHit>, String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    let fts_query = query
        .split_whitespace()
        .map(|token| format!("\"{}\"", token.replace('"', "")))
        .collect::<Vec<_>>()
        .join(" OR ");
    if fts_query.is_empty() {
        return Ok(Vec::new());
    }

    let mut statement = connection
        .prepare(
            "SELECT c.id, c.chunk_text, c.domain
             FROM memory_chunks_fts
             JOIN memory_chunks c ON c.id = memory_chunks_fts.rowid
             WHERE memory_chunks_fts MATCH ?1
             ORDER BY rank
             LIMIT ?2",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map(params![fts_query, limit as i64], |row| {
            Ok(RecallHit {
                chunk_id: row.get(0)?,
                text: row.get(1)?,
                domain: row.get(2)?,
                score: 0.0,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(rows)
}

fn vector_search(path: &Path, query_vector: &[f32], limit: usize) -> Result<Vec<RecallHit>, String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT c.id, c.chunk_text, c.domain, e.embedding
             FROM memory_embeddings e
             JOIN memory_chunks c ON c.id = e.chunk_id
             ORDER BY c.id DESC
             LIMIT 256",
        )
        .map_err(|error| error.to_string())?;

    let mut scored = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Vec<u8>>(3)?,
            ))
        })
        .map_err(|error| error.to_string())?
        .filter_map(|row| row.ok())
        .map(|(chunk_id, text, domain, blob)| {
            let vector = blob_to_embedding(&blob);
            let score = cosine_similarity(query_vector, &vector);
            RecallHit {
                chunk_id,
                text,
                domain,
                score,
            }
        })
        .collect::<Vec<_>>();

    scored.sort_by(|left, right| {
        right
            .score
            .partial_cmp(&left.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    scored.truncate(limit);
    Ok(scored)
}

pub fn store_chunk_with_embedding(
    connection: &Connection,
    db_path: &Path,
    document_id: i64,
    entity_id: Option<i64>,
    domain: &str,
    chunk_text: &str,
) -> Result<i64, String> {
    connection
        .execute(
            "INSERT INTO memory_chunks (document_id, entity_id, domain, chunk_text)
             VALUES (?1, ?2, ?3, ?4)",
            params![document_id, entity_id, domain, chunk_text],
        )
        .map_err(|error| error.to_string())?;
    let chunk_id = connection.last_insert_rowid();
    connection
        .execute(
            "INSERT INTO memory_chunks_fts (rowid, chunk_text, domain) VALUES (?1, ?2, ?3)",
            params![chunk_id, chunk_text, domain],
        )
        .map_err(|error| error.to_string())?;

    if let Ok(vector) = embed_text(db_path, chunk_text) {
        connection
            .execute(
                "INSERT INTO memory_embeddings (chunk_id, dimensions, embedding)
                 VALUES (?1, ?2, ?3)
                 ON CONFLICT(chunk_id) DO UPDATE SET dimensions = excluded.dimensions, embedding = excluded.embedding",
                params![
                    chunk_id,
                    vector.len() as i64,
                    embedding_to_blob(&vector)
                ],
            )
            .map_err(|error| error.to_string())?;
    }

    Ok(chunk_id)
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::*;
    use crate::memory::schema::migrate;

    fn temp_db() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        std::env::temp_dir().join(format!("jarvis-memory-recall-{nanos}.db"))
    }

    #[test]
    fn recall_round_trip_via_fts_and_vector() {
        let path = temp_db();
        migrate(&path).expect("migrate");
        let connection = Connection::open(&path).expect("open");
        connection
            .execute(
                "INSERT INTO memory_documents (domain, source, content) VALUES ('general', 'test', 'Alice likes tea')",
                [],
            )
            .expect("document");
        let document_id = connection.last_insert_rowid();
        store_chunk_with_embedding(
            &connection,
            &path,
            document_id,
            None,
            "general",
            "Alice likes tea in the afternoon",
        )
        .expect("chunk");

        let hits = recall(&path, "Alice tea", 3).expect("recall");
        assert!(!hits.is_empty());
        assert!(hits[0].text.to_lowercase().contains("alice"));

        let _ = std::fs::remove_file(path);
    }
}
