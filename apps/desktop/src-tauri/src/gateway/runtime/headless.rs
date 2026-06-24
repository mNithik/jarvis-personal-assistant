use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::{Mutex, RwLock},
};

use chrono::Timelike;

use crate::providers::escalation::EscalationTracker;

use super::super::{
    bus::EventBus,
    config::{load_gateway_config, GatewayConfig},
    orchestrator::{GatewayOrchestrator, GatewayTurnResponse, TurnExecutionEnv},
    router::RouterContext,
    state::PendingApproval,
    trigger_queue::{claim_next_trigger, complete_trigger, enqueue_trigger},
    types::ApprovalRequest,
    types::{TurnRequest, TurnSource},
};

#[derive(Debug, Default)]
pub struct HeadlessProactiveState {
    pub last_heartbeat_minute: Option<u32>,
    pub last_brief_day: Option<String>,
    pub last_ocr_minute: Option<u32>,
    pub last_meeting_copilot_key: Option<String>,
}

pub struct HeadlessGatewayContext {
    config: RwLock<GatewayConfig>,
    pub db_path: PathBuf,
    pub app_data_dir: PathBuf,
    pub bus: Mutex<EventBus>,
    pub turn_counters: Mutex<HashMap<String, u64>>,
    pending_approvals: Mutex<HashMap<String, PendingApproval>>,
    pub escalation: Mutex<EscalationTracker>,
    pub proactive: Mutex<HeadlessProactiveState>,
}

impl HeadlessGatewayContext {
    pub fn new(app_data_dir: PathBuf, db_path: PathBuf) -> Self {
        let config = load_gateway_config(&app_data_dir);
        Self {
            config: RwLock::new(config),
            db_path,
            app_data_dir,
            bus: Mutex::new(EventBus::default()),
            turn_counters: Mutex::new(HashMap::new()),
            pending_approvals: Mutex::new(HashMap::new()),
            escalation: Mutex::new(EscalationTracker::default()),
            proactive: Mutex::new(HeadlessProactiveState::default()),
        }
    }

    pub fn config(&self) -> GatewayConfig {
        self.config
            .read()
            .unwrap_or_else(|error| error.into_inner())
            .clone()
    }

    pub fn reload_config(&self) {
        let fresh = load_gateway_config(&self.app_data_dir);
        if let Ok(mut guard) = self.config.write() {
            *guard = fresh;
        }
    }

    pub fn next_turn_id(&self, session_id: &str) -> Result<u64, String> {
        let mut counters = self
            .turn_counters
            .lock()
            .map_err(|error| error.to_string())?;
        let turn_id = counters.entry(session_id.to_string()).or_insert(1);
        let current = *turn_id;
        *turn_id += 1;
        Ok(current)
    }

    pub fn run_turn(&self, request: TurnRequest) -> Result<GatewayTurnResponse, String> {
        let config = self.config();
        if !config.enabled {
            return Err("Gateway is disabled".to_string());
        }

        let session_id = request
            .session_id
            .clone()
            .unwrap_or_else(|| "headless".to_string());
        let turn_id = self.next_turn_id(&session_id)?;

        let router_context = RouterContext {
            db_path: Some(self.db_path.clone()),
            app_data_dir: Some(self.app_data_dir.clone()),
            config: config.clone(),
        };

        let mut bus = self.bus.lock().map_err(|error| error.to_string())?;
        let mut escalation = self.escalation.lock().map_err(|error| error.to_string())?;

        let original_command = request.command.clone();
        let response = GatewayOrchestrator::run_turn(
            request,
            turn_id,
            &session_id,
            &config,
            &router_context,
            &mut bus,
            None,
            Some(TurnExecutionEnv {
                db_path: &self.db_path,
                app_data_dir: &self.app_data_dir,
                escalation: &mut escalation,
            }),
        );

        if response.awaiting_approval {
            if let Some(approval) = response.approval.clone() {
                self.store_pending_approval(PendingApproval {
                    request: approval,
                    correlation_id: response.correlation_id.clone(),
                    command: original_command.clone(),
                })?;
            }
        }

        Ok(response)
    }

