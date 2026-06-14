import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "../src/features/command/commandRouterDepTypes.ts");

const setterTypes = {
  setActiveConversationContext: "ActiveConversationContext | null",
  setBuildRequest: "SkillBuildRequest | null",
  setCommandResult: "CommandResult | null",
  setConversationBackend: "ConversationBackend",
  setCrossFeatureSuggestions: "CrossFeatureSuggestionRecord[]",
  setDesktopPermissionSettings: "DesktopPermissionSettings",
  setDesktopProjects: "DesktopProjectRecord[]",
  setDesktopSchedules: "DesktopScheduleRecord[]",
  setGatewayPreview: "GatewayPreview | null",
  setGatewayPreviewError: "string | null",
  setHandoffArtifact: "BuildHandoffArtifact | null",
  setIsRoutingCommand: "boolean",
  setLastOcrText: "string",
  setLastScreenshotPath: "string",
  setLastSemanticIntentMatches: "SemanticIntentDebugMatch[]",
  setMissingSkillPlan: "MissingSkillPlan | null",
  setMissingSkillRequest: "string | null",
  setOcrCorrections: "OcrCorrectionRecord[]",
  setOcrHistory: "OcrHistoryRecord[]",
  setOcrWatchMatches: "OcrHistoryRecord[]",
  setOcrWatchTargets: "OcrWatchTarget[]",
  setOcrWatchTemplates: "OcrWatchTemplate[]",
  setPendingClarification: "PendingClarification | null",
  setPendingGatewayConfirmation: "PendingGatewayConfirmation | null",
  setPendingGatewayTeaching: "PendingGatewayTeaching | null",
  setPendingWorkflowExecution: "PendingWorkflowExecution | null",
  setPlannerTasks: "PlannerTaskRecord[]",
  setPreferredModelProvider: "ModelProviderId",
  setPresentedCollectionContext: "PresentedCollectionContext | null",
  setProactiveCrossSuggestion: "CrossFeatureSuggestionRecord | null",
  setRecentEmails: "EmailRecord[]",
  setRecentFiles: "FileRecord[]",
  setRecentNotes: "NoteRecord[]",
  setSpotifyPlaybackState: "SpotifyPlaybackState | null",
  setStatusMessage: "string",
  setTeachingTargetPhrase: "string | null",
  setUserPreferenceMemory: "UserPreferenceMemory",
  setVoiceReplyMode: "VoiceReplyMode",
  setVoiceSessionPhase: "VoiceSessionPhase",
  setWakeModeEnabled: "boolean",
  setWakeModeStatus: "WakeModeStatus | null",
};

