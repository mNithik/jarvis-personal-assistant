use std::path::Path;

use rusqlite::{params, Connection};

use crate::gateway::config::GatewayConfig;
use crate::gateway::trigger_queue::enqueue_trigger;
use crate::integrations::google;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProactiveNudgeRecord {
    pub id: String,
    pub kind: String,
    pub message: String,
    pub status: String,
    pub created_at: String,
}

pub fn maybe_enqueue_anomaly_nudges(
    db_path: &Path,
    config: &GatewayConfig,
) -> Result<Vec<String>, String> {
    if !config.enabled || !config.labs.proactive_anomaly {
        return Ok(Vec::new());
    }

    let mut nudges = Vec::new();

    if config.features.calendar {
        if let Ok(token) = google::get_session_token("calendar") {
            if let Ok(events) = google::calendar::list_today(&token) {
                let meeting_minutes = events.len() as i64 * 30;
                if meeting_minutes >= 360 {
                    nudges.push(
                        "Calendar overload: more than 6 hours of meetings today. Consider blocking focus time."
                            .to_string(),
                    );
                }
            }
        }
    }

    if config.features.gmail {
        if let Ok(token) = google::get_session_token("gmail") {
            if let Ok(emails) = google::gmail::list_unread(&token, 20) {
                let urgent = emails
                    .iter()
                    .filter(|email| google::gmail::is_urgent_email(email))
                    .count();
                if urgent >= 3 {
                    nudges.push(format!(
                        "Inbox spike: {urgent} urgent unread emails. Consider triage before deep work."
                    ));
                }
            }
        }
    }

    if config.features.notion {
        if let Ok(tasks) = crate::integrations::notion::list_planner_tasks(db_path) {
            let today = chrono::Local::now().date_naive();
            let overdue = tasks
                .iter()
                .filter(|task| {
                    task.due.as_deref().and_then(|due| {
                        chrono::NaiveDate::parse_from_str(&due[..10.min(due.len())], "%Y-%m-%d").ok()
                    }).is_some_and(|due| due < today && !task.is_done)
                })
                .count();
            if overdue >= 3 {
                nudges.push(format!(
                    "Deadline drift: {overdue} overdue Notion tasks. Replan or reschedule."
                ));
            }
        }
    }

    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    for message in &nudges {
        let id = format!("nudge-{}", chrono::Utc::now().timestamp_millis());
        conn.execute(
            "INSERT INTO proactive_nudge_log (id, kind, message, status) VALUES (?1, 'anomaly', ?2, 'shown')",
            params![id, message],
        )
        .map_err(|error| error.to_string())?;
        let payload = serde_json::json!({ "command": message, "nudgeId": id }).to_string();
        enqueue_trigger(&conn, "channel_turn", &payload)?;
    }
    Ok(nudges)
}

pub fn list_recent_nudges(db_path: &Path, limit: usize) -> Result<Vec<ProactiveNudgeRecord>, String> {
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    let mut statement = conn
        .prepare(
            "SELECT id, kind, message, status, created_at
             FROM proactive_nudge_log ORDER BY created_at DESC LIMIT ?1",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([limit as i64], |row| {
            Ok(ProactiveNudgeRecord {
                id: row.get(0)?,
                kind: row.get(1)?,
                message: row.get(2)?,
                status: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

pub fn dismiss_nudge(db_path: &Path, id: &str) -> Result<(), String> {
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    conn.execute(
        "UPDATE proactive_nudge_log SET status = 'dismissed' WHERE id = ?1",
        [id],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn accept_nudge(db_path: &Path, id: &str) -> Result<(), String> {
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    conn.execute(
        "UPDATE proactive_nudge_log SET status = 'accepted' WHERE id = ?1",
        [id],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}