    pub fn run_turn_headless(&self, command: &str) -> Result<GatewayTurnResponse, String> {
        self.run_turn(TurnRequest {
            session_id: Some("headless".to_string()),
            command: command.to_string(),
            source: Some(TurnSource::Automation),
            idempotency_key: None,
        })
    }

    pub fn process_trigger_queue_headless(&self) -> Result<Option<String>, String> {
        if !self.config().enabled {
            return Ok(None);
        }

        let conn = rusqlite::Connection::open(&self.db_path).map_err(|error| error.to_string())?;
        let Some(event) = claim_next_trigger(&conn)? else {
            return Ok(None);
        };

        let result = match event.kind.as_str() {
            "morning_brief" => self.dispatch_morning_brief(),
            "ocr_watch" => self.dispatch_ocr_watch(&event.payload),
            "channel_turn" => self.dispatch_channel_turn(&event.payload),
            "gmail_label_inbox" => self.dispatch_gmail_label_inbox(&event.payload),
            "calendar_event_soon" => self.dispatch_calendar_event_soon(&event.payload),
            other => {
                let _ = complete_trigger(&conn, &event.id, false);
                return Err(format!("Unknown trigger kind: {other}"));
            }
        };

        let success = result.is_ok();
        complete_trigger(&conn, &event.id, success)?;
        result.map(|summary| Some(format!("{}: {}", event.kind, summary)))
    }

    fn dispatch_morning_brief(&self) -> Result<String, String> {
        let config = self.config();
        let command = if config.proactive.planner_copilot_enabled {
            "plan my day".to_string()
        } else {
            "create daily brief".to_string()
        };
        let response = self.run_turn(TurnRequest {
            session_id: Some("proactive-morning-brief".to_string()),
            command,
            source: Some(TurnSource::Automation),
            idempotency_key: None,
        })?;
        let summary = response.result.reply.chars().take(120).collect::<String>();
        self.append_service_log(&format!("morning_brief: {summary}"));
        Ok(summary)
    }

    fn dispatch_ocr_watch(&self, payload: &str) -> Result<String, String> {
        self.append_service_log(&format!("ocr_watch tick: {payload}"));
        Ok("OCR watch tick processed headlessly".to_string())
    }

    fn dispatch_channel_turn(&self, payload: &str) -> Result<String, String> {
        let channel_request = crate::gateway::channels::parse_local_channel_payload(payload)?;
        let turn_request: TurnRequest = channel_request.into();
        let response = self.run_turn(turn_request)?;
        let summary = response.result.reply.chars().take(120).collect::<String>();
        self.append_service_log(&format!("channel_turn: {summary}"));
        Ok(summary)
    }

    fn dispatch_gmail_label_inbox(&self, payload: &str) -> Result<String, String> {
        let parsed: serde_json::Value =
            serde_json::from_str(payload).unwrap_or_else(|_| serde_json::json!({}));
        let command = parsed
            .get("command")
            .and_then(|value| value.as_str())
            .unwrap_or("scan expense emails in inbox")
            .trim()
            .to_string();
        let response = self.run_turn(TurnRequest {
            session_id: Some(format!(
                "trigger-gmail-{}",
                parsed
                    .get("label")
                    .and_then(|value| value.as_str())
                    .unwrap_or("inbox")
            )),
            command,
            source: Some(TurnSource::Automation),
            idempotency_key: None,
        })?;
        let summary = response.result.reply.chars().take(120).collect::<String>();
        self.append_service_log(&format!("gmail_label_inbox: {summary}"));
        Ok(summary)
    }

    fn dispatch_calendar_event_soon(&self, payload: &str) -> Result<String, String> {
        let parsed: serde_json::Value =
            serde_json::from_str(payload).unwrap_or_else(|_| serde_json::json!({}));
        let command = parsed
            .get("command")
            .and_then(|value| value.as_str())
            .unwrap_or("prep me for my next meeting")
            .trim()
            .to_string();
        let response = self.run_turn(TurnRequest {
            session_id: Some(format!(
                "trigger-meeting-{}",
                parsed
                    .get("eventId")
                    .and_then(|value| value.as_str())
                    .unwrap_or("soon")
            )),
            command,
            source: Some(TurnSource::Automation),
            idempotency_key: None,
        })?;
        let summary = response.result.reply.chars().take(120).collect::<String>();
        self.append_service_log(&format!("calendar_event_soon: {summary}"));
        Ok(summary)
    }

