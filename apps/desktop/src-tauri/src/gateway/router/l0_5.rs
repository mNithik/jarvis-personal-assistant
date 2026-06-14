use crate::gateway::types::{GatewayAgentKind, GatewayModelTier, GatewayRoute, RouteLevel};

use super::l0::{build_route, classify_sensitivity, normalize_command, CapabilityRoute};

struct WorkflowTemplate {
    trigger: &'static str,
    capability: CapabilityRoute,
}

pub fn route_l0_5(command: &str) -> Option<GatewayRoute> {
    let normalized = normalize_command(command);
    let sensitivity = classify_sensitivity(&normalized);
    let template = workflow_templates()
        .iter()
        .find(|template| normalized.contains(template.trigger))?;

    Some(build_route(
        &template.capability,
        sensitivity,
        3,
        RouteLevel::L0_5,
    ))
}

fn workflow_templates() -> &'static [WorkflowTemplate] {
    &[
        WorkflowTemplate {
            trigger: "run email capture",
            capability: CapabilityRoute {
                id: "workflow.email_capture",
                label: "Email Capture Workflow",
                agent: GatewayAgentKind::Integrations,
                tier: GatewayModelTier::Worker,
                keywords: &[],
                reason: "Matched the email capture workflow template.",
            },
        },
        WorkflowTemplate {
            trigger: "run pdf summary",
            capability: CapabilityRoute {
                id: "workflow.pdf_summary",
                label: "PDF Summary Workflow",
                agent: GatewayAgentKind::Vision,
                tier: GatewayModelTier::Worker,
                keywords: &[],
                reason: "Matched the PDF summary workflow template.",
            },
        },
        WorkflowTemplate {
            trigger: "run task reset",
            capability: CapabilityRoute {
                id: "workflow.task_reset",
                label: "Task Reset Workflow",
                agent: GatewayAgentKind::Integrations,
                tier: GatewayModelTier::Worker,
                keywords: &[],
                reason: "Matched the task reset workflow template.",
            },
        },
        WorkflowTemplate {
            trigger: "run smart pdf summary",
            capability: CapabilityRoute {
                id: "workflow.smart_pdf_summary",
                label: "Smart PDF Summary Workflow",
                agent: GatewayAgentKind::Vision,
                tier: GatewayModelTier::Worker,
                keywords: &[],
                reason: "Matched the smart PDF summary workflow template.",
            },
        },
    ]
}
