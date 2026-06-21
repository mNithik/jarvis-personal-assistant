use std::path::Path;

use rusqlite::{params, Connection, OptionalExtension};

use super::config::GatewayConfig;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TriggerRecipeRecord {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub kind: String,
    pub schedule_value: Option<String>,
    pub payload_json: String,
    pub created_at: String,
    pub updated_at: String,
}

pub fn list_trigger_recipes(db_path: &Path) -> Result<Vec<TriggerRecipeRecord>, String> {
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    let mut statement = conn
        .prepare(
            "SELECT id, name, enabled, kind, schedule_value, payload_json, created_at, updated_at
             FROM trigger_recipes ORDER BY name ASC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(TriggerRecipeRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                enabled: row.get::<_, i64>(2)? != 0,
                kind: row.get(3)?,
                schedule_value: row.get(4)?,
                payload_json: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

pub fn save_trigger_recipe(db_path: &Path, recipe: &TriggerRecipeRecord) -> Result<(), String> {
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    conn.execute(
        "INSERT INTO trigger_recipes (id, name, enabled, kind, schedule_value, payload_json, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            enabled = excluded.enabled,
            kind = excluded.kind,
            schedule_value = excluded.schedule_value,
            payload_json = excluded.payload_json,
            updated_at = excluded.updated_at",
        params![
            recipe.id,
            recipe.name,
            if recipe.enabled { 1 } else { 0 },
            recipe.kind,
            recipe.schedule_value,
            recipe.payload_json,
            recipe.created_at,
            recipe.updated_at,
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn delete_trigger_recipe(db_path: &Path, id: &str) -> Result<(), String> {
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    conn.execute("DELETE FROM trigger_recipes WHERE id = ?1", [id])
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn seed_default_recipes(db_path: &Path, config: &GatewayConfig) -> Result<(), String> {
    let existing = list_trigger_recipes(db_path)?;
    if !existing.is_empty() {
        return Ok(());
    }

    let now = chrono::Local::now()
        .format("%Y-%m-%dT%H:%M:%S")
        .to_string();
    let defaults = vec![
        TriggerRecipeRecord {
            id: "recipe-morning-brief".into(),
            name: "Morning brief / plan".into(),
            enabled: config.proactive.morning_brief_enabled,
            kind: "morning_brief".into(),
            schedule_value: Some(config.proactive.morning_brief_time.clone()),
            payload_json: "{}".into(),
            created_at: now.clone(),
            updated_at: now.clone(),
        },
        TriggerRecipeRecord {
            id: "recipe-ocr-watch".into(),
            name: "OCR watch tick".into(),
            enabled: config.proactive.ocr_watch_tick_enabled,
            kind: "ocr_watch".into(),
            schedule_value: None,
            payload_json: "{}".into(),
            created_at: now.clone(),
            updated_at: now.clone(),
        },
        TriggerRecipeRecord {
            id: "recipe-calendar-soon".into(),
            name: "Meeting prep (15m before)".into(),
            enabled: true,
            kind: "calendar_event_soon".into(),
            schedule_value: Some("15".into()),
            payload_json: r#"{"command":"prep me for my next meeting"}"#.into(),
            created_at: now.clone(),
            updated_at: now.clone(),
        },
        TriggerRecipeRecord {
            id: "recipe-inbox-triage".into(),
            name: "Morning inbox triage".into(),
            enabled: false,
            kind: "gmail_label_inbox".into(),
            schedule_value: Some("08:00".into()),
            payload_json: r#"{"command":"triage my inbox","label":"inbox"}"#.into(),
            created_at: now.clone(),
            updated_at: now,
        },
    ];

    for recipe in defaults {
        save_trigger_recipe(db_path, &recipe)?;
    }
    Ok(())
}

pub fn sync_recipes_to_config(db_path: &Path, config: &mut GatewayConfig) -> Result<(), String> {
    seed_default_recipes(db_path, config)?;
    for recipe in list_trigger_recipes(db_path)? {
        if !recipe.enabled {
            continue;
        }
        match recipe.kind.as_str() {
            "morning_brief" => {
                config.proactive.morning_brief_enabled = true;
                if let Some(time) = recipe.schedule_value.filter(|value| !value.trim().is_empty())
                {
                    config.proactive.morning_brief_time = time;
                }
            }
            "ocr_watch" => config.proactive.ocr_watch_tick_enabled = true,
            _ => {}
        }
    }
    Ok(())
}

pub fn maybe_enqueue_scheduled_recipes(
    db_path: &Path,
    time_label: &str,
    day_key: &str,
) -> Result<(), String> {
    use super::trigger_queue::enqueue_trigger;

    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    for recipe in list_trigger_recipes(db_path)? {
        if !recipe.enabled {
            continue;
        }
        let Some(schedule) = recipe
            .schedule_value
            .as_deref()
            .filter(|value| !value.trim().is_empty())
        else {
            continue;
        };
        if schedule.contains(':') && schedule != time_label {
            continue;
        }
        let dedupe_key = format!("{}-{}", recipe.id, day_key);
        let already = conn
            .query_row(
                "SELECT 1 FROM app_meta WHERE key = ?1 LIMIT 1",
                [dedupe_key.clone()],
                |_| Ok(()),
            )
            .optional()
            .map_err(|error| error.to_string())?
            .is_some();
        if already {
            continue;
        }
        enqueue_trigger(&conn, &recipe.kind, &recipe.payload_json)?;
        conn.execute(
            "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?1, '1')",
            [dedupe_key],
        )
        .map_err(|error| error.to_string())?;
    }
    Ok(())
}
