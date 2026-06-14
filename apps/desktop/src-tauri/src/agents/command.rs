use super::{
    extract_file_search_query, extract_google_search_query, extract_pdf_search_query,
    is_list_pdfs_command, open_target_from_command, parse_pdf_command_action, Agent, AgentContext,
    PdfCommandAction, StepResult,
};
use crate::commands::{desktop, files};
use crate::gateway::types::GatewayAgentKind;

pub struct CommandAgent;

impl Agent for CommandAgent {
    fn kind(&self) -> GatewayAgentKind {
        GatewayAgentKind::Command
    }

    fn run_step(&self, ctx: &AgentContext) -> Result<StepResult, String> {
        match ctx.step_kind.as_str() {
            "study_setup" => run_study(ctx),
            "search_files" => run_search_files(ctx),
            "google_search" => run_google_search(ctx),
            "list_recent_files" => run_list_recent_files(),
            "list_pdfs" => run_list_pdfs(),
            "search_pdfs" => run_search_pdfs(ctx),
            "open_current_pdf" | "open_pdf_by_index" | "open_pdf_by_query" | "read_current_pdf"
            | "read_pdf_by_index" | "read_pdf_by_query" => run_pdf_handoff(ctx),
            "open_desktop" => run_open_desktop(ctx),
            "fake_step" => Ok(StepResult::ok(format!(
                "Completed fake step: {}",
                ctx.step_description
            ))),
            _ => match ctx.route.capability_id.as_str() {
                "command.study" => run_study(ctx),
                "command.search" => {
                    if let Some(query) = extract_google_search_query(&ctx.command) {
                        run_google_search_with_query(&query)
                    } else if let Some(query) = extract_file_search_query(&ctx.command) {
                        run_search_files_with_query(ctx, &query)
                    } else {
                        Ok(StepResult::failed(
                            "Search needs a query like 'search google for rust' or 'search files for budget'.",
                        ))
                    }
                }
                "command.files" => {
                    if is_list_pdfs_command(&ctx.command) {
                        run_list_pdfs()
                    } else if extract_pdf_search_query(&ctx.command).is_some() {
                        run_search_pdfs(ctx)
                    } else if parse_pdf_command_action(&ctx.command).is_some() {
                        run_pdf_handoff(ctx)
                    } else {
                        run_list_recent_files()
                    }
                }
                "command.desktop" => run_open_desktop(ctx),
                _ => Ok(StepResult::failed(format!(
                    "Command agent does not handle capability {} yet.",
                    ctx.route.capability_id
                ))),
            },
        }
    }
}

fn run_study(ctx: &AgentContext) -> Result<StepResult, String> {
    if !ctx.config.features.study_routine {
        return Ok(StepResult::failed(
            "Study routine is disabled. Enable gateway.features.study_routine to run this via the gateway.",
        ));
    }

    let reply = desktop::run_study_setup(&ctx.db_path)?;
    Ok(StepResult::ok(reply))
}

fn run_search_files(ctx: &AgentContext) -> Result<StepResult, String> {
    let query = extract_file_search_query(&ctx.command)
        .or_else(|| open_target_from_command(&ctx.step_description))
        .unwrap_or_else(|| ctx.step_description.clone());
    run_search_files_with_query(ctx, &query)
}

fn run_search_files_with_query(_ctx: &AgentContext, query: &str) -> Result<StepResult, String> {
    let files = files::search_local_files(query)?;
    if files.is_empty() {
        return Ok(StepResult::ok(format!(
            "No files in Documents matched \"{query}\"."
        )));
    }

    let listing = files
        .iter()
        .map(|file| format!("- {} ({})", file.name, file.path))
        .collect::<Vec<_>>()
        .join("\n");
    Ok(StepResult::ok(format!(
        "Found {} file(s) for \"{query}\":\n{listing}",
        files.len()
    )))
}

fn run_google_search(ctx: &AgentContext) -> Result<StepResult, String> {
    let query = extract_google_search_query(&ctx.command)
        .ok_or_else(|| "Google search needs a query like 'search google for rust'.".to_string())?;
    run_google_search_with_query(&query)
}

fn run_google_search_with_query(query: &str) -> Result<StepResult, String> {
    Ok(StepResult::handoff(
        "command.search",
        "search_google",
        Some(query.to_string()),
        format!("Handing off Google search for \"{query}\" to the desktop browser bridge."),
    ))
}

fn run_list_recent_files() -> Result<StepResult, String> {
    Ok(StepResult::handoff(
        "command.files",
        "list_recent_files",
        None,
        "Handing off recent files listing to the desktop files bridge.",
    ))
}

fn run_list_pdfs() -> Result<StepResult, String> {
    Ok(StepResult::handoff(
        "command.files",
        "list_pdfs",
        None,
        "Handing off PDF listing to the desktop files bridge.",
    ))
}

fn run_search_pdfs(ctx: &AgentContext) -> Result<StepResult, String> {
    let query = extract_pdf_search_query(&ctx.command)
        .ok_or_else(|| "PDF search needs a query like 'search pdfs for taxes'.".to_string())?;
    Ok(StepResult::handoff(
        "command.files",
        "search_pdfs",
        Some(query.to_string()),
        format!("Handing off PDF search for \"{query}\" to the desktop files bridge."),
    ))
}

