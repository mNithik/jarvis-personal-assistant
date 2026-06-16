use std::path::Path;

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrWatchRecord {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub scope: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub region: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rect: Option<serde_json::Value>,
    #[serde(default = "default_watch_status")]
    pub status: String,
    #[serde(default = "default_interval_ms")]
    pub interval_ms: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub log_to_notion: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub create_task_on_match: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rule: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_match_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_checked_at: Option<String>,
}

fn default_watch_status() -> String {
    "active".to_string()
}

fn default_interval_ms() -> i64 {
    60_000
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopScheduleRecord {
    pub id: String,
    #[serde(default)]
    pub project_name: String,
    #[serde(default)]
    pub action_label: String,
    #[serde(default)]
    pub due_at: String,
    #[serde(default)]
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedWorkflowRecord {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub trigger_phrase: String,
    pub steps: Vec<String>,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub based_on_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalStorageImportPayload {
    #[serde(default)]
    pub ocr_watches: Vec<OcrWatchRecord>,
    #[serde(default)]
    pub desktop_schedules: Vec<DesktopScheduleRecord>,
    #[serde(default)]
    pub saved_workflows: Vec<SavedWorkflowRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalStorageImportResult {
    pub ocr_watches_imported: usize,
    pub desktop_schedules_imported: usize,
    pub saved_workflows_imported: usize,
}

fn open_connection(path: &Path) -> Result<Connection, String> {
    Connection::open(path).map_err(|error| error.to_string())
}

fn row_to_ocr_watch(
    id: String,
    name: Option<String>,
    scope: String,
    region_json: Option<String>,
    app_name: Option<String>,
    interval_ms: i64,
    rule_json: String,
    action: Option<String>,
    paused: i64,
    log_to_notion: i64,
    create_task_on_match: i64,
) -> Result<OcrWatchRecord, String> {
    let region = region_json
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(serde_json::from_str)
        .transpose()
        .map_err(|error| error.to_string())?;
    let rule: Option<serde_json::Value> = if rule_json.trim().is_empty() || rule_json == "{}" {
        None
    } else {
        Some(serde_json::from_str(&rule_json).map_err(|error| error.to_string())?)
    };
    let action_value = action
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(serde_json::from_str)
        .transpose()
        .map_err(|error| error.to_string())?;

    Ok(OcrWatchRecord {
        id,
        name: name.unwrap_or_default(),
        scope,
        app_name,
        region,
        rect: None,
        status: if paused == 1 {
            "paused".to_string()
        } else {
            "active".to_string()
        },
        interval_ms,
        log_to_notion: Some(log_to_notion == 1),
        create_task_on_match: Some(create_task_on_match == 1),
        action: action_value,
        rule,
        last_text: None,
        last_match_key: None,
        last_checked_at: None,
    })
}

pub fn list_ocr_watches(path: &Path) -> Result<Vec<OcrWatchRecord>, String> {
    let connection = open_connection(path)?;
    let mut statement = connection
        .prepare(
            "SELECT id, name, scope, region_json, app_name, interval_ms, rule_json, action, paused, log_to_notion, create_task_on_match
             FROM ocr_watches
             ORDER BY created_at ASC",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let name: Option<String> = row.get(1)?;
            let scope: String = row.get(2)?;
            let region_json: Option<String> = row.get(3)?;
            let app_name: Option<String> = row.get(4)?;
            let interval_ms: i64 = row.get(5)?;
            let rule_json: String = row.get(6)?;
            let action: Option<String> = row.get(7)?;
            let paused: i64 = row.get(8)?;
            let log_to_notion: i64 = row.get(9)?;
            let create_task_on_match: i64 = row.get(10)?;
            row_to_ocr_watch(
                id,
                name,
                scope,
                region_json,
                app_name,
                interval_ms,
                rule_json,
                action,
                paused,
                log_to_notion,
                create_task_on_match,
            )
            .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                error,
            ))))
        })
        .map_err(|error| error.to_string())?;

    let mut watches = Vec::new();
    for row in rows {
        watches.push(row.map_err(|error| error.to_string())?);
    }
    Ok(watches)
}

