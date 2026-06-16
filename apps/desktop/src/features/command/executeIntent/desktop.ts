import { getCurrentWindow } from "@tauri-apps/api/window";
import * as J from "../../legacy/appHelpers";
import type { DesktopPermissionSettings, DesktopScheduleRecord } from "../jarvisCommandTypes";
import type { ResolvedCommandRouterDeps } from "../commandRouterTypes";
import {
  captureDesktopScreenshot,
  controlDesktopAppWindow,
  createNotionNote,
  focusDesktopApp,
  getDesktopAppWindowStatus,
  launchDesktopApp,
  openBrowserUrl,
  openLocalFile,
  openNamedFolder,
  openScreenshotsFolder,
  runJarvisProjectChecks,
  launchStudySetup,
  searchGoogle,
} from "../../../services/jarvisApi";
import type { ExecuteIntentFn, ExecuteIntentResult } from "./types";

export async function handleDesktopIntent(
  deps: ResolvedCommandRouterDeps,
  intent: import("../jarvisCommandTypes").CommandIntent,
  executeIntent: ExecuteIntentFn,
): Promise<ExecuteIntentResult> {
  if (intent.kind === "open_screenshots_folder") {
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
    return { status: "handled" };
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
    return { status: "handled" };
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
    return { status: "handled" };
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
    return { status: "handled" };
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
    return { status: "handled" };
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
    return { status: "handled" };
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
    return { status: "handled" };
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
    return { status: "handled" };
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
    return { status: "handled" };
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
    return { status: "handled" };
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
    return { status: "handled" };
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
    return { status: "handled" };
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
    return { status: "handled" };
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
    return { status: "handled" };
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
    return { status: "handled" };
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
    return { status: "handled" };
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
    return { status: "handled" };
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
    return { status: "handled" };
  } else if (intent.kind === "run_project_checks" &&         deps.desktopPermissionSettings.confirmProjectChecks &&         !intent.confirmed) {
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
    return { status: "handled" };
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
    return { status: "handled" };
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
    return { status: "handled" };
  } else if (intent.kind === "control_desktop_app_window" &&         intent.action === "close" &&         deps.desktopPermissionSettings.confirmAppClose &&         !intent.confirmed) {
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
    return { status: "handled" };
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
    return { status: "handled" };
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
    return { status: "handled" };
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
    return { status: "handled" };
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
    return { status: "handled" };
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
    return { status: "handled" };
  }
  return { status: "unhandled" };
}
