mod agents;
mod builder;
mod commands;
mod db;
mod env_local;
pub mod gateway;
pub mod integrations;
mod memory;
mod migrations;
mod models;
pub mod providers;
mod tools;
mod training;

pub use db::init_database;

use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    process::Command,
    thread,
    time::{SystemTime, UNIX_EPOCH},
};

use base64::{engine::general_purpose, Engine as _};
use keyring::Entry;
use reqwest::blocking::Client;
use serde::de::DeserializeOwned;
use serde_json::json;
use tauri::{Manager, State};

use crate::{
    db::{
        approve_proposal, clear_legacy_model_provider_secret, delete_learned_intent,
        delete_provider_credential_metadata, generate_study_proposal, get_executor_config,
        get_google_calendar_config, get_local_tts_backend_config, get_local_voice_backend_config,
        get_notion_config, get_ollama_config, get_provider_credential_metadata,
        get_secrets_migration_version, get_spotify_config, get_wake_mode_config,
        list_browser_aliases, list_history, list_learned_intents,
        list_legacy_model_provider_secrets, list_proposal_steps, list_proposals,
        list_provider_credential_metadata, list_routines, list_voice_corrections, log_action,
        reject_proposal, save_browser_alias, save_executor_config, save_google_calendar_config,
        save_learned_intent, save_local_tts_backend_config, save_local_voice_backend_config,
        save_notion_config, save_ollama_config, save_spotify_config, save_voice_correction,
        save_wake_mode_config, set_secrets_migration_version, update_proposal,
        upsert_provider_credential_metadata,
    },
    models::{
        BrowserAliasRecord, BuildHandoffArtifact, ConversationInterpretation,
        ConversationInterpretationRequest, ExecutorLaunchRequest, ExecutorStatus, FileRecord,
        GoogleCalendarStatus, HistoryRecord, LearnedIntentRecord, LocalSpeechOutputStatus,
        LocalVoiceBackendStatus, MissingSkillPlan, MissingSkillPlanRequest,
        ModelProviderChatRequest, ModelProviderChatResponse, ModelProviderSecretRequest,
        ModelProviderSecretStatus, NoteRecord, NotionStatus, OllamaStatus, ProposalRecord,
        ProposalStepRecord, ProposalUpdateInput, RoutineRecord, SkillBuildRequestInput,
        SpotifyStatus, VoiceCorrectionRecord, WakeModeStatus,
    },
};

pub struct AppState {
    db_path: PathBuf,
    app_data_dir: PathBuf,
}

const NOTION_VERSION: &str = "2022-06-28";
const KEYRING_SERVICE_NAME: &str = "jarvis-ai-assistant";

fn account_for_provider(provider: &str) -> String {
    format!("provider:{}:default", provider.trim().to_lowercase())
}

fn provider_display_name(provider: &str) -> String {
    match provider {
        "nvidia_nim" => "NVIDIA Build / NIM",
        "gemini" => "Gemini",
        "groq" => "Groq",
        "openrouter" => "OpenRouter",
        "huggingface" => "Hugging Face",
        "openai" => "OpenAI",
        "anthropic" => "Anthropic",
        "local_ollama" => "Local Ollama",
        "lm_studio" => "LM Studio",
        _ => provider,
    }
    .to_string()
}

fn key_ref_for_provider(provider: &str) -> String {
    format!(
        "{}:{}",
        KEYRING_SERVICE_NAME,
        account_for_provider(provider)
    )
}

fn mask_api_key(api_key: &str) -> Option<String> {
    let trimmed = api_key.trim();
    if trimmed.is_empty() {
        return None;
    }
    let prefix: String = trimmed.chars().take(6).collect();
    let suffix_chars: Vec<char> = trimmed.chars().rev().take(4).collect();
    let suffix: String = suffix_chars.into_iter().rev().collect();
    Some(format!("{}****{}", prefix, suffix))
}

fn save_provider_key_to_keyring(provider: &str, api_key: &str) -> Result<(), String> {
    if api_key.trim().is_empty() {
        return Err("API key cannot be empty.".to_string());
    }
    let account = account_for_provider(provider);
    let entry = Entry::new(KEYRING_SERVICE_NAME, &account).map_err(|error| {
        format!(
            "Failed to create Windows Credential Manager entry: {}",
            error
        )
    })?;
    entry.set_password(api_key.trim()).map_err(|error| {
        format!(
            "Failed to save API key in Windows Credential Manager: {}",
            error
        )
    })
}

fn get_provider_key_for_backend_only(provider: &str) -> Result<String, String> {
    if let Some(key) = env_local::provider_api_key(provider) {
        return Ok(key);
    }

    let account = account_for_provider(provider);
    let entry = Entry::new(KEYRING_SERVICE_NAME, &account)
        .map_err(|error| format!("Failed to open Windows Credential Manager entry: {}", error))?;
    entry.get_password().map_err(|error| {
        format!(
            "Failed to read API key from Windows Credential Manager: {}",
            error
        )
    })
}

fn delete_provider_key_from_keyring(provider: &str) -> Result<(), String> {
    let account = account_for_provider(provider);
    let entry = Entry::new(KEYRING_SERVICE_NAME, &account)
        .map_err(|error| format!("Failed to open Windows Credential Manager entry: {}", error))?;
    entry.delete_credential().map_err(|error| {
        format!(
            "Failed to delete API key from Windows Credential Manager: {}",
            error
        )
    })
}

fn has_provider_key_in_keyring(provider: &str) -> bool {
    get_provider_key_for_backend_only(provider)
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
}

fn save_google_session_token_to_keyring(kind: &str, token: &str) -> Result<(), String> {
    crate::integrations::google::auth::save_session_token_to_keyring(kind, token)
}

fn get_google_session_token_from_keyring(kind: &str) -> Result<String, String> {
    crate::integrations::google::auth::get_session_token_from_keyring(kind)
}

fn clear_google_session_token_from_keyring(kind: &str) -> Result<(), String> {
    crate::integrations::google::auth::clear_session_token_from_keyring(kind)
}

fn user_documents_dir() -> Result<PathBuf, String> {
    let user_profile = std::env::var("USERPROFILE")
        .map_err(|error| format!("Could not resolve USERPROFILE for file search: {}", error))?;
    Ok(Path::new(&user_profile).join("Documents"))
}

fn user_profile_dir() -> Result<PathBuf, String> {
    let user_profile = std::env::var("USERPROFILE")
        .map_err(|error| format!("Could not resolve USERPROFILE: {}", error))?;
    Ok(PathBuf::from(user_profile))
}

fn system_time_to_iso(time: SystemTime) -> String {
    let duration = time.duration_since(UNIX_EPOCH).unwrap_or_default();
    duration.as_secs().to_string()
}

#[tauri::command]
fn preview_gateway_turn(
    request: crate::gateway::types::TurnRequest,
) -> Result<crate::gateway::orchestrator::GatewayPreview, String> {
    if request.command.trim().is_empty() {
        return Err("Gateway preview needs a command to route.".to_string());
    }

    let session_id = request
        .session_id
        .clone()
        .unwrap_or_else(|| format!("gateway-preview-{}", system_time_to_iso(SystemTime::now())));
    let router_context = crate::gateway::router::RouterContext {
        db_path: None,
        app_data_dir: None,
        config: crate::gateway::config::GatewayConfig::default(),
    };

    Ok(
        crate::gateway::orchestrator::GatewayOrchestrator::preview_turn(
            request,
            1,
            &session_id,
            &router_context,
        ),
    )
}

