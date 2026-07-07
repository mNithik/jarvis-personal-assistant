import { invoke } from "@tauri-apps/api/core";
import {
  BuildHandoffArtifact,
  BrowserAliasRecord,
  ConversationInterpretation,
  FileRecord,
  GoogleCalendarStatus,
  HistoryRecord,
  LearnedIntentRecord,
  MissingSkillPlan,
  NoteRecord,
  NotionStatus,
  ProposalRecord,
  ProposalStepRecord,
  ProposalUpdateInput,
  RoutineRecord,
  SkillBuildRequest,
  SpotifyStatus,
  VoiceCorrectionRecord,
} from "../types/jarvis";
import {
  OllamaStatus,
  ExecutorStatus,
  LocalSpeechOutputStatus,
  LocalVoiceBackendStatus,
  WakeModeStatus,
} from "../types/voice";

export function pingJarvis() {
  return invoke<string>("ping_jarvis");
}

export type GatewayAgentKind =
  | "command"
  | "vision"
  | "memory"
  | "integrations"
  | "builder";

export type GatewayModelTier =
  | "local"
  | "talker"
  | "planner"
  | "worker"
  | "embed";

export type GatewaySensitivity = "public" | "personal" | "secret";

export type GatewayConfidenceBand = "high" | "medium" | "low";

export type GatewayDecisionPolicy = "execute" | "confirm" | "teach";

export type RouteLevel = "l0" | "l0_5" | "l1" | "l1_5" | "l2" | "fallback";

export type GatewayEventKind =
  | "thinking"
  | "route_decided"
  | "tool_start"
  | "tool_end"
  | "approval_required"
  | "screen_analyzed"
  | "reply"
  | "knowledge_recalled"
  | "error";

export type TurnSource = "text" | "voice" | "automation" | "mcp";

export type GatewayRoute = {
  capabilityId: string;
  capabilityLabel: string;
  agent: GatewayAgentKind;
  tier: GatewayModelTier;
  sensitivity: GatewaySensitivity;
  score: number;
  confidence: GatewayConfidenceBand;
  decisionPolicy: GatewayDecisionPolicy;
  decisionReason: string;
  reason: string;
  routeLevel: RouteLevel;
  resolvedProvider: string | null;
};

export type TurnRequest = {
  sessionId?: string | null;
  command: string;
  source?: TurnSource | null;
  idempotencyKey?: string | null;
};

export type IntegrationHandoff = {
  capabilityId: string;
  action: string;
  payload?: string | null;
};

export type TurnResult = {
  sessionId: string;
  turnId: number;
  legacy: boolean;
  reply: string;
  route: GatewayRoute | null;
  integrationHandoff?: IntegrationHandoff | null;
};

export type ApprovalRisk = "read" | "write" | "destructive";

export type ApprovalRequest = {
  id: string;
  sessionId: string;
  title: string;
  detail: string;
  risk: ApprovalRisk;
  createdAt: string;
};

export type GatewayEvent = {
  id: string;
  sessionId: string;
  turnId: number | null;
  kind: GatewayEventKind;
  message: string;
  createdAt: string;
  approval: ApprovalRequest | null;
};

export type GatewayPreview = {
  events: GatewayEvent[];
  result: TurnResult;
};

export type GatewayFeatures = {
  studyRoutine: boolean;
  screenOcr: boolean;
  gmail: boolean;
  notion: boolean;
  spotify: boolean;
  calendar: boolean;
  ocrNotion: boolean;
  emailNotion: boolean;
  memory: boolean;
  builder: boolean;
};

export type GatewayRoutingConfig = {
  l2Enabled: boolean;
  preferLocalForPersonal: boolean;
  jarvisRouterEnabled?: boolean;
};

export type GatewaySttProvider = "browser" | "local" | "groq";

export type GatewayVoiceConfig = {
  sttProvider: GatewaySttProvider;
  talkerEnabled: boolean;
};

export type GatewayQuotaConfig = {
  groqDailyRequests: number;
  openrouterDailyRequests: number;
  nvidiaNimDailyRequests: number;
  cerebrasDailyRequests: number;
};

export type GatewayBudgetConfig = {
  maxStepsPerTurn: number;
  maxWallTimeSeconds: number;
  maxRetriesPerStep: number;
  maxMcpPayloadBytes: number;
};

export type GatewayProactiveConfig = {
  heartbeatEnabled: boolean;
  heartbeatIntervalMinutes: number;
  morningBriefEnabled: boolean;
  morningBriefTime: string;
  ocrWatchTickEnabled: boolean;
  plannerCopilotEnabled?: boolean;
  dayReplanOnCalendarChange?: boolean;
};

export type AppFeatureFlags = {
  embeddedTerminalEnabled: boolean;
};

export type DayPlanRecord = {
  planDate: string;
  topThree: string[];
  fullPlanText: string;
  notionPageId: string | null;
  suggestedActions: string[];
  createdAt: string;
  updatedAt: string;
};

export type GatewayMode = "execute" | "dry_run" | "plan_only";

