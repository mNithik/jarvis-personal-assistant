use std::{
    collections::HashMap,
    path::PathBuf,
    sync::Mutex,
    time::SystemTime,
};

use crate::providers::escalation::EscalationTracker;

use super::{
    bus::EventBus,
    config::{ensure_default_gateway_config, load_gateway_config, save_gateway_config, GatewayConfig},
    orchestrator::GatewayTurnResponse,
    types::{ApprovalRequest, GatewayEvent},
};

const IDEMPOTENCY_TTL_SECONDS: u64 = 60;

#[derive(Debug, Clone)]
pub struct PendingApproval {
    pub request: ApprovalRequest,
    pub correlation_id: String,
    pub command: String,
}

pub struct GatewayState {
    pub config: Mutex<GatewayConfig>,
    app_data_dir: PathBuf,
    pub bus: Mutex<EventBus>,
    turn_counters: Mutex<HashMap<String, u64>>,
    pending_approvals: Mutex<HashMap<String, PendingApproval>>,
    idempotency_cache: Mutex<HashMap<String, IdempotencyCacheEntry>>,
    pub escalation: Mutex<EscalationTracker>,
}

#[derive(Debug, Clone)]
struct IdempotencyCacheEntry {
    response: GatewayTurnResponse,
    stored_at: SystemTime,
}

impl GatewayState {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let config = ensure_default_gateway_config(&app_data_dir);
        Self {
            config: Mutex::new(config),
            app_data_dir,
            bus: Mutex::new(EventBus::default()),
            turn_counters: Mutex::new(HashMap::new()),
            pending_approvals: Mutex::new(HashMap::new()),
            idempotency_cache: Mutex::new(HashMap::new()),
            escalation: Mutex::new(EscalationTracker::default()),
        }
    }

    pub fn app_data_dir(&self) -> &PathBuf {
        &self.app_data_dir
    }

    pub fn reload_config(&self) -> Result<GatewayConfig, String> {
        let config = load_gateway_config(&self.app_data_dir);
        let mut current = self.config.lock().map_err(|error| error.to_string())?;
        *current = config.clone();
        Ok(config)
    }

    pub fn save_config(&self, config: &GatewayConfig) -> Result<(), String> {
        save_gateway_config(&self.app_data_dir, config)?;
        let mut current = self.config.lock().map_err(|error| error.to_string())?;
        *current = config.clone();
        Ok(())
    }

    pub fn next_turn_id(&self, session_id: &str) -> Result<u64, String> {
        let mut counters = self.turn_counters.lock().map_err(|error| error.to_string())?;
        let turn_id = counters.entry(session_id.to_string()).or_insert(1);
        let current = *turn_id;
        *turn_id += 1;
        Ok(current)
    }

    pub fn store_pending_approval(&self, pending: PendingApproval) -> Result<(), String> {
        let mut approvals = self
            .pending_approvals
            .lock()
            .map_err(|error| error.to_string())?;
        approvals.insert(pending.request.id.clone(), pending);
        Ok(())
    }

    pub fn take_pending_approval(&self, approval_id: &str) -> Result<Option<PendingApproval>, String> {
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

    pub fn recent_trace(&self, limit: usize) -> Result<Vec<GatewayEvent>, String> {
        let bus = self.bus.lock().map_err(|error| error.to_string())?;
        Ok(bus.recent(limit))
    }

    pub fn get_idempotent_response(
        &self,
        key: &str,
    ) -> Result<Option<GatewayTurnResponse>, String> {
        let mut cache = self
            .idempotency_cache
            .lock()
            .map_err(|error| error.to_string())?;
        let Some(entry) = cache.get(key) else {
            return Ok(None);
        };
        let expired = entry
            .stored_at
            .elapsed()
            .map(|elapsed| elapsed.as_secs() > IDEMPOTENCY_TTL_SECONDS)
            .unwrap_or(true);
        if expired {
            cache.remove(key);
            return Ok(None);
        }
        Ok(Some(entry.response.clone()))
    }

    pub fn store_idempotent_response(
        &self,
        key: &str,
        response: GatewayTurnResponse,
    ) -> Result<(), String> {
        let mut cache = self
            .idempotency_cache
            .lock()
            .map_err(|error| error.to_string())?;
        cache.insert(
            key.to_string(),
            IdempotencyCacheEntry {
                response,
                stored_at: SystemTime::now(),
            },
        );
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gateway::orchestrator::GatewayTurnResponse;
    use crate::gateway::types::TurnResult;

    fn response(turn_id: u64) -> GatewayTurnResponse {
        GatewayTurnResponse {
            correlation_id: format!("corr-{turn_id}"),
            events: Vec::new(),
            result: TurnResult {
                session_id: "session".to_string(),
                turn_id,
                legacy: false,
                reply: format!("reply {turn_id}"),
                route: None,
                integration_handoff: None,
            },
            approval: None,
            awaiting_approval: false,
            talker_reply: None,
        }
    }

    #[test]
    fn idempotency_cache_returns_stored_response_for_same_key() {
        let state = GatewayState::new(std::env::temp_dir());
        state
            .store_idempotent_response("key-a", response(7))
            .expect("store");

        let cached = state
            .get_idempotent_response("key-a")
            .expect("lookup")
            .expect("cached response");

        assert_eq!(cached.result.turn_id, 7);
        assert_eq!(cached.correlation_id, "corr-7");
    }

    #[test]
    fn idempotency_cache_expires_old_entries() {
        let state = GatewayState::new(std::env::temp_dir());
        state
            .store_idempotent_response("key-old", response(3))
            .expect("store");
        {
            let mut cache = state.idempotency_cache.lock().expect("cache");
            cache.get_mut("key-old").expect("entry").stored_at =
                SystemTime::now() - std::time::Duration::from_secs(IDEMPOTENCY_TTL_SECONDS + 1);
        }

        assert!(state
            .get_idempotent_response("key-old")
            .expect("lookup")
            .is_none());
    }
}
