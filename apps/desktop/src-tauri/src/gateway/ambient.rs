use std::path::Path;

use rusqlite::{params, Connection};

use super::config::GatewayConfig;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AmbientSessionRecord {
    pub id: String,
    pub profile_id: String,
    pub desktop_project_id: Option<String>,
    pub ocr_watch_id: Option<String>,
    pub consent_given: bool,
    pub started_at: String,
    pub ended_at: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AmbientSuggestionRecord {
    pub id: String,
    pub session_id: String,
    pub message: String,
    pub status: String,
    pub created_at: String,
}

fn open_conn(db_path: &Path) -> Result<Connection, String> {
    crate::migrations::apply_pending_migrations(
        &Connection::open(db_path).map_err(|error| error.to_string())?,
        db_path,
    )?;
    Connection::open(db_path).map_err(|error| error.to_string())
}

pub fn start_ambient_session(
    db_path: &Path,
    desktop_project_id: Option<&str>,
    ocr_watch_id: Option<&str>,
    consent_given: bool,
) -> Result<AmbientSessionRecord, String> {
    let conn = open_conn(db_path)?;
    let profile_id = crate::gateway::profiles::active_profile_id_or_default(db_path)?;
    let id = format!("ambient-{}", chrono::Utc::now().timestamp_millis());
    let started_at = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO ambient_sessions (id, profile_id, desktop_project_id, ocr_watch_id, consent_given, started_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            id,
            profile_id,
            desktop_project_id,
            ocr_watch_id,
            if consent_given { 1 } else { 0 },
            started_at,
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(AmbientSessionRecord {
        id,
        profile_id,
        desktop_project_id: desktop_project_id.map(str::to_string),
        ocr_watch_id: ocr_watch_id.map(str::to_string),
        consent_given,
        started_at,
        ended_at: None,
    })
}

pub fn end_ambient_session(db_path: &Path, session_id: &str) -> Result<(), String> {
    let conn = open_conn(db_path)?;
    conn.execute(
        "UPDATE ambient_sessions SET ended_at = ?1 WHERE id = ?2",
        params![chrono::Utc::now().to_rfc3339(), session_id],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn active_ambient_session(db_path: &Path) -> Result<Option<AmbientSessionRecord>, String> {
    let conn = open_conn(db_path)?;
    let profile_id = crate::gateway::profiles::active_profile_id_or_default(db_path)?;
    let mut statement = conn
        .prepare(
            "SELECT id, profile_id, desktop_project_id, ocr_watch_id, consent_given, started_at, ended_at
             FROM ambient_sessions
             WHERE profile_id = ?1 AND ended_at IS NULL
             ORDER BY started_at DESC LIMIT 1",
        )
        .map_err(|error| error.to_string())?;
    let mut rows = statement
        .query_map([profile_id], |row| {
            Ok(AmbientSessionRecord {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                desktop_project_id: row.get(2)?,
                ocr_watch_id: row.get(3)?,
                consent_given: row.get::<_, i64>(4)? != 0,
                started_at: row.get(5)?,
                ended_at: row.get(6)?,
            })
        })
        .map_err(|error| error.to_string())?;
    Ok(rows.next().transpose().map_err(|error| error.to_string())?)
}

pub fn record_ambient_suggestion(
    db_path: &Path,
    session_id: &str,
    message: &str,
) -> Result<AmbientSuggestionRecord, String> {
    let conn = open_conn(db_path)?;
    let id = format!(
        "ambient-suggestion-{}",
        chrono::Utc::now().timestamp_millis()
    );
    let created_at = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO ambient_suggestion_log (id, session_id, message, status, created_at)
         VALUES (?1, ?2, ?3, 'shown', ?4)",
        params![id, session_id, message, created_at],
    )
    .map_err(|error| error.to_string())?;
    Ok(AmbientSuggestionRecord {
        id,
        session_id: session_id.to_string(),
        message: message.to_string(),
        status: "shown".to_string(),
        created_at,
    })
}

pub fn list_ambient_suggestions(
    db_path: &Path,
    limit: usize,
) -> Result<Vec<AmbientSuggestionRecord>, String> {
    let conn = open_conn(db_path)?;
    let profile_id = crate::gateway::profiles::active_profile_id_or_default(db_path)?;
    let mut statement = conn
        .prepare(
            "SELECT id, session_id, message, status, created_at
             FROM ambient_suggestion_log
             WHERE status = 'shown'
               AND session_id IN (
                   SELECT id FROM ambient_sessions WHERE profile_id = ?1
               )
             ORDER BY created_at DESC LIMIT ?2",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![profile_id, limit as i64], |row| {
            Ok(AmbientSuggestionRecord {
                id: row.get(0)?,
                session_id: row.get(1)?,
                message: row.get(2)?,
                status: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

pub fn dismiss_ambient_suggestion(db_path: &Path, id: &str) -> Result<(), String> {
    let conn = open_conn(db_path)?;
    conn.execute(
        "UPDATE ambient_suggestion_log SET status = 'dismissed' WHERE id = ?1",
        [id],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn maybe_suggest_from_signal(
    db_path: &Path,
    config: &GatewayConfig,
    signal: &str,
) -> Result<Option<AmbientSuggestionRecord>, String> {
    if !config.labs.ambient_copilot {
        return Ok(None);
    }
    let Some(session) = active_ambient_session(db_path)? else {
        return Ok(None);
    };
    if !session.consent_given {
        return Ok(None);
    }
    let trimmed = signal.trim();
    if trimmed.len() < 8 {
        return Ok(None);
    }
    let message = format!(
        "Ambient copilot noticed: \"{}\". Review before acting — no auto-writes.",
        trimmed.chars().take(120).collect::<String>()
    );
    record_ambient_suggestion(db_path, &session.id, &message).map(Some)
}

pub fn is_ambient_command(command: &str) -> bool {
    let normalized = command.trim().to_lowercase();
    normalized.contains("ambient copilot")
        || normalized.contains("start ambient session")
        || normalized.contains("end ambient session")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gateway::config::GatewayConfig;
    use crate::gateway::profiles::{seed_default_profiles, switch_profile};

    #[test]
    fn ambient_suggestion_requires_active_consented_session() {
        let path = std::env::temp_dir().join(format!("jarvis-ambient-{}", std::process::id()));
        let app_data =
            std::env::temp_dir().join(format!("jarvis-ambient-app-{}", std::process::id()));
        std::fs::create_dir_all(&app_data).expect("app data");
        seed_default_profiles(&path, &app_data).expect("seed");
        let mut config = GatewayConfig::default();
        config.labs.ambient_copilot = true;
        start_ambient_session(&path, Some("focus"), None, true).expect("session");
        let suggestion = maybe_suggest_from_signal(&path, &config, "invoice due tomorrow")
            .expect("suggest")
            .expect("some");
        assert!(suggestion.message.contains("Ambient copilot"));
        let _ = std::fs::remove_file(path);
        let _ = std::fs::remove_dir_all(app_data);
    }

    #[test]
    fn ambient_sessions_and_suggestions_are_scoped_to_active_profile() {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let path = std::env::temp_dir().join(format!("jarvis-ambient-scope-{nanos}.db"));
        let app_data = std::env::temp_dir().join(format!("jarvis-ambient-scope-app-{nanos}"));
        std::fs::create_dir_all(&app_data).expect("app data");
        seed_default_profiles(&path, &app_data).expect("seed");

        let mut config = GatewayConfig::default();
        config.labs.ambient_copilot = true;

        let work_session =
            start_ambient_session(&path, Some("work-focus"), None, true).expect("work session");
        let work_suggestion =
            maybe_suggest_from_signal(&path, &config, "work invoice due tomorrow")
                .expect("suggest")
                .expect("work suggestion");
        assert_eq!(
            active_ambient_session(&path)
                .expect("active work")
                .expect("session")
                .id,
            work_session.id
        );

        switch_profile(&path, &app_data, "personal").expect("switch");
        assert!(active_ambient_session(&path)
            .expect("active personal")
            .is_none());
        let personal_session = start_ambient_session(&path, Some("personal-focus"), None, true)
            .expect("personal session");
        let personal_suggestion =
            maybe_suggest_from_signal(&path, &config, "personal dinner reservation")
                .expect("suggest")
                .expect("personal suggestion");
        let personal_suggestions = list_ambient_suggestions(&path, 10).expect("list personal");
        assert_eq!(personal_suggestions.len(), 1);
        assert_eq!(personal_suggestions[0].id, personal_suggestion.id);
        assert_eq!(
            active_ambient_session(&path)
                .expect("active personal after")
                .expect("session")
                .id,
            personal_session.id
        );

        switch_profile(&path, &app_data, "work").expect("switch back");
        let work_suggestions = list_ambient_suggestions(&path, 10).expect("list work");
        assert_eq!(work_suggestions.len(), 1);
        assert_eq!(work_suggestions[0].id, work_suggestion.id);
        assert_eq!(
            active_ambient_session(&path)
                .expect("active work again")
                .expect("session")
                .id,
            work_session.id
        );

        let _ = std::fs::remove_file(path);
        let _ = std::fs::remove_dir_all(app_data);
    }
}
