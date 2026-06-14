import { ReactNode } from "react";
import type { DesktopPermissionSettings } from "../../../features/command/jarvisCommandTypes";
import type { WorkspacesSectionProps } from "./sectionTypes";

export function buildWorkspacesWorkspaceSections({
  desktopPermissionSettings,
  desktopProjects,
  desktopSchedules,
  executeIntent,
  setDesktopPermissionSettings,
}: WorkspacesSectionProps): ReactNode[] {
  return [
    <section className="grid-layout single-column" key="workspaces-main">
      <div className="result-card">
        <p className="section-kicker">Desktop Permissions</p>
        <h3>Risky actions stay under your control</h3>
        <div className="workflow-actions">
          {[
            ["Project checks", "confirmProjectChecks"],
            ["Close apps", "confirmAppClose"],
            ["Coding executor", "confirmExecutorLaunch"],
          ].map(([label, permission]) => {
            const key = permission as keyof DesktopPermissionSettings;
            return (
              <button
                className="secondary-button"
                type="button"
                key={key}
                onClick={() =>
                  setDesktopPermissionSettings((current) => ({
                    ...current,
                    [key]: !current[key],
                  }))
                }
              >
                {label}: {desktopPermissionSettings[key] ? "Confirm" : "Auto-run"}
              </button>
            );
          })}
        </div>
      </div>
      {desktopProjects.length > 0 ? (
        <div className="result-card">
          <p className="section-kicker">Desktop Workspaces</p>
          <h3>{desktopProjects.length} saved workspace{desktopProjects.length === 1 ? "" : "s"}</h3>
          <div className="memory-grid">
            {desktopProjects.slice(0, 4).map((project) => (
              <div className="memory-card" key={project.id}>
                <h4>{project.name}</h4>
                <p>{project.apps.length} apps, {project.folders.length} folders, {project.websites.length} websites</p>
                <button className="secondary-button" type="button" onClick={() => { void executeIntent({ kind: "open_desktop_project", query: project.name }); }}>
                  Open workspace
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : <p className="empty-state">No desktop workspaces saved yet.</p>}
      {desktopSchedules.length > 0 ? (
        <div className="result-card">
          <p className="section-kicker">Workspace Schedule</p>
          <h3>{desktopSchedules.length} scheduled desktop item{desktopSchedules.length === 1 ? "" : "s"}</h3>
          <p className="result-meta">
            {desktopSchedules.slice(0, 4).map((schedule) => `${schedule.actionLabel} at ${new Date(schedule.dueAt).toLocaleString()}`).join(" | ")}
          </p>
        </div>
      ) : null}
    </section>,
  ];
}

