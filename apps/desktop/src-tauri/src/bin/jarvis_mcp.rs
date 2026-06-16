use std::borrow::Cow;

use anyhow::Result;
use jarvis_lib::gateway::mcp::list_mcp_tools;
use rmcp::{
    handler::server::wrapper::Parameters,
    model::{CallToolResult, Content, ServerCapabilities, ServerInfo},
    schemars, service::ServiceExt, tool, tool_handler, tool_router, ErrorData as McpError,
    ServerHandler,
};
use tokio::io::{stdin, stdout};

#[derive(Clone)]
struct JarvisMcpServer {
    tool_router: rmcp::handler::server::tool::ToolRouter<Self>,
}

#[tool_router]
impl JarvisMcpServer {
    fn new() -> Self {
        Self {
            tool_router: Self::tool_router(),
        }
    }

    #[tool(description = "Health check for the JARVIS MCP bridge.")]
    async fn ping_jarvis() -> Result<CallToolResult, McpError> {
        Ok(CallToolResult::success(vec![Content::text(
            "JARVIS MCP bridge is online.",
        )]))
    }

    #[tool(description = "List read-only JARVIS tools exposed through the gateway catalog.")]
    async fn list_jarvis_tools(
        Parameters(request): Parameters<ListToolsRequest>,
    ) -> Result<CallToolResult, McpError> {
        let tools = list_mcp_tools(!request.include_write_tools);
        let payload = serde_json::to_string_pretty(&tools).map_err(|error| McpError {
            code: rmcp::model::ErrorCode::INTERNAL_ERROR,
            message: Cow::from(format!("Failed to serialize MCP catalog: {error}")),
            data: None,
        })?;
        Ok(CallToolResult::success(vec![Content::text(payload)]))
    }

    #[tool(description = "Proxy read-only get_routines metadata from the gateway tool registry.")]
    async fn get_routines() -> Result<CallToolResult, McpError> {
        let payload = serde_json::json!({
            "tool": "get_routines",
            "available": list_mcp_tools(true).iter().any(|tool| tool.name == "get_routines")
        });
        Ok(CallToolResult::success(vec![Content::text(payload.to_string())]))
    }

    #[tool(description = "Summarize a gateway capability family from the read-only catalog.")]
    async fn describe_jarvis_capability(
        Parameters(request): Parameters<DescribeCapabilityRequest>,
    ) -> Result<CallToolResult, McpError> {
        let tools = list_mcp_tools(true);
        let matches: Vec<_> = tools
            .iter()
            .filter(|tool| {
                request.capability_id.is_empty()
                    || tool.category.contains(&request.capability_id)
                    || tool.name.contains(&request.capability_id)
            })
            .take(12)
            .collect();
        let payload = serde_json::json!({
            "capabilityId": request.capability_id,
            "matches": matches,
            "totalReadOnlyTools": tools.len(),
        });
        Ok(CallToolResult::success(vec![Content::text(payload.to_string())]))
    }
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
struct ListToolsRequest {
    #[serde(default)]
    include_write_tools: bool,
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
struct DescribeCapabilityRequest {
    #[serde(default)]
    capability_id: String,
}

#[tool_handler]
impl ServerHandler for JarvisMcpServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build()).with_instructions(
            "JARVIS MCP bridge. Use ping_jarvis for health checks and list_jarvis_tools to inspect the read-only gateway catalog.",
        )
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let server = JarvisMcpServer::new();
    let transport = (stdin(), stdout());
    server.serve(transport).await?.waiting().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_only_catalog_has_at_least_five_tools() {
        assert!(list_mcp_tools(true).len() >= 5);
    }
}
