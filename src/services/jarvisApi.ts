import { invoke } from "@tauri-apps/api/core";
import {
  BuildHandoffArtifact,
  BrowserAliasRecord,
  ConversationInterpretation,
  FileRecord,
  GoogleCalendarStatus,
  HistoryRecord,
  LearnedIntentRecord,
  MissingSkillPlan,
  NoteRecord,
  NotionStatus,
  ProposalRecord,
  ProposalStepRecord,
  ProposalUpdateInput,
  RoutineRecord,
  SkillBuildRequest,
  SpotifyStatus,
  VoiceCorrectionRecord,
} from "../types/jarvis";
import {
  OllamaStatus,
  ExecutorStatus,
  LocalSpeechOutputStatus,
  LocalVoiceBackendStatus,
  WakeModeStatus,
} from "../types/voice";

export function pingJarvis() {
  return invoke<string>("ping_jarvis");
}

export function launchStudySetup() {
  return invoke<string>("launch_study_setup");
}

export function launchDesktopApp(appName: string) {
  return invoke<string>("launch_desktop_app", { appName });
}

export function focusDesktopApp(appName: string) {
  return invoke<string>("focus_desktop_app", { appName });
}

export function controlDesktopAppWindow(appName: string, action: string) {
  return invoke<string>("control_desktop_app_window", { appName, action });
}

export function getDesktopAppWindowStatus(appName: string) {
  return invoke<string>("get_desktop_app_window_status", { appName });
}

export function openNamedFolder(folderName: string) {
  return invoke<string>("open_named_folder", { folderName });
}

export function captureDesktopScreenshot() {
  return invoke<string>("capture_desktop_screenshot");
}

export function captureActiveWindowScreenshot() {
  return invoke<string>("capture_active_window_screenshot");
}

export function captureDesktopAppWindowScreenshot(appName: string) {
  return invoke<string>("capture_desktop_app_window_screenshot", { appName });
}

export function captureScreenRegionScreenshot(region: string) {
  return invoke<string>("capture_screen_region_screenshot", { region });
}

export function captureScreenRectScreenshot(x: number, y: number, width: number, height: number) {
  return invoke<string>("capture_screen_rect_screenshot", { x, y, width, height });
}

export function captureGlobalSelectionScreenshot() {
  return invoke<string>("capture_global_selection_screenshot");
}

export function openScreenshotsFolder() {
  return invoke<string>("open_screenshots_folder");
}

export function extractImageOcrText(path: string) {
  return invoke<string>("extract_image_ocr_text", { path });
}

export function readClipboardText() {
  return invoke<string>("read_clipboard_text");
}

export function writeClipboardText(text: string) {
  return invoke<string>("write_clipboard_text", { text });
}

export function runJarvisProjectChecks() {
  return invoke<string>("run_jarvis_project_checks");
}

export function openBrowserUrl(url: string) {
  return invoke<string>("open_browser_url", { url });
}

export function searchLocalFiles(query: string) {
  return invoke<FileRecord[]>("search_local_files", { query });
}

export function listRecentLocalFiles() {
  return invoke<FileRecord[]>("list_recent_local_files");
}

export function openLocalFile(path: string) {
  return invoke<string>("open_local_file", { path });
}

export function extractPdfText(path: string) {
  return invoke<string>("extract_pdf_text", { path });
}

export function searchGoogle(query: string) {
  return invoke<string>("search_google", { query });
}

export function getRoutines() {
  return invoke<RoutineRecord[]>("get_routines");
}

export function getRecentHistory() {
  return invoke<HistoryRecord[]>("get_recent_history");
}

export function getProposals() {
  return invoke<ProposalRecord[]>("get_proposals");
}

export function generateLearningProposal() {
  return invoke<ProposalRecord | null>("generate_learning_proposal");
}

export function getProposalSteps(proposalId: number) {
  return invoke<ProposalStepRecord[]>("get_proposal_steps", { proposalId });
}

export function updateLearningProposal(proposal: ProposalUpdateInput) {
  return invoke<void>("update_learning_proposal", { proposal });
}

export function approveLearningProposal(proposalId: number) {
  return invoke<void>("approve_learning_proposal", { proposalId });
}

export function rejectLearningProposal(proposalId: number) {
  return invoke<void>("reject_learning_proposal", { proposalId });
}

export function getVoiceCorrections() {
  return invoke<VoiceCorrectionRecord[]>("get_voice_corrections");
}

export function saveVoiceCorrectionEntry(
  heardPhrase: string,
  correctedPhrase: string,
) {
  return invoke<void>("save_voice_correction_entry", {
    heardPhrase,
    correctedPhrase,
  });
}

export function getLocalVoiceBackendStatus() {
  return invoke<LocalVoiceBackendStatus>("get_local_voice_backend_status");
}

export function saveLocalVoiceBackendPaths(
  executablePath: string,
  modelPath: string,
) {
  return invoke<LocalVoiceBackendStatus>("save_local_voice_backend_paths", {
    executablePath,
    modelPath,
  });
}

