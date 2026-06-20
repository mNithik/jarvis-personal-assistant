import type React from "react";
import { FormEvent } from "react";
import type {
  BrowserAliasRecord,
  BuildHandoffArtifact,
  EmailRecord,
  FileRecord,
  HistoryRecord,
  LearnedIntentRecord,
  MissingSkillPlan,
  NoteRecord,
  ProposalRecord,
  RoutineRecord,
  SkillBuildRequest,
  SkillImplementationRequest,
  VoiceCorrectionRecord,
} from "../../../types/jarvis";
import type {
  ExecutorStatus,
  SpeechRecognitionState,
  VoiceBackend,
  VoiceSessionPhase,
} from "../../../types/voice";
import type { GatewayEvent, GatewayPreview } from "../../../services/jarvisApi";
import type {
  ActiveConversationContext,
  ConversationContextStackEntry,
  ConversationTopicRecord,
  ConversationTurn,
  CrossFeatureSuggestionRecord,
  DesktopPermissionSettings,
  DesktopProjectRecord,
  DesktopScheduleRecord,
  EmbeddingBackend,
  ExpenseMemoryRecord,
  FollowUpWindow,
  GeneratedModelDraft,
  MeetingPrepMemoryRecord,
  ModelBenchmarkResult,
  ModelComparisonRun,
  ModelProviderId,
  ModelProviderUsageRecord,
  ModelRouterConfig,
  ModelRouterTestResult,
  OcrHistoryRecord,
  OcrWatchTarget,
  PackageMemoryRecord,
  PendingClarification,
  PendingWorkflowExecution,
  PersonMemoryRecord,
  PlannerTaskRecord,
  SavedWorkflowRecord,
  SchoolPlanMemoryRecord,
  SemanticConversationMemoryRecord,
  SemanticIntentDebugMatch,
  SemanticIntentFeedbackRecord,
  TrainingModeSession,
  UserPreferenceMemory,
  WorkflowSuggestionRecord,
} from "../../../features/command/jarvisCommandTypes";
import type { JarvisUiAction } from "../../model/uiReducer";
import type { CommandIntent } from "../../../features/legacy/appHelpers";

type GatewayHistoryEntry = {
  id: string;
  kind: string;
  command: string;
  capabilityLabel: string;
  decisionPolicy: string;
  confidence: string;
  detail: string;
  createdAt: string;
};

type PendingGatewayConfirmation = {
  command: string;
  preview: GatewayPreview;
};

type PendingGatewayTeaching = {
  phrase: string;
  preview: GatewayPreview;
};

export type CommandSectionProps = {
  activeConversationContext: ActiveConversationContext | null;
  assistantName: string;
  browserAliases: BrowserAliasRecord[];
  commandResult: { title: string; detail: string; routeLabel?: string } | null;
  conversationContextStack: ConversationContextStackEntry[];
  conversationTurns: ConversationTurn[];
  followUpWindow: FollowUpWindow | null;
  gatewayFollowUp: string | null;
  gatewayHistory: GatewayHistoryEntry[];
  gatewayPreviewError: string | null;
  localRecorderRef: React.MutableRefObject<{ stop: () => Promise<string> } | null>;
  pendingGatewayConfirmation: PendingGatewayConfirmation | null;
  pendingGatewayTeaching: PendingGatewayTeaching | null;
  handleDeleteLearnedIntent: (record: LearnedIntentRecord) => void | Promise<void>;
  handleDeleteWorkflow: (workflow: SavedWorkflowRecord) => void;
  handleRenameLearnedIntent: (record: LearnedIntentRecord) => void | Promise<void>;
  handleRenameWorkflow: (workflow: SavedWorkflowRecord) => void;
  handleVoiceStart: () => void;
  input: string;
  isPreviewingGateway: boolean;
  isRoutingCommand: boolean;
  lastConversationTopic: ConversationTopicRecord | null;
  lastSemanticIntentMatches: SemanticIntentDebugMatch[];
  learnedIntentFamilies: Array<{
    key: string;
    label: string;
    phraseCount: number;
    totalUseCount: number;
    examplePhrases: string[];
  }>;
  learnedIntentMappings: LearnedIntentRecord[];
  learnedIntentRenameDrafts: Record<string, string>;
  pendingClarification: PendingClarification | null;
  plannerTasks: PlannerTaskRecord[];
  quickPrompts: string[];
  recentEmails: EmailRecord[];
  recentFiles: FileRecord[];
  recentHistory: HistoryRecord[];
  recentNotes: NoteRecord[];
  routeCommand: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  savedWorkflows: SavedWorkflowRecord[];
  semanticConversationMemory: SemanticConversationMemoryRecord[];
  semanticIntentFeedback: SemanticIntentFeedbackRecord[];
  setInput: (value: string) => void;
  setLearnedIntentRenameDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setVoiceResponseEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setWorkflowRenameDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  trainingModeSession: TrainingModeSession | null;
  userPreferenceMemory: UserPreferenceMemory;
  visibleGatewayPreview: GatewayPreview | null;
  voiceBackend: VoiceBackend;
  voiceCorrections: VoiceCorrectionRecord[];
  voiceResponseEnabled: boolean;
  voiceSessionPhase: VoiceSessionPhase;
  voiceState: SpeechRecognitionState;
  voiceTranscript: string;
  workflowRenameDrafts: Record<string, string>;
  embeddingBackend: EmbeddingBackend;
  embeddingModelName: string;
  embeddingStatusMessage: string;
};

