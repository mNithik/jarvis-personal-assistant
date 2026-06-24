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
        .map(|event| format!("{}@{}", event.summary, event.start.as_deref().unwrap_or("")))
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
    maybe_enqueue_meeting_followup_bundle(db_path, config, &token)?;
    Ok(())
}

const FOLLOWUP_ENQUEUED_PREFIX: &str = "meeting_followup_enqueued_";

fn followup_already_enqueued(db_path: &Path, event_id: &str) -> Result<bool, String> {
    let key = format!("{FOLLOWUP_ENQUEUED_PREFIX}{event_id}");
    let conn = rusqlite::Connection::open(db_path).map_err(|error| error.to_string())?;
    let value: Option<String> = conn
        .query_row("SELECT value FROM app_meta WHERE key = ?1", [&key], |row| {
            row.get(0)
        })
        .optional()
        .map_err(|error| error.to_string())?;
    Ok(value.is_some())
}

fn mark_followup_enqueued(db_path: &Path, event_id: &str) -> Result<(), String> {
    let key = format!("{FOLLOWUP_ENQUEUED_PREFIX}{event_id}");
    let conn = rusqlite::Connection::open(db_path).map_err(|error| error.to_string())?;
    conn.execute(
        "INSERT INTO app_meta (key, value) VALUES (?1, '1')
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![key],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

/// Enqueue a project bundle when a calendar event ended recently (debounced per event).
pub fn maybe_enqueue_meeting_followup_bundle(
    db_path: &Path,
    config: &GatewayConfig,
    token: &str,
) -> Result<(), String> {
    if !config.enabled || !config.labs.project_bundle_pilot || !config.features.calendar {
        return Ok(());
    }

    let now = chrono::Local::now();
    let events = google::calendar::list_today(token)?;
    for event in events {
        let Some(end_raw) = event.end.as_deref() else {
            continue;
        };
        let Some(end) = chrono::DateTime::parse_from_rfc3339(end_raw)
            .ok()
            .map(|value| value.with_timezone(&chrono::Local))
        else {
            continue;
        };
        if end > now || now.signed_duration_since(end).num_minutes() > 20 {
            continue;
        }
        if followup_already_enqueued(db_path, &event.id)? {
            continue;
        }
        let conn = rusqlite::Connection::open(db_path).map_err(|error| error.to_string())?;
        let payload = serde_json::json!({
            "command": format!("run meeting follow-up bundle for {}", event.summary),
            "eventId": event.id,
        })
        .to_string();
        enqueue_trigger(&conn, "meeting_followup_bundle", &payload)?;
        mark_followup_enqueued(db_path, &event.id)?;
    }
    Ok(())
}
