import { useState } from "react";

import type { GatewayConfig } from "../../services/jarvisApi";
import { findMcpPreset, presetToHostEntry } from "../../features/gateway/mcpPresets";

type ObsidianSetupWizardProps = {
  config: GatewayConfig;
  saving: boolean;
  onPersist: (next: GatewayConfig) => void;
};

export default function ObsidianSetupWizard({ config, saving, onPersist }: ObsidianSetupWizardProps) {
  const [vaultPath, setVaultPath] = useState(config.knowledge?.localVaultPath ?? "");
  const [apiKey, setApiKey] = useState("");
  const [mode, setMode] = useState<"filesystem" | "rest" | "graph">("filesystem");

  function applySetup() {
    const next: GatewayConfig = {
      ...config,
      knowledge: {
        ...config.knowledge,
        localVaultPath: vaultPath.trim() || config.knowledge?.localVaultPath,
        obsidianHostId: mode === "filesystem" ? config.knowledge?.obsidianHostId : mode === "rest" ? "obsidian-rest" : "obsidian-graph",
      },
      mcpHosts: [...(config.mcpHosts ?? [])],
    };

    if (mode !== "filesystem") {
      const preset = findMcpPreset(mode === "rest" ? "obsidian-rest" : "obsidian-graph");
      if (preset) {
        const entry = presetToHostEntry(preset);
        const hosts = next.mcpHosts.filter((host) => host.id !== entry.id);
        hosts.push(entry);
        next.mcpHosts = hosts;
      }
    }

    onPersist(next);
  }

  return (
    <div className="local-config-card">
      <p className="section-kicker">Obsidian setup wizard</p>
      <ol className="memory-list memory-meta">
        <li>Install Obsidian and enable the Local REST API community plugin (port 27124).</li>
        <li>Set your vault folder path for offline search when Obsidian is closed.</li>
        <li>Pick REST or Graph MCP when Obsidian is running for live vault tools.</li>
      </ol>
      <label className="gateway-field">
        <span>Vault folder path</span>
        <input value={vaultPath} onChange={(event) => setVaultPath(event.target.value)} placeholder="C:\Users\you\Documents\vault" disabled={saving} />
      </label>
      <label className="gateway-field">
        <span>Connection mode</span>
        <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)} disabled={saving}>
          <option value="filesystem">Filesystem only (Obsidian closed OK)</option>
          <option value="rest">Local REST MCP (Obsidian open)</option>
          <option value="graph">Graph MCP — backlinks + daily note</option>
        </select>
      </label>
      {mode !== "filesystem" ? (
        <label className="gateway-field">
          <span>Obsidian API key (optional, stored in env for MCP host)</span>
          <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Paste from Local REST API plugin" disabled={saving} />
        </label>
      ) : null}
      <button className="secondary-button" type="button" disabled={saving} onClick={applySetup}>
        Save Obsidian setup
      </button>
    </div>
  );
}
