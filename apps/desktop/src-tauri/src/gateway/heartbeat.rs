use std::path::Path;
use std::time::Duration;

use chrono::Timelike;
use tauri::{AppHandle, Emitter, Manager};

use super::{
    capabilities::find_capability,
    config::GatewayConfig,
    state::GatewayState,
    types::{GatewayEvent, GatewayEventKind, TurnRequest, TurnSource},
};
use crate::gateway::orchestrator::GatewayOrchestrator;

const DEFAULT_HEARTBEAT_TEMPLATE: &str = "# JARVIS Heartbeat\n\n- Check gateway trace for pending approvals\n- Review memory cards saved today\n- Confirm proactive automations are enabled\n";

pub fn spawn_proactive_scheduler(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut last_heartbeat_minute: Option<u32> = None;
        let mut last_brief_day: Option<String> = None;
        let mut last_ocr_minute: Option<u32> = None;

        loop {
            tokio::time::sleep(Duration::from_secs(30)).await;
            let Some(gateway_state) = app.try_state::<GatewayState>() else {
                continue;
            };
            let Some(app_state) = app.try_state::<crate::AppState>() else {
                continue;
            };

            let config = match gateway_state.config.lock() {
                Ok(config) => config.clone(),
                Err(_) => continue,
            };

            if !config.enabled {
                continue;
            }

            if crate::gateway::runtime::headless::service_is_running(gateway_state.app_data_dir()) {
                continue;
            }

            let now = chrono::Local::now();
            let minute_key = now.hour() * 60 + now.minute();
            let day_key = now.format("%Y-%m-%d").to_string();
            let time_label = now.format("%H:%M").to_string();

            if config.proactive.heartbeat_enabled
                && minute_key % config.proactive.heartbeat_interval_minutes.max(1) == 0
                && last_heartbeat_minute != Some(minute_key)
            {
                last_heartbeat_minute = Some(minute_key);
                let _ = run_heartbeat_tick(
                    &app,
                    &gateway_state,
                    &app_state.db_path,
                    gateway_state.app_data_dir(),
                    &config,
                );
            }

            if config.proactive.morning_brief_enabled
                && time_label == config.proactive.morning_brief_time
                && last_brief_day != Some(day_key.clone())
            {
                last_brief_day = Some(day_key.clone());
                let _ = run_morning_brief_turn(&app, &gateway_state, &app_state, &config);
            }

            if config.proactive.ocr_watch_tick_enabled && last_ocr_minute != Some(minute_key) {
                last_ocr_minute = Some(minute_key);
                let _ = app.emit("ocr-watch-tick", serde_json::json!({ "minute": minute_key }));
            }

            let _ = super::trigger_recipes::maybe_enqueue_scheduled_recipes(
                &app_state.db_path,
                &time_label,
                &day_key,
            );
            let _ = super::calendar_replan::maybe_enqueue_replan_on_calendar_change(
                &app_state.db_path,
                &config,
            );
            let _ = super::anomaly::maybe_enqueue_anomaly_nudges(&app_state.db_path, &config);

            if let Err(error) = super::trigger_dispatcher::process_trigger_queue(
                &app,
                &app_state.db_path,
                &config,
            ) {
                let _ = app.emit(
                    "gateway-event",
                    super::types::GatewayEvent {
                        id: format!("trigger-error-{}", chrono::Utc::now().timestamp()),
                        session_id: "proactive-triggers".to_string(),
                        turn_id: None,
                        kind: super::types::GatewayEventKind::Error,
                        message: format!("Trigger dispatch error: {error}"),
                        created_at: chrono::Utc::now().timestamp().to_string(),
                        approval: None,
                    },
                );
            }
        }
    });
}

fn run_heartbeat_tick(
    app: &AppHandle,
    gateway_state: &GatewayState,
    db_path: &Path,
    app_data_dir: &Path,
    config: &GatewayConfig,
) -> Result<(), String> {
    ensure_heartbeat_file(app_data_dir)?;
    let heartbeat_path = app_data_dir.join("HEARTBEAT.md");
    let body = std::fs::read_to_string(&heartbeat_path).unwrap_or_else(|_| DEFAULT_HEARTBEAT_TEMPLATE.to_string());

    let mut bus = gateway_state.bus.lock().map_err(|error| error.to_string())?;
    let event = GatewayEvent {
        id: format!("heartbeat-{}", chrono::Utc::now().timestamp()),
        session_id: "proactive-heartbeat".to_string(),
        turn_id: None,
        kind: GatewayEventKind::Reply,
        message: format!("Heartbeat: {}", body.lines().next().unwrap_or("ok")),
        created_at: chrono::Utc::now().timestamp().to_string(),
        approval: None,
    };
    bus.publish(event.clone());
    let _ = app.emit("gateway-event", &event);

    let _ = db_path;
    let _ = find_capability_message(config);

    Ok(())
}

fn run_morning_brief_turn(
    app: &AppHandle,
    gateway_state: &GatewayState,
    app_state: &crate::AppState,
    config: &GatewayConfig,
) -> Result<(), String> {
    let session_id = "proactive-morning-brief".to_string();
    let turn_id = gateway_state.next_turn_id(&session_id)?;
    let request = TurnRequest {
        session_id: Some(session_id.clone()),
        command: if config.proactive.planner_copilot_enabled {
            "plan my day".to_string()
        } else {
            "create daily brief".to_string()
        },
        source: Some(TurnSource::Automation),
        idempotency_key: None,
    };

    let router_context = crate::gateway::router::RouterContext {
        config: config.clone(),
        db_path: Some(app_state.db_path.clone()),
    };

    let mut bus = gateway_state.bus.lock().map_err(|error| error.to_string())?;
    let mut escalation = gateway_state
        .escalation
        .lock()
        .map_err(|error| error.to_string())?;

    let response = GatewayOrchestrator::run_turn(
        request,
        turn_id,
        &session_id,
        config,
        &router_context,
        &mut bus,
        crate::env_local::provider_api_key("groq"),
        Some(crate::gateway::orchestrator::TurnExecutionEnv {
            db_path: &app_state.db_path,
            app_data_dir: &app_state.app_data_dir,
            escalation: &mut escalation,
        }),
    );

    let _ = app.emit("gateway-turn-complete", &response);
    Ok(())
}

fn ensure_heartbeat_file(app_data_dir: &Path) -> Result<(), String> {
    std::fs::create_dir_all(app_data_dir).map_err(|error| error.to_string())?;
    let path = app_data_dir.join("HEARTBEAT.md");
    if !path.exists() {
        std::fs::write(&path, DEFAULT_HEARTBEAT_TEMPLATE).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn find_capability_message(config: &GatewayConfig) -> Option<String> {
    let capability = find_capability("proactive.heartbeat")?;
    if config.enabled {
        Some(format!("{} is registered.", capability.label))
    } else {
        None
    }
}
