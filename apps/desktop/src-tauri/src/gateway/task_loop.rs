use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::agents::{
    dispatch_step, extract_file_search_query, extract_google_search_query, open_target_from_command,
    parse_pdf_command_action, parse_then_steps, AgentContext,
    PdfCommandAction,
};
use crate::gateway::router::{route_turn, replan_supervisor_step, verify_with_builder, RouterContext};
use crate::gateway::types::TurnRequest;
use crate::db::{list_active_tasks, save_task_state, TaskStateRecord};
use crate::gateway::types::GatewayRoute;
use crate::integrations::{
    parse_calendar_command, parse_gmail_command, parse_notion_command, parse_spotify_command,
    parse_ocr_notion_command, parse_ocr_watch_command, CalendarAction, GmailAction, NotionAction,
    OcrNotionAction, OcrWatchAction, SpotifyAction,
};
use crate::providers::escalation::{EscalationContext, EscalationTracker};

use super::{
    bus::EventBus,
    config::GatewayConfig,
    types::{GatewayAgentKind, GatewayEvent, GatewayEventKind},
};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Planning,
    Running,
    Complete,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StepStatus {
    Pending,
    Running,
    Done,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TaskStep {
    pub id: String,
    pub description: String,
    pub kind: String,
    pub status: StepStatus,
    pub result: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TaskStepsPayload {
    pub failure_count: u32,
    #[serde(default)]
    pub supervisor_recoveries: u32,
    pub steps: Vec<TaskStep>,
}

#[derive(Debug)]
pub struct TaskLoopContext<'a> {
    pub db_path: &'a Path,
    pub app_data_dir: &'a Path,
    pub config: &'a GatewayConfig,
    pub route: &'a GatewayRoute,
    pub session_id: &'a str,
    pub turn_id: u64,
    pub command: &'a str,
    pub bus: &'a mut EventBus,
    pub escalation: &'a mut EscalationTracker,
}

#[derive(Debug, Clone)]
pub struct TaskLoopOutcome {
    pub reply: String,
    pub events: Vec<GatewayEvent>,
    pub task_complete: bool,
    pub success: bool,
    pub integration_handoff: Option<crate::gateway::types::IntegrationHandoff>,
}

pub fn start_or_resume_turn(mut ctx: TaskLoopContext<'_>) -> Result<TaskLoopOutcome, String> {
    let mut events = Vec::new();
    let task = load_or_create_task(&ctx)?;

    let mut payload = parse_steps_payload(&task.steps_json)?;
    let step_index = task.current_step as usize;
    let max_steps = ctx.config.budgets.max_steps_per_turn as usize;
    let max_wall_time_seconds = ctx.config.budgets.max_wall_time_seconds as u64;
    let max_retries = ctx.config.budgets.max_retries_per_step;

    if max_steps > 0 && payload.steps.len() > max_steps {
        persist_task(
            ctx.db_path,
            &task.id,
            ctx.session_id,
            ctx.command,
            TaskStatus::Failed,
            step_index as i64,
            &payload,
        )?;
        return Ok(TaskLoopOutcome {
            reply: format!(
                "Turn step budget exceeded: {} planned steps, max {}. No tools were executed.",
                payload.steps.len(),
                max_steps
            ),
            events,
            task_complete: true,
            success: false,
            integration_handoff: None,
        });
    }

    if max_wall_time_seconds > 0
        && task_age_seconds(&task).is_some_and(|age| age > max_wall_time_seconds)
    {
        persist_task(
            ctx.db_path,
            &task.id,
            ctx.session_id,
            ctx.command,
            TaskStatus::Failed,
            step_index as i64,
            &payload,
        )?;
        return Ok(TaskLoopOutcome {
            reply: format!(
                "Turn wall-time budget exceeded: active task age is over {max_wall_time_seconds} seconds. No tools were executed."
            ),
            events,
            task_complete: true,
            success: false,
            integration_handoff: None,
        });
    }

    if payload.failure_count > max_retries {
        persist_task(
            ctx.db_path,
            &task.id,
            ctx.session_id,
            ctx.command,
            TaskStatus::Failed,
            step_index as i64,
            &payload,
        )?;
        return Ok(TaskLoopOutcome {
            reply: format!(
                "Turn retry budget exceeded: {} failures, max {} retries per step. No tools were executed.",
                payload.failure_count, max_retries
            ),
            events,
            task_complete: true,
            success: false,
            integration_handoff: None,
        });
    }

    if step_index >= payload.steps.len() {
        return Ok(TaskLoopOutcome {
            reply: "Task already completed.".to_string(),
            events,
            task_complete: true,
            success: true,
            integration_handoff: None,
        });
    }

    payload.steps[step_index].status = StepStatus::Running;
    let step = payload.steps[step_index].clone();
    persist_task(
        ctx.db_path,
        &task.id,
        ctx.session_id,
        ctx.command,
        TaskStatus::Running,
        step_index as i64,
        &payload,
    )?;

    events.push(tool_event(
        ctx.session_id,
        ctx.turn_id,
        GatewayEventKind::ToolStart,
        format!("Ralph step {}: {}", step_index + 1, step.description),
    ));

    let step_result = match execute_step_with_recovery(&mut ctx, &step, &mut payload, &mut events) {
        Ok(result) => result,
        Err(error) => {
            payload.failure_count += 1;
            payload.steps[step_index].status = StepStatus::Failed;
            payload.steps[step_index].result = Some(error.clone());
            persist_task(
                ctx.db_path,
                &task.id,
                ctx.session_id,
                ctx.command,
                TaskStatus::Failed,
                step_index as i64,
                &payload,
            )?;
            ctx.escalation
                .record_failure(ctx.session_id, &error, ctx.config);

            if let Some(plan) = ctx.escalation.maybe_escalate(EscalationContext {
                session_id: ctx.session_id,
                command: ctx.command,
                config: ctx.config,
                failure_count: payload.failure_count,
            }) {
                events.push(tool_event(
                    ctx.session_id,
                    ctx.turn_id,
                    GatewayEventKind::Thinking,
                    format!("Escalated to planner: {plan}"),
                ));
            }

            return Ok(TaskLoopOutcome {
                reply: error,
                events,
                task_complete: true,
                success: false,
                integration_handoff: None,
            });
        }
    };

    ctx.escalation.record_success(ctx.session_id);

    payload.steps[step_index].status = if step_result.success {
        StepStatus::Done
    } else {
        StepStatus::Failed
    };
    payload.steps[step_index].result = Some(step_result.reply.clone());

    if ctx.route.agent == GatewayAgentKind::Vision && step_result.success {
        crate::agents::vision::publish_screen_analyzed(
            ctx.bus,
            ctx.session_id,
            ctx.turn_id,
            &step_result.reply,
        );
    }

    let next_index = step_index + 1;
    let task_complete = step_result.done && next_index >= payload.steps.len();
    let status = if task_complete {
        if step_result.success {
            TaskStatus::Complete
        } else {
            TaskStatus::Failed
        }
    } else if step_result.success {
        TaskStatus::Running
    } else {
        TaskStatus::Failed
    };

    persist_task(
        ctx.db_path,
        &task.id,
        ctx.session_id,
        ctx.command,
        status,
        next_index as i64,
        &payload,
    )?;

    if let Some(handoff) = &step_result.integration_handoff {
        events.push(tool_event(
            ctx.session_id,
            ctx.turn_id,
            GatewayEventKind::ToolStart,
            format!(
                "Integration handoff: {} → {}",
                handoff.capability_id, handoff.action
            ),
        ));
    }

    events.push(tool_event(
        ctx.session_id,
        ctx.turn_id,
        if step_result.success {
            GatewayEventKind::ToolEnd
        } else {
            GatewayEventKind::Error
        },
        step_result.reply.clone(),
    ));

    Ok(TaskLoopOutcome {
        reply: step_result.reply,
        events,
        task_complete,
        success: step_result.success,
        integration_handoff: step_result.integration_handoff,
    })
}

fn load_or_create_task(ctx: &TaskLoopContext<'_>) -> Result<TaskStateRecord, String> {
    if let Some(existing) = list_active_tasks(ctx.db_path, ctx.session_id)?
        .into_iter()
        .find(|task| task.goal == ctx.command)
    {
        return Ok(existing);
    }

    let task_id = format!("{}-{}", ctx.session_id, ctx.turn_id);
    let steps = plan_steps(ctx.command, ctx.route);
    let payload = TaskStepsPayload {
        failure_count: 0,
        supervisor_recoveries: 0,
        steps,
    };
    let record = TaskStateRecord {
        id: task_id,
        session_id: ctx.session_id.to_string(),
        goal: ctx.command.to_string(),
        status: "planning".to_string(),
        current_step: 0,
        steps_json: serde_json::to_string(&payload).map_err(|error| error.to_string())?,
        updated_at: iso_timestamp(),
    };
    save_task_state(ctx.db_path, &record)?;
    Ok(record)
}

pub fn plan_steps(command: &str, route: &GatewayRoute) -> Vec<TaskStep> {
    if route.capability_id == "supervisor.delegate" {
        if let Some((left, right)) = parse_then_steps(command) {
            return vec![
                task_step("step-1", &left, "supervisor_step"),
                task_step("step-2", &right, "supervisor_step"),
            ];
        }
    }

    if route.capability_id == "automation.workflow" {
        return vec![task_step("step-1", command, "automation_workflow")];
    }

    if let Some((left, right)) = parse_then_steps(command) {
        return vec![
            task_step("step-1", &left, "open_desktop"),
            task_step("step-2", &right, "open_desktop"),
        ];
    }

    if route.capability_id == "command.study" {
        return vec![task_step("step-1", "Launch study setup", "study_setup")];
    }

    if route.capability_id == "vision.ocr" {
        return vec![task_step("step-1", "Read screen", "read_screen")];
    }

    if extract_file_search_query(command).is_some() {
        return vec![task_step("step-1", "Search local files", "search_files")];
    }

    if route.capability_id == "command.search" {
        if extract_google_search_query(command).is_some() {
            return vec![task_step("step-1", "Search Google", "google_search")];
        }
        return vec![task_step("step-1", "Search local files", "search_files")];
    }

    if route.capability_id == "command.files" {
        if let Some(action) = parse_pdf_command_action(command) {
            let (description, kind) = match action {
                PdfCommandAction::List => ("List PDFs", "list_pdfs"),
                PdfCommandAction::Search { .. } => ("Search PDFs", "search_pdfs"),
                PdfCommandAction::OpenCurrent => ("Open current PDF", "open_current_pdf"),
                PdfCommandAction::OpenByIndex { .. } => ("Open PDF by index", "open_pdf_by_index"),
                PdfCommandAction::OpenByQuery { .. } => ("Open PDF by query", "open_pdf_by_query"),
                PdfCommandAction::ReadCurrent => ("Read current PDF", "read_current_pdf"),
                PdfCommandAction::ReadByIndex { .. } => ("Read PDF by index", "read_pdf_by_index"),
                PdfCommandAction::ReadByQuery { .. } => ("Read PDF by query", "read_pdf_by_query"),
                PdfCommandAction::SummarizeCurrent => {
                    ("Summarize current PDF", "summarize_current_pdf")
                }
                PdfCommandAction::SummarizeByIndex { .. } => {
                    ("Summarize PDF by index", "summarize_pdf_by_index")
                }
                PdfCommandAction::SummarizeByQuery { .. } => {
                    ("Summarize PDF by query", "summarize_pdf_by_query")
                }
            };
            return vec![task_step("step-1", description, kind)];
        }
        return vec![task_step("step-1", "List recent files", "list_recent_files")];
    }

    if route.capability_id == "command.desktop" {
        return vec![task_step("step-1", command, "open_desktop")];
    }

    if route.capability_id == "command.clipboard" {
        return vec![task_step("step-1", "Clipboard", "clipboard_action")];
    }

    if route.agent == GatewayAgentKind::Integrations {
        if route.capability_id == "integrations.google" {
            if let Some(action) = parse_gmail_command(command) {
                let (description, kind) = match action {
                    GmailAction::ListUnread => ("List unread Gmail messages", "list_unread_emails"),
                    GmailAction::Search { .. } => ("Search Gmail", "search_gmail"),
                    GmailAction::ReadCurrentEmail => ("Read current email", "read_current_email"),
                    GmailAction::ReadEmailByIndex { .. } => {
                        ("Read email by index", "read_email_by_index")
                    }
                    GmailAction::ReadEmailByQuery { .. } => {
                        ("Read email by query", "read_email_by_query")
                    }
                };
                return vec![task_step("step-1", description, kind)];
            }
        }
        if route.capability_id == "integrations.calendar" {
            if let Some(action) = parse_calendar_command(command) {
                let (description, kind) = match action {
                    CalendarAction::ListToday => {
                        ("List today's calendar events", "list_today_calendar_events")
                    }
                    CalendarAction::CreateFromNl => {
                        ("Create calendar event from command", "create_calendar_event")
                    }
                    CalendarAction::CreateFromEmail => {
                        ("Create calendar event from current email", "create_calendar_event_from_current_email")
                    }
                };
                return vec![task_step("step-1", description, kind)];
            }
        }
        if route.capability_id == "integrations.spotify" {
            if let Some(action) = parse_spotify_command(command) {
                let (description, kind) = match action {
                    SpotifyAction::Play => ("Resume Spotify playback", "spotify_play"),
                    SpotifyAction::Pause => ("Pause Spotify playback", "spotify_pause"),
                    SpotifyAction::Skip => ("Skip to next Spotify track", "spotify_next"),
                    SpotifyAction::Previous => {
                        ("Skip to previous Spotify track", "spotify_previous")
                    }
                    SpotifyAction::PlayQuery { .. } => ("Play Spotify query", "spotify_play_query"),
                };
                return vec![task_step("step-1", description, kind)];
            }
        }
        if route.capability_id == "integrations.notion" {
            if let Some(action) = parse_notion_command(command) {
                let (description, kind) = match action {
                    NotionAction::ListNotes => ("List Notion notes", "notion_list_notes"),
                    NotionAction::SearchNotes { .. } => {
                        ("Search Notion notes", "notion_search_notes")
                    }
                    NotionAction::CreateNote { .. } => ("Create Notion note", "notion_create_note"),
                    NotionAction::CreateTask { .. } => ("Create Notion task", "notion_create_task"),
                };
                return vec![task_step("step-1", description, kind)];
            }
        }
        if route.capability_id == "integrations.ocr_notion" {
            if let Some(action) = parse_ocr_watch_command(command) {
                let (description, kind) = match action {
                    OcrWatchAction::StartWatch => ("Start OCR watch", "start_ocr_watch"),
                    OcrWatchAction::StopWatch => ("Stop OCR watch", "stop_ocr_watch"),
                    OcrWatchAction::ShowWatches => ("Show OCR watches", "show_ocr_watches"),
                    OcrWatchAction::PauseWatches => ("Pause OCR watches", "pause_ocr_watches"),
                    OcrWatchAction::ResumeWatches => ("Resume OCR watches", "resume_ocr_watches"),
                };
                return vec![task_step("step-1", description, kind)];
            }
            if let Some(action) = parse_ocr_notion_command(command) {
                let (description, kind) = match action {
                    OcrNotionAction::ReadScreenAndSave => {
                        ("Read screen and save to Notion", "read_screen_save_to_notion")
                    }
                    OcrNotionAction::SaveOcrHistory => {
                        ("Save OCR history to Notion", "save_ocr_history_to_notion")
                    }
                    OcrNotionAction::SaveScreenText { .. } => {
                        ("Save scoped screen text to Notion", "save_screen_text_to_notion")
                    }
                };
                return vec![task_step("step-1", description, kind)];
            }
        }
        return vec![task_step("step-1", command, "integration")];
    }

    if route.capability_id == "memory.life" {
        return vec![task_step("step-1", command, "memory")];
    }

    if route.capability_id == "memory.vault" {
        return vec![task_step("step-1", "Search knowledge vault", "vault_search")];
    }

    if route.capability_id == "integrations.mcp.host"
        || route.capability_id == "integrations.mcp.github"
        || route.capability_id == "integrations.mcp.jira"
        || route.capability_id == "integrations.mcp.huggingface"
        || route.capability_id == "integrations.mcp.zapier"
        || command.trim().to_lowercase().starts_with("mcp ")
    {
        return vec![task_step("step-1", command, "mcp_call")];
    }

    if route.capability_id == "research.web" {
        return vec![task_step("step-1", command, "research_query")];
    }

    vec![task_step("step-1", command, "fake_step")]
}

fn execute_step_with_recovery(
    ctx: &mut TaskLoopContext<'_>,
    step: &TaskStep,
    payload: &mut TaskStepsPayload,
    events: &mut Vec<GatewayEvent>,
) -> Result<crate::agents::StepResult, String> {
    let agent_ctx = agent_context_for_step(ctx, step);
    let mut result = dispatch_step(&agent_ctx, ctx.bus)?;

    if result.success || ctx.route.capability_id != "supervisor.delegate" {
        return Ok(result);
    }

    if payload.supervisor_recoveries > 0 {
        return Ok(result);
    }

    let router_context = RouterContext {
        db_path: Some(ctx.db_path.to_path_buf()),
        config: ctx.config.clone(),
    };

    if let Some(replan_route) =
        replan_supervisor_step(&step.description, &router_context)
    {
        payload.supervisor_recoveries += 1;
        events.push(tool_event(
            ctx.session_id,
            ctx.turn_id,
            GatewayEventKind::Thinking,
            format!(
                "L3 supervisor replan → {} ({})",
                replan_route.capability_id, replan_route.reason
            ),
        ));

        let recovered_kind = step_kind_for_command(&step.description, &replan_route);
        let recovered_ctx = AgentContext {
            db_path: ctx.db_path.to_path_buf(),
            app_data_dir: ctx.app_data_dir.to_path_buf(),
            config: ctx.config.clone(),
            route: replan_route.clone(),
            session_id: ctx.session_id.to_string(),
            turn_id: ctx.turn_id,
            command: step.description.clone(),
            step_description: step.description.clone(),
            step_kind: recovered_kind,
        };
        result = dispatch_step(&recovered_ctx, ctx.bus)?;
        if result.success {
            return Ok(result);
        }
    }

    if let Some(builder_route) = verify_with_builder(&step.description, &router_context) {
        payload.supervisor_recoveries += 1;
        events.push(tool_event(
            ctx.session_id,
            ctx.turn_id,
            GatewayEventKind::Thinking,
            format!(
                "L4 builder verify → {} ({})",
                builder_route.capability_id, builder_route.reason
            ),
        ));

        let verify_ctx = AgentContext {
            db_path: ctx.db_path.to_path_buf(),
            app_data_dir: ctx.app_data_dir.to_path_buf(),
            config: ctx.config.clone(),
            route: builder_route,
            session_id: ctx.session_id.to_string(),
            turn_id: ctx.turn_id,
            command: step.description.clone(),
            step_description: step.description.clone(),
            step_kind: "builder_verify".to_string(),
        };
        let verify_result = dispatch_step(&verify_ctx, ctx.bus)?;
        if verify_result.success {
            return Ok(crate::agents::StepResult {
                reply: format!("L4 recovery: {}", verify_result.reply),
                done: true,
                success: true,
                integration_handoff: None,
            });
        }
    }

    Ok(result)
}

fn agent_context_for_step(ctx: &TaskLoopContext<'_>, step: &TaskStep) -> AgentContext {
    let mut command = ctx.command.to_string();
    let mut route = ctx.route.clone();
    let mut step_kind = step.kind.clone();

    if step.kind == "supervisor_step" {
        command = step.description.clone();
        route = route_subcommand(&command, ctx.config, ctx.db_path);
        step_kind = step_kind_for_command(&command, &route);
    }

    AgentContext {
        db_path: ctx.db_path.to_path_buf(),
        app_data_dir: ctx.app_data_dir.to_path_buf(),
        config: ctx.config.clone(),
        route,
        session_id: ctx.session_id.to_string(),
        turn_id: ctx.turn_id,
        command,
        step_description: step.description.clone(),
        step_kind,
    }
}

fn route_subcommand(
    command: &str,
    config: &GatewayConfig,
    db_path: &Path,
) -> GatewayRoute {
    route_turn(
        &TurnRequest {
            session_id: None,
            command: command.to_string(),
            source: None,
            idempotency_key: None,
        },
        &RouterContext {
            db_path: Some(db_path.to_path_buf()),
            config: config.clone(),
        },
    )
}

fn step_kind_for_command(command: &str, route: &GatewayRoute) -> String {
    if route.capability_id == "vision.ocr" {
        return "read_screen".to_string();
    }
    if route.capability_id == "command.study" {
        return "study_setup".to_string();
    }
    if extract_file_search_query(command).is_some() {
        return "search_files".to_string();
    }
    if route.capability_id == "command.search" {
        if extract_google_search_query(command).is_some() {
            return "google_search".to_string();
        }
        return "search_files".to_string();
    }
    if route.capability_id == "command.files" {
        if let Some(action) = parse_pdf_command_action(command) {
            return match action {
                PdfCommandAction::List => "list_pdfs",
                PdfCommandAction::Search { .. } => "search_pdfs",
                PdfCommandAction::OpenCurrent => "open_current_pdf",
                PdfCommandAction::OpenByIndex { .. } => "open_pdf_by_index",
                PdfCommandAction::OpenByQuery { .. } => "open_pdf_by_query",
                PdfCommandAction::ReadCurrent => "read_current_pdf",
                PdfCommandAction::ReadByIndex { .. } => "read_pdf_by_index",
                PdfCommandAction::ReadByQuery { .. } => "read_pdf_by_query",
                PdfCommandAction::SummarizeCurrent => "summarize_current_pdf",
                PdfCommandAction::SummarizeByIndex { .. } => "summarize_pdf_by_index",
                PdfCommandAction::SummarizeByQuery { .. } => "summarize_pdf_by_query",
            }
            .to_string();
        }
        return "list_recent_files".to_string();
    }
    if route.capability_id == "command.clipboard" {
        return "clipboard_action".to_string();
    }
    if route.capability_id == "integrations.mcp.host"
        || route.capability_id == "integrations.mcp.github"
        || route.capability_id == "integrations.mcp.jira"
        || route.capability_id == "integrations.mcp.huggingface"
        || route.capability_id == "integrations.mcp.zapier"
        || command.trim().to_lowercase().starts_with("mcp ")
    {
        return "mcp_call".to_string();
    }
    if route.capability_id == "memory.vault" {
        return "vault_search".to_string();
    }
    if route.agent == GatewayAgentKind::Memory {
        return "memory".to_string();
    }
    if route.agent == GatewayAgentKind::Research {
        return "research_query".to_string();
    }
    if route.agent == GatewayAgentKind::Finance {
        return "finance".to_string();
    }
    if route.agent == GatewayAgentKind::Writer {
        return "writer_draft".to_string();
    }
    if route.agent == GatewayAgentKind::Integrations {
        return "integration".to_string();
    }
    if route.capability_id == "command.desktop" || open_target_from_command(command).is_some() {
        return "open_desktop".to_string();
    }
    "open_desktop".to_string()
}

fn task_step(id: &str, description: &str, kind: &str) -> TaskStep {
    TaskStep {
        id: id.to_string(),
        description: description.to_string(),
        kind: kind.to_string(),
        status: StepStatus::Pending,
        result: None,
    }
}

fn parse_steps_payload(steps_json: &str) -> Result<TaskStepsPayload, String> {
    serde_json::from_str(steps_json).map_err(|error| error.to_string())
}

fn persist_task(
    db_path: &Path,
    task_id: &str,
    session_id: &str,
    goal: &str,
    status: TaskStatus,
    current_step: i64,
    payload: &TaskStepsPayload,
) -> Result<(), String> {
    let record = TaskStateRecord {
        id: task_id.to_string(),
        session_id: session_id.to_string(),
        goal: goal.to_string(),
        status: format!("{:?}", status).to_lowercase(),
        current_step,
        steps_json: serde_json::to_string(payload).map_err(|error| error.to_string())?,
        updated_at: iso_timestamp(),
    };
    save_task_state(db_path, &record)
}

fn tool_event(
    session_id: &str,
    turn_id: u64,
    kind: GatewayEventKind,
    message: String,
) -> GatewayEvent {
    GatewayEvent {
        id: format!("gateway-event-{turn_id}-loop-{kind:?}").to_lowercase(),
        session_id: session_id.to_string(),
        turn_id: Some(turn_id),
        kind,
        message,
        created_at: iso_timestamp(),
        approval: None,
    }
}

fn iso_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn task_age_seconds(task: &TaskStateRecord) -> Option<u64> {
    let updated_at = task.updated_at.parse::<u64>().ok()?;
    let now = SystemTime::now().duration_since(UNIX_EPOCH).ok()?.as_secs();
    Some(now.saturating_sub(updated_at))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_database;
    use crate::gateway::types::{
        GatewayAgentKind, GatewayConfidenceBand, GatewayDecisionPolicy, GatewayModelTier,
        GatewaySensitivity, RouteLevel,
    };
    use crate::providers::escalation::EscalationTracker;
    use std::env::temp_dir;

    fn sample_route() -> GatewayRoute {
        GatewayRoute {
            capability_id: "command.study".into(),
            capability_label: "Study".into(),
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
        }
    }

    #[test]
    fn task_state_persists_and_resumes_second_step() {
        let db_path = temp_dir().join(format!("jarvis-task-loop-{}.db", std::process::id()));
        let _ = std::fs::remove_file(&db_path);
        init_database(&db_path).expect("init");

        let mut config = GatewayConfig::default();
        config.enabled = true;
        config.features.study_routine = true;

        let mut bus = super::super::bus::EventBus::default();
        let mut escalation = EscalationTracker::default();
        let route = GatewayRoute {
            capability_id: "command.desktop".into(),
            capability_label: "Desktop".into(),
            agent: GatewayAgentKind::Command,
            ..sample_route()
        };

        let command = "open notepad then open calculator";
        let steps = plan_steps(command, &route);
        assert_eq!(steps.len(), 2);

        let mut ctx = TaskLoopContext {
            db_path: &db_path,
            app_data_dir: &temp_dir(),
            config: &config,
            route: &route,
            session_id: "session-test",
            turn_id: 42,
            command,
            bus: &mut bus,
            escalation: &mut escalation,
        };

        let first = start_or_resume_turn(ctx).expect("first step");
        assert!(first.success);
        assert!(!first.task_complete);

        let task_id = format!("session-test-42");
        let saved = crate::db::load_task_state(&db_path, &task_id)
            .expect("load")
            .expect("record");
        assert_eq!(saved.current_step, 1);

        let mut bus2 = super::super::bus::EventBus::default();
        let mut escalation2 = EscalationTracker::default();
        let mut ctx2 = TaskLoopContext {
            db_path: &db_path,
            app_data_dir: &temp_dir(),
            config: &config,
            route: &route,
            session_id: "session-test",
            turn_id: 43,
            command,
            bus: &mut bus2,
            escalation: &mut escalation2,
        };

        let second = start_or_resume_turn(ctx2).expect("second step");
        assert!(second.success);
        assert!(second.task_complete);

        let _ = std::fs::remove_file(db_path);
    }

    #[test]
    fn step_budget_stops_overlarge_plan_before_tool_execution() {
        let db_path = temp_dir().join(format!("jarvis-task-loop-budget-{}.db", std::process::id()));
        let _ = std::fs::remove_file(&db_path);
        init_database(&db_path).expect("init");

        let mut config = GatewayConfig::default();
        config.enabled = true;
        config.budgets.max_steps_per_turn = 1;

        let mut bus = super::super::bus::EventBus::default();
        let mut escalation = EscalationTracker::default();
        let route = GatewayRoute {
            capability_id: "command.desktop".into(),
            capability_label: "Desktop".into(),
            agent: GatewayAgentKind::Command,
            ..sample_route()
        };

        let outcome = start_or_resume_turn(TaskLoopContext {
            db_path: &db_path,
            app_data_dir: &temp_dir(),
            config: &config,
            route: &route,
            session_id: "session-budget",
            turn_id: 50,
            command: "open notepad then open calculator",
            bus: &mut bus,
            escalation: &mut escalation,
        })
        .expect("budget outcome");

        assert!(!outcome.success);
        assert!(outcome.task_complete);
        assert!(outcome.reply.contains("step budget exceeded"));
        assert!(!outcome.events.iter().any(|event| event.kind == GatewayEventKind::ToolStart));

        let _ = std::fs::remove_file(db_path);
    }

    #[test]
    fn google_search_command_plans_browser_search_handoff() {
        let route = GatewayRoute {
            capability_id: "command.search".into(),
            capability_label: "Search".into(),
            agent: GatewayAgentKind::Command,
            ..sample_route()
        };

        let steps = plan_steps("search google for rust traits", &route);

        assert_eq!(steps.len(), 1);
        assert_eq!(steps[0].kind, "google_search");
        assert_eq!(steps[0].description, "Search Google");
    }

    #[test]
    fn recent_files_command_plans_recent_files_handoff() {
        let route = GatewayRoute {
            capability_id: "command.files".into(),
            capability_label: "Files".into(),
            agent: GatewayAgentKind::Command,
            ..sample_route()
        };

        let steps = plan_steps("show recent files", &route);

        assert_eq!(steps.len(), 1);
        assert_eq!(steps[0].kind, "list_recent_files");
        assert_eq!(steps[0].description, "List recent files");
    }

    #[test]
    fn pdf_commands_plan_pdf_file_handoffs() {
        let route = GatewayRoute {
            capability_id: "command.files".into(),
            capability_label: "Files".into(),
            agent: GatewayAgentKind::Command,
            ..sample_route()
        };

        let list_steps = plan_steps("list pdfs", &route);
        let search_steps = plan_steps("search pdfs for taxes", &route);

        assert_eq!(list_steps[0].kind, "list_pdfs");
        assert_eq!(search_steps[0].kind, "search_pdfs");
    }

    #[test]
    fn pdf_open_and_read_commands_plan_pdf_handoffs() {
        let route = GatewayRoute {
            capability_id: "command.files".into(),
            capability_label: "Files".into(),
            agent: GatewayAgentKind::Command,
            ..sample_route()
        };

        let open_steps = plan_steps("open pdf 2", &route);
        let read_steps = plan_steps("read pdf about taxes", &route);

        assert_eq!(open_steps[0].kind, "open_pdf_by_index");
        assert_eq!(read_steps[0].kind, "read_pdf_by_query");
    }

    #[test]
    fn gmail_commands_plan_specific_integration_handoffs() {
        let route = GatewayRoute {
            capability_id: "integrations.google".into(),
            capability_label: "Gmail".into(),
            agent: GatewayAgentKind::Integrations,
            ..sample_route()
        };

        let list_steps = plan_steps("check gmail", &route);
        let search_steps = plan_steps("search gmail for receipts", &route);
        let read_steps = plan_steps("read email 2", &route);

        assert_eq!(list_steps[0].kind, "list_unread_emails");
        assert_eq!(search_steps[0].kind, "search_gmail");
        assert_eq!(read_steps[0].kind, "read_email_by_index");
    }

    #[test]
    fn calendar_commands_plan_specific_integration_handoffs() {
        let route = GatewayRoute {
            capability_id: "integrations.calendar".into(),
            capability_label: "Calendar".into(),
            agent: GatewayAgentKind::Integrations,
            ..sample_route()
        };

        let today_steps = plan_steps("what's on my calendar today", &route);
        let create_steps = plan_steps("add gym tomorrow at 6 PM to my calendar", &route);
        let email_steps = plan_steps("add this email to calendar", &route);

        assert_eq!(today_steps[0].kind, "list_today_calendar_events");
        assert_eq!(create_steps[0].kind, "create_calendar_event");
        assert_eq!(
            email_steps[0].kind,
            "create_calendar_event_from_current_email"
        );
    }

    #[test]
    fn spotify_commands_plan_specific_integration_handoffs() {
        let route = GatewayRoute {
            capability_id: "integrations.spotify".into(),
            capability_label: "Spotify".into(),
            agent: GatewayAgentKind::Integrations,
            ..sample_route()
        };

        let play_steps = plan_steps("play blinding lights on spotify", &route);
        let pause_steps = plan_steps("pause spotify", &route);
        let next_steps = plan_steps("next spotify track", &route);
        let previous_steps = plan_steps("previous spotify track", &route);

        assert_eq!(play_steps[0].kind, "spotify_play_query");
        assert_eq!(pause_steps[0].kind, "spotify_pause");
        assert_eq!(next_steps[0].kind, "spotify_next");
        assert_eq!(previous_steps[0].kind, "spotify_previous");
    }

    #[test]
    fn notion_commands_plan_specific_integration_steps() {
        let route = GatewayRoute {
            capability_id: "integrations.notion".into(),
            capability_label: "Notion".into(),
            agent: GatewayAgentKind::Integrations,
            ..sample_route()
        };

        let list_steps = plan_steps("show notes", &route);
        let search_steps = plan_steps("search notion for taxes", &route);
        let note_steps = plan_steps("make a note to follow up with Sam", &route);
        let task_steps = plan_steps("create a task review roadmap", &route);

        assert_eq!(list_steps[0].kind, "notion_list_notes");
        assert_eq!(search_steps[0].kind, "notion_search_notes");
        assert_eq!(note_steps[0].kind, "notion_create_note");
        assert_eq!(task_steps[0].kind, "notion_create_task");
    }

    #[test]
    fn ocr_notion_commands_plan_specific_integration_steps() {
        let route = GatewayRoute {
            capability_id: "integrations.ocr_notion".into(),
            capability_label: "OCR to Notion".into(),
            agent: GatewayAgentKind::Integrations,
            ..sample_route()
        };

        let read_save_steps = plan_steps("read screen and save to notion", &route);
        let history_steps = plan_steps("save ocr history to notion", &route);
        let scoped_steps = plan_steps("save screen text from chrome to notion", &route);

        assert_eq!(read_save_steps[0].kind, "read_screen_save_to_notion");
        assert_eq!(history_steps[0].kind, "save_ocr_history_to_notion");
        assert_eq!(scoped_steps[0].kind, "save_screen_text_to_notion");
    }

    #[test]
    fn ocr_watch_commands_plan_specific_integration_steps() {
        let route = GatewayRoute {
            capability_id: "integrations.ocr_notion".into(),
            capability_label: "OCR to Notion".into(),
            agent: GatewayAgentKind::Integrations,
            ..sample_route()
        };

        let start_steps = plan_steps("watch chrome every 30 seconds and log to notion", &route);
        let stop_steps = plan_steps("stop ocr watch", &route);
        let show_steps = plan_steps("show ocr watches", &route);
        let pause_steps = plan_steps("pause ocr watches", &route);
        let resume_steps = plan_steps("resume ocr watches", &route);

        assert_eq!(start_steps[0].kind, "start_ocr_watch");
        assert_eq!(stop_steps[0].kind, "stop_ocr_watch");
        assert_eq!(show_steps[0].kind, "show_ocr_watches");
        assert_eq!(pause_steps[0].kind, "pause_ocr_watches");
        assert_eq!(resume_steps[0].kind, "resume_ocr_watches");
    }

    #[test]
    fn wall_time_budget_stops_expired_task_before_tool_execution() {
        let db_path = temp_dir().join(format!(
            "jarvis-task-loop-wall-time-{}.db",
            std::process::id()
        ));
        let _ = std::fs::remove_file(&db_path);
        init_database(&db_path).expect("init");

        let mut config = GatewayConfig::default();
        config.enabled = true;
        config.budgets.max_wall_time_seconds = 1;

        let route = GatewayRoute {
            capability_id: "command.study".into(),
            capability_label: "Study".into(),
            agent: GatewayAgentKind::Command,
            ..sample_route()
        };
        let command = "start study mode";
        let payload = TaskStepsPayload {
            failure_count: 0,
            supervisor_recoveries: 0,
            steps: plan_steps(command, &route),
        };
        save_task_state(
            &db_path,
            &TaskStateRecord {
                id: "session-wall-time-77".to_string(),
                session_id: "session-wall-time".to_string(),
                goal: command.to_string(),
                status: "running".to_string(),
                current_step: 0,
                steps_json: serde_json::to_string(&payload).expect("steps json"),
                updated_at: "1".to_string(),
            },
        )
        .expect("save expired task");

        let mut bus = super::super::bus::EventBus::default();
        let mut escalation = EscalationTracker::default();
        let outcome = start_or_resume_turn(TaskLoopContext {
            db_path: &db_path,
            app_data_dir: &temp_dir(),
            config: &config,
            route: &route,
            session_id: "session-wall-time",
            turn_id: 77,
            command,
            bus: &mut bus,
            escalation: &mut escalation,
        })
        .expect("wall-time outcome");

        assert!(!outcome.success);
        assert!(outcome.task_complete);
        assert!(outcome.reply.contains("wall-time budget exceeded"));
        assert!(!outcome.events.iter().any(|event| event.kind == GatewayEventKind::ToolStart));

        let _ = std::fs::remove_file(db_path);
    }

    #[test]
    fn retry_budget_stops_over_failed_task_before_tool_execution() {
        let db_path = temp_dir().join(format!(
            "jarvis-task-loop-retry-budget-{}.db",
            std::process::id()
        ));
        let _ = std::fs::remove_file(&db_path);
        init_database(&db_path).expect("init");

        let mut config = GatewayConfig::default();
        config.enabled = true;
        config.budgets.max_retries_per_step = 1;

        let route = GatewayRoute {
            capability_id: "command.study".into(),
            capability_label: "Study".into(),
            agent: GatewayAgentKind::Command,
            ..sample_route()
        };
        let command = "start study mode";
        let payload = TaskStepsPayload {
            failure_count: 2,
            supervisor_recoveries: 0,
            steps: plan_steps(command, &route),
        };
        save_task_state(
            &db_path,
            &TaskStateRecord {
                id: "session-retry-budget-88".to_string(),
                session_id: "session-retry-budget".to_string(),
                goal: command.to_string(),
                status: "running".to_string(),
                current_step: 0,
                steps_json: serde_json::to_string(&payload).expect("steps json"),
                updated_at: iso_timestamp(),
            },
        )
        .expect("save over-failed task");

        let mut bus = super::super::bus::EventBus::default();
        let mut escalation = EscalationTracker::default();
        let outcome = start_or_resume_turn(TaskLoopContext {
            db_path: &db_path,
            app_data_dir: &temp_dir(),
            config: &config,
            route: &route,
            session_id: "session-retry-budget",
            turn_id: 88,
            command,
            bus: &mut bus,
            escalation: &mut escalation,
        })
        .expect("retry-budget outcome");

        assert!(!outcome.success);
        assert!(outcome.task_complete);
        assert!(outcome.reply.contains("retry budget exceeded"));
        assert!(!outcome.events.iter().any(|event| event.kind == GatewayEventKind::ToolStart));

        let _ = std::fs::remove_file(db_path);
    }
}
