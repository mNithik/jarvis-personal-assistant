use serde::{Deserialize, Serialize};

use crate::gateway::mcp::McpHostEntry;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpHostPreset {
    pub id: String,
    pub label: String,
    pub description: String,
    pub capability_family: String,
    pub command: String,
    pub read_only: bool,
}

pub fn list_mcp_presets() -> Vec<McpHostPreset> {
    vec![
        preset(
            "obsidian-rest",
            "Obsidian Local REST",
            "Requires Obsidian Local REST API plugin on port 27124.",
            "integrations.mcp.obsidian",
            "npx -y obsidian-mcp-server",
            false,
        ),
        preset(
            "obsidian-graph",
            "Obsidian Graph MCP",
            "Graph-aware vault tools. Obsidian must be open.",
            "integrations.mcp.obsidian",
            "npx -y obsidian-mcp",
            false,
        ),
        preset(
            "github",
            "GitHub MCP",
            "List issues and PRs. Writes require approval.",
            "integrations.mcp.github",
            "npx -y @modelcontextprotocol/server-github",
            true,
        ),
        preset(
            "jira",
            "Jira MCP",
            "Community Jira MCP server.",
            "integrations.mcp.jira",
            "npx -y @aashari/mcp-server-jira",
            true,
        ),
        preset(
            "huggingface",
            "HuggingFace MCP",
            "Search models and datasets.",
            "integrations.mcp.huggingface",
            "npx -y @huggingface/mcp-server",
            true,
        ),
        preset(
            "zapier",
            "Zapier MCP",
            "Long-tail SaaS automation.",
            "integrations.mcp.zapier",
            "npx -y @zapier/mcp-server",
            false,
        ),
    ]
}

pub fn preset_to_host(preset: &McpHostPreset) -> McpHostEntry {
    McpHostEntry {
        id: preset.id.clone(),
        label: preset.label.clone(),
        transport: "stdio".to_string(),
        command: Some(preset.command.clone()),
        read_only: preset.read_only,
        external: true,
    }
}

pub fn test_mcp_host_connection(
    config: &crate::gateway::config::GatewayConfig,
    host_id: &str,
) -> Result<String, String> {
    let tool = if host_id.starts_with("obsidian") {
        "search_notes"
    } else if host_id.starts_with("github") {
        "list_issues"
    } else if host_id.starts_with("huggingface") {
        "search_models"
    } else {
        "get_routines"
    };
    crate::gateway::mcp_host::call_mcp_tool(config, host_id, tool, serde_json::json!({ "query": "health" }))
}

fn preset(
    id: &str,
    label: &str,
    description: &str,
    capability_family: &str,
    command: &str,
    read_only: bool,
) -> McpHostPreset {
    McpHostPreset {
        id: id.to_string(),
        label: label.to_string(),
        description: description.to_string(),
        capability_family: capability_family.to_string(),
        command: command.to_string(),
        read_only,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_six_presets() {
        assert!(list_mcp_presets().len() >= 6);
    }
}