#[tauri::command]
fn get_gateway_config(
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
) -> Result<crate::gateway::config::GatewayConfig, String> {
    gateway_state
        .config
        .lock()
        .map(|config| config.clone())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn get_gateway_audit_log(
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
    limit: Option<usize>,
) -> Result<Vec<String>, String> {
    crate::gateway::audit::read_recent_entries(gateway_state.app_data_dir(), limit.unwrap_or(50))
}

#[tauri::command]
fn list_gateway_task_runs(
    state: State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<crate::gateway::task_run::TaskRunSummary>, String> {
    let records = crate::db::list_recent_task_states(&state.db_path, limit.unwrap_or(20))?;
    Ok(records
        .iter()
        .map(crate::gateway::task_run::summary_from_task_state)
        .collect())
}

#[tauri::command]
fn list_project_bundles(
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
    limit: Option<usize>,
) -> Result<Vec<crate::gateway::labs::ProjectBundleRecord>, String> {
    crate::gateway::labs::list_project_bundles(gateway_state.app_data_dir(), limit.unwrap_or(5))
}

#[tauri::command]
fn memory_list_entity_controls(
    state: State<'_, AppState>,
    domain: String,
) -> Result<Vec<crate::memory::controls::MemoryEntityControl>, String> {
    crate::memory::controls::list_entity_controls(&state.db_path, &domain)
}

#[tauri::command]
fn memory_set_entity_control(
    state: State<'_, AppState>,
    domain: String,
    entity_id: i64,
    pinned: Option<bool>,
    forgotten: Option<bool>,
    confidence: Option<String>,
) -> Result<crate::memory::controls::MemoryEntityControl, String> {
    crate::memory::controls::set_entity_control_flags(
        &state.db_path,
        &domain,
        entity_id,
        pinned,
        forgotten,
        confidence.as_deref(),
    )
}

#[tauri::command]
fn memory_correct_entity(
    state: State<'_, AppState>,
    domain: String,
    entity_id: i64,
    field: String,
    new_value: String,
) -> Result<crate::memory::controls::MemoryEntityControl, String> {
    crate::memory::controls::correct_entity_field(
        &state.db_path,
        &domain,
        entity_id,
        &field,
        &new_value,
    )
}

#[tauri::command]
fn save_gateway_config(
    app: tauri::AppHandle,
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
    config: crate::gateway::config::GatewayConfig,
) -> Result<(), String> {
    gateway_state.save_config(&config)?;
    crate::memory::cag::invalidate_cag_cache();
    let _ = crate::memory::cag::ensure_default_cag_policy(gateway_state.app_data_dir());
    crate::gateway::local_turn_api::sync_local_turn_api(app.clone());
    crate::gateway::telegram::sync_telegram_bot(app.clone());
    crate::gateway::discord::sync_discord_bot(app.clone());
    Ok(())
}

#[tauri::command]
fn get_discord_bot_status() -> crate::gateway::discord::DiscordBotStatus {
    crate::gateway::discord::get_discord_bot_status()
}

#[tauri::command]
fn apply_gateway_easy_preset(
    app: tauri::AppHandle,
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
) -> Result<crate::gateway::config::GatewayConfig, String> {
    let preset = crate::gateway::config::gateway_easy_mode_preset();
    gateway_state.save_config(&preset)?;
    crate::memory::cag::invalidate_cag_cache();
    let _ = crate::memory::cag::ensure_default_cag_policy(gateway_state.app_data_dir());
    crate::gateway::local_turn_api::sync_local_turn_api(app.clone());
    crate::gateway::telegram::sync_telegram_bot(app.clone());
    crate::gateway::discord::sync_discord_bot(app.clone());
    Ok(preset)
}

#[tauri::command]
fn get_telegram_bot_status() -> crate::gateway::telegram::TelegramBotStatus {
    crate::gateway::telegram::get_telegram_bot_status()
}

#[tauri::command]
fn list_trigger_events(
    app_state: State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<crate::gateway::trigger_queue::TriggerEvent>, String> {
    let conn = rusqlite::Connection::open(&app_state.db_path).map_err(|error| error.to_string())?;
    crate::gateway::trigger_queue::list_trigger_events(&conn, limit.unwrap_or(20))
}

#[tauri::command]
fn get_local_turn_api_status() -> crate::gateway::local_turn_api::LocalTurnApiStatus {
    crate::gateway::local_turn_api::get_local_turn_api_status()
}

#[tauri::command]
fn get_jarvis_service_status(
    app_state: State<'_, AppState>,
) -> crate::gateway::runtime::headless::JarvisServiceStatus {
    crate::gateway::runtime::headless::read_service_status(&app_state.app_data_dir)
}

#[tauri::command]
fn get_trigger_queue_status(app_state: State<'_, AppState>) -> Result<u32, String> {
    let conn = rusqlite::Connection::open(&app_state.db_path).map_err(|error| error.to_string())?;
    crate::gateway::trigger_queue::count_pending_triggers(&conn)
}

#[tauri::command]
fn list_gateway_tools() -> Vec<crate::gateway::tools::ToolDefinition> {
    crate::gateway::tools::list_tool_definitions()
}

#[tauri::command]
fn gateway_run_turn(
    app_state: State<'_, AppState>,
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
    request: crate::gateway::types::TurnRequest,
) -> Result<crate::gateway::orchestrator::GatewayTurnResponse, String> {
    if request.command.trim().is_empty() {
        return Err("Gateway turn needs a command to route.".to_string());
    }

    let idempotency_key = request
        .idempotency_key
        .as_deref()
        .map(str::trim)
        .filter(|key| !key.is_empty())
        .map(str::to_string);
    if let Some(key) = idempotency_key.as_deref() {
        if let Some(response) = gateway_state.get_idempotent_response(key)? {
            return Ok(response);
        }
    }

    let session_id = request
        .session_id
        .clone()
        .unwrap_or_else(|| format!("gateway-session-{}", system_time_to_iso(SystemTime::now())));
    let turn_id = gateway_state.next_turn_id(&session_id)?;
    let config = gateway_state
        .config
        .lock()
        .map(|config| config.clone())
        .map_err(|error| error.to_string())?;
    let mut bus = gateway_state
        .bus
        .lock()
        .map_err(|error| error.to_string())?;
    let mut escalation = gateway_state
        .escalation
        .lock()
        .map_err(|error| error.to_string())?;
    let router_context = crate::gateway::router::RouterContext {
        db_path: Some(app_state.db_path.clone()),
        app_data_dir: Some(app_state.app_data_dir.clone()),
        config: config.clone(),
    };
    let groq_api_key = if config.voice.talker_enabled {
        get_provider_key_for_backend_only("groq").ok()
    } else {
        None
    };
    let execution = crate::gateway::orchestrator::TurnExecutionEnv {
        db_path: &app_state.db_path,
        app_data_dir: &app_state.app_data_dir,
        escalation: &mut escalation,
    };

    let response = crate::gateway::orchestrator::GatewayOrchestrator::run_turn(
        request.clone(),
        turn_id,
        &session_id,
        &config,
        &router_context,
        &mut bus,
        groq_api_key,
        Some(execution),
    );

    if response.awaiting_approval {
        if let Some(approval) = response.approval.clone() {
            gateway_state.store_pending_approval(crate::gateway::state::PendingApproval {
                request: approval,
                correlation_id: response.correlation_id.clone(),
                command: request.command,
            })?;
        }
    }

    if let Some(key) = idempotency_key.as_deref() {
        gateway_state.store_idempotent_response(key, response.clone())?;
    }

    Ok(response)
}

#[tauri::command]
fn list_provider_presets() -> Vec<providers::presets::ModelPreset> {
    providers::list_model_presets()
}

#[tauri::command]
fn list_provider_defaults() -> Vec<providers::presets::ProviderDefaults> {
    providers::list_provider_defaults()
}

#[tauri::command]
fn transcribe_groq_audio(audio_base64: String) -> Result<String, String> {
    let api_key = get_provider_key_for_backend_only("groq")?;
    providers::groq_stt::transcribe_audio_base64(&api_key, &audio_base64)
}

#[tauri::command]
fn list_pending_gateway_approvals(
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
) -> Result<Vec<crate::gateway::types::ApprovalRequest>, String> {
    gateway_state.list_pending_approvals()
}

#[tauri::command]
fn get_gateway_trace(
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
    limit: Option<usize>,
) -> Result<Vec<crate::gateway::types::GatewayEvent>, String> {
    gateway_state.recent_trace(limit.unwrap_or(20))
}

#[tauri::command]
fn list_mcp_tools(read_only: Option<bool>) -> Vec<crate::gateway::mcp::McpToolDescriptor> {
    crate::gateway::mcp::list_mcp_tools(read_only.unwrap_or(true))
}

#[tauri::command]
fn list_gateway_capabilities() -> Vec<crate::gateway::capabilities::CapabilityRecord> {
    crate::gateway::capabilities::list_capabilities()
}

#[tauri::command]
fn list_mcp_host_registry(
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
) -> Result<Vec<crate::gateway::mcp::McpHostEntry>, String> {
    let config = gateway_state
        .config
        .lock()
        .map_err(|error| error.to_string())?;
    Ok(crate::gateway::mcp::list_mcp_hosts(&config.mcp_hosts))
}

#[tauri::command]
fn gateway_mcp_call_tool(
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
    host_id: String,
    tool_name: String,
    arguments: Option<serde_json::Value>,
) -> Result<String, String> {
    let config = gateway_state
        .config
        .lock()
        .map_err(|error| error.to_string())?;
    crate::gateway::mcp_host::call_mcp_tool(
        &config,
        host_id.trim(),
        tool_name.trim(),
        arguments.unwrap_or_else(|| serde_json::json!({})),
    )
}

#[tauri::command]
fn list_mcp_presets() -> Vec<crate::gateway::mcp_presets::McpHostPreset> {
    crate::gateway::mcp_presets::list_mcp_presets()
}

#[tauri::command]
fn test_mcp_host_connection(
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
    host_id: String,
) -> Result<String, String> {
    let config = gateway_state
        .config
        .lock()
        .map_err(|error| error.to_string())?;
    crate::gateway::mcp_presets::test_mcp_host_connection(&config, host_id.trim())
}

#[tauri::command]
fn gateway_channel_turn(
    app_state: State<'_, AppState>,
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
    payload: String,
) -> Result<crate::gateway::orchestrator::GatewayTurnResponse, String> {
    let request: crate::gateway::channels::ChannelTurnRequest =
        crate::gateway::channels::parse_local_channel_payload(&payload)?;
    let turn_request: crate::gateway::types::TurnRequest = request.into();
    let session_id = turn_request
        .session_id
        .clone()
        .unwrap_or_else(|| "channel-session".to_string());
    let turn_id = gateway_state.next_turn_id(&session_id)?;
    let config = gateway_state
        .config
        .lock()
        .map_err(|error| error.to_string())?
        .clone();
    let mut bus = gateway_state
        .bus
        .lock()
        .map_err(|error| error.to_string())?;
    let mut escalation = gateway_state
        .escalation
        .lock()
        .map_err(|error| error.to_string())?;
    let router_context = crate::gateway::router::RouterContext {
        db_path: Some(app_state.db_path.clone()),
        app_data_dir: Some(app_state.app_data_dir.clone()),
        config: config.clone(),
    };
    let execution = crate::gateway::orchestrator::TurnExecutionEnv {
        db_path: &app_state.db_path,
        app_data_dir: &app_state.app_data_dir,
        escalation: &mut escalation,
    };
    Ok(crate::gateway::orchestrator::GatewayOrchestrator::run_turn(
        turn_request,
        turn_id,
        &session_id,
        &config,
        &router_context,
        &mut bus,
        None,
        Some(execution),
    ))
}

#[tauri::command]
fn export_training_turn(
    app_state: State<'_, AppState>,
    phrase: String,
    capability_id: String,
    route_level: String,
    tools: Vec<String>,
    success: bool,
    latency_ms: u64,
) -> Result<String, String> {
    let export_path = app_state.app_data_dir.join("training-export.jsonl");
    let record = crate::training::training_export::TrainingTurnRecord {
        phrase: crate::training::training_export::anonymize_phrase(&phrase),
        capability_id,
        route_level,
        tools,
        success,
        latency_ms,
        exported_at: system_time_to_iso(SystemTime::now()),
    };
    crate::training::training_export::append_training_record(&export_path, &record)?;
    Ok(export_path.display().to_string())
}

#[tauri::command]
fn run_training_eval_gate(
    app_state: State<'_, AppState>,
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
) -> Result<crate::training::eval_gate::TrainingEvalGateResult, String> {
    let config = gateway_state
        .config
        .lock()
        .map_err(|error| error.to_string())?
        .clone();
    let export_path = app_state.app_data_dir.join("training-export.jsonl");
    crate::training::eval_gate::run_training_eval_gate(&config, &export_path)
}

#[tauri::command]
fn anonymize_training_export(app_state: State<'_, AppState>) -> Result<String, String> {
    let input_path = app_state.app_data_dir.join("training-export.jsonl");
    let output_path = app_state
        .app_data_dir
        .join("training-export-anonymized.jsonl");
    let count = crate::training::eval_gate::anonymize_export_file(&input_path, &output_path)?;
    Ok(format!(
        "Anonymized {count} records to {}",
        output_path.display()
    ))
}

#[tauri::command]
fn prepare_database_migrations(app_state: State<'_, AppState>) -> Result<String, String> {
    let connection =
        rusqlite::Connection::open(&app_state.db_path).map_err(|error| error.to_string())?;
    let version = crate::migrations::apply_pending_migrations(&connection, &app_state.db_path)?;
    Ok(format!("Migration framework ready at version {version}."))
}

#[tauri::command]
fn gateway_approve(
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
    approval_id: String,
) -> Result<crate::gateway::orchestrator::GatewayApprovalResolution, String> {
    let pending = gateway_state
        .take_pending_approval(&approval_id)?
        .ok_or_else(|| format!("No pending approval found for {approval_id}"))?;
    let config = gateway_state
        .config
        .lock()
        .map_err(|error| error.to_string())?
        .clone();
    let mut bus = gateway_state
        .bus
        .lock()
        .map_err(|error| error.to_string())?;

    Ok(
        crate::gateway::orchestrator::GatewayOrchestrator::resolve_approval(
            &pending, true, &config, &mut bus,
        ),
    )
}

#[tauri::command]
fn gateway_deny(
    gateway_state: State<'_, crate::gateway::state::GatewayState>,
    approval_id: String,
) -> Result<crate::gateway::orchestrator::GatewayApprovalResolution, String> {
    let pending = gateway_state
        .take_pending_approval(&approval_id)?
        .ok_or_else(|| format!("No pending approval found for {approval_id}"))?;
    let config = gateway_state
        .config
        .lock()
        .map_err(|error| error.to_string())?
        .clone();
    let mut bus = gateway_state
        .bus
        .lock()
        .map_err(|error| error.to_string())?;

    Ok(
        crate::gateway::orchestrator::GatewayOrchestrator::resolve_approval(
            &pending, false, &config, &mut bus,
        ),
    )
}

fn collect_files_recursively(base_dir: &Path, files: &mut Vec<FileRecord>) -> Result<(), String> {
    let entries = fs::read_dir(base_dir).map_err(|error| error.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();

        if path.is_dir() {
            let _ = collect_files_recursively(&path, files);
            continue;
        }

        if path.is_file() {
            let metadata = entry.metadata().map_err(|error| error.to_string())?;
            let modified = metadata
                .modified()
                .map(system_time_to_iso)
                .unwrap_or_else(|_| String::new());
            let name = path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
                .to_string();

            files.push(FileRecord {
                path: path.to_string_lossy().to_string(),
                name,
                modified_at: modified,
            });
        }
    }

    Ok(())
}

fn read_pdf_text_from_path(path: &Path) -> Result<String, String> {
    if !path.exists() {
        return Err("That PDF path does not exist.".to_string());
    }

    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_lowercase();
    if extension != "pdf" {
        return Err("That file is not a PDF.".to_string());
    }

    pdf_extract::extract_text(path)
        .map(|value| value.replace('\u{0}', " ").replace("\r\n", "\n"))
        .map_err(|error| format!("Could not read PDF text: {}", error))
}

fn send_ollama_generate_request(
    base_url: &str,
    payload: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let normalized_base = base_url.trim_end_matches('/');
    let mut attempt_urls = vec![format!("{}/api/generate", normalized_base)];
    if normalized_base.contains("127.0.0.1") {
        attempt_urls.push(format!(
            "{}/api/generate",
            normalized_base.replace("127.0.0.1", "localhost")
        ));
    } else if normalized_base.contains("localhost") {
        attempt_urls.push(format!(
            "{}/api/generate",
            normalized_base.replace("localhost", "127.0.0.1")
        ));
    }

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|error| format!("Failed to initialize Ollama client: {}", error))?;

    let mut last_error: Option<String> = None;
    for url in attempt_urls {
        for attempt in 1..=2 {
            let response = client.post(&url).json(&payload).send();
            match response {
                Ok(response) => {
                    let status = response.status();
                    let body = response
                        .text()
                        .map_err(|error| format!("Failed to read Ollama response: {}", error))?;

                    if !status.is_success() {
                        return Err(format!("Ollama returned {}: {}", status, body.trim()));
                    }

                    return serde_json::from_str(&body).map_err(|error| {
                        format!(
                            "Failed to parse Ollama response JSON: {}. Body: {}",
                            error,
                            body.trim()
                        )
                    });
                }
                Err(error) => {
                    last_error = Some(format!(
                        "Failed to reach Ollama at {} (attempt {}): {}",
                        url, attempt, error
                    ));
                    if attempt == 1 {
                        thread::sleep(std::time::Duration::from_millis(300));
                    }
                }
            }
        }
    }

    Err(last_error.unwrap_or_else(|| "Failed to reach Ollama.".to_string()))
}

fn notion_client() -> Result<Client, String> {
    Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|error| format!("Failed to initialize Notion client: {}", error))
}

fn notion_headers(token: &str) -> Result<reqwest::header::HeaderMap, String> {
    use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};

    let mut headers = HeaderMap::new();
    let bearer = format!("Bearer {}", token);
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&bearer).map_err(|error| error.to_string())?,
    );
    headers.insert(
        "Notion-Version",
        HeaderValue::from_str(NOTION_VERSION).map_err(|error| error.to_string())?,
    );
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    Ok(headers)
}

fn extract_notion_title_property(database: &serde_json::Value) -> Result<String, String> {
    database
        .get("properties")
        .and_then(|value| value.as_object())
        .and_then(|properties| {
            properties.iter().find_map(|(name, property)| {
                property
                    .get("type")
                    .and_then(|value| value.as_str())
                    .is_some_and(|kind| kind == "title")
                    .then(|| name.to_string())
            })
        })
        .ok_or_else(|| "Could not find the title property in the Notion database.".to_string())
}

fn extract_notion_title(page: &serde_json::Value, title_property_name: &str) -> String {
    page.get("properties")
        .and_then(|value| value.get(title_property_name))
        .and_then(|value| value.get("title"))
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.get("plain_text").and_then(|value| value.as_str()))
                .collect::<Vec<_>>()
                .join("")
        })
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "Untitled note".to_string())
}

fn extract_notion_plain_text(items: &[serde_json::Value]) -> String {
    items
        .iter()
        .filter_map(|item| item.get("plain_text").and_then(|value| value.as_str()))
        .collect::<Vec<_>>()
        .join("")
}

fn find_notion_property_name(
    database: &serde_json::Value,
    candidates: &[&str],
    supported_types: &[&str],
) -> Option<(String, String)> {
    let properties = database.get("properties")?.as_object()?;

    for candidate in candidates {
        for (name, property) in properties {
            let property_type = property.get("type")?.as_str()?;
            if !supported_types.contains(&property_type) {
                continue;
            }

            if name.eq_ignore_ascii_case(candidate) {
                return Some((name.to_string(), property_type.to_string()));
            }
        }
    }

    for candidate in candidates {
        let normalized_candidate = candidate.to_lowercase();
        for (name, property) in properties {
            let property_type = property.get("type")?.as_str()?;
            if !supported_types.contains(&property_type) {
                continue;
            }

            if name.to_lowercase().contains(&normalized_candidate) {
                return Some((name.to_string(), property_type.to_string()));
            }
        }
    }

    None
}

fn extract_notion_property_display_value(
    page: &serde_json::Value,
    property_name: &str,
    property_type: &str,
) -> Option<String> {
    let property = page.get("properties")?.get(property_name)?;
    let value = match property_type {
        "status" => property
            .get("status")
            .and_then(|value| value.get("name"))
            .and_then(|value| value.as_str())
            .map(|value| value.to_string()),
        "select" => property
            .get("select")
            .and_then(|value| value.get("name"))
            .and_then(|value| value.as_str())
            .map(|value| value.to_string()),
        "date" => property
            .get("date")
            .and_then(|value| value.get("start"))
            .and_then(|value| value.as_str())
            .map(|value| value.to_string()),
        "rich_text" => property
            .get("rich_text")
            .and_then(|value| value.as_array())
            .map(|entries| extract_notion_plain_text(entries)),
        _ => None,
    }?;

    let trimmed = value.trim().to_string();
    (!trimmed.is_empty()).then_some(trimmed)
}

