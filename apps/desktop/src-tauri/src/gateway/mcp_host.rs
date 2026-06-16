use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use serde_json::{json, Value};

use super::config::GatewayConfig;
use super::mcp::McpHostEntry;
use crate::env_local;

static MCP_CALL_ID: AtomicU64 = AtomicU64::new(1);

fn next_id() -> u64 {
    MCP_CALL_ID.fetch_add(1, Ordering::Relaxed)
}

pub fn call_mcp_tool(
    config: &GatewayConfig,
    host_id: &str,
    tool_name: &str,
    arguments: Value,
) -> Result<String, String> {
    let payload = serde_json::to_string(&arguments).map_err(|error| error.to_string())?;
    if payload.len() as u32 > config.budgets.max_mcp_payload_bytes {
        return Err(format!(
            "MCP arguments exceed budget ({} bytes > {} bytes).",
            payload.len(),
            config.budgets.max_mcp_payload_bytes
        ));
    }

    let host = super::mcp::list_mcp_hosts(&config.mcp_hosts)
        .into_iter()
        .find(|entry| entry.id == host_id)
        .ok_or_else(|| format!("Unknown MCP host '{host_id}'."))?;

    if host.read_only && is_write_mcp_tool(tool_name) {
        return Err(format!(
            "MCP host '{host_id}' is read-only; write tool '{tool_name}' blocked."
        ));
    }

    if host.external {
        call_external_stdio_tool(&host, tool_name, arguments)
    } else {
        call_builtin_tool(tool_name, arguments)
    }
}

fn call_builtin_tool(tool_name: &str, arguments: Value) -> Result<String, String> {
    match tool_name {
        "get_routines" | "get_recent_history" => {
            let payload = json!({
                "tool": tool_name,
                "arguments": arguments,
                "status": "catalog_only",
                "message": "Built-in MCP host exposes tool metadata; invoke through gateway task loop for execution."
            });
            serde_json::to_string_pretty(&payload).map_err(|error| error.to_string())
        }
        _ => Err(format!(
            "Built-in MCP host does not proxy '{tool_name}' yet. Use gateway tools or an external MCP host."
        )),
    }
}

fn call_external_stdio_tool(
    host: &McpHostEntry,
    tool_name: &str,
    arguments: Value,
) -> Result<String, String> {
    let command_line = host
        .command
        .as_ref()
        .ok_or_else(|| format!("MCP host '{}' has no launch command.", host.id))?;
    let parts: Vec<&str> = command_line.split_whitespace().collect();
    if parts.is_empty() {
        return Err("MCP host command is empty.".to_string());
    }

    let mut command = Command::new(parts[0]);
    command
        .args(&parts[1..])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if host.id.starts_with("github") {
        env_local::init_local_env();
        if let Some(token) = env_local::provider_api_key("github") {
            command.env("GITHUB_PERSONAL_ACCESS_TOKEN", token);
        }
    }
    apply_host_env(&host.id, &host.env, &mut command);
    let mut child = command
        .spawn()
        .map_err(|error| format!("Failed to spawn MCP host '{}': {error}", host.id))?;

    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "MCP host stdin unavailable.".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "MCP host stdout unavailable.".to_string())?;

    let init_id = next_id();
    let init_request = json!({
        "jsonrpc": "2.0",
        "id": init_id,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": { "name": "jarvis-gateway", "version": "0.1.0" }
        }
    });
    writeln!(stdin, "{}", init_request).map_err(|error| error.to_string())?;
    stdin.flush().map_err(|error| error.to_string())?;

    let initialized = json!({
        "jsonrpc": "2.0",
        "method": "notifications/initialized"
    });
    writeln!(stdin, "{}", initialized).map_err(|error| error.to_string())?;
    stdin.flush().map_err(|error| error.to_string())?;

    let call_id = next_id();
    let call_request = json!({
        "jsonrpc": "2.0",
        "id": call_id,
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments
        }
    });
    writeln!(stdin, "{}", call_request).map_err(|error| error.to_string())?;
    stdin.flush().map_err(|error| error.to_string())?;
    drop(stdin);

    let reader = BufReader::new(stdout);
    let mut response_body = String::new();
    for line in reader.lines() {
        let line = line.map_err(|error| error.to_string())?;
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let value: Value =
            serde_json::from_str(trimmed).map_err(|error| format!("Invalid MCP JSON: {error}"))?;
        if value.get("id").and_then(|id| id.as_u64()) == Some(call_id) {
            response_body = trimmed.to_string();
            break;
        }
        if value.get("id").and_then(|id| id.as_u64()) == Some(init_id) {
            continue;
        }
    }

    let _ = child.wait();

    if response_body.is_empty() {
        return Err(format!(
            "MCP host '{}' did not return a tool response for '{}'.",
            host.id, tool_name
        ));
    }

    let parsed: Value = serde_json::from_str(&response_body)
        .map_err(|error| format!("Failed to parse MCP tool response: {error}"))?;
    if let Some(error) = parsed.get("error") {
        return Err(format!("MCP tool error: {error}"));
    }

    parsed
        .get("result")
        .map(|result| result.to_string())
        .ok_or_else(|| "MCP tool response missing result.".to_string())
}

