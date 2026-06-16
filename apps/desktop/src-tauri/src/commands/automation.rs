use tauri::State;

use crate::{
    db::automation_store::{
        delete_desktop_schedule, delete_ocr_watch, import_from_local_storage,
        list_desktop_schedules, list_ocr_watches, list_saved_workflows, save_desktop_schedule,
        save_ocr_watch, save_saved_workflow, DesktopScheduleRecord, LocalStorageImportPayload,
        LocalStorageImportResult, OcrWatchRecord, SavedWorkflowRecord,
    },
    AppState,
};

#[tauri::command]
pub fn list_ocr_watches_cmd(state: State<'_, AppState>) -> Result<Vec<OcrWatchRecord>, String> {
    list_ocr_watches(&state.db_path)
}

#[tauri::command]
pub fn save_ocr_watch_cmd(
    state: State<'_, AppState>,
    watch: OcrWatchRecord,
) -> Result<(), String> {
    save_ocr_watch(&state.db_path, &watch)
}

#[tauri::command]
pub fn delete_ocr_watch_cmd(state: State<'_, AppState>, id: String) -> Result<(), String> {
    delete_ocr_watch(&state.db_path, &id)
}

#[tauri::command]
pub fn list_desktop_schedules_cmd(
    state: State<'_, AppState>,
) -> Result<Vec<DesktopScheduleRecord>, String> {
    list_desktop_schedules(&state.db_path)
}

#[tauri::command]
pub fn save_desktop_schedule_cmd(
    state: State<'_, AppState>,
    schedule: DesktopScheduleRecord,
) -> Result<(), String> {
    save_desktop_schedule(&state.db_path, &schedule)
}

#[tauri::command]
pub fn delete_desktop_schedule_cmd(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    delete_desktop_schedule(&state.db_path, &id)
}

#[tauri::command]
pub fn list_saved_workflows_cmd(
    state: State<'_, AppState>,
) -> Result<Vec<SavedWorkflowRecord>, String> {
    list_saved_workflows(&state.db_path)
}

#[tauri::command]
pub fn save_saved_workflow_cmd(
    state: State<'_, AppState>,
    workflow: SavedWorkflowRecord,
) -> Result<(), String> {
    save_saved_workflow(&state.db_path, &workflow)
}

#[tauri::command]
pub fn import_automation_from_local_storage(
    state: State<'_, AppState>,
    payload: LocalStorageImportPayload,
) -> Result<LocalStorageImportResult, String> {
    import_from_local_storage(&state.db_path, &payload)
}
