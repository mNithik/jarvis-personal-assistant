import { ReactNode } from "react";
import { JarvisUiState, JarvisWorkspaceId } from "../model/jarvisTypes";
import WorkspaceSurface from "./WorkspaceSurface";

type JarvisShellProps = {
  uiState: JarvisUiState;
  activeProfileName: string | null;
  quickBar: ReactNode;
  cockpitOverlay: ReactNode;
  floatingPanels: ReactNode;
  systemDrawer: ReactNode;
  homeSurface: ReactNode;
  workspaceRenderers: Record<JarvisWorkspaceId, ReactNode>;
  onBackHome: () => void;
};

export default function JarvisShell({
  uiState,
  activeProfileName,
  quickBar,
  cockpitOverlay,
  floatingPanels,
  systemDrawer,
  homeSurface,
  workspaceRenderers,
  onBackHome,
}: JarvisShellProps) {
  return (
    <>
      {quickBar}
      {cockpitOverlay}
      {floatingPanels}
      {systemDrawer}
      <div className="shell-status-strip">
        <span>Active: {activeProfileName ?? "Default gateway.json"}</span>
      </div>
      {uiState.activeSurface === "home" ? homeSurface : null}
      {uiState.activeSurface === "workspace" ? (
        <section className="workspace-surface">
          <div className="workspace-surface-topbar">
            <button className="secondary-button" type="button" onClick={onBackHome}>
              Back to Home
            </button>
          </div>
          <WorkspaceSurface
            activeWorkspaceId={uiState.activeWorkspaceId}
            renderers={workspaceRenderers}
          />
        </section>
      ) : null}
    </>
  );
}
