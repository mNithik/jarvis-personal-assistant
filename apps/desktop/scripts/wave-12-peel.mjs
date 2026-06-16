/**
 * Wave 12 peel: extract shell state, panel chrome, router ctx builder, render assembly hooks.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const hooksDir = path.join(__dirname, "../src/hooks");
const rootPath = path.join(hooksDir, "useJarvisAppRoot.tsx");
let src = fs.readFileSync(rootPath, "utf8");

// --- Extract state block (lines between export function and openJarvisPanel) ---
const fnStart = src.indexOf("export function useJarvisAppRoot(): ReactNode {");
const panelFnStart = src.indexOf("  function openJarvisPanel(panel: JarvisPanelId) {");
if (fnStart === -1 || panelFnStart === -1) throw new Error("state boundaries not found");

const stateBlock = src.slice(
  fnStart + "export function useJarvisAppRoot(): ReactNode {\n".length,
  panelFnStart,
);

const shellStateFile = `import { useReducer, useRef, useState } from "react";

import { DEFAULT_DESKTOP_PERMISSION_SETTINGS } from "./jarvisAppRootLegacyImports";
import { jarvisUiReducer } from "../ui/model/uiReducer";
import { loadJarvisUiState } from "../ui/model/uiPersistence";
import type {
  AutonomousBuildStatus,
  BuildHandoffArtifact,
  ConversationBackend,
  ConversationBackendComparison,
  ConversationContextStackEntry,
  ConversationTopicRecord,
  ConversationTurn,
  CrossFeatureSuggestionRecord,
  DesktopPermissionSettings,
  EmbeddingBackend,
  ExecutorStatus,
  OllamaStatus,
} from "../features/command/jarvisCommandTypes";
import type { GoogleCalendarEventRecord } from "../services/googleCalendar";
import type { SpotifyPlaybackState } from "../services/spotify";
import type {
  BrowserAliasRecord,
  EmailRecord,
  FileRecord,
  GoogleCalendarStatus,
  HistoryRecord,
  LearnedIntentRecord,
  MissingSkillPlan,
  NoteRecord,
  NotionStatus,
  ProposalRecord,
  ProposalStepRecord,
  RoutineRecord,
  SkillBuildRequest,
  SkillImplementationRequest,
  SpotifyStatus,
} from "../types/jarvis";
import type {
  ActiveConversationContext,
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
import type { GatewayPreview } from "../services/jarvisApi";

type CommandResult = { title: string; detail: string; routeLabel?: string };
type PendingGatewayConfirmation = { command: string; preview: GatewayPreview };
type PendingGatewayTeaching = { phrase: string; preview: GatewayPreview };

export type JarvisShellState = ReturnType<typeof useJarvisShellState>;

export function useJarvisShellState() {
${stateBlock}  return {
    input, setInput, statusMessage, setStatusMessage, commandResult, setCommandResult,
    isRoutingCommand, setIsRoutingCommand, pendingGatewayConfirmation, setPendingGatewayConfirmation,
    pendingGatewayTeaching, setPendingGatewayTeaching, gatewaySessionRef, storedRoutines, setStoredRoutines,
    recentHistory, setRecentHistory, proposals, setProposals, isGeneratingProposal, setIsGeneratingProposal,
    proposalSteps, setProposalSteps, editingProposalId, setEditingProposalId, assistantName, setAssistantName,
    wakeModeEnabled, setWakeModeEnabled, wakeModeStatus, setWakeModeStatus, wakeCueActive, setWakeCueActive,
    browserAliases, setBrowserAliases, learnedIntentMappings, setLearnedIntentMappings,
    userPreferenceMemory, setUserPreferenceMemory, browserAliasUrl, setBrowserAliasUrl,
    googleCalendarStatus, setGoogleCalendarStatus, googleCalendarClientId, setGoogleCalendarClientId,
    googleCalendarApiKey, setGoogleCalendarApiKey, googleCalendarAccessToken, setGoogleCalendarAccessToken,
    todayCalendarEvents, setTodayCalendarEvents, gmailAccessToken, setGmailAccessToken,
    recentEmails, setRecentEmails, plannerTasks, setPlannerTasks, peopleMemory, setPeopleMemory,
    travelMemory, setTravelMemory, expenseMemory, setExpenseMemory, packageMemory, setPackageMemory,
    meetingPrepMemory, setMeetingPrepMemory, schoolPlanMemory, setSchoolPlanMemory,
    spotifyStatus, setSpotifyStatus, spotifyClientId, setSpotifyClientId,
    spotifyAccessToken, setSpotifyAccessToken, spotifyPlaybackState, setSpotifyPlaybackState,
    recentFiles, setRecentFiles, desktopPermissionSettings, setDesktopPermissionSettings,
    jarvisPanels, setJarvisPanels, panelDragState, setPanelDragState, shellBarInput, setShellBarInput,
    shellBarDragState, setShellBarDragState, uiState, dispatchUi,
    activeConversationContext, setActiveConversationContext, conversationContextStack, setConversationContextStack,
    presentedCollectionContext, setPresentedCollectionContext,
    semanticConversationMemory, setSemanticConversationMemory, semanticIntentFeedback, setSemanticIntentFeedback,
    lastConversationTopic, setLastConversationTopic, notionStatus, setNotionStatus,
    notionTokenInput, setNotionTokenInput, notionDatabaseId, setNotionDatabaseId, recentNotes, setRecentNotes,
    conversationBackend, setConversationBackend, backendComparePrompt, setBackendComparePrompt,
    backendComparison, setBackendComparison, isComparingBackends, setIsComparingBackends,
    ollamaStatus, setOllamaStatus, ollamaBaseUrl, setOllamaBaseUrl, ollamaModelName, setOllamaModelName,
    embeddingBackend, setEmbeddingBackend, embeddingModelName, setEmbeddingModelName,
    embeddingStatusMessage, setEmbeddingStatusMessage, missingSkillRequest, setMissingSkillRequest,
    missingSkillPlan, setMissingSkillPlan, isGeneratingMissingSkillPlan, setIsGeneratingMissingSkillPlan,
    implementationRequest, setImplementationRequest, buildRequest, setBuildRequest,
    proactiveCrossSuggestion, setProactiveCrossSuggestion,
    autonomousSkillBuildingEnabled, setAutonomousSkillBuildingEnabled,
    autonomousBuildStatus, setAutonomousBuildStatus, handoffArtifact, setHandoffArtifact,
    executorStatus, setExecutorStatus, executorCommandPath, setExecutorCommandPath,
    executorWorkingDirectory, setExecutorWorkingDirectory, conversationTurns, setConversationTurns,
    teachingTargetPhrase, setTeachingTargetPhrase, wakeListenerActive, setWakeListenerActive,
    currentRouteLabelRef,
  };
}
`;

fs.writeFileSync(path.join(hooksDir, "useJarvisShellState.ts"), shellStateFile);

// Replace state block in root with hook call
src = src.replace(
  stateBlock,
  "  const shellState = useJarvisShellState();\n",
);

if (!src.includes("useJarvisShellState")) {
  src = src.replace(
    'import { useJarvisBuilderAutopilot } from "./useJarvisBuilderAutopilot";',
    'import { useJarvisBuilderAutopilot } from "./useJarvisBuilderAutopilot";\nimport { useJarvisShellState } from "./useJarvisShellState";',
  );
}

// Add destructuring after shellState line - insert after const shellState = useJarvisShellState();
const destructure = `  const {
    input, setInput, statusMessage, setStatusMessage, commandResult, setCommandResult,
    isRoutingCommand, setIsRoutingCommand, pendingGatewayConfirmation, setPendingGatewayConfirmation,
    pendingGatewayTeaching, setPendingGatewayTeaching, gatewaySessionRef, storedRoutines, setStoredRoutines,
    recentHistory, setRecentHistory, proposals, setProposals, isGeneratingProposal, setIsGeneratingProposal,
    proposalSteps, setProposalSteps, editingProposalId, setEditingProposalId, assistantName, setAssistantName,
    wakeModeEnabled, setWakeModeEnabled, wakeModeStatus, setWakeModeStatus, wakeCueActive, setWakeCueActive,
    browserAliases, setBrowserAliases, learnedIntentMappings, setLearnedIntentMappings,
    userPreferenceMemory, setUserPreferenceMemory, browserAliasUrl, setBrowserAliasUrl,
    googleCalendarStatus, setGoogleCalendarStatus, googleCalendarClientId, setGoogleCalendarClientId,
    googleCalendarApiKey, setGoogleCalendarApiKey, googleCalendarAccessToken, setGoogleCalendarAccessToken,
    todayCalendarEvents, setTodayCalendarEvents, gmailAccessToken, setGmailAccessToken,
    recentEmails, setRecentEmails, plannerTasks, setPlannerTasks, peopleMemory, setPeopleMemory,
    travelMemory, setTravelMemory, expenseMemory, setExpenseMemory, packageMemory, setPackageMemory,
    meetingPrepMemory, setMeetingPrepMemory, schoolPlanMemory, setSchoolPlanMemory,
    spotifyStatus, setSpotifyStatus, spotifyClientId, setSpotifyClientId,
    spotifyAccessToken, setSpotifyAccessToken, spotifyPlaybackState, setSpotifyPlaybackState,
    recentFiles, setRecentFiles, desktopPermissionSettings, setDesktopPermissionSettings,
    jarvisPanels, setJarvisPanels, panelDragState, setPanelDragState, shellBarInput, setShellBarInput,
    shellBarDragState, setShellBarDragState, uiState, dispatchUi,
    activeConversationContext, setActiveConversationContext, conversationContextStack, setConversationContextStack,
    presentedCollectionContext, setPresentedCollectionContext,
    semanticConversationMemory, setSemanticConversationMemory, semanticIntentFeedback, setSemanticIntentFeedback,
    lastConversationTopic, setLastConversationTopic, notionStatus, setNotionStatus,
    notionTokenInput, setNotionTokenInput, notionDatabaseId, setNotionDatabaseId, recentNotes, setRecentNotes,
    conversationBackend, setConversationBackend, backendComparePrompt, setBackendComparePrompt,
    backendComparison, setBackendComparison, isComparingBackends, setIsComparingBackends,
    ollamaStatus, setOllamaStatus, ollamaBaseUrl, setOllamaBaseUrl, ollamaModelName, setOllamaModelName,
    embeddingBackend, setEmbeddingBackend, embeddingModelName, setEmbeddingModelName,
    embeddingStatusMessage, setEmbeddingStatusMessage, missingSkillRequest, setMissingSkillRequest,
    missingSkillPlan, setMissingSkillPlan, isGeneratingMissingSkillPlan, setIsGeneratingMissingSkillPlan,
    implementationRequest, setImplementationRequest, buildRequest, setBuildRequest,
    proactiveCrossSuggestion, setProactiveCrossSuggestion,
    autonomousSkillBuildingEnabled, setAutonomousSkillBuildingEnabled,
    autonomousBuildStatus, setAutonomousBuildStatus, handoffArtifact, setHandoffArtifact,
    executorStatus, setExecutorStatus, executorCommandPath, setExecutorCommandPath,
    executorWorkingDirectory, setExecutorWorkingDirectory, conversationTurns, setConversationTurns,
    teachingTargetPhrase, setTeachingTargetPhrase, wakeListenerActive, setWakeListenerActive,
    currentRouteLabelRef,
  } = shellState;\n`;

src = src.replace(
  "  const shellState = useJarvisShellState();\n",
  `  const shellState = useJarvisShellState();\n${destructure}`,
);

fs.writeFileSync(rootPath, src);
console.log("Wave 12 peel: useJarvisShellState extracted");
