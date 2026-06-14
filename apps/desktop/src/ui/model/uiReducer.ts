import {
  FloatingPanelId,
  JarvisUiState,
  JarvisWorkspaceId,
  QuickBarPlacement,
} from "./jarvisTypes";

export type JarvisUiAction =
  | { type: "setSurface"; surface: JarvisUiState["activeSurface"] }
  | { type: "setWorkspace"; workspaceId: JarvisWorkspaceId }
  | { type: "openCockpit" }
  | { type: "closeCockpit" }
  | { type: "setQuickBarVisibility"; visible: boolean }
  | { type: "setQuickBarPlacement"; placement: QuickBarPlacement }
  | { type: "setQuickBarPosition"; position: { x: number; y: number } }
  | { type: "openFloatingPanel"; panelId: FloatingPanelId }
  | { type: "closeFloatingPanel"; panelId: FloatingPanelId }
  | { type: "toggleFloatingPanel"; panelId: FloatingPanelId }
  | { type: "setSelectedDataSphereNode"; workspaceId: JarvisWorkspaceId | null }
  | { type: "setSystemDrawerOpen"; open: boolean };

export const defaultJarvisUiState: JarvisUiState = {
  activeSurface: "home",
  activeWorkspaceId: "command",
  isCockpitOpen: false,
  quickBar: {
    visible: true,
    placement: "bottom",
    position: { x: 0, y: 0 },
  },
  openFloatingPanels: [],
  selectedDataSphereNode: null,
  systemDrawerOpen: false,
};

export function jarvisUiReducer(state: JarvisUiState, action: JarvisUiAction): JarvisUiState {
  switch (action.type) {
    case "setSurface":
      return { ...state, activeSurface: action.surface };
    case "setWorkspace":
      return {
        ...state,
        activeSurface: "workspace",
        activeWorkspaceId: action.workspaceId,
        selectedDataSphereNode: action.workspaceId,
      };
    case "openCockpit":
      return { ...state, isCockpitOpen: true };
    case "closeCockpit":
      return { ...state, isCockpitOpen: false };
    case "setQuickBarVisibility":
      return { ...state, quickBar: { ...state.quickBar, visible: action.visible } };
    case "setQuickBarPlacement":
      return { ...state, quickBar: { ...state.quickBar, placement: action.placement } };
    case "setQuickBarPosition":
      return { ...state, quickBar: { ...state.quickBar, position: action.position } };
    case "openFloatingPanel":
      return state.openFloatingPanels.includes(action.panelId)
        ? state
        : { ...state, openFloatingPanels: [...state.openFloatingPanels, action.panelId] };
    case "closeFloatingPanel":
      return {
        ...state,
        openFloatingPanels: state.openFloatingPanels.filter((panelId) => panelId !== action.panelId),
      };
    case "toggleFloatingPanel":
      return state.openFloatingPanels.includes(action.panelId)
        ? {
            ...state,
            openFloatingPanels: state.openFloatingPanels.filter((panelId) => panelId !== action.panelId),
          }
        : { ...state, openFloatingPanels: [...state.openFloatingPanels, action.panelId] };
    case "setSelectedDataSphereNode":
      return { ...state, selectedDataSphereNode: action.workspaceId };
    case "setSystemDrawerOpen":
      return { ...state, systemDrawerOpen: action.open };
    default:
      return state;
  }
}
