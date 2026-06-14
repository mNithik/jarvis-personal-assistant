import { FormEvent, ReactNode, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  approveLearningProposal,
  callModelProviderChat,
  captureActiveWindowScreenshot,
  captureDesktopScreenshot,
  captureDesktopAppWindowScreenshot,
  captureGlobalSelectionScreenshot,
  captureScreenRectScreenshot,
  captureScreenRegionScreenshot,
  controlDesktopAppWindow,
  createBuildHandoffArtifact,
  deleteLearnedIntentEntry,
  deleteProviderKey,
  createNotionNote,
  createNotionTask,
  extractImageOcrText,
  extractPdfText,
  focusDesktopApp,
  generateLearningProposal,
  getBrowserAliases,
  getGoogleCalendarStatus,
  getDesktopAppWindowStatus,
  getLearnedIntents,
  getModelProviderSecretStatus,
  listProviderKeyStatus,
  getExecutorStatus,
  getLocalSpeechOutputStatus,
  getLocalVoiceBackendStatus,
  getNotionStatus,
  getOllamaStatus,
  generateMissingSkillPlanWithOllama,
  listNotionNotes,
  listRecentLocalFiles,
  openBrowserUrl,
  openLocalFile,
  getProposals,
  getProposalSteps,
  getRecentHistory,
  getRoutines,
  searchLocalFiles,
  searchNotionNotes,
  getVoiceCorrections,
  getWakeModeStatus,
  interpretConversationWithOllama,
  launchDesktopApp,
  launchStudySetup,
  openNamedFolder,
  openScreenshotsFolder,
  pingJarvis,
  rejectLearningProposal,
  saveBrowserAliasEntry,
  saveExecutorStatus,
  saveGoogleCalendarStatus,
  saveLearnedIntentEntry,
  saveModelProviderSecretEntry,
  testProviderKey,
  saveLocalSpeechOutputPaths,
  saveLocalVoiceBackendPaths,
  saveNotionStatus,
  saveOllamaStatus,
  saveSpotifyStatus,
  saveVoiceCorrectionEntry,
  saveWakeModeStatus,
  runJarvisProjectChecks,
  searchGoogle,
  speakLocalText,
  transcribeGroqAudio,
  transcribeLocalAudio,
  updateNotionTask,
  updateLearningProposal,
  launchExecutorHandoff,
  getSpotifyStatus,
  readClipboardText,
  writeClipboardText,
  importPeopleMemory,
  importTravelMemory,
  importExpenseMemory,
  importPackageMemory,
  importMeetingPrepMemory,
  importSchoolPlanMemory,
  memoryListPeople,
  memoryListTravel,
  memoryListExpenses,
  memoryListPackages,
  memoryListMeetingPrep,
  memoryListSchoolPlans,
  type GatewayConfig,
  type GatewayEvent,
  type GatewayPreview,
  type GatewayTurnResponse,
  type IntegrationHandoff,
} from "../../services/jarvisApi";
import { startLocalAudioRecorder } from "../../services/localAudioRecorder";
import {
  beginGoogleRedirectAuthorization,
  clearStoredGoogleAccessToken,
  completeGoogleRedirectAuthorizationIfNeeded,
  createGoogleCalendarEvent,
  getStoredGoogleAccessToken,
  listTodayGoogleCalendarEvents,
  GoogleCalendarEventRecord,
} from "../../services/googleCalendar";
import {
  listUnreadGmailMessages,
  requestGmailAccessToken,
  searchGmailMessages,
} from "../../services/gmail";
import {
  beginSpotifyAuthorization,
  clearSpotifySession,
  completeSpotifyAuthorizationIfNeeded,
  getSpotifyPlaybackState,
  getStoredSpotifyAccessToken,
  playSpotifySearchResult,
  queueSpotifyTrack,
  saveSpotifyTrack,
  searchSpotifyPlayable,
  spotifyPausePlayback,
  spotifyResumePlayback,
  spotifySkipToNext,
  spotifySkipToPrevious,
  SpotifyPlaybackState,
} from "../../services/spotify";
import { speakText } from "../../services/speechSynthesis";
import { createVoiceRecognition } from "../../services/voiceRecognition";
import {
  BrowserAliasRecord,
  ConversationInterpretation,
  FileRecord,
  GoogleCalendarStatus,
  HistoryRecord,
  LearnedIntentRecord,
  AutonomousBuildStatus,
  BuildHandoffArtifact,
  EmailRecord,
  MissingSkillPlan,
  NoteRecord,
  NotionStatus,
  ProposalRecord,
  ProposalStepRecord,
  RoutineRecord,
  SkillBuildRequest,
  SpotifyStatus,
  SkillImplementationRequest,
  VoiceCorrectionRecord,
} from "../../types/jarvis";
import {
  ConversationBackend,
  ExecutorStatus,
  LocalSpeechOutputStatus,
  LocalVoiceBackendStatus,
  OllamaStatus,
  SpeechOutputBackend,
  SpeechRecognitionState,
  VoiceBackend,
  VoiceSessionPhase,
  WakeModeStatus,
} from "../../types/voice";
import JarvisShell from "../shell/JarvisShell";
import { jarvisModules } from "./jarvisModules";
import { JarvisAppProvider } from "../context/JarvisAppContext";
import { useJarvisCommandRouter } from "../../hooks/useJarvisCommandRouter";
import { useJarvisGatewayShell } from "../../hooks/useJarvisGatewayShell";
import { useJarvisSemanticRouting } from "../../hooks/useJarvisSemanticRouting";
import { useJarvisVoiceSession } from "../../hooks/useJarvisVoiceSession";
import { useJarvisVoiceWake } from "../../hooks/useJarvisVoiceWake";
import { useOcrWatchScheduler } from "../../hooks/useOcrWatchScheduler";
import type { CommandRouterDeps } from "../../features/command/createJarvisCommandRouter";
import QuickBar from "../shell/QuickBar";
import DataSphere from "../shell/DataSphere";
import AppLaunchpad from "../shell/AppLaunchpad";
import CockpitOverlay from "../cockpit/CockpitOverlay";
import GatewayTracePanel from "../cockpit/GatewayTracePanel";
import FloatingPanelHost from "../floating/FloatingPanelHost";
import SystemDrawer from "../settings/SystemDrawer";
import AdvancedConfigPanel from "../settings/AdvancedConfigPanel";
import { createLocalMemoryActions } from "../../features/memory/localMemoryActions";
import { useJarvisWorkspaceSections } from "../../hooks/useJarvisWorkspaceSections";
import SystemDrawerStack from "../settings/SystemDrawerStack";
import CommandWorkspace from "../workspaces/CommandWorkspace";
import VisionWorkspace from "../workspaces/VisionWorkspace";
import MemoryWorkspace from "../workspaces/MemoryWorkspace";
import AutomationWorkspace from "../workspaces/AutomationWorkspace";
import WorkspacesWorkspace from "../workspaces/WorkspacesWorkspace";
import ConnectionsWorkspace from "../workspaces/ConnectionsWorkspace";
import ModelsWorkspace from "../workspaces/ModelsWorkspace";
import BuilderWorkspace from "../workspaces/BuilderWorkspace";
import { workspaceRegistry } from "../model/workspaceRegistry";
import {
  defaultJarvisUiState,
  jarvisUiReducer,
} from "../model/uiReducer";
import {
  JARVIS_UI_PREFERENCES_STORAGE_KEY,
  loadJarvisUiState,
  persistJarvisUiState,
} from "../model/uiPersistence";
import { executeUiQuickAction } from "../model/uiActionAdapter";
import { JarvisWorkspaceId } from "../model/jarvisTypes";
import {
  jarvisQuickPrompts,
  jarvisSkills,
  skillAutopilotAvailable,
} from "./jarvisStaticCatalog";

type BrowserRecognitionHandle = ReturnType<typeof createVoiceRecognition>;

type CommandResult = {
  title: string;
  detail: string;
  routeLabel?: string;
};

type PendingGatewayConfirmation = {
  command: string;
  preview: GatewayPreview;
};

type PendingGatewayTeaching = {
  phrase: string;
  preview: GatewayPreview;
};

import {
  ASSISTANT_DEFAULTS_STORAGE_KEY,
  CLOUD_MODEL_PROVIDERS,
  CONVERSATION_BACKEND_STORAGE_KEY,
  DEFAULT_DESKTOP_PERMISSION_SETTINGS,
  DEFAULT_UI_PREFERENCES,
  DESKTOP_PERMISSION_SETTINGS_STORAGE_KEY,
  DESKTOP_PROJECTS_STORAGE_KEY,
  DESKTOP_SCHEDULES_STORAGE_KEY,
  DISMISSED_WORKFLOWS_STORAGE_KEY,
  EMBEDDING_CONFIG_STORAGE_KEY,
  EXPENSE_MEMORY_STORAGE_KEY,
  FOLLOW_UP_WINDOW_MS,
  MEETING_PREP_MEMORY_STORAGE_KEY,
  MODEL_PROVIDER_LABELS,
  MODEL_PROVIDER_PRESETS,
  MODEL_ROUTER_CONFIG_STORAGE_KEY,
  MODEL_ROUTER_USAGE_STORAGE_KEY,
  OCR_CORRECTIONS_STORAGE_KEY,
  OCR_HISTORY_STORAGE_KEY,
  OCR_WATCHES_STORAGE_KEY,
  OCR_WATCH_TEMPLATES_STORAGE_KEY,
  OPENAI_COMPATIBLE_PROVIDER_IDS,
  PACKAGE_MEMORY_STORAGE_KEY,
  PAID_MODEL_PROVIDERS,
  PEOPLE_MEMORY_STORAGE_KEY,
  RECOMMENDED_ASSISTANT_DEFAULTS,
  SAVED_WORKFLOWS_STORAGE_KEY,
  SCHOOL_PLAN_MEMORY_STORAGE_KEY,
  SEMANTIC_CONVERSATION_MEMORY_STORAGE_KEY,
  SEMANTIC_INTENT_FEEDBACK_STORAGE_KEY,
  TRAVEL_MEMORY_STORAGE_KEY,
  UI_PREFERENCES_STORAGE_KEY,
  USER_PREFERENCE_MEMORY_STORAGE_KEY,
  VOICE_REPLY_MODE_STORAGE_KEY,
  WORKFLOW_COUNTS_STORAGE_KEY,
  addMinutes,
  applyOcrCorrections,
  buildBatchEmailSaveReply,
  buildBatchOverdueTaskReply,
  buildBatchPdfSummaryReply,
  buildBirthdayCalendarReply,
  buildBirthdayImportReply,
  buildBirthdayLookupReply,
  buildBirthdaySavedReply,
  buildCalendarEventReply,
  buildCalendarIntentFromEmail,
  buildCategoryExpenseReply,
  buildClarificationForCommand,
  buildClarificationReply,
  buildClipboardCleanupReply,
  buildClipboardNotionReply,
  buildClipboardOpenReply,
  buildClipboardReadReply,
  buildClipboardSearchReply,
  buildClipboardWriteReply,
  buildCompleteTaskReply,
  buildConversationMemoryText,
  buildCreateNoteReply,
  buildCreateTaskReply,
  buildDailyBriefContent,
  buildDailyBriefContentV4,
  buildDailyBriefReply,
  buildDelayedPackageReply,
  buildDesktopAppReply,
  buildDesktopFocusReply,
  buildDesktopProjectCreatedReply,
  buildDesktopProjectDeletedReply,
  buildDesktopProjectOpenedReply,
  buildDesktopProjectUpdatedReply,
  buildDesktopProjectsListReply,
  buildEmailSignalsReply,
  buildEmailToCalendarReply,
  buildExamCountdowns,
  buildExpenseExtractionReply,
  buildExpenseSavedReply,
  buildExpenseSummaryReply,
  buildFailureReply,
  buildFileSearchReply,
  buildFocusSummary,
  buildGmailThreadUrl,
  buildGoogleCalendarEventUrl,
  buildGoogleSearchReply,
  buildGoogleSearchUrl,
  buildLearnedIntentFamilySummaries,
  buildListNotesReply,
  buildLocalSemanticEmbedding,
  buildMeetingActionItems,
  buildMeetingChangeSummary,
  buildMeetingFocusSummary,
  buildMeetingPrepContent,
  buildMeetingPrepReply,
  buildMeetingPrepSavedReply,
  buildMissingSkillReply,
  buildMoveTaskReply,
  buildNamedFolderReply,
  buildOcrSummary,
  buildOllamaSemanticEmbedding,
  buildOpenEmailReply,
  buildOpenFileReply,
  buildOpenNoteReply,
  buildOpenSiteReply,
  buildOverdueTasksReply,
  buildPackageExtractionReply,
  buildPackageSavedReply,
  buildPackageSummaryReply,
  buildPackageTomorrowReply,
  buildPdfSummaryReply,
  buildPdfTasksReply,
  buildPeopleCheckInReply,
  buildPeopleFollowUpReply,
  buildProactiveSuggestions,
  buildProjectChecksReply,
  buildReadEmailReply,
  buildReadNoteReply,
  buildReadPdfReply,
  buildRecentFilesReply,
  buildRecurringExpenseReply,
  buildReminderReply,
  buildReopenTaskReply,
  buildSaveEmailDigestToNotionReply,
  buildSaveIndexedEmailToNotionReply,
  buildSaveLatestEmailToNotionReply,
  buildSaveQueriedEmailToNotionReply,
  buildSchoolFocusSummary,
  buildSchoolPlanContent,
  buildSchoolPlanReply,
  buildSchoolPlanSavedReply,
  buildSchoolSessions,
  buildScreenshotNotionReply,
  buildScreenshotReply,
  buildScreenshotsFolderReply,
  buildSearchEmailReply,
  buildSearchNotesReply,
  buildSemanticIntentCandidates,
  buildShutdownReply,
  buildSleepReply,
  buildSpotifyLikeReply,
  buildSpotifyPauseReply,
  buildSpotifyPlayReply,
  buildSpotifyQueryPlayReply,
  buildSpotifyQueueReply,
  buildSpotifySearchUrl,
  buildSpotifySkipReply,
  buildSpotifyStatusReply,
  buildStandbyReply,
  buildStudySetupReply,
  buildTodayTasksReply,
  buildTopPriorities,
  buildTransformersSemanticEmbedding,
  buildTravelCalendarIntent,
  buildTravelCalendarReply,
  buildTravelChecklist,
  buildTravelChecklistReply,
  buildTravelExtractionReply,
  buildTravelSavedReply,
  buildTravelTimeline,
  buildTravelTimelineReply,
  buildUnreadEmailReply,
  buildUpcomingTasksReply,
  buildUpdateTaskReply,
  buildVoiceReplyModeDetail,
  buildVoiceReplyModeReply,
  buildWorkflowSignature,
  buildWorkspaceScheduledReply,
  builtInBrowserAliases,
  canonicalHostRoots,
  canonicalizeBrowserUrl,
  cleanConversationalCommand,
  cleanPdfText,
  cleanupClipboardText,
  cleanupOcrText,
  collectSchoolDeadlines,
  cosineSimilarity,
  createActiveBrowserContext,
  createActiveDesktopAppContext,
  createActiveDesktopFolderContext,
  createActiveDesktopWorkspaceContext,
  createActiveEmailContext,
  createActiveNoteContext,
  createActivePdfContext,
  createActiveScreenshotContext,
  createActiveTaskContext,
  createDefaultModelRouterConfig,
  createVoiceBuildRequest,
  decodeLearnedIntent,
  describeCommandIntent,
  describeIntentActionType,
  describeOcrTarget,
  describeOcrWatchAction,
  describeOcrWatchRule,
  desktopAppAliases,
  detectSchoolSubjects,
  encodeLearnedIntent,
  escapeRegExp,
  estimateTravelSegmentCount,
  evaluateWorkflowCondition,
  extractBirthdayCandidatesFromEmail,
  extractBirthdayCandidatesFromText,
  extractDueLabel,
  extractEmailSignals,
  extractExpenseDetails,
  extractMeetingAgendaCandidates,
  extractOcrPrices,
  extractOcrTaskTitles,
  extractPackageDetails,
  extractSchoolAssignments,
  extractSentenceMatches,
  extractTasksFromPdfText,
  extractTravelDetails,
  extractUniqueMatches,
  extractWakeCommand,
  filterOcrHistory,
  findConversationContextByLabel,
  findEmailByQuery,
  findLearnedIntentFamilySummary,
  findLearnedIntentSuggestion,
  findMeetingPrepEvent,
  findMeetingRelatedPeople,
  findPdfByQuery,
  findPersonByQuery,
  findPlannerTaskByQuery,
  findRelatedMeetingEmails,
  findRelatedMeetingNotes,
  findRelatedMeetingTasks,
  findRelevantConversationMemory,
  formatBirthdayLabel,
  formatBirthdaySummary,
  formatBrowserTargetLabel,
  formatCalendarEventTimeLabel,
  formatEmailDigestForNotion,
  formatEmailForNotion,
  formatEmailForReading,
  formatEmailSignals,
  formatExpenseExtraction,
  formatExpenseForNotion,
  formatGatewayFollowUp,
  formatGatewayPreview,
  formatGoogleCalendarDate,
  formatIntentConfidenceLabel,
  formatOcrResultDetail,
  formatPackageExtraction,
  formatPackageForNotion,
  formatPdfTextPreview,
  formatPersonAge,
  formatPersonFollowUp,
  formatPlannerTaskList,
  formatTravelExtraction,
  formatTravelForNotion,
  formatUpcomingBirthday,
  formatVoiceReplyModeLabel,
  generateWorkflowName,
  generateWorkflowTriggerPhrase,
  getActivePresentedCollectionIndex,
  getConversationContextKey,
  getCurrentEmail,
  getCurrentPdf,
  getDueIsoFromLabel,
  getEmailByIndex,
  getErrorDetail,
  getEventBucketLabel,
  getIntentConfidenceFromScore,
  getLoadedPdfFiles,
  getNextBirthdayCalendarWindow,
  getNextBirthdayDate,
  getNoteByIndex,
  getOcrHistorySince,
  getOcrMatchKey,
  getOcrSourceLabel,
  getPdfByIndex,
  getPlannerTaskByIndex,
  getPresentedCollectionSize,
  getPrimaryTravelSummary,
  getSemanticIntentFeedbackAdjustment,
  getUpcomingPeopleFollowUps,
  hasExpenseSignal,
  hasExplicitOpenLanguage,
  hasExplicitSearchLanguage,
  hasPackageSignal,
  hasTravelSignal,
  hashEmbeddingToken,
  isBuilderGatewayCommand,
  isCalendarGatewayCommand,
  isCancelTrainingModeCommand,
  isEmailNotionGatewayCommand,
  isExplainIntentRoutingCommand,
  isGatewayConfirmationNo,
  isGatewayConfirmationYes,
  isGmailGatewayCommand,
  isJarvisHomeAppId,
  isKnownBrowserTarget,
  isMemoryGatewayCommand,
  isNotionGatewayCommand,
  isOcrNotionGatewayCommand,
  isPdfFile,
  isReadScreenCommand,
  isSameTopicFollowUpCommand,
  isSearchFilesCommand,
  isShellBarPlacement,
  isSpotifyConversationContext,
  isSpotifyGatewayCommand,
  isStartTrainingModeCommand,
  isStudyAppsCommand,
  isTodayDeliveryLabel,
  isTomorrowDeliveryLabel,
  mapCollectionIntent,
  mapIntegrationHandoffToIntent,
  mapOllamaInterpretationToResult,
  mergeModelRouterConfig,
  namedFolderAliases,
  normalizeControlCommand,
  normalizeDesktopProjectName,
  normalizeDesktopTarget,
  normalizeExpenseCategoryLabel,
  normalizeJarvisHomeAppName,
  normalizeJarvisPanelName,
  normalizeLearnedPhrase,
  normalizeOcrRegion,
  normalizeUrlTarget,
  normalizeWakeTranscript,
  normalizeWorkflowStep,
  ocrWatchRuleMatches,
  parseBirthdayMonthDay,
  parseCalendarCommandIntent,
  parseClockTime,
  parseConversationalCommandIntent,
  parseCorrectionInstruction,
  parseDateFromEmailText,
  parseDateFromFlexibleText,
  parseDesktopControlIntent,
  parseDesktopProjectIntent,
  parseDurationMinutes,
  parseDurationMinutesFromText,
  parseExplicitCommandIntent,
  parseOptionalDateLabel,
  parseReminderCommandIntent,
  parseSemanticIntentTestCommand,
  parseTaskCommandIntent,
  parseTaskNoteRecord,
  parseTeachingInstruction,
  parseTrainingReviewCleanupCommand,
  parseWakeControlIntent,
  parseWatchIntervalMs,
  parseWorkspaceScheduleDate,
  rankSemanticIntentCandidates,
  renderWorkflowStep,
  requiresSemanticConfirmation,
  resolveActiveAppContextFollowUpIntent,
  resolveActiveBrowserContext,
  resolveActiveEmail,
  resolveActiveNote,
  resolveActivePdf,
  resolveActiveTask,
  resolveBatchReferenceFollowUpIntent,
  resolveBrowserAliasTarget,
  resolveClarificationReply,
  resolveCollectionGlobalIndices,
  resolveCollectionPositions,
  resolveContextualFollowUpIntent,
  resolveDayReference,
  resolveLearnedIntent,
  resolveNaturalConversationFollowUp,
  resolveOrdinalFollowUpIntent,
  resolveOrdinalIndex,
  resolveReferenceFollowUpIntent,
  resolveReferenceQuery,
  resolveSameTopicFollowUpIntent,
  resolveSavedWorkflowInvocation,
  resolveSpotifyContextFollowUpIntent,
  resolveTeachableIntent,
  resolveWorkflowConditionalStep,
  scoreEmailUrgency,
  scoreLearnedPhraseSimilarity,
  scoreMeetingPrepEvent,
  shouldDelegateToGateway,
  shouldUseOllamaFirstInAutoMode,
  splitWorkflowCommand,
  startOfDay,
  stripSemanticActionQuery,
  summarizeOcrText,
  summarizePdfText,
  toTitleCase,
  tokenizeLearnedPhrase,
  tokenizePrepQuery,
  wakeTranscriptMatchesAssistant,
  workflowLeadPattern,
  workflowTemplates,
  type ActiveConversationContext,
  type AssistantDefaults,
  type BirthdayCandidate,
  type ClarificationChoice,
  type CommandIntent,
  type ConversationBackendComparison,
  type ConversationContextStackEntry,
  type ConversationTopicRecord,
  type ConversationTurn,
  type CorrectionInstruction,
  type CrossFeatureSuggestionRecord,
  type DesktopPermissionSettings,
  type DesktopProjectRecord,
  type DesktopScheduleRecord,
  type EmailSignals,
  type EmbeddingBackend,
  type ExpenseExtraction,
  type ExpenseMemoryRecord,
  type FollowUpWindow,
  type GeneratedModelDraft,
  type IntentConfidence,
  type JarvisHomeAppId,
  type JarvisPanelId,
  type JarvisPanelRecord,
  type JarvisUiPreferences,
  type MeetingPrepMemoryRecord,
  type ModelBenchmarkResult,
  type ModelComparisonResult,
  type ModelComparisonRun,
  type ModelInterpretationResult,
  type ModelProviderConfig,
  type ModelProviderId,
  type ModelProviderUsageRecord,
  type ModelRouteDecision,
  type ModelRouterConfig,
  type ModelRouterTestResult,
  type ModelTaskType,
  type NaturalConversationResolution,
  type OcrCorrectionRecord,
  type OcrHistoryFilter,
  type OcrHistoryRecord,
  type OcrRect,
  type OcrRegion,
  type OcrScope,
  type OcrSelectionState,
  type OcrWatchAction,
  type OcrWatchRule,
  type OcrWatchTarget,
  type OcrWatchTemplate,
  type PackageExtraction,
  type PackageMemoryRecord,
  type PanelDragState,
  type PdfTaskCandidate,
  type PendingClarification,
  type PendingWorkflowExecution,
  type PersonBirthdaySaveInput,
  type PersonMemoryRecord,
  type PlannerTaskRecord,
  type PresentedCollectionContext,
  type RunCommandOutcome,
  type SavedWorkflowRecord,
  type SchoolPlanMemoryRecord,
  type SemanticConversationMemoryRecord,
  type SemanticIntentCandidate,
  type SemanticIntentDebugMatch,
  type SemanticIntentFeedbackRecord,
  type SemanticIntentRank,
  type ShellBarDragState,
  type ShellBarPlacement,
  type TeachingInstruction,
  type TrainingModeSession,
  type TransformersEmbeddingExtractor,
  type TravelExtraction,
  type TravelMemoryRecord,
  type UserPreferenceMemory,
  type VoiceReplyMode,
  type WorkflowStepResolution,
  type WorkflowSuggestionRecord,
  type WorkflowTemplateRecord,
} from "../../features/legacy/appHelpers";
export * from "../../features/legacy/appHelpers";

