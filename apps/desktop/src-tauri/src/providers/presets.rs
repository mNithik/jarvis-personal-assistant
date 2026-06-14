use serde::Serialize;

use crate::gateway::types::GatewayModelTier;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderId {
    LocalOllama,
    LmStudio,
    NvidiaNim,
    Gemini,
    Groq,
    Openrouter,
    Cerebras,
    Huggingface,
    Openai,
    Anthropic,
}

impl ProviderId {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::LocalOllama => "local_ollama",
            Self::LmStudio => "lm_studio",
            Self::NvidiaNim => "nvidia_nim",
            Self::Gemini => "gemini",
            Self::Groq => "groq",
            Self::Openrouter => "openrouter",
            Self::Cerebras => "cerebras",
            Self::Huggingface => "huggingface",
            Self::Openai => "openai",
            Self::Anthropic => "anthropic",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value.trim().to_lowercase().as_str() {
            "local_ollama" => Some(Self::LocalOllama),
            "lm_studio" => Some(Self::LmStudio),
            "nvidia_nim" => Some(Self::NvidiaNim),
            "gemini" => Some(Self::Gemini),
            "groq" => Some(Self::Groq),
            "openrouter" => Some(Self::Openrouter),
            "cerebras" => Some(Self::Cerebras),
            "huggingface" => Some(Self::Huggingface),
            "openai" => Some(Self::Openai),
            "anthropic" => Some(Self::Anthropic),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderDefaults {
    pub provider_id: String,
    pub base_url: String,
    pub chat_model: String,
    pub coding_model: String,
    pub reasoning_model: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ModelPreset {
    pub id: String,
    pub provider_id: String,
    pub label: String,
    pub chat_model: String,
    pub coding_model: String,
    pub reasoning_model: String,
    pub talker_tier: GatewayModelTier,
    pub planner_tier: GatewayModelTier,
    pub worker_tier: GatewayModelTier,
}

struct StaticPreset {
    id: &'static str,
    provider_id: &'static str,
    label: &'static str,
    chat_model: &'static str,
    coding_model: &'static str,
    reasoning_model: &'static str,
}

const MODEL_PRESET_REGISTRY: &[StaticPreset] = &[
    StaticPreset {
        id: "groq-fast-free",
        provider_id: "groq",
        label: "Groq fast free",
        chat_model: "llama-3.1-8b-instant",
        coding_model: "llama-3.3-70b-versatile",
        reasoning_model: "llama-3.3-70b-versatile",
    },
    StaticPreset {
        id: "openrouter-free-qwen",
        provider_id: "openrouter",
        label: "OpenRouter free Qwen",
        chat_model: "qwen/qwen-2.5-72b-instruct:free",
        coding_model: "qwen/qwen-2.5-coder-32b-instruct:free",
        reasoning_model: "qwen/qwen-2.5-72b-instruct:free",
    },
    StaticPreset {
        id: "openrouter-free-deepseek",
        provider_id: "openrouter",
        label: "OpenRouter free DeepSeek",
        chat_model: "deepseek/deepseek-chat-v3-0324:free",
        coding_model: "deepseek/deepseek-chat-v3-0324:free",
        reasoning_model: "deepseek/deepseek-r1:free",
    },
    StaticPreset {
        id: "nvidia-nim-llama",
        provider_id: "nvidia_nim",
        label: "NVIDIA NIM Llama",
        chat_model: "meta/llama-3.1-8b-instruct",
        coding_model: "meta/llama-3.1-70b-instruct",
        reasoning_model: "meta/llama-3.1-70b-instruct",
    },
    StaticPreset {
        id: "cerebras-fast",
        provider_id: "cerebras",
        label: "Cerebras fast inference",
        chat_model: "llama-3.3-70b",
        coding_model: "llama-3.3-70b",
        reasoning_model: "llama-3.3-70b",
    },
    StaticPreset {
        id: "gemini-flash-free",
        provider_id: "gemini",
        label: "Gemini flash free tier",
        chat_model: "gemini-2.5-flash",
        coding_model: "gemini-2.5-flash",
        reasoning_model: "gemini-2.5-flash",
    },
];

pub fn model_presets() -> Vec<ModelPreset> {
    MODEL_PRESET_REGISTRY
        .iter()
        .map(|preset| ModelPreset {
            id: preset.id.to_string(),
            provider_id: preset.provider_id.to_string(),
            label: preset.label.to_string(),
            chat_model: preset.chat_model.to_string(),
            coding_model: preset.coding_model.to_string(),
            reasoning_model: preset.reasoning_model.to_string(),
            talker_tier: GatewayModelTier::Talker,
            planner_tier: GatewayModelTier::Planner,
            worker_tier: GatewayModelTier::Worker,
        })
        .collect()
}

pub fn provider_defaults() -> Vec<ProviderDefaults> {
    vec![
        provider("local_ollama", "http://127.0.0.1:11434/v1", "qwen3:4b", true),
        provider("lm_studio", "http://127.0.0.1:1234/v1", "", false),
        provider("nvidia_nim", "https://integrate.api.nvidia.com/v1", "", false),
        provider(
            "gemini",
            "https://generativelanguage.googleapis.com/v1beta",
            "gemini-2.5-flash",
            false,
        ),
        provider("groq", "https://api.groq.com/openai/v1", "", false),
        provider("openrouter", "https://openrouter.ai/api/v1", "", false),
        provider("cerebras", "https://api.cerebras.ai/v1", "", false),
        provider("huggingface", "", "", false),
        provider("openai", "https://api.openai.com/v1", "", false),
        provider("anthropic", "https://api.anthropic.com/v1", "", false),
    ]
}

fn provider(id: &str, base_url: &str, model: &str, enabled: bool) -> ProviderDefaults {
    ProviderDefaults {
        provider_id: id.to_string(),
        base_url: base_url.to_string(),
        chat_model: model.to_string(),
        coding_model: model.to_string(),
        reasoning_model: model.to_string(),
        enabled,
    }
}

pub fn find_preset(id: &str) -> Option<ModelPreset> {
    model_presets().into_iter().find(|preset| preset.id == id)
}

pub fn requires_stored_key(provider_id: &str) -> bool {
    matches!(
        provider_id,
        "nvidia_nim" | "gemini" | "groq" | "openrouter" | "cerebras" | "huggingface" | "openai"
            | "anthropic"
    )
}

pub fn model_for_tier(preset: &ModelPreset, tier: GatewayModelTier) -> &str {
    match tier {
        GatewayModelTier::Talker => preset.chat_model.as_str(),
        GatewayModelTier::Planner | GatewayModelTier::Embed => preset.reasoning_model.as_str(),
        GatewayModelTier::Worker => preset.coding_model.as_str(),
        GatewayModelTier::Local => preset.chat_model.as_str(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn includes_app_preset_ids() {
        let presets = model_presets();
        let ids: Vec<_> = presets.iter().map(|preset| preset.id.as_str()).collect();
        assert!(ids.contains(&"groq-fast-free"));
        assert!(ids.contains(&"openrouter-free-qwen"));
        assert!(ids.contains(&"openrouter-free-deepseek"));
        assert!(ids.contains(&"nvidia-nim-llama"));
        assert!(ids.contains(&"cerebras-fast"));
    }
}
