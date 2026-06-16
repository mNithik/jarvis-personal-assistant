import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type {
  BrowserAliasRecord,
  EmailRecord,
  FileRecord,
  LearnedIntentRecord,
  NoteRecord,
} from "../../types/jarvis";
import type { ConversationBackend } from "../../types/voice";
import type { GatewayConfig, GatewayPreview } from "../../services/jarvisApi";
import type { SpotifyPlaybackState } from "../../services/spotify";
import type {
  ActiveConversationContext,
  CommandIntent,
  CrossFeatureSuggestionRecord,
  FollowUpWindow,
  DesktopPermissionSettings,
  DesktopProjectRecord,
  DesktopScheduleRecord,
  JarvisModuleDescriptor,
  JarvisPanelId,
  ExpenseMemoryRecord,
  GeneratedModelDraft,
  MeetingPrepMemoryRecord,
  ModelBenchmarkResult,
  ModelComparisonResult,
  ModelComparisonRun,
  ModelProviderId,
  ModelRouteDecision,
  ModelRouterConfig,
  ModelRouterTestResult,
  ModelTaskType,
  OcrCaptureTarget,
  OcrCorrectionRecord,
  OcrHistoryMeta,
  OcrHistoryRecord,
  OcrScope,
  OcrSnapshot,
  OcrWatchTarget,
  OcrWatchTemplate,
  PackageMemoryRecord,
  PendingClarification,
  PersonMemoryRecord,
  PlannerTaskRecord,
  PresentedCollectionContext,
  SavedWorkflowRecord,
  SchoolPlanMemoryRecord,
  SemanticConversationMemoryRecord,
  SemanticIntentFeedbackRecord,
  SemanticIntentDebugMatch,
  PendingWorkflowExecution,
  TrainingModeSession,
  TravelMemoryRecord,
  UserPreferenceMemory,
  VoiceReplyMode,
  ConversationTopicRecord,
  EmbeddingBackend,
  WorkflowStepResolution,
} from "./jarvisCommandTypes";
import type { BuildHandoffArtifact, MissingSkillPlan, SkillBuildRequest } from "../../types/jarvis";
import type { VoiceSessionPhase, WakeModeStatus } from "../../types/voice";
import type { JarvisUiAction } from "../../ui/model/uiReducer";

export type CommandResult = {
  title: string;
  detail: string;
  routeLabel?: string;
};

export type PendingGatewayConfirmation = {
  command: string;
  preview: GatewayPreview;
};

export type PendingGatewayTeaching = {
  phrase: string;
  preview: GatewayPreview;
};

export type GatewayHistoryKind =
  | "preview"
  | "confirm_requested"
  | "confirm_accepted"
  | "confirm_cancelled"
  | "teach_requested"
  | "teach_saved"
  | "teach_cancelled";

type Setter<T> = Dispatch<SetStateAction<T>>;