fn map_notion_note_record(
    page: &serde_json::Value,
    title_property_name: &str,
    database: &serde_json::Value,
) -> NoteRecord {
    let title = extract_notion_title(page, title_property_name);
    let url = page
        .get("url")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    let id = page
        .get("id")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    let last_edited_time = page
        .get("last_edited_time")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    let status_property =
        find_notion_property_name(database, &["Status"], &["status", "select", "rich_text"]);
    let due_property = find_notion_property_name(
        database,
        &["Due", "Due Date", "Deadline"],
        &["date", "rich_text"],
    );

    let mut summary_lines = Vec::new();
    if let Some((property_name, property_type)) = status_property {
        if let Some(value) =
            extract_notion_property_display_value(page, &property_name, &property_type)
        {
            summary_lines.push(format!("Status: {}", value));
        }
    }

    if let Some((property_name, property_type)) = due_property {
        if let Some(value) =
            extract_notion_property_display_value(page, &property_name, &property_type)
        {
            summary_lines.push(format!("Due: {}", value));
        }
    }

    let summary = if summary_lines.is_empty() {
        title.clone()
    } else {
        summary_lines.join("\n")
    };

    NoteRecord {
        id,
        summary,
        title,
        url,
        last_edited_time,
    }
}

fn build_notion_task_title(
    title: &str,
    due_label: Option<&str>,
    status: &str,
    has_due_metadata: bool,
    has_status_metadata: bool,
) -> String {
    let mut value = format!("Task: {}", title.trim());
    if !has_due_metadata {
        if let Some(due) = due_label.filter(|candidate| !candidate.trim().is_empty()) {
            value.push_str(&format!(" | Due: {}", due.trim()));
        }
    }

    if !has_status_metadata {
        value.push_str(&format!(" | Status: {}", status.trim()));
    }

    value
}

fn insert_notion_task_properties(
    database: &serde_json::Value,
    properties: &mut serde_json::Map<String, serde_json::Value>,
    due_label: Option<&str>,
    due_iso: Option<&str>,
    status: &str,
) {
    if let Some((property_name, property_type)) =
        find_notion_property_name(database, &["Status"], &["status", "select", "rich_text"])
    {
        let trimmed_status = status.trim();
        let value = match property_type.as_str() {
            "status" => json!({ "status": { "name": trimmed_status } }),
            "select" => json!({ "select": { "name": trimmed_status } }),
            "rich_text" => json!({
                "rich_text": [
                    {
                        "text": { "content": trimmed_status }
                    }
                ]
            }),
            _ => serde_json::Value::Null,
        };

        if !value.is_null() {
            properties.insert(property_name, value);
        }
    }

    if let Some((property_name, property_type)) = find_notion_property_name(
        database,
        &["Due", "Due Date", "Deadline"],
        &["date", "rich_text"],
    ) {
        let value = match property_type.as_str() {
            "date" => due_iso
                .filter(|candidate| !candidate.trim().is_empty())
                .map(|candidate| json!({ "date": { "start": candidate.trim() } })),
            "rich_text" => due_label
                .filter(|candidate| !candidate.trim().is_empty())
                .map(|candidate| {
                    json!({
                        "rich_text": [
                            {
                                "text": { "content": candidate.trim() }
                            }
                        ]
                    })
                }),
            _ => None,
        };

        if let Some(value) = value {
            properties.insert(property_name, value);
        }
    }
}

fn extract_ollama_response_text(response_value: &serde_json::Value) -> Option<String> {
    response_value
        .get("response")
        .and_then(|value| value.as_str())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or_else(|| {
            response_value
                .get("thinking")
                .and_then(|value| value.as_str())
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        })
        .or_else(|| {
            response_value
                .get("message")
                .and_then(|value| value.get("content"))
                .and_then(|value| value.as_str())
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        })
}

fn request_ollama_response_text(
    base_url: &str,
    model_name: &str,
    prompt: &str,
) -> Result<String, String> {
    let strict_response = send_ollama_generate_request(
        base_url,
        json!({
            "model": model_name,
            "prompt": prompt,
            "stream": false,
            "format": "json",
            "options": {
                "temperature": 0
            }
        }),
    )?;

    if let Some(content) = extract_ollama_response_text(&strict_response) {
        return Ok(content);
    }

    let fallback_prompt = format!(
        "{prompt}\n\nReturn exactly one JSON object and nothing else. Do not leave the response empty.",
        prompt = prompt
    );

    let fallback_response = send_ollama_generate_request(
        base_url,
        json!({
            "model": model_name,
            "prompt": fallback_prompt,
            "stream": false,
            "options": {
                "temperature": 0
            }
        }),
    )?;

    extract_ollama_response_text(&fallback_response).ok_or_else(|| {
        format!(
            "Ollama returned an empty response. Raw payload: {}",
            fallback_response
        )
    })
}

#[tauri::command]
fn call_model_provider_chat(
    request: ModelProviderChatRequest,
) -> Result<ModelProviderChatResponse, String> {
    let provider_id = request.provider_id.trim().to_string();
    let stored_api_key = if providers::presets::requires_stored_key(&provider_id) {
        Some(get_provider_key_for_backend_only(&provider_id)?)
    } else {
        None
    };
    providers::openai_compat::chat(request, stored_api_key)
}

#[tauri::command]
fn get_model_provider_secret_status(
    state: State<'_, AppState>,
    provider_id: String,
) -> Result<ModelProviderSecretStatus, String> {
    let provider = provider_id.trim().to_lowercase();
    let metadata = get_provider_credential_metadata(&state.db_path, &provider)?;
    let has_api_key = has_provider_key_in_keyring(&provider);
    Ok(metadata.unwrap_or_else(|| ModelProviderSecretStatus {
        provider_id: provider.clone(),
        display_name: provider_display_name(&provider),
        has_api_key,
        key_ref: key_ref_for_provider(&provider),
        masked_preview: None,
        enabled: has_api_key,
        last_validated_at: None,
        updated_at: None,
    }))
}

#[tauri::command]
fn save_model_provider_secret_entry(
    state: State<'_, AppState>,
    request: ModelProviderSecretRequest,
) -> Result<ModelProviderSecretStatus, String> {
    let provider_id = request.provider_id.trim().to_string();
    if provider_id.is_empty() {
        return Err("Model provider is missing.".to_string());
    }
    let api_key = request
        .api_key
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "API key cannot be empty.".to_string())?;
    save_provider_key_to_keyring(&provider_id, api_key)?;
    let verified_key = get_provider_key_for_backend_only(&provider_id)?;
    if verified_key.trim().is_empty() {
        return Err("Windows Credential Manager saved an empty API key.".to_string());
    }
    upsert_provider_credential_metadata(
        &state.db_path,
        &provider_id,
        &provider_display_name(&provider_id),
        &key_ref_for_provider(&provider_id),
        mask_api_key(api_key).as_deref(),
        true,
        None,
    )?;
    get_model_provider_secret_status(state, provider_id)
}

#[tauri::command]
fn save_provider_key(
    state: State<'_, AppState>,
    request: ModelProviderSecretRequest,
) -> Result<ModelProviderSecretStatus, String> {
    save_model_provider_secret_entry(state, request)
}

#[tauri::command]
fn send_chat_with_provider(
    request: ModelProviderChatRequest,
) -> Result<ModelProviderChatResponse, String> {
    call_model_provider_chat(request)
}

#[tauri::command]
fn delete_provider_key(
    state: State<'_, AppState>,
    provider_id: String,
) -> Result<ModelProviderSecretStatus, String> {
    let provider = provider_id.trim().to_lowercase();
    if provider.is_empty() {
        return Err("Model provider is missing.".to_string());
    }
    let _ = delete_provider_key_from_keyring(&provider);
    delete_provider_credential_metadata(&state.db_path, &provider)?;
    get_model_provider_secret_status(state, provider)
}

#[tauri::command]
fn list_provider_key_status(
    state: State<'_, AppState>,
) -> Result<Vec<ModelProviderSecretStatus>, String> {
    let mut statuses = list_provider_credential_metadata(&state.db_path)?;
    for status in &mut statuses {
        status.has_api_key = has_provider_key_in_keyring(&status.provider_id);
        status.enabled = status.enabled && status.has_api_key;
    }
    Ok(statuses)
}

#[tauri::command]
fn test_provider_key(
    state: State<'_, AppState>,
    provider_id: String,
) -> Result<ModelProviderSecretStatus, String> {
    let provider = provider_id.trim().to_lowercase();
    let key = get_provider_key_for_backend_only(&provider)?;
    if key.trim().is_empty() {
        return Err(format!(
            "{} API key is empty.",
            provider_display_name(&provider)
        ));
    }
    upsert_provider_credential_metadata(
        &state.db_path,
        &provider,
        &provider_display_name(&provider),
        &key_ref_for_provider(&provider),
        mask_api_key(&key).as_deref(),
        true,
        Some(&system_time_to_iso(SystemTime::now())),
    )?;
    get_model_provider_secret_status(state, provider)
}

#[tauri::command]
fn save_google_session_token(kind: String, token: String) -> Result<(), String> {
    save_google_session_token_to_keyring(&kind, &token)
}

#[tauri::command]
fn get_google_session_token(kind: String) -> Result<String, String> {
    get_google_session_token_from_keyring(&kind)
}

#[tauri::command]
fn clear_google_session_token(kind: String) -> Result<(), String> {
    clear_google_session_token_from_keyring(&kind)
}

fn migrate_legacy_provider_secrets(path: &Path) -> Result<(), String> {
    if get_secrets_migration_version(path)? >= 1 {
        return Ok(());
    }
    for (provider, api_key) in list_legacy_model_provider_secrets(path)? {
        if api_key.trim().is_empty() {
            clear_legacy_model_provider_secret(path, &provider)?;
            continue;
        }
        save_provider_key_to_keyring(&provider, &api_key)?;
        let stored = get_provider_key_for_backend_only(&provider)?;
        if stored.trim().is_empty() {
            return Err(format!(
                "Failed to verify migrated {} API key.",
                provider_display_name(&provider)
            ));
        }
        upsert_provider_credential_metadata(
            path,
            &provider,
            &provider_display_name(&provider),
            &key_ref_for_provider(&provider),
            mask_api_key(&api_key).as_deref(),
            true,
            None,
        )?;
        clear_legacy_model_provider_secret(path, &provider)?;
    }
    set_secrets_migration_version(path, 1)
}

fn parse_ollama_json_response<T: DeserializeOwned>(
    content: &str,
    context: &str,
) -> Result<T, String> {
    let trimmed = content.trim();

    if let Ok(parsed) = serde_json::from_str::<T>(trimmed) {
        return Ok(parsed);
    }

    let without_prefix = trimmed
        .strip_prefix("```json")
        .or_else(|| trimmed.strip_prefix("```"))
        .unwrap_or(trimmed)
        .trim()
        .to_string();
    let without_fences = without_prefix
        .strip_suffix("```")
        .unwrap_or(&without_prefix)
        .trim()
        .to_string();

    if let Ok(parsed) = serde_json::from_str::<T>(&without_fences) {
        return Ok(parsed);
    }

    if let (Some(start), Some(end)) = (without_fences.find('{'), without_fences.rfind('}')) {
        if start <= end {
            let candidate = &without_fences[start..=end];
            if let Ok(parsed) = serde_json::from_str::<T>(candidate) {
                return Ok(parsed);
            }
        }
    }

    Err(format!(
        "Ollama returned invalid {} JSON: {}",
        context, trimmed
    ))
}

fn extract_json_object_string(content: &str) -> Result<String, String> {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return Err("Ollama returned an empty response.".to_string());
    }

    let without_prefix = trimmed
        .strip_prefix("```json")
        .or_else(|| trimmed.strip_prefix("```"))
        .unwrap_or(trimmed)
        .trim();
    let without_fences = without_prefix
        .strip_suffix("```")
        .unwrap_or(without_prefix)
        .trim();

    if without_fences.starts_with('{') && without_fences.ends_with('}') {
        return Ok(without_fences.to_string());
    }

    if let (Some(start), Some(end)) = (without_fences.find('{'), without_fences.rfind('}')) {
        if start <= end {
            return Ok(without_fences[start..=end].to_string());
        }
    }

    Err(format!("Ollama did not return a JSON object: {}", trimmed))
}

fn get_string_alias(value: &serde_json::Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        value
            .get(*key)
            .and_then(|entry| entry.as_str())
            .map(|entry| entry.trim().to_string())
            .filter(|entry| !entry.is_empty())
    })
}

fn get_string_array_alias(value: &serde_json::Value, keys: &[&str]) -> Vec<String> {
    keys.iter()
        .find_map(|key| {
            value.get(*key).and_then(|entry| {
                entry.as_array().map(|items| {
                    items
                        .iter()
                        .filter_map(|item| item.as_str().map(|text| text.trim().to_string()))
                        .filter(|text| !text.is_empty())
                        .collect::<Vec<_>>()
                })
            })
        })
        .unwrap_or_default()
}

fn normalize_conversation_interpretation(
    content: &str,
) -> Result<ConversationInterpretation, String> {
    if let Ok(parsed) =
        parse_ollama_json_response::<ConversationInterpretation>(content, "interpretation")
    {
        return Ok(parsed);
    }

    let json_text = extract_json_object_string(content)?;
    let value: serde_json::Value = serde_json::from_str(&json_text)
        .map_err(|error| format!("Ollama returned invalid interpretation JSON: {}", error))?;

    let kind =
        get_string_alias(&value, &["kind", "intent", "type", "action"]).ok_or_else(|| {
            format!(
                "Ollama interpretation JSON is missing a kind field: {}",
                json_text
            )
        })?;
    let query = get_string_alias(&value, &["query", "searchQuery", "search_query"]);
    let url = get_string_alias(&value, &["url", "targetUrl", "target_url"]);
    let clarification_prompt = get_string_alias(
        &value,
        &[
            "clarificationPrompt",
            "clarification_prompt",
            "question",
            "followUp",
            "follow_up",
        ],
    );

    Ok(ConversationInterpretation {
        kind,
        query,
        url,
        clarification_prompt,
    })
}

fn normalize_missing_skill_plan(content: &str) -> Result<MissingSkillPlan, String> {
    if let Ok(parsed) =
        parse_ollama_json_response::<MissingSkillPlan>(content, "missing-skill plan")
    {
        return Ok(parsed);
    }

    let json_text = extract_json_object_string(content)?;
    let value: serde_json::Value = serde_json::from_str(&json_text)
        .map_err(|error| format!("Ollama returned invalid missing-skill JSON: {}", error))?;

    let skill_name = get_string_alias(&value, &["skillName", "skill_name", "name", "title"])
        .ok_or_else(|| {
            format!(
                "Ollama missing-skill JSON is missing skillName: {}",
                json_text
            )
        })?;

    let summary = get_string_alias(&value, &["summary", "description", "overview"])
        .unwrap_or_else(|| format!("Add a new {} capability to JARVIS.", skill_name));
    let user_value = get_string_alias(&value, &["userValue", "user_value", "value", "benefit"])
        .unwrap_or_else(|| {
            "This would let JARVIS handle the request directly next time.".to_string()
        });

    let build_steps = {
        let steps = get_string_array_alias(
            &value,
            &[
                "buildSteps",
                "build_steps",
                "steps",
                "implementationSteps",
                "implementation_steps",
            ],
        );
        if steps.is_empty() {
            vec![
                "Define the new skill intent and routing behavior.".to_string(),
                "Add the backend execution path or storage needed for the skill.".to_string(),
                "Wire the UI and conversation flow for the new skill.".to_string(),
            ]
        } else {
            steps
        }
    };

    let permissions_needed = get_string_array_alias(
        &value,
        &[
            "permissionsNeeded",
            "permissions_needed",
            "permissions",
            "approvals",
        ],
    );
    let approval_message = get_string_alias(
        &value,
        &[
            "approvalMessage",
            "approval_message",
            "confirmation",
            "confirmMessage",
            "confirm_message",
        ],
    )
    .unwrap_or_else(|| {
        format!(
            "Do you want me to prepare the {} skill for implementation?",
            skill_name
        )
    });

    Ok(MissingSkillPlan {
        skill_name,
        summary,
        user_value,
        build_steps,
        permissions_needed,
        approval_message,
    })
}

