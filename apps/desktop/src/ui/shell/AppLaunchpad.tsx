import { ReactNode } from "react";
import { JarvisWorkspaceId } from "../model/jarvisTypes";

type LaunchpadItem = {
  id: JarvisWorkspaceId;
  title: string;
  stat: string;
  accent: string;
};

type AppLaunchpadProps = {
  items: LaunchpadItem[];
  activeWorkspaceId: JarvisWorkspaceId;
  onSelect: (workspaceId: JarvisWorkspaceId) => void;
  preview: ReactNode;
  actions: ReactNode;
  title: string;
  summary: string;
};

export default function AppLaunchpad({
  items,
  activeWorkspaceId,
  onSelect,
  preview,
  actions,
  title,
  summary,
}: AppLaunchpadProps) {
  return (
    <section className="jarvis-app-launchpad">
      <div className="app-launchpad-header">
        <div>
          <p className="section-kicker">JARVIS Apps</p>
          <h2>{title}</h2>
          <p>{summary}</p>
        </div>
        <div className="launchpad-actions">{actions}</div>
      </div>
      <div className="home-app-rail" role="tablist" aria-label="JARVIS app sections">
        {items.map((app) => (
          <button
            className={`home-app-tab accent-${app.accent} ${activeWorkspaceId === app.id ? "active" : ""}`}
            type="button"
            key={app.id}
            role="tab"
            aria-selected={activeWorkspaceId === app.id}
            onClick={() => onSelect(app.id)}
          >
            <span>{app.title}</span>
            <small>{app.stat}</small>
          </button>
        ))}
      </div>
      {preview}
    </section>
  );
}
