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
        env: std::collections::HashMap::new(),
    }
}

pub fn test_mcp_host_connection(
    config: &crate::gateway::config::GatewayConfig,
    host_id: &str,
) -> Result<String, String> {
    let host = crate::gateway::mcp::list_mcp_hosts(&config.mcp_hosts)
        .into_iter()
        .find(|entry| entry.id == host_id)
        .ok_or_else(|| {
            format!(
                "MCP host '{host_id}' is not configured. Add the preset under Gateway settings → MCP hosts."
            )
        })?;

    if host_id.starts_with("github") && crate::env_local::provider_api_key("github").is_none() {
        return Err(
            "Missing GitHub token. Set GITHUB_TOKEN or JARVIS_GITHUB_TOKEN in .env.".to_string(),
        );
    }
    if host_id.starts_with("jira") {
        crate::env_local::init_local_env();
        if std::env::var("JIRA_API_TOKEN").unwrap_or_default().trim().is_empty() {
            return Err(
                "Missing Jira token. Set JIRA_API_TOKEN (and JIRA_URL, JIRA_EMAIL) in .env.".to_string(),
            );
        }
    }
    if (host_id.starts_with("huggingface") || host_id.contains("hf"))
        && crate::env_local::provider_api_key("huggingface").is_none()
    {
        return Err(
            "Missing HuggingFace token. Set HF_TOKEN or JARVIS_HUGGINGFACE_API_KEY in .env.".to_string(),
        );
    }
    if host_id.starts_with("zapier") {
        crate::env_local::init_local_env();
        if std::env::var("ZAPIER_MCP_TOKEN")
            .or_else(|_| std::env::var("ZAPIER_API_KEY"))
            .unwrap_or_default()
            .trim()
            .is_empty()
        {
            return Err("Missing Zapier token. Set ZAPIER_MCP_TOKEN or ZAPIER_API_KEY in .env.".to_string());
        }
    }
    if host_id.starts_with("obsidian-rest")
        && host.env.get("OBSIDIAN_API_KEY").map(|value| value.trim()).unwrap_or("").is_empty()
    {
        return Err(
            "Missing Obsidian REST API key. Save it in the Obsidian setup wizard or set OBSIDIAN_API_KEY on the MCP host.".to_string(),
        );
    }

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