#[tauri::command]
fn ping_jarvis() -> String {
    "JARVIS core responding. Native command channel is live.".to_string()
}

#[tauri::command]
fn launch_study_setup(state: State<'_, AppState>) -> Result<String, String> {
    commands::desktop::run_study_setup(&state.db_path)
}

#[tauri::command]
fn read_screen_uia() -> Result<serde_json::Value, String> {
    #[cfg(target_os = "windows")]
    {
        tools::uia::read_foreground_tree()
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("UI Automation screen reading is only available on Windows.".to_string())
    }
}

#[tauri::command]
fn open_browser_url(state: State<'_, AppState>, url: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|error| format!("Failed to open URL: {}", error))?;

        log_action(
            &state.db_path,
            &format!("Open {}", url),
            "open_browser_url",
            "success",
            &url,
        )?;

        return Ok(format!("Opened {}", url));
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Browser URL opening is currently implemented for Windows only.".to_string())
    }
}

#[tauri::command]
fn search_local_files(
    _state: State<'_, AppState>,
    query: String,
) -> Result<Vec<FileRecord>, String> {
    commands::files::search_local_files(&query)
}

#[tauri::command]
fn list_recent_local_files(
    _state: State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<FileRecord>, String> {
    commands::files::list_recent_local_files(limit.unwrap_or(10))
}

#[tauri::command]
fn open_local_file(state: State<'_, AppState>, path: String) -> Result<String, String> {
    let file_path = PathBuf::from(path.trim());
    if !file_path.exists() {
        return Err("That file path does not exist anymore.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", file_path.to_string_lossy().as_ref()])
            .spawn()
            .map_err(|error| format!("Failed to open file: {}", error))?;

        log_action(
            &state.db_path,
            &format!("Open file {}", file_path.to_string_lossy()),
            "open_local_file",
            "success",
            &file_path.to_string_lossy(),
        )?;

        return Ok(format!("Opened {}", file_path.to_string_lossy()));
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Local file opening is currently implemented for Windows only.".to_string())
    }
}

#[tauri::command]
fn launch_desktop_app(state: State<'_, AppState>, app_name: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let normalized = app_name.trim().to_lowercase();
        let (label, target) = match normalized.as_str() {
            "code" | "vs code" | "vscode" | "visual studio code" => ("VS Code", "code"),
            "explorer" | "file explorer" => ("File Explorer", "explorer"),
            "powershell" | "power shell" => ("PowerShell", "powershell"),
            "command prompt" | "cmd" => ("Command Prompt", "cmd"),
            "notepad" => ("Notepad", "notepad"),
            "spotify" => ("Spotify", "spotify"),
            "chrome" | "google chrome" => ("Google Chrome", "chrome"),
            "edge" | "microsoft edge" => ("Microsoft Edge", "msedge"),
            "calculator" | "calc" => ("Calculator", "calc"),
            "settings" | "windows settings" => ("Settings", "ms-settings:"),
            "task manager" | "taskmgr" => ("Task Manager", "taskmgr"),
            _ => {
                return Err(format!(
                    "I do not have a desktop app launcher for {} yet.",
                    app_name.trim()
                ))
            }
        };

        commands::desktop::open_named_target(&state.db_path, target)?;
        log_action(
            &state.db_path,
            &format!("Launch app {label}"),
            "launch_desktop_app",
            "success",
            label,
        )?;

        return Ok(format!("Opened {label}."));
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Desktop app launching is currently implemented for Windows only.".to_string())
    }
}

#[tauri::command]
fn focus_desktop_app(state: State<'_, AppState>, app_name: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let normalized = app_name.trim().to_lowercase();
        let (label, window_name) = desktop_window_label(&normalized)?;
        let escaped_window_name = window_name.replace('\'', "''");
        let script = format!(
            "$shell = New-Object -ComObject WScript.Shell; \
             if ($shell.AppActivate('{window_name}')) {{ exit 0 }} else {{ exit 1 }}",
            window_name = escaped_window_name
        );

        let status = Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .status()
            .map_err(|error| format!("Failed to focus {}: {}", label, error))?;
        if !status.success() {
            return Err(format!(
                "I could not find an open {} window to focus.",
                label
            ));
        }

        log_action(
            &state.db_path,
            &format!("Focus app {}", label),
            "focus_desktop_app",
            "success",
            label,
        )?;

        return Ok(format!("Focused {}.", label));
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Desktop app focusing is currently implemented for Windows only.".to_string())
    }
}

fn desktop_window_label(app_name: &str) -> Result<(&'static str, &'static str), String> {
    match app_name.trim().to_lowercase().as_str() {
        "code" | "vs code" | "vscode" | "visual studio code" => {
            Ok(("VS Code", "Visual Studio Code"))
        }
        "explorer" | "file explorer" => Ok(("File Explorer", "File Explorer")),
        "powershell" | "power shell" => Ok(("PowerShell", "PowerShell")),
        "command prompt" | "cmd" => Ok(("Command Prompt", "Command Prompt")),
        "notepad" => Ok(("Notepad", "Notepad")),
        "spotify" => Ok(("Spotify", "Spotify")),
        "chrome" | "google chrome" => Ok(("Google Chrome", "Google Chrome")),
        "edge" | "microsoft edge" => Ok(("Microsoft Edge", "Microsoft Edge")),
        "calculator" | "calc" => Ok(("Calculator", "Calculator")),
        "settings" | "windows settings" => Ok(("Settings", "Settings")),
        "task manager" | "taskmgr" => Ok(("Task Manager", "Task Manager")),
        _ => Err(format!(
            "I do not have a desktop window mapping for {} yet.",
            app_name.trim()
        )),
    }
}

#[tauri::command]
fn get_desktop_app_window_status(
    state: State<'_, AppState>,
    app_name: String,
) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let (label, window_name) = desktop_window_label(&app_name)?;
        let escaped_window_name = window_name.replace('\'', "''");
        let script = format!(
            "Get-Process | Where-Object {{ $_.MainWindowTitle -like '*{window_name}*' }} | \
             Select-Object -First 1 -ExpandProperty MainWindowTitle",
            window_name = escaped_window_name
        );
        let output = Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .output()
            .map_err(|error| format!("Failed to check {} window status: {}", label, error))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
        }

        let title = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if title.is_empty() {
            format!(
                "{} does not appear to have an open window right now.",
                label
            )
        } else {
            format!("{} is open: {}", label, title)
        };

        log_action(
            &state.db_path,
            &format!("Check app window {}", label),
            "get_desktop_app_window_status",
            "success",
            &detail,
        )?;

        return Ok(detail);
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Desktop app window status is currently implemented for Windows only.".to_string())
    }
}

#[tauri::command]
fn control_desktop_app_window(
    state: State<'_, AppState>,
    app_name: String,
    action: String,
) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let (label, window_name) = desktop_window_label(&app_name)?;
        let normalized_action = action.trim().to_lowercase();
        let send_keys = match normalized_action.as_str() {
            "minimize" => "n",
            "maximize" => "x",
            "close" => "%{F4}",
            _ => return Err(format!("Unsupported window action: {}", action.trim())),
        };
        let escaped_window_name = window_name.replace('\'', "''");
        let script = if normalized_action == "close" {
            format!(
                "$shell = New-Object -ComObject WScript.Shell; \
                 if (-not $shell.AppActivate('{window_name}')) {{ exit 1 }}; \
                 Start-Sleep -Milliseconds 150; \
                 $shell.SendKeys('{send_keys}');",
                window_name = escaped_window_name,
                send_keys = send_keys
            )
        } else {
            format!(
                "$shell = New-Object -ComObject WScript.Shell; \
                 if (-not $shell.AppActivate('{window_name}')) {{ exit 1 }}; \
                 Start-Sleep -Milliseconds 150; \
                 $shell.SendKeys('% '); \
                 Start-Sleep -Milliseconds 100; \
                 $shell.SendKeys('{send_keys}');",
                window_name = escaped_window_name,
                send_keys = send_keys
            )
        };

        let status = Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .status()
            .map_err(|error| format!("Failed to control {} window: {}", label, error))?;
        if !status.success() {
            return Err(format!(
                "I could not find an open {} window to control.",
                label
            ));
        }

        log_action(
            &state.db_path,
            &format!("{} app {}", action.trim(), label),
            "control_desktop_app_window",
            "success",
            label,
        )?;

        return Ok(format!("Sent {} to {}.", action.trim(), label));
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Desktop app window controls are currently implemented for Windows only.".to_string())
    }
}

#[tauri::command]
fn open_named_folder(state: State<'_, AppState>, folder_name: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let normalized = folder_name.trim().to_lowercase();
        let folder_path = match normalized.as_str() {
            "documents" | "documents folder" => user_documents_dir()?,
            "downloads" | "downloads folder" => user_profile_dir()?.join("Downloads"),
            "desktop" | "desktop folder" => user_profile_dir()?.join("Desktop"),
            "project" | "project folder" | "jarvis project" => {
                std::env::current_dir().unwrap_or_else(|_| state.app_data_dir.clone())
            }
            _ => {
                return Err(format!(
                    "I do not have a named folder mapping for {} yet.",
                    folder_name.trim()
                ))
            }
        };

        if !folder_path.exists() {
            return Err(format!(
                "That folder does not exist: {}",
                folder_path.to_string_lossy()
            ));
        }

        Command::new("cmd")
            .args(["/C", "start", "", folder_path.to_string_lossy().as_ref()])
            .spawn()
            .map_err(|error| format!("Failed to open folder: {}", error))?;

        log_action(
            &state.db_path,
            &format!("Open folder {}", folder_name.trim()),
            "open_named_folder",
            "success",
            &folder_path.to_string_lossy(),
        )?;

        return Ok(format!("Opened {}.", folder_path.to_string_lossy()));
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Named folder opening is currently implemented for Windows only.".to_string())
    }
}

#[tauri::command]
fn capture_desktop_screenshot(state: State<'_, AppState>) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let screenshot_dir = state.app_data_dir.join("screenshots");
        fs::create_dir_all(&screenshot_dir)
            .map_err(|error| format!("Failed to create screenshot directory: {}", error))?;
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let screenshot_path = screenshot_dir.join(format!("jarvis-screenshot-{}.png", timestamp));
        let screenshot_path_string = screenshot_path.to_string_lossy().replace('\'', "''");
        let script = format!(
            "Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; \
             $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; \
             $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height; \
             $graphics = [System.Drawing.Graphics]::FromImage($bitmap); \
             $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size); \
             $bitmap.Save('{path}', [System.Drawing.Imaging.ImageFormat]::Png); \
             $graphics.Dispose(); \
             $bitmap.Dispose();",
            path = screenshot_path_string
        );

        Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .spawn()
            .map_err(|error| format!("Failed to capture screenshot: {}", error))?
            .wait()
            .map_err(|error| format!("Failed to wait for screenshot capture: {}", error))?;

        log_action(
            &state.db_path,
            "Capture screenshot",
            "capture_desktop_screenshot",
            "success",
            &screenshot_path.to_string_lossy(),
        )?;

        return Ok(screenshot_path.to_string_lossy().to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Desktop screenshot capture is currently implemented for Windows only.".to_string())
    }
}

#[tauri::command]
fn capture_active_window_screenshot(state: State<'_, AppState>) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let screenshot_dir = state.app_data_dir.join("screenshots");
        fs::create_dir_all(&screenshot_dir)
            .map_err(|error| format!("Failed to create screenshot directory: {}", error))?;
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let screenshot_path =
            screenshot_dir.join(format!("jarvis-active-window-{}.png", timestamp));
        let screenshot_path_string = screenshot_path.to_string_lossy().replace('\'', "''");
        let script = r#"
Add-Type -AssemblyName System.Drawing;
Add-Type @"
using System;
using System.Runtime.InteropServices;
public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
}
public class NativeMethods {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
}
"@;
$hwnd = [NativeMethods]::GetForegroundWindow();
if ($hwnd -eq [IntPtr]::Zero) { exit 2 }
$rect = New-Object RECT;
if (-not [NativeMethods]::GetWindowRect($hwnd, [ref]$rect)) { exit 3 }
$width = $rect.Right - $rect.Left;
$height = $rect.Bottom - $rect.Top;
if ($width -lt 10 -or $height -lt 10) { exit 4 }
$bitmap = New-Object System.Drawing.Bitmap $width, $height;
$graphics = [System.Drawing.Graphics]::FromImage($bitmap);
$graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size);
$bitmap.Save('__PATH__', [System.Drawing.Imaging.ImageFormat]::Png);
$graphics.Dispose();
$bitmap.Dispose();
"#
        .replace("__PATH__", &screenshot_path_string);

        let status = Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .status()
            .map_err(|error| format!("Failed to capture active window screenshot: {}", error))?;
        if !status.success() {
            return Err("Windows could not capture the active window screenshot.".to_string());
        }

        log_action(
            &state.db_path,
            "Capture active window screenshot",
            "capture_active_window_screenshot",
            "success",
            &screenshot_path.to_string_lossy(),
        )?;

        return Ok(screenshot_path.to_string_lossy().to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err(
            "Active window screenshot capture is currently implemented for Windows only."
                .to_string(),
        )
    }
}

#[tauri::command]
fn capture_desktop_app_window_screenshot(
    state: State<'_, AppState>,
    app_name: String,
) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let (label, window_name) = desktop_window_label(&app_name)?;
        let screenshot_dir = state.app_data_dir.join("screenshots");
        fs::create_dir_all(&screenshot_dir)
            .map_err(|error| format!("Failed to create screenshot directory: {}", error))?;
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let safe_label = label.to_lowercase().replace(' ', "-");
        let screenshot_path =
            screenshot_dir.join(format!("jarvis-{}-window-{}.png", safe_label, timestamp));
        let screenshot_path_string = screenshot_path.to_string_lossy().replace('\'', "''");
        let escaped_window_name = window_name.replace('\'', "''");
        let script = r#"
