/**
 * Wave 11 Part 1: wire peeled hooks into useJarvisAppRoot.tsx and swap render bridge.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const hookPath = path.join(__dirname, "../src/hooks/useJarvisAppRoot.tsx");
let src = fs.readFileSync(hookPath, "utf8");

// --- imports ---
src = src.replace(
  /import JarvisShell from "\.\.\/ui\/shell\/JarvisShell";[\s\S]*?import BuilderWorkspace from "\.\.\/ui\/workspaces\/BuilderWorkspace";\n/,
  "",
);
src = src.replace(
  /import QuickBar from "\.\.\/ui\/shell\/QuickBar";[\s\S]*?import BuilderWorkspace from "\.\.\/ui\/workspaces\/BuilderWorkspace";\n/,
  "",
);
src = src.replace(/import DataSphere from "\.\.\/ui\/shell\/DataSphere";\n/, "");
src = src.replace(/import AppLaunchpad from "\.\.\/ui\/shell\/AppLaunchpad";\n/, "");
src = src.replace(/import CockpitOverlay from "\.\.\/ui\/cockpit\/CockpitOverlay";\n/, "");
src = src.replace(/import GatewayTracePanel from "\.\.\/ui\/cockpit\/GatewayTracePanel";\n/, "");
src = src.replace(/import FloatingPanelHost from "\.\.\/ui\/floating\/FloatingPanelHost";\n/, "");
src = src.replace(/import SystemDrawer from "\.\.\/ui\/settings\/SystemDrawer";\n/, "");
src = src.replace(/import AdvancedConfigPanel from "\.\.\/ui\/settings\/AdvancedConfigPanel";\n/, "");
src = src.replace(/import SystemDrawerStack from "\.\.\/ui\/settings\/SystemDrawerStack";\n/, "");
src = src.replace(/import CommandWorkspace from "\.\.\/ui\/workspaces\/CommandWorkspace";\n/, "");
src = src.replace(/import VisionWorkspace from "\.\.\/ui\/workspaces\/VisionWorkspace";\n/, "");
src = src.replace(/import MemoryWorkspace from "\.\.\/ui\/workspaces\/MemoryWorkspace";\n/, "");
src = src.replace(/import AutomationWorkspace from "\.\.\/ui\/workspaces\/AutomationWorkspace";\n/, "");
src = src.replace(/import WorkspacesWorkspace from "\.\.\/ui\/workspaces\/WorkspacesWorkspace";\n/, "");
src = src.replace(/import ConnectionsWorkspace from "\.\.\/ui\/workspaces\/ConnectionsWorkspace";\n/, "");
src = src.replace(/import ModelsWorkspace from "\.\.\/ui\/workspaces\/ModelsWorkspace";\n/, "");
src = src.replace(/import BuilderWorkspace from "\.\.\/ui\/workspaces\/BuilderWorkspace";\n/, "");
src = src.replace(/import { workspaceRegistry } from "\.\.\/ui\/model\/workspaceRegistry";\n/, "");
src = src.replace(/import { executeUiQuickAction } from "\.\.\/ui\/model\/uiActionAdapter";\n/, "");
src = src.replace(/import { JarvisWorkspaceId } from "\.\.\/ui\/model\/jarvisTypes";\n/, "");
src = src.replace(/import { JarvisAppProvider } from "\.\.\/ui\/context\/JarvisAppContext";\n/, "");
src = src.replace(/import { useJarvisCommandRouter } from "\.\/useJarvisCommandRouter";\n/, "");
src = src.replace(/import { useOcrWatchScheduler } from "\.\/useOcrWatchScheduler";\n/, "");
src = src.replace(/import type { CommandRouterDeps } from "\.\.\/features\/command\/createJarvisCommandRouter";\n/, "");

const newImports = `import JarvisAppRootRender from "../ui/shell/JarvisAppRoot.render";
import type { JarvisAppRootRenderProps, JarvisPanelContentProps } from "../ui/shell/jarvisAppRootTypes";
import {
  buildCrossFeatureSuggestionsForEmail,
  buildCrossFeatureSuggestionsForState,
  pickProactiveCrossSuggestion,
} from "../features/shell/crossFeatureSuggestions";
import { useJarvisShellViewModel } from "./useJarvisShellViewModel";
import { useJarvisShellRouterBridge } from "./useJarvisShellRouterBridge";
import { useJarvisWorkflows } from "./useJarvisWorkflows";
import { useJarvisVoiceRuntime } from "./useJarvisVoiceRuntime";
import { useJarvisModelRouter } from "./useJarvisModelRouter";
import { useJarvisOcr } from "./useJarvisOcr";
import {
  useJarvisDesktopScheduleTimers,
  useJarvisDesktopWorkspaces,
} from "./useJarvisDesktopWorkspaces";
import { useJarvisRustMemoryLoader } from "./useJarvisRustMemoryLoader";
import { useJarvisTrainingMode } from "./useJarvisTrainingMode";
import { useJarvisBuilderAutopilot } from "./useJarvisBuilderAutopilot";
`;

if (!src.includes("useJarvisShellViewModel")) {
  src = src.replace(
    'import { useJarvisShellPersistence } from "./useJarvisShellPersistence";',
    `import { useJarvisShellPersistence } from "./useJarvisShellPersistence";
${newImports}`,
  );
}

src = src.replace(/\nexport \* from "\.\.\/features\/legacy\/appHelpers";\n/, "\n");

// --- remove peeled useState blocks ---
const stateRemovals = [
  /  const \[lastScreenshotPath, setLastScreenshotPath\] = useState<string \| null>\(null\);\n/,
  /  const \[ocrWatchTargets, setOcrWatchTargets\] = useState<OcrWatchTarget\[\]>\(\[\]\);\n/,
  /  const \[ocrHistory, setOcrHistory\] = useState<OcrHistoryRecord\[\]>\(\[\]\);\n/,
  /  const \[ocrWatchMatches, setOcrWatchMatches\] = useState<OcrHistoryRecord\[\]>\(\[\]\);\n/,
  /  const \[lastOcrText, setLastOcrText\] = useState\(""\);\n/,
  /  const \[ocrCorrections, setOcrCorrections\] = useState<OcrCorrectionRecord\[\]>\(\[\]\);\n/,
  /  const \[ocrWatchTemplates, setOcrWatchTemplates\] = useState<OcrWatchTemplate\[\]>\(\[\]\);\n/,
  /  const \[isOcrSelecting, setIsOcrSelecting\] = useState\(false\);\n/,
  /  const \[ocrSelection, setOcrSelection\] = useState<OcrSelectionState>\(null\);\n/,
  /  const \[desktopProjects, setDesktopProjects\] = useState<DesktopProjectRecord\[\]>\(\[\]\);\n/,
  /  const \[desktopSchedules, setDesktopSchedules\] = useState<DesktopScheduleRecord\[\]>\(\[\]\);\n/,
  /  const \[rustPeopleMemory, setRustPeopleMemory\] = useState<PersonMemoryRecord\[\] \| null>\(null\);\n/,
  /  const \[rustTravelMemory, setRustTravelMemory\] = useState<TravelMemoryRecord\[\] \| null>\(null\);\n/,
  /  const \[rustExpenseMemory, setRustExpenseMemory\] = useState<ExpenseMemoryRecord\[\] \| null>\(null\);\n/,
  /  const \[rustPackageMemory, setRustPackageMemory\] = useState<PackageMemoryRecord\[\] \| null>\(null\);\n/,
  /  const \[rustMeetingPrepMemory, setRustMeetingPrepMemory\] = useState<MeetingPrepMemoryRecord\[\] \| null>\(null\);\n/,
  /  const \[rustSchoolPlanMemory, setRustSchoolPlanMemory\] = useState<SchoolPlanMemoryRecord\[\] \| null>\(null\);\n/,
  /  const \[trainingModeSession, setTrainingModeSession\] =\n    useState<TrainingModeSession \| null>\(null\);\n/,
  /  const \[modelRouterConfig, setModelRouterConfig\] = useState<ModelRouterConfig>\(\(\) =>\n    createDefaultModelRouterConfig\(\),\n  \);\n/,
  /  const \[modelRouterStatusMessage, setModelRouterStatusMessage\] = useState\("Zero-cost model router ready\. Local stays default\."\);\n/,
  /  const \[modelRouterTestResult, setModelRouterTestResult\] = useState<ModelRouterTestResult \| null>\(null\);\n/,
  /  const \[latestGeneratedDraft, setLatestGeneratedDraft\] = useState<GeneratedModelDraft \| null>\(null\);\n/,
  /  const \[modelProviderUsage, setModelProviderUsage\] = useState<ModelProviderUsageRecord\[\]>\(\[\]\);\n/,
  /  const \[modelBenchmarkResults, setModelBenchmarkResults\] = useState<ModelBenchmarkResult\[\]>\(\[\]\);\n/,
  /  const \[modelComparisonPrompt, setModelComparisonPrompt\] = useState\(""\);\n/,
  /  const \[modelComparisonRun, setModelComparisonRun\] = useState<ModelComparisonRun \| null>\(null\);\n/,
  /  const \[streamingModelText, setStreamingModelText\] = useState\(""\);\n/,
  /  const \[modelProviderKeyStatus, setModelProviderKeyStatus\] = useState<Record<string, boolean>>\(\{\}\);\n/,
  /  const \[modelProviderKeyPreview, setModelProviderKeyPreview\] = useState<Record<string, string>>\(\{\}\);\n/,
  /  const \[isTestingModelRouter, setIsTestingModelRouter\] = useState\(false\);\n/,
  /  const \[isBenchmarkingModels, setIsBenchmarkingModels\] = useState\(false\);\n/,
  /  const \[isComparingModels, setIsComparingModels\] = useState\(false\);\n/,
  /  const \[isGeneratingModelDraft, setIsGeneratingModelDraft\] = useState\(false\);\n/,
  /  const \[savedWorkflows, setSavedWorkflows\] = useState<SavedWorkflowRecord\[\]>\(\[\]\);\n/,
  /  const \[workflowSuggestion, setWorkflowSuggestion\] = useState<WorkflowSuggestionRecord \| null>\(null\);\n/,
  /  const \[editingWorkflowId, setEditingWorkflowId\] = useState<string \| null>\(null\);\n/,
  /  const \[pendingWorkflowExecution, setPendingWorkflowExecution\] =\n    useState<PendingWorkflowExecution \| null>\(null\);\n/,
  /  const \[workflowImportText, setWorkflowImportText\] = useState\(""\);\n/,
  /  const localRecorderRef = useRef<\{ stop: \(\) => Promise<string> \} \| null>\(null\);\n/,
  /  const followUpTimeoutRef = useRef<number \| null>\(null\);\n/,
  /  const wakeTriggeredRef = useRef\(false\);\n/,
  /  const transformersEmbeddingRef = useRef<\{[\s\S]*?\} \| null>\(null\);\n/,
  /  const semanticIntentEmbeddingCacheRef = useRef<\n    Map<string, \{ embedding: number\[\]; backend: EmbeddingBackend \}>\n  >\(new Map\(\)\);\n/,
];
for (const re of stateRemovals) {
  src = src.replace(re, "");
}

// --- extend semantic routing ---
src = src.replace(
  /  const \{\n    pendingClarification,\n    setPendingClarification,\n    lastSemanticIntentMatches,\n    setLastSemanticIntentMatches,\n    learnedIntentRenameDrafts,\n    setLearnedIntentRenameDrafts,\n  \} = useJarvisSemanticRouting\(\);/,
  `  const {
    pendingClarification,
    setPendingClarification,
    lastSemanticIntentMatches,
    setLastSemanticIntentMatches,
    learnedIntentRenameDrafts,
    setLearnedIntentRenameDrafts,
    transformersEmbeddingRef,
    semanticIntentEmbeddingCacheRef,
    buildSemanticEmbeddingWithFallback,
    buildCachedSemanticIntentEmbedding,
    rememberSemanticConversationTurn,
    rememberSemanticIntentFeedback,
  } = useJarvisSemanticRouting({
    activeConversationContext,
    embeddingBackend,
    embeddingModelName,
    ollamaBaseUrl,
    setEmbeddingStatusMessage,
    setSemanticConversationMemory,
    setLastConversationTopic,
    setSemanticIntentFeedback,
  });`,
);

// --- remove workflow persistence useEffects (owned by useJarvisWorkflows) ---
src = src.replace(
  /\n  useEffect\(\(\) => \{\n    try \{\n      const saved = window\.localStorage\.getItem\(SAVED_WORKFLOWS_STORAGE_KEY\);[\s\S]*?\n  \}, \[savedWorkflows\]\);\n/,
  "\n",
);

// --- insert peel hooks after persistence ---
const peelHooksAnchor = `  useJarvisShellPersistence({
    setStatusMessage,
    uiState,
    voiceReplyMode,
    setVoiceReplyMode,
    conversationBackend,
    setConversationBackend,
    setVoiceBackend,
    setSpeechOutputBackend,
    setVoiceAutoRouteEnabled,
    setVoiceResponseEnabled,
    userPreferenceMemory,
    setUserPreferenceMemory,
    semanticConversationMemory,
    setSemanticConversationMemory,
    semanticIntentFeedback,
    setSemanticIntentFeedback,
    embeddingBackend,
    setEmbeddingBackend,
    embeddingModelName,
    setEmbeddingModelName,
    peopleMemory,
    setPeopleMemory,
    travelMemory,
    setTravelMemory,
    expenseMemory,
    setExpenseMemory,
    packageMemory,
    setPackageMemory,
    meetingPrepMemory,
    setMeetingPrepMemory,
    schoolPlanMemory,
    setSchoolPlanMemory,
    desktopPermissionSettings,
    setDesktopPermissionSettings,
  });`;

const peelHooksBlock = `${peelHooksAnchor}

  const executeIntentRef = useRef<
    (intent: CommandIntent) => Promise<boolean | undefined>
  >(async () => undefined);
  const runCommandRef = useRef<
    (
      command: string,
      options?: { appendUserTurn?: boolean; allowChaining?: boolean },
    ) => Promise<RunCommandOutcome>
  >(async () => ({ status: "failed" as const }));
  const routeCommandFromVoiceRef = useRef<(transcript: string) => Promise<void>>(async () => {});
  const teachJarvisMeaningRef = useRef(teachJarvisMeaning);
  teachJarvisMeaningRef.current = teachJarvisMeaning;
  const appendConversationTurnRef = useRef<(role: "user" | "jarvis", text: string, routeLabel?: string) => void>(
    () => {},
  );
  const speakIfEnabledRef = useRef<(text: string) => void>(() => {});

  const {
    desktopProjects,
    setDesktopProjects,
    desktopSchedules,
    setDesktopSchedules,
    findDesktopProject,
    createDesktopProject,
    createDesktopProjectFromTemplate,
    updateDesktopProject,
    deleteDesktopProject,
  } = useJarvisDesktopWorkspaces({
    gatewayEnabled: gatewayConfig?.memoryEnabled,
    setStatusMessage,
  });

  const {
    rustPeopleMemory,
    rustTravelMemory,
    rustExpenseMemory,
    rustPackageMemory,
    rustMeetingPrepMemory,
    rustSchoolPlanMemory,
    setRustPeopleMemory,
    setRustTravelMemory,
    setRustExpenseMemory,
    setRustPackageMemory,
    setRustMeetingPrepMemory,
    setRustSchoolPlanMemory,
  } = useJarvisRustMemoryLoader(gatewayConfig?.memoryEnabled);

  const modelRouter = useJarvisModelRouter({
    activeConversationContext,
    appendConversationTurn: (role, text) => appendConversationTurnRef.current(role, text),
    conversationTurns,
    lastConversationTopic,
    setCommandResult,
    setStatusMessage,
    speakIfEnabled: (text) => speakIfEnabledRef.current(text),
    userPreferenceMemory,
  });

  const {
    applyModelProviderPreset,
    buildNaturalGenerationSystemPrompt,
    callConfiguredModel,
    chooseModelComparisonWinner,
    classifyModelTask,
    compareModelResponses,
    createDefaultModelRouterConfig,
    deleteSavedProviderApiKey,
    generateSafeModelDraft,
    handleTestModelProvider,
    isBenchmarkingModels,
    isComparingModels,
    isGeneratingModelDraft,
    isSensitiveModelPrompt,
    isTestingModelRouter,
    latestGeneratedDraft,
    modelBenchmarkResults,
    modelComparisonPrompt,
    modelComparisonRun,
    modelProviderKeyPreview,
    modelProviderKeyStatus,
    modelProviderUsage,
    modelRouterConfig,
    modelRouterStatusMessage,
    modelRouterTestResult,
    recommendModelRoutesFromHistory,
    refreshProviderKeyStatuses,
    rememberModelProviderUsage,
    resolveModelRoute,
    revealModelText,
    runModelBenchmark,
    saveProviderApiKey,
    setIsBenchmarkingModels,
    setIsComparingModels,
    setIsGeneratingModelDraft,
    setIsTestingModelRouter,
    setLatestGeneratedDraft,
    setModelBenchmarkResults,
    setModelComparisonPrompt,
    setModelComparisonRun,
    setModelProviderKeyPreview,
    setModelProviderKeyStatus,
    setModelProviderUsage,
    setModelRouterConfig,
    setModelRouterStatusMessage,
    setModelRouterTestResult,
    setPreferredModelProvider,
    setStreamingModelText,
    streamingModelText,
    testSavedProviderApiKey,
    updateModelProviderConfig,
    updateModelRouterConfig,
  } = modelRouter;

  const workflows = useJarvisWorkflows({
    activeConversationContext,
    appendConversationTurnRef,
    plannerTasks,
    recentEmails,
    recentFiles,
    recentNotes,
    runCommandRef,
    setCommandResult,
    setStatusMessage,
    speakIfEnabledRef,
  });

  const {
    continuePendingWorkflowExecution,
    editingWorkflowId,
    getDismissedWorkflowSignatures,
    getWorkflowCounts,
    handleAddWorkflowTemplate,
    handleApproveWorkflowSuggestion,
    handleDeleteWorkflow,
    handleDismissWorkflowSuggestion,
    handleExportWorkflows,
    handleImportWorkflows,
    handleRenameWorkflow,
    handleSaveWorkflowEdits,
    handleWorkflowFieldChange,
    handleWorkflowStepChange,
    pendingWorkflowExecution,
    rememberWorkflowSequence,
    savedWorkflows,
    setDismissedWorkflowSignatures,
    setEditingWorkflowId,
    setPendingWorkflowExecution,
    setSavedWorkflows,
    setWorkflowCounts,
    setWorkflowImportText,
    setWorkflowRenameDrafts,
    setWorkflowSuggestion,
    teachJarvisWorkflow,
    workflowImportText,
    workflowRenameDrafts,
    workflowSuggestion,
  } = workflows;

  const voiceRuntime = useJarvisVoiceRuntime({
    assistantName,
    setAssistantName,
    wakeModeEnabled,
    setWakeModeEnabled,
    setWakeModeStatus,
    setWakeCueActive,
    setWakeListenerActive,
    browserAliases,
    conversationBackend,
    isRoutingCommand,
    setInput,
    setStatusMessage,
    setCommandResult,
    routeCommandFromVoiceRef,
    runCommandRef,
    speakIfEnabledRef,
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
  });

  const {
    applyVoiceCorrections,
    beginSelectedVoiceCapture,
    clearFollowUpTimeout,
    clearWakeRestartTimeout,
    closeFollowUpWindow,
    followUpTimeoutRef,
    handleGroqVoiceToggle,
    handleLocalVoiceToggle,
    handleSaveLocalSpeechConfig,
    handleSaveLocalVoiceConfig,
    handleSaveWakeMode,
    handleVoiceStart,
    handleVoiceStateChange,
    handleWakeActivation,
    loadLocalSpeechStatus,
    loadLocalVoiceStatus,
    loadVoiceCorrections,
    loadWakeModeStatus,
    localRecorderRef,
    openFollowUpWindow,
    restartFollowUpListenerSoon,
    restartWakeListenerSoon,
    returnToArmedWakeMode,
    shouldAutoRouteVoice,
    shouldUseBrowserFollowUps,
    speakIfEnabled,
    startBrowserVoiceRecognition,
    startBrowserWakeListener,
    stopCommandListener,
    stopHandsFreeSession,
    stopWakeListener,
    triggerVoiceAutoRoute,
    wakeTriggeredRef,
  } = voiceRuntime;

  speakIfEnabledRef.current = speakIfEnabled;

  const executeIntentForOcr = useCallback(
    (intent: CommandIntent) => executeIntentRef.current(intent),
    [],
  );

  const ocr = useJarvisOcr({
    appendConversationTurn: (role, text) => appendConversationTurnRef.current(role, text),
    executeIntent: executeIntentForOcr,
    gatewayEnabled: gatewayConfig?.ocrEnabled,
    setActiveConversationContext,
    setCommandResult,
    setRecentNotes,
    setStatusMessage,
    speakIfEnabled,
  });

  const {
    activeOcrWatches,
    beginOcrSelection,
    captureOcrSnapshot,
    completeOcrSelection,
    isOcrSelecting,
    lastOcrText,
    lastScreenshotPath,
    ocrCorrections,
    ocrHistory,
    ocrSelection,
    ocrWatchMatches,
    ocrWatchTargets,
    ocrWatchTemplates,
    primaryOcrWatch,
    rememberOcrHistory,
    runOcrWatchCheck,
    selectionRect,
    setIsOcrSelecting,
    setLastOcrText,
    setLastScreenshotPath,
    setOcrCorrections,
    setOcrHistory,
    setOcrSelection,
    setOcrWatchMatches,
    setOcrWatchTargets,
    setOcrWatchTemplates,
  } = ocr;

  const builderAutopilot = useJarvisBuilderAutopilot({
    assistantName,
    autonomousSkillBuildingEnabled,
    skillAutopilotAvailable,
    missingSkillRequest,
    missingSkillPlan,
    implementationRequest,
    executorStatus,
    appendConversationTurn: (role, text) => appendConversationTurnRef.current(role, text),
    speakIfEnabled,
    setIsGeneratingMissingSkillPlan,
    setAutonomousBuildStatus,
    setMissingSkillPlan,
    setImplementationRequest,
    setBuildRequest,
    setHandoffArtifact,
    setCommandResult,
  });

  const {
    createBuildRequest,
    createImplementationRequest,
    handleAskAdvancedAssistant,
    handleApproveSkillPlan,
    handleGenerateBuildRequest,
    handleCreateHandoffArtifact,
  } = builderAutopilot;

  const trainingMode = useJarvisTrainingMode({
    setTeachingTargetPhrase,
    setPendingClarification,
    setCommandResult,
    setStatusMessage,
    setVoiceSessionPhase,
    appendConversationTurn: (role, text) => appendConversationTurnRef.current(role, text),
    speakIfEnabled,
    openFollowUpWindow,
    teachJarvisMeaning: (...args) => teachJarvisMeaningRef.current(...args),
    teachJarvisWorkflow,
  });

  const { trainingModeSession, setTrainingModeSession, startTrainingMode, handleTrainingModeInput } =
    trainingMode;`;

if (!src.includes("useJarvisDesktopWorkspaces")) {
  src = src.replace(peelHooksAnchor, peelHooksBlock);
}

// --- remove duplicate shouldAutoRouteVoice ---
src = src.replace(
  /\n\n  const shouldAutoRouteVoice =\n    voiceAutoRouteEnabled \|\| conversationBackend === "ollama" \|\| conversationBackend === "auto";\n/,
  "\n",
);

// --- remove peeled function bodies ---
const fnNames = [
  "buildSemanticEmbeddingWithFallback",
  "buildCachedSemanticIntentEmbedding",
  "rememberSemanticConversationTurn",
  "rememberSemanticIntentFeedback",
  "createDesktopProject",
  "createDesktopProjectFromTemplate",
  "updateDesktopProject",
  "deleteDesktopProject",
  "findDesktopProject",
  "buildCrossFeatureSuggestionsForEmail",
  "buildCrossFeatureSuggestionsForState",
  "pickProactiveCrossSuggestion",
  "clearWakeRestartTimeout",
  "clearFollowUpTimeout",
  "shouldUseBrowserFollowUps",
  "shouldKeepFollowUpWindowOpen",
  "closeFollowUpWindow",
  "openFollowUpWindow",
  "stopWakeListener",
  "stopCommandListener",
  "stopHandsFreeSession",
  "returnToArmedWakeMode",
  "loadVoiceCorrections",
  "loadLocalVoiceStatus",
  "loadLocalSpeechStatus",
  "loadWakeModeStatus",
  "handleDeleteWorkflow",
  "handleRenameWorkflow",
  "teachJarvisWorkflow",
  "rememberWorkflowSequence",
  "handleApproveWorkflowSuggestion",
  "handleDismissWorkflowSuggestion",
  "handleWorkflowFieldChange",
  "handleWorkflowStepChange",
  "handleSaveWorkflowEdits",
  "handleAddWorkflowTemplate",
  "handleExportWorkflows",
  "handleImportWorkflows",
  "getWorkflowCounts",
  "setWorkflowCounts",
  "getDismissedWorkflowSignatures",
  "setDismissedWorkflowSignatures",
  "startTrainingMode",
  "handleTrainingModeInput",
  "updateModelProviderConfig",
  "saveProviderApiKey",
  "refreshProviderKeyStatuses",
  "deleteSavedProviderApiKey",
  "testSavedProviderApiKey",
  "revealModelText",
  "applyModelProviderPreset",
  "setPreferredModelProvider",
  "updateModelRouterConfig",
  "rememberModelProviderUsage",
  "classifyModelTask",
  "isSensitiveModelPrompt",
  "resolveModelRoute",
  "buildNaturalGenerationSystemPrompt",
  "handleTestModelProvider",
  "callConfiguredModel",
  "generateSafeModelDraft",
  "compareModelResponses",
  "chooseModelComparisonWinner",
  "runModelBenchmark",
  "recommendModelRoutesFromHistory",
  "continuePendingWorkflowExecution",
  "handleAskAdvancedAssistant",
  "createImplementationRequest",
  "createBuildRequest",
  "handleApproveSkillPlan",
  "handleGenerateBuildRequest",
  "handleCreateHandoffArtifact",
  "handleVoiceStateChange",
  "handleSaveVoiceCorrection",
  "handleSaveLocalVoiceConfig",
  "handleSaveLocalSpeechConfig",
  "handleSaveWakeMode",
  "handleWakeActivation",
  "handleLocalVoiceToggle",
  "startBrowserVoiceRecognition",
  "startBrowserWakeListener",
  "handleGroqVoiceToggle",
  "handleVoiceStart",
  "triggerVoiceAutoRoute",
  "runOcrWatchCheck",
  "captureOcrSnapshot",
  "rememberOcrHistory",
  "beginOcrSelection",
  "completeOcrSelection",
  "renderJarvisPanelContent",
];

for (const name of fnNames) {
  const re = new RegExp(
    `\\n  (async )?function ${name}\\([\\s\\S]*?(?=\\n  (async )?function |\\n  const [a-zA-Z]|\\n  useEffect|\\n  useJarvis|\\n  useOcr|\\n  async function submit)`,
    "m",
  );
  src = src.replace(re, "\n");
}

// --- replace router bridge ---
const routerAssignMatch = src.match(
  /\n  const commandRouterDepsRef = useRef<CommandRouterDeps>\(\{\}\);\n  Object\.assign\(commandRouterDepsRef\.current, \{[\s\S]*?\n  \}\);\n  const commandRouter = useJarvisCommandRouter\(commandRouterDepsRef\.current\);\n  const \{ routeCommand, routeCommandFromVoice, executeIntent, runCommand \} = commandRouter;/,
);
if (routerAssignMatch) {
  const assignBody = routerAssignMatch[0].match(/Object\.assign\(commandRouterDepsRef\.current, \{([\s\S]*)\}\);/)?.[1] ?? "";
  const bridgeReplacement = `
  const commandRouter = useJarvisShellRouterBridge(
    {
      state: {${assignBody}},
      setters: {},
      handlers: {},
      voice: {},
      gateway: {},
      model: {},
      workflow: {},
      integration: {},
      memory: {},
      ocr: {},
      ui: {},
      autonomous: {},
      proposals: {},
      loaders: {},
      embedding: {},
    },
    { executeIntentRef, runCommandRef, routeCommandFromVoiceRef },
  );
  const { routeCommand, routeCommandFromVoice, executeIntent, runCommand, assignRouterRefs } =
    commandRouter;
  assignRouterRefs();`;
  src = src.replace(routerAssignMatch[0], bridgeReplacement);
}

// --- schedule timers hook ---
src = src.replace(
  /\n  useEffect\(\(\) => \{\n    const timers = desktopSchedules[\s\S]*?\n  \}, \[desktopSchedules\]\);\n/,
  `\n  useJarvisDesktopScheduleTimers({
    desktopSchedules,
    executeIntent,
    setDesktopSchedules,
  });\n`,
);

// --- cross-feature suggestions ---
if (!src.includes("const crossFeatureSuggestions = useMemo")) {
  src = src.replace(
    /  const visibleGatewayPreview =/,
    `  const crossFeatureSuggestions = useMemo(
    () =>
      buildCrossFeatureSuggestionsForState({
        peopleMemory,
        packageMemory,
        expenseMemory,
        meetingPrepMemory,
        schoolPlanMemory,
      }),
    [peopleMemory, packageMemory, expenseMemory, meetingPrepMemory, schoolPlanMemory],
  );

  const visibleGatewayPreview =`,
  );
}

// --- view model ---
const viewModelStart = src.indexOf("  const selectionRect = ocrSelection");
const viewModelEnd = src.indexOf("  async function submitShellBarCommand");
if (viewModelStart !== -1 && viewModelEnd !== -1) {
  const viewModelReplacement = `  const shellViewModel = useJarvisShellViewModel({
    learnedIntentMappings,
    rustPeopleMemory,
    peopleMemory,
    rustTravelMemory,
    travelMemory,
    rustExpenseMemory,
    expenseMemory,
    rustPackageMemory,
    packageMemory,
    rustMeetingPrepMemory,
    meetingPrepMemory,
    rustSchoolPlanMemory,
    schoolPlanMemory,
    voiceSessionPhase,
    activeOcrWatches,
    googleCalendarAccessToken,
    gmailAccessToken,
    notionStatus,
    spotifyAccessToken,
    desktopProjects,
    savedWorkflows,
    ocrWatchTargets,
    ocrHistory,
    modelRouterConfig,
    executorStatus,
    uiState,
  });

  const {
    learnedIntentFamilies,
    displayPeopleMemory,
    displayTravelMemory,
    displayExpenseMemory,
    displayPackageMemory,
    displayMeetingPrepMemory,
    displaySchoolPlanMemory,
    memoryTotal,
    connectedIntegrations,
    cockpitSignals,
    cockpitMissionPrompts,
    dataSphereNodes,
    jarvisHomeApps,
    activeHomeApp,
    activeHomeAppRecord,
  } = shellViewModel;

  const shellBarPlacement = uiState.quickBar.placement;

`;
  src = src.slice(0, viewModelStart) + viewModelReplacement + src.slice(viewModelEnd);
}

// --- replace render return ---
const renderStart = src.indexOf("  const systemDrawerContent = (");
const returnStart = src.indexOf("  return (\n    <main");
if (renderStart !== -1 && returnStart !== -1) {
  const renderReplacement = `  const [showGatewayTrace, setShowGatewayTrace] = useState(false);

  const drawerContext = useMemo(
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

  const renderProps: JarvisAppRootRenderProps = {
    uiState,
    dispatchUi,
    shellViewModel,
    workspaceSections,
    drawerContext,
    input,
    setInput,
    isRoutingCommand,
    commandRouter,
    statusMessage,
    assistantName,
    wakeCueActive,
    showGatewayTrace,
    setShowGatewayTrace,
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
    panelContentProps,
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
  };

  return <JarvisAppRootRender {...renderProps} />`;
  src = src.slice(0, renderStart) + renderReplacement + "\n}\n";
}

// appendConversationTurn ref sync
if (!src.includes("appendConversationTurnRef.current = appendConversationTurn")) {
  src = src.replace(
    /(function appendConversationTurn\([\s\S]*?\n  \}\n)/,
    `$1\n  appendConversationTurnRef.current = appendConversationTurn;\n`,
  );
}

// useOcrWatchScheduler after ocr hook - add if missing
if (!src.includes("useOcrWatchScheduler(ocrWatchTargets")) {
  src = src.replace(
    /  const visibleGatewayPreview =/,
    `  useOcrWatchScheduler(ocrWatchTargets, runOcrWatchCheck);

  const visibleGatewayPreview =`,
  );
}

// add useCallback to react import if needed
if (src.includes("useCallback(") && !src.match(/import \{[^}]*useCallback/)) {
  src = src.replace(
    /import \{ ([^}]+) \} from "react";/,
    (m, imports) => `import { ${imports.includes("useCallback") ? imports : `${imports}, useCallback`} } from "react";`,
  );
}

fs.writeFileSync(hookPath, src);
console.log(`Wave 11 peel applied. Lines: ${src.split(/\r?\n/).length}`);
