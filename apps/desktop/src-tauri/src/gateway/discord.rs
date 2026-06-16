use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::json;
use tauri::{AppHandle, Manager};
use tokio_tungstenite::{connect_async, tungstenite::Message};

use super::{
    channels::ChannelTurnRequest,
    config::GatewayConfig,
    local_turn_api::run_channel_turn_internal,
    runtime::headless::{service_is_running, HeadlessGatewayContext},
};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordBotStatus {
    pub running: bool,
    pub last_error: Option<String>,
    pub last_channel_id: Option<String>,
    pub last_message_at: Option<String>,
}

struct DiscordRuntime {
    shutdown: AtomicBool,
    status: Mutex<DiscordBotStatus>,
}

static DISCORD: OnceLock<Arc<DiscordRuntime>> = OnceLock::new();

fn runtime() -> Arc<DiscordRuntime> {
    DISCORD
        .get_or_init(|| {
            Arc::new(DiscordRuntime {
                shutdown: AtomicBool::new(false),
                status: Mutex::new(DiscordBotStatus {
                    running: false,
                    last_error: None,
                    last_channel_id: None,
                    last_message_at: None,
                }),
            })
        })
        .clone()
}

pub fn get_discord_bot_status() -> DiscordBotStatus {
    runtime()
        .status
        .lock()
        .map(|status| status.clone())
        .unwrap_or(DiscordBotStatus {
            running: false,
            last_error: None,
            last_channel_id: None,
            last_message_at: None,
        })
}

pub fn sync_discord_bot(app: AppHandle) {
    let config = match app.try_state::<super::state::GatewayState>() {
        Some(state) => state
            .config
            .lock()
            .map(|config| config.clone())
            .unwrap_or_default(),
        None => return,
    };

    let app_data_dir = match app.try_state::<crate::AppState>() {
        Some(state) => state.app_data_dir.clone(),
        None => return,
    };

    if service_is_running(&app_data_dir) {
        runtime().shutdown.store(true, Ordering::SeqCst);
        if let Ok(mut status) = runtime().status.lock() {
            status.running = false;
            status.last_error = Some("Windows service owns Discord ingress.".to_string());
        }
        return;
    }

    let enabled = config.enabled
        && config.channels.discord_enabled
        && config
            .channels
            .discord_bot_token
            .as_deref()
            .is_some_and(|token| !token.trim().is_empty());

    if enabled {
        runtime().shutdown.store(false, Ordering::SeqCst);
        spawn_gateway_worker(app, config);
    } else {
        runtime().shutdown.store(true, Ordering::SeqCst);
        if let Ok(mut status) = runtime().status.lock() {
            status.running = false;
            status.last_error = None;
        }
    }
}

pub fn sync_discord_bot_headless(ctx: Arc<HeadlessGatewayContext>) {
    let config = ctx.config();
    let enabled = config.enabled
        && config.channels.discord_enabled
        && config
            .channels
            .discord_bot_token
            .as_deref()
            .is_some_and(|token| !token.trim().is_empty());

    if enabled {
        runtime().shutdown.store(false, Ordering::SeqCst);
        tauri::async_runtime::spawn(async move {
            if let Err(error) = run_headless_gateway_loop(ctx, config).await {
                if let Ok(mut status) = runtime().status.lock() {
                    status.last_error = Some(error);
                    status.running = false;
                }
            }
        });
        if let Ok(mut status) = runtime().status.lock() {
            status.running = true;
            status.last_error = None;
        }
    } else {
        runtime().shutdown.store(true, Ordering::SeqCst);
    }
}

fn spawn_gateway_worker(app: AppHandle, config: GatewayConfig) {
    tauri::async_runtime::spawn(async move {
        if let Err(error) = run_desktop_gateway_loop(app, config).await {
            if let Ok(mut status) = runtime().status.lock() {
                status.last_error = Some(error);
                status.running = false;
            }
        }
    });
    if let Ok(mut status) = runtime().status.lock() {
        status.running = true;
        status.last_error = None;
    }
}

async fn run_desktop_gateway_loop(app: AppHandle, config: GatewayConfig) -> Result<(), String> {
    let token = config
        .channels
        .discord_bot_token
        .clone()
        .ok_or_else(|| "Discord bot token missing".to_string())?;
    let gateway_url = fetch_gateway_url().await?;
    let (socket, _) = connect_async(&gateway_url)
        .await
        .map_err(|error| format!("Discord gateway connect failed: {error}"))?;
    let (mut write, mut read) = socket.split();
    let identify = json!({
        "op": 2,
        "d": {
            "token": token,
            "intents": 37377,
            "properties": {
                "os": "windows",
                "browser": "jarvis",
                "device": "jarvis"
            }
        }
    });
    write
        .send(Message::Text(identify.to_string()))
        .await
        .map_err(|error| error.to_string())?;

    while !runtime().shutdown.load(Ordering::SeqCst) {
        let message = read.next().await.transpose().map_err(|error| error.to_string())?;
        let Some(message) = message else {
            break;
        };
        if let Message::Text(payload) = message {
            handle_gateway_payload(Some(&app), None, &config, &token, &payload).await?;
        }
    }
    Ok(())
}

