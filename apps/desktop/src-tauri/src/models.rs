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

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelProviderMessage {
    pub role: String,
    pub content: String,
}

#[derive(Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelProviderChatRequest {
    pub provider_id: String,
    pub base_url: String,
    pub api_key: Option<String>,
    pub model: String,
    pub messages: Vec<ModelProviderMessage>,
    pub temperature: Option<f64>,
    pub max_tokens: Option<i64>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelProviderChatResponse {
    pub provider_id: String,
    pub model: String,
    pub text: String,
    pub latency_ms: u128,
    pub prompt_tokens: Option<i64>,
    pub completion_tokens: Option<i64>,
    pub total_tokens: Option<i64>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelProviderSecretRequest {
    pub provider_id: String,
    pub api_key: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelProviderSecretStatus {
    pub provider_id: String,
    pub display_name: String,
    pub has_api_key: bool,
    pub key_ref: String,
    pub masked_preview: Option<String>,
    pub enabled: bool,
    pub last_validated_at: Option<String>,
    pub updated_at: Option<String>,
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

#[derive(Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PersonMemoryRecord {
    pub id: String,
    pub name: String,
    pub birthday_label: String,
    pub month: i32,
    pub day: i32,
    pub age: Option<i32>,
    pub relationship: Option<String>,
    pub gift_notes: Vec<String>,
    pub contact_notes: Vec<String>,
    pub last_contact_label: Option<String>,
    pub follow_up_due_label: Option<String>,
    pub follow_up_reason: Option<String>,
    pub reminder_lead_days: i32,
    pub calendar_linked_at: Option<String>,
    pub source: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TravelMemoryRecord {
    pub id: String,
    pub title: String,
    pub source_email_subject: String,
    pub transport: Option<String>,
    pub departure: Option<String>,
    pub arrival: Option<String>,
    pub hotel: Option<String>,
    pub check_in: Option<String>,
    pub check_out: Option<String>,
    pub confirmation_code: Option<String>,
    pub calendar_linked_at: Option<String>,
    pub segment_count: i32,
    pub timeline: Vec<String>,
    pub checklist: Vec<String>,
    pub summary: String,
    pub created_at: String,
}

#[derive(Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExpenseMemoryRecord {
    pub id: String,
    pub title: String,
    pub source_email_subject: String,
    pub merchant: Option<String>,
    pub amount: Option<String>,
    pub amount_value: Option<f64>,
    pub category: Option<String>,
    pub expense_date: Option<String>,
    pub order_number: Option<String>,
    pub recurring_likely: bool,
    pub summary: String,
    pub created_at: String,
}

#[derive(Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PackageMemoryRecord {
    pub id: String,
    pub title: String,
    pub source_email_subject: String,
    pub carrier: Option<String>,
    pub merchant: Option<String>,
    pub item_label: Option<String>,
    pub status: Option<String>,
    pub delivery_date: Option<String>,
    pub tracking_number: Option<String>,
    pub status_history: Vec<String>,
    pub arriving_today: bool,
    pub arriving_tomorrow: bool,
    pub summary: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MeetingPrepMemoryRecord {
    pub id: String,
    pub event_title: String,
    pub summary_title: String,
    pub focus_summary: String,
    pub action_items: Vec<String>,
    pub related_people: Vec<String>,
    pub changes_since_last_prep: Option<String>,
    pub summary: String,
    pub created_at: String,
}

#[derive(Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SchoolPlanMemoryRecord {
    pub id: String,
    pub title: String,
    pub focus_summary: String,
    pub subjects: Vec<String>,
    pub sessions: Vec<String>,
    pub assignments: Vec<String>,
    pub exam_countdowns: Vec<String>,
    pub summary: String,
    pub created_at: String,
}
