use std::path::Path;

use rusqlite::OptionalExtension;

use crate::gateway::config::GatewayConfig;
use crate::gateway::trigger_queue::enqueue_trigger;
use crate::integrations::google;

const FINGERPRINT_KEY: &str = "calendar_replan_fingerprint";

fn read_fingerprint(db_path: &Path) -> Result<Option<String>, String> {
    let conn = rusqlite::Connection::open(db_path).map_err(|error| error.to_string())?;
    conn.query_row(
        "SELECT value FROM app_meta WHERE key = ?1",
        [FINGERPRINT_KEY],
        |row| row.get(0),
    )
    .optional()
    .map_err(|error| error.to_string())
}

fn write_fingerprint(db_path: &Path, value: &str) -> Result<(), String> {
    let conn = rusqlite::Connection::open(db_path).map_err(|error| error.to_string())?;
    conn.execute(
        "INSERT INTO app_meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![FINGERPRINT_KEY, value],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn calendar_fingerprint(token: &str) -> Result<String, String> {
    let events = google::calendar::list_today(token)?;
    let parts = events
        .iter()
        .map(|event| {
            format!(
                "{}@{}",
                event.summary,
                event.start.as_deref().unwrap_or("")
            )
        })
        .collect::<Vec<_>>();
    Ok(parts.join("|"))
}

/// When enabled, enqueue a replan trigger if today's calendar snapshot changed.
pub fn maybe_enqueue_replan_on_calendar_change(
    db_path: &Path,
    config: &GatewayConfig,
) -> Result<(), String> {
    if !config.enabled
        || !config.proactive.planner_copilot_enabled
        || !config.proactive.day_replan_on_calendar_change
        || !config.features.calendar
    {
        return Ok(());
    }

    let token = match google::get_session_token("calendar") {
        Ok(token) => token,
        Err(_) => return Ok(()),
    };

    let fingerprint = calendar_fingerprint(&token)?;
    let previous = read_fingerprint(db_path)?;

    if let Some(prev) = previous.as_deref() {
        if prev != fingerprint {
            let conn = rusqlite::Connection::open(db_path).map_err(|error| error.to_string())?;
            enqueue_trigger(&conn, "replan_day", "{}")?;
        }
    }

    write_fingerprint(db_path, &fingerprint)?;
    Ok(())
}
