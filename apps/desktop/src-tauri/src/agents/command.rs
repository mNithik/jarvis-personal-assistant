use super::{
    extract_file_search_query, extract_google_search_query, extract_pdf_search_query,
    is_list_pdfs_command, open_target_from_command, parse_clipboard_command,
    parse_pdf_command_action, Agent, AgentContext, ClipboardCommandAction, PdfCommandAction,
    StepResult,
};
use crate::commands::{clipboard, desktop, files};
use crate::db::{list_active_tasks, list_recent_task_states};
use crate::gateway::task_run::is_list_task_runs_command;
use crate::gateway::types::GatewayAgentKind;

pub struct CommandAgent;

impl Agent for CommandAgent {
    fn kind(&self) -> GatewayAgentKind {
        GatewayAgentKind::Command
    }

    fn run_step(&self, ctx: &AgentContext) -> Result<StepResult, String> {
        if ctx.route.capability_id == "platform.profiles" {
            return run_profile_switch(ctx);
        }
        if ctx.route.capability_id == "platform.skill" {
            return run_installed_skill(ctx);
        }
        if ctx.route.capability_id == "labs.ambient" {
            return run_ambient_command(ctx);
        }

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
            "mission_control" => run_mission_control(ctx),
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

fn run_mission_control(ctx: &AgentContext) -> Result<StepResult, String> {
    if is_list_task_runs_command(&ctx.command) {
        let runs = list_recent_task_states(&ctx.db_path, 10)?;
        if runs.is_empty() {
            return Ok(StepResult::ok(
                "Mission control: no saved task runs yet.".to_string(),
            ));
        }
        let summary = runs
            .iter()
            .enumerate()
            .map(|(index, run)| {
                format!(
                    "{}. [{}] {} — step {} ({})",
                    index + 1,
                    run.status,
                    run.goal,
                    run.current_step + 1,
                    run.updated_at
                )
            })
            .collect::<Vec<_>>()
            .join("\n");
        return Ok(StepResult::ok(format!(
            "Mission control — recent task runs:\n{summary}"
        )));
    }

    let active = list_active_tasks(&ctx.db_path, &ctx.session_id)?;
    if active.is_empty() {
        return Ok(StepResult::ok(
            "Mission control: no active tasks for this session.".to_string(),
        ));
    }
    let latest = &active[0];
    Ok(StepResult::ok(format!(
        "Mission control status: \"{}\" is {} at step {}.",
        latest.goal,
        latest.status,
        latest.current_step + 1
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
        PdfCommandAction::OpenCurrent
        | PdfCommandAction::ReadCurrent
        | PdfCommandAction::SummarizeCurrent => files::list_pdf_files()?
            .into_iter()
            .next()
            .ok_or_else(|| "No PDFs found in Documents.".to_string()),
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
    let action = parse_pdf_command_action(&ctx.command).ok_or_else(|| {
        "PDF action needs a command like 'open pdf 2' or 'open pdf about taxes'.".to_string()
    })?;
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

fn run_profile_switch(ctx: &AgentContext) -> Result<StepResult, String> {
    let profile_id = crate::gateway::profiles::profile_id_from_command(&ctx.command)
        .ok_or_else(|| "Specify work, personal, or lab profile.".to_string())?;
    let reply =
        crate::gateway::profiles::switch_profile(&ctx.db_path, &ctx.app_data_dir, profile_id)?;
    Ok(StepResult::ok(reply))
}

fn run_installed_skill(ctx: &AgentContext) -> Result<StepResult, String> {
    let skill =
        crate::gateway::skills::match_dynamic_skill(&ctx.command, &ctx.db_path, &ctx.app_data_dir)
            .ok_or_else(|| "No installed skill matched that command.".to_string())?;
    let skill_root = crate::gateway::skills::skill_root_for_manifest(
        &ctx.db_path,
        &ctx.app_data_dir,
        &skill.id,
    )?;
    Ok(crate::gateway::skills_executor::execute_skill(
        &skill,
        Some(&skill_root),
        &ctx.command,
    ))
}

fn run_ambient_command(ctx: &AgentContext) -> Result<StepResult, String> {
    if !ctx.config.labs.ambient_copilot {
        return Ok(StepResult::ok(
            "Ambient copilot is disabled. Enable gateway.labs.ambientCopilot first.".to_string(),
        ));
    }
    let normalized = ctx.command.to_lowercase();
    if normalized.contains("end ambient") {
        if let Some(session) = crate::gateway::ambient::active_ambient_session(&ctx.db_path)? {
            crate::gateway::ambient::end_ambient_session(&ctx.db_path, &session.id)?;
            return Ok(StepResult::ok("Ended ambient copilot session.".to_string()));
        }
        return Ok(StepResult::ok("No active ambient session.".to_string()));
    }
    let session = crate::gateway::ambient::start_ambient_session(&ctx.db_path, None, None, true)?;
    Ok(StepResult::ok(format!(
        "Ambient copilot session {} started. Suggestions are read-only.",
        session.id
    )))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gateway::config::GatewayConfig;
    use crate::gateway::profiles::seed_default_profiles;
    use crate::gateway::skills::{SkillHandler, SkillManifest};
    use crate::gateway::types::{
        GatewayAgentKind, GatewayConfidenceBand, GatewayDecisionPolicy, GatewayModelTier,
        GatewayRoute, GatewaySensitivity, RouteLevel,
    };
    use std::io::{Read, Write};
    use std::net::TcpListener;

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

    fn skill_ctx(command: &str, manifest: &SkillManifest) -> AgentContext {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let app_data_dir = std::env::temp_dir().join(format!("jarvis-skill-exec-{nanos}"));
        let db_path = std::env::temp_dir().join(format!("jarvis-skill-exec-{nanos}.db"));
        std::fs::create_dir_all(&app_data_dir).expect("app data");
        seed_default_profiles(&db_path, &app_data_dir).expect("seed");
        let skill_dir = app_data_dir.join("skills").join(&manifest.id);
        std::fs::create_dir_all(&skill_dir).expect("skill dir");
        let raw = serde_json::to_string_pretty(manifest).expect("serialize manifest");
        std::fs::write(skill_dir.join("skill.json"), raw).expect("write manifest");

        let mut ctx = command_ctx(command, "installed_skill");
        ctx.db_path = db_path;
        ctx.app_data_dir = app_data_dir;
        ctx.route.capability_id = "platform.skill".into();
        ctx
    }

    fn cleanup_skill_ctx(ctx: &AgentContext) {
        let _ = std::fs::remove_dir_all(&ctx.app_data_dir);
        let _ = std::fs::remove_file(&ctx.db_path);
    }

    #[test]
    fn installed_http_skill_executes_local_get() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
        let port = listener.local_addr().expect("addr").port();
        let handle = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept");
            let mut request = [0_u8; 1024];
            let _ = stream.read(&mut request);
            let response = b"HTTP/1.1 200 OK\r\nContent-Length: 11\r\n\r\nhello world";
            stream.write_all(response).expect("write response");
        });

        let manifest = SkillManifest {
            id: "local-http".into(),
            version: "1.0.0".into(),
            label: "Local Http".into(),
            keywords: vec!["local http".into()],
            agent: "command".into(),
            permissions: vec!["read".into()],
            enabled: true,
            handler: SkillHandler::Http {
                url: format!("http://127.0.0.1:{port}/health"),
                method: "GET".into(),
            },
        };
        let ctx = skill_ctx("run local http", &manifest);

        let result = run_installed_skill(&ctx).expect("run skill");
        assert!(result.success);
        assert!(result.reply.contains("hello world"));

        handle.join().expect("join");
        cleanup_skill_ctx(&ctx);
    }

    #[test]
    fn installed_http_skill_rejects_non_local_url() {
        let manifest = SkillManifest {
            id: "remote-http".into(),
            version: "1.0.0".into(),
            label: "Remote Http".into(),
            keywords: vec!["remote http".into()],
            agent: "command".into(),
            permissions: vec!["read".into()],
            enabled: true,
            handler: SkillHandler::Http {
                url: "https://example.com".into(),
                method: "GET".into(),
            },
        };
        let ctx = skill_ctx("run remote http", &manifest);

        let result = run_installed_skill(&ctx).expect("run skill");
        assert!(!result.success);
        assert!(result.reply.to_lowercase().contains("local"));

        cleanup_skill_ctx(&ctx);
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn installed_script_skill_executes_safe_command() {
        let manifest = SkillManifest {
            id: "script-echo".into(),
            version: "1.0.0".into(),
            label: "Script Echo".into(),
            keywords: vec!["script echo".into()],
            agent: "command".into(),
            permissions: vec!["execute".into()],
            enabled: true,
            handler: SkillHandler::Script {
                command: "cmd /C echo hello-script".into(),
            },
        };
        let ctx = skill_ctx("run script echo", &manifest);

        let result = run_installed_skill(&ctx).expect("run skill");
        assert!(result.success);
        assert!(result.reply.to_lowercase().contains("hello-script"));

        cleanup_skill_ctx(&ctx);
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn installed_script_skill_rejects_unsafe_command() {
        let manifest = SkillManifest {
            id: "script-unsafe".into(),
            version: "1.0.0".into(),
            label: "Script Unsafe".into(),
            keywords: vec!["script unsafe".into()],
            agent: "command".into(),
            permissions: vec!["execute".into()],
            enabled: true,
            handler: SkillHandler::Script {
                command: "cmd /C echo hi && dir".into(),
            },
        };
        let ctx = skill_ctx("run script unsafe", &manifest);

        let result = run_installed_skill(&ctx).expect("run skill");
        assert!(!result.success);
        assert!(result.reply.to_lowercase().contains("unsafe"));

        cleanup_skill_ctx(&ctx);
    }

    #[test]
    fn installed_wasm_skill_resolves_its_skill_directory_context() {
        let manifest = SkillManifest {
            id: "wasm-skill".into(),
            version: "1.0.0".into(),
            label: "Wasm Skill".into(),
            keywords: vec!["wasm skill".into()],
            agent: "command".into(),
            permissions: vec![],
            enabled: true,
            handler: SkillHandler::Wasm {
                module: "dist/skill.wasm".into(),
                entrypoint: Some("run".into()),
            },
        };
        let ctx = skill_ctx("run wasm skill", &manifest);

        let result = run_installed_skill(&ctx).expect("run skill");
        assert!(!result.success);
        assert!(result.reply.contains("not wired yet"));

        cleanup_skill_ctx(&ctx);
    }
}
