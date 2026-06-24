use std::path::Path;

use tauri::{AppHandle, Emitter, Manager};

use super::{
    config::GatewayConfig,
    orchestrator::GatewayOrchestrator,
    state::GatewayState,
    trigger_queue::{claim_next_trigger, complete_trigger},
    types::{TurnRequest, TurnSource},
};

/// Process at most one pending trigger per heartbeat tick.
pub fn process_trigger_queue(
    app: &AppHandle,
    db_path: &Path,
    config: &GatewayConfig,
) -> Result<Option<String>, String> {
    if !config.enabled {
        return Ok(None);
    }

    let conn = rusqlite::Connection::open(db_path).map_err(|error| error.to_string())?;
    let Some(event) = claim_next_trigger(&conn)? else {
        return Ok(None);
    };

    let result = match event.kind.as_str() {
        "morning_brief" => dispatch_morning_brief(app, config),
        "ocr_watch" => dispatch_ocr_watch(app, &event.payload),
        "channel_turn" => dispatch_channel_turn(app, db_path, config, &event.payload),
        "gmail_label_inbox" => dispatch_gmail_label_inbox(app, db_path, config, &event.payload),
        "calendar_event_soon" => dispatch_calendar_event_soon(app, db_path, config, &event.payload),
        "replan_day" => dispatch_replan_day(app, db_path, config),
        "meeting_followup_bundle" => {
            dispatch_meeting_followup_bundle(app, db_path, config, &event.payload)
        }
        other => {
            let _ = complete_trigger(&conn, &event.id, false);
            return Err(format!("Unknown trigger kind: {other}"));
        }
    };

    let success = result.is_ok();
    complete_trigger(&conn, &event.id, success)?;
    result.map(|summary| Some(format!("{}: {}", event.kind, summary)))
}

fn dispatch_morning_brief(app: &AppHandle, config: &GatewayConfig) -> Result<String, String> {
    let gateway_state = app
        .try_state::<GatewayState>()
        .ok_or_else(|| "Gateway state unavailable".to_string())?;
    let app_state = app
        .try_state::<crate::AppState>()
        .ok_or_else(|| "App state unavailable".to_string())?;

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
        app_data_dir: Some(app_state.app_data_dir.clone()),
    };

    let mut bus = gateway_state
        .bus
        .lock()
        .map_err(|error| error.to_string())?;
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
    Ok(response.result.reply.chars().take(120).collect())
}

fn dispatch_ocr_watch(app: &AppHandle, payload: &str) -> Result<String, String> {
    let parsed: serde_json::Value =
        serde_json::from_str(payload).unwrap_or_else(|_| serde_json::json!({ "raw": payload }));
    app.emit("ocr-watch-tick", parsed)
        .map_err(|error| error.to_string())?;
    Ok("OCR watch tick emitted".to_string())
}

fn dispatch_channel_turn(
    app: &AppHandle,
    db_path: &Path,
    config: &GatewayConfig,
    payload: &str,
) -> Result<String, String> {
    let channel_request = crate::gateway::channels::parse_local_channel_payload(payload)?;
    let turn_request: TurnRequest = channel_request.into();

    let gateway_state = app
        .try_state::<GatewayState>()
        .ok_or_else(|| "Gateway state unavailable".to_string())?;
    let app_state = app
        .try_state::<crate::AppState>()
        .ok_or_else(|| "App state unavailable".to_string())?;

    let session_id = turn_request
        .session_id
        .clone()
        .unwrap_or_else(|| "trigger-channel".to_string());
    let turn_id = gateway_state.next_turn_id(&session_id)?;

    let router_context = crate::gateway::router::RouterContext {
        db_path: Some(db_path.to_path_buf()),
        app_data_dir: Some(app_state.app_data_dir.clone()),
        config: config.clone(),
    };

    let mut bus = gateway_state
        .bus
        .lock()
        .map_err(|error| error.to_string())?;
    let mut escalation = gateway_state
        .escalation
        .lock()
        .map_err(|error| error.to_string())?;

    let response = GatewayOrchestrator::run_turn(
        turn_request,
        turn_id,
        &session_id,
        config,
        &router_context,
        &mut bus,
        None,
        Some(crate::gateway::orchestrator::TurnExecutionEnv {
            db_path: &app_state.db_path,
            app_data_dir: &app_state.app_data_dir,
            escalation: &mut escalation,
        }),
    );

    let _ = app.emit("gateway-turn-complete", &response);
    Ok(response.result.reply.chars().take(120).collect())
}

fn dispatch_gmail_label_inbox(
    app: &AppHandle,
    db_path: &Path,
    config: &GatewayConfig,
    payload: &str,
) -> Result<String, String> {
    let parsed: serde_json::Value =
        serde_json::from_str(payload).unwrap_or_else(|_| serde_json::json!({}));
    let command = parsed
        .get("command")
        .and_then(|value| value.as_str())
        .unwrap_or("scan expense emails in inbox")
        .trim()
        .to_string();
    if command.is_empty() {
        return Err("gmail_label_inbox trigger needs a command in payload.".to_string());
    }

    let gateway_state = app
        .try_state::<GatewayState>()
        .ok_or_else(|| "Gateway state unavailable".to_string())?;
    let app_state = app
        .try_state::<crate::AppState>()
        .ok_or_else(|| "App state unavailable".to_string())?;

    let session_id = format!(
        "trigger-gmail-{}",
        parsed
            .get("label")
            .and_then(|value| value.as_str())
            .unwrap_or("inbox")
    );
    let turn_id = gateway_state.next_turn_id(&session_id)?;
    let request = TurnRequest {
        session_id: Some(session_id.clone()),
        command,
        source: Some(TurnSource::Automation),
        idempotency_key: None,
    };

    let router_context = crate::gateway::router::RouterContext {
        db_path: Some(db_path.to_path_buf()),
        app_data_dir: Some(app_state.app_data_dir.clone()),
        config: config.clone(),
    };

    let mut bus = gateway_state
        .bus
        .lock()
        .map_err(|error| error.to_string())?;
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
        None,
        Some(crate::gateway::orchestrator::TurnExecutionEnv {
            db_path: &app_state.db_path,
            app_data_dir: &app_state.app_data_dir,
            escalation: &mut escalation,
        }),
    );

    let _ = app.emit("gateway-turn-complete", &response);
    Ok(response.result.reply.chars().take(120).collect())
}

