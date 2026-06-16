import type { DesktopProjectRecord } from "../jarvisCommandTypes";
import type { ResolvedCommandRouterDeps } from "../commandRouterTypes";
import { readClipboardText, writeClipboardText } from "../../../services/jarvisApi";
import type { ExecuteIntentFn, ExecuteIntentResult } from "./types";

export async function handleClipboardIntent(
  deps: ResolvedCommandRouterDeps,
  intent: import("../jarvisCommandTypes").CommandIntent,
  _executeIntent: ExecuteIntentFn,
): Promise<ExecuteIntentResult> {
  if (intent.kind === "export_ocr_history_to_clipboard") {
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
    return { status: "handled" };
  }
  if (intent.kind === "export_desktop_projects_to_clipboard") {
    await writeClipboardText(JSON.stringify(deps.desktopProjects, null, 2));
    deps.setCommandResult({
      title: "Workspaces exported",
      detail: `Copied ${deps.desktopProjects.length} workspace${deps.desktopProjects.length === 1 ? "" : "s"} to the clipboard as JSON.`,
    });
    deps.setStatusMessage("Desktop workspaces exported to clipboard.");
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn("jarvis", "I copied your workspace export to the clipboard.");
    deps.speakIfEnabled("I copied your workspace export to the clipboard.");
    return { status: "handled" };
  }
  if (intent.kind === "import_desktop_projects_from_clipboard") {
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
    deps.appendConversationTurn(
      "jarvis",
      `I imported ${sanitized.length} workspace${sanitized.length === 1 ? "" : "s"}.`,
    );
    deps.speakIfEnabled(
      `I imported ${sanitized.length} workspace${sanitized.length === 1 ? "" : "s"}.`,
    );
    return { status: "handled" };
  }
  return { status: "unhandled" };
}
