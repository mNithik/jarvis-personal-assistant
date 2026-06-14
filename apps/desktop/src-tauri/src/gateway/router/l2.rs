use std::path::Path;

use reqwest::blocking::Client;
use serde_json::json;

use crate::db::get_ollama_config;

use super::l0::{
    build_route, classify_sensitivity, normalize_command, CapabilityRoute,
};
use crate::gateway::types::{GatewayAgentKind, GatewayModelTier, GatewayRoute, RouteLevel};

pub fn route_l2(command: &str, db_path: &Path) -> Option<GatewayRoute> {
    let (base_url, model_name) = ollama_config(db_path)?;
    let normalized = normalize_command(command);
    let sensitivity = classify_sensitivity(&normalized);
    let prompt = format!(
        "Classify this desktop assistant command into one capability id. \
Return only JSON with keys capabilityId and reason. \
Allowed capabilityId values: command.study, vision.ocr, integrations.spotify, integrations.notion, integrations.google, integrations.calendar, integrations.ocr_notion, integrations.email_notion, memory.life, builder.code, command.desktop, command.search, command.general. \
Command: {normalized}"
    );

    let response = ollama_generate_json(&base_url, &model_name, &prompt).ok()?;
    let capability_id = response
        .get("capabilityId")
        .and_then(|value| value.as_str())?;
    let capability = map_capability_id(capability_id)?;
    let mut route = build_route(&capability, sensitivity, 2, RouteLevel::L2);
    route.reason = response
        .get("reason")
        .and_then(|value| value.as_str())
        .unwrap_or("Matched via Ollama L2 router.")
        .to_string();
    Some(route)
}

fn ollama_config(db_path: &Path) -> Option<(String, String)> {
    let (base_url, model_name) = get_ollama_config(db_path).ok()?;
    Some((
        base_url.filter(|value| !value.trim().is_empty())?,
        model_name.filter(|value| !value.trim().is_empty())?,
    ))
}

fn ollama_generate_json(
    base_url: &str,
    model_name: &str,
    prompt: &str,
) -> Result<serde_json::Value, String> {
    let url = format!("{}/api/generate", base_url.trim_end_matches('/'));
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|error| error.to_string())?;
    let response = client
        .post(url)
        .json(&json!({
            "model": model_name,
            "prompt": prompt,
            "stream": false,
            "format": "json",
            "options": { "temperature": 0 }
        }))
        .send()
        .map_err(|error| error.to_string())?;
    let body = response.text().map_err(|error| error.to_string())?;
    let value: serde_json::Value = serde_json::from_str(&body).map_err(|error| error.to_string())?;
    let content = value
        .get("response")
        .and_then(|response| response.as_str())
        .ok_or_else(|| "Ollama L2 returned empty response.".to_string())?;
    serde_json::from_str(content).map_err(|error| error.to_string())
}

fn map_capability_id(id: &str) -> Option<CapabilityRoute> {
    let capability = match id {
        "command.study" => CapabilityRoute {
            id: "command.study",
            label: "Study Setup",
            agent: GatewayAgentKind::Command,
            tier: GatewayModelTier::Local,
            keywords: &[],
            reason: "L2 classified study setup.",
        },
        "vision.ocr" => CapabilityRoute {
            id: "vision.ocr",
            label: "Screen and OCR",
            agent: GatewayAgentKind::Vision,
            tier: GatewayModelTier::Worker,
            keywords: &[],
            reason: "L2 classified vision.",
        },
        "integrations.spotify" => CapabilityRoute {
            id: "integrations.spotify",
            label: "Spotify",
            agent: GatewayAgentKind::Integrations,
            tier: GatewayModelTier::Worker,
            keywords: &[],
            reason: "L2 classified Spotify.",
        },
        "integrations.notion" => CapabilityRoute {
            id: "integrations.notion",
            label: "Notion",
            agent: GatewayAgentKind::Integrations,
            tier: GatewayModelTier::Worker,
            keywords: &[],
            reason: "L2 classified Notion.",
        },
        "integrations.google" => CapabilityRoute {
            id: "integrations.google",
            label: "Gmail",
            agent: GatewayAgentKind::Integrations,
            tier: GatewayModelTier::Worker,
            keywords: &[],
            reason: "L2 classified Gmail.",
        },
        "integrations.calendar" => CapabilityRoute {
            id: "integrations.calendar",
            label: "Google Calendar",
            agent: GatewayAgentKind::Integrations,
            tier: GatewayModelTier::Worker,
            keywords: &[],
            reason: "L2 classified Google Calendar.",
        },
        "integrations.ocr_notion" => CapabilityRoute {
            id: "integrations.ocr_notion",
            label: "OCR to Notion",
            agent: GatewayAgentKind::Integrations,
            tier: GatewayModelTier::Worker,
            keywords: &[],
            reason: "L2 classified OCR to Notion.",
        },
        "integrations.email_notion" => CapabilityRoute {
            id: "integrations.email_notion",
            label: "Email to Notion",
            agent: GatewayAgentKind::Integrations,
            tier: GatewayModelTier::Worker,
            keywords: &[],
            reason: "L2 classified email to Notion.",
        },
        "memory.life" => CapabilityRoute {
            id: "memory.life",
            label: "Memory",
            agent: GatewayAgentKind::Memory,
            tier: GatewayModelTier::Embed,
            keywords: &[],
            reason: "L2 classified memory.",
        },
        "builder.code" => CapabilityRoute {
            id: "builder.code",
            label: "Builder",
            agent: GatewayAgentKind::Builder,
            tier: GatewayModelTier::Planner,
            keywords: &[],
            reason: "L2 classified builder.",
        },
        "command.search" => CapabilityRoute {
            id: "command.search",
            label: "Search Command",
            agent: GatewayAgentKind::Command,
            tier: GatewayModelTier::Local,
            keywords: &[],
            reason: "L2 classified search.",
        },
        "command.desktop" | "command.general" => CapabilityRoute {
            id: "command.desktop",
            label: "Desktop Command",
            agent: GatewayAgentKind::Command,
            tier: GatewayModelTier::Local,
            keywords: &[],
            reason: "L2 classified desktop command.",
        },
        _ => return None,
    };
    Some(capability)
}
