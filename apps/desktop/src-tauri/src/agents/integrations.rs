use serde_json::{json, Value};

use super::{Agent, AgentContext, StepResult};
use crate::gateway::mcp_host::call_mcp_tool;
use crate::gateway::models::{
    find_email_by_query, get_current_email, get_email_by_index, store_session_emails,
};
use crate::gateway::tools::list_tool_definitions;
use crate::gateway::types::{ApprovalRisk, GatewayAgentKind};
use crate::integrations::{
    google::{self, calendar as google_calendar, gmail as google_gmail},
    notion::{self, format_notes_reply},
    parse_calendar_command, parse_email_notion_command, parse_gmail_command, parse_notion_command,
    parse_ocr_notion_command, parse_ocr_watch_command, parse_spotify_command, CalendarAction,
    EmailNotionAction, GmailAction, NotionAction, OcrNotionAction, SpotifyAction,
};

pub struct IntegrationsAgent;

impl Agent for IntegrationsAgent {
    fn kind(&self) -> GatewayAgentKind {
        GatewayAgentKind::Integrations
    }

    fn run_step(&self, ctx: &AgentContext) -> Result<StepResult, String> {
        match ctx.step_kind.as_str() {
            "list_unread_emails"
            | "search_gmail"
            | "read_current_email"
            | "read_email_by_index"
            | "read_email_by_query"
            | "triage_gmail_inbox"
            | "draft_gmail_reply" => return run_gmail(ctx),
            "list_today_calendar_events"
            | "create_calendar_event"
            | "create_calendar_event_from_current_email" => return run_calendar(ctx),
            "spotify_play" | "spotify_pause" | "spotify_next" | "spotify_previous"
            | "spotify_play_query" => return run_spotify(ctx),
            "notion_list_notes"
            | "notion_search_notes"
            | "notion_create_note"
            | "notion_create_task" => return run_notion(ctx),
            "read_screen_save_to_notion"
            | "save_ocr_history_to_notion"
            | "save_screen_text_to_notion"
            | "start_ocr_watch"
            | "stop_ocr_watch"
            | "show_ocr_watches"
            | "pause_ocr_watches"
            | "resume_ocr_watches" => return run_ocr_notion(ctx),
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
            "integrations.mcp.host"
            | "integrations.mcp.github"
            | "integrations.mcp.jira"
            | "integrations.mcp.huggingface"
            | "integrations.mcp.zapier" => run_mcp(ctx),
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
            let note = notion::create_note(&ctx.db_path, &format!("Task: {}", title.trim()))?;
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

    let token = match google::get_session_token("gmail") {
        Ok(token) => token,
        Err(_) => {
            return Ok(StepResult::failed(
                "Gmail is not connected yet. Connect Gmail in Settings first.",
            ));
        }
    };

    let action = parse_gmail_command(&ctx.command).unwrap_or(GmailAction::ListUnread);
    match action {
        GmailAction::ListUnread => {
            let emails = google_gmail::list_unread(&token, 5)?;
            store_session_emails(&ctx.session_id, emails.clone());
            Ok(StepResult::ok(google_gmail::format_unread_reply(&emails)))
        }
        GmailAction::TriageInbox => {
            let emails = google_gmail::list_unread(&token, 5)?;
            store_session_emails(&ctx.session_id, emails.clone());
            Ok(StepResult::ok(google_gmail::format_triage_reply(&emails)))
        }
        GmailAction::Search { query } => {
            let emails = google_gmail::search(&token, &query, 5)?;
            store_session_emails(&ctx.session_id, emails.clone());
            Ok(StepResult::ok(google_gmail::format_search_reply(
                &query, &emails,
            )))
        }
        GmailAction::ReadCurrentEmail => {
            let email = get_current_email(&ctx.session_id).ok_or_else(|| {
                "There is no loaded email to read yet. Ask JARVIS to show unread emails or search Gmail first.".to_string()
            })?;
            Ok(StepResult::ok(google_gmail::format_read_reply(&email)))
        }
        GmailAction::ReadEmailByIndex { index } => {
            let email = get_email_by_index(&ctx.session_id, index).ok_or_else(|| {
                format!(
                    "Email {index} is not loaded right now. Load emails first and then choose a visible email number."
                )
            })?;
            Ok(StepResult::ok(google_gmail::format_read_reply(&email)))
        }
        GmailAction::ReadEmailByQuery { query } => {
            let email = find_email_by_query(&ctx.session_id, &query).ok_or_else(|| {
                format!(
                    "I could not find a loaded email about {query}. Load or search Gmail first."
                )
            })?;
            Ok(StepResult::ok(google_gmail::format_read_reply(&email)))
        }
        GmailAction::DraftReply { index } => {
            if get_email_by_index(&ctx.session_id, index).is_none() {
                let loaded = google_gmail::list_unread(&token, 5)?;
                store_session_emails(&ctx.session_id, loaded);
            }
            let email = get_email_by_index(&ctx.session_id, index).ok_or_else(|| {
                format!(
                    "Email {index} is not loaded right now. Run inbox triage or list unread emails first."
                )
            })?;
            Ok(StepResult::ok(google_gmail::format_draft_reply(&email)))
        }
    }
}

fn run_calendar(ctx: &AgentContext) -> Result<StepResult, String> {
    if !ctx.config.features.calendar {
        return Ok(StepResult::failed(
            "Calendar integration is disabled. Enable gateway.features.calendar first.",
        ));
    }

    let token = match google::get_session_token("calendar") {
        Ok(token) => token,
        Err(_) => {
            return Ok(StepResult::failed(
                "Google Calendar is not connected yet. Connect Google Calendar in Settings first.",
            ));
        }
    };

    let action = parse_calendar_command(&ctx.command).unwrap_or(CalendarAction::CreateFromNl);
    match action {
        CalendarAction::ListToday => {
            let events = google_calendar::list_today(&token)?;
            Ok(StepResult::ok(google_calendar::format_today_reply(&events)))
        }
        CalendarAction::CreateFromNl => {
            let parsed = google_calendar::parse_calendar_from_nl(&ctx.command).ok_or_else(|| {
                "I could not parse a calendar time from that command. Try something like \"add gym tomorrow at 6 PM to my calendar\".".to_string()
            })?;
            let created =
                google_calendar::create_event(&token, &parsed.title, parsed.start, parsed.end)?;
            Ok(StepResult::ok(google_calendar::format_create_reply(
                &created.summary,
                created.html_link.as_deref(),
            )))
        }
        CalendarAction::CreateFromEmail => {
            let email = get_current_email(&ctx.session_id).ok_or_else(|| {
                "There is no loaded email to schedule yet. Load or read an email first.".to_string()
            })?;
            let parsed = google_calendar::build_calendar_from_email(&email).ok_or_else(|| {
                "I could not find a meeting time in the current email.".to_string()
            })?;
            let created =
                google_calendar::create_event(&token, &parsed.title, parsed.start, parsed.end)?;
            Ok(StepResult::ok(google_calendar::format_create_reply(
                &created.summary,
                created.html_link.as_deref(),
            )))
        }
    }
}

fn run_ocr_notion(ctx: &AgentContext) -> Result<StepResult, String> {
    if !ctx.config.features.ocr_notion {
        return Ok(StepResult::failed(
            "OCR to Notion is disabled. Enable gateway.features.ocr_notion first.",
        ));
    }

    if let Some(watch_action) = parse_ocr_watch_command(&ctx.command) {
        let _ = watch_action;
        return crate::agents::ocr_watch::run_ocr_watch_terminal(ctx);
    }

    let action = parse_ocr_notion_command(&ctx.command)
        .ok_or_else(|| "Could not parse an OCR to Notion command.".to_string())?;

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
    if !ctx.config.features.notion {
        return Ok(StepResult::failed(
            "Notion integration is disabled. Enable gateway.features.notion first.",
        ));
    }

    let action = parse_email_notion_command(&ctx.command)
        .ok_or_else(|| "Could not parse an email to Notion command.".to_string())?;

    match action {
        EmailNotionAction::SaveCurrentEmail => {
            let Some(email) = get_current_email(&ctx.session_id) else {
                return Ok(StepResult::failed(
                    "There is no active email in the conversation yet. Open, read, or analyze an email first.",
                ));
            };
            let note = match notion::create_note(
                &ctx.db_path,
                &google_gmail::format_email_for_notion(&email),
            ) {
                Ok(note) => note,
                Err(error) => return Ok(StepResult::failed(error)),
            };
            Ok(StepResult::ok(format!(
                "Saved \"{}\" to Notion as \"{}\" at {}",
                email.subject, note.title, note.url
            )))
        }
        EmailNotionAction::SaveLatestEmail => {
            let Some(email) = get_current_email(&ctx.session_id) else {
                return Ok(StepResult::failed(
                    "There is no loaded email to save yet. Ask JARVIS to show unread emails or search Gmail first.",
                ));
            };
            let note = match notion::create_note(
                &ctx.db_path,
                &google_gmail::format_email_for_notion(&email),
            ) {
                Ok(note) => note,
                Err(error) => return Ok(StepResult::failed(error)),
            };
            Ok(StepResult::ok(format!(
                "Saved \"{}\" to Notion as \"{}\" at {}",
                email.subject, note.title, note.url
            )))
        }
        _ => {
            let (action_name, payload) = match action {
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
                EmailNotionAction::SaveEmailByQuery { query } => {
                    ("save_email_by_query", Some(query))
                }
                EmailNotionAction::SaveTravelByIndex { index } => {
                    ("save_travel_by_index", Some(index.to_string()))
                }
                EmailNotionAction::SaveTravelByQuery { query } => {
                    ("save_travel_by_query", Some(query))
                }
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
                EmailNotionAction::SaveCurrentEmail | EmailNotionAction::SaveLatestEmail => {
                    unreachable!("handled above")
                }
            };

            Ok(StepResult::handoff(
                "integrations.email_notion",
                action_name,
                payload,
                format!(
                    "Handing off email to Notion action `{action_name}` to the desktop bridge."
                ),
            ))
        }
    }
}

fn run_mcp(ctx: &AgentContext) -> Result<StepResult, String> {
    let parsed = parse_mcp_command(&ctx.command)
        .or_else(|| parse_github_nl_command(&ctx.command))
        .or_else(|| parse_jira_nl_command(&ctx.command))
        .or_else(|| parse_huggingface_nl_command(&ctx.command))
        .or_else(|| parse_zapier_nl_command(&ctx.command));

    let Some((host_id, tool_name, arguments)) = parsed else {
        return Ok(StepResult::failed(
            "MCP commands use: mcp <host-id> <tool-name> [json-args], or try 'list github issues'.",
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

    let config = config_with_preset_host(&ctx.config, &host_id);
    match call_mcp_tool(&config, &host_id, &tool_name, arguments) {
        Ok(reply) => Ok(StepResult::ok(reply)),
        Err(error) => Ok(StepResult::failed(error)),
    }
}

fn config_with_preset_host(
    config: &crate::gateway::config::GatewayConfig,
    host_id: &str,
) -> crate::gateway::config::GatewayConfig {
    if config.mcp_hosts.iter().any(|entry| entry.id == host_id) {
        return config.clone();
    }
    if let Some(preset) = crate::gateway::mcp_presets::list_mcp_presets()
        .into_iter()
        .find(|entry| entry.id == host_id)
    {
        let mut next = config.clone();
        next.mcp_hosts
            .push(crate::gateway::mcp_presets::preset_to_host(&preset));
        return next;
    }
    config.clone()
}

fn parse_github_nl_command(command: &str) -> Option<(String, String, Value)> {
    let normalized = command.trim().to_lowercase();
    if !normalized.contains("github")
        && !normalized.contains("pull request")
        && !normalized.contains(" prs")
        && !normalized.contains("issues")
    {
        return None;
    }

    let host_id = "github".to_string();
    let default_repo = std::env::var("JARVIS_GITHUB_DEFAULT_REPO")
        .ok()
        .filter(|value| !value.trim().is_empty());

    if normalized.contains("pull request")
        || normalized.contains(" open pr")
        || normalized.contains(" prs")
        || normalized.contains("github pr")
    {
        let args = github_repo_args(default_repo.as_deref());
        return Some((host_id, "list_pull_requests".to_string(), args));
    }

    if normalized.contains("issue") || normalized.contains("github") {
        let args = github_repo_args(default_repo.as_deref());
        return Some((host_id, "list_issues".to_string(), args));
    }

    if normalized.contains("repo") {
        let query = normalized
            .replace("search github repos", "")
            .replace("my github repos", "")
            .trim()
            .to_string();
        return Some((
            host_id,
            "search_repositories".to_string(),
            json!({ "query": if query.is_empty() { "jarvis" } else { query.as_str() } }),
        ));
    }

    None
}

fn github_repo_args(default_repo: Option<&str>) -> Value {
    if let Some(repo) = default_repo {
        if let Some((owner, repo_name)) = repo.split_once('/') {
            return json!({ "owner": owner, "repo": repo_name });
        }
    }
    json!({})
}

fn parse_jira_nl_command(command: &str) -> Option<(String, String, Value)> {
    let normalized = command.trim().to_lowercase();
    if !normalized.contains("jira") {
        return None;
    }
    Some((
        "jira".to_string(),
        "search_issues".to_string(),
        json!({ "jql": "order by updated DESC" }),
    ))
}

fn parse_huggingface_nl_command(command: &str) -> Option<(String, String, Value)> {
    let normalized = command.trim().to_lowercase();
    if !normalized.contains("huggingface") && !normalized.contains("hf models") {
        return None;
    }
    let query = normalized
        .replace("search huggingface models", "")
        .replace("search huggingface", "")
        .replace("huggingface models", "")
        .replace("hf models", "")
        .replace("find a model on huggingface", "")
        .trim()
        .to_string();
    Some((
        "huggingface".to_string(),
        "search_models".to_string(),
        json!({ "query": if query.is_empty() { "llama" } else { query.as_str() } }),
    ))
}

fn parse_zapier_nl_command(command: &str) -> Option<(String, String, Value)> {
    let normalized = command.trim().to_lowercase();
    if !normalized.contains("zapier") && !normalized.contains("zaps") {
        return None;
    }
    Some(("zapier".to_string(), "list_actions".to_string(), json!({})))
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
            result
                .integration_handoff
                .as_ref()
                .map(|h| h.action.as_str()),
            Some("pause")
        );
    }

    #[test]
    fn gmail_execution_lists_unread_when_token_present() {
        use std::collections::HashMap;

        use crate::gateway::models::clear_all_session_emails;
        use crate::integrations::google::{auth, client};

        const LIST_FIXTURE: &str = r#"{"messages":[{"id":"msg-1","threadId":"thread-1"}]}"#;
        const MESSAGE_FIXTURE: &str = r#"{
          "id":"msg-1","threadId":"thread-1","snippet":"Hello",
          "payload":{"mimeType":"text/plain","headers":[{"name":"Subject","value":"Hello"},{"name":"From","value":"a@example.com"}],"body":{"data":"SGVsbG8="}}
        }"#;

        auth::set_test_tokens(HashMap::from([("gmail".to_string(), "token".to_string())]));
        client::set_mock_responses(HashMap::from([
            (
                "/users/me/messages?labelIds=INBOX".to_string(),
                LIST_FIXTURE.to_string(),
            ),
            (
                "/users/me/messages/msg-1?format=full".to_string(),
                MESSAGE_FIXTURE.to_string(),
            ),
        ]));

        clear_all_session_emails();
        let ctx = integration_ctx("check gmail", "integrations.google");
        let result = IntegrationsAgent.run_step(&ctx).expect("step");
        assert!(result.success);
        assert!(result.integration_handoff.is_none());
        assert!(result.reply.contains("unread emails"));

        client::clear_mock_responses();
        auth::clear_test_tokens();
        clear_all_session_emails();
    }

    #[test]
    fn gmail_fails_with_clear_message_when_token_missing() {
        let ctx = integration_ctx("check gmail", "integrations.google");
        let result = IntegrationsAgent.run_step(&ctx).expect("step");
        assert!(!result.success);
        assert!(result.reply.contains("Gmail is not connected"));
    }

    #[test]
    fn calendar_execution_lists_today_when_token_present() {
        use std::collections::HashMap;

        use crate::integrations::google::{auth, client};

        auth::set_test_tokens(HashMap::from([(
            "calendar".to_string(),
            "token".to_string(),
        )]));
        client::set_mock_responses(HashMap::from([(
            "/calendars/primary/events".to_string(),
            r#"{"items":[{"id":"evt-1","summary":"Standup","start":{"dateTime":"2026-06-14T09:00:00-04:00"},"end":{"dateTime":"2026-06-14T09:30:00-04:00"}}]}"#
                .to_string(),
        )]));

        let ctx = integration_ctx("what's on my calendar today", "integrations.calendar");
        let result = IntegrationsAgent.run_step(&ctx).expect("step");
        assert!(result.success);
        assert!(result.integration_handoff.is_none());
        assert!(result.reply.contains("Standup"));

        client::clear_mock_responses();
        auth::clear_test_tokens();
    }

    #[test]
    fn calendar_handoff_for_nl_create() {
        use std::collections::HashMap;

        use crate::integrations::google::{auth, client};

        auth::set_test_tokens(HashMap::from([(
            "calendar".to_string(),
            "token".to_string(),
        )]));
        client::set_mock_responses(HashMap::from([(
            "/calendars/primary/events".to_string(),
            r#"{"id":"evt-2","summary":"gym","htmlLink":"https://calendar.google.com/event?eid=2"}"#
                .to_string(),
        )]));

        let ctx = integration_ctx(
            "add gym tomorrow at 6 PM to my calendar",
            "integrations.calendar",
        );
        let result = IntegrationsAgent.run_step(&ctx).expect("step");
        assert!(result.success);
        assert!(result.integration_handoff.is_none());
        assert!(result.reply.contains("gym"));

        client::clear_mock_responses();
        auth::clear_test_tokens();
    }

    #[test]
    fn email_notion_save_current_skips_handoff_without_notion_config() {
        use crate::db::init_database;
        use crate::gateway::models::{
            clear_session_emails, get_current_email, store_session_emails, GmailMessageRecord,
        };

        let session = format!("email-notion-save-current-{}", std::process::id());
        clear_session_emails(&session);
        store_session_emails(
            &session,
            vec![GmailMessageRecord {
                id: "1".into(),
                thread_id: "t1".into(),
                subject: "Invoice".into(),
                from: "billing@example.com".into(),
                snippet: String::new(),
                date: String::new(),
                body: "Please pay".into(),
            }],
        );
        assert!(get_current_email(&session).is_some());

        let db_path = std::env::temp_dir().join(format!(
            "jarvis-email-notion-agent-{}.db",
            std::process::id()
        ));
        let _ = std::fs::remove_file(&db_path);
        init_database(&db_path).expect("init db");

        let mut ctx = integration_ctx("save this email to notion", "integrations.email_notion");
        ctx.session_id = session.clone();
        ctx.db_path = db_path;

        let result = IntegrationsAgent.run_step(&ctx).expect("step");
        assert!(result.integration_handoff.is_none());

        clear_session_emails(&session);
    }

    #[test]
    fn email_notion_handoff_for_first_emails_batch() {
        let ctx = integration_ctx("save first 3 emails to notion", "integrations.email_notion");
        let result = IntegrationsAgent.run_step(&ctx).expect("step");
        assert!(result.success);
        assert_eq!(
            result
                .integration_handoff
                .as_ref()
                .map(|h| h.action.as_str()),
            Some("save_first_emails")
        );
        assert_eq!(
            result
                .integration_handoff
                .as_ref()
                .and_then(|h| h.payload.as_deref()),
            Some("3")
        );
    }

    #[test]
    fn gmail_read_by_index_uses_session_email_store() {
        use crate::gateway::models::{
            clear_all_session_emails, store_session_emails, GmailMessageRecord,
        };
        use std::collections::HashMap;

        use crate::integrations::google::auth;

        auth::set_test_tokens(HashMap::from([("gmail".to_string(), "token".to_string())]));
        clear_all_session_emails();
        store_session_emails(
            "session",
            vec![
                GmailMessageRecord {
                    id: "1".into(),
                    thread_id: "t1".into(),
                    subject: "First".into(),
                    from: "a@example.com".into(),
                    snippet: String::new(),
                    date: String::new(),
                    body: "First body".into(),
                },
                GmailMessageRecord {
                    id: "2".into(),
                    thread_id: "t2".into(),
                    subject: "Second".into(),
                    from: "b@example.com".into(),
                    snippet: String::new(),
                    date: String::new(),
                    body: "Second body".into(),
                },
            ],
        );

        let ctx = integration_ctx("read email 2", "integrations.google");
        let result = IntegrationsAgent.run_step(&ctx).expect("step");
        assert!(result.success);
        assert!(result.reply.contains("Second"));

        auth::clear_test_tokens();
        clear_all_session_emails();
    }

    #[test]
    fn ocr_watch_terminal_for_start_watch() {
        let db_path =
            std::env::temp_dir().join(format!("jarvis-ocr-watch-terminal-{}", std::process::id()));
        let _ = std::fs::remove_file(&db_path);
        let _ = crate::db::init_database(&db_path);

        let mut ctx = integration_ctx(
            "watch chrome every 30 seconds and log to notion",
            "integrations.ocr_notion",
        );
        ctx.db_path = db_path.clone();
        let result = IntegrationsAgent.run_step(&ctx).expect("step");
        assert!(result.success);
        assert!(result.integration_handoff.is_none());
        assert!(result.reply.to_lowercase().contains("ocr watch"));
        let _ = std::fs::remove_file(db_path);
    }

    #[test]
    fn github_nl_command_maps_to_list_issues() {
        let parsed = super::parse_github_nl_command("list github issues");
        assert!(parsed.is_some());
        let (_, tool, _) = parsed.unwrap();
        assert_eq!(tool, "list_issues");
    }

    #[test]
    fn jira_nl_command_maps_to_search_issues() {
        let parsed = super::parse_jira_nl_command("list jira issues");
        assert!(parsed.is_some());
        let (host, tool, _) = parsed.unwrap();
        assert_eq!(host, "jira");
        assert_eq!(tool, "search_issues");
    }
}
