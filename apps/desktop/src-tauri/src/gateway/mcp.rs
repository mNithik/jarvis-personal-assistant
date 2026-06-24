use serde::{Deserialize, Serialize};

use super::tools::{list_tool_definitions, ToolDefinition};
use super::types::ApprovalRisk;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpToolDescriptor {
    pub name: String,
    pub description: String,
    pub risk: ApprovalRisk,
    pub category: String,
}

pub fn list_mcp_tools(read_only: bool) -> Vec<McpToolDescriptor> {
    list_tool_definitions()
        .into_iter()
        .filter(|tool| !read_only || tool.risk == ApprovalRisk::Read)
        .map(tool_to_descriptor)
        .collect()
}

pub fn mcp_tool_count(read_only: bool) -> usize {
    list_mcp_tools(read_only).len()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpHostEntry {
    pub id: String,
    pub label: String,
    pub transport: String,
    pub command: Option<String>,
    pub read_only: bool,
    pub external: bool,
    #[serde(default)]
    pub env: std::collections::HashMap<String, String>,
}

pub struct McpHostRegistry {
    builtin: Vec<McpHostEntry>,
    external: Vec<McpHostEntry>,
}

impl Default for McpHostRegistry {
    fn default() -> Self {
        Self {
            builtin: vec![McpHostEntry {
                id: "jarvis-builtin".to_string(),
                label: "JARVIS built-in MCP catalog".to_string(),
                transport: "in-process".to_string(),
                command: None,
                read_only: true,
                external: false,
                env: std::collections::HashMap::new(),
            }],
            external: Vec::new(),
        }
    }
}

impl McpHostRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn merge_config_hosts(&mut self, hosts: &[McpHostEntry]) {
        self.external = hosts.iter().filter(|host| host.external).cloned().collect();
    }

    pub fn list_hosts(&self) -> Vec<McpHostEntry> {
        let mut hosts = self.builtin.clone();
        hosts.extend(self.external.clone());
        hosts
    }
}

pub fn default_mcp_host_registry() -> McpHostRegistry {
    McpHostRegistry::new()
}

pub fn list_mcp_hosts(config_hosts: &[McpHostEntry]) -> Vec<McpHostEntry> {
    let mut registry = default_mcp_host_registry();
    registry.merge_config_hosts(config_hosts);
    registry.list_hosts()
}

fn tool_to_descriptor(tool: ToolDefinition) -> McpToolDescriptor {
    McpToolDescriptor {
        name: tool.id.clone(),
        description: tool.label.clone(),
        risk: tool.risk,
        category: tool.category,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_at_least_five_read_only_tools() {
        assert!(mcp_tool_count(true) >= 5);
    }

    #[test]
    fn read_only_catalog_is_subset_of_full_catalog() {
        let read_only = list_mcp_tools(true);
        let full = list_mcp_tools(false);
        assert!(read_only.len() <= full.len());
        assert!(full.len() >= 80);
    }

    #[test]
    fn read_only_tools_exclude_destructive_entries() {
        assert!(list_mcp_tools(true)
            .iter()
            .all(|tool| tool.risk == ApprovalRisk::Read));
    }

    #[test]
    fn list_mcp_hosts_merges_config_descriptors() {
        let hosts = list_mcp_hosts(&[McpHostEntry {
            id: "obsidian-local".to_string(),
            label: "Obsidian local MCP".to_string(),
            transport: "stdio".to_string(),
            command: Some("obsidian-mcp".to_string()),
            read_only: true,
            external: true,
            env: std::collections::HashMap::new(),
        }]);

        assert!(hosts.iter().any(|host| host.id == "jarvis-builtin"));
        assert!(hosts.iter().any(|host| host.id == "obsidian-local"));
    }
}
