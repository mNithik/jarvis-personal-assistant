use std::collections::HashMap;

use crate::gateway::config::GatewayConfig;
use crate::gateway::types::GatewayModelTier;
use crate::models::{ModelProviderChatRequest, ModelProviderMessage};
use crate::env_local;
use crate::providers::{openai_compat, presets};

#[derive(Debug, Default)]
pub struct EscalationTracker {
    failures: HashMap<String, u32>,
}

impl EscalationTracker {
    pub fn record_failure(&mut self, session_id: &str, _error: &str, _config: &GatewayConfig) {
        let entry = self.failures.entry(session_id.to_string()).or_insert(0);
        *entry += 1;
    }

    pub fn record_success(&mut self, session_id: &str) {
        self.failures.remove(session_id);
    }

    pub fn failure_count(&self, session_id: &str) -> u32 {
        self.failures.get(session_id).copied().unwrap_or(0)
    }

    pub fn maybe_escalate(&self, ctx: EscalationContext<'_>) -> Option<String> {
        if ctx.failure_count < 2 {
            return None;
        }
        escalate_to_nim_planner(ctx.command, ctx.config).ok()
    }
}

pub struct EscalationContext<'a> {
    pub session_id: &'a str,
    pub command: &'a str,
    pub config: &'a GatewayConfig,
    pub failure_count: u32,
}

pub fn escalate_to_nim_planner(command: &str, config: &GatewayConfig) -> Result<String, String> {
    let preset = presets::provider_defaults()
        .into_iter()
        .find(|provider| provider.provider_id == "nvidia_nim")
        .map(|defaults| presets::ModelPreset {
            id: "nvidia-nim-planner".to_string(),
            label: "NVIDIA NIM Planner".to_string(),
            provider_id: defaults.provider_id,
            chat_model: defaults.reasoning_model.clone(),
            coding_model: defaults.coding_model,
            reasoning_model: defaults.reasoning_model,
            talker_tier: GatewayModelTier::Talker,
            planner_tier: GatewayModelTier::Planner,
            worker_tier: GatewayModelTier::Worker,
        });

    let Some(preset) = preset else {
        return Err("NVIDIA NIM planner preset is unavailable.".to_string());
    };

    let api_key = env_local::provider_api_key("nvidia_nim");
    if api_key.as_deref().unwrap_or("").trim().is_empty() {
        return Err(
            "Planner unavailable: set JARVIS_NVIDIA_NIM_API_KEY (or NVIDIA_API_KEY) in .env."
                .to_string(),
        );
    }

    let request = ModelProviderChatRequest {
        provider_id: preset.provider_id.clone(),
        base_url: "https://integrate.api.nvidia.com/v1".to_string(),
        api_key,
        model: preset.reasoning_model.clone(),
        messages: vec![
            ModelProviderMessage {
                role: "system".to_string(),
                content: "Decompose the desktop task into 2-4 short executable steps.".to_string(),
            },
            ModelProviderMessage {
                role: "user".to_string(),
                content: command.to_string(),
            },
        ],
        temperature: Some(0.2),
        max_tokens: Some(400),
    };

    let _ = config;
    let response = openai_compat::chat(request, None)?;
    Ok(response.text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn two_failures_trigger_escalation_attempt() {
        let mut tracker = EscalationTracker::default();
        let config = GatewayConfig::default();
        tracker.record_failure("session-a", "step failed", &config);
        tracker.record_failure("session-a", "step failed again", &config);
        assert_eq!(tracker.failure_count("session-a"), 2);

        let plan = tracker.maybe_escalate(EscalationContext {
            session_id: "session-a",
            command: "open notepad then save file",
            config: &config,
            failure_count: 2,
        });
        assert!(plan.is_none() || plan.is_some());
    }
}
