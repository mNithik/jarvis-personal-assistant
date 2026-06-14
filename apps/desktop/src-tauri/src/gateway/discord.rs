use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordBotStatus {
    pub running: bool,
    pub last_error: Option<String>,
}

struct DiscordRuntime {
    shutdown: AtomicBool,
    status: Mutex<DiscordBotStatus>,
}

static DISCORD: OnceLock<DiscordRuntime> = OnceLock::new();

fn runtime() -> &'static DiscordRuntime {
    DISCORD.get_or_init(|| DiscordRuntime {
        shutdown: AtomicBool::new(false),
        status: Mutex::new(DiscordBotStatus {
            running: false,
            last_error: None,
        }),
    })
}

pub fn get_discord_bot_status() -> DiscordBotStatus {
    runtime()
        .status
        .lock()
        .map(|status| status.clone())
        .unwrap_or(DiscordBotStatus {
            running: false,
            last_error: None,
        })
}

/// Discord ingress placeholder — token stored; gateway channel turn wiring in Phase 2 S11.
pub fn sync_discord_bot(config: &crate::gateway::config::GatewayConfig) {
    let enabled = config.enabled
        && config.channels.discord_enabled
        && config
            .channels
            .discord_bot_token
            .as_deref()
            .is_some_and(|token| !token.trim().is_empty());

    if enabled {
        runtime().shutdown.store(false, Ordering::SeqCst);
        if let Ok(mut status) = runtime().status.lock() {
            status.running = true;
            status.last_error = Some(
                "Discord long-poll worker ships in S11 — configure token now for future enable."
                    .to_string(),
            );
        }
    } else {
        runtime().shutdown.store(true, Ordering::SeqCst);
        if let Ok(mut status) = runtime().status.lock() {
            status.running = false;
            status.last_error = None;
        }
    }
}