export type GatewayKnowledgeConfig = {
  localVaultPath?: string;
  obsidianHostId?: string;
  readwiseCsvPath?: string;
  zoteroBibPath?: string;
};

export type GatewayChannelsConfig = {
  localWsEnabled: boolean;
  localWsPort: number;
  localWsToken?: string;
  mobileApproveEnabled?: boolean;
  telegramEnabled: boolean;
  telegramBotToken?: string;
  discordEnabled: boolean;
  discordBotToken?: string;
};

export type GatewayTrainingConfig = {
  exportEnabled: boolean;
  evalMinAccuracyPct?: number;
};

export type GatewayPaidModeConfig = {
  enabled: boolean;
  maxDailyRequests: number;
  requireUserOptIn: boolean;
};

export type GatewayLabsConfig = {
  projectBundlePilot: boolean;
  councilVerifier: boolean;
  councilRuntime?: boolean;
  proactiveAnomaly: boolean;
  worldModelQueries: boolean;
  ambientCopilot?: boolean;
};

export type GatewayConfig = {
  enabled: boolean;
  mode: GatewayMode;
  features: GatewayFeatures;
  correlationPrefix: string;
  routing: GatewayRoutingConfig;
  voice: GatewayVoiceConfig;
  quotas: GatewayQuotaConfig;
  budgets: GatewayBudgetConfig;
  proactive: GatewayProactiveConfig;
  knowledge?: GatewayKnowledgeConfig;
  channels?: GatewayChannelsConfig;
  training?: GatewayTrainingConfig;
  paid?: GatewayPaidModeConfig;
  labs?: GatewayLabsConfig;
  mcpHosts: McpHostEntry[];
};

export type TriggerEvent = {
  id: string;
  kind: string;
  payload: string;
  status: string;
  createdAt: string;
};

export type LocalTurnApiStatus = {
  listening: boolean;
  port: number;
  lastError?: string;
  lastRequestAt?: string;
};

export type GatewayCapabilityRecord = {
  id: string;
  label: string;
  agent: string;
  tier: string;
  provider?: string;
  quotaKey?: string;
};

export type McpHostEntry = {
  id: string;
  label: string;
  transport: string;
  command?: string;
  readOnly: boolean;
  external: boolean;
  env?: Record<string, string>;
};

export type JarvisServiceStatus = {
  running: boolean;
  updatedAt?: string;
};

export type ModelPreset = {
  id: string;
  providerId: string;
  label: string;
  chatModel: string;
  codingModel: string;
  reasoningModel: string;
  talkerTier: GatewayModelTier;
  plannerTier: GatewayModelTier;
  workerTier: GatewayModelTier;
};

export type ProviderDefaults = {
  providerId: string;
  baseUrl: string;
  chatModel: string;
  codingModel: string;
  reasoningModel: string;
  enabled: boolean;
};

export type GatewayToolDefinition = {
  id: string;
  label: string;
  risk: ApprovalRisk;
  category: string;
};

export type GatewayTurnResponse = {
  correlationId: string;
  events: GatewayEvent[];
  result: TurnResult;
  approval: ApprovalRequest | null;
  awaitingApproval: boolean;
  talkerReply: string | null;
};

export type GatewayApprovalResolution = {
  approved: boolean;
  approvalId: string;
  correlationId: string;
  message: string;
  event: GatewayEvent;
};

export type McpToolDescriptor = {
  name: string;
  description: string;
  risk: ApprovalRisk;
  category: string;
};

export function previewGatewayTurn(request: TurnRequest) {
  return invoke<GatewayPreview>("preview_gateway_turn", { request });
}

export function gatewayRunTurn(request: TurnRequest) {
  return invoke<GatewayTurnResponse>("gateway_run_turn", { request });
}

export function getGatewayConfig() {
  return invoke<GatewayConfig>("get_gateway_config");
}

export function getGatewayAuditLog(limit = 50) {
  return invoke<string[]>("get_gateway_audit_log", { limit });
}

export type GatewayTaskRunSummary = {
  id: string;
  sessionId: string;
  command: string;
  status: string;
  currentStepIndex: number;
  stepCount: number;
  failureCount: number;
  updatedAt: string;
};

export type MemoryEntityControl = {
  entityId: number;
  domain: string;
  label: string;
  pinned: boolean;
  forgotten: boolean;
  confidence: string;
};

export function listGatewayTaskRuns(limit = 20) {
  return invoke<GatewayTaskRunSummary[]>("list_gateway_task_runs", { limit });
}

export function listMemoryEntityControls(domain: string) {
  return invoke<MemoryEntityControl[]>("memory_list_entity_controls", { domain });
}

export function setMemoryEntityControl(args: {
  domain: string;
  entityId: number;
  pinned?: boolean;
  forgotten?: boolean;
  confidence?: string;
}) {
  return invoke<MemoryEntityControl>("memory_set_entity_control", args);
}

export function saveGatewayConfig(config: GatewayConfig) {
  return invoke<void>("save_gateway_config", { config });
}