const stateTypes = {
  activeConversationContext: "ActiveConversationContext | null",
  input: "string",
  assistantName: "string",
  autonomousSkillBuildingEnabled: "boolean",
  browserAliases: "BrowserAliasRecord[]",
  commandResult: "CommandResult | null",
  conversationBackend: "ConversationBackend",
  desktopPermissionSettings: "DesktopPermissionSettings",
  desktopProjects: "DesktopProjectRecord[]",
  desktopSchedules: "DesktopScheduleRecord[]",
  expenseMemory: "ExpenseMemoryRecord[]",
  gatewayConfig: "GatewayConfig | null",
  gatewaySessionRef: "MutableRefObject<string>",
  currentRouteLabelRef: "MutableRefObject<string | undefined>",
  gmailAccessToken: "string | null",
  googleCalendarAccessToken: "string | null",
  lastConversationTopic: "ConversationTopicRecord | null",
  lastOcrText: "string",
  lastScreenshotPath: "string",
  lastSemanticIntentMatches: "SemanticIntentDebugMatch[]",
  latestGeneratedDraft: "GeneratedModelDraft | null",
  learnedIntentMappings: "LearnedIntentRecord[]",
  meetingPrepMemory: "MeetingPrepMemoryRecord[]",
  ocrHistory: "OcrHistoryRecord[]",
  ocrWatchTargets: "OcrWatchTarget[]",
  ocrWatchTemplates: "OcrWatchTemplate[]",
  packageMemory: "PackageMemoryRecord[]",
  peopleMemory: "PersonMemoryRecord[]",
  plannerTasks: "PlannerTaskRecord[]",
  recentEmails: "EmailRecord[]",
  recentFiles: "FileRecord[]",
  recentNotes: "NoteRecord[]",
  savedWorkflows: "SavedWorkflowRecord[]",
  schoolPlanMemory: "SchoolPlanMemoryRecord[]",
  semanticConversationMemory: "SemanticConversationMemoryRecord[]",
  semanticIntentFeedback: "SemanticIntentFeedbackRecord[]",
  spotifyAccessToken: "string | null",
  teachingTargetPhrase: "string",
  trainingModeSession: "TrainingModeSession | null",
  travelMemory: "TravelMemoryRecord[]",
  userPreferenceMemory: "UserPreferenceMemory",
  voiceReplyMode: "VoiceReplyMode",
  pendingClarification: "PendingClarification | null",
  pendingGatewayConfirmation: "PendingGatewayConfirmation | null",
  pendingGatewayTeaching: "PendingGatewayTeaching | null",
  pendingWorkflowExecution: "PendingWorkflowExecution | null",
  presentedCollectionContext: "PresentedCollectionContext | null",
  proactiveCrossSuggestion: "CrossFeatureSuggestionRecord | null",
  jarvisModules: "JarvisModuleDescriptor[]",
  skillAutopilotAvailable: "boolean",
};

