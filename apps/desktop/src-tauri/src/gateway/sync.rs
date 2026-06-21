use std::fs;
use std::path::Path;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use rusqlite::{params, Connection};

use crate::gateway::config::{load_gateway_config, save_gateway_config, GatewayConfig};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserGoalRecord {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: String,
    pub target_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncBundle {
    pub exported_at: String,
    pub gateway_config: GatewayConfig,
    pub goals: Vec<UserGoalRecord>,
    pub trigger_recipes: Vec<crate::gateway::trigger_recipes::TriggerRecipeRecord>,
}

pub fn list_user_goals(db_path: &Path) -> Result<Vec<UserGoalRecord>, String> {
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    let mut statement = conn
        .prepare(
            "SELECT id, title, description, status, target_date, created_at, updated_at
             FROM user_goals ORDER BY updated_at DESC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(UserGoalRecord {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                status: row.get(3)?,
                target_date: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

pub fn save_user_goal(db_path: &Path, goal: &UserGoalRecord) -> Result<(), String> {
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    conn.execute(
        "INSERT INTO user_goals (id, title, description, status, target_date, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            description = excluded.description,
            status = excluded.status,
            target_date = excluded.target_date,
            updated_at = excluded.updated_at",
        params![
            goal.id,
            goal.title,
            goal.description,
            goal.status,
            goal.target_date,
            goal.created_at,
            goal.updated_at,
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn export_sync_bundle(
    db_path: &Path,
    app_data_dir: &Path,
    passphrase: &str,
) -> Result<String, String> {
    crate::migrations::apply_pending_migrations(
        &Connection::open(db_path).map_err(|error| error.to_string())?,
        db_path,
    )?;
    let bundle = SyncBundle {
        exported_at: chrono::Utc::now().to_rfc3339(),
        gateway_config: load_gateway_config(app_data_dir),
        goals: list_user_goals(db_path)?,
        trigger_recipes: crate::gateway::trigger_recipes::list_trigger_recipes(db_path)?,
    };
    let json = serde_json::to_string_pretty(&bundle).map_err(|error| error.to_string())?;
    let encoded = STANDARD.encode(format!("{passphrase}::{json}"));
    let export_dir = app_data_dir.join("sync").join("exports");
    fs::create_dir_all(&export_dir).map_err(|error| error.to_string())?;
    let path = export_dir.join(format!(
        "jarvis-sync-{}.json",
        chrono::Utc::now().timestamp()
    ));
    fs::write(&path, encoded).map_err(|error| error.to_string())?;
    Ok(path.display().to_string())
}

pub fn import_sync_bundle(
    db_path: &Path,
    app_data_dir: &Path,
    bundle_path: &Path,
    passphrase: &str,
) -> Result<String, String> {
    let encoded = fs::read_to_string(bundle_path).map_err(|error| error.to_string())?;
    let decoded = String::from_utf8(
        STANDARD
            .decode(encoded.trim())
            .map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;
    let (expected_prefix, json) = decoded
        .split_once("::")
        .ok_or_else(|| "Invalid sync bundle format.".to_string())?;
    if expected_prefix != passphrase {
        return Err("Sync bundle passphrase mismatch.".to_string());
    }
    let bundle: SyncBundle = serde_json::from_str(json).map_err(|error| error.to_string())?;
    save_gateway_config(app_data_dir, &bundle.gateway_config)?;
    for goal in &bundle.goals {
        save_user_goal(db_path, goal)?;
    }
    for recipe in &bundle.trigger_recipes {
        crate::gateway::trigger_recipes::save_trigger_recipe(db_path, recipe)?;
    }
    Ok(format!(
        "Imported sync bundle with {} goal(s) and {} trigger recipe(s).",
        bundle.goals.len(),
        bundle.trigger_recipes.len()
    ))
}
