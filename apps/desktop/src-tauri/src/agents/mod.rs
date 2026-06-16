pub mod automation;
pub mod command;
pub mod finance;
pub mod builder;
pub mod integrations;
mod memory_agent;
pub use memory_agent::MemoryAgent;
pub mod ocr_watch;
pub mod research;
pub mod supervisor;
pub mod vision;
pub mod writer;

use std::path::PathBuf;

use crate::gateway::types::IntegrationHandoff;
use crate::gateway::{
    bus::EventBus,
    config::GatewayConfig,
    types::{GatewayAgentKind, GatewayRoute},
};

#[derive(Debug, Clone)]
pub struct AgentContext {
    pub db_path: PathBuf,
    pub app_data_dir: PathBuf,
    pub config: GatewayConfig,
    pub route: GatewayRoute,
    pub session_id: String,
    pub turn_id: u64,
    pub command: String,
    pub step_description: String,
    pub step_kind: String,
}

#[derive(Debug, Clone)]
pub struct StepResult {
    pub reply: String,
    pub done: bool,
    pub success: bool,
    pub integration_handoff: Option<IntegrationHandoff>,
}

impl StepResult {
    pub fn ok(reply: impl Into<String>) -> Self {
        Self {
            reply: reply.into(),
            done: true,
            success: true,
            integration_handoff: None,
        }
    }

    pub fn failed(reply: impl Into<String>) -> Self {
        Self {
            reply: reply.into(),
            done: true,
            success: false,
            integration_handoff: None,
        }
    }

    pub fn handoff(
        capability_id: &str,
        action: &str,
        payload: Option<String>,
        reply: impl Into<String>,
    ) -> Self {
        Self {
            reply: reply.into(),
            done: true,
            success: true,
            integration_handoff: Some(IntegrationHandoff {
                capability_id: capability_id.to_string(),
                action: action.to_string(),
                payload,
            }),
        }
    }
}

pub trait Agent {
    fn kind(&self) -> GatewayAgentKind;
    fn run_step(&self, ctx: &AgentContext) -> Result<StepResult, String>;
}

pub fn dispatch_step(ctx: &AgentContext, bus: &mut EventBus) -> Result<StepResult, String> {
    if ctx.config.mode.is_simulation() {
        return Ok(StepResult::ok(format!(
            "{} mode skipped step: {}",
            if ctx.config.mode == crate::gateway::config::GatewayMode::PlanOnly {
                "Plan-only"
            } else {
                "Dry-run"
            },
            ctx.step_description
        )));
    }

    let tool_id = format!("agent-{}-{}", format!("{:?}", ctx.route.agent).to_lowercase(), ctx.turn_id);
    bus.publish(crate::gateway::types::GatewayEvent {
        id: format!("{tool_id}-start"),
        session_id: ctx.session_id.clone(),
        turn_id: Some(ctx.turn_id),
        kind: crate::gateway::types::GatewayEventKind::ToolStart,
        message: format!("Running {} step: {}", format!("{:?}", ctx.route.agent).to_lowercase(), ctx.step_description),
        created_at: unix_timestamp_string(),
        approval: None,
    });

    let agent: Box<dyn Agent> = match ctx.route.agent {
        GatewayAgentKind::Command => Box::new(command::CommandAgent),
        GatewayAgentKind::Vision => Box::new(vision::VisionAgent),
        GatewayAgentKind::Integrations => Box::new(integrations::IntegrationsAgent),
        GatewayAgentKind::Memory => Box::new(memory_agent::MemoryAgent),
        GatewayAgentKind::Builder => Box::new(builder::BuilderAgent),
        GatewayAgentKind::Supervisor => Box::new(supervisor::SupervisorAgent),
        GatewayAgentKind::Automation => Box::new(automation::AutomationAgent),
        GatewayAgentKind::Research => Box::new(research::ResearchAgent),
        GatewayAgentKind::Finance => Box::new(finance::FinanceAgent),
        GatewayAgentKind::Writer => Box::new(writer::WriterAgent),
    };

    let result = agent.run_step(ctx);
    let success = result.as_ref().map(|value| value.success).unwrap_or(false);
    let message = result
        .as_ref()
        .map(|value| value.reply.clone())
        .unwrap_or_else(|error| error.clone());

    bus.publish(crate::gateway::types::GatewayEvent {
        id: format!("{tool_id}-end"),
        session_id: ctx.session_id.clone(),
        turn_id: Some(ctx.turn_id),
        kind: if success {
            crate::gateway::types::GatewayEventKind::ToolEnd
        } else {
            crate::gateway::types::GatewayEventKind::Error
        },
        message,
        created_at: unix_timestamp_string(),
        approval: None,
    });

    result
}

pub(super) fn unix_timestamp_string() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

pub fn extract_file_search_query(command: &str) -> Option<String> {
    let trimmed = command.trim();
    let normalized = trimmed.to_lowercase();
    const PREFIXES: &[&str] = &[
        "search files for ",
        "find file ",
        "find files for ",
        "search for file ",
    ];
    for prefix in PREFIXES {
        if normalized.starts_with(prefix) {
            let query = trimmed[prefix.len()..].trim();
            if !query.is_empty() {
                return Some(query.to_string());
            }
        }
    }
    None
}

