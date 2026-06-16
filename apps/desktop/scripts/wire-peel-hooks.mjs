import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const hookPath = path.join(__dirname, "../src/hooks/useJarvisAppRoot.ts");
let src = fs.readFileSync(hookPath, "utf8");

if (!src.includes("useJarvisShellLoaders")) {
  src = src.replace(
    'import { useOcrWatchScheduler } from "../../hooks/useOcrWatchScheduler";',
    `import { useOcrWatchScheduler } from "../../hooks/useOcrWatchScheduler";
import { useJarvisShellLoaders } from "../../hooks/useJarvisShellLoaders";
import { useJarvisIntegrations } from "../../hooks/useJarvisIntegrations";
import { useJarvisShellPersistence } from "../../hooks/useJarvisShellPersistence";`,
  );

  const anchor = `  const semanticIntentEmbeddingCacheRef = useRef<
    Map<string, { embedding: number[]; backend: EmbeddingBackend }>
  >(new Map());

  function openJarvisPanel`;

  const injection = `  const semanticIntentEmbeddingCacheRef = useRef<
    Map<string, { embedding: number[]; backend: EmbeddingBackend }>
  >(new Map());

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
    saveGoogleCalendarConfig,
    connectGoogleCalendar,
    connectGmail,
    saveNotionConfig,
    saveSpotifyConfig,
    connectSpotify,
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

  function openJarvisPanel`;

  if (!src.includes(anchor.split("\n")[0])) {
    throw new Error("useJarvisAppRoot anchor not found");
  }
  src = src.replace(anchor, injection);
}

// Remove duplicate loader functions (loadMemoryView through loadExecutorStatus)
src = src.replace(
  /\n  async function loadMemoryView\(\) \{[\s\S]*?\n  async function loadVoiceCorrections\(\)/,
  "\n  async function loadVoiceCorrections()",
);

src = src.replace(
  /\n  async function loadBrowserAliases\(\) \{[\s\S]*?\n  async function loadLearnedIntents\(\) \{[\s\S]*?\n  async function rememberSuccessfulPhrase/,
  "\n  async function rememberSuccessfulPhrase",
);

// Remove duplicate loader blocks that remain
src = src.replace(/\n  async function loadLearnedIntents\(\) \{[\s\S]*?\n  async function rememberSuccessfulPhrase/, "\n  async function rememberSuccessfulPhrase");

src = src.replace(
  /\n  async function loadGoogleCalendarStatus\(\) \{[\s\S]*?\n  async function loadNotionStatus\(\) \{[\s\S]*?\n  async function loadSpotifyStatus\(\) \{[\s\S]*?\n  async function loadRecentNotes\(\) \{[\s\S]*?\n  async function loadPlannerTaskRecords\(\) \{[\s\S]*?\n  async function loadRecentFiles\(\) \{[\s\S]*?\n  async function loadOllamaStatus\(\) \{[\s\S]*?\n  async function loadExecutorStatus\(\) \{[\s\S]*?\n  \}/,
  "",
);

// Remove boot + OAuth useEffects (integrations hook owns these)
src = src.replace(
  /\n  useEffect\(\(\) => \{\n    void loadMemoryView\(\);[\s\S]*?\n  \}, \[\]\);\n\n  useEffect\(\(\) => \{\n    const storedCalendarToken[\s\S]*?\n  \}, \[\]\);\n\n  useEffect\(\(\) => \{\n    try \{\n      const authResult = completeGoogleRedirectAuthorizationIfNeeded[\s\S]*?\n  \}, \[\]\);\n\n  useEffect\(\(\) => \{\n    const storedToken = getStoredSpotifyAccessToken[\s\S]*?\n  \}, \[\]\);\n\n  useEffect\(\(\) => \{\n    if \(!spotifyClientId\.trim\(\)\) \{[\s\S]*?\n    spotifyClientId,\n  \]\);/,
  "",
);

fs.writeFileSync(hookPath, src);
console.log("Wired peel hooks into useJarvisAppRoot.ts");
