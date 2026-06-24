use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

use crate::memory::{is_memory_command, knowledge_router};
use crate::models::{ModelProviderChatRequest, ModelProviderMessage};
use crate::providers::{self, escalation::EscalationTracker};

use super::{
    approval::{ApprovalGate, ApprovalOutcome},
    audit::{self, AuditOutcome, AuditRecord},
    bus::EventBus,
    capabilities::find_capability,
    config::{GatewayConfig, GatewayMode},
    policy::{policy_class_label, route_policy_class},
    router::{route_turn, RouterContext},
    state::PendingApproval,
    task_loop::{plan_steps, start_or_resume_turn, TaskLoopContext},
    types::{
        ApprovalRequest, GatewayEvent, GatewayEventKind, RouteLevel, TurnRequest, TurnResult,
        TurnSource,
    },
    verifier::council_verify_send,
};

#[derive(Debug)]
pub struct TurnExecutionEnv<'a> {
    pub db_path: &'a Path,
    pub app_data_dir: &'a Path,
    pub escalation: &'a mut EscalationTracker,
}

pub struct GatewayOrchestrator;

impl GatewayOrchestrator {
    pub fn preview_turn(
        request: TurnRequest,
        turn_id: u64,
        session_id: &str,
        router_context: &RouterContext,
    ) -> GatewayPreview {
        let response = Self::build_turn_response(
            request,
            turn_id,
            session_id,
            &router_context.config,
            router_context,
            "gateway-preview",
            false,
            None,
        );
        GatewayPreview {
            events: response.events,
            result: response.result,
        }
    }

