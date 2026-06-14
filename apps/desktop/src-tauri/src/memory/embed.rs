use std::path::Path;

use reqwest::blocking::Client;
use serde_json::json;

use crate::db::get_ollama_config;

const DEFAULT_EMBED_MODEL: &str = "nomic-embed-text";
const FALLBACK_DIMENSIONS: usize = 64;

pub fn embed_text(db_path: &Path, text: &str) -> Result<Vec<f32>, String> {
    if let Ok(vector) = embed_with_ollama(db_path, text) {
        return Ok(vector);
    }
    Ok(fallback_embedding(text))
}

fn embed_with_ollama(db_path: &Path, text: &str) -> Result<Vec<f32>, String> {
    let (base_url, model_name) = get_ollama_config(db_path)?;
    let base_url = base_url
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Ollama base URL is not configured.".to_string())?;
    let model = model_name
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_EMBED_MODEL.to_string());

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?;
    let response = client
        .post(format!("{}/api/embeddings", base_url.trim_end_matches('/')))
        .json(&json!({
            "model": model,
            "prompt": text,
        }))
        .send()
        .map_err(|error| format!("Ollama embedding request failed: {error}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Ollama embedding failed with status {}.",
            response.status()
        ));
    }

    let body: serde_json::Value = response
        .json()
        .map_err(|error| format!("Failed to parse Ollama embedding response: {error}"))?;
    let values = body
        .get("embedding")
        .and_then(|value| value.as_array())
        .ok_or_else(|| "Ollama embedding response missing embedding array.".to_string())?;

    Ok(values
        .iter()
        .filter_map(|value| value.as_f64().map(|number| number as f32))
        .collect())
}

pub fn fallback_embedding(text: &str) -> Vec<f32> {
    let normalized = text.trim().to_lowercase();
    let mut vector = vec![0.0_f32; FALLBACK_DIMENSIONS];
    for token in normalized.split_whitespace() {
        let mut hash = 0_u64;
        for byte in token.as_bytes() {
            hash = hash.wrapping_mul(16777619).wrapping_add(u64::from(*byte));
        }
        let index = (hash as usize) % FALLBACK_DIMENSIONS;
        vector[index] += 1.0;
    }
    normalize_vector(&mut vector);
    vector
}

pub fn cosine_similarity(left: &[f32], right: &[f32]) -> f32 {
    if left.len() != right.len() || left.is_empty() {
        return 0.0;
    }
    let dot: f32 = left.iter().zip(right.iter()).map(|(a, b)| a * b).sum();
    let left_norm = left.iter().map(|value| value * value).sum::<f32>().sqrt();
    let right_norm = right.iter().map(|value| value * value).sum::<f32>().sqrt();
    if left_norm == 0.0 || right_norm == 0.0 {
        return 0.0;
    }
    dot / (left_norm * right_norm)
}

fn normalize_vector(vector: &mut [f32]) {
    let norm = vector.iter().map(|value| value * value).sum::<f32>().sqrt();
    if norm > 0.0 {
        for value in vector.iter_mut() {
            *value /= norm;
        }
    }
}

pub fn embedding_to_blob(values: &[f32]) -> Vec<u8> {
    values
        .iter()
        .flat_map(|value| value.to_le_bytes())
        .collect()
}

pub fn blob_to_embedding(blob: &[u8]) -> Vec<f32> {
    blob.chunks_exact(4)
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fallback_embedding_is_deterministic() {
        let first = fallback_embedding("Alice likes tea");
        let second = fallback_embedding("Alice likes tea");
        assert_eq!(first, second);
        assert!(cosine_similarity(&first, &second) > 0.99);
    }
}