    pub fn run_proactive_tick_headless(&self) -> Result<Vec<String>, String> {
        let config = self.config();
        if !config.enabled {
            return Ok(Vec::new());
        }

        let mut summaries = Vec::new();
        let now = chrono::Local::now();
        let minute_key = now.hour() * 60 + now.minute();
        let day_key = now.format("%Y-%m-%d").to_string();
        let time_label = now.format("%H:%M").to_string();

        let mut proactive = self.proactive.lock().map_err(|error| error.to_string())?;

        if config.proactive.heartbeat_enabled
            && minute_key % config.proactive.heartbeat_interval_minutes.max(1) == 0
            && proactive.last_heartbeat_minute != Some(minute_key)
        {
            proactive.last_heartbeat_minute = Some(minute_key);
            self.write_heartbeat_file()?;
            summaries.push("heartbeat".to_string());
        }

        if config.proactive.morning_brief_enabled
            && time_label == config.proactive.morning_brief_time
            && proactive.last_brief_day != Some(day_key.clone())
        {
            proactive.last_brief_day = Some(day_key);
            drop(proactive);
            if let Ok(Some(summary)) = self.enqueue_and_note("morning_brief", "{}") {
                summaries.push(summary);
            }
            proactive = self.proactive.lock().map_err(|error| error.to_string())?;
        }

        if config.proactive.ocr_watch_tick_enabled && proactive.last_ocr_minute != Some(minute_key)
        {
            proactive.last_ocr_minute = Some(minute_key);
            drop(proactive);
            let payload = serde_json::json!({ "minute": minute_key }).to_string();
            if let Ok(Some(summary)) = self.enqueue_and_note("ocr_watch", &payload) {
                summaries.push(summary);
            }
            let _ = crate::gateway::schedule_runner::enqueue_due_schedules(&self.db_path);
            proactive = self.proactive.lock().map_err(|error| error.to_string())?;
        }

        if config.features.calendar {
            if let Ok(token) = crate::integrations::google::get_session_token("calendar") {
                if let Ok(Some(event)) =
                    crate::integrations::google::calendar::find_event_starting_within(&token, 15)
                {
                    let minute_key = now.hour() * 60 + now.minute();
                    let dedupe_key = format!("{}:{}", event.id, minute_key);
                    if proactive.last_meeting_copilot_key != Some(dedupe_key.clone()) {
                        proactive.last_meeting_copilot_key = Some(dedupe_key);
                        drop(proactive);
                        let payload = serde_json::json!({
                            "minutes": 15,
                            "eventId": event.id,
                            "summary": event.summary,
                            "command": "prep me for my next meeting",
                        })
                        .to_string();
                        if let Ok(Some(summary)) =
                            self.enqueue_and_note("calendar_event_soon", &payload)
                        {
                            summaries.push(summary);
                        }
                        proactive = self.proactive.lock().map_err(|error| error.to_string())?;
                    }
                }
            }
        }

        drop(proactive);
        if let Ok(Some(summary)) = self.process_trigger_queue_headless() {
            summaries.push(summary);
        }

        self.touch_service_status()?;
        Ok(summaries)
    }

    fn enqueue_and_note(&self, kind: &str, payload: &str) -> Result<Option<String>, String> {
        let conn = rusqlite::Connection::open(&self.db_path).map_err(|error| error.to_string())?;
        enqueue_trigger(&conn, kind, payload)?;
        drop(conn);
        self.process_trigger_queue_headless()
    }

    pub fn store_pending_approval(&self, pending: PendingApproval) -> Result<(), String> {
        let mut approvals = self
            .pending_approvals
            .lock()
            .map_err(|error| error.to_string())?;
        approvals.insert(pending.request.id.clone(), pending);
        Ok(())
    }