export type CommandRouterStateDeps = {
  activeConversationContext?: ActiveConversationContext | null;
  input?: string;
  assistantName?: string;
  autonomousSkillBuildingEnabled?: boolean;
  browserAliases?: BrowserAliasRecord[];
  commandResult?: CommandResult | null;
  conversationBackend?: ConversationBackend;
  desktopPermissionSettings?: DesktopPermissionSettings;
  desktopProjects?: DesktopProjectRecord[];
  desktopSchedules?: DesktopScheduleRecord[];
  expenseMemory?: ExpenseMemoryRecord[];
  gatewayConfig?: GatewayConfig | null;
  gatewayEnabled?: boolean;
  gatewaySessionRef?: MutableRefObject<string>;
  currentRouteLabelRef?: MutableRefObject<string | undefined>;
  gmailAccessToken?: string | null;
  googleCalendarAccessToken?: string | null;
  lastConversationTopic?: ConversationTopicRecord | null;
  lastOcrText?: string;
  lastScreenshotPath?: string | null;
  lastSemanticIntentMatches?: SemanticIntentDebugMatch[];
  latestGeneratedDraft?: GeneratedModelDraft | null;
  learnedIntentMappings?: LearnedIntentRecord[];
  meetingPrepMemory?: MeetingPrepMemoryRecord[];
  ocrHistory?: OcrHistoryRecord[];
  ocrWatchTargets?: OcrWatchTarget[];
  ocrWatchTemplates?: OcrWatchTemplate[];
  packageMemory?: PackageMemoryRecord[];
  peopleMemory?: PersonMemoryRecord[];
  plannerTasks?: PlannerTaskRecord[];
  recentEmails?: EmailRecord[];
  recentFiles?: FileRecord[];
  recentNotes?: NoteRecord[];
  savedWorkflows?: SavedWorkflowRecord[];
  schoolPlanMemory?: SchoolPlanMemoryRecord[];
  semanticConversationMemory?: SemanticConversationMemoryRecord[];
  semanticIntentFeedback?: SemanticIntentFeedbackRecord[];
  spotifyAccessToken?: string | null;
  teachingTargetPhrase?: string | null;
  trainingModeSession?: TrainingModeSession | null;
  travelMemory?: TravelMemoryRecord[];
  userPreferenceMemory?: UserPreferenceMemory;
  voiceReplyMode?: VoiceReplyMode;
  pendingClarification?: PendingClarification | null;
  pendingGatewayConfirmation?: PendingGatewayConfirmation | null;
  pendingGatewayTeaching?: PendingGatewayTeaching | null;
  pendingWorkflowExecution?: PendingWorkflowExecution | null;
  presentedCollectionContext?: PresentedCollectionContext | null;
  proactiveCrossSuggestion?: CrossFeatureSuggestionRecord | null;
  jarvisModules?: JarvisModuleDescriptor[];
  skillAutopilotAvailable?: boolean;
};

export type CommandRouterSetterDeps = {
  setActiveConversationContext?: Setter<ActiveConversationContext | null>;
  setBuildRequest?: Setter<SkillBuildRequest | null>;
  setCommandResult?: Setter<CommandResult | null>;
  setConversationBackend?: Setter<ConversationBackend>;
  setCrossFeatureSuggestions?: Setter<CrossFeatureSuggestionRecord[]>;
  setDesktopPermissionSettings?: Setter<DesktopPermissionSettings>;
  setDesktopProjects?: Setter<DesktopProjectRecord[]>;
  setDesktopSchedules?: Setter<DesktopScheduleRecord[]>;
  setGatewayPreview?: ((value: GatewayPreview | null) => void) | Setter<GatewayPreview | null>;
  setGatewayPreviewError?: ((value: string | null) => void) | Setter<string | null>;
  setHandoffArtifact?: Setter<BuildHandoffArtifact | null>;
  setIsRoutingCommand?: Setter<boolean>;
  setLastOcrText?: Setter<string>;
  setLastScreenshotPath?: Setter<string | null>;
  setLastSemanticIntentMatches?: Setter<SemanticIntentDebugMatch[]>;
  setMissingSkillPlan?: Setter<MissingSkillPlan | null>;
  setMissingSkillRequest?: Setter<string | null>;
  setOcrCorrections?: Setter<OcrCorrectionRecord[]>;
  setOcrHistory?: Setter<OcrHistoryRecord[]>;
  setOcrWatchMatches?: Setter<OcrHistoryRecord[]>;
  setOcrWatchTargets?: Setter<OcrWatchTarget[]>;
  setOcrWatchTemplates?: Setter<OcrWatchTemplate[]>;
  setPendingClarification?: Setter<PendingClarification | null>;
  setPendingGatewayConfirmation?: Setter<PendingGatewayConfirmation | null>;
  setPendingGatewayTeaching?: Setter<PendingGatewayTeaching | null>;
  setPendingWorkflowExecution?: Setter<PendingWorkflowExecution | null>;
  setPlannerTasks?: Setter<PlannerTaskRecord[]>;
  setPreferredModelProvider?: (
    taskType: "chat" | "coding" | "reasoning",
    providerId: ModelProviderId,
  ) => void;
  setPresentedCollectionContext?: Setter<PresentedCollectionContext | null>;
  setProactiveCrossSuggestion?: Setter<CrossFeatureSuggestionRecord | null>;
  setRecentEmails?: Setter<EmailRecord[]>;
  setRecentFiles?: Setter<FileRecord[]>;
  setRecentNotes?: Setter<NoteRecord[]>;
  setSpotifyPlaybackState?: Setter<SpotifyPlaybackState | null>;
  setStatusMessage?: Setter<string>;
  setTeachingTargetPhrase?: Setter<string | null>;
  setUserPreferenceMemory?: Setter<UserPreferenceMemory>;
  setVoiceReplyMode?: Setter<VoiceReplyMode>;
  setVoiceSessionPhase?: Setter<VoiceSessionPhase>;
  setWakeModeEnabled?: Setter<boolean>;
  setWakeModeStatus?: Setter<WakeModeStatus | null>;
};

