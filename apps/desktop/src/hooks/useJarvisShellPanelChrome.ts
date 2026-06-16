import type { Dispatch } from "react";
import { jarvisModules } from "../ui/shell/jarvisModules";
import { defaultJarvisUiState } from "../ui/model/uiReducer";
import type { JarvisUiAction } from "../ui/model/uiReducer";
import type {
  JarvisPanelId,
  JarvisPanelRecord,
  PanelDragState,
  ShellBarDragState,
  ShellBarPlacement,
} from "../features/command/jarvisCommandTypes";

export type JarvisShellPanelChromeParams = {
  dispatchUi: Dispatch<JarvisUiAction>;
  setJarvisPanels: React.Dispatch<React.SetStateAction<JarvisPanelRecord[]>>;
  panelDragState: PanelDragState;
  shellBarDragState: ShellBarDragState;
  setShellBarDragState: React.Dispatch<React.SetStateAction<ShellBarDragState>>;
  setStatusMessage: React.Dispatch<React.SetStateAction<string>>;
};

export function useJarvisShellPanelChrome({
  dispatchUi,
  setJarvisPanels,
  panelDragState,
  shellBarDragState,
  setShellBarDragState,
  setStatusMessage,
}: JarvisShellPanelChromeParams) {
  function openJarvisPanel(panel: JarvisPanelId) {
    dispatchUi({ type: "openFloatingPanel", panelId: panel });
    setJarvisPanels((current) => {
      const existing = current.find((item) => item.id === panel);
      if (existing) {
        return [
          ...current.filter((item) => item.id !== panel),
          { ...existing, minimized: false },
        ];
      }
      const index = jarvisModules.findIndex((module) => module.id === panel);
      const offset = Math.max(index, 0) * 26;
      return [
        ...current,
        {
          id: panel,
          x: 28 + offset,
          y: 88 + offset,
          minimized: false,
        },
      ];
    });
  }

  function closeJarvisPanel(panel?: JarvisPanelId) {
    if (panel) {
      dispatchUi({ type: "closeFloatingPanel", panelId: panel });
    }
    setJarvisPanels((current) =>
      panel ? current.filter((item) => item.id !== panel) : [],
    );
  }

  function minimizeJarvisPanel(panel?: JarvisPanelId) {
    setJarvisPanels((current) =>
      current.map((item) =>
        !panel || item.id === panel ? { ...item, minimized: true } : item,
      ),
    );
  }

  function toggleJarvisPanel(panel: JarvisPanelId) {
    setJarvisPanels((current) =>
      current.map((item) =>
        item.id === panel ? { ...item, minimized: !item.minimized } : item,
      ),
    );
  }

  function moveJarvisPanel(clientX: number, clientY: number) {
    if (!panelDragState) {
      return;
    }
    const nextX = Math.max(8, Math.min(clientX - panelDragState.offsetX, window.innerWidth - 340));
    const nextY = Math.max(8, Math.min(clientY - panelDragState.offsetY, window.innerHeight - 160));
    setJarvisPanels((current) =>
      current.map((panel) =>
        panel.id === panelDragState.id ? { ...panel, x: nextX, y: nextY } : panel,
      ),
    );
  }

  function moveShellBar(clientX: number, clientY: number) {
    if (!shellBarDragState) {
      return;
    }
    const nextX = Math.max(8, Math.min(clientX - shellBarDragState.offsetX, window.innerWidth - 320));
    const nextY = Math.max(8, Math.min(clientY - shellBarDragState.offsetY, window.innerHeight - 86));
    dispatchUi({ type: "setQuickBarPlacement", placement: "free" });
    dispatchUi({ type: "setQuickBarPosition", position: { x: nextX, y: nextY } });
  }

  function pinShellBar(placement: Exclude<ShellBarPlacement, "free">) {
    dispatchUi({ type: "setQuickBarPlacement", placement });
    setShellBarDragState(null);
  }

  function resetJarvisUiPreferences() {
    dispatchUi({ type: "setQuickBarVisibility", visible: defaultJarvisUiState.quickBar.visible });
    dispatchUi({ type: "setQuickBarPlacement", placement: defaultJarvisUiState.quickBar.placement });
    dispatchUi({ type: "setQuickBarPosition", position: defaultJarvisUiState.quickBar.position });
    dispatchUi({ type: "closeCockpit" });
    dispatchUi({ type: "setWorkspace", workspaceId: defaultJarvisUiState.activeWorkspaceId });
    dispatchUi({ type: "setSurface", surface: defaultJarvisUiState.activeSurface });
    dispatchUi({ type: "setSelectedDataSphereNode", workspaceId: null });
    dispatchUi({ type: "setSystemDrawerOpen", open: false });
    setStatusMessage("JARVIS UI layout reset.");
  }
  return {
    openJarvisPanel,
    closeJarvisPanel,
    minimizeJarvisPanel,
    toggleJarvisPanel,
    moveJarvisPanel,
    moveShellBar,
    pinShellBar,
    resetJarvisUiPreferences,
  };
}
