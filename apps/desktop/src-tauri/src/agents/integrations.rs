use serde_json::{json, Value};

use super::{Agent, AgentContext, StepResult};
use crate::gateway::mcp_host::call_mcp_tool;
use crate::gateway::tools::list_tool_definitions;
use crate::gateway::types::{ApprovalRisk, GatewayAgentKind};
use crate::integrations::{
    notion::{self, format_notes_reply},
    parse_calendar_command, parse_email_notion_command, parse_gmail_command, parse_notion_command,
    parse_ocr_notion_command, parse_ocr_watch_command, parse_spotify_command, CalendarAction,
    EmailNotionAction, GmailAction, NotionAction, OcrNotionAction, OcrWatchAction, SpotifyAction,
};

pub struct IntegrationsAgent;

impl Agent for IntegrationsAgent {
    fn kind(&self) -> GatewayAgentKind {
        GatewayAgentKind::Integrations
    }

    fn run_step(&self, ctx: &AgentContext) -> Result<StepResult, String> {
        match ctx.step_kind.as_str() {
            "list_unread_emails" | "search_gmail" | "read_current_email"
            | "read_email_by_index" | "read_email_by_query" => return run_gmail(ctx),
            "list_today_calendar_events" | "create_calendar_event"
            | "create_calendar_event_from_current_email" => return run_calendar(ctx),
            "spotify_play" | "spotify_pause" | "spotify_next" | "spotify_previous"
            | "spotify_play_query" => return run_spotify(ctx),
            "notion_list_notes" | "notion_search_notes" | "notion_create_note"
            | "notion_create_task" => return run_notion(ctx),
            "read_screen_save_to_notion" | "save_ocr_history_to_notion"
            | "save_screen_text_to_notion" | "start_ocr_watch" | "stop_ocr_watch"
            |             "show_ocr_watches" | "pause_ocr_watches" | "resume_ocr_watches" => {
                return run_ocr_notion(ctx)
            }
            "mcp_call" => return run_mcp(ctx),
            _ => {}
        }

        match ctx.route.capability_id.as_str() {
            "integrations.notion" => run_notion(ctx),
            "integrations.spotify" => run_spotify(ctx),
            "integrations.google" => run_gmail(ctx),
            "integrations.calendar" => run_calendar(ctx),
            "integrations.ocr_notion" => run_ocr_notion(ctx),
            "integrations.email_notion" => run_email_notion(ctx),
            "integrations.mcp.host" => run_mcp(ctx),
            _ => Ok(StepResult::ok(format!(
                "Integrations agent stub for {}.",
                ctx.route.capability_label
            ))),
        }
    }
}

fn run_notion(ctx: &AgentContext) -> Result<StepResult, String> {
    if !ctx.config.features.notion {
        return Ok(StepResult::failed(
            "Notion integration is disabled. Enable gateway.features.notion first.",
        ));
    }

    let action = parse_notion_command(&ctx.command).unwrap_or(NotionAction::ListNotes);
    match action {
        NotionAction::ListNotes => {
            let notes = notion::list_notes(&ctx.db_path)?;
            Ok(StepResult::ok(format_notes_reply(&notes)))
        }
        NotionAction::SearchNotes { query } => {
            let notes = notion::search_notes(&ctx.db_path, &query)?;
            if notes.is_empty() {
                Ok(StepResult::ok(format!(
                    "No Notion notes matched \"{query}\"."
                )))
            } else {
                Ok(StepResult::ok(format!(
                    "Notion search results for \"{query}\":\n{}",
                    format_notes_reply(&notes)
                )))
            }
        }
        NotionAction::CreateNote { content } => {
            let note = notion::create_note(&ctx.db_path, &content)?;
            Ok(StepResult::ok(format!(
                "Saved note \"{}\" to Notion: {}",
                note.title, note.url
            )))
        }
        NotionAction::CreateTask { title } => {
            let note = notion::create_note(
                &ctx.db_path,
                &format!("Task: {}", title.trim()),
            )?;
            Ok(StepResult::ok(format!(
                "Created Notion task \"{}\" at {}",
                note.title, note.url
            )))
        }
    }
}

