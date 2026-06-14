use std::path::Path;

use crate::db::list_learned_intents;

use super::l0::{build_route, classify_sensitivity, normalize_command, CapabilityRoute};
use crate::gateway::types::{GatewayAgentKind, GatewayModelTier, GatewayRoute, RouteLevel};

pub fn route_l1(command: &str, db_path: &Path) -> Option<GatewayRoute> {
    let normalized = normalize_command(command);
    let intents = list_learned_intents(db_path).ok()?;
    let record = intents.into_iter().find(|record| {
        record.normalized_phrase == normalized
            || normalized.contains(&record.normalized_phrase)
            || record.normalized_phrase.contains(&normalized)
    })?;

    let capability = map_intent_to_capability(&record.intent_kind)?;
    let sensitivity = classify_sensitivity(&normalized);
    let mut route = build_route(&capability, sensitivity, 4, RouteLevel::L1);
    route.reason = format!(
        "Matched learned intent '{}' ({})",
        record.phrase, record.intent_kind
    );
    Some(route)
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
