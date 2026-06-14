import type { Dispatch } from "react";
import {
  JarvisQuickActionId,
  JarvisWorkspaceId,
  FloatingPanelId,
} from "./jarvisTypes";
import { JarvisUiAction } from "./uiReducer";

export type UiActionHandlers = {
  dispatch: Dispatch<JarvisUiAction>;
  runCommand: (command: string) => Promise<void> | void;
  handleVoiceStart: () => void;
};

const panelWorkspaceMap: Record<FloatingPanelId, JarvisWorkspaceId> = {
  ocr: "vision",
  voice: "command",
  workspaces: "workspaces",
  memory: "memory",
  integrations: "connections",
  automation: "automation",
  builder: "builder",
};

function openPanel(
  handlers: UiActionHandlers,
  panelId: FloatingPanelId,
) {
  handlers.dispatch({ type: "setWorkspace", workspaceId: panelWorkspaceMap[panelId] });
  handlers.dispatch({ type: "openFloatingPanel", panelId });
}

export async function executeUiQuickAction(
  actionId: JarvisQuickActionId,
  handlers: UiActionHandlers,
) {
  switch (actionId) {
    case "listen":
      handlers.handleVoiceStart();
      return;
    case "open_cockpit":
      handlers.dispatch({ type: "openCockpit" });
      return;
    case "open_system_drawer":
      handlers.dispatch({ type: "setSystemDrawerOpen", open: true });
      return;
    case "create_daily_brief":
      return handlers.runCommand("Create daily brief");
    case "read_screen":
      return handlers.runCommand("Read my screen");
    case "select_ocr_area":
      return handlers.runCommand("Select OCR area");
    case "open_ocr_panel":
      openPanel(handlers, "ocr");
      return;
    case "list_birthdays":
      return handlers.runCommand("List birthdays");
    case "open_memory_panel":
      openPanel(handlers, "memory");
      return;
    case "show_ocr_watches":
      return handlers.runCommand("Show OCR watches");
    case "list_desktop_schedules":
      return handlers.runCommand("List desktop schedules");
    case "open_automation_panel":
      openPanel(handlers, "automation");
      return;
    case "open_coding_workspace":
      return handlers.runCommand("Open coding workspace");
    case "list_desktop_projects":
      return handlers.runCommand("List desktop projects");
    case "open_workspaces_panel":
      openPanel(handlers, "workspaces");
      return;
    case "show_unread_emails":
      return handlers.runCommand("Show unread emails");
    case "spotify_status":
      return handlers.runCommand("What's playing on Spotify");
    case "open_integrations_panel":
      openPanel(handlers, "integrations");
      return;
    case "open_models_workspace":
      handlers.dispatch({ type: "setWorkspace", workspaceId: "models" });
      handlers.dispatch({ type: "setSurface", surface: "workspace" });
      return;
    case "run_project_checks":
      return handlers.runCommand("Run project checks");
    case "open_project_in_vscode":
      return handlers.runCommand("Open project in VS Code");
    case "open_builder_panel":
      openPanel(handlers, "builder");
      return;
    default:
      return;
  }
}
