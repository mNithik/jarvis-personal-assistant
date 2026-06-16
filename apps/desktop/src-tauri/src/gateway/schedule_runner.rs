use std::path::Path;

use rusqlite::Connection;

use crate::db::automation_store::list_desktop_schedules;
use crate::gateway::trigger_queue::enqueue_trigger;

/// Evaluate due desktop schedules and enqueue channel_turn triggers.
pub fn enqueue_due_schedules(db_path: &Path) -> Result<usize, String> {
    let schedules = list_desktop_schedules(db_path)?;
    if schedules.is_empty() {
        return Ok(0);
    }

    let now = chrono::Local::now();
    let current_minute = now.format("%H:%M").to_string();
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    let mut enqueued = 0usize;

    for schedule in schedules {
        if schedule.due_at.trim().is_empty() {
            continue;
        }
        let due_minute = chrono::DateTime::parse_from_rfc3339(&schedule.due_at)
            .map(|value| value.format("%H:%M").to_string())
            .unwrap_or_else(|_| schedule.due_at.chars().take(5).collect());
        if due_minute != current_minute {
            continue;
        }

        let payload = serde_json::json!({
            "channel": "schedule",
            "command": schedule.action_label,
            "sessionId": format!("schedule-{}", schedule.id),
        })
        .to_string();
        enqueue_trigger(&conn, "channel_turn", &payload)?;
        enqueued += 1;
    }

    Ok(enqueued)
}