pub fn save_ocr_watch(path: &Path, watch: &OcrWatchRecord) -> Result<(), String> {
    let connection = open_connection(path)?;
    let region_json = watch
        .region
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|error| error.to_string())?;
    let rule_json = match watch.rule.as_ref() {
        Some(rule) => serde_json::to_string(rule).map_err(|error| error.to_string())?,
        None => "{}".to_string(),
    };
    let action_json = watch
        .action
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|error| error.to_string())?;
    let paused = if watch.status == "paused" { 1 } else { 0 };

    connection
        .execute(
            "INSERT INTO ocr_watches (
                id, name, scope, region_json, app_name, interval_ms, rule_json, action,
                paused, log_to_notion, create_task_on_match, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, CURRENT_TIMESTAMP)
             ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                scope = excluded.scope,
                region_json = excluded.region_json,
                app_name = excluded.app_name,
                interval_ms = excluded.interval_ms,
                rule_json = excluded.rule_json,
                action = excluded.action,
                paused = excluded.paused,
                log_to_notion = excluded.log_to_notion,
                create_task_on_match = excluded.create_task_on_match,
                updated_at = CURRENT_TIMESTAMP",
            params![
                watch.id,
                watch.name,
                watch.scope,
                region_json,
                watch.app_name,
                watch.interval_ms,
                rule_json,
                action_json,
                paused,
                if watch.log_to_notion.unwrap_or(false) {
                    1
                } else {
                    0
                },
                if watch.create_task_on_match.unwrap_or(false) {
                    1
                } else {
                    0
                },
            ],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn delete_ocr_watch(path: &Path, id: &str) -> Result<(), String> {
    let connection = open_connection(path)?;
    connection
        .execute("DELETE FROM ocr_watches WHERE id = ?1", params![id])
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn list_desktop_schedules(path: &Path) -> Result<Vec<DesktopScheduleRecord>, String> {
    let connection = open_connection(path)?;
    let mut statement = connection
        .prepare(
            "SELECT id, name, command, at_time, created_at
             FROM desktop_schedules
             ORDER BY created_at ASC",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let command: String = row.get(2)?;
            let due_at: Option<String> = row.get(3)?;
            let created_at: String = row.get(4)?;
            Ok(DesktopScheduleRecord {
                id,
                project_name: name.clone(),
                action_label: command,
                due_at: due_at.unwrap_or_default(),
                created_at,
            })
        })
        .map_err(|error| error.to_string())?;

    let mut schedules = Vec::new();
    for row in rows {
        schedules.push(row.map_err(|error| error.to_string())?);
    }
    Ok(schedules)
}

