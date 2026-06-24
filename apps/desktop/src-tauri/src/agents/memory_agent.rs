use super::{Agent, AgentContext, StepResult};
use crate::gateway::types::GatewayAgentKind;
use crate::memory::{self, brief, knowledge_router, planner};

pub struct MemoryAgent;

impl Agent for MemoryAgent {
    fn kind(&self) -> GatewayAgentKind {
        GatewayAgentKind::Memory
    }

    fn run_step(&self, ctx: &AgentContext) -> Result<StepResult, String> {
        if !ctx.config.features.memory {
            return Ok(StepResult::failed(
                "Memory integration is disabled. Enable gateway.features.memory first.",
            ));
        }

        if ctx.step_kind == "vault_search" {
            return run_vault_search(ctx);
        }

        let knowledge = knowledge_router::recall_context_with_config(
            &ctx.db_path,
            Some(&ctx.app_data_dir),
            Some(&ctx.config),
            &ctx.command,
            3,
        );
        let knowledge_prefix = if knowledge.snippets.is_empty() {
            String::new()
        } else {
            format!("Recalled context: {}\n\n", knowledge.summary)
        };

        if planner::is_save_plan_command(&ctx.command) {
            return match planner::save_day_plan_to_notion(&ctx.db_path) {
                Ok(plan) => Ok(StepResult::ok(format!(
                    "{knowledge_prefix}{}\n\nSaved to Notion.",
                    planner::format_day_plan_reply(&plan)
                ))),
                Err(error) => Ok(StepResult::failed(error)),
            };
        }

        if planner::is_replan_command(&ctx.command) {
            return match planner::replan_day(&ctx.db_path, &ctx.app_data_dir, Some(&ctx.config)) {
                Ok(plan) => Ok(StepResult::ok(format!(
                    "{knowledge_prefix}{}",
                    planner::format_day_plan_reply(&plan)
                ))),
                Err(error) => Ok(StepResult::failed(error)),
            };
        }

        if ctx.config.proactive.planner_copilot_enabled
            && (planner::is_plan_command(&ctx.command)
                || brief::is_daily_brief_command(&ctx.command))
        {
            return match planner::compose_morning_plan(
                &ctx.db_path,
                &ctx.app_data_dir,
                Some(&ctx.config),
            ) {
                Ok(plan) => Ok(StepResult::ok(format!(
                    "{knowledge_prefix}{}",
                    planner::format_day_plan_reply(&plan)
                ))),
                Err(error) => Ok(StepResult::failed(error)),
            };
        }

        if brief::is_daily_brief_command(&ctx.command) {
            let composed = brief::compose_daily_brief_v2(
                &ctx.db_path,
                Some(&ctx.app_data_dir),
                Some(&ctx.config),
            )?;
            return Ok(StepResult::ok(format!("{knowledge_prefix}{composed}")));
        }

        if matches!(
            memory::parse_memory_command(&ctx.command),
            Some(memory::MemoryAction::MeetingCopilot)
        ) {
            return run_meeting_copilot(ctx, &knowledge_prefix);
        }

        if memory::travel_copilot::is_travel_copilot_command(&ctx.command) {
            return match memory::travel_copilot::compose_travel_copilot(
                &ctx.db_path,
                Some(&ctx.config),
            ) {
                Ok(reply) => Ok(StepResult::ok(format!("{knowledge_prefix}{reply}"))),
                Err(error) => Ok(StepResult::failed(error)),
            };
        }

        if memory::world_model::is_world_model_query(&ctx.command) {
            return match memory::world_model::answer_world_model_query(
                &ctx.db_path,
                &ctx.config,
                &ctx.command,
            ) {
                Ok(reply) => Ok(StepResult::ok(format!("{knowledge_prefix}{reply}"))),
                Err(error) => Ok(StepResult::failed(error)),
            };
        }

        memory::run_memory_action(&ctx.db_path, &ctx.command)
            .map(|reply| StepResult::ok(format!("{knowledge_prefix}{reply}")))
    }
}

fn run_meeting_copilot(ctx: &AgentContext, knowledge_prefix: &str) -> Result<StepResult, String> {
    let (summary, start) = if ctx.config.features.calendar {
        match crate::integrations::google::get_session_token("calendar") {
            Ok(token) => {
                match crate::integrations::google::calendar::find_event_starting_within(&token, 60)
                {
                    Ok(Some(event)) => (Some(event.summary), event.start),
                    Ok(None) => (None, None),
                    Err(error) => {
                        return Ok(StepResult::failed(format!(
                            "I could not read your calendar for meeting prep: {error}"
                        )));
                    }
                }
            }
            Err(_) => {
                return Ok(StepResult::failed(
                    "Google Calendar is not connected yet. Connect Google Calendar in Settings first.",
                ));
            }
        }
    } else {
        (None, None)
    };

    let reply = memory::meeting::compose_meeting_copilot_v2(
        &ctx.db_path,
        &ctx.app_data_dir,
        Some(&ctx.config),
        summary.as_deref(),
        start.as_deref(),
    )
    .map(|(reply, _)| reply)?;
    Ok(StepResult::ok(format!("{knowledge_prefix}{reply}")))
}