export type DiscordBotStatus = {
  running: boolean;
  lastError?: string | null;
  lastChannelId?: string | null;
  lastMessageAt?: string | null;
};

export function getDiscordBotStatus() {
  return invoke<DiscordBotStatus>("get_discord_bot_status");
}

export function listGatewayTools() {
  return invoke<GatewayToolDefinition[]>("list_gateway_tools");
}

export function listGatewayCapabilities() {
  return invoke<GatewayCapabilityRecord[]>("list_gateway_capabilities");
}

export function listMcpHostRegistry() {
  return invoke<McpHostEntry[]>("list_mcp_host_registry");
}

export function gatewayMcpCallTool(
  hostId: string,
  toolName: string,
  toolArguments?: Record<string, unknown>,
) {
  return invoke<string>("gateway_mcp_call_tool", {
    hostId,
    toolName,
    arguments: toolArguments ?? {},
  });
}

export type McpHostPreset = {
  id: string;
  label: string;
  description: string;
  capabilityFamily: string;
  command: string;
  readOnly: boolean;
};

export function listMcpPresets() {
  return invoke<McpHostPreset[]>("list_mcp_presets");
}

export function testMcpHostConnection(hostId: string) {
  return invoke<string>("test_mcp_host_connection", { hostId });
}

export function gatewayChannelTurn(payload: string) {
  return invoke<GatewayTurnResponse>("gateway_channel_turn", { payload });
}

export function exportTrainingTurn(input: {
  phrase: string;
  capabilityId: string;
  routeLevel: string;
  tools: string[];
  success: boolean;
  latencyMs: number;
}) {
  return invoke<string>("export_training_turn", input);
}

export type TrainingEvalGateResult = {
  totalCases: number;
  correctCases: number;
  accuracyPct: number;
  baselinePct: number;
  minAccuracyPct: number;
  passed: boolean;
  exportRecordCount: number;
  evalFilesScanned: number;
};

export function runTrainingEvalGate() {
  return invoke<TrainingEvalGateResult>("run_training_eval_gate");
}

export function anonymizeTrainingExport() {
  return invoke<string>("anonymize_training_export");
}

export function applyGatewayEasyPreset() {
  return invoke<GatewayConfig>("apply_gateway_easy_preset");
}

export function listTriggerEvents(limit = 20) {
  return invoke<TriggerEvent[]>("list_trigger_events", { limit });
}

export function getLocalTurnApiStatus() {
  return invoke<LocalTurnApiStatus>("get_local_turn_api_status");
}

export function getTriggerQueueStatus() {
  return invoke<number>("get_trigger_queue_status");
}

export function getJarvisServiceStatus() {
  return invoke<JarvisServiceStatus>("get_jarvis_service_status");
}

export function prepareDatabaseMigrations() {
  return invoke<string>("prepare_database_migrations");
}

export function listPendingGatewayApprovals() {
  return invoke<ApprovalRequest[]>("list_pending_gateway_approvals");
}

export function getGatewayTrace(limit = 20) {
  return invoke<GatewayEvent[]>("get_gateway_trace", { limit });
}

export function listMcpTools(readOnly = true) {
  return invoke<McpToolDescriptor[]>("list_mcp_tools", { readOnly });
}

export function gatewayApprove(approvalId: string) {
  return invoke<GatewayApprovalResolution>("gateway_approve", { approvalId });
}

export function gatewayDeny(approvalId: string) {
  return invoke<GatewayApprovalResolution>("gateway_deny", { approvalId });
}

export function listProviderPresets() {
  return invoke<ModelPreset[]>("list_provider_presets");
}

export function listProviderDefaults() {
  return invoke<ProviderDefaults[]>("list_provider_defaults");
}

export function transcribeGroqAudio(audioBase64: string) {
  return invoke<string>("transcribe_groq_audio", { audioBase64 });
}

export function launchStudySetup() {
  return invoke<string>("launch_study_setup");
}

export function launchDesktopApp(appName: string) {
  return invoke<string>("launch_desktop_app", { appName });
}

export function focusDesktopApp(appName: string) {
  return invoke<string>("focus_desktop_app", { appName });
}

export function controlDesktopAppWindow(appName: string, action: string) {
  return invoke<string>("control_desktop_app_window", { appName, action });
}

export function getDesktopAppWindowStatus(appName: string) {
  return invoke<string>("get_desktop_app_window_status", { appName });
}

export function openNamedFolder(folderName: string) {
  return invoke<string>("open_named_folder", { folderName });
}

export function captureDesktopScreenshot() {
  return invoke<string>("capture_desktop_screenshot");
}

export function captureActiveWindowScreenshot() {
  return invoke<string>("capture_active_window_screenshot");
}

export function captureDesktopAppWindowScreenshot(appName: string) {
  return invoke<string>("capture_desktop_app_window_screenshot", { appName });
}

export function captureScreenRegionScreenshot(region: string) {
  return invoke<string>("capture_screen_region_screenshot", { region });
}

export function captureScreenRectScreenshot(x: number, y: number, width: number, height: number) {
  return invoke<string>("capture_screen_rect_screenshot", { x, y, width, height });
}

