import { useMemo, useState } from "react";
import GatewayConfigPanel from "@desktop/ui/settings/GatewayConfigPanel";
import TriggerRecipePanel from "@desktop/ui/settings/TriggerRecipePanel";
import SyncPanel from "@desktop/ui/settings/SyncPanel";
import { TopicGraphPanel } from "@desktop/ui/workspaces/sections/TopicGraphPanel";
import { ProactiveNudgePanel } from "@desktop/ui/workspaces/sections/ProactiveNudgePanel";
import { AmbientCopilotPanel } from "@desktop/ui/workspaces/sections/AmbientCopilotPanel";
import InstalledSkillsPanel from "@desktop/ui/workspaces/sections/InstalledSkillsPanel";
import ProfileSwitcherPanel from "@desktop/ui/settings/ProfileSwitcherPanel";

const PANELS = [
  { id: "gateway", label: "Gateway" },
  { id: "triggers", label: "Triggers" },
  { id: "sync", label: "Sync" },
  { id: "topic-graph", label: "Topic graph" },
  { id: "nudges", label: "Nudges" },
  { id: "ambient", label: "Ambient" },
  { id: "skills", label: "Skills" },
  { id: "profiles", label: "Profiles" },
  { id: "command", label: "Command" },
] as const;

export default function HarnessApp() {
  const [panel, setPanel] = useState<(typeof PANELS)[number]["id"]>("gateway");
  const [command, setCommand] = useState("");
  const [preview, setPreview] = useState("Type a command to preview the route.");

  const body = useMemo(() => {
    switch (panel) {
      case "gateway":
        return <GatewayConfigPanel />;
      case "triggers":
        return <TriggerRecipePanel />;
      case "sync":
        return <SyncPanel />;
      case "topic-graph":
        return <TopicGraphPanel />;
      case "nudges":
        return <ProactiveNudgePanel />;
      case "ambient":
        return <AmbientCopilotPanel />;
      case "skills":
        return <InstalledSkillsPanel />;
      case "profiles":
        return <ProfileSwitcherPanel />;
      case "command":
        return (
          <section className="command-panel" data-testid="command-panel">
            <form
              className="command-box"
              onSubmit={async (event) => {
                event.preventDefault();
                const { previewGatewayTurn } = await import("@desktop/services/jarvisApi");
                const result = await previewGatewayTurn({ command });
                setPreview(
                  `${result.result.route?.capabilityLabel ?? "Unknown"} - ${result.result.route?.decisionReason ?? ""}`,
                );
              }}
            >
              <input
                data-testid="command-input"
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="Tell JARVIS what you want to do..."
              />
              <button className="primary-button" type="submit">
                Route command
              </button>
            </form>
            <div className="gateway-preview-card" data-testid="gateway-preview">
              {preview}
            </div>
          </section>
        );
      default:
        return null;
    }
  }, [command, panel, preview]);

  return (
    <div className="workspace-surface-body" style={{ padding: "1rem" }}>
      <nav className="inline-actions" data-testid="harness-nav">
        {PANELS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={panel === entry.id ? "primary-button" : "secondary-button"}
            onClick={() => setPanel(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </nav>
      <div style={{ marginTop: "1rem" }}>{body}</div>
    </div>
  );
}