Add-Type -AssemblyName System.Drawing;
Add-Type @"
using System;
using System.Runtime.InteropServices;
public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
}
public class NativeMethods {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
}
"@;
$shell = New-Object -ComObject WScript.Shell;
if (-not $shell.AppActivate('__WINDOW__')) { exit 1 }
Start-Sleep -Milliseconds 250;
$hwnd = [NativeMethods]::GetForegroundWindow();
if ($hwnd -eq [IntPtr]::Zero) { exit 2 }
$rect = New-Object RECT;
if (-not [NativeMethods]::GetWindowRect($hwnd, [ref]$rect)) { exit 3 }
$width = $rect.Right - $rect.Left;
$height = $rect.Bottom - $rect.Top;
if ($width -lt 10 -or $height -lt 10) { exit 4 }
$bitmap = New-Object System.Drawing.Bitmap $width, $height;
$graphics = [System.Drawing.Graphics]::FromImage($bitmap);
$graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size);
$bitmap.Save('__PATH__', [System.Drawing.Imaging.ImageFormat]::Png);
$graphics.Dispose();
$bitmap.Dispose();
"#
        .replace("__WINDOW__", &escaped_window_name)
        .replace("__PATH__", &screenshot_path_string);

        let status = Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .status()
            .map_err(|error| format!("Failed to capture {} window screenshot: {}", label, error))?;
        if !status.success() {
            return Err(format!(
                "I could not find an open {} window to capture.",
                label
            ));
        }

        log_action(
            &state.db_path,
            &format!("Capture app window screenshot {}", label),
            "capture_desktop_app_window_screenshot",
            "success",
            &screenshot_path.to_string_lossy(),
        )?;

        return Ok(screenshot_path.to_string_lossy().to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("App window screenshot capture is currently implemented for Windows only.".to_string())
    }
}

#[tauri::command]
fn capture_screen_region_screenshot(
    state: State<'_, AppState>,
    region: String,
) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let normalized = region.trim().to_lowercase().replace('-', " ");
        let (x_factor, y_factor, width_factor, height_factor, label) = match normalized.as_str() {
            "selected" | "center" | "middle" => (0.2_f32, 0.2_f32, 0.6_f32, 0.6_f32, "center"),
            "top" | "top half" => (0.0, 0.0, 1.0, 0.5, "top"),
            "bottom" | "bottom half" => (0.0, 0.5, 1.0, 0.5, "bottom"),
            "left" | "left half" => (0.0, 0.0, 0.5, 1.0, "left"),
            "right" | "right half" => (0.5, 0.0, 0.5, 1.0, "right"),
            "top left" => (0.0, 0.0, 0.5, 0.5, "top-left"),
            "top right" => (0.5, 0.0, 0.5, 0.5, "top-right"),
            "bottom left" => (0.0, 0.5, 0.5, 0.5, "bottom-left"),
            "bottom right" => (0.5, 0.5, 0.5, 0.5, "bottom-right"),
            _ => return Err(format!("Unsupported OCR region: {}", region.trim())),
        };

        let screenshot_dir = state.app_data_dir.join("screenshots");
        fs::create_dir_all(&screenshot_dir)
            .map_err(|error| format!("Failed to create screenshot directory: {}", error))?;
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let screenshot_path =
            screenshot_dir.join(format!("jarvis-region-{}-{}.png", label, timestamp));
        let screenshot_path_string = screenshot_path.to_string_lossy().replace('\'', "''");
        let script = format!(
            "Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; \
             $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; \
             $x = [int]($bounds.Left + ($bounds.Width * {x_factor})); \
             $y = [int]($bounds.Top + ($bounds.Height * {y_factor})); \
             $width = [int]($bounds.Width * {width_factor}); \
             $height = [int]($bounds.Height * {height_factor}); \
             $bitmap = New-Object System.Drawing.Bitmap $width, $height; \
             $graphics = [System.Drawing.Graphics]::FromImage($bitmap); \
             $graphics.CopyFromScreen($x, $y, 0, 0, $bitmap.Size); \
             $bitmap.Save('{path}', [System.Drawing.Imaging.ImageFormat]::Png); \
             $graphics.Dispose(); \
             $bitmap.Dispose();",
            x_factor = x_factor,
            y_factor = y_factor,
            width_factor = width_factor,
            height_factor = height_factor,
            path = screenshot_path_string
        );

        let status = Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .status()
            .map_err(|error| format!("Failed to capture screen region: {}", error))?;
        if !status.success() {
            return Err("Windows could not capture that screen region.".to_string());
        }

        log_action(
            &state.db_path,
            &format!("Capture screen region {}", label),
            "capture_screen_region_screenshot",
            "success",
            &screenshot_path.to_string_lossy(),
        )?;

        return Ok(screenshot_path.to_string_lossy().to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Screen region capture is currently implemented for Windows only.".to_string())
    }
}

#[tauri::command]
fn capture_screen_rect_screenshot(
    state: State<'_, AppState>,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        if width < 20 || height < 20 {
            return Err("The selected OCR area is too small to read.".to_string());
        }

        let screenshot_dir = state.app_data_dir.join("screenshots");
        fs::create_dir_all(&screenshot_dir)
            .map_err(|error| format!("Failed to create screenshot directory: {}", error))?;
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let screenshot_path =
            screenshot_dir.join(format!("jarvis-selected-rect-{}.png", timestamp));
        let screenshot_path_string = screenshot_path.to_string_lossy().replace('\'', "''");
        let script = format!(
            "Add-Type -AssemblyName System.Drawing; \
             $bitmap = New-Object System.Drawing.Bitmap {width}, {height}; \
             $graphics = [System.Drawing.Graphics]::FromImage($bitmap); \
             $graphics.CopyFromScreen({x}, {y}, 0, 0, $bitmap.Size); \
             $bitmap.Save('{path}', [System.Drawing.Imaging.ImageFormat]::Png); \
             $graphics.Dispose(); \
             $bitmap.Dispose();",
            x = x,
            y = y,
            width = width,
            height = height,
            path = screenshot_path_string
        );

        let status = Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .status()
            .map_err(|error| format!("Failed to capture selected OCR rectangle: {}", error))?;
        if !status.success() {
            return Err("Windows could not capture the selected OCR rectangle.".to_string());
        }

        log_action(
            &state.db_path,
            "Capture selected OCR rectangle",
            "capture_screen_rect_screenshot",
            "success",
            &screenshot_path.to_string_lossy(),
        )?;

        return Ok(screenshot_path.to_string_lossy().to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Selected rectangle capture is currently implemented for Windows only.".to_string())
    }
}

#[tauri::command]
fn capture_global_selection_screenshot(state: State<'_, AppState>) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let screenshot_dir = state.app_data_dir.join("screenshots");
        fs::create_dir_all(&screenshot_dir)
            .map_err(|error| format!("Failed to create screenshot directory: {}", error))?;
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let screenshot_path =
            screenshot_dir.join(format!("jarvis-global-selection-{}.png", timestamp));
        let screenshot_path_string = screenshot_path.to_string_lossy().replace('\'', "''");
        let script = r#"
Add-Type -AssemblyName System.Windows.Forms;
Add-Type -AssemblyName System.Drawing;
$bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen;
$form = New-Object System.Windows.Forms.Form;
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None;
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual;
$form.Bounds = $bounds;
$form.TopMost = $true;
$form.Opacity = 0.32;
$form.BackColor = [System.Drawing.Color]::Black;
$form.Cursor = [System.Windows.Forms.Cursors]::Cross;
$start = $null;
$current = $null;
$selected = $null;
$form.Add_KeyDown({
    if ($_.KeyCode -eq [System.Windows.Forms.Keys]::Escape) {
        $form.Tag = 'cancel';
        $form.Close();
    }
});
$form.Add_MouseDown({
    $script:start = $_.Location;
    $script:current = $_.Location;
    $form.Invalidate();
});
$form.Add_MouseMove({
    if ($script:start -ne $null) {
        $script:current = $_.Location;
        $form.Invalidate();
    }
});
$form.Add_MouseUp({
    if ($script:start -eq $null) { return }
    $x = [Math]::Min($script:start.X, $_.X) + $bounds.Left;
    $y = [Math]::Min($script:start.Y, $_.Y) + $bounds.Top;
    $w = [Math]::Abs($_.X - $script:start.X);
    $h = [Math]::Abs($_.Y - $script:start.Y);
    if ($w -lt 20 -or $h -lt 20) {
        $form.Tag = 'small';
        $form.Close();
        return;
    }
    $script:selected = New-Object System.Drawing.Rectangle $x, $y, $w, $h;
    $form.Close();
});
$form.Add_Paint({
    if ($script:start -ne $null -and $script:current -ne $null) {
        $x = [Math]::Min($script:start.X, $script:current.X);
        $y = [Math]::Min($script:start.Y, $script:current.Y);
        $w = [Math]::Abs($script:current.X - $script:start.X);
        $h = [Math]::Abs($script:current.Y - $script:start.Y);
        $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::Cyan), 4;
        $_.Graphics.DrawRectangle($pen, $x, $y, $w, $h);
        $pen.Dispose();
    }
});
[void]$form.ShowDialog();
if ($form.Tag -eq 'cancel') { exit 5 }
if ($form.Tag -eq 'small') { exit 6 }
if ($script:selected -eq $null) { exit 7 }
$bitmap = New-Object System.Drawing.Bitmap $script:selected.Width, $script:selected.Height;
$graphics = [System.Drawing.Graphics]::FromImage($bitmap);
$graphics.CopyFromScreen($script:selected.X, $script:selected.Y, 0, 0, $bitmap.Size);
$bitmap.Save('__PATH__', [System.Drawing.Imaging.ImageFormat]::Png);
$graphics.Dispose();
$bitmap.Dispose();
"#
        .replace("__PATH__", &screenshot_path_string);

        let status = Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .status()
            .map_err(|error| format!("Failed to run global OCR selector: {}", error))?;
        if !status.success() {
            return Err(
                "Global OCR selection was cancelled or could not capture the selected area."
                    .to_string(),
            );
        }

        log_action(
            &state.db_path,
            "Capture global OCR selection",
            "capture_global_selection_screenshot",
            "success",
            &screenshot_path.to_string_lossy(),
        )?;

        return Ok(screenshot_path.to_string_lossy().to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Global OCR selection is currently implemented for Windows only.".to_string())
    }
}

#[tauri::command]
fn open_screenshots_folder(state: State<'_, AppState>) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let screenshot_dir = state.app_data_dir.join("screenshots");
        fs::create_dir_all(&screenshot_dir)
            .map_err(|error| format!("Failed to create screenshot directory: {}", error))?;

        Command::new("cmd")
            .args(["/C", "start", "", screenshot_dir.to_string_lossy().as_ref()])
            .spawn()
            .map_err(|error| format!("Failed to open screenshots folder: {}", error))?;

        log_action(
            &state.db_path,
            "Open screenshots folder",
            "open_screenshots_folder",
            "success",
            &screenshot_dir.to_string_lossy(),
        )?;

        return Ok(format!("Opened {}.", screenshot_dir.to_string_lossy()));
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Opening the screenshots folder is currently implemented for Windows only.".to_string())
    }
}

#[tauri::command]
fn extract_image_ocr_text(state: State<'_, AppState>, path: String) -> Result<String, String> {
    let image_path = PathBuf::from(path.trim());
    if !image_path.exists() {
        return Err(format!(
            "That image does not exist: {}",
            image_path.to_string_lossy()
        ));
    }

    let output = Command::new("tesseract")
        .arg(&image_path)
        .arg("stdout")
        .output()
        .or_else(|_| {
            Command::new(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
                .arg(&image_path)
                .arg("stdout")
                .output()
        })
        .map_err(|error| {
            format!(
                "OCR needs Tesseract installed and available on PATH or at C:\\Program Files\\Tesseract-OCR. I could not start it: {}",
                error
            )
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Tesseract could not read text from that image.".to_string()
        } else {
            stderr
        });
    }

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    log_action(
        &state.db_path,
        &format!("OCR image {}", image_path.to_string_lossy()),
        "extract_image_ocr_text",
        "success",
        if text.is_empty() { "empty" } else { "text" },
    )?;

    Ok(text)
}

#[tauri::command]
fn read_clipboard_text(state: State<'_, AppState>) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("powershell")
            .args(["-NoProfile", "-Command", "Get-Clipboard -Raw"])
            .output()
            .map_err(|error| format!("Failed to read clipboard: {}", error))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
        }

        let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
        log_action(
            &state.db_path,
            "Read clipboard",
            "read_clipboard_text",
            "success",
            if text.is_empty() { "empty" } else { "text" },
        )?;

        return Ok(text);
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Clipboard reading is currently implemented for Windows only.".to_string())
    }
}

#[tauri::command]
fn write_clipboard_text(state: State<'_, AppState>, text: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let mut child = Command::new("powershell")
            .args(["-NoProfile", "-Command", "Set-Clipboard"])
            .stdin(std::process::Stdio::piped())
            .spawn()
            .map_err(|error| format!("Failed to write clipboard: {}", error))?;

        if let Some(stdin) = child.stdin.as_mut() {
            stdin
                .write_all(text.as_bytes())
                .map_err(|error| format!("Failed to send clipboard text: {}", error))?;
        }

        let status = child
            .wait()
            .map_err(|error| format!("Failed to wait for clipboard write: {}", error))?;
        if !status.success() {
            return Err("Windows rejected the clipboard update.".to_string());
        }

        log_action(
            &state.db_path,
            "Write clipboard",
            "write_clipboard_text",
            "success",
            if text.trim().is_empty() {
                "empty"
            } else {
                "text"
            },
        )?;

        return Ok("Copied text to the clipboard.".to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Clipboard writing is currently implemented for Windows only.".to_string())
    }
}

#[tauri::command]
fn run_jarvis_project_checks(state: State<'_, AppState>) -> Result<String, String> {
    let project_dir =
        builder::resolve_jarvis_project_dir(&std::env::current_dir().map_err(|error| {
            format!(
                "Could not resolve the current JARVIS project directory: {}",
                error
            )
        })?)?;

    let outcome = builder::run_project_checks(&project_dir);
    let log_status = match &outcome {
        Ok(summary) if builder::checks_succeeded(summary) => "success",
        _ => "failed",
    };

    log_action(
        &state.db_path,
        "Run JARVIS project checks",
        "run_jarvis_project_checks",
        log_status,
        &project_dir.to_string_lossy(),
    )?;

    outcome
}

