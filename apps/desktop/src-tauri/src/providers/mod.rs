pub mod escalation;
pub mod groq_stt;
pub mod openai_compat;
pub mod presets;
pub mod quota;
pub mod redaction;

use crate::env_local;
use crate::gateway::{
    config::GatewayConfig,
    types::{GatewayModelTier, GatewayRoute, GatewaySensitivity},
};
use crate::models::{ModelProviderChatRequest, ModelProviderChatResponse};

use self::presets::{find_preset, model_for_tier, requires_stored_key, ModelPreset, ProviderDefaults};
use self::quota::{shared_circuit_breaker, shared_quota_tracker};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedProvider {
    pub provider_id: String,
    pub preset_id: Option<String>,
    pub model: String,
    pub base_url: String,
    pub tier: GatewayModelTier,
    pub forced_local: bool,
}

pub fn list_model_presets() -> Vec<presets::ModelPreset> {
    presets::model_presets()
}

pub fn list_provider_defaults() -> Vec<ProviderDefaults> {
    presets::provider_defaults()
}

pub fn resolve_provider(route: &GatewayRoute, config: &GatewayConfig) -> ResolvedProvider {
    if should_force_local(route, config) {
        return resolve_local(route.tier.clone());
    }

    for preset_id in PRESET_FAILOVER_CHAIN {
        let Some(preset) = find_preset(preset_id) else {
            continue;
        };
        if provider_available(&preset, config) {
            return resolve_from_preset(&preset, route.tier.clone());
        }
    }

    resolve_local(route.tier.clone())
}

const PRESET_FAILOVER_CHAIN: &[&str] = &[
    "groq-fast-free",
    "openrouter-free-qwen",
    "gemini-flash-free",
    "nvidia-nim-llama",
    "cerebras-fast",
    "openrouter-free-deepseek",
];

pub fn provider_available(preset: &ModelPreset, config: &GatewayConfig) -> bool {
    let provider_id = preset.provider_id.as_str();
    if requires_stored_key(provider_id) && env_local::provider_api_key(provider_id).is_none() {
        return false;
    }
    if let Ok(circuit) = shared_circuit_breaker().lock() {
        if !circuit.can_call(provider_id) {
            return false;
        }
    }

    let quota_limit = quota_limit_for(provider_id, config);
    if quota_limit == 0 {
        return true;
    }

    if let Ok(tracker) = shared_quota_tracker().lock() {
        return tracker.count(provider_id) < quota_limit;
    }

    true
}

fn quota_limit_for(provider_id: &str, config: &GatewayConfig) -> u32 {
    match provider_id {
        "groq" => config.quotas.groq_daily_requests,
        "openrouter" => config.quotas.openrouter_daily_requests,
        "nvidia_nim" => config.quotas.nvidia_nim_daily_requests,
        "cerebras" => config.quotas.cerebras_daily_requests,
        _ => 0,
    }
}

pub fn chat_with_failover(
    request: ModelProviderChatRequest,
    route: &GatewayRoute,
    config: &GatewayConfig,
) -> Result<ModelProviderChatResponse, String> {
    if should_force_local(route, config) {
        return chat_local(request, route.tier.clone());
    }

    let mut last_error = "No cloud providers were available.".to_string();
    for preset_id in PRESET_FAILOVER_CHAIN {
        let Some(preset) = find_preset(preset_id) else {
            continue;
        };
        if !provider_available(&preset, config) {
            continue;
        }
        let resolved = resolve_from_preset(&preset, route.tier.clone());
        let stored_key = env_local::provider_api_key(&resolved.provider_id);
        let attempt = ModelProviderChatRequest {
            provider_id: resolved.provider_id.clone(),
            base_url: resolved.base_url.clone(),
            api_key: request.api_key.clone().or(stored_key),
            model: resolved.model.clone(),
            messages: request.messages.clone(),
            temperature: request.temperature,
            max_tokens: request.max_tokens,
        };
        match openai_compat::chat(attempt, None) {
            Ok(response) => {
                if let Ok(mut circuit) = shared_circuit_breaker().lock() {
                    circuit.record_success(&resolved.provider_id);
                }
                if let Ok(mut tracker) = shared_quota_tracker().lock() {
                    let _ = tracker.check_and_increment(
                        &resolved.provider_id,
                        quota_limit_for(&resolved.provider_id, config),
                    );
                }
                return Ok(response);
            }
            Err(error) => {
                last_error = error;
                if let Ok(mut circuit) = shared_circuit_breaker().lock() {
                    circuit.record_failure(&resolved.provider_id);
                }
            }
        }
    }

    chat_local(request, route.tier.clone()).or(Err(last_error))
}

fn chat_local(
    mut request: ModelProviderChatRequest,
    tier: GatewayModelTier,
) -> Result<ModelProviderChatResponse, String> {
    let local = resolve_local(tier);
    request.provider_id = local.provider_id;
    request.base_url = local.base_url;
    request.model = local.model;
    openai_compat::chat(request, None)
}

