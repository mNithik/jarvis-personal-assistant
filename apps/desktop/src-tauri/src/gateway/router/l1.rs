use std::path::Path;

use crate::db::list_learned_intents;
use crate::gateway::capabilities::list_capabilities;

use super::l0::{build_route, classify_sensitivity, normalize_command, CapabilityRoute};
use crate::gateway::types::{
    GatewayAgentKind, GatewayConfidenceBand, GatewayDecisionPolicy, GatewayModelTier, GatewayRoute,
    GatewaySensitivity, RouteLevel,
};

pub fn route_l1(command: &str, db_path: &Path) -> Option<GatewayRoute> {
    let normalized = normalize_command(command);
    let intents = list_learned_intents(db_path).ok()?;
    let record = intents.into_iter().find(|record| {
        record.normalized_phrase == normalized
            || normalized.contains(&record.normalized_phrase)
            || record.normalized_phrase.contains(&normalized)
    })?;

    let capability = map_intent_to_capability(&record.intent_kind);
    let sensitivity = classify_sensitivity(&normalized);
    if let Some(capability) = capability {
        let mut route = build_route(&capability, sensitivity, 4, RouteLevel::L1);
        route.reason = format!(
            "Matched learned intent '{}' ({})",
            record.phrase, record.intent_kind
        );
        return Some(route);
    }

    route_learned_capability(&record.intent_kind, sensitivity, &record.phrase)
}

fn route_learned_capability(
    capability_id: &str,
    sensitivity: GatewaySensitivity,
    phrase: &str,
) -> Option<GatewayRoute> {
    let record = list_capabilities()
        .into_iter()
        .find(|capability| capability.id == capability_id)?;
    let agent = match record.agent.as_str() {
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
    };
    let tier = match record.tier.as_str() {
        "embed" => GatewayModelTier::Embed,
        "worker" => GatewayModelTier::Worker,
        "planner" => GatewayModelTier::Planner,
        _ => GatewayModelTier::Local,
    };
    let (decision_policy, decision_reason) = match sensitivity {
        GatewaySensitivity::Secret => (
            GatewayDecisionPolicy::Confirm,
            "Learned phrase maps to a secret-handling capability.".to_string(),
        ),
        _ => (
            GatewayDecisionPolicy::Execute,
            "Learned phrase mapping with high confidence.".to_string(),
        ),
    };

    Some(GatewayRoute {
        capability_id: record.id.clone(),
        capability_label: record.label.clone(),
        agent,
        tier,
        sensitivity,
        score: 4,
        confidence: GatewayConfidenceBand::High,
        decision_policy,
        decision_reason,
        reason: format!("Matched learned intent '{}' ({})", phrase, capability_id),
        route_level: RouteLevel::L1,
        resolved_provider: record.provider,
    })
}

fn map_intent_to_capability(intent_kind: &str) -> Option<CapabilityRoute> {
    let kind = intent_kind.trim().to_lowercase();
    match kind.as_str() {
        "study_setup" | "study" => Some(CapabilityRoute {
            id: "command.study",
            label: "Study Setup",
            agent: GatewayAgentKind::Command,
            tier: GatewayModelTier::Local,
            keywords: &[],
            reason: "Learned study setup intent.",
        }),
        "open_url" | "browser" => Some(CapabilityRoute {
            id: "command.desktop",
            label: "Desktop Command",
            agent: GatewayAgentKind::Command,
            tier: GatewayModelTier::Local,
            keywords: &[],
            reason: "Learned browser intent.",
        }),
        "google_search" | "search" => Some(CapabilityRoute {
            id: "command.search",
            label: "Search Command",
            agent: GatewayAgentKind::Command,
            tier: GatewayModelTier::Local,
            keywords: &[],
            reason: "Learned search intent.",
        }),
        "notion" | "note" => Some(CapabilityRoute {
            id: "integrations.notion",
            label: "Notion",
            agent: GatewayAgentKind::Integrations,
            tier: GatewayModelTier::Worker,
            keywords: &[],
            reason: "Learned Notion intent.",
        }),
        _ => None,
    }
}