export function captureGlobalSelectionScreenshot() {
  return invoke<string>("capture_global_selection_screenshot");
}

export function openScreenshotsFolder() {
  return invoke<string>("open_screenshots_folder");
}

export function extractImageOcrText(path: string) {
  return invoke<string>("extract_image_ocr_text", { path });
}

export function readClipboardText() {
  return invoke<string>("read_clipboard_text");
}

export function writeClipboardText(text: string) {
  return invoke<string>("write_clipboard_text", { text });
}

export function runJarvisProjectChecks() {
  return invoke<string>("run_jarvis_project_checks");
}

export function openBrowserUrl(url: string) {
  return invoke<string>("open_browser_url", { url });
}

export function searchLocalFiles(query: string) {
  return invoke<FileRecord[]>("search_local_files", { query });
}

export function listRecentLocalFiles(limit?: number) {
  return invoke<FileRecord[]>("list_recent_local_files", { limit });
}

export function openLocalFile(path: string) {
  return invoke<string>("open_local_file", { path });
}

export function extractPdfText(path: string) {
  return invoke<string>("extract_pdf_text", { path });
}

export function searchGoogle(query: string) {
  return invoke<string>("search_google", { query });
}

export function getRoutines() {
  return invoke<RoutineRecord[]>("get_routines");
}

export function getRecentHistory() {
  return invoke<HistoryRecord[]>("get_recent_history");
}

export function getProposals() {
  return invoke<ProposalRecord[]>("get_proposals");
}

export function generateLearningProposal() {
  return invoke<ProposalRecord | null>("generate_learning_proposal");
}

export function getProposalSteps(proposalId: number) {
  return invoke<ProposalStepRecord[]>("get_proposal_steps", { proposalId });
}

export function updateLearningProposal(proposal: ProposalUpdateInput) {
  return invoke<void>("update_learning_proposal", { proposal });
}

export function approveLearningProposal(proposalId: number) {
  return invoke<void>("approve_learning_proposal", { proposalId });
}

export function rejectLearningProposal(proposalId: number) {
  return invoke<void>("reject_learning_proposal", { proposalId });
}

export function getVoiceCorrections() {
  return invoke<VoiceCorrectionRecord[]>("get_voice_corrections");
}

export function saveVoiceCorrectionEntry(
  heardPhrase: string,
  correctedPhrase: string,
) {
  return invoke<void>("save_voice_correction_entry", {
    heardPhrase,
    correctedPhrase,
  });
}

export function getLocalVoiceBackendStatus() {
  return invoke<LocalVoiceBackendStatus>("get_local_voice_backend_status");
}

export function saveLocalVoiceBackendPaths(
  executablePath: string,
  modelPath: string,
) {
  return invoke<LocalVoiceBackendStatus>("save_local_voice_backend_paths", {
    executablePath,
    modelPath,
  });
}

export function transcribeLocalAudio(audioBase64: string) {
  return invoke<string>("transcribe_local_audio", { audioBase64 });
}

export function getLocalSpeechOutputStatus() {
  return invoke<LocalSpeechOutputStatus>("get_local_speech_output_status");
}

export function saveLocalSpeechOutputPaths(
  executablePath: string,
  modelPath: string,
) {
  return invoke<LocalSpeechOutputStatus>("save_local_speech_output_paths", {
    executablePath,
    modelPath,
  });
}

export function speakLocalText(text: string) {
  return invoke<void>("speak_local_text", { text });
}

export function getWakeModeStatus() {
  return invoke<WakeModeStatus>("get_wake_mode_status");
}

export function saveWakeModeStatus(
  assistantName: string,
  wakeModeEnabled: boolean,
) {
  return invoke<WakeModeStatus>("save_wake_mode_status", {
    assistantName,
    wakeModeEnabled,
  });
}

export function getBrowserAliases() {
  return invoke<BrowserAliasRecord[]>("get_browser_aliases");
}

export function saveBrowserAliasEntry(phrase: string, url: string) {
  return invoke<void>("save_browser_alias_entry", { phrase, url });
}

export function getLearnedIntents() {
  return invoke<LearnedIntentRecord[]>("get_learned_intents");
}

export function saveLearnedIntentEntry(
  phrase: string,
  normalizedPhrase: string,
  intentKind: string,
  intentPayload: string,
) {
  return invoke<void>("save_learned_intent_entry", {
    phrase,
    normalizedPhrase,
    intentKind,
    intentPayload,
  });
}

export function deleteLearnedIntentEntry(id: number) {
  return invoke<void>("delete_learned_intent_entry", { id });
}

export function getGoogleCalendarStatus() {
  return invoke<GoogleCalendarStatus>("get_google_calendar_status");
}

export function saveGoogleCalendarStatus(clientId: string, apiKey: string) {
  return invoke<GoogleCalendarStatus>("save_google_calendar_status", {
    clientId,
    apiKey,
  });
}

export function getSpotifyStatus() {
  return invoke<SpotifyStatus>("get_spotify_status");
}

