use super::{parse_then_steps, Agent, AgentContext, StepResult};
use crate::gateway::types::GatewayAgentKind;

pub struct SupervisorAgent;

impl Agent for SupervisorAgent {
    fn kind(&self) -> GatewayAgentKind {
        GatewayAgentKind::Supervisor
    }

    fn run_step(&self, ctx: &AgentContext) -> Result<StepResult, String> {
        if ctx.step_kind == "supervisor_step" {
            return Ok(StepResult::ok(format!(
                "Supervisor delegated step: {}",
                ctx.step_description
            )));
        }

        if let Some((left, right)) = parse_then_steps(&ctx.command) {
            return Ok(StepResult::ok(format!(
                "Supervisor planned sequence:\n1. {}\n2. {}",
                left, right
            )));
        }

        Ok(StepResult::failed(
            "Supervisor could not derive a multi-step plan for this command.",
        ))
    }
}