export function transcribeLocalAudio(audioBase64: string) {
  return invoke<string>("transcribe_local_audio", { audioBase64 });
}

export function getLocalSpeechOutputStatus() {
  return invoke<LocalSpeechOutputStatus>("get_local_speech_output_status");
}

export function saveLocalSpeechOutputPaths(
  executablePath: string,
  modelPath: string,
) {
  return invoke<LocalSpeechOutputStatus>("save_local_speech_output_paths", {
    executablePath,
    modelPath,
  });
}

export function speakLocalText(text: string) {
  return invoke<void>("speak_local_text", { text });
}

export function getWakeModeStatus() {
  return invoke<WakeModeStatus>("get_wake_mode_status");
}

export function saveWakeModeStatus(
  assistantName: string,
  wakeModeEnabled: boolean,
) {
  return invoke<WakeModeStatus>("save_wake_mode_status", {
    assistantName,
    wakeModeEnabled,
  });
}

export function getBrowserAliases() {
  return invoke<BrowserAliasRecord[]>("get_browser_aliases");
}

export function saveBrowserAliasEntry(phrase: string, url: string) {
  return invoke<void>("save_browser_alias_entry", { phrase, url });
}

export function getLearnedIntents() {
  return invoke<LearnedIntentRecord[]>("get_learned_intents");
}

export function saveLearnedIntentEntry(
  phrase: string,
  normalizedPhrase: string,
  intentKind: string,
  intentPayload: string,
) {
  return invoke<void>("save_learned_intent_entry", {
    phrase,
    normalizedPhrase,
    intentKind,
    intentPayload,
  });
}

export function getGoogleCalendarStatus() {
  return invoke<GoogleCalendarStatus>("get_google_calendar_status");
}

export function saveGoogleCalendarStatus(clientId: string, apiKey: string) {
  return invoke<GoogleCalendarStatus>("save_google_calendar_status", {
    clientId,
    apiKey,
  });
}

export function getSpotifyStatus() {
  return invoke<SpotifyStatus>("get_spotify_status");
}

export function saveSpotifyStatus(clientId: string) {
  return invoke<SpotifyStatus>("save_spotify_status", {
    clientId,
  });
}

export function getNotionStatus() {
  return invoke<NotionStatus>("get_notion_status");
}

export function saveNotionStatus(accessToken: string, databaseId: string) {
  return invoke<NotionStatus>("save_notion_status", {
    accessToken,
    databaseId,
  });
}

export function createNotionNote(content: string) {
  return invoke<NoteRecord>("create_notion_note", { content });
}

export function createNotionTask(
  title: string,
  dueLabel: string | null,
  dueIso: string | null,
) {
  return invoke<NoteRecord>("create_notion_task", {
    title,
    dueLabel,
    dueIso,
  });
}

export function listNotionNotes() {
  return invoke<NoteRecord[]>("list_notion_notes");
}

export function searchNotionNotes(query: string) {
  return invoke<NoteRecord[]>("search_notion_notes", { query });
}

export function updateNotionNoteTitle(noteId: string, title: string) {
  return invoke<NoteRecord>("update_notion_note_title", {
    noteId,
    title,
  });
}

export function updateNotionTask(
  noteId: string,
  title: string,
  dueLabel: string | null,
  dueIso: string | null,
  status: string,
) {
  return invoke<NoteRecord>("update_notion_task", {
    noteId,
    title,
    dueLabel,
    dueIso,
    status,
  });
}

export function getOllamaStatus() {
  return invoke<OllamaStatus>("get_ollama_status");
}

export function saveOllamaStatus(baseUrl: string, modelName: string) {
  return invoke<OllamaStatus>("save_ollama_status", {
    baseUrl,
    modelName,
  });
}

export function interpretConversationWithOllama(
  command: string,
  assistantName: string,
) {
  return invoke<ConversationInterpretation>("interpret_conversation_with_ollama", {
    request: {
      command,
      assistantName,
    },
  });
}

export function generateMissingSkillPlanWithOllama(
  command: string,
  assistantName: string,
) {
  return invoke<MissingSkillPlan>("generate_missing_skill_plan_with_ollama", {
    request: {
      command,
      assistantName,
    },
  });
}

export function createBuildHandoffArtifact(request: SkillBuildRequest) {
  return invoke<BuildHandoffArtifact>("create_build_handoff_artifact", { request });
}

export function getExecutorStatus() {
  return invoke<ExecutorStatus>("get_executor_status");
}

export function saveExecutorStatus(
  commandPath: string,
  workingDirectory: string,
) {
  return invoke<ExecutorStatus>("save_executor_status", {
    commandPath,
    workingDirectory,
  });
}

export function launchExecutorHandoff(
  jsonPath: string,
  markdownPath: string,
) {
  return invoke<string>("launch_executor_handoff", {
    request: {
      jsonPath,
      markdownPath,
    },
  });
}
