use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use serde::Deserialize;
use tauri::{AppHandle, Manager};

use super::{
    channels::ChannelTurnRequest, config::GatewayConfig, local_turn_api::run_channel_turn_internal,
    runtime::headless::HeadlessGatewayContext, types::TurnRequest,
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
        spawn_poller(TelegramPollTarget::Desktop(app), config);
    } else {
        runtime().shutdown.store(true, Ordering::SeqCst);
        if let Ok(mut status) = runtime().status.lock() {
            status.running = false;
        }
    }
}

pub fn sync_telegram_bot_headless(ctx: Arc<HeadlessGatewayContext>) {
    let config = ctx.config();
    let enabled = config.enabled
        && config.channels.telegram_enabled
        && config
            .channels
            .telegram_bot_token
            .as_deref()
            .is_some_and(|token| !token.trim().is_empty());

    if enabled {
        runtime().shutdown.store(false, Ordering::SeqCst);
        spawn_poller(TelegramPollTarget::Headless(ctx), config);
        if let Ok(mut status) = runtime().status.lock() {
            status.running = true;
            status.last_error = None;
        }
    } else {
        runtime().shutdown.store(true, Ordering::SeqCst);
    }
}

enum TelegramPollTarget {
    Desktop(AppHandle),
    Headless(Arc<HeadlessGatewayContext>),
}

fn spawn_poller(target: TelegramPollTarget, config: GatewayConfig) {
    {
        let already_running = runtime().status.lock().map(|s| s.running).unwrap_or(false);
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
                    log_telegram_activity(&target, &format!("inbound from {chat_id}: {text}"));
                    let channel_request = ChannelTurnRequest {
                        channel: "telegram".to_string(),
                        session_id: Some(format!("telegram-{chat_id}")),
                        command: text.clone(),
                    };
                    let turn_request: TurnRequest = channel_request.into();
                    let reply = match &target {
                        TelegramPollTarget::Headless(ctx) => match ctx.run_turn(turn_request) {
                            Ok(response) => response.result.reply,
                            Err(error) => format!("JARVIS error: {error}"),
                        },
                        TelegramPollTarget::Desktop(app) => {
                            match run_channel_turn_internal(app, turn_request) {
                                Ok(response) => response.result.reply,
                                Err(error) => format!("JARVIS error: {error}"),
                            }
                        }
                    };
                    let _ = send_telegram_message(&client, &token, &chat_id, &reply).await;
                    log_telegram_activity(
                        &target,
                        &format!(
                            "reply to {chat_id}: {}",
                            reply.chars().take(80).collect::<String>()
                        ),
                    );
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

fn log_telegram_activity(target: &TelegramPollTarget, line: &str) {
    if let TelegramPollTarget::Headless(ctx) = target {
        let path = ctx.app_data_dir.join("service.log");
        let stamp = chrono::Utc::now().to_rfc3339();
        let _ = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .and_then(|mut file| {
                use std::io::Write;
                writeln!(file, "[{stamp}] telegram: {line}")
            });
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
    use std::sync::Arc;

    use super::*;
    use crate::gateway::config::{save_gateway_config, GatewayConfig};
    use crate::gateway::runtime::headless::HeadlessGatewayContext;
    use crate::migrations::apply_pending_migrations;

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

    #[test]
    fn sync_headless_marks_running_when_enabled() {
        runtime().shutdown.store(true, Ordering::SeqCst);
        if let Ok(mut status) = runtime().status.lock() {
            status.running = false;
        }

        let dir = std::env::temp_dir().join(format!("jarvis-telegram-h-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let db_path = dir.join("jarvis.db");
        let conn = rusqlite::Connection::open(&db_path).expect("open");
        apply_pending_migrations(&conn, &db_path).expect("migrate");
        drop(conn);

        let mut config = GatewayConfig::default();
        config.enabled = true;
        config.channels.telegram_enabled = true;
        config.channels.telegram_bot_token = Some("test-bot-token".into());
        save_gateway_config(&dir, &config).expect("save config");

        let ctx = Arc::new(HeadlessGatewayContext::new(dir.clone(), db_path));
        sync_telegram_bot_headless(ctx);

        let status = get_telegram_bot_status();
        assert!(status.running);

        runtime().shutdown.store(true, Ordering::SeqCst);
        if let Ok(mut status) = runtime().status.lock() {
            status.running = false;
        }
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn headless_activity_logs_to_service_log() {
        let dir = std::env::temp_dir().join(format!("jarvis-telegram-log-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let db_path = dir.join("jarvis.db");
        let ctx = Arc::new(HeadlessGatewayContext::new(dir.clone(), db_path));

        log_telegram_activity(
            &TelegramPollTarget::Headless(ctx),
            "inbound from 42: prep me for my next meeting",
        );

        let log_path = dir.join("service.log");
        let log = std::fs::read_to_string(&log_path).expect("service log");
        assert!(log.contains("telegram: inbound from 42"));

        let _ = std::fs::remove_dir_all(dir);
    }
}