    pub fn run_turn(
        request: TurnRequest,
        turn_id: u64,
        session_id: &str,
        config: &GatewayConfig,
        router_context: &RouterContext,
        bus: &mut EventBus,
        groq_api_key: Option<String>,
        execution: Option<TurnExecutionEnv<'_>>,
    ) -> GatewayTurnResponse {
        let export_enabled = config.training.export_enabled;
        let app_data_dir_for_export = execution.as_ref().map(|env| env.app_data_dir.to_path_buf());

        let mut response = Self::build_turn_response(
            request.clone(),
            turn_id,
            session_id,
            config,
            router_context,
            &config.correlation_prefix,
            true,
            groq_api_key,
        );

        if let (Some(env), Some(route)) = (execution.as_ref(), response.result.route.as_ref()) {
            Self::maybe_log_turn_audit(
                env.app_data_dir,
                route,
                &response.result.session_id,
                turn_id,
                &request.command,
                config,
                response.awaiting_approval,
            );
        }

        if let (Some(env), false) = (execution, response.awaiting_approval) {
            if config.features.memory
                && response.result.route.as_ref().is_some_and(|route| {
                    route.capability_id.starts_with("memory") || is_memory_command(&request.command)
                })
            {
                let bundle = knowledge_router::recall_context_with_config(
                    env.db_path,
                    Some(env.app_data_dir),
                    Some(config),
                    &request.command,
                    3,
                );
                if !bundle.snippets.is_empty() {
                    response.events.push(GatewayEvent {
                        id: format!("gateway-event-{turn_id}-knowledge"),
                        session_id: response.result.session_id.clone(),
                        turn_id: Some(turn_id),
                        kind: GatewayEventKind::KnowledgeRecalled,
                        message: bundle.summary.clone(),
                        created_at: unix_timestamp_string(),
                        approval: None,
                    });
                    if !response.result.reply.contains(&bundle.summary) {
                        response.result.reply = format!(
                            "{}\n\nRecalled context: {}",
                            response.result.reply, bundle.summary
                        );
                    }
                }
            }

            if config.enabled
                && config.mode == GatewayMode::PlanOnly
                && capability_enabled(config, response.result.route.as_ref(), &request.command)
            {
                response.result.legacy = false;
                response.result.reply = format!(
                    "Gateway plan-only mode routed this turn to {}. No tools were executed.",
                    response
                        .result
                        .route
                        .as_ref()
                        .map(|route| route.capability_label.clone())
                        .unwrap_or_else(|| "the selected capability".to_string())
                );
                response.events.push(GatewayEvent {
                    id: format!("gateway-event-{turn_id}-plan-only"),
                    session_id: response.result.session_id.clone(),
                    turn_id: Some(turn_id),
                    kind: GatewayEventKind::Thinking,
                    message: "Gateway plan-only mode skipped task execution.".to_string(),
                    created_at: unix_timestamp_string(),
                    approval: None,
                });
            } else if config.enabled
                && config.mode == GatewayMode::DryRun
                && capability_enabled(config, response.result.route.as_ref(), &request.command)
            {
                if let Some(route) = response.result.route.clone() {
                    let steps = plan_steps(&request.command, &route);
                    let planned = steps
                        .iter()
                        .enumerate()
                        .map(|(index, step)| {
                            format!("{}. {} ({})", index + 1, step.description, step.kind)
                        })
                        .collect::<Vec<_>>()
                        .join("\n");
                    response.result.legacy = false;
                    response.result.reply = format!(
                        "Dry run for {}: {}\n{}",
                        route.capability_label, request.command, planned
                    );
                    response.events.push(GatewayEvent {
                        id: format!("gateway-event-{turn_id}-dry-run"),
                        session_id: response.result.session_id.clone(),
                        turn_id: Some(turn_id),
                        kind: GatewayEventKind::Thinking,
                        message: "Gateway dry-run mode planned task steps without executing tools."
                            .to_string(),
                        created_at: unix_timestamp_string(),
                        approval: None,
                    });
                }
            } else if config.enabled
                && capability_enabled(config, response.result.route.as_ref(), &request.command)
            {
                if let Some(route) = response.result.route.clone() {
                    let loop_ctx = TaskLoopContext {
                        db_path: env.db_path,
                        app_data_dir: env.app_data_dir,
                        config,
                        route: &route,
                        session_id,
                        turn_id,
                        command: &request.command,
                        bus,
                        escalation: env.escalation,
                    };
                    match start_or_resume_turn(loop_ctx) {
                        Ok(outcome) => {
                            response.result.legacy = false;
                            response.result.reply = outcome.reply.clone();
                            response.result.integration_handoff = outcome.integration_handoff;
                            response.events.extend(outcome.events);
                        }
                        Err(error) => {
                            response.result.legacy = false;
                            response.result.reply = error;
                        }
                    }
                }
            }
        }

        for event in &response.events {
            bus.publish(event.clone());
        }

        if export_enabled {
            if let Some(dir) = app_data_dir_for_export.as_deref() {
                if !response.result.legacy && !response.awaiting_approval {
                    maybe_export_training_turn(dir, &request.command, &response);
                }
            }
        }

        response
    }

    pub fn resolve_approval(
        pending: &PendingApproval,
        approved: bool,
        config: &GatewayConfig,
        bus: &mut EventBus,
    ) -> GatewayApprovalResolution {
        if approved && config.labs.council_verifier {
            let policy_class = if pending.request.detail.to_lowercase().contains("calendar") {
                crate::gateway::types::GatewayPolicyClass::Schedule
            } else {
                crate::gateway::types::GatewayPolicyClass::Send
            };
            if let Err(reason) = council_verify_send(
                config,
                policy_class,
                &pending.command,
                &pending.request.detail,
            ) {
                let message = format!(
                    "Approval blocked by council verifier for {}: {reason}",
                    pending.request.title
                );
                let event = GatewayEvent {
                    id: format!(
                        "gateway-event-approval-{}-verifier-blocked",
                        pending.request.id
                    ),
                    session_id: pending.request.session_id.clone(),
                    turn_id: None,
                    kind: GatewayEventKind::Error,
                    message: message.clone(),
                    created_at: unix_timestamp_string(),
                    approval: Some(pending.request.clone()),
                };
                bus.publish(event.clone());
                return GatewayApprovalResolution {
                    approved: false,
                    approval_id: pending.request.id.clone(),
                    correlation_id: pending.correlation_id.clone(),
                    message,
                    event,
                };
            }
        }

        let message = if approved {
            format!("Approval granted for {}", pending.request.title)
        } else {
            format!("Approval denied for {}", pending.request.title)
        };

        let event = GatewayEvent {
            id: format!(
                "gateway-event-approval-{}-{}",
                pending.request.id,
                if approved { "granted" } else { "denied" }
            ),
            session_id: pending.request.session_id.clone(),
            turn_id: None,
            kind: if approved {
                GatewayEventKind::Reply
            } else {
                GatewayEventKind::Error
            },
            message: message.clone(),
            created_at: unix_timestamp_string(),
            approval: Some(pending.request.clone()),
        };

        bus.publish(event.clone());

        GatewayApprovalResolution {
            approved,
            approval_id: pending.request.id.clone(),
            correlation_id: pending.correlation_id.clone(),
            message,
            event,
        }
    }

