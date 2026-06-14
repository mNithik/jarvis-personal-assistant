use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use serde::Deserialize;
use tauri::{AppHandle, Manager};

use super::{
    channels::ChannelTurnRequest,
    config::GatewayConfig,
    local_turn_api::run_channel_turn_internal,
    types::TurnRequest,
};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TelegramBotStatus {
    pub running: bool,
    pub last_error: Option<String>,
    pub last_chat_id: Option<String>,
    pub last_message_at: Option<String>,
}

struct TelegramRuntime {
    shutdown: AtomicBool,
    status: Mutex<TelegramBotStatus>,
}

static TELEGRAM: OnceLock<Arc<TelegramRuntime>> = OnceLock::new();

fn runtime() -> Arc<TelegramRuntime> {
    TELEGRAM
        .get_or_init(|| {
            Arc::new(TelegramRuntime {
                shutdown: AtomicBool::new(false),
                status: Mutex::new(TelegramBotStatus {
                    running: false,
                    last_error: None,
                    last_chat_id: None,
                    last_message_at: None,
                }),
            })
        })
        .clone()
}

pub fn get_telegram_bot_status() -> TelegramBotStatus {
    runtime()
        .status
        .lock()
        .map(|status| status.clone())
        .unwrap_or(TelegramBotStatus {
            running: false,
            last_error: None,
            last_chat_id: None,
            last_message_at: None,
        })
}

pub fn sync_telegram_bot(app: AppHandle) {
    let config = match app.try_state::<super::state::GatewayState>() {
        Some(state) => state
            .config
            .lock()
            .map(|config| config.clone())
            .unwrap_or_default(),
        None => return,
    };

    if config.enabled
        && config.channels.telegram_enabled
        && config
            .channels
            .telegram_bot_token
            .as_deref()
            .is_some_and(|token| !token.trim().is_empty())
    {
        spawn_poller(app, config);
    } else {
        runtime().shutdown.store(true, Ordering::SeqCst);
        if let Ok(mut status) = runtime().status.lock() {
            status.running = false;
        }
    }
}

fn spawn_poller(app: AppHandle, config: GatewayConfig) {
    {
        let already_running = runtime()
            .status
            .lock()
            .map(|s| s.running)
            .unwrap_or(false);
        if already_running {
            return;
        }
        runtime().shutdown.store(false, Ordering::SeqCst);
        if let Ok(mut status) = runtime().status.lock() {
            status.running = true;
            status.last_error = None;
        }
    }

    let token = config
        .channels
        .telegram_bot_token
        .clone()
        .unwrap_or_default();
    let app_handle = app.clone();

    tauri::async_runtime::spawn(async move {
        let mut offset: i64 = 0;
        let client = reqwest::Client::new();

        loop {
            if runtime().shutdown.load(Ordering::SeqCst) {
                break;
            }

            let url = format!(
                "https://api.telegram.org/bot{token}/getUpdates?timeout=25&offset={offset}"
            );
            let response = client.get(&url).send().await;
            let Ok(response) = response else {
                set_error("Telegram getUpdates request failed");
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                continue;
            };

            let body: TelegramUpdatesResponse = match response.json().await {
                Ok(body) => body,
                Err(error) => {
                    set_error(&format!("Telegram parse error: {error}"));
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                    continue;
                }
            };

            if !body.ok {
                set_error("Telegram API returned ok=false");
                tokio::time::sleep(std::time::Duration::from_secs(10)).await;
                continue;
            }

            for update in body.result {
                offset = update.update_id + 1;
                if let Some(message) = update.message {
                    let chat_id = message.chat.id.to_string();
                    let text = message.text.unwrap_or_default();
                    if text.trim().is_empty() {
                        continue;
                    }

                    touch_message(&chat_id);
                    let channel_request = ChannelTurnRequest {
                        channel: "telegram".to_string(),
                        session_id: Some(format!("telegram-{chat_id}")),
                        command: text.clone(),
                    };
                    let turn_request: TurnRequest = channel_request.into();
                    let reply = match run_channel_turn_internal(&app_handle, turn_request) {
                        Ok(response) => response.result.reply,
                        Err(error) => format!("JARVIS error: {error}"),
                    };
                    let _ = send_telegram_message(&client, &token, &chat_id, &reply).await;
                }
            }
        }

        if let Ok(mut status) = runtime().status.lock() {
            status.running = false;
        }
    });
}

async fn send_telegram_message(
    client: &reqwest::Client,
    token: &str,
    chat_id: &str,
    text: &str,
) -> Result<(), String> {
    let url = format!("https://api.telegram.org/bot{token}/sendMessage");
    client
        .post(&url)
        .json(&serde_json::json!({
            "chat_id": chat_id,
            "text": text.chars().take(4000).collect::<String>(),
        }))
        .send()
        .await
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn set_error(message: &str) {
    if let Ok(mut status) = runtime().status.lock() {
        status.last_error = Some(message.to_string());
    }
}

fn touch_message(chat_id: &str) {
    if let Ok(mut status) = runtime().status.lock() {
        status.last_chat_id = Some(chat_id.to_string());
        status.last_message_at = Some(chrono::Utc::now().timestamp().to_string());
    }
}

#[derive(Debug, Deserialize)]
struct TelegramUpdatesResponse {
    ok: bool,
    result: Vec<TelegramUpdate>,
}

#[derive(Debug, Deserialize)]
struct TelegramUpdate {
    update_id: i64,
    message: Option<TelegramMessage>,
}

#[derive(Debug, Deserialize)]
struct TelegramMessage {
    chat: TelegramChat,
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TelegramChat {
    id: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_status_is_stopped() {
        let status = TelegramBotStatus {
            running: false,
            last_error: None,
            last_chat_id: None,
            last_message_at: None,
        };
        assert!(!status.running);
    }
}
