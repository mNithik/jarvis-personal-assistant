use std::time::Instant;

use reqwest::blocking::Client;
use serde_json::json;

use crate::models::{ModelProviderChatRequest, ModelProviderChatResponse};

use super::{presets::requires_stored_key, redaction::redact_messages};

pub fn chat(
    request: ModelProviderChatRequest,
    stored_api_key: Option<String>,
) -> Result<ModelProviderChatResponse, String> {
    let provider_id = request.provider_id.trim().to_string();
    let base_url = request.base_url.trim().trim_end_matches('/').to_string();
    let model = request.model.trim().to_string();

    if provider_id.is_empty() {
        return Err("Model provider is missing.".to_string());
    }
    if base_url.is_empty() {
        return Err("Model provider base URL is missing.".to_string());
    }
    if model.is_empty() {
        return Err("Model name is missing.".to_string());
    }
    if request.messages.is_empty() {
        return Err("Model request needs at least one message.".to_string());
    }

    if requires_stored_key(&provider_id) && stored_api_key.is_none() {
        if request
            .api_key
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .is_none()
        {
            return Err(format!("{provider_id} needs an API key first."));
        }
    }

    let (messages, _redacted) = redact_messages(&request.messages);
    let mut request = request;
    request.messages = messages;

    if provider_id == "gemini" {
        return chat_gemini(request, stored_api_key);
    }

    chat_openai_compatible(request, stored_api_key)
}

fn chat_openai_compatible(
    request: ModelProviderChatRequest,
    stored_api_key: Option<String>,
) -> Result<ModelProviderChatResponse, String> {
    let provider_id = request.provider_id.trim().to_string();
    let base_url = request.base_url.trim().trim_end_matches('/').to_string();
    let model = request.model.trim().to_string();
    let url = format!("{base_url}/chat/completions");
    let mut payload = json!({
        "model": model,
        "messages": request.messages,
        "temperature": request.temperature.unwrap_or(0.4),
        "max_tokens": request.max_tokens.unwrap_or(1200)
    });

    if provider_id == "openrouter" {
        payload["stream"] = json!(false);
    }

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .map_err(|error| format!("Failed to initialize model provider client: {error}"))?;

    let mut builder = client.post(&url).json(&payload);
    if let Some(api_key) = request
        .api_key
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .or(stored_api_key.as_deref())
    {
        builder = builder.bearer_auth(api_key);
    }

    let started_at = Instant::now();
    let response = builder
        .send()
        .map_err(|error| format!("Failed to reach {provider_id} at {url}: {error}"))?;
    let latency_ms = started_at.elapsed().as_millis();
    parse_openai_response(provider_id, model, latency_ms, response)
}

fn chat_gemini(
    request: ModelProviderChatRequest,
    stored_api_key: Option<String>,
) -> Result<ModelProviderChatResponse, String> {
    let provider_id = request.provider_id.trim().to_string();
    let base_url = request.base_url.trim().trim_end_matches('/').to_string();
    let model = request.model.trim().to_string();
    let api_key = request
        .api_key
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .or(stored_api_key.as_deref())
        .ok_or_else(|| "Gemini needs an API key first.".to_string())?;
    let url = format!("{base_url}/models/{model}:generateContent");
    let system_text = request
        .messages
        .iter()
        .filter(|message| message.role == "system")
        .map(|message| message.content.as_str())
        .collect::<Vec<&str>>()
        .join("\n\n");
    let contents = request
        .messages
        .iter()
        .filter(|message| message.role != "system")
        .map(|message| {
            json!({
                "role": if message.role == "assistant" { "model" } else { "user" },
                "parts": [{ "text": message.content }]
            })
        })
        .collect::<Vec<serde_json::Value>>();
    let mut payload = json!({
        "contents": contents,
        "generationConfig": {
            "temperature": request.temperature.unwrap_or(0.4),
            "maxOutputTokens": request.max_tokens.unwrap_or(1200)
        }
    });

    if !system_text.trim().is_empty() {
        payload["systemInstruction"] = json!({
            "parts": [{ "text": system_text }]
        });
    }

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .map_err(|error| format!("Failed to initialize Gemini client: {error}"))?;
    let started_at = Instant::now();
    let response = client
        .post(&url)
        .header("x-goog-api-key", api_key)
        .json(&payload)
        .send()
        .map_err(|error| format!("Failed to reach Gemini at {url}: {error}"))?;
    let latency_ms = started_at.elapsed().as_millis();
    let status = response.status();
    let body = response
        .text()
        .map_err(|error| format!("Failed to read Gemini response: {error}"))?;

    if !status.is_success() {
        return Err(format!("Gemini returned {status}: {}", body.trim()));
    }

    let value: serde_json::Value = serde_json::from_str(&body)
        .map_err(|error| format!("Failed to parse Gemini response JSON: {error}. Body: {}", body.trim()))?;
    let text = value
        .get("candidates")
        .and_then(|candidates| candidates.get(0))
        .and_then(|candidate| candidate.get("content"))
        .and_then(|content| content.get("parts"))
        .and_then(|parts| parts.as_array())
        .map(|parts| {
            parts
                .iter()
                .filter_map(|part| part.get("text").and_then(|text| text.as_str()))
                .collect::<Vec<&str>>()
                .join("")
        })
        .unwrap_or_default();

    if text.trim().is_empty() {
        return Err("Gemini returned an empty assistant response.".to_string());
    }

    let usage = value.get("usageMetadata");
    Ok(ModelProviderChatResponse {
        provider_id,
        model,
        text,
        latency_ms,
        prompt_tokens: usage
            .and_then(|usage| usage.get("promptTokenCount"))
            .and_then(|value| value.as_i64()),
        completion_tokens: usage
            .and_then(|usage| usage.get("candidatesTokenCount"))
            .and_then(|value| value.as_i64()),
        total_tokens: usage
            .and_then(|usage| usage.get("totalTokenCount"))
            .and_then(|value| value.as_i64()),
    })
}

fn parse_openai_response(
    provider_id: String,
    model: String,
    latency_ms: u128,
    response: reqwest::blocking::Response,
) -> Result<ModelProviderChatResponse, String> {
    let status = response.status();
    let body = response
        .text()
        .map_err(|error| format!("Failed to read {provider_id} response: {error}"))?;

    if !status.is_success() {
        return Err(format!(
            "{provider_id} returned {status}: {}",
            body.trim()
        ));
    }

    let value: serde_json::Value = serde_json::from_str(&body).map_err(|error| {
        format!(
            "Failed to parse {provider_id} response JSON: {error}. Body: {}",
            body.trim()
        )
    })?;
    let text = value
        .get("choices")
        .and_then(|choices| choices.get(0))
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(|content| content.as_str())
        .or_else(|| {
            value
                .get("choices")
                .and_then(|choices| choices.get(0))
                .and_then(|choice| choice.get("text"))
                .and_then(|content| content.as_str())
        })
        .unwrap_or_default()
        .to_string();

    if text.trim().is_empty() {
        return Err(format!(
            "{provider_id} returned an empty assistant response."
        ));
    }

    let usage = value.get("usage");
    Ok(ModelProviderChatResponse {
        provider_id,
        model,
        text,
        latency_ms,
        prompt_tokens: usage
            .and_then(|usage| usage.get("prompt_tokens"))
            .and_then(|value| value.as_i64()),
        completion_tokens: usage
            .and_then(|usage| usage.get("completion_tokens"))
            .and_then(|value| value.as_i64()),
        total_tokens: usage
            .and_then(|usage| usage.get("total_tokens"))
            .and_then(|value| value.as_i64()),
    })
}
