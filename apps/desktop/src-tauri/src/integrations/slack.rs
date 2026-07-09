use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use reqwest::blocking::Client;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE, HeaderMap, HeaderValue};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const SLACK_API_BASE: &str = "https://slack.com/api";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SlackMessage {
    pub user: String,
    pub text: String,
    pub ts: String,
}

static SESSION_DRAFTS: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

#[cfg(test)]
thread_local! {
    static MOCK_RESPONSES: std::cell::RefCell<Option<HashMap<String, String>>> = const { std::cell::RefCell::new(None) };
}

fn drafts() -> &'static Mutex<HashMap<String, String>> {
    SESSION_DRAFTS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn slack_client() -> Result<Client, String> {
    Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|error| format!("Failed to initialize Slack client: {error}"))
}

fn slack_headers(token: &str) -> Result<HeaderMap, String> {
    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {token}")).map_err(|error| error.to_string())?,
    );
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    Ok(headers)
}

#[cfg(test)]
fn lookup_mock(method: &str, url: &str) -> Option<String> {
    MOCK_RESPONSES.with(|cell| {
        let responses = cell.borrow();
        let map = responses.as_ref()?;
        let key = format!("{method} {url}");
        map.get(&key)
            .or_else(|| map.get(url))
            .cloned()
            .or_else(|| map.iter().find(|(k, _)| url.contains(k.as_str())).map(|(_, v)| v.clone()))
    })
}

fn slack_post_json(token: &str, endpoint: &str, payload: Value) -> Result<Value, String> {
    let url = format!("{SLACK_API_BASE}/{endpoint}");
    #[cfg(test)]
    if let Some(body) = lookup_mock("POST", &url) {
        return serde_json::from_str(&body)
            .map_err(|error| format!("Failed to parse mock Slack response: {error}"));
    }

    let client = slack_client()?;
    let response = client
        .post(&url)
        .headers(slack_headers(token)?)
        .json(&payload)
        .send()
        .map_err(|error| format!("Failed to reach Slack: {error}"))?;
    let status = response.status();
    let body = response.text().unwrap_or_default();
    if !status.is_success() {
        return Err(format!("Slack request failed with {status}: {body}"));
    }
    serde_json::from_str(&body).map_err(|error| format!("Failed to parse Slack response: {error}"))
}

fn normalize_slack_error(response: &Value) -> String {
    let error = response
        .get("error")
        .and_then(|value| value.as_str())
        .unwrap_or("unknown_error");
    match error {
        "missing_scope" | "not_authed" | "invalid_auth" => {
            "Slack token is missing or does not have required scopes.".to_string()
        }
        "channel_not_found" => "Slack channel was not found.".to_string(),
        "thread_not_found" => "Slack thread was not found.".to_string(),
        "ratelimited" => "Slack rate limit reached. Try again in a moment.".to_string(),
        _ => format!("Slack API error: {error}"),
    }
}

pub fn resolve_bot_token() -> Result<String, String> {
    crate::env_local::init_local_env();
    for key in ["JARVIS_SLACK_BOT_TOKEN", "SLACK_BOT_TOKEN"] {
        if let Ok(value) = std::env::var(key) {
            let token = value.trim().to_string();
            if !token.is_empty() {
                return Ok(token);
            }
        }
    }
    Err("Slack is not connected yet. Set JARVIS_SLACK_BOT_TOKEN in your local environment.".to_string())
}

pub fn fetch_channel_messages(
    token: &str,
    channel: &str,
    limit: u32,
) -> Result<Vec<SlackMessage>, String> {
    let response = slack_post_json(
        token,
        "conversations.history",
        json!({ "channel": channel.trim_start_matches('#'), "limit": limit }),
    )?;
    if !response.get("ok").and_then(|value| value.as_bool()).unwrap_or(false) {
        return Err(normalize_slack_error(&response));
    }
    Ok(map_messages(response.get("messages")))
}

