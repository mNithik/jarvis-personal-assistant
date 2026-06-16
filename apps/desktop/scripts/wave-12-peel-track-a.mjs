/**
 * Wave 12 Track A: peel useJarvisAppRoot.tsx
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const hooksDir = path.join(__dirname, "../src/hooks");
const srcPath = path.join(hooksDir, "useJarvisAppRoot.tsx");
const src = fs.readFileSync(srcPath, "utf8");
const lines = src.split("\n");

function slice(from, to) {
  return lines.slice(from - 1, to).join("\n");
}

// --- useJarvisShellState.ts ---
fs.writeFileSync(
  path.join(hooksDir, "useJarvisShellState.ts"),
  `import { useReducer, useRef, useState } from "react";
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
${slice(282, 392)}
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
    executorStatus, setExecutorStatus,
    executorCommandPath, setExecutorCommandPath,
    executorWorkingDirectory, setExecutorWorkingDirectory,
    conversationTurns, setConversationTurns,
    teachingTargetPhrase, setTeachingTargetPhrase,
    wakeListenerActive, setWakeListenerActive,
    currentRouteLabelRef,
  };
}
`,
);

// --- useJarvisShellPanelChrome.ts ---
fs.writeFileSync(
  path.join(hooksDir, "useJarvisShellPanelChrome.ts"),
  `import type { Dispatch } from "react";
import { jarvisModules } from "../ui/shell/jarvisModules";
import { defaultJarvisUiState } from "../ui/model/uiReducer";
import type { JarvisUiAction } from "../ui/model/uiReducer";
import type {
  JarvisPanelId,
  JarvisPanelRecord,
  PanelDragState,
  ShellBarDragState,
  ShellBarPlacement,
} from "../features/command/jarvisCommandTypes";

export type JarvisShellPanelChromeParams = {
  dispatchUi: Dispatch<JarvisUiAction>;
  setJarvisPanels: React.Dispatch<React.SetStateAction<JarvisPanelRecord[]>>;
  panelDragState: PanelDragState;
  shellBarDragState: ShellBarDragState;
  setShellBarDragState: React.Dispatch<React.SetStateAction<ShellBarDragState>>;
  setStatusMessage: React.Dispatch<React.SetStateAction<string>>;
};

export function useJarvisShellPanelChrome({
  dispatchUi,
  setJarvisPanels,
  panelDragState,
  shellBarDragState,
  setShellBarDragState,
  setStatusMessage,
}: JarvisShellPanelChromeParams) {
${slice(395, 482)}
  return {
    openJarvisPanel,
    closeJarvisPanel,
    minimizeJarvisPanel,
    toggleJarvisPanel,
    moveJarvisPanel,
    moveShellBar,
    pinShellBar,
    resetJarvisUiPreferences,
  };
}
`,
);

// --- jarvisRouterBridgeContext.build.ts ---
fs.writeFileSync(
  path.join(hooksDir, "jarvisRouterBridgeContext.build.ts"),
  `import type { JarvisRouterBridgeContext } from "./buildJarvisRouterBridgeState";

export function collectJarvisRouterBridgeContext(
  bag: JarvisRouterBridgeContext,
): JarvisRouterBridgeContext {
  return {
${slice(1881, 2319)}
  };
}
`,
);

// --- useJarvisRouterBridgeContext.ts ---
fs.writeFileSync(
  path.join(hooksDir, "useJarvisRouterBridgeContext.ts"),
  `import type { JarvisRouterBridgeContext } from "./buildJarvisRouterBridgeState";
import { collectJarvisRouterBridgeContext } from "./jarvisRouterBridgeContext.build";

export function useJarvisRouterBridgeContext(
  bag: JarvisRouterBridgeContext,
): JarvisRouterBridgeContext {
  return collectJarvisRouterBridgeContext(bag);
}
`,
);

// --- useJarvisShellRenderAssembly.ts ---
const renderBody = slice(2497, 2713);
fs.writeFileSync(
  path.join(hooksDir, "useJarvisShellRenderAssembly.ts"),
  `import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { JarvisAppRootRenderProps, JarvisPanelContentProps } from "../ui/shell/jarvisAppRootTypes";
import type { JarvisSystemDrawerContextValue } from "../ui/settings/drawer/JarvisSystemDrawerContext";
import type { useJarvisShellViewModel } from "./useJarvisShellViewModel";
import type { useJarvisWorkspaceSections } from "./useJarvisWorkspaceSections";
import type { useJarvisShellRouterBridge } from "./useJarvisShellRouterBridge";
import type { JarvisUiAction, JarvisUiState } from "../ui/model/uiReducer";
import type { Dispatch } from "react";
import type {
  JarvisPanelId,
  JarvisPanelRecord,
  ModelRouterConfig,
  OcrWatchTarget,
  PanelDragState,
  SavedWorkflowRecord,
  ShellBarDragState,
  ShellBarPlacement,
  DesktopProjectRecord,
} from "../features/command/jarvisCommandTypes";
import type { ConversationBackend } from "../types/voice";
import type { ExecutorStatus } from "../types/voice";
import type { GatewayPreview } from "../services/jarvisApi";
import type { CommandResult } from "./useJarvisShellState";

export type JarvisShellRenderAssemblyParams = {
  drawerContextBag: JarvisSystemDrawerContextValue;
  panelContentProps: Omit<JarvisPanelContentProps, "panel">;
  uiState: JarvisUiState;
  dispatchUi: Dispatch<JarvisUiAction>;
  shellViewModel: ReturnType<typeof useJarvisShellViewModel>;
  workspaceSections: ReturnType<typeof useJarvisWorkspaceSections>;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  isRoutingCommand: boolean;
  commandRouter: ReturnType<typeof useJarvisShellRouterBridge>;
  statusMessage: string;
  assistantName: string;
  wakeCueActive: boolean;
  gatewayPreview: GatewayPreview | null;
  gatewayPreviewError: string | null;
  isPreviewingGateway: boolean;
  conversationBackend: ConversationBackend;
  shellBarInput: string;
  setShellBarInput: React.Dispatch<React.SetStateAction<string>>;
  submitShellBarCommand: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  shellBarPlacement: ShellBarPlacement;
  pinShellBar: (placement: Exclude<ShellBarPlacement, "free">) => void;
  setShellBarDragState: React.Dispatch<React.SetStateAction<ShellBarDragState>>;
  handleVoiceStart: () => void;
  runCommand: ReturnType<typeof useJarvisShellRouterBridge>["runCommand"];
  executeIntent: ReturnType<typeof useJarvisShellRouterBridge>["executeIntent"];
  jarvisPanels: JarvisPanelRecord[];
  setPanelDragState: React.Dispatch<React.SetStateAction<PanelDragState>>;
  toggleJarvisPanel: (panel: JarvisPanelId) => void;
  closeJarvisPanel: (panel?: JarvisPanelId) => void;
  openJarvisPanel: (panel: JarvisPanelId) => void;
  pingCore: () => Promise<void>;
  resetJarvisUiPreferences: () => void;
  commandResult: CommandResult | null;
  ocrHistory: ReturnType<typeof import("./useJarvisOcr").useJarvisOcr>["ocrHistory"];
  savedWorkflows: SavedWorkflowRecord[];
  ocrWatchTargets: OcrWatchTarget[];
  desktopProjects: DesktopProjectRecord[];
  modelRouterConfig: ModelRouterConfig;
  executorStatus: ExecutorStatus | null;
  isOcrSelecting: boolean;
  ocrSelection: ReturnType<typeof import("./useJarvisOcr").useJarvisOcr>["ocrSelection"];
  setOcrSelection: ReturnType<typeof import("./useJarvisOcr").useJarvisOcr>["setOcrSelection"];
  setIsOcrSelecting: ReturnType<typeof import("./useJarvisOcr").useJarvisOcr>["setIsOcrSelecting"];
  setStatusMessage: React.Dispatch<React.SetStateAction<string>>;
  completeOcrSelection: ReturnType<typeof import("./useJarvisOcr").useJarvisOcr>["completeOcrSelection"];
  selectionRect: ReturnType<typeof import("./useJarvisOcr").useJarvisOcr>["selectionRect"];
  moveJarvisPanel: (clientX: number, clientY: number) => void;
  moveShellBar: (clientX: number, clientY: number) => void;
};

export function useJarvisShellRenderAssembly(params: JarvisShellRenderAssemblyParams) {
  const {
    drawerContextBag,
    panelContentProps,
    uiState,
    dispatchUi,
    shellViewModel,
    workspaceSections,
    input,
    setInput,
    isRoutingCommand,
    commandRouter,
    statusMessage,
    assistantName,
    wakeCueActive,
    gatewayPreview,
    gatewayPreviewError,
    isPreviewingGateway,
    conversationBackend,
    shellBarInput,
    setShellBarInput,
    submitShellBarCommand,
    shellBarPlacement,
    pinShellBar,
    setShellBarDragState,
    handleVoiceStart,
    runCommand,
    executeIntent,
    jarvisPanels,
    setPanelDragState,
    toggleJarvisPanel,
    closeJarvisPanel,
    openJarvisPanel,
    pingCore,
    resetJarvisUiPreferences,
    commandResult,
    ocrHistory,
    savedWorkflows,
    ocrWatchTargets,
    desktopProjects,
    modelRouterConfig,
    executorStatus,
    isOcrSelecting,
    ocrSelection,
    setOcrSelection,
    setIsOcrSelecting,
    setStatusMessage,
    completeOcrSelection,
    selectionRect,
    moveJarvisPanel,
    moveShellBar,
  } = params;

${renderBody.replace("  const [showGatewayTrace, setShowGatewayTrace] = useState(false);\n\n  const drawerContext = useMemo(", "  const [showGatewayTrace, setShowGatewayTrace] = useState(false);\n\n  const drawerContext = useMemo(").replace(
  /const drawerContext = useMemo\([\s\S]*?\],\n  \);\n\n  const panelContentProps[\s\S]*?};\n\n  const renderProps/,
  "const drawerContext = useMemo(\n    (): JarvisSystemDrawerContextValue => drawerContextBag,\n    [drawerContextBag],\n  );\n\n  const renderProps",
)}

  return renderProps;
}
`,
);

// --- useJarvisAppRootComposition.ts ---
let comp = src;
comp = comp.replace(
  /type BrowserRecognitionHandle[\s\S]*?type PendingGatewayTeaching = \{[\s\S]*?\};\n\n/,
  "",
);
comp = comp.replace("export function useJarvisAppRoot(): ReactNode {", "export function useJarvisAppRootComposition(): ReactNode {");
comp = comp.replace(slice(282, 392), `  const shellState = useJarvisShellState();
  const {
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
    executorStatus, setExecutorStatus,
    executorCommandPath, setExecutorCommandPath,
    executorWorkingDirectory, setExecutorWorkingDirectory,
    conversationTurns, setConversationTurns,
    teachingTargetPhrase, setTeachingTargetPhrase,
    wakeListenerActive, setWakeListenerActive,
    currentRouteLabelRef,
  } = shellState;
`);
comp = comp.replace(
  slice(395, 482),
  `  const {
    openJarvisPanel,
    closeJarvisPanel,
    minimizeJarvisPanel,
    toggleJarvisPanel,
    moveJarvisPanel,
    moveShellBar,
    pinShellBar,
    resetJarvisUiPreferences,
  } = useJarvisShellPanelChrome({
    dispatchUi,
    setJarvisPanels,
    panelDragState,
    shellBarDragState,
    setShellBarDragState,
    setStatusMessage,
  });
`);
comp = comp.replace(
  "state: buildJarvisRouterBridgeState({",
  "state: buildJarvisRouterBridgeState(useJarvisRouterBridgeContext({",
);
comp = comp.replace(
  /  const \[showGatewayTrace, setShowGatewayTrace\] = useState\(false\);\n\n  const drawerContext = useMemo\([\s\S]*?  \};\n\n  return <JarvisAppRootRender \{\.\.\.renderProps\} \/>/,
  `  const drawerContextBag = useMemo(
    (): import("../ui/settings/drawer/JarvisSystemDrawerContext").JarvisSystemDrawerContextValue => ({
      conversationBackend,
      setConversationBackend,
      saveCurrentAssistantDefaults,
      restoreSavedAssistantDefaults,
      resetToRecommendedAssistantDefaults,
      voiceBackend,
      speechOutputBackend,
      localExecutablePath,
      setLocalExecutablePath,
      localModelPath,
      setLocalModelPath,
      handleSaveLocalVoiceConfig,
      localTtsExecutablePath,
      setLocalTtsExecutablePath,
      localTtsModelPath,
      setLocalTtsModelPath,
      handleSaveLocalSpeechConfig,
      ollamaBaseUrl,
      setOllamaBaseUrl,
      ollamaModelName,
      setOllamaModelName,
      handleSaveOllamaConfig,
      modelRouterConfig,
      updateModelRouterConfig,
      updateModelProviderConfig,
      modelProviderKeyStatus,
      modelProviderKeyPreview,
      saveProviderApiKey,
      deleteSavedProviderApiKey,
      testSavedProviderApiKey,
      applyModelProviderPreset,
      executeIntent,
      handleTestModelProvider,
      isTestingModelRouter,
      isBenchmarkingModels,
      isComparingModels,
      modelComparisonPrompt,
      setModelComparisonPrompt,
      modelComparisonRun,
      modelBenchmarkResults,
      modelProviderUsage,
      modelRouterStatusMessage,
      setModelRouterConfig,
      createDefaultModelRouterConfig,
      embeddingBackend,
      setEmbeddingBackend,
      embeddingModelName,
      setEmbeddingModelName,
      embeddingStatusMessage,
      googleCalendarClientId,
      setGoogleCalendarClientId,
      googleCalendarApiKey,
      setGoogleCalendarApiKey,
      googleCalendarAccessToken,
      gmailAccessToken,
      handleSaveGoogleCalendarConfig,
      handleConnectGoogleCalendar,
      handleConnectGmail,
      spotifyClientId,
      setSpotifyClientId,
      spotifyAccessToken,
      handleSaveSpotifyConfig,
      handleConnectSpotify,
      notionTokenInput,
      setNotionTokenInput,
      notionDatabaseId,
      setNotionDatabaseId,
      notionStatus,
      handleSaveNotionConfig,
      executorCommandPath,
      setExecutorCommandPath,
      executorWorkingDirectory,
      setExecutorWorkingDirectory,
      handleSaveExecutorConfig,
      assistantName,
      setAssistantName,
      wakeModeEnabled,
      setWakeModeEnabled,
      handleSaveWakeMode,
      handleWakeActivation,
    }),
    [
      conversationBackend,
      voiceBackend,
      speechOutputBackend,
      localExecutablePath,
      localModelPath,
      localTtsExecutablePath,
      localTtsModelPath,
      ollamaBaseUrl,
      ollamaModelName,
      modelRouterConfig,
      modelProviderKeyStatus,
      modelProviderKeyPreview,
      isTestingModelRouter,
      isBenchmarkingModels,
      isComparingModels,
      modelComparisonPrompt,
      modelComparisonRun,
      modelBenchmarkResults,
      modelProviderUsage,
      modelRouterStatusMessage,
      embeddingBackend,
      embeddingModelName,
      embeddingStatusMessage,
      googleCalendarClientId,
      googleCalendarApiKey,
      googleCalendarAccessToken,
      gmailAccessToken,
      spotifyClientId,
      spotifyAccessToken,
      notionTokenInput,
      notionDatabaseId,
      notionStatus,
      executorCommandPath,
      executorWorkingDirectory,
      assistantName,
      wakeModeEnabled,
      executeIntent,
    ],
  );

  const panelContentProps: Omit<JarvisPanelContentProps, "panel"> = {
    assistantName,
    activeOcrWatches,
    ocrHistory,
    ocrWatchTemplates,
    lastOcrText,
    voiceSessionPhase,
    voiceBackend,
    learnedIntentMappings,
    wakeModeEnabled,
    voiceResponseEnabled,
    voiceReplyMode,
    desktopProjects,
    desktopSchedules,
    activeConversationContext,
    displayPeopleMemory,
    displayTravelMemory,
    displayExpenseMemory,
    displayPackageMemory,
    displayMeetingPrepMemory,
    displaySchoolPlanMemory,
    memoryTotal,
    googleCalendarAccessToken,
    gmailAccessToken,
    notionStatus,
    spotifyAccessToken,
    connectedIntegrations,
    ocrWatchTargets,
    savedWorkflows,
    crossFeatureSuggestions,
    executorStatus,
    autonomousBuildStatus,
    handoffArtifact,
    executeIntent,
    handleVoiceStart,
    handleWakeActivation,
  };

  const renderProps = useJarvisShellRenderAssembly({
    drawerContextBag,
    panelContentProps,
    uiState,
    dispatchUi,
    shellViewModel,
    workspaceSections,
    input,
    setInput,
    isRoutingCommand,
    commandRouter,
    statusMessage,
    assistantName,
    wakeCueActive,
    gatewayPreview,
    gatewayPreviewError,
    isPreviewingGateway,
    conversationBackend,
    shellBarInput,
    setShellBarInput,
    submitShellBarCommand,
    shellBarPlacement,
    pinShellBar,
    setShellBarDragState,
    handleVoiceStart,
    runCommand,
    executeIntent,
    jarvisPanels,
    setPanelDragState,
    toggleJarvisPanel,
    closeJarvisPanel,
    openJarvisPanel,
    pingCore,
    resetJarvisUiPreferences,
    commandResult,
    ocrHistory,
    savedWorkflows,
    ocrWatchTargets,
    desktopProjects,
    modelRouterConfig,
    executorStatus,
    isOcrSelecting,
    ocrSelection,
    setOcrSelection,
    setIsOcrSelecting,
    setStatusMessage,
    completeOcrSelection,
    selectionRect,
    moveJarvisPanel,
    moveShellBar,
  });

  return <JarvisAppRootRender {...renderProps} />`,
);

const extraImports = `import { useJarvisShellState } from "./useJarvisShellState";
import { useJarvisShellPanelChrome } from "./useJarvisShellPanelChrome";
import { useJarvisRouterBridgeContext } from "./useJarvisRouterBridgeContext";
import { useJarvisShellRenderAssembly } from "./useJarvisShellRenderAssembly";
`;
comp = comp.replace(
  'import { buildJarvisRouterBridgeState } from "./buildJarvisRouterBridgeState";',
  `import { buildJarvisRouterBridgeState } from "./buildJarvisRouterBridgeState";
${extraImports}`,
);
comp = comp.replace(
  /import \{ FormEvent, ReactNode, useEffect, useMemo, useReducer, useRef, useState, useCallback \} from "react";/,
  'import { FormEvent, ReactNode, useEffect, useMemo, useRef, useCallback } from "react";',
);
comp = comp.replace(
  /import \{\n  defaultJarvisUiState,\n  jarvisUiReducer,\n\} from "\.\.\/ui\/model\/uiReducer";\nimport \{\n  JARVIS_UI_PREFERENCES_STORAGE_KEY,\n  loadJarvisUiState,\n  persistJarvisUiState,\n\} from "\.\.\/ui\/model\/uiPersistence";\n/,
  "",
);
comp = comp.replace(/import \{ jarvisModules \} from "\.\.\/ui\/shell\/jarvisModules";\n/, "");

fs.writeFileSync(path.join(hooksDir, "useJarvisAppRootComposition.ts"), comp.replace(/\.tsx/g, ".ts").replace("useJarvisAppRootComposition.ts", "useJarvisAppRootComposition.tsx"));

// Fix extension - composition should be .ts if no JSX... but it has JSX return. Use .tsx
const compPath = path.join(hooksDir, "useJarvisAppRootComposition.tsx");
fs.writeFileSync(compPath, comp);
if (fs.existsSync(path.join(hooksDir, "useJarvisAppRootComposition.ts"))) {
  fs.unlinkSync(path.join(hooksDir, "useJarvisAppRootComposition.ts"));
}

// --- thin useJarvisAppRoot.tsx ---
fs.writeFileSync(
  path.join(hooksDir, "useJarvisAppRoot.tsx"),
  `import type { ReactNode } from "react";
import { useJarvisAppRootComposition } from "./useJarvisAppRootComposition";

export function useJarvisAppRoot(): ReactNode {
  return useJarvisAppRootComposition();
}
`,
);

for (const f of [
  "useJarvisShellState.ts",
  "useJarvisShellPanelChrome.ts",
  "jarvisRouterBridgeContext.build.ts",
  "useJarvisRouterBridgeContext.ts",
  "useJarvisShellRenderAssembly.ts",
  "useJarvisAppRootComposition.tsx",
  "useJarvisAppRoot.tsx",
]) {
  const n = fs.readFileSync(path.join(hooksDir, f), "utf8").split("\n").length;
  console.log(f, n);
}