fn run_spotify(ctx: &AgentContext) -> Result<StepResult, String> {
    if !ctx.config.features.spotify {
        return Ok(StepResult::failed(
            "Spotify integration is disabled. Enable gateway.features.spotify first.",
        ));
    }

    let action = parse_spotify_command(&ctx.command).unwrap_or(SpotifyAction::Play);
    let (action_name, payload) = match action {
        SpotifyAction::Play => ("play", None),
        SpotifyAction::Pause => ("pause", None),
        SpotifyAction::Skip => ("skip", None),
        SpotifyAction::Previous => ("previous", None),
        SpotifyAction::PlayQuery { query } => ("play_query", Some(query)),
    };

    Ok(StepResult::handoff(
        "integrations.spotify",
        action_name,
        payload,
        format!("Handing off Spotify action `{action_name}` to the desktop player."),
    ))
}

fn run_gmail(ctx: &AgentContext) -> Result<StepResult, String> {
    if !ctx.config.features.gmail {
        return Ok(StepResult::failed(
            "Gmail integration is disabled. Enable gateway.features.gmail first.",
        ));
    }

    let action = parse_gmail_command(&ctx.command).unwrap_or(GmailAction::ListUnread);
    let (action_name, payload) = match action {
        GmailAction::ListUnread => ("list_unread", None),
        GmailAction::Search { query } => ("search", Some(query)),
        GmailAction::ReadCurrentEmail => ("read_current_email", None),
        GmailAction::ReadEmailByIndex { index } => ("read_email_by_index", Some(index.to_string())),
        GmailAction::ReadEmailByQuery { query } => ("read_email_by_query", Some(query)),
    };

    Ok(StepResult::handoff(
        "integrations.google",
        action_name,
        payload,
        gmail_bridge_reply(action_name),
    ))
}

fn gmail_bridge_reply(action_name: &str) -> String {
    format!(
        "Handing off Gmail action `{action_name}` to the desktop mail client. Gmail bridge degraded mode: if this does not complete, check Google auth, Gmail service status, and the legacy desktop mail bridge with gateway disabled."
    )
}

fn run_calendar(ctx: &AgentContext) -> Result<StepResult, String> {
    if !ctx.config.features.calendar {
        return Ok(StepResult::failed(
            "Calendar integration is disabled. Enable gateway.features.calendar first.",
        ));
    }

    let action = parse_calendar_command(&ctx.command).unwrap_or(CalendarAction::CreateFromNl);
    let (action_name, payload) = match action {
        CalendarAction::ListToday => ("list_today", None),
        CalendarAction::CreateFromNl => ("create_from_nl", Some(ctx.command.clone())),
        CalendarAction::CreateFromEmail => ("create_from_email", None),
    };

    Ok(StepResult::handoff(
        "integrations.calendar",
        action_name,
        payload,
        format!("Handing off Calendar action `{action_name}` to the desktop calendar client."),
    ))
}

fn run_ocr_notion(ctx: &AgentContext) -> Result<StepResult, String> {
    if !ctx.config.features.ocr_notion {
        return Ok(StepResult::failed(
            "OCR to Notion is disabled. Enable gateway.features.ocr_notion first.",
        ));
    }

    if let Some(watch_action) = parse_ocr_watch_command(&ctx.command) {
        let (action_name, payload) = match watch_action {
            OcrWatchAction::StartWatch => ("start_ocr_watch", Some(ctx.command.clone())),
            OcrWatchAction::StopWatch => ("stop_ocr_watch", None),
            OcrWatchAction::ShowWatches => ("show_ocr_watches", None),
            OcrWatchAction::PauseWatches => ("pause_ocr_watches", None),
            OcrWatchAction::ResumeWatches => ("resume_ocr_watches", None),
        };
        return Ok(StepResult::handoff(
            "integrations.ocr_notion",
            action_name,
            payload,
            format!("Handing off OCR watch action `{action_name}` to the desktop automation bridge."),
        ));
    }

    let action = parse_ocr_notion_command(&ctx.command).ok_or_else(|| {
        "Could not parse an OCR to Notion command.".to_string()
    })?;

    match action {
        OcrNotionAction::ReadScreenAndSave => {
            let text =
                crate::commands::vision::read_screen_via_ocr(&ctx.db_path, &ctx.app_data_dir)?;
            let trimmed = text.trim();
            if trimmed.is_empty() {
                return Ok(StepResult::failed(
                    "Screen OCR returned no text to save to Notion.",
                ));
            }
            let note = notion::create_note(&ctx.db_path, trimmed)?;
            Ok(StepResult::ok(format!(
                "Saved screen text to Notion as \"{}\" at {}",
                note.title, note.url
            )))
        }
        OcrNotionAction::SaveOcrHistory => Ok(StepResult::handoff(
            "integrations.ocr_notion",
            "save_ocr_history_to_notion",
            None,
            "Handing off OCR history save to the desktop Notion bridge.".to_string(),
        )),
        OcrNotionAction::SaveScreenText { scope } => Ok(StepResult::handoff(
            "integrations.ocr_notion",
            "save_screen_text_to_notion",
            scope,
            "Handing off scoped screen text save to the desktop Notion bridge.".to_string(),
        )),
    }
}