fn run_pdf_handoff(ctx: &AgentContext) -> Result<StepResult, String> {
    let action = parse_pdf_command_action(&ctx.command)
        .ok_or_else(|| "PDF action needs a command like 'open pdf 2' or 'read pdf about taxes'.".to_string())?;
    let (action_name, payload) = match action {
        PdfCommandAction::List => ("list_pdfs", None),
        PdfCommandAction::Search { query } => ("search_pdfs", Some(query)),
        PdfCommandAction::OpenCurrent => ("open_current_pdf", None),
        PdfCommandAction::OpenByIndex { index } => ("open_pdf_by_index", Some(index.to_string())),
        PdfCommandAction::OpenByQuery { query } => ("open_pdf_by_query", Some(query)),
        PdfCommandAction::ReadCurrent => ("read_current_pdf", None),
        PdfCommandAction::ReadByIndex { index } => ("read_pdf_by_index", Some(index.to_string())),
        PdfCommandAction::ReadByQuery { query } => ("read_pdf_by_query", Some(query)),
    };
    Ok(StepResult::handoff(
        "command.files",
        action_name,
        payload,
        format!("Handing off PDF action `{action_name}` to the desktop files bridge."),
    ))
}

fn run_open_desktop(ctx: &AgentContext) -> Result<StepResult, String> {
    let target = open_target_from_command(&ctx.step_description)
        .or_else(|| open_target_from_command(&ctx.command))
        .ok_or_else(|| "Could not determine which app to open.".to_string())?;
    let reply = desktop::open_named_target(&ctx.db_path, &target)?;
    Ok(StepResult::ok(reply))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gateway::config::GatewayConfig;
    use crate::gateway::types::{
        GatewayAgentKind, GatewayConfidenceBand, GatewayDecisionPolicy, GatewayModelTier,
        GatewayRoute, GatewaySensitivity, RouteLevel,
    };

    fn command_ctx(command: &str, step_kind: &str) -> AgentContext {
        AgentContext {
            db_path: std::env::temp_dir().join("jarvis-command-agent-test.db"),
            app_data_dir: std::env::temp_dir(),
            config: GatewayConfig::default(),
            route: GatewayRoute {
                capability_id: "command.search".into(),
                capability_label: "Search".into(),
                agent: GatewayAgentKind::Command,
                tier: GatewayModelTier::Local,
                sensitivity: GatewaySensitivity::Public,
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
            step_description: "Search Google".into(),
            step_kind: step_kind.into(),
        }
    }

    #[test]
    fn google_search_step_hands_off_to_desktop_bridge() {
        let ctx = command_ctx("search google for rust traits", "google_search");
        let result = CommandAgent.run_step(&ctx).expect("step");

        assert!(result.success);
        assert_eq!(
            result.integration_handoff.as_ref().map(|handoff| handoff.capability_id.as_str()),
            Some("command.search")
        );
        assert_eq!(
            result.integration_handoff.as_ref().map(|handoff| handoff.action.as_str()),
            Some("search_google")
        );
        assert_eq!(
            result.integration_handoff.as_ref().and_then(|handoff| handoff.payload.as_deref()),
            Some("rust traits")
        );
    }

    #[test]
    fn recent_files_step_hands_off_to_desktop_bridge() {
        let ctx = command_ctx("show recent files", "list_recent_files");
        let result = CommandAgent.run_step(&ctx).expect("step");

        assert!(result.success);
        assert_eq!(
            result.integration_handoff.as_ref().map(|handoff| handoff.capability_id.as_str()),
            Some("command.files")
        );
        assert_eq!(
            result.integration_handoff.as_ref().map(|handoff| handoff.action.as_str()),
            Some("list_recent_files")
        );
    }

    #[test]
    fn pdf_file_steps_hand_off_to_desktop_bridge() {
        let list_ctx = command_ctx("list pdfs", "list_pdfs");
        let search_ctx = command_ctx("search pdfs for taxes", "search_pdfs");

        let list_result = CommandAgent.run_step(&list_ctx).expect("list step");
        let search_result = CommandAgent.run_step(&search_ctx).expect("search step");

        assert_eq!(
            list_result.integration_handoff.as_ref().map(|handoff| handoff.action.as_str()),
            Some("list_pdfs")
        );
        assert_eq!(
            search_result.integration_handoff.as_ref().map(|handoff| handoff.action.as_str()),
            Some("search_pdfs")
        );
        assert_eq!(
            search_result.integration_handoff.as_ref().and_then(|handoff| handoff.payload.as_deref()),
            Some("taxes")
        );
    }

    #[test]
    fn pdf_open_and_read_steps_hand_off_to_desktop_bridge() {
        let open_index_ctx = command_ctx("open pdf 2", "open_pdf_by_index");
        let read_query_ctx = command_ctx("read pdf about taxes", "read_pdf_by_query");
        let open_current_ctx = command_ctx("open this pdf", "open_current_pdf");

        let open_index = CommandAgent.run_step(&open_index_ctx).expect("open index");
        let read_query = CommandAgent.run_step(&read_query_ctx).expect("read query");
        let open_current = CommandAgent.run_step(&open_current_ctx).expect("open current");

        assert_eq!(
            open_index.integration_handoff.as_ref().map(|handoff| handoff.action.as_str()),
            Some("open_pdf_by_index")
        );
        assert_eq!(
            open_index.integration_handoff.as_ref().and_then(|handoff| handoff.payload.as_deref()),
            Some("2")
        );
        assert_eq!(
            read_query.integration_handoff.as_ref().map(|handoff| handoff.action.as_str()),
            Some("read_pdf_by_query")
        );
        assert_eq!(
            read_query.integration_handoff.as_ref().and_then(|handoff| handoff.payload.as_deref()),
            Some("taxes")
        );
        assert_eq!(
            open_current.integration_handoff.as_ref().map(|handoff| handoff.action.as_str()),
            Some("open_current_pdf")
        );
    }
}
