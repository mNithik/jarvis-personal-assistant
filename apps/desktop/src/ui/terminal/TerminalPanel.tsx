import type { BuildHandoffArtifact } from "../../types/jarvis";
import type { ExecutorStatus } from "../../types/voice";
import { isCliAvailable } from "./cliPresets";
import { TerminalTabView } from "./TerminalTabView";
import { useJarvisTerminal, type PendingHandoffLaunch } from "./useJarvisTerminal";

type TerminalPanelProps = {
  executorStatus: ExecutorStatus | null;
  handoffArtifact: BuildHandoffArtifact | null;
  pendingHandoffLaunch: PendingHandoffLaunch;
  onPendingHandoffLaunchHandled: () => void;
  onLaunchExternalExecutor?: () => void | Promise<void>;
};

export function TerminalPanel({
  executorStatus,
  handoffArtifact,
  pendingHandoffLaunch,
  onPendingHandoffLaunchHandled,
  onLaunchExternalExecutor,
}: TerminalPanelProps) {
  const terminal = useJarvisTerminal({
    executorStatus,
    handoffArtifact,
    pendingHandoffLaunch,
    onPendingHandoffLaunchHandled,
  });

  const activePreset = terminal.presets.find((preset) => preset.id === terminal.activeTabId);

  return (
    <div className="result-card builder-terminal-section">
      <div className="terminal-panel-header">
        <div>
          <p className="section-kicker">Embedded Terminal</p>
          <h3>Local coding CLIs</h3>
          <p className="result-meta terminal-trust-note">
            Uses your local CLI login. Commands run with your user privileges—not JARVIS API keys.
          </p>
        </div>
        <div className="workflow-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={terminal.restartActiveTab}
          >
            Restart tab
          </button>
        </div>
      </div>

      {!terminal.workingDirectory ? (
        <p className="terminal-banner terminal-banner-warning">
          Set executor working directory in the system drawer to start in your project folder.
        </p>
      ) : (
        <p className="terminal-banner">
          Working directory: <code>{terminal.workingDirectory}</code>
        </p>
      )}

      <div className="terminal-tab-bar" role="tablist" aria-label="Terminal tabs">
        {terminal.presets.map((preset) => {
          const tabState = terminal.tabStates[preset.id];
          const available = isCliAvailable(preset, terminal.cliStatus);
          const isActive = terminal.activeTabId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`terminal-tab${isActive ? " terminal-tab-active" : ""}${
                !available ? " terminal-tab-disabled" : ""
              }`}
              onClick={() => terminal.selectTab(preset.id)}
            >
              {preset.label}
              {!available ? " (missing)" : null}
              {tabState.status === "running" ? " •" : null}
              {tabState.status === "exited" ? " (exited)" : null}
              {tabState.status === "error" ? " (error)" : null}
            </button>
          );
        })}
      </div>

      {activePreset && !isCliAvailable(activePreset, terminal.cliStatus) ? (
        <p className="terminal-banner terminal-banner-warning">
          {activePreset.label} CLI was not found on PATH. Install it locally, then restart this tab.
        </p>
      ) : null}

      {terminal.tabStates[terminal.activeTabId].detail ? (
        <p className="terminal-banner terminal-banner-warning">
          {terminal.tabStates[terminal.activeTabId].detail}
        </p>
      ) : null}

      <div className="terminal-panel-body">
        {terminal.presets.map((preset) => {
          const tabState = terminal.tabStates[preset.id];
          const available = isCliAvailable(preset, terminal.cliStatus);
          return (
            <TerminalTabView
              key={`${preset.id}-${terminal.restartNonce}-${tabState.touched ? "live" : "idle"}`}
              isActive={terminal.activeTabId === preset.id && tabState.touched && available}
              preset={preset}
              workingDirectory={terminal.workingDirectory}
              startupSequence={
                terminal.activeTabId === preset.id ? terminal.startupSequence : null
              }
              onStatusChange={(status, detail) => terminal.updateTabStatus(preset.id, status, detail)}
              onStartupComplete={terminal.handleStartupComplete}
            />
          );
        })}
      </div>

      {handoffArtifact ? (
        <div className="terminal-handoff-actions">
          <p className="result-meta">Handoff package ready</p>
          <div className="workflow-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => void terminal.launchHandoffInTab("claude")}
            >
              Run in Claude tab
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void terminal.launchHandoffInTab("codex")}
            >
              Run in Codex tab
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void terminal.launchHandoffInTab("shell")}
            >
              Open in Shell
            </button>
            {onLaunchExternalExecutor ? (
              <button
                className="secondary-button"
                type="button"
                onClick={() => void onLaunchExternalExecutor()}
              >
                Launch external script
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
