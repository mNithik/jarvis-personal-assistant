use super::{
    extract_file_search_query, extract_google_search_query, extract_pdf_search_query,
    is_list_pdfs_command, open_target_from_command, parse_clipboard_command,
    parse_pdf_command_action, Agent, AgentContext, ClipboardCommandAction, PdfCommandAction,
    StepResult,
};
use crate::commands::{clipboard, desktop, files};
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
            "open_current_pdf" | "open_pdf_by_index" | "open_pdf_by_query" => run_open_pdf(ctx),
            "read_current_pdf" | "read_pdf_by_index" | "read_pdf_by_query" => run_read_pdf(ctx),
            "summarize_current_pdf" | "summarize_pdf_by_index" | "summarize_pdf_by_query" => {
                run_summarize_pdf(ctx)
            }
            "clipboard_action" => run_clipboard(ctx),
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
                        if matches!(
                            parse_pdf_command_action(&ctx.command),
                            Some(
                                PdfCommandAction::ReadCurrent
                                    | PdfCommandAction::ReadByIndex { .. }
                                    | PdfCommandAction::ReadByQuery { .. }
                            )
                        ) {
                            run_read_pdf(ctx)
                        } else if matches!(
                            parse_pdf_command_action(&ctx.command),
                            Some(
                                PdfCommandAction::SummarizeCurrent
                                    | PdfCommandAction::SummarizeByIndex { .. }
                                    | PdfCommandAction::SummarizeByQuery { .. }
                            )
                        ) {
                            run_summarize_pdf(ctx)
                        } else {
                            run_open_pdf(ctx)
                        }
                    } else {
                        run_list_recent_files()
                    }
                }
                "command.clipboard" => run_clipboard(ctx),
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

    Ok(StepResult::ok(files::format_file_listing(
        &files,
        &format!("Found {} file(s) for \"{query}\"", files.len()),
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
    let files = files::list_recent_local_files(10)?;
    Ok(StepResult::ok(files::format_file_listing(
        &files,
        &format!("Found {} recent file(s) in Documents", files.len()),
    )))
}

fn run_list_pdfs() -> Result<StepResult, String> {
    let pdfs = files::list_pdf_files()?;
    Ok(StepResult::ok(files::format_file_listing(
        &pdfs,
        &format!("Found {} PDF(s) in Documents", pdfs.len()),
    )))
}

fn run_search_pdfs(ctx: &AgentContext) -> Result<StepResult, String> {
    let query = extract_pdf_search_query(&ctx.command)
        .ok_or_else(|| "PDF search needs a query like 'search pdfs for taxes'.".to_string())?;
    let pdfs = files::search_pdf_files(&query)?;
    Ok(StepResult::ok(files::format_file_listing(
        &pdfs,
        &format!("PDF search results for \"{query}\""),
    )))
}

fn resolve_pdf_from_action(action: PdfCommandAction) -> Result<crate::models::FileRecord, String> {
    match action {
        PdfCommandAction::OpenCurrent | PdfCommandAction::ReadCurrent | PdfCommandAction::SummarizeCurrent => {
            files::list_pdf_files()?
                .into_iter()
                .next()
                .ok_or_else(|| "No PDFs found in Documents.".to_string())
        }
        PdfCommandAction::OpenByIndex { index }
        | PdfCommandAction::ReadByIndex { index }
        | PdfCommandAction::SummarizeByIndex { index } => files::list_pdf_files()?
            .into_iter()
            .nth((index as usize).saturating_sub(1))
            .ok_or_else(|| format!("PDF index {index} is out of range.")),
        PdfCommandAction::OpenByQuery { query }
        | PdfCommandAction::ReadByQuery { query }
        | PdfCommandAction::SummarizeByQuery { query } => files::search_pdf_files(&query)?
            .into_iter()
            .next()
            .ok_or_else(|| format!("No PDF matched \"{query}\".")),
        PdfCommandAction::List | PdfCommandAction::Search { .. } => {
            Err("Expected a single PDF action.".to_string())
        }
    }
}

fn run_open_pdf(ctx: &AgentContext) -> Result<StepResult, String> {
    let action = parse_pdf_command_action(&ctx.command)
        .ok_or_else(|| "PDF action needs a command like 'open pdf 2' or 'open pdf about taxes'.".to_string())?;
    let file = resolve_pdf_from_action(action)?;
    let reply = files::open_file_path(&file.path)?;
    Ok(StepResult::ok(reply))
}

fn run_read_pdf(ctx: &AgentContext) -> Result<StepResult, String> {
    let action = parse_pdf_command_action(&ctx.command)
        .ok_or_else(|| "PDF read needs a command like 'read pdf 1'.".to_string())?;
    let file = resolve_pdf_from_action(action)?;
    Ok(StepResult::ok(format!(
        "Selected PDF {} at {}. Say \"summarize pdf\" for content extraction.",
        file.name, file.path
    )))
}

fn run_summarize_pdf(ctx: &AgentContext) -> Result<StepResult, String> {
    let action = parse_pdf_command_action(&ctx.command).ok_or_else(|| {
        "PDF summarize needs a command like 'summarize pdf 1' or 'summarize this pdf'.".to_string()
    })?;
    let file = resolve_pdf_from_action(action)?;
    let text = files::extract_pdf_text(&file.path)?;
    let summary = files::summarize_pdf_text(&file.name, &text);
    Ok(StepResult::ok(summary))
}

fn run_clipboard(ctx: &AgentContext) -> Result<StepResult, String> {
    match parse_clipboard_command(&ctx.command) {
        Some(ClipboardCommandAction::Read) => {
            let text = clipboard::read_clipboard_text()?;
            if text.trim().is_empty() {
                Ok(StepResult::ok("Your clipboard is empty.".to_string()))
            } else {
                Ok(StepResult::ok(format!("Clipboard:\n{text}")))
            }
        }
        Some(ClipboardCommandAction::Write { text }) => {
            let reply = clipboard::write_clipboard_text(&text)?;
            Ok(StepResult::ok(reply))
        }
        None => Ok(StepResult::failed(
            "Clipboard commands: 'read clipboard' or 'copy hello to clipboard'.",
        )),
    }
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
            step_description: command.to_string(),
            step_kind: step_kind.to_string(),
        }
    }

    #[test]
    fn list_pdfs_returns_ok_without_handoff() {
        let ctx = command_ctx("list pdfs", "list_pdfs");
        let result = CommandAgent.run_step(&ctx).expect("step");
        assert!(result.success);
        assert!(result.integration_handoff.is_none());
    }

    #[test]
    fn list_recent_files_returns_ok_without_handoff() {
        let mut ctx = command_ctx("show recent files", "list_recent_files");
        ctx.route.capability_id = "command.files".into();
        let result = CommandAgent.run_step(&ctx).expect("step");
        assert!(result.success);
        assert!(result.integration_handoff.is_none());
    }

    #[test]
    fn clipboard_read_returns_ok_without_handoff() {
        let mut ctx = command_ctx("read clipboard", "clipboard_action");
        ctx.route.capability_id = "command.clipboard".into();
        let result = CommandAgent.run_step(&ctx);
        assert!(result.is_ok());
        assert!(result.unwrap().integration_handoff.is_none());
    }
}