async fn run_headless_gateway_loop(
    ctx: Arc<HeadlessGatewayContext>,
    config: GatewayConfig,
) -> Result<(), String> {
    let token = config
        .channels
        .discord_bot_token
        .clone()
        .ok_or_else(|| "Discord bot token missing".to_string())?;
    let gateway_url = fetch_gateway_url().await?;
    let (socket, _) = connect_async(&gateway_url)
        .await
        .map_err(|error| format!("Discord gateway connect failed: {error}"))?;
    let (mut write, mut read) = socket.split();
    let identify = json!({
        "op": 2,
        "d": {
            "token": token,
            "intents": 37377,
            "properties": {
                "os": "windows",
                "browser": "jarvis-service",
                "device": "jarvis-service"
            }
        }
    });
    write
        .send(Message::Text(identify.to_string()))
        .await
        .map_err(|error| error.to_string())?;

    while !runtime().shutdown.load(Ordering::SeqCst) {
        let message = read.next().await.transpose().map_err(|error| error.to_string())?;
        let Some(message) = message else {
            break;
        };
        if let Message::Text(payload) = message {
            handle_gateway_payload_headless(&ctx, &config, &token, &payload).await?;
        }
    }
    Ok(())
}

async fn fetch_gateway_url() -> Result<String, String> {
    tokio::task::spawn_blocking(|| {
        let response = reqwest::blocking::get("https://discord.com/api/v10/gateway")
            .map_err(|error| error.to_string())?;
        let body: GatewayResponse = response.json().map_err(|error| error.to_string())?;
        Ok(body.url)
    })
    .await
    .map_err(|error| error.to_string())?
}

async fn post_discord_message(token: &str, channel_id: &str, content: &str) -> Result<(), String> {
    let token = token.to_string();
    let channel_id = channel_id.to_string();
    let content = content.chars().take(1900).collect::<String>();
    tokio::task::spawn_blocking(move || {
        let client = reqwest::blocking::Client::new();
        let url = format!("https://discord.com/api/v10/channels/{channel_id}/messages");
        client
            .post(url)
            .header("Authorization", format!("Bot {token}"))
            .json(&json!({ "content": content }))
            .send()
            .map_err(|error| error.to_string())?;
        Ok(())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[derive(Debug, Deserialize)]
struct GatewayResponse {
    url: String,
}

#[derive(Debug, Deserialize)]
struct GatewayEnvelope {
    op: Option<i64>,
    t: Option<String>,
    d: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct DiscordMessageCreate {
    content: String,
    channel_id: String,
    author: DiscordAuthor,
}

#[derive(Debug, Deserialize)]
struct DiscordAuthor {
    bot: Option<bool>,
}

async fn handle_gateway_payload(
    app: Option<&AppHandle>,
    headless: Option<&HeadlessGatewayContext>,
    config: &GatewayConfig,
    token: &str,
    payload: &str,
) -> Result<(), String> {
    let envelope: GatewayEnvelope =
        serde_json::from_str(payload).map_err(|error| error.to_string())?;

    if envelope.op == Some(10) {
        if let Some(d) = envelope.d {
            let heartbeat_ms = d
                .get("heartbeat_interval")
                .and_then(|value| value.as_u64())
                .unwrap_or(45_000);
            let _ = heartbeat_ms;
        }
        return Ok(());
    }

    if envelope.t.as_deref() == Some("MESSAGE_CREATE") {
        let Some(data) = envelope.d else {
            return Ok(());
        };
        let message: DiscordMessageCreate =
            serde_json::from_value(data).map_err(|error| error.to_string())?;
        if message.author.bot.unwrap_or(false) || message.content.trim().is_empty() {
            return Ok(());
        }
        let turn_request = ChannelTurnRequest {
            channel: "discord".to_string(),
            command: message.content.clone(),
            session_id: Some(format!("discord-{}", message.channel_id)),
        };
        let reply = if let Some(ctx) = headless {
            ctx.run_turn(turn_request.clone().into())?.result.reply
        } else {
            let app = app.ok_or_else(|| "Desktop app handle unavailable".to_string())?;
            run_channel_turn_internal(app, turn_request.into())?.result.reply
        };
        post_discord_message(token, &message.channel_id, &reply).await?;
        if let Ok(mut status) = runtime().status.lock() {
            status.last_channel_id = Some(message.channel_id);
            status.last_message_at = Some(chrono::Utc::now().to_rfc3339());
        }
    }
    let _ = config;
    Ok(())
}

async fn handle_gateway_payload_headless(
    ctx: &HeadlessGatewayContext,
    config: &GatewayConfig,
    token: &str,
    payload: &str,
) -> Result<(), String> {
    handle_gateway_payload(None, Some(ctx), config, token, payload).await
}