export type CommandRouterHandlerDeps = {
  appendConversationTurn?: Function;
  beginOcrSelection?: Function;
  buildCachedSemanticIntentEmbedding?: (
    text: string,
  ) => Promise<{ embedding: number[]; backend: EmbeddingBackend }>;
  buildCrossFeatureSuggestionsForEmail?: Function;
  buildCrossFeatureSuggestionsForState?: Function;
  buildSemanticEmbeddingWithFallback?: (text: string) => Promise<{ embedding: number[]; backend: EmbeddingBackend }>;
  captureOcrSnapshot?: Function;
  chooseModelComparisonWinner?: Function;
  closeJarvisPanel?: Function;
  compareModelResponses?: Function;
  continuePendingWorkflowExecution?: Function;
  createDesktopProject?: Function;
  createDesktopProjectFromTemplate?: Function;
  deleteDesktopProject?: Function;
  findDesktopProject?: Function;
  generateSafeModelDraft?: Function;
  handleAskAdvancedAssistant?: Function;
  handleConversationContextStackCommand?: Function;
  handleTestModelProvider?: Function;
  handleTrainingModeInput?: Function;
  handleTrainingReviewCleanupCommand?: Function;
  isSensitiveModelPrompt?: Function;
  loadMemoryView?: Function;
  loadPlannerTaskRecords?: () => Promise<PlannerTaskRecord[]>;
  loadRecentNotes?: Function;
  minimizeJarvisPanel?: Function;
  openFollowUpWindow?: Function;
  openJarvisPanel?: Function;
  pickProactiveCrossSuggestion?: Function;
  pushGatewayHistory?: Function;
  recommendModelRoutesFromHistory?: Function;
  refreshGatewayPreview?: Function;
  refreshSpotifyPlayback?: Function;
  rememberExpenseSummary?: Function;
  rememberMeetingPrepSummary?: Function;
  rememberOcrHistory?: Function;
  rememberPackageSummary?: Function;
  rememberPersonBirthday?: Function;
  rememberRejectedPendingSemanticClarification?: Function;
  rememberSchoolPlan?: Function;
  rememberSemanticConversationTurn?: Function;
  rememberSemanticIntentFeedback?: Function;
  rememberSuccessfulPhrase?: Function;
  rememberTravelSummary?: Function;
  rememberWorkflowSequence?: Function;
  resolveModelRoute?: (prompt: string, taskType?: ModelTaskType) => ModelRouteDecision;
  returnToArmedWakeMode?: Function;
  runModelBenchmark?: Function;
  shouldKeepFollowUpWindowOpen?: Function;
  speakIfEnabled?: Function;
  startTrainingMode?: Function;
  stopHandsFreeSession?: Function;
  teachJarvisMeaning?: Function;
  teachJarvisWorkflow?: Function;
  updateDesktopProject?: (
    query: string,
    updater: (entry: DesktopProjectRecord) => DesktopProjectRecord,
  ) => DesktopProjectRecord | null;
  updateModelRouterConfig?: Function;
  updatePersonMemory?: (
    query: string,
    updater: (entry: PersonMemoryRecord) => PersonMemoryRecord,
  ) => PersonMemoryRecord | null;
  dispatchUi?: Function;
};

export type CommandRouterDeps = Partial<
  CommandRouterStateDeps & CommandRouterSetterDeps & CommandRouterHandlerDeps
> &
  Record<string, unknown>;