fn run_email_notion(ctx: &AgentContext) -> Result<StepResult, String> {
    if !ctx.config.features.email_notion {
        return Ok(StepResult::failed(
            "Email to Notion is disabled. Enable gateway.features.email_notion first.",
        ));
    }
    if !ctx.config.features.gmail {
        return Ok(StepResult::failed(
            "Email to Notion requires Gmail to be enabled in gateway features.",
        ));
    }

    let action = parse_email_notion_command(&ctx.command).ok_or_else(|| {
        "Could not parse an email to Notion command.".to_string()
    })?;

    let (action_name, payload) = match action {
        EmailNotionAction::SaveCurrentEmail => ("save_current_email", None),
        EmailNotionAction::SaveLatestEmail => ("save_latest_email", None),
        EmailNotionAction::SaveEmailDigest => ("save_email_digest", None),
        EmailNotionAction::SaveFirstEmails { count } => {
            ("save_first_emails", Some(count.to_string()))
        }
        EmailNotionAction::SaveTravelCurrent => ("save_travel_current", None),
        EmailNotionAction::SaveExpenseCurrent => ("save_expense_current", None),
        EmailNotionAction::SavePackageCurrent => ("save_package_current", None),
        EmailNotionAction::SaveEmailByIndex { index } => {
            ("save_email_by_index", Some(index.to_string()))
        }
        EmailNotionAction::SaveEmailByQuery { query } => ("save_email_by_query", Some(query)),
        EmailNotionAction::SaveTravelByIndex { index } => {
            ("save_travel_by_index", Some(index.to_string()))
        }
        EmailNotionAction::SaveTravelByQuery { query } => ("save_travel_by_query", Some(query)),
        EmailNotionAction::SaveExpenseByIndex { index } => {
            ("save_expense_by_index", Some(index.to_string()))
        }
        EmailNotionAction::SaveExpenseByQuery { query } => {
            ("save_expense_by_query", Some(query))
        }
        EmailNotionAction::SavePackageByIndex { index } => {
            ("save_package_by_index", Some(index.to_string()))
        }
        EmailNotionAction::SavePackageByQuery { query } => {
            ("save_package_by_query", Some(query))
        }
    };

    Ok(StepResult::handoff(
        "integrations.email_notion",
        action_name,
        payload,
        format!("Handing off email to Notion action `{action_name}` to the desktop bridge."),
    ))
}

fn run_mcp(ctx: &AgentContext) -> Result<StepResult, String> {
    let Some((host_id, tool_name, arguments)) = parse_mcp_command(&ctx.command) else {
        return Ok(StepResult::failed(
            "MCP commands use: mcp <host-id> <tool-name> [json-args]",
        ));
    };

    if mcp_tool_requires_approval(&tool_name) {
        let host = ctx
            .config
            .mcp_hosts
            .iter()
            .find(|entry| entry.id == host_id);
        if host.is_none_or(|entry| !entry.read_only) {
            return Ok(StepResult::failed(format!(
                "MCP tool '{tool_name}' requires approval. Approve in the gateway panel, then retry."
            )));
        }
    }

    match call_mcp_tool(&ctx.config, &host_id, &tool_name, arguments) {
        Ok(reply) => Ok(StepResult::ok(reply)),
        Err(error) => Ok(StepResult::failed(error)),
    }
}

fn parse_mcp_command(command: &str) -> Option<(String, String, Value)> {
    let trimmed = command.trim();
    let mut parts = trimmed.split_whitespace();
    if parts.next()?.to_lowercase() != "mcp" {
        return None;
    }
    let host_id = parts.next()?.to_string();
    let tool_name = parts.next()?.to_string();
    let arguments = parts.collect::<Vec<_>>().join(" ");
    let parsed = if arguments.is_empty() {
        json!({})
    } else {
        serde_json::from_str(&arguments).unwrap_or_else(|_| json!({ "input": arguments }))
    };
    Some((host_id, tool_name, parsed))
}

