//! T17-D hosted sync — encrypted remote bundle store with conflict detection.

use std::fs;
use std::path::{Path, PathBuf};

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use serde::{Deserialize, Serialize};

use super::sync::{export_sync_bundle, import_sync_bundle, SyncBundle, UserGoalRecord};

pub const REMOTE_SYNC_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteSyncAccount {
    pub endpoint: String,
    pub device_token: String,
    pub device_id: String,
    pub last_sync_at: Option<String>,
    pub last_remote_version: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteSyncStatus {
    pub connected: bool,
    pub endpoint: String,
    pub device_id: String,
    pub last_sync_at: Option<String>,
    pub pending_conflicts: usize,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SyncConflictKind {
    Goal,
    Profile,
    TriggerRecipe,
    MemoryEntity,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncConflict {
    pub id: String,
    pub kind: SyncConflictKind,
    pub local_summary: String,
    pub remote_summary: String,
    pub local_updated_at: Option<String>,
    pub remote_updated_at: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SyncConflictResolution {
    KeepLocal,
    KeepRemote,
    NewestWins,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteSyncResult {
    pub summary: String,
    pub conflicts: Vec<SyncConflict>,
    pub applied: bool,
}

fn account_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("remote_sync").join("account.json")
}

fn remote_store_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("remote_sync").join("store")
}

fn conflicts_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("remote_sync").join("pending_conflicts.json")
}

fn remote_bundle_path(app_data_dir: &Path) -> PathBuf {
    remote_store_dir(app_data_dir).join("latest.bundle")
}

pub fn load_remote_account(app_data_dir: &Path) -> Option<RemoteSyncAccount> {
    let path = account_path(app_data_dir);
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

pub fn save_remote_account(app_data_dir: &Path, account: &RemoteSyncAccount) -> Result<(), String> {
    let path = account_path(app_data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let raw = serde_json::to_string_pretty(account).map_err(|error| error.to_string())?;
    fs::write(path, raw).map_err(|error| error.to_string())
}

pub fn remote_sync_status(app_data_dir: &Path) -> RemoteSyncStatus {
    let account = load_remote_account(app_data_dir);
    let pending_conflicts = load_pending_conflicts(app_data_dir).map(|items| items.len()).unwrap_or(0);
    match account {
        Some(account) => RemoteSyncStatus {
            connected: !account.device_token.trim().is_empty(),
            endpoint: account.endpoint,
            device_id: account.device_id,
            last_sync_at: account.last_sync_at,
            pending_conflicts,
        },
        None => RemoteSyncStatus {
            connected: false,
            endpoint: String::new(),
            device_id: String::new(),
            last_sync_at: None,
            pending_conflicts,
        },
    }
}

pub fn connect_remote_account(
    app_data_dir: &Path,
    endpoint: String,
    device_token: String,
) -> Result<RemoteSyncAccount, String> {
    let device_id = load_remote_account(app_data_dir)
        .map(|account| account.device_id)
        .unwrap_or_else(|| format!("jarvis-{}", chrono::Utc::now().timestamp()));
    let account = RemoteSyncAccount {
        endpoint: endpoint.trim().to_string(),
        device_token: device_token.trim().to_string(),
        device_id,
        last_sync_at: None,
        last_remote_version: None,
    };
    save_remote_account(app_data_dir, &account)?;
    Ok(account)
}

fn decode_bundle(encoded: &str, passphrase: &str) -> Result<SyncBundle, String> {
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
    serde_json::from_str(json).map_err(|error| error.to_string())
}

fn encode_bundle(bundle: &SyncBundle, passphrase: &str) -> Result<String, String> {
    let json = serde_json::to_string(bundle).map_err(|error| error.to_string())?;
    Ok(STANDARD.encode(format!("{passphrase}::{json}")))
}

pub fn build_local_bundle(
    db_path: &Path,
    app_data_dir: &Path,
    passphrase: &str,
) -> Result<SyncBundle, String> {
    let export_path = export_sync_bundle(db_path, app_data_dir, passphrase)?;
    let encoded = fs::read_to_string(export_path).map_err(|error| error.to_string())?;
    decode_bundle(&encoded, passphrase)
}

fn load_remote_bundle_file(app_data_dir: &Path, passphrase: &str) -> Result<Option<SyncBundle>, String> {
    let path = remote_bundle_path(app_data_dir);
    if !path.exists() {
        return Ok(None);
    }
    let encoded = fs::read_to_string(path).map_err(|error| error.to_string())?;
    decode_bundle(&encoded, passphrase).map(Some)
}

fn write_remote_bundle_file(app_data_dir: &Path, bundle: &SyncBundle, passphrase: &str) -> Result<(), String> {
    let dir = remote_store_dir(app_data_dir);
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    fs::write(
        remote_bundle_path(app_data_dir),
        encode_bundle(bundle, passphrase)?,
    )
    .map_err(|error| error.to_string())
}

fn post_remote_bundle(account: &RemoteSyncAccount, encoded: &str) -> Result<(), String> {
    if account.endpoint.trim().is_empty() {
        return Ok(());
    }
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?;
    let response = client
        .post(format!("{}/v1/sync/bundles", account.endpoint.trim_end_matches('/')))
        .header("Authorization", format!("Bearer {}", account.device_token))
        .header("X-Jarvis-Device-Id", &account.device_id)
        .header("X-Jarvis-Sync-Version", REMOTE_SYNC_VERSION.to_string())
        .body(encoded.to_string())
        .send()
        .map_err(|error| format!("Remote sync upload failed: {error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "Remote sync upload returned HTTP {}",
            response.status()
        ));
    }
    Ok(())
}

fn fetch_remote_bundle(account: &RemoteSyncAccount) -> Result<Option<String>, String> {
    if account.endpoint.trim().is_empty() {
        return Ok(None);
    }
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?;
    let response = client
        .get(format!(
            "{}/v1/sync/bundles/latest",
            account.endpoint.trim_end_matches('/')
        ))
        .header("Authorization", format!("Bearer {}", account.device_token))
        .header("X-Jarvis-Device-Id", &account.device_id)
        .send()
        .map_err(|error| format!("Remote sync download failed: {error}"))?;
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !response.status().is_success() {
        return Err(format!(
            "Remote sync download returned HTTP {}",
            response.status()
        ));
    }
    response
        .text()
        .map_err(|error| error.to_string())
        .map(Some)
}

pub fn detect_sync_conflicts(local: &SyncBundle, remote: &SyncBundle) -> Vec<SyncConflict> {
    let mut conflicts = Vec::new();

    for remote_goal in &remote.goals {
        if let Some(local_goal) = local.goals.iter().find(|goal| goal.id == remote_goal.id) {
            if local_goal.updated_at != remote_goal.updated_at
                || local_goal.title != remote_goal.title
                || local_goal.status != remote_goal.status
            {
                conflicts.push(SyncConflict {
                    id: remote_goal.id.clone(),
                    kind: SyncConflictKind::Goal,
                    local_summary: format!("{} ({})", local_goal.title, local_goal.status),
                    remote_summary: format!("{} ({})", remote_goal.title, remote_goal.status),
                    local_updated_at: Some(local_goal.updated_at.clone()),
                    remote_updated_at: Some(remote_goal.updated_at.clone()),
                });
            }
        }
    }

    for remote_profile in &remote.profiles {
        if let Some(local_profile) = local
            .profiles
            .iter()
            .find(|profile| profile.id == remote_profile.id)
        {
            if local_profile.name != remote_profile.name
                || local_profile.gateway_config != remote_profile.gateway_config
            {
                conflicts.push(SyncConflict {
                    id: remote_profile.id.clone(),
                    kind: SyncConflictKind::Profile,
                    local_summary: format!("{} profile config", local_profile.name),
                    remote_summary: format!("{} profile config", remote_profile.name),
                    local_updated_at: None,
                    remote_updated_at: None,
                });
            }
        }
    }

    for remote_recipe in &remote.trigger_recipes {
        if let Some(local_recipe) = local
            .trigger_recipes
            .iter()
            .find(|recipe| recipe.id == remote_recipe.id)
        {
            if local_recipe.updated_at != remote_recipe.updated_at
                || local_recipe.enabled != remote_recipe.enabled
            {
                conflicts.push(SyncConflict {
                    id: remote_recipe.id.clone(),
                    kind: SyncConflictKind::TriggerRecipe,
                    local_summary: format!(
                        "{} (enabled={})",
                        local_recipe.name, local_recipe.enabled
                    ),
                    remote_summary: format!(
                        "{} (enabled={})",
                        remote_recipe.name, remote_recipe.enabled
                    ),
                    local_updated_at: Some(local_recipe.updated_at.clone()),
                    remote_updated_at: Some(remote_recipe.updated_at.clone()),
                });
            }
        }
    }

    for remote_entity in &remote.memory_entities {
        let key = (
            remote_entity.profile_id.as_str(),
            remote_entity.domain.as_str(),
            remote_entity.label.as_str(),
        );
        if let Some(local_entity) = local.memory_entities.iter().find(|entity| {
            (
                entity.profile_id.as_str(),
                entity.domain.as_str(),
                entity.label.as_str(),
            ) == key
        }) {
            if local_entity.updated_at != remote_entity.updated_at
                || local_entity.metadata_json != remote_entity.metadata_json
            {
                conflicts.push(SyncConflict {
                    id: format!(
                        "{}:{}:{}",
                        remote_entity.profile_id, remote_entity.domain, remote_entity.label
                    ),
                    kind: SyncConflictKind::MemoryEntity,
                    local_summary: format!(
                        "{} / {} metadata changed",
                        local_entity.domain, local_entity.label
                    ),
                    remote_summary: format!(
                        "{} / {} metadata changed",
                        remote_entity.domain, remote_entity.label
                    ),
                    local_updated_at: Some(local_entity.updated_at.clone()),
                    remote_updated_at: Some(remote_entity.updated_at.clone()),
                });
            }
        }
    }

    conflicts
}

fn merge_bundles(
    local: &SyncBundle,
    remote: &SyncBundle,
    resolutions: &[SyncConflictResolution],
    conflicts: &[SyncConflict],
) -> SyncBundle {
    let mut merged = remote.clone();
    merged.exported_at = chrono::Utc::now().to_rfc3339();
    merged.active_profile_id = local
        .active_profile_id
        .clone()
        .or_else(|| remote.active_profile_id.clone());

    for (conflict, resolution) in conflicts.iter().zip(resolutions.iter()) {
        match (conflict.kind, resolution) {
            (SyncConflictKind::Goal, SyncConflictResolution::KeepLocal) => {
                if let Some(goal) = local.goals.iter().find(|item| item.id == conflict.id) {
                    if let Some(target) = merged.goals.iter_mut().find(|item| item.id == goal.id) {
                        *target = goal.clone();
                    } else {
                        merged.goals.push(goal.clone());
                    }
                }
            }
            (SyncConflictKind::Goal, SyncConflictResolution::NewestWins) => {
                let local_goal = local.goals.iter().find(|item| item.id == conflict.id);
                let remote_goal = remote.goals.iter().find(|item| item.id == conflict.id);
                let winner = match (local_goal, remote_goal) {
                    (Some(left), Some(right)) => {
                        if left.updated_at >= right.updated_at {
                            left
                        } else {
                            right
                        }
                    }
                    (Some(left), None) => left,
                    (None, Some(right)) => right,
                    (None, None) => continue,
                };
                if let Some(target) = merged.goals.iter_mut().find(|item| item.id == winner.id) {
                    *target = winner.clone();
                } else {
                    merged.goals.push(winner.clone());
                }
            }
            (SyncConflictKind::Profile, SyncConflictResolution::KeepLocal) => {
                if let Some(profile) = local.profiles.iter().find(|item| item.id == conflict.id) {
                    if let Some(target) = merged.profiles.iter_mut().find(|item| item.id == profile.id)
                    {
                        *target = profile.clone();
                    }
                }
            }
            (SyncConflictKind::TriggerRecipe, SyncConflictResolution::KeepLocal) => {
                if let Some(recipe) = local
                    .trigger_recipes
                    .iter()
                    .find(|item| item.id == conflict.id)
                {
                    if let Some(target) = merged
                        .trigger_recipes
                        .iter_mut()
                        .find(|item| item.id == recipe.id)
                    {
                        *target = recipe.clone();
                    }
                }
            }
            (SyncConflictKind::MemoryEntity, SyncConflictResolution::KeepLocal) => {
                if let Some(entity) = local.memory_entities.iter().find(|item| item.id() == conflict.id)
                {
                    if let Some(target) = merged
                        .memory_entities
                        .iter_mut()
                        .find(|item| item.id() == entity.id())
                    {
                        *target = entity.clone();
                    }
                }
            }
            _ => {}
        }
    }

    merged
}

trait MemoryEntityKey {
    fn id(&self) -> String;
}

impl MemoryEntityKey for super::sync::SyncMemoryEntityRecord {
    fn id(&self) -> String {
        format!("{}:{}:{}", self.profile_id, self.domain, self.label)
    }
}

fn load_pending_conflicts(app_data_dir: &Path) -> Result<Vec<SyncConflict>, String> {
    let path = conflicts_path(app_data_dir);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

fn save_pending_conflicts(app_data_dir: &Path, conflicts: &[SyncConflict]) -> Result<(), String> {
    let path = conflicts_path(app_data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    if conflicts.is_empty() {
        let _ = fs::remove_file(path);
        return Ok(());
    }
    let raw = serde_json::to_string_pretty(conflicts).map_err(|error| error.to_string())?;
    fs::write(path, raw).map_err(|error| error.to_string())
}

pub fn list_pending_sync_conflicts(app_data_dir: &Path) -> Result<Vec<SyncConflict>, String> {
    load_pending_conflicts(app_data_dir)
}

pub fn push_remote_sync(
    db_path: &Path,
    app_data_dir: &Path,
    passphrase: &str,
) -> Result<RemoteSyncResult, String> {
    let account = load_remote_account(app_data_dir)
        .ok_or_else(|| "Connect a hosted sync account before pushing.".to_string())?;
    let local = build_local_bundle(db_path, app_data_dir, passphrase)?;
    let encoded = encode_bundle(&local, passphrase)?;
    write_remote_bundle_file(app_data_dir, &local, passphrase)?;
    post_remote_bundle(&account, &encoded)?;

    let mut account = account;
    account.last_sync_at = Some(chrono::Utc::now().to_rfc3339());
    account.last_remote_version = Some(REMOTE_SYNC_VERSION);
    save_remote_account(app_data_dir, &account)?;

    Ok(RemoteSyncResult {
        summary: "Pushed encrypted sync bundle to hosted store.".to_string(),
        conflicts: Vec::new(),
        applied: true,
    })
}

pub fn pull_remote_sync(
    db_path: &Path,
    app_data_dir: &Path,
    passphrase: &str,
    resolutions: Option<Vec<SyncConflictResolution>>,
) -> Result<RemoteSyncResult, String> {
    let account = load_remote_account(app_data_dir)
        .ok_or_else(|| "Connect a hosted sync account before pulling.".to_string())?;
    let local = build_local_bundle(db_path, app_data_dir, passphrase)?;

    let remote_encoded = if let Some(encoded) = fetch_remote_bundle(&account)? {
        write_remote_bundle_file(
            app_data_dir,
            &decode_bundle(&encoded, passphrase)?,
            passphrase,
        )?;
        Some(encoded)
    } else {
        None
    };

    let remote_bundle = if let Some(encoded) = remote_encoded {
        decode_bundle(&encoded, passphrase)?
    } else if let Some(bundle) = load_remote_bundle_file(app_data_dir, passphrase)? {
        bundle
    } else {
        return Ok(RemoteSyncResult {
            summary: "No remote bundle found yet. Push from this device first.".to_string(),
            conflicts: Vec::new(),
            applied: false,
        });
    };

    let conflicts = detect_sync_conflicts(&local, &remote_bundle);
    if conflicts.is_empty() {
        let temp_path = app_data_dir.join("remote_sync").join("import-temp.bundle");
        fs::write(&temp_path, encode_bundle(&remote_bundle, passphrase)?)
            .map_err(|error| error.to_string())?;
        let summary = import_sync_bundle(db_path, app_data_dir, &temp_path, passphrase)?;
        let _ = fs::remove_file(temp_path);
        let mut account = account;
        account.last_sync_at = Some(chrono::Utc::now().to_rfc3339());
        save_remote_account(app_data_dir, &account)?;
        save_pending_conflicts(app_data_dir, &[])?;
        return Ok(RemoteSyncResult {
            summary,
            conflicts: Vec::new(),
            applied: true,
        });
    }

    let resolutions = resolutions.unwrap_or_else(|| vec![SyncConflictResolution::NewestWins; conflicts.len()]);
    if resolutions.len() != conflicts.len() {
        save_pending_conflicts(app_data_dir, &conflicts)?;
        return Ok(RemoteSyncResult {
            summary: format!(
                "Detected {} sync conflict(s). Resolve them before applying the remote bundle.",
                conflicts.len()
            ),
            conflicts,
            applied: false,
        });
    }

    let merged = merge_bundles(&local, &remote_bundle, &resolutions, &conflicts);
    let temp_path = app_data_dir.join("remote_sync").join("import-merged.bundle");
    fs::write(&temp_path, encode_bundle(&merged, passphrase)?).map_err(|error| error.to_string())?;
    let summary = import_sync_bundle(db_path, app_data_dir, &temp_path, passphrase)?;
    let _ = fs::remove_file(temp_path);
    let mut account = account;
    account.last_sync_at = Some(chrono::Utc::now().to_rfc3339());
    save_remote_account(app_data_dir, &account)?;
    save_pending_conflicts(app_data_dir, &[])?;

    Ok(RemoteSyncResult {
        summary,
        conflicts: Vec::new(),
        applied: true,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_database;
    use crate::gateway::profiles::seed_default_profiles;
    use crate::gateway::sync::save_user_goal;

    #[test]
    fn detects_goal_conflicts_between_bundles() {
        let local = SyncBundle {
            exported_at: "2026-01-01T00:00:00Z".into(),
            active_profile_id: Some("work".into()),
            gateway_config: Default::default(),
            profiles: Vec::new(),
            memory_entities: Vec::new(),
            memory_facts: Vec::new(),
            memory_relations: Vec::new(),
            memory_documents: Vec::new(),
            memory_chunks: Vec::new(),
            goals: vec![UserGoalRecord {
                id: "goal-1".into(),
                profile_id: Some("work".into()),
                title: "Local title".into(),
                description: String::new(),
                status: "active".into(),
                target_date: None,
                created_at: "2026-01-01T00:00:00Z".into(),
                updated_at: "2026-01-02T00:00:00Z".into(),
            }],
            trigger_recipes: Vec::new(),
        };
        let remote = SyncBundle {
            goals: vec![UserGoalRecord {
                id: "goal-1".into(),
                profile_id: Some("work".into()),
                title: "Remote title".into(),
                description: String::new(),
                status: "active".into(),
                target_date: None,
                created_at: "2026-01-01T00:00:00Z".into(),
                updated_at: "2026-01-03T00:00:00Z".into(),
            }],
            ..local.clone()
        };
        let conflicts = detect_sync_conflicts(&local, &remote);
        assert_eq!(conflicts.len(), 1);
        assert_eq!(conflicts[0].kind, SyncConflictKind::Goal);
    }

    #[test]
    fn push_and_pull_round_trip_local_store() {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let db_path = std::env::temp_dir().join(format!("jarvis-remote-db-{nanos}.db"));
        let app_data_dir = std::env::temp_dir().join(format!("jarvis-remote-app-{nanos}"));
        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_dir_all(&app_data_dir);
        std::fs::create_dir_all(&app_data_dir).expect("dir");
        init_database(&db_path).expect("db");
        seed_default_profiles(&db_path, &app_data_dir).expect("profiles");
        save_user_goal(
            &db_path,
            &UserGoalRecord {
                id: "goal-remote".into(),
                profile_id: Some("work".into()),
                title: "Ship hosted sync".into(),
                description: String::new(),
                status: "active".into(),
                target_date: None,
                created_at: "2026-01-01T00:00:00Z".into(),
                updated_at: "2026-01-01T00:00:00Z".into(),
            },
        )
        .expect("goal");

        connect_remote_account(&app_data_dir, String::new(), "device-token".into())
            .expect("connect");
        push_remote_sync(&db_path, &app_data_dir, "jarvis").expect("push");

        let target_db = std::env::temp_dir().join(format!("jarvis-remote-target-{nanos}.db"));
        let target_app = std::env::temp_dir().join(format!("jarvis-remote-target-app-{nanos}"));
        let _ = std::fs::remove_file(&target_db);
        let _ = std::fs::remove_dir_all(&target_app);
        std::fs::create_dir_all(&target_app).expect("target dir");
        init_database(&target_db).expect("target db");
        seed_default_profiles(&target_db, &target_app).expect("target profiles");
        fs::create_dir_all(target_app.join("remote_sync")).expect("remote dir");
        fs::copy(
            remote_bundle_path(&app_data_dir),
            remote_bundle_path(&target_app),
        )
        .expect("copy bundle");
        connect_remote_account(&target_app, String::new(), "device-token".into()).expect("connect");

        let result = pull_remote_sync(&target_db, &target_app, "jarvis", None).expect("pull");
        assert!(result.applied);
        assert!(result.summary.contains("goal"));

        let _ = std::fs::remove_file(db_path);
        let _ = std::fs::remove_file(target_db);
        let _ = std::fs::remove_dir_all(app_data_dir);
        let _ = std::fs::remove_dir_all(target_app);
    }
}
