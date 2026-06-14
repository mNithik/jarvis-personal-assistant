//! Local development secrets from `.env` files.
//!
//! Checked before Windows Credential Manager so you can paste all keys once
//! while building. Copy `.env.example` to `.env` at the repo root.

use std::{
    path::PathBuf,
    sync::Once,
};

static INIT: Once = Once::new();

pub fn init_local_env() {
    INIT.call_once(|| {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let candidates = [
            manifest_dir.join(".env"),
            manifest_dir.join("../.env"),
            manifest_dir.join("../../.env"),
        ];

        for path in candidates {
            if path.is_file() {
                let _ = dotenvy::from_path(&path);
            }
        }

        let _ = dotenvy::dotenv();
    });
}

pub fn provider_api_key(provider: &str) -> Option<String> {
    init_local_env();
    for key in provider_env_keys(provider) {
        if let Ok(value) = std::env::var(key) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

fn provider_env_keys(provider: &str) -> &'static [&'static str] {
    match provider.trim().to_lowercase().as_str() {
        "groq" => &["JARVIS_GROQ_API_KEY", "GROQ_API_KEY"],
        "openrouter" => &["JARVIS_OPENROUTER_API_KEY", "OPENROUTER_API_KEY"],
        "cerebras" => &["JARVIS_CEREBRAS_API_KEY", "CEREBRAS_API_KEY"],
        "nvidia_nim" => &["JARVIS_NVIDIA_NIM_API_KEY", "NVIDIA_API_KEY", "NVIDIA_NIM_API_KEY"],
        "gemini" => &["JARVIS_GEMINI_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"],
        "openai" => &["JARVIS_OPENAI_API_KEY", "OPENAI_API_KEY"],
        "anthropic" => &["JARVIS_ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY"],
        "huggingface" => &["JARVIS_HUGGINGFACE_API_KEY", "HUGGINGFACE_API_KEY", "HF_TOKEN"],
        "notion" => &["JARVIS_NOTION_TOKEN", "NOTION_TOKEN", "NOTION_API_KEY"],
        "spotify" => &["JARVIS_SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_ID"],
        "google" | "google_calendar" | "gmail" => {
            &["JARVIS_GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_ID"]
        }
        _ => &[],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_provider_to_env_key_names() {
        assert_eq!(provider_env_keys("groq")[0], "JARVIS_GROQ_API_KEY");
        assert_eq!(provider_env_keys("nvidia_nim")[0], "JARVIS_NVIDIA_NIM_API_KEY");
    }
}
