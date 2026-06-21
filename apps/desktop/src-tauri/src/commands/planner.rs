use tauri::State;

use crate::memory::{day_plan_store, planner};
use crate::models::DayPlanRecord;
use crate::AppState;

#[tauri::command]
pub fn compose_day_plan(state: State<'_, AppState>) -> Result<DayPlanRecord, String> {
    let config = crate::gateway::config::load_gateway_config(&state.app_data_dir);
    let planner_enabled = config.proactive.planner_copilot_enabled;
    if !planner_enabled {
        return Err("Planner copilot is disabled in gateway settings.".to_string());
    }
    planner::compose_morning_plan(&state.db_path, &state.app_data_dir, Some(&config))
}

#[tauri::command]
pub fn get_day_plan(state: State<'_, AppState>) -> Result<Option<DayPlanRecord>, String> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    day_plan_store::get_day_plan(&state.db_path, &today)
}

#[tauri::command]
pub fn replan_day(state: State<'_, AppState>) -> Result<DayPlanRecord, String> {
    let config = crate::gateway::config::load_gateway_config(&state.app_data_dir);
    planner::replan_day(&state.db_path, &state.app_data_dir, Some(&config))
}

#[tauri::command]
pub fn save_day_plan_to_notion(state: State<'_, AppState>) -> Result<DayPlanRecord, String> {
    planner::save_day_plan_to_notion(&state.db_path)
}

#[tauri::command]
pub fn get_app_feature_flags() -> crate::models::AppFeatureFlags {
    crate::models::AppFeatureFlags {
        embedded_terminal_enabled: crate::env_local::embedded_terminal_enabled(),
    }
}