const handlerTypes = {
  appendConversationTurn: '(role: "user" | "jarvis", text: string, routeLabel?: string) => void',
  beginOcrSelection: "(scope?: OcrScope) => Promise<void>",
  buildCachedSemanticIntentEmbedding: "(phrase: string) => Promise<number[] | null>",
  buildCrossFeatureSuggestionsForEmail: "(email: EmailRecord) => CrossFeatureSuggestionRecord[]",
  buildCrossFeatureSuggestionsForState: "() => CrossFeatureSuggestionRecord[]",
  buildSemanticEmbeddingWithFallback: "(phrase: string) => Promise<number[] | null>",
  captureOcrSnapshot: "(target: OcrCaptureTarget) => Promise<OcrSnapshot>",
  chooseModelComparisonWinner: "(run: ModelComparisonRun) => ModelComparisonResult | null",
  closeJarvisPanel: "(panel?: JarvisPanelId) => void",
  compareModelResponses: "(prompt: string, taskType: ModelTaskType) => Promise<ModelComparisonRun>",
  continuePendingWorkflowExecution: "(execution: PendingWorkflowExecution, input: string) => Promise<void>",
  createDesktopProject: "(name: string) => DesktopProjectRecord | null",
  createDesktopProjectFromTemplate: "(templateName: string, projectName: string) => DesktopProjectRecord | null",
  deleteDesktopProject: "(query: string) => DesktopProjectRecord | null",
  findDesktopProject: "(query: string) => DesktopProjectRecord | null",
  generateSafeModelDraft: "(prompt: string, taskType: ModelTaskType) => Promise<GeneratedModelDraft | null>",
  handleAskAdvancedAssistant: "(prompt: string) => Promise<void>",
  handleConversationContextStackCommand: "(command: string) => Promise<boolean>",
  handleTestModelProvider: "(providerId: ModelProviderId) => Promise<ModelRouterTestResult>",
  handleTrainingModeInput: "(input: string) => Promise<void>",
  handleTrainingReviewCleanupCommand: "(command: string) => Promise<boolean>",
  isSensitiveModelPrompt: "(prompt: string) => boolean",
  loadMemoryView: "() => Promise<void>",
  loadPlannerTaskRecords: "() => Promise<void>",
  loadRecentNotes: "() => Promise<void>",
  minimizeJarvisPanel: "(panel?: JarvisPanelId) => void",
  openFollowUpWindow: "(reason: FollowUpWindow[\"reason\"]) => void",
  openJarvisPanel: "(panel: JarvisPanelId) => void",
  pickProactiveCrossSuggestion: "(suggestions: CrossFeatureSuggestionRecord[]) => CrossFeatureSuggestionRecord | null",
  pushGatewayHistory: "(kind: GatewayHistoryKind, command: string, preview: GatewayPreview | null, detail: string) => void",
  recommendModelRoutesFromHistory: "() => ModelRouteDecision[]",
  refreshGatewayPreview: '(command: string, source: "text" | "voice") => Promise<void>',
  refreshSpotifyPlayback: "() => Promise<void>",
  rememberExpenseSummary: "(summary: string) => void",
  rememberMeetingPrepSummary: "(summary: string) => void",
  rememberOcrHistory: "(target: string, text: string, screenshotPath: string, meta?: OcrHistoryMeta) => void",
  rememberPackageSummary: "(summary: string) => void",
  rememberPersonBirthday: "(record: PersonMemoryRecord) => void",
  rememberRejectedPendingSemanticClarification: "() => void",
  rememberSchoolPlan: "(plan: SchoolPlanMemoryRecord) => void",
  rememberSemanticConversationTurn: "(command: string, intent: CommandIntent | null) => Promise<void>",
  rememberSemanticIntentFeedback: "(phrase: string, candidateId: string, candidateLabel: string, accepted: boolean) => void",
  rememberSuccessfulPhrase: "(phrase: string, intent: CommandIntent) => Promise<void>",
  rememberTravelSummary: "(summary: string) => void",
  rememberWorkflowSequence: "(steps: WorkflowStepResolution[]) => void",
  resolveModelRoute: "(taskType: ModelTaskType, prompt: string) => ModelRouteDecision",
  returnToArmedWakeMode: "() => void",
  runModelBenchmark: "(providerId: ModelProviderId) => Promise<ModelBenchmarkResult>",
  shouldKeepFollowUpWindowOpen: "(intent: CommandIntent) => boolean",
  speakIfEnabled: "(text: string) => void",
  startTrainingMode: "() => void",
  stopHandsFreeSession: "() => void",
  teachJarvisMeaning: "(phrase: string, intent: CommandIntent) => Promise<void>",
  teachJarvisWorkflow: "(workflow: SavedWorkflowRecord) => Promise<void>",
  updateDesktopProject: "(query: string, updater: (project: DesktopProjectRecord) => DesktopProjectRecord) => DesktopProjectRecord | null",
  updateModelRouterConfig: "(config: ModelRouterConfig) => void",
  updatePersonMemory: "(record: PersonMemoryRecord) => void",
  dispatchUi: "(action: JarvisUiAction) => void",
};

const header = `import type { Dispatch, MutableRefObject, SetStateAction } from "react";
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

`;

let body = "export type CommandRouterStateDeps = {\n";
for (const [key, value] of Object.entries(stateTypes)) {
  body += `  ${key}?: ${value};\n`;
}
body += "};\n\nexport type CommandRouterSetterDeps = {\n";
for (const [key, value] of Object.entries(setterTypes)) {
  body += `  ${key}?: Setter<${value}>;\n`;
}
const handlerTypeOverrides = {
  buildCachedSemanticIntentEmbedding: "(text: string) => Promise<number[] | null>",
  buildSemanticEmbeddingWithFallback:
    "(text: string) => Promise<{ embedding: number[]; backend: EmbeddingBackend }>",
};

body += "};\n\nexport type CommandRouterHandlerDeps = {\n";
for (const key of Object.keys(handlerTypes)) {
  const type = handlerTypeOverrides[key] ?? "Function";
  body += `  ${key}?: ${type};\n`;
}
body += "};\n\nexport type CommandRouterDeps = Partial<\n  CommandRouterStateDeps & CommandRouterSetterDeps & CommandRouterHandlerDeps\n>;\n";

fs.writeFileSync(outPath, header + body);
console.log(`Wrote ${outPath}`);