    fn build_turn_response(
        request: TurnRequest,
        turn_id: u64,
        fallback_session_id: &str,
        config: &GatewayConfig,
        router_context: &RouterContext,
        correlation_prefix: &str,
        enforce_approval: bool,
        groq_api_key: Option<String>,
    ) -> GatewayTurnResponse {
        let route = route_turn(&request, router_context);
        let session_id = request
            .session_id
            .clone()
            .unwrap_or_else(|| fallback_session_id.to_string());
        let correlation_id = format!("{correlation_prefix}-{session_id}-{turn_id}");
        let command = request.command.clone();
        let route_level = format!("{:?}", route.route_level).to_lowercase();

        let mut approval = if enforce_approval {
            match ApprovalGate::evaluate_route(&route, &session_id, turn_id, &command) {
                ApprovalOutcome::Allowed => None,
                ApprovalOutcome::ApprovalRequired(request) => Some(request),
            }
        } else {
            None
        };

        let policy_class = route_policy_class(&route);
        if config.labs.council_verifier
            && matches!(
                policy_class,
                crate::gateway::types::GatewayPolicyClass::Send
                    | crate::gateway::types::GatewayPolicyClass::Schedule
            )
        {
            let draft = approval
                .as_ref()
                .map(|request| request.detail.as_str())
                .unwrap_or(&command);
            match council_verify_send(config, policy_class, &command, draft) {
                Ok(()) => {
                    if let Some(request) = approval.as_mut() {
                        request.detail =
                            format!("{}\n\nCouncil verifier: approved.", request.detail);
                    }
                }
                Err(reason) => {
                    if let Some(request) = approval.as_mut() {
                        request.detail =
                            format!("{}\n\nCouncil verifier BLOCKED: {reason}", request.detail);
                        request.title = format!("Verifier blocked: {}", request.title);
                    } else {
                        approval = Some(ApprovalRequest {
                            id: format!("council-verifier-{session_id}-{turn_id}"),
                            session_id: session_id.clone(),
                            title: "Council verifier blocked send".to_string(),
                            detail: format!(
                                "JARVIS classified \"{command}\" as {} policy.\nCouncil verifier BLOCKED: {reason}",
                                policy_class_label(policy_class),
                            ),
                            risk: crate::gateway::types::ApprovalRisk::Write,
                            created_at: unix_timestamp_string(),
                        });
                    }
                }
            }
        }

        let awaiting_approval = approval.is_some();
        let legacy = !config.enabled || awaiting_approval;
        let mut reply = if awaiting_approval {
            format!(
                "Waiting for approval: {}",
                approval
                    .as_ref()
                    .map(|request| request.title.clone())
                    .unwrap_or_default()
            )
        } else if config.enabled {
            "Gateway turn routed. Feature takeover is not enabled for this capability yet."
                .to_string()
        } else {
            "Gateway is disabled. Existing JARVIS command handling should execute this turn."
                .to_string()
        };

        let mut talker_reply = None;
        if !awaiting_approval {
            if config.mode.allows_mutations() {
                if let Some(text) = maybe_run_talker(config, &route, &command, groq_api_key) {
                    talker_reply = Some(text.clone());
                    reply = text;
                }
            } else if config.mode.is_simulation() {
                reply = format!(
                    "Gateway {:?} mode routed this turn without executing tools.",
                    config.mode
                );
            }
        }

        if matches!(request.source, Some(TurnSource::Mcp)) {
            reply = format!("MCP-originated turn: {reply}");
        }

        let result = TurnResult {
            session_id: session_id.clone(),
            turn_id,
            legacy,
            reply: reply.clone(),
            route: Some(route.clone()),
            integration_handoff: None,
        };

        let mut events = vec![
            GatewayEvent {
                id: format!("gateway-event-{turn_id}-thinking"),
                session_id: session_id.clone(),
                turn_id: Some(turn_id),
                kind: GatewayEventKind::Thinking,
                message: "Routing turn through gateway control plane.".to_string(),
                created_at: unix_timestamp_string(),
                approval: None,
            },
            GatewayEvent {
                id: format!("gateway-event-{turn_id}-route"),
                session_id: session_id.clone(),
                turn_id: Some(turn_id),
                kind: GatewayEventKind::RouteDecided,
                message: format!(
                    "Route level {route_level} -> {} ({}) policy={} via {}",
                    route.capability_label,
                    route.capability_id,
                    policy_class_label(route_policy_class(&route)),
                    route
                        .resolved_provider
                        .clone()
                        .unwrap_or_else(|| "unresolved".to_string())
                ),
                created_at: unix_timestamp_string(),
                approval: approval.clone(),
            },
            GatewayEvent {
                id: format!("gateway-event-{turn_id}-budgets"),
                session_id: session_id.clone(),
                turn_id: Some(turn_id),
                kind: GatewayEventKind::Thinking,
                message: format_budget_trace(config),
                created_at: unix_timestamp_string(),
                approval: None,
            },
            GatewayEvent {
                id: format!("gateway-event-{turn_id}-quota"),
                session_id: session_id.clone(),
                turn_id: Some(turn_id),
                kind: GatewayEventKind::Thinking,
                message: format_quota_trace(config, route.resolved_provider.as_deref()),
                created_at: unix_timestamp_string(),
                approval: None,
            },
        ];

        if awaiting_approval {
            events.push(GatewayEvent {
                id: format!("gateway-event-{turn_id}-approval"),
                session_id: session_id.clone(),
                turn_id: Some(turn_id),
                kind: GatewayEventKind::ApprovalRequired,
                message: approval
                    .as_ref()
                    .map(|request| request.detail.clone())
                    .unwrap_or_default(),
                created_at: unix_timestamp_string(),
                approval: approval.clone(),
            });
        }

        if let Some(ref text) = talker_reply {
            events.push(GatewayEvent {
                id: format!("gateway-event-{turn_id}-talker"),
                session_id: session_id.clone(),
                turn_id: Some(turn_id),
                kind: GatewayEventKind::Reply,
                message: format!("Groq talker reply (redacted): {text}"),
                created_at: unix_timestamp_string(),
                approval: None,
            });
        }

        events.push(GatewayEvent {
            id: format!("gateway-event-{turn_id}-reply"),
            session_id: session_id.clone(),
            turn_id: Some(turn_id),
            kind: GatewayEventKind::Reply,
            message: reply,
            created_at: unix_timestamp_string(),
            approval: None,
        });

        GatewayTurnResponse {
            correlation_id,
            events,
            result,
            approval,
            awaiting_approval,
            talker_reply,
        }
    }

