use std::path::Path;

use serde::{Deserialize, Serialize};

use super::config::GatewayConfig;
use crate::agents::{extract_file_search_query, parse_then_steps, research::extract_research_query};
use crate::memory::knowledge_router::parse_vault_search_query;
use crate::builder::is_builder_command;
use crate::integrations::{
    is_calendar_command, is_email_notion_command, is_gmail_command, is_notion_command,
    is_ocr_notion_command, is_spotify_command,
};
use crate::memory::is_memory_command;

#[derive(Debug, Clone, Deserialize)]
struct YamlCapabilityRecord {
    id: String,
    label: String,
    agent: String,
    tier: String,
    provider: Option<String>,
    quota_key: Option<String>,
    feature_flag: Option<String>,
    feature_flags: Option<Vec<String>>,
    command_guard: Option<String>,
    always_enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityRecord {
    pub id: String,
    pub label: String,
    pub agent: String,
    pub tier: String,
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default)]
    pub quota_key: Option<String>,
    #[serde(default)]
    pub feature_flag: Option<String>,
    #[serde(default)]
    pub feature_flags: Vec<String>,
    #[serde(default)]
    pub command_guard: Option<String>,
    #[serde(default)]
    pub always_enabled: bool,
}

#[derive(Debug, Clone, Deserialize)]
struct CapabilityFile {
    capabilities: Vec<YamlCapabilityRecord>,
}

const EMBEDDED_CAPABILITIES: &str = include_str!("../../capabilities.yaml");

pub fn load_capabilities_from_yaml(raw: &str) -> Result<Vec<CapabilityRecord>, String> {
    let parsed: CapabilityFile =
        serde_yaml::from_str(raw).map_err(|error| format!("capabilities.yaml: {error}"))?;
    Ok(parsed
        .capabilities
        .into_iter()
        .map(|capability| CapabilityRecord {
            id: capability.id,
            label: capability.label,
            agent: capability.agent,
            tier: capability.tier,
            provider: capability.provider,
            quota_key: capability.quota_key,
            feature_flag: capability.feature_flag,
            feature_flags: capability.feature_flags.unwrap_or_default(),
            command_guard: capability.command_guard,
            always_enabled: capability.always_enabled.unwrap_or(false),
        })
        .collect())
}

pub fn list_capabilities() -> Vec<CapabilityRecord> {
    load_capabilities_from_yaml(EMBEDDED_CAPABILITIES).unwrap_or_default()
}

pub fn find_capability(id: &str) -> Option<CapabilityRecord> {
    list_capabilities()
        .into_iter()
        .find(|capability| capability.id == id)
}

pub fn load_external_capabilities(path: &Path) -> Result<Vec<CapabilityRecord>, String> {
    if !path.exists() {
        return Ok(list_capabilities());
    }
    let raw = std::fs::read_to_string(path).map_err(|error| error.to_string())?;
    load_capabilities_from_yaml(&raw)
}

pub fn capability_enabled_for_turn(
    config: &GatewayConfig,
    capability: &CapabilityRecord,
    command: &str,
) -> bool {
    if capability.always_enabled {
        return true;
    }

    if !feature_flags_enabled(config, capability) {
        return false;
    }

    command_guard_passes(capability.command_guard.as_deref(), command)
}

fn feature_flags_enabled(config: &GatewayConfig, capability: &CapabilityRecord) -> bool {
    let flags: Vec<&str> = if capability.feature_flags.is_empty() {
        capability
            .feature_flag
            .as_deref()
            .map(|flag| vec![flag])
            .unwrap_or_default()
    } else {
        capability.feature_flags.iter().map(String::as_str).collect()
    };

    if flags.is_empty() {
        return true;
    }

    flags
        .iter()
        .all(|flag| gateway_feature_enabled(config, flag))
}