#[tauri::command]
fn extract_pdf_text(state: State<'_, AppState>, path: String) -> Result<String, String> {
    let file_path = PathBuf::from(path.trim());
    let text = read_pdf_text_from_path(&file_path)?;

    log_action(
        &state.db_path,
        &format!("Extract PDF {}", file_path.to_string_lossy()),
        "extract_pdf_text",
        "success",
        &file_path.to_string_lossy(),
    )?;

    Ok(text)
}

#[tauri::command]
fn search_google(state: State<'_, AppState>, query: String) -> Result<String, String> {
    let encoded_query = query.replace(' ', "+");
    let url = format!("https://www.google.com/search?q={}", encoded_query);
    open_browser_url(state.clone(), url.clone())?;

    log_action(
        &state.db_path,
        &format!("Search {} on Google", query),
        "search_google",
        "success",
        &url,
    )?;

    Ok(format!("Searched Google for {}", query))
}

#[tauri::command]
fn get_routines(state: State<'_, AppState>) -> Result<Vec<RoutineRecord>, String> {
    list_routines(&state.db_path)
}

#[tauri::command]
fn get_recent_history(state: State<'_, AppState>) -> Result<Vec<HistoryRecord>, String> {
    list_history(&state.db_path, 8)
}

#[tauri::command]
fn get_proposals(state: State<'_, AppState>) -> Result<Vec<ProposalRecord>, String> {
    list_proposals(&state.db_path)
}

#[tauri::command]
fn generate_learning_proposal(
    state: State<'_, AppState>,
) -> Result<Option<ProposalRecord>, String> {
    generate_study_proposal(&state.db_path)
}

#[tauri::command]
fn get_proposal_steps(
    state: State<'_, AppState>,
    proposal_id: i64,
) -> Result<Vec<ProposalStepRecord>, String> {
    list_proposal_steps(&state.db_path, proposal_id)
}

#[tauri::command]
fn update_learning_proposal(
    state: State<'_, AppState>,
    proposal: ProposalUpdateInput,
) -> Result<(), String> {
    update_proposal(&state.db_path, proposal)
}

#[tauri::command]
fn approve_learning_proposal(state: State<'_, AppState>, proposal_id: i64) -> Result<(), String> {
    approve_proposal(&state.db_path, proposal_id)
}

#[tauri::command]
fn reject_learning_proposal(state: State<'_, AppState>, proposal_id: i64) -> Result<(), String> {
    reject_proposal(&state.db_path, proposal_id)
}

#[tauri::command]
fn get_voice_corrections(state: State<'_, AppState>) -> Result<Vec<VoiceCorrectionRecord>, String> {
    list_voice_corrections(&state.db_path)
}

#[tauri::command]
fn save_voice_correction_entry(
    state: State<'_, AppState>,
    heard_phrase: String,
    corrected_phrase: String,
) -> Result<(), String> {
    save_voice_correction(&state.db_path, &heard_phrase, &corrected_phrase)
}

#[tauri::command]
fn get_local_voice_backend_status(
    state: State<'_, AppState>,
) -> Result<LocalVoiceBackendStatus, String> {
    let (executable_path, model_path) = get_local_voice_backend_config(&state.db_path)?;
    let executable_exists = executable_path
        .as_ref()
        .is_some_and(|path| Path::new(path).exists());
    let model_exists = model_path
        .as_ref()
        .is_some_and(|path| Path::new(path).exists());
    let configured = executable_exists && model_exists;

    Ok(LocalVoiceBackendStatus {
        backend: "local".to_string(),
        available: configured,
        configured,
        provider_name: "whisper.cpp".to_string(),
        executable_path,
        model_path,
        message: if configured {
            "Local whisper.cpp transcription is configured.".to_string()
        } else {
            "Set a whisper-cli executable path and ggml model path to enable local transcription."
                .to_string()
        },
    })
}

#[tauri::command]
fn save_local_voice_backend_paths(
    state: State<'_, AppState>,
    executable_path: String,
    model_path: String,
) -> Result<LocalVoiceBackendStatus, String> {
    let executable_value = if executable_path.trim().is_empty() {
        None
    } else {
        Some(executable_path.trim())
    };
    let model_value = if model_path.trim().is_empty() {
        None
    } else {
        Some(model_path.trim())
    };

    save_local_voice_backend_config(&state.db_path, executable_value, model_value)?;
    get_local_voice_backend_status(state)
}

#[tauri::command]
fn transcribe_local_audio(
    state: State<'_, AppState>,
    audio_base64: String,
) -> Result<String, String> {
    let status = get_local_voice_backend_status(state.clone())?;
    if !status.configured {
        return Err(status.message);
    }

    let executable_path = status
        .executable_path
        .ok_or_else(|| "Local whisper executable path is missing.".to_string())?;
    let model_path = status
        .model_path
        .ok_or_else(|| "Local whisper model path is missing.".to_string())?;

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let temp_dir = state.app_data_dir.join("voice-temp");
    fs::create_dir_all(&temp_dir).map_err(|error| error.to_string())?;

    let audio_path = temp_dir.join(format!("voice-input-{}.wav", timestamp));
    let output_prefix = temp_dir.join(format!("voice-output-{}", timestamp));
    let output_txt_path = temp_dir.join(format!("voice-output-{}.txt", timestamp));

    let audio_bytes = general_purpose::STANDARD
        .decode(audio_base64)
        .map_err(|error| error.to_string())?;
    fs::write(&audio_path, audio_bytes).map_err(|error| error.to_string())?;

    let output = Command::new(&executable_path)
        .args([
            "--model",
            &model_path,
            "--file",
            audio_path.to_string_lossy().as_ref(),
            "--output-txt",
            "--output-file",
            output_prefix.to_string_lossy().as_ref(),
            "--no-prints",
            "--no-timestamps",
        ])
        .output()
        .map_err(|error| format!("Failed to launch whisper.cpp: {}", error))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("whisper.cpp failed: {}", stderr.trim()));
    }

    let transcript = fs::read_to_string(&output_txt_path)
        .map_err(|error| format!("Failed to read whisper output: {}", error))?;

    let _ = fs::remove_file(&audio_path);
    let _ = fs::remove_file(&output_txt_path);

    Ok(transcript.trim().to_string())
}

#[tauri::command]
fn get_local_speech_output_status(
    state: State<'_, AppState>,
) -> Result<LocalSpeechOutputStatus, String> {
    let (executable_path, model_path) = get_local_tts_backend_config(&state.db_path)?;
    let executable_exists = executable_path
        .as_ref()
        .is_some_and(|path| Path::new(path).exists());
    let model_exists = model_path
        .as_ref()
        .is_some_and(|path| Path::new(path).exists());
    let configured = executable_exists && model_exists;

    Ok(LocalSpeechOutputStatus {
        backend: "local".to_string(),
        available: configured,
        configured,
        provider_name: "Piper".to_string(),
        executable_path,
        model_path,
        message: if configured {
            "Local Piper speech output is configured.".to_string()
        } else {
            "Set a Piper executable path and voice model path to enable local speech output."
                .to_string()
        },
    })
}

#[tauri::command]
fn save_local_speech_output_paths(
    state: State<'_, AppState>,
    executable_path: String,
    model_path: String,
) -> Result<LocalSpeechOutputStatus, String> {
    let executable_value = if executable_path.trim().is_empty() {
        None
    } else {
        Some(executable_path.trim())
    };
    let model_value = if model_path.trim().is_empty() {
        None
    } else {
        Some(model_path.trim())
    };

    save_local_tts_backend_config(&state.db_path, executable_value, model_value)?;
    get_local_speech_output_status(state)
}

#[tauri::command]
fn speak_local_text(state: State<'_, AppState>, text: String) -> Result<(), String> {
    let status = get_local_speech_output_status(state.clone())?;
    if !status.configured {
        return Err(status.message);
    }

    let executable_path = status
        .executable_path
        .ok_or_else(|| "Local Piper executable path is missing.".to_string())?;
    let model_path = status
        .model_path
        .ok_or_else(|| "Local Piper model path is missing.".to_string())?;

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let temp_dir = state.app_data_dir.join("voice-temp");
    fs::create_dir_all(&temp_dir).map_err(|error| error.to_string())?;
    let output_wav = temp_dir.join(format!("tts-output-{}.wav", timestamp));

    let output = Command::new(&executable_path)
        .args([
            "--model",
            &model_path,
            "--output_file",
            output_wav.to_string_lossy().as_ref(),
        ])
        .stdin(std::process::Stdio::piped())
        .spawn()
        .map_err(|error| format!("Failed to launch Piper: {}", error))?;

    let mut child = output;
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(text.as_bytes())
            .map_err(|error| format!("Failed to send text to Piper: {}", error))?;
    }

    let result = child
        .wait()
        .map_err(|error| format!("Failed to wait for Piper: {}", error))?;

    if !result.success() {
        return Err("Piper failed to generate speech.".to_string());
    }

    Command::new("cmd")
        .args(["/C", "start", "", output_wav.to_string_lossy().as_ref()])
        .spawn()
        .map_err(|error| format!("Failed to play generated speech: {}", error))?;

    Ok(())
}

#[tauri::command]
fn get_wake_mode_status(state: State<'_, AppState>) -> Result<WakeModeStatus, String> {
    let (assistant_name, wake_mode_enabled) = get_wake_mode_config(&state.db_path)?;
    Ok(WakeModeStatus {
        assistant_name: assistant_name.clone(),
        wake_mode_enabled,
        message: if wake_mode_enabled {
            format!(
                "{} wake mode is enabled. Use the wake button to simulate activation before full detector integration.",
                assistant_name
            )
        } else {
            format!("{} wake mode is currently off.", assistant_name)
        },
    })
}

#[tauri::command]
fn save_wake_mode_status(
    state: State<'_, AppState>,
    assistant_name: String,
    wake_mode_enabled: bool,
) -> Result<WakeModeStatus, String> {
    let trimmed_name = if assistant_name.trim().is_empty() {
        "Jarvis".to_string()
    } else {
        assistant_name.trim().to_string()
    };

    save_wake_mode_config(&state.db_path, &trimmed_name, wake_mode_enabled)?;
    get_wake_mode_status(state)
}

#[tauri::command]
fn get_browser_aliases(state: State<'_, AppState>) -> Result<Vec<BrowserAliasRecord>, String> {
    list_browser_aliases(&state.db_path)
}

#[tauri::command]
fn save_browser_alias_entry(
    state: State<'_, AppState>,
    phrase: String,
    url: String,
) -> Result<(), String> {
    save_browser_alias(&state.db_path, &phrase, &url)
}

#[tauri::command]
fn get_learned_intents(state: State<'_, AppState>) -> Result<Vec<LearnedIntentRecord>, String> {
    list_learned_intents(&state.db_path)
}

#[tauri::command]
fn save_learned_intent_entry(
    state: State<'_, AppState>,
    phrase: String,
    normalized_phrase: String,
    intent_kind: String,
    intent_payload: String,
) -> Result<(), String> {
    save_learned_intent(
        &state.db_path,
        &phrase,
        &normalized_phrase,
        &intent_kind,
        &intent_payload,
    )
}

#[tauri::command]
fn delete_learned_intent_entry(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    delete_learned_intent(&state.db_path, id)
}

#[tauri::command]
fn get_notion_status(state: State<'_, AppState>) -> Result<NotionStatus, String> {
    let (mut access_token, database_id) = get_notion_config(&state.db_path)?;
    if access_token
        .as_ref()
        .map(|value| value.trim().is_empty())
        .unwrap_or(true)
    {
        access_token = crate::env_local::provider_api_key("notion");
    }
    let has_token = access_token
        .as_ref()
        .is_some_and(|value| !value.trim().is_empty());
    let configured = has_token
        && database_id
            .as_ref()
            .is_some_and(|value| !value.trim().is_empty());

    if !configured {
        return Ok(NotionStatus {
            configured: false,
            available: false,
            has_token,
            database_id,
            message: "Set a Notion token and database ID to enable external notes.".to_string(),
        });
    }

    let token = access_token.unwrap_or_default();
    let db_id = database_id.clone().unwrap_or_default();
    let client = notion_client()?;
    let response = client
        .get(format!("https://api.notion.com/v1/databases/{}", db_id))
        .headers(notion_headers(&token)?)
        .send();

    match response {
        Ok(response) if response.status().is_success() => Ok(NotionStatus {
            configured: true,
            available: true,
            has_token: true,
            database_id,
            message: "Notion is connected and ready for notes.".to_string(),
        }),
        Ok(response) => Ok(NotionStatus {
            configured: true,
            available: false,
            has_token: true,
            database_id,
            message: format!(
                "Notion is configured, but the database request returned {}.",
                response.status()
            ),
        }),
        Err(error) => Ok(NotionStatus {
            configured: true,
            available: false,
            has_token: true,
            database_id,
            message: format!("Notion is configured, but could not be reached: {}", error),
        }),
    }
}

#[tauri::command]
fn get_google_calendar_status(state: State<'_, AppState>) -> Result<GoogleCalendarStatus, String> {
    let (client_id, api_key) = get_google_calendar_config(&state.db_path)?;
    let has_client_id = client_id
        .as_ref()
        .is_some_and(|value| !value.trim().is_empty());
    let has_api_key = api_key
        .as_ref()
        .is_some_and(|value| !value.trim().is_empty());
    let configured = has_client_id && has_api_key;

    Ok(GoogleCalendarStatus {
        configured,
        has_client_id,
        has_api_key,
        client_id,
        api_key,
        message: if configured {
            "Google Calendar API credentials are saved. Connect in the app to start direct calendar actions.".to_string()
        } else {
            "Set a Google Calendar client ID and API key to enable direct calendar API access."
                .to_string()
        },
    })
}

#[tauri::command]
fn save_google_calendar_status(
    state: State<'_, AppState>,
    client_id: String,
    api_key: String,
) -> Result<GoogleCalendarStatus, String> {
    let client_value = if client_id.trim().is_empty() {
        None
    } else {
        Some(client_id.trim())
    };
    let key_value = if api_key.trim().is_empty() {
        None
    } else {
        Some(api_key.trim())
    };

    save_google_calendar_config(&state.db_path, client_value, key_value)?;
    get_google_calendar_status(state)
}

#[tauri::command]
fn get_spotify_status(state: State<'_, AppState>) -> Result<SpotifyStatus, String> {
    let client_id = get_spotify_config(&state.db_path)?;
    let has_client_id = client_id
        .as_ref()
        .is_some_and(|value| !value.trim().is_empty());

    Ok(SpotifyStatus {
        configured: has_client_id,
        has_client_id,
        client_id,
        message: if has_client_id {
            "Spotify client ID is saved. Connect in the app to enable playback controls."
                .to_string()
        } else {
            "Set a Spotify client ID to enable direct playback controls through the Spotify Web API.".to_string()
        },
    })
}

