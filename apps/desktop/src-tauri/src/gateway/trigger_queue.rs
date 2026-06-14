use rusqlite::{params, Connection, OptionalExtension};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TriggerEvent {
    pub id: String,
    pub kind: String,
    pub payload: String,
    pub status: String,
    pub created_at: String,
}

pub fn ensure_trigger_table(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS trigger_events (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            payload TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ",
    )
    .map_err(|error| error.to_string())
}

pub fn enqueue_trigger(conn: &Connection, kind: &str, payload: &str) -> Result<TriggerEvent, String> {
    ensure_trigger_table(conn)?;
    let id = format!("trigger-{}-{}", kind, uuid_like());
    conn.execute(
        "INSERT INTO trigger_events (id, kind, payload, status) VALUES (?1, ?2, ?3, 'pending')",
        params![id, kind, payload],
    )
    .map_err(|error| error.to_string())?;
    Ok(TriggerEvent {
        id,
        kind: kind.to_string(),
        payload: payload.to_string(),
        status: "pending".to_string(),
        created_at: iso_timestamp(),
    })
}

pub fn claim_next_trigger(conn: &Connection) -> Result<Option<TriggerEvent>, String> {
    ensure_trigger_table(conn)?;
    let row = conn
        .query_row(
            "SELECT id, kind, payload, status, created_at FROM trigger_events WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1",
            [],
            |row| {
                Ok(TriggerEvent {
                    id: row.get(0)?,
                    kind: row.get(1)?,
                    payload: row.get(2)?,
                    status: row.get(3)?,
                    created_at: row.get(4)?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if let Some(event) = &row {
        conn.execute(
            "UPDATE trigger_events SET status = 'running' WHERE id = ?1",
            params![event.id],
        )
        .map_err(|error| error.to_string())?;
    }

    Ok(row)
}

pub fn complete_trigger(conn: &Connection, id: &str, success: bool) -> Result<(), String> {
    let status = if success { "done" } else { "failed" };
    conn.execute(
        "UPDATE trigger_events SET status = ?1 WHERE id = ?2",
        params![status, id],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn list_trigger_events(conn: &Connection, limit: usize) -> Result<Vec<TriggerEvent>, String> {
    ensure_trigger_table(conn)?;
    let limit = limit.max(1).min(100) as i64;
    let mut stmt = conn
        .prepare(
            "SELECT id, kind, payload, status, created_at FROM trigger_events ORDER BY created_at DESC LIMIT ?1",
        )
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map([limit], |row| {
            Ok(TriggerEvent {
                id: row.get(0)?,
                kind: row.get(1)?,
                payload: row.get(2)?,
                status: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

pub fn count_pending_triggers(conn: &Connection) -> Result<u32, String> {
    ensure_trigger_table(conn)?;
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM trigger_events WHERE status = 'pending'",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    Ok(count.max(0) as u32)
}

fn uuid_like() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0)
        .to_string()
}

fn iso_timestamp() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn enqueue_and_claim_trigger() {
        let conn = Connection::open_in_memory().expect("memory db");
        enqueue_trigger(&conn, "ocr_watch", r#"{"watchId":"w1"}"#).expect("enqueue");
        let claimed = claim_next_trigger(&conn).expect("claim").expect("event");
        assert_eq!(claimed.kind, "ocr_watch");
        complete_trigger(&conn, &claimed.id, true).expect("complete");
    }
}
