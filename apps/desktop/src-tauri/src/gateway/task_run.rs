//! Wave 13 T13-F: task run state types and DB bridge.

use serde::{Deserialize, Serialize};

use crate::db::TaskStateRecord;

use super::task_loop::{StepStatus, TaskStepsPayload};
use super::types::GatewayPolicyClass;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TaskRunStatus {
    Queued,
    Running,
    Blocked,
    AwaitingApproval,
    Done,
    Failed,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TaskRunStepStatus {
    Pending,
    Running,
    Done,
    Failed,
    Skipped,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StepFailureKind {
    PolicyBlocked,
    ToolError,
    BudgetExceeded,
    ApprovalRequired,
    Transient,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TaskRunStep {
    pub id: String,
    pub description: String,
    pub policy_class: GatewayPolicyClass,
    pub status: TaskRunStepStatus,
    pub result: Option<String>,
    pub failure_kind: Option<StepFailureKind>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TaskRunRecord {
    pub id: String,
    pub session_id: String,
    pub command: String,
    pub status: TaskRunStatus,
    pub current_step_index: u32,
    pub steps: Vec<TaskRunStep>,
    pub checkpoint_step_id: Option<String>,
    pub failure_count: u32,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TaskRunSummary {
    pub id: String,
    pub session_id: String,
    pub command: String,
    pub status: TaskRunStatus,
    pub current_step_index: u32,
    pub step_count: u32,
    pub failure_count: u32,
    pub updated_at: String,
}

impl TaskRunRecord {
    pub fn new(
        id: impl Into<String>,
        session_id: impl Into<String>,
        command: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            session_id: session_id.into(),
            command: command.into(),
            status: TaskRunStatus::Queued,
            current_step_index: 0,
            steps: Vec::new(),
            checkpoint_step_id: None,
            failure_count: 0,
            updated_at: String::new(),
        }
    }
}

fn map_task_status(status: &str) -> TaskRunStatus {
    match status {
        "planning" => TaskRunStatus::Queued,
        "running" => TaskRunStatus::Running,
        "complete" => TaskRunStatus::Done,
        "failed" => TaskRunStatus::Failed,
        "blocked" => TaskRunStatus::Blocked,
        "awaiting_approval" => TaskRunStatus::AwaitingApproval,
        _ => TaskRunStatus::Queued,
    }
}

fn map_step_status(status: &super::task_loop::StepStatus) -> TaskRunStepStatus {
    match status {
        super::task_loop::StepStatus::Pending => TaskRunStepStatus::Pending,
        super::task_loop::StepStatus::Running => TaskRunStepStatus::Running,
        super::task_loop::StepStatus::Done => TaskRunStepStatus::Done,
        super::task_loop::StepStatus::Failed => TaskRunStepStatus::Failed,
    }
}

pub fn from_task_state(
    record: &TaskStateRecord,
    policy_class: GatewayPolicyClass,
) -> TaskRunRecord {
    let payload: TaskStepsPayload =
        serde_json::from_str(&record.steps_json).unwrap_or(TaskStepsPayload {
            failure_count: 0,
            supervisor_recoveries: 0,
            steps: Vec::new(),
        });
    let checkpoint = payload
        .steps
        .get(record.current_step as usize)
        .map(|step| step.id.clone());
    let steps = payload
        .steps
        .iter()
        .map(|step| TaskRunStep {
            id: step.id.clone(),
            description: step.description.clone(),
            policy_class,
            status: map_step_status(&step.status),
            result: step.result.clone(),
            failure_kind: if step.status == StepStatus::Failed {
                Some(StepFailureKind::ToolError)
            } else {
                None
            },
        })
        .collect();

    TaskRunRecord {
        id: record.id.clone(),
        session_id: record.session_id.clone(),
        command: record.goal.clone(),
        status: map_task_status(&record.status),
        current_step_index: record.current_step.max(0) as u32,
        steps,
        checkpoint_step_id: checkpoint,
        failure_count: payload.failure_count,
        updated_at: record.updated_at.clone(),
    }
}

pub fn summary_from_task_state(record: &TaskStateRecord) -> TaskRunSummary {
    let payload: TaskStepsPayload =
        serde_json::from_str(&record.steps_json).unwrap_or(TaskStepsPayload {
            failure_count: 0,
            supervisor_recoveries: 0,
            steps: Vec::new(),
        });
    TaskRunSummary {
        id: record.id.clone(),
        session_id: record.session_id.clone(),
        command: record.goal.clone(),
        status: map_task_status(&record.status),
        current_step_index: record.current_step.max(0) as u32,
        step_count: payload.steps.len() as u32,
        failure_count: payload.failure_count,
        updated_at: record.updated_at.clone(),
    }
}

pub fn is_resume_last_command(command: &str) -> bool {
    matches!(
        command.trim().to_lowercase().as_str(),
        "resume last task" | "resume task" | "continue last task"
    )
}

pub fn is_list_task_runs_command(command: &str) -> bool {
    let normalized = command.trim().to_lowercase();
    normalized.contains("show task runs")
        || normalized.contains("list task runs")
        || normalized.contains("mission control")
        || normalized.contains("task status")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_task_run_starts_queued() {
        let run = TaskRunRecord::new("run-1", "session-1", "prep me for my next meeting");
        assert_eq!(run.status, TaskRunStatus::Queued);
        assert!(run.steps.is_empty());
    }

    #[test]
    fn resume_last_command_detected() {
        assert!(is_resume_last_command("resume last task"));
        assert!(!is_resume_last_command("check my email"));
    }
}
