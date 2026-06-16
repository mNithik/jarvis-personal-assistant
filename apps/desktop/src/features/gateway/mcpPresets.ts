import type { McpHostEntry } from "../../services/jarvisApi";

export type McpHostPreset = {
  id: string;
  label: string;
  description: string;
  capabilityFamily: string;
  command: string;
  readOnly: boolean;
  external: boolean;
  obsidianWizard?: boolean;
};

export const MCP_HOST_PRESETS: McpHostPreset[] = [
  {
    id: "obsidian-rest",
    label: "Obsidian Local REST",
    description: "Requires Obsidian Local REST API plugin on port 27124.",
    capabilityFamily: "integrations.mcp.obsidian",
    command: "npx -y obsidian-mcp-server",
    readOnly: false,
    external: true,
    obsidianWizard: true,
  },
  {
    id: "obsidian-graph",
    label: "Obsidian Graph MCP",
    description: "Graph-aware vault tools (backlinks, daily note). Obsidian must be open.",
    capabilityFamily: "integrations.mcp.obsidian",
    command: "npx -y obsidian-mcp",
    readOnly: false,
    external: true,
    obsidianWizard: true,
  },
  {
    id: "github",
    label: "GitHub MCP",
    description: "List issues and PRs. Writes require gateway approval.",
    capabilityFamily: "integrations.mcp.github",
    command: "npx -y @modelcontextprotocol/server-github",
    readOnly: true,
    external: true,
  },
  {
    id: "jira",
    label: "Jira MCP",
    description: "Community Jira MCP server (configure env vars for your instance).",
    capabilityFamily: "integrations.mcp.jira",
    command: "npx -y @aashari/mcp-server-jira",
    readOnly: true,
    external: true,
  },
  {
    id: "huggingface",
    label: "HuggingFace MCP",
    description: "Search models and datasets.",
    capabilityFamily: "integrations.mcp.huggingface",
    command: "npx -y @huggingface/mcp-server",
    readOnly: true,
    external: true,
  },
  {
    id: "zapier",
    label: "Zapier MCP",
    description: "Long-tail SaaS automation. Soft cap 100 tasks/month.",
    capabilityFamily: "integrations.mcp.zapier",
    command: "npx -y @zapier/mcp-server",
    readOnly: false,
    external: true,
  },
];

export function presetToHostEntry(preset: McpHostPreset): McpHostEntry {
  return {
    id: preset.id,
    label: preset.label,
    transport: "stdio",
    command: preset.command,
    readOnly: preset.readOnly,
    external: preset.external,
    env: {},
  };
}

export function findMcpPreset(id: string) {
  return MCP_HOST_PRESETS.find((preset) => preset.id === id);
}