fn mcp_tool_requires_approval(tool_name: &str) -> bool {
    list_tool_definitions()
        .into_iter()
        .find(|tool| tool.id == tool_name)
        .map(|tool| tool.risk != ApprovalRisk::Read)
        .unwrap_or(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gateway::config::GatewayConfig;
    use crate::gateway::types::{
        GatewayAgentKind, GatewayConfidenceBand, GatewayDecisionPolicy, GatewayModelTier,
        GatewayRoute, GatewaySensitivity, RouteLevel,
    };

    fn integration_ctx(command: &str, capability_id: &str) -> AgentContext {
        AgentContext {
            db_path: std::env::temp_dir().join("jarvis-integration-agent-test.db"),
            app_data_dir: std::env::temp_dir(),
            config: GatewayConfig {
                enabled: true,
                features: crate::gateway::config::GatewayFeatures {
                    notion: true,
                    spotify: true,
                    calendar: true,
                    ocr_notion: true,
                    email_notion: true,
                    gmail: true,
                    ..Default::default()
                },
                ..Default::default()
            },
            route: GatewayRoute {
                capability_id: capability_id.into(),
                capability_label: "Test".into(),
                agent: GatewayAgentKind::Integrations,
                tier: GatewayModelTier::Worker,
                sensitivity: GatewaySensitivity::Personal,
                score: 3,
                confidence: GatewayConfidenceBand::High,
                decision_policy: GatewayDecisionPolicy::Execute,
                decision_reason: "test".into(),
                reason: "test".into(),
                route_level: RouteLevel::L0,
                resolved_provider: None,
            },
            session_id: "session".into(),
            turn_id: 1,
            command: command.to_string(),
            step_description: command.to_string(),
            step_kind: "integration".into(),
        }
    }

    #[test]
    fn spotify_handoff_when_flag_enabled() {
        let ctx = integration_ctx("pause spotify", "integrations.spotify");
        let result = IntegrationsAgent.run_step(&ctx).expect("step");
        assert!(result.success);
        assert_eq!(
            result.integration_handoff.as_ref().map(|h| h.action.as_str()),
            Some("pause")
        );
    }

    #[test]
    fn calendar_handoff_for_nl_create() {
        let ctx = integration_ctx(
            "add gym tomorrow at 6 PM to my calendar",
            "integrations.calendar",
        );
        let result = IntegrationsAgent.run_step(&ctx).expect("step");
        assert!(result.success);
        assert_eq!(
            result.integration_handoff.as_ref().map(|h| h.action.as_str()),
            Some("create_from_nl")
        );
    }

    #[test]
    fn email_notion_handoff_for_current_email() {
        let ctx = integration_ctx("save this email to notion", "integrations.email_notion");
        let result = IntegrationsAgent.run_step(&ctx).expect("step");
        assert!(result.success);
        assert_eq!(
            result.integration_handoff.as_ref().map(|h| h.action.as_str()),
            Some("save_current_email")
        );
    }

    #[test]
    fn email_notion_handoff_for_first_emails_batch() {
        let ctx = integration_ctx("save first 3 emails to notion", "integrations.email_notion");
        let result = IntegrationsAgent.run_step(&ctx).expect("step");
        assert!(result.success);
        assert_eq!(
            result.integration_handoff.as_ref().map(|h| h.action.as_str()),
            Some("save_first_emails")
        );
        assert_eq!(
            result.integration_handoff.as_ref().and_then(|h| h.payload.as_deref()),
            Some("3")
        );
    }

    #[test]
    fn gmail_handoff_for_read_email_by_index() {
        let ctx = integration_ctx("read email 2", "integrations.google");
        let result = IntegrationsAgent.run_step(&ctx).expect("step");
        assert!(result.success);
        assert_eq!(
            result.integration_handoff.as_ref().map(|h| h.action.as_str()),
            Some("read_email_by_index")
        );
    }

    #[test]
    fn gmail_handoff_reply_names_degraded_bridge_path() {
        let ctx = integration_ctx("check gmail", "integrations.google");
        let result = IntegrationsAgent.run_step(&ctx).expect("step");

        assert!(result.success);
        assert!(result.reply.contains("Gmail bridge degraded mode"));
        assert!(result.reply.contains("desktop mail client"));
    }

    #[test]
    fn ocr_watch_handoff_for_start_watch() {
        let ctx = integration_ctx(
            "watch chrome every 30 seconds and log to notion",
            "integrations.ocr_notion",
        );
        let result = IntegrationsAgent.run_step(&ctx).expect("step");
        assert!(result.success);
        assert_eq!(
            result.integration_handoff.as_ref().map(|h| h.action.as_str()),
            Some("start_ocr_watch")
        );
    }
}
