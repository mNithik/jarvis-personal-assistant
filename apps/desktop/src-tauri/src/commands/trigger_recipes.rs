use std::path::Path;

use tauri::State;

use crate::gateway::trigger_recipes::{
    delete_trigger_recipe, list_trigger_recipes, save_trigger_recipe, seed_default_recipes,
    TriggerRecipeRecord,
};
use crate::AppState;

#[tauri::command]
pub fn list_trigger_recipes_cmd(state: State<'_, AppState>) -> Result<Vec<TriggerRecipeRecord>, String> {
    let config = crate::gateway::config::load_gateway_config(&state.app_data_dir);
    seed_default_recipes(&state.db_path, &config)?;
    list_trigger_recipes(&state.db_path)
}

#[tauri::command]
pub fn save_trigger_recipe_cmd(
    state: State<'_, AppState>,
    recipe: TriggerRecipeRecord,
) -> Result<(), String> {
    save_trigger_recipe(&state.db_path, &recipe)
}

#[tauri::command]
pub fn delete_trigger_recipe_cmd(state: State<'_, AppState>, id: String) -> Result<(), String> {
    delete_trigger_recipe(&state.db_path, &id)
}

#[tauri::command]
pub fn search_audit_log_cmd(
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
    state: State<'_, AppState>,
    query: Option<String>,
    policy_class: Option<String>,
    since: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<crate::gateway::audit::AuditEntry>, String> {
    let _ = state;
    crate::gateway::audit::search_audit_log(
        gateway_state.app_data_dir(),
        query.as_deref(),
        policy_class.as_deref(),
        since.as_deref(),
        limit.unwrap_or(50),
    )
}

#[tauri::command]
pub fn rollback_audit_entry_cmd(
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
    state: State<'_, AppState>,
    line_index: usize,
) -> Result<String, String> {
    crate::gateway::audit::rollback_audit_entry(
        gateway_state.app_data_dir(),
        &state.db_path,
        line_index,
    )
}
