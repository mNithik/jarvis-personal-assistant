/**
 * Fix corrupted useJarvisAppRoot.tsx: restore imports + router bridge ctx block.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const hookPath = path.join(__dirname, "../src/hooks/useJarvisAppRoot.tsx");
const bridgePath = path.join(__dirname, "../src/hooks/buildJarvisRouterBridgeState.ts");
const legacyPath = path.join(__dirname, "../src/hooks/jarvisAppRootLegacyImports.ts");

let hook = fs.readFileSync(hookPath, "utf8");
const bridge = fs.readFileSync(bridgePath, "utf8");

const ctxKeys = [...bridge.matchAll(/^\s{2}(\w+): CommandRouterDeps\[/gm)].map((m) => m[1]);
const ctxBlock = ctxKeys.map((key) => `        ${key},`).join("\n");

const brokenBridgeRe =
  /const commandRouter = useJarvisShellRouterBridge\(\s*\{\s*state: buildJarvisRouterBridgeState\(\{[\s\S]*?\},\s*\{ executeIntentRef/;
const fixedBridge = `const commandRouter = useJarvisShellRouterBridge(
    {
      state: buildJarvisRouterBridgeState({
${ctxBlock}
      }),
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
    { executeIntentRef`;

if (!brokenBridgeRe.test(hook)) {
  throw new Error("Broken router bridge pattern not found");
}
hook = hook.replace(brokenBridgeRe, fixedBridge);

const header = `import { FormEvent, ReactNode, useEffect, useMemo, useReducer, useRef, useState, useCallback } from "react";
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
  defaultJarvisUiState,
  jarvisUiReducer,
} from "../ui/model/uiReducer";
import {
  JARVIS_UI_PREFERENCES_STORAGE_KEY,
  loadJarvisUiState,
  persistJarvisUiState,
} from "../ui/model/uiPersistence";
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
  canonicalizeBrowserUrl,
  DEFAULT_DESKTOP_PERMISSION_SETTINGS,
  formatGatewayFollowUp,
} from "./jarvisAppRootLegacyImports";
import type {
  ActiveConversationContext,
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

`;

if (!hook.trimStart().startsWith("import")) {
  hook = header + hook.trimStart();
}

fs.writeFileSync(hookPath, hook);
console.log(`Restored imports and ${ctxKeys.length} router ctx keys.`);
