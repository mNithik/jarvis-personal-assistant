import { useReducer, useRef, useState } from "react";
import type { PendingHandoffLaunch } from "../ui/terminal/useJarvisTerminal";
import type { GoogleCalendarEventRecord } from "../services/googleCalendar";
import type { SpotifyPlaybackState } from "../services/spotify";
import type {
  BrowserAliasRecord,
  EmailRecord,
  FileRecord,
  HistoryRecord,
  LearnedIntentRecord,
  AutonomousBuildStatus,
  BuildHandoffArtifact,
  MissingSkillPlan,
  NoteRecord,
  NotionStatus,
  ProposalRecord,
  ProposalStepRecord,
  RoutineRecord,
  SkillBuildRequest,
  SpotifyStatus,
  SkillImplementationRequest,
  GoogleCalendarStatus,
} from "../types/jarvis";
import type {
  ConversationBackend,
  ExecutorStatus,
  OllamaStatus,
  WakeModeStatus,
} from "../types/voice";
import { jarvisUiReducer } from "../ui/model/uiReducer";
import { loadJarvisUiState } from "../ui/model/uiPersistence";
import { DEFAULT_DESKTOP_PERMISSION_SETTINGS } from "./jarvisAppRootLegacyImports";
import type {
  ActiveConversationContext,
  ConversationBackendComparison,
  ConversationContextStackEntry,
  ConversationTopicRecord,
  ConversationTurn,
  CrossFeatureSuggestionRecord,
  DesktopPermissionSettings,
  EmbeddingBackend,
  ExpenseMemoryRecord,
  JarvisPanelRecord,
  MeetingPrepMemoryRecord,
  PackageMemoryRecord,
  PanelDragState,
  PersonMemoryRecord,
  PlannerTaskRecord,
  PresentedCollectionContext,
  SchoolPlanMemoryRecord,
  SemanticConversationMemoryRecord,
  SemanticIntentFeedbackRecord,
  ShellBarDragState,
  TravelMemoryRecord,
  UserPreferenceMemory,
} from "../features/command/jarvisCommandTypes";

export type CommandResult = {
  title: string;
  detail: string;
  routeLabel?: string;
};

export type PendingGatewayConfirmation = {
  command: string;
  preview: import("../services/jarvisApi").GatewayPreview;
};

export type PendingGatewayTeaching = {
  phrase: string;
  preview: import("../services/jarvisApi").GatewayPreview;
};