    fn maybe_log_turn_audit(
        app_data_dir: &Path,
        route: &crate::gateway::types::GatewayRoute,
        session_id: &str,
        turn_id: u64,
        command: &str,
        config: &GatewayConfig,
        awaiting_approval: bool,
    ) {
        use crate::gateway::types::GatewayPolicyClass;

        let policy_class = route_policy_class(route);
        if policy_class == GatewayPolicyClass::Read && !awaiting_approval {
            return;
        }

        let outcome = if awaiting_approval {
            AuditOutcome::PendingApproval
        } else if config.mode.is_simulation() {
            AuditOutcome::BlockedSimulation
        } else {
            return;
        };

        let agent = format!("{:?}", route.agent).to_lowercase();
        let _ = audit::append_entry(
            app_data_dir,
            AuditRecord {
                policy_class,
                agent: &agent,
                capability_id: &route.capability_id,
                session_id,
                turn_id,
                outcome,
                detail: command,
                rollback_ref: None,
            },
        );
    }
}

fn capability_enabled(
    config: &GatewayConfig,
    route: Option<&crate::gateway::types::GatewayRoute>,
    command: &str,
) -> bool {
    let Some(route) = route else {
        return false;
    };
    let Some(capability) = find_capability(&route.capability_id) else {
        return false;
    };

    super::capabilities::capability_enabled_for_turn(config, &capability, command)
}

