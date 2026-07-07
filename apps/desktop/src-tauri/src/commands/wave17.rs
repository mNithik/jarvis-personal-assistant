use tauri::State;

use crate::gateway::marketplace::{
    install_marketplace_skill, list_marketplace_catalog_for_app, operator_lane_summary,
    refresh_remote_catalog_cache,
};
use crate::gateway::metrics::{proactive_metrics, write_proactive_metrics_snapshot, ProactiveMetrics};
use crate::gateway::sync_remote::{
    connect_remote_account, list_pending_sync_conflicts, pull_remote_sync, push_remote_sync,
    register_remote_device, remote_sync_status, RemoteSyncAccount, RemoteSyncResult,
    RemoteSyncStatus, SyncConflict, SyncConflictResolution,
};

#[tauri::command]
pub fn remote_sync_status_cmd(
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
) -> Result<RemoteSyncStatus, String> {
    Ok(remote_sync_status(gateway_state.app_data_dir()))
}

#[tauri::command]
pub fn connect_remote_sync_cmd(
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
    endpoint: String,
    device_token: String,
) -> Result<RemoteSyncAccount, String> {
    connect_remote_account(gateway_state.app_data_dir(), endpoint, device_token)
}

#[tauri::command]
pub fn register_remote_sync_cmd(
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
    endpoint: String,
    label: Option<String>,
) -> Result<RemoteSyncAccount, String> {
    register_remote_device(gateway_state.app_data_dir(), endpoint, label)
}

#[tauri::command]
pub fn push_remote_sync_cmd(
    state: State<'_, crate::AppState>,
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
    passphrase: String,
) -> Result<RemoteSyncResult, String> {
    push_remote_sync(
        &state.db_path,
        gateway_state.app_data_dir(),
        &passphrase,
    )
}

#[tauri::command]
pub fn pull_remote_sync_cmd(
    state: State<'_, crate::AppState>,
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
    passphrase: String,
    resolutions: Option<Vec<SyncConflictResolution>>,
) -> Result<RemoteSyncResult, String> {
    pull_remote_sync(
        &state.db_path,
        gateway_state.app_data_dir(),
        &passphrase,
        resolutions,
    )
}

#[tauri::command]
pub fn list_pending_sync_conflicts_cmd(
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
) -> Result<Vec<SyncConflict>, String> {
    list_pending_sync_conflicts(gateway_state.app_data_dir())
}

#[tauri::command]
pub fn list_marketplace_catalog_cmd(
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
) -> Result<Vec<crate::gateway::marketplace::MarketplaceCatalogEntry>, String> {
    list_marketplace_catalog_for_app(gateway_state.app_data_dir())
}

#[tauri::command]
pub fn refresh_marketplace_catalog_cmd(
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
) -> Result<Vec<crate::gateway::marketplace::MarketplaceCatalogEntry>, String> {
    refresh_remote_catalog_cache(gateway_state.app_data_dir())
}

#[tauri::command]
pub fn install_marketplace_skill_cmd(
    state: State<'_, crate::AppState>,
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
    skill_id: String,
) -> Result<crate::gateway::marketplace::MarketplaceInstallResult, String> {
    install_marketplace_skill(&state.db_path, gateway_state.app_data_dir(), &skill_id)
}

#[tauri::command]
pub fn marketplace_operator_lane_cmd(
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
    skill_id: String,
) -> Result<String, String> {
    operator_lane_summary(&skill_id, gateway_state.app_data_dir())
}

#[tauri::command]
pub fn get_proactive_metrics_cmd(
    state: State<'_, crate::AppState>,
) -> Result<ProactiveMetrics, String> {
    proactive_metrics(&state.db_path)
}

#[tauri::command]
pub fn export_proactive_metrics_cmd(
    state: State<'_, crate::AppState>,
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
) -> Result<String, String> {
    let path = write_proactive_metrics_snapshot(gateway_state.app_data_dir(), &state.db_path)?;
    Ok(format!("Wrote proactive metrics to {}", path.display()))
}