pub fn save_desktop_schedule(path: &Path, schedule: &DesktopScheduleRecord) -> Result<(), String> {
    let connection = open_connection(path)?;
    let name = if schedule.project_name.trim().is_empty() {
        schedule.action_label.clone()
    } else {
        schedule.project_name.clone()
    };
    connection
        .execute(
            "INSERT INTO desktop_schedules (id, name, command, at_time, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                command = excluded.command,
                at_time = excluded.at_time",
            params![
                schedule.id,
                name,
                schedule.action_label,
                schedule.due_at,
                schedule.created_at,
            ],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn delete_desktop_schedule(path: &Path, id: &str) -> Result<(), String> {
    let connection = open_connection(path)?;
    connection
        .execute("DELETE FROM desktop_schedules WHERE id = ?1", params![id])
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn list_saved_workflows(path: &Path) -> Result<Vec<SavedWorkflowRecord>, String> {
    let connection = open_connection(path)?;
    let mut statement = connection
        .prepare(
            "SELECT id, name, steps_json, source, created_at
             FROM saved_workflows
             ORDER BY created_at ASC",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
            let steps_json: String = row.get(2)?;
            let steps: Vec<String> =
                serde_json::from_str(&steps_json).unwrap_or_else(|_| Vec::new());
            let source: String = row.get(3)?;
            Ok(SavedWorkflowRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                trigger_phrase: format!("run workflow {}", row.get::<_, String>(1)?),
                steps,
                created_at: row.get(4)?,
                based_on_count: if source == "imported" { 1 } else { 0 },
            })
        })
        .map_err(|error| error.to_string())?;

    let mut workflows = Vec::new();
    for row in rows {
        workflows.push(row.map_err(|error| error.to_string())?);
    }
    Ok(workflows)
}

pub fn save_saved_workflow(path: &Path, workflow: &SavedWorkflowRecord) -> Result<(), String> {
    let connection = open_connection(path)?;
    let steps_json =
        serde_json::to_string(&workflow.steps).map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO saved_workflows (id, name, steps_json, source, updated_at)
             VALUES (?1, ?2, ?3, 'user', CURRENT_TIMESTAMP)
             ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                steps_json = excluded.steps_json,
                updated_at = CURRENT_TIMESTAMP",
            params![workflow.id, workflow.name, steps_json],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn delete_saved_workflow(path: &Path, id: &str) -> Result<(), String> {
    let connection = open_connection(path)?;
    connection
        .execute("DELETE FROM saved_workflows WHERE id = ?1", params![id])
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn find_saved_workflow_by_name(
    path: &Path,
    query: &str,
) -> Result<Option<SavedWorkflowRecord>, String> {
    let normalized = query.trim().to_lowercase();
    let workflows = list_saved_workflows(path)?;
    Ok(workflows.into_iter().find(|workflow| {
        workflow.name.to_lowercase() == normalized
            || workflow.trigger_phrase.to_lowercase() == normalized
            || workflow.name.to_lowercase().contains(&normalized)
    }))
}

pub fn import_from_local_storage(
    path: &Path,
    payload: &LocalStorageImportPayload,
) -> Result<LocalStorageImportResult, String> {
    let mut ocr_count = 0usize;
    let mut schedule_count = 0usize;
    let mut workflow_count = 0usize;

    for watch in &payload.ocr_watches {
        save_ocr_watch(path, watch)?;
        ocr_count += 1;
    }
    for schedule in &payload.desktop_schedules {
        save_desktop_schedule(path, schedule)?;
        schedule_count += 1;
    }
    for workflow in &payload.saved_workflows {
        save_saved_workflow(path, workflow)?;
        workflow_count += 1;
    }

    Ok(LocalStorageImportResult {
        ocr_watches_imported: ocr_count,
        desktop_schedules_imported: schedule_count,
        saved_workflows_imported: workflow_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::migrations::apply_pending_migrations;

    fn temp_db() -> (std::path::PathBuf, Connection) {
        let path = std::env::temp_dir().join(format!(
            "jarvis-automation-store-{}-{}.db",
            std::process::id(),
            uuid_like()
        ));
        let conn = Connection::open(&path).expect("open");
        apply_pending_migrations(&conn, &path).expect("migrate");
        (path, conn)
    }

    fn uuid_like() -> String {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0)
            .to_string()
    }

    #[test]
    fn ocr_watch_round_trip() {
        let (path, _) = temp_db();
        let watch = OcrWatchRecord {
            id: "watch-1".to_string(),
            name: "Price watch".to_string(),
            scope: "screen".to_string(),
            app_name: None,
            region: None,
            rect: None,
            status: "active".to_string(),
            interval_ms: 30_000,
            log_to_notion: Some(false),
            create_task_on_match: Some(false),
            action: None,
            rule: Some(serde_json::json!({"type": "keyword", "keyword": "error"})),
            last_text: None,
            last_match_key: None,
            last_checked_at: None,
        };
        save_ocr_watch(&path, &watch).expect("save");
        let listed = list_ocr_watches(&path).expect("list");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].name, "Price watch");
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn saved_workflow_round_trip() {
        let (path, _) = temp_db();
        let workflow = SavedWorkflowRecord {
            id: "wf-1".to_string(),
            name: "morning routine".to_string(),
            trigger_phrase: "run workflow morning routine".to_string(),
            steps: vec!["open chrome".to_string(), "read clipboard".to_string()],
            created_at: "2026-01-01T00:00:00Z".to_string(),
            based_on_count: 2,
        };
        save_saved_workflow(&path, &workflow).expect("save");
        let found = find_saved_workflow_by_name(&path, "morning routine")
            .expect("find")
            .expect("some");
        assert_eq!(found.steps.len(), 2);
        let _ = std::fs::remove_file(path);
    }
}
