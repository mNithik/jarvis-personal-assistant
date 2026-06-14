import { ReactNode } from "react";

export type JarvisSurface = "home" | "workspace" | "cockpit";

export type JarvisWorkspaceId =
  | "command"
  | "vision"
  | "memory"
  | "automation"
  | "workspaces"
  | "connections"
  | "models"
  | "builder";

export type QuickBarPlacement = "bottom" | "top" | "free";

export type FloatingPanelId =
  | "ocr"
  | "voice"
  | "workspaces"
  | "memory"
  | "integrations"
  | "automation"
  | "builder";

export type QuickBarState = {
  visible: boolean;
  placement: QuickBarPlacement;
  position: { x: number; y: number };
};

export type JarvisUiState = {
  activeSurface: JarvisSurface;
  activeWorkspaceId: JarvisWorkspaceId;
  isCockpitOpen: boolean;
  quickBar: QuickBarState;
  openFloatingPanels: FloatingPanelId[];
  selectedDataSphereNode: JarvisWorkspaceId | null;
  systemDrawerOpen: boolean;
};

export type JarvisQuickActionId =
  | "listen"
  | "open_cockpit"
  | "open_system_drawer"
  | "create_daily_brief"
  | "read_screen"
  | "select_ocr_area"
  | "open_ocr_panel"
  | "list_birthdays"
  | "open_memory_panel"
  | "show_ocr_watches"
  | "list_desktop_schedules"
  | "open_automation_panel"
  | "open_coding_workspace"
  | "list_desktop_projects"
  | "open_workspaces_panel"
  | "show_unread_emails"
  | "spotify_status"
  | "open_integrations_panel"
  | "open_models_workspace"
  | "run_project_checks"
  | "open_project_in_vscode"
  | "open_builder_panel";

export type WorkspaceRegistryEntry = {
  id: JarvisWorkspaceId;
  title: string;
  summary: string;
  icon: string;
  accent: string;
  showOnHome: boolean;
  quickActions: JarvisQuickActionId[];
  ownedFeatureBlocks: string[];
  relatedFloatingInspectors: FloatingPanelId[];
  advancedSettingsOwned: boolean;
};

export type WorkspaceRenderProps = {
  title: string;
  summary: string;
  sections: ReactNode[];
};