fn gateway_feature_enabled(config: &GatewayConfig, flag: &str) -> bool {
    match flag {
        "study_routine" => config.features.study_routine,
        "screen_ocr" => config.features.screen_ocr,
        "gmail" => config.features.gmail,
        "notion" => config.features.notion,
        "spotify" => config.features.spotify,
        "calendar" => config.features.calendar,
        "ocr_notion" => config.features.ocr_notion,
        "email_notion" => config.features.email_notion,
        "memory" => config.features.memory,
        "builder" => config.features.builder,
        _ => false,
    }
}

fn command_guard_passes(guard: Option<&str>, command: &str) -> bool {
    match guard {
        None => true,
        Some("file_search") => extract_file_search_query(command).is_some(),
        Some("notion") => is_notion_command(command),
        Some("spotify") => is_spotify_command(command),
        Some("gmail") => is_gmail_command(command),
        Some("calendar") => is_calendar_command(command),
        Some("ocr_notion") => is_ocr_notion_command(command),
        Some("email_notion") => is_email_notion_command(command),
        Some("memory") => is_memory_command(command),
        Some("builder") => is_builder_command(command),
        Some("supervisor") => parse_then_steps(command).is_some(),
        Some("automation") => is_automation_command(command),
        Some("mcp") => command.trim().to_lowercase().starts_with("mcp "),
        Some("vault") => parse_vault_search_query(command).is_some(),
        Some("research") => extract_research_query(command).is_some(),
        _ => false,
    }
}

fn is_automation_command(command: &str) -> bool {
    let normalized = command.trim().to_lowercase();
    normalized.starts_with("run workflow ") || normalized.starts_with("start workflow ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_catalog_includes_starter_capabilities() {
        let capabilities = list_capabilities();
        assert!(capabilities.iter().any(|cap| cap.id == "memory.recall"));
        assert!(capabilities.iter().any(|cap| cap.id == "proactive.heartbeat"));
        assert!(capabilities.iter().any(|cap| cap.id == "builder.code"));
    }

    #[test]
    fn embedded_catalog_covers_gateway_route_capabilities() {
        let capabilities = list_capabilities();
        let required_ids = [
            "command.study",
            "command.desktop",
            "command.search",
            "vision.ocr",
            "integrations.notion",
            "integrations.spotify",
            "integrations.google",
            "integrations.calendar",
            "integrations.ocr_notion",
            "integrations.email_notion",
            "memory.life",
            "builder.code",
            "proactive.heartbeat",
        ];

        for id in required_ids {
            assert!(
                capabilities.iter().any(|capability| capability.id == id),
                "missing capability {id}"
            );
        }
    }

    #[test]
    fn finds_capability_by_id() {
        let capability = find_capability("infer.groq.talker").expect("talker capability");
        assert_eq!(capability.quota_key.as_deref(), Some("groq"));
    }

    #[test]
    fn registry_feature_flags_gate_study_routine() {
        let capability = find_capability("command.study").expect("study capability");
        let mut config = GatewayConfig::default();
        config.features.study_routine = false;
        assert!(!capability_enabled_for_turn(&config, &capability, "start study routine"));
        config.features.study_routine = true;
        assert!(capability_enabled_for_turn(
            &config,
            &capability,
            "start study routine"
        ));
    }

    #[test]
    fn registry_command_guard_requires_file_search_query() {
        let capability = find_capability("command.search").expect("search capability");
        let config = GatewayConfig::default();
        assert!(!capability_enabled_for_turn(
            &config,
            &capability,
            "hello jarvis"
        ));
        assert!(capability_enabled_for_turn(
            &config,
            &capability,
            "search files for budget.xlsx"
        ));
    }

    #[test]
    fn email_notion_requires_both_feature_flags() {
        let capability = find_capability("integrations.email_notion").expect("email notion");
        let mut config = GatewayConfig::default();
        config.features.email_notion = true;
        config.features.gmail = false;
        assert!(!capability_enabled_for_turn(
            &config,
            &capability,
            "save email to notion"
        ));
        config.features.gmail = true;
        assert!(capability_enabled_for_turn(
            &config,
            &capability,
            "save email to notion"
        ));
    }
}