#[tauri::command]
fn save_spotify_status(
    state: State<'_, AppState>,
    client_id: String,
) -> Result<SpotifyStatus, String> {
    let client_value = if client_id.trim().is_empty() {
        None
    } else {
        Some(client_id.trim())
    };

    save_spotify_config(&state.db_path, client_value)?;
    get_spotify_status(state)
}

#[tauri::command]
fn save_notion_status(
    state: State<'_, AppState>,
    access_token: String,
    database_id: String,
) -> Result<NotionStatus, String> {
    let token_value = if access_token.trim().is_empty() {
        None
    } else {
        Some(access_token.trim())
    };
    let database_value = if database_id.trim().is_empty() {
        None
    } else {
        Some(database_id.trim())
    };

    save_notion_config(&state.db_path, token_value, database_value)?;
    get_notion_status(state)
}

#[tauri::command]
fn create_notion_note(state: State<'_, AppState>, content: String) -> Result<NoteRecord, String> {
    integrations::notion::create_note(&state.db_path, &content)
}

#[tauri::command]
fn list_notion_notes(state: State<'_, AppState>) -> Result<Vec<NoteRecord>, String> {
    integrations::notion::list_notes(&state.db_path)
}

#[tauri::command]
fn search_notion_notes(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<NoteRecord>, String> {
    integrations::notion::search_notes(&state.db_path, &query)
}

#[tauri::command]
fn update_notion_note_title(
    state: State<'_, AppState>,
    note_id: String,
    title: String,
) -> Result<NoteRecord, String> {
    let (access_token, database_id) = get_notion_config(&state.db_path)?;
    let token = access_token
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Notion access token is missing.".to_string())?;
    let db_id = database_id
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Notion database ID is missing.".to_string())?;

    let client = notion_client()?;
    let headers = notion_headers(&token)?;
    let database_response = client
        .get(format!("https://api.notion.com/v1/databases/{}", db_id))
        .headers(headers.clone())
        .send()
        .map_err(|error| format!("Failed to reach Notion: {}", error))?;

    if !database_response.status().is_success() {
        return Err(format!(
            "Notion database lookup failed with {}.",
            database_response.status()
        ));
    }

    let database_value: serde_json::Value = database_response
        .json()
        .map_err(|error| format!("Failed to parse Notion database metadata: {}", error))?;
    let title_property_name = extract_notion_title_property(&database_value)?;
    let trimmed_title = title.trim();

    let mut properties = serde_json::Map::new();
    properties.insert(
        title_property_name.clone(),
        json!({
            "title": [
                {
                    "text": { "content": trimmed_title }
                }
            ]
        }),
    );

    let update_response = client
        .patch(format!("https://api.notion.com/v1/pages/{}", note_id))
        .headers(headers)
        .json(&json!({
            "properties": properties
        }))
        .send()
        .map_err(|error| format!("Failed to update Notion note: {}", error))?;

    if !update_response.status().is_success() {
        let status = update_response.status();
        let body = update_response.text().unwrap_or_default();
        return Err(format!(
            "Notion note update failed with {}: {}",
            status, body
        ));
    }

    let page_value: serde_json::Value = update_response
        .json()
        .map_err(|error| format!("Failed to parse updated Notion note: {}", error))?;

    Ok(map_notion_note_record(
        &page_value,
        &title_property_name,
        &database_value,
    ))
}

#[tauri::command]
fn create_notion_task(
    state: State<'_, AppState>,
    title: String,
    due_label: Option<String>,
    due_iso: Option<String>,
) -> Result<NoteRecord, String> {
    let (access_token, database_id) = get_notion_config(&state.db_path)?;
    let token = access_token
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Notion access token is missing.".to_string())?;
    let db_id = database_id
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Notion database ID is missing.".to_string())?;

    let client = notion_client()?;
    let headers = notion_headers(&token)?;
    let database_response = client
        .get(format!("https://api.notion.com/v1/databases/{}", db_id))
        .headers(headers.clone())
        .send()
        .map_err(|error| format!("Failed to reach Notion: {}", error))?;

    if !database_response.status().is_success() {
        return Err(format!(
            "Notion database lookup failed with {}.",
            database_response.status()
        ));
    }

    let database_value: serde_json::Value = database_response
        .json()
        .map_err(|error| format!("Failed to parse Notion database metadata: {}", error))?;
    let title_property_name = extract_notion_title_property(&database_value)?;
    let has_status_metadata = find_notion_property_name(
        &database_value,
        &["Status"],
        &["status", "select", "rich_text"],
    )
    .is_some();
    let has_due_metadata = find_notion_property_name(
        &database_value,
        &["Due", "Due Date", "Deadline"],
        &["date", "rich_text"],
    )
    .is_some();
    let task_title = build_notion_task_title(
        &title,
        due_label.as_deref(),
        "open",
        has_due_metadata,
        has_status_metadata,
    );

    let mut properties = serde_json::Map::new();
    properties.insert(
        title_property_name.clone(),
        json!({
            "title": [
                {
                    "text": { "content": task_title }
                }
            ]
        }),
    );
    insert_notion_task_properties(
        &database_value,
        &mut properties,
        due_label.as_deref(),
        due_iso.as_deref(),
        "open",
    );

    let create_response = client
        .post("https://api.notion.com/v1/pages")
        .headers(headers)
        .json(&json!({
            "parent": { "database_id": db_id },
            "properties": properties,
            "children": [
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [
                            {
                                "type": "text",
                                "text": { "content": format!("Task: {}", title.trim()) }
                            }
                        ]
                    }
                },
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [
                            {
                                "type": "text",
                                "text": {
                                    "content": due_label
                                        .as_deref()
                                        .filter(|value| !value.trim().is_empty())
                                        .map(|value| format!("Due: {}", value.trim()))
                                        .unwrap_or_else(|| "Due: unscheduled".to_string())
                                }
                            }
                        ]
                    }
                },
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [
                            {
                                "type": "text",
                                "text": { "content": "Status: open" }
                            }
                        ]
                    }
                }
            ]
        }))
        .send()
        .map_err(|error| format!("Failed to create Notion task: {}", error))?;

    if !create_response.status().is_success() {
        let status = create_response.status();
        let body = create_response.text().unwrap_or_default();
        return Err(format!(
            "Notion task creation failed with {}: {}",
            status, body
        ));
    }

    let page_value: serde_json::Value = create_response
        .json()
        .map_err(|error| format!("Failed to parse Notion task response: {}", error))?;

    Ok(map_notion_note_record(
        &page_value,
        &title_property_name,
        &database_value,
    ))
}

#[tauri::command]
fn update_notion_task(
    state: State<'_, AppState>,
    note_id: String,
    title: String,
    due_label: Option<String>,
    due_iso: Option<String>,
    status: String,
) -> Result<NoteRecord, String> {
    let (access_token, database_id) = get_notion_config(&state.db_path)?;
    let token = access_token
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Notion access token is missing.".to_string())?;
    let db_id = database_id
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Notion database ID is missing.".to_string())?;

    let client = notion_client()?;
    let headers = notion_headers(&token)?;
    let database_response = client
        .get(format!("https://api.notion.com/v1/databases/{}", db_id))
        .headers(headers.clone())
        .send()
        .map_err(|error| format!("Failed to reach Notion: {}", error))?;

    if !database_response.status().is_success() {
        return Err(format!(
            "Notion database lookup failed with {}.",
            database_response.status()
        ));
    }

    let database_value: serde_json::Value = database_response
        .json()
        .map_err(|error| format!("Failed to parse Notion database metadata: {}", error))?;
    let title_property_name = extract_notion_title_property(&database_value)?;
    let has_status_metadata = find_notion_property_name(
        &database_value,
        &["Status"],
        &["status", "select", "rich_text"],
    )
    .is_some();
    let has_due_metadata = find_notion_property_name(
        &database_value,
        &["Due", "Due Date", "Deadline"],
        &["date", "rich_text"],
    )
    .is_some();
    let task_title = build_notion_task_title(
        &title,
        due_label.as_deref(),
        &status,
        has_due_metadata,
        has_status_metadata,
    );

    let mut properties = serde_json::Map::new();
    properties.insert(
        title_property_name.clone(),
        json!({
            "title": [
                {
                    "text": { "content": task_title }
                }
            ]
        }),
    );
    insert_notion_task_properties(
        &database_value,
        &mut properties,
        due_label.as_deref(),
        due_iso.as_deref(),
        &status,
    );

    let update_response = client
        .patch(format!("https://api.notion.com/v1/pages/{}", note_id))
        .headers(headers)
        .json(&json!({
            "properties": properties
        }))
        .send()
        .map_err(|error| format!("Failed to update Notion task: {}", error))?;

    if !update_response.status().is_success() {
        let status_code = update_response.status();
        let body = update_response.text().unwrap_or_default();
        return Err(format!(
            "Notion task update failed with {}: {}",
            status_code, body
        ));
    }

    let page_value: serde_json::Value = update_response
        .json()
        .map_err(|error| format!("Failed to parse updated Notion task: {}", error))?;

    Ok(map_notion_note_record(
        &page_value,
        &title_property_name,
        &database_value,
    ))
}

#[tauri::command]
fn get_ollama_status(state: State<'_, AppState>) -> Result<OllamaStatus, String> {
    let (base_url, model_name) = get_ollama_config(&state.db_path)?;
    let configured = base_url
        .as_ref()
        .is_some_and(|value| !value.trim().is_empty())
        && model_name
            .as_ref()
            .is_some_and(|value| !value.trim().is_empty());

    if !configured {
        return Ok(OllamaStatus {
            backend: "ollama".to_string(),
            available: false,
            configured: false,
            provider_name: "Ollama".to_string(),
            base_url,
            model_name,
            message:
                "Set an Ollama base URL and model name to enable local conversation interpretation."
                    .to_string(),
        });
    }

    let base_url_value = base_url.clone().unwrap_or_default();
    let tags_url = format!("{}/api/tags", base_url_value.trim_end_matches('/'));
    let tags_response = Client::new().get(tags_url).send();
    let (available, message) = match tags_response {
        Ok(response) if response.status().is_success() => {
            let parsed_tags = response.json::<serde_json::Value>().ok();
            let model_configured = model_name
                .as_ref()
                .map(|value| value.trim().to_string())
                .unwrap_or_default();

            let model_exists = parsed_tags
                .as_ref()
                .and_then(|value| value.get("models"))
                .and_then(|value| value.as_array())
                .map(|models| {
                    models.iter().any(|entry| {
                        entry
                            .get("name")
                            .and_then(|value| value.as_str())
                            .is_some_and(|name| name == model_configured)
                    })
                })
                .unwrap_or(false);

            if model_exists {
                (
                    true,
                    format!(
                        "Ollama is reachable and ready with model {}.",
                        model_configured
                    ),
                )
            } else {
                (
                    false,
                    format!(
                        "Ollama is reachable, but model {} is not pulled yet.",
                        model_configured
                    ),
                )
            }
        }
        Ok(response) => (
            false,
            format!(
                "Ollama responded with {} while checking availability.",
                response.status()
            ),
        ),
        Err(_) => (
            false,
            "Ollama is configured, but the local server is not reachable right now.".to_string(),
        ),
    };

    Ok(OllamaStatus {
        backend: "ollama".to_string(),
        available,
        configured: true,
        provider_name: "Ollama".to_string(),
        base_url,
        model_name,
        message,
    })
}

#[tauri::command]
fn save_ollama_status(
    state: State<'_, AppState>,
    base_url: String,
    model_name: String,
) -> Result<OllamaStatus, String> {
    let base_url_value = if base_url.trim().is_empty() {
        None
    } else {
        Some(base_url.trim())
    };
    let model_name_value = if model_name.trim().is_empty() {
        None
    } else {
        Some(model_name.trim())
    };

    save_ollama_config(&state.db_path, base_url_value, model_name_value)?;
    get_ollama_status(state)
}

#[tauri::command]
fn interpret_conversation_with_ollama(
    state: State<'_, AppState>,
    request: ConversationInterpretationRequest,
) -> Result<ConversationInterpretation, String> {
    let status = get_ollama_status(state.clone())?;
    if !status.configured {
        return Err(status.message);
    }
    if !status.available {
        return Err(status.message);
    }

    let base_url = status
        .base_url
        .ok_or_else(|| "Ollama base URL is missing.".to_string())?;
    let model_name = status
        .model_name
        .ok_or_else(|| "Ollama model name is missing.".to_string())?;

    let prompt = format!(
        "You are the natural-language interpreter for a desktop assistant named {assistant_name}. \
Return only compact JSON with keys kind, query, url, clarificationPrompt. \
Allowed kind values: study_setup, google_search, open_url, needs_clarification, unsupported. \
Use google_search for search requests, open_url for website/homepage opening, study_setup for study/focus workspace requests. \
If the user says just 'google' or something ambiguous, return needs_clarification with a short clarificationPrompt. \
If you cannot map the request, return unsupported. \
User command: {command}",
        assistant_name = request.assistant_name,
        command = request.command
    );

    let content = request_ollama_response_text(&base_url, &model_name, &prompt)?;

    normalize_conversation_interpretation(&content)
}

#[tauri::command]
fn generate_missing_skill_plan_with_ollama(
    state: State<'_, AppState>,
    request: MissingSkillPlanRequest,
) -> Result<MissingSkillPlan, String> {
    let status = get_ollama_status(state.clone())?;
    if !status.configured || !status.available {
        return Err(status.message);
    }

    let base_url = status
        .base_url
        .ok_or_else(|| "Ollama base URL is missing.".to_string())?;
    let model_name = status
        .model_name
        .ok_or_else(|| "Ollama model name is missing.".to_string())?;

    let prompt = format!(
        "You are helping a desktop assistant named {assistant_name} handle a missing skill request. \
Return only compact JSON with keys skillName, summary, userValue, buildSteps, permissionsNeeded, approvalMessage. \
Keep it practical and specific to the user's request. \
The approvalMessage should be one short sentence asking for permission before implementation or risky actions. \
User request: {command}",
        assistant_name = request.assistant_name,
        command = request.command
    );

    let content = request_ollama_response_text(&base_url, &model_name, &prompt)?;

    normalize_missing_skill_plan(&content)
}