export function useJarvisShellState() {
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
  const [todayCalendarEvents, setTodayCalendarEvents] = useState<GoogleCalendarEventRecord[]>([]);
  const [gmailAccessToken, setGmailAccessToken] = useState<string | null>(null);
  const [recentEmails, setRecentEmails] = useState<EmailRecord[]>([]);
  const [plannerTasks, setPlannerTasks] = useState<PlannerTaskRecord[]>([]);
  const [peopleMemory, setPeopleMemory] = useState<PersonMemoryRecord[]>([]);
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
  const [desktopPermissionSettings, setDesktopPermissionSettings] = useState<DesktopPermissionSettings>(
    DEFAULT_DESKTOP_PERMISSION_SETTINGS,
  );
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
  const [missingSkillRequest, setMissingSkillRequest] = useState<string | null>(null);
  const [missingSkillPlan, setMissingSkillPlan] = useState<MissingSkillPlan | null>(null);
  const [isGeneratingMissingSkillPlan, setIsGeneratingMissingSkillPlan] = useState(false);
  const [implementationRequest, setImplementationRequest] =
    useState<SkillImplementationRequest | null>(null);
  const [buildRequest, setBuildRequest] = useState<SkillBuildRequest | null>(null);
  const [proactiveCrossSuggestion, setProactiveCrossSuggestion] = useState<CrossFeatureSuggestionRecord | null>(null);
  const [autonomousSkillBuildingEnabled, setAutonomousSkillBuildingEnabled] = useState(false);
  const [autonomousBuildStatus, setAutonomousBuildStatus] =
    useState<AutonomousBuildStatus>("idle");
  const [handoffArtifact, setHandoffArtifact] = useState<BuildHandoffArtifact | null>(null);
  const [pendingHandoffLaunch, setPendingHandoffLaunch] = useState<PendingHandoffLaunch>(null);
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
  const currentRouteLabelRef = useRef<string | undefined>(undefined);
  return {
    input, setInput,
    statusMessage, setStatusMessage,
    commandResult, setCommandResult,
    isRoutingCommand, setIsRoutingCommand,
    pendingGatewayConfirmation, setPendingGatewayConfirmation,
    pendingGatewayTeaching, setPendingGatewayTeaching,
    gatewaySessionRef,
    storedRoutines, setStoredRoutines,
    recentHistory, setRecentHistory,
    proposals, setProposals,
    isGeneratingProposal, setIsGeneratingProposal,
    proposalSteps, setProposalSteps,
    editingProposalId, setEditingProposalId,
    assistantName, setAssistantName,
    wakeModeEnabled, setWakeModeEnabled,
    wakeModeStatus, setWakeModeStatus,
    wakeCueActive, setWakeCueActive,
    browserAliases, setBrowserAliases,
    learnedIntentMappings, setLearnedIntentMappings,
    userPreferenceMemory, setUserPreferenceMemory,
    browserAliasUrl, setBrowserAliasUrl,
    googleCalendarStatus, setGoogleCalendarStatus,
    googleCalendarClientId, setGoogleCalendarClientId,
    googleCalendarApiKey, setGoogleCalendarApiKey,
    googleCalendarAccessToken, setGoogleCalendarAccessToken,
    todayCalendarEvents, setTodayCalendarEvents,
    gmailAccessToken, setGmailAccessToken,
    recentEmails, setRecentEmails,
    plannerTasks, setPlannerTasks,
    peopleMemory, setPeopleMemory,
    travelMemory, setTravelMemory,
    expenseMemory, setExpenseMemory,
    packageMemory, setPackageMemory,
    meetingPrepMemory, setMeetingPrepMemory,
    schoolPlanMemory, setSchoolPlanMemory,
    spotifyStatus, setSpotifyStatus,
    spotifyClientId, setSpotifyClientId,
    spotifyAccessToken, setSpotifyAccessToken,
    spotifyPlaybackState, setSpotifyPlaybackState,
    recentFiles, setRecentFiles,
    desktopPermissionSettings, setDesktopPermissionSettings,
    jarvisPanels, setJarvisPanels,
    panelDragState, setPanelDragState,
    shellBarInput, setShellBarInput,
    shellBarDragState, setShellBarDragState,
    uiState, dispatchUi,
    activeConversationContext, setActiveConversationContext,
    conversationContextStack, setConversationContextStack,
    presentedCollectionContext, setPresentedCollectionContext,
    semanticConversationMemory, setSemanticConversationMemory,
    semanticIntentFeedback, setSemanticIntentFeedback,
    lastConversationTopic, setLastConversationTopic,
    notionStatus, setNotionStatus,
    notionTokenInput, setNotionTokenInput,
    notionDatabaseId, setNotionDatabaseId,
    recentNotes, setRecentNotes,
    conversationBackend, setConversationBackend,
    backendComparePrompt, setBackendComparePrompt,
    backendComparison, setBackendComparison,
    isComparingBackends, setIsComparingBackends,
    ollamaStatus, setOllamaStatus,
    ollamaBaseUrl, setOllamaBaseUrl,
    ollamaModelName, setOllamaModelName,
    embeddingBackend, setEmbeddingBackend,
    embeddingModelName, setEmbeddingModelName,
    embeddingStatusMessage, setEmbeddingStatusMessage,
    missingSkillRequest, setMissingSkillRequest,
    missingSkillPlan, setMissingSkillPlan,
    isGeneratingMissingSkillPlan, setIsGeneratingMissingSkillPlan,
    implementationRequest, setImplementationRequest,
    buildRequest, setBuildRequest,
    proactiveCrossSuggestion, setProactiveCrossSuggestion,
    autonomousSkillBuildingEnabled, setAutonomousSkillBuildingEnabled,
    autonomousBuildStatus, setAutonomousBuildStatus,
    handoffArtifact, setHandoffArtifact,
    pendingHandoffLaunch, setPendingHandoffLaunch,
    executorStatus, setExecutorStatus,
    executorCommandPath, setExecutorCommandPath,
    executorWorkingDirectory, setExecutorWorkingDirectory,
    conversationTurns, setConversationTurns,
    teachingTargetPhrase, setTeachingTargetPhrase,
    wakeListenerActive, setWakeListenerActive,
    currentRouteLabelRef,
  };
}