    pub fn take_pending_approval(
        &self,
        approval_id: &str,
    ) -> Result<Option<PendingApproval>, String> {
        let mut approvals = self
            .pending_approvals
            .lock()
            .map_err(|error| error.to_string())?;
        Ok(approvals.remove(approval_id))
    }

    pub fn list_pending_approvals(&self) -> Result<Vec<ApprovalRequest>, String> {
        let approvals = self
            .pending_approvals
            .lock()
            .map_err(|error| error.to_string())?;
        Ok(approvals
            .values()
            .map(|pending| pending.request.clone())
            .collect())
    }

    fn write_heartbeat_file(&self) -> Result<(), String> {
        let path = self.app_data_dir.join("HEARTBEAT.md");
        let stamp = chrono::Utc::now().to_rfc3339();
        let body = format!("# JARVIS Heartbeat\n\n- Last service tick: {stamp}\n");
        fs::write(path, body).map_err(|error| error.to_string())
    }

    pub fn append_service_log(&self, line: &str) {
        let path = self.app_data_dir.join("service.log");
        let stamp = chrono::Utc::now().to_rfc3339();
        let _ = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .and_then(|mut file| {
                use std::io::Write;
                writeln!(file, "[{stamp}] {line}")
            });
    }

    pub fn touch_service_status(&self) -> Result<(), String> {
        let path = self.app_data_dir.join("service-status.json");
        let payload = serde_json::json!({
            "running": true,
            "updatedAt": chrono::Utc::now().to_rfc3339(),
        });
        fs::write(path, payload.to_string()).map_err(|error| error.to_string())
    }

    pub fn clear_service_status(&self) {
        let path = self.app_data_dir.join("service-status.json");
        let _ = fs::remove_file(path);
    }
}

pub fn service_is_running(app_data_dir: &Path) -> bool {
    read_service_status(app_data_dir).running
}

#[derive(Debug, Clone, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct JarvisServiceStatus {
    pub running: bool,
    pub updated_at: Option<String>,
}

pub fn read_service_status(app_data_dir: &Path) -> JarvisServiceStatus {
    let path = app_data_dir.join("service-status.json");
    if !path.exists() {
        return JarvisServiceStatus {
            running: false,
            updated_at: None,
        };
    }
    fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
        .map(|value| JarvisServiceStatus {
            running: value
                .get("running")
                .and_then(|running| running.as_bool())
                .unwrap_or(false),
            updated_at: value
                .get("updatedAt")
                .and_then(|stamp| stamp.as_str())
                .map(str::to_string),
        })
        .unwrap_or(JarvisServiceStatus {
            running: false,
            updated_at: None,
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gateway::config::GatewayConfig;
    use crate::migrations::apply_pending_migrations;

    #[test]
    fn headless_turn_when_gateway_disabled_errors() {
        let dir = std::env::temp_dir().join(format!("jarvis-headless-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let db_path = dir.join("jarvis.db");
        let conn = rusqlite::Connection::open(&db_path).expect("open");
        apply_pending_migrations(&conn, &db_path).expect("migrate");
        drop(conn);

        let mut config = GatewayConfig::default();
        config.enabled = false;
        crate::gateway::config::save_gateway_config(&dir, &config).expect("save disabled config");

        let ctx = HeadlessGatewayContext::new(dir.clone(), db_path);
        let result = ctx.run_turn_headless("list recent files");
        assert!(result.is_err());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn headless_turn_runs_when_gateway_enabled() {
        let dir = std::env::temp_dir().join(format!("jarvis-headless-on-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let db_path = dir.join("jarvis.db");
        let conn = rusqlite::Connection::open(&db_path).expect("open");
        apply_pending_migrations(&conn, &db_path).expect("migrate");
        drop(conn);

        let mut config = GatewayConfig::default();
        config.enabled = true;
        crate::gateway::config::save_gateway_config(&dir, &config).expect("save config");

        let ctx = HeadlessGatewayContext::new(dir.clone(), db_path);
        let response = ctx.run_turn_headless("list recent files").expect("turn");
        assert!(!response.result.reply.is_empty());
        let _ = std::fs::remove_dir_all(dir);
    }
}
