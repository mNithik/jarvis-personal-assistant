use std::time::Instant;

use base64::{engine::general_purpose, Engine as _};
use reqwest::blocking::{Client, multipart};

pub fn transcribe_audio_base64(api_key: &str, audio_base64: &str) -> Result<String, String> {
    let trimmed = audio_base64.trim();
    if trimmed.is_empty() {
        return Err("Groq transcription needs audio data.".to_string());
    }

    let audio_bytes = general_purpose::STANDARD
        .decode(trimmed)
        .map_err(|error| format!("Failed to decode audio base64: {error}"))?;

    let part = multipart::Part::bytes(audio_bytes)
        .file_name("audio.webm")
        .mime_str("audio/webm")
        .map_err(|error| error.to_string())?;
    let form = multipart::Form::new()
        .text("model", "whisper-large-v3-turbo")
        .part("file", part);

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|error| format!("Failed to initialize Groq STT client: {error}"))?;
    let started_at = Instant::now();
    let _latency = started_at.elapsed();
    let response = client
        .post("https://api.groq.com/openai/v1/audio/transcriptions")
        .bearer_auth(api_key)
        .multipart(form)
        .send()
        .map_err(|error| format!("Failed to reach Groq STT: {error}"))?;

    let status = response.status();
    let body = response
        .text()
        .map_err(|error| format!("Failed to read Groq STT response: {error}"))?;

    if !status.is_success() {
        return Err(format!("Groq STT returned {status}: {}", body.trim()));
    }

    let value: serde_json::Value = serde_json::from_str(&body)
        .map_err(|error| format!("Failed to parse Groq STT JSON: {error}"))?;
    value
        .get("text")
        .and_then(|text| text.as_str())
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
        .ok_or_else(|| "Groq STT returned an empty transcript.".to_string())
}
