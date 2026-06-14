// Legacy router body; CommandRouterDeps are typed in commandRouterDepTypes.ts.
// @ts-nocheck — staged removal: gateway simulation guards and dep groups land first.
import { FormEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import * as J from "../legacy/appHelpers";
export * from "../legacy/appHelpers";
import type { CommandRouterDeps } from "./commandRouterDepTypes";
export type { CommandRouterDeps } from "./commandRouterDepTypes";
import type {
  CommandIntent,
  CrossFeatureSuggestionRecord,
  DesktopPermissionSettings,
  DesktopProjectRecord,
  DesktopScheduleRecord,
  OcrWatchTarget,
  OcrWatchTemplate,
  PendingWorkflowExecution,
  PlannerTaskRecord,
  RunCommandOutcome,
} from "./jarvisCommandTypes";
import type { EmailRecord, FileRecord, NoteRecord } from "../../types/jarvis";
import type { GatewayTurnResponse } from "../../services/jarvisApi";
import {
  captureActiveWindowScreenshot,
  captureDesktopAppWindowScreenshot,
  captureDesktopScreenshot,
  captureGlobalSelectionScreenshot,
  captureScreenRectScreenshot,
  captureScreenRegionScreenshot,
  controlDesktopAppWindow,
  createBuildHandoffArtifact,
  createNotionNote,
  createNotionTask,
  extractImageOcrText,
  extractPdfText,
  focusDesktopApp,
  gatewayRunTurn,
  getDesktopAppWindowStatus,
  interpretConversationWithOllama,
  launchDesktopApp,
  listNotionNotes,
  listRecentLocalFiles,
  previewGatewayTurn,
  launchExecutorHandoff,
  launchStudySetup,
  openBrowserUrl,
  openLocalFile,
  openNamedFolder,
  openScreenshotsFolder,
  readClipboardText,
  runJarvisProjectChecks,
  searchGoogle,
  searchLocalFiles,
  searchNotionNotes,
  updateNotionTask,
  writeClipboardText,
} from "../../services/jarvisApi";
import {
  beginGoogleRedirectAuthorization,
  createGoogleCalendarEvent,
  listTodayGoogleCalendarEvents,
} from "../../services/googleCalendar";
import {
  listUnreadGmailMessages,
  requestGmailAccessToken,
  searchGmailMessages,
} from "../../services/gmail";
import {
  getSpotifyPlaybackState,
  playSpotifySearchResult,
  queueSpotifyTrack,
  saveSpotifyTrack,
  searchSpotifyPlayable,
  spotifyPausePlayback,
  spotifyResumePlayback,
  spotifySkipToNext,
  spotifySkipToPrevious,
} from "../../services/spotify";
import type { JarvisCommandRouter } from "../../ui/context/JarvisAppContext";

type ResolvedCommandRouterDeps = Required<CommandRouterDeps>;

export function createJarvisCommandRouter(depsInput: CommandRouterDeps): JarvisCommandRouter {
  const deps = depsInput as ResolvedCommandRouterDeps;
  async function routeCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const command = deps.input.trim();
    await deps.refreshGatewayPreview(command, "text");
    await runCommand(command);
  }

  async function routeCommandFromVoice(transcript: string) {
    const command = transcript.trim();
    await deps.refreshGatewayPreview(command, "voice");
    await runCommand(command);
  }

  async function executeIntent(intent: CommandIntent) {
    deps.setIsRoutingCommand(true);
    deps.setVoiceSessionPhase("processing");
    deps.setStatusMessage("Routing command through JARVIS.");
    let completed = false;

    try {
      if (intent.kind === "study_setup") {
        const response = await launchStudySetup();
        const reply = J.buildStudySetupReply();
        deps.setCommandResult({
          title: "Study setup launched",
          detail: response,
        });
        deps.setStatusMessage("Study routine completed through the native bridge.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "launch_desktop_app") {
        const response = await launchDesktopApp(intent.appName);
        const reply = J.buildDesktopAppReply(intent.appName);
        deps.setActiveConversationContext(J.createActiveDesktopAppContext(intent.appName));
        deps.setCommandResult({
          title: "Desktop app opened",
          detail: response,
        });
        deps.setStatusMessage("Desktop app launched through the native bridge.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "focus_desktop_app") {
        const response = await focusDesktopApp(intent.appName);
        const reply = J.buildDesktopFocusReply(intent.appName);
        deps.setActiveConversationContext(J.createActiveDesktopAppContext(intent.appName));
        deps.setCommandResult({
          title: "Desktop app focused",
          detail: response,
        });
        deps.setStatusMessage("Desktop app focused through the native bridge.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "open_named_folder") {
        const response = await openNamedFolder(intent.folderName);
        const reply = J.buildNamedFolderReply(intent.folderName);
        deps.setActiveConversationContext(J.createActiveDesktopFolderContext(intent.folderName));
        deps.setCommandResult({
          title: "Folder opened",
          detail: response,
        });
        deps.setStatusMessage("Folder opened through the native bridge.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "capture_desktop_screenshot") {
        const screenshotPath = await captureDesktopScreenshot();
        const reply = J.buildScreenshotReply();
        deps.setLastScreenshotPath(screenshotPath);
        deps.setActiveConversationContext(J.createActiveScreenshotContext(screenshotPath));
        deps.setCommandResult({
          title: "Screenshot captured",
          detail: `Saved screenshot to ${screenshotPath}.`,
        });
        deps.setStatusMessage("Screenshot captured through the native bridge.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "open_screenshots_folder") {
        const response = await openScreenshotsFolder();
        const reply = J.buildScreenshotsFolderReply();
        deps.setCommandResult({
          title: "Screenshots folder opened",
          detail: response,
        });
        deps.setStatusMessage("Screenshots folder opened through the native bridge.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "read_clipboard_text") {
        const text = await readClipboardText();
        const reply = J.buildClipboardReadReply(text.trim().length > 0);
        deps.setCommandResult({
          title: "Clipboard",
          detail: text.trim().length > 0 ? text : "Clipboard is empty.",
        });
        deps.setStatusMessage("Clipboard read through the native bridge.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "write_clipboard_text") {
        const response = await writeClipboardText(intent.text);
        const reply = J.buildClipboardWriteReply();
        deps.setCommandResult({
          title: "Clipboard updated",
          detail: response,
        });
        deps.setStatusMessage("Clipboard updated through the native bridge.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "open_clipboard_target") {
        const text = (await readClipboardText()).trim();
        if (!text) {
          throw new Error("Your clipboard is empty right now.");
        }
        const looksLikeFilePath = text.includes("\\") || text.includes(":\\") || text.includes("/");
        if (looksLikeFilePath && !/^https?:\/\//i.test(text)) {
          await openLocalFile(text);
          deps.setCommandResult({
            title: "Clipboard file opened",
            detail: `Opened ${text}.`,
          });
        } else {
          const url = J.normalizeUrlTarget(text);
          await openBrowserUrl(url);
          deps.setActiveConversationContext(J.createActiveBrowserContext(url));
          deps.setCommandResult({
            title: "Clipboard target opened",
            detail: `Opened ${J.formatBrowserTargetLabel(url)} from your clipboard.`,
          });
        }
        const reply = J.buildClipboardOpenReply();
        deps.setStatusMessage("Clipboard target opened through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "search_clipboard_on_google") {
        const text = (await readClipboardText()).trim();
        if (!text) {
          throw new Error("Your clipboard is empty right now.");
        }
        await searchGoogle(text);
        const reply = J.buildClipboardSearchReply();
        deps.setActiveConversationContext(J.createActiveBrowserContext(J.buildGoogleSearchUrl(text)));
        deps.setCommandResult({
          title: "Clipboard searched",
          detail: `Searched Google for ${text}.`,
        });
        deps.setStatusMessage("Clipboard text searched on Google.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_clipboard_to_notion") {
        const text = (await readClipboardText()).trim();
        if (!text) {
          throw new Error("Your clipboard is empty right now.");
        }
        const note = await createNotionNote(`Clipboard Note\n\n${text}`);
        const reply = J.buildClipboardNotionReply(note.title);
        deps.setCommandResult({
          title: "Clipboard saved to Notion",
          detail: `Saved clipboard text to Notion as "${note.title}".`,
        });
        deps.setStatusMessage("Clipboard text saved into Notion.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_screenshot_to_notion") {
        const screenshotPath = await captureDesktopScreenshot();
        deps.setLastScreenshotPath(screenshotPath);
        deps.setActiveConversationContext(J.createActiveScreenshotContext(screenshotPath));
        const note = await createNotionNote(
          `Screenshot Capture\n\nPath: ${screenshotPath}\nCaptured: ${new Date().toLocaleString()}`,
        );
        const reply = J.buildScreenshotNotionReply(note.title);
        deps.setCommandResult({
          title: "Screenshot saved to Notion",
          detail: `Captured a screenshot and saved its path to Notion as "${note.title}".`,
        });
        deps.setStatusMessage("Screenshot reference saved into Notion.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_last_screenshot_to_notion") {
        if (!deps.lastScreenshotPath) {
          throw new Error("There is no last screenshot yet. Ask JARVIS to take a screenshot first.");
        }
        const note = await createNotionNote(
          `Screenshot Capture\n\nPath: ${deps.lastScreenshotPath}\nSaved: ${new Date().toLocaleString()}`,
        );
        const reply = J.buildScreenshotNotionReply(note.title);
        deps.setCommandResult({
          title: "Last screenshot saved to Notion",
          detail: `Saved ${deps.lastScreenshotPath} to Notion as "${note.title}".`,
        });
        deps.setStatusMessage("Last screenshot reference saved into Notion.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "read_screen_text") {
        const { screenshotPath, ocrText } = await deps.captureOcrSnapshot(intent);
        const scopeLabel = J.describeOcrTarget(intent.scope, intent.appName, intent.region, intent.rect);
        const detail = J.formatOcrResultDetail(ocrText);
        deps.rememberOcrHistory(scopeLabel, ocrText, screenshotPath);
        deps.setCommandResult({
          title: detail ? `${scopeLabel} text read` : `No ${scopeLabel} text found`,
          detail: detail || `OCR ran on ${screenshotPath}, but no readable text was found.`,
        });
        deps.setStatusMessage("Screen OCR completed through the desktop bridge.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", detail ? `I read and cleaned the visible ${scopeLabel} text.` : `I tried reading the ${scopeLabel}, but did not find readable text.`);
        deps.speakIfEnabled(detail ? `I read and cleaned the visible ${scopeLabel} text.` : `I tried reading the ${scopeLabel}, but did not find readable text.`);
      } else if (intent.kind === "save_screen_text_to_notion") {
        const { screenshotPath, ocrText } = await deps.captureOcrSnapshot(intent);
        const cleaned = J.cleanupOcrText(ocrText);
        const summary = J.summarizeOcrText(ocrText);
        if (!cleaned) {
          throw new Error(`OCR ran on ${screenshotPath}, but no readable text was found.`);
        }
        const savedScopeLabel = J.describeOcrTarget(intent.scope, intent.appName, intent.region, intent.rect);
        deps.rememberOcrHistory(savedScopeLabel, cleaned, screenshotPath);
        const note = await createNotionNote(
          `${savedScopeLabel} Text Capture\n\nPath: ${screenshotPath}\nCaptured: ${new Date().toLocaleString()}\n\nSummary\n${summary || cleaned}\n\nCleaned OCR\n${cleaned}`,
        );
        deps.setCommandResult({
          title: `${savedScopeLabel} text saved to Notion`,
          detail: `Saved OCR text from ${screenshotPath} to Notion as "${note.title}".`,
        });
        deps.setStatusMessage("Screen OCR text saved into Notion.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", "I read the screen and saved the text to Notion.");
        deps.speakIfEnabled("I read the screen and saved the text to Notion.");
      } else if (intent.kind === "cleanup_clipboard") {
        const text = (await readClipboardText()).trim();
        if (!text) {
          throw new Error("Your clipboard is empty right now.");
        }
        const cleaned = J.cleanupClipboardText(text, intent.mode);
        await writeClipboardText(cleaned);
        const reply = J.buildClipboardCleanupReply(intent.mode);
        deps.setCommandResult({
          title: "Clipboard updated",
          detail: cleaned.slice(0, 2000),
        });
        deps.setStatusMessage("Clipboard text cleaned and copied back.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "create_desktop_project") {
        const project = deps.createDesktopProject(intent.name);
        if (!project) {
          throw new Error("I need a workspace name before I can save it.");
        }

        const reply = J.buildDesktopProjectCreatedReply(project.name);
        deps.setCommandResult({
          title: "Desktop workspace saved",
          detail: `${project.name} is ready. Add apps, folders, or websites to it next.`,
        });
        deps.setStatusMessage("Desktop workspace saved locally.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "create_desktop_project_template") {
        const project = deps.createDesktopProjectFromTemplate(intent.templateName, intent.projectName);
        if (!project) {
          throw new Error(`I do not have a ${intent.templateName} workspace template yet.`);
        }

        const reply = J.buildDesktopProjectCreatedReply(project.name);
        deps.setCommandResult({
          title: "Workspace template added",
          detail: `${project.name} now has ${project.apps.length} apps, ${project.folders.length} folders, and ${project.websites.length} websites.`,
        });
        deps.setStatusMessage("Desktop workspace template saved locally.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "list_desktop_projects") {
        const reply = J.buildDesktopProjectsListReply(deps.desktopProjects.length);
        deps.setCommandResult({
          title: "Desktop workspaces",
          detail:
            deps.desktopProjects.length > 0
              ? deps.desktopProjects
                  .map(
                    (project) =>
                      `${project.name}: ${project.apps.length} apps, ${project.folders.length} folders, ${project.websites.length} websites`,
                  )
                  .join(" | ")
              : "No desktop workspaces are saved yet.",
        });
        deps.setStatusMessage("Desktop workspace memory loaded.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "add_app_to_desktop_project") {
        const project = deps.updateDesktopProject(intent.projectQuery, (entry) => ({
          ...entry,
          apps: Array.from(new Set([...entry.apps, intent.appName])),
          updatedAt: new Date().toISOString(),
        }));
        if (!project) {
          throw new Error(`I could not find a workspace named ${intent.projectQuery}.`);
        }

        const reply = J.buildDesktopProjectUpdatedReply(project.name);
        deps.setCommandResult({
          title: "Workspace app added",
          detail: `Added ${intent.appName} to ${project.name}.`,
        });
        deps.setStatusMessage("Desktop workspace updated locally.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "add_folder_to_desktop_project") {
        const project = deps.updateDesktopProject(intent.projectQuery, (entry) => ({
          ...entry,
          folders: Array.from(new Set([...entry.folders, intent.folderName])),
          updatedAt: new Date().toISOString(),
        }));
        if (!project) {
          throw new Error(`I could not find a workspace named ${intent.projectQuery}.`);
        }

        const reply = J.buildDesktopProjectUpdatedReply(project.name);
        deps.setCommandResult({
          title: "Workspace folder added",
          detail: `Added ${intent.folderName} to ${project.name}.`,
        });
        deps.setStatusMessage("Desktop workspace updated locally.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "add_website_to_desktop_project") {
        const project = deps.updateDesktopProject(intent.projectQuery, (entry) => ({
          ...entry,
          websites: Array.from(new Set([...entry.websites, intent.url])),
          updatedAt: new Date().toISOString(),
        }));
        if (!project) {
          throw new Error(`I could not find a workspace named ${intent.projectQuery}.`);
        }

        const reply = J.buildDesktopProjectUpdatedReply(project.name);
        deps.setCommandResult({
          title: "Workspace website added",
          detail: `Added ${J.formatBrowserTargetLabel(intent.url)} to ${project.name}.`,
        });
        deps.setStatusMessage("Desktop workspace updated locally.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "rename_desktop_project") {
        const project = deps.updateDesktopProject(intent.projectQuery, (entry) => ({
          ...entry,
          name: intent.newName,
          updatedAt: new Date().toISOString(),
        }));
        if (!project) {
          throw new Error(`I could not find a workspace named ${intent.projectQuery}.`);
        }

        const reply = J.buildDesktopProjectUpdatedReply(project.name);
        deps.setCommandResult({
          title: "Workspace renamed",
          detail: `Renamed ${intent.projectQuery} to ${project.name}.`,
        });
        deps.setStatusMessage("Desktop workspace renamed locally.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "delete_desktop_project") {
        const project = deps.deleteDesktopProject(intent.projectQuery);
        if (!project) {
          throw new Error(`I could not find a workspace named ${intent.projectQuery}.`);
        }

        const reply = J.buildDesktopProjectDeletedReply(project.name);
        deps.setCommandResult({
          title: "Workspace deleted",
          detail: `Deleted ${project.name} from desktop workspace memory.`,
        });
        deps.setStatusMessage("Desktop workspace deleted locally.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "remove_app_from_desktop_project") {
        const project = deps.updateDesktopProject(intent.projectQuery, (entry) => ({
          ...entry,
          apps: entry.apps.filter((appName) => appName !== intent.appName),
          updatedAt: new Date().toISOString(),
        }));
        if (!project) {
          throw new Error(`I could not find a workspace named ${intent.projectQuery}.`);
        }

        const reply = J.buildDesktopProjectUpdatedReply(project.name);
        deps.setCommandResult({
          title: "Workspace app removed",
          detail: `Removed ${intent.appName} from ${project.name}.`,
        });
        deps.setStatusMessage("Desktop workspace updated locally.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "remove_folder_from_desktop_project") {
        const project = deps.updateDesktopProject(intent.projectQuery, (entry) => ({
          ...entry,
          folders: entry.folders.filter((folderName) => folderName !== intent.folderName),
          updatedAt: new Date().toISOString(),
        }));
        if (!project) {
          throw new Error(`I could not find a workspace named ${intent.projectQuery}.`);
        }

        const reply = J.buildDesktopProjectUpdatedReply(project.name);
        deps.setCommandResult({
          title: "Workspace folder removed",
          detail: `Removed ${intent.folderName} from ${project.name}.`,
        });
        deps.setStatusMessage("Desktop workspace updated locally.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "remove_website_from_desktop_project") {
        const normalizedUrl = J.canonicalizeBrowserUrl(intent.url);
        const project = deps.updateDesktopProject(intent.projectQuery, (entry) => ({
          ...entry,
          websites: entry.websites.filter((url) => J.canonicalizeBrowserUrl(url) !== normalizedUrl),
          updatedAt: new Date().toISOString(),
        }));
        if (!project) {
          throw new Error(`I could not find a workspace named ${intent.projectQuery}.`);
        }

        const reply = J.buildDesktopProjectUpdatedReply(project.name);
        deps.setCommandResult({
          title: "Workspace website removed",
          detail: `Removed ${J.formatBrowserTargetLabel(intent.url)} from ${project.name}.`,
        });
        deps.setStatusMessage("Desktop workspace updated locally.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "open_desktop_project") {
        const project = deps.findDesktopProject(intent.query);
        if (!project) {
          throw new Error(`I could not find a workspace named ${intent.query}.`);
        }

        for (const appName of project.apps) {
          await launchDesktopApp(appName);
        }
        for (const folderName of project.folders) {
          await openNamedFolder(folderName);
        }
        for (const url of project.websites) {
          await openBrowserUrl(url);
        }

        const reply = J.buildDesktopProjectOpenedReply(project.name);
        deps.setActiveConversationContext(J.createActiveDesktopWorkspaceContext(project.name));
        deps.setCommandResult({
          title: "Desktop workspace opened",
          detail: `Opened ${project.name}: ${project.apps.length} apps, ${project.folders.length} folders, ${project.websites.length} websites.`,
        });
        deps.setStatusMessage("Desktop workspace opened through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "schedule_desktop_project") {
        const project = deps.findDesktopProject(intent.query);
        if (!project) {
          throw new Error(`I could not find a workspace named ${intent.query}.`);
        }
        const schedule: DesktopScheduleRecord = {
          id: `desktop-schedule-${Date.now()}`,
          projectName: project.name,
          actionLabel: `Open ${project.name}`,
          dueAt: intent.dueAt.toISOString(),
          createdAt: new Date().toISOString(),
        };
        deps.setDesktopSchedules((current) => [schedule, ...current].slice(0, 12));
        const reply = J.buildWorkspaceScheduledReply(project.name);
        deps.setCommandResult({
          title: "Workspace scheduled",
          detail: `${project.name} is scheduled for ${intent.dueAt.toLocaleString()}. This works while JARVIS is running.`,
        });
        deps.setStatusMessage("Desktop workspace schedule saved locally.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "start_desktop_project_for_duration") {
        const project = deps.findDesktopProject(intent.query);
        if (!project) {
          throw new Error(`I could not find a workspace named ${intent.query}.`);
        }
        for (const appName of project.apps) {
          await launchDesktopApp(appName);
        }
        for (const folderName of project.folders) {
          await openNamedFolder(folderName);
        }
        for (const url of project.websites) {
          await openBrowserUrl(url);
        }
        const dueAt = new Date(Date.now() + intent.durationMinutes * 60 * 1000);
        deps.setDesktopSchedules((current) => [
          {
            id: `desktop-schedule-${Date.now()}`,
            projectName: project.name,
            actionLabel: `${project.name} focus block ends`,
            dueAt: dueAt.toISOString(),
            createdAt: new Date().toISOString(),
          },
          ...current,
        ].slice(0, 12));
        deps.setActiveConversationContext(J.createActiveDesktopWorkspaceContext(project.name));
        deps.setCommandResult({
          title: "Workspace focus block started",
          detail: `Opened ${project.name} and marked a ${intent.durationMinutes}-minute focus block ending at ${dueAt.toLocaleTimeString()}.`,
        });
        deps.setStatusMessage("Desktop workspace focus block started.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", `I started the ${project.name} workspace for ${intent.durationMinutes} minutes.`);
        deps.speakIfEnabled(`I started the ${project.name} workspace for ${intent.durationMinutes} minutes.`);
      } else if (intent.kind === "list_desktop_schedules") {
        const upcoming = deps.desktopSchedules.filter((schedule) => new Date(schedule.dueAt).getTime() >= Date.now());
        deps.setCommandResult({
          title: "Workspace schedules",
          detail:
            upcoming.length > 0
              ? upcoming.map((schedule) => `${schedule.actionLabel}: ${new Date(schedule.dueAt).toLocaleString()}`).join(" | ")
              : "No workspace schedules are active right now.",
        });
        deps.setStatusMessage("Workspace schedules loaded.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", upcoming.length > 0 ? `I found ${upcoming.length} workspace schedule${upcoming.length === 1 ? "" : "s"}.` : "No workspace schedules are active right now.");
        deps.speakIfEnabled(upcoming.length > 0 ? `I found ${upcoming.length} workspace schedule${upcoming.length === 1 ? "" : "s"}.` : "No workspace schedules are active right now.");
      } else if (intent.kind === "open_jarvis_panel") {
        deps.openJarvisPanel(intent.panel);
        const module = deps.jarvisModules.find((item) => item.id === intent.panel);
        const label = module?.name ?? intent.panel;
        deps.setCommandResult({
          title: "JARVIS panel opened",
          detail: `${label} is now floating in the shell. You can drag it, minimize it, or close it by voice.`,
        });
        deps.setStatusMessage(`${label} panel opened.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", `I opened the ${label} panel.`);
        deps.speakIfEnabled(`I opened the ${label} panel.`);
      } else if (intent.kind === "close_jarvis_panel") {
        deps.closeJarvisPanel(intent.panel);
        const module = intent.panel ? deps.jarvisModules.find((item) => item.id === intent.panel) : null;
        const label = module?.name ?? "all panels";
        deps.setCommandResult({
          title: "JARVIS panel closed",
          detail: intent.panel ? `Closed ${label}.` : "Closed every floating shell panel.",
        });
        deps.setStatusMessage(intent.panel ? `${label} panel closed.` : "All shell panels closed.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", intent.panel ? `I closed the ${label} panel.` : "I closed all shell panels.");
        deps.speakIfEnabled(intent.panel ? `I closed the ${label} panel.` : "I closed all shell panels.");
      } else if (intent.kind === "minimize_jarvis_panel") {
        deps.minimizeJarvisPanel(intent.panel);
        const module = intent.panel ? deps.jarvisModules.find((item) => item.id === intent.panel) : null;
        const label = module?.name ?? "all panels";
        deps.setCommandResult({
          title: "JARVIS panel minimized",
          detail: intent.panel ? `Collapsed ${label}.` : "Collapsed every floating shell panel.",
        });
        deps.setStatusMessage(intent.panel ? `${label} panel minimized.` : "All shell panels minimized.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", intent.panel ? `I minimized the ${label} panel.` : "I minimized all shell panels.");
        deps.speakIfEnabled(intent.panel ? `I minimized the ${label} panel.` : "I minimized all shell panels.");
      } else if (intent.kind === "set_shell_bar") {
        deps.dispatchUi({ type: "setQuickBarVisibility", visible: intent.visible });
        deps.setCommandResult({
          title: intent.visible ? "Command bar shown" : "Command bar hidden",
          detail: intent.visible
            ? "The floating JARVIS command bar is back."
            : "The floating JARVIS command bar is hidden. Use the small J button to bring it back.",
        });
        deps.setStatusMessage(intent.visible ? "JARVIS quick bar shown." : "JARVIS quick bar hidden.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", intent.visible ? "I brought the command bar back." : "I hid the command bar.");
        deps.speakIfEnabled(intent.visible ? "I brought the command bar back." : "I hid the command bar.");
      } else if (intent.kind === "set_cockpit_mode") {
        deps.dispatchUi({ type: intent.active ? "openCockpit" : "closeCockpit" });
        if (intent.active) {
          deps.dispatchUi({ type: "setQuickBarVisibility", visible: true });
        }
        deps.setCommandResult({
          title: intent.active ? "Cockpit mode online" : "Cockpit mode closed",
          detail: intent.active
            ? "JARVIS cockpit mode is now focused around missions, modules, and live system state."
            : "Returned to the standard command center layout.",
        });
        deps.setStatusMessage(intent.active ? "JARVIS cockpit mode online." : "JARVIS cockpit mode closed.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", intent.active ? "Cockpit mode is online." : "Cockpit mode is closed.");
        deps.speakIfEnabled(intent.active ? "Cockpit mode is online." : "Cockpit mode is closed.");
      } else if (intent.kind === "set_home_app") {
        deps.dispatchUi({ type: "setWorkspace", workspaceId: intent.app });
        const label = intent.app === "connections" ? "Connections" : intent.app.charAt(0).toUpperCase() + intent.app.slice(1);
        deps.setCommandResult({
          title: "JARVIS app opened",
          detail: `Switched the main assistant launchpad to ${label}.`,
        });
        deps.setStatusMessage(`${label} app selected.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", `I opened the ${label} app.`);
        deps.speakIfEnabled(`I opened the ${label} app.`);
      } else if (intent.kind === "set_conversation_backend") {
        deps.setConversationBackend(intent.backend);
        const label =
          intent.backend === "ollama"
            ? "Ollama"
            : intent.backend === "auto"
            ? "Auto"
            : "Heuristics";
        deps.setCommandResult({
          title: "Conversation brain updated",
          detail:
            intent.backend === "auto"
              ? "JARVIS will now prefer heuristics for exact commands and use Ollama for fuzzier requests."
              : `JARVIS is now using ${label} as the active conversation brain.`,
        });
        deps.setStatusMessage(`Conversation brain set to ${label}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", `I switched the conversation brain to ${label}.`);
        deps.speakIfEnabled(`I switched the conversation brain to ${label}.`);
      } else if (intent.kind === "test_model_provider") {
        await deps.handleTestModelProvider(intent.providerId);
        deps.setStatusMessage("Model provider test completed through the router.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn(
          "jarvis",
          `I tested ${J.MODEL_PROVIDER_LABELS[intent.providerId]} through the zero-cost model router.`,
        );
        deps.speakIfEnabled(`I tested ${J.MODEL_PROVIDER_LABELS[intent.providerId]}.`);
      } else if (intent.kind === "explain_model_route") {
        const route = deps.resolveModelRoute(intent.prompt);
        deps.setCommandResult({
          title: "Model route decision",
          detail: `${intent.prompt}\n\nTask: ${route.taskType}\nProvider: ${J.MODEL_PROVIDER_LABELS[route.providerId]}\nModel: ${route.model || "not set"}\nStatus: ${route.blocked ? "blocked" : "ready"}\nReason: ${route.reason}`,
          routeLabel: "Model Router",
        });
        deps.setStatusMessage("Model route explained without calling a model.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", `I would route that to ${J.MODEL_PROVIDER_LABELS[route.providerId]} for ${route.taskType}.`);
        deps.speakIfEnabled(`I would route that to ${J.MODEL_PROVIDER_LABELS[route.providerId]}.`);
      } else if (intent.kind === "generate_model_draft") {
        const route = deps.resolveModelRoute(intent.prompt, intent.taskType);
        if (
          !intent.confirmedCloud &&
          J.CLOUD_MODEL_PROVIDERS.has(route.providerId) &&
          deps.isSensitiveModelPrompt(intent.prompt, route.taskType)
        ) {
          deps.setPendingClarification({
            prompt: `This draft may include private context and would use ${J.MODEL_PROVIDER_LABELS[route.providerId]}. Send it to cloud for drafting?`,
            choices: [
              {
                label: `Use ${J.MODEL_PROVIDER_LABELS[route.providerId]}`,
                intent: { ...intent, confirmedCloud: true },
              },
            ],
            originalPhrase: intent.prompt,
          });
          deps.setCommandResult({
            title: "Cloud confirmation needed",
            detail: `JARVIS is protecting this prompt because it looks sensitive. Say yes to use ${J.MODEL_PROVIDER_LABELS[route.providerId]}, or switch the route to local first.`,
            routeLabel: "Model Router Safety",
          });
          deps.setStatusMessage("Waiting for cloud model confirmation.");
          deps.setVoiceSessionPhase("ready");
          deps.appendConversationTurn("jarvis", `This may include private context. Should I use ${J.MODEL_PROVIDER_LABELS[route.providerId]} for the draft?`);
          deps.speakIfEnabled(`This may include private context. Should I use ${J.MODEL_PROVIDER_LABELS[route.providerId]}?`);
          deps.openFollowUpWindow("clarification");
          completed = false;
          return completed;
        }
        await deps.generateSafeModelDraft(intent.prompt, intent.taskType);
        deps.setStatusMessage("Model draft generated safely.");
        deps.setVoiceSessionPhase("ready");
      } else if (intent.kind === "copy_latest_model_draft") {
        if (!deps.latestGeneratedDraft) {
          throw new Error("There is no generated draft yet.");
        }
        await writeClipboardText(deps.latestGeneratedDraft.text);
        deps.setCommandResult({
          title: "Draft copied",
          detail: "Copied the latest generated draft to your clipboard. Nothing was sent or saved elsewhere.",
        });
        deps.setStatusMessage("Latest generated draft copied to clipboard.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I copied the latest draft to your clipboard.");
        deps.speakIfEnabled("I copied the latest draft to your clipboard.");
      } else if (intent.kind === "save_latest_model_draft_to_notion") {
        if (!deps.latestGeneratedDraft) {
          throw new Error("There is no generated draft yet.");
        }
        const note = await createNotionNote(
          `Generated Draft\n\nPrompt: ${deps.latestGeneratedDraft.prompt}\nProvider: ${J.MODEL_PROVIDER_LABELS[deps.latestGeneratedDraft.providerId]}\nModel: ${deps.latestGeneratedDraft.model}\nCreated: ${new Date(deps.latestGeneratedDraft.createdAt).toLocaleString()}\n\n${deps.latestGeneratedDraft.text}`,
        );
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.setCommandResult({
          title: "Draft saved to Notion",
          detail: `Saved the latest generated draft to Notion as "${note.title}".`,
        });
        deps.setStatusMessage("Latest generated draft saved to Notion after approval.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I saved the approved draft to Notion.");
        deps.speakIfEnabled("I saved the approved draft to Notion.");
      } else if (intent.kind === "run_model_benchmark") {
        await deps.runModelBenchmark();
        deps.setStatusMessage("Model benchmark completed.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I finished the model benchmark.");
        deps.speakIfEnabled("I finished the model benchmark.");
      } else if (intent.kind === "compare_model_responses") {
        await deps.compareModelResponses(intent.prompt);
        deps.setStatusMessage("Model comparison completed.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I compared the available model responses.");
        deps.speakIfEnabled("I compared the available model responses.");
      } else if (intent.kind === "choose_model_comparison_winner") {
        deps.chooseModelComparisonWinner(intent.providerId, intent.taskType);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", `${J.MODEL_PROVIDER_LABELS[intent.providerId]} is now the preferred model route.`);
        deps.speakIfEnabled(`${J.MODEL_PROVIDER_LABELS[intent.providerId]} is now preferred.`);
      } else if (intent.kind === "recommend_model_routes") {
        deps.recommendModelRoutesFromHistory();
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I recommended model routes from the latest benchmark and usage history.");
        deps.speakIfEnabled("I recommended model routes from the latest benchmark and usage history.");
      } else if (intent.kind === "set_model_provider_for_task") {
        deps.setPreferredModelProvider(intent.taskType, intent.providerId);
        deps.setCommandResult({
          title: "Model preference updated",
          detail: `${J.MODEL_PROVIDER_LABELS[intent.providerId]} is now preferred for ${intent.taskType}.`,
        });
        deps.setStatusMessage("Model provider preference updated.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", `${J.MODEL_PROVIDER_LABELS[intent.providerId]} is now preferred for ${intent.taskType}.`);
        deps.speakIfEnabled(`${J.MODEL_PROVIDER_LABELS[intent.providerId]} is now preferred for ${intent.taskType}.`);
      } else if (intent.kind === "set_private_model_mode") {
        deps.updateModelRouterConfig({ allowCloudForPrivateMemory: !intent.localOnly });
        deps.setCommandResult({
          title: intent.localOnly ? "Local-only model mode on" : "Cloud private mode allowed",
          detail: intent.localOnly
            ? "Sensitive and private-memory prompts will stay on local providers unless you manually switch this off."
            : "JARVIS may use cloud providers for private prompts after the safety confirmation.",
        });
        deps.setStatusMessage(intent.localOnly ? "Local-only model mode enabled." : "Cloud private model mode allowed.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", intent.localOnly ? "Local-only model mode is on." : "Cloud private model mode is allowed.");
        deps.speakIfEnabled(intent.localOnly ? "Local-only model mode is on." : "Cloud private model mode is allowed.");
      } else if (
        intent.kind === "run_project_checks" &&
        deps.desktopPermissionSettings.confirmProjectChecks &&
        !intent.confirmed
      ) {
        deps.setPendingClarification({
          prompt: "Run the JARVIS project checks now? This can take a little while.",
          choices: [
            {
              label: "Run checks",
              intent: { kind: "run_project_checks", confirmed: true },
            },
          ],
        });
        deps.setCommandResult({
          title: "Confirm project checks",
          detail: "Say yes to run TypeScript and Rust checks through the desktop bridge.",
        });
        deps.setStatusMessage("Waiting for project-check confirmation.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "Should I run the JARVIS project checks now?");
        deps.speakIfEnabled("Should I run the JARVIS project checks now?");
      } else if (intent.kind === "run_project_checks") {
        const response = await runJarvisProjectChecks();
        const reply = J.buildProjectChecksReply();
        deps.setCommandResult({
          title: "Project checks finished",
          detail: response.slice(0, 5000),
        });
        deps.setStatusMessage("JARVIS project checks completed.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "open_project_in_vscode") {
        await openNamedFolder("jarvis project");
        await launchDesktopApp("vs code");
        deps.setActiveConversationContext(J.createActiveDesktopWorkspaceContext("jarvis project"));
        deps.setCommandResult({
          title: "Project opened",
          detail: "Opened the JARVIS project folder and VS Code.",
        });
        deps.setStatusMessage("JARVIS project opened for coding.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I opened the JARVIS project for coding.");
        deps.speakIfEnabled("I opened the JARVIS project for coding.");
      } else if (intent.kind === "minimize_jarvis_window") {
        await getCurrentWindow().minimize();
        completed = true;
        deps.setIsRoutingCommand(false);
        return completed;
      } else if (intent.kind === "maximize_jarvis_window") {
        await getCurrentWindow().maximize();
        deps.setCommandResult({
          title: "JARVIS window maximized",
          detail: "Maximized the JARVIS app window.",
        });
        deps.setStatusMessage("JARVIS window maximized.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I maximized the JARVIS window.");
        deps.speakIfEnabled("I maximized the JARVIS window.");
      } else if (intent.kind === "restore_jarvis_window") {
        await getCurrentWindow().unmaximize();
        deps.setCommandResult({
          title: "JARVIS window restored",
          detail: "Restored the JARVIS app window.",
        });
        deps.setStatusMessage("JARVIS window restored.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I restored the JARVIS window.");
        deps.speakIfEnabled("I restored the JARVIS window.");
      } else if (
        intent.kind === "control_desktop_app_window" &&
        intent.action === "close" &&
        deps.desktopPermissionSettings.confirmAppClose &&
        !intent.confirmed
      ) {
        deps.setPendingClarification({
          prompt: `Close ${intent.appName}? This can discard unsaved work in that app.`,
          choices: [
            {
              label: "Close app",
              intent: { ...intent, confirmed: true },
            },
          ],
        });
        deps.setCommandResult({
          title: "Confirm app close",
          detail: `Say yes to close ${intent.appName}, or no to leave it open.`,
        });
        deps.setStatusMessage("Waiting for app-close confirmation.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", `Should I close ${intent.appName}?`);
        deps.speakIfEnabled(`Should I close ${intent.appName}?`);
      } else if (intent.kind === "control_desktop_app_window") {
        const response = await controlDesktopAppWindow(intent.appName, intent.action);
        deps.setActiveConversationContext(J.createActiveDesktopAppContext(intent.appName));
        deps.setCommandResult({
          title: "Desktop window controlled",
          detail: response,
        });
        deps.setStatusMessage("Desktop window command completed through the native bridge.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", `I sent ${intent.action} to ${intent.appName}.`);
        deps.speakIfEnabled(`I sent ${intent.action} to ${intent.appName}.`);
      } else if (intent.kind === "check_desktop_app_window_status") {
        const response = await getDesktopAppWindowStatus(intent.appName);
        deps.setActiveConversationContext(J.createActiveDesktopAppContext(intent.appName));
        deps.setCommandResult({
          title: "Desktop app status",
          detail: response,
        });
        deps.setStatusMessage("Desktop app status checked through the native bridge.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", response);
        deps.speakIfEnabled(response);
      } else if (intent.kind === "show_desktop_permissions") {
        const detail = [
          `Project checks confirmation: ${deps.desktopPermissionSettings.confirmProjectChecks ? "on" : "off"}`,
          `deps.App close confirmation: ${deps.desktopPermissionSettings.confirmAppClose ? "on" : "off"}`,
          `Executor launch confirmation: ${deps.desktopPermissionSettings.confirmExecutorLaunch ? "on" : "off"}`,
        ].join(" | ");
        deps.setCommandResult({
          title: "Desktop permissions",
          detail,
        });
        deps.setStatusMessage("Desktop permission settings loaded.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", detail);
        deps.speakIfEnabled("Here are the desktop permission settings.");
      } else if (intent.kind === "set_desktop_permission") {
        deps.setDesktopPermissionSettings((current) => ({
          ...current,
          [intent.permission]: intent.enabled,
        }));
        const labels: Record<keyof DesktopPermissionSettings, string> = {
          confirmProjectChecks: "project checks confirmation",
          confirmAppClose: "app close confirmation",
          confirmExecutorLaunch: "executor launch confirmation",
        };
        const detail = `${labels[intent.permission]} is now ${intent.enabled ? "on" : "off"}.`;
        deps.setCommandResult({
          title: "Desktop permission updated",
          detail,
        });
        deps.setStatusMessage("Desktop permission setting saved locally.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", detail);
        deps.speakIfEnabled(detail);
      } else if (intent.kind === "begin_ocr_region_selection") {
        const { screenshotPath, ocrText } = await deps.captureOcrSnapshot({ scope: "global_selection" });
        const detail = J.formatOcrResultDetail(ocrText);
        deps.rememberOcrHistory("global selected area", ocrText, screenshotPath);
        deps.setCommandResult({
          title: detail ? "Global selected area read" : "No selected-area text found",
          detail: detail || `OCR ran on ${screenshotPath}, but no readable text was found.`,
        });
        deps.setStatusMessage("Global OCR selection completed.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", detail ? "I read the selected desktop area." : "I tried reading the selected area, but did not find readable text.");
        deps.speakIfEnabled(detail ? "I read the selected desktop area." : "I tried reading the selected area, but did not find readable text.");
      } else if (intent.kind === "begin_app_ocr_region_selection") {
        deps.beginOcrSelection();
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "Drag a box over the area you want me to read.");
        deps.speakIfEnabled("Drag a box over the area you want me to read.");
      } else if (intent.kind === "start_ocr_watch") {
        const snapshot = await deps.captureOcrSnapshot(intent);
        const cleaned = J.cleanupOcrText(snapshot.ocrText);
        const watchTarget: OcrWatchTarget = {
          id: `watch-${Date.now()}`,
          name: J.describeOcrTarget(intent.scope ?? "screen", intent.appName, intent.region, intent.rect),
          scope: intent.scope ?? "screen",
          appName: intent.appName,
          region: intent.region,
          rect: intent.rect,
          status: "active",
          intervalMs: intent.intervalMs,
          logToNotion: intent.logToNotion,
          createTaskOnMatch: intent.createTaskOnMatch,
          action: intent.action,
          rule: intent.rule,
          lastText: cleaned,
          lastCheckedAt: new Date().toISOString(),
        };
        deps.setOcrWatchTargets((current) => [watchTarget, ...current].slice(0, 8));
        const targetLabel = J.describeOcrTarget(watchTarget.scope, watchTarget.appName, watchTarget.region, watchTarget.rect);
        deps.rememberOcrHistory(targetLabel, cleaned, snapshot.screenshotPath);
        deps.setCommandResult({
          title: "Screen watch started",
          detail: `Watching ${targetLabel} every ${Math.round(watchTarget.intervalMs / 1000)} seconds for ${J.describeOcrWatchRule(watchTarget.rule)}${watchTarget.logToNotion ? " and logging matches to Notion" : ""}${watchTarget.createTaskOnMatch ? " and creating tasks on matches" : ""}${watchTarget.action ? ` and ${J.describeOcrWatchAction(watchTarget.action)}` : ""}. Current OCR preview:\n\n${J.formatOcrResultDetail(cleaned) || "No readable text yet."}`,
        });
        deps.setStatusMessage(`OCR watch started for ${targetLabel}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", `I started watching the ${targetLabel} for text changes.`);
        deps.speakIfEnabled(`I started watching the ${targetLabel} for text changes.`);
      } else if (intent.kind === "stop_ocr_watch") {
        deps.setOcrWatchTargets([]);
        deps.setCommandResult({
          title: "Screen watches stopped",
          detail: "JARVIS stopped all periodic OCR checks.",
        });
        deps.setStatusMessage("OCR watch stopped.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I stopped watching the screen.");
        deps.speakIfEnabled("I stopped watching the screen.");
      } else if (intent.kind === "name_latest_ocr_watch") {
        deps.setOcrWatchTargets((current) =>
          current.map((watch, index) => (index === 0 ? { ...watch, name: intent.name } : watch)),
        );
        deps.setCommandResult({
          title: "OCR watch named",
          detail: `Saved the latest OCR watch as "${intent.name}".`,
        });
        deps.setStatusMessage("OCR watch name saved.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", `I named the latest OCR watch ${intent.name}.`);
        deps.speakIfEnabled(`I named the latest OCR watch ${intent.name}.`);
      } else if (intent.kind === "pause_ocr_watch_by_name") {
        deps.setOcrWatchTargets((current) =>
          current.map((watch) => (watch.name.toLowerCase().includes(intent.name.toLowerCase()) ? { ...watch, status: "paused" } : watch)),
        );
        deps.setCommandResult({ title: "OCR watch paused", detail: `Paused watches matching "${intent.name}".` });
        deps.setStatusMessage("Named OCR watch paused.");
        deps.setVoiceSessionPhase("ready");
      } else if (intent.kind === "resume_ocr_watch_by_name") {
        deps.setOcrWatchTargets((current) =>
          current.map((watch) => (watch.name.toLowerCase().includes(intent.name.toLowerCase()) ? { ...watch, status: "active" } : watch)),
        );
        deps.setCommandResult({ title: "OCR watch resumed", detail: `Resumed watches matching "${intent.name}".` });
        deps.setStatusMessage("Named OCR watch resumed.");
        deps.setVoiceSessionPhase("ready");
      } else if (intent.kind === "delete_ocr_watch_by_name") {
        deps.setOcrWatchTargets((current) => current.filter((watch) => !watch.name.toLowerCase().includes(intent.name.toLowerCase())));
        deps.setCommandResult({ title: "OCR watch deleted", detail: `Deleted watches matching "${intent.name}".` });
        deps.setStatusMessage("Named OCR watch deleted.");
        deps.setVoiceSessionPhase("ready");
      } else if (intent.kind === "save_latest_ocr_watch_template") {
        const watch = deps.ocrWatchTargets[0];
        if (!watch) throw new Error("There is no OCR watch to save as a template yet.");
        const template: OcrWatchTemplate = {
          name: intent.name,
          rule: watch.rule,
          intervalMs: watch.intervalMs,
          logToNotion: watch.logToNotion,
          createTaskOnMatch: watch.createTaskOnMatch,
          action: watch.action,
        };
        deps.setOcrWatchTemplates((current) => [template, ...current.filter((item) => item.name.toLowerCase() !== intent.name.toLowerCase())].slice(0, 20));
        deps.setCommandResult({ title: "OCR watch template saved", detail: `Saved "${intent.name}" as a reusable watch template.` });
        deps.setStatusMessage("OCR watch template saved.");
        deps.setVoiceSessionPhase("ready");
      } else if (intent.kind === "start_ocr_watch_template") {
        const template = deps.ocrWatchTemplates.find((item) => item.name.toLowerCase().includes(intent.templateName.toLowerCase()));
        if (!template) throw new Error(`I could not find an OCR watch template called ${intent.templateName}.`);
        await executeIntent({
          kind: "start_ocr_watch",
          scope: "app_window",
          appName: intent.appName,
          intervalMs: template.intervalMs,
          logToNotion: template.logToNotion,
          createTaskOnMatch: template.createTaskOnMatch,
          action: template.action,
          rule: template.rule,
        });
        completed = true;
        return completed;
      } else if (intent.kind === "pause_ocr_watches") {
        deps.setOcrWatchTargets((current) => current.map((watch) => ({ ...watch, status: "paused" })));
        deps.setCommandResult({
          title: "OCR watches paused",
          detail: "Paused all saved OCR watches. You can resume them later.",
        });
        deps.setStatusMessage("OCR watches paused.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I paused OCR watches.");
        deps.speakIfEnabled("I paused OCR watches.");
      } else if (intent.kind === "resume_ocr_watches") {
        deps.setOcrWatchTargets((current) => current.map((watch) => ({ ...watch, status: "active" })));
        deps.setCommandResult({
          title: "OCR watches resumed",
          detail: "Resumed all saved OCR watches.",
        });
        deps.setStatusMessage("OCR watches resumed.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I resumed OCR watches.");
        deps.speakIfEnabled("I resumed OCR watches.");
      } else if (intent.kind === "show_ocr_watches") {
        deps.setCommandResult({
          title: "OCR watches",
          detail:
            deps.ocrWatchTargets.length > 0
              ? deps.ocrWatchTargets
                  .map(
                    (watch, index) =>
                      `${index + 1}. ${watch.status}: ${watch.name} | ${J.describeOcrWatchRule(watch.rule)} | ${J.describeOcrWatchAction(watch.action)} | every ${Math.round(watch.intervalMs / 1000)}s`,
                  )
                  .join("\n")
              : "No OCR watches are saved right now.",
        });
        deps.setStatusMessage("OCR watches loaded.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", `I found ${deps.ocrWatchTargets.length} OCR watch${deps.ocrWatchTargets.length === 1 ? "" : "es"}.`);
        deps.speakIfEnabled(`I found ${deps.ocrWatchTargets.length} OCR watch${deps.ocrWatchTargets.length === 1 ? "" : "es"}.`);
      } else if (intent.kind === "show_ocr_history") {
        deps.setCommandResult({
          title: "OCR history",
          detail:
            deps.ocrHistory.length > 0
              ? deps.ocrHistory
                  .slice(0, 5)
                  .map((entry, index) => `${index + 1}. ${entry.target} at ${new Date(entry.createdAt).toLocaleString()}: ${entry.summary}`)
                  .join("\n\n")
              : "No OCR history yet. Try `read my screen` first.",
        });
        deps.setStatusMessage("OCR history loaded.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", `I found ${deps.ocrHistory.length} OCR history item${deps.ocrHistory.length === 1 ? "" : "s"}.`);
        deps.speakIfEnabled(`I found ${deps.ocrHistory.length} OCR history item${deps.ocrHistory.length === 1 ? "" : "s"}.`);
      } else if (intent.kind === "search_ocr_history") {
        const matches = J.filterOcrHistory(deps.ocrHistory, intent);
        deps.setCommandResult({
          title: "OCR history search",
          detail:
            matches.length > 0
              ? matches
                  .slice(0, 5)
                  .map((entry, index) => `${index + 1}. ${entry.target} at ${new Date(entry.createdAt).toLocaleString()}: ${entry.summary}`)
                  .join("\n\n")
              : `No OCR history matches found ${intent.label}.`,
        });
        deps.setStatusMessage("OCR history searched.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", `I found ${matches.length} OCR history match${matches.length === 1 ? "" : "es"}.`);
        deps.speakIfEnabled(`I found ${matches.length} OCR history match${matches.length === 1 ? "" : "es"}.`);
      } else if (intent.kind === "save_ocr_history_to_notion") {
        if (deps.ocrHistory.length === 0) {
          throw new Error("There is no OCR history yet.");
        }
        const note = await createNotionNote(
          `OCR History Log\n\nSaved: ${new Date().toLocaleString()}\n\n${deps.ocrHistory
            .slice(0, 10)
            .map(
              (entry, index) =>
                `${index + 1}. ${entry.target}\nTime: ${new Date(entry.createdAt).toLocaleString()}\nScreenshot: ${entry.screenshotPath}\nSummary:\n${entry.summary}\n`,
            )
            .join("\n")}`,
        );
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.setCommandResult({
          title: "OCR history saved to Notion",
          detail: `Saved ${Math.min(deps.ocrHistory.length, 10)} OCR history item${deps.ocrHistory.length === 1 ? "" : "s"} as "${note.title}".`,
        });
        deps.setStatusMessage("OCR history saved into Notion.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I saved the OCR history to Notion.");
        deps.speakIfEnabled("I saved the OCR history to Notion.");
      } else if (intent.kind === "clear_ocr_history") {
        deps.setOcrHistory([]);
        deps.setOcrWatchMatches([]);
        deps.setLastOcrText("");
        deps.setCommandResult({
          title: "OCR history cleared",
          detail: "Cleared local OCR history and watch match previews.",
        });
        deps.setStatusMessage("OCR history cleared.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I cleared OCR history.");
        deps.speakIfEnabled("I cleared OCR history.");
      } else if (intent.kind === "export_ocr_history_to_clipboard") {
        if (deps.ocrHistory.length === 0) {
          throw new Error("There is no OCR history to export yet.");
        }
        await writeClipboardText(JSON.stringify(deps.ocrHistory, null, 2));
        deps.setCommandResult({
          title: "OCR history exported",
          detail: `Copied ${deps.ocrHistory.length} OCR history item${deps.ocrHistory.length === 1 ? "" : "s"} to the clipboard as JSON.`,
        });
        deps.setStatusMessage("OCR history copied to clipboard.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I copied OCR history to the clipboard.");
        deps.speakIfEnabled("I copied OCR history to the clipboard.");
      } else if (intent.kind === "copy_latest_ocr_text") {
        const text = deps.lastOcrText || deps.ocrHistory[0]?.text || "";
        if (!text) {
          throw new Error("There is no OCR text to copy yet.");
        }
        await writeClipboardText(text);
        deps.setCommandResult({
          title: "Latest OCR copied",
          detail: "Copied the latest OCR text to your clipboard.",
        });
        deps.setStatusMessage("Latest OCR text copied.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I copied the latest OCR text.");
        deps.speakIfEnabled("I copied the latest OCR text.");
      } else if (intent.kind === "correct_ocr_text") {
        deps.setOcrCorrections((current) => [{ from: intent.from, to: intent.to, createdAt: new Date().toISOString() }, ...current].slice(0, 50));
        deps.setCommandResult({ title: "OCR correction saved", detail: `JARVIS will replace "${intent.from}" with "${intent.to}" in future OCR reads.` });
        deps.setStatusMessage("OCR correction saved.");
        deps.setVoiceSessionPhase("ready");
      } else if (intent.kind === "remember_latest_ocr") {
        const text = deps.lastOcrText || deps.ocrHistory[0]?.text || "";
        if (!text) throw new Error("There is no OCR text to remember yet.");
        const note = await createNotionNote(`Screen Memory\n\nSaved: ${new Date().toLocaleString()}\n\n${text}`);
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.setCommandResult({ title: "Screen memory saved", detail: `Saved latest OCR as "${note.title}".` });
        deps.setStatusMessage("Latest OCR saved as memory.");
        deps.setVoiceSessionPhase("ready");
      } else if (intent.kind === "summarize_screen") {
        const { screenshotPath, ocrText } = await deps.captureOcrSnapshot({ scope: intent.scope ?? "screen", appName: intent.appName });
        const summary = J.buildOcrSummary(ocrText, intent.mode);
        deps.rememberOcrHistory(`screen ${intent.mode}`, ocrText, screenshotPath, { source: "summary" });
        deps.setCommandResult({ title: "Screen summary", detail: summary || "No readable text found to summarize." });
        deps.setStatusMessage("Screen summarized from OCR.");
        deps.setVoiceSessionPhase("ready");
      } else if (intent.kind === "create_screen_task_list") {
        const scopeLabel = J.describeOcrTarget(intent.scope, intent.appName, intent.region, intent.rect);
        const taskTitles = intent.taskTitles ?? J.extractOcrTaskTitles((await deps.captureOcrSnapshot(intent)).ocrText);
        if (taskTitles.length === 0) {
          throw new Error("I could not find task-like text in the OCR result yet.");
        }
        if (!intent.confirmed) {
          deps.setPendingClarification({
            prompt: `Create ${taskTitles.length} Notion task${taskTitles.length === 1 ? "" : "s"} from ${scopeLabel}?`,
            choices: [
              {
                label: "Create tasks",
                intent: { ...intent, confirmed: true, taskTitles },
              },
            ],
          });
          deps.setCommandResult({
            title: "OCR task preview",
            detail: `I found these possible tasks from ${scopeLabel}:\n${taskTitles.map((title, index) => `${index + 1}. ${title}`).join("\n")}\n\nSay yes to create them in Notion.`,
          });
          deps.setStatusMessage("Waiting for OCR task creation confirmation.");
          deps.setVoiceSessionPhase("ready");
          deps.appendConversationTurn("jarvis", `I found ${taskTitles.length} possible task${taskTitles.length === 1 ? "" : "s"}. Should I create them in Notion?`);
          deps.speakIfEnabled(`I found ${taskTitles.length} possible task${taskTitles.length === 1 ? "" : "s"}. Should I create them in Notion?`);
          completed = true;
          await deps.loadMemoryView();
          return completed;
        }
        const createdTasks: NoteRecord[] = [];
        for (const title of taskTitles) {
          createdTasks.push(await createNotionTask(title, null, null));
        }
        deps.setCommandResult({
          title: "Screen task list created",
          detail: `Created ${createdTasks.length} task${createdTasks.length === 1 ? "" : "s"} from ${scopeLabel}: ${createdTasks
            .map((task) => task.title)
            .join(" | ")}`,
        });
        deps.setStatusMessage("OCR task list created through Notion.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [...createdTasks, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", `I created ${createdTasks.length} task${createdTasks.length === 1 ? "" : "s"} from the ${scopeLabel}.`);
        deps.speakIfEnabled(`I created ${createdTasks.length} task${createdTasks.length === 1 ? "" : "s"} from the ${scopeLabel}.`);
      } else if (intent.kind === "create_screen_task") {
        const screenshotPath = await captureDesktopScreenshot();
        deps.setLastScreenshotPath(screenshotPath);
        deps.setActiveConversationContext(J.createActiveScreenshotContext(screenshotPath));
        let contextText = "";
        try {
          contextText = (await extractImageOcrText(screenshotPath)).trim();
        } catch {
          contextText = (await readClipboardText()).trim();
        }
        const title = contextText
          ? J.cleanupClipboardText(contextText, "summarize").slice(0, 120)
          : `Review screenshot ${screenshotPath.split(/[\\/]/).pop() ?? ""}`.trim();
        const task = await createNotionTask(title, null, null);
        deps.setCommandResult({
          title: "Screen task created",
          detail: `Created "${task.title}" from the screenshot context. Screenshot: ${screenshotPath}`,
        });
        deps.setStatusMessage("Screen task created through Notion.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [task, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", "I captured the screen and created a task from readable screen context.");
        deps.speakIfEnabled("I captured the screen and created a task from readable screen context.");
      } else if (
        intent.kind === "create_builder_handoff" &&
        intent.launchExecutor &&
        deps.desktopPermissionSettings.confirmExecutorLaunch &&
        !intent.confirmed
      ) {
        deps.setPendingClarification({
          prompt: "Launch the configured coding executor for this handoff?",
          choices: [
            {
              label: "Launch executor",
              intent: { ...intent, confirmed: true },
            },
          ],
        });
        deps.setCommandResult({
          title: "Confirm coding executor",
          detail: "Say yes to create the handoff and launch the configured local coding agent bridge.",
        });
        deps.setStatusMessage("Waiting for coding executor confirmation.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "Should I launch the coding executor for this handoff?");
        deps.speakIfEnabled("Should I launch the coding executor for this handoff?");
      } else if (intent.kind === "create_builder_handoff") {
        const request = J.createVoiceBuildRequest(intent.request);
        deps.setBuildRequest(request);
        const artifact = await createBuildHandoffArtifact(request);
        deps.setHandoffArtifact(artifact);
        let launchDetail = artifact.message;
        if (intent.launchExecutor) {
          try {
            launchDetail = await launchExecutorHandoff(artifact.jsonPath, artifact.markdownPath);
          } catch (error) {
            launchDetail = `Handoff saved, but executor launch needs manual help: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
        deps.setCommandResult({
          title: "Builder handoff ready",
          detail: launchDetail,
        });
        deps.setStatusMessage("Voice build request converted into a coding handoff.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I prepared the coding handoff.");
        deps.speakIfEnabled("I prepared the coding handoff.");
      } else if (intent.kind === "open_last_desktop_context") {
        const context = deps.activeConversationContext;
        if (!context) {
          throw new Error("I do not have a recent desktop target to reopen yet.");
        }
        if (context.kind === "desktop_app") {
          await launchDesktopApp(context.appName);
        } else if (context.kind === "desktop_folder") {
          await openNamedFolder(context.folderName);
        } else if (context.kind === "desktop_workspace") {
          const project = deps.findDesktopProject(context.projectName);
          if (!project) {
            throw new Error(`I could not find the ${context.projectName} workspace anymore.`);
          }
          for (const appName of project.apps) {
            await launchDesktopApp(appName);
          }
          for (const folderName of project.folders) {
            await openNamedFolder(folderName);
          }
          for (const url of project.websites) {
            await openBrowserUrl(url);
          }
        } else if (context.kind === "screenshot") {
          await openLocalFile(context.path);
        } else if (context.kind === "browser") {
          await openBrowserUrl(context.url);
        } else {
          throw new Error("That recent item is not a desktop target I can reopen directly.");
        }
        deps.setCommandResult({
          title: "Last desktop target opened",
          detail: `Opened ${context.label}.`,
        });
        deps.setStatusMessage("Last desktop context reopened.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", `I opened ${context.label} again.`);
        deps.speakIfEnabled(`I opened ${context.label} again.`);
      } else if (intent.kind === "export_desktop_projects_to_clipboard") {
        await writeClipboardText(JSON.stringify(deps.desktopProjects, null, 2));
        deps.setCommandResult({
          title: "Workspaces exported",
          detail: `Copied ${deps.desktopProjects.length} workspace${deps.desktopProjects.length === 1 ? "" : "s"} to the clipboard as JSON.`,
        });
        deps.setStatusMessage("Desktop workspaces exported to clipboard.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I copied your workspace export to the clipboard.");
        deps.speakIfEnabled("I copied your workspace export to the clipboard.");
      } else if (intent.kind === "import_desktop_projects_from_clipboard") {
        const text = await readClipboardText();
        const parsed = JSON.parse(text) as DesktopProjectRecord[];
        if (!Array.isArray(parsed)) {
          throw new Error("The clipboard does not contain a workspace JSON array.");
        }
        const sanitized = parsed
          .filter((project) => project?.name)
          .map((project) => ({
            id: project.id || `desktop-project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: project.name,
            apps: Array.isArray(project.apps) ? project.apps : [],
            folders: Array.isArray(project.folders) ? project.folders : [],
            websites: Array.isArray(project.websites) ? project.websites : [],
            createdAt: project.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }));
        deps.setDesktopProjects((current) => {
          const byName = new Map(current.map((project) => [project.name.toLowerCase(), project]));
          for (const project of sanitized) {
            byName.set(project.name.toLowerCase(), project);
          }
          return [...byName.values()];
        });
        deps.setCommandResult({
          title: "Workspaces imported",
          detail: `Imported ${sanitized.length} workspace${sanitized.length === 1 ? "" : "s"} from the clipboard.`,
        });
        deps.setStatusMessage("Desktop workspaces imported from clipboard.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", `I imported ${sanitized.length} workspace${sanitized.length === 1 ? "" : "s"}.`);
        deps.speakIfEnabled(`I imported ${sanitized.length} workspace${sanitized.length === 1 ? "" : "s"}.`);
      } else if (intent.kind === "google_search") {
        const query = intent.query.trim();
        if (!query) {
          const prompt = "What do you want me to search for on Google?";
          deps.setPendingClarification({
            prompt,
            choices: [],
          });
          deps.setVoiceSessionPhase("ready");
          deps.setCommandResult({
            title: "Need a search topic",
            detail: prompt,
          });
          deps.appendConversationTurn("jarvis", J.buildClarificationReply(prompt));
          deps.speakIfEnabled(J.buildClarificationReply(prompt));
          return;
        }

        const response = await searchGoogle(query);
        const reply = J.buildGoogleSearchReply(query);
        deps.setActiveConversationContext(J.createActiveBrowserContext(J.buildGoogleSearchUrl(query)));
        deps.setCommandResult({
          title: "Google search started",
          detail: `Started a Google search for ${query}.`,
        });
        deps.setStatusMessage("Google search routed through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "open_url") {
        const browserTargetLabel = J.formatBrowserTargetLabel(intent.url);
        const reply = J.buildOpenSiteReply(browserTargetLabel);
        await openBrowserUrl(intent.url);
        deps.setActiveConversationContext(J.createActiveBrowserContext(intent.url));
        deps.setCommandResult({
          title: "Website opened",
          detail: `Opened ${browserTargetLabel}.`,
        });
        deps.setStatusMessage("Browser action completed through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "remember_person_birthday") {
        const savedPerson = deps.rememberPersonBirthday({
          name: intent.name,
          birthdayLabel: intent.birthdayLabel,
          month: intent.month,
          day: intent.day,
          age: intent.age ?? null,
          relationship: intent.relationship ?? null,
          giftNotes: [],
          contactNotes: [],
          lastContactLabel: null,
          followUpDueLabel: null,
          followUpReason: null,
          reminderLeadDays: intent.reminderLeadDays ?? 7,
          calendarLinkedAt: null,
          source: "manual",
        });
        if (!savedPerson) {
          throw new Error(`I could not save ${intent.name}'s birthday right now.`);
        }
        const reply = J.buildBirthdaySavedReply(intent.name, intent.birthdayLabel);
        if (intent.addToCalendar) {
          const { start, end } = J.getNextBirthdayCalendarWindow(savedPerson);
          if (deps.googleCalendarAccessToken) {
            await createGoogleCalendarEvent(
              deps.googleCalendarAccessToken,
              `Birthday: ${savedPerson.name}`,
              start,
              end,
            );
          } else {
            await openBrowserUrl(J.buildGoogleCalendarEventUrl(`Birthday: ${savedPerson.name}`, start, end));
          }
          deps.updatePersonMemory(savedPerson.name, (person) => ({
            ...person,
            calendarLinkedAt: new Date().toISOString(),
          }));
        }
        deps.setCommandResult({
          title: "Birthday saved",
          detail: `${J.formatBirthdaySummary(savedPerson)}${
            intent.addToCalendar ? " | Calendar entry created." : ""
          }`,
        });
        deps.setStatusMessage("People memory updated through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "list_birthdays") {
        const sortedPeople = [...deps.peopleMemory].sort((left, right) =>
          left.name.localeCompare(right.name),
        );
        const reply =
          sortedPeople.length > 0
            ? `I found ${sortedPeople.length} saved birthday${sortedPeople.length === 1 ? "" : "s"}.`
            : "You do not have any saved birthdays yet.";
        deps.setCommandResult({
          title: "Saved birthdays",
          detail:
            sortedPeople.length > 0
              ? sortedPeople.map((person) => J.formatBirthdaySummary(person)).join(" | ")
              : "No birthdays are saved yet.",
        });
        deps.setStatusMessage("People memory loaded through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "list_upcoming_birthdays") {
        const sortedPeople = [...deps.peopleMemory].sort(
          (left, right) =>
            J.getNextBirthdayDate(left).getTime() - J.getNextBirthdayDate(right).getTime(),
        );
        const reply =
          sortedPeople.length > 0
            ? `I sorted your upcoming birthdays for you.`
            : "You do not have any saved birthdays yet.";
        deps.setCommandResult({
          title: "Upcoming birthdays",
          detail:
            sortedPeople.length > 0
              ? sortedPeople.slice(0, 8).map((person) => J.formatUpcomingBirthday(person)).join(" | ")
              : "No birthdays are saved yet.",
        });
        deps.setStatusMessage("Upcoming birthdays checked through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "show_person_birthday") {
        const person = J.findPersonByQuery(deps.peopleMemory, intent.query);
        if (!person) {
          throw new Error(`I could not find a saved birthday for ${intent.query} yet.`);
        }

        const reply = J.buildBirthdayLookupReply(person);
        deps.setCommandResult({
          title: "Birthday found",
          detail: J.buildBirthdayLookupReply(person),
        });
        deps.setStatusMessage("People memory lookup completed.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "update_person_relationship") {
        const person = deps.updatePersonMemory(intent.query, (entry) => ({
          ...entry,
          relationship: intent.relationship,
        }));
        if (!person) {
          throw new Error(`I could not find ${intent.query} in people memory yet.`);
        }
        const reply = `Okay. I saved ${person.name} as your ${intent.relationship}.`;
        deps.setCommandResult({
          title: "Relationship updated",
          detail: J.buildBirthdayLookupReply(person),
        });
        deps.setStatusMessage("People memory updated through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "update_person_age") {
        const person = deps.updatePersonMemory(intent.query, (entry) => ({
          ...entry,
          age: intent.age,
        }));
        if (!person) {
          throw new Error(`I could not find ${intent.query} in people memory yet.`);
        }
        const reply = `Okay. I saved ${person.name} as turning ${intent.age}.`;
        deps.setCommandResult({
          title: "Birthday age updated",
          detail: J.buildBirthdayLookupReply(person),
        });
        deps.setStatusMessage("People memory updated through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "add_person_gift_note") {
        const person = deps.updatePersonMemory(intent.query, (entry) => ({
          ...entry,
          giftNotes: [...(entry.giftNotes ?? []), intent.note],
        }));
        if (!person) {
          throw new Error(`I could not find ${intent.query} in people memory yet.`);
        }
        const reply = `Okay. I added that gift note for ${person.name}.`;
        deps.setCommandResult({
          title: "Gift note saved",
          detail: J.buildBirthdayLookupReply(person),
        });
        deps.setStatusMessage("People memory updated through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "add_person_contact_note") {
        const person = deps.updatePersonMemory(intent.query, (entry) => ({
          ...entry,
          contactNotes: [...(entry.contactNotes ?? []), intent.note],
        }));
        if (!person) {
          throw new Error(`I could not find ${intent.query} in people memory yet.`);
        }
        const reply = `Okay. I added that contact note for ${person.name}.`;
        deps.setCommandResult({
          title: "Contact note saved",
          detail: J.buildBirthdayLookupReply(person),
        });
        deps.setStatusMessage("People memory updated through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "set_person_last_contact") {
        const person = deps.updatePersonMemory(intent.query, (entry) => ({
          ...entry,
          lastContactLabel: intent.whenLabel,
        }));
        if (!person) {
          throw new Error(`I could not find ${intent.query} in people memory yet.`);
        }
        const reply = `Okay. I saved that you last talked to ${person.name} ${intent.whenLabel}.`;
        deps.setCommandResult({
          title: "Last contact saved",
          detail: J.buildBirthdayLookupReply(person),
        });
        deps.setStatusMessage("People memory updated through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "set_person_follow_up") {
        const person = deps.updatePersonMemory(intent.query, (entry) => ({
          ...entry,
          followUpDueLabel: intent.dueLabel,
          followUpReason: intent.reason,
        }));
        if (!person) {
          throw new Error(`I could not find ${intent.query} in people memory yet.`);
        }
        const reply = `Okay. I will remind you to follow up with ${person.name} ${intent.dueLabel}.`;
        deps.setCommandResult({
          title: "People follow-up saved",
          detail: J.buildBirthdayLookupReply(person),
        });
        deps.setStatusMessage("People memory updated through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "list_people_follow_ups") {
        const followUps = deps.peopleMemory.filter((person) => person.followUpDueLabel);
        const reply = J.buildPeopleFollowUpReply(followUps.length);
        deps.setCommandResult({
          title: "People follow-ups",
          detail:
            followUps.length > 0
              ? followUps.map((person) => J.formatPersonFollowUp(person)).join(" | ")
              : "No people follow-ups are saved yet.",
        });
        deps.setStatusMessage("People follow-ups loaded through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "list_people_check_ins") {
        const followUps = J.getUpcomingPeopleFollowUps(deps.peopleMemory);
        const reply = J.buildPeopleCheckInReply(followUps.length);
        deps.setCommandResult({
          title: "People to check in with",
          detail:
            followUps.length > 0
              ? followUps.map((person) => J.formatPersonFollowUp(person)).join(" | ")
              : "No people are flagged for a check-in this week.",
        });
        deps.setStatusMessage("People check-ins loaded through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "set_person_birthday_reminder") {
        const person = deps.updatePersonMemory(intent.query, (entry) => ({
          ...entry,
          reminderLeadDays: intent.daysBefore,
        }));
        if (!person) {
          throw new Error(`I could not find ${intent.query} in people memory yet.`);
        }
        const reply = `Okay. I will treat ${intent.daysBefore} days before ${person.name}'s birthday as the reminder timing.`;
        deps.setCommandResult({
          title: "Birthday reminder updated",
          detail: J.buildBirthdayLookupReply(person),
        });
        deps.setStatusMessage("People memory updated through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "add_person_birthday_to_calendar") {
        const person = J.findPersonByQuery(deps.peopleMemory, intent.query);
        if (!person) {
          throw new Error(`I could not find a saved birthday for ${intent.query} yet.`);
        }
        const { start, end } = J.getNextBirthdayCalendarWindow(person);
        if (deps.googleCalendarAccessToken) {
          await createGoogleCalendarEvent(
            deps.googleCalendarAccessToken,
            `Birthday: ${person.name}`,
            start,
            end,
          );
        } else {
          await openBrowserUrl(J.buildGoogleCalendarEventUrl(`Birthday: ${person.name}`, start, end));
        }
        deps.updatePersonMemory(person.name, (entry) => ({
          ...entry,
          calendarLinkedAt: new Date().toISOString(),
        }));
        const reply = J.buildBirthdayCalendarReply(person.name);
        deps.setCommandResult({
          title: deps.googleCalendarAccessToken ? "Birthday calendar event created" : "Birthday calendar draft opened",
          detail: deps.googleCalendarAccessToken
            ? `Created a Google Calendar birthday event for ${person.name}.`
            : `Opened a Google Calendar birthday draft for ${person.name}.`,
        });
        deps.setStatusMessage("Birthday calendar action completed through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "list_travel_memory") {
        const reply =
          deps.travelMemory.length > 0
            ? `I found ${deps.travelMemory.length} saved travel item${deps.travelMemory.length === 1 ? "" : "s"}.`
            : "You do not have any saved travel summaries yet.";
        deps.setCommandResult({
          title: "Travel memory",
          detail:
            deps.travelMemory.length > 0
              ? deps.travelMemory
                  .map((item) =>
                    `${item.title}${item.departure ? ` - ${item.departure}` : ""}${
                      item.hotel ? ` - ${item.hotel}` : ""
                    }`,
                  )
                  .join(" | ")
              : "No travel summaries are saved yet.",
        });
        deps.setStatusMessage("Travel memory loaded through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "show_current_travel_checklist") {
        const trip = deps.travelMemory[0];
        if (!trip) {
          throw new Error("There is no saved trip in travel memory yet. Extract travel from an email first.");
        }
        const reply = J.buildTravelChecklistReply(trip.title);
        deps.setCommandResult({
          title: "Travel checklist",
          detail: trip.checklist.length > 0 ? trip.checklist.join(" | ") : "No travel checklist items are available yet.",
        });
        deps.setStatusMessage("Travel checklist loaded through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "show_current_travel_timeline") {
        const trip = deps.travelMemory[0];
        if (!trip) {
          throw new Error("There is no saved trip in travel memory yet. Extract travel from an email first.");
        }
        const reply = J.buildTravelTimelineReply(trip.title);
        deps.setCommandResult({
          title: "Trip timeline",
          detail: trip.timeline.length > 0 ? trip.timeline.join(" | ") : "No trip timeline cues are available yet.",
        });
        deps.setStatusMessage("Travel timeline loaded through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "list_expense_memory") {
        const reply =
          deps.expenseMemory.length > 0
            ? `I found ${deps.expenseMemory.length} saved expense item${deps.expenseMemory.length === 1 ? "" : "s"}.`
            : "You do not have any saved expense summaries yet.";
        deps.setCommandResult({
          title: "Expense memory",
          detail:
            deps.expenseMemory.length > 0
              ? deps.expenseMemory
                  .map((item) =>
                    `${item.title}${item.amount ? ` - ${item.amount}` : ""}${item.category ? ` [${item.category}]` : ""}${item.merchant ? ` (${item.merchant})` : ""}`,
                  )
                  .join(" | ")
              : "No expense summaries are saved yet.",
        });
        deps.setStatusMessage("Expense memory loaded through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (
        intent.kind === "list_weekly_expenses" ||
        intent.kind === "list_monthly_expenses" ||
        intent.kind === "list_monthly_expenses_by_category"
      ) {
        const now = new Date();
        const start =
          intent.kind === "list_weekly_expenses"
            ? J.addMinutes(J.startOfDay(now), -6 * 24 * 60)
            : new Date(now.getFullYear(), now.getMonth(), 1);
        const normalizedCategory =
          intent.kind === "list_monthly_expenses_by_category"
            ? J.normalizeExpenseCategoryLabel(intent.category).toLowerCase()
            : null;
        const filtered = deps.expenseMemory.filter((item) => {
          const parsed = item.expenseDate ? J.parseDateFromFlexibleText(item.expenseDate) : null;
          if (!parsed || parsed < start) {
            return false;
          }
          if (!normalizedCategory) {
            return true;
          }
          return (item.category ?? "").toLowerCase() === normalizedCategory;
        });
        const total = filtered.reduce<number | null>((sum, item) => {
          if (item.amountValue === null) {
            return sum;
          }
          return (sum ?? 0) + item.amountValue;
        }, 0);
        const reply =
          intent.kind === "list_monthly_expenses_by_category"
            ? J.buildCategoryExpenseReply(intent.category, filtered.length, filtered.length > 0 ? total : null)
            : J.buildExpenseSummaryReply(
                intent.kind === "list_weekly_expenses" ? "weekly" : "monthly",
                filtered.length,
                filtered.length > 0 ? total : null,
              );
        deps.setCommandResult({
          title:
            intent.kind === "list_weekly_expenses"
              ? "Weekly expenses"
              : intent.kind === "list_monthly_expenses_by_category"
                ? `${J.normalizeExpenseCategoryLabel(intent.category)} expenses`
                : "Monthly expenses",
          detail:
            filtered.length > 0
              ? filtered
                  .map(
                    (item) =>
                      `${item.title}${item.amount ? ` - ${item.amount}` : ""}${item.category ? ` [${item.category}]` : ""}${
                        item.recurringLikely ? " - recurring" : ""
                      }`,
                  )
                  .join(" | ")
              : "No matching expenses are saved yet.",
        });
        deps.setStatusMessage("Expense summary loaded through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "list_recurring_expenses") {
        const recurring = deps.expenseMemory.filter((item) => item.recurringLikely);
        const total = recurring.reduce<number | null>((sum, item) => {
          if (item.amountValue === null) {
            return sum;
          }
          return (sum ?? 0) + item.amountValue;
        }, 0);
        const reply = J.buildRecurringExpenseReply(recurring.length, recurring.length > 0 ? total : null);
        deps.setCommandResult({
          title: "Recurring expenses",
          detail:
            recurring.length > 0
              ? recurring
                  .map(
                    (item) =>
                      `${item.title}${item.amount ? ` - ${item.amount}` : ""}${item.category ? ` [${item.category}]` : ""}`,
                  )
                  .join(" | ")
              : "No likely recurring charges are saved yet.",
        });
        deps.setStatusMessage("Recurring expense summary loaded through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "list_package_memory") {
        const arrivingTodayCount = deps.packageMemory.filter((item) => item.arrivingToday).length;
        const reply =
          deps.packageMemory.length > 0
            ? J.buildPackageSummaryReply(arrivingTodayCount)
            : "You do not have any saved package summaries yet.";
        deps.setCommandResult({
          title: "Package memory",
          detail:
            deps.packageMemory.length > 0
              ? deps.packageMemory
                  .map(
                    (item) =>
                      `${item.title}${item.itemLabel ? ` - ${item.itemLabel}` : ""}${item.status ? ` - ${item.status}` : ""}${
                        item.deliveryDate ? ` (${item.deliveryDate})` : ""
                      }${item.trackingNumber ? ` [${item.trackingNumber}]` : ""}${item.merchant ? ` - ${item.merchant}` : ""}`,
                  )
                  .join(" | ")
              : "No package summaries are saved yet.",
        });
        deps.setStatusMessage("Package memory loaded through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "list_packages_arriving_tomorrow") {
        const arrivingTomorrow = deps.packageMemory.filter((item) => item.arrivingTomorrow);
        const reply = J.buildPackageTomorrowReply(arrivingTomorrow.length);
        deps.setCommandResult({
          title: "Packages arriving tomorrow",
          detail:
            arrivingTomorrow.length > 0
              ? arrivingTomorrow
                  .map((item) => `${item.title}${item.itemLabel ? ` - ${item.itemLabel}` : ""}${item.deliveryDate ? ` (${item.deliveryDate})` : ""}`)
                  .join(" | ")
              : "No packages are marked as arriving tomorrow.",
        });
        deps.setStatusMessage("Tomorrow package summary loaded through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "list_delayed_packages") {
        const delayed = deps.packageMemory.filter((item) => /\bdelayed\b/i.test(item.status ?? ""));
        const reply = J.buildDelayedPackageReply(delayed.length);
        deps.setCommandResult({
          title: "Delayed packages",
          detail:
            delayed.length > 0
              ? delayed
                  .map((item) => `${item.title}${item.status ? ` - ${item.status}` : ""}${item.trackingNumber ? ` [${item.trackingNumber}]` : ""}`)
                  .join(" | ")
              : "No delayed packages are saved yet.",
        });
        deps.setStatusMessage("Delayed package summary loaded through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "list_meeting_prep_memory") {
        const reply =
          deps.meetingPrepMemory.length > 0
            ? `I found ${deps.meetingPrepMemory.length} saved meeting prep item${deps.meetingPrepMemory.length === 1 ? "" : "s"}.`
            : "You do not have any saved meeting prep summaries yet.";
        deps.setCommandResult({
          title: "Meeting prep memory",
          detail:
            deps.meetingPrepMemory.length > 0
              ? deps.meetingPrepMemory
                  .map(
                    (item) =>
                      `${item.summaryTitle} - ${item.eventTitle}${item.relatedPeople.length > 0 ? ` - people: ${item.relatedPeople.join(", ")}` : ""}${
                        item.changesSinceLastPrep ? ` - ${item.changesSinceLastPrep}` : ""
                      }`,
                  )
                  .join(" | ")
              : "No meeting prep summaries are saved yet.",
        });
        deps.setStatusMessage("Meeting prep memory loaded through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "list_school_memory") {
        const reply =
          deps.schoolPlanMemory.length > 0
            ? `I found ${deps.schoolPlanMemory.length} saved school plan${deps.schoolPlanMemory.length === 1 ? "" : "s"}.`
            : "You do not have any saved school plans yet.";
        deps.setCommandResult({
          title: "School memory",
          detail:
            deps.schoolPlanMemory.length > 0
              ? deps.schoolPlanMemory
                  .map(
                    (item) =>
                      `${item.title}${item.subjects.length > 0 ? ` - ${item.subjects.join(", ")}` : ""}${
                        item.examCountdowns.length > 0 ? ` - exams: ${item.examCountdowns.join(", ")}` : ""
                      }`,
                  )
                  .join(" | ")
              : "No school plans are saved yet.",
        });
        deps.setStatusMessage("School memory loaded through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "create_school_plan" || intent.kind === "save_school_plan_to_notion") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const planContent = J.buildSchoolPlanContent(deps.recentEmails, availableTasks, deps.recentFiles);
        const loadedPdfs = J.getLoadedPdfFiles(deps.recentFiles);
        const urgentStudyEmails = deps.recentEmails
          .map(J.scoreEmailUrgency)
          .filter(({ email, signals, score }) => {
            const text = `${email.subject} ${email.snippet} ${email.body}`.toLowerCase();
            return (
              /\b(class|course|assignment|exam|quiz|study|homework|syllabus|lecture|project)\b/i.test(text) ||
              signals.deadlines.length > 0 ||
              score > 0
            );
          })
          .slice(0, 5);
        const studyTasks = availableTasks.filter((task) =>
          /\b(class|course|assignment|exam|quiz|study|homework|syllabus|lecture|project|school)\b/i.test(
            `${task.title} ${task.sourceNote.summary}`,
          ) || task.status === "today" || task.status === "overdue",
        );
        const focusSummary = J.buildSchoolFocusSummary(urgentStudyEmails, studyTasks, loadedPdfs);
        const subjects = J.detectSchoolSubjects(deps.recentEmails, studyTasks, loadedPdfs);
        const sessions = J.buildSchoolSessions(subjects, loadedPdfs, studyTasks, urgentStudyEmails);
        const assignments = J.extractSchoolAssignments(urgentStudyEmails, studyTasks);
        const examCountdowns = J.buildExamCountdowns(urgentStudyEmails, studyTasks);
        const reply = J.buildSchoolPlanReply();

        if (intent.kind === "save_school_plan_to_notion") {
          const note = await createNotionNote(planContent);
          deps.rememberSchoolPlan(note.title, focusSummary, subjects, sessions, assignments, examCountdowns, planContent);
          deps.setCommandResult({
            title: "School plan saved",
            detail: `Saved your school mode plan to Notion as "${note.title}".`,
          });
          deps.setStatusMessage("School mode plan saved to Notion through JARVIS.");
          deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
          deps.appendConversationTurn("jarvis", J.buildSchoolPlanSavedReply(note.title));
          deps.speakIfEnabled(J.buildSchoolPlanSavedReply(note.title));
        } else {
          deps.rememberSchoolPlan("School Mode Plan", focusSummary, subjects, sessions, assignments, examCountdowns, planContent);
          deps.setCommandResult({
            title: "School mode plan ready",
            detail: planContent,
          });
          deps.setStatusMessage("School mode plan generated through JARVIS.");
          deps.appendConversationTurn("jarvis", reply);
          deps.speakIfEnabled(reply);
        }

        deps.setVoiceSessionPhase("ready");
      } else if (intent.kind === "create_note") {
        const note = await createNotionNote(intent.content.trim());
        const reply = J.buildCreateNoteReply(note.title);
        deps.setActiveConversationContext(J.createActiveNoteContext(note));
        deps.setCommandResult({
          title: "Notion note saved",
          detail: `Saved "${note.title}" to Notion.`,
        });
        deps.setStatusMessage("Notion note created through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.setPresentedCollectionContext({
          kind: "notes",
          noteIds: [note.id, ...deps.recentNotes.map((entry) => entry.id).filter((id) => id !== note.id)].slice(0, 5),
        });
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "create_task_note") {
        const note = await createNotionTask(
          intent.title,
          intent.dueLabel,
          J.getDueIsoFromLabel(intent.dueLabel),
        );
        const reply = J.buildCreateTaskReply(note.title);
        const createdTask = J.parseTaskNoteRecord(note);
        if (createdTask) {
          deps.setActiveConversationContext(J.createActiveTaskContext(createdTask));
        }
        deps.setCommandResult({
          title: "Task note saved",
          detail: intent.dueLabel
            ? `Saved a task note for ${intent.title} due ${intent.dueLabel}.`
            : `Saved a task note for ${intent.title}.`,
        });
        deps.setStatusMessage("Task note created through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        await deps.loadRecentNotes();
        if (createdTask) {
          deps.setPresentedCollectionContext({
            kind: "tasks",
            noteIds: [createdTask.id],
          });
        }
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "list_notes") {
        const notes = await listNotionNotes();
        const detail =
          notes.length > 0
            ? notes.map((note) => note.title).join(" | ")
            : "I did not find any notes in Notion yet.";
        const reply = J.buildListNotesReply(notes.length);
        deps.setCommandResult({
          title: "Recent Notion notes",
          detail,
        });
        deps.setStatusMessage("Fetched recent Notion notes.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes(notes);
        deps.setPresentedCollectionContext({
          kind: "notes",
          noteIds: notes.map((note) => note.id),
        });
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "search_notes") {
        const query = intent.query.trim();
        const notes = await searchNotionNotes(query);
        const detail =
          notes.length > 0
            ? notes.map((note) => note.title).join(" | ")
            : `No Notion notes matched ${query}.`;
        const reply = J.buildSearchNotesReply(query, notes.length);
        deps.setCommandResult({
          title: "Notion note search",
          detail,
        });
        deps.setStatusMessage("Searched Notion notes through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes(notes);
        deps.setPresentedCollectionContext({
          kind: "notes",
          noteIds: notes.map((note) => note.id),
        });
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "read_current_note") {
        const note = J.resolveActiveNote(deps.activeConversationContext, deps.recentNotes);
        if (!note) {
          throw new Error("There is no active note in the conversation yet. Show, search, or save a note first.");
        }

        deps.setActiveConversationContext(J.createActiveNoteContext(note));
        const reply = J.buildReadNoteReply(note.title);
        deps.setCommandResult({
          title: `Note: ${note.title}`,
          detail: note.summary
            ? `${note.summary}\n\nOpen in Notion: ${note.url}`
            : `No summary is available for ${note.title} yet.\n\nOpen in Notion: ${note.url}`,
        });
        deps.setStatusMessage("Active Notion note loaded through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "read_note_by_index") {
        const note = J.getNoteByIndex(deps.recentNotes, intent.index);
        if (!note) {
          throw new Error(`Note ${intent.index} is not loaded right now. Show or search your notes first.`);
        }

        deps.setActiveConversationContext(J.createActiveNoteContext(note));
        const reply = J.buildReadNoteReply(note.title);
        deps.setCommandResult({
          title: `Note ${intent.index}`,
          detail: note.summary
            ? `${note.summary}\n\nOpen in Notion: ${note.url}`
            : `No summary is available for ${note.title} yet.\n\nOpen in Notion: ${note.url}`,
        });
        deps.setStatusMessage(`Loaded note ${intent.index} through JARVIS.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "open_current_note") {
        const note = J.resolveActiveNote(deps.activeConversationContext, deps.recentNotes);
        if (!note) {
          throw new Error("There is no active note in the conversation yet. Show, search, or save a note first.");
        }

        deps.setActiveConversationContext(J.createActiveNoteContext(note));
        await openBrowserUrl(note.url);
        const reply = J.buildOpenNoteReply(note.title);
        deps.setCommandResult({
          title: "Notion note opened",
          detail: `Opened ${note.title} in Notion.`,
        });
        deps.setStatusMessage("Active Notion note opened through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "open_note_by_index") {
        const note = J.getNoteByIndex(deps.recentNotes, intent.index);
        if (!note) {
          throw new Error(`Note ${intent.index} is not loaded right now. Show or search your notes first.`);
        }

        deps.setActiveConversationContext(J.createActiveNoteContext(note));
        await openBrowserUrl(note.url);
        const reply = J.buildOpenNoteReply(note.title);
        deps.setCommandResult({
          title: "Notion note opened",
          detail: `Opened note ${intent.index} (${note.title}) in Notion.`,
        });
        deps.setStatusMessage(`Opened note ${intent.index} through JARVIS.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "list_today_tasks") {
        const parsedTasks = await deps.loadPlannerTaskRecords();
        const filtered = parsedTasks.filter((task) => task.status === "today");
        const detail = J.formatPlannerTaskList(filtered, "No task notes due today were found.");
        const reply = J.buildTodayTasksReply(filtered.length);
        deps.setCommandResult({
          title: "Today's task notes",
          detail,
        });
        deps.setStatusMessage("Today's task notes loaded from Notion.");
        deps.setVoiceSessionPhase("ready");
        deps.setPlannerTasks(filtered);
        deps.setPresentedCollectionContext({
          kind: "tasks",
          noteIds: filtered.map((task) => task.id),
        });
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "list_upcoming_tasks") {
        const parsedTasks = await deps.loadPlannerTaskRecords();
        const filtered = parsedTasks.filter((task) => task.status === "upcoming");
        const detail = J.formatPlannerTaskList(filtered, "No upcoming task notes were found.");
        const reply = J.buildUpcomingTasksReply(filtered.length);
        deps.setCommandResult({
          title: "Upcoming task notes",
          detail,
        });
        deps.setStatusMessage("Upcoming task notes loaded from Notion.");
        deps.setVoiceSessionPhase("ready");
        deps.setPlannerTasks(filtered);
        deps.setPresentedCollectionContext({
          kind: "tasks",
          noteIds: filtered.map((task) => task.id),
        });
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "list_overdue_tasks") {
        const parsedTasks = await deps.loadPlannerTaskRecords();
        const filtered = parsedTasks.filter((task) => task.status === "overdue");
        const detail = J.formatPlannerTaskList(filtered, "No overdue task notes were found.");
        const reply = J.buildOverdueTasksReply(filtered.length);
        deps.setCommandResult({
          title: "Overdue task notes",
          detail,
        });
        deps.setStatusMessage("Overdue task notes loaded from Notion.");
        deps.setVoiceSessionPhase("ready");
        deps.setPlannerTasks(filtered);
        deps.setPresentedCollectionContext({
          kind: "tasks",
          noteIds: filtered.map((task) => task.id),
        });
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "list_done_tasks") {
        const parsedTasks = await deps.loadPlannerTaskRecords();
        const filtered = parsedTasks.filter((task) => task.status === "done");
        deps.setCommandResult({
          title: "Done task notes",
          detail: J.formatPlannerTaskList(filtered, "No completed task notes were found."),
        });
        deps.setStatusMessage("Completed task notes loaded from Notion.");
        deps.setVoiceSessionPhase("ready");
        deps.setPlannerTasks(filtered);
        deps.setPresentedCollectionContext({
          kind: "tasks",
          noteIds: filtered.map((task) => task.id),
        });
        deps.appendConversationTurn("jarvis", `I found ${filtered.length} completed task${filtered.length === 1 ? "" : "s"}.`);
        deps.speakIfEnabled(`I found ${filtered.length} completed task${filtered.length === 1 ? "" : "s"}.`);
      } else if (intent.kind === "list_open_tasks") {
        const parsedTasks = await deps.loadPlannerTaskRecords();
        const filtered = parsedTasks.filter((task) => task.status !== "done");
        deps.setCommandResult({
          title: "Open task notes",
          detail: J.formatPlannerTaskList(filtered, "No open task notes were found."),
        });
        deps.setStatusMessage("Open task notes loaded from Notion.");
        deps.setVoiceSessionPhase("ready");
        deps.setPlannerTasks(filtered);
        deps.setPresentedCollectionContext({
          kind: "tasks",
          noteIds: filtered.map((task) => task.id),
        });
        deps.appendConversationTurn("jarvis", `I found ${filtered.length} open task${filtered.length === 1 ? "" : "s"}.`);
        deps.speakIfEnabled(`I found ${filtered.length} open task${filtered.length === 1 ? "" : "s"}.`);
      } else if (intent.kind === "filter_tasks_by_query") {
        const parsedTasks = await deps.loadPlannerTaskRecords();
        const filtered = parsedTasks.filter((task) =>
          `${task.title} ${task.dueLabel ?? ""} ${task.sourceNote.summary}`.toLowerCase().includes(intent.query.toLowerCase()),
        );
        const reply = `I found ${filtered.length} task${filtered.length === 1 ? "" : "s"} matching ${intent.query}.`;
        deps.setCommandResult({
          title: `Tasks about ${intent.query}`,
          detail: J.formatPlannerTaskList(filtered, `No task notes matched ${intent.query}.`),
        });
        deps.setStatusMessage(`Task notes filtered for ${intent.query}.`);
        deps.setVoiceSessionPhase("ready");
        deps.setPlannerTasks(filtered);
        deps.setPresentedCollectionContext({
          kind: "tasks",
          noteIds: filtered.map((task) => task.id),
        });
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "create_calendar_event") {
        const reply = J.buildCalendarEventReply(intent.title);
        if (deps.googleCalendarAccessToken) {
          await createGoogleCalendarEvent(
            deps.googleCalendarAccessToken,
            intent.title,
            intent.start,
            intent.end,
          );
        } else {
          const calendarUrl = J.buildGoogleCalendarEventUrl(
            intent.title,
            intent.start,
            intent.end,
          );
          await openBrowserUrl(calendarUrl);
        }
        deps.setCommandResult({
          title: deps.googleCalendarAccessToken ? "Calendar event created" : "Calendar draft opened",
          detail: deps.googleCalendarAccessToken
            ? `Created a Google Calendar event for ${intent.title}.`
            : `Opened a Google Calendar draft for ${intent.title}.`,
        });
        deps.setStatusMessage(
          deps.googleCalendarAccessToken
            ? "Calendar event created through JARVIS."
            : "Calendar draft opened through JARVIS.",
        );
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "list_today_calendar_events") {
        if (!deps.googleCalendarAccessToken) {
          throw new Error(
            "Google Calendar is not connected yet. Connect Google Calendar first so I can read today's schedule.",
          );
        }

        const events = await listTodayGoogleCalendarEvents(deps.googleCalendarAccessToken);
        const detail =
          events.length === 0
            ? "You have no calendar events scheduled for today."
            : events
                .map(
                  (event) =>
                    `${J.formatCalendarEventTimeLabel(event.start)} — ${event.summary}`,
                )
                .join("\n");
        const reply =
          events.length === 0
            ? "You have no calendar events scheduled for today."
            : `You have ${events.length} event${events.length === 1 ? "" : "s"} today: ${events.map((event) => event.summary).join(", ")}.`;
        deps.setCommandResult({
          title: "Today's calendar",
          detail,
        });
        deps.setStatusMessage("Today's calendar events loaded through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "create_reminder") {
        const reply = J.buildReminderReply(intent.title.replace(/^Reminder:\s*/i, ""));
        if (deps.googleCalendarAccessToken) {
          await createGoogleCalendarEvent(
            deps.googleCalendarAccessToken,
            intent.title,
            intent.start,
            intent.end,
          );
        } else {
          const calendarUrl = J.buildGoogleCalendarEventUrl(
            intent.title,
            intent.start,
            intent.end,
          );
          await openBrowserUrl(calendarUrl);
        }
        deps.setCommandResult({
          title: deps.googleCalendarAccessToken ? "Reminder created" : "Reminder draft opened",
          detail: deps.googleCalendarAccessToken
            ? `Created a Google Calendar reminder event for ${intent.title.replace(/^Reminder:\s*/i, "")}.`
            : `Opened a Google Calendar reminder draft for ${intent.title.replace(/^Reminder:\s*/i, "")}.`,
        });
        deps.setStatusMessage(
          deps.googleCalendarAccessToken
            ? "Reminder created through JARVIS."
            : "Reminder draft opened through JARVIS.",
        );
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "search_files") {
        const files = await searchLocalFiles(intent.query.trim());
        const detail =
          files.length > 0
            ? files.map((file) => file.name).join(" | ")
            : `No files matched ${intent.query}.`;
        const reply = J.buildFileSearchReply(intent.query, files.length);
        deps.setCommandResult({
          title: "Local file search",
          detail,
        });
        deps.setStatusMessage("Local file search completed through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentFiles(files);
        deps.setPresentedCollectionContext(null);
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "list_pdfs") {
        const files = (await searchLocalFiles("pdf")).filter(J.isPdfFile);
        deps.setCommandResult({
          title: "PDF files",
          detail:
            files.length > 0
              ? files.map((file) => file.name).join(" | ")
              : "No PDF files were found in your Documents folder.",
        });
        deps.setStatusMessage("PDF files loaded through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentFiles(files);
        deps.setPresentedCollectionContext({
          kind: "pdfs",
          paths: files.map((file) => file.path),
        });
        deps.appendConversationTurn("jarvis", `I found ${files.length} PDF${files.length === 1 ? "" : "s"} in your Documents folder.`);
        deps.speakIfEnabled(`I found ${files.length} PDF${files.length === 1 ? "" : "s"}.`);
      } else if (intent.kind === "search_pdfs") {
        const files = (await searchLocalFiles(intent.query.trim())).filter(J.isPdfFile);
        deps.setCommandResult({
          title: "PDF search",
          detail:
            files.length > 0
              ? files.map((file) => file.name).join(" | ")
              : `No PDFs matched ${intent.query}.`,
        });
        deps.setStatusMessage("PDF search completed through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentFiles(files);
        deps.setPresentedCollectionContext({
          kind: "pdfs",
          paths: files.map((file) => file.path),
        });
        deps.appendConversationTurn("jarvis", `I found ${files.length} PDF${files.length === 1 ? "" : "s"} matching ${intent.query}.`);
        deps.speakIfEnabled(`I found ${files.length} PDF${files.length === 1 ? "" : "s"} matching ${intent.query}.`);
      } else if (intent.kind === "open_current_pdf") {
        const file = J.getCurrentPdf(deps.recentFiles);
        if (!file) {
          throw new Error("There is no loaded PDF yet. Ask JARVIS to find PDFs or search PDFs first.");
        }

        deps.setActiveConversationContext(J.createActivePdfContext(file));
        await openLocalFile(file.path);
        const reply = J.buildOpenFileReply(file.name);
        deps.setCommandResult({
          title: "PDF opened",
          detail: `Opened ${file.name}.`,
        });
        deps.setStatusMessage("Current PDF opened through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "open_pdf_by_index") {
        const file = J.getPdfByIndex(deps.recentFiles, intent.index);
        if (!file) {
          throw new Error(`PDF ${intent.index} is not loaded right now. Ask JARVIS to find PDFs first.`);
        }

        deps.setActiveConversationContext(J.createActivePdfContext(file));
        await openLocalFile(file.path);
        const reply = J.buildOpenFileReply(file.name);
        deps.setCommandResult({
          title: "PDF opened",
          detail: `Opened ${file.name}.`,
        });
        deps.setStatusMessage("PDF opened through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "open_pdf_by_query") {
        const file = J.findPdfByQuery(deps.recentFiles, intent.query);
        if (!file) {
          throw new Error(`I could not find a loaded PDF about ${intent.query}. Ask JARVIS to search PDFs first.`);
        }

        deps.setActiveConversationContext(J.createActivePdfContext(file));
        await openLocalFile(file.path);
        const reply = J.buildOpenFileReply(file.name);
        deps.setCommandResult({
          title: "PDF opened",
          detail: `Opened ${file.name}.`,
        });
        deps.setStatusMessage(`PDF opened for ${intent.query}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "read_current_pdf") {
        const file = J.getCurrentPdf(deps.recentFiles);
        if (!file) {
          throw new Error("There is no loaded PDF yet. Ask JARVIS to find PDFs or search PDFs first.");
        }

        deps.setActiveConversationContext(J.createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const reply = J.buildReadPdfReply(file.name);
        deps.setCommandResult({
          title: `PDF text: ${file.name}`,
          detail: J.formatPdfTextPreview(file.name, text),
        });
        deps.setStatusMessage("Current PDF text extracted through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "read_pdf_by_index") {
        const file = J.getPdfByIndex(deps.recentFiles, intent.index);
        if (!file) {
          throw new Error(`PDF ${intent.index} is not loaded right now. Ask JARVIS to find PDFs first.`);
        }

        deps.setActiveConversationContext(J.createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const reply = J.buildReadPdfReply(file.name);
        deps.setCommandResult({
          title: `PDF text: ${file.name}`,
          detail: J.formatPdfTextPreview(file.name, text),
        });
        deps.setStatusMessage("PDF text extracted through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "read_pdf_by_query") {
        const file = J.findPdfByQuery(deps.recentFiles, intent.query);
        if (!file) {
          throw new Error(`I could not find a loaded PDF about ${intent.query}. Ask JARVIS to search PDFs first.`);
        }

        deps.setActiveConversationContext(J.createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const reply = J.buildReadPdfReply(file.name);
        deps.setCommandResult({
          title: `PDF text: ${file.name}`,
          detail: J.formatPdfTextPreview(file.name, text),
        });
        deps.setStatusMessage(`PDF text extracted for ${intent.query}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "list_recent_files") {
        const files = await listRecentLocalFiles();
        const detail =
          files.length > 0
            ? files.map((file) => file.name).join(" | ")
            : "No recent files were found.";
        const reply = J.buildRecentFilesReply(files.length);
        deps.setCommandResult({
          title: "Recent files",
          detail,
        });
        deps.setStatusMessage("Recent local files loaded through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentFiles(files);
        deps.setPresentedCollectionContext(null);
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "open_file") {
        await openLocalFile(intent.path);
        const fileName = intent.path.split(/[/\\]/).pop() ?? intent.path;
        const reply = J.buildOpenFileReply(fileName);
        deps.setCommandResult({
          title: "Local file opened",
          detail: `Opened ${fileName}.`,
        });
        deps.setStatusMessage("Local file opened through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "summarize_current_pdf") {
        const file = J.getCurrentPdf(deps.recentFiles);
        if (!file) {
          throw new Error("There is no loaded PDF yet. Ask JARVIS to find PDFs or search PDFs first.");
        }

        deps.setActiveConversationContext(J.createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const summary = J.summarizePdfText(file.name, text);
        const reply = J.buildPdfSummaryReply(file.name);
        deps.setCommandResult({
          title: `PDF summary: ${file.name}`,
          detail: summary,
        });
        deps.setStatusMessage("Current PDF summary generated through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "summarize_pdf_by_index") {
        const file = J.getPdfByIndex(deps.recentFiles, intent.index);
        if (!file) {
          throw new Error(`PDF ${intent.index} is not loaded right now. Ask JARVIS to find PDFs first.`);
        }

        deps.setActiveConversationContext(J.createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const summary = J.summarizePdfText(file.name, text);
        const reply = J.buildPdfSummaryReply(file.name);
        deps.setCommandResult({
          title: `PDF summary: ${file.name}`,
          detail: summary,
        });
        deps.setStatusMessage("PDF summary generated through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "summarize_pdf_by_query") {
        const file = J.findPdfByQuery(deps.recentFiles, intent.query);
        if (!file) {
          throw new Error(`I could not find a loaded PDF about ${intent.query}. Ask JARVIS to search PDFs first.`);
        }

        deps.setActiveConversationContext(J.createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const summary = J.summarizePdfText(file.name, text);
        const reply = J.buildPdfSummaryReply(file.name);
        deps.setCommandResult({
          title: `PDF summary: ${file.name}`,
          detail: summary,
        });
        deps.setStatusMessage(`PDF summary generated for ${intent.query}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_pdf_summary_to_notion_by_index") {
        const file = J.getPdfByIndex(deps.recentFiles, intent.index);
        if (!file) {
          throw new Error(`PDF ${intent.index} is not loaded right now. Ask JARVIS to find PDFs first.`);
        }

        deps.setActiveConversationContext(J.createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const summary = J.summarizePdfText(file.name, text);
        const note = await createNotionNote(summary);
        deps.setCommandResult({
          title: "PDF summary saved",
          detail: `Saved the summary for ${file.name} to Notion as "${note.title}".`,
        });
        deps.setStatusMessage("PDF summary saved to Notion through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", `I saved the summary for ${file.name} to Notion.`);
        deps.speakIfEnabled(`I saved the summary for ${file.name} to Notion.`);
      } else if (intent.kind === "save_current_pdf_summary_to_notion") {
        const file = J.getCurrentPdf(deps.recentFiles);
        if (!file) {
          throw new Error("There is no loaded PDF yet. Ask JARVIS to find PDFs or search PDFs first.");
        }

        deps.setActiveConversationContext(J.createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const summary = J.summarizePdfText(file.name, text);
        const note = await createNotionNote(summary);
        deps.setCommandResult({
          title: "PDF summary saved",
          detail: `Saved the summary for ${file.name} to Notion as "${note.title}".`,
        });
        deps.setStatusMessage("Current PDF summary saved to Notion through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", `I saved the summary for ${file.name} to Notion.`);
        deps.speakIfEnabled(`I saved the summary for ${file.name} to Notion.`);
      } else if (intent.kind === "save_pdf_summary_to_notion_by_query") {
        const file = J.findPdfByQuery(deps.recentFiles, intent.query);
        if (!file) {
          throw new Error(`I could not find a loaded PDF about ${intent.query}. Ask JARVIS to search PDFs first.`);
        }

        deps.setActiveConversationContext(J.createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const summary = J.summarizePdfText(file.name, text);
        const note = await createNotionNote(summary);
        deps.setCommandResult({
          title: "PDF summary saved",
          detail: `Saved the summary for ${file.name} to Notion as "${note.title}".`,
        });
        deps.setStatusMessage(`PDF summary for ${intent.query} saved to Notion through JARVIS.`);
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", `I saved the summary for ${file.name} to Notion.`);
        deps.speakIfEnabled(`I saved the summary for ${file.name} to Notion.`);
      } else if (intent.kind === "create_tasks_from_pdf_by_index") {
        const file = J.getPdfByIndex(deps.recentFiles, intent.index);
        if (!file) {
          throw new Error(`PDF ${intent.index} is not loaded right now. Ask JARVIS to find PDFs first.`);
        }

        deps.setActiveConversationContext(J.createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const tasks = J.extractTasksFromPdfText(text);
        if (tasks.length === 0) {
          throw new Error(`JARVIS could not find clear action items in ${file.name} yet.`);
        }

        for (const task of tasks) {
          await createNotionTask(task.title, task.dueLabel, J.getDueIsoFromLabel(task.dueLabel));
        }

        const reply = J.buildPdfTasksReply(file.name, tasks.length);
        deps.setCommandResult({
          title: "PDF tasks created",
          detail: tasks
            .map((task) => (task.dueLabel ? `${task.title} (${task.dueLabel})` : task.title))
            .join(" | "),
        });
        deps.setStatusMessage("Tasks were created from the PDF through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "create_tasks_from_current_pdf") {
        const file = J.getCurrentPdf(deps.recentFiles);
        if (!file) {
          throw new Error("There is no loaded PDF yet. Ask JARVIS to find PDFs or search PDFs first.");
        }

        deps.setActiveConversationContext(J.createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const tasks = J.extractTasksFromPdfText(text);
        if (tasks.length === 0) {
          throw new Error(`JARVIS could not find clear action items in ${file.name} yet.`);
        }

        for (const task of tasks) {
          await createNotionTask(task.title, task.dueLabel, J.getDueIsoFromLabel(task.dueLabel));
        }

        const reply = J.buildPdfTasksReply(file.name, tasks.length);
        deps.setCommandResult({
          title: "PDF tasks created",
          detail: tasks
            .map((task) => (task.dueLabel ? `${task.title} (${task.dueLabel})` : task.title))
            .join(" | "),
        });
        deps.setStatusMessage("Tasks were created from the current PDF through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "create_tasks_from_pdf_by_query") {
        const file = J.findPdfByQuery(deps.recentFiles, intent.query);
        if (!file) {
          throw new Error(`I could not find a loaded PDF about ${intent.query}. Ask JARVIS to search PDFs first.`);
        }

        deps.setActiveConversationContext(J.createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const tasks = J.extractTasksFromPdfText(text);
        if (tasks.length === 0) {
          throw new Error(`JARVIS could not find clear action items in ${file.name} yet.`);
        }

        for (const task of tasks) {
          await createNotionTask(task.title, task.dueLabel, J.getDueIsoFromLabel(task.dueLabel));
        }

        const reply = J.buildPdfTasksReply(file.name, tasks.length);
        deps.setCommandResult({
          title: "PDF tasks created",
          detail: tasks
            .map((task) => (task.dueLabel ? `${task.title} (${task.dueLabel})` : task.title))
            .join(" | "),
        });
        deps.setStatusMessage(`Tasks were created from the PDF about ${intent.query}.`);
        deps.setVoiceSessionPhase("ready");
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "summarize_all_loaded_pdfs") {
        const loadedPdfs = J.getLoadedPdfFiles(deps.recentFiles);
        if (loadedPdfs.length === 0) {
          throw new Error("There are no loaded PDFs yet. Ask JARVIS to find PDFs or search PDFs first.");
        }

        const summaries: string[] = [];
        for (const file of loadedPdfs) {
          const text = await extractPdfText(file.path);
          summaries.push(`PDF: ${file.name}\n${J.summarizePdfText(file.name, text)}`);
        }

        const reply = J.buildBatchPdfSummaryReply(loadedPdfs.length);
        deps.setCommandResult({
          title: "Batch PDF summaries",
          detail: summaries.join("\n\n---\n\n").slice(0, 12000),
        });
        deps.setStatusMessage("Summarized all loaded PDFs through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "summarize_pdf_range") {
        const selectedPdfs = intent.indices
          .map((index) => J.getPdfByIndex(deps.recentFiles, index))
          .filter(Boolean) as FileRecord[];
        if (selectedPdfs.length === 0) {
          throw new Error(
            "I could not resolve those PDFs from the current list. Ask JARVIS to find PDFs or search PDFs first.",
          );
        }

        const summaries: string[] = [];
        for (const file of selectedPdfs) {
          const text = await extractPdfText(file.path);
          summaries.push(`PDF: ${file.name}\n${J.summarizePdfText(file.name, text)}`);
        }

        deps.setActiveConversationContext(J.createActivePdfContext(selectedPdfs[selectedPdfs.length - 1]));
        const reply = J.buildBatchPdfSummaryReply(selectedPdfs.length);
        deps.setCommandResult({
          title: "Batch PDF summaries",
          detail: summaries.join("\n\n---\n\n").slice(0, 12000),
        });
        deps.setStatusMessage("Summarized selected PDFs through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "spotify_play_query") {
        if (!deps.spotifyAccessToken) {
          throw new Error(
            "Spotify is not connected yet. Save your Spotify client ID and connect first.",
          );
        }

        const match = await searchSpotifyPlayable(deps.spotifyAccessToken, intent.query);
        if (!match) {
          throw new Error(`I could not find a playable Spotify result for "${intent.query}".`);
        }

        await playSpotifySearchResult(deps.spotifyAccessToken, match);
        const playback = await deps.refreshSpotifyPlayback(deps.spotifyAccessToken).catch(() => null);
        const reply = J.buildSpotifyQueryPlayReply(
          playback?.title ?? match.name,
          playback?.artist ?? match.artist,
        );
        deps.setCommandResult({
          title: "Spotify started playback",
          detail: playback?.title
            ? `Playing ${playback.title}${playback.artist ? ` by ${playback.artist}` : ""}${playback.deviceName ? ` on ${playback.deviceName}` : ""}.`
            : `Started ${match.type} ${match.name}${match.artist ? ` by ${match.artist}` : ""} on Spotify.`,
        });
        deps.setStatusMessage("Spotify started the requested song through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (
        intent.kind === "spotify_play_artist" ||
        intent.kind === "spotify_play_playlist" ||
        intent.kind === "spotify_play_album"
      ) {
        if (!deps.spotifyAccessToken) {
          throw new Error(
            "Spotify is not connected yet. Save your Spotify client ID and connect first.",
          );
        }

        const preferredType =
          intent.kind === "spotify_play_artist"
            ? "artist"
            : intent.kind === "spotify_play_playlist"
            ? "playlist"
            : "album";
        const match = await searchSpotifyPlayable(
          deps.spotifyAccessToken,
          intent.query,
          preferredType,
        );
        if (!match) {
          throw new Error(`I could not find a Spotify ${preferredType} for "${intent.query}".`);
        }

        await playSpotifySearchResult(deps.spotifyAccessToken, match);
        const playback = await deps.refreshSpotifyPlayback(deps.spotifyAccessToken).catch(() => null);
        const reply = J.buildSpotifyQueryPlayReply(
          playback?.title ?? match.name,
          playback?.artist ?? match.artist,
        );
        deps.setCommandResult({
          title: `Spotify ${preferredType} started`,
          detail: playback?.title
            ? `Playing ${playback.title}${playback.artist ? ` by ${playback.artist}` : ""}${playback.deviceName ? ` on ${playback.deviceName}` : ""}.`
            : `Started Spotify ${preferredType} ${match.name}${match.artist ? ` by ${match.artist}` : ""}.`,
        });
        deps.setStatusMessage(`Spotify started the requested ${preferredType} through JARVIS.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "spotify_play") {
        if (!deps.spotifyAccessToken) {
          throw new Error(
            "Spotify is not connected yet. Save your Spotify client ID and connect first.",
          );
        }

        await spotifyResumePlayback(deps.spotifyAccessToken);
        const playback = await deps.refreshSpotifyPlayback(deps.spotifyAccessToken).catch(() => null);
        const reply = J.buildSpotifyPlayReply();
        deps.setCommandResult({
          title: "Spotify resumed",
          detail: playback?.title
            ? `Resumed ${playback.title}${playback.artist ? ` by ${playback.artist}` : ""}.`
            : "Sent the resume command to Spotify.",
        });
        deps.setStatusMessage("Spotify playback resumed through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "spotify_pause") {
        if (!deps.spotifyAccessToken) {
          throw new Error(
            "Spotify is not connected yet. Save your Spotify client ID and connect first.",
          );
        }

        await spotifyPausePlayback(deps.spotifyAccessToken);
        const reply = J.buildSpotifyPauseReply();
        deps.setSpotifyPlaybackState((current) =>
          current ? { ...current, isPlaying: false } : current,
        );
        deps.setCommandResult({
          title: "Spotify paused",
          detail: "Paused Spotify playback.",
        });
        deps.setStatusMessage("Spotify playback paused through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "spotify_next") {
        if (!deps.spotifyAccessToken) {
          throw new Error(
            "Spotify is not connected yet. Save your Spotify client ID and connect first.",
          );
        }

        await spotifySkipToNext(deps.spotifyAccessToken);
        const playback = await deps.refreshSpotifyPlayback(deps.spotifyAccessToken).catch(() => null);
        const reply = J.buildSpotifySkipReply("next");
        deps.setCommandResult({
          title: "Spotify skipped",
          detail: playback?.title
            ? `Skipped to ${playback.title}${playback.artist ? ` by ${playback.artist}` : ""}.`
            : "Skipped to the next Spotify track.",
        });
        deps.setStatusMessage("Spotify advanced to the next track.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "spotify_previous") {
        if (!deps.spotifyAccessToken) {
          throw new Error(
            "Spotify is not connected yet. Save your Spotify client ID and connect first.",
          );
        }

        await spotifySkipToPrevious(deps.spotifyAccessToken);
        const playback = await deps.refreshSpotifyPlayback(deps.spotifyAccessToken).catch(() => null);
        const reply = J.buildSpotifySkipReply("previous");
        deps.setCommandResult({
          title: "Spotify went back",
          detail: playback?.title
            ? `Went back to ${playback.title}${playback.artist ? ` by ${playback.artist}` : ""}.`
            : "Moved Spotify to the previous track.",
        });
        deps.setStatusMessage("Spotify moved to the previous track.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "spotify_status") {
        if (!deps.spotifyAccessToken) {
          throw new Error(
            "Spotify is not connected yet. Save your Spotify client ID and connect first.",
          );
        }

        const playback = await deps.refreshSpotifyPlayback(deps.spotifyAccessToken);
        const reply = J.buildSpotifyStatusReply(playback);
        deps.setCommandResult({
          title: "Spotify playback",
          detail: playback?.title
            ? `${playback.isPlaying ? "Playing" : "Paused"} ${playback.title}${
                playback.artist ? ` by ${playback.artist}` : ""
              }${playback.deviceName ? ` on ${playback.deviceName}` : ""}.`
            : "Spotify is connected, but nothing is actively playing right now.",
        });
        deps.setStatusMessage("Spotify playback status checked.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "spotify_queue_query") {
        if (!deps.spotifyAccessToken) {
          throw new Error(
            "Spotify is not connected yet. Save your Spotify client ID and connect first.",
          );
        }

        const match = await searchSpotifyPlayable(deps.spotifyAccessToken, intent.query, "track");
        if (!match) {
          throw new Error(`I could not find a Spotify track to queue for "${intent.query}".`);
        }

        await queueSpotifyTrack(deps.spotifyAccessToken, match.uri);
        const reply = J.buildSpotifyQueueReply(match.name, match.artist);
        deps.setCommandResult({
          title: "Spotify track queued",
          detail: `Queued ${match.name}${match.artist ? ` by ${match.artist}` : ""} on Spotify.`,
        });
        deps.setStatusMessage("Spotify queued the requested track through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "spotify_like_current") {
        if (!deps.spotifyAccessToken) {
          throw new Error(
            "Spotify is not connected yet. Save your Spotify client ID and connect first.",
          );
        }

        const playback = await deps.refreshSpotifyPlayback(deps.spotifyAccessToken);
        if (!playback?.trackId || !playback.title) {
          throw new Error("Spotify is not actively playing a track to save right now.");
        }

        await saveSpotifyTrack(deps.spotifyAccessToken, playback.trackId);
        const reply = J.buildSpotifyLikeReply(playback.title, playback.artist);
        deps.setCommandResult({
          title: "Spotify track saved",
          detail: `Saved ${playback.title}${playback.artist ? ` by ${playback.artist}` : ""} to your Spotify library.`,
        });
        deps.setStatusMessage("Spotify saved the current track through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "list_unread_emails") {
        if (!deps.gmailAccessToken) {
          throw new Error(
            "Gmail is not connected yet. Use the Google config and connect Gmail first.",
          );
        }

        const emails = await listUnreadGmailMessages(deps.gmailAccessToken);
        const detail =
          emails.length > 0
            ? emails
                .map((email) => `${email.subject} — ${email.from}`)
                .join(" | ")
            : "No unread Gmail messages were found.";
        const reply = J.buildUnreadEmailReply(emails.length);
        deps.setCommandResult({
          title: "Unread Gmail messages",
          detail,
        });
        deps.setStatusMessage("Unread Gmail messages loaded through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentEmails(emails);
        deps.setPresentedCollectionContext({
          kind: "emails",
          emailIds: emails.map((email) => email.id),
        });
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "search_emails") {
        if (!deps.gmailAccessToken) {
          throw new Error(
            "Gmail is not connected yet. Use the Google config and connect Gmail first.",
          );
        }

        const query = intent.query.trim();
        const emails = await searchGmailMessages(deps.gmailAccessToken, query);
        const detail =
          emails.length > 0
            ? emails
                .map((email) => `${email.subject} — ${email.from}`)
                .join(" | ")
            : `No Gmail messages matched ${query}.`;
        const reply = J.buildSearchEmailReply(query, emails.length);
        deps.setCommandResult({
          title: "Gmail search",
          detail,
        });
        deps.setStatusMessage("Gmail search completed through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentEmails(emails);
        deps.setPresentedCollectionContext({
          kind: "emails",
          emailIds: emails.map((email) => email.id),
        });
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_latest_email_to_notion") {
        const email = deps.recentEmails[0];
        if (!email) {
          throw new Error(
            "There is no loaded email to save yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        const note = await createNotionNote(J.formatEmailForNotion(email));
        const reply = J.buildSaveLatestEmailToNotionReply(note.title);
        deps.setCommandResult({
          title: "Email saved to Notion",
          detail: `Saved "${email.subject}" to Notion as "${note.title}".`,
        });
        deps.setStatusMessage("Latest Gmail message saved into Notion.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_current_email_to_notion") {
        const email = J.resolveActiveEmail(deps.activeConversationContext, deps.recentEmails);
        if (!email) {
          throw new Error(
            "There is no active email in the conversation yet. Open, read, or analyze an email first.",
          );
        }

        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        const note = await createNotionNote(J.formatEmailForNotion(email));
        const reply = J.buildSaveLatestEmailToNotionReply(note.title);
        deps.setCommandResult({
          title: "Email saved to Notion",
          detail: `Saved "${email.subject}" to Notion as "${note.title}".`,
        });
        deps.setStatusMessage("Active Gmail message saved into Notion.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_email_digest_to_notion") {
        if (deps.recentEmails.length === 0) {
          throw new Error(
            "There are no loaded emails to summarize yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const note = await createNotionNote(J.formatEmailDigestForNotion(deps.recentEmails));
        const reply = J.buildSaveEmailDigestToNotionReply(note.title, deps.recentEmails.length);
        deps.setCommandResult({
          title: "Email digest saved to Notion",
          detail: `Saved a Notion digest covering ${deps.recentEmails.length} emails as "${note.title}".`,
        });
        deps.setStatusMessage("Gmail digest saved into Notion.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_first_emails_to_notion") {
        if (deps.recentEmails.length === 0) {
          throw new Error(
            "There are no loaded emails yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const count = Math.max(1, Math.min(intent.count, deps.recentEmails.length));
        const emailsToSave = deps.recentEmails.slice(0, count);
        const savedNotes: NoteRecord[] = [];
        for (const email of emailsToSave) {
          const note = await createNotionNote(J.formatEmailForNotion(email));
          savedNotes.push(note);
        }

        const reply = J.buildBatchEmailSaveReply(savedNotes.length);
        deps.setCommandResult({
          title: "Batch email save complete",
          detail: savedNotes.map((note) => note.title).join(" | "),
        });
        deps.setStatusMessage("Saved multiple Gmail messages into Notion.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [...savedNotes.reverse(), ...current].slice(0, 10));
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_email_range_to_notion") {
        const emailsToSave = intent.indices
          .map((index) => J.getEmailByIndex(deps.recentEmails, index))
          .filter(Boolean) as EmailRecord[];
        if (emailsToSave.length === 0) {
          throw new Error(
            "I could not resolve those emails from the current list. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const savedNotes: NoteRecord[] = [];
        for (const email of emailsToSave) {
          const note = await createNotionNote(J.formatEmailForNotion(email));
          savedNotes.push(note);
        }

        deps.setActiveConversationContext(J.createActiveEmailContext(emailsToSave[emailsToSave.length - 1]));
        const reply = J.buildBatchEmailSaveReply(savedNotes.length);
        deps.setCommandResult({
          title: "Batch email save complete",
          detail: savedNotes.map((note) => note.title).join(" | "),
        });
        deps.setStatusMessage("Saved selected Gmail messages into Notion.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [...savedNotes.reverse(), ...current].slice(0, 10));
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_email_to_notion_by_index") {
        const email = J.getEmailByIndex(deps.recentEmails, intent.index);
        if (!email) {
          throw new Error(
            `Email ${intent.index} is not loaded right now. Load emails first and then choose a visible email number.`,
          );
        }

        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        const note = await createNotionNote(J.formatEmailForNotion(email));
        const reply = J.buildSaveIndexedEmailToNotionReply(note.title, intent.index);
        deps.setCommandResult({
          title: "Email saved to Notion",
          detail: `Saved email ${intent.index} (${email.subject}) to Notion as "${note.title}".`,
        });
        deps.setStatusMessage(`Saved email ${intent.index} from Gmail into Notion.`);
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_email_to_notion_by_query") {
        const email = J.findEmailByQuery(deps.recentEmails, intent.query);
        if (!email) {
          throw new Error(
            `I could not find a loaded email about ${intent.query}. Load or search Gmail first.`,
          );
        }

        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        const note = await createNotionNote(J.formatEmailForNotion(email));
        const reply = J.buildSaveQueriedEmailToNotionReply(note.title, intent.query);
        deps.setCommandResult({
          title: "Email saved to Notion",
          detail: `Saved the email about ${intent.query} to Notion as "${note.title}".`,
        });
        deps.setStatusMessage(`Saved a Gmail message about ${intent.query} into Notion.`);
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "read_current_email") {
        const email = J.getCurrentEmail(deps.recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email to read yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        const reply = J.buildReadEmailReply(email.subject);
        deps.setCommandResult({
          title: `Email: ${email.subject}`,
          detail: J.formatEmailForReading(email),
        });
        deps.setStatusMessage("Current email loaded through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "extract_email_signals") {
        const email =
          intent.index === null ? deps.recentEmails[0] ?? null : J.getEmailByIndex(deps.recentEmails, intent.index);
        if (!email) {
          throw new Error(
            intent.index === null
              ? "There is no loaded email to analyze yet. Ask JARVIS to show unread emails or search Gmail first."
              : `Email ${intent.index} is not loaded right now. Load emails first and then choose a visible email number.`,
          );
        }

        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        const signals = J.extractEmailSignals(email);
        const reply = J.buildEmailSignalsReply(email.subject);
        deps.setCommandResult({
          title: "Email details extracted",
          detail: J.formatEmailSignals(email, signals),
        });
        {
          const suggestions = deps.buildCrossFeatureSuggestionsForEmail(email);
          deps.setCrossFeatureSuggestions(suggestions);
          deps.setProactiveCrossSuggestion(deps.pickProactiveCrossSuggestion(suggestions));
        }
        deps.setStatusMessage("Email details were extracted through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "extract_current_email_signals") {
        const email = J.resolveActiveEmail(deps.activeConversationContext, deps.recentEmails);
        if (!email) {
          throw new Error(
            "There is no active email in the conversation yet. Open, read, or analyze an email first.",
          );
        }

        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        const signals = J.extractEmailSignals(email);
        const reply = J.buildEmailSignalsReply(email.subject);
        deps.setCommandResult({
          title: "Email details extracted",
          detail: J.formatEmailSignals(email, signals),
        });
        {
          const suggestions = deps.buildCrossFeatureSuggestionsForEmail(email);
          deps.setCrossFeatureSuggestions(suggestions);
          deps.setProactiveCrossSuggestion(deps.pickProactiveCrossSuggestion(suggestions));
        }
        deps.setStatusMessage("Active email details were extracted through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_birthdays_from_current_email") {
        const email = J.resolveActiveEmail(deps.activeConversationContext, deps.recentEmails) ?? J.getCurrentEmail(deps.recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const candidates = J.extractBirthdayCandidatesFromEmail(email);
        for (const candidate of candidates) {
          deps.rememberPersonBirthday({ ...candidate, source: "gmail" });
        }
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        const reply = J.buildBirthdayImportReply(candidates.length);
        deps.setCommandResult({
          title: "Birthday import",
          detail:
            candidates.length > 0
              ? candidates.map((candidate) => `${candidate.name} - ${candidate.birthdayLabel}`).join(" | ")
              : `No clear birthdays were found in ${email.subject}.`,
        });
        deps.setStatusMessage("Birthday extraction ran on the current email.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_birthdays_from_email_index") {
        const email = J.getEmailByIndex(deps.recentEmails, intent.index);
        if (!email) {
          throw new Error(`Email ${intent.index} is not loaded right now. Load emails first.`);
        }

        const candidates = J.extractBirthdayCandidatesFromEmail(email);
        for (const candidate of candidates) {
          deps.rememberPersonBirthday({ ...candidate, source: "gmail" });
        }
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        const reply = J.buildBirthdayImportReply(candidates.length);
        deps.setCommandResult({
          title: "Birthday import",
          detail:
            candidates.length > 0
              ? candidates.map((candidate) => `${candidate.name} - ${candidate.birthdayLabel}`).join(" | ")
              : `No clear birthdays were found in email ${intent.index}.`,
        });
        deps.setStatusMessage(`Birthday extraction ran on email ${intent.index}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_birthdays_from_email_query") {
        const email = J.findEmailByQuery(deps.recentEmails, intent.query);
        if (!email) {
          throw new Error(`I could not find a loaded email about ${intent.query}.`);
        }

        const candidates = J.extractBirthdayCandidatesFromEmail(email);
        for (const candidate of candidates) {
          deps.rememberPersonBirthday({ ...candidate, source: "gmail" });
        }
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        const reply = J.buildBirthdayImportReply(candidates.length);
        deps.setCommandResult({
          title: "Birthday import",
          detail:
            candidates.length > 0
              ? candidates.map((candidate) => `${candidate.name} - ${candidate.birthdayLabel}`).join(" | ")
              : `No clear birthdays were found in the email about ${intent.query}.`,
        });
        deps.setStatusMessage(`Birthday extraction ran on the email about ${intent.query}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_birthdays_from_loaded_emails") {
        if (deps.recentEmails.length === 0) {
          throw new Error(
            "There are no loaded emails yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const candidateMap = new Map<string, import("../semantic/intentRanking").BirthdayCandidate>();
        for (const email of deps.recentEmails) {
          for (const candidate of J.extractBirthdayCandidatesFromEmail(email)) {
            candidateMap.set(candidate.name.toLowerCase(), candidate);
          }
        }
        const candidates = Array.from(candidateMap.values());
        for (const candidate of candidates) {
          deps.rememberPersonBirthday({ ...candidate, source: "gmail" });
        }

        const reply = J.buildBirthdayImportReply(candidates.length);
        deps.setCommandResult({
          title: "Birthday import",
          detail:
            candidates.length > 0
              ? candidates.map((candidate) => `${candidate.name} - ${candidate.birthdayLabel}`).join(" | ")
              : "No clear birthdays were found in the currently loaded emails.",
        });
        deps.setStatusMessage("Birthday extraction ran across loaded emails.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "extract_current_email_travel") {
        const email = J.resolveActiveEmail(deps.activeConversationContext, deps.recentEmails) ?? J.getCurrentEmail(deps.recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const details = J.extractTravelDetails(email);
        const formatted = J.formatTravelExtraction(email, details);
        deps.rememberTravelSummary(email.subject, email.subject, details, formatted);
        const reply = J.buildTravelExtractionReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Travel extracted",
          detail: formatted,
        });
        deps.setStatusMessage("Travel extraction ran on the current email.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "extract_email_travel") {
        const email =
          intent.index === null ? deps.recentEmails[0] ?? null : J.getEmailByIndex(deps.recentEmails, intent.index);
        if (!email) {
          throw new Error(
            intent.index === null
              ? "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first."
              : `Email ${intent.index} is not loaded right now. Load emails first and then choose a visible email number.`,
          );
        }

        const details = J.extractTravelDetails(email);
        const formatted = J.formatTravelExtraction(email, details);
        deps.rememberTravelSummary(email.subject, email.subject, details, formatted);
        const reply = J.buildTravelExtractionReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Travel extracted",
          detail: formatted,
        });
        deps.setStatusMessage("Travel extraction ran on the selected email.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "extract_email_travel_by_query") {
        const email = J.findEmailByQuery(deps.recentEmails, intent.query);
        if (!email) {
          throw new Error(`I could not find a loaded email about ${intent.query}.`);
        }

        const details = J.extractTravelDetails(email);
        const formatted = J.formatTravelExtraction(email, details);
        deps.rememberTravelSummary(email.subject, email.subject, details, formatted);
        const reply = J.buildTravelExtractionReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Travel extracted",
          detail: formatted,
        });
        deps.setStatusMessage(`Travel extraction ran on the email about ${intent.query}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_current_email_travel_to_notion") {
        const email = J.resolveActiveEmail(deps.activeConversationContext, deps.recentEmails) ?? J.getCurrentEmail(deps.recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const details = J.extractTravelDetails(email);
        const note = await createNotionNote(J.formatTravelForNotion(email, details));
        deps.rememberTravelSummary(note.title, email.subject, details, J.formatTravelExtraction(email, details));
        const reply = J.buildTravelSavedReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Travel saved to Notion",
          detail: `Saved the travel summary for ${email.subject} as "${note.title}".`,
        });
        deps.setStatusMessage("Travel summary saved to Notion through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_email_travel_to_notion_by_index") {
        const email = J.getEmailByIndex(deps.recentEmails, intent.index);
        if (!email) {
          throw new Error(`Email ${intent.index} is not loaded right now. Load emails first.`);
        }

        const details = J.extractTravelDetails(email);
        const note = await createNotionNote(J.formatTravelForNotion(email, details));
        deps.rememberTravelSummary(note.title, email.subject, details, J.formatTravelExtraction(email, details));
        const reply = J.buildTravelSavedReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Travel saved to Notion",
          detail: `Saved the travel summary for email ${intent.index} as "${note.title}".`,
        });
        deps.setStatusMessage(`Travel summary from email ${intent.index} saved to Notion.`);
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_email_travel_to_notion_by_query") {
        const email = J.findEmailByQuery(deps.recentEmails, intent.query);
        if (!email) {
          throw new Error(`I could not find a loaded email about ${intent.query}.`);
        }

        const details = J.extractTravelDetails(email);
        const note = await createNotionNote(J.formatTravelForNotion(email, details));
        deps.rememberTravelSummary(note.title, email.subject, details, J.formatTravelExtraction(email, details));
        const reply = J.buildTravelSavedReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Travel saved to Notion",
          detail: `Saved the travel summary for the email about ${intent.query} as "${note.title}".`,
        });
        deps.setStatusMessage(`Travel summary from the email about ${intent.query} saved to Notion.`);
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_current_email_travel_to_calendar") {
        const email = J.resolveActiveEmail(deps.activeConversationContext, deps.recentEmails) ?? J.getCurrentEmail(deps.recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const details = J.extractTravelDetails(email);
        const calendarIntent = J.buildTravelCalendarIntent(email, details);
        if (!calendarIntent) {
          throw new Error("I could not find a clear travel date to add to calendar from that email yet.");
        }
        if (deps.googleCalendarAccessToken) {
          await createGoogleCalendarEvent(
            deps.googleCalendarAccessToken,
            calendarIntent.title,
            calendarIntent.start,
            calendarIntent.end,
          );
        } else {
          await openBrowserUrl(
            J.buildGoogleCalendarEventUrl(calendarIntent.title, calendarIntent.start, calendarIntent.end),
          );
        }
        deps.rememberTravelSummary(
          calendarIntent.title,
          email.subject,
          details,
          J.formatTravelExtraction(email, details),
          new Date().toISOString(),
        );
        const reply = J.buildTravelCalendarReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: deps.googleCalendarAccessToken ? "Travel calendar event created" : "Travel calendar draft opened",
          detail: deps.googleCalendarAccessToken
            ? `Created a Google Calendar trip event from ${email.subject}.`
            : `Opened a Google Calendar trip draft from ${email.subject}.`,
        });
        deps.setStatusMessage("Travel calendar action completed through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_email_travel_to_calendar_by_index") {
        const email = J.getEmailByIndex(deps.recentEmails, intent.index);
        if (!email) {
          throw new Error(`Email ${intent.index} is not loaded right now. Load emails first.`);
        }

        const details = J.extractTravelDetails(email);
        const calendarIntent = J.buildTravelCalendarIntent(email, details);
        if (!calendarIntent) {
          throw new Error(`I could not find a clear travel date in email ${intent.index} yet.`);
        }
        if (deps.googleCalendarAccessToken) {
          await createGoogleCalendarEvent(
            deps.googleCalendarAccessToken,
            calendarIntent.title,
            calendarIntent.start,
            calendarIntent.end,
          );
        } else {
          await openBrowserUrl(
            J.buildGoogleCalendarEventUrl(calendarIntent.title, calendarIntent.start, calendarIntent.end),
          );
        }
        deps.rememberTravelSummary(
          calendarIntent.title,
          email.subject,
          details,
          J.formatTravelExtraction(email, details),
          new Date().toISOString(),
        );
        const reply = J.buildTravelCalendarReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: deps.googleCalendarAccessToken ? "Travel calendar event created" : "Travel calendar draft opened",
          detail: deps.googleCalendarAccessToken
            ? `Created a Google Calendar trip event from email ${intent.index}.`
            : `Opened a Google Calendar trip draft from email ${intent.index}.`,
        });
        deps.setStatusMessage(`Travel calendar action ran on email ${intent.index}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_email_travel_to_calendar_by_query") {
        const email = J.findEmailByQuery(deps.recentEmails, intent.query);
        if (!email) {
          throw new Error(`I could not find a loaded email about ${intent.query}.`);
        }

        const details = J.extractTravelDetails(email);
        const calendarIntent = J.buildTravelCalendarIntent(email, details);
        if (!calendarIntent) {
          throw new Error(`I could not find a clear travel date in the email about ${intent.query} yet.`);
        }
        if (deps.googleCalendarAccessToken) {
          await createGoogleCalendarEvent(
            deps.googleCalendarAccessToken,
            calendarIntent.title,
            calendarIntent.start,
            calendarIntent.end,
          );
        } else {
          await openBrowserUrl(
            J.buildGoogleCalendarEventUrl(calendarIntent.title, calendarIntent.start, calendarIntent.end),
          );
        }
        deps.rememberTravelSummary(
          calendarIntent.title,
          email.subject,
          details,
          J.formatTravelExtraction(email, details),
          new Date().toISOString(),
        );
        const reply = J.buildTravelCalendarReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: deps.googleCalendarAccessToken ? "Travel calendar event created" : "Travel calendar draft opened",
          detail: deps.googleCalendarAccessToken
            ? `Created a Google Calendar trip event from the email about ${intent.query}.`
            : `Opened a Google Calendar trip draft from the email about ${intent.query}.`,
        });
        deps.setStatusMessage(`Travel calendar action ran on the email about ${intent.query}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "extract_current_email_expense") {
        const email = J.resolveActiveEmail(deps.activeConversationContext, deps.recentEmails) ?? J.getCurrentEmail(deps.recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const details = J.extractExpenseDetails(email);
        const formatted = J.formatExpenseExtraction(email, details);
        deps.rememberExpenseSummary(
          email.subject,
          email.subject,
          details.merchants[0] ?? null,
          details.amounts[0] ?? null,
          details.primaryAmountValue,
          details.normalizedCategory,
          details.primaryDate,
          details.orderNumbers[0] ?? null,
          details.recurringLikely,
          formatted,
        );
        const reply = J.buildExpenseExtractionReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Expense extracted",
          detail: formatted,
        });
        deps.setStatusMessage("Expense extraction ran on the current email.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "extract_email_expense") {
        const email =
          intent.index === null ? deps.recentEmails[0] ?? null : J.getEmailByIndex(deps.recentEmails, intent.index);
        if (!email) {
          throw new Error(
            intent.index === null
              ? "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first."
              : `Email ${intent.index} is not loaded right now. Load emails first and then choose a visible email number.`,
          );
        }

        const details = J.extractExpenseDetails(email);
        const formatted = J.formatExpenseExtraction(email, details);
        deps.rememberExpenseSummary(
          email.subject,
          email.subject,
          details.merchants[0] ?? null,
          details.amounts[0] ?? null,
          details.primaryAmountValue,
          details.normalizedCategory,
          details.primaryDate,
          details.orderNumbers[0] ?? null,
          details.recurringLikely,
          formatted,
        );
        const reply = J.buildExpenseExtractionReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Expense extracted",
          detail: formatted,
        });
        deps.setStatusMessage("Expense extraction ran on the selected email.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "extract_email_expense_by_query") {
        const email = J.findEmailByQuery(deps.recentEmails, intent.query);
        if (!email) {
          throw new Error(`I could not find a loaded email about ${intent.query}.`);
        }

        const details = J.extractExpenseDetails(email);
        const formatted = J.formatExpenseExtraction(email, details);
        deps.rememberExpenseSummary(
          email.subject,
          email.subject,
          details.merchants[0] ?? null,
          details.amounts[0] ?? null,
          details.primaryAmountValue,
          details.normalizedCategory,
          details.primaryDate,
          details.orderNumbers[0] ?? null,
          details.recurringLikely,
          formatted,
        );
        const reply = J.buildExpenseExtractionReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Expense extracted",
          detail: formatted,
        });
        deps.setStatusMessage(`Expense extraction ran on the email about ${intent.query}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_current_email_expense_to_notion") {
        const email = J.resolveActiveEmail(deps.activeConversationContext, deps.recentEmails) ?? J.getCurrentEmail(deps.recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const details = J.extractExpenseDetails(email);
        const note = await createNotionNote(J.formatExpenseForNotion(email, details));
        deps.rememberExpenseSummary(
          note.title,
          email.subject,
          details.merchants[0] ?? null,
          details.amounts[0] ?? null,
          details.primaryAmountValue,
          details.normalizedCategory,
          details.primaryDate,
          details.orderNumbers[0] ?? null,
          details.recurringLikely,
          J.formatExpenseExtraction(email, details),
        );
        const reply = J.buildExpenseSavedReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Expense saved to Notion",
          detail: `Saved the expense summary for ${email.subject} as "${note.title}".`,
        });
        deps.setStatusMessage("Expense summary saved to Notion through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_email_expense_to_notion_by_index") {
        const email = J.getEmailByIndex(deps.recentEmails, intent.index);
        if (!email) {
          throw new Error(`Email ${intent.index} is not loaded right now. Load emails first.`);
        }

        const details = J.extractExpenseDetails(email);
        const note = await createNotionNote(J.formatExpenseForNotion(email, details));
        deps.rememberExpenseSummary(
          note.title,
          email.subject,
          details.merchants[0] ?? null,
          details.amounts[0] ?? null,
          details.primaryAmountValue,
          details.normalizedCategory,
          details.primaryDate,
          details.orderNumbers[0] ?? null,
          details.recurringLikely,
          J.formatExpenseExtraction(email, details),
        );
        const reply = J.buildExpenseSavedReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Expense saved to Notion",
          detail: `Saved the expense summary for email ${intent.index} as "${note.title}".`,
        });
        deps.setStatusMessage(`Expense summary from email ${intent.index} saved to Notion.`);
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_email_expense_to_notion_by_query") {
        const email = J.findEmailByQuery(deps.recentEmails, intent.query);
        if (!email) {
          throw new Error(`I could not find a loaded email about ${intent.query}.`);
        }

        const details = J.extractExpenseDetails(email);
        const note = await createNotionNote(J.formatExpenseForNotion(email, details));
        deps.rememberExpenseSummary(
          note.title,
          email.subject,
          details.merchants[0] ?? null,
          details.amounts[0] ?? null,
          details.primaryAmountValue,
          details.normalizedCategory,
          details.primaryDate,
          details.orderNumbers[0] ?? null,
          details.recurringLikely,
          J.formatExpenseExtraction(email, details),
        );
        const reply = J.buildExpenseSavedReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Expense saved to Notion",
          detail: `Saved the expense summary for the email about ${intent.query} as "${note.title}".`,
        });
        deps.setStatusMessage(`Expense summary from the email about ${intent.query} saved to Notion.`);
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "extract_current_email_package") {
        const email = J.resolveActiveEmail(deps.activeConversationContext, deps.recentEmails) ?? J.getCurrentEmail(deps.recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const details = J.extractPackageDetails(email);
        const formatted = J.formatPackageExtraction(email, details);
        deps.rememberPackageSummary(
          email.subject,
          email.subject,
          details.carriers[0] ?? null,
          details.merchants[0] ?? null,
          details.items[0] ?? null,
          details.statuses[0] ?? null,
          details.deliveryDates[0] ?? null,
          details.trackingNumbers[0] ?? null,
          formatted,
        );
        const reply = J.buildPackageExtractionReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Package extracted",
          detail: formatted,
        });
        deps.setStatusMessage("Package extraction ran on the current email.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "extract_email_package") {
        const email =
          intent.index === null ? deps.recentEmails[0] ?? null : J.getEmailByIndex(deps.recentEmails, intent.index);
        if (!email) {
          throw new Error(
            intent.index === null
              ? "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first."
              : `Email ${intent.index} is not loaded right now. Load emails first and then choose a visible email number.`,
          );
        }

        const details = J.extractPackageDetails(email);
        const formatted = J.formatPackageExtraction(email, details);
        deps.rememberPackageSummary(
          email.subject,
          email.subject,
          details.carriers[0] ?? null,
          details.merchants[0] ?? null,
          details.items[0] ?? null,
          details.statuses[0] ?? null,
          details.deliveryDates[0] ?? null,
          details.trackingNumbers[0] ?? null,
          formatted,
        );
        const reply = J.buildPackageExtractionReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Package extracted",
          detail: formatted,
        });
        deps.setStatusMessage("Package extraction ran on the selected email.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "extract_email_package_by_query") {
        const email = J.findEmailByQuery(deps.recentEmails, intent.query);
        if (!email) {
          throw new Error(`I could not find a loaded email about ${intent.query}.`);
        }

        const details = J.extractPackageDetails(email);
        const formatted = J.formatPackageExtraction(email, details);
        deps.rememberPackageSummary(
          email.subject,
          email.subject,
          details.carriers[0] ?? null,
          details.merchants[0] ?? null,
          details.items[0] ?? null,
          details.statuses[0] ?? null,
          details.deliveryDates[0] ?? null,
          details.trackingNumbers[0] ?? null,
          formatted,
        );
        const reply = J.buildPackageExtractionReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Package extracted",
          detail: formatted,
        });
        deps.setStatusMessage(`Package extraction ran on the email about ${intent.query}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_current_email_package_to_notion") {
        const email = J.resolveActiveEmail(deps.activeConversationContext, deps.recentEmails) ?? J.getCurrentEmail(deps.recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const details = J.extractPackageDetails(email);
        const note = await createNotionNote(J.formatPackageForNotion(email, details));
        deps.rememberPackageSummary(
          note.title,
          email.subject,
          details.carriers[0] ?? null,
          details.merchants[0] ?? null,
          details.items[0] ?? null,
          details.statuses[0] ?? null,
          details.deliveryDates[0] ?? null,
          details.trackingNumbers[0] ?? null,
          J.formatPackageExtraction(email, details),
        );
        const reply = J.buildPackageSavedReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Package saved to Notion",
          detail: `Saved the package summary for ${email.subject} as "${note.title}".`,
        });
        deps.setStatusMessage("Package summary saved to Notion through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_email_package_to_notion_by_index") {
        const email = J.getEmailByIndex(deps.recentEmails, intent.index);
        if (!email) {
          throw new Error(`Email ${intent.index} is not loaded right now. Load emails first.`);
        }

        const details = J.extractPackageDetails(email);
        const note = await createNotionNote(J.formatPackageForNotion(email, details));
        deps.rememberPackageSummary(
          note.title,
          email.subject,
          details.carriers[0] ?? null,
          details.merchants[0] ?? null,
          details.items[0] ?? null,
          details.statuses[0] ?? null,
          details.deliveryDates[0] ?? null,
          details.trackingNumbers[0] ?? null,
          J.formatPackageExtraction(email, details),
        );
        const reply = J.buildPackageSavedReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Package saved to Notion",
          detail: `Saved the package summary for email ${intent.index} as "${note.title}".`,
        });
        deps.setStatusMessage(`Package summary from email ${intent.index} saved to Notion.`);
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "save_email_package_to_notion_by_query") {
        const email = J.findEmailByQuery(deps.recentEmails, intent.query);
        if (!email) {
          throw new Error(`I could not find a loaded email about ${intent.query}.`);
        }

        const details = J.extractPackageDetails(email);
        const note = await createNotionNote(J.formatPackageForNotion(email, details));
        deps.rememberPackageSummary(
          note.title,
          email.subject,
          details.carriers[0] ?? null,
          details.merchants[0] ?? null,
          details.items[0] ?? null,
          details.statuses[0] ?? null,
          details.deliveryDates[0] ?? null,
          details.trackingNumbers[0] ?? null,
          J.formatPackageExtraction(email, details),
        );
        const reply = J.buildPackageSavedReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Package saved to Notion",
          detail: `Saved the package summary for the email about ${intent.query} as "${note.title}".`,
        });
        deps.setStatusMessage(`Package summary from the email about ${intent.query} saved to Notion.`);
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "create_meeting_prep" || intent.kind === "save_meeting_prep_to_notion") {
        if (!deps.googleCalendarAccessToken) {
          throw new Error(
            "Google Calendar is not connected yet. Connect Google Calendar first so I can prepare from your schedule.",
          );
        }

        const events = await listTodayGoogleCalendarEvents(deps.googleCalendarAccessToken);
        const event = J.findMeetingPrepEvent(events, intent.query);
        if (!event) {
          throw new Error(
            intent.query
              ? `I could not find a matching event for ${intent.query} in today's calendar.`
              : "I could not find a calendar event to prepare for today.",
          );
        }

        const relatedEmails = J.findRelatedMeetingEmails(event, deps.recentEmails);
        const relatedNotes = J.findRelatedMeetingNotes(event, deps.recentNotes);
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const relatedTasks = J.findRelatedMeetingTasks(event, availableTasks);
        const previousPrep =
          deps.meetingPrepMemory.find((item) => item.eventTitle.toLowerCase() === event.summary.toLowerCase()) ?? null;
        const relatedPeople = J.findMeetingRelatedPeople(event, relatedEmails, deps.peopleMemory);
        const changeSummary = J.buildMeetingChangeSummary(event, relatedEmails, relatedTasks, previousPrep);
        const prepContent = J.buildMeetingPrepContent(
          event,
          relatedEmails,
          relatedNotes,
          relatedTasks,
          deps.peopleMemory,
          previousPrep,
        );
        const focusSummary = J.buildMeetingFocusSummary(event, relatedEmails, relatedNotes, relatedTasks);
        const actionItems = J.buildMeetingActionItems(relatedEmails, relatedNotes, relatedTasks);
        const reply = J.buildMeetingPrepReply(event.summary);

        if (intent.kind === "save_meeting_prep_to_notion") {
          const note = await createNotionNote(prepContent);
          deps.rememberMeetingPrepSummary(
            event.summary,
            note.title,
            focusSummary,
            actionItems,
            relatedPeople,
            changeSummary,
            prepContent,
          );
          deps.setCommandResult({
            title: "Meeting prep saved",
            detail: `Saved the meeting prep note for ${event.summary} as "${note.title}".`,
          });
          deps.setStatusMessage("Meeting prep saved to Notion through JARVIS.");
          deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
          deps.appendConversationTurn("jarvis", J.buildMeetingPrepSavedReply(event.summary));
          deps.speakIfEnabled(J.buildMeetingPrepSavedReply(event.summary));
        } else {
          deps.rememberMeetingPrepSummary(
            event.summary,
            `Meeting Prep: ${event.summary}`,
            focusSummary,
            actionItems,
            relatedPeople,
            changeSummary,
            prepContent,
          );
          deps.setCommandResult({
            title: "Meeting prep ready",
            detail: prepContent,
          });
          deps.setStatusMessage("Meeting prep generated through JARVIS.");
          deps.appendConversationTurn("jarvis", reply);
          deps.speakIfEnabled(reply);
        }

        deps.setVoiceSessionPhase("ready");
      } else if (intent.kind === "extract_email_signals_by_query") {
        const email = J.findEmailByQuery(deps.recentEmails, intent.query);
        if (!email) {
          throw new Error(
            `I could not find a loaded email about ${intent.query}. Load or search Gmail first.`,
          );
        }

        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        const signals = J.extractEmailSignals(email);
        const reply = J.buildEmailSignalsReply(email.subject);
        deps.setCommandResult({
          title: "Email details extracted",
          detail: J.formatEmailSignals(email, signals),
        });
        {
          const suggestions = deps.buildCrossFeatureSuggestionsForEmail(email);
          deps.setCrossFeatureSuggestions(suggestions);
          deps.setProactiveCrossSuggestion(deps.pickProactiveCrossSuggestion(suggestions));
        }
        deps.setStatusMessage(`Email details were extracted for the email about ${intent.query}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "read_email_by_index") {
        const email = J.getEmailByIndex(deps.recentEmails, intent.index);
        if (!email) {
          throw new Error(
            `Email ${intent.index} is not loaded right now. Load emails first and then choose a visible email number.`,
          );
        }

        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        const reply = J.buildReadEmailReply(email.subject);
        deps.setCommandResult({
          title: `Email ${intent.index}`,
          detail: J.formatEmailForReading(email),
        });
        deps.setStatusMessage(`Loaded the full email text for email ${intent.index}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "read_email_by_query") {
        const email = J.findEmailByQuery(deps.recentEmails, intent.query);
        if (!email) {
          throw new Error(
            `I could not find a loaded email about ${intent.query}. Load or search Gmail first.`,
          );
        }

        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        const reply = J.buildReadEmailReply(email.subject);
        deps.setCommandResult({
          title: `Email about ${intent.query}`,
          detail: J.formatEmailForReading(email),
        });
        deps.setStatusMessage(`Loaded the email about ${intent.query}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "open_current_email") {
        const email = J.getCurrentEmail(deps.recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email to open yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        await openBrowserUrl(J.buildGmailThreadUrl(email.threadId));
        const reply = J.buildOpenEmailReply(email.subject);
        deps.setCommandResult({
          title: "Gmail thread opened",
          detail: `Opened ${email.subject} in Gmail.`,
        });
        deps.setStatusMessage("Current Gmail thread opened through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "open_email_by_index") {
        const email = J.getEmailByIndex(deps.recentEmails, intent.index);
        if (!email) {
          throw new Error(
            `Email ${intent.index} is not loaded right now. Load emails first and then choose a visible email number.`,
          );
        }

        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        await openBrowserUrl(J.buildGmailThreadUrl(email.threadId));
        const reply = J.buildOpenEmailReply(email.subject);
        deps.setCommandResult({
          title: "Gmail thread opened",
          detail: `Opened email ${intent.index} (${email.subject}) in Gmail.`,
        });
        deps.setStatusMessage(`Opened Gmail thread for email ${intent.index}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "open_email_by_query") {
        const email = J.findEmailByQuery(deps.recentEmails, intent.query);
        if (!email) {
          throw new Error(
            `I could not find a loaded email about ${intent.query}. Load or search Gmail first.`,
          );
        }

        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        await openBrowserUrl(J.buildGmailThreadUrl(email.threadId));
        const reply = J.buildOpenEmailReply(email.subject);
        deps.setCommandResult({
          title: "Gmail thread opened",
          detail: `Opened the email about ${intent.query} in Gmail.`,
        });
        deps.setStatusMessage(`Opened Gmail thread about ${intent.query}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "create_calendar_event_from_email") {
        const email =
          intent.index === null ? deps.recentEmails[0] ?? null : J.getEmailByIndex(deps.recentEmails, intent.index);
        if (!email) {
          throw new Error(
            intent.index === null
              ? "There is no loaded email to turn into a calendar item yet."
              : `Email ${intent.index} is not loaded right now. Load emails first and then choose a visible email number.`,
          );
        }

        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        const derivedIntent = J.buildCalendarIntentFromEmail(email);
        if (!derivedIntent) {
          throw new Error(
            `JARVIS could not find a clear date and time in "${email.subject}" yet.`,
          );
        }

        const reply = J.buildEmailToCalendarReply(derivedIntent.title);
        if (deps.googleCalendarAccessToken) {
          await createGoogleCalendarEvent(
            deps.googleCalendarAccessToken,
            derivedIntent.title,
            derivedIntent.start,
            derivedIntent.end,
          );
        } else {
          const calendarUrl = J.buildGoogleCalendarEventUrl(
            derivedIntent.title,
            derivedIntent.start,
            derivedIntent.end,
          );
          await openBrowserUrl(calendarUrl);
        }
        deps.setCommandResult({
          title: deps.googleCalendarAccessToken ? "Email event created" : "Email event draft opened",
          detail: deps.googleCalendarAccessToken
            ? `Created a calendar event from "${email.subject}".`
            : `Opened a calendar draft from "${email.subject}".`,
        });
        deps.setStatusMessage("Email was turned into a calendar action through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "create_calendar_event_from_current_email") {
        const email = J.resolveActiveEmail(deps.activeConversationContext, deps.recentEmails);
        if (!email) {
          throw new Error(
            "There is no active email in the conversation yet. Open, read, or analyze an email first.",
          );
        }

        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        const derivedIntent = J.buildCalendarIntentFromEmail(email);
        if (!derivedIntent) {
          throw new Error(
            `JARVIS could not find a clear date and time in "${email.subject}" yet.`,
          );
        }

        const reply = J.buildEmailToCalendarReply(derivedIntent.title);
        if (deps.googleCalendarAccessToken) {
          await createGoogleCalendarEvent(
            deps.googleCalendarAccessToken,
            derivedIntent.title,
            derivedIntent.start,
            derivedIntent.end,
          );
        } else {
          const calendarUrl = J.buildGoogleCalendarEventUrl(
            derivedIntent.title,
            derivedIntent.start,
            derivedIntent.end,
          );
          await openBrowserUrl(calendarUrl);
        }
        deps.setCommandResult({
          title: deps.googleCalendarAccessToken ? "Email event created" : "Email event draft opened",
          detail: deps.googleCalendarAccessToken
            ? `Created a calendar event from "${email.subject}".`
            : `Opened a calendar draft from "${email.subject}".`,
        });
        deps.setStatusMessage("Active email was turned into a calendar action through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "create_calendar_event_from_email_query") {
        const email = J.findEmailByQuery(deps.recentEmails, intent.query);
        if (!email) {
          throw new Error(
            `I could not find a loaded email about ${intent.query}. Load or search Gmail first.`,
          );
        }

        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        const derivedIntent = J.buildCalendarIntentFromEmail(email);
        if (!derivedIntent) {
          throw new Error(
            `JARVIS could not find a clear date and time in the email about ${intent.query} yet.`,
          );
        }

        const reply = J.buildEmailToCalendarReply(derivedIntent.title);
        if (deps.googleCalendarAccessToken) {
          await createGoogleCalendarEvent(
            deps.googleCalendarAccessToken,
            derivedIntent.title,
            derivedIntent.start,
            derivedIntent.end,
          );
        } else {
          const calendarUrl = J.buildGoogleCalendarEventUrl(
            derivedIntent.title,
            derivedIntent.start,
            derivedIntent.end,
          );
          await openBrowserUrl(calendarUrl);
        }
        deps.setCommandResult({
          title: deps.googleCalendarAccessToken ? "Email event created" : "Email event draft opened",
          detail: deps.googleCalendarAccessToken
            ? `Created a calendar event from the email about ${intent.query}.`
            : `Opened a calendar draft from the email about ${intent.query}.`,
        });
        deps.setStatusMessage("Queried email was turned into a calendar action through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "complete_task_by_index") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const task = J.getPlannerTaskByIndex(availableTasks, intent.index);
        if (!task) {
          throw new Error(
            `Task ${intent.index} is not loaded right now. Show your task notes first.`,
          );
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          task.dueLabel,
          J.getDueIsoFromLabel(task.dueLabel),
          "done",
        );
        const reply = J.buildCompleteTaskReply(task.title);
        deps.setCommandResult({
          title: "Task completed",
          detail: `Marked task ${intent.index} (${task.title}) as done in Notion.`,
        });
        deps.setStatusMessage("Task note marked done through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setActiveConversationContext(
          J.createActiveTaskContext({
            ...task,
            status: "done",
            sourceNote: updatedNote,
          }),
        );
        deps.setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "complete_task_by_query") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const task = J.findPlannerTaskByQuery(availableTasks, intent.query);
        if (!task) {
          throw new Error(`I could not find a loaded task about ${intent.query}.`);
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          task.dueLabel,
          J.getDueIsoFromLabel(task.dueLabel),
          "done",
        );
        const reply = J.buildCompleteTaskReply(task.title);
        deps.setCommandResult({
          title: "Task completed",
          detail: `Marked ${task.title} as done in Notion.`,
        });
        deps.setStatusMessage("Task note marked done through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setActiveConversationContext(
          J.createActiveTaskContext({
            ...task,
            status: "done",
            sourceNote: updatedNote,
          }),
        );
        deps.setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "update_task_by_index") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const task = J.getPlannerTaskByIndex(availableTasks, intent.index);
        if (!task) {
          throw new Error(
            `Task ${intent.index} is not loaded right now. Show your task notes first.`,
          );
        }

        const updatedNote = await updateNotionTask(
          task.id,
          intent.title,
          intent.dueLabel,
          J.getDueIsoFromLabel(intent.dueLabel),
          "open",
        );
        const reply = J.buildUpdateTaskReply(intent.title);
        deps.setCommandResult({
          title: "Task updated",
          detail: intent.dueLabel
            ? `Updated task ${intent.index} to ${intent.title} due ${intent.dueLabel}.`
            : `Updated task ${intent.index} to ${intent.title}.`,
        });
        deps.setStatusMessage("Task note updated through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setActiveConversationContext(
          J.createActiveTaskContext({
            ...task,
            id: updatedNote.id,
            title: intent.title,
            dueLabel: intent.dueLabel,
            sourceNote: updatedNote,
          }),
        );
        deps.setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "update_task_by_query") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const task = J.findPlannerTaskByQuery(availableTasks, intent.query);
        if (!task) {
          throw new Error(`I could not find a loaded task about ${intent.query}.`);
        }

        const updatedNote = await updateNotionTask(
          task.id,
          intent.title,
          intent.dueLabel,
          J.getDueIsoFromLabel(intent.dueLabel),
          "open",
        );
        const reply = J.buildUpdateTaskReply(intent.title);
        deps.setCommandResult({
          title: "Task updated",
          detail: intent.dueLabel
            ? `Updated ${task.title} to ${intent.title} due ${intent.dueLabel}.`
            : `Updated ${task.title} to ${intent.title}.`,
        });
        deps.setStatusMessage("Task note updated through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setActiveConversationContext(
          J.createActiveTaskContext({
            ...task,
            id: updatedNote.id,
            title: intent.title,
            dueLabel: intent.dueLabel,
            sourceNote: updatedNote,
          }),
        );
        deps.setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "reopen_task_by_index") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const task = J.getPlannerTaskByIndex(availableTasks, intent.index);
        if (!task) {
          throw new Error(`Task ${intent.index} is not loaded right now. Show your task notes first.`);
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          task.dueLabel,
          J.getDueIsoFromLabel(task.dueLabel),
          "open",
        );
        const reply = J.buildReopenTaskReply(task.title);
        deps.setCommandResult({
          title: "Task reopened",
          detail: `Reopened task ${intent.index} (${task.title}) in Notion.`,
        });
        deps.setStatusMessage("Task note reopened through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setActiveConversationContext(
          J.createActiveTaskContext({
            ...task,
            sourceNote: updatedNote,
          }),
        );
        deps.setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "reopen_task_by_query") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const task = J.findPlannerTaskByQuery(availableTasks, intent.query);
        if (!task) {
          throw new Error(`I could not find a loaded task about ${intent.query}.`);
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          task.dueLabel,
          J.getDueIsoFromLabel(task.dueLabel),
          "open",
        );
        const reply = J.buildReopenTaskReply(task.title);
        deps.setCommandResult({
          title: "Task reopened",
          detail: `Reopened ${task.title} in Notion.`,
        });
        deps.setStatusMessage("Task note reopened through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setActiveConversationContext(
          J.createActiveTaskContext({
            ...task,
            sourceNote: updatedNote,
          }),
        );
        deps.setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "move_task_by_index") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const task = J.getPlannerTaskByIndex(availableTasks, intent.index);
        if (!task) {
          throw new Error(`Task ${intent.index} is not loaded right now. Show your task notes first.`);
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          intent.dueLabel,
          J.getDueIsoFromLabel(intent.dueLabel),
          "open",
        );
        const reply = J.buildMoveTaskReply(task.title, intent.dueLabel);
        deps.setCommandResult({
          title: "Task moved",
          detail: `Moved task ${intent.index} (${task.title}) to ${intent.dueLabel}.`,
        });
        deps.setStatusMessage("Task note rescheduled through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setActiveConversationContext(
          J.createActiveTaskContext({
            ...task,
            dueLabel: intent.dueLabel,
            sourceNote: updatedNote,
          }),
        );
        deps.setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "move_task_by_query") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const task = J.findPlannerTaskByQuery(availableTasks, intent.query);
        if (!task) {
          throw new Error(`I could not find a loaded task about ${intent.query}.`);
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          intent.dueLabel,
          J.getDueIsoFromLabel(intent.dueLabel),
          "open",
        );
        const reply = J.buildMoveTaskReply(task.title, intent.dueLabel);
        deps.setCommandResult({
          title: "Task moved",
          detail: `Moved ${task.title} to ${intent.dueLabel}.`,
        });
        deps.setStatusMessage("Task note rescheduled through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setActiveConversationContext(
          J.createActiveTaskContext({
            ...task,
            dueLabel: intent.dueLabel,
            sourceNote: updatedNote,
          }),
        );
        deps.setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "complete_current_task") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const task = J.resolveActiveTask(deps.activeConversationContext, availableTasks);
        if (!task) {
          throw new Error("There is no active task in the conversation yet. Show or create a task first.");
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          task.dueLabel,
          J.getDueIsoFromLabel(task.dueLabel),
          "done",
        );
        const reply = J.buildCompleteTaskReply(task.title);
        deps.setCommandResult({
          title: "Task completed",
          detail: `Marked ${task.title} as done in Notion.`,
        });
        deps.setStatusMessage("Active task note marked done through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setActiveConversationContext(
          J.createActiveTaskContext({
            ...task,
            status: "done",
            sourceNote: updatedNote,
          }),
        );
        deps.setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "reopen_current_task") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const task = J.resolveActiveTask(deps.activeConversationContext, availableTasks);
        if (!task) {
          throw new Error("There is no active task in the conversation yet. Show or create a task first.");
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          task.dueLabel,
          J.getDueIsoFromLabel(task.dueLabel),
          "open",
        );
        const reply = J.buildReopenTaskReply(task.title);
        deps.setCommandResult({
          title: "Task reopened",
          detail: `Reopened ${task.title} in Notion.`,
        });
        deps.setStatusMessage("Active task note reopened through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setActiveConversationContext(
          J.createActiveTaskContext({
            ...task,
            sourceNote: updatedNote,
          }),
        );
        deps.setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "move_current_task") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const task = J.resolveActiveTask(deps.activeConversationContext, availableTasks);
        if (!task) {
          throw new Error("There is no active task in the conversation yet. Show or create a task first.");
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          intent.dueLabel,
          J.getDueIsoFromLabel(intent.dueLabel),
          "open",
        );
        const reply = J.buildMoveTaskReply(task.title, intent.dueLabel);
        deps.setCommandResult({
          title: "Task moved",
          detail: `Moved ${task.title} to ${intent.dueLabel}.`,
        });
        deps.setStatusMessage("Active task note rescheduled through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setActiveConversationContext(
          J.createActiveTaskContext({
            ...task,
            dueLabel: intent.dueLabel,
            sourceNote: updatedNote,
          }),
        );
        deps.setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "open_current_browser_target") {
        const browserContext = J.resolveActiveBrowserContext(deps.activeConversationContext);
        if (!browserContext) {
          throw new Error("There is no active browser target in the conversation yet. Open or search something first.");
        }

        await openBrowserUrl(browserContext.url);
        const reply = J.buildOpenSiteReply(browserContext.label);
        deps.setCommandResult({
          title: "Website opened",
          detail: `Opened ${browserContext.label}.`,
        });
        deps.setStatusMessage("Active browser target opened through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "set_voice_reply_mode") {
        deps.setVoiceReplyMode(intent.mode);
        const reply = J.buildVoiceReplyModeReply(intent.mode);
        deps.setCommandResult({
          title: "Voice reply mode updated",
          detail: J.buildVoiceReplyModeDetail(intent.mode),
        });
        deps.setStatusMessage(`Voice reply mode set to ${J.formatVoiceReplyModeLabel(intent.mode)}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        if (intent.mode !== "quiet") {
          deps.speakIfEnabled(reply);
        }
      } else if (intent.kind === "report_voice_reply_mode") {
        const label = J.formatVoiceReplyModeLabel(deps.voiceReplyMode);
        const reply = `I'm currently using ${label} voice mode.`;
        deps.setCommandResult({
          title: "Voice reply mode",
          detail: J.buildVoiceReplyModeDetail(deps.voiceReplyMode),
        });
        deps.setStatusMessage(`Voice reply mode is ${label}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "complete_all_overdue_tasks") {
        const parsedTasks = await deps.loadPlannerTaskRecords();
        const overdueTasks = parsedTasks.filter((task) => task.status === "overdue");
        const updatedNotes: NoteRecord[] = [];

        for (const task of overdueTasks) {
          const updatedNote = await updateNotionTask(
            task.id,
            task.title,
            task.dueLabel,
            J.getDueIsoFromLabel(task.dueLabel),
            "done",
          );
          updatedNotes.push(updatedNote);
        }

        const reply = J.buildBatchOverdueTaskReply(overdueTasks.length);
        deps.setCommandResult({
          title: "Overdue tasks completed",
          detail:
            overdueTasks.length > 0
              ? overdueTasks.map((task) => task.title).join(" | ")
              : "There were no overdue tasks to complete.",
        });
        deps.setStatusMessage("Processed all overdue tasks through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        if (updatedNotes.length > 0) {
          deps.setRecentNotes((current) =>
            [
              ...updatedNotes.reverse(),
              ...current.filter(
                (note) => !updatedNotes.some((updated) => updated.id === note.id),
              ),
            ].slice(0, 10),
          );
        }
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "complete_task_range") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const tasksToComplete = intent.indices
          .map((index) => J.getPlannerTaskByIndex(availableTasks, index))
          .filter(Boolean) as PlannerTaskRecord[];
        if (tasksToComplete.length === 0) {
          throw new Error(
            "I could not resolve those tasks from the current list. Show your task notes first.",
          );
        }

        const updatedNotes: NoteRecord[] = [];
        for (const task of tasksToComplete) {
          const updatedNote = await updateNotionTask(
            task.id,
            task.title,
            task.dueLabel,
            J.getDueIsoFromLabel(task.dueLabel),
            "done",
          );
          updatedNotes.push(updatedNote);
        }

        const lastTask = tasksToComplete[tasksToComplete.length - 1];
        const lastUpdatedNote = updatedNotes[updatedNotes.length - 1];
        deps.setActiveConversationContext(
          J.createActiveTaskContext({
            ...lastTask,
            status: "done",
            sourceNote: lastUpdatedNote,
          }),
        );
        const reply = J.buildBatchOverdueTaskReply(tasksToComplete.length);
        deps.setCommandResult({
          title: "Batch task completion complete",
          detail: tasksToComplete.map((task) => task.title).join(" | "),
        });
        deps.setStatusMessage("Completed selected tasks through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) =>
          [
            ...updatedNotes.reverse(),
            ...current.filter((note) => !updatedNotes.some((updated) => updated.id === note.id)),
          ].slice(0, 10),
        );
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "create_daily_brief") {
        const emails =
          deps.gmailAccessToken ? await listUnreadGmailMessages(deps.gmailAccessToken, 5) : deps.recentEmails.slice(0, 5);
        const taskNotes = await searchNotionNotes("Task:");
        const parsedTasks = taskNotes
          .map(J.parseTaskNoteRecord)
          .filter(Boolean) as PlannerTaskRecord[];
        const events = deps.googleCalendarAccessToken
          ? await listTodayGoogleCalendarEvents(deps.googleCalendarAccessToken)
          : [];

        const briefContent = J.buildDailyBriefContentV4(
          emails,
          parsedTasks,
          events,
          deps.peopleMemory,
          deps.travelMemory,
          deps.expenseMemory,
          deps.packageMemory,
          deps.meetingPrepMemory,
          deps.schoolPlanMemory,
        );
        const note = await createNotionNote(briefContent);
        const reply = J.buildDailyBriefReply(note.title);
        deps.setCommandResult({
          title: "Daily brief saved",
          detail: `Saved your daily brief to Notion as "${note.title}".`,
        });
        deps.setStatusMessage("Daily brief generated from Gmail, Calendar, and Notion.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentEmails(emails);
        deps.setPlannerTasks(parsedTasks);
        deps.setRecentNotes((current) => [note, ...current.filter((item) => item.id !== note.id)].slice(0, 5));
        {
          const suggestions = deps.buildCrossFeatureSuggestionsForState();
          deps.setCrossFeatureSuggestions(suggestions);
          deps.setProactiveCrossSuggestion(deps.pickProactiveCrossSuggestion(suggestions));
        }
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "standby_mode") {
        deps.returnToArmedWakeMode();
        deps.setWakeModeStatus({
          assistantName: deps.assistantName,
          wakeModeEnabled: true,
          message: `${deps.assistantName} is standing by and waiting for the wake phrase.`,
        });
        const reply = J.buildStandbyReply(deps.assistantName);
        deps.setCommandResult({
          title: "JARVIS is standing by",
          detail: "Wake mode stays on, and the assistant has returned to the armed standby state.",
        });
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "sleep_mode") {
        deps.stopHandsFreeSession();
        deps.setWakeModeEnabled(false);
        deps.setWakeModeStatus({
          assistantName: deps.assistantName,
          wakeModeEnabled: false,
          message: `${deps.assistantName} is sleeping for this session.`,
        });
        const reply = J.buildSleepReply(deps.assistantName);
        deps.setCommandResult({
          title: "JARVIS is sleeping",
          detail: "Wake mode is off for this session. Turn it back on when you want hands-free listening again.",
        });
        deps.setStatusMessage(`${deps.assistantName} is sleeping. Wake mode is off for this session.`);
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
      } else if (intent.kind === "shutdown_app") {
        deps.stopHandsFreeSession();
        const reply = J.buildShutdownReply(deps.assistantName);
        deps.setCommandResult({
          title: "Shutting down JARVIS",
          detail: "Closing the app now.",
        });
        deps.setStatusMessage(`Shutting down ${deps.assistantName}.`);
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
        window.setTimeout(() => {
          void getCurrentWindow().close();
        }, 300);
      }

      if (intent.kind.startsWith("spotify_")) {
        deps.setActiveConversationContext(J.createActiveBrowserContext("https://open.spotify.com/"));
      }

      completed = true;
      await deps.loadMemoryView();
    } catch (error) {
      deps.setVoiceSessionPhase("error");
      deps.setCommandResult({
        title: "Command failed",
        detail: J.getErrorDetail(
          error,
          "JARVIS could not complete that browser or study action through the native bridge.",
        ),
      });
      deps.appendConversationTurn("jarvis", J.buildFailureReply());
      deps.speakIfEnabled("I could not complete that.");
    } finally {
      deps.setIsRoutingCommand(false);
    }

    return completed;
  }

  async function handleApplyCrossFeatureSuggestion(suggestion: CrossFeatureSuggestionRecord) {
    const intents = suggestion.intents ?? (suggestion.intent ? [suggestion.intent] : []);
    if (intents.length === 0) {
      return;
    }

    let completed = true;
    for (const intent of intents) {
      const stepCompleted = await executeIntent(intent);
      if (!stepCompleted) {
        completed = false;
        break;
      }
    }
    if (completed) {
      deps.setCrossFeatureSuggestions((current) =>
        current.filter((entry) => entry.id !== suggestion.id),
      );
      deps.setProactiveCrossSuggestion((current) => (current?.id === suggestion.id ? null : current));
    }
  }

  async function runCommand(
    trimmedInput: string,
    options?: {
      appendUserTurn?: boolean;
      allowChaining?: boolean;
      bypassGatewayConfirmation?: boolean;
    },
  ): Promise<RunCommandOutcome> {
    const appendUserTurn = options?.appendUserTurn ?? true;
    const allowChaining = options?.allowChaining ?? true;
    const bypassGatewayConfirmation = options?.bypassGatewayConfirmation ?? false;
    deps.currentRouteLabelRef.current = undefined;
    deps.setCrossFeatureSuggestions([]);

    if (!trimmedInput) {
      deps.setVoiceSessionPhase("idle");
      deps.setStatusMessage("No command to route yet.");
      deps.setCommandResult({
        title: "No command to route",
        detail: "Type something like 'Open my study apps' to test the first skill.",
      });
      deps.speakIfEnabled("I did not hear a command to route.");
      return { status: "empty" };
    }

    if (deps.pendingGatewayConfirmation && !bypassGatewayConfirmation) {
      if (J.isGatewayConfirmationYes(trimmedInput)) {
        const confirmed = deps.pendingGatewayConfirmation;
        deps.setPendingGatewayConfirmation(null);
        deps.pushGatewayHistory(
          "confirm_accepted",
          confirmed.command,
          confirmed.preview,
          "User confirmed the pending gateway route.",
        );
        deps.setCommandResult({
          title: "Gateway confirmation accepted",
          detail: `Running the confirmed command: "${confirmed.command}".`,
        });
        return runCommand(confirmed.command, {
          appendUserTurn: false,
          allowChaining,
          bypassGatewayConfirmation: true,
        });
      }

      if (J.isGatewayConfirmationNo(trimmedInput)) {
        deps.pushGatewayHistory(
          "confirm_cancelled",
          deps.pendingGatewayConfirmation.command,
          deps.pendingGatewayConfirmation.preview,
          "User cancelled the pending gateway route.",
        );
        deps.setPendingGatewayConfirmation(null);
        deps.setCommandResult({
          title: "Gateway confirmation cancelled",
          detail: "JARVIS will not run that pending command.",
        });
        deps.setStatusMessage("Gateway confirmation cancelled.");
        deps.appendConversationTurn("jarvis", "Okay, I cancelled that pending command.");
        deps.speakIfEnabled("Okay, I cancelled that.");
        return { status: "clarification" };
      }

      deps.setPendingGatewayConfirmation(null);
      deps.setCommandResult({
        title: "Gateway confirmation replaced",
        detail: "JARVIS cleared the pending confirmation and will route your new command instead.",
      });
    }

    if (deps.pendingGatewayTeaching && !bypassGatewayConfirmation) {
      const pending = deps.pendingGatewayTeaching;
      const teachingInstruction = J.parseTeachingInstruction(trimmedInput, pending.phrase);

      if (teachingInstruction?.kind === "teach_phrase") {
        const taught = await deps.teachJarvisMeaning(
          teachingInstruction.phrase,
          teachingInstruction.meaning,
        );
        deps.pushGatewayHistory(
          "teach_saved",
          teachingInstruction.phrase,
          pending.preview,
          `Saved phrase as ${J.describeCommandIntent(taught.resolvedIntent)}.`,
        );
        deps.setPendingGatewayTeaching(null);
        deps.setTeachingTargetPhrase(null);
        deps.setCommandResult({
          title: "Gateway phrase taught",
          detail: `JARVIS learned that "${teachingInstruction.phrase}" means ${J.describeCommandIntent(taught.resolvedIntent)}.`,
        });
        deps.setStatusMessage(`Gateway learned what "${teachingInstruction.phrase}" means.`);
        deps.appendConversationTurn(
          "jarvis",
          `I'll remember that "${teachingInstruction.phrase}" means ${J.describeCommandIntent(taught.resolvedIntent)}.`,
        );
        deps.speakIfEnabled(
          `I'll remember that ${teachingInstruction.phrase} means ${J.describeCommandIntent(taught.resolvedIntent)}.`,
        );
        return { status: "completed" };
      }

      if (teachingInstruction?.kind === "teach_workflow") {
        const workflow = deps.teachJarvisWorkflow(
          teachingInstruction.phrase,
          teachingInstruction.steps,
        );
        deps.pushGatewayHistory(
          "teach_saved",
          teachingInstruction.phrase,
          pending.preview,
          `Saved ${workflow.steps.length}-step workflow.`,
        );
        deps.setPendingGatewayTeaching(null);
        deps.setTeachingTargetPhrase(null);
        deps.setCommandResult({
          title: "Gateway workflow taught",
          detail: `Saved "${workflow.triggerPhrase}" as a ${workflow.steps.length}-step workflow.`,
        });
        deps.setStatusMessage(`Gateway learned the workflow for "${workflow.triggerPhrase}".`);
        deps.appendConversationTurn(
          "jarvis",
          `I'll remember that "${workflow.triggerPhrase}" runs ${workflow.steps.length} steps.`,
        );
        deps.speakIfEnabled(`I'll remember that ${workflow.triggerPhrase} runs ${workflow.steps.length} steps.`);
        return { status: "completed" };
      }

      if (J.isGatewayConfirmationNo(trimmedInput)) {
        deps.pushGatewayHistory(
          "teach_cancelled",
          pending.phrase,
          pending.preview,
          "User cancelled gateway teaching.",
        );
        deps.setPendingGatewayTeaching(null);
        deps.setTeachingTargetPhrase(null);
        deps.setCommandResult({
          title: "Gateway teaching cancelled",
          detail: "JARVIS will not learn a mapping for that phrase right now.",
        });
        deps.setStatusMessage("Gateway teaching cancelled.");
        deps.appendConversationTurn("jarvis", "Okay, I will not learn that phrase right now.");
        deps.speakIfEnabled("Okay, I will not learn that phrase right now.");
        return { status: "clarification" };
      }
    }

    if (appendUserTurn) {
      deps.appendConversationTurn("user", trimmedInput);
    }

    if (deps.gatewayConfig && J.shouldDelegateToGateway(trimmedInput, deps.gatewayConfig)) {
      try {
        const response: GatewayTurnResponse = await gatewayRunTurn({
          command: trimmedInput,
          sessionId: deps.gatewaySessionRef.current,
          source: "text",
        });
        if (!response.result.legacy) {
          const handoff = response.result.integrationHandoff;
          if (handoff) {
            if (deps.gatewayConfig && J.isGatewaySimulationMode(deps.gatewayConfig)) {
              const blocked = J.formatSimulationBlockedHandoff(deps.gatewayConfig, handoff);
              deps.setCommandResult({ title: "Gateway simulation mode", detail: blocked });
              deps.setStatusMessage(blocked);
              deps.appendConversationTurn("jarvis", blocked);
              deps.speakIfEnabled(blocked);
              return { status: "completed" };
            }
            const intent = J.mapIntegrationHandoffToIntent(handoff);
            if (intent) {
              await executeIntent(intent);
              return { status: "completed" };
            }
          }
          deps.setCommandResult({
            title: "Gateway executed command",
            detail: response.result.reply,
          });
          deps.setStatusMessage(response.result.reply);
          deps.setVoiceSessionPhase("ready");
          deps.appendConversationTurn("jarvis", response.result.reply);
          deps.speakIfEnabled(response.result.reply);
          return { status: "completed" };
        }
        if (deps.gatewayConfig && J.isGatewaySimulationMode(deps.gatewayConfig)) {
          const reply =
            response.result.reply ||
            "Gateway simulation mode blocked legacy fallback for this command.";
          deps.setCommandResult({ title: "Gateway simulation mode", detail: reply });
          deps.setStatusMessage(reply);
          deps.appendConversationTurn("jarvis", reply);
          deps.speakIfEnabled(reply);
          return { status: "completed" };
        }
      } catch {
        // Gateway execution failed; fall through to legacy deps.App routing.
      }
      if (J.shouldBlockLegacyCommandInSimulation(trimmedInput, deps.gatewayConfig)) {
        const reply = "Gateway simulation mode blocked legacy command execution.";
        deps.setCommandResult({ title: "Gateway simulation mode", detail: reply });
        deps.setStatusMessage(reply);
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
        return { status: "completed" };
      }
    }

    if (!bypassGatewayConfirmation) {
      try {
        const preview = await previewGatewayTurn({ command: trimmedInput, source: "text" });
        deps.setGatewayPreview(preview);
        deps.setGatewayPreviewError(null);
        const route = preview.result.route;
        if (route?.decisionPolicy === "confirm") {
          deps.setPendingGatewayTeaching(null);
          deps.setPendingGatewayConfirmation({ command: trimmedInput, preview });
          deps.pushGatewayHistory(
            "confirm_requested",
            trimmedInput,
            preview,
            "Gateway asked for confirmation before execution.",
          );
          deps.setCommandResult({
            title: "Gateway confirmation needed",
            detail: `JARVIS thinks this belongs to ${route.capabilityLabel}. Say yes to run it, or no to cancel.`,
          });
          deps.setStatusMessage("Gateway is waiting for confirmation.");
          deps.appendConversationTurn(
            "jarvis",
            `I think this is ${route.capabilityLabel}. Say yes to run it, or no to cancel.`,
          );
          deps.speakIfEnabled(`I think this is ${route.capabilityLabel}. Should I run it?`);
          return { status: "clarification" };
        }
        if (route?.decisionPolicy === "teach") {
          deps.setPendingGatewayConfirmation(null);
          deps.setPendingGatewayTeaching({ phrase: trimmedInput, preview });
          deps.setTeachingTargetPhrase(trimmedInput);
          deps.pushGatewayHistory(
            "teach_requested",
            trimmedInput,
            preview,
            "Gateway asked to learn this low-confidence phrase.",
          );
          deps.setCommandResult({
            title: "Gateway needs teaching",
            detail: `I do not know what "${trimmedInput}" should do yet. Teach me with "that means ..." or "when I say ${trimmedInput}, I mean ...".`,
          });
          deps.setStatusMessage("Gateway is waiting for teaching.");
          deps.appendConversationTurn(
            "jarvis",
            `I do not know what "${trimmedInput}" should do yet. Tell me what it means.`,
          );
          deps.speakIfEnabled(`I do not know what ${trimmedInput} should do yet. Tell me what it means.`);
          return { status: "clarification" };
        }
      } catch {
        // Gateway preview is advisory. Existing command routing stays available if preview fails.
      }
    }

    if (J.isStartTrainingModeCommand(trimmedInput)) {
      deps.startTrainingMode(5);
      return { status: "clarification" };
    }

    if (deps.trainingModeSession) {
      return deps.handleTrainingModeInput(trimmedInput, deps.trainingModeSession);
    }

    const trainingCleanupOutcome = await deps.handleTrainingReviewCleanupCommand(trimmedInput);
    if (trainingCleanupOutcome) {
      return trainingCleanupOutcome;
    }

    const contextStackOutcome = deps.handleConversationContextStackCommand(trimmedInput);
    if (contextStackOutcome) {
      return contextStackOutcome;
    }

    const teachingInstruction = J.parseTeachingInstruction(trimmedInput, deps.teachingTargetPhrase);
    if (teachingInstruction) {
      if (teachingInstruction.kind === "teach_phrase") {
        const taught = await deps.teachJarvisMeaning(
          teachingInstruction.phrase,
          teachingInstruction.meaning,
        );
        deps.setTeachingTargetPhrase(null);
        deps.setPendingClarification(null);
        deps.setCommandResult({
          title: "Phrase meaning taught",
          detail: `JARVIS learned that "${teachingInstruction.phrase}" means ${J.describeCommandIntent(taught.resolvedIntent)}. Family: ${taught.familyLabel}.`,
        });
        deps.setStatusMessage(`JARVIS learned what "${teachingInstruction.phrase}" means.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn(
          "jarvis",
          `I'll remember that "${teachingInstruction.phrase}" means ${J.describeCommandIntent(taught.resolvedIntent)}.`,
        );
        deps.speakIfEnabled(
          `I'll remember that ${teachingInstruction.phrase} means ${J.describeCommandIntent(taught.resolvedIntent)}.`,
        );
        return { status: "completed" };
      }

      if (teachingInstruction.kind === "teach_workflow") {
        const workflow = deps.teachJarvisWorkflow(
          teachingInstruction.phrase,
          teachingInstruction.steps,
        );
        deps.setTeachingTargetPhrase(null);
        deps.setPendingClarification(null);
        deps.setCommandResult({
          title: "Workflow meaning taught",
          detail: `Saved "${workflow.triggerPhrase}" as a ${workflow.steps.length}-step workflow: ${workflow.steps.join(" -> ")}.`,
        });
        deps.setStatusMessage(`JARVIS learned the workflow for "${workflow.triggerPhrase}".`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn(
          "jarvis",
          `I'll remember that "${workflow.triggerPhrase}" runs ${workflow.steps.length} steps.`,
        );
        deps.speakIfEnabled(`I'll remember that ${workflow.triggerPhrase} runs ${workflow.steps.length} steps.`);
        return { status: "completed" };
      }

      if (teachingInstruction.kind === "set_music_provider") {
        deps.setUserPreferenceMemory((current) => ({
          ...current,
          musicProvider: teachingInstruction.provider,
        }));
        deps.setTeachingTargetPhrase(null);
        deps.setCommandResult({
          title: "Music preference saved",
          detail: "JARVIS will treat music requests as Spotify-first when the phrasing is ambiguous.",
        });
        deps.setStatusMessage("Music preference saved.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I'll treat music requests as Spotify-first from now on.");
        deps.speakIfEnabled("I'll treat music requests as Spotify first from now on.");
        return { status: "completed" };
      }

      if (teachingInstruction.kind === "set_note_app") {
        deps.setUserPreferenceMemory((current) => ({
          ...current,
          noteApp: teachingInstruction.app,
        }));
        deps.setTeachingTargetPhrase(null);
        deps.setCommandResult({
          title: "Note preference saved",
          detail: "JARVIS will keep sending note requests to Notion.",
        });
        deps.setStatusMessage("Note preference saved.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I'll keep sending your note requests to Notion.");
        deps.speakIfEnabled("I'll keep sending your note requests to Notion.");
        return { status: "completed" };
      }

      if (teachingInstruction.kind === "set_default_workspace") {
        deps.setUserPreferenceMemory((current) => ({
          ...current,
          defaultWorkspaceName: teachingInstruction.workspaceName,
        }));
        deps.setTeachingTargetPhrase(null);
        deps.setCommandResult({
          title: "Default workspace saved",
          detail: `JARVIS will treat setup-style workspace requests as ${teachingInstruction.workspaceName}.`,
        });
        deps.setStatusMessage("Default workspace saved.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn(
          "jarvis",
          `I'll treat your setup workspace as ${teachingInstruction.workspaceName} from now on.`,
        );
        deps.speakIfEnabled(
          `I'll treat your setup workspace as ${teachingInstruction.workspaceName} from now on.`,
        );
        return { status: "completed" };
      }
    }

    const normalizedDirectCommand = J.normalizeControlCommand(trimmedInput);
    if (
      deps.userPreferenceMemory.musicProvider === "spotify" &&
      ["play something", "play some music", "put on some music", "play music"].includes(
        normalizedDirectCommand,
      )
    ) {
      const completed = await executeIntent({ kind: "spotify_play" });
      return completed ? { status: "completed" } : { status: "failed" };
    }

    if (
      deps.userPreferenceMemory.defaultWorkspaceName &&
      [
        "open my setup",
        "open setup",
        "start my setup",
        "start setup",
        "open my default workspace",
        "open default workspace",
      ].includes(normalizedDirectCommand)
    ) {
      const completed = await executeIntent({
        kind: "open_desktop_project",
        query: deps.userPreferenceMemory.defaultWorkspaceName,
      });
      return completed ? { status: "completed" } : { status: "failed" };
    }

    if (J.isExplainIntentRoutingCommand(trimmedInput)) {
      const routeLabel = deps.commandResult?.routeLabel ?? deps.currentRouteLabelRef.current ?? "No route recorded yet";
      const matchDetail =
        deps.lastSemanticIntentMatches.length > 0
          ? deps.lastSemanticIntentMatches
              .map(
                (match, index) =>
                  `${index + 1}. ${match.label} (${Math.round(match.score * 100)}%, ${match.source}, matched "${match.matchedExample}")`,
              )
              .join(" ")
          : "There were no semantic matches recorded for the last routed command.";
      const pendingDetail = deps.pendingClarification
        ? ` Current pending clarification: ${deps.pendingClarification.prompt}`
        : "";

      deps.setCommandResult({
        title: "Why JARVIS chose that",
        detail: `Last route: ${routeLabel}. ${matchDetail}${pendingDetail}`,
        routeLabel,
      });
      deps.setStatusMessage("JARVIS explained the last routing decision.");
      deps.setVoiceSessionPhase("ready");
      deps.appendConversationTurn(
        "jarvis",
        deps.lastSemanticIntentMatches[0]
          ? `I matched mostly on ${deps.lastSemanticIntentMatches[0].label} at ${Math.round(deps.lastSemanticIntentMatches[0].score * 100)} percent confidence.`
          : "I do not have a semantic match recorded for the last command.",
      );
      deps.speakIfEnabled(
        deps.lastSemanticIntentMatches[0]
          ? `I matched mostly on ${deps.lastSemanticIntentMatches[0].label}.`
          : "I do not have a semantic match recorded for the last command.",
      );
      return { status: "completed" };
    }

    const semanticTestPhrase = J.parseSemanticIntentTestCommand(trimmedInput);
    if (semanticTestPhrase) {
      const semanticTestEmbedding = await deps.buildSemanticEmbeddingWithFallback(semanticTestPhrase);
      const semanticIntentRanks = await J.rankSemanticIntentCandidates(
        semanticTestPhrase,
        J.buildSemanticIntentCandidates(
          semanticTestPhrase,
          deps.browserAliases,
          deps.learnedIntentMappings,
          deps.savedWorkflows,
          deps.userPreferenceMemory,
          deps.activeConversationContext,
        ),
        semanticTestEmbedding.embedding,
        deps.buildCachedSemanticIntentEmbedding as unknown as (
          text: string,
        ) => Promise<{ embedding: number[]; backend: J.EmbeddingBackend }>,
        deps.semanticIntentFeedback,
      );
      const matches = semanticIntentRanks.slice(0, 5).map((rank) => ({
        id: rank.candidate.id,
        label: rank.candidate.label,
        source: rank.candidate.source,
        score: rank.score,
        confidence: rank.confidence,
        matchedExample: rank.matchedExample,
      }));
      deps.setLastSemanticIntentMatches(matches);
      deps.setCommandResult({
        title: "Semantic intent test",
        detail:
          matches.length > 0
            ? matches
                .map(
                  (match, index) =>
                    `${index + 1}. ${match.label} (${Math.round(match.score * 100)}%, ${match.source}, matched "${match.matchedExample}")`,
                )
                .join(" ")
            : `No semantic candidate reached the current confidence threshold for "${semanticTestPhrase}".`,
        routeLabel: "Semantic test only",
      });
      deps.setStatusMessage("Semantic intent test finished without executing an action.");
      deps.setVoiceSessionPhase("ready");
      deps.appendConversationTurn(
        "jarvis",
        matches[0]
          ? `Test only. The top match was ${matches[0].label} at ${Math.round(matches[0].score * 100)} percent.`
          : "Test only. I did not find a strong semantic match.",
        "Semantic test only",
      );
      deps.speakIfEnabled(
        matches[0]
          ? `Test only. The top match was ${matches[0].label}.`
          : "Test only. I did not find a strong semantic match.",
      );
      return { status: "completed" };
    }

    const sameTopicIntent = J.resolveSameTopicFollowUpIntent(
      trimmedInput,
      deps.lastConversationTopic,
      deps.activeConversationContext,
    );
    if (sameTopicIntent) {
      deps.setMissingSkillRequest(null);
      deps.setMissingSkillPlan(null);
      deps.currentRouteLabelRef.current = "Session topic memory";
      const completed = await executeIntent(sameTopicIntent);
      if (completed) {
        await deps.rememberSuccessfulPhrase(trimmedInput, sameTopicIntent);
        await deps.rememberSemanticConversationTurn(trimmedInput, sameTopicIntent);
      }
      if (completed && deps.shouldKeepFollowUpWindowOpen(sameTopicIntent)) {
        deps.openFollowUpWindow("reply");
      }
      deps.currentRouteLabelRef.current = undefined;
      return completed ? { status: "completed" } : { status: "failed" };
    }

    const activeAppContextIntent = J.resolveActiveAppContextFollowUpIntent(
      trimmedInput,
      deps.activeConversationContext,
      deps.lastConversationTopic,
      deps.userPreferenceMemory.musicProvider,
    );
    if (activeAppContextIntent) {
      deps.setMissingSkillRequest(null);
      deps.setMissingSkillPlan(null);
      deps.currentRouteLabelRef.current = "Active context memory";
      const completed = await executeIntent(activeAppContextIntent);
      if (completed) {
        await deps.rememberSuccessfulPhrase(trimmedInput, activeAppContextIntent);
        await deps.rememberSemanticConversationTurn(trimmedInput, activeAppContextIntent);
      }
      if (completed && deps.shouldKeepFollowUpWindowOpen(activeAppContextIntent)) {
        deps.openFollowUpWindow("reply");
      }
      deps.currentRouteLabelRef.current = undefined;
      return completed ? { status: "completed" } : { status: "failed" };
    }

    const naturalQueryEmbedding = await deps.buildSemanticEmbeddingWithFallback(trimmedInput);
    const naturalConversationResolution = J.resolveNaturalConversationFollowUp(
      trimmedInput,
      deps.activeConversationContext,
      deps.semanticConversationMemory,
      naturalQueryEmbedding.embedding,
    );
    if (naturalConversationResolution) {
      if (naturalConversationResolution.kind === "intent") {
        const completed = await executeIntent(naturalConversationResolution.intent);
        if (completed) {
          await deps.rememberSemanticConversationTurn(trimmedInput, naturalConversationResolution.intent);
        }
        return completed ? { status: "completed" } : { status: "failed" };
      }

      deps.setCommandResult({
        title: naturalConversationResolution.title,
        detail: naturalConversationResolution.detail,
      });
      deps.setStatusMessage("Conversation context answered from semantic memory.");
      deps.setVoiceSessionPhase("ready");
      deps.appendConversationTurn("jarvis", naturalConversationResolution.spoken);
      deps.speakIfEnabled(naturalConversationResolution.spoken);
      deps.openFollowUpWindow("reply");
      await deps.rememberSemanticConversationTurn(trimmedInput, null);
      return { status: "completed" };
    }

    if (deps.proactiveCrossSuggestion) {
      const normalizedReply = J.normalizeControlCommand(trimmedInput);
      if (["yes", "yeah", "yep", "sure", "okay", "ok", "do it", "do that"].includes(normalizedReply)) {
        const suggestion = deps.proactiveCrossSuggestion;
        deps.setProactiveCrossSuggestion(null);
        await handleApplyCrossFeatureSuggestion(suggestion);
        return { status: "completed" };
      }

      if (["no", "nope", "nah", "not now", "skip that", "don't do that", "do not do that"].includes(normalizedReply)) {
        deps.setProactiveCrossSuggestion(null);
        deps.setCommandResult({
          title: "Skipped suggested next step",
          detail: "Okay. I left that cross-feature follow-up alone.",
        });
        deps.setStatusMessage("Skipped the proactive cross-feature suggestion.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "Okay, I won't do that right now.");
        deps.speakIfEnabled("Okay, I won't do that right now.");
        return { status: "completed" };
      }
    }

    if (deps.pendingWorkflowExecution) {
      return deps.continuePendingWorkflowExecution(deps.pendingWorkflowExecution, trimmedInput);
    }

    if (deps.pendingClarification) {
      const correctionInstruction = J.parseCorrectionInstruction(trimmedInput);
      if (correctionInstruction && deps.pendingClarification.originalPhrase) {
        deps.rememberRejectedPendingSemanticClarification(deps.pendingClarification);
        const originalPhrase = deps.pendingClarification.originalPhrase;
        deps.setTeachingTargetPhrase(null);
        deps.setPendingClarification(null);

        if (correctionInstruction.kind === "correct_workflow") {
          const workflow = deps.teachJarvisWorkflow(originalPhrase, correctionInstruction.steps);
          deps.setCommandResult({
            title: "Correction learned",
            detail: `Got it. I weakened the wrong guess and learned that "${originalPhrase}" runs ${workflow.steps.length} steps: ${workflow.steps.join(" -> ")}.`,
          });
          deps.setStatusMessage("JARVIS learned your correction as a workflow.");
          deps.setVoiceSessionPhase("ready");
          deps.appendConversationTurn(
            "jarvis",
            `Got it. I'll remember that ${originalPhrase} runs that workflow.`,
          );
          deps.speakIfEnabled(`Got it. I'll remember that ${originalPhrase} runs that workflow.`);
          return { status: "completed" };
        }

        try {
          const taught = await deps.teachJarvisMeaning(originalPhrase, correctionInstruction.meaning);
          deps.setCommandResult({
            title: "Correction learned",
            detail: `Got it. I weakened the wrong guess and learned that "${originalPhrase}" means ${J.describeCommandIntent(taught.resolvedIntent)}.`,
          });
          deps.setStatusMessage("JARVIS learned your correction.");
          deps.setVoiceSessionPhase("ready");
          deps.appendConversationTurn(
            "jarvis",
            `Got it. I'll remember that ${originalPhrase} means ${J.describeCommandIntent(taught.resolvedIntent)}.`,
          );
          deps.speakIfEnabled(
            `Got it. I'll remember that ${originalPhrase} means ${J.describeCommandIntent(taught.resolvedIntent)}.`,
          );
          const completed = await executeIntent(taught.resolvedIntent);
          if (completed) {
            await deps.rememberSemanticConversationTurn(originalPhrase, taught.resolvedIntent);
          }
          return completed ? { status: "completed" } : { status: "failed" };
        } catch (error) {
          deps.setTeachingTargetPhrase(originalPhrase);
          deps.setCommandResult({
            title: "Correction needs a clearer action",
            detail: J.getErrorDetail(
              error,
              `I could not turn that correction into a reliable action. Try "when I say ${originalPhrase}, I mean play blinding lights on spotify".`,
            ),
          });
          deps.setStatusMessage("JARVIS could not learn that correction yet.");
          deps.setVoiceSessionPhase("ready");
          deps.appendConversationTurn(
            "jarvis",
            `I understand you are correcting me, but I need the action to be a little clearer.`,
          );
          deps.speakIfEnabled("I understand you are correcting me, but I need the action to be a little clearer.");
          return { status: "clarification" };
        }
      }

      if (deps.pendingClarification.suggestedWorkflow) {
        const normalizedReply = J.normalizeControlCommand(trimmedInput);
        if (["yes", "yeah", "yep", "sure", "okay", "ok", "do that", "run it"].includes(normalizedReply)) {
          const triggerPhrase = deps.pendingClarification.suggestedWorkflow.triggerPhrase;
          deps.rememberSemanticIntentFeedback(
            deps.pendingClarification.originalPhrase ?? triggerPhrase,
            deps.pendingClarification.suggestedWorkflow.candidateId,
            deps.pendingClarification.suggestedWorkflow.candidateLabel,
            true,
          );
          deps.setPendingClarification(null);
          return runCommand(triggerPhrase, {
            appendUserTurn: false,
            allowChaining: false,
          });
        }

        if (["no", "nope", "nah", "not that", "don't run that", "do not run that"].includes(normalizedReply)) {
          deps.rememberSemanticIntentFeedback(
            deps.pendingClarification.originalPhrase ?? deps.pendingClarification.suggestedWorkflow.triggerPhrase,
            deps.pendingClarification.suggestedWorkflow.candidateId,
            deps.pendingClarification.suggestedWorkflow.candidateLabel,
            false,
          );
          deps.setPendingClarification(null);
          deps.setCommandResult({
            title: "Workflow suggestion dismissed",
            detail: "Okay. I will not run that workflow for this phrase.",
          });
          deps.setStatusMessage("JARVIS skipped that semantic workflow suggestion.");
          deps.appendConversationTurn("jarvis", "Okay. I won't run that workflow.");
          deps.speakIfEnabled("Okay. I won't run that workflow.");
          return { status: "clarification" };
        }
      }

      if (deps.pendingClarification.suggestedLearning) {
        const normalizedReply = J.normalizeControlCommand(trimmedInput);
        if (["yes", "yeah", "yep", "sure", "okay", "ok", "do that"].includes(normalizedReply)) {
          deps.setPendingClarification(null);
          await deps.rememberSuccessfulPhrase(
            deps.pendingClarification.suggestedLearning.originalPhrase,
            deps.pendingClarification.suggestedLearning.intent,
          );
          const completed = await executeIntent(deps.pendingClarification.suggestedLearning.intent);
          if (completed && deps.shouldKeepFollowUpWindowOpen(deps.pendingClarification.suggestedLearning.intent)) {
            deps.openFollowUpWindow("reply");
          }
          return completed ? { status: "completed" } : { status: "failed" };
        }

        if (["no", "nope", "nah", "not that", "don't learn that", "do not learn that"].includes(normalizedReply)) {
          deps.setPendingClarification(null);
          deps.setCommandResult({
            title: "Learning suggestion dismissed",
            detail: "Okay. I will not learn that phrase mapping right now.",
          });
          deps.setStatusMessage("JARVIS skipped that language-learning suggestion.");
          deps.appendConversationTurn("jarvis", "Okay. I won't learn that phrase mapping yet.");
          deps.speakIfEnabled("Okay. I won't learn that phrase mapping yet.");
          return { status: "clarification" };
        }
      }

      if (deps.pendingClarification.choices.length === 0) {
        deps.setCommandResult({
          title: "Still learning the meaning",
          detail: deps.pendingClarification.suggestedLearning
            ? `Say yes to learn that mapping, no to skip it, or teach me with "that means ...".`
            : deps.pendingClarification.prompt,
        });
        deps.appendConversationTurn(
          "jarvis",
          deps.pendingClarification.suggestedLearning
            ? `Say yes, no, or teach me what it means with "that means ...".`
            : J.buildClarificationReply(deps.pendingClarification.prompt),
        );
        deps.speakIfEnabled(
          deps.pendingClarification.suggestedLearning
            ? `Say yes, no, or teach me what it means.`
            : J.buildClarificationReply(deps.pendingClarification.prompt),
        );
        deps.openFollowUpWindow("clarification");
        return { status: "clarification" };
      }

      if (["no", "nope", "nah", "not that", "skip it", "don't do that", "do not do that"].includes(J.normalizeControlCommand(trimmedInput))) {
        if (deps.pendingClarification.suggestedSemanticIntent) {
          deps.rememberSemanticIntentFeedback(
            deps.pendingClarification.originalPhrase ?? deps.pendingClarification.prompt,
            deps.pendingClarification.suggestedSemanticIntent.candidateId,
            deps.pendingClarification.suggestedSemanticIntent.candidateLabel,
            false,
          );
        }
        deps.setPendingClarification(null);
        deps.setCommandResult({
          title: "Clarification skipped",
          detail: `Okay. I will not run that guess. You can teach me with "when I say ${deps.pendingClarification.originalPhrase ?? "that"}, I mean ...".`,
        });
        deps.setStatusMessage("JARVIS skipped the uncertain semantic match.");
        deps.appendConversationTurn("jarvis", "Okay. I won't run that guess.");
        deps.speakIfEnabled("Okay. I won't run that guess.");
        return { status: "clarification" };
      }

      const clarifiedIntent = J.resolveClarificationReply(trimmedInput, deps.pendingClarification);
      if (clarifiedIntent) {
        if (deps.pendingClarification.suggestedSemanticIntent) {
          deps.rememberSemanticIntentFeedback(
            deps.pendingClarification.originalPhrase ?? trimmedInput,
            deps.pendingClarification.suggestedSemanticIntent.candidateId,
            deps.pendingClarification.suggestedSemanticIntent.candidateLabel,
            true,
          );
        }
        deps.setPendingClarification(null);
        const completed = await executeIntent(clarifiedIntent);
        if (completed && deps.pendingClarification.originalPhrase) {
          await deps.rememberSuccessfulPhrase(deps.pendingClarification.originalPhrase, clarifiedIntent);
        }
        if (completed && deps.shouldKeepFollowUpWindowOpen(clarifiedIntent)) {
          deps.openFollowUpWindow("reply");
        }
        return completed ? { status: "completed" } : { status: "failed" };
      }

      deps.setCommandResult({
        title: "Still need clarification",
        detail: deps.pendingClarification.prompt,
      });
      deps.appendConversationTurn("jarvis", J.buildClarificationReply(deps.pendingClarification.prompt));
      deps.speakIfEnabled(J.buildClarificationReply(deps.pendingClarification.prompt));
      deps.openFollowUpWindow("clarification");
      return { status: "clarification" };
    }

    const savedWorkflowInvocation = J.resolveSavedWorkflowInvocation(trimmedInput, deps.savedWorkflows);
    if (savedWorkflowInvocation) {
      const { workflow: savedWorkflow, inputText } = savedWorkflowInvocation;
      deps.setStatusMessage(`Running saved workflow ${savedWorkflow.name}.`);
      for (let index = 0; index < savedWorkflow.steps.length; index += 1) {
        const rawStep = savedWorkflow.steps[index];
        const resolvedStep = J.resolveWorkflowConditionalStep(
          rawStep,
          deps.activeConversationContext,
          deps.recentEmails,
          deps.recentFiles,
          deps.recentNotes,
          deps.plannerTasks,
        );
        if (resolvedStep.action === "skip") {
          continue;
        }
        if (resolvedStep.action === "stop") {
          deps.setCommandResult({
            title: "Workflow stopped by condition",
            detail: `Stopped ${savedWorkflow.name} because one of its conditions chose a stop branch.`,
          });
          deps.appendConversationTurn("jarvis", `Stopped the workflow ${savedWorkflow.name}.`);
          deps.speakIfEnabled(`Stopped the workflow ${savedWorkflow.name}.`);
          return { status: "completed" };
        }
        const renderedStep = J.renderWorkflowStep(
          resolvedStep.step,
          deps.activeConversationContext,
          inputText,
        );
        if (renderedStep.missingPlaceholder) {
          deps.setPendingWorkflowExecution({
            workflowId: savedWorkflow.id,
            workflowName: savedWorkflow.name,
            inputText,
            currentStepIndex: index,
            rawSteps: savedWorkflow.steps,
            missingPlaceholder: renderedStep.missingPlaceholder as PendingWorkflowExecution["missingPlaceholder"],
          });
          deps.setCommandResult({
            title: "Workflow needs more context",
            detail:
              renderedStep.missingPlaceholder === "deps.input"
                ? `The workflow "${savedWorkflow.name}" needs extra text after its trigger phrase.`
                : `The workflow "${savedWorkflow.name}" needs a matching current context for {{${renderedStep.missingPlaceholder}}}.`,
          });
          deps.appendConversationTurn(
            "jarvis",
            renderedStep.missingPlaceholder === "deps.input"
              ? `That workflow needs a little more text after ${savedWorkflow.triggerPhrase}.`
              : `That workflow needs the right current context before I can run it.`,
          );
          deps.speakIfEnabled(
            renderedStep.missingPlaceholder === "deps.input"
              ? `That workflow needs a little more text after ${savedWorkflow.triggerPhrase}.`
              : "That workflow needs the right current context before I can run it.",
          );
          return { status: "clarification" };
        }

        const outcome = await runCommand(renderedStep.step, {
          appendUserTurn: false,
          allowChaining: false,
        });
        if (outcome.status !== "completed") {
          deps.setStatusMessage(`Saved workflow ${savedWorkflow.name} paused before completion.`);
          return outcome;
        }
      }

      deps.setCommandResult({
        title: "Workflow completed",
        detail: `Finished saved workflow "${savedWorkflow.name}".`,
      });
      deps.appendConversationTurn("jarvis", `Finished the workflow ${savedWorkflow.name}.`);
      deps.speakIfEnabled(`Finished the workflow ${savedWorkflow.name}.`);
      return { status: "completed" };
    }

    if (allowChaining) {
      const workflowSteps = J.splitWorkflowCommand(trimmedInput);
      if (workflowSteps) {
        deps.setStatusMessage(`Running a ${workflowSteps.length}-step workflow through JARVIS.`);
        let completedSteps = 0;
        for (const step of workflowSteps) {
          const outcome = await runCommand(step, {
            appendUserTurn: false,
            allowChaining: false,
          });
          if (outcome.status !== "completed") {
            deps.setStatusMessage(
              completedSteps > 0
                ? `Workflow paused after ${completedSteps} step${completedSteps === 1 ? "" : "s"}.`
                : "Workflow paused before completion.",
            );
            return outcome;
          }
          completedSteps += 1;
        }

        deps.setStatusMessage(
          `Workflow complete. Finished ${completedSteps} step${completedSteps === 1 ? "" : "s"}.`,
        );
        deps.rememberWorkflowSequence(workflowSteps, trimmedInput);
        return { status: "completed" };
      }
    }

    const learnedIntent = J.resolveLearnedIntent(trimmedInput, deps.learnedIntentMappings);
    if (learnedIntent) {
      deps.setMissingSkillRequest(null);
      deps.setMissingSkillPlan(null);
      const completed = await executeIntent(learnedIntent);
      if (completed) {
        deps.setTeachingTargetPhrase(null);
        await deps.rememberSuccessfulPhrase(trimmedInput, learnedIntent);
      }
      if (completed && deps.shouldKeepFollowUpWindowOpen(learnedIntent)) {
        deps.openFollowUpWindow("reply");
      }
      return completed ? { status: "completed" } : { status: "failed" };
    }

    const contextualIntent = J.resolveContextualFollowUpIntent(
      trimmedInput,
      deps.activeConversationContext,
    );
    if (contextualIntent) {
      deps.setMissingSkillRequest(null);
      deps.setMissingSkillPlan(null);
      const completed = await executeIntent(contextualIntent);
      if (completed) {
        deps.setTeachingTargetPhrase(null);
        await deps.rememberSuccessfulPhrase(trimmedInput, contextualIntent);
      }
      if (completed && deps.shouldKeepFollowUpWindowOpen(contextualIntent)) {
        deps.openFollowUpWindow("reply");
      }
      return completed ? { status: "completed" } : { status: "failed" };
    }

    const ordinalIntent = J.resolveOrdinalFollowUpIntent(
      trimmedInput,
      deps.presentedCollectionContext,
      deps.recentEmails,
      deps.recentFiles,
      deps.recentNotes,
      deps.plannerTasks,
    );
    if (ordinalIntent) {
      deps.setMissingSkillRequest(null);
      deps.setMissingSkillPlan(null);
      const completed = await executeIntent(ordinalIntent);
      if (completed) {
        deps.setTeachingTargetPhrase(null);
        await deps.rememberSuccessfulPhrase(trimmedInput, ordinalIntent);
      }
      if (completed && deps.shouldKeepFollowUpWindowOpen(ordinalIntent)) {
        deps.openFollowUpWindow("reply");
      }
      return completed ? { status: "completed" } : { status: "failed" };
    }

    const referenceIntent = J.resolveReferenceFollowUpIntent(
      trimmedInput,
      deps.presentedCollectionContext,
      deps.activeConversationContext,
      deps.recentEmails,
      deps.recentFiles,
      deps.recentNotes,
      deps.plannerTasks,
    );
    if (referenceIntent) {
      deps.setMissingSkillRequest(null);
      deps.setMissingSkillPlan(null);
      const completed = await executeIntent(referenceIntent);
      if (completed) {
        deps.setTeachingTargetPhrase(null);
        await deps.rememberSuccessfulPhrase(trimmedInput, referenceIntent);
      }
      if (completed && deps.shouldKeepFollowUpWindowOpen(referenceIntent)) {
        deps.openFollowUpWindow("reply");
      }
      return completed ? { status: "completed" } : { status: "failed" };
    }

    const batchReferenceIntent = J.resolveBatchReferenceFollowUpIntent(
      trimmedInput,
      deps.presentedCollectionContext,
      deps.activeConversationContext,
      deps.recentEmails,
      deps.recentFiles,
      deps.recentNotes,
      deps.plannerTasks,
    );
    if (batchReferenceIntent) {
      deps.setMissingSkillRequest(null);
      deps.setMissingSkillPlan(null);
      const completed = await executeIntent(batchReferenceIntent);
      if (completed) {
        deps.setTeachingTargetPhrase(null);
        await deps.rememberSuccessfulPhrase(trimmedInput, batchReferenceIntent);
      }
      if (completed && deps.shouldKeepFollowUpWindowOpen(batchReferenceIntent)) {
        deps.openFollowUpWindow("reply");
      }
      return completed ? { status: "completed" } : { status: "failed" };
    }

    if (!J.parseConversationalCommandIntent(trimmedInput, deps.browserAliases)) {
      const semanticIntentRanks = await J.rankSemanticIntentCandidates(
        trimmedInput,
        J.buildSemanticIntentCandidates(
          trimmedInput,
          deps.browserAliases,
          deps.learnedIntentMappings,
          deps.savedWorkflows,
          deps.userPreferenceMemory,
          deps.activeConversationContext,
        ),
        naturalQueryEmbedding.embedding,
        deps.buildCachedSemanticIntentEmbedding as unknown as (
          text: string,
        ) => Promise<{ embedding: number[]; backend: J.EmbeddingBackend }>,
        deps.semanticIntentFeedback,
      );
      deps.setLastSemanticIntentMatches(
        semanticIntentRanks.slice(0, 3).map((rank) => ({
          id: rank.candidate.id,
          label: rank.candidate.label,
          source: rank.candidate.source,
          score: rank.score,
          confidence: rank.confidence,
          matchedExample: rank.matchedExample,
        })),
      );
      const semanticIntentRank = semanticIntentRanks[0] ?? null;

      if (semanticIntentRank) {
        const routeLabel = `Semantic foundation -> ${semanticIntentRank.candidate.source}`;
        if (semanticIntentRank.candidate.source === "workflow") {
          const workflow = semanticIntentRank.candidate.workflow;
          if (semanticIntentRank.confidence === "high") {
            deps.rememberSemanticIntentFeedback(
              trimmedInput,
              semanticIntentRank.candidate.id,
              semanticIntentRank.candidate.label,
              true,
            );
            deps.setStatusMessage(`JARVIS matched the workflow ${workflow.name} with semantic memory.`);
            deps.appendConversationTurn(
              "jarvis",
              `That sounds like your ${workflow.name} workflow. I'll run it now.`,
              routeLabel,
            );
            return runCommand(workflow.triggerPhrase, {
              appendUserTurn: false,
              allowChaining: false,
            });
          }

          deps.setTeachingTargetPhrase(trimmedInput);
          deps.setPendingClarification({
            prompt: `This sounds close to your workflow "${workflow.name}". Should I run it?`,
            choices: [],
            originalPhrase: trimmedInput,
            confidence: semanticIntentRank.confidence,
            confidenceScore: semanticIntentRank.score,
            suggestedWorkflow: {
              workflowId: workflow.id,
              workflowName: workflow.name,
              triggerPhrase: workflow.triggerPhrase,
              candidateId: semanticIntentRank.candidate.id,
              candidateLabel: semanticIntentRank.candidate.label,
              confidence: semanticIntentRank.confidence,
              confidenceScore: semanticIntentRank.score,
            },
          });
          deps.setVoiceSessionPhase("ready");
          deps.setStatusMessage("JARVIS found a semantic workflow match and wants to confirm it.");
          deps.setCommandResult({
            title: "Semantic workflow match",
            detail: `I think "${trimmedInput}" means "${workflow.name}" (${Math.round(semanticIntentRank.score * 100)}%). Say yes to run it, no to skip, or teach me a better meaning.`,
            routeLabel,
          });
          deps.appendConversationTurn(
            "jarvis",
            `That sounds close to your workflow ${workflow.name}. Should I run it?`,
            routeLabel,
          );
          deps.speakIfEnabled(`That sounds close to your workflow ${workflow.name}. Should I run it?`);
          deps.openFollowUpWindow("clarification");
          return { status: "clarification" };
        }

        const resolvedIntent = semanticIntentRank.candidate.resolve(trimmedInput);
        if (resolvedIntent) {
          const needsConfirmation = J.requiresSemanticConfirmation(resolvedIntent);
          if (semanticIntentRank.confidence === "high" && !needsConfirmation) {
            deps.setMissingSkillRequest(null);
            deps.setMissingSkillPlan(null);
            deps.currentRouteLabelRef.current = routeLabel;
            const completed = await executeIntent(resolvedIntent);
            if (completed) {
              deps.setTeachingTargetPhrase(null);
              deps.rememberSemanticIntentFeedback(
                trimmedInput,
                semanticIntentRank.candidate.id,
                semanticIntentRank.candidate.label,
                true,
              );
              await deps.rememberSuccessfulPhrase(trimmedInput, resolvedIntent);
              await deps.rememberSemanticConversationTurn(trimmedInput, resolvedIntent);
            }
            if (completed && deps.shouldKeepFollowUpWindowOpen(resolvedIntent)) {
              deps.openFollowUpWindow("reply");
            }
            deps.currentRouteLabelRef.current = undefined;
            return completed ? { status: "completed" } : { status: "failed" };
          }

          deps.setTeachingTargetPhrase(trimmedInput);
          deps.setPendingClarification({
            prompt: needsConfirmation
              ? `This can change data or run a sensitive action. Did you mean ${J.describeCommandIntent(resolvedIntent)}?`
              : `Did you mean ${J.describeCommandIntent(resolvedIntent)}?`,
            choices: [
              {
                label: J.describeCommandIntent(resolvedIntent),
                intent: resolvedIntent,
              },
            ],
            originalPhrase: trimmedInput,
            confidence: semanticIntentRank.confidence,
            confidenceScore: semanticIntentRank.score,
            suggestedSemanticIntent: {
              candidateId: semanticIntentRank.candidate.id,
              candidateLabel: semanticIntentRank.candidate.label,
              confidence: semanticIntentRank.confidence,
              confidenceScore: semanticIntentRank.score,
            },
          });
          deps.setVoiceSessionPhase("ready");
          deps.setStatusMessage("JARVIS found a semantic intent match and wants to confirm it.");
          deps.setCommandResult({
            title: "Semantic intent match",
            detail: `${needsConfirmation ? "Safety check: this action needs confirmation. " : ""}I matched this to "${semanticIntentRank.candidate.label}" from the pretrained foundation (${Math.round(semanticIntentRank.score * 100)}%). Say yes to run it, no to skip, or teach me a better meaning.`,
            routeLabel,
          });
          deps.appendConversationTurn(
            "jarvis",
            `I think you mean ${J.describeCommandIntent(resolvedIntent)}. Should I do that?`,
            routeLabel,
          );
          deps.speakIfEnabled(`I think you mean ${J.describeCommandIntent(resolvedIntent)}. Should I do that?`);
          deps.openFollowUpWindow("clarification");
          return { status: "clarification" };
        }
      }
    }

    const learnedSuggestion = J.findLearnedIntentSuggestion(trimmedInput, deps.learnedIntentMappings);
    if (learnedSuggestion) {
      deps.setTeachingTargetPhrase(trimmedInput);
      const family = J.findLearnedIntentFamilySummary(
        learnedSuggestion.intent,
        deps.learnedIntentMappings,
      );
      const confidence = J.getIntentConfidenceFromScore(learnedSuggestion.score);
      const familyLabel = family?.label ?? J.describeCommandIntent(learnedSuggestion.intent);
      const familyPhraseCount = family?.phraseCount ?? 1;
      deps.setPendingClarification({
        prompt: `This sounds ${J.formatIntentConfidenceLabel(confidence)} close to your learned phrase "${learnedSuggestion.record.phrase}". Should I treat "${trimmedInput}" the same way from now on?`,
        choices: [],
        originalPhrase: trimmedInput,
        confidence,
        confidenceScore: learnedSuggestion.score,
        suggestedLearning: {
          originalPhrase: trimmedInput,
          sourcePhrase: learnedSuggestion.record.phrase,
          intent: learnedSuggestion.intent,
          confidence,
          confidenceScore: learnedSuggestion.score,
          familyLabel,
          familyPhraseCount,
        },
      });
      deps.setVoiceSessionPhase("ready");
      deps.setStatusMessage(
        `JARVIS found a ${J.formatIntentConfidenceLabel(confidence)} learned phrase match and wants to confirm it.`,
      );
      deps.setCommandResult({
        title: "Language learning suggestion",
        detail: `I think "${trimmedInput}" belongs to your "${familyLabel}" phrase family. Match confidence: ${Math.round(learnedSuggestion.score * 100)}%. Say yes to learn and reuse it, or no to skip it.`,
      });
      deps.appendConversationTurn(
        "jarvis",
        `That sounds ${J.formatIntentConfidenceLabel(confidence)} close to your learned phrase "${learnedSuggestion.record.phrase}". Should I treat it the same way from now on?`,
      );
      deps.speakIfEnabled(
        `That sounds ${J.formatIntentConfidenceLabel(confidence)} close to your learned phrase ${learnedSuggestion.record.phrase}. Should I treat it the same way from now on?`,
      );
      deps.openFollowUpWindow("clarification");
      return { status: "clarification" };
    }

    const clarification = J.buildClarificationForCommand(trimmedInput, deps.browserAliases);
    if (clarification) {
      deps.setTeachingTargetPhrase(trimmedInput);
      deps.setPendingClarification({
        ...clarification,
        originalPhrase: trimmedInput,
      });
      deps.setVoiceSessionPhase("ready");
      deps.setStatusMessage(
        clarification.confidence
          ? `JARVIS needs a quick clarification because this is a ${J.formatIntentConfidenceLabel(clarification.confidence)} guess.`
          : "JARVIS needs a quick clarification.",
      );
      deps.setCommandResult({
        title: "Need clarification",
        detail: clarification.confidence
          ? `${clarification.prompt} Confidence: ${Math.round((clarification.confidenceScore ?? 0) * 100)}%.`
          : clarification.prompt,
      });
      deps.appendConversationTurn("jarvis", J.buildClarificationReply(clarification.prompt));
      deps.speakIfEnabled(J.buildClarificationReply(clarification.prompt));
      deps.openFollowUpWindow("clarification");
      return { status: "clarification" };
    }

    let intent: CommandIntent | null = null;
    let routeFallbackNote: string | null = null;
    let routeLabel = deps.conversationBackend === "auto" ? "Auto" : deps.conversationBackend === "ollama" ? "Ollama" : "Heuristics";

    const tryOllamaInterpretation = async () => {
      try {
        const interpretation = await interpretConversationWithOllama(
          trimmedInput,
          deps.assistantName,
        );
        const mappedResult = J.mapOllamaInterpretationToResult(interpretation);

        if (mappedResult.kind === "clarification") {
          routeLabel = deps.conversationBackend === "auto" ? "Auto -> Ollama" : "Ollama";
          deps.setPendingClarification({
            prompt: mappedResult.prompt,
            choices: [],
            originalPhrase: trimmedInput,
          });
          deps.setVoiceSessionPhase("ready");
          deps.setStatusMessage("Ollama asked for a quick clarification.");
          deps.setCommandResult({
            title: "Need clarification",
            detail: mappedResult.prompt,
            routeLabel,
          });
          deps.appendConversationTurn("jarvis", J.buildClarificationReply(mappedResult.prompt), routeLabel);
          deps.speakIfEnabled(J.buildClarificationReply(mappedResult.prompt));
          deps.openFollowUpWindow("clarification");
          return { resolved: true as const, outcome: { status: "clarification" as const } };
        }

        if (mappedResult.kind === "intent") {
          if (
            mappedResult.intent.kind === "google_search" &&
            !J.hasExplicitSearchLanguage(trimmedInput)
          ) {
            intent = null;
          } else if (
            mappedResult.intent.kind === "open_url" &&
            !J.hasExplicitOpenLanguage(trimmedInput)
          ) {
            intent = null;
          } else {
            intent = mappedResult.intent;
            routeLabel = deps.conversationBackend === "auto" ? "Auto -> Ollama" : "Ollama";
          }
        }
      } catch (error) {
        routeFallbackNote = J.getErrorDetail(
          error,
          "Ollama could not interpret that request, so JARVIS fell back to heuristics.",
        );
        deps.setStatusMessage(routeFallbackNote);
      }

      return { resolved: false as const };
    };

    if (deps.conversationBackend === "ollama") {
      const result = await tryOllamaInterpretation();
      if (result.resolved) {
        return result.outcome;
      }
    } else if (deps.conversationBackend === "auto") {
      if (J.shouldUseOllamaFirstInAutoMode(trimmedInput)) {
        const result = await tryOllamaInterpretation();
        if (result.resolved) {
          return result.outcome;
        }
        if (!intent) {
          intent = J.parseConversationalCommandIntent(trimmedInput, deps.browserAliases);
          if (intent) {
            routeLabel = "Auto -> Heuristics";
          }
        }
      } else {
        intent = J.parseConversationalCommandIntent(trimmedInput, deps.browserAliases);
        if (intent) {
          routeLabel = "Auto -> Heuristics";
        }
        if (!intent) {
          const result = await tryOllamaInterpretation();
          if (result.resolved) {
            return result.outcome;
          }
        }
      }
    }

    if (!intent) {
      intent = J.parseConversationalCommandIntent(trimmedInput, deps.browserAliases);
      if (intent && deps.conversationBackend === "heuristics") {
        routeLabel = "Heuristics";
      }
    }

    if (!intent) {
      deps.setTeachingTargetPhrase(trimmedInput);
      deps.setMissingSkillRequest(trimmedInput);
      deps.setMissingSkillPlan(null);
      deps.setVoiceSessionPhase("ready");
      deps.setCommandResult({
        title: "Conversation understood, skill missing",
        detail:
          `I understood that as a request, but I do not have the right skill wired yet. You can also teach me directly by saying "when I say ${trimmedInput}, I mean ...".`,
        routeLabel,
      });
      if (routeFallbackNote) {
        deps.setCommandResult((current) =>
          current
            ? { ...current, detail: `${current.detail} ${routeFallbackNote}` }
            : current,
        );
      }
      deps.appendConversationTurn("jarvis", J.buildMissingSkillReply(), routeLabel);
      deps.speakIfEnabled("I get what you're asking, but that skill is not wired yet.");
      deps.openFollowUpWindow("reply");

      if (
        deps.skillAutopilotAvailable &&
        deps.autonomousSkillBuildingEnabled &&
        (deps.conversationBackend === "ollama" || deps.conversationBackend === "auto")
      ) {
        void deps.handleAskAdvancedAssistant(trimmedInput);
      }
      return { status: "missing_skill" };
    }

    deps.setMissingSkillRequest(null);
    deps.setMissingSkillPlan(null);
    deps.currentRouteLabelRef.current = routeLabel;
    const completed = await executeIntent(intent);
    if (routeFallbackNote) {
      const fallbackNote = routeFallbackNote;
      deps.setCommandResult((current) =>
        current
          ? { ...current, detail: `${current.detail} ${fallbackNote}`, routeLabel }
          : { title: "Routing fallback", detail: fallbackNote, routeLabel },
      );
      deps.setStatusMessage(fallbackNote);
    } else {
      deps.setCommandResult((current) => (current ? { ...current, routeLabel } : current));
    }
    if (completed) {
      deps.setTeachingTargetPhrase(null);
      await deps.rememberSuccessfulPhrase(trimmedInput, intent);
      await deps.rememberSemanticConversationTurn(trimmedInput, intent);
    }
    if (completed && deps.shouldKeepFollowUpWindowOpen(intent)) {
      deps.openFollowUpWindow("reply");
    }
    deps.currentRouteLabelRef.current = undefined;
    return completed ? { status: "completed" } : { status: "failed" };
  }

  return {
    routeCommand,
    routeCommandFromVoice,
    executeIntent,
    runCommand,
  };
}