export type VisionSectionProps = {
  activeOcrWatches: OcrWatchTarget[];
  isRoutingCommand: boolean;
  ocrHistory: OcrHistoryRecord[];
  ocrWatchMatches: OcrHistoryRecord[];
  ocrWatchTargets: OcrWatchTarget[];
  primaryOcrWatch: OcrWatchTarget | null;
  runCommand: (command: string) => void | Promise<unknown>;
};

export type MemorySectionProps = {
  displayExpenseMemory: ExpenseMemoryRecord[];
  displayMeetingPrepMemory: MeetingPrepMemoryRecord[];
  displayPackageMemory: PackageMemoryRecord[];
  displayPeopleMemory: PersonMemoryRecord[];
  displaySchoolPlanMemory: SchoolPlanMemoryRecord[];
  displayTravelMemory: Array<{ title: string }>;
  lastKnowledgeRecall: GatewayEvent | null;
  memoryTotal: number;
  rustExpenseMemory: ExpenseMemoryRecord[] | null;
  rustMeetingPrepMemory: MeetingPrepMemoryRecord[] | null;
  rustPackageMemory: PackageMemoryRecord[] | null;
  rustPeopleMemory: PersonMemoryRecord[] | null;
  rustSchoolPlanMemory: SchoolPlanMemoryRecord[] | null;
  rustTravelMemory: Array<{ title: string }> | null;
  googleCalendarAccessToken?: string | null;
  nextMeetingEvent?: { summary: string; start?: string | null } | null;
  meetingPrepStatus?: string;
  runCommand?: (command: string) => void | Promise<unknown>;
  gmailAccessToken?: string | null;
  memoryEntityControls?: MemoryEntityControlRecord[];
  onPinMemory?: (entityId: number, domain: string) => void;
  onForgetMemory?: (entityId: number, domain: string) => void;
};

export type EmailSectionProps = {
  gmailAccessToken?: string | null;
  runCommand?: (command: string) => void | Promise<unknown>;
};

export type MemoryEntityControlRecord = {
  entityId: number;
  domain: string;
  label: string;
  pinned: boolean;
  forgotten: boolean;
  confidence: string;
};

export type AutomationSectionProps = {
  crossFeatureSuggestions: CrossFeatureSuggestionRecord[];
  pendingWorkflowExecution: PendingWorkflowExecution | null;
  proposals: ProposalRecord[];
  savedWorkflows: SavedWorkflowRecord[];
  storedRoutines: RoutineRecord[];
  workflowSuggestion: WorkflowSuggestionRecord | null;
};

export type WorkspacesSectionProps = {
  desktopPermissionSettings: DesktopPermissionSettings;
  desktopProjects: DesktopProjectRecord[];
  desktopSchedules: DesktopScheduleRecord[];
  executeIntent: (intent: CommandIntent) => void | Promise<boolean | undefined>;
  setDesktopPermissionSettings: React.Dispatch<React.SetStateAction<DesktopPermissionSettings>>;
};

export type ConnectionsSectionProps = {
  backendComparePrompt: string;
  backendComparison: {
    prompt: string;
    heuristics: string;
    heuristicsAction: string;
    ollama: string;
    ollamaAction: string;
    autoRouteLabel?: string;
    autoReason?: string;
    autoDecision?: string;
  } | null;
  conversationBackend: "heuristics" | "ollama" | "auto";
  setBackendComparePrompt: (value: string) => void;
  setConversationBackend: (value: "heuristics" | "ollama" | "auto") => void;
  executeIntent: (intent: CommandIntent) => void | Promise<boolean | undefined>;
  gmailAccessToken: string | null;
  googleCalendarAccessToken: string | null;
  handleCompareConversationBackends: () => void | Promise<void>;
  handleTestModelProvider: (providerId: ModelProviderId) => void | Promise<void>;
  isBenchmarkingModels: boolean;
  isComparingBackends: boolean;
  isTestingModelRouter: boolean;
  latestGeneratedDraft: GeneratedModelDraft | null;
  modelBenchmarkResults: ModelBenchmarkResult[];
  modelComparisonRun: ModelComparisonRun | null;
  modelProviderUsage: ModelProviderUsageRecord[];
  modelRouterConfig: ModelRouterConfig;
  modelRouterStatusMessage: string;
  modelRouterTestResult: ModelRouterTestResult | null;
  notionStatus: { hasToken?: boolean } | null;
  ollamaStatus: { configured?: boolean } | null;
  runCommand: (command: string) => void | Promise<unknown>;
  shouldAutoRouteVoice: boolean;
  spotifyAccessToken: string | null;
  dispatchUi: (action: JarvisUiAction) => void;
};

export type ModelsSectionProps = {
  executeIntent: (intent: CommandIntent) => void | Promise<boolean | undefined>;
  isBenchmarkingModels: boolean;
  isComparingModels: boolean;
  latestGeneratedDraft: GeneratedModelDraft | null;
  modelBenchmarkResults: ModelBenchmarkResult[];
  modelComparisonPrompt: string;
  setModelComparisonPrompt: (value: string) => void;
  modelComparisonRun: ModelComparisonRun | null;
  modelRouterConfig: ModelRouterConfig;
  modelRouterStatusMessage: string;
  streamingModelText: string;
  dispatchUi: (action: JarvisUiAction) => void;
};

export type BuilderSectionProps = {
  buildRequest: SkillBuildRequest | null;
  executorStatus: ExecutorStatus | null;
  handoffArtifact: BuildHandoffArtifact | null;
  implementationRequest: SkillImplementationRequest | null;
  missingSkillPlan: MissingSkillPlan | null;
  missingSkillRequest: string | null;
  runCommand: (command: string) => void | Promise<unknown>;
  dispatchUi: (action: JarvisUiAction) => void;
};
