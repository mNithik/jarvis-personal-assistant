use super::{Agent, AgentContext, StepResult};
use crate::builder::{
    checks_succeeded, parse_builder_command, plan_coding_assist, resolve_jarvis_project_dir,
    run_project_checks, BuilderAction,
};
use crate::db::log_action;
use crate::gateway::types::GatewayAgentKind;

pub struct BuilderAgent;

impl Agent for BuilderAgent {
    fn kind(&self) -> GatewayAgentKind {
        GatewayAgentKind::Builder
    }

    fn run_step(&self, ctx: &AgentContext) -> Result<StepResult, String> {
        if !ctx.config.features.builder {
            return Ok(StepResult::failed(
                "Builder integration is disabled. Enable gateway.features.builder first.",
            ));
        }

        let action = parse_builder_command(&ctx.command).ok_or_else(|| {
            "Could not parse a builder or coding command.".to_string()
        })?;

        match action {
            BuilderAction::CreateHandoff {
                request,
                launch_executor,
            } => {
                let payload = serde_json::json!({
                    "request": request,
                    "launchExecutor": launch_executor,
                })
                .to_string();
                Ok(StepResult::handoff(
                    "builder.code",
                    "create_builder_handoff",
                    Some(payload),
                    "Handing off coding build request to the desktop builder bridge.",
                ))
            }
            BuilderAction::RunProjectChecks => {
                let project_dir = resolve_jarvis_project_dir(&std::env::current_dir().map_err(
                    |error| {
                        format!(
                            "Could not resolve the current JARVIS project directory: {}",
                            error
                        )
                    },
                )?)?;

                match run_project_checks(&project_dir) {
                    Ok(summary) => {
                        let _ = log_action(
                            &ctx.db_path,
                            "Run JARVIS project checks",
                            "run_jarvis_project_checks",
                            "success",
                            &project_dir.to_string_lossy(),
                        );
                        Ok(StepResult::ok(summary))
                    }
                    Err(summary) => {
                        let status = if checks_succeeded(&summary) {
                            "success"
                        } else {
                            "failed"
                        };
                        let _ = log_action(
                            &ctx.db_path,
                            "Run JARVIS project checks",
                            "run_jarvis_project_checks",
                            status,
                            &project_dir.to_string_lossy(),
                        );
                        Ok(StepResult::failed(summary))
                    }
                }
            }
            BuilderAction::OpenProjectInVscode => Ok(StepResult::handoff(
                "builder.code",
                "open_project_in_vscode",
                None,
                "Handing off VS Code project open to the desktop builder bridge.",
            )),
            BuilderAction::PlanDebug { .. } => match plan_coding_assist(ctx) {
                Ok(plan) => Ok(StepResult::ok(plan)),
                Err(error) => Ok(StepResult::failed(error)),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gateway::config::GatewayConfig;
    use crate::gateway::types::{
        GatewayAgentKind, GatewayConfidenceBand, GatewayDecisionPolicy, GatewayModelTier,
        GatewayRoute, GatewaySensitivity, RouteLevel,
    };

    fn builder_ctx(command: &str) -> AgentContext {
        AgentContext {
            db_path: std::env::temp_dir().join("jarvis-builder-agent-test.db"),
            app_data_dir: std::env::temp_dir(),
            config: GatewayConfig {
                enabled: true,
                features: crate::gateway::config::GatewayFeatures {
                    builder: true,
                    ..Default::default()
                },
                ..Default::default()
            },
            route: GatewayRoute {
                capability_id: "builder.code".into(),
                capability_label: "Builder".into(),
                agent: GatewayAgentKind::Builder,
                tier: GatewayModelTier::Planner,
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
            step_kind: "builder".into(),
        }
    }

    #[test]
    fn builder_handoff_for_build_in_jarvis() {
        let ctx = builder_ctx("build dark mode toggle in jarvis");
        let result = BuilderAgent.run_step(&ctx).expect("step");
        assert!(result.success);
        assert_eq!(
            result.integration_handoff.as_ref().map(|h| h.action.as_str()),
            Some("create_builder_handoff")
        );
        assert!(result
            .integration_handoff
            .as_ref()
            .and_then(|h| h.payload.as_deref())
            .unwrap_or("")
            .contains("launchExecutor"));
    }

    #[test]
    fn builder_inline_run_project_checks() {
        if std::process::Command::new("npm")
            .arg("--version")
            .output()
            .is_err()
        {
            return;
        }

        let manifest = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let project_root =
            resolve_jarvis_project_dir(&manifest).expect("jarvis project root from manifest");
        let previous_dir = std::env::current_dir().ok();
        std::env::set_current_dir(&project_root).expect("set cwd to project root");

        let ctx = builder_ctx("run project checks");
        let result = BuilderAgent.run_step(&ctx).expect("step");

        if let Some(previous_dir) = previous_dir {
            let _ = std::env::set_current_dir(previous_dir);
        }

        assert!(result.integration_handoff.is_none());
        assert!(result.reply.contains("TypeScript:"));
        assert!(result.reply.contains("Rust:"));
    }

    #[test]
    fn builder_plan_debug_without_api_key_fails_gracefully() {
        let ctx = builder_ctx("debug this repo");
        let result = BuilderAgent.run_step(&ctx).expect("step");
        assert!(!result.reply.trim().is_empty());
    }
}
