import { JarvisUiState } from "./jarvisTypes";
import { defaultJarvisUiState } from "./uiReducer";

export const JARVIS_UI_PREFERENCES_STORAGE_KEY = "jarvis_ui_preferences_v2";

export function loadJarvisUiState(): JarvisUiState {
  try {
    const raw = window.localStorage.getItem(JARVIS_UI_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return defaultJarvisUiState;
    }
    const parsed = JSON.parse(raw) as Partial<JarvisUiState>;
    return {
      ...defaultJarvisUiState,
      ...parsed,
      quickBar: {
        ...defaultJarvisUiState.quickBar,
        ...(parsed.quickBar ?? {}),
      },
      openFloatingPanels: Array.isArray(parsed.openFloatingPanels)
        ? parsed.openFloatingPanels
        : defaultJarvisUiState.openFloatingPanels,
    };
  } catch {
    return defaultJarvisUiState;
  }
}

export function persistJarvisUiState(state: JarvisUiState) {
  const payload: JarvisUiState = {
    activeSurface: state.activeSurface,
    activeWorkspaceId: state.activeWorkspaceId,
    isCockpitOpen: state.isCockpitOpen,
    quickBar: state.quickBar,
    openFloatingPanels: state.openFloatingPanels,
    selectedDataSphereNode: state.selectedDataSphereNode,
    systemDrawerOpen: state.systemDrawerOpen,
  };
  window.localStorage.setItem(JARVIS_UI_PREFERENCES_STORAGE_KEY, JSON.stringify(payload));
}