export function saveSpotifyStatus(clientId: string) {
  return invoke<SpotifyStatus>("save_spotify_status", {
    clientId,
  });
}

export function getNotionStatus() {
  return invoke<NotionStatus>("get_notion_status");
}

export function saveNotionStatus(accessToken: string, databaseId: string) {
  return invoke<NotionStatus>("save_notion_status", {
    accessToken,
    databaseId,
  });
}

export function createNotionNote(content: string) {
  return invoke<NoteRecord>("create_notion_note", { content });
}

export function createNotionTask(
  title: string,
  dueLabel: string | null,
  dueIso: string | null,
) {
  return invoke<NoteRecord>("create_notion_task", {
    title,
    dueLabel,
    dueIso,
  });
}

export function listNotionNotes() {
  return invoke<NoteRecord[]>("list_notion_notes");
}

export function searchNotionNotes(query: string) {
  return invoke<NoteRecord[]>("search_notion_notes", { query });
}

export function updateNotionNoteTitle(noteId: string, title: string) {
  return invoke<NoteRecord>("update_notion_note_title", {
    noteId,
    title,
  });
}

export function updateNotionTask(
  noteId: string,
  title: string,
  dueLabel: string | null,
  dueIso: string | null,
  status: string,
) {
  return invoke<NoteRecord>("update_notion_task", {
    noteId,
    title,
    dueLabel,
    dueIso,
    status,
  });
}

export function getOllamaStatus() {
  return invoke<OllamaStatus>("get_ollama_status");
}

export function saveOllamaStatus(baseUrl: string, modelName: string) {
  return invoke<OllamaStatus>("save_ollama_status", {
    baseUrl,
    modelName,
  });
}

export function interpretConversationWithOllama(
  command: string,
  assistantName: string,
) {
  return invoke<ConversationInterpretation>("interpret_conversation_with_ollama", {
    request: {
      command,
      assistantName,
    },
  });
}

export function generateMissingSkillPlanWithOllama(
  command: string,
  assistantName: string,
) {
  return invoke<MissingSkillPlan>("generate_missing_skill_plan_with_ollama", {
    request: {
      command,
      assistantName,
    },
  });
}

