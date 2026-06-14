use serde::Serialize;

use super::types::ApprovalRisk;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ToolDefinition {
    pub id: String,
    pub label: String,
    pub risk: ApprovalRisk,
    pub category: String,
}

const TOOL_REGISTRY: &[(&str, &str, ApprovalRisk, &str)] = &[
    ("ping_jarvis", "Ping JARVIS", ApprovalRisk::Read, "system"),
    (
        "preview_gateway_turn",
        "Preview Gateway Turn",
        ApprovalRisk::Read,
        "gateway",
    ),
    (
        "get_gateway_config",
        "Get Gateway Config",
        ApprovalRisk::Read,
        "gateway",
    ),
    (
        "save_gateway_config",
        "Save Gateway Config",
        ApprovalRisk::Write,
        "gateway",
    ),
    (
        "list_gateway_tools",
        "List Gateway Tools",
        ApprovalRisk::Read,
        "gateway",
    ),
    (
        "gateway_run_turn",
        "Gateway Run Turn",
        ApprovalRisk::Read,
        "gateway",
    ),
    (
        "gateway_deny",
        "Gateway Deny",
        ApprovalRisk::Write,
        "gateway",
    ),
    (
        "list_pending_gateway_approvals",
        "List Pending Gateway Approvals",
        ApprovalRisk::Read,
        "gateway",
    ),
    (
        "get_gateway_trace",
        "Get Gateway Trace",
        ApprovalRisk::Read,
        "gateway",
    ),
    (
        "list_mcp_tools",
        "List MCP Tools",
        ApprovalRisk::Read,
        "gateway",
    ),
    (
        "gateway_approve",
        "Gateway Approve",
        ApprovalRisk::Write,
        "gateway",
    ),
    (
        "list_provider_presets",
        "List Provider Presets",
        ApprovalRisk::Read,
        "models",
    ),
    (
        "list_provider_defaults",
        "List Provider Defaults",
        ApprovalRisk::Read,
        "models",
    ),
    (
        "transcribe_groq_audio",
        "Transcribe Groq Audio",
        ApprovalRisk::Read,
        "voice",
    ),
    (
        "launch_study_setup",
        "Launch Study Setup",
        ApprovalRisk::Write,
        "command",
    ),
    (
        "read_screen_uia",
        "Read Screen UIA",
        ApprovalRisk::Read,
        "vision",
    ),
    ("open_browser_url", "Open Browser URL", ApprovalRisk::Write, "command"),
    ("search_local_files", "Search Local Files", ApprovalRisk::Read, "files"),
    (
        "list_recent_local_files",
        "List Recent Local Files",
        ApprovalRisk::Read,
        "files",
    ),
    ("open_local_file", "Open Local File", ApprovalRisk::Write, "files"),
    (
        "launch_desktop_app",
        "Launch Desktop App",
        ApprovalRisk::Write,
        "command",
    ),
    (
        "focus_desktop_app",
        "Focus Desktop App",
        ApprovalRisk::Write,
        "command",
    ),
    (
        "control_desktop_app_window",
        "Control Desktop App Window",
        ApprovalRisk::Write,
        "command",
    ),
    (
        "get_desktop_app_window_status",
        "Get Desktop App Window Status",
        ApprovalRisk::Read,
        "command",
    ),
    ("open_named_folder", "Open Named Folder", ApprovalRisk::Write, "command"),
    (
        "capture_desktop_screenshot",
        "Capture Desktop Screenshot",
        ApprovalRisk::Read,
        "vision",
    ),
    (
        "capture_active_window_screenshot",
        "Capture Active Window Screenshot",
        ApprovalRisk::Read,
        "vision",
    ),
    (
        "capture_desktop_app_window_screenshot",
        "Capture Desktop App Window Screenshot",
        ApprovalRisk::Read,
        "vision",
    ),
    (
        "capture_screen_region_screenshot",
        "Capture Screen Region Screenshot",
        ApprovalRisk::Read,
        "vision",
    ),
    (
        "capture_screen_rect_screenshot",
        "Capture Screen Rect Screenshot",
        ApprovalRisk::Read,
        "vision",
    ),
    (
        "capture_global_selection_screenshot",
        "Capture Global Selection Screenshot",
        ApprovalRisk::Read,
        "vision",
    ),
    (
        "open_screenshots_folder",
        "Open Screenshots Folder",
        ApprovalRisk::Write,
        "vision",
    ),
    (
        "extract_image_ocr_text",
        "Extract Image OCR Text",
        ApprovalRisk::Read,
        "vision",
    ),
    ("read_clipboard_text", "Read Clipboard Text", ApprovalRisk::Read, "system"),
    (
        "write_clipboard_text",
        "Write Clipboard Text",
        ApprovalRisk::Write,
        "system",
    ),
    (
        "run_jarvis_project_checks",
        "Run JARVIS Project Checks",
        ApprovalRisk::Read,
        "builder",
    ),
    ("extract_pdf_text", "Extract PDF Text", ApprovalRisk::Read, "files"),
    ("search_google", "Search Google", ApprovalRisk::Write, "command"),
    ("get_routines", "Get Routines", ApprovalRisk::Read, "memory"),
    ("get_recent_history", "Get Recent History", ApprovalRisk::Read, "memory"),
    ("get_proposals", "Get Proposals", ApprovalRisk::Read, "memory"),
    (
        "generate_learning_proposal",
        "Generate Learning Proposal",
        ApprovalRisk::Write,
        "memory",
    ),
    ("get_proposal_steps", "Get Proposal Steps", ApprovalRisk::Read, "memory"),
    (
        "update_learning_proposal",
        "Update Learning Proposal",
        ApprovalRisk::Write,
        "memory",
    ),
    (
        "approve_learning_proposal",
        "Approve Learning Proposal",
        ApprovalRisk::Write,
        "memory",
    ),
    (
        "reject_learning_proposal",
        "Reject Learning Proposal",
        ApprovalRisk::Write,
        "memory",
    ),
    (
        "get_voice_corrections",
        "Get Voice Corrections",
        ApprovalRisk::Read,
        "voice",
    ),
    (
        "save_voice_correction_entry",
        "Save Voice Correction Entry",
        ApprovalRisk::Write,
        "voice",
    ),
    (
        "get_local_voice_backend_status",
        "Get Local Voice Backend Status",
        ApprovalRisk::Read,
        "voice",
    ),
    (
        "save_local_voice_backend_paths",
        "Save Local Voice Backend Paths",
        ApprovalRisk::Write,
        "voice",
    ),
    (
        "transcribe_local_audio",
        "Transcribe Local Audio",
        ApprovalRisk::Read,
        "voice",
    ),
    (
        "get_local_speech_output_status",
        "Get Local Speech Output Status",
        ApprovalRisk::Read,
        "voice",
    ),
    (
        "save_local_speech_output_paths",
        "Save Local Speech Output Paths",
        ApprovalRisk::Write,
        "voice",
    ),
    ("speak_local_text", "Speak Local Text", ApprovalRisk::Write, "voice"),
    ("get_wake_mode_status", "Get Wake Mode Status", ApprovalRisk::Read, "voice"),
    ("save_wake_mode_status", "Save Wake Mode Status", ApprovalRisk::Write, "voice"),
    ("get_browser_aliases", "Get Browser Aliases", ApprovalRisk::Read, "routing"),
    (
        "save_browser_alias_entry",
        "Save Browser Alias Entry",
        ApprovalRisk::Write,
        "routing",
    ),
    ("get_learned_intents", "Get Learned Intents", ApprovalRisk::Read, "routing"),
    (
        "save_learned_intent_entry",
        "Save Learned Intent Entry",
        ApprovalRisk::Write,
        "routing",
    ),
    (
        "delete_learned_intent_entry",
        "Delete Learned Intent Entry",
        ApprovalRisk::Destructive,
        "routing",
    ),
    (
        "get_google_calendar_status",
        "Get Google Calendar Status",
        ApprovalRisk::Read,
        "integrations",
    ),
    (
        "save_google_calendar_status",
        "Save Google Calendar Status",
        ApprovalRisk::Write,
        "integrations",
    ),
    (
        "get_spotify_status",
        "Get Spotify Status",
        ApprovalRisk::Read,
        "integrations",
    ),
    (
        "save_spotify_status",
        "Save Spotify Status",
        ApprovalRisk::Write,
        "integrations",
    ),
    ("get_notion_status", "Get Notion Status", ApprovalRisk::Read, "integrations"),
    (
        "save_notion_status",
        "Save Notion Status",
        ApprovalRisk::Write,
        "integrations",
    ),
    ("create_notion_note", "Create Notion Note", ApprovalRisk::Write, "integrations"),
    ("create_notion_task", "Create Notion Task", ApprovalRisk::Write, "integrations"),
    ("list_notion_notes", "List Notion Notes", ApprovalRisk::Read, "integrations"),
    (
        "search_notion_notes",
        "Search Notion Notes",
        ApprovalRisk::Read,
        "integrations",
    ),
    (
        "update_notion_note_title",
        "Update Notion Note Title",
        ApprovalRisk::Write,
        "integrations",
    ),
    ("update_notion_task", "Update Notion Task", ApprovalRisk::Write, "integrations"),
    ("get_ollama_status", "Get Ollama Status", ApprovalRisk::Read, "models"),
    ("save_ollama_status", "Save Ollama Status", ApprovalRisk::Write, "models"),
    (
        "interpret_conversation_with_ollama",
        "Interpret Conversation With Ollama",
        ApprovalRisk::Read,
        "models",
    ),
    (
        "generate_missing_skill_plan_with_ollama",
        "Generate Missing Skill Plan With Ollama",
        ApprovalRisk::Read,
        "models",
    ),
    (
        "call_model_provider_chat",
        "Call Model Provider Chat",
        ApprovalRisk::Read,
        "models",
    ),
    (
        "send_chat_with_provider",
        "Send Chat With Provider",
        ApprovalRisk::Read,
        "models",
    ),
    (
        "get_model_provider_secret_status",
        "Get Model Provider Secret Status",
        ApprovalRisk::Read,
        "models",
    ),
    (
        "save_model_provider_secret_entry",
        "Save Model Provider Secret Entry",
        ApprovalRisk::Write,
        "models",
    ),
    ("save_provider_key", "Save Provider Key", ApprovalRisk::Write, "models"),
    ("delete_provider_key", "Delete Provider Key", ApprovalRisk::Destructive, "models"),
    (
        "list_provider_key_status",
        "List Provider Key Status",
        ApprovalRisk::Read,
        "models",
    ),
    ("test_provider_key", "Test Provider Key", ApprovalRisk::Read, "models"),
    (
        "create_build_handoff_artifact",
        "Create Build Handoff Artifact",
        ApprovalRisk::Write,
        "builder",
    ),
    ("get_executor_status", "Get Executor Status", ApprovalRisk::Read, "builder"),
    ("save_executor_status", "Save Executor Status", ApprovalRisk::Write, "builder"),
    (
        "launch_executor_handoff",
        "Launch Executor Handoff",
        ApprovalRisk::Write,
        "builder",
    ),
];

pub fn list_tool_definitions() -> Vec<ToolDefinition> {
    TOOL_REGISTRY
        .iter()
        .map(|(id, label, risk, category)| ToolDefinition {
            id: (*id).to_string(),
            label: (*label).to_string(),
            risk: risk.clone(),
            category: (*category).to_string(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    pub const EXPECTED_INVOKE_HANDLER_TOOL_COUNT: usize = 89;

    #[test]
    fn registry_matches_invoke_handler_count() {
        assert_eq!(
            list_tool_definitions().len(),
            EXPECTED_INVOKE_HANDLER_TOOL_COUNT
        );
    }

    #[test]
    fn destructive_tools_are_tagged() {
        let destructive = list_tool_definitions()
            .into_iter()
            .filter(|tool| tool.risk == ApprovalRisk::Destructive)
            .map(|tool| tool.id)
            .collect::<Vec<_>>();

        assert!(destructive.contains(&"delete_provider_key".to_string()));
        assert!(destructive.contains(&"delete_learned_intent_entry".to_string()));
    }
}
