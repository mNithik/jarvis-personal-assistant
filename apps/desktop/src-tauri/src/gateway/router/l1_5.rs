use crate::gateway::{
    capabilities::{list_capabilities, CapabilityRecord},
    types::{
        GatewayAgentKind, GatewayConfidenceBand, GatewayDecisionPolicy, GatewayModelTier,
        GatewayRoute, GatewaySensitivity, RouteLevel,
    },
};

use super::l0::{classify_sensitivity, normalize_command};

pub fn route_l1_5(command: &str) -> Option<GatewayRoute> {
    let normalized = normalize_command(command);
    let sensitivity = classify_sensitivity(&normalized);

    list_capabilities()
        .into_iter()
        .filter_map(|capability| {
            let score = score_capability(&normalized, &capability);
            (score > 0).then(|| build_route(capability, sensitivity.clone(), score))
        })
        .max_by(|left, right| left.score.cmp(&right.score))
}

fn score_capability(command: &str, capability: &CapabilityRecord) -> u32 {
    let id = capability.id.to_lowercase();
    if command.contains(&id) {
        return 6;
    }

    let label = capability.label.to_lowercase();
    if label.split_whitespace().count() > 1 && command.contains(&label) {
        return 4;
    }

    0
}

fn build_route(
    capability: CapabilityRecord,
    sensitivity: GatewaySensitivity,
    score: u32,
) -> GatewayRoute {
    let confidence = if score >= 6 {
        GatewayConfidenceBand::High
    } else {
        GatewayConfidenceBand::Medium
    };
    let (decision_policy, decision_reason) = decision_for_route(&confidence, &sensitivity);

    GatewayRoute {
        capability_id: capability.id.clone(),
        capability_label: capability.label.clone(),
        agent: map_agent(&capability.agent),
        tier: map_tier(&capability.tier),
        sensitivity,
        score,
        confidence,
        decision_policy,
        decision_reason,
        reason: format!(
            "Matched capability registry entry {} from capabilities.yaml.",
            capability.id
        ),
        route_level: RouteLevel::L1_5,
        resolved_provider: capability.provider,
    }
}

fn map_agent(agent: &str) -> GatewayAgentKind {
    match agent {
        "vision" => GatewayAgentKind::Vision,
        "memory" => GatewayAgentKind::Memory,
        "integrations" => GatewayAgentKind::Integrations,
        "builder" => GatewayAgentKind::Builder,
        "supervisor" => GatewayAgentKind::Supervisor,
        "automation" => GatewayAgentKind::Automation,
        "research" => GatewayAgentKind::Research,
        "finance" => GatewayAgentKind::Finance,
        "writer" => GatewayAgentKind::Writer,
        _ => GatewayAgentKind::Command,
    }
}

fn map_tier(tier: &str) -> GatewayModelTier {
    match tier {
        "talker" | "chat" => GatewayModelTier::Talker,
        "planner" => GatewayModelTier::Planner,
        "worker" => GatewayModelTier::Worker,
        "embed" => GatewayModelTier::Embed,
        _ => GatewayModelTier::Local,
    }
}

fn decision_for_route(
    confidence: &GatewayConfidenceBand,
    sensitivity: &GatewaySensitivity,
) -> (GatewayDecisionPolicy, String) {
    match (confidence, sensitivity) {
        (GatewayConfidenceBand::High, GatewaySensitivity::Public) => (
            GatewayDecisionPolicy::Execute,
            "High confidence registry route. Safe to execute when gateway takeover is enabled."
                .to_string(),
        ),
        (GatewayConfidenceBand::Low, _) => (
            GatewayDecisionPolicy::Teach,
            "Low confidence registry route. Ask the user to teach or clarify this phrase."
                .to_string(),
        ),
        _ => (
            GatewayDecisionPolicy::Confirm,
            "Registry route touches sensitive or medium-confidence context. Confirm before acting."
                .to_string(),
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exact_capability_id_routes_from_yaml_registry() {
        let route = route_l1_5("use capability memory.life").expect("registry route");

        assert_eq!(route.capability_id, "memory.life");
        assert_eq!(route.capability_label, "Life memory");
        assert_eq!(route.agent, GatewayAgentKind::Memory);
        assert_eq!(route.tier, GatewayModelTier::Embed);
        assert_eq!(route.route_level, RouteLevel::L1_5);
        assert!(route.reason.contains("capabilities.yaml"));
    }

    #[test]
    fn label_match_routes_from_yaml_registry() {
        let route = route_l1_5("please use life memory").expect("registry route");

        assert_eq!(route.capability_id, "memory.life");
        assert_eq!(route.confidence, GatewayConfidenceBand::Medium);
        assert_eq!(route.decision_policy, GatewayDecisionPolicy::Confirm);
    }
}
