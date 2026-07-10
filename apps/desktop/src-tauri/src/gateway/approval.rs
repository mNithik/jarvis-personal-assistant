use std::time::{SystemTime, UNIX_EPOCH};

use super::policy::{policy_class_label, requires_confirmation, route_policy_class};
use super::types::{
    ApprovalRequest, ApprovalRisk, GatewayDecisionPolicy, GatewayRoute, GatewaySensitivity,
};
use crate::gateway::tools::{list_tool_definitions, ToolDefinition};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ApprovalOutcome {
    Allowed,
    ApprovalRequired(ApprovalRequest),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ApprovalGate;

impl ApprovalGate {
    pub fn evaluate_route(
        route: &GatewayRoute,
        session_id: &str,
        turn_id: u64,
        command: &str,
    ) -> ApprovalOutcome {
        if crate::gateway::audit::is_search_audit_command(command)
            || crate::gateway::audit::is_rollback_notion_command(command)
        {
            return ApprovalOutcome::Allowed;
        }

        let policy_class = route_policy_class(route);
        if requires_confirmation(policy_class) {
            return ApprovalOutcome::ApprovalRequired(build_request(
                session_id,
                turn_id,
                format!(
                    "Confirm {} action: {}",
                    policy_class_label(policy_class),
                    route.capability_label
                ),
                format!(
                    "JARVIS classified \"{command}\" as {} policy for {} ({}).\n{}",
                    policy_class_label(policy_class),
                    route.capability_label,
                    route.capability_id,
                    route.decision_reason
                ),
                policy_risk(policy_class, route),
            ));
        }

        let requires_confirmation = matches!(
            route.decision_policy,
            GatewayDecisionPolicy::Confirm | GatewayDecisionPolicy::Teach
        ) || route.sensitivity == GatewaySensitivity::Secret;

        if !requires_confirmation {
            return ApprovalOutcome::Allowed;
        }

        ApprovalOutcome::ApprovalRequired(build_request(
            session_id,
            turn_id,
            format!("Confirm route: {}", route.capability_label),
            format!(
                "JARVIS wants to route \"{command}\" to {} ({}) before acting.\n{}",
                route.capability_label, route.capability_id, route.decision_reason
            ),
            route_risk(route),
        ))
    }

    pub fn evaluate_tool(tool_id: &str, session_id: &str, turn_id: u64) -> ApprovalOutcome {
        let Some(tool) = find_tool(tool_id) else {
            return ApprovalOutcome::Allowed;
        };

        match tool.risk {
            ApprovalRisk::Read => ApprovalOutcome::Allowed,
            ApprovalRisk::Write | ApprovalRisk::Destructive => {
                ApprovalOutcome::ApprovalRequired(build_request(
                    session_id,
                    turn_id,
                    format!("Approve tool: {}", tool.label),
                    format!(
                        "Tool `{}` is classified as {:?}. Confirm before JARVIS executes it.",
                        tool.id, tool.risk
                    ),
                    tool.risk.clone(),
                ))
            }
        }
    }
}

fn route_risk(route: &GatewayRoute) -> ApprovalRisk {
    if route.sensitivity == GatewaySensitivity::Secret {
        return ApprovalRisk::Destructive;
    }

    match route.decision_policy {
        GatewayDecisionPolicy::Teach => ApprovalRisk::Write,
        GatewayDecisionPolicy::Confirm => ApprovalRisk::Write,
        GatewayDecisionPolicy::Execute => ApprovalRisk::Read,
    }
}

fn policy_risk(
    policy_class: crate::gateway::types::GatewayPolicyClass,
    route: &GatewayRoute,
) -> ApprovalRisk {
    use crate::gateway::types::GatewayPolicyClass;

    match policy_class {
        GatewayPolicyClass::Delete | GatewayPolicyClass::Pay => ApprovalRisk::Destructive,
        GatewayPolicyClass::Send | GatewayPolicyClass::Schedule | GatewayPolicyClass::Execute => {
            ApprovalRisk::Write
        }
        GatewayPolicyClass::Write => ApprovalRisk::Write,
        GatewayPolicyClass::Read => route_risk(route),
    }
}

fn find_tool(tool_id: &str) -> Option<ToolDefinition> {
    list_tool_definitions()
        .into_iter()
        .find(|tool| tool.id == tool_id)
}

fn build_request(
    session_id: &str,
    turn_id: u64,
    title: String,
    detail: String,
    risk: ApprovalRisk,
) -> ApprovalRequest {
    ApprovalRequest {
        id: format!("approval-{session_id}-{turn_id}"),
        session_id: session_id.to_string(),
        title,
        detail,
        risk,
        created_at: unix_timestamp_string(),
    }
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
    use crate::gateway::types::{
        GatewayAgentKind, GatewayConfidenceBand, GatewayDecisionPolicy, GatewayModelTier,
    };

    fn sample_route(decision_policy: GatewayDecisionPolicy) -> GatewayRoute {
        GatewayRoute {
            capability_id: "integrations.notion".to_string(),
            capability_label: "Notion".to_string(),
            agent: GatewayAgentKind::Integrations,
            tier: GatewayModelTier::Worker,
            sensitivity: GatewaySensitivity::Personal,
            score: 3,
            confidence: GatewayConfidenceBand::High,
            decision_policy,
            decision_reason: "Needs confirmation.".to_string(),
            reason: "Matched Notion.".to_string(),
            route_level: crate::gateway::types::RouteLevel::L0,
            resolved_provider: None,
        }
    }

    #[test]
    fn gmail_routes_require_policy_approval() {
        let route = GatewayRoute {
            capability_id: "integrations.gmail".to_string(),
            capability_label: "Gmail".to_string(),
            agent: GatewayAgentKind::Integrations,
            tier: GatewayModelTier::Worker,
            sensitivity: GatewaySensitivity::Personal,
            score: 3,
            confidence: GatewayConfidenceBand::High,
            decision_policy: GatewayDecisionPolicy::Execute,
            decision_reason: "Matched Gmail.".to_string(),
            reason: "Matched Gmail.".to_string(),
            route_level: crate::gateway::types::RouteLevel::L0,
            resolved_provider: None,
        };
        let outcome = ApprovalGate::evaluate_route(&route, "session-a", 5, "send email");
        assert!(matches!(outcome, ApprovalOutcome::ApprovalRequired(_)));
    }

    #[test]
    fn execute_routes_are_allowed() {
        let outcome = ApprovalGate::evaluate_route(
            &sample_route(GatewayDecisionPolicy::Execute),
            "session-a",
            1,
            "play music",
        );
        assert_eq!(outcome, ApprovalOutcome::Allowed);
    }

    #[test]
    fn confirm_routes_require_approval() {
        let outcome = ApprovalGate::evaluate_route(
            &sample_route(GatewayDecisionPolicy::Confirm),
            "session-a",
            2,
            "save task to notion",
        );
        assert!(matches!(outcome, ApprovalOutcome::ApprovalRequired(_)));
    }

    #[test]
    fn destructive_tools_require_approval() {
        let outcome = ApprovalGate::evaluate_tool("delete_provider_key", "session-a", 3);
        assert!(
            matches!(outcome, ApprovalOutcome::ApprovalRequired(request) if request.risk == ApprovalRisk::Destructive)
        );
    }

    #[test]
    fn read_tools_are_allowed() {
        let outcome = ApprovalGate::evaluate_tool("ping_jarvis", "session-a", 4);
        assert_eq!(outcome, ApprovalOutcome::Allowed);
    }
}
