use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutineRecord {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub trigger_phrase: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryRecord {
    pub id: i64,
    pub raw_command: String,
    pub resolved_intent: String,
    pub action_status: String,
    pub executed_actions: String,
    pub created_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposalRecord {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub trigger_phrase: String,
    pub status: String,
    pub reason_summary: String,
    pub confidence: f64,
    pub based_on_count: i64,
    pub created_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposalStepRecord {
    pub id: i64,
    pub proposal_id: i64,
    pub step_order: i64,
    pub action_type: String,
    pub action_value: String,
    pub requires_permission: bool,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposalUpdateInput {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub trigger_phrase: String,
    pub steps: Vec<ProposalStepInput>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposalStepInput {
    pub id: i64,
    pub step_order: i64,
    pub action_type: String,
    pub action_value: String,
    pub requires_permission: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceCorrectionRecord {
    pub id: i64,
    pub heard_phrase: String,
    pub corrected_phrase: String,
    pub created_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalVoiceBackendStatus {
    pub backend: String,
    pub available: bool,
    pub configured: bool,
    pub provider_name: String,
    pub executable_path: Option<String>,
    pub model_path: Option<String>,
    pub message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSpeechOutputStatus {
    pub backend: String,
    pub available: bool,
    pub configured: bool,
    pub provider_name: String,
    pub executable_path: Option<String>,
    pub model_path: Option<String>,
    pub message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WakeModeStatus {
    pub assistant_name: String,
    pub wake_mode_enabled: bool,
    pub message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserAliasRecord {
    pub id: i64,
    pub phrase: String,
    pub url: String,
    pub created_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LearnedIntentRecord {
    pub id: i64,
    pub phrase: String,
    pub normalized_phrase: String,
    pub intent_kind: String,
    pub intent_payload: String,
    pub use_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionStatus {
    pub configured: bool,
    pub available: bool,
    pub has_token: bool,
    pub database_id: Option<String>,
    pub message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteRecord {
    pub id: String,
    pub title: String,
    pub summary: String,
    pub url: String,
    pub last_edited_time: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleCalendarStatus {
    pub configured: bool,
    pub has_client_id: bool,
    pub has_api_key: bool,
    pub client_id: Option<String>,
    pub api_key: Option<String>,
    pub message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileRecord {
    pub path: String,
    pub name: String,
    pub modified_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpotifyStatus {
    pub configured: bool,
    pub has_client_id: bool,
    pub client_id: Option<String>,
    pub message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaStatus {
    pub backend: String,
    pub available: bool,
    pub configured: bool,
    pub provider_name: String,
    pub base_url: Option<String>,
    pub model_name: Option<String>,
    pub message: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationInterpretationRequest {
    pub command: String,
    pub assistant_name: String,
}

#[derive(Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationInterpretation {
    pub kind: String,
    pub query: Option<String>,
    pub url: Option<String>,
    pub clarification_prompt: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissingSkillPlanRequest {
    pub command: String,
    pub assistant_name: String,
}

#[derive(Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissingSkillPlan {
    pub skill_name: String,
    pub summary: String,
    pub user_value: String,
    pub build_steps: Vec<String>,
    pub permissions_needed: Vec<String>,
    pub approval_message: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillBuildRequestInput {
    pub skill_name: String,
    pub title: String,
    pub prompt: String,
    pub safety_checks: Vec<String>,
    pub created_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildHandoffArtifact {
    pub markdown_path: String,
    pub json_path: String,
    pub created_at: String,
    pub message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutorStatus {
    pub configured: bool,
    pub available: bool,
    pub command_path: Option<String>,
    pub working_directory: Option<String>,
    pub message: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutorLaunchRequest {
    pub json_path: String,
    pub markdown_path: String,
}
