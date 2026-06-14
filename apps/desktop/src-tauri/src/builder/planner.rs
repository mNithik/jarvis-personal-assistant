use crate::agents::AgentContext;
use crate::env_local;
use crate::models::{ModelProviderChatRequest, ModelProviderMessage};
use crate::providers::{chat_with_failover, presets, resolve_provider};

const SYSTEM_PROMPT: &str = "You are JARVIS coding planner for a local Tauri + React desktop repo. \
Given a debug or coding request, produce a short actionable checklist (3-6 bullets): \
what to inspect first, which checks to run, likely failure areas, and safe next steps. \
Do not claim you edited files. Do not invent test output.";

pub fn plan_coding_assist(ctx: &AgentContext) -> Result<String, String> {
    let resolved = resolve_provider(&ctx.route, &ctx.config);
    let request = ModelProviderChatRequest {
        provider_id: resolved.provider_id.clone(),
        base_url: resolved.base_url.clone(),
        api_key: env_local::provider_api_key(&resolved.provider_id),
        model: if resolved.forced_local {
            presets::provider_defaults()
                .into_iter()
                .find(|provider| provider.provider_id == "local_ollama")
                .map(|provider| provider.reasoning_model)
                .unwrap_or_else(|| "qwen3:4b".to_string())
        } else {
            resolved.model.clone()
        },
        messages: vec![
            ModelProviderMessage {
                role: "system".to_string(),
                content: SYSTEM_PROMPT.to_string(),
            },
            ModelProviderMessage {
                role: "user".to_string(),
                content: ctx.command.clone(),
            },
        ],
        temperature: Some(0.2),
        max_tokens: Some(600),
    };

    let response = chat_with_failover(request, &ctx.route, &ctx.config)?;
    Ok(response.text)
}