fn maybe_run_talker(
    config: &GatewayConfig,
    route: &crate::gateway::types::GatewayRoute,
    command: &str,
    groq_api_key: Option<String>,
) -> Option<String> {
    if !config.voice.talker_enabled {
        return None;
    }
    if route.route_level == RouteLevel::Fallback {
        return None;
    }
    if config.budgets.max_wall_time_seconds == 0 {
        return Some("Talker skipped: wall-time budget is zero.".to_string());
    }

    let resolved = providers::resolve_provider(route, config);
    let request = ModelProviderChatRequest {
        provider_id: resolved.provider_id.clone(),
        base_url: resolved.base_url.clone(),
        api_key: groq_api_key,
        model: resolved.model.clone(),
        messages: vec![
            ModelProviderMessage {
                role: "system".to_string(),
                content:
                    "You are JARVIS, a concise desktop assistant. Reply in one or two sentences."
                        .to_string(),
            },
            ModelProviderMessage {
                role: "user".to_string(),
                content: command.to_string(),
            },
        ],
        temperature: Some(0.4),
        max_tokens: Some(300),
    };

    match providers::chat_with_failover(request, route, config) {
        Ok(response) => Some(response.text),
        Err(message) => Some(message),
    }
}

fn format_budget_trace(config: &GatewayConfig) -> String {
    format!(
        "Turn budgets: max {} steps, {}s wall time, {} retries/step, {} MCP payload bytes.",
        config.budgets.max_steps_per_turn,
        config.budgets.max_wall_time_seconds,
        config.budgets.max_retries_per_step,
        config.budgets.max_mcp_payload_bytes,
    )
}

fn format_quota_trace(config: &GatewayConfig, provider: Option<&str>) -> String {
    let Some(provider) = provider else {
        return "Provider quota: local execution (no cloud quota).".to_string();
    };

    match provider {
        "groq" => format!(
            "Provider quota: groq daily cap {} requests.",
            config.quotas.groq_daily_requests
        ),
        "openrouter" => format!(
            "Provider quota: openrouter daily cap {} requests.",
            config.quotas.openrouter_daily_requests
        ),
        "nvidia_nim" | "nvidia-nim" => format!(
            "Provider quota: nvidia nim daily cap {} requests.",
            config.quotas.nvidia_nim_daily_requests
        ),
        "cerebras" => format!(
            "Provider quota: cerebras daily cap {} requests.",
            config.quotas.cerebras_daily_requests
        ),
        _ => format!("Provider quota: {provider} (no configured daily cap)."),
    }
}

