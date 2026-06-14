use super::{Agent, AgentContext, StepResult};
use crate::gateway::types::GatewayAgentKind;
use crate::memory;

pub struct FinanceAgent;

impl Agent for FinanceAgent {
    fn kind(&self) -> GatewayAgentKind {
        GatewayAgentKind::Finance
    }

    fn run_step(&self, ctx: &AgentContext) -> Result<StepResult, String> {
        if !ctx.config.features.memory {
            return Ok(StepResult::failed(
                "Finance recall requires memory integration. Enable gateway.features.memory first.",
            ));
        }

        let normalized = ctx.command.to_lowercase();
        if normalized.contains("trade") || normalized.contains("buy stock") || normalized.contains("sell stock") {
            return Ok(StepResult::failed(
                "Finance agent is read-only. Trading and transfers are not supported.",
            ));
        }

        memory::run_memory_action(&ctx.db_path, &ctx.command).map(|reply| {
            StepResult::ok(format!("Finance (read-only): {reply}"))
        })
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

    fn finance_ctx(command: &str) -> AgentContext {
        AgentContext {
            db_path: std::env::temp_dir().join("jarvis-finance-agent-test.db"),
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
                capability_id: "finance.readonly".into(),
                capability_label: "Finance".into(),
                agent: GatewayAgentKind::Finance,
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
            session_id: "test".into(),
            turn_id: 1,
            command: command.to_string(),
            step_description: command.to_string(),
            step_kind: "finance".to_string(),
        }
    }

    #[test]
    fn blocks_trading_commands() {
        let ctx = finance_ctx("buy stock AAPL");
        let result = FinanceAgent.run_step(&ctx).expect("step");
        assert!(!result.success);
    }
}
