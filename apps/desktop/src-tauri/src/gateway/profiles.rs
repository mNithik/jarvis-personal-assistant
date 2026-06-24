use std::path::Path;

use rusqlite::{params, Connection, OptionalExtension};

use super::config::{
    gateway_default_install_preset, gateway_easy_mode_preset, load_gateway_config,
    save_gateway_config, GatewayConfig,
};

pub const ACTIVE_PROFILE_KEY: &str = "active_profile_id";
pub const DEFAULT_PROFILE_ID: &str = "work";

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserProfileRecord {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub created_at: String,
}

fn open_conn(db_path: &Path) -> Result<Connection, String> {
    crate::migrations::apply_pending_migrations(
        &Connection::open(db_path).map_err(|error| error.to_string())?,
        db_path,
    )?;
    Connection::open(db_path).map_err(|error| error.to_string())
}

pub fn list_profiles(db_path: &Path) -> Result<Vec<UserProfileRecord>, String> {
    let conn = open_conn(db_path)?;
    let mut statement = conn
        .prepare("SELECT id, name, kind, created_at FROM user_profiles ORDER BY name ASC")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(UserProfileRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                kind: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

pub fn get_active_profile_id(db_path: &Path) -> Result<Option<String>, String> {
    let conn = open_conn(db_path)?;
    conn.query_row(
        "SELECT value FROM app_meta WHERE key = ?1",
        [ACTIVE_PROFILE_KEY],
        |row| row.get::<_, String>(0),
    )
    .optional()
    .map_err(|error| error.to_string())
}

pub fn active_profile_id_or_default(db_path: &Path) -> Result<String, String> {
    Ok(get_active_profile_id(db_path)?.unwrap_or_else(|| DEFAULT_PROFILE_ID.to_string()))
}

pub fn get_active_profile(db_path: &Path) -> Result<Option<UserProfileRecord>, String> {
    let Some(active_id) = get_active_profile_id(db_path)? else {
        return Ok(None);
    };
    let conn = open_conn(db_path)?;
    conn.query_row(
        "SELECT id, name, kind, created_at FROM user_profiles WHERE id = ?1",
        [&active_id],
        |row| {
            Ok(UserProfileRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                kind: row.get(2)?,
                created_at: row.get(3)?,
            })
        },
    )
    .optional()
    .map_err(|error| error.to_string())
}

pub fn profile_gateway_config(db_path: &Path, profile_id: &str) -> Result<GatewayConfig, String> {
    let conn = open_conn(db_path)?;
    let raw: String = conn
        .query_row(
            "SELECT gateway_json FROM user_profiles WHERE id = ?1",
            [profile_id],
            |row| row.get(0),
        )
        .map_err(|_| format!("Profile \"{profile_id}\" not found"))?;
    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

pub fn upsert_profile(
    db_path: &Path,
    profile: &UserProfileRecord,
    gateway_config: &GatewayConfig,
) -> Result<(), String> {
    let conn = open_conn(db_path)?;
    let gateway_json = serde_json::to_string(gateway_config).map_err(|error| error.to_string())?;
    conn.execute(
        "INSERT INTO user_profiles (id, name, kind, gateway_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            kind = excluded.kind,
            gateway_json = excluded.gateway_json",
        params![
            profile.id,
            profile.name,
            profile.kind,
            gateway_json,
            profile.created_at,
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn seed_default_profiles(db_path: &Path, app_data_dir: &Path) -> Result<(), String> {
    let existing = list_profiles(db_path)?;
    if !existing.is_empty() {
        return apply_active_profile(db_path, app_data_dir);
    }

    let now = chrono::Utc::now().to_rfc3339();
    let defaults = [
        ("work", "Work", "work", {
            let mut config = gateway_default_install_preset();
            config.features.builder = true;
            config.features.gmail = true;
            config.features.notion = true;
            config
        }),
        ("personal", "Personal", "personal", {
            let mut config = gateway_easy_mode_preset();
            config.routing.prefer_local_for_personal = true;
            config
        }),
        ("lab", "Lab", "lab", {
            let mut config = gateway_default_install_preset();
            config.labs.project_bundle_pilot = true;
            config.labs.council_verifier = true;
            config.labs.council_runtime = true;
            config.labs.proactive_anomaly = true;
            config.labs.world_model_queries = true;
            config.labs.ambient_copilot = false;
            config
        }),
    ];

    for (id, name, kind, config) in defaults {
        upsert_profile(
            db_path,
            &UserProfileRecord {
                id: id.to_string(),
                name: name.to_string(),
                kind: kind.to_string(),
                created_at: now.clone(),
            },
            &config,
        )?;
    }

    switch_profile(db_path, app_data_dir, "work").map(|_| ())
}

pub fn switch_profile(
    db_path: &Path,
    app_data_dir: &Path,
    profile_id: &str,
) -> Result<String, String> {
    let config = profile_gateway_config(db_path, profile_id)?;
    save_gateway_config(app_data_dir, &config)?;
    let conn = open_conn(db_path)?;
    conn.execute(
        "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?1, ?2)",
        params![ACTIVE_PROFILE_KEY, profile_id],
    )
    .map_err(|error| error.to_string())?;
    let name = list_profiles(db_path)?
        .into_iter()
        .find(|profile| profile.id == profile_id)
        .map(|profile| profile.name)
        .unwrap_or_else(|| profile_id.to_string());
    Ok(format!("Switched to {name} profile."))
}

pub fn apply_active_profile(db_path: &Path, app_data_dir: &Path) -> Result<(), String> {
    if let Some(active_id) = get_active_profile_id(db_path)? {
        let _ = switch_profile(db_path, app_data_dir, &active_id);
        return Ok(());
    }
    if list_profiles(db_path)?.is_empty() {
        return Ok(());
    }
    switch_profile(db_path, app_data_dir, "work").map(|_| ())
}

pub fn is_profile_switch_command(command: &str) -> bool {
    let normalized = command.trim().to_lowercase();
    normalized.contains("switch to work profile")
        || normalized.contains("switch to personal profile")
        || normalized.contains("switch to lab profile")
        || normalized.contains("switch profile")
}

pub fn profile_id_from_command(command: &str) -> Option<&'static str> {
    let normalized = command.trim().to_lowercase();
    if normalized.contains("personal") {
        Some("personal")
    } else if normalized.contains("lab") {
        Some("lab")
    } else if normalized.contains("work") {
        Some("work")
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_paths() -> (std::path::PathBuf, std::path::PathBuf) {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let db = std::env::temp_dir().join(format!("jarvis-profile-db-{nanos}.db"));
        let app_data = std::env::temp_dir().join(format!("jarvis-profile-app-{nanos}"));
        (db, app_data)
    }

    #[test]
    fn seed_and_switch_profile_roundtrip() {
        let (db_path, app_data_dir) = temp_paths();
        std::fs::create_dir_all(&app_data_dir).expect("dir");
        seed_default_profiles(&db_path, &app_data_dir).expect("seed");
        let profiles = list_profiles(&db_path).expect("list");
        assert_eq!(profiles.len(), 3);
        switch_profile(&db_path, &app_data_dir, "personal").expect("switch");
        let loaded = load_gateway_config(&app_data_dir);
        assert!(loaded.routing.prefer_local_for_personal);
        let _ = std::fs::remove_file(db_path);
        let _ = std::fs::remove_dir_all(app_data_dir);
    }
}
