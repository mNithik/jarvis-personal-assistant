use tauri::State;

use crate::gateway::ambient::{AmbientSessionRecord, AmbientSuggestionRecord};
use crate::gateway::profiles::UserProfileRecord;
use crate::gateway::skills::InstalledSkillRecord;

#[tauri::command]
pub fn list_user_profiles_cmd(
    state: State<'_, crate::AppState>,
) -> Result<Vec<UserProfileRecord>, String> {
    crate::gateway::profiles::list_profiles(&state.db_path)
}

#[tauri::command]
pub fn get_active_profile_cmd(
    state: State<'_, crate::AppState>,
) -> Result<Option<UserProfileRecord>, String> {
    crate::gateway::profiles::get_active_profile(&state.db_path)
}

#[tauri::command]
pub fn switch_user_profile_cmd(
    state: State<'_, crate::AppState>,
    profile_id: String,
) -> Result<String, String> {
    crate::gateway::profiles::switch_profile(&state.db_path, &state.app_data_dir, &profile_id)
}

#[tauri::command]
pub fn list_installed_skills_cmd(
    state: State<'_, crate::AppState>,
) -> Result<Vec<InstalledSkillRecord>, String> {
    crate::gateway::skills::list_installed_skills(&state.db_path, &state.app_data_dir)
}

#[tauri::command]
pub fn start_ambient_session_cmd(
    state: State<'_, crate::AppState>,
    desktop_project_id: Option<String>,
    ocr_watch_id: Option<String>,
    consent_given: bool,
) -> Result<AmbientSessionRecord, String> {
    crate::gateway::ambient::start_ambient_session(
        &state.db_path,
        desktop_project_id.as_deref(),
        ocr_watch_id.as_deref(),
        consent_given,
    )
}

#[tauri::command]
pub fn end_ambient_session_cmd(
    state: State<'_, crate::AppState>,
    session_id: String,
) -> Result<(), String> {
    crate::gateway::ambient::end_ambient_session(&state.db_path, &session_id)
}

#[tauri::command]
pub fn list_ambient_suggestions_cmd(
    state: State<'_, crate::AppState>,
    limit: Option<usize>,
) -> Result<Vec<AmbientSuggestionRecord>, String> {
    crate::gateway::ambient::list_ambient_suggestions(&state.db_path, limit.unwrap_or(10))
}

#[tauri::command]
pub fn dismiss_ambient_suggestion_cmd(
    state: State<'_, crate::AppState>,
    id: String,
) -> Result<(), String> {
    crate::gateway::ambient::dismiss_ambient_suggestion(&state.db_path, &id)
}

#[tauri::command]
pub fn record_ambient_signal_cmd(
    state: State<'_, crate::AppState>,
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
    signal: String,
) -> Result<Option<AmbientSuggestionRecord>, String> {
    let config = gateway_state
        .config
        .lock()
        .map(|guard| guard.clone())
        .map_err(|error| error.to_string())?;
    crate::gateway::ambient::maybe_suggest_from_signal(&state.db_path, &config, &signal)
}