fn resolve_from_preset(preset: &ModelPreset, tier: GatewayModelTier) -> ResolvedProvider {
    ResolvedProvider {
        provider_id: preset.provider_id.clone(),
        preset_id: Some(preset.id.clone()),
        model: model_for_tier(preset, tier.clone()).to_string(),
        base_url: presets::provider_defaults()
            .into_iter()
            .find(|provider| provider.provider_id == preset.provider_id)
            .map(|provider| provider.base_url)
            .unwrap_or_default(),
        tier,
        forced_local: false,
    }
}

fn resolve_local(tier: GatewayModelTier) -> ResolvedProvider {
    let defaults = presets::provider_defaults()
        .into_iter()
        .find(|provider| provider.provider_id == "local_ollama")
        .unwrap_or(ProviderDefaults {
            provider_id: "local_ollama".to_string(),
            base_url: "http://127.0.0.1:11434/v1".to_string(),
            chat_model: "qwen3:4b".to_string(),
            coding_model: "qwen3:4b".to_string(),
            reasoning_model: "qwen3:4b".to_string(),
            enabled: true,
        });
    ResolvedProvider {
        provider_id: defaults.provider_id,
        preset_id: None,
        model: defaults.chat_model,
        base_url: defaults.base_url,
        tier: GatewayModelTier::Local,
        forced_local: true,
    }
}

fn should_force_local(route: &GatewayRoute, config: &GatewayConfig) -> bool {
    config.routing.prefer_local_for_personal
        && matches!(
            route.sensitivity,
            GatewaySensitivity::Personal | GatewaySensitivity::Secret
        )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gateway::types::{
        GatewayAgentKind, GatewayConfidenceBand, GatewayDecisionPolicy, GatewayRoute,
    };

    fn sample_route(sensitivity: GatewaySensitivity) -> GatewayRoute {
        GatewayRoute {
            capability_id: "integrations.google".into(),
            capability_label: "Google".into(),
            agent: GatewayAgentKind::Integrations,
            tier: GatewayModelTier::Talker,
            sensitivity,
            score: 3,
            confidence: GatewayConfidenceBand::High,
            decision_policy: GatewayDecisionPolicy::Confirm,
            decision_reason: "test".into(),
            reason: "test".into(),
            route_level: crate::gateway::types::RouteLevel::L0,
            resolved_provider: None,
        }
    }

    #[test]
    fn personal_routes_force_local_provider() {
        let config = GatewayConfig::default();
        let resolved = resolve_provider(&sample_route(GatewaySensitivity::Personal), &config);
        assert!(resolved.forced_local);
        assert_eq!(resolved.provider_id, "local_ollama");
    }

    fn with_test_provider_keys<F: FnOnce()>(run: F) {
        std::env::set_var("JARVIS_GROQ_API_KEY", "test-groq-key");
        std::env::set_var("JARVIS_OPENROUTER_API_KEY", "test-openrouter-key");
        std::env::set_var("JARVIS_NVIDIA_NIM_API_KEY", "test-nim-key");
        std::env::set_var("JARVIS_CEREBRAS_API_KEY", "test-cerebras-key");
        run();
    }

    #[test]
    fn resolves_groq_first_when_available() {
        with_test_provider_keys(|| {
            let config = GatewayConfig::default();
            let resolved = resolve_provider(&sample_route(GatewaySensitivity::Public), &config);
            assert_eq!(resolved.provider_id, "groq");
            assert_eq!(resolved.preset_id.as_deref(), Some("groq-fast-free"));
        });
    }

    #[test]
    fn fails_over_to_openrouter_when_groq_quota_exhausted() {
        with_test_provider_keys(|| {
            let config = GatewayConfig {
                quotas: crate::gateway::config::GatewayQuotaConfig {
                    groq_daily_requests: 1,
                    ..Default::default()
                },
                ..GatewayConfig::default()
            };

            {
                let mut tracker = shared_quota_tracker().lock().expect("quota tracker");
                let _ = tracker.check_and_increment("groq", 1);
            }

            let groq = find_preset("groq-fast-free").expect("groq preset");
            assert!(!provider_available(&groq, &config));

            let resolved = resolve_provider(&sample_route(GatewaySensitivity::Public), &config);
            assert_eq!(resolved.provider_id, "openrouter");
        });
    }

    #[test]
    fn gemini_is_in_failover_chain() {
        assert!(PRESET_FAILOVER_CHAIN.contains(&"gemini-flash-free"));
    }

    #[test]
    fn cerebras_quota_uses_dedicated_limit() {
        let config = GatewayConfig {
            quotas: crate::gateway::config::GatewayQuotaConfig {
                cerebras_daily_requests: 2,
                ..Default::default()
            },
            ..GatewayConfig::default()
        };
        assert_eq!(config.quotas.cerebras_daily_requests, 2);
        std::env::set_var("JARVIS_CEREBRAS_API_KEY", "test-cerebras-key");
        let cerebras = find_preset("cerebras-fast").expect("cerebras preset");
        assert!(provider_available(&cerebras, &config));
    }
}