fn maybe_export_training_turn(app_data_dir: &Path, phrase: &str, response: &GatewayTurnResponse) {
    let Some(route) = response.result.route.as_ref() else {
        return;
    };
    let export_path = app_data_dir.join("training-export.jsonl");
    let record = crate::training::training_export::TrainingTurnRecord {
        phrase: crate::training::training_export::anonymize_phrase(phrase),
        capability_id: route.capability_id.clone(),
        route_level: format!("{:?}", route.route_level).to_lowercase(),
        tools: Vec::new(),
        success: !response.result.reply.to_lowercase().contains("error"),
        latency_ms: 0,
        exported_at: unix_timestamp_string(),
    };
    let _ = crate::training::training_export::append_training_record(&export_path, &record);
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayPreview {
    pub events: Vec<GatewayEvent>,
    pub result: TurnResult,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayTurnResponse {
    pub correlation_id: String,
    pub events: Vec<GatewayEvent>,
    pub result: TurnResult,
    pub approval: Option<ApprovalRequest>,
    pub awaiting_approval: bool,
    pub talker_reply: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayApprovalResolution {
    pub approved: bool,
    pub approval_id: String,
    pub correlation_id: String,
    pub message: String,
    pub event: GatewayEvent,
}

fn unix_timestamp_string() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gateway::types::{GatewayAgentKind, GatewayEventKind, TurnSource};

    fn router_context() -> RouterContext {
        RouterContext {
            db_path: None,
            app_data_dir: None,
            config: GatewayConfig::default(),
        }
    }

    #[test]
    fn previews_route_without_taking_over_execution() {
        let preview = GatewayOrchestrator::preview_turn(
            TurnRequest {
                session_id: None,
                command: "Open Spotify".to_string(),
                source: Some(TurnSource::Text),
                idempotency_key: None,
            },
            1,
            "session-a",
            &router_context(),
        );

        assert!(preview.result.legacy);
        assert_eq!(preview.result.turn_id, 1);
        assert_eq!(
            preview.result.route.expect("route").agent,
            GatewayAgentKind::Integrations
        );
        assert!(preview.events.len() >= 3);
    }

    #[test]
    fn run_turn_stays_legacy_when_gateway_disabled() {
        let mut bus = EventBus::default();
        let mut escalation = EscalationTracker::default();
        let response = GatewayOrchestrator::run_turn(
            TurnRequest {
                session_id: Some("session-b".to_string()),
                command: "Read my screen".to_string(),
                source: Some(TurnSource::Text),
                idempotency_key: None,
            },
            2,
            "session-b",
            &GatewayConfig::default(),
            &router_context(),
            &mut bus,
            None,
            None,
        );
        let _ = escalation;

        assert!(response.result.legacy);
        assert!(!response.awaiting_approval);
        assert_eq!(response.correlation_id, "jarvis-session-b-2");
        assert!(bus.drain().len() >= 3);
    }

    #[test]
    fn run_turn_executes_study_when_gateway_and_flag_enabled() {
        let mut bus = EventBus::default();
        let mut escalation = EscalationTracker::default();
        let db_path =
            std::env::temp_dir().join(format!("jarvis-orch-study-{}.db", std::process::id()));
        let _ = std::fs::remove_file(&db_path);
        crate::db::init_database(&db_path).expect("init db");

        let mut config = GatewayConfig::default();
        config.enabled = true;
        config.features.study_routine = true;

        let app_data_dir = std::env::temp_dir();
        let db_path_for_cleanup = db_path.clone();
        let response = {
            let execution = TurnExecutionEnv {
                db_path: &db_path,
                app_data_dir: &app_data_dir,
                escalation: &mut escalation,
            };

            GatewayOrchestrator::run_turn(
                TurnRequest {
                    session_id: Some("session-study".to_string()),
                    command: "launch study setup".to_string(),
                    source: Some(TurnSource::Text),
                    idempotency_key: None,
                },
                7,
                "session-study",
                &config,
                &RouterContext {
                    db_path: Some(db_path.clone()),
                    app_data_dir: Some(app_data_dir.clone()),
                    config: config.clone(),
                },
                &mut bus,
                None,
                Some(execution),
            )
        };

        assert!(!response.result.legacy);
        assert!(response.result.reply.contains("study routine"));
        let _ = std::fs::remove_file(db_path_for_cleanup);
    }

    #[test]
    fn plan_only_mode_routes_without_executing_task_loop() {
        let mut bus = EventBus::default();
        let mut escalation = EscalationTracker::default();
        let db_path =
            std::env::temp_dir().join(format!("jarvis-orch-plan-only-{}.db", std::process::id()));
        let _ = std::fs::remove_file(&db_path);
        crate::db::init_database(&db_path).expect("init db");

        let mut config = GatewayConfig::default();
        config.enabled = true;
        config.mode = crate::gateway::config::GatewayMode::PlanOnly;
        config.features.study_routine = true;

        let app_data_dir = std::env::temp_dir();
        let db_path_for_cleanup = db_path.clone();
        let response = {
            let execution = TurnExecutionEnv {
                db_path: &db_path,
                app_data_dir: &app_data_dir,
                escalation: &mut escalation,
            };

            GatewayOrchestrator::run_turn(
                TurnRequest {
                    session_id: Some("session-plan-only".to_string()),
                    command: "launch study setup".to_string(),
                    source: Some(TurnSource::Text),
                    idempotency_key: None,
                },
                8,
                "session-plan-only",
                &config,
                &RouterContext {
                    db_path: Some(db_path.clone()),
                    app_data_dir: Some(app_data_dir.clone()),
                    config: config.clone(),
                },
                &mut bus,
                None,
                Some(execution),
            )
        };

        assert!(!response.result.legacy);
        assert!(response.result.reply.contains("plan-only"));
        assert!(!response
            .events
            .iter()
            .any(|event| event.kind == GatewayEventKind::ToolStart));
        let _ = std::fs::remove_file(db_path_for_cleanup);
    }

    #[test]
    fn dry_run_mode_returns_planned_steps_without_executing_task_loop() {
        let mut bus = EventBus::default();
        let mut escalation = EscalationTracker::default();
        let db_path =
            std::env::temp_dir().join(format!("jarvis-orch-dry-run-{}.db", std::process::id()));
        let _ = std::fs::remove_file(&db_path);
        crate::db::init_database(&db_path).expect("init db");

        let mut config = GatewayConfig::default();
        config.enabled = true;
        config.mode = crate::gateway::config::GatewayMode::DryRun;
        config.features.study_routine = true;

        let app_data_dir = std::env::temp_dir();
        let db_path_for_cleanup = db_path.clone();
        let response = {
            let execution = TurnExecutionEnv {
                db_path: &db_path,
                app_data_dir: &app_data_dir,
                escalation: &mut escalation,
            };

            GatewayOrchestrator::run_turn(
                TurnRequest {
                    session_id: Some("session-dry-run".to_string()),
                    command: "launch study setup".to_string(),
                    source: Some(TurnSource::Text),
                    idempotency_key: None,
                },
                9,
                "session-dry-run",
                &config,
                &RouterContext {
                    db_path: Some(db_path.clone()),
                    app_data_dir: Some(app_data_dir.clone()),
                    config: config.clone(),
                },
                &mut bus,
                None,
                Some(execution),
            )
        };

        assert!(!response.result.legacy);
        assert!(response.result.reply.contains("Dry run"));
        assert!(response.result.reply.contains("launch study setup"));
        assert!(!response
            .events
            .iter()
            .any(|event| event.kind == GatewayEventKind::ToolStart));
        let _ = std::fs::remove_file(db_path_for_cleanup);
    }

    #[test]
    fn run_turn_requires_approval_for_confirm_routes() {
        let mut bus = EventBus::default();
        let response = GatewayOrchestrator::run_turn(
            TurnRequest {
                session_id: Some("session-c".to_string()),
                command: "Save this task to Notion".to_string(),
                source: Some(TurnSource::Text),
                idempotency_key: None,
            },
            3,
            "session-c",
            &GatewayConfig::default(),
            &router_context(),
            &mut bus,
            None,
            None,
        );

        assert!(response.awaiting_approval);
        assert!(response.approval.is_some());
        assert!(response.result.legacy);
        assert!(response
            .events
            .iter()
            .any(|event| event.kind == GatewayEventKind::ApprovalRequired));
    }
}
