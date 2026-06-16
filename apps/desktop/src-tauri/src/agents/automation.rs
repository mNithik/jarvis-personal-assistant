use super::{Agent, AgentContext, StepResult};
use crate::commands::desktop::open_named_target;
use crate::db::automation_store::find_saved_workflow_by_name;
use crate::db::{find_routine_with_steps, RoutineStepRecord};
use crate::gateway::types::GatewayAgentKind;

pub struct AutomationAgent;

impl Agent for AutomationAgent {
    fn kind(&self) -> GatewayAgentKind {
        GatewayAgentKind::Automation
    }

    fn run_step(&self, ctx: &AgentContext) -> Result<StepResult, String> {
        if ctx.step_kind == "automation_workflow" || ctx.step_kind == "run_workflow" {
            return run_saved_workflow(ctx);
        }

        let normalized = ctx.command.trim().to_lowercase();
        if normalized.contains("schedule") {
            return crate::agents::ocr_watch::run_desktop_schedules_terminal(ctx);
        }
        if normalized.starts_with("run workflow ") || normalized.starts_with("start workflow ") {
            return run_saved_workflow(ctx);
        }

        Ok(StepResult::failed(
            "Automation agent did not recognize a saved workflow command.",
        ))
    }
}

fn run_saved_workflow(ctx: &AgentContext) -> Result<StepResult, String> {
    let name = workflow_name_from_command(&ctx.command)
        .unwrap_or_else(|| ctx.step_description.clone());

    if let Some((routine, steps)) = find_routine_with_steps(&ctx.db_path, &name)? {
        let mut executed = Vec::new();
        for step in steps {
            match execute_routine_step(&ctx.db_path, &step) {
                Ok(label) => executed.push(label),
                Err(error) => {
                    return Ok(StepResult::failed(format!(
                        "Workflow \"{}\" failed on step {}: {error}",
                        routine.name, step.step_order
                    )));
                }
            }
        }
        return Ok(StepResult::ok(format!(
            "Automation ran workflow \"{}\" in Rust ({} steps): {}",
            routine.name,
            executed.len(),
            executed.join("; ")
        )));
    }

    if let Some(workflow) = find_saved_workflow_by_name(&ctx.db_path, &name)? {
        let mut executed = Vec::new();
        for (index, step) in workflow.steps.iter().enumerate() {
            match execute_workflow_step(&ctx.db_path, step) {
                Ok(label) => executed.push(label),
                Err(error) => {
                    return Ok(StepResult::failed(format!(
                        "Workflow \"{}\" failed on step {}: {error}",
                        workflow.name,
                        index + 1
                    )));
                }
            }
        }
        return Ok(StepResult::ok(format!(
            "Automation ran workflow \"{}\" in Rust ({} steps): {}",
            workflow.name,
            executed.len(),
            executed.join("; ")
        )));
    }

    Ok(StepResult::failed(format!(
        "No saved workflow named \"{name}\" was found in SQLite."
    )))
}

fn execute_workflow_step(db_path: &std::path::Path, step: &str) -> Result<String, String> {
    let trimmed = step.trim();
    if trimmed.is_empty() {
        return Err("Workflow step was empty.".to_string());
    }
    let lower = trimmed.to_lowercase();
    if let Some(target) = lower.strip_prefix("open ") {
        return open_named_target(db_path, target.trim());
    }
    open_named_target(db_path, trimmed)
}

fn execute_routine_step(db_path: &std::path::Path, step: &RoutineStepRecord) -> Result<String, String> {
    match step.action_type.as_str() {
        "open_url" | "open_app" => open_named_target(db_path, &step.action_value),
        _ => Err(format!("Unsupported routine action type {}", step.action_type)),
    }
}

fn workflow_name_from_command(command: &str) -> Option<String> {
    let normalized = command.trim().to_lowercase();
    for prefix in ["run workflow ", "start workflow "] {
        if normalized.starts_with(prefix) {
            let name = command[prefix.len()..].trim();
            if !name.is_empty() {
                return Some(name.to_string());
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_workflow_name() {
        assert_eq!(
            workflow_name_from_command("run workflow Study Setup"),
            Some("Study Setup".to_string())
        );
    }
}