export default function JarvisAppRootLogic() {
  const [input, setInput] = useState("");
  const [statusMessage, setStatusMessage] = useState(
    "Core online. Desktop skills are ready to be wired.",
  );
  const [commandResult, setCommandResult] = useState<CommandResult | null>(null);
  const [isRoutingCommand, setIsRoutingCommand] = useState(false);
  const [pendingGatewayConfirmation, setPendingGatewayConfirmation] =
    useState<PendingGatewayConfirmation | null>(null);
  const [pendingGatewayTeaching, setPendingGatewayTeaching] =
    useState<PendingGatewayTeaching | null>(null);
  const gatewaySessionRef = useRef("jarvis-main-session");
  const [storedRoutines, setStoredRoutines] = useState<RoutineRecord[]>([]);
  const [recentHistory, setRecentHistory] = useState<HistoryRecord[]>([]);
  const [proposals, setProposals] = useState<ProposalRecord[]>([]);
  const [isGeneratingProposal, setIsGeneratingProposal] = useState(false);
  const [proposalSteps, setProposalSteps] = useState<Record<number, ProposalStepRecord[]>>({});
  const [editingProposalId, setEditingProposalId] = useState<number | null>(null);
  const localRecorderRef = useRef<{ stop: () => Promise<string> } | null>(null);
  const [assistantName, setAssistantName] = useState("Jarvis");
  const [wakeModeEnabled, setWakeModeEnabled] = useState(false);
  const [wakeModeStatus, setWakeModeStatus] = useState<WakeModeStatus | null>(null);
  const [wakeCueActive, setWakeCueActive] = useState(false);
  const [browserAliases, setBrowserAliases] = useState<BrowserAliasRecord[]>([]);
  const [learnedIntentMappings, setLearnedIntentMappings] = useState<LearnedIntentRecord[]>([]);
  const [userPreferenceMemory, setUserPreferenceMemory] = useState<UserPreferenceMemory>({
    noteApp: "notion",
    musicProvider: null,
    defaultWorkspaceName: null,
  });
  const [browserAliasUrl, setBrowserAliasUrl] = useState("");
  const [googleCalendarStatus, setGoogleCalendarStatus] =
    useState<GoogleCalendarStatus | null>(null);
  const [googleCalendarClientId, setGoogleCalendarClientId] = useState("");
  const [googleCalendarApiKey, setGoogleCalendarApiKey] = useState("");
  const [googleCalendarAccessToken, setGoogleCalendarAccessToken] = useState<string | null>(null);
  const [gmailAccessToken, setGmailAccessToken] = useState<string | null>(null);
  const [recentEmails, setRecentEmails] = useState<EmailRecord[]>([]);
  const [plannerTasks, setPlannerTasks] = useState<PlannerTaskRecord[]>([]);
  const [peopleMemory, setPeopleMemory] = useState<PersonMemoryRecord[]>([]);
  const [rustPeopleMemory, setRustPeopleMemory] = useState<PersonMemoryRecord[] | null>(null);
  const [rustTravelMemory, setRustTravelMemory] = useState<TravelMemoryRecord[] | null>(null);
  const [rustExpenseMemory, setRustExpenseMemory] = useState<ExpenseMemoryRecord[] | null>(null);
  const [rustPackageMemory, setRustPackageMemory] = useState<PackageMemoryRecord[] | null>(null);
  const [rustMeetingPrepMemory, setRustMeetingPrepMemory] = useState<MeetingPrepMemoryRecord[] | null>(null);
  const [rustSchoolPlanMemory, setRustSchoolPlanMemory] = useState<SchoolPlanMemoryRecord[] | null>(null);
  const [travelMemory, setTravelMemory] = useState<TravelMemoryRecord[]>([]);
  const [expenseMemory, setExpenseMemory] = useState<ExpenseMemoryRecord[]>([]);
  const [packageMemory, setPackageMemory] = useState<PackageMemoryRecord[]>([]);
  const [meetingPrepMemory, setMeetingPrepMemory] = useState<MeetingPrepMemoryRecord[]>([]);
  const [schoolPlanMemory, setSchoolPlanMemory] = useState<SchoolPlanMemoryRecord[]>([]);
  const [spotifyStatus, setSpotifyStatus] = useState<SpotifyStatus | null>(null);
  const [spotifyClientId, setSpotifyClientId] = useState("");
  const [spotifyAccessToken, setSpotifyAccessToken] = useState<string | null>(null);
  const [spotifyPlaybackState, setSpotifyPlaybackState] = useState<SpotifyPlaybackState | null>(null);
  const [recentFiles, setRecentFiles] = useState<FileRecord[]>([]);
  const [desktopProjects, setDesktopProjects] = useState<DesktopProjectRecord[]>([]);
  const [desktopSchedules, setDesktopSchedules] = useState<DesktopScheduleRecord[]>([]);
  const [desktopPermissionSettings, setDesktopPermissionSettings] = useState<DesktopPermissionSettings>(
    DEFAULT_DESKTOP_PERMISSION_SETTINGS,
  );
  const [lastScreenshotPath, setLastScreenshotPath] = useState<string | null>(null);
  const [ocrWatchTargets, setOcrWatchTargets] = useState<OcrWatchTarget[]>([]);
  const [ocrHistory, setOcrHistory] = useState<OcrHistoryRecord[]>([]);
  const [ocrWatchMatches, setOcrWatchMatches] = useState<OcrHistoryRecord[]>([]);
  const [lastOcrText, setLastOcrText] = useState("");
  const [ocrCorrections, setOcrCorrections] = useState<OcrCorrectionRecord[]>([]);
  const [ocrWatchTemplates, setOcrWatchTemplates] = useState<OcrWatchTemplate[]>([]);
  const [isOcrSelecting, setIsOcrSelecting] = useState(false);
  const [ocrSelection, setOcrSelection] = useState<OcrSelectionState>(null);
  const [jarvisPanels, setJarvisPanels] = useState<JarvisPanelRecord[]>([]);
  const [panelDragState, setPanelDragState] = useState<PanelDragState>(null);
  const [shellBarInput, setShellBarInput] = useState("");
  const [shellBarDragState, setShellBarDragState] = useState<ShellBarDragState>(null);
  const [uiState, dispatchUi] = useReducer(jarvisUiReducer, undefined, loadJarvisUiState);
  const [activeConversationContext, setActiveConversationContext] =
    useState<ActiveConversationContext | null>(null);
  const [conversationContextStack, setConversationContextStack] = useState<
    ConversationContextStackEntry[]
  >([]);
  const [presentedCollectionContext, setPresentedCollectionContext] =
    useState<PresentedCollectionContext | null>(null);
  const [semanticConversationMemory, setSemanticConversationMemory] = useState<
    SemanticConversationMemoryRecord[]
  >([]);
  const [semanticIntentFeedback, setSemanticIntentFeedback] = useState<
    SemanticIntentFeedbackRecord[]
  >([]);
  const [lastConversationTopic, setLastConversationTopic] =
    useState<ConversationTopicRecord | null>(null);
  const [trainingModeSession, setTrainingModeSession] =
    useState<TrainingModeSession | null>(null);
  const [workflowRenameDrafts, setWorkflowRenameDrafts] = useState<
    Record<string, string>
  >({});
  const [notionStatus, setNotionStatus] = useState<NotionStatus | null>(null);
  const [notionTokenInput, setNotionTokenInput] = useState("");
  const [notionDatabaseId, setNotionDatabaseId] = useState("");
  const [recentNotes, setRecentNotes] = useState<NoteRecord[]>([]);
  const [conversationBackend, setConversationBackend] =
    useState<ConversationBackend>("auto");
  const [backendComparePrompt, setBackendComparePrompt] = useState("");
  const [backendComparison, setBackendComparison] = useState<ConversationBackendComparison | null>(null);
  const [isComparingBackends, setIsComparingBackends] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://127.0.0.1:11434");
  const [ollamaModelName, setOllamaModelName] = useState("");
  const [embeddingBackend, setEmbeddingBackend] = useState<EmbeddingBackend>("transformers");
  const [embeddingModelName, setEmbeddingModelName] = useState("Xenova/all-MiniLM-L6-v2");
  const [embeddingStatusMessage, setEmbeddingStatusMessage] = useState("Transformers.js semantic foundation ready.");
  const [modelRouterConfig, setModelRouterConfig] = useState<ModelRouterConfig>(() =>
    createDefaultModelRouterConfig(),
  );
  const [modelRouterStatusMessage, setModelRouterStatusMessage] = useState("Zero-cost model router ready. Local stays default.");
  const [modelRouterTestResult, setModelRouterTestResult] = useState<ModelRouterTestResult | null>(null);
  const [latestGeneratedDraft, setLatestGeneratedDraft] = useState<GeneratedModelDraft | null>(null);
  const [modelProviderUsage, setModelProviderUsage] = useState<ModelProviderUsageRecord[]>([]);
  const [modelBenchmarkResults, setModelBenchmarkResults] = useState<ModelBenchmarkResult[]>([]);
  const [modelComparisonPrompt, setModelComparisonPrompt] = useState("");
  const [modelComparisonRun, setModelComparisonRun] = useState<ModelComparisonRun | null>(null);
  const [streamingModelText, setStreamingModelText] = useState("");
  const [modelProviderKeyStatus, setModelProviderKeyStatus] = useState<Record<string, boolean>>({});
  const [modelProviderKeyPreview, setModelProviderKeyPreview] = useState<Record<string, string>>({});
  const [isTestingModelRouter, setIsTestingModelRouter] = useState(false);
  const [isBenchmarkingModels, setIsBenchmarkingModels] = useState(false);
  const [isComparingModels, setIsComparingModels] = useState(false);
  const [isGeneratingModelDraft, setIsGeneratingModelDraft] = useState(false);
  const [missingSkillRequest, setMissingSkillRequest] = useState<string | null>(null);
  const [missingSkillPlan, setMissingSkillPlan] = useState<MissingSkillPlan | null>(null);
  const [isGeneratingMissingSkillPlan, setIsGeneratingMissingSkillPlan] = useState(false);
  const [implementationRequest, setImplementationRequest] =
    useState<SkillImplementationRequest | null>(null);
  const [buildRequest, setBuildRequest] = useState<SkillBuildRequest | null>(null);
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflowRecord[]>([]);
  const [workflowSuggestion, setWorkflowSuggestion] = useState<WorkflowSuggestionRecord | null>(null);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [pendingWorkflowExecution, setPendingWorkflowExecution] =
    useState<PendingWorkflowExecution | null>(null);
  const [workflowImportText, setWorkflowImportText] = useState("");
  const [crossFeatureSuggestions, setCrossFeatureSuggestions] = useState<CrossFeatureSuggestionRecord[]>([]);
  const [proactiveCrossSuggestion, setProactiveCrossSuggestion] = useState<CrossFeatureSuggestionRecord | null>(null);
  const [autonomousSkillBuildingEnabled, setAutonomousSkillBuildingEnabled] = useState(false);
  const [autonomousBuildStatus, setAutonomousBuildStatus] =
    useState<AutonomousBuildStatus>("idle");
  const [handoffArtifact, setHandoffArtifact] = useState<BuildHandoffArtifact | null>(null);
  const [executorStatus, setExecutorStatus] = useState<ExecutorStatus | null>(null);
  const [executorCommandPath, setExecutorCommandPath] = useState("");
  const [executorWorkingDirectory, setExecutorWorkingDirectory] = useState("");
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([
    {
      id: 1,
      role: "jarvis",
      text: "Conversation mode is starting up. Talk naturally and I'll try to understand, ask follow-ups, and act through the existing skills.",
    },
  ]);
  const [teachingTargetPhrase, setTeachingTargetPhrase] = useState<string | null>(null);
  const [wakeListenerActive, setWakeListenerActive] = useState(false);
  const followUpTimeoutRef = useRef<number | null>(null);
  const wakeTriggeredRef = useRef(false);
  const currentRouteLabelRef = useRef<string | undefined>(undefined);
  const transformersEmbeddingRef = useRef<{
    model: string;
    extractor: TransformersEmbeddingExtractor;
  } | null>(null);
  const semanticIntentEmbeddingCacheRef = useRef<
    Map<string, { embedding: number[]; backend: EmbeddingBackend }>
  >(new Map());

  function openJarvisPanel(panel: JarvisPanelId) {
    dispatchUi({ type: "openFloatingPanel", panelId: panel });
    setJarvisPanels((current) => {
      const existing = current.find((item) => item.id === panel);
      if (existing) {
        return [
          ...current.filter((item) => item.id !== panel),
          { ...existing, minimized: false },
        ];
      }
      const index = jarvisModules.findIndex((module) => module.id === panel);
      const offset = Math.max(index, 0) * 26;
      return [
        ...current,
        {
          id: panel,
          x: 28 + offset,
          y: 88 + offset,
          minimized: false,
        },
      ];
    });
  }

  function closeJarvisPanel(panel?: JarvisPanelId) {
    if (panel) {
      dispatchUi({ type: "closeFloatingPanel", panelId: panel });
    }
    setJarvisPanels((current) =>
      panel ? current.filter((item) => item.id !== panel) : [],
    );
  }

  function minimizeJarvisPanel(panel?: JarvisPanelId) {
    setJarvisPanels((current) =>
      current.map((item) =>
        !panel || item.id === panel ? { ...item, minimized: true } : item,
      ),
    );
  }

  function toggleJarvisPanel(panel: JarvisPanelId) {
    setJarvisPanels((current) =>
      current.map((item) =>
        item.id === panel ? { ...item, minimized: !item.minimized } : item,
      ),
    );
  }

  function moveJarvisPanel(clientX: number, clientY: number) {
    if (!panelDragState) {
      return;
    }
    const nextX = Math.max(8, Math.min(clientX - panelDragState.offsetX, window.innerWidth - 340));
    const nextY = Math.max(8, Math.min(clientY - panelDragState.offsetY, window.innerHeight - 160));
    setJarvisPanels((current) =>
      current.map((panel) =>
        panel.id === panelDragState.id ? { ...panel, x: nextX, y: nextY } : panel,
      ),
    );
  }

  function moveShellBar(clientX: number, clientY: number) {
    if (!shellBarDragState) {
      return;
    }
    const nextX = Math.max(8, Math.min(clientX - shellBarDragState.offsetX, window.innerWidth - 320));
    const nextY = Math.max(8, Math.min(clientY - shellBarDragState.offsetY, window.innerHeight - 86));
    dispatchUi({ type: "setQuickBarPlacement", placement: "free" });
    dispatchUi({ type: "setQuickBarPosition", position: { x: nextX, y: nextY } });
  }

  function pinShellBar(placement: Exclude<ShellBarPlacement, "free">) {
    dispatchUi({ type: "setQuickBarPlacement", placement });
    setShellBarDragState(null);
  }

  function resetJarvisUiPreferences() {
    dispatchUi({ type: "setQuickBarVisibility", visible: defaultJarvisUiState.quickBar.visible });
    dispatchUi({ type: "setQuickBarPlacement", placement: defaultJarvisUiState.quickBar.placement });
    dispatchUi({ type: "setQuickBarPosition", position: defaultJarvisUiState.quickBar.position });
    dispatchUi({ type: "closeCockpit" });
    dispatchUi({ type: "setWorkspace", workspaceId: defaultJarvisUiState.activeWorkspaceId });
    dispatchUi({ type: "setSurface", surface: defaultJarvisUiState.activeSurface });
    dispatchUi({ type: "setSelectedDataSphereNode", workspaceId: null });
    dispatchUi({ type: "setSystemDrawerOpen", open: false });
    setStatusMessage("JARVIS UI layout reset.");
  }

  const upcomingModules = useMemo(
    () => jarvisSkills.filter((skill) => skill.status === "planned").length,
    [],
  );

  const {
    gatewayConfig,
    setGatewayConfig,
    gatewayPreview,
    setGatewayPreview,
    gatewayPreviewError,
    setGatewayPreviewError,
    isPreviewingGateway,
    lastKnowledgeRecall,
    refreshGatewayPreview,
    gatewayHistory,
    setGatewayHistory,
    pushGatewayHistory,
    refreshGatewayPreviewWithHistory,
  } = useJarvisGatewayShell({ input });

  const {
    pendingClarification,
    setPendingClarification,
    lastSemanticIntentMatches,
    setLastSemanticIntentMatches,
    learnedIntentRenameDrafts,
    setLearnedIntentRenameDrafts,
  } = useJarvisSemanticRouting();

  const {
    voiceState,
    setVoiceState,
    voiceTranscript,
    setVoiceTranscript,
    voiceResponseEnabled,
    setVoiceResponseEnabled,
    voiceReplyMode,
    setVoiceReplyMode,
    voiceCorrections,
    setVoiceCorrections,
    voiceCorrectionInput,
    setVoiceCorrectionInput,
    voiceSessionPhase,
    setVoiceSessionPhase,
    voiceAutoRouteEnabled,
    setVoiceAutoRouteEnabled,
    voiceBackend,
    setVoiceBackend,
    localVoiceStatus,
    setLocalVoiceStatus,
    speechOutputBackend,
    setSpeechOutputBackend,
    localSpeechStatus,
    setLocalSpeechStatus,
    localExecutablePath,
    setLocalExecutablePath,
    localModelPath,
    setLocalModelPath,
    localTtsExecutablePath,
    setLocalTtsExecutablePath,
    localTtsModelPath,
    setLocalTtsModelPath,
    followUpWindow,
    setFollowUpWindow,
    commandRecognitionRef,
    wakeRecognitionRef,
    wakeRestartTimeoutRef,
    lastAutoRoutedVoiceRef,
  } = useJarvisVoiceSession();

  const shouldAutoRouteVoice =
    voiceAutoRouteEnabled || conversationBackend === "ollama" || conversationBackend === "auto";

  useEffect(() => {
    try {
      persistJarvisUiState(uiState);
    } catch {
      setStatusMessage("JARVIS could not persist UI preferences locally.");
    }
  }, [uiState]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SAVED_WORKFLOWS_STORAGE_KEY);
      if (saved) {
        setSavedWorkflows(JSON.parse(saved) as SavedWorkflowRecord[]);
      }
    } catch {
      setSavedWorkflows([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SAVED_WORKFLOWS_STORAGE_KEY,
        JSON.stringify(savedWorkflows),
      );
    } catch {
      setStatusMessage("JARVIS could not persist saved workflows locally.");
    }
  }, [savedWorkflows]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VOICE_REPLY_MODE_STORAGE_KEY);
      if (
        saved === "quiet" ||
        saved === "brief" ||
        saved === "normal" ||
        saved === "detailed"
      ) {
        setVoiceReplyMode(saved);
      }
    } catch {
      setVoiceReplyMode("normal");
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(VOICE_REPLY_MODE_STORAGE_KEY, voiceReplyMode);
    } catch {
      setStatusMessage("JARVIS could not persist the voice reply mode locally.");
    }
  }, [voiceReplyMode]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CONVERSATION_BACKEND_STORAGE_KEY);
      if (saved === "heuristics" || saved === "ollama" || saved === "auto") {
        setConversationBackend(saved);
      } else {
        setConversationBackend("auto");
      }
    } catch {
      setConversationBackend("auto");
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(CONVERSATION_BACKEND_STORAGE_KEY, conversationBackend);
    } catch {
      setStatusMessage("JARVIS could not persist the conversation brain locally.");
    }
  }, [conversationBackend]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ASSISTANT_DEFAULTS_STORAGE_KEY);
      if (!saved) {
        return;
      }
      const defaults = JSON.parse(saved) as Partial<AssistantDefaults>;
      if (
        defaults.voiceBackend === "browser" ||
        defaults.voiceBackend === "local" ||
        defaults.voiceBackend === "groq"
      ) {
        setVoiceBackend(defaults.voiceBackend);
      }
      if (defaults.speechOutputBackend === "browser" || defaults.speechOutputBackend === "local") {
        setSpeechOutputBackend(defaults.speechOutputBackend);
      }
      if (typeof defaults.voiceAutoRouteEnabled === "boolean") {
        setVoiceAutoRouteEnabled(defaults.voiceAutoRouteEnabled);
      }
      if (
        defaults.conversationBackend === "heuristics" ||
        defaults.conversationBackend === "ollama" ||
        defaults.conversationBackend === "auto"
      ) {
        setConversationBackend(defaults.conversationBackend);
      }
      if (
        defaults.voiceReplyMode === "quiet" ||
        defaults.voiceReplyMode === "brief" ||
        defaults.voiceReplyMode === "normal" ||
        defaults.voiceReplyMode === "detailed"
      ) {
        setVoiceReplyMode(defaults.voiceReplyMode);
      }
      if (typeof defaults.voiceResponseEnabled === "boolean") {
        setVoiceResponseEnabled(defaults.voiceResponseEnabled);
      }
    } catch {
      setStatusMessage("JARVIS could not load saved assistant defaults.");
    }
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(USER_PREFERENCE_MEMORY_STORAGE_KEY);
      if (!saved) {
        return;
      }

      const parsed = JSON.parse(saved) as Partial<UserPreferenceMemory>;
      setUserPreferenceMemory({
        noteApp: "notion",
        musicProvider: parsed.musicProvider === "spotify" ? "spotify" : null,
        defaultWorkspaceName:
          typeof parsed.defaultWorkspaceName === "string" && parsed.defaultWorkspaceName.trim()
            ? parsed.defaultWorkspaceName.trim()
            : null,
      });
    } catch {
      setStatusMessage("JARVIS could not load your preference memory.");
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        USER_PREFERENCE_MEMORY_STORAGE_KEY,
        JSON.stringify(userPreferenceMemory),
      );
    } catch {
      setStatusMessage("JARVIS could not persist your preference memory locally.");
    }
  }, [userPreferenceMemory]);

  useEffect(() => {
    if (!activeConversationContext) {
      return;
    }

    setConversationContextStack((current) => {
      const key = getConversationContextKey(activeConversationContext);
      const entry: ConversationContextStackEntry = {
        ...activeConversationContext,
        lastUsedAt: new Date().toISOString(),
      };
      return [
            ...current.filter((item) => getConversationContextKey(item) !== key),
      ].slice(0, 8);
    });
  }, [activeConversationContext]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SEMANTIC_CONVERSATION_MEMORY_STORAGE_KEY);
      if (saved) {
        setSemanticConversationMemory(JSON.parse(saved) as SemanticConversationMemoryRecord[]);
      }
    } catch {
      setSemanticConversationMemory([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SEMANTIC_CONVERSATION_MEMORY_STORAGE_KEY,
        JSON.stringify(semanticConversationMemory.slice(0, 80)),
      );
    } catch {
      setStatusMessage("JARVIS could not persist semantic conversation memory locally.");
    }
  }, [semanticConversationMemory]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SEMANTIC_INTENT_FEEDBACK_STORAGE_KEY);
      if (saved) {
        setSemanticIntentFeedback(JSON.parse(saved) as SemanticIntentFeedbackRecord[]);
      }
    } catch {
      setSemanticIntentFeedback([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SEMANTIC_INTENT_FEEDBACK_STORAGE_KEY,
        JSON.stringify(semanticIntentFeedback.slice(0, 120)),
      );
    } catch {
      setStatusMessage("JARVIS could not persist semantic intent feedback locally.");
    }
  }, [semanticIntentFeedback]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(EMBEDDING_CONFIG_STORAGE_KEY);
      if (!saved) {
        return;
      }

      const parsed = JSON.parse(saved) as {
        backend?: EmbeddingBackend;
        modelName?: string;
      };
      if (
        parsed.backend === "local" ||
        parsed.backend === "ollama" ||
        parsed.backend === "transformers"
      ) {
        setEmbeddingBackend(parsed.backend);
      }
      if (typeof parsed.modelName === "string" && parsed.modelName.trim()) {
        setEmbeddingModelName(parsed.modelName.trim());
      }
    } catch {
      setStatusMessage("JARVIS could not load embedding settings.");
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        EMBEDDING_CONFIG_STORAGE_KEY,
        JSON.stringify({
          backend: embeddingBackend,
          modelName: embeddingModelName,
        }),
      );
    } catch {
      setStatusMessage("JARVIS could not persist embedding settings.");
    }
  }, [embeddingBackend, embeddingModelName]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MODEL_ROUTER_CONFIG_STORAGE_KEY);
      if (saved) {
        setModelRouterConfig(mergeModelRouterConfig(JSON.parse(saved) as Partial<ModelRouterConfig>));
      }
    } catch {
      setModelRouterConfig(createDefaultModelRouterConfig());
      setStatusMessage("JARVIS could not load model router settings.");
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        MODEL_ROUTER_CONFIG_STORAGE_KEY,
        JSON.stringify({
          ...modelRouterConfig,
          providers: Object.fromEntries(
            (Object.keys(modelRouterConfig.providers) as ModelProviderId[]).map((providerId) => [
                        { ...modelRouterConfig.providers[providerId], apiKey: "" },
            ]),
          ),
        }),
      );
    } catch {
      setStatusMessage("JARVIS could not persist model router settings.");
    }
  }, [modelRouterConfig]);

  useEffect(() => {
    void refreshProviderKeyStatuses();
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MODEL_ROUTER_USAGE_STORAGE_KEY);
      if (saved) {
        setModelProviderUsage(JSON.parse(saved) as ModelProviderUsageRecord[]);
      }
    } catch {
      setModelProviderUsage([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        MODEL_ROUTER_USAGE_STORAGE_KEY,
        JSON.stringify(modelProviderUsage.slice(0, 80)),
      );
    } catch {
      setStatusMessage("JARVIS could not persist model provider usage.");
    }
  }, [modelProviderUsage]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PEOPLE_MEMORY_STORAGE_KEY);
      if (saved) {
        setPeopleMemory(JSON.parse(saved) as PersonMemoryRecord[]);
      }
    } catch {
      setPeopleMemory([]);
    }
  }, []);

  useEffect(() => {
    if (!gatewayConfig?.features.memory) {
      setRustPeopleMemory(null);
      setRustTravelMemory(null);
      setRustExpenseMemory(null);
      setRustPackageMemory(null);
      setRustMeetingPrepMemory(null);
      setRustSchoolPlanMemory(null);
      return;
    }

    void (async () => {
      try {
        let people = await memoryListPeople();
        if (people.length === 0) {
          const saved = window.localStorage.getItem(PEOPLE_MEMORY_STORAGE_KEY);
          if (saved) {
            const localPeople = JSON.parse(saved) as PersonMemoryRecord[];
            if (localPeople.length > 0) {
              await importPeopleMemory(localPeople);
              people = await memoryListPeople();
            }
          }
        }
        setRustPeopleMemory(people);

        let travel = await memoryListTravel();
        if (travel.length === 0) {
          const saved = window.localStorage.getItem(TRAVEL_MEMORY_STORAGE_KEY);
          if (saved) {
            const localTravel = JSON.parse(saved) as TravelMemoryRecord[];
            if (localTravel.length > 0) {
              await importTravelMemory(localTravel);
              travel = await memoryListTravel();
            }
          }
        }
        setRustTravelMemory(travel);

        let expenses = await memoryListExpenses();
        if (expenses.length === 0) {
          const saved = window.localStorage.getItem(EXPENSE_MEMORY_STORAGE_KEY);
          if (saved) {
            const localExpenses = JSON.parse(saved) as ExpenseMemoryRecord[];
            if (localExpenses.length > 0) {
              await importExpenseMemory(localExpenses);
              expenses = await memoryListExpenses();
            }
          }
        }
        setRustExpenseMemory(expenses);

        let packages = await memoryListPackages();
        if (packages.length === 0) {
          const saved = window.localStorage.getItem(PACKAGE_MEMORY_STORAGE_KEY);
          if (saved) {
            const localPackages = JSON.parse(saved) as PackageMemoryRecord[];
            if (localPackages.length > 0) {
              await importPackageMemory(localPackages);
              packages = await memoryListPackages();
            }
          }
        }
        setRustPackageMemory(packages);

        let meetingPrep = await memoryListMeetingPrep();
        if (meetingPrep.length === 0) {
          const saved = window.localStorage.getItem(MEETING_PREP_MEMORY_STORAGE_KEY);
          if (saved) {
            const localMeetingPrep = JSON.parse(saved) as MeetingPrepMemoryRecord[];
            if (localMeetingPrep.length > 0) {
              await importMeetingPrepMemory(localMeetingPrep);
              meetingPrep = await memoryListMeetingPrep();
            }
          }
        }
        setRustMeetingPrepMemory(meetingPrep);

        let schoolPlans = await memoryListSchoolPlans();
        if (schoolPlans.length === 0) {
          const saved = window.localStorage.getItem(SCHOOL_PLAN_MEMORY_STORAGE_KEY);
          if (saved) {
            const localSchoolPlans = JSON.parse(saved) as SchoolPlanMemoryRecord[];
            if (localSchoolPlans.length > 0) {
              await importSchoolPlanMemory(localSchoolPlans);
              schoolPlans = await memoryListSchoolPlans();
            }
          }
        }
        setRustSchoolPlanMemory(schoolPlans);
      } catch {
        setRustPeopleMemory(null);
        setRustTravelMemory(null);
        setRustExpenseMemory(null);
        setRustPackageMemory(null);
        setRustMeetingPrepMemory(null);
        setRustSchoolPlanMemory(null);
      }
    })();
  }, [gatewayConfig?.features.memory]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PEOPLE_MEMORY_STORAGE_KEY, JSON.stringify(peopleMemory));
    } catch {
      setStatusMessage("JARVIS could not persist people memory locally.");
    }
  }, [peopleMemory]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(TRAVEL_MEMORY_STORAGE_KEY);
      if (saved) {
        setTravelMemory(JSON.parse(saved) as TravelMemoryRecord[]);
      }
    } catch {
      setTravelMemory([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(TRAVEL_MEMORY_STORAGE_KEY, JSON.stringify(travelMemory));
    } catch {
      setStatusMessage("JARVIS could not persist travel memory locally.");
    }
  }, [travelMemory]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(EXPENSE_MEMORY_STORAGE_KEY);
      if (saved) {
        setExpenseMemory(JSON.parse(saved) as ExpenseMemoryRecord[]);
      }
    } catch {
      setExpenseMemory([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(EXPENSE_MEMORY_STORAGE_KEY, JSON.stringify(expenseMemory));
    } catch {
      setStatusMessage("JARVIS could not persist expense memory locally.");
    }
  }, [expenseMemory]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PACKAGE_MEMORY_STORAGE_KEY);
      if (saved) {
        setPackageMemory(JSON.parse(saved) as PackageMemoryRecord[]);
      }
    } catch {
      setPackageMemory([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(PACKAGE_MEMORY_STORAGE_KEY, JSON.stringify(packageMemory));
    } catch {
      setStatusMessage("JARVIS could not persist package memory locally.");
    }
  }, [packageMemory]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MEETING_PREP_MEMORY_STORAGE_KEY);
      if (saved) {
        setMeetingPrepMemory(JSON.parse(saved) as MeetingPrepMemoryRecord[]);
      }
    } catch {
      setMeetingPrepMemory([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        MEETING_PREP_MEMORY_STORAGE_KEY,
        JSON.stringify(meetingPrepMemory),
      );
    } catch {
      setStatusMessage("JARVIS could not persist meeting prep memory locally.");
    }
  }, [meetingPrepMemory]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SCHOOL_PLAN_MEMORY_STORAGE_KEY);
      if (saved) {
        setSchoolPlanMemory(JSON.parse(saved) as SchoolPlanMemoryRecord[]);
      }
    } catch {
      setSchoolPlanMemory([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SCHOOL_PLAN_MEMORY_STORAGE_KEY,
        JSON.stringify(schoolPlanMemory),
      );
    } catch {
      setStatusMessage("JARVIS could not persist school plan memory locally.");
    }
  }, [schoolPlanMemory]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DESKTOP_PROJECTS_STORAGE_KEY);
      if (saved) {
        setDesktopProjects(JSON.parse(saved) as DesktopProjectRecord[]);
      }
    } catch {
      setDesktopProjects([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DESKTOP_PROJECTS_STORAGE_KEY,
        JSON.stringify(desktopProjects),
      );
    } catch {
      setStatusMessage("JARVIS could not persist desktop projects locally.");
    }
  }, [desktopProjects]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DESKTOP_SCHEDULES_STORAGE_KEY);
      if (saved) {
        setDesktopSchedules(JSON.parse(saved) as DesktopScheduleRecord[]);
      }
    } catch {
      setDesktopSchedules([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DESKTOP_SCHEDULES_STORAGE_KEY,
        JSON.stringify(desktopSchedules),
      );
    } catch {
      setStatusMessage("JARVIS could not persist desktop schedules locally.");
    }
  }, [desktopSchedules]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DESKTOP_PERMISSION_SETTINGS_STORAGE_KEY);
      if (saved) {
        setDesktopPermissionSettings({
          ...DEFAULT_DESKTOP_PERMISSION_SETTINGS,
          ...(JSON.parse(saved) as Partial<DesktopPermissionSettings>),
        });
      }
    } catch {
      setDesktopPermissionSettings(DEFAULT_DESKTOP_PERMISSION_SETTINGS);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DESKTOP_PERMISSION_SETTINGS_STORAGE_KEY,
        JSON.stringify(desktopPermissionSettings),
      );
    } catch {
      setStatusMessage("JARVIS could not persist desktop permission settings locally.");
    }
  }, [desktopPermissionSettings]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(OCR_HISTORY_STORAGE_KEY);
      if (saved) {
        setOcrHistory(JSON.parse(saved) as OcrHistoryRecord[]);
      }
    } catch {
      setOcrHistory([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(OCR_HISTORY_STORAGE_KEY, JSON.stringify(ocrHistory.slice(0, 20)));
    } catch {
      setStatusMessage("JARVIS could not persist OCR history locally.");
    }
  }, [ocrHistory]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(OCR_WATCHES_STORAGE_KEY);
      if (saved) {
        setOcrWatchTargets(JSON.parse(saved) as OcrWatchTarget[]);
      }
    } catch {
      setOcrWatchTargets([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(OCR_WATCHES_STORAGE_KEY, JSON.stringify(ocrWatchTargets));
    } catch {
      setStatusMessage("JARVIS could not persist OCR watches locally.");
    }
  }, [ocrWatchTargets]);

  useEffect(() => {
    try {
      const savedCorrections = window.localStorage.getItem(OCR_CORRECTIONS_STORAGE_KEY);
      const savedTemplates = window.localStorage.getItem(OCR_WATCH_TEMPLATES_STORAGE_KEY);
      if (savedCorrections) setOcrCorrections(JSON.parse(savedCorrections) as OcrCorrectionRecord[]);
      if (savedTemplates) setOcrWatchTemplates(JSON.parse(savedTemplates) as OcrWatchTemplate[]);
    } catch {
      setOcrCorrections([]);
      setOcrWatchTemplates([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(OCR_CORRECTIONS_STORAGE_KEY, JSON.stringify(ocrCorrections.slice(0, 50)));
    } catch {
      setStatusMessage("JARVIS could not persist OCR corrections locally.");
    }
  }, [ocrCorrections]);

  useEffect(() => {
    try {
      window.localStorage.setItem(OCR_WATCH_TEMPLATES_STORAGE_KEY, JSON.stringify(ocrWatchTemplates.slice(0, 20)));
    } catch {
      setStatusMessage("JARVIS could not persist OCR watch templates locally.");
    }
  }, [ocrWatchTemplates]);


  function appendConversationTurn(role: "user" | "jarvis", text: string, routeLabel?: string) {
    setConversationTurns((current) => [
      ...current.slice(-7),
      {
        id: Date.now() + current.length,
        role,
        text,
        routeLabel: routeLabel ?? (role === "jarvis" ? currentRouteLabelRef.current : undefined),
      },
    ]);
  }

  async function buildSemanticEmbeddingWithFallback(text: string) {
    if (embeddingBackend === "ollama") {
      try {
        const embedding = await buildOllamaSemanticEmbedding(
          ollamaBaseUrl,
          embeddingModelName || "nomic-embed-text",
          text,
        );
        setEmbeddingStatusMessage(`Ollama embeddings active: ${embeddingModelName || "nomic-embed-text"}.`);
        return {
          embedding,
          backend: "ollama" as const,
        };
      } catch (error) {
        setEmbeddingStatusMessage(
          getErrorDetail(error, "Ollama embeddings unavailable. Using local fallback."),
        );
      }
    }

    if (embeddingBackend === "transformers") {
      const model = embeddingModelName || "Xenova/all-MiniLM-L6-v2";
      try {
        const result = await buildTransformersSemanticEmbedding(
          model,
          text,
          transformersEmbeddingRef.current,
        );
        transformersEmbeddingRef.current = {
          model,
          extractor: result.extractor,
        };
        setEmbeddingStatusMessage(`Transformers.js embeddings active: ${model}.`);
        return {
          embedding: result.embedding,
          backend: "transformers" as const,
        };
      } catch (error) {
        setEmbeddingStatusMessage(
          getErrorDetail(error, "Transformers.js embeddings unavailable. Using local fallback."),
        );
      }
    }

    return {
      embedding: buildLocalSemanticEmbedding(text),
      backend: "local" as const,
    };
  }

  async function buildCachedSemanticIntentEmbedding(text: string) {
    const cacheKey = `${embeddingBackend}:${embeddingModelName || "default"}:${normalizeControlCommand(text)}`;
    const cached = semanticIntentEmbeddingCacheRef.current.get(cacheKey);
    if (cached) {
      return cached;
    }

    const embedding = await buildSemanticEmbeddingWithFallback(text);
    semanticIntentEmbeddingCacheRef.current.set(cacheKey, embedding);
    if (semanticIntentEmbeddingCacheRef.current.size > 240) {
      const firstKey = semanticIntentEmbeddingCacheRef.current.keys().next().value;
      if (firstKey) {
        semanticIntentEmbeddingCacheRef.current.delete(firstKey);
      }
    }
    return embedding;
  }

  async function rememberSemanticConversationTurn(command: string, intent: CommandIntent | null) {
    const memoryText = buildConversationMemoryText(command, intent, activeConversationContext);
    if (!memoryText.trim()) {
      return;
    }

    const embeddingResult = await buildSemanticEmbeddingWithFallback(memoryText);
    const summary = intent
      ? describeCommandIntent(intent)
      : activeConversationContext?.label ?? command.trim();
    const record: SemanticConversationMemoryRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: memoryText,
      summary,
      intentKind: intent?.kind ?? null,
      contextLabel: activeConversationContext?.label ?? null,
      embedding: embeddingResult.embedding,
      embeddingBackend: embeddingResult.backend,
      createdAt: new Date().toISOString(),
    };

    setSemanticConversationMemory((current) => {
      const withoutDuplicate = current.filter(
        (entry) => normalizeControlCommand(entry.summary) !== normalizeControlCommand(summary),
      );
      return [record, ...withoutDuplicate].slice(0, 80);
    });

    if (intent) {
      setLastConversationTopic({
        phrase: command.trim(),
        intentLabel: describeCommandIntent(intent),
        actionType: describeIntentActionType(intent),
        contextLabel: activeConversationContext?.label ?? null,
        createdAt: new Date().toISOString(),
      });
    }
  }

  function rememberSemanticIntentFeedback(
    phrase: string,
    candidateId: string,
    candidateLabel: string,
    accepted: boolean,
  ) {
    const normalizedPhrase = normalizeLearnedPhrase(phrase);
    if (!normalizedPhrase) {
      return;
    }

    const record: SemanticIntentFeedbackRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      phrase: phrase.trim(),
      normalizedPhrase,
      candidateId,
      candidateLabel,
      accepted,
      createdAt: new Date().toISOString(),
    };

    setSemanticIntentFeedback((current) => [
        ...current.filter(
        (entry) =>
          !(
            entry.normalizedPhrase === normalizedPhrase &&
            entry.candidateId === candidateId
          ),
      ),
    ].slice(0, 120));
  }

  function findDesktopProject(query: string) {
    const normalizedQuery = query.trim().toLowerCase();
    return (
      desktopProjects.find((project) => project.name.trim().toLowerCase() === normalizedQuery) ??
      desktopProjects.find((project) => project.name.toLowerCase().includes(normalizedQuery)) ??
      null
    );
  }

  function createDesktopProject(name: string): DesktopProjectRecord | null {
    const normalizedName = normalizeDesktopProjectName(name);
    if (!normalizedName) {
      return null;
    }

    const nowIso = new Date().toISOString();
    const existing = desktopProjects.find(
      (project) => project.name.trim().toLowerCase() === normalizedName.toLowerCase(),
    );
    if (existing) {
      return existing;
    }

    const savedProject: DesktopProjectRecord = {
      id: `${Date.now()}-${normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: normalizedName,
      apps: [],
      folders: [],
      websites: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setDesktopProjects((current) => [savedProject, ...current]);

    return savedProject;
  }

  function createDesktopProjectFromTemplate(
    templateName: string,
    projectName: string,
  ): DesktopProjectRecord | null {
    const normalizedTemplate = templateName.trim().toLowerCase();
    const normalizedName = normalizeDesktopProjectName(projectName);
    if (!normalizedName) {
      return null;
    }

    const template = (() => {
      switch (normalizedTemplate) {
        case "coding":
        case "code":
          return {
            apps: ["vs code", "powershell"],
            folders: ["jarvis project"],
            websites: ["https://github.com"],
          };
        case "school":
        case "study":
          return {
            apps: ["vs code"],
            folders: ["documents", "downloads"],
            websites: [
              "https://calendar.google.com",
              "https://docs.google.com",
              "https://drive.google.com",
              "https://www.notion.so",
            ],
          };
        case "focus":
          return {
            apps: ["vs code", "notepad"],
            folders: ["documents"],
            websites: ["https://calendar.google.com", "https://www.notion.so"],
          };
        case "music":
          return {
            apps: ["spotify"],
            folders: [],
            websites: ["https://open.spotify.com"],
          };
        default:
          return null;
      }
    })();

    if (!template) {
      return null;
    }

    const nowIso = new Date().toISOString();
    const existing = desktopProjects.find(
      (project) => project.name.trim().toLowerCase() === normalizedName.toLowerCase(),
    );
    const savedProject: DesktopProjectRecord = {
      id: existing?.id ?? `${Date.now()}-${normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: normalizedName,
      apps: Array.from(new Set([...(existing?.apps ?? []), ...template.apps])),
      folders: Array.from(new Set([...(existing?.folders ?? []), ...template.folders])),
      websites: Array.from(new Set([...(existing?.websites ?? []), ...template.websites])),
      createdAt: existing?.createdAt ?? nowIso,
      updatedAt: nowIso,
    };

    setDesktopProjects((current) =>
      existing
        ? current.map((project) => (project.id === existing.id ? savedProject : project))
        : [savedProject, ...current],
    );

    return savedProject;
  }

  function updateDesktopProject(
    query: string,
    updater: (project: DesktopProjectRecord) => DesktopProjectRecord,
  ): DesktopProjectRecord | null {
    const existingProject = findDesktopProject(query);
    if (!existingProject) {
      return null;
    }

    const updatedProject = updater(existingProject);
    setDesktopProjects((current) =>
      current.map((project) => (project.id === existingProject.id ? updatedProject : project)),
    );

    return updatedProject;
  }

  function deleteDesktopProject(query: string): DesktopProjectRecord | null {
    const existingProject = findDesktopProject(query);
    if (!existingProject) {
      return null;
    }

    setDesktopProjects((current) =>
      current.filter((project) => project.id !== existingProject.id),
    );
    return existingProject;
  }

  const {
    rememberPersonBirthday,
    updatePersonMemory,
    rememberTravelSummary,
    rememberExpenseSummary,
    rememberPackageSummary,
    rememberMeetingPrepSummary,
    rememberSchoolPlan,
  } = useMemo(
    () =>
      createLocalMemoryActions({
        gatewayConfig,
        peopleMemory,
        setPeopleMemory,
        setTravelMemory,
        setExpenseMemory,
        setPackageMemory,
        setMeetingPrepMemory,
        setSchoolPlanMemory,
        setRustPeopleMemory,
        setRustTravelMemory,
        setRustExpenseMemory,
        setRustPackageMemory,
        setRustMeetingPrepMemory,
        setRustSchoolPlanMemory,
      }),
    [gatewayConfig, peopleMemory],
  );


  function buildCrossFeatureSuggestionsForEmail(email: EmailRecord) {
    const suggestions: CrossFeatureSuggestionRecord[] = [];
    const birthdayCandidates = extractBirthdayCandidatesFromEmail(email);
    const travelDetails = extractTravelDetails(email);
    const expenseDetails = extractExpenseDetails(email);
    const packageDetails = extractPackageDetails(email);
    const emailSignals = extractEmailSignals(email);

    if (birthdayCandidates.length > 0) {
      suggestions.push({
        id: `birthday-${email.id}`,
        title: "Save birthday details",
        detail: `I found ${birthdayCandidates.length} birthday cue${birthdayCandidates.length === 1 ? "" : "s"} in this email. I can move them into people memory.`,
        intent: { kind: "save_birthdays_from_current_email" },
      });
      suggestions.push({
        id: `birthday-brief-${email.id}`,
        title: "Save birthdays and refresh the brief",
        detail: "I can save the birthday details from this email and then refresh your daily brief so they show up there too.",
        intents: [{ kind: "save_birthdays_from_current_email" }, { kind: "create_daily_brief" }],
      });
    }

    if (hasTravelSignal(travelDetails)) {
      suggestions.push({
        id: `travel-note-${email.id}`,
        title: "Save travel summary",
        detail: "This email looks travel-related. I can save the trip summary into Notion.",
        intent: { kind: "save_current_email_travel_to_notion" },
      });

      if (travelDetails.dates.length > 0 || travelDetails.departures.length > 0 || travelDetails.checkIns.length > 0) {
        suggestions.push({
          id: `travel-calendar-${email.id}`,
          title: "Add trip to calendar",
          detail: "I found enough trip timing cues to try creating a calendar item from this travel email.",
          intent: { kind: "save_current_email_travel_to_calendar" },
        });
        suggestions.push({
          id: `travel-bundle-${email.id}`,
          title: "Capture the whole trip",
          detail: "I can save the travel summary to Notion and add the trip to Calendar in one pass.",
          intents: [
            { kind: "save_current_email_travel_to_notion" },
            { kind: "save_current_email_travel_to_calendar" },
          ],
        });
      }
    }

    if (hasExpenseSignal(expenseDetails)) {
      suggestions.push({
        id: `expense-${email.id}`,
        title: "Capture expense",
        detail: "This looks like a receipt or invoice. I can save it into your expense memory and Notion.",
        intent: { kind: "save_current_email_expense_to_notion" },
      });
      if (expenseDetails.normalizedCategory) {
        suggestions.push({
          id: `expense-bundle-${email.id}`,
          title: "Capture and total this category",
          detail: `I can save this expense and then show your ${expenseDetails.normalizedCategory.toLowerCase()} spending for this month.`,
          intents: [
            { kind: "save_current_email_expense_to_notion" },
            { kind: "list_monthly_expenses_by_category", category: expenseDetails.normalizedCategory },
          ],
        });
      }
    }

    if (hasPackageSignal(packageDetails)) {
      suggestions.push({
        id: `package-${email.id}`,
        title: "Track package",
        detail: "This looks like a shipping update. I can save it into package memory and Notion.",
        intent: { kind: "save_current_email_package_to_notion" },
      });
      suggestions.push({
        id: `package-bundle-${email.id}`,
        title: "Track and check package status",
        detail: "I can save this package update and then show the next most relevant shipping view.",
        intents: [
          { kind: "save_current_email_package_to_notion" },
          packageDetails.statuses.some((status) => /delayed/i.test(status))
            ? { kind: "list_delayed_packages" }
            : packageDetails.deliveryDates.some((label) => isTomorrowDeliveryLabel(label))
              ? { kind: "list_packages_arriving_tomorrow" }
              : { kind: "list_package_memory" },
        ],
      });
    }

    if (emailSignals.meetings.length > 0) {
      suggestions.push({
        id: `calendar-${email.id}`,
        title: "Turn email into calendar item",
        detail: "I spotted meeting-like details in this email. I can turn it into a calendar action.",
        intent: { kind: "create_calendar_event_from_current_email" },
      });
    }

    return suggestions.slice(0, 6);
  }

  function buildCrossFeatureSuggestionsForState() {
    const suggestions: CrossFeatureSuggestionRecord[] = [];
    const upcomingFollowUps = getUpcomingPeopleFollowUps(peopleMemory);
    const arrivingTomorrow = packageMemory.filter((item) => item.arrivingTomorrow);
    const delayedPackages = packageMemory.filter((item) => /\bdelayed\b/i.test(item.status ?? ""));
    const recurringExpenses = expenseMemory.filter((item) => item.recurringLikely);

    if (upcomingFollowUps.length > 0) {
      suggestions.push({
        id: "people-followups",
        title: "Review people follow-ups",
        detail: `You have ${upcomingFollowUps.length} person-related follow-up${upcomingFollowUps.length === 1 ? "" : "s"} due soon.`,
        intent: { kind: "list_people_check_ins" },
      });
    }

    if (arrivingTomorrow.length > 0) {
      suggestions.push({
        id: "packages-tomorrow",
        title: "Check tomorrow's deliveries",
        detail: `You have ${arrivingTomorrow.length} package${arrivingTomorrow.length === 1 ? "" : "s"} arriving tomorrow.`,
        intent: { kind: "list_packages_arriving_tomorrow" },
      });
    }

    if (delayedPackages.length > 0) {
      suggestions.push({
        id: "packages-delayed",
        title: "Review delayed packages",
        detail: `You have ${delayedPackages.length} delayed package${delayedPackages.length === 1 ? "" : "s"} that may need attention.`,
        intent: { kind: "list_delayed_packages" },
      });
    }

    if (recurringExpenses.length > 0) {
      suggestions.push({
        id: "expenses-recurring",
        title: "Review recurring charges",
        detail: `I found ${recurringExpenses.length} likely recurring charge${recurringExpenses.length === 1 ? "" : "s"} in your saved expenses.`,
        intent: { kind: "list_recurring_expenses" },
      });
    }

    if (meetingPrepMemory.length > 0 && schoolPlanMemory.length > 0) {
      suggestions.push({
        id: "planner-bundle",
        title: "Refresh your planning stack",
        detail: "I can rebuild your daily brief and school plan together so your planning context stays fresh.",
        intents: [{ kind: "create_school_plan" }, { kind: "create_daily_brief" }],
      });
    }

    return suggestions.slice(0, 5);
  }

  function pickProactiveCrossSuggestion(suggestions: CrossFeatureSuggestionRecord[]) {
    return suggestions.find((suggestion) => (suggestion.intents?.length ?? 0) > 1) ?? suggestions[0] ?? null;
  }

  function clearWakeRestartTimeout() {
    if (wakeRestartTimeoutRef.current !== null) {
      window.clearTimeout(wakeRestartTimeoutRef.current);
      wakeRestartTimeoutRef.current = null;
    }
  }

  function clearFollowUpTimeout() {
    if (followUpTimeoutRef.current !== null) {
      window.clearTimeout(followUpTimeoutRef.current);
      followUpTimeoutRef.current = null;
    }
  }

  function shouldUseBrowserFollowUps() {
    return wakeModeEnabled && voiceBackend === "browser";
  }

  function shouldKeepFollowUpWindowOpen(intent: CommandIntent) {
    return intent.kind !== "sleep_mode" && intent.kind !== "shutdown_app";
  }

  function closeFollowUpWindow() {
    clearFollowUpTimeout();
    setFollowUpWindow(null);
  }

  function openFollowUpWindow(reason: FollowUpWindow["reason"]) {
    if (!shouldUseBrowserFollowUps()) {
      return;
    }

    clearFollowUpTimeout();
    setFollowUpWindow({ active: true, reason });
    followUpTimeoutRef.current = window.setTimeout(() => {
      followUpTimeoutRef.current = null;
      setFollowUpWindow(null);
      restartWakeListenerSoon();
    }, FOLLOW_UP_WINDOW_MS);
  }

  function stopWakeListener() {
    clearWakeRestartTimeout();
    wakeTriggeredRef.current = false;
    if (wakeRecognitionRef.current) {
      const wakeRecognition = wakeRecognitionRef.current;
      wakeRecognitionRef.current = null;
      wakeRecognition.onend = null;
      wakeRecognition.onerror = null;
      wakeRecognition.onresult = null;
      wakeRecognition.stop();
    }
    setWakeListenerActive(false);
    if (voiceState === "wake_listening") {
      setVoiceState("idle");
    }
  }

  function stopCommandListener() {
    if (commandRecognitionRef.current) {
      const commandRecognition = commandRecognitionRef.current;
      commandRecognitionRef.current = null;
      commandRecognition.onend = null;
      commandRecognition.onerror = null;
      commandRecognition.onresult = null;
      commandRecognition.stop();
    }
  }

  function stopHandsFreeSession() {
    closeFollowUpWindow();
    stopWakeListener();
    stopCommandListener();
    setWakeCueActive(false);
    setWakeListenerActive(false);
    setVoiceTranscript("");
    setVoiceState("idle");
    setVoiceSessionPhase("idle");
  }

  function returnToArmedWakeMode() {
    closeFollowUpWindow();
    stopCommandListener();
    setWakeCueActive(false);
    setVoiceTranscript("");
    setVoiceState("idle");
    setVoiceSessionPhase("idle");
    setStatusMessage(`${assistantName} is standing by. Wake mode is armed again.`);
    if (shouldUseBrowserFollowUps()) {
      startBrowserWakeListener();
    }
  }

  async function loadMemoryView() {
    try {
      const [routines, history, loadedProposals] = await Promise.all([
        getRoutines(),
        getRecentHistory(),
        getProposals(),
      ]);
      setStoredRoutines(routines);
      setRecentHistory(history);
      setProposals(loadedProposals);
    } catch {
      setStatusMessage(
        "Memory layer is not available yet. Once Tauri is connected, routines and history will appear here.",
      );
    }
  }

  async function loadProposalSteps(proposalId: number) {
    try {
      const steps = await getProposalSteps(proposalId);
      setProposalSteps((current) => ({ ...current, [proposalId]: steps }));
    } catch {
      setCommandResult({
        title: "Could not load proposal steps",
        detail: "JARVIS could not fetch the draft steps for that proposal.",
      });
    }
  }

  async function loadVoiceCorrections() {
    try {
      const corrections = await getVoiceCorrections();
      setVoiceCorrections(corrections);
    } catch {
      setStatusMessage("Voice correction memory could not be loaded.");
    }
  }

  async function loadLocalVoiceStatus() {
    try {
      const status = await getLocalVoiceBackendStatus();
      setLocalVoiceStatus(status);
      setLocalExecutablePath(status.executablePath ?? "");
      setLocalModelPath(status.modelPath ?? "");
    } catch {
      setStatusMessage("Local voice backend status could not be loaded.");
    }
  }

  async function loadLocalSpeechStatus() {
    try {
      const status = await getLocalSpeechOutputStatus();
      setLocalSpeechStatus(status);
      setLocalTtsExecutablePath(status.executablePath ?? "");
      setLocalTtsModelPath(status.modelPath ?? "");
    } catch {
      setStatusMessage("Local speech output status could not be loaded.");
    }
  }

  async function loadWakeModeStatus() {
    try {
      const status = await getWakeModeStatus();
      setWakeModeStatus(status);
      setAssistantName(status.assistantName);
      setWakeModeEnabled(status.wakeModeEnabled);
    } catch {
      setStatusMessage("Wake mode status could not be loaded.");
    }
  }

  async function loadBrowserAliases() {
    try {
      const aliases = await getBrowserAliases();
      setBrowserAliases(aliases);
    } catch {
      setStatusMessage("Browser alias memory could not be loaded.");
    }
  }

  async function loadLearnedIntents() {
    try {
      const mappings = await getLearnedIntents();
      setLearnedIntentMappings(mappings);
    } catch {
      setStatusMessage("Personal language memory could not be loaded.");
    }
  }

  async function rememberSuccessfulPhrase(phrase: string, intent: CommandIntent) {
    const normalizedPhrase = normalizeLearnedPhrase(phrase);
    if (!normalizedPhrase) {
      return;
    }

    try {
      await saveLearnedIntentEntry(
        phrase.trim(),
        normalizedPhrase,
        intent.kind,
        encodeLearnedIntent(intent),
      );
      await loadLearnedIntents();
    } catch {
      setStatusMessage("JARVIS could not update personal language memory.");
    }
  }

  async function handleDeleteLearnedIntent(record: LearnedIntentRecord) {
    try {
      await deleteLearnedIntentEntry(record.id);
      setSemanticIntentFeedback((current) =>
        current.filter((entry) => entry.candidateId !== `learned.${record.id}`),
      );
      setLearnedIntentRenameDrafts((current) => {
        const next = { ...current };
        delete next[record.id];
        return next;
      });
      await loadLearnedIntents();
      setCommandResult({
        title: "Training phrase deleted",
        detail: `Removed "${record.phrase}" from JARVIS language memory.`,
      });
      setStatusMessage("Deleted learned phrase.");
    } catch {
      setStatusMessage("JARVIS could not delete that learned phrase.");
    }
  }

  async function handleRenameLearnedIntent(record: LearnedIntentRecord) {
    const nextPhrase = learnedIntentRenameDrafts[record.id]?.trim();
    if (!nextPhrase || normalizeLearnedPhrase(nextPhrase) === record.normalizedPhrase) {
      return;
    }

    try {
      await saveLearnedIntentEntry(
        nextPhrase,
        normalizeLearnedPhrase(nextPhrase),
        record.intentKind,
        record.intentPayload,
      );
      await deleteLearnedIntentEntry(record.id);
      setSemanticIntentFeedback((current) =>
        current.filter((entry) => entry.candidateId !== `learned.${record.id}`),
      );
      setLearnedIntentRenameDrafts((current) => {
        const next = { ...current };
        delete next[record.id];
        return next;
      });
      await loadLearnedIntents();
      setCommandResult({
        title: "Training phrase renamed",
        detail: `Renamed "${record.phrase}" to "${nextPhrase}".`,
      });
      setStatusMessage("Renamed learned phrase.");
    } catch {
      setStatusMessage("JARVIS could not rename that learned phrase.");
    }
  }

  function handleDeleteWorkflow(workflow: SavedWorkflowRecord) {
    setSavedWorkflows((current) => current.filter((entry) => entry.id !== workflow.id));
    setWorkflowRenameDrafts((current) => {
      const next = { ...current };
      delete next[workflow.id];
      return next;
    });
    setCommandResult({
      title: "Training workflow deleted",
      detail: `Removed "${workflow.name}" from saved workflows.`,
    });
    setStatusMessage("Deleted saved workflow.");
  }

  function handleRenameWorkflow(workflow: SavedWorkflowRecord) {
    const nextTrigger = workflowRenameDrafts[workflow.id]?.trim();
    if (!nextTrigger || normalizeControlCommand(nextTrigger) === normalizeControlCommand(workflow.triggerPhrase)) {
      return;
    }

    const duplicate = savedWorkflows.find(
      (entry) =>
        entry.id !== workflow.id &&
        normalizeControlCommand(entry.triggerPhrase) === normalizeControlCommand(nextTrigger),
    );
    if (duplicate) {
      setCommandResult({
        title: "Workflow trigger already used",
        detail: `"${nextTrigger}" is already used by ${duplicate.name}.`,
      });
      setStatusMessage("Workflow rename blocked by duplicate trigger.");
      return;
    }

    setSavedWorkflows((current) =>
      current.map((entry) =>
        entry.id === workflow.id ? { ...entry, triggerPhrase: nextTrigger } : entry,
      ),
    );
    setWorkflowRenameDrafts((current) => {
      const next = { ...current };
      delete next[workflow.id];
      return next;
    });
    setCommandResult({
      title: "Training workflow renamed",
      detail: `Updated "${workflow.name}" trigger to "${nextTrigger}".`,
    });
    setStatusMessage("Renamed saved workflow trigger.");
  }

  async function handleTrainingReviewCleanupCommand(command: string) {
    const cleanup = parseTrainingReviewCleanupCommand(command);
    if (!cleanup) {
      return null;
    }

    if (cleanup.kind === "delete_phrase" || cleanup.kind === "rename_phrase") {
      const normalizedPhrase = normalizeLearnedPhrase(cleanup.phrase);
      const record =
        learnedIntentMappings.find((entry) => entry.normalizedPhrase === normalizedPhrase) ??
        learnedIntentMappings.find((entry) =>
          entry.normalizedPhrase.includes(normalizedPhrase),
        ) ??
        null;

      if (!record) {
        setCommandResult({
          title: "Training phrase not found",
          detail: `I could not find a learned phrase matching "${cleanup.phrase}".`,
        });
        setStatusMessage("No matching learned phrase found.");
        speakIfEnabled("I could not find that learned phrase.");
        return { status: "failed" as const };
      }

      if (cleanup.kind === "delete_phrase") {
        await handleDeleteLearnedIntent(record);
        speakIfEnabled(`Deleted the learned phrase ${record.phrase}.`);
        return { status: "completed" as const };
      }

      setLearnedIntentRenameDrafts((current) => ({
        ...current,
        [record.id]: cleanup.nextPhrase,
      }));
      await saveLearnedIntentEntry(
        cleanup.nextPhrase,
        normalizeLearnedPhrase(cleanup.nextPhrase),
        record.intentKind,
        record.intentPayload,
      );
      await deleteLearnedIntentEntry(record.id);
      await loadLearnedIntents();
      setCommandResult({
        title: "Training phrase renamed",
        detail: `Renamed "${record.phrase}" to "${cleanup.nextPhrase}".`,
      });
      setStatusMessage("Renamed learned phrase by voice.");
      speakIfEnabled(`Renamed ${record.phrase} to ${cleanup.nextPhrase}.`);
      return { status: "completed" as const };
    }

    const normalizedWorkflowPhrase = normalizeControlCommand(cleanup.phrase);
    const workflow =
      savedWorkflows.find(
        (entry) =>
          normalizeControlCommand(entry.triggerPhrase) === normalizedWorkflowPhrase ||
          normalizeControlCommand(entry.name) === normalizedWorkflowPhrase,
      ) ??
      savedWorkflows.find(
        (entry) =>
          normalizeControlCommand(entry.triggerPhrase).includes(normalizedWorkflowPhrase) ||
          normalizeControlCommand(entry.name).includes(normalizedWorkflowPhrase),
      ) ??
      null;

    if (!workflow) {
      setCommandResult({
        title: "Training workflow not found",
        detail: `I could not find a saved workflow matching "${cleanup.phrase}".`,
      });
      setStatusMessage("No matching saved workflow found.");
      speakIfEnabled("I could not find that workflow.");
      return { status: "failed" as const };
    }

    if (cleanup.kind === "delete_workflow") {
      handleDeleteWorkflow(workflow);
      speakIfEnabled(`Deleted the workflow ${workflow.name}.`);
      return { status: "completed" as const };
    }

    setWorkflowRenameDrafts((current) => ({
      ...current,
      [workflow.id]: cleanup.nextPhrase,
    }));
    const duplicate = savedWorkflows.find(
      (entry) =>
        entry.id !== workflow.id &&
        normalizeControlCommand(entry.triggerPhrase) === normalizeControlCommand(cleanup.nextPhrase),
    );
    if (duplicate) {
      setCommandResult({
        title: "Workflow trigger already used",
        detail: `"${cleanup.nextPhrase}" is already used by ${duplicate.name}.`,
      });
      setStatusMessage("Workflow rename blocked by duplicate trigger.");
      return { status: "failed" as const };
    }
    setSavedWorkflows((current) =>
      current.map((entry) =>
        entry.id === workflow.id ? { ...entry, triggerPhrase: cleanup.nextPhrase } : entry,
      ),
    );
    setCommandResult({
      title: "Training workflow renamed",
      detail: `Updated "${workflow.name}" trigger to "${cleanup.nextPhrase}".`,
    });
    setStatusMessage("Renamed saved workflow trigger by voice.");
    speakIfEnabled(`Renamed the workflow trigger to ${cleanup.nextPhrase}.`);
    return { status: "completed" as const };
  }

  function handleConversationContextStackCommand(command: string) {
    const normalized = normalizeControlCommand(command);

    if (
      [
        "what are we in",
        "what app are we in",
        "what is the active context",
        "what is the current context",
        "where are we",
        "what are we working on",
      ].includes(normalized)
    ) {
      const activeLabel = activeConversationContext?.label ?? "nothing yet";
      const stackLabels = conversationContextStack
        .slice(0, 5)
        .map((entry) => entry.label)
        .join(" -> ");
      setCommandResult({
        title: "Active conversation context",
        detail: `Current: ${activeLabel}. Recent stack: ${stackLabels || "empty"}.`,
      });
      setStatusMessage("JARVIS reported the active conversation context.");
      setVoiceSessionPhase("ready");
      appendConversationTurn("jarvis", `We are currently in ${activeLabel}.`);
      speakIfEnabled(`We are currently in ${activeLabel}.`);
      return { status: "completed" as const };
    }

    if (["switch back", "go back", "back to last context", "previous context"].includes(normalized)) {
      const previous = conversationContextStack[1] ?? conversationContextStack[0] ?? null;
      if (!previous) {
        setCommandResult({
          title: "No previous context",
          detail: "JARVIS does not have a previous app or topic to switch back to yet.",
        });
        setStatusMessage("No previous context is available.");
        return { status: "failed" as const };
      }

      setActiveConversationContext(previous);
      setCommandResult({
        title: "Context switched",
        detail: `Switched conversation context back to ${previous.label}.`,
      });
      setStatusMessage(`Conversation context switched to ${previous.label}.`);
      setVoiceSessionPhase("ready");
      appendConversationTurn("jarvis", `Switched back to ${previous.label}.`);
      speakIfEnabled(`Switched back to ${previous.label}.`);
      return { status: "completed" as const };
    }

    const switchMatch = command.trim().match(/^(?:switch|go|return|jump)\s+(?:back\s+)?to\s+(.+)$/i);
    const target = switchMatch?.[1]?.trim();
    if (target) {
      const context = findConversationContextByLabel(target, conversationContextStack);
      if (!context) {
        setCommandResult({
          title: "Context not found",
          detail: `I could not find "${target}" in the recent conversation context stack.`,
        });
        setStatusMessage("Requested context was not in the recent stack.");
        speakIfEnabled(`I could not find ${target} in recent context.`);
        return { status: "failed" as const };
      }

      setActiveConversationContext(context);
      setCommandResult({
        title: "Context switched",
        detail: `Switched conversation context to ${context.label}.`,
      });
      setStatusMessage(`Conversation context switched to ${context.label}.`);
      setVoiceSessionPhase("ready");
      appendConversationTurn("jarvis", `Switched to ${context.label}.`);
      speakIfEnabled(`Switched to ${context.label}.`);
      return { status: "completed" as const };
    }

    return null;
  }

  async function teachJarvisMeaning(phrase: string, meaning: string) {
    const resolvedIntent = resolveTeachableIntent(meaning, browserAliases);
    if (!resolvedIntent) {
      throw new Error(
        `I could not turn "${meaning}" into a reliable action yet. Try teaching it with a clearer action like "open coding workspace" or "play blinding lights on spotify".`,
      );
    }

    await rememberSuccessfulPhrase(phrase, resolvedIntent);
    const family = findLearnedIntentFamilySummary(resolvedIntent, learnedIntentMappings);
    return {
      resolvedIntent,
      familyLabel: family?.label ?? describeCommandIntent(resolvedIntent),
    };
  }

  function rememberRejectedPendingSemanticClarification(clarification: PendingClarification) {
    if (clarification.suggestedWorkflow) {
      rememberSemanticIntentFeedback(
        clarification.originalPhrase ?? clarification.suggestedWorkflow.triggerPhrase,
        clarification.suggestedWorkflow.candidateId,
        clarification.suggestedWorkflow.candidateLabel,
        false,
      );
      return;
    }

    if (clarification.suggestedSemanticIntent) {
      rememberSemanticIntentFeedback(
        clarification.originalPhrase ?? clarification.prompt,
        clarification.suggestedSemanticIntent.candidateId,
        clarification.suggestedSemanticIntent.candidateLabel,
        false,
      );
    }
  }

  function startTrainingMode(targetCount = 5) {
    setTrainingModeSession({
      targetCount,
      currentIndex: 1,
      phase: "awaiting_phrase",
      pendingPhrase: null,
      learnedExamples: [],
    });
    setTeachingTargetPhrase(null);
    setPendingClarification(null);
    setCommandResult({
      title: "Training mode started",
      detail:
        "Give me example phrase 1. After that, I will ask what it should mean. Say cancel training anytime to stop.",
    });
    setStatusMessage("JARVIS training mode is listening for example phrase 1.");
    setVoiceSessionPhase("ready");
    appendConversationTurn(
      "jarvis",
      `Training mode started. Give me example phrase 1 of ${targetCount}.`,
    );
    speakIfEnabled(`Training mode started. Give me example phrase 1.`);
    openFollowUpWindow("reply");
  }

  async function handleTrainingModeInput(command: string, session: TrainingModeSession) {
    if (isCancelTrainingModeCommand(command)) {
      setTrainingModeSession(null);
      setCommandResult({
        title: "Training mode cancelled",
        detail:
          session.learnedExamples.length > 0
            ? `Saved ${session.learnedExamples.length} example${session.learnedExamples.length === 1 ? "" : "s"} before stopping.`
            : "No examples were saved.",
      });
      setStatusMessage("Training mode stopped.");
      setVoiceSessionPhase("ready");
      appendConversationTurn("jarvis", "Training mode stopped.");
      speakIfEnabled("Training mode stopped.");
      return { status: "completed" as const };
    }

    if (session.phase === "awaiting_phrase") {
      const phrase = command.trim().replace(/^["']|["']$/g, "");
      if (!phrase) {
        setCommandResult({
          title: "Training needs a phrase",
          detail: `Give me example phrase ${session.currentIndex}, or say cancel training.`,
        });
        speakIfEnabled(`Give me example phrase ${session.currentIndex}.`);
        return { status: "clarification" as const };
      }

      setTrainingModeSession({
        ...session,
        phase: "awaiting_meaning",
        pendingPhrase: phrase,
      });
      setCommandResult({
        title: "Training phrase captured",
        detail: `Phrase ${session.currentIndex}: "${phrase}". Now tell me what it should mean, like "play blinding lights on spotify" or "save this to notion".`,
      });
      setStatusMessage("Training mode is waiting for the intended meaning.");
      setVoiceSessionPhase("ready");
      appendConversationTurn(
        "jarvis",
        `Got the phrase: ${phrase}. What should it mean?`,
      );
      speakIfEnabled(`Got it. What should ${phrase} mean?`);
      openFollowUpWindow("reply");
      return { status: "clarification" as const };
    }

    const phrase = session.pendingPhrase;
    if (!phrase) {
      setTrainingModeSession({
        ...session,
        phase: "awaiting_phrase",
        pendingPhrase: null,
      });
      return { status: "clarification" as const };
    }

    const meaning = command.trim();
    try {
      const workflowSteps = splitWorkflowCommand(meaning);
      const label = workflowSteps
        ? (() => {
            const workflow = teachJarvisWorkflow(phrase, workflowSteps);
            return `Workflow: ${workflow.name}`;
          })()
        : (() => {
            return "";
          })();
      let resolvedLabel = label;
      if (!workflowSteps) {
        const taught = await teachJarvisMeaning(phrase, meaning);
        resolvedLabel = describeCommandIntent(taught.resolvedIntent);
      }

      const learnedExamples = [
        ...session.learnedExamples,
        {
          phrase,
          meaning,
          label: resolvedLabel,
        },
      ];

      if (learnedExamples.length >= session.targetCount) {
        setTrainingModeSession(null);
        setCommandResult({
          title: "Training complete",
          detail: `Saved ${learnedExamples.length} examples: ${learnedExamples
            .map((entry) => `"${entry.phrase}" -> ${entry.label}`)
            .join(" | ")}`,
        });
        setStatusMessage("JARVIS training mode completed.");
        setVoiceSessionPhase("ready");
        appendConversationTurn(
          "jarvis",
          `Training complete. I saved ${learnedExamples.length} examples.`,
        );
        speakIfEnabled(`Training complete. I saved ${learnedExamples.length} examples.`);
        return { status: "completed" as const };
      }

      const nextIndex = session.currentIndex + 1;
      setTrainingModeSession({
        targetCount: session.targetCount,
        currentIndex: nextIndex,
        phase: "awaiting_phrase",
        pendingPhrase: null,
        learnedExamples,
      });
      setCommandResult({
        title: "Training example saved",
        detail: `Saved "${phrase}" as ${resolvedLabel}. Give me example phrase ${nextIndex} of ${session.targetCount}.`,
      });
      setStatusMessage(`Training mode saved example ${learnedExamples.length}.`);
      setVoiceSessionPhase("ready");
      appendConversationTurn(
        "jarvis",
        `Saved that. Give me example phrase ${nextIndex} of ${session.targetCount}.`,
      );
      speakIfEnabled(`Saved that. Give me example phrase ${nextIndex}.`);
      openFollowUpWindow("reply");
      return { status: "clarification" as const };
    } catch (error) {
      setCommandResult({
        title: "Training meaning unclear",
        detail: getErrorDetail(
          error,
          `I could not turn that into a reliable action. Try a clearer meaning for "${phrase}", like "play blinding lights on spotify" or "open coding workspace".`,
        ),
      });
      setStatusMessage("Training mode needs a clearer meaning.");
      setVoiceSessionPhase("ready");
      appendConversationTurn(
        "jarvis",
        `I need a clearer action for ${phrase}. Try saying the meaning again.`,
      );
      speakIfEnabled(`I need a clearer action for ${phrase}. Try saying the meaning again.`);
      openFollowUpWindow("reply");
      return { status: "clarification" as const };
    }
  }

  function teachJarvisWorkflow(phrase: string, steps: string[]) {
    const triggerPhrase = phrase.trim();
    const normalizedTrigger = normalizeControlCommand(triggerPhrase);
    if (!normalizedTrigger || steps.length < 2) {
      throw new Error("A taught workflow needs a trigger phrase and at least two clear steps.");
    }

    const duplicate = savedWorkflows.find(
      (workflow) => normalizeControlCommand(workflow.triggerPhrase) === normalizedTrigger,
    );
    const workflow: SavedWorkflowRecord = {
      id: duplicate?.id ?? `${Date.now()}`,
      name: duplicate?.name ?? generateWorkflowName(steps),
      triggerPhrase,
      steps,
      createdAt: duplicate?.createdAt ?? new Date().toISOString(),
      basedOnCount: duplicate?.basedOnCount ?? 1,
    };

    setSavedWorkflows((current) => [
        ...current.filter((entry) => entry.id !== workflow.id),
    ].slice(0, 20));

    return workflow;
  }

  function getWorkflowCounts() {
    try {
      const raw = window.localStorage.getItem(WORKFLOW_COUNTS_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, number>) : {};
    } catch {
      return {};
    }
  }

  function setWorkflowCounts(counts: Record<string, number>) {
    try {
      window.localStorage.setItem(WORKFLOW_COUNTS_STORAGE_KEY, JSON.stringify(counts));
    } catch {
      setStatusMessage("JARVIS could not persist workflow-learning counts.");
    }
  }

  function getDismissedWorkflowSignatures() {
    try {
      const raw = window.localStorage.getItem(DISMISSED_WORKFLOWS_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  function setDismissedWorkflowSignatures(signatures: string[]) {
    try {
      window.localStorage.setItem(
        DISMISSED_WORKFLOWS_STORAGE_KEY,
        JSON.stringify(signatures),
      );
    } catch {
      setStatusMessage("JARVIS could not persist dismissed workflow suggestions.");
    }
  }

  function rememberWorkflowSequence(steps: string[], sampleCommand: string) {
    const signature = buildWorkflowSignature(steps);
    const savedTriggerSet = new Set(
      savedWorkflows.map((workflow) => normalizeControlCommand(workflow.triggerPhrase)),
    );
    if (savedTriggerSet.has(normalizeControlCommand(sampleCommand))) {
      return;
    }

    const dismissed = getDismissedWorkflowSignatures();
    if (dismissed.includes(signature)) {
      return;
    }

    if (savedWorkflows.some((workflow) => buildWorkflowSignature(workflow.steps) === signature)) {
      return;
    }

    const counts = getWorkflowCounts();
    const nextCount = (counts[signature] ?? 0) + 1;
    counts[signature] = nextCount;
    setWorkflowCounts(counts);

    if (nextCount < 2) {
      return;
    }

    const name = generateWorkflowName(steps);
    const triggerPhrase = generateWorkflowTriggerPhrase(name);
    setWorkflowSuggestion({
      signature,
      name,
      triggerPhrase,
      steps,
      basedOnCount: nextCount,
      sampleCommand,
    });
    setCommandResult({
      title: "Workflow learned from repetition",
      detail: `You've repeated this ${nextCount} times. I can save it as "${name}" and run it later with "${triggerPhrase}".`,
    });
    appendConversationTurn(
      "jarvis",
      `You've repeated that workflow a few times. I can save it as ${name} and run it later if you want.`,
    );
  }

  function handleApproveWorkflowSuggestion() {
    if (!workflowSuggestion) {
      return;
    }

    const workflow: SavedWorkflowRecord = {
      id: `${Date.now()}`,
      name: workflowSuggestion.name,
      triggerPhrase: workflowSuggestion.triggerPhrase,
      steps: workflowSuggestion.steps,
      createdAt: new Date().toISOString(),
      basedOnCount: workflowSuggestion.basedOnCount,
    };
    setSavedWorkflows((current) => [workflow, ...current].slice(0, 12));
    setWorkflowSuggestion(null);
    setCommandResult({
      title: "Workflow saved",
      detail: `Saved "${workflow.name}". You can now say "${workflow.triggerPhrase}".`,
    });
    appendConversationTurn(
      "jarvis",
      `Saved that workflow. You can now say ${workflow.triggerPhrase}.`,
    );
    speakIfEnabled(`Saved that workflow. You can now say ${workflow.triggerPhrase}.`);
  }

  function handleDismissWorkflowSuggestion() {
    if (!workflowSuggestion) {
      return;
    }

    const dismissed = getDismissedWorkflowSignatures();
    setDismissedWorkflowSignatures([...dismissed, workflowSuggestion.signature]);
    setWorkflowSuggestion(null);
    setCommandResult({
      title: "Workflow suggestion dismissed",
      detail: "Okay. I won't suggest saving that repeated workflow right now.",
    });
    appendConversationTurn(
      "jarvis",
      "Okay. I won't suggest saving that workflow right now.",
    );
    speakIfEnabled("Okay. I won't suggest saving that workflow right now.");
  }

  function handleWorkflowFieldChange(
    workflowId: string,
    field: "name" | "triggerPhrase",
    value: string,
  ) {
    setSavedWorkflows((current) =>
      current.map((workflow) =>
        workflow.id === workflowId ? { ...workflow, [field]: value } : workflow,
      ),
    );
  }

  function handleWorkflowStepChange(workflowId: string, stepIndex: number, value: string) {
    setSavedWorkflows((current) =>
      current.map((workflow) =>
        workflow.id === workflowId
          ? {
              ...workflow,
              steps: workflow.steps.map((step, index) => (index === stepIndex ? value : step)),
            }
          : workflow,
      ),
    );
  }

  function handleSaveWorkflowEdits(workflowId: string) {
    const workflow = savedWorkflows.find((entry) => entry.id === workflowId);
    if (!workflow) {
      return;
    }

    const cleanedName = workflow.name.trim();
    const cleanedTrigger = workflow.triggerPhrase.trim();
    const cleanedSteps = workflow.steps.map((step) => step.trim()).filter(Boolean);

    if (!cleanedName || !cleanedTrigger || cleanedSteps.length === 0) {
      setCommandResult({
        title: "Workflow edit incomplete",
        detail: "A saved workflow needs a name, a trigger phrase, and at least one step.",
      });
      speakIfEnabled("That workflow still needs a name, trigger, and at least one step.");
      return;
    }

    const normalizedTrigger = normalizeControlCommand(cleanedTrigger);
    const duplicate = savedWorkflows.find(
      (entry) =>
        entry.id !== workflowId &&
        normalizeControlCommand(entry.triggerPhrase) === normalizedTrigger,
    );
    if (duplicate) {
      setCommandResult({
        title: "Workflow trigger already used",
        detail: `The trigger phrase "${cleanedTrigger}" is already used by ${duplicate.name}.`,
      });
      speakIfEnabled("That workflow trigger is already being used.");
      return;
    }

    setSavedWorkflows((current) =>
      current.map((entry) =>
        entry.id === workflowId
          ? {
              ...entry,
              name: cleanedName,
              triggerPhrase: cleanedTrigger,
              steps: cleanedSteps,
            }
          : entry,
      ),
    );
    setEditingWorkflowId(null);
    setCommandResult({
      title: "Workflow updated",
      detail: `Saved edits to ${cleanedName}. You can trigger it with "${cleanedTrigger}".`,
    });
    appendConversationTurn(
      "jarvis",
      `Updated the workflow ${cleanedName}. You can trigger it with ${cleanedTrigger}.`,
    );
    speakIfEnabled(`Updated the workflow ${cleanedName}.`);
  }

  function handleAddWorkflowTemplate(template: WorkflowTemplateRecord) {
    const normalizedTrigger = normalizeControlCommand(template.triggerPhrase);
    const duplicate = savedWorkflows.find(
      (workflow) =>
        normalizeControlCommand(workflow.triggerPhrase) === normalizedTrigger ||
        workflow.name.trim().toLowerCase() === template.name.trim().toLowerCase(),
    );

    if (duplicate) {
      setCommandResult({
        title: "Template already added",
        detail: `A saved workflow named ${duplicate.name} is already using that trigger or template shape.`,
      });
      speakIfEnabled("That workflow template is already in your library.");
      return;
    }

    const workflow: SavedWorkflowRecord = {
      id: `${Date.now()}-${template.id}`,
      name: template.name,
      triggerPhrase: template.triggerPhrase,
      steps: template.steps,
      createdAt: new Date().toISOString(),
      basedOnCount: 1,
    };
    setSavedWorkflows((current) => [workflow, ...current].slice(0, 20));
    setCommandResult({
      title: "Workflow template added",
      detail: `Added ${template.name}. You can trigger it with "${template.triggerPhrase}".`,
    });
    appendConversationTurn(
      "jarvis",
      `Added the workflow template ${template.name}. You can trigger it with ${template.triggerPhrase}.`,
    );
    speakIfEnabled(`Added the workflow template ${template.name}.`);
  }

  function handleExportWorkflows() {
    const exportPayload = JSON.stringify(savedWorkflows, null, 2);
    setWorkflowImportText(exportPayload);
    setCommandResult({
      title: "Workflow export ready",
      detail: "Your saved workflows are now in the export box as JSON.",
    });
    appendConversationTurn(
      "jarvis",
      "I prepared your saved workflows for export in the JSON box.",
    );
    speakIfEnabled("I prepared your saved workflows for export.");
  }

  function handleImportWorkflows() {
    try {
      const parsed = JSON.parse(workflowImportText) as SavedWorkflowRecord[];
      if (!Array.isArray(parsed)) {
        throw new Error("Workflow import must be a JSON array.");
      }

      const sanitized = parsed
        .map((workflow, index) => ({
          id: workflow.id || `${Date.now()}-${index}`,
          name: workflow.name?.trim() || `Imported workflow ${index + 1}`,
          triggerPhrase: workflow.triggerPhrase?.trim() || `run imported workflow ${index + 1}`,
          steps: Array.isArray(workflow.steps)
            ? workflow.steps.map((step) => String(step).trim()).filter(Boolean)
            : [],
          createdAt: workflow.createdAt || new Date().toISOString(),
          basedOnCount:
            typeof workflow.basedOnCount === "number" && Number.isFinite(workflow.basedOnCount)
              ? workflow.basedOnCount
              : 1,
        }))
        .filter((workflow) => workflow.steps.length > 0);

      const deduped = new Map<string, SavedWorkflowRecord>();
      for (const workflow of sanitized) {
        deduped.set(normalizeControlCommand(workflow.triggerPhrase), workflow);
      }

      const importedWorkflows = Array.from(deduped.values());
      setSavedWorkflows(importedWorkflows.slice(0, 20));
      setEditingWorkflowId(null);
      setCommandResult({
        title: "Workflows imported",
        detail: `Imported ${importedWorkflows.length} saved workflow${importedWorkflows.length === 1 ? "" : "s"}.`,
      });
      appendConversationTurn(
        "jarvis",
        `Imported ${importedWorkflows.length} saved workflow${importedWorkflows.length === 1 ? "" : "s"}.`,
      );
      speakIfEnabled(
        `Imported ${importedWorkflows.length} saved workflow${importedWorkflows.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      setCommandResult({
        title: "Workflow import failed",
        detail: getErrorDetail(error, "JARVIS could not read that workflow JSON."),
      });
      speakIfEnabled("I could not import that workflow JSON.");
    }
  }

  function updateModelProviderConfig(
    providerId: ModelProviderId,
    patch: Partial<ModelProviderConfig>,
  ) {
    setModelRouterConfig((current) => ({
      ...current,
      providers: {
        ...current.providers,
        [providerId]: {
          ...current.providers[providerId],
          ...patch,
              },
      },
    }));
  }

  async function saveProviderApiKey(providerId: ModelProviderId, apiKey: string) {
    const status = await saveModelProviderSecretEntry(providerId, apiKey.trim() || null);
    updateModelProviderConfig(providerId, { apiKey: "" });
    setModelProviderKeyStatus((current) => ({ ...current, [providerId]: status.hasApiKey }));
    setModelProviderKeyPreview((current) => ({
      ...current,
      [providerId]: status.maskedPreview ?? "",
    }));
    setModelRouterStatusMessage(
      status.hasApiKey
        ? `${MODEL_PROVIDER_LABELS[providerId]} API key saved in Windows Credential Manager.`
        : `${MODEL_PROVIDER_LABELS[providerId]} API key is not saved.`,
    );
  }

  async function refreshProviderKeyStatuses() {
    try {
      const statuses = await listProviderKeyStatus();
      const statusMap: Record<string, boolean> = {};
      const previewMap: Record<string, string> = {};
      for (const status of statuses) {
        statusMap[status.providerId] = status.hasApiKey;
        previewMap[status.providerId] = status.maskedPreview ?? "";
      }
      setModelProviderKeyStatus(statusMap);
      setModelProviderKeyPreview(previewMap);
    } catch {
      setModelRouterStatusMessage("Could not read Windows Credential Manager provider status.");
    }
  }

  async function deleteSavedProviderApiKey(providerId: ModelProviderId) {
    const status = await deleteProviderKey(providerId);
    updateModelProviderConfig(providerId, { apiKey: "" });
    setModelProviderKeyStatus((current) => ({ ...current, [providerId]: status.hasApiKey }));
    setModelProviderKeyPreview((current) => ({ ...current, [providerId]: "" }));
    setModelRouterStatusMessage(`${MODEL_PROVIDER_LABELS[providerId]} API key deleted from Windows Credential Manager.`);
  }

  async function testSavedProviderApiKey(providerId: ModelProviderId) {
    const status = await testProviderKey(providerId);
    setModelProviderKeyStatus((current) => ({ ...current, [providerId]: status.hasApiKey }));
    setModelProviderKeyPreview((current) => ({
      ...current,
      [providerId]: status.maskedPreview ?? "",
    }));
    setModelRouterStatusMessage(`${MODEL_PROVIDER_LABELS[providerId]} key exists in Windows Credential Manager.`);
  }

  function revealModelText(text: string) {
    setStreamingModelText("");
    const words = text.split(/(\s+)/);
    let index = 0;
    const interval = window.setInterval(() => {
      index += 8;
      setStreamingModelText(words.slice(0, index).join(""));
      if (index >= words.length) {
        window.clearInterval(interval);
      }
    }, 35);
  }

  function applyModelProviderPreset(presetId: string) {
    const preset = MODEL_PROVIDER_PRESETS.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }
    updateModelProviderConfig(preset.providerId, {
      chatModel: preset.chatModel,
      codingModel: preset.codingModel,
      reasoningModel: preset.reasoningModel,
    });
    setModelRouterStatusMessage(`${preset.label} preset applied to ${MODEL_PROVIDER_LABELS[preset.providerId]}.`);
  }

  function setPreferredModelProvider(taskType: "chat" | "coding" | "reasoning", providerId: ModelProviderId) {
    setModelRouterConfig((current) => {
      if (taskType === "chat") {
        return { ...current, defaultProvider: providerId };
      }
      if (taskType === "coding") {
        return { ...current, codingProvider: providerId };
      }
      return { ...current, reasoningProvider: providerId };
    });
    setModelRouterStatusMessage(`${MODEL_PROVIDER_LABELS[providerId]} is now preferred for ${taskType}.`);
  }

  function updateModelRouterConfig(patch: Partial<ModelRouterConfig>) {
    setModelRouterConfig((current) => mergeModelRouterConfig({ ...current, ...patch }));
  }

  function rememberModelProviderUsage(record: Omit<ModelProviderUsageRecord, "id" | "createdAt">) {
    setModelProviderUsage((current) => [
      {
        ...record,
        id: `model-usage-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ].slice(0, 80));
  }

  function classifyModelTask(prompt: string): ModelTaskType {
    const normalized = prompt.toLowerCase();
    if (
      /\b(code|coding|repo|github|codex|debug|bug|typescript|rust|backend|frontend|api|database|schema|test|architecture)\b/.test(
        normalized,
      )
    ) {
      return "coding";
    }
    if (/\b(reason|plan|compare|decide|analyze|strategy|architecture|think through)\b/.test(normalized)) {
      return "reasoning";
    }
    if (/\b(private|memory|personal|remember|preference|profile)\b/.test(normalized)) {
      return "private_memory";
    }
    if (/\b(draft|write|generate|rewrite|summarize)\b/.test(normalized)) {
      return "draft";
    }
    return "general_chat";
  }

  function isSensitiveModelPrompt(prompt: string, taskType: ModelTaskType) {
    const normalized = prompt.toLowerCase();
    return (
      taskType === "private_memory" ||
      /\b(private|personal|password|token|api key|secret|email|gmail|calendar|birthday|address|phone|bank|receipt|invoice|medical|health|resume|school id|student id)\b/.test(
        normalized,
      )
    );
  }

  function resolveModelRoute(prompt: string, requestedTaskType?: ModelTaskType): ModelRouteDecision {
    const taskType = requestedTaskType ?? classifyModelTask(prompt);
    const preferredProvider =
      taskType === "coding"
        ? modelRouterConfig.codingProvider
        : taskType === "reasoning"
        ? modelRouterConfig.reasoningProvider
        : taskType === "private_memory"
        ? modelRouterConfig.privateProvider
        : modelRouterConfig.defaultProvider;
    const providerId =
      taskType === "private_memory" && !modelRouterConfig.allowCloudForPrivateMemory
        ? modelRouterConfig.privateProvider
        : preferredProvider;
    const provider = modelRouterConfig.providers[providerId];
    const model =
      taskType === "coding"
        ? provider.codingModel || provider.chatModel
        : taskType === "reasoning"
        ? provider.reasoningModel || provider.chatModel
        : provider.chatModel || provider.reasoningModel || provider.codingModel;

    if (PAID_MODEL_PROVIDERS.has(providerId) && !modelRouterConfig.enablePaidProviders) {
      return {
        taskType,
        providerId,
        model,
        baseUrl: provider.baseUrl,
        blocked: true,
        reason: `${MODEL_PROVIDER_LABELS[providerId]} is paid and blocked because ENABLE_PAID_PROVIDERS is off.`,
      };
    }
    if (PAID_MODEL_PROVIDERS.has(providerId) && modelRouterConfig.maxMonthlyApiSpend <= 0) {
      return {
        taskType,
        providerId,
        model,
        baseUrl: provider.baseUrl,
        blocked: true,
        reason: `${MODEL_PROVIDER_LABELS[providerId]} is blocked by MAX_MONTHLY_API_SPEND=0.`,
      };
    }
    if (taskType === "private_memory" && CLOUD_MODEL_PROVIDERS.has(providerId) && !modelRouterConfig.allowCloudForPrivateMemory) {
      return {
        taskType,
        providerId,
        model,
        baseUrl: provider.baseUrl,
        blocked: true,
        reason: "Private memory-heavy requests are local-only unless cloud memory routing is explicitly enabled.",
      };
    }
    if (!OPENAI_COMPATIBLE_PROVIDER_IDS.has(providerId)) {
      return {
        taskType,
        providerId,
        model,
        baseUrl: provider.baseUrl,
        blocked: true,
        reason: `${MODEL_PROVIDER_LABELS[providerId]} is registered but its non-OpenAI-compatible adapter is not wired yet.`,
      };
    }
    if (!provider.baseUrl.trim()) {
      return {
        taskType,
        providerId,
        model,
        baseUrl: provider.baseUrl,
        blocked: true,
        reason: `${MODEL_PROVIDER_LABELS[providerId]} needs a base URL before JARVIS can call it.`,
      };
    }
    if (!model.trim()) {
      return {
        taskType,
        providerId,
        model,
        baseUrl: provider.baseUrl,
        blocked: true,
        reason: `${MODEL_PROVIDER_LABELS[providerId]} needs a model name before JARVIS can call it.`,
      };
    }
    if (CLOUD_MODEL_PROVIDERS.has(providerId) && !modelProviderKeyStatus[providerId]) {
      return {
        taskType,
        providerId,
        model,
        baseUrl: provider.baseUrl,
        blocked: true,
        reason: `${MODEL_PROVIDER_LABELS[providerId]} needs an API key first.`,
      };
    }

    return {
      taskType,
      providerId,
      model,
      baseUrl: provider.baseUrl,
      blocked: false,
      reason:
        taskType === "coding" || taskType === "reasoning"
          ? `${MODEL_PROVIDER_LABELS[providerId]} selected for ${taskType}.`
          : `${MODEL_PROVIDER_LABELS[providerId]} selected with zero-cost guardrails active.`,
    };
  }

  function buildNaturalGenerationSystemPrompt(taskType: ModelTaskType) {
    const contextLines = [
      activeConversationContext ? `Active context: ${activeConversationContext.label}.` : null,
      lastConversationTopic ? `Recent topic: ${lastConversationTopic.intentLabel}.` : null,
      userPreferenceMemory.musicProvider ? `Music preference: ${userPreferenceMemory.musicProvider}.` : null,
      userPreferenceMemory.defaultWorkspaceName ? `Default workspace: ${userPreferenceMemory.defaultWorkspaceName}.` : null,
    ].filter(Boolean);
    return [
      "You are JARVIS, a local-first personal assistant.",
      "Speak naturally, clearly, and directly.",
      "Do not claim you saved, sent, ran, or changed anything. Return draft text only.",
      taskType === "coding"
        ? "For coding requests, be implementation-focused and practical."
        : "For daily assistant requests, be helpful without overexplaining.",
      ...contextLines,
    ].join("\n");
  }

  async function callConfiguredModel(prompt: string, requestedTaskType?: ModelTaskType) {
    const route = resolveModelRoute(prompt, requestedTaskType);
    if (route.blocked) {
      throw new Error(route.reason);
    }

    return callModelProviderChat({
      providerId: route.providerId,
      baseUrl: route.baseUrl,
      apiKey: null,
      model: route.model,
      temperature: route.taskType === "coding" ? 0.25 : 0.45,
      maxTokens: route.taskType === "coding" || route.taskType === "reasoning" ? 1800 : 900,
      messages: [
        { role: "system", content: buildNaturalGenerationSystemPrompt(route.taskType) },
        ...conversationTurns.slice(-6).map((turn) => ({
          role: turn.role === "user" ? ("user" as const) : ("assistant" as const),
          content: turn.text,
        })),
        { role: "user", content: prompt },
      ],
    });
  }

  async function handleTestModelProvider(providerId: ModelProviderId) {
    setIsTestingModelRouter(true);
    const prompt = `Reply with one short sentence confirming ${MODEL_PROVIDER_LABELS[providerId]} is reachable.`;
    const provider = modelRouterConfig.providers[providerId];
    const taskType: ModelTaskType =
      providerId === modelRouterConfig.codingProvider ? "coding" : "general_chat";
    try {
      const route = resolveModelRoute(prompt, taskType);
      const requestedProviderRoute =
        route.providerId === providerId
          ? route
          : {
              ...route,
              providerId,
              baseUrl: provider.baseUrl,
              model: provider.chatModel || provider.codingModel || provider.reasoningModel,
              blocked: false,
              reason: `Testing ${MODEL_PROVIDER_LABELS[providerId]}.`,
            };
      if (PAID_MODEL_PROVIDERS.has(providerId) && !modelRouterConfig.enablePaidProviders) {
        throw new Error(`${MODEL_PROVIDER_LABELS[providerId]} is blocked because paid providers are disabled.`);
      }
      if (!OPENAI_COMPATIBLE_PROVIDER_IDS.has(providerId)) {
        throw new Error(`${MODEL_PROVIDER_LABELS[providerId]} is registered, but its direct adapter is not wired yet.`);
      }
      if (!requestedProviderRoute.baseUrl.trim() || !requestedProviderRoute.model.trim()) {
        throw new Error(`${MODEL_PROVIDER_LABELS[providerId]} needs a base URL and model name first.`);
      }
      if (CLOUD_MODEL_PROVIDERS.has(providerId) && !modelProviderKeyStatus[providerId]) {
        throw new Error(`${MODEL_PROVIDER_LABELS[providerId]} needs an API key first.`);
      }
      const response = await callModelProviderChat({
        providerId,
        baseUrl: requestedProviderRoute.baseUrl,
        apiKey: null,
        model: requestedProviderRoute.model,
        temperature: 0.1,
        maxTokens: 120,
        messages: [
          { role: "system", content: "You are a model health checker. Reply briefly." },
          { role: "user", content: prompt },
        ],
      });
      const result: ModelRouterTestResult = {
        providerId,
        model: requestedProviderRoute.model,
        ok: true,
        message: response.text,
        latencyMs: response.latencyMs,
        checkedAt: new Date().toISOString(),
      };
      setModelRouterTestResult(result);
      setModelRouterStatusMessage(`${MODEL_PROVIDER_LABELS[providerId]} replied in ${response.latencyMs}ms.`);
      setCommandResult({
        title: "Model provider reachable",
        detail: `${MODEL_PROVIDER_LABELS[providerId]} (${requestedProviderRoute.model}) replied: ${response.text}`,
      });
      rememberModelProviderUsage({
        providerId,
        model: requestedProviderRoute.model,
        taskType,
        prompt,
        ok: true,
        latencyMs: response.latencyMs,
        totalTokens: response.totalTokens,
      });
    } catch (error) {
      const message = getErrorDetail(error, `${MODEL_PROVIDER_LABELS[providerId]} test failed.`);
      const result: ModelRouterTestResult = {
        providerId,
        model: provider.chatModel || provider.codingModel || provider.reasoningModel || "not set",
        ok: false,
        message,
        checkedAt: new Date().toISOString(),
      };
      setModelRouterTestResult(result);
      setModelRouterStatusMessage(result.message);
      setCommandResult({ title: "Model provider test failed", detail: result.message });
      rememberModelProviderUsage({
        providerId,
        model: result.model,
        taskType,
        prompt,
        ok: false,
        latencyMs: null,
        totalTokens: null,
        errorMessage: message,
      });
    } finally {
      setIsTestingModelRouter(false);
    }
  }

  async function generateSafeModelDraft(prompt: string, taskType?: ModelTaskType) {
    setIsGeneratingModelDraft(true);
    try {
      const route = resolveModelRoute(prompt, taskType);
      const response = await callConfiguredModel(prompt, route.taskType);
      const draft: GeneratedModelDraft = {
        id: `draft-${Date.now()}`,
        prompt,
        taskType: route.taskType,
        providerId: route.providerId,
        model: route.model,
        text: response.text,
        latencyMs: response.latencyMs,
        createdAt: new Date().toISOString(),
      };
      setLatestGeneratedDraft(draft);
      revealModelText(response.text);
      setModelRouterStatusMessage(
        `Draft generated with ${MODEL_PROVIDER_LABELS[route.providerId]} in ${response.latencyMs}ms. It was not saved or sent.`,
      );
      setCommandResult({
        title: "Draft generated",
        detail: `${response.text}\n\nProvider: ${MODEL_PROVIDER_LABELS[route.providerId]} | Model: ${route.model} | Nothing was saved, sent, or run.`,
        routeLabel: `Model Router -> ${MODEL_PROVIDER_LABELS[route.providerId]}`,
      });
      rememberModelProviderUsage({
        providerId: route.providerId,
        model: route.model,
        taskType: route.taskType,
        prompt,
        ok: true,
        latencyMs: response.latencyMs,
        totalTokens: response.totalTokens,
      });
      appendConversationTurn("jarvis", "I generated a draft only. I did not save, send, or run it.");
      speakIfEnabled("I generated a draft only. I did not save, send, or run it.");
      return draft;
    } catch (error) {
      const route = resolveModelRoute(prompt, taskType);
      rememberModelProviderUsage({
        providerId: route.providerId,
        model: route.model || "not set",
        taskType: route.taskType,
        prompt,
        ok: false,
        latencyMs: null,
        totalTokens: null,
        errorMessage: getErrorDetail(error, "Model draft generation failed."),
      });
      throw error;
    } finally {
      setIsGeneratingModelDraft(false);
    }
  }

  async function runModelBenchmark() {
    setIsBenchmarkingModels(true);
    const benchmarkPrompt = "Reply with exactly: benchmark ok";
    const providerIds = Array.from(
      new Set<ModelProviderId>([
        modelRouterConfig.defaultProvider,
        modelRouterConfig.codingProvider,
        modelRouterConfig.reasoningProvider,
        "gemini",
        "groq",
        "openrouter",
      ]),
    );
    const results: ModelBenchmarkResult[] = [];

    for (const providerId of providerIds) {
      const provider = modelRouterConfig.providers[providerId];
      const model = provider.chatModel || provider.codingModel || provider.reasoningModel;
      try {
        if (PAID_MODEL_PROVIDERS.has(providerId) && !modelRouterConfig.enablePaidProviders) {
          throw new Error("Paid provider blocked.");
        }
        if (!OPENAI_COMPATIBLE_PROVIDER_IDS.has(providerId)) {
          throw new Error("Adapter not wired yet.");
        }
        if (!provider.baseUrl.trim() || !model.trim()) {
          throw new Error("Missing base URL or model.");
        }
        if (CLOUD_MODEL_PROVIDERS.has(providerId) && !modelProviderKeyStatus[providerId]) {
          throw new Error("Missing API key.");
        }
        const response = await callModelProviderChat({
          providerId,
          baseUrl: provider.baseUrl,
          apiKey: null,
          model,
          temperature: 0,
          maxTokens: 40,
          messages: [
            { role: "system", content: "You are a benchmark probe. Follow the user exactly." },
            { role: "user", content: benchmarkPrompt },
          ],
        });
        results.push({
          id: `benchmark-${Date.now()}-${providerId}`,
          providerId,
          model,
          ok: true,
          latencyMs: response.latencyMs,
          message: response.text,
          checkedAt: new Date().toISOString(),
        });
        rememberModelProviderUsage({
          providerId,
          model,
          taskType: "general_chat",
          prompt: benchmarkPrompt,
          ok: true,
          latencyMs: response.latencyMs,
          totalTokens: response.totalTokens,
        });
      } catch (error) {
        const message = getErrorDetail(error, `${MODEL_PROVIDER_LABELS[providerId]} benchmark failed.`);
        results.push({
          id: `benchmark-${Date.now()}-${providerId}`,
          providerId,
          model: model || "not set",
          ok: false,
          latencyMs: null,
          message,
          checkedAt: new Date().toISOString(),
        });
        rememberModelProviderUsage({
          providerId,
          model: model || "not set",
          taskType: "general_chat",
          prompt: benchmarkPrompt,
          ok: false,
          latencyMs: null,
          totalTokens: null,
          errorMessage: message,
        });
      }
    }

    setModelBenchmarkResults(results);
    setModelRouterStatusMessage(`Benchmark finished: ${results.filter((result) => result.ok).length}/${results.length} providers reachable.`);
    setCommandResult({
      title: "Model benchmark finished",
      detail: results
        .map((result) =>
          `${MODEL_PROVIDER_LABELS[result.providerId]}: ${result.ok ? `${result.latencyMs}ms` : result.message}`,
        )
        .join(" | "),
    });
    setIsBenchmarkingModels(false);
  }

  async function compareModelResponses(prompt: string) {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      throw new Error("Enter a prompt before comparing models.");
    }
    setIsComparingModels(true);
    const taskType = classifyModelTask(trimmedPrompt);
    const providerIds = Array.from(
      new Set<ModelProviderId>([
        modelRouterConfig.defaultProvider,
        modelRouterConfig.codingProvider,
        modelRouterConfig.reasoningProvider,
        "local_ollama",
        "gemini",
        "groq",
        "openrouter",
      ]),
    ).slice(0, 5);
    const results: ModelComparisonResult[] = [];

    for (const providerId of providerIds) {
      const provider = modelRouterConfig.providers[providerId];
      const model =
        taskType === "coding"
          ? provider.codingModel || provider.chatModel
          : taskType === "reasoning"
          ? provider.reasoningModel || provider.chatModel
          : provider.chatModel || provider.reasoningModel || provider.codingModel;
      try {
        if (PAID_MODEL_PROVIDERS.has(providerId) && !modelRouterConfig.enablePaidProviders) {
          throw new Error("Paid provider blocked.");
        }
        if (!OPENAI_COMPATIBLE_PROVIDER_IDS.has(providerId)) {
          throw new Error("Adapter not wired yet.");
        }
        if (!provider.baseUrl.trim() || !model.trim()) {
          throw new Error("Missing base URL or model.");
        }
        if (CLOUD_MODEL_PROVIDERS.has(providerId) && !modelProviderKeyStatus[providerId]) {
          throw new Error("Missing API key.");
        }
        if (
          CLOUD_MODEL_PROVIDERS.has(providerId) &&
          isSensitiveModelPrompt(trimmedPrompt, taskType) &&
          !modelRouterConfig.allowCloudForPrivateMemory
        ) {
          throw new Error("Skipped cloud for sensitive prompt. Enable cloud private mode to compare it.");
        }
        const response = await callModelProviderChat({
          providerId,
          baseUrl: provider.baseUrl,
          apiKey: null,
          model,
          temperature: 0.35,
          maxTokens: 500,
          messages: [
            { role: "system", content: buildNaturalGenerationSystemPrompt(taskType) },
            { role: "user", content: trimmedPrompt },
          ],
        });
        results.push({
          id: `model-compare-${Date.now()}-${providerId}`,
          providerId,
          model,
          ok: true,
          text: response.text,
          latencyMs: response.latencyMs,
        });
        setModelComparisonRun({
          prompt: trimmedPrompt,
          taskType,
          createdAt: new Date().toISOString(),
          results: [...results],
        });
        rememberModelProviderUsage({
          providerId,
          model,
          taskType,
          prompt: trimmedPrompt,
          ok: true,
          latencyMs: response.latencyMs,
          totalTokens: response.totalTokens,
        });
      } catch (error) {
        const message = getErrorDetail(error, `${MODEL_PROVIDER_LABELS[providerId]} comparison failed.`);
        results.push({
          id: `model-compare-${Date.now()}-${providerId}`,
          providerId,
          model: model || "not set",
          ok: false,
          text: "",
          latencyMs: null,
          errorMessage: message,
        });
        setModelComparisonRun({
          prompt: trimmedPrompt,
          taskType,
          createdAt: new Date().toISOString(),
          results: [...results],
        });
        rememberModelProviderUsage({
          providerId,
          model: model || "not set",
          taskType,
          prompt: trimmedPrompt,
          ok: false,
          latencyMs: null,
          totalTokens: null,
          errorMessage: message,
        });
      }
    }

    setModelComparisonRun({
      prompt: trimmedPrompt,
      taskType,
      createdAt: new Date().toISOString(),
      results,
    });
    setModelRouterStatusMessage(`Compared ${results.length} model route${results.length === 1 ? "" : "s"}.`);
    setCommandResult({
      title: "Model comparison ready",
      detail: results
        .map((result) =>
          `${MODEL_PROVIDER_LABELS[result.providerId]}: ${result.ok ? `${result.latencyMs}ms` : result.errorMessage}`,
        )
        .join(" | "),
      routeLabel: "Model Router",
    });
    setIsComparingModels(false);
  }

  function chooseModelComparisonWinner(providerId: ModelProviderId, taskType?: ModelTaskType) {
    const comparisonTaskType = taskType ?? modelComparisonRun?.taskType ?? "general_chat";
    const winner = modelComparisonRun?.results.find((result) => result.providerId === providerId && result.ok);
    if (modelComparisonRun && !winner) {
      throw new Error(`${MODEL_PROVIDER_LABELS[providerId]} did not have a successful result in the latest comparison.`);
    }
    const preference =
      comparisonTaskType === "coding"
        ? "coding"
        : comparisonTaskType === "reasoning"
        ? "reasoning"
        : "chat";
    setPreferredModelProvider(preference, providerId);
    setCommandResult({
      title: "Model winner selected",
      detail: `${MODEL_PROVIDER_LABELS[providerId]} is now preferred for ${preference}.`,
    });
    setStatusMessage(`${MODEL_PROVIDER_LABELS[providerId]} selected as model winner.`);
  }

  function recommendModelRoutesFromHistory() {
    const usableStats = new Map<
      ModelProviderId,
      { ok: number; failed: number; latencyTotal: number; latencyCount: number }
    >();
    for (const providerId of Object.keys(MODEL_PROVIDER_LABELS) as ModelProviderId[]) {
      usableStats.set(providerId, { ok: 0, failed: 0, latencyTotal: 0, latencyCount: 0 });
    }

    for (const result of modelBenchmarkResults) {
      const stats = usableStats.get(result.providerId);
      if (!stats) {
        continue;
      }
      if (result.ok) {
        stats.ok += 2;
      } else {
        stats.failed += 2;
      }
      if (result.latencyMs) {
        stats.latencyTotal += result.latencyMs;
        stats.latencyCount += 1;
      }
    }

    for (const usage of modelProviderUsage.slice(0, 30)) {
      const stats = usableStats.get(usage.providerId);
      if (!stats) {
        continue;
      }
      if (usage.ok) {
        stats.ok += 1;
      } else {
        stats.failed += 1;
      }
      if (usage.latencyMs) {
        stats.latencyTotal += usage.latencyMs;
        stats.latencyCount += 1;
      }
    }

    const scoreProvider = (providerId: ModelProviderId, taskType: "chat" | "coding" | "reasoning") => {
      const provider = modelRouterConfig.providers[providerId];
      const model =
        taskType === "coding"
          ? provider.codingModel || provider.chatModel
          : taskType === "reasoning"
          ? provider.reasoningModel || provider.chatModel
          : provider.chatModel || provider.reasoningModel || provider.codingModel;
      if (!model || !provider.baseUrl) {
        return -1000;
      }
      if (PAID_MODEL_PROVIDERS.has(providerId) && !modelRouterConfig.enablePaidProviders) {
        return -1000;
      }
      if (CLOUD_MODEL_PROVIDERS.has(providerId) && !modelProviderKeyStatus[providerId]) {
        return -200;
      }
      const stats = usableStats.get(providerId) ?? { ok: 0, failed: 0, latencyTotal: 0, latencyCount: 0 };
      const avgLatency = stats.latencyCount > 0 ? stats.latencyTotal / stats.latencyCount : 3000;
      const localBonus = providerId === "local_ollama" || providerId === "lm_studio" ? 6 : 0;
      const taskBonus =
        taskType === "coding" && (providerId === "nvidia_nim" || providerId === "groq" || providerId === "openrouter")
          ? 5
          : taskType === "reasoning" && (providerId === "nvidia_nim" || providerId === "gemini" || providerId === "openrouter")
          ? 5
          : 0;
      return stats.ok * 12 - stats.failed * 10 - avgLatency / 500 + localBonus + taskBonus;
    };

    const pick = (taskType: "chat" | "coding" | "reasoning") =>
      (Object.keys(MODEL_PROVIDER_LABELS) as ModelProviderId[])
        .map((providerId) => ({ providerId, score: scoreProvider(providerId, taskType) }))
        .sort((a, b) => b.score - a.score)[0];

    const chat = pick("chat");
    const coding = pick("coding");
    const reasoning = pick("reasoning");

    setModelRouterConfig((current) => ({
      ...current,
      defaultProvider: chat.providerId,
      codingProvider: coding.providerId,
      reasoningProvider: reasoning.providerId,
    }));
    setModelRouterStatusMessage(
      `Recommended routes applied: chat ${MODEL_PROVIDER_LABELS[chat.providerId]}, coding ${MODEL_PROVIDER_LABELS[coding.providerId]}, reasoning ${MODEL_PROVIDER_LABELS[reasoning.providerId]}.`,
    );
    setCommandResult({
      title: "Model routes recommended",
      detail: `Chat: ${MODEL_PROVIDER_LABELS[chat.providerId]} | Coding: ${MODEL_PROVIDER_LABELS[coding.providerId]} | Reasoning: ${MODEL_PROVIDER_LABELS[reasoning.providerId]}. Run a benchmark first for stronger recommendations.`,
    });
  }

  async function continuePendingWorkflowExecution(
    execution: PendingWorkflowExecution,
    providedValue: string,
  ) {
    const savedWorkflow = savedWorkflows.find((workflow) => workflow.id === execution.workflowId);
    if (!savedWorkflow) {
      setPendingWorkflowExecution(null);
      setCommandResult({
        title: "Workflow no longer available",
        detail: "That saved workflow could not be found anymore.",
      });
      return { status: "failed" as const };
    }

    const resumedInputText =
      execution.missingPlaceholder === "input" ? providedValue.trim() : execution.inputText;
    setPendingWorkflowExecution(null);

    for (let index = execution.currentStepIndex; index < execution.rawSteps.length; index += 1) {
      const resolvedStep = resolveWorkflowConditionalStep(
        execution.rawSteps[index],
        activeConversationContext,
        recentEmails,
        recentFiles,
        recentNotes,
        plannerTasks,
      );

      if (resolvedStep.action === "skip") {
        continue;
      }

      if (resolvedStep.action === "stop") {
        setCommandResult({
          title: "Workflow stopped by condition",
          detail: `Stopped ${savedWorkflow.name} because one of its conditions chose a stop branch.`,
        });
        appendConversationTurn("jarvis", `Stopped the workflow ${savedWorkflow.name}.`);
        speakIfEnabled(`Stopped the workflow ${savedWorkflow.name}.`);
        return { status: "completed" as const };
      }

      const renderedStep = renderWorkflowStep(
        resolvedStep.step,
        activeConversationContext,
        resumedInputText,
      );

      if (renderedStep.missingPlaceholder) {
        setPendingWorkflowExecution({
          ...execution,
          inputText: resumedInputText,
          currentStepIndex: index,
          missingPlaceholder: renderedStep.missingPlaceholder as PendingWorkflowExecution["missingPlaceholder"],
        });
        setCommandResult({
          title: "Workflow needs more context",
          detail:
            renderedStep.missingPlaceholder === "input"
              ? `The workflow "${savedWorkflow.name}" still needs extra text after its trigger phrase.`
              : `The workflow "${savedWorkflow.name}" still needs a matching current context for {{${renderedStep.missingPlaceholder}}}.`,
        });
        appendConversationTurn(
          "jarvis",
          renderedStep.missingPlaceholder === "input"
            ? `I still need the text you want to use for ${savedWorkflow.name}.`
            : `I still need the right current context before I can continue ${savedWorkflow.name}.`,
        );
        speakIfEnabled(
          renderedStep.missingPlaceholder === "input"
            ? `I still need the text you want to use for ${savedWorkflow.name}.`
            : `I still need the right current context before I can continue ${savedWorkflow.name}.`,
        );
        return { status: "clarification" as const };
      }

      const outcome = await runCommand(renderedStep.step, {
        appendUserTurn: false,
        allowChaining: false,
      });
      if (outcome.status !== "completed") {
        setStatusMessage(`Saved workflow ${savedWorkflow.name} paused before completion.`);
        return outcome;
      }
    }

    setCommandResult({
      title: "Workflow completed",
      detail: `Finished saved workflow "${savedWorkflow.name}".`,
    });
    appendConversationTurn("jarvis", `Finished the workflow ${savedWorkflow.name}.`);
    speakIfEnabled(`Finished the workflow ${savedWorkflow.name}.`);
    return { status: "completed" as const };
  }

  async function loadGoogleCalendarStatus() {
    try {
      const status = await getGoogleCalendarStatus();
      setGoogleCalendarStatus(status);
      setGoogleCalendarClientId(status.clientId ?? "");
      setGoogleCalendarApiKey(status.apiKey ?? "");
    } catch {
      setStatusMessage("Google Calendar status could not be loaded.");
    }
  }

  async function loadNotionStatus() {
    try {
      const status = await getNotionStatus();
      setNotionStatus(status);
      setNotionDatabaseId(status.databaseId ?? "");
    } catch {
      setStatusMessage("Notion status could not be loaded.");
    }
  }

  async function loadSpotifyStatus() {
    try {
      const status = await getSpotifyStatus();
      setSpotifyStatus(status);
      setSpotifyClientId(status.clientId ?? "");
    } catch {
      setStatusMessage("Spotify status could not be loaded.");
    }
  }

  async function loadRecentNotes() {
    try {
      const notes = await listNotionNotes();
      setRecentNotes(notes);
      setPlannerTasks(notes.map(parseTaskNoteRecord).filter(Boolean) as PlannerTaskRecord[]);
    } catch {
      setRecentNotes([]);
      setPlannerTasks([]);
    }
  }

  async function loadPlannerTaskRecords() {
    const taskNotes = await searchNotionNotes("Task:");
    const parsedTasks = taskNotes
      .map(parseTaskNoteRecord)
      .filter(Boolean) as PlannerTaskRecord[];
    setPlannerTasks(parsedTasks);
    setRecentNotes(taskNotes);
    return parsedTasks;
  }

  async function loadRecentFiles() {
    try {
      const files = await listRecentLocalFiles();
      setRecentFiles(files);
    } catch {
      setRecentFiles([]);
    }
  }

  async function loadOllamaStatus() {
    try {
      const status = await getOllamaStatus();
      setOllamaStatus(status);
      setOllamaBaseUrl(status.baseUrl ?? "http://127.0.0.1:11434");
      setOllamaModelName(status.modelName ?? "");
    } catch {
      setStatusMessage("Ollama status could not be loaded.");
    }
  }

  async function loadExecutorStatus() {
    try {
      const status = await getExecutorStatus();
      setExecutorStatus(status);
      setExecutorCommandPath(status.commandPath ?? "");
      setExecutorWorkingDirectory(status.workingDirectory ?? "");
    } catch {
      setStatusMessage("Executor bridge status could not be loaded.");
    }
  }

  async function handleGenerateProposal() {
    setIsGeneratingProposal(true);

    try {
      const generatedProposal = await generateLearningProposal();
      if (generatedProposal) {
        setCommandResult({
          title: "Draft proposal created",
          detail:
            "JARVIS observed repeated study behavior and drafted a routine for your review.",
        });
        speakIfEnabled("I drafted a new study routine for your review.");
      } else {
        setCommandResult({
          title: "Not enough history yet",
          detail:
            "Run the study setup a few times first so JARVIS has enough evidence to draft a suggestion.",
        });
        speakIfEnabled("I need a little more history before I can draft a routine.");
      }

      await loadMemoryView();
    } catch {
      setCommandResult({
        title: "Proposal generation failed",
        detail: "JARVIS could not create a learning proposal from the current history.",
      });
      speakIfEnabled("I could not generate a learning proposal right now.");
    } finally {
      setIsGeneratingProposal(false);
    }
  }

  async function handleProposalDecision(
    proposalId: number,
    decision: "approve" | "reject",
  ) {
    try {
      if (decision === "approve") {
        await approveLearningProposal(proposalId);
        speakIfEnabled("Proposal approved. The routine is now live.");
      } else {
        await rejectLearningProposal(proposalId);
        speakIfEnabled("Proposal rejected. I will keep learning from future activity.");
      }

      await loadMemoryView();
    } catch {
      setCommandResult({
        title: "Review action failed",
        detail: "JARVIS could not update that proposal status.",
      });
      speakIfEnabled("I could not update that proposal.");
    }
  }

  function handleProposalFieldChange(
    proposalId: number,
    field: "name" | "description" | "triggerPhrase",
    value: string,
  ) {
    setProposals((current) =>
      current.map((proposal) =>
        proposal.id === proposalId ? { ...proposal, [field]: value } : proposal,
      ),
    );
  }

  function handleProposalStepChange(
    proposalId: number,
    stepId: number,
    value: string,
  ) {
    setProposalSteps((current) => ({
      ...current,
      [proposalId]: (current[proposalId] ?? []).map((step) =>
        step.id === stepId ? { ...step, actionValue: value } : step,
      ),
    }));
  }

  async function handleSaveProposalEdits(proposalId: number) {
    const proposal = proposals.find((entry) => entry.id === proposalId);
    const steps = proposalSteps[proposalId];

    if (!proposal || !steps) {
      return;
    }

    try {
      await updateLearningProposal({
        id: proposal.id,
        name: proposal.name,
        description: proposal.description,
        triggerPhrase: proposal.triggerPhrase,
        steps,
      });
      setEditingProposalId(null);
      await loadMemoryView();
      await loadProposalSteps(proposalId);
      speakIfEnabled("Draft updated.");
    } catch {
      setCommandResult({
        title: "Could not save proposal edits",
        detail: "JARVIS could not update that draft proposal.",
      });
      speakIfEnabled("I could not save those proposal edits.");
    }
  }

  function speakIfEnabled(text: string) {
    if (!voiceResponseEnabled) {
      return;
    }

    if (voiceReplyMode === "quiet") {
      return;
    }

    const spokenText =
      voiceReplyMode === "brief"
        ? text.split(/[.!?]/)[0]?.trim() || text
        : text;

    if (speechOutputBackend === "local") {
      void speakLocalText(spokenText).catch(() => {
        setStatusMessage(
          localSpeechStatus?.message ??
            "Local Piper speech output is not configured correctly yet.",
        );
      });
      return;
    }

    speakText(spokenText);
  }

  function applyVoiceCorrections(transcript: string) {
    const match = voiceCorrections.find(
      (correction) =>
        correction.heardPhrase.trim().toLowerCase() === transcript.trim().toLowerCase(),
    );

    return match ? match.correctedPhrase : transcript;
  }

  function handleVoiceStateChange(state: SpeechRecognitionState) {
    setVoiceState(state);

    if (state === "idle") {
      setVoiceSessionPhase((current) =>
        current === "processing"
          ? "ready"
          : current === "unsupported"
            ? "unsupported"
            : followUpWindow?.active
              ? "ready"
              : "idle",
      );
    }

    if (state === "unsupported") {
      setVoiceSessionPhase("unsupported");
    }

    if (state === "error") {
      setVoiceSessionPhase("error");
    }
  }

  async function handleSaveVoiceCorrection() {
    const heardPhrase = voiceTranscript.trim();
    const correctedPhrase = voiceCorrectionInput.trim();

    if (!heardPhrase || !correctedPhrase) {
      setCommandResult({
        title: "Correction incomplete",
        detail: "Record a voice transcript and enter the corrected version before saving.",
      });
      return;
    }

    try {
      await saveVoiceCorrectionEntry(heardPhrase, correctedPhrase);
      await loadVoiceCorrections();
      setVoiceTranscript(correctedPhrase);
      setInput(correctedPhrase);
      setVoiceCorrectionInput("");
      setCommandResult({
        title: "Voice correction saved",
        detail: `JARVIS will now map "${heardPhrase}" to "${correctedPhrase}".`,
      });
      speakIfEnabled("Voice correction saved.");
    } catch {
      setCommandResult({
        title: "Could not save voice correction",
        detail: "JARVIS could not store that correction yet.",
      });
      speakIfEnabled("I could not save that voice correction.");
    }
  }

  async function handleSaveLocalVoiceConfig() {
    try {
      const status = await saveLocalVoiceBackendPaths(localExecutablePath, localModelPath);
      setLocalVoiceStatus(status);
      setStatusMessage(status.message);
      setCommandResult({
        title: "Local voice config saved",
        detail: status.message,
      });
    } catch {
      setCommandResult({
        title: "Could not save local voice config",
        detail: "JARVIS could not update the whisper.cpp executable or model paths.",
      });
    }
  }

  async function handleSaveLocalSpeechConfig() {
    try {
      const status = await saveLocalSpeechOutputPaths(
        localTtsExecutablePath,
        localTtsModelPath,
      );
      setLocalSpeechStatus(status);
      setStatusMessage(status.message);
      setCommandResult({
        title: "Local speech config saved",
        detail: status.message,
      });
    } catch {
      setCommandResult({
        title: "Could not save local speech config",
        detail: "JARVIS could not update the Piper executable or voice model paths.",
      });
    }
  }

  async function handleSaveWakeMode() {
    try {
      const status = await saveWakeModeStatus(assistantName, wakeModeEnabled);
      setWakeModeStatus(status);
      setAssistantName(status.assistantName);
      setWakeModeEnabled(status.wakeModeEnabled);
      setStatusMessage(status.message);
      setCommandResult({
        title: "Wake mode settings saved",
        detail: status.message,
      });
    } catch {
      setCommandResult({
        title: "Could not save wake mode settings",
        detail: "JARVIS could not update the wake mode configuration.",
      });
    }
  }

  async function handleSaveOllamaConfig() {
    try {
      const status = await saveOllamaStatus(ollamaBaseUrl, ollamaModelName);
      setOllamaStatus(status);
      setStatusMessage(status.message);
      setCommandResult({
        title: "Ollama config saved",
        detail: status.message,
      });
    } catch {
      setCommandResult({
        title: "Could not save Ollama config",
        detail: "JARVIS could not update the Ollama conversation settings.",
      });
    }
  }

  async function handleSaveGoogleCalendarConfig() {
    try {
      const status = await saveGoogleCalendarStatus(
        googleCalendarClientId,
        googleCalendarApiKey,
      );
      setGoogleCalendarStatus(status);
      setStatusMessage(status.message);
      setCommandResult({
        title: "Google Calendar config saved",
        detail: status.message,
      });
    } catch {
      setCommandResult({
        title: "Could not save Google Calendar config",
        detail: "JARVIS could not update the Google Calendar API settings.",
      });
    }
  }

  async function handleConnectGoogleCalendar() {
    if (!googleCalendarStatus?.configured || !googleCalendarClientId.trim()) {
      setCommandResult({
        title: "Google Calendar not configured",
        detail: "Save your Google Calendar client ID and API key first.",
      });
      return;
    }

    try {
      setStatusMessage("Opening Google Calendar sign-in...");
      setCommandResult({
        title: "Google Calendar sign-in",
        detail: "JARVIS is redirecting this app through Google sign-in and will return here after consent.",
      });
      beginGoogleRedirectAuthorization(
        googleCalendarClientId.trim(),
        "calendar",
        "https://www.googleapis.com/auth/calendar.events.owned",
      );
    } catch (error) {
      setCommandResult({
        title: "Google Calendar connection failed",
        detail: getErrorDetail(
          error,
          "JARVIS could not connect to Google Calendar right now.",
        ),
      });
    }
  }

  async function handleConnectGmail() {
    if (!googleCalendarStatus?.configured || !googleCalendarClientId.trim()) {
      setCommandResult({
        title: "Google account not configured",
        detail: "Save your Google client ID and API key first, then connect Gmail.",
      });
      return;
    }

    try {
      setStatusMessage("Opening Gmail sign-in...");
      setCommandResult({
        title: "Gmail sign-in",
        detail: "JARVIS is redirecting this app through Google sign-in and will return here after consent.",
      });
      requestGmailAccessToken(googleCalendarClientId.trim());
    } catch (error) {
      const detail = getErrorDetail(
        error,
        "JARVIS could not connect to Gmail right now.",
      );
      setCommandResult({
        title: "Gmail connection failed",
        detail,
      });
    }
  }

  async function handleSaveNotionConfig() {
    try {
      const status = await saveNotionStatus(notionTokenInput, notionDatabaseId);
      setNotionStatus(status);
      setNotionTokenInput("");
      setStatusMessage(status.message);
      setCommandResult({
        title: "Notion config saved",
        detail: status.hasToken
          ? `The Notion token is saved locally and hidden from the input for safety. ${status.message}`
          : status.message,
      });
      await loadRecentNotes();
    } catch {
      setCommandResult({
        title: "Could not save Notion config",
        detail: "JARVIS could not update the Notion notes settings.",
      });
    }
  }

  async function handleSaveSpotifyConfig() {
    try {
      const status = await saveSpotifyStatus(spotifyClientId);
      setSpotifyStatus(status);
      setStatusMessage(status.message);
      setCommandResult({
        title: "Spotify config saved",
        detail: status.message,
      });
    } catch {
      setCommandResult({
        title: "Could not save Spotify config",
        detail: "JARVIS could not update the Spotify app settings.",
      });
    }
  }

  async function handleConnectSpotify() {
    if (!spotifyStatus?.configured || !spotifyClientId.trim()) {
      setCommandResult({
        title: "Spotify not configured",
        detail: "Save your Spotify client ID first.",
      });
      return;
    }

    await beginSpotifyAuthorization(spotifyClientId.trim());
  }

  async function refreshSpotifyPlayback(accessToken: string) {
    const playback = await getSpotifyPlaybackState(accessToken);
    setSpotifyPlaybackState(playback);
    return playback;
  }

  async function handleSaveExecutorConfig() {
    try {
      const status = await saveExecutorStatus(
        executorCommandPath,
        executorWorkingDirectory,
      );
      setExecutorStatus(status);
      setStatusMessage(status.message);
      setCommandResult({
        title: "Executor bridge saved",
        detail: status.message,
      });
    } catch {
      setCommandResult({
        title: "Could not save executor bridge",
        detail: "JARVIS could not update the local coding executor settings.",
      });
    }
  }

  async function handleAskAdvancedAssistant(requestOverride?: string) {
    const requestToPlan = requestOverride ?? missingSkillRequest;
    if (!requestToPlan) {
      return;
    }

    setIsGeneratingMissingSkillPlan(true);
    setAutonomousBuildStatus("planning");

    try {
      const plan = await generateMissingSkillPlanWithOllama(
        requestToPlan,
        assistantName,
      );
      setMissingSkillPlan(plan);
      setCommandResult({
        title: "Advanced assistant drafted a plan",
        detail: `JARVIS asked the advanced assistant for help with "${requestToPlan}". Review the suggested skill plan below before doing anything else.`,
      });
      appendConversationTurn(
        "jarvis",
        `I asked the advanced assistant for help. It suggested a skill called ${plan.skillName}.`,
      );
      speakIfEnabled(`I drafted a plan for a new skill called ${plan.skillName}.`);

      if (skillAutopilotAvailable && autonomousSkillBuildingEnabled) {
        const nextImplementationRequest = createImplementationRequest(plan, requestToPlan);
        const nextBuildRequest = createBuildRequest(nextImplementationRequest);
        setImplementationRequest(nextImplementationRequest);
        setBuildRequest(nextBuildRequest);
        setAutonomousBuildStatus("build_request_ready");
        await handleCreateHandoffArtifact(nextBuildRequest);
      }
    } catch (error) {
      const detail = getErrorDetail(
        error,
        "JARVIS could not get a missing-skill plan from the advanced assistant right now.",
      );
      setAutonomousBuildStatus("manual_required");
      setCommandResult({
        title: "Advanced assistant unavailable",
        detail,
      });
      appendConversationTurn(
        "jarvis",
        `I tried to ask the advanced assistant for a missing-skill plan, but it failed: ${detail}`,
      );
      speakIfEnabled("I could not get the advanced assistant plan right now.");
    } finally {
      setIsGeneratingMissingSkillPlan(false);
    }
  }

  function createImplementationRequest(
    plan: MissingSkillPlan,
    originalRequest: string,
  ): SkillImplementationRequest {
    return {
      skillName: plan.skillName,
      originalRequest,
      summary: plan.summary,
      userValue: plan.userValue,
      buildSteps: plan.buildSteps,
      permissionsNeeded: plan.permissionsNeeded,
      approvedAt: new Date().toISOString(),
    };
  }

  function createBuildRequest(
    nextImplementationRequest: SkillImplementationRequest,
  ): SkillBuildRequest {
    return {
      skillName: nextImplementationRequest.skillName,
      title: `Implement ${nextImplementationRequest.skillName} for JARVIS`,
      prompt: [
        `Implement a new JARVIS skill named "${nextImplementationRequest.skillName}".`,
        `Original user request: ${nextImplementationRequest.originalRequest}`,
        `Goal: ${nextImplementationRequest.summary}`,
        `User value: ${nextImplementationRequest.userValue}`,
        "Required build steps:",
        ...nextImplementationRequest.buildSteps.map((step, index) => `${index + 1}. ${step}`),
        nextImplementationRequest.permissionsNeeded.length > 0
          ? `Permissions to review: ${nextImplementationRequest.permissionsNeeded.join(", ")}`
          : "Permissions to review: none listed yet.",
        "Keep the implementation aligned with JARVIS's existing memory, permission, conversation, and skill architecture.",
      ].join("\n"),
      safetyChecks: [
        "Do not auto-execute risky actions without user approval.",
        "Preserve local-first behavior where practical.",
        "Keep new actions behind the existing JARVIS planner and permission flow.",
      ],
      createdAt: new Date().toISOString(),
    };
  }

  function handleApproveSkillPlan() {
    if (!missingSkillPlan || !missingSkillRequest) {
      return;
    }

    const nextImplementationRequest = createImplementationRequest(
      missingSkillPlan,
      missingSkillRequest,
    );

    setImplementationRequest(nextImplementationRequest);
    setBuildRequest(null);
    setAutonomousBuildStatus("implementation_brief_ready");
    setCommandResult({
      title: "Skill plan approved for implementation",
      detail:
        "JARVIS converted the approved skill plan into a structured implementation brief. Review it below before building anything.",
    });
    appendConversationTurn(
      "jarvis",
      `I turned the approved ${missingSkillPlan.skillName} plan into an implementation brief.`,
    );
    speakIfEnabled(`I turned the ${missingSkillPlan.skillName} plan into an implementation brief.`);
  }

  function handleGenerateBuildRequest() {
    if (!implementationRequest) {
      return;
    }

    const nextBuildRequest = createBuildRequest(implementationRequest);

    setBuildRequest(nextBuildRequest);
    setAutonomousBuildStatus("build_request_ready");
    setCommandResult({
      title: "Build request created",
      detail:
        "JARVIS turned the implementation brief into a concrete coding-agent handoff request.",
    });
    appendConversationTurn(
      "jarvis",
      `I created a build request for ${implementationRequest.skillName}.`,
    );
    speakIfEnabled(`I created a build request for ${implementationRequest.skillName}.`);
  }

  async function handleCreateHandoffArtifact(request: SkillBuildRequest) {
    try {
      const artifact = await createBuildHandoffArtifact(request);
      setHandoffArtifact(artifact);
      setAutonomousBuildStatus("handoff_ready");
      setCommandResult({
        title: "Coding handoff package created",
        detail: artifact.message,
      });
      appendConversationTurn(
        "jarvis",
        `I created a coding handoff package for ${request.skillName}. Manual execution is the next boundary.`,
      );
      speakIfEnabled(
        `I created a coding handoff package for ${request.skillName}. Manual execution is the next boundary.`,
      );

      if (executorStatus?.configured && executorStatus.available) {
        try {
          const launchMessage = await launchExecutorHandoff(
            artifact.jsonPath,
            artifact.markdownPath,
          );
          setCommandResult({
            title: "Executor bridge launched",
            detail: launchMessage,
          });
          appendConversationTurn(
            "jarvis",
            "I handed the package to the local coding executor.",
          );
          speakIfEnabled("I handed the package to the local coding executor.");
        } catch {
          setAutonomousBuildStatus("manual_required");
          setCommandResult({
            title: "Executor bridge needs manual help",
            detail:
              "JARVIS created the handoff package, but the local coding executor did not launch successfully.",
          });
        }
      }
    } catch {
      setAutonomousBuildStatus("manual_required");
      setCommandResult({
        title: "Could not create coding handoff package",
        detail:
          "JARVIS prepared the build request, but it could not save the handoff files automatically.",
      });
      appendConversationTurn(
        "jarvis",
        "I prepared the build request, but I could not save the handoff files automatically.",
      );
      speakIfEnabled("I prepared the build request, but I could not save the handoff files.");
    }
  }

  function handleWakeActivation() {
    if (!wakeModeEnabled) {
      setCommandResult({
        title: "Wake mode is off",
        detail: `Enable wake mode first if you want ${assistantName} to stay armed for activation.`,
      });
      return;
    }

    setVoiceSessionPhase("awakened");
    setWakeCueActive(true);
    setStatusMessage(`${assistantName} is awake. Listening for your command now.`);
    openFollowUpWindow("wake");
    if (voiceBackend === "local") {
      speakIfEnabled(`${assistantName} is listening.`);
    }
    beginSelectedVoiceCapture();
    window.setTimeout(() => {
      setWakeCueActive(false);
    }, 1200);
  }

  async function handleSaveBrowserAlias() {
    const phrase = input
      .replace(/^open\s+/i, "")
      .replace(/^search\s+/i, "")
      .trim();
    const rawUrl = browserAliasUrl.trim();

    if (!phrase || !rawUrl) {
      setCommandResult({
        title: "Alias incomplete",
        detail: "Enter the corrected URL and keep the command text in the input before saving.",
      });
      return;
    }

    const url = canonicalizeBrowserUrl(rawUrl);

    try {
      await saveBrowserAliasEntry(phrase, url);
      await loadBrowserAliases();
      setBrowserAliasUrl("");
      setCommandResult({
        title: "Browser alias saved",
        detail: `JARVIS will now map "${phrase}" to "${url}".`,
      });
      speakIfEnabled("Browser alias saved.");
    } catch {
      setCommandResult({
        title: "Could not save browser alias",
        detail: "JARVIS could not store that browser correction yet.",
      });
    }
  }

  async function handleLocalVoiceToggle() {
    if (localRecorderRef.current) {
      setVoiceSessionPhase("processing");
      setStatusMessage("Transcribing local audio with whisper.cpp.");

      try {
        const audioBase64 = await localRecorderRef.current.stop();
        localRecorderRef.current = null;
        const transcript = await transcribeLocalAudio(audioBase64);
        const normalized = applyVoiceCorrections(transcript);
        setVoiceTranscript(normalized);
        setInput(normalized);

        if (shouldAutoRouteVoice) {
          setStatusMessage("Local voice transcript captured. Routing now.");
          triggerVoiceAutoRoute(normalized);
        } else {
          setVoiceSessionPhase("ready");
          setStatusMessage("Local voice transcript captured. Review or route it when ready.");
        }
      } catch (error) {
        localRecorderRef.current = null;
        setVoiceSessionPhase("error");
        setStatusMessage(
          error instanceof Error ? error.message : "Local voice transcription failed.",
        );
      }

      return;
    }

    if (!localVoiceStatus?.configured) {
      setVoiceSessionPhase("error");
      setStatusMessage(
        localVoiceStatus?.message ??
          "Local STT is selected, but the whisper.cpp backend is not configured yet.",
      );
      return;
    }

    try {
      localRecorderRef.current = await startLocalAudioRecorder();
      setVoiceTranscript("");
      setVoiceSessionPhase("listening");
      setStatusMessage("Recording local audio. Click again to stop and transcribe.");
    } catch (error) {
      setVoiceSessionPhase("error");
      setStatusMessage(
        error instanceof Error ? error.message : "Could not start local audio recording.",
      );
    }
  }

  function restartWakeListenerSoon() {
    clearWakeRestartTimeout();

    if (!shouldUseBrowserFollowUps() || followUpWindow?.active) {
      return;
    }

    wakeRestartTimeoutRef.current = window.setTimeout(() => {
      wakeRestartTimeoutRef.current = null;
      startBrowserWakeListener();
    }, 350);
  }

  function restartFollowUpListenerSoon() {
    if (!shouldUseBrowserFollowUps() || !followUpWindow?.active) {
      return;
    }

    window.setTimeout(() => {
      if (
        wakeModeEnabled &&
        voiceBackend === "browser" &&
        followUpWindow?.active &&
        !commandRecognitionRef.current &&
        !isRoutingCommand
      ) {
        startBrowserVoiceRecognition();
      }
    }, 450);
  }

  function startBrowserVoiceRecognition() {
    stopWakeListener();
    stopCommandListener();

    const recognition = createVoiceRecognition({
      onStateChange: handleVoiceStateChange,
      onTranscript: ({ transcript, isFinal }) => {
        const normalized = applyVoiceCorrections(transcript);
        setVoiceTranscript(normalized);
        setInput(normalized);

        if (isFinal) {
          setVoiceSessionPhase("processing");
          setStatusMessage(
            shouldAutoRouteVoice
              ? "Voice command captured. Routing now."
              : "Voice command captured. Review or route it when ready.",
          );
          if (shouldAutoRouteVoice) {
            triggerVoiceAutoRoute(normalized);
          }
        }
      },
      onError: (message) => {
        setStatusMessage(message);
      },
    });

    if (!recognition) {
      return;
    }

    recognition.onend = () => {
      commandRecognitionRef.current = null;
      handleVoiceStateChange("idle");
      if (followUpWindow?.active) {
        setStatusMessage("Still with you. Keep talking if you want to continue.");
        restartFollowUpListenerSoon();
      } else {
        restartWakeListenerSoon();
      }
    };

    commandRecognitionRef.current = recognition;
    setVoiceTranscript("");
    setVoiceState("listening");
    setVoiceSessionPhase("listening");
    recognition.start();
  }

  function startBrowserWakeListener() {
    if (!wakeModeEnabled || voiceBackend !== "browser" || commandRecognitionRef.current) {
      return;
    }

    if (wakeRecognitionRef.current) {
      return;
    }

    wakeTriggeredRef.current = false;

    const recognition = createVoiceRecognition(
      {
        onStateChange: (state) => {
          if (state === "error") {
            setVoiceState("error");
            setVoiceSessionPhase("error");
            setWakeListenerActive(false);
            return;
          }

          if (state === "idle" && wakeRecognitionRef.current) {
            setVoiceState("wake_listening");
            setVoiceSessionPhase("armed");
            return;
          }

          handleVoiceStateChange(state);
        },
        onTranscript: ({ transcript, isFinal }) => {
          if (wakeTriggeredRef.current) {
            return;
          }

          const wakeCommand = extractWakeCommand(transcript, assistantName);

          if (isFinal) {
            const wakeControlIntent = parseWakeControlIntent(transcript, browserAliases);
            if (wakeControlIntent) {
              wakeTriggeredRef.current = true;
              setVoiceTranscript(transcript.trim());
              stopWakeListener();
              void runCommand(cleanConversationalCommand(transcript));
              return;
            }

            if (wakeCommand) {
              wakeTriggeredRef.current = true;
              setVoiceTranscript(transcript.trim());
              stopWakeListener();
              void runCommand(wakeCommand);
              return;
            }
          }

          if (!wakeCommand && wakeTranscriptMatchesAssistant(transcript, assistantName)) {
            wakeTriggeredRef.current = true;
            setVoiceTranscript(transcript.trim());
            stopWakeListener();
            handleWakeActivation();
            return;
          }

          if (!isFinal) {
            setStatusMessage(`${assistantName} wake listener is armed. Say "${assistantName}" to start talking.`);
          }
        },
        onError: (message) => {
          setStatusMessage(message);
          setVoiceSessionPhase("error");
          setWakeListenerActive(false);
          wakeTriggeredRef.current = false;
        },
      },
      {
        continuous: true,
        interimResults: true,
      },
    );

    if (!recognition) {
      setStatusMessage(
        "Hands-free wake mode is not available in this browser recognizer environment yet.",
      );
      setVoiceSessionPhase("unsupported");
      return;
    }

    recognition.onend = () => {
      wakeRecognitionRef.current = null;
      setWakeListenerActive(false);
      wakeTriggeredRef.current = false;
      if (wakeModeEnabled && voiceBackend === "browser" && !commandRecognitionRef.current) {
        restartWakeListenerSoon();
      }
    };

    wakeRecognitionRef.current = recognition;
    setWakeListenerActive(true);
    setVoiceState("wake_listening");
    setVoiceSessionPhase("armed");
    setStatusMessage(`${assistantName} wake listener is armed. Say "${assistantName}" to start talking.`);
    recognition.start();
  }

  async function handleGroqVoiceToggle() {
    if (localRecorderRef.current) {
      setVoiceSessionPhase("processing");
      setStatusMessage("Transcribing audio with Groq Whisper.");

      try {
        const audioBase64 = await localRecorderRef.current.stop();
        localRecorderRef.current = null;
        const transcript = await transcribeGroqAudio(audioBase64);
        const normalized = applyVoiceCorrections(transcript);
        setVoiceTranscript(normalized);
        setInput(normalized);

        if (shouldAutoRouteVoice) {
          setStatusMessage("Groq voice transcript captured. Routing now.");
          triggerVoiceAutoRoute(normalized);
        } else {
          setVoiceSessionPhase("ready");
          setStatusMessage("Groq voice transcript captured. Review or route it when ready.");
        }
      } catch (error) {
        localRecorderRef.current = null;
        setVoiceSessionPhase("error");
        setStatusMessage(
          error instanceof Error ? error.message : "Groq voice transcription failed.",
        );
      }

      return;
    }

    try {
      localRecorderRef.current = await startLocalAudioRecorder();
      setVoiceTranscript("");
      setVoiceSessionPhase("listening");
      setStatusMessage("Recording audio for Groq transcription. Click again to stop.");
    } catch (error) {
      setVoiceSessionPhase("error");
      setStatusMessage(
        error instanceof Error ? error.message : "Could not start audio recording for Groq STT.",
      );
    }
  }

  function beginSelectedVoiceCapture() {
    if (voiceBackend === "local") {
      void handleLocalVoiceToggle();
      return;
    }
    if (voiceBackend === "groq") {
      void handleGroqVoiceToggle();
      return;
    }

    startBrowserVoiceRecognition();
  }

  function handleVoiceStart() {
    beginSelectedVoiceCapture();
  }

  useEffect(() => {
    void loadMemoryView();
    void loadVoiceCorrections();
    void loadLocalVoiceStatus();
    void loadLocalSpeechStatus();
    void loadWakeModeStatus();
    void loadBrowserAliases();
    void loadLearnedIntents();
    void loadGoogleCalendarStatus();
    void loadSpotifyStatus();
    void loadNotionStatus();
    void loadRecentNotes();
    void loadRecentFiles();
    void loadOllamaStatus();
    void loadExecutorStatus();
  }, []);

  useEffect(() => {
    const storedCalendarToken = getStoredGoogleAccessToken("calendar");
    const storedGmailToken = getStoredGoogleAccessToken("gmail");
    if (storedCalendarToken) {
      setGoogleCalendarAccessToken(storedCalendarToken);
    }
    if (storedGmailToken) {
      setGmailAccessToken(storedGmailToken);
    }
  }, []);

  useEffect(() => {
    try {
      const authResult = completeGoogleRedirectAuthorizationIfNeeded();
      if (!authResult) {
        return;
      }

      if (authResult.service === "calendar") {
        setGoogleCalendarAccessToken(authResult.accessToken);
        setStatusMessage("Google Calendar is connected for this session.");
        setCommandResult({
          title: "Google Calendar connected",
          detail: "JARVIS can now create events directly through the Calendar API.",
        });
      } else {
        setGmailAccessToken(authResult.accessToken);
        setStatusMessage("Gmail is connected for this session.");
        setCommandResult({
          title: "Gmail connected",
          detail: "JARVIS can now read unread messages and search your inbox.",
        });
        void listUnreadGmailMessages(authResult.accessToken)
          .then((messages) => setRecentEmails(messages))
          .catch(() => setRecentEmails([]));
      }
    } catch (error) {
      setCommandResult({
        title: "Google sign-in failed",
        detail: getErrorDetail(error, "Google sign-in could not be completed."),
      });
    }
  }, []);

  useEffect(() => {
    const storedToken = getStoredSpotifyAccessToken();
    if (storedToken) {
      setSpotifyAccessToken(storedToken);
      void refreshSpotifyPlayback(storedToken).catch(() => {
        setSpotifyPlaybackState(null);
      });
    }
  }, []);

  useEffect(() => {
    if (!spotifyClientId.trim()) {
      return;
    }

    void completeSpotifyAuthorizationIfNeeded(spotifyClientId.trim())
      .then((token) => {
        if (!token) {
          return;
        }

        setSpotifyAccessToken(token);
        setStatusMessage("Spotify is connected for this session.");
        setCommandResult({
          title: "Spotify connected",
          detail: "JARVIS can now control playback through the Spotify Web API.",
        });
        return refreshSpotifyPlayback(token);
      })
      .catch((error) => {
        setSpotifyAccessToken(null);
        setSpotifyPlaybackState(null);
        setCommandResult({
          title: "Spotify connection failed",
          detail: getErrorDetail(
            error,
            "JARVIS could not complete the Spotify sign-in flow right now.",
          ),
        });
      });
  }, [spotifyClientId]);

  useEffect(() => {
    const recognition = createVoiceRecognition(
      {
        onStateChange: () => {},
        onTranscript: () => {},
        onError: () => {},
      },
      {
        continuous: false,
        interimResults: false,
      },
    );

    if (!recognition && voiceBackend === "browser") {
      setStatusMessage(
        "Voice recognition is not available in this environment yet. The mic control stays disabled until we swap in a local engine.",
      );
      setVoiceSessionPhase("unsupported");
      return;
    }

    recognition?.stop();
  }, [voiceBackend]);

  useEffect(() => {
    if (!followUpWindow?.active || !shouldUseBrowserFollowUps()) {
      return;
    }

    if (commandRecognitionRef.current || isRoutingCommand) {
      return;
    }

    const timeout = window.setTimeout(() => {
      if (
        shouldUseBrowserFollowUps() &&
        followUpWindow?.active &&
        !commandRecognitionRef.current &&
        !isRoutingCommand
      ) {
        setStatusMessage("Follow-up window is open. Keep talking.");
        startBrowserVoiceRecognition();
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [followUpWindow, isRoutingCommand, wakeModeEnabled, voiceBackend]);

  useJarvisVoiceWake({
    wakeModeEnabled,
    voiceBackend,
    assistantName,
    voiceSessionPhase,
    voiceState,
    startBrowserWakeListener,
    stopWakeListener,
    closeFollowUpWindow,
    clearWakeRestartTimeout,
    setVoiceSessionPhase,
    setVoiceState,
    commandRecognitionRef,
    wakeRecognitionRef,
  });

  useEffect(() => {
    const transcript = voiceTranscript.trim();
    if (!shouldAutoRouteVoice || !transcript || isRoutingCommand) {
      return;
    }

    if (voiceSessionPhase !== "ready" && voiceSessionPhase !== "processing") {
      return;
    }

    if (lastAutoRoutedVoiceRef.current === transcript) {
      return;
    }

    triggerVoiceAutoRoute(transcript);
  }, [voiceTranscript, voiceSessionPhase, shouldAutoRouteVoice, isRoutingCommand]);

  async function runOcrWatchCheck(watch: OcrWatchTarget) {
    try {
      const snapshot = await captureOcrSnapshot(watch);
      const cleaned = cleanupOcrText(snapshot.ocrText);
      if (!cleaned) {
        return;
      }
      setOcrWatchTargets((currentTargets) =>
        currentTargets.map((current) => {
          if (current.id !== watch.id) {
            return current;
          }
          if (!ocrWatchRuleMatches(current.rule, current.lastText, cleaned)) {
            return { ...current, lastCheckedAt: new Date().toISOString() };
          }
          const matchKey = getOcrMatchKey(current.rule, cleaned);
          if (current.lastMatchKey === matchKey) {
            return { ...current, lastText: cleaned, lastCheckedAt: new Date().toISOString() };
          }
          const targetLabel = describeOcrTarget(current.scope, current.appName, current.region, current.rect);
          const summary = summarizeOcrText(cleaned) || cleaned.slice(0, 800);
          setCommandResult({
            title: "Screen watch changed",
            detail: `Detected ${describeOcrWatchRule(current.rule)} on ${targetLabel}.\n\n${formatOcrResultDetail(cleaned)}`,
          });
          setStatusMessage(`OCR watch noticed a change on ${targetLabel}.`);
          appendConversationTurn("jarvis", `I noticed the watched ${targetLabel} changed.`);
          speakIfEnabled(`I noticed the watched ${targetLabel} changed.`);
          const source = getOcrSourceLabel(current.scope, current.appName, current.region);
          rememberOcrHistory(targetLabel, cleaned, snapshot.screenshotPath, {
            source,
            matchType: describeOcrWatchRule(current.rule),
            watchMatch: true,
          });
          if (current.logToNotion) {
            void createNotionNote(
              `OCR Watch Change\n\nTarget: ${targetLabel}\nDetected: ${new Date().toLocaleString()}\nScreenshot: ${snapshot.screenshotPath}\n\nSummary\n${summary}\n\nCleaned OCR\n${cleaned}`,
            )
              .then((note) => setRecentNotes((notes) => [note, ...notes].slice(0, 5)))
              .catch(() => setStatusMessage("OCR watch changed, but Notion logging failed."));
          }
          if (current.createTaskOnMatch) {
            void createNotionTask(`Review OCR match on ${targetLabel}: ${summary.slice(0, 120)}`, null, null)
              .then((task) => setRecentNotes((notes) => [task, ...notes].slice(0, 5)))
              .catch(() => setStatusMessage("OCR watch matched, but task creation failed."));
          }
          if (current.action?.type === "open_app") {
            void launchDesktopApp(current.action.appName).catch(() => setStatusMessage("OCR watch matched, but app launch failed."));
          } else if (current.action?.type === "open_workspace") {
            void executeIntent({ kind: "open_desktop_project", query: current.action.query }).catch(() =>
              setStatusMessage("OCR watch matched, but workspace launch failed."),
            );
          } else if (current.action?.type === "copy_text") {
            void writeClipboardText(cleaned).catch(() => setStatusMessage("OCR watch matched, but clipboard copy failed."));
          }
          return { ...current, lastText: cleaned, lastMatchKey: matchKey, lastCheckedAt: new Date().toISOString() };
        }),
      );
    } catch (error) {
      setStatusMessage(getErrorDetail(error, "OCR watch could not read the watched target."));
    }
  }

  useOcrWatchScheduler(ocrWatchTargets, runOcrWatchCheck);

  async function pingCore() {
    try {
      const response = await pingJarvis();
      setStatusMessage(response);
    } catch {
      setStatusMessage(
        "Tauri command bridge not connected yet. Install the toolchain to activate native actions.",
      );
    }
  }

  function triggerVoiceAutoRoute(transcript: string) {
    const normalizedTranscript = transcript.trim();
    if (!normalizedTranscript) {
      return;
    }

    lastAutoRoutedVoiceRef.current = normalizedTranscript;
    void routeCommandFromVoice(normalizedTranscript);
  }

  async function captureOcrSnapshot(target: {
    scope?: OcrScope;
    appName?: string;
    region?: OcrRegion;
    rect?: OcrRect;
    useLast?: boolean;
  }) {
    if (target.useLast && !lastScreenshotPath) {
      throw new Error("There is no last screenshot yet. Ask JARVIS to take a screenshot first.");
    }

    const screenshotPath = target.useLast
      ? lastScreenshotPath!
      : target.scope === "active_window"
        ? await captureActiveWindowScreenshot()
        : target.scope === "app_window" && target.appName
          ? await captureDesktopAppWindowScreenshot(target.appName)
          : target.scope === "region" && target.region
            ? await captureScreenRegionScreenshot(target.region)
          : target.scope === "rect" && target.rect
            ? await captureScreenRectScreenshot(
                Math.round(target.rect.x),
                Math.round(target.rect.y),
                Math.round(target.rect.width),
                Math.round(target.rect.height),
              )
            : target.scope === "global_selection"
              ? await captureGlobalSelectionScreenshot()
            : await captureDesktopScreenshot();
    setLastScreenshotPath(screenshotPath);
    setActiveConversationContext(createActiveScreenshotContext(screenshotPath));
    const ocrText = applyOcrCorrections((await extractImageOcrText(screenshotPath)).trim(), ocrCorrections);
    return { screenshotPath, ocrText };
  }

  function rememberOcrHistory(target: string, text: string, screenshotPath: string, options?: { source?: string; matchType?: string; watchMatch?: boolean }) {
    const cleaned = cleanupOcrText(text);
    if (!cleaned) {
      return null;
    }
    const record: OcrHistoryRecord = {
      id: `ocr-${Date.now()}`,
      target,
      text: cleaned.slice(0, 5000),
      summary: (summarizeOcrText(cleaned) || cleaned).slice(0, 1000),
      screenshotPath,
      createdAt: new Date().toISOString(),
      source: options?.source,
      matchType: options?.matchType,
    };
    setLastOcrText(record.text);
    setOcrHistory((current) => [record, ...current].slice(0, 20));
    if (options?.watchMatch) {
      setOcrWatchMatches((current) => [record, ...current].slice(0, 10));
    }
    return record;
  }

  function beginOcrSelection() {
    setIsOcrSelecting(true);
    setOcrSelection(null);
    setCommandResult({
      title: "Select OCR area",
      detail: "Drag a box over the area you want JARVIS to read. Press Escape or Cancel to stop.",
    });
    setStatusMessage("OCR selection mode active.");
  }

  async function completeOcrSelection(rect: OcrRect) {
    setIsOcrSelecting(false);
    setOcrSelection(null);
    await executeIntent({ kind: "read_screen_text", scope: "rect", rect });
  }

  const selectionRect = ocrSelection
    ? {
        left: Math.min(ocrSelection.viewStartX, ocrSelection.viewCurrentX),
        top: Math.min(ocrSelection.viewStartY, ocrSelection.viewCurrentY),
        width: Math.abs(ocrSelection.viewCurrentX - ocrSelection.viewStartX),
        height: Math.abs(ocrSelection.viewCurrentY - ocrSelection.viewStartY),
      }
    : null;
  const activeOcrWatches = ocrWatchTargets.filter((watch) => watch.status === "active");
  const primaryOcrWatch = ocrWatchTargets[0] ?? null;
  const learnedIntentFamilies = useMemo(
    () => buildLearnedIntentFamilySummaries(learnedIntentMappings),
    [learnedIntentMappings],
  );
  const isShellBarVisible = uiState.quickBar.visible;
  const shellBarPlacement = uiState.quickBar.placement;
  const shellBarPosition = uiState.quickBar.position;
  const isCockpitMode = uiState.isCockpitOpen;
  const activeHomeApp = uiState.activeWorkspaceId;
  const setIsShellBarVisible = (visible: boolean) =>
    dispatchUi({ type: "setQuickBarVisibility", visible });
  const setIsCockpitMode = (active: boolean) =>
    dispatchUi({ type: active ? "openCockpit" : "closeCockpit" });
  const setActiveHomeApp = (appId: JarvisHomeAppId) =>
    dispatchUi({ type: "setWorkspace", workspaceId: appId });
  const connectedIntegrations = [
    googleCalendarAccessToken ? "Calendar" : null,
    gmailAccessToken ? "Gmail" : null,
    notionStatus?.hasToken ? "Notion" : null,
    spotifyAccessToken ? "Spotify" : null,
  ].filter(Boolean);
  const displayPeopleMemory = rustPeopleMemory ?? peopleMemory;
  const displayTravelMemory = rustTravelMemory ?? travelMemory;
  const displayExpenseMemory = rustExpenseMemory ?? expenseMemory;
  const displayPackageMemory = rustPackageMemory ?? packageMemory;
  const displayMeetingPrepMemory = rustMeetingPrepMemory ?? meetingPrepMemory;
  const displaySchoolPlanMemory = rustSchoolPlanMemory ?? schoolPlanMemory;
  const memoryTotal =
    displayPeopleMemory.length +
    displayTravelMemory.length +
    displayExpenseMemory.length +
    displayPackageMemory.length +
    displayMeetingPrepMemory.length +
    displaySchoolPlanMemory.length;
  const cockpitSignals = [
    { label: "Voice", value: voiceSessionPhase },
    { label: "OCR", value: `${activeOcrWatches.length} active` },
    { label: "Memory", value: `${memoryTotal} cards` },
    { label: "Links", value: `${connectedIntegrations.length} on` },
    { label: "Workspaces", value: `${desktopProjects.length} saved` },
    { label: "Automation", value: `${savedWorkflows.length + ocrWatchTargets.length} rules` },
  ];
  const cockpitMissionPrompts = [
    "Create daily brief",
    "Read my screen",
    "Show unread emails",
    "Open coding workspace",
    "Show OCR watches",
    "Run project checks",
  ];
  const dataSphereNodes = [
    { label: "Voice", value: voiceSessionPhase, app: "command" as JarvisHomeAppId, panel: "voice" as JarvisPanelId, angle: 0 },
    { label: "Vision", value: `${ocrHistory.length} reads`, app: "vision" as JarvisHomeAppId, panel: "ocr" as JarvisPanelId, angle: 52 },
    { label: "Memory", value: `${memoryTotal} cards`, app: "memory" as JarvisHomeAppId, panel: "memory" as JarvisPanelId, angle: 104 },
    { label: "Auto", value: `${ocrWatchTargets.length} watches`, app: "automation" as JarvisHomeAppId, panel: "automation" as JarvisPanelId, angle: 156 },
    { label: "Desk", value: `${desktopProjects.length} spaces`, app: "workspaces" as JarvisHomeAppId, panel: "workspaces" as JarvisPanelId, angle: 208 },
    { label: "Links", value: `${connectedIntegrations.length} on`, app: "connections" as JarvisHomeAppId, panel: "integrations" as JarvisPanelId, angle: 260 },
    { label: "Models", value: modelRouterConfig.allowCloudForPrivateMemory ? "cloud ok" : "local", app: "models" as JarvisHomeAppId, panel: "integrations" as JarvisPanelId, angle: 300 },
    { label: "Build", value: executorStatus?.configured ? "ready" : "setup", app: "builder" as JarvisHomeAppId, panel: "builder" as JarvisPanelId, angle: 340 },
  ];
  const jarvisHomeApps: Array<{
    id: JarvisHomeAppId;
    title: string;
    kicker: string;
    description: string;
    stat: string;
    accent: string;
    actions: Array<{ label: string; command?: string; panel?: JarvisPanelId; cockpit?: boolean }>;
  }> = [
    {
      id: "command",
      title: "Command",
      kicker: "Natural language",
      description: "Run text or voice commands, route actions, and see the latest result.",
      stat: voiceSessionPhase,
      accent: "cyan",
      actions: [
        { label: "Listen", command: "__listen__" },
        { label: "Daily brief", command: "Create daily brief" },
        { label: "Cockpit", cockpit: true },
      ],
    },
    {
      id: "vision",
      title: "Vision",
      kicker: "OCR and screen",
      description: "Read your screen, summarize visible text, watch apps, and create tasks from OCR.",
      stat: `${ocrHistory.length} reads`,
      accent: "blue",
      actions: [
        { label: "Read screen", command: "Read my screen" },
        { label: "Select area", command: "Select OCR area" },
        { label: "Open panel", panel: "ocr" },
      ],
    },
    {
      id: "memory",
      title: "Memory",
      kicker: "People and life",
      description: "Birthdays, travel, expenses, packages, meetings, school plans, and learned language.",
      stat: `${memoryTotal} cards`,
      accent: "green",
      actions: [
        { label: "Daily brief", command: "Create daily brief" },
        { label: "People", command: "List birthdays" },
        { label: "Open panel", panel: "memory" },
      ],
    },
    {
      id: "automation",
      title: "Automation",
      kicker: "Watches and workflows",
      description: "OCR watches, repeated workflows, schedules, and cross-feature suggestions.",
      stat: `${ocrWatchTargets.length + savedWorkflows.length} rules`,
      accent: "violet",
      actions: [
        { label: "Show watches", command: "Show OCR watches" },
        { label: "Schedules", command: "List desktop schedules" },
        { label: "Open panel", panel: "automation" },
      ],
    },
    {
      id: "workspaces",
      title: "Workspaces",
      kicker: "Desktop modes",
      description: "Saved app, folder, and website bundles for school, coding, focus, and daily routines.",
      stat: `${desktopProjects.length} saved`,
      accent: "amber",
      actions: [
        { label: "Open coding", command: "Open coding workspace" },
        { label: "Show workspaces", command: "List desktop projects" },
        { label: "Open panel", panel: "workspaces" },
      ],
    },
    {
      id: "connections",
      title: "Connections",
      kicker: "External apps",
      description: "Google Calendar, Gmail, Notion, Spotify, Ollama, and the local executor bridge.",
      stat: `${connectedIntegrations.length} online`,
      accent: "pink",
      actions: [
        { label: "Unread emails", command: "Show unread emails" },
        { label: "Spotify", command: "What's playing on Spotify" },
        { label: "Open panel", panel: "integrations" },
      ],
    },
    {
      id: "models",
      title: "Models",
      kicker: "AI routing",
      description: "Choose local/cloud models, benchmark providers, compare responses, and manage safe drafts.",
      stat: `${MODEL_PROVIDER_LABELS[modelRouterConfig.defaultProvider]}`,
      accent: "indigo",
      actions: [
        { label: "Benchmark", command: "Run model benchmark" },
        { label: "Recommend", command: "Recommend model routes" },
        { label: "Open models", command: "__models__" },
      ],
    },
    {
      id: "builder",
      title: "Builder",
      kicker: "Code and agent bridge",
      description: "Project checks, coding handoffs, executor bridge, and future voice-to-code control.",
      stat: executorStatus?.configured ? "ready" : "setup",
      accent: "red",
      actions: [
        { label: "Run checks", command: "Run project checks" },
        { label: "Open project", command: "Open project in VS Code" },
        { label: "Open panel", panel: "builder" },
      ],
    },
  ];
  const activeHomeAppRecord = jarvisHomeApps.find((app) => app.id === activeHomeApp) ?? jarvisHomeApps[0];

  function renderJarvisPanelContent(panel: JarvisPanelId) {
    if (panel === "ocr") {
      return (
        <>
          <div className="shell-stat-grid">
            <span><strong>{activeOcrWatches.length}</strong> active watches</span>
            <span><strong>{ocrHistory.length}</strong> reads saved</span>
            <span><strong>{ocrWatchTemplates.length}</strong> templates</span>
          </div>
          <p className="shell-panel-copy">
            Latest: {lastOcrText ? `${lastOcrText.replace(/\s+/g, " ").slice(0, 120)}${lastOcrText.length > 120 ? "..." : ""}` : "No screen text captured yet."}
          </p>
          <div className="shell-panel-actions-row">
            <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "read_screen_text" })}>Read screen</button>
            <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "summarize_screen", mode: "brief" })}>Summarize</button>
            <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "begin_ocr_region_selection" })}>Select area</button>
          </div>
        </>
      );
    }
    if (panel === "voice") {
      return (
        <>
          <div className="shell-stat-grid">
            <span><strong>{voiceSessionPhase}</strong> state</span>
            <span><strong>{voiceBackend}</strong> voice</span>
            <span><strong>{learnedIntentMappings.length}</strong> phrases</span>
          </div>
          <p className="shell-panel-copy">
            Wake mode is {wakeModeEnabled ? "enabled" : "off"}. Replies are {voiceResponseEnabled ? formatVoiceReplyModeLabel(voiceReplyMode) : "off"}.
          </p>
          <div className="shell-panel-actions-row">
            <button className="secondary-button" type="button" onClick={handleVoiceStart}>Listen</button>
            <button className="secondary-button" type="button" onClick={handleWakeActivation}>Wake {assistantName}</button>
          </div>
        </>
      );
    }
    if (panel === "workspaces") {
      return (
        <>
          <div className="shell-stat-grid">
            <span><strong>{desktopProjects.length}</strong> workspaces</span>
            <span><strong>{desktopSchedules.length}</strong> schedules</span>
            <span><strong>{activeConversationContext?.label ?? "none"}</strong> last target</span>
          </div>
          <div className="shell-mini-list">
            {desktopProjects.slice(0, 4).map((project) => (
              <button className="shell-mini-item" type="button" key={project.id} onClick={() => void executeIntent({ kind: "open_desktop_project", query: project.name })}>
                {project.name}
              </button>
            ))}
            {desktopProjects.length === 0 ? <span className="shell-panel-copy">No workspace templates yet.</span> : null}
          </div>
        </>
      );
    }
    if (panel === "memory") {
      return (
        <>
          <div className="shell-stat-grid">
            <span><strong>{displayPeopleMemory.length}</strong> people</span>
            <span><strong>{displayTravelMemory.length}</strong> trips</span>
            <span><strong>{displayExpenseMemory.length}</strong> expenses</span>
            <span><strong>{displayPackageMemory.length}</strong> packages</span>
            <span><strong>{displayMeetingPrepMemory.length}</strong> meetings</span>
            <span><strong>{displaySchoolPlanMemory.length}</strong> school plans</span>
          </div>
          <p className="shell-panel-copy">Total memory cards: {memoryTotal}. This is the personal-context layer JARVIS uses for briefs and cross-feature workflows.</p>
        </>
      );
    }
    if (panel === "integrations") {
      return (
        <>
          <div className="shell-stat-grid">
            <span><strong>{googleCalendarAccessToken ? "on" : "off"}</strong> Calendar</span>
            <span><strong>{gmailAccessToken ? "on" : "off"}</strong> Gmail</span>
            <span><strong>{notionStatus?.hasToken ? "on" : "off"}</strong> Notion</span>
            <span><strong>{spotifyAccessToken ? "on" : "off"}</strong> Spotify</span>
          </div>
          <p className="shell-panel-copy">
            Connected: {connectedIntegrations.length > 0 ? connectedIntegrations.join(", ") : "none yet"}.
          </p>
        </>
      );
    }
    if (panel === "automation") {
      return (
        <>
          <div className="shell-stat-grid">
            <span><strong>{ocrWatchTargets.length}</strong> OCR watches</span>
            <span><strong>{savedWorkflows.length}</strong> workflows</span>
            <span><strong>{crossFeatureSuggestions.length}</strong> suggestions</span>
          </div>
          <p className="shell-panel-copy">
            Automation is where watches, schedules, and cross-feature suggestions come together.
          </p>
          <div className="shell-panel-actions-row">
            <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "show_ocr_watches" })}>Show watches</button>
            <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "list_desktop_schedules" })}>Schedules</button>
          </div>
        </>
      );
    }
    return (
      <>
        <div className="shell-stat-grid">
          <span><strong>{executorStatus?.configured ? "ready" : "off"}</strong> executor</span>
          <span><strong>{autonomousBuildStatus}</strong> build state</span>
          <span><strong>{handoffArtifact ? "yes" : "none"}</strong> handoff</span>
        </div>
        <p className="shell-panel-copy">
          Builder mode prepares code-change handoffs now, and later can become the true voice-to-code bridge.
        </p>
        <div className="shell-panel-actions-row">
          <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "open_project_in_vscode" })}>Open project</button>
          <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "run_project_checks" })}>Run checks</button>
        </div>
      </>
    );
  }

  async function submitShellBarCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const command = shellBarInput.trim();
    if (!command) {
      return;
    }
    setInput(command);
    setShellBarInput("");
    await runCommand(command);
  }

  async function handleCompareConversationBackends() {
    const prompt = backendComparePrompt.trim();
    if (!prompt) {
      setStatusMessage("Add a prompt first so JARVIS can compare heuristics and Ollama.");
      return;
    }

    setIsComparingBackends(true);
    try {
      const heuristicsIntent = parseConversationalCommandIntent(prompt, browserAliases);
      let ollamaSummary = "Ollama not configured.";
      let ollamaAction = "none";

      if (ollamaStatus?.configured) {
        try {
          const interpretation = await interpretConversationWithOllama(prompt, assistantName);
          const mapped = mapOllamaInterpretationToResult(interpretation);
          ollamaSummary =
            mapped.kind === "clarification"
              ? `Clarification: ${mapped.prompt}`
              : mapped.kind === "intent"
              ? describeCommandIntent(mapped.intent)
              : "Unsupported or empty response.";
          ollamaAction =
            mapped.kind === "clarification"
              ? "clarify"
              : mapped.kind === "intent"
              ? describeIntentActionType(mapped.intent)
              : "none";
        } catch (error) {
          ollamaSummary = getErrorDetail(error, "Ollama comparison failed.");
          ollamaAction = "error";
        }
      }

      setBackendComparison({
        prompt,
        heuristics: describeCommandIntent(heuristicsIntent),
        heuristicsAction: describeIntentActionType(heuristicsIntent),
        ollama: ollamaSummary,
        ollamaAction,
        autoRouteLabel: shouldUseOllamaFirstInAutoMode(prompt)
          ? "Auto -> Ollama"
          : "Auto -> Heuristics",
        autoDecision: shouldUseOllamaFirstInAutoMode(prompt)
          ? "Auto would try Ollama first, then fall back to heuristics if needed."
          : "Auto would try heuristics first, then ask Ollama only if the command stays unclear.",
        autoReason: shouldUseOllamaFirstInAutoMode(prompt)
          ? "This sounds fuzzy, open-ended, or planning-oriented, so JARVIS leans on Ollama first."
          : "This looks like a direct command with a clear action, so JARVIS keeps the fast heuristics path first.",
      });
      setStatusMessage("Compared the prompt across conversation brains.");
    } finally {
      setIsComparingBackends(false);
    }
  }

  function applyAssistantDefaults(defaults: Partial<AssistantDefaults>) {
    if (
      defaults.voiceBackend === "browser" ||
      defaults.voiceBackend === "local" ||
      defaults.voiceBackend === "groq"
    ) {
      setVoiceBackend(defaults.voiceBackend);
    }
    if (defaults.speechOutputBackend === "browser" || defaults.speechOutputBackend === "local") {
      setSpeechOutputBackend(defaults.speechOutputBackend);
    }
    if (typeof defaults.voiceAutoRouteEnabled === "boolean") {
      setVoiceAutoRouteEnabled(defaults.voiceAutoRouteEnabled);
    }
    if (
      defaults.conversationBackend === "heuristics" ||
      defaults.conversationBackend === "ollama" ||
      defaults.conversationBackend === "auto"
    ) {
      setConversationBackend(defaults.conversationBackend);
    }
    if (
      defaults.voiceReplyMode === "quiet" ||
      defaults.voiceReplyMode === "brief" ||
      defaults.voiceReplyMode === "normal" ||
      defaults.voiceReplyMode === "detailed"
    ) {
      setVoiceReplyMode(defaults.voiceReplyMode);
    }
    if (typeof defaults.voiceResponseEnabled === "boolean") {
      setVoiceResponseEnabled(defaults.voiceResponseEnabled);
    }
  }

  function saveCurrentAssistantDefaults() {
    const payload: AssistantDefaults = {
      voiceBackend,
      speechOutputBackend,
      voiceAutoRouteEnabled,
      conversationBackend,
      voiceReplyMode,
      voiceResponseEnabled,
    };

    try {
      window.localStorage.setItem(ASSISTANT_DEFAULTS_STORAGE_KEY, JSON.stringify(payload));
      setStatusMessage("Saved your current assistant defaults.");
      setCommandResult({
        title: "Assistant defaults saved",
        detail: "JARVIS will reuse your current voice, speech, auto-route, and brain preferences next time.",
      });
    } catch {
      setStatusMessage("JARVIS could not save the assistant defaults locally.");
    }
  }

  function restoreSavedAssistantDefaults() {
    try {
      const saved = window.localStorage.getItem(ASSISTANT_DEFAULTS_STORAGE_KEY);
      if (!saved) {
        setStatusMessage("No saved assistant defaults were found yet.");
        return;
      }
      const defaults = JSON.parse(saved) as Partial<AssistantDefaults>;
      applyAssistantDefaults(defaults);
      setStatusMessage("Restored your saved assistant defaults.");
      setCommandResult({
        title: "Assistant defaults restored",
        detail: "JARVIS reapplied your saved voice, speech, auto-route, and brain settings.",
      });
    } catch {
      setStatusMessage("JARVIS could not restore the assistant defaults.");
    }
  }

  function resetToRecommendedAssistantDefaults() {
    applyAssistantDefaults(RECOMMENDED_ASSISTANT_DEFAULTS);
    setStatusMessage("Reset to the recommended assistant defaults.");
    setCommandResult({
      title: "Recommended defaults restored",
      detail: "JARVIS reset voice, speech, routing, and brain preferences to the recommended baseline.",
    });
  }

  const visibleGatewayPreview =
    pendingGatewayConfirmation?.preview ?? pendingGatewayTeaching?.preview ?? gatewayPreview;
  const gatewayFollowUp = formatGatewayFollowUp(visibleGatewayPreview);

  const commandRouterDepsRef = useRef<CommandRouterDeps>({});
  Object.assign(commandRouterDepsRef.current, {
    activeConversationContext,
    appendConversationTurn,
    applyModelProviderPreset,
    applyVoiceCorrections,
    assistantName,
    autonomousBuildStatus,
    autonomousSkillBuildingEnabled,
    backendComparePrompt,
    backendComparison,
    beginOcrSelection,
    beginSelectedVoiceCapture,
    browserAliasUrl,
    browserAliases,
    buildCachedSemanticIntentEmbedding,
    buildCrossFeatureSuggestionsForEmail,
    buildCrossFeatureSuggestionsForState,
    buildNaturalGenerationSystemPrompt,
    buildRequest,
    buildSemanticEmbeddingWithFallback,
    callConfiguredModel,
    captureOcrSnapshot,
    chooseModelComparisonWinner,
    classifyModelTask,
    clearFollowUpTimeout,
    clearWakeRestartTimeout,
    closeFollowUpWindow,
    closeJarvisPanel,
    commandRecognitionRef,
    commandResult,
    compareModelResponses,
    completeOcrSelection,
    continuePendingWorkflowExecution,
    conversationBackend,
    conversationContextStack,
    conversationTurns,
    createBuildRequest,
    createDesktopProject,
    createDesktopProjectFromTemplate,
    createImplementationRequest,
    crossFeatureSuggestions,
    currentRouteLabelRef,
    deleteDesktopProject,
    deleteSavedProviderApiKey,
    desktopPermissionSettings,
    desktopProjects,
    desktopSchedules,
    editingProposalId,
    editingWorkflowId,
    embeddingBackend,
    embeddingModelName,
    embeddingStatusMessage,
    executorCommandPath,
    executorStatus,
    executorWorkingDirectory,
    expenseMemory,
    findDesktopProject,
    followUpTimeoutRef,
    followUpWindow,
    gatewayConfig,
    gatewayHistory,
    gatewayPreview,
    gatewayPreviewError,
    gatewaySessionRef,
    jarvisModules,
    skillAutopilotAvailable,
    dispatchUi,
    generateSafeModelDraft,
    getDismissedWorkflowSignatures,
    getWorkflowCounts,
    gmailAccessToken,
    googleCalendarAccessToken,
    googleCalendarApiKey,
    googleCalendarClientId,
    googleCalendarStatus,
    handleAddWorkflowTemplate,
    handleApproveSkillPlan,
    handleApproveWorkflowSuggestion,
    handleAskAdvancedAssistant,
    handleConnectGmail,
    handleConnectGoogleCalendar,
    handleConnectSpotify,
    handleConversationContextStackCommand,
    handleCreateHandoffArtifact,
    handleDeleteLearnedIntent,
    handleDeleteWorkflow,
    handleDismissWorkflowSuggestion,
    handleExportWorkflows,
    handleGenerateBuildRequest,
    handleGenerateProposal,
    handleGroqVoiceToggle,
    handleImportWorkflows,
    handleLocalVoiceToggle,
    handleProposalDecision,
    handleProposalFieldChange,
    handleProposalStepChange,
    handleRenameLearnedIntent,
    handleRenameWorkflow,
    handleSaveBrowserAlias,
    handleSaveExecutorConfig,
    handleSaveGoogleCalendarConfig,
    handleSaveLocalSpeechConfig,
    handleSaveLocalVoiceConfig,
    handleSaveNotionConfig,
    handleSaveOllamaConfig,
    handleSaveProposalEdits,
    handleSaveSpotifyConfig,
    handleSaveVoiceCorrection,
    handleSaveWakeMode,
    handleSaveWorkflowEdits,
    handleTestModelProvider,
    handleTrainingModeInput,
    handleTrainingReviewCleanupCommand,
    handleVoiceStart,
    handleVoiceStateChange,
    handleWakeActivation,
    handleWorkflowFieldChange,
    handleWorkflowStepChange,
    handoffArtifact,
    implementationRequest,
    input,
    isBenchmarkingModels,
    isComparingBackends,
    isComparingModels,
    isGeneratingMissingSkillPlan,
    isGeneratingModelDraft,
    isGeneratingProposal,
    isOcrSelecting,
    isPreviewingGateway,
    isRoutingCommand,
    isSensitiveModelPrompt,
    isTestingModelRouter,
    jarvisPanels,
    lastAutoRoutedVoiceRef,
    lastConversationTopic,
    lastOcrText,
    lastScreenshotPath,
    lastSemanticIntentMatches,
    latestGeneratedDraft,
    learnedIntentMappings,
    learnedIntentRenameDrafts,
    loadBrowserAliases,
    loadExecutorStatus,
    loadGoogleCalendarStatus,
    loadLearnedIntents,
    loadLocalSpeechStatus,
    loadLocalVoiceStatus,
    loadMemoryView,
    loadNotionStatus,
    loadOllamaStatus,
    loadPlannerTaskRecords,
    loadProposalSteps,
    loadRecentFiles,
    loadRecentNotes,
    loadSpotifyStatus,
    loadVoiceCorrections,
    loadWakeModeStatus,
    localExecutablePath,
    localModelPath,
    localRecorderRef,
    localSpeechStatus,
    localTtsExecutablePath,
    localTtsModelPath,
    localVoiceStatus,
    meetingPrepMemory,
    minimizeJarvisPanel,
    missingSkillPlan,
    missingSkillRequest,
    modelBenchmarkResults,
    modelComparisonPrompt,
    modelComparisonRun,
    modelProviderKeyPreview,
    modelProviderKeyStatus,
    modelProviderUsage,
    modelRouterConfig,
    modelRouterStatusMessage,
    modelRouterTestResult,
    moveJarvisPanel,
    moveShellBar,
    notionDatabaseId,
    notionStatus,
    notionTokenInput,
    ocrCorrections,
    ocrHistory,
    ocrSelection,
    ocrWatchMatches,
    ocrWatchTargets,
    ocrWatchTemplates,
    ollamaBaseUrl,
    ollamaModelName,
    ollamaStatus,
    openFollowUpWindow,
    openJarvisPanel,
    packageMemory,
    panelDragState,
    pendingClarification,
    pendingGatewayConfirmation,
    pendingGatewayTeaching,
    pendingWorkflowExecution,
    peopleMemory,
    pickProactiveCrossSuggestion,
    pinShellBar,
    pingCore,
    plannerTasks,
    presentedCollectionContext,
    proactiveCrossSuggestion,
    proposalSteps,
    proposals,
    pushGatewayHistory,
    recentEmails,
    recentFiles,
    recentHistory,
    recentNotes,
    recommendModelRoutesFromHistory,
    refreshGatewayPreview: refreshGatewayPreviewWithHistory,
    refreshProviderKeyStatuses,
    refreshSpotifyPlayback,
    rememberExpenseSummary,
    rememberMeetingPrepSummary,
    rememberModelProviderUsage,
    rememberOcrHistory,
    rememberPackageSummary,
    rememberPersonBirthday,
    rememberRejectedPendingSemanticClarification,
    rememberSchoolPlan,
    rememberSemanticConversationTurn,
    rememberSemanticIntentFeedback,
    rememberSuccessfulPhrase,
    rememberTravelSummary,
    rememberWorkflowSequence,
    resetJarvisUiPreferences,
    resolveModelRoute,
    restartFollowUpListenerSoon,
    restartWakeListenerSoon,
    returnToArmedWakeMode,
    revealModelText,
    runModelBenchmark,
    rustExpenseMemory,
    rustMeetingPrepMemory,
    rustPackageMemory,
    rustPeopleMemory,
    rustSchoolPlanMemory,
    rustTravelMemory,
    saveProviderApiKey,
    savedWorkflows,
    schoolPlanMemory,
    semanticConversationMemory,
    semanticIntentEmbeddingCacheRef,
    semanticIntentFeedback,
    setActiveConversationContext,
    setAssistantName,
    setAutonomousBuildStatus,
    setAutonomousSkillBuildingEnabled,
    setBackendComparePrompt,
    setBackendComparison,
    setBrowserAliasUrl,
    setBrowserAliases,
    setBuildRequest,
    setCommandResult,
    setConversationBackend,
    setConversationContextStack,
    setConversationTurns,
    setCrossFeatureSuggestions,
    setDesktopPermissionSettings,
    setDesktopProjects,
    setDesktopSchedules,
    setDismissedWorkflowSignatures,
    setEditingProposalId,
    setEditingWorkflowId,
    setEmbeddingBackend,
    setEmbeddingModelName,
    setEmbeddingStatusMessage,
    setExecutorCommandPath,
    setExecutorStatus,
    setExecutorWorkingDirectory,
    setExpenseMemory,
    setFollowUpWindow,
    setGatewayConfig,
    setGatewayHistory,
    setGatewayPreview,
    setGatewayPreviewError,
    setGmailAccessToken,
    setGoogleCalendarAccessToken,
    setGoogleCalendarApiKey,
    setGoogleCalendarClientId,
    setGoogleCalendarStatus,
    setHandoffArtifact,
    setImplementationRequest,
    setInput,
    setIsBenchmarkingModels,
    setIsComparingBackends,
    setIsComparingModels,
    setIsGeneratingMissingSkillPlan,
    setIsGeneratingModelDraft,
    setIsGeneratingProposal,
    setIsOcrSelecting,
    setIsRoutingCommand,
    setIsTestingModelRouter,
    setJarvisPanels,
    setLastConversationTopic,
    setLastOcrText,
    setLastScreenshotPath,
    setLastSemanticIntentMatches,
    setLatestGeneratedDraft,
    setLearnedIntentMappings,
    setLearnedIntentRenameDrafts,
    setLocalExecutablePath,
    setLocalModelPath,
    setLocalSpeechStatus,
    setLocalTtsExecutablePath,
    setLocalTtsModelPath,
    setLocalVoiceStatus,
    setMeetingPrepMemory,
    setMissingSkillPlan,
    setMissingSkillRequest,
    setModelBenchmarkResults,
    setModelComparisonPrompt,
    setModelComparisonRun,
    setModelProviderKeyPreview,
    setModelProviderKeyStatus,
    setModelProviderUsage,
    setModelRouterConfig,
    setModelRouterStatusMessage,
    setModelRouterTestResult,
    setNotionDatabaseId,
    setNotionStatus,
    setNotionTokenInput,
    setOcrCorrections,
    setOcrHistory,
    setOcrSelection,
    setOcrWatchMatches,
    setOcrWatchTargets,
    setOcrWatchTemplates,
    setOllamaBaseUrl,
    setOllamaModelName,
    setOllamaStatus,
    setPackageMemory,
    setPanelDragState,
    setPendingClarification,
    setPendingGatewayConfirmation,
    setPendingGatewayTeaching,
    setPendingWorkflowExecution,
    setPeopleMemory,
    setPlannerTasks,
    setPreferredModelProvider,
    setPresentedCollectionContext,
    setProactiveCrossSuggestion,
    setProposalSteps,
    setProposals,
    setRecentEmails,
    setRecentFiles,
    setRecentHistory,
    setRecentNotes,
    setRustExpenseMemory,
    setRustMeetingPrepMemory,
    setRustPackageMemory,
    setRustPeopleMemory,
    setRustSchoolPlanMemory,
    setRustTravelMemory,
    setSavedWorkflows,
    setSchoolPlanMemory,
    setSemanticConversationMemory,
    setSemanticIntentFeedback,
    setShellBarDragState,
    setShellBarInput,
    setSpeechOutputBackend,
    setSpotifyAccessToken,
    setSpotifyClientId,
    setSpotifyPlaybackState,
    setSpotifyStatus,
    setStatusMessage,
    setStoredRoutines,
    setStreamingModelText,
    setTeachingTargetPhrase,
    setTrainingModeSession,
    setTravelMemory,
    setUserPreferenceMemory,
    setVoiceAutoRouteEnabled,
    setVoiceBackend,
    setVoiceCorrectionInput,
    setVoiceCorrections,
    setVoiceReplyMode,
    setVoiceResponseEnabled,
    setVoiceSessionPhase,
    setVoiceState,
    setVoiceTranscript,
    setWakeCueActive,
    setWakeListenerActive,
    setWakeModeEnabled,
    setWakeModeStatus,
    setWorkflowCounts,
    setWorkflowImportText,
    setWorkflowRenameDrafts,
    setWorkflowSuggestion,
    shellBarDragState,
    shellBarInput,
    shouldKeepFollowUpWindowOpen,
    shouldUseBrowserFollowUps,
    speakIfEnabled,
    speechOutputBackend,
    spotifyAccessToken,
    spotifyClientId,
    spotifyPlaybackState,
    spotifyStatus,
    startBrowserVoiceRecognition,
    startBrowserWakeListener,
    startTrainingMode,
    statusMessage,
    stopCommandListener,
    stopHandsFreeSession,
    stopWakeListener,
    storedRoutines,
    streamingModelText,
    teachJarvisMeaning,
    teachJarvisWorkflow,
    teachingTargetPhrase,
    testSavedProviderApiKey,
    toggleJarvisPanel,
    trainingModeSession,
    transformersEmbeddingRef,
    travelMemory,
    triggerVoiceAutoRoute,
    updateDesktopProject,
    updateModelProviderConfig,
    updateModelRouterConfig,
    updatePersonMemory,
    userPreferenceMemory,
    voiceAutoRouteEnabled,
    voiceBackend,
    voiceCorrectionInput,
    voiceCorrections,
    voiceReplyMode,
    voiceResponseEnabled,
    voiceSessionPhase,
    voiceState,
    voiceTranscript,
    wakeCueActive,
    wakeListenerActive,
    wakeModeEnabled,
    wakeModeStatus,
    wakeRecognitionRef,
    wakeRestartTimeoutRef,
    wakeTriggeredRef,
    workflowImportText,
    workflowRenameDrafts,
    workflowSuggestion,
  });
  const commandRouter = useJarvisCommandRouter(commandRouterDepsRef.current);
  const { routeCommand, routeCommandFromVoice, executeIntent, runCommand } = commandRouter;

  useEffect(() => {
    const timers = desktopSchedules
      .map((schedule) => {
        const delay = new Date(schedule.dueAt).getTime() - Date.now();
        if (delay <= 0) {
          void executeIntent({ kind: "open_desktop_project", query: schedule.projectName });
          setDesktopSchedules((current) => current.filter((item) => item.id !== schedule.id));
          return null;
        }

        if (delay > 24 * 60 * 60 * 1000) {
          return null;
        }

        return window.setTimeout(() => {
          void executeIntent({ kind: "open_desktop_project", query: schedule.projectName });
          setDesktopSchedules((current) => current.filter((item) => item.id !== schedule.id));
        }, delay);
      })
      .filter(Boolean) as number[];

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [desktopSchedules]);

  const workspaceSections = useJarvisWorkspaceSections({
    activeConversationContext,
    assistantName,
    browserAliases,
    commandResult,
    conversationContextStack,
    conversationTurns,
    followUpWindow,
    embeddingBackend,
    embeddingModelName,
    embeddingStatusMessage,
    gatewayFollowUp,
    gatewayHistory,
    gatewayPreviewError,
    localRecorderRef,
    pendingGatewayConfirmation,
    pendingGatewayTeaching,
    handleDeleteLearnedIntent,
    handleDeleteWorkflow,
    handleRenameLearnedIntent,
    handleRenameWorkflow,
    handleVoiceStart,
    input,
    isPreviewingGateway,
    isRoutingCommand,
    lastConversationTopic,
    lastSemanticIntentMatches,
    learnedIntentFamilies,
    learnedIntentMappings,
    learnedIntentRenameDrafts,
    pendingClarification,
    plannerTasks,
    quickPrompts: jarvisQuickPrompts,
    recentEmails,
    recentFiles,
    recentHistory,
    recentNotes,
    routeCommand,
    savedWorkflows,
    semanticConversationMemory,
    semanticIntentFeedback,
    setInput,
    setLearnedIntentRenameDrafts,
    setVoiceResponseEnabled,
    setWorkflowRenameDrafts,
    trainingModeSession,
    userPreferenceMemory,
    visibleGatewayPreview,
    voiceBackend,
    voiceCorrections,
    voiceResponseEnabled,
    voiceSessionPhase,
    voiceState,
    voiceTranscript,
    workflowRenameDrafts,
    vision: {
      activeOcrWatches,
      isRoutingCommand,
      ocrHistory,
      ocrWatchMatches,
      ocrWatchTargets,
      primaryOcrWatch,
      runCommand,
    },
    memory: {
      displayExpenseMemory,
      displayMeetingPrepMemory,
      displayPackageMemory,
      displayPeopleMemory,
      displaySchoolPlanMemory,
      displayTravelMemory,
      lastKnowledgeRecall,
      memoryTotal,
      rustExpenseMemory,
      rustMeetingPrepMemory,
      rustPackageMemory,
      rustPeopleMemory,
      rustSchoolPlanMemory,
      rustTravelMemory,
    },
    workspaces: {
      desktopPermissionSettings,
      desktopProjects,
      desktopSchedules,
      executeIntent,
      setDesktopPermissionSettings,
    },
    connections: {
      backendComparePrompt,
      backendComparison,
      conversationBackend,
      setBackendComparePrompt,
      setConversationBackend,
      dispatchUi,
      executeIntent,
      gmailAccessToken,
      googleCalendarAccessToken,
      handleCompareConversationBackends,
      handleTestModelProvider,
      isBenchmarkingModels,
      isComparingBackends,
      isTestingModelRouter,
      latestGeneratedDraft,
      modelBenchmarkResults,
      modelComparisonRun,
      modelProviderUsage,
      modelRouterConfig,
      modelRouterStatusMessage,
      modelRouterTestResult,
      notionStatus,
      ollamaStatus,
      runCommand,
      shouldAutoRouteVoice,
      spotifyAccessToken,
    },
    builder: {
      buildRequest,
      dispatchUi,
      executorStatus,
      handoffArtifact,
      implementationRequest,
      missingSkillPlan,
      missingSkillRequest,
      runCommand,
    },
    models: {
      dispatchUi,
      executeIntent,
      isBenchmarkingModels,
      isComparingModels,
      latestGeneratedDraft,
      modelBenchmarkResults,
      modelComparisonPrompt,
      modelComparisonRun,
      modelRouterConfig,
      modelRouterStatusMessage,
      setModelComparisonPrompt,
      streamingModelText,
    },
    automation: {
      crossFeatureSuggestions,
      pendingWorkflowExecution,
      proposals,
      savedWorkflows,
      storedRoutines,
      workflowSuggestion,
    },
  });

  const systemDrawerContent = (
    <SystemDrawerStack
      advancedPanel={
        <AdvancedConfigPanel
        title="Connection and backend settings"
        summary="Advanced auth, provider, and backend controls live here so the main app stays focused."
      >
        <div className="local-config-card">
          <span className="memory-meta">Current conversation brain: {conversationBackend}</span>
          <div className="workflow-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => setConversationBackend("heuristics")}
              disabled={conversationBackend === "heuristics"}
            >
              Switch to heuristics
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setConversationBackend("auto")}
              disabled={conversationBackend === "auto"}
            >
              Switch to auto
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setConversationBackend("ollama")}
              disabled={conversationBackend === "ollama"}
            >
              Switch to Ollama
            </button>
          </div>
        </div>
        <div className="local-config-card">
          <span className="memory-meta">
            Save the current voice, speech, auto-route, reply mode, and conversation brain as your assistant defaults.
          </span>
          <div className="workflow-actions">
            <button className="secondary-button" type="button" onClick={saveCurrentAssistantDefaults}>
              Save current defaults
            </button>
            <button className="secondary-button" type="button" onClick={restoreSavedAssistantDefaults}>
              Restore saved defaults
            </button>
            <button className="secondary-button" type="button" onClick={resetToRecommendedAssistantDefaults}>
              Reset to recommended defaults
            </button>
          </div>
        </div>
        {voiceBackend === "local" ? (
          <div className="local-config-card">
            <input value={localExecutablePath} onChange={(event) => setLocalExecutablePath(event.target.value)} placeholder="Path to whisper-cli.exe" />
            <input value={localModelPath} onChange={(event) => setLocalModelPath(event.target.value)} placeholder="Path to ggml model file (.bin)" />
            <button className="secondary-button" type="button" onClick={handleSaveLocalVoiceConfig}>Save local config</button>
          </div>
        ) : null}
        {speechOutputBackend === "local" ? (
          <div className="local-config-card">
            <input value={localTtsExecutablePath} onChange={(event) => setLocalTtsExecutablePath(event.target.value)} placeholder="Path to piper.exe" />
            <input value={localTtsModelPath} onChange={(event) => setLocalTtsModelPath(event.target.value)} placeholder="Path to Piper voice model (.onnx)" />
            <button className="secondary-button" type="button" onClick={handleSaveLocalSpeechConfig}>Save local speech config</button>
          </div>
        ) : null}
        <div className="local-config-card">
          <input value={ollamaBaseUrl} onChange={(event) => setOllamaBaseUrl(event.target.value)} placeholder="Ollama base URL" />
          <input value={ollamaModelName} onChange={(event) => setOllamaModelName(event.target.value)} placeholder="Ollama model name" />
          <button className="secondary-button" type="button" onClick={handleSaveOllamaConfig}>Save Ollama config</button>
        </div>
        <div className="local-config-card">
          <span className="memory-meta">
            Model router: local-first, NVIDIA first for hosted coding/reasoning, paid providers blocked unless explicitly enabled.
          </span>
          <select
            value={modelRouterConfig.defaultProvider}
            onChange={(event) => updateModelRouterConfig({ defaultProvider: event.target.value as ModelProviderId })}
          >
            {(Object.keys(MODEL_PROVIDER_LABELS) as ModelProviderId[]).map((providerId) => (
              <option key={providerId} value={providerId}>{MODEL_PROVIDER_LABELS[providerId]}</option>
            ))}
          </select>
          <select
            value={modelRouterConfig.codingProvider}
            onChange={(event) => updateModelRouterConfig({ codingProvider: event.target.value as ModelProviderId })}
          >
            {(Object.keys(MODEL_PROVIDER_LABELS) as ModelProviderId[]).map((providerId) => (
              <option key={providerId} value={providerId}>Coding: {MODEL_PROVIDER_LABELS[providerId]}</option>
            ))}
          </select>
          <select
            value={modelRouterConfig.reasoningProvider}
            onChange={(event) => updateModelRouterConfig({ reasoningProvider: event.target.value as ModelProviderId })}
          >
            {(Object.keys(MODEL_PROVIDER_LABELS) as ModelProviderId[]).map((providerId) => (
              <option key={providerId} value={providerId}>Reasoning: {MODEL_PROVIDER_LABELS[providerId]}</option>
            ))}
          </select>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={modelRouterConfig.enablePaidProviders}
              onChange={(event) => updateModelRouterConfig({ enablePaidProviders: event.target.checked })}
            />
            Enable paid providers
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={modelRouterConfig.allowCloudForPrivateMemory}
              onChange={(event) => updateModelRouterConfig({ allowCloudForPrivateMemory: event.target.checked })}
            />
            Allow cloud for private memory requests
          </label>
          <input
            type="number"
            min="0"
            value={modelRouterConfig.maxMonthlyApiSpend}
            onChange={(event) => updateModelRouterConfig({ maxMonthlyApiSpend: Number(event.target.value) || 0 })}
            placeholder="Max monthly API spend"
          />
          <input
            value={modelRouterConfig.experimentalLocalReasoningModel}
            onChange={(event) => updateModelRouterConfig({ experimentalLocalReasoningModel: event.target.value })}
            placeholder="Experimental local reasoning model"
          />
          <input
            value={modelRouterConfig.providers.local_ollama.baseUrl}
            onChange={(event) => updateModelProviderConfig("local_ollama", { baseUrl: event.target.value })}
            placeholder="Local Ollama OpenAI-compatible base URL"
          />
          <input
            value={modelRouterConfig.providers.local_ollama.chatModel}
            onChange={(event) => updateModelProviderConfig("local_ollama", { chatModel: event.target.value, codingModel: event.target.value, reasoningModel: event.target.value })}
            placeholder="Local Ollama chat model"
          />
          <input
            value={modelRouterConfig.providers.nvidia_nim.apiKey}
            onChange={(event) => updateModelProviderConfig("nvidia_nim", { apiKey: event.target.value })}
            onBlur={(event) => void saveProviderApiKey("nvidia_nim", event.target.value)}
            placeholder={modelProviderKeyStatus.nvidia_nim ? `Saved: ${modelProviderKeyPreview.nvidia_nim || "Windows Credential Manager"}` : "NVIDIA API key"}
          />
          <input
            value={modelRouterConfig.providers.nvidia_nim.baseUrl}
            onChange={(event) => updateModelProviderConfig("nvidia_nim", { baseUrl: event.target.value })}
            placeholder="NVIDIA base URL"
          />
          <input
            value={modelRouterConfig.providers.nvidia_nim.chatModel}
            onChange={(event) => updateModelProviderConfig("nvidia_nim", { chatModel: event.target.value })}
            placeholder="NVIDIA chat model"
          />
          <input
            value={modelRouterConfig.providers.nvidia_nim.codingModel}
            onChange={(event) => updateModelProviderConfig("nvidia_nim", { codingModel: event.target.value })}
            placeholder="NVIDIA coding model"
          />
          <input
            value={modelRouterConfig.providers.nvidia_nim.reasoningModel}
            onChange={(event) => updateModelProviderConfig("nvidia_nim", { reasoningModel: event.target.value })}
            placeholder="NVIDIA reasoning model"
          />
          <input
            value={modelRouterConfig.providers.gemini.apiKey}
            onChange={(event) => updateModelProviderConfig("gemini", { apiKey: event.target.value })}
            onBlur={(event) => void saveProviderApiKey("gemini", event.target.value)}
            placeholder={modelProviderKeyStatus.gemini ? `Saved: ${modelProviderKeyPreview.gemini || "Windows Credential Manager"}` : "Gemini API key"}
          />
          <input
            value={modelRouterConfig.providers.gemini.baseUrl}
            onChange={(event) => updateModelProviderConfig("gemini", { baseUrl: event.target.value })}
            placeholder="Gemini base URL"
          />
          <input
            value={modelRouterConfig.providers.gemini.chatModel}
            onChange={(event) => updateModelProviderConfig("gemini", { chatModel: event.target.value, codingModel: event.target.value, reasoningModel: event.target.value })}
            placeholder="Gemini model, e.g. gemini-2.5-flash"
          />
          <input
            value={modelRouterConfig.providers.groq.apiKey}
            onChange={(event) => updateModelProviderConfig("groq", { apiKey: event.target.value })}
            onBlur={(event) => void saveProviderApiKey("groq", event.target.value)}
            placeholder={modelProviderKeyStatus.groq ? `Saved: ${modelProviderKeyPreview.groq || "Windows Credential Manager"}` : "Groq API key"}
          />
          <input
            value={modelRouterConfig.providers.openrouter.apiKey}
            onChange={(event) => updateModelProviderConfig("openrouter", { apiKey: event.target.value })}
            onBlur={(event) => void saveProviderApiKey("openrouter", event.target.value)}
            placeholder={modelProviderKeyStatus.openrouter ? `Saved: ${modelProviderKeyPreview.openrouter || "Windows Credential Manager"}` : "OpenRouter API key"}
          />
          <div className="workflow-actions">
            {(["nvidia_nim", "gemini", "groq", "openrouter"] as ModelProviderId[]).map((providerId) => (
              <button className="secondary-button" type="button" key={`key-test-${providerId}`} onClick={() => void testSavedProviderApiKey(providerId)}>
                Check {MODEL_PROVIDER_LABELS[providerId]} key
              </button>
            ))}
            {(["nvidia_nim", "gemini", "groq", "openrouter"] as ModelProviderId[]).map((providerId) => (
              <button className="secondary-button" type="button" key={`key-delete-${providerId}`} onClick={() => void deleteSavedProviderApiKey(providerId)}>
                Delete {MODEL_PROVIDER_LABELS[providerId]} key
              </button>
            ))}
          </div>
          <div className="workflow-actions">
            {MODEL_PROVIDER_PRESETS.map((preset) => (
              <button className="secondary-button" type="button" key={preset.id} onClick={() => applyModelProviderPreset(preset.id)}>
                {preset.label}
              </button>
            ))}
          </div>
          <div className="workflow-actions">
            {(Object.keys(MODEL_PROVIDER_LABELS) as ModelProviderId[]).map((providerId) => (
              <button
                className="secondary-button"
                type="button"
                key={`chat-${providerId}`}
                onClick={() => void executeIntent({ kind: "set_model_provider_for_task", taskType: "chat", providerId })}
              >
                Chat: {MODEL_PROVIDER_LABELS[providerId]}
              </button>
            ))}
          </div>
          <div className="workflow-actions">
            {(["local_ollama", "lm_studio", "nvidia_nim", "gemini", "groq", "openrouter"] as ModelProviderId[]).map((providerId) => (
              <button
                className="secondary-button"
                type="button"
                key={`coding-${providerId}`}
                onClick={() => void executeIntent({ kind: "set_model_provider_for_task", taskType: "coding", providerId })}
              >
                Coding: {MODEL_PROVIDER_LABELS[providerId]}
              </button>
            ))}
          </div>
          <div className="workflow-actions">
            {(["local_ollama", "lm_studio", "nvidia_nim", "gemini", "groq", "openrouter"] as ModelProviderId[]).map((providerId) => (
              <button
                className="secondary-button"
                type="button"
                key={`reasoning-${providerId}`}
                onClick={() => void executeIntent({ kind: "set_model_provider_for_task", taskType: "reasoning", providerId })}
              >
                Reasoning: {MODEL_PROVIDER_LABELS[providerId]}
              </button>
            ))}
          </div>
          <div className="workflow-actions">
            <button className="secondary-button" type="button" onClick={() => void handleTestModelProvider("local_ollama")} disabled={isTestingModelRouter}>
              Test local router
            </button>
            <button className="secondary-button" type="button" onClick={() => void handleTestModelProvider("nvidia_nim")} disabled={isTestingModelRouter}>
              Test NVIDIA router
            </button>
            <button className="secondary-button" type="button" onClick={() => void handleTestModelProvider("gemini")} disabled={isTestingModelRouter}>
              Test Gemini router
            </button>
            <button className="secondary-button" type="button" onClick={() => void handleTestModelProvider("groq")} disabled={isTestingModelRouter}>
              Test Groq router
            </button>
            <button className="secondary-button" type="button" onClick={() => void handleTestModelProvider("openrouter")} disabled={isTestingModelRouter}>
              Test OpenRouter router
            </button>
            <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "run_model_benchmark" })} disabled={isBenchmarkingModels}>
              {isBenchmarkingModels ? "Benchmarking..." : "Run benchmark"}
            </button>
            <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "recommend_model_routes" })}>
              Recommend routes
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void executeIntent({ kind: "set_private_model_mode", localOnly: !modelRouterConfig.allowCloudForPrivateMemory })}
            >
              {modelRouterConfig.allowCloudForPrivateMemory ? "Disable private cloud" : "Local-only private mode"}
            </button>
            <button className="secondary-button" type="button" onClick={() => setModelRouterConfig(createDefaultModelRouterConfig())}>
              Reset router defaults
            </button>
          </div>
          <div className="voice-correction-box">
            <input
              value={modelComparisonPrompt}
              onChange={(event) => setModelComparisonPrompt(event.target.value)}
              placeholder="Compare models for a prompt..."
            />
            <button
              className="secondary-button"
              type="button"
              onClick={() => void executeIntent({ kind: "compare_model_responses", prompt: modelComparisonPrompt })}
              disabled={isComparingModels}
            >
              {isComparingModels ? "Comparing..." : "Compare models"}
            </button>
          </div>
          {modelComparisonRun ? (
            <div className="memory-list">
              {modelComparisonRun.results.map((result) => (
                <div className="memory-card" key={result.id}>
                  <h4>{MODEL_PROVIDER_LABELS[result.providerId]}</h4>
                  <span className="memory-meta">
                    {result.model} | {result.ok ? `${result.latencyMs}ms` : "failed"}
                  </span>
                  <p>{result.ok ? result.text : result.errorMessage}</p>
                  {result.ok ? (
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => void executeIntent({ kind: "choose_model_comparison_winner", providerId: result.providerId, taskType: modelComparisonRun.taskType })}
                    >
                      Choose as winner
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {modelBenchmarkResults.length > 0 ? (
            <div className="memory-list">
              {modelBenchmarkResults.map((result) => (
                <div className="memory-card" key={result.id}>
                  <h4>{MODEL_PROVIDER_LABELS[result.providerId]} benchmark</h4>
                  <span className="memory-meta">
                    {result.model} | {result.ok ? "reachable" : "failed"}
                    {result.latencyMs ? ` | ${result.latencyMs}ms` : ""}
                  </span>
                  <p>{result.message}</p>
                </div>
              ))}
            </div>
          ) : null}
          {modelProviderUsage.length > 0 ? (
            <div className="memory-list">
              {modelProviderUsage.slice(0, 6).map((usage) => (
                <div className="memory-card" key={usage.id}>
                  <h4>{MODEL_PROVIDER_LABELS[usage.providerId]} usage</h4>
                  <span className="memory-meta">
                    {usage.model} | {usage.taskType} | {usage.ok ? "ok" : "failed"}
                    {usage.latencyMs ? ` | ${usage.latencyMs}ms` : ""}
                    {usage.totalTokens ? ` | ${usage.totalTokens} tokens` : ""}
                  </span>
                  {usage.errorMessage ? <p>{usage.errorMessage}</p> : <p>{usage.prompt.slice(0, 160)}</p>}
                </div>
              ))}
            </div>
          ) : null}
          <span className="memory-meta">{modelRouterStatusMessage}</span>
        </div>
        <div className="local-config-card">
          <span className="memory-meta">
            Embeddings:{" "}
            {embeddingBackend === "ollama"
              ? `Ollama (${embeddingModelName || "nomic-embed-text"})`
              : embeddingBackend === "transformers"
              ? `Transformers.js (${embeddingModelName || "Xenova/all-MiniLM-L6-v2"})`
              : "local fallback"}
          </span>
          <div className="workflow-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => setEmbeddingBackend("local")}
              disabled={embeddingBackend === "local"}
            >
              Use local embeddings
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setEmbeddingBackend("ollama");
                if (!embeddingModelName || embeddingModelName.startsWith("Xenova/")) {
                  setEmbeddingModelName("nomic-embed-text");
                }
              }}
              disabled={embeddingBackend === "ollama"}
            >
              Use Ollama embeddings
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setEmbeddingBackend("transformers");
                if (!embeddingModelName || embeddingModelName === "nomic-embed-text") {
                  setEmbeddingModelName("Xenova/all-MiniLM-L6-v2");
                }
              }}
              disabled={embeddingBackend === "transformers"}
            >
              Use Transformers.js
            </button>
          </div>
          <input
            value={embeddingModelName}
            onChange={(event) => setEmbeddingModelName(event.target.value)}
            placeholder={
              embeddingBackend === "ollama"
                ? "Embedding model, e.g. nomic-embed-text"
                : "Embedding model, e.g. Xenova/all-MiniLM-L6-v2"
            }
          />
          <span className="memory-meta">{embeddingStatusMessage}</span>
        </div>
        <div className="local-config-card">
          <input value={googleCalendarClientId} onChange={(event) => setGoogleCalendarClientId(event.target.value)} placeholder="Google Calendar client ID" />
          <input value={googleCalendarApiKey} onChange={(event) => setGoogleCalendarApiKey(event.target.value)} placeholder="Google Calendar API key" />
          <button className="secondary-button" type="button" onClick={handleSaveGoogleCalendarConfig}>Save Google Calendar config</button>
          <button className="secondary-button" type="button" onClick={() => void handleConnectGoogleCalendar()}>{googleCalendarAccessToken ? "Google Calendar connected" : "Connect Google Calendar"}</button>
          <button className="secondary-button" type="button" onClick={() => void handleConnectGmail()}>{gmailAccessToken ? "Gmail connected" : "Connect Gmail"}</button>
        </div>
        <div className="local-config-card">
          <input value={spotifyClientId} onChange={(event) => setSpotifyClientId(event.target.value)} placeholder="Spotify client ID" />
          <button className="secondary-button" type="button" onClick={handleSaveSpotifyConfig}>Save Spotify config</button>
          <button className="secondary-button" type="button" onClick={() => void handleConnectSpotify()}>{spotifyAccessToken ? "Spotify connected" : "Connect Spotify"}</button>
        </div>
        <div className="local-config-card">
          <input
            value={notionTokenInput}
            onChange={(event) => setNotionTokenInput(event.target.value)}
            placeholder={notionStatus?.hasToken ? "Notion token saved locally. Re-enter only if you want to replace it." : "Notion integration token"}
          />
          <input value={notionDatabaseId} onChange={(event) => setNotionDatabaseId(event.target.value)} placeholder="Notion database ID" />
          <button className="secondary-button" type="button" onClick={handleSaveNotionConfig}>Save Notion config</button>
        </div>
        <div className="local-config-card">
          <input value={executorCommandPath} onChange={(event) => setExecutorCommandPath(event.target.value)} placeholder="Executor command path" />
          <input value={executorWorkingDirectory} onChange={(event) => setExecutorWorkingDirectory(event.target.value)} placeholder="Executor working directory" />
          <button className="secondary-button" type="button" onClick={handleSaveExecutorConfig}>Save executor bridge</button>
        </div>
        <div className="local-config-card">
          <input value={assistantName} onChange={(event) => setAssistantName(event.target.value)} placeholder="Assistant name" />
          <div className="wake-row">
            <button className="secondary-button" type="button" onClick={() => setWakeModeEnabled((current) => !current)}>{wakeModeEnabled ? "Wake mode on" : "Wake mode off"}</button>
            <button className="secondary-button" type="button" onClick={handleSaveWakeMode}>Save wake settings</button>
            <button className="secondary-button" type="button" onClick={handleWakeActivation}>Wake {assistantName}</button>
          </div>
        </div>
      </AdvancedConfigPanel>
      }
    />
  );

  const workspaceRenderers: Record<JarvisWorkspaceId, ReactNode> = {
    command: <CommandWorkspace title={workspaceRegistry.command.title} summary={workspaceRegistry.command.summary} sections={workspaceSections.command} />,
    vision: <VisionWorkspace title={workspaceRegistry.vision.title} summary={workspaceRegistry.vision.summary} sections={workspaceSections.vision} />,
    memory: <MemoryWorkspace title={workspaceRegistry.memory.title} summary={workspaceRegistry.memory.summary} sections={workspaceSections.memory} />,
    automation: <AutomationWorkspace title={workspaceRegistry.automation.title} summary={workspaceRegistry.automation.summary} sections={workspaceSections.automation} />,
    workspaces: <WorkspacesWorkspace title={workspaceRegistry.workspaces.title} summary={workspaceRegistry.workspaces.summary} sections={workspaceSections.workspaces} />,
    connections: <ConnectionsWorkspace title={workspaceRegistry.connections.title} summary={workspaceRegistry.connections.summary} sections={workspaceSections.connections} />,
    models: <ModelsWorkspace title={workspaceRegistry.models.title} summary={workspaceRegistry.models.summary} sections={workspaceSections.models} />,
    builder: <BuilderWorkspace title={workspaceRegistry.builder.title} summary={workspaceRegistry.builder.summary} sections={workspaceSections.builder} />,
  };

  const quickActionLabels: Record<string, string> = {
    listen: "Listen",
    open_cockpit: "Cockpit",
    open_system_drawer: "Systems",
    create_daily_brief: "Brief",
    read_screen: "Read screen",
    select_ocr_area: "Select area",
    open_ocr_panel: "OCR panel",
    list_birthdays: "Birthdays",
    open_memory_panel: "Memory panel",
    show_ocr_watches: "OCR watches",
    list_desktop_schedules: "Schedules",
    open_automation_panel: "Automation panel",
    open_coding_workspace: "Coding workspace",
    list_desktop_projects: "Projects",
    open_workspaces_panel: "Workspace panel",
    show_unread_emails: "Unread email",
    spotify_status: "Spotify",
    open_integrations_panel: "Connections panel",
    open_models_workspace: "Models",
    run_project_checks: "Run checks",
    open_project_in_vscode: "Open project",
    open_builder_panel: "Builder panel",
  };

  const quickBarShortcuts = workspaceRegistry[uiState.activeWorkspaceId].quickActions.map((actionId) => (
    <button
      type="button"
      key={actionId}
      onClick={() =>
        void executeUiQuickAction(actionId, {
          dispatch: dispatchUi,
          runCommand: (command) => {
            void runCommand(command);
          },
          handleVoiceStart,
        })
      }
      disabled={isRoutingCommand && actionId !== "listen" && actionId !== "open_cockpit" && actionId !== "open_system_drawer"}
    >
      {quickActionLabels[actionId] ?? actionId}
    </button>
  ));

  const quickBarNode = (
    <QuickBar
      visible={uiState.quickBar.visible}
      placement={uiState.quickBar.placement}
      position={uiState.quickBar.position}
      voicePhase={voiceSessionPhase}
      brainLabel={
        conversationBackend === "ollama"
          ? "Ollama"
          : conversationBackend === "auto"
          ? "Auto"
          : "Heuristics"
      }
      input={shellBarInput}
      onInputChange={setShellBarInput}
      onSubmit={submitShellBarCommand}
      onListen={handleVoiceStart}
      onHide={() => dispatchUi({ type: "setQuickBarVisibility", visible: false })}
      onRestore={() => dispatchUi({ type: "setQuickBarVisibility", visible: true })}
      onPinToggle={() => pinShellBar(shellBarPlacement === "top" ? "bottom" : "top")}
      onStartDrag={(clientX, clientY, rect) =>
        setShellBarDragState({
          offsetX: clientX - rect.left,
          offsetY: clientY - rect.top,
        })
      }
      shortcuts={quickBarShortcuts}
      isRoutingCommand={isRoutingCommand}
    />
  );

  const cockpitOverlayNode = (
    <CockpitOverlay
      open={uiState.isCockpitOpen}
      title={`${assistantName} operating layer`}
      subtitle="Focused command space for missions, modules, and live state. The normal app stays underneath, but this is the use-it-like-JARVIS surface."
      actions={
        <>
          <button className="secondary-button" type="button" onClick={handleVoiceStart}>
            Listen
          </button>
          <button className="secondary-button" type="button" onClick={() => dispatchUi({ type: "closeCockpit" })}>
            Exit cockpit
          </button>
        </>
      }
      core={
        <div className="cockpit-core-card">
          <div className={`cockpit-core ${voiceSessionPhase}`}>
            <span>{assistantName.slice(0, 1).toUpperCase()}</span>
          </div>
          <h3>{voiceSessionPhase === "listening" ? "Listening" : voiceSessionPhase === "processing" ? "Thinking" : "Ready"}</h3>
          <p>{statusMessage}</p>
        </div>
      }
      signals={
        <div className="cockpit-signal-grid">
          {cockpitSignals.map((signal) => (
            <div className="cockpit-signal" key={signal.label}>
              <span>{signal.label}</span>
              <strong>{signal.value}</strong>
            </div>
          ))}
        </div>
      }
      missions={
        <div className="cockpit-mission-card">
          <p className="section-kicker">Mission Launcher</p>
          <div className="cockpit-mission-grid">
            {cockpitMissionPrompts.map((prompt) => (
              <button
                type="button"
                key={prompt}
                onClick={() => {
                  setInput(prompt);
                  void runCommand(prompt);
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      }
      modules={
        <div className="cockpit-module-stack">
          <GatewayTracePanel
            livePreview={gatewayPreview}
            livePreviewError={gatewayPreviewError}
            isPreviewing={isPreviewingGateway}
          />
          <div className="cockpit-module-dock">
            <p className="section-kicker">Modules</p>
            <div className="cockpit-module-grid">
              {jarvisModules.map((module) => (
                <button
                  className={`accent-${module.accent}`}
                  type="button"
                  key={module.id}
                  onClick={() => openJarvisPanel(module.id)}
                >
                  <span>{module.name}</span>
                  <small>{module.description}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      }
    />
  );

  const floatingPanelsNode = (
    <FloatingPanelHost
      panels={jarvisPanels}
      titleForPanel={(panelId) => jarvisModules.find((module) => module.id === panelId)?.name ?? panelId}
      accentForPanel={(panelId) => jarvisModules.find((module) => module.id === panelId)?.accent ?? "cyan"}
      onStartDrag={(panelId, clientX, clientY, rect) =>
        setPanelDragState({
          id: panelId,
          offsetX: clientX - rect.left,
          offsetY: clientY - rect.top,
        })
      }
      onToggle={toggleJarvisPanel}
      onClose={(panelId) => closeJarvisPanel(panelId)}
      renderPanelContent={renderJarvisPanelContent}
    />
  );

  const systemDrawerNode = (
    <SystemDrawer
      open={uiState.systemDrawerOpen}
      onClose={() => dispatchUi({ type: "setSystemDrawerOpen", open: false })}
    >
      {systemDrawerContent}
    </SystemDrawer>
  );

  const homeHeroNode = (
    <section className="hero-panel">
      <div className="hero-copy">
        <p className="eyebrow">Personal Assistant Platform</p>
        <h1>JARVIS</h1>
        <p className="hero-text">
          A modular desktop assistant for launching apps, handling web tasks, and growing into your daily operating layer.
        </p>
      </div>

      <div className="status-card">
        <span className="status-label">Core status</span>
        <div className={`wake-cue ${wakeCueActive ? "active" : ""}`}>
          {wakeCueActive ? `${assistantName} woke up` : "Wake cue idle"}
        </div>
        <p>{statusMessage}</p>
        <button className="secondary-button" onClick={pingCore}>
          Test native bridge
        </button>
        <button className="secondary-button" type="button" onClick={() => dispatchUi({ type: "openCockpit" })}>
          Open cockpit
        </button>
      </div>
    </section>
  );

  const homeDataSphereNode = (
    <DataSphere
      title="System map"
      summary="A cinematic control layer for JARVIS. Each orbit node opens the related workspace and matching inspector so the home core stays useful, not decorative."
      actions={
        <>
          <button className="primary-button" type="button" onClick={() => dispatchUi({ type: "openCockpit" })}>
            Open cockpit
          </button>
          <button className="secondary-button" type="button" onClick={() => void runCommand("Create daily brief")}>
            Daily brief
          </button>
          <button className="secondary-button" type="button" onClick={handleVoiceStart}>
            Listen
          </button>
        </>
      }
      voicePhase={voiceSessionPhase}
      coreLabel={assistantName.slice(0, 1).toUpperCase()}
      nodes={dataSphereNodes.map((node) => ({
        label: node.label,
        value: node.value,
        angle: node.angle,
        active: uiState.selectedDataSphereNode === node.app || uiState.activeWorkspaceId === node.app,
      }))}
      onNodeClick={(label) => {
        const node = dataSphereNodes.find((item) => item.label === label);
        if (!node) {
          return;
        }
        dispatchUi({ type: "setSelectedDataSphereNode", workspaceId: node.app });
        dispatchUi({ type: "setWorkspace", workspaceId: node.app });
        openJarvisPanel(node.panel);
      }}
    />
  );

  const homeSummaryNode = (
    <section className="jarvis-shell-panel">
      <div className="jarvis-core-orbit" aria-hidden="true">
        <div className="jarvis-core">
          <span>{jarvisPanels.length}</span>
          <small>panels</small>
        </div>
      </div>
      <div className="shell-copy">
        <p className="section-kicker">JARVIS Shell</p>
        <h2>Modular command space</h2>
        <p>
          Open assistant modules as floating inspectors, drag them around, and close or minimize them by voice.
          Try: `open OCR panel`, `show memory`, `minimize voice panel`, or `close all panels`.
        </p>
        <div className="shell-status-strip">
          <span>{activeOcrWatches.length} OCR watch{activeOcrWatches.length === 1 ? "" : "es"}</span>
          <span>{memoryTotal} memory card{memoryTotal === 1 ? "" : "s"}</span>
          <span>{connectedIntegrations.length} integration{connectedIntegrations.length === 1 ? "" : "s"}</span>
        </div>
        <button className="primary-button shell-cockpit-button" type="button" onClick={() => dispatchUi({ type: "openCockpit" })}>
          Enter cockpit mode
        </button>
      </div>
      <div className="shell-module-grid">
        {jarvisModules.map((module) => (
          <button
            className={`shell-module-card accent-${module.accent}`}
            type="button"
            key={module.id}
            onClick={() => openJarvisPanel(module.id)}
          >
            <span>{module.name}</span>
            <small>{module.description}</small>
          </button>
        ))}
      </div>
    </section>
  );

  const launchpadPreview = (
    <article className={`home-app-stage accent-${activeHomeAppRecord.accent}`}>
      <div>
        <p className="section-kicker">{activeHomeAppRecord.kicker}</p>
        <h3>{activeHomeAppRecord.title}</h3>
        <p>{activeHomeAppRecord.description}</p>
      </div>
      <div className="home-app-actions">
        {activeHomeAppRecord.actions.map((action) => (
          <button
            className="secondary-button"
            type="button"
            key={action.label}
            onClick={() => {
              if (action.command === "__listen__") {
                handleVoiceStart();
              } else if (action.command === "__models__") {
                dispatchUi({ type: "setWorkspace", workspaceId: "models" });
                dispatchUi({ type: "setSurface", surface: "workspace" });
              } else if (action.command) {
                setInput(action.command);
                void runCommand(action.command);
              } else if (action.panel) {
                openJarvisPanel(action.panel);
              } else if (action.cockpit) {
                dispatchUi({ type: "openCockpit" });
              }
            }}
            disabled={isRoutingCommand && Boolean(action.command && action.command !== "__listen__" && action.command !== "__models__")}
          >
            {action.label}
          </button>
        ))}
      </div>
      <div className="home-app-preview">
        {activeHomeApp === "command" ? (
          <>
            <strong>{commandResult?.title ?? "Ready for the next command"}</strong>
            <p>{commandResult?.detail ?? "Type or say a command to route actions through JARVIS."}</p>
          </>
        ) : activeHomeApp === "vision" ? (
          <>
            <strong>{ocrHistory[0]?.target ?? "No OCR yet"}</strong>
            <p>{ocrHistory[0]?.summary ?? "Try `read my screen` or `select OCR area`."}</p>
          </>
        ) : activeHomeApp === "memory" ? (
          <>
            <strong>{memoryTotal} memory cards saved</strong>
            <p>People, travel, expenses, packages, meetings, and school plans all feed your daily brief.</p>
          </>
        ) : activeHomeApp === "automation" ? (
          <>
            <strong>{savedWorkflows.length + ocrWatchTargets.length} active rules</strong>
            <p>OCR watches, saved workflows, schedules, and cross-feature follow-through stay here.</p>
          </>
        ) : activeHomeApp === "workspaces" ? (
          <>
            <strong>{desktopProjects.length} desktop workspace{desktopProjects.length === 1 ? "" : "s"}</strong>
            <p>Open saved app/folder/site bundles or schedule workspace launches.</p>
          </>
        ) : activeHomeApp === "connections" ? (
          <>
            <strong>{connectedIntegrations.length} live connection{connectedIntegrations.length === 1 ? "" : "s"}</strong>
            <p>Google, Gmail, Notion, Spotify, Ollama, and executor settings stay available in the system drawer.</p>
          </>
        ) : activeHomeApp === "models" ? (
          <>
            <strong>{MODEL_PROVIDER_LABELS[modelRouterConfig.defaultProvider]} is the chat default</strong>
            <p>Benchmarks, comparisons, safe drafts, private mode, and provider routing now live in Models.</p>
          </>
        ) : (
          <>
            <strong>{executorStatus?.configured ? "Executor configured" : "Executor not configured"}</strong>
            <p>Project checks, handoffs, and local coding bridge controls live here.</p>
          </>
        )}
      </div>
    </article>
  );

  const homeLaunchpadNode = (
    <AppLaunchpad
      items={jarvisHomeApps.map((app) => ({
        id: app.id,
        title: app.title,
        stat: app.stat,
        accent: app.accent,
      }))}
      activeWorkspaceId={uiState.activeWorkspaceId}
      onSelect={(workspaceId) => dispatchUi({ type: "setWorkspace", workspaceId })}
      preview={launchpadPreview}
      actions={
        <>
          <button className="secondary-button" type="button" onClick={() => dispatchUi({ type: "openCockpit" })}>
            Full cockpit
          </button>
          <button className="secondary-button" type="button" onClick={resetJarvisUiPreferences}>
            Reset layout
          </button>
        </>
      }
      title="Choose a working surface"
      summary="Pick the app you want, run focused actions, and keep advanced config tucked into one system drawer."
    />
  );

  const homeSurface = (
    <>
      {homeHeroNode}
      {homeDataSphereNode}
      {homeSummaryNode}
      {homeLaunchpadNode}
    </>
  );

  const jarvisAppContextValue = {
    input,
    setInput,
    isRoutingCommand,
    commandRouter,
    dispatchUi,
  };

  return (
    <main
      className="app-shell"
      onMouseMove={(event) => {
        moveJarvisPanel(event.clientX, event.clientY);
        moveShellBar(event.clientX, event.clientY);
      }}
      onMouseUp={() => {
        setPanelDragState(null);
        setShellBarDragState(null);
      }}
      onMouseLeave={() => {
        setPanelDragState(null);
        setShellBarDragState(null);
      }}
    >
      {isOcrSelecting ? (
        <div
          className="ocr-selection-overlay"
          role="presentation"
          onMouseDown={(event) => {
            setOcrSelection({
              startX: event.screenX,
              startY: event.screenY,
              currentX: event.screenX,
              currentY: event.screenY,
              viewStartX: event.clientX,
              viewStartY: event.clientY,
              viewCurrentX: event.clientX,
              viewCurrentY: event.clientY,
            });
          }}
          onMouseMove={(event) => {
            setOcrSelection((current) =>
              current
                ? {
                    ...current,
                    currentX: event.screenX,
                    currentY: event.screenY,
                    viewCurrentX: event.clientX,
                    viewCurrentY: event.clientY,
                  }
                : current,
            );
          }}
          onMouseUp={(event) => {
            if (!ocrSelection) {
              return;
            }
            const rect = {
              x: Math.min(ocrSelection.startX, event.screenX),
              y: Math.min(ocrSelection.startY, event.screenY),
              width: Math.abs(event.screenX - ocrSelection.startX),
              height: Math.abs(event.screenY - ocrSelection.startY),
            };
            if (rect.width < 20 || rect.height < 20) {
              setOcrSelection(null);
              setStatusMessage("OCR selection was too small. Drag a larger box.");
              return;
            }
            void completeOcrSelection(rect);
          }}
        >
          <div className="ocr-selection-help">
            <strong>Select OCR area</strong>
            <span>Drag a box over text. Press Cancel to stop.</span>
            <button
              className="secondary-button"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setIsOcrSelecting(false);
                setOcrSelection(null);
                setStatusMessage("OCR selection cancelled.");
              }}
            >
              Cancel
            </button>
          </div>
          {selectionRect ? (
            <div
              className="ocr-selection-box"
              style={{
                left: `${selectionRect.left}px`,
                top: `${selectionRect.top}px`,
                width: `${selectionRect.width}px`,
                height: `${selectionRect.height}px`,
              }}
            />
          ) : null}
        </div>
      ) : null}
      <JarvisAppProvider value={jarvisAppContextValue}>
        <JarvisShell
          uiState={uiState}
          quickBar={quickBarNode}
          cockpitOverlay={cockpitOverlayNode}
          floatingPanels={floatingPanelsNode}
          systemDrawer={systemDrawerNode}
          homeSurface={homeSurface}
          workspaceRenderers={workspaceRenderers}
          onBackHome={() => dispatchUi({ type: "setSurface", surface: "home" })}
        />
      </JarvisAppProvider>
      {/* Legacy vertically stacked UI removed after migration into shell/workspaces. */}
    </main>
  );
}

