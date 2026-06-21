import { FormEvent, ReactNode, useEffect, useMemo, useRef, useCallback, useState } from "react";
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
  getAppFeatureFlags,
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
} from "../services/jarvisApi";
import { startLocalAudioRecorder } from "../services/localAudioRecorder";
import {
  beginGoogleRedirectAuthorization,
  clearStoredGoogleAccessToken,
  completeGoogleRedirectAuthorizationIfNeeded,
  createGoogleCalendarEvent,
  getStoredGoogleAccessToken,
  listTodayGoogleCalendarEvents,
  GoogleCalendarEventRecord,
} from "../services/googleCalendar";
import {
  listUnreadGmailMessages,
  requestGmailAccessToken,
  searchGmailMessages,
} from "../services/gmail";
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
} from "../services/spotify";
import { speakText } from "../services/speechSynthesis";
import { createVoiceRecognition } from "../services/voiceRecognition";
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
} from "../types/jarvis";
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
} from "../types/voice";
import {
  jarvisQuickPrompts,
  jarvisSkills,
  skillAutopilotAvailable,
} from "../ui/shell/jarvisStaticCatalog";
import { jarvisModules } from "../ui/shell/jarvisModules";
import { createLocalMemoryActions } from "../features/memory/localMemoryActions";
import JarvisAppRootRender from "../ui/shell/JarvisAppRoot.render";
import type { JarvisAppRootRenderProps, JarvisPanelContentProps } from "../ui/shell/jarvisAppRootTypes";
import {
  buildCrossFeatureSuggestionsForEmail,
  buildCrossFeatureSuggestionsForState,
  pickProactiveCrossSuggestion,
} from "../features/shell/crossFeatureSuggestions";
import { useJarvisGatewayShell } from "./useJarvisGatewayShell";
import { useJarvisSemanticRouting } from "./useJarvisSemanticRouting";
import { useJarvisVoiceSession } from "./useJarvisVoiceSession";
import { useJarvisVoiceWake } from "./useJarvisVoiceWake";
import { useOcrWatchScheduler } from "./useOcrWatchScheduler";
import { useJarvisShellLoaders } from "./useJarvisShellLoaders";
import { useJarvisIntegrations } from "./useJarvisIntegrations";
import { useJarvisShellPersistence } from "./useJarvisShellPersistence";
import { useJarvisWorkspaceSections } from "./useJarvisWorkspaceSections";
import { useJarvisShellViewModel } from "./useJarvisShellViewModel";
import { useJarvisShellRouterBridge } from "./useJarvisShellRouterBridge";
import { buildJarvisRouterBridgeState } from "./buildJarvisRouterBridgeState";
import { useJarvisShellState } from "./useJarvisShellState";
import { useJarvisShellPanelChrome } from "./useJarvisShellPanelChrome";
import { useJarvisRouterBridgeContext } from "./useJarvisRouterBridgeContext";
import { useJarvisShellRenderAssembly } from "./useJarvisShellRenderAssembly";

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
import {
  ASSISTANT_DEFAULTS_STORAGE_KEY,
  canonicalizeBrowserUrl,
  createDefaultModelRouterConfig,
  DEFAULT_DESKTOP_PERMISSION_SETTINGS,
  describeCommandIntent,
  describeIntentActionType,
  findConversationContextByLabel,
  formatGatewayFollowUp,
  getConversationContextKey,
  getErrorDetail,
  mapOllamaInterpretationToResult,
  normalizeControlCommand,
  normalizeLearnedPhrase,
  parseConversationalCommandIntent,
  parseTrainingReviewCleanupCommand,
  RECOMMENDED_ASSISTANT_DEFAULTS,
  shouldUseOllamaFirstInAutoMode,
} from "./jarvisAppRootLegacyImports";
import type {
  ActiveConversationContext,
  AssistantDefaults,
  CommandIntent,
  ConversationBackendComparison,
  ConversationContextStackEntry,
  ConversationTopicRecord,
  ConversationTurn,
  CrossFeatureSuggestionRecord,
  DesktopPermissionSettings,
  DesktopProjectRecord,
  DesktopScheduleRecord,
  EmbeddingBackend,
  ExpenseMemoryRecord,
  JarvisPanelId,
  JarvisPanelRecord,
  MeetingPrepMemoryRecord,
  ModelRouterConfig,
  OcrWatchTarget,
  PackageMemoryRecord,
  PanelDragState,
  PendingClarification,
  PersonMemoryRecord,
  PlannerTaskRecord,
  PresentedCollectionContext,
  RunCommandOutcome,
  SavedWorkflowRecord,
  SchoolPlanMemoryRecord,
  SemanticConversationMemoryRecord,
  SemanticIntentFeedbackRecord,
  ShellBarDragState,
  ShellBarPlacement,
  TravelMemoryRecord,
  UserPreferenceMemory,
  WorkflowSuggestionRecord,
} from "../features/command/jarvisCommandTypes";