fn dispatch_calendar_event_soon(
    app: &AppHandle,
    db_path: &Path,
    config: &GatewayConfig,
    payload: &str,
) -> Result<String, String> {
    let parsed: serde_json::Value =
        serde_json::from_str(payload).unwrap_or_else(|_| serde_json::json!({}));
    let command = parsed
        .get("command")
        .and_then(|value| value.as_str())
        .unwrap_or("prep me for my next meeting")
        .trim()
        .to_string();
    if command.is_empty() {
        return Err("calendar_event_soon trigger needs a command in payload.".to_string());
    }

    let gateway_state = app
        .try_state::<GatewayState>()
        .ok_or_else(|| "Gateway state unavailable".to_string())?;
    let app_state = app
        .try_state::<crate::AppState>()
        .ok_or_else(|| "App state unavailable".to_string())?;

    let event_id = parsed
        .get("eventId")
        .and_then(|value| value.as_str())
        .unwrap_or("soon");
    let session_id = format!("trigger-meeting-{event_id}");
    let turn_id = gateway_state.next_turn_id(&session_id)?;
    let request = TurnRequest {
        session_id: Some(session_id.clone()),
        command,
        source: Some(TurnSource::Automation),
        idempotency_key: None,
    };

    let router_context = crate::gateway::router::RouterContext {
        db_path: Some(db_path.to_path_buf()),
        app_data_dir: Some(app_state.app_data_dir.clone()),
        config: config.clone(),
    };

    let mut bus = gateway_state
        .bus
        .lock()
        .map_err(|error| error.to_string())?;
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
        None,
        Some(crate::gateway::orchestrator::TurnExecutionEnv {
            db_path: &app_state.db_path,
            app_data_dir: &app_state.app_data_dir,
            escalation: &mut escalation,
        }),
    );

    let _ = app.emit("gateway-turn-complete", &response);
    Ok(response.result.reply.chars().take(120).collect())
}

fn dispatch_replan_day(
    app: &AppHandle,
    db_path: &Path,
    config: &GatewayConfig,
) -> Result<String, String> {
    let gateway_state = app
        .try_state::<GatewayState>()
        .ok_or_else(|| "Gateway state unavailable".to_string())?;
    let app_state = app
        .try_state::<crate::AppState>()
        .ok_or_else(|| "App state unavailable".to_string())?;

    let session_id = "proactive-replan-day".to_string();
    let turn_id = gateway_state.next_turn_id(&session_id)?;
    let request = TurnRequest {
        session_id: Some(session_id.clone()),
        command: "replan my day".to_string(),
        source: Some(TurnSource::Automation),
        idempotency_key: None,
    };

    let router_context = crate::gateway::router::RouterContext {
        db_path: Some(db_path.to_path_buf()),
        app_data_dir: Some(app_state.app_data_dir.clone()),
        config: config.clone(),
    };

    let mut bus = gateway_state
        .bus
        .lock()
        .map_err(|error| error.to_string())?;
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
        None,
        Some(crate::gateway::orchestrator::TurnExecutionEnv {
            db_path: &app_state.db_path,
            app_data_dir: &app_state.app_data_dir,
            escalation: &mut escalation,
        }),
    );

    let _ = app.emit("gateway-turn-complete", &response);
    let _ = app.emit("planner-day-plan-changed", ());
    Ok(response.result.reply.chars().take(120).collect())
}

fn dispatch_meeting_followup_bundle(
    app: &AppHandle,
    _db_path: &Path,
    config: &GatewayConfig,
    payload: &str,
) -> Result<String, String> {
    let app_state = app
        .try_state::<crate::AppState>()
        .ok_or_else(|| "App state unavailable".to_string())?;
    let command = serde_json::from_str::<serde_json::Value>(payload)
        .ok()
        .and_then(|value| {
            value
                .get("command")
                .and_then(|entry| entry.as_str())
                .map(str::to_string)
        })
        .unwrap_or_else(|| "run project bundle".to_string());
    let (success, reply) = crate::gateway::labs::project_bundle_reply(
        config,
        &app_state.db_path,
        &app_state.app_data_dir,
        &command,
    );
    if success {
        Ok(reply.chars().take(200).collect())
    } else {
        Err(reply)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gateway::trigger_queue::enqueue_trigger;

    #[test]
    fn unknown_trigger_kind_fails() {
        let dir =
            std::env::temp_dir().join(format!("jarvis-trigger-dispatch-{}", std::process::id()));
        std::fs::create_dir_all(&dir).expect("dir");
        let db_path = dir.join("test.db");
        let conn = rusqlite::Connection::open(&db_path).expect("db");
        crate::migrations::apply_pending_migrations(&conn, &db_path).expect("migrate");
        enqueue_trigger(&conn, "unknown_kind", "{}").expect("enqueue");
        drop(conn);

        let conn = rusqlite::Connection::open(&db_path).expect("db");
        let claimed = claim_next_trigger(&conn).expect("claim").expect("event");
        assert_eq!(claimed.kind, "unknown_kind");
        let _ = std::fs::remove_dir_all(dir);
    }
}