export type ModelProviderMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ModelProviderChatRequest = {
  providerId: string;
  baseUrl: string;
  apiKey?: string | null;
  model: string;
  messages: ModelProviderMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type ModelProviderChatResponse = {
  providerId: string;
  model: string;
  text: string;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

export function callModelProviderChat(request: ModelProviderChatRequest) {
  return invoke<ModelProviderChatResponse>("send_chat_with_provider", { request });
}

export type ModelProviderSecretStatus = {
  providerId: string;
  displayName: string;
  hasApiKey: boolean;
  keyRef: string;
  maskedPreview: string | null;
  enabled: boolean;
  lastValidatedAt: string | null;
  updatedAt: string | null;
};

export function getModelProviderSecretStatus(providerId: string) {
  return invoke<ModelProviderSecretStatus>("get_model_provider_secret_status", { providerId });
}

export function saveModelProviderSecretEntry(providerId: string, apiKey: string | null) {
  return invoke<ModelProviderSecretStatus>("save_provider_key", {
    request: { providerId, apiKey },
  });
}

export function deleteProviderKey(providerId: string) {
  return invoke<ModelProviderSecretStatus>("delete_provider_key", { providerId });
}

export function listProviderKeyStatus() {
  return invoke<ModelProviderSecretStatus[]>("list_provider_key_status");
}

export function testProviderKey(providerId: string) {
  return invoke<ModelProviderSecretStatus>("test_provider_key", { providerId });
}

export function saveGoogleSessionToken(
  kind: "calendar" | "gmail",
  token: string,
) {
  return invoke<void>("save_google_session_token", { kind, token });
}

export function getGoogleSessionToken(kind: "calendar" | "gmail") {
  return invoke<string>("get_google_session_token", { kind });
}

export function clearGoogleSessionToken(kind: "calendar" | "gmail") {
  return invoke<void>("clear_google_session_token", { kind });
}

export function createBuildHandoffArtifact(request: SkillBuildRequest) {
  return invoke<BuildHandoffArtifact>("create_build_handoff_artifact", { request });
}

export function getExecutorStatus() {
  return invoke<ExecutorStatus>("get_executor_status");
}

export function saveExecutorStatus(
  commandPath: string,
  workingDirectory: string,
) {
  return invoke<ExecutorStatus>("save_executor_status", {
    commandPath,
    workingDirectory,
  });
}

export function launchExecutorHandoff(
  jsonPath: string,
  markdownPath: string,
) {
  return invoke<string>("launch_executor_handoff", {
    request: {
      jsonPath,
      markdownPath,
    },
  });
}

export type CodingCliStatus = {
  pwsh: boolean;
  powershell: boolean;
  claude: boolean;
  codex: boolean;
  preferredShell: string;
};

export function detectCodingClis() {
  return invoke<CodingCliStatus>("detect_coding_clis");
}

export function readHandoffMarkdown(path: string) {
  return invoke<string>("read_handoff_markdown", { path });
}

export function readHandoffPrompt(path: string) {
  return invoke<string>("read_handoff_prompt", { path });
}

export type PersonMemoryRecord = {
  id: string;
  name: string;
  birthdayLabel: string;
  month: number;
  day: number;
  age: number | null;
  relationship: string | null;
  giftNotes: string[];
  contactNotes: string[];
  lastContactLabel: string | null;
  followUpDueLabel: string | null;
  followUpReason: string | null;
  reminderLeadDays: number;
  calendarLinkedAt: string | null;
  source: "manual" | "gmail";
  createdAt: string;
  updatedAt: string;
};

export function memoryRemember(content: string, domain?: string) {
  return invoke<string>("memory_remember", { content, domain });
}

export function memoryRecall(query: string) {
  return invoke<string>("memory_recall", { query });
}

export function memoryListPeople() {
  return invoke<PersonMemoryRecord[]>("memory_list_people");
}

export function importPeopleMemory(records: PersonMemoryRecord[]) {
  return invoke<number>("import_people_memory", { records });
}

export type TravelMemoryRecord = {
  id: string;
  title: string;
  sourceEmailSubject: string;
  transport: string | null;
  departure: string | null;
  arrival: string | null;
  hotel: string | null;
  checkIn: string | null;
  checkOut: string | null;
  confirmationCode: string | null;
  calendarLinkedAt: string | null;
  segmentCount: number;
  timeline: string[];
  checklist: string[];
  summary: string;
  createdAt: string;
};

export type ExpenseMemoryRecord = {
  id: string;
  title: string;
  sourceEmailSubject: string;
  merchant: string | null;
  amount: string | null;
  amountValue: number | null;
  category: string | null;
  expenseDate: string | null;
  orderNumber: string | null;
  recurringLikely: boolean;
  summary: string;
  createdAt: string;
};

export type PackageMemoryRecord = {
  id: string;
  title: string;
  sourceEmailSubject: string;
  carrier: string | null;
  merchant: string | null;
  itemLabel: string | null;
  status: string | null;
  deliveryDate: string | null;
  trackingNumber: string | null;
  statusHistory: string[];
  arrivingToday: boolean;
  arrivingTomorrow: boolean;
  summary: string;
  createdAt: string;
  updatedAt: string;
};

export type MeetingPrepMemoryRecord = {
  id: string;
  eventTitle: string;
  summaryTitle: string;
  focusSummary: string;
  actionItems: string[];
  relatedPeople: string[];
  changesSinceLastPrep: string | null;
  summary: string;
  createdAt: string;
};

export type SchoolPlanMemoryRecord = {
  id: string;
  title: string;
  focusSummary: string;
  subjects: string[];
  sessions: string[];
  assignments: string[];
  examCountdowns: string[];
  summary: string;
  createdAt: string;
};

export function memoryListTravel() {
  return invoke<TravelMemoryRecord[]>("memory_list_travel");
}

export function importTravelMemory(records: TravelMemoryRecord[]) {
  return invoke<number>("import_travel_memory", { records });
}

export function memoryListExpenses() {
  return invoke<ExpenseMemoryRecord[]>("memory_list_expenses");
}

export function importExpenseMemory(records: ExpenseMemoryRecord[]) {
  return invoke<number>("import_expense_memory", { records });
}

export function memoryListPackages() {
  return invoke<PackageMemoryRecord[]>("memory_list_packages");
}

export function importPackageMemory(records: PackageMemoryRecord[]) {
  return invoke<number>("import_package_memory", { records });
}

export function memoryListMeetingPrep() {
  return invoke<MeetingPrepMemoryRecord[]>("memory_list_meeting_prep");
}

export function importMeetingPrepMemory(records: MeetingPrepMemoryRecord[]) {
  return invoke<number>("import_meeting_prep_memory", { records });
}

export function memoryListSchoolPlans() {
  return invoke<SchoolPlanMemoryRecord[]>("memory_list_school_plans");
}

export function importSchoolPlanMemory(records: SchoolPlanMemoryRecord[]) {
  return invoke<number>("import_school_plan_memory", { records });
}

export type OcrWatchRecord = {
  id: string;
  name: string;
  scope: string;
  appName?: string;
  region?: unknown;
  rect?: unknown;
  status: string;
  intervalMs: number;
  logToNotion?: boolean;
  createTaskOnMatch?: boolean;
  action?: unknown;
  rule?: unknown;
  lastText?: string;
  lastMatchKey?: string;
  lastCheckedAt?: string;
};

export type DesktopScheduleDbRecord = {
  id: string;
  projectName: string;
  actionLabel: string;
  dueAt: string;
  createdAt: string;
};

export type SavedWorkflowDbRecord = {
  id: string;
  name: string;
  triggerPhrase: string;
  steps: string[];
  createdAt: string;
  basedOnCount: number;
};

export type LocalStorageImportPayload = {
  ocrWatches: OcrWatchRecord[];
  desktopSchedules: DesktopScheduleDbRecord[];
  savedWorkflows: SavedWorkflowDbRecord[];
};

export type LocalStorageImportResult = {
  ocrWatchesImported: number;
  desktopSchedulesImported: number;
  savedWorkflowsImported: number;
};

export function listOcrWatches() {
  return invoke<OcrWatchRecord[]>("list_ocr_watches_cmd");
}

export function saveOcrWatch(watch: OcrWatchRecord) {
  return invoke<void>("save_ocr_watch_cmd", { watch });
}

export function listDesktopSchedulesDb() {
  return invoke<DesktopScheduleDbRecord[]>("list_desktop_schedules_cmd");
}

export function saveDesktopSchedule(schedule: DesktopScheduleDbRecord) {
  return invoke<void>("save_desktop_schedule_cmd", { schedule });
}

export function listSavedWorkflowsDb() {
  return invoke<SavedWorkflowDbRecord[]>("list_saved_workflows_cmd");
}

export function importAutomationFromLocalStorage(payload: LocalStorageImportPayload) {
  return invoke<LocalStorageImportResult>("import_automation_from_local_storage", { payload });
}

export function getAppFeatureFlags() {
  return invoke<AppFeatureFlags>("get_app_feature_flags");
}

export function composeDayPlan() {
  return invoke<DayPlanRecord>("compose_day_plan");
}

export function getDayPlan() {
  return invoke<DayPlanRecord | null>("get_day_plan");
}

export function replanDay() {
  return invoke<DayPlanRecord>("replan_day");
}

export function saveDayPlanToNotion() {
  return invoke<DayPlanRecord>("save_day_plan_to_notion");
}

export type TriggerRecipeRecord = {
  id: string;
  name: string;
  enabled: boolean;
  kind: string;
  scheduleValue: string | null;
  payloadJson: string;
  createdAt: string;
  updatedAt: string;
};

export type AuditEntry = {
  lineIndex: number;
  timestamp: string;
  policyClass: string;
  agent: string;
  capabilityId: string;
  sessionId: string;
  turnId: number;
  outcome: string;
  detail: string;
  rollbackRef: string | null;
  rawLine: string;
};

export function listTriggerRecipes() {
  return invoke<TriggerRecipeRecord[]>("list_trigger_recipes_cmd");
}

export function saveTriggerRecipe(recipe: TriggerRecipeRecord) {
  return invoke<void>("save_trigger_recipe_cmd", { recipe });
}

export function deleteTriggerRecipe(id: string) {
  return invoke<void>("delete_trigger_recipe_cmd", { id });
}

export function searchAuditLog(args: {
  query?: string;
  policyClass?: string;
  since?: string;
  limit?: number;
}) {
  return invoke<AuditEntry[]>("search_audit_log_cmd", args);
}

export function rollbackAuditEntry(lineIndex: number) {
  return invoke<string>("rollback_audit_entry_cmd", { lineIndex });
}

export type ProjectBundleStep = {
  label: string;
  status: string;
};

export type ProjectBundleRecord = {
  runId: string;
  command: string;
  steps: ProjectBundleStep[];
  createdAt: string;
};

export function listProjectBundles(limit = 5) {
  return invoke<ProjectBundleRecord[]>("list_project_bundles", { limit });
}

export type TopicGraphNode = {
  entityId: number;
  domain: string;
  label: string;
};

export type TopicGraphEdge = {
  id: number;
  subjectEntityId: number;
  predicate: string;
  objectEntityId: number;
  confidence: number;
};

export type TopicGraphBundle = {
  nodes: TopicGraphNode[];
  edges: TopicGraphEdge[];
};

export type UserGoalRecord = {
  id: string;
  profileId?: string;
  title: string;
  description: string;
  status: string;
  targetDate?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProactiveNudgeRecord = {
  id: string;
  kind: string;
  message: string;
  status: string;
  createdAt: string;
};

export function getTopicGraph(limit = 40) {
  return invoke<TopicGraphBundle>("get_topic_graph_cmd", { limit });
}

export function queryTopicNeighbors(query: string) {
  return invoke<string>("query_topic_neighbors_cmd", { query });
}

export function inferTopicGraph() {
  return invoke<number>("infer_topic_graph_cmd");
}

export function linkTopicEntities(
  subjectLabel: string,
  predicate: string,
  objectLabel: string,
) {
  return invoke<string>("link_topic_entities_cmd", {
    subjectLabel,
    predicate,
    objectLabel,
  });
}

export function unlinkTopicRelation(relationId: number) {
  return invoke<string>("unlink_topic_relation_cmd", { relationId });
}

export function listUserGoals() {
  return invoke<UserGoalRecord[]>("list_user_goals_cmd");
}

export function saveUserGoal(goal: UserGoalRecord) {
  return invoke<void>("save_user_goal_cmd", { goal });
}

export function exportSyncBundle(passphrase: string) {
  return invoke<string>("export_sync_bundle_cmd", { passphrase });
}

export function importSyncBundle(bundlePath: string, passphrase: string) {
  return invoke<string>("import_sync_bundle_cmd", { bundlePath, passphrase });
}

export function listProactiveNudges(limit = 10) {
  return invoke<ProactiveNudgeRecord[]>("list_proactive_nudges_cmd", { limit });
}

export function dismissProactiveNudge(id: string) {
  return invoke<void>("dismiss_proactive_nudge_cmd", { id });
}

export function acceptProactiveNudge(id: string) {
  return invoke<void>("accept_proactive_nudge_cmd", { id });
}

export type UserProfileRecord = {
  id: string;
  name: string;
  kind: string;
  createdAt: string;
};

export type InstalledSkillRecord = {
  id: string;
  version: string;
  label: string;
  enabled: boolean;
  keywords: string[];
  sourceScope: string;
  profileId?: string | null;
};

export type AmbientSuggestionRecord = {
  id: string;
  sessionId: string;
  message: string;
  status: string;
  createdAt: string;
};

export function listUserProfiles() {
  return invoke<UserProfileRecord[]>("list_user_profiles_cmd");
}

export function getActiveProfile() {
  return invoke<UserProfileRecord | null>("get_active_profile_cmd");
}

export function switchUserProfile(profileId: string) {
  return invoke<string>("switch_user_profile_cmd", { profileId });
}

export function listInstalledSkills() {
  return invoke<InstalledSkillRecord[]>("list_installed_skills_cmd");
}

export function startAmbientSession(options?: {
  desktopProjectId?: string;
  ocrWatchId?: string;
  consentGiven?: boolean;
}) {
  return invoke("start_ambient_session_cmd", {
    desktopProjectId: options?.desktopProjectId ?? null,
    ocrWatchId: options?.ocrWatchId ?? null,
    consentGiven: options?.consentGiven ?? false,
  });
}

export function endAmbientSession(sessionId: string) {
  return invoke<void>("end_ambient_session_cmd", { sessionId });
}

export function listAmbientSuggestions(limit = 10) {
  return invoke<AmbientSuggestionRecord[]>("list_ambient_suggestions_cmd", { limit });
}

export function dismissAmbientSuggestion(id: string) {
  return invoke<void>("dismiss_ambient_suggestion_cmd", { id });
}

export function recordAmbientSignal(signal: string) {
  return invoke<AmbientSuggestionRecord | null>("record_ambient_signal_cmd", { signal });
}

export type RemoteSyncAccount = {
  endpoint: string;
  deviceToken: string;
  deviceId: string;
  lastSyncAt?: string | null;
  lastRemoteVersion?: number | null;
};

export type RemoteSyncStatus = {
  connected: boolean;
  endpoint: string;
  deviceId: string;
  lastSyncAt?: string | null;
  pendingConflicts: number;
};

export type SyncConflict = {
  id: string;
  kind: "goal" | "profile" | "triggerRecipe" | "memoryEntity";
  localSummary: string;
  remoteSummary: string;
  localUpdatedAt?: string | null;
  remoteUpdatedAt?: string | null;
};

export type RemoteSyncResult = {
  summary: string;
  conflicts: SyncConflict[];
  applied: boolean;
};

export type MarketplaceCatalogEntry = {
  id: string;
  label: string;
  version: string;
  description: string;
  keywords: string[];
  sourcePath: string;
  operatorLane?: string | null;
};

export function remoteSyncStatus() {
  return invoke<RemoteSyncStatus>("remote_sync_status_cmd");
}

export function connectRemoteSync(endpoint: string, deviceToken: string) {
  return invoke("connect_remote_sync_cmd", { endpoint, deviceToken });
}

export function registerRemoteSync(endpoint: string, label?: string) {
  return invoke<RemoteSyncAccount>("register_remote_sync_cmd", { endpoint, label });
}

export function pushRemoteSync(passphrase: string) {
  return invoke<RemoteSyncResult>("push_remote_sync_cmd", { passphrase });
}

export function pullRemoteSync(passphrase: string, resolutions?: string[]) {
  return invoke<RemoteSyncResult>("pull_remote_sync_cmd", { passphrase, resolutions });
}

export function listPendingSyncConflicts() {
  return invoke<SyncConflict[]>("list_pending_sync_conflicts_cmd");
}

export function listMarketplaceCatalog() {
  return invoke<MarketplaceCatalogEntry[]>("list_marketplace_catalog_cmd");
}

export function refreshMarketplaceCatalog() {
  return invoke<MarketplaceCatalogEntry[]>("refresh_marketplace_catalog_cmd");
}

export function installMarketplaceSkill(skillId: string) {
  return invoke<{ skillId: string; installedPath: string; message: string }>(
    "install_marketplace_skill_cmd",
    { skillId },
  );
}

export function marketplaceOperatorLane(skillId: string) {
  return invoke<string>("marketplace_operator_lane_cmd", { skillId });
}

export type ProactiveMetrics = {
  shown: number;
  dismissed: number;
  accepted: number;
  dismissRate: number;
  acceptRate: number;
};

export function getProactiveMetrics() {
  return invoke<ProactiveMetrics>("get_proactive_metrics_cmd");
}

export function exportProactiveMetrics() {
  return invoke<string>("export_proactive_metrics_cmd");
}