fn apply_host_env(host_id: &str, env: &std::collections::HashMap<String, String>, command: &mut Command) {
    for (key, value) in env {
        if !value.trim().is_empty() {
            command.env(key, value);
        }
    }
    env_local::init_local_env();
    if host_id.starts_with("jira") {
        for (key, env_key) in [
            ("JIRA_API_TOKEN", "JIRA_API_TOKEN"),
            ("JIRA_BASE_URL", "JIRA_URL"),
            ("JIRA_EMAIL", "JIRA_EMAIL"),
        ] {
            if let Ok(value) = std::env::var(env_key) {
                let trimmed = value.trim();
                if !trimmed.is_empty() {
                    command.env(key, trimmed);
                }
            }
        }
    }
    if host_id.starts_with("huggingface") || host_id.contains("hf") {
        if let Some(token) = env_local::provider_api_key("huggingface") {
            command.env("HF_TOKEN", token);
        }
    }
    if host_id.starts_with("zapier") {
        if let Ok(token) = std::env::var("ZAPIER_MCP_TOKEN").or_else(|_| std::env::var("ZAPIER_API_KEY")) {
            let trimmed = token.trim();
            if !trimmed.is_empty() {
                command.env("ZAPIER_MCP_TOKEN", trimmed);
            }
        }
    }
    if host_id.starts_with("obsidian-rest") {
        if let Some(key) = env.get("OBSIDIAN_API_KEY") {
            command.env("OBSIDIAN_API_KEY", key);
        }
    }
}

static HOST_CACHE: Mutex<Option<Vec<McpHostEntry>>> = Mutex::new(None);

pub fn reset_host_cache_for_tests() {
    if let Ok(mut cache) = HOST_CACHE.lock() {
        *cache = None;
    }
}

fn is_write_mcp_tool(tool_name: &str) -> bool {
    use super::tools::list_tool_definitions;
    use super::types::ApprovalRisk;

    list_tool_definitions()
        .into_iter()
        .find(|tool| tool.id == tool_name)
        .map(|tool| tool.risk != ApprovalRisk::Read)
        .unwrap_or(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builtin_host_rejects_unknown_tool() {
        let config = GatewayConfig::default();
        let result = call_mcp_tool(&config, "jarvis-builtin", "unknown_tool", json!({}));
        assert!(result.is_err());
    }

    #[test]
    fn rejects_oversized_payload() {
        let config = GatewayConfig {
            budgets: crate::gateway::config::GatewayBudgetConfig {
                max_mcp_payload_bytes: 8,
                ..Default::default()
            },
            ..Default::default()
        };
        let result = call_mcp_tool(
            &config,
            "jarvis-builtin",
            "get_routines",
            json!({ "data": "0123456789" }),
        );
        assert!(result.is_err());
    }
}