export function useJarvisAppRootComposition(): ReactNode {
  const shellState = useJarvisShellState();
  const [embeddedTerminalEnabled, setEmbeddedTerminalEnabled] = useState(true);
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
    pendingHandoffLaunch, setPendingHandoffLaunch,
    executorStatus, setExecutorStatus,
    executorCommandPath, setExecutorCommandPath,
    executorWorkingDirectory, setExecutorWorkingDirectory,
    conversationTurns, setConversationTurns,
    teachingTargetPhrase, setTeachingTargetPhrase,
    wakeListenerActive, setWakeListenerActive,
    currentRouteLabelRef,
  } = shellState;



  const {
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


  const upcomingModules = useMemo(
    () => jarvisSkills.filter((skill: (typeof jarvisSkills)[number]) => skill.status === "planned").length,
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
  });

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
  const {
    loadMemoryView,
    loadProposalSteps,
    loadBrowserAliases,
    loadLearnedIntents,
    rememberSuccessfulPhrase,
    handleDeleteLearnedIntent,
    handleRenameLearnedIntent,
    teachJarvisMeaning,
    loadGoogleCalendarStatus,
    loadNotionStatus,
    loadSpotifyStatus,
    loadRecentNotes,
    loadPlannerTaskRecords,
    loadRecentFiles,
    loadOllamaStatus,
    loadExecutorStatus,
  } = useJarvisShellLoaders({
    setStatusMessage,
    setCommandResult,
    setStoredRoutines,
    setRecentHistory,
    setProposals,
    setProposalSteps,
    setBrowserAliases,
    setLearnedIntentMappings,
    setSemanticIntentFeedback,
    setLearnedIntentRenameDrafts,
    setGoogleCalendarStatus,
    setGoogleCalendarClientId,
    setGoogleCalendarApiKey,
    setNotionStatus,
    setNotionDatabaseId,
    setSpotifyStatus,
    setSpotifyClientId,
    setRecentNotes,
    setPlannerTasks,
    setRecentFiles,
    setOllamaStatus,
    setOllamaBaseUrl,
    setOllamaModelName,
    setExecutorStatus,
    setExecutorCommandPath,
    setExecutorWorkingDirectory,
    browserAliases,
    learnedIntentMappings,
    learnedIntentRenameDrafts,
  });

  const {
    saveGoogleCalendarConfig: handleSaveGoogleCalendarConfig,
    connectGoogleCalendar: handleConnectGoogleCalendar,
    connectGmail: handleConnectGmail,
    saveNotionConfig: handleSaveNotionConfig,
    saveSpotifyConfig: handleSaveSpotifyConfig,
    connectSpotify: handleConnectSpotify,
    refreshSpotifyPlayback,
  } = useJarvisIntegrations({
    googleCalendarApiKey,
    googleCalendarClientId,
    googleCalendarStatus,
    loadBrowserAliases,
    loadExecutorStatus,
    loadGoogleCalendarStatus,
    loadLearnedIntents,
    loadMemoryView,
    loadNotionStatus,
    loadOllamaStatus,
    loadRecentFiles,
    loadRecentNotes,
    loadSpotifyStatus,
    notionDatabaseId,
    notionTokenInput,
    setCommandResult,
    setGmailAccessToken,
    setGoogleCalendarAccessToken,
    setGoogleCalendarStatus,
    setNotionStatus,
    setNotionTokenInput,
    setRecentEmails,
    setSpotifyAccessToken,
    setSpotifyPlaybackState,
    setSpotifyStatus,
    setStatusMessage,
    spotifyClientId,
    spotifyStatus,
  });

  useJarvisShellPersistence({
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
  });

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
    gatewayEnabled: gatewayConfig?.features.memory,
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
  } = useJarvisRustMemoryLoader(gatewayConfig?.features.memory);

  const {
    rememberPersonBirthday,
    updatePersonMemory,
    rememberTravelSummary,
    rememberExpenseSummary,
    rememberPackageSummary,
    rememberMeetingPrepSummary,
    rememberSchoolPlan,
  } = createLocalMemoryActions({
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
  });

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
    voiceReplyMode,
    voiceCorrections,
    setVoiceCorrections,
    voiceSessionPhase,
    setVoiceSessionPhase,
    voiceAutoRouteEnabled,
    voiceBackend,
    localVoiceStatus,
    setLocalVoiceStatus,
    speechOutputBackend,
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
    gatewayEnabled: gatewayConfig?.features.screenOcr,
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
    confirmExecutorLaunch: desktopPermissionSettings.confirmExecutorLaunch,
    embeddedTerminalEnabled,
    appendConversationTurn: (role, text) => appendConversationTurnRef.current(role, text),
    speakIfEnabled,
    setIsGeneratingMissingSkillPlan,
    setAutonomousBuildStatus,
    setMissingSkillPlan,
    setImplementationRequest,
    setBuildRequest,
    setHandoffArtifact,
    setPendingHandoffLaunch,
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
    trainingMode;


  useEffect(() => {
    void getAppFeatureFlags()
      .then((flags) => setEmbeddedTerminalEnabled(flags.embeddedTerminalEnabled))
      .catch(() => undefined);
  }, []);

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

  appendConversationTurnRef.current = appendConversationTurn;


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

  async function handleSaveVoiceCorrection() {
    const heard = voiceCorrectionInput.trim();
    const corrected = input.trim();
    if (!heard || !corrected) {
      setCommandResult({
        title: "Voice correction incomplete",
        detail: "Keep the heard phrase in the correction field and the intended phrase in the command input.",
      });
      return;
    }

    try {
      await saveVoiceCorrectionEntry(heard, corrected);
      await loadVoiceCorrections();
      setVoiceCorrectionInput("");
      setCommandResult({
        title: "Voice correction saved",
        detail: `JARVIS will treat "${heard}" as "${corrected}".`,
      });
      speakIfEnabled("Voice correction saved.");
    } catch {
      setCommandResult({
        title: "Could not save voice correction",
        detail: "JARVIS could not store that voice correction yet.",
      });
    }
  }

  function shouldKeepFollowUpWindowOpen(intent: CommandIntent) {
    return intent.kind !== "sleep_mode" && intent.kind !== "shutdown_app";
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

  useEffect(() => {
    void loadVoiceCorrections();
    void loadLocalVoiceStatus();
    void loadLocalSpeechStatus();
    void loadWakeModeStatus();
  }, []);

  useEffect(() => {
    if (!googleCalendarAccessToken) {
      setTodayCalendarEvents([]);
      return;
    }

    let cancelled = false;
    const refreshCalendarEvents = async () => {
      try {
        const events = await listTodayGoogleCalendarEvents(googleCalendarAccessToken);
        if (!cancelled) {
          setTodayCalendarEvents(events);
        }
      } catch {
        if (!cancelled) {
          setTodayCalendarEvents([]);
        }
      }
    };

    void refreshCalendarEvents();
    const intervalId = window.setInterval(() => {
      void refreshCalendarEvents();
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [googleCalendarAccessToken]);

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






  const shellViewModel = useJarvisShellViewModel({
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
    todayCalendarEvents,
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
    nextMeetingEvent,
    meetingPrepStatus,
  } = shellViewModel;

  const shellBarPlacement = uiState.quickBar.placement;

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

  const crossFeatureSuggestions = useMemo(
    () =>
      buildCrossFeatureSuggestionsForState({
        peopleMemory,
        packageMemory,
        expenseMemory,
        meetingPrepMemory,
        schoolPlanMemory,
        todayCalendarEvents,
        googleCalendarAccessToken,
      }),
    [peopleMemory, packageMemory, expenseMemory, meetingPrepMemory, schoolPlanMemory, todayCalendarEvents, googleCalendarAccessToken],
  );

  const visibleGatewayPreview =
    pendingGatewayConfirmation?.preview ?? pendingGatewayTeaching?.preview ?? gatewayPreview;
  const gatewayFollowUp = formatGatewayFollowUp(visibleGatewayPreview);

  const commandRouter = useJarvisShellRouterBridge(
    {
      state: buildJarvisRouterBridgeState(useJarvisRouterBridgeContext({
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
      })),
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
  assignRouterRefs();

  useJarvisDesktopScheduleTimers({
    desktopSchedules,
    executeIntent,
    setDesktopSchedules,
  });

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
    googleCalendarAccessToken,
    notionStatus,
    runCommand,
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
      googleCalendarAccessToken,
      gmailAccessToken,
      nextMeetingEvent,
      meetingPrepStatus,
      runCommand,
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
      pendingHandoffLaunch,
      onPendingHandoffLaunchHandled: () => setPendingHandoffLaunch(null),
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

  const drawerContextBag = useMemo(
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

  return <JarvisAppRootRender {...renderProps} />
}