pub fn fetch_thread_replies(
    token: &str,
    channel: &str,
    thread_ts: &str,
    limit: u32,
) -> Result<Vec<SlackMessage>, String> {
    let response = slack_post_json(
        token,
        "conversations.replies",
        json!({
            "channel": channel.trim_start_matches('#'),
            "ts": thread_ts,
            "limit": limit
        }),
    )?;
    if !response.get("ok").and_then(|value| value.as_bool()).unwrap_or(false) {
        return Err(normalize_slack_error(&response));
    }
    Ok(map_messages(response.get("messages")))
}

pub fn post_message(token: &str, channel: &str, text: &str) -> Result<String, String> {
    let response = slack_post_json(
        token,
        "chat.postMessage",
        json!({
            "channel": channel.trim_start_matches('#'),
            "text": text,
        }),
    )?;
    if !response.get("ok").and_then(|value| value.as_bool()).unwrap_or(false) {
        return Err(normalize_slack_error(&response));
    }
    Ok(response
        .get("ts")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string())
}

fn map_messages(messages: Option<&Value>) -> Vec<SlackMessage> {
    messages
        .and_then(|value| value.as_array())
        .map(|rows| {
            rows.iter()
                .map(|row| SlackMessage {
                    user: row
                        .get("user")
                        .and_then(|value| value.as_str())
                        .unwrap_or("unknown")
                        .to_string(),
                    text: row
                        .get("text")
                        .and_then(|value| value.as_str())
                        .unwrap_or_default()
                        .to_string(),
                    ts: row
                        .get("ts")
                        .and_then(|value| value.as_str())
                        .unwrap_or_default()
                        .to_string(),
                })
                .collect()
        })
        .unwrap_or_default()
}

pub fn parse_thread_ref(input: &str) -> Option<(String, String)> {
    let trimmed = input.trim();
    if let Some((channel, ts)) = trimmed.split_once(':') {
        let channel = channel.trim().to_string();
        let ts = ts.trim().to_string();
        if !channel.is_empty() && !ts.is_empty() {
            return Some((channel, ts));
        }
    }
    None
}

pub fn format_channel_summary(channel: &str, messages: &[SlackMessage]) -> String {
    if messages.is_empty() {
        return format!("No recent messages found in {channel}.");
    }
    let lines = messages
        .iter()
        .take(6)
        .enumerate()
        .map(|(index, message)| format!("{}. {}: {}", index + 1, message.user, message.text))
        .collect::<Vec<_>>()
        .join("\n");
    format!(
        "Recent updates in {channel}:\n{lines}\n\nUse \"save slack action items to planner\" to capture follow-ups."
    )
}

pub fn format_thread_summary(ref_id: &str, messages: &[SlackMessage]) -> String {
    if messages.is_empty() {
        return format!("No replies found for Slack thread {ref_id}.");
    }
    let lines = messages
        .iter()
        .take(8)
        .map(|message| format!("- {}: {}", message.user, message.text))
        .collect::<Vec<_>>()
        .join("\n");
    format!("Thread summary for {ref_id}:\n{lines}")
}

pub fn build_draft(channel: &str, topic: &str, summary: Option<&str>) -> String {
    let context = summary.unwrap_or("Shared updates are progressing.");
    format!(
        "Draft for {channel}:\n\nTeam update on {topic}:\n- {context}\n- Next step: confirm owners and ETA.\n\nThis draft is not sent yet."
    )
}

pub fn save_session_draft(session_id: &str, draft: String) {
    if let Ok(mut cache) = drafts().lock() {
        cache.insert(session_id.to_string(), draft);
    }
}

pub fn get_session_draft(session_id: &str) -> Option<String> {
    drafts()
        .lock()
        .ok()
        .and_then(|cache| cache.get(session_id).cloned())
}

pub fn clear_session_draft(session_id: &str) {
    if let Ok(mut cache) = drafts().lock() {
        cache.remove(session_id);
    }
}

#[cfg(test)]
pub fn set_mock_responses(responses: HashMap<String, String>) {
    MOCK_RESPONSES.with(|cell| {
        *cell.borrow_mut() = Some(responses);
    });
}

#[cfg(test)]
pub fn clear_mock_responses() {
    MOCK_RESPONSES.with(|cell| {
        *cell.borrow_mut() = None;
    });
}
