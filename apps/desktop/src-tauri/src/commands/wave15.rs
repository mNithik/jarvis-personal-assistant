use std::path::PathBuf;

use tauri::State;

use crate::gateway::anomaly::ProactiveNudgeRecord;
use crate::gateway::sync::UserGoalRecord;
use crate::memory::topic_graph::TopicGraphBundle;

#[tauri::command]
pub fn get_topic_graph_cmd(
    state: State<'_, crate::AppState>,
    limit: Option<usize>,
) -> Result<TopicGraphBundle, String> {
    crate::memory::topic_graph::get_topic_graph(&state.db_path, limit.unwrap_or(40))
}

#[tauri::command]
pub fn query_topic_neighbors_cmd(
    state: State<'_, crate::AppState>,
    query: String,
) -> Result<String, String> {
    crate::memory::topic_graph::query_topic_neighbors(&state.db_path, &query)
}

#[tauri::command]
pub fn infer_topic_graph_cmd(state: State<'_, crate::AppState>) -> Result<usize, String> {
    crate::memory::topic_graph::infer_relations_from_domains(&state.db_path)
}

#[tauri::command]
pub fn link_topic_entities_cmd(
    state: State<'_, crate::AppState>,
    subject_label: String,
    predicate: String,
    object_label: String,
) -> Result<String, String> {
    crate::memory::topic_graph::link_entities_by_label(
        &state.db_path,
        &subject_label,
        &predicate,
        &object_label,
        "manual",
    )?;
    Ok(format!(
        "Linked \"{subject_label}\" —{predicate}→ \"{object_label}\"."
    ))
}

#[tauri::command]
pub fn unlink_topic_relation_cmd(
    state: State<'_, crate::AppState>,
    relation_id: i64,
) -> Result<String, String> {
    crate::memory::topic_graph::unlink_relation(&state.db_path, relation_id)?;
    Ok(format!("Removed relation {relation_id}."))
}

#[tauri::command]
pub fn list_user_goals_cmd(
    state: State<'_, crate::AppState>,
) -> Result<Vec<UserGoalRecord>, String> {
    crate::gateway::sync::list_user_goals(&state.db_path)
}

#[tauri::command]
pub fn save_user_goal_cmd(
    state: State<'_, crate::AppState>,
    goal: UserGoalRecord,
) -> Result<(), String> {
    crate::gateway::sync::save_user_goal(&state.db_path, &goal)
}

#[tauri::command]
pub fn export_sync_bundle_cmd(
    state: State<'_, crate::AppState>,
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
    passphrase: String,
) -> Result<String, String> {
    crate::gateway::sync::export_sync_bundle(
        &state.db_path,
        gateway_state.app_data_dir(),
        &passphrase,
    )
}

#[tauri::command]
pub fn import_sync_bundle_cmd(
    state: State<'_, crate::AppState>,
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
    bundle_path: String,
    passphrase: String,
) -> Result<String, String> {
    crate::gateway::sync::import_sync_bundle(
        &state.db_path,
        gateway_state.app_data_dir(),
        PathBuf::from(bundle_path).as_path(),
        &passphrase,
    )
}

#[tauri::command]
pub fn list_proactive_nudges_cmd(
    state: State<'_, crate::AppState>,
    limit: Option<usize>,
) -> Result<Vec<ProactiveNudgeRecord>, String> {
    crate::gateway::anomaly::list_recent_nudges(&state.db_path, limit.unwrap_or(10))
}

#[tauri::command]
pub fn dismiss_proactive_nudge_cmd(
    state: State<'_, crate::AppState>,
    id: String,
) -> Result<(), String> {
    crate::gateway::anomaly::dismiss_nudge(&state.db_path, &id)
}

#[tauri::command]
pub fn accept_proactive_nudge_cmd(
    state: State<'_, crate::AppState>,
    id: String,
) -> Result<(), String> {
    crate::gateway::anomaly::accept_nudge(&state.db_path, &id)
}