pub fn extract_google_search_query(command: &str) -> Option<String> {
    let trimmed = command.trim();
    let normalized = trimmed.to_lowercase();
    const PREFIXES: &[&str] = &[
        "search google for ",
        "google search for ",
        "google for ",
        "search web for ",
        "search the web for ",
    ];
    for prefix in PREFIXES {
        if normalized.starts_with(prefix) {
            let query = trimmed[prefix.len()..].trim();
            if !query.is_empty() {
                return Some(query.to_string());
            }
        }
    }
    None
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PdfCommandAction {
    List,
    Search { query: String },
    OpenCurrent,
    OpenByIndex { index: u32 },
    OpenByQuery { query: String },
    ReadCurrent,
    ReadByIndex { index: u32 },
    ReadByQuery { query: String },
    SummarizeCurrent,
    SummarizeByIndex { index: u32 },
    SummarizeByQuery { query: String },
}

pub fn parse_pdf_command_action(command: &str) -> Option<PdfCommandAction> {
    let trimmed = command.trim();
    let normalized = trimmed.to_lowercase();

    if matches!(normalized.as_str(), "list pdfs" | "show pdfs" | "find pdfs") {
        return Some(PdfCommandAction::List);
    }

    if normalized == "open this pdf" {
        return Some(PdfCommandAction::OpenCurrent);
    }

    if matches!(normalized.as_str(), "read this pdf" | "show this pdf") {
        return Some(PdfCommandAction::ReadCurrent);
    }

    if normalized == "summarize this pdf" {
        return Some(PdfCommandAction::SummarizeCurrent);
    }

    for prefix in ["search pdfs for ", "find pdf about "] {
        if normalized.starts_with(prefix) {
            let query = trimmed[prefix.len()..].trim();
            if !query.is_empty() {
                return Some(PdfCommandAction::Search {
                    query: query.to_string(),
                });
            }
        }
    }

    for prefix in ["open the pdf about ", "open pdf about "] {
        if normalized.starts_with(prefix) {
            let query = trimmed[prefix.len()..].trim();
            if !query.is_empty() {
                return Some(PdfCommandAction::OpenByQuery {
                    query: query.to_string(),
                });
            }
        }
    }

    for prefix in [
        "read the pdf about ",
        "read pdf about ",
        "show the pdf about ",
        "show pdf about ",
    ] {
        if normalized.starts_with(prefix) {
            let query = trimmed[prefix.len()..].trim();
            if !query.is_empty() {
                return Some(PdfCommandAction::ReadByQuery {
                    query: query.to_string(),
                });
            }
        }
    }

    for prefix in ["open pdf ", "open the pdf "] {
        if normalized.starts_with(prefix) {
            let index = trimmed[prefix.len()..].trim();
            if let Ok(index) = index.parse::<u32>() {
                return Some(PdfCommandAction::OpenByIndex { index });
            }
        }
    }

    for prefix in ["read pdf ", "read the pdf ", "show pdf ", "show the pdf "] {
        if normalized.starts_with(prefix) {
            let index = trimmed[prefix.len()..].trim();
            if let Ok(index) = index.parse::<u32>() {
                return Some(PdfCommandAction::ReadByIndex { index });
            }
        }
    }

    for prefix in ["summarize pdf ", "summarize the pdf "] {
        if normalized.starts_with(prefix) {
            let index = trimmed[prefix.len()..].trim();
            if let Ok(index) = index.parse::<u32>() {
                return Some(PdfCommandAction::SummarizeByIndex { index });
            }
        }
    }

    for prefix in ["summarize the pdf about ", "summarize pdf about "] {
        if normalized.starts_with(prefix) {
            let query = trimmed[prefix.len()..].trim();
            if !query.is_empty() {
                return Some(PdfCommandAction::SummarizeByQuery {
                    query: query.to_string(),
                });
            }
        }
    }

    None
}

pub fn is_list_pdfs_command(command: &str) -> bool {
    matches!(parse_pdf_command_action(command), Some(PdfCommandAction::List))
}

pub fn extract_pdf_search_query(command: &str) -> Option<String> {
    match parse_pdf_command_action(command) {
        Some(PdfCommandAction::Search { query }) => Some(query),
        _ => None,
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ClipboardCommandAction {
    Read,
    Write { text: String },
}

pub fn parse_clipboard_command(command: &str) -> Option<ClipboardCommandAction> {
    let trimmed = command.trim();
    let normalized = trimmed.to_lowercase();

    if normalized.contains("read clipboard")
        || normalized == "clipboard"
        || normalized == "show clipboard"
    {
        return Some(ClipboardCommandAction::Read);
    }

    for prefix in ["copy ", "write clipboard ", "copy to clipboard "] {
        if normalized.starts_with(prefix) {
            let text = trimmed[prefix.len()..].trim();
            let text = text
                .strip_suffix(" to clipboard")
                .or_else(|| text.strip_suffix(" to the clipboard"))
                .unwrap_or(text)
                .trim();
            if !text.is_empty() {
                return Some(ClipboardCommandAction::Write {
                    text: text.to_string(),
                });
            }
        }
    }

    None
}

pub fn parse_then_steps(command: &str) -> Option<(String, String)> {
    let normalized = command.to_lowercase();
    let marker = " then ";
    let index = normalized.find(marker)?;
    let left = command[..index].trim();
    let right = command[index + marker.len()..].trim();
    if left.is_empty() || right.is_empty() {
        return None;
    }
    Some((left.to_string(), right.to_string()))
}

pub fn open_target_from_command(command: &str) -> Option<String> {
    let trimmed = command.trim();
    let normalized = trimmed.to_lowercase();
    for prefix in ["open ", "launch ", "focus "] {
        if normalized.starts_with(prefix) {
            let target = trimmed[prefix.len()..].trim();
            if !target.is_empty() {
                return Some(target.to_string());
            }
        }
    }
    None
}