fn run_vault_search(ctx: &AgentContext) -> Result<StepResult, String> {
    if let Some(note) = knowledge_router::parse_backlinks_query(&ctx.command) {
        let host_id = ctx
            .config
            .knowledge
            .obsidian_host_id
            .as_deref()
            .filter(|value| !value.is_empty())
            .unwrap_or("obsidian-graph");
        match knowledge_router::fetch_obsidian_backlinks(&ctx.config, host_id, &note) {
            Ok(reply) => {
                return Ok(StepResult::ok(format!(
                    "Backlinks for \"{note}\":\n{reply}"
                )));
            }
            Err(error) => {
                return Ok(StepResult::failed(format!(
                    "Could not fetch Obsidian backlinks for \"{note}\": {error}"
                )));
            }
        }
    }

    let query = knowledge_router::parse_vault_search_query(&ctx.command)
        .unwrap_or_else(|| ctx.command.trim().to_string());
    if query.is_empty() {
        return Ok(StepResult::failed("Vault search needs a query."));
    }

    let bundle = knowledge_router::recall_context_with_config(
        &ctx.db_path,
        Some(&ctx.app_data_dir),
        Some(&ctx.config),
        &format!("search vault for {query}"),
        5,
    );

    if bundle.snippets.is_empty() {
        if let Some(path) = ctx
            .config
            .knowledge
            .local_vault_path
            .as_deref()
            .filter(|value| !value.trim().is_empty())
        {
            let vault_path = crate::memory::vault::resolve_vault_path(path);
            if !vault_path.is_dir() {
                return Ok(StepResult::failed(format!(
                    "Local vault path is not configured or missing: {}",
                    vault_path.display()
                )));
            }
        }
        return Ok(StepResult::ok(format!(
            "No vault notes matched \"{query}\"."
        )));
    }

    Ok(StepResult::ok(format!(
        "Vault results for \"{query}\":\n{}",
        bundle.summary
    )))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gateway::config::GatewayConfig;
    use crate::gateway::types::{
        GatewayAgentKind, GatewayConfidenceBand, GatewayDecisionPolicy, GatewayModelTier,
        GatewayRoute, GatewaySensitivity, RouteLevel,
    };

    #[test]
    fn memory_agent_lists_people_when_empty() {
        let db_path = std::env::temp_dir().join(format!(
            "jarvis-memory-agent-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|duration| duration.as_nanos())
                .unwrap_or(0)
        ));
        let ctx = AgentContext {
            db_path: db_path.clone(),
            app_data_dir: std::env::temp_dir(),
            config: GatewayConfig {
                enabled: true,
                features: crate::gateway::config::GatewayFeatures {
                    memory: true,
                    ..Default::default()
                },
                ..Default::default()
            },
            route: GatewayRoute {
                capability_id: "memory.life".into(),
                capability_label: "Memory".into(),
                agent: GatewayAgentKind::Memory,
                tier: GatewayModelTier::Embed,
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
            command: "show my people memory".into(),
            step_description: "show my people memory".into(),
            step_kind: "memory".into(),
        };
        let result = MemoryAgent.run_step(&ctx).expect("step");
        assert!(result.success);
        assert!(result.reply.contains("No people"));
        let _ = std::fs::remove_file(db_path);
    }

    #[test]
    fn memory_agent_daily_brief_without_planner_returns_text() {
        let ctx = AgentContext {
            db_path: std::env::temp_dir().join("jarvis-memory-agent-brief.db"),
            app_data_dir: std::env::temp_dir(),
            config: GatewayConfig {
                enabled: true,
                features: crate::gateway::config::GatewayFeatures {
                    memory: true,
                    ..Default::default()
                },
                proactive: crate::gateway::config::GatewayProactiveConfig {
                    planner_copilot_enabled: false,
                    ..Default::default()
                },
                ..Default::default()
            },
            route: GatewayRoute {
                capability_id: "memory.life".into(),
                capability_label: "Memory".into(),
                agent: GatewayAgentKind::Memory,
                tier: GatewayModelTier::Embed,
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
            command: "create daily brief".into(),
            step_description: "create daily brief".into(),
            step_kind: "memory".into(),
        };
        let result = MemoryAgent.run_step(&ctx).expect("step");
        assert!(result.success);
        assert!(result.reply.contains("Daily brief"));
        assert!(result.integration_handoff.is_none());
    }
}
