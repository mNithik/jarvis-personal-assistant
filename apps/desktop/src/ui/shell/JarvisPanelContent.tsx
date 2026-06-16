import { formatVoiceReplyModeLabel } from "../../features/semantic/intentRanking";
import type { JarvisPanelContentProps } from "./jarvisAppRootTypes";

export default function JarvisPanelContent({
  panel,
  assistantName,
  activeOcrWatches,
  ocrHistory,
  ocrWatchTemplates,
  lastOcrText,
  voiceSessionPhase,
  voiceBackend,
  learnedIntentMappings,
  wakeModeEnabled,
  voiceResponseEnabled,
  voiceReplyMode,
  desktopProjects,
  desktopSchedules,
  activeConversationContext,
  displayPeopleMemory,
  displayTravelMemory,
  displayExpenseMemory,
  displayPackageMemory,
  displayMeetingPrepMemory,
  displaySchoolPlanMemory,
  memoryTotal,
  googleCalendarAccessToken,
  gmailAccessToken,
  notionStatus,
  spotifyAccessToken,
  connectedIntegrations,
  ocrWatchTargets,
  savedWorkflows,
  crossFeatureSuggestions,
  executorStatus,
  autonomousBuildStatus,
  handoffArtifact,
  executeIntent,
  handleVoiceStart,
  handleWakeActivation,
}: JarvisPanelContentProps) {
  if (panel === "ocr") {
    return (
      <>
        <div className="shell-stat-grid">
          <span><strong>{activeOcrWatches.length}</strong> active watches</span>
          <span><strong>{ocrHistory.length}</strong> reads saved</span>
          <span><strong>{ocrWatchTemplates.length}</strong> templates</span>
        </div>
        <p className="shell-panel-copy">
          Latest: {lastOcrText ? `${lastOcrText.replace(/\s+/g, " ").slice(0, 120)}${lastOcrText.length > 120 ? "..." : ""}` : "No screen text captured yet."}
        </p>
        <div className="shell-panel-actions-row">
          <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "read_screen_text" })}>Read screen</button>
          <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "summarize_screen", mode: "brief" })}>Summarize</button>
          <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "begin_ocr_region_selection" })}>Select area</button>
        </div>
      </>
    );
  }
  if (panel === "voice") {
    return (
      <>
        <div className="shell-stat-grid">
          <span><strong>{voiceSessionPhase}</strong> state</span>
          <span><strong>{voiceBackend}</strong> voice</span>
          <span><strong>{learnedIntentMappings.length}</strong> phrases</span>
        </div>
        <p className="shell-panel-copy">
          Wake mode is {wakeModeEnabled ? "enabled" : "off"}. Replies are {voiceResponseEnabled ? formatVoiceReplyModeLabel(voiceReplyMode) : "off"}.
        </p>
        <div className="shell-panel-actions-row">
          <button className="secondary-button" type="button" onClick={handleVoiceStart}>Listen</button>
          <button className="secondary-button" type="button" onClick={handleWakeActivation}>Wake {assistantName}</button>
        </div>
      </>
    );
  }
  if (panel === "workspaces") {
    return (
      <>
        <div className="shell-stat-grid">
          <span><strong>{desktopProjects.length}</strong> workspaces</span>
          <span><strong>{desktopSchedules.length}</strong> schedules</span>
          <span><strong>{activeConversationContext?.label ?? "none"}</strong> last target</span>
        </div>
        <div className="shell-mini-list">
          {desktopProjects.slice(0, 4).map((project) => (
            <button className="shell-mini-item" type="button" key={project.id} onClick={() => void executeIntent({ kind: "open_desktop_project", query: project.name })}>
              {project.name}
            </button>
          ))}
          {desktopProjects.length === 0 ? <span className="shell-panel-copy">No workspace templates yet.</span> : null}
        </div>
      </>
    );
  }
  if (panel === "memory") {
    return (
      <>
        <div className="shell-stat-grid">
          <span><strong>{displayPeopleMemory.length}</strong> people</span>
          <span><strong>{displayTravelMemory.length}</strong> trips</span>
          <span><strong>{displayExpenseMemory.length}</strong> expenses</span>
          <span><strong>{displayPackageMemory.length}</strong> packages</span>
          <span><strong>{displayMeetingPrepMemory.length}</strong> meetings</span>
          <span><strong>{displaySchoolPlanMemory.length}</strong> school plans</span>
        </div>
        <p className="shell-panel-copy">Total memory cards: {memoryTotal}. This is the personal-context layer JARVIS uses for briefs and cross-feature workflows.</p>
      </>
    );
  }
  if (panel === "integrations") {
    return (
      <>
        <div className="shell-stat-grid">
          <span><strong>{googleCalendarAccessToken ? "on" : "off"}</strong> Calendar</span>
          <span><strong>{gmailAccessToken ? "on" : "off"}</strong> Gmail</span>
          <span><strong>{notionStatus?.hasToken ? "on" : "off"}</strong> Notion</span>
          <span><strong>{spotifyAccessToken ? "on" : "off"}</strong> Spotify</span>
        </div>
        <p className="shell-panel-copy">
          Connected: {connectedIntegrations.length > 0 ? connectedIntegrations.join(", ") : "none yet"}.
        </p>
      </>
    );
  }
  if (panel === "automation") {
    return (
      <>
        <div className="shell-stat-grid">
          <span><strong>{ocrWatchTargets.length}</strong> OCR watches</span>
          <span><strong>{savedWorkflows.length}</strong> workflows</span>
          <span><strong>{crossFeatureSuggestions.length}</strong> suggestions</span>
        </div>
        <p className="shell-panel-copy">
          Automation is where watches, schedules, and cross-feature suggestions come together.
        </p>
        <div className="shell-panel-actions-row">
          <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "show_ocr_watches" })}>Show watches</button>
          <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "list_desktop_schedules" })}>Schedules</button>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="shell-stat-grid">
        <span><strong>{executorStatus?.configured ? "ready" : "off"}</strong> executor</span>
        <span><strong>{autonomousBuildStatus}</strong> build state</span>
        <span><strong>{handoffArtifact ? "yes" : "none"}</strong> handoff</span>
      </div>
      <p className="shell-panel-copy">
        Builder mode prepares code-change handoffs now, and later can become the true voice-to-code bridge.
      </p>
      <div className="shell-panel-actions-row">
        <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "open_project_in_vscode" })}>Open project</button>
        <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "run_project_checks" })}>Run checks</button>
      </div>
    </>
  );
}