#[tauri::command]
fn create_build_handoff_artifact(
    state: State<'_, AppState>,
    request: SkillBuildRequestInput,
) -> Result<BuildHandoffArtifact, String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();

    let base_dir = std::env::current_dir().unwrap_or_else(|_| state.app_data_dir.clone());
    let handoff_dir = base_dir.join("jarvis-handoffs");
    fs::create_dir_all(&handoff_dir).map_err(|error| error.to_string())?;

    let safe_name = request
        .skill_name
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>();

    let markdown_path = handoff_dir.join(format!("{}-{}.md", safe_name, timestamp));
    let json_path = handoff_dir.join(format!("{}-{}.json", safe_name, timestamp));

    let markdown = format!(
        "# {title}\n\n## Prompt\n\n{prompt}\n\n## Safety Checks\n\n{checks}\n\n## Created At\n\n{created_at}\n",
        title = request.title,
        prompt = request.prompt,
        checks = request
            .safety_checks
            .iter()
            .map(|item| format!("- {}", item))
            .collect::<Vec<_>>()
            .join("\n"),
        created_at = request.created_at
    );

    fs::write(&markdown_path, markdown).map_err(|error| error.to_string())?;
    fs::write(
        &json_path,
        serde_json::to_string_pretty(&serde_json::json!({
            "skillName": request.skill_name,
            "title": request.title,
            "prompt": request.prompt,
            "safetyChecks": request.safety_checks,
            "createdAt": request.created_at
        }))
        .map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;

    Ok(BuildHandoffArtifact {
        markdown_path: markdown_path.to_string_lossy().to_string(),
        json_path: json_path.to_string_lossy().to_string(),
        created_at: request.created_at,
        message: "JARVIS created a coding handoff package. Manual execution is the next boundary."
            .to_string(),
    })
}

#[tauri::command]
fn get_executor_status(state: State<'_, AppState>) -> Result<ExecutorStatus, String> {
    let (command_path, working_directory) = get_executor_config(&state.db_path)?;
    let configured = command_path
        .as_ref()
        .is_some_and(|value| !value.trim().is_empty());
    let available = command_path
        .as_ref()
        .is_some_and(|path| Path::new(path).exists());

    Ok(ExecutorStatus {
        configured,
        available,
        command_path,
        working_directory,
        message: if available {
            "Executor bridge is configured and ready.".to_string()
        } else if configured {
            "Executor bridge is configured, but the command path is not available right now."
                .to_string()
        } else {
            "Set an executor command path to let JARVIS hand coding packages to a local runtime."
                .to_string()
        },
    })
}

#[tauri::command]
fn save_executor_status(
    state: State<'_, AppState>,
    command_path: String,
    working_directory: String,
) -> Result<ExecutorStatus, String> {
    let command_value = if command_path.trim().is_empty() {
        None
    } else {
        Some(command_path.trim())
    };
    let working_directory_value = if working_directory.trim().is_empty() {
        None
    } else {
        Some(working_directory.trim())
    };

    save_executor_config(&state.db_path, command_value, working_directory_value)?;
    get_executor_status(state)
}

#[tauri::command]
fn launch_executor_handoff(
    state: State<'_, AppState>,
    request: ExecutorLaunchRequest,
) -> Result<String, String> {
    let status = get_executor_status(state)?;
    if !status.configured || !status.available {
        return Err(status.message);
    }

    let command_path = status
        .command_path
        .ok_or_else(|| "Executor command path is missing.".to_string())?;
    let mut command = Command::new(command_path);
    command.arg(&request.json_path).arg(&request.markdown_path);

    if let Some(working_directory) = status.working_directory.as_ref() {
        if !working_directory.trim().is_empty() {
            command.current_dir(working_directory);
        }
    }

    command
        .spawn()
        .map_err(|error| format!("Failed to launch executor bridge: {}", error))?;

    Ok("JARVIS launched the local coding executor bridge.".to_string())
}

#[tauri::command]
fn memory_remember(
    state: State<'_, AppState>,
    content: String,
    domain: Option<String>,
) -> Result<String, String> {
    crate::memory::remember(
        &state.db_path,
        &content,
        domain.as_deref().unwrap_or("general"),
    )
}

#[tauri::command]
fn memory_recall(state: State<'_, AppState>, query: String) -> Result<String, String> {
    crate::memory::recall_text(&state.db_path, &query)
}

#[tauri::command]
fn memory_list_people(
    state: State<'_, AppState>,
) -> Result<Vec<crate::models::PersonMemoryRecord>, String> {
    crate::memory::people::list_people(&state.db_path)
}

#[tauri::command]
fn import_people_memory(
    state: State<'_, AppState>,
    records: Vec<crate::models::PersonMemoryRecord>,
) -> Result<usize, String> {
    crate::memory::import_people_records(&state.db_path, &records)
}

#[tauri::command]
fn memory_list_travel(
    state: State<'_, AppState>,
) -> Result<Vec<crate::models::TravelMemoryRecord>, String> {
    crate::memory::travel::list_travel(&state.db_path)
}

#[tauri::command]
fn import_travel_memory(
    state: State<'_, AppState>,
    records: Vec<crate::models::TravelMemoryRecord>,
) -> Result<usize, String> {
    crate::memory::import_travel_records(&state.db_path, &records)
}

#[tauri::command]
fn memory_list_expenses(
    state: State<'_, AppState>,
) -> Result<Vec<crate::models::ExpenseMemoryRecord>, String> {
    crate::memory::expense::list_expenses(&state.db_path)
}

#[tauri::command]
fn import_expense_memory(
    state: State<'_, AppState>,
    records: Vec<crate::models::ExpenseMemoryRecord>,
) -> Result<usize, String> {
    crate::memory::import_expense_records(&state.db_path, &records)
}

#[tauri::command]
fn memory_list_packages(
    state: State<'_, AppState>,
) -> Result<Vec<crate::models::PackageMemoryRecord>, String> {
    crate::memory::package::list_packages(&state.db_path)
}

#[tauri::command]
fn import_package_memory(
    state: State<'_, AppState>,
    records: Vec<crate::models::PackageMemoryRecord>,
) -> Result<usize, String> {
    crate::memory::import_package_records(&state.db_path, &records)
}

#[tauri::command]
fn memory_list_meeting_prep(
    state: State<'_, AppState>,
) -> Result<Vec<crate::models::MeetingPrepMemoryRecord>, String> {
    crate::memory::meeting::list_meeting_prep(&state.db_path)
}

#[tauri::command]
fn import_meeting_prep_memory(
    state: State<'_, AppState>,
    records: Vec<crate::models::MeetingPrepMemoryRecord>,
) -> Result<usize, String> {
    crate::memory::import_meeting_prep_records(&state.db_path, &records)
}

#[tauri::command]
fn memory_list_school_plans(
    state: State<'_, AppState>,
) -> Result<Vec<crate::models::SchoolPlanMemoryRecord>, String> {
    crate::memory::school::list_school_plans(&state.db_path)
}

#[tauri::command]
fn import_school_plan_memory(
    state: State<'_, AppState>,
    records: Vec<crate::models::SchoolPlanMemoryRecord>,
) -> Result<usize, String> {
    crate::memory::import_school_plan_records(&state.db_path, &records)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();
    #[cfg(feature = "embedded-terminal")]
    {
        builder = builder.plugin(tauri_plugin_pty::init());
    }
    builder
        .setup(|app| {
            env_local::init_local_env();

            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|error| error.to_string())?;
            let db_path = app_data_dir.join("jarvis.db");

            init_database(&db_path)?;
            migrate_legacy_provider_secrets(&db_path)?;
            if let Err(error) = crate::memory::cag::ensure_default_cag_policy(&app_data_dir) {
                eprintln!("Failed to ensure default CAG policy: {error}");
            }
            if let Err(error) =
                crate::gateway::profiles::seed_default_profiles(&db_path, &app_data_dir)
            {
                eprintln!("Failed to seed default profiles: {error}");
            }
            if let Err(error) = crate::gateway::skills::install_fixture_skill(&app_data_dir) {
                eprintln!("Failed to install fixture skill: {error}");
            }
            app.manage(AppState {
                db_path,
                app_data_dir: app_data_dir.clone(),
            });
            app.manage(crate::gateway::state::GatewayState::new(app_data_dir));
            crate::gateway::heartbeat::spawn_proactive_scheduler(app.handle().clone());
            crate::gateway::local_turn_api::sync_local_turn_api(app.handle().clone());
            crate::gateway::telegram::sync_telegram_bot(app.handle().clone());
            crate::gateway::discord::sync_discord_bot(app.handle().clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping_jarvis,
            preview_gateway_turn,
            get_gateway_config,
            get_gateway_audit_log,
            list_gateway_task_runs,
            list_project_bundles,
            crate::commands::wave15::get_topic_graph_cmd,
            crate::commands::wave15::query_topic_neighbors_cmd,
            crate::commands::wave15::infer_topic_graph_cmd,
            crate::commands::wave15::list_user_goals_cmd,
            crate::commands::wave15::save_user_goal_cmd,
            crate::commands::wave15::export_sync_bundle_cmd,
            crate::commands::wave15::import_sync_bundle_cmd,
            crate::commands::wave15::list_proactive_nudges_cmd,
            crate::commands::wave15::dismiss_proactive_nudge_cmd,
            crate::commands::wave15::accept_proactive_nudge_cmd,
            crate::commands::wave16::list_user_profiles_cmd,
            crate::commands::wave16::get_active_profile_cmd,
            crate::commands::wave16::switch_user_profile_cmd,
            crate::commands::wave16::list_installed_skills_cmd,
            crate::commands::wave16::start_ambient_session_cmd,
            crate::commands::wave16::end_ambient_session_cmd,
            crate::commands::wave16::list_ambient_suggestions_cmd,
            crate::commands::wave16::dismiss_ambient_suggestion_cmd,
            crate::commands::wave16::record_ambient_signal_cmd,
            crate::commands::wave17::remote_sync_status_cmd,
            crate::commands::wave17::connect_remote_sync_cmd,
            crate::commands::wave17::push_remote_sync_cmd,
            crate::commands::wave17::pull_remote_sync_cmd,
            crate::commands::wave17::list_pending_sync_conflicts_cmd,
            crate::commands::wave17::list_marketplace_catalog_cmd,
            crate::commands::wave17::install_marketplace_skill_cmd,
            crate::commands::wave17::marketplace_operator_lane_cmd,
            save_gateway_config,
            apply_gateway_easy_preset,
            list_trigger_events,
            get_local_turn_api_status,
            get_jarvis_service_status,
            get_trigger_queue_status,
            get_telegram_bot_status,
            get_discord_bot_status,
            list_gateway_tools,
            gateway_run_turn,
            list_pending_gateway_approvals,
            get_gateway_trace,
            list_mcp_tools,
            list_gateway_capabilities,
            list_mcp_host_registry,
            gateway_mcp_call_tool,
            list_mcp_presets,
            test_mcp_host_connection,
            gateway_channel_turn,
            export_training_turn,
            run_training_eval_gate,
            anonymize_training_export,
            prepare_database_migrations,
            crate::commands::automation::list_ocr_watches_cmd,
            crate::commands::automation::save_ocr_watch_cmd,
            crate::commands::automation::delete_ocr_watch_cmd,
            crate::commands::automation::list_desktop_schedules_cmd,
            crate::commands::automation::save_desktop_schedule_cmd,
            crate::commands::automation::delete_desktop_schedule_cmd,
            crate::commands::automation::list_saved_workflows_cmd,
            crate::commands::automation::save_saved_workflow_cmd,
            crate::commands::automation::import_automation_from_local_storage,
            list_provider_presets,
            list_provider_defaults,
            transcribe_groq_audio,
            gateway_approve,
            gateway_deny,
            launch_study_setup,
            read_screen_uia,
            open_browser_url,
            search_local_files,
            list_recent_local_files,
            open_local_file,
            launch_desktop_app,
            focus_desktop_app,
            control_desktop_app_window,
            get_desktop_app_window_status,
            open_named_folder,
            capture_desktop_screenshot,
            capture_active_window_screenshot,
            capture_desktop_app_window_screenshot,
            capture_screen_region_screenshot,
            capture_screen_rect_screenshot,
            capture_global_selection_screenshot,
            open_screenshots_folder,
            extract_image_ocr_text,
            read_clipboard_text,
            write_clipboard_text,
            run_jarvis_project_checks,
            extract_pdf_text,
            search_google,
            get_routines,
            get_recent_history,
            get_proposals,
            generate_learning_proposal,
            get_proposal_steps,
            update_learning_proposal,
            approve_learning_proposal,
            reject_learning_proposal,
            get_voice_corrections,
            save_voice_correction_entry,
            get_local_voice_backend_status,
            save_local_voice_backend_paths,
            transcribe_local_audio,
            get_local_speech_output_status,
            save_local_speech_output_paths,
            speak_local_text,
            get_wake_mode_status,
            save_wake_mode_status,
            get_browser_aliases,
            save_browser_alias_entry,
            get_learned_intents,
            save_learned_intent_entry,
            delete_learned_intent_entry,
            get_google_calendar_status,
            save_google_calendar_status,
            get_spotify_status,
            save_spotify_status,
            get_notion_status,
            save_notion_status,
            create_notion_note,
            create_notion_task,
            list_notion_notes,
            search_notion_notes,
            update_notion_note_title,
            update_notion_task,
            get_ollama_status,
            save_ollama_status,
            interpret_conversation_with_ollama,
            generate_missing_skill_plan_with_ollama,
            call_model_provider_chat,
            send_chat_with_provider,
            get_model_provider_secret_status,
            save_model_provider_secret_entry,
            save_provider_key,
            delete_provider_key,
            list_provider_key_status,
            test_provider_key,
            save_google_session_token,
            get_google_session_token,
            clear_google_session_token,
            create_build_handoff_artifact,
            get_executor_status,
            save_executor_status,
            launch_executor_handoff,
            memory_remember,
            memory_recall,
            memory_list_people,
            memory_list_entity_controls,
            memory_set_entity_control,
            memory_correct_entity,
            import_people_memory,
            memory_list_travel,
            import_travel_memory,
            memory_list_expenses,
            import_expense_memory,
            memory_list_packages,
            import_package_memory,
            memory_list_meeting_prep,
            import_meeting_prep_memory,
            memory_list_school_plans,
            import_school_plan_memory,
            crate::commands::terminal::detect_coding_clis,
            crate::commands::terminal::read_handoff_markdown,
            crate::commands::terminal::read_handoff_prompt,
            crate::commands::planner::compose_day_plan,
            crate::commands::planner::get_day_plan,
            crate::commands::planner::replan_day,
            crate::commands::planner::save_day_plan_to_notion,
            crate::commands::planner::get_app_feature_flags,
            crate::commands::trigger_recipes::list_trigger_recipes_cmd,
            crate::commands::trigger_recipes::save_trigger_recipe_cmd,
            crate::commands::trigger_recipes::delete_trigger_recipe_cmd,
            crate::commands::trigger_recipes::search_audit_log_cmd,
            crate::commands::trigger_recipes::rollback_audit_entry_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
