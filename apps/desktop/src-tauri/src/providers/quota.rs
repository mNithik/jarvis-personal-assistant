use std::{
    collections::HashMap,
    sync::{LazyLock, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QuotaExceeded {
    pub provider_id: String,
    pub limit: u32,
    pub failover_hint: String,
}

pub struct QuotaTracker {
    day_key: String,
    counts: HashMap<String, u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CircuitState {
    Closed,
    Open,
    HalfOpen,
}

#[derive(Debug, Clone, Default)]
struct CircuitEntry {
    failure_timestamps: Vec<u64>,
    opened_at: Option<u64>,
}

#[derive(Debug, Clone, Default)]
pub struct CircuitBreakerTracker {
    entries: HashMap<String, CircuitEntry>,
}

const CIRCUIT_FAILURE_THRESHOLD: usize = 5;
const CIRCUIT_FAILURE_WINDOW_SECONDS: u64 = 60;
const CIRCUIT_OPEN_SECONDS: u64 = 300;

impl Default for QuotaTracker {
    fn default() -> Self {
        Self {
            day_key: current_day_key(),
            counts: HashMap::new(),
        }
    }
}

impl QuotaTracker {
    pub fn check_and_increment(
        &mut self,
        provider_id: &str,
        limit: u32,
    ) -> Result<(), QuotaExceeded> {
        roll_day_if_needed(self);
        if limit == 0 {
            return Ok(());
        }

        let count = self.counts.entry(provider_id.to_string()).or_insert(0);
        if *count >= limit {
            return Err(QuotaExceeded {
                provider_id: provider_id.to_string(),
                limit,
                failover_hint: "use local_ollama".to_string(),
            });
        }
        *count += 1;
        Ok(())
    }

    pub fn count(&self, provider_id: &str) -> u32 {
        self.counts.get(provider_id).copied().unwrap_or(0)
    }
}

pub fn shared_quota_tracker() -> &'static Mutex<QuotaTracker> {
    static TRACKER: LazyLock<Mutex<QuotaTracker>> =
        LazyLock::new(|| Mutex::new(QuotaTracker::default()));
    &TRACKER
}

impl CircuitBreakerTracker {
    pub fn record_failure(&mut self, provider_id: &str) {
        self.record_failure_at(provider_id, current_second());
    }

    pub fn record_failure_at(&mut self, provider_id: &str, now: u64) {
        let state = self.state_at(provider_id, now);
        let entry = self.entries.entry(provider_id.to_string()).or_default();
        if state == CircuitState::Open || state == CircuitState::HalfOpen {
            entry.failure_timestamps.clear();
            entry.opened_at = Some(now);
            return;
        }

        entry
            .failure_timestamps
            .retain(|timestamp| now.saturating_sub(*timestamp) <= CIRCUIT_FAILURE_WINDOW_SECONDS);
        entry.failure_timestamps.push(now);
        if entry.failure_timestamps.len() >= CIRCUIT_FAILURE_THRESHOLD {
            entry.opened_at = Some(now);
        }
    }

    pub fn record_success(&mut self, provider_id: &str) {
        self.entries.remove(provider_id);
    }

    pub fn can_call(&self, provider_id: &str) -> bool {
        self.can_call_at(provider_id, current_second())
    }

    pub fn can_call_at(&self, provider_id: &str, now: u64) -> bool {
        self.state_at(provider_id, now) != CircuitState::Open
    }

    pub fn state_at(&self, provider_id: &str, now: u64) -> CircuitState {
        let Some(entry) = self.entries.get(provider_id) else {
            return CircuitState::Closed;
        };
        let Some(opened_at) = entry.opened_at else {
            return CircuitState::Closed;
        };
        if now.saturating_sub(opened_at) >= CIRCUIT_OPEN_SECONDS {
            CircuitState::HalfOpen
        } else {
            CircuitState::Open
        }
    }
}

pub fn shared_circuit_breaker() -> &'static Mutex<CircuitBreakerTracker> {
    static TRACKER: LazyLock<Mutex<CircuitBreakerTracker>> =
        LazyLock::new(|| Mutex::new(CircuitBreakerTracker::default()));
    &TRACKER
}

fn roll_day_if_needed(tracker: &mut QuotaTracker) {
    let today = current_day_key();
    if tracker.day_key != today {
        tracker.day_key = today;
        tracker.counts.clear();
    }
}

fn current_day_key() -> String {
    (current_second() / 86_400).to_string()
}

fn current_second() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quota_exceeded_returns_failover_hint() {
        let mut tracker = QuotaTracker::default();
        tracker.check_and_increment("groq", 1).expect("first call");
        let exceeded = tracker
            .check_and_increment("groq", 1)
            .expect_err("second call should exceed");
        assert_eq!(exceeded.provider_id, "groq");
        assert_eq!(exceeded.failover_hint, "use local_ollama");
    }

    #[test]
    fn exceeding_limit_returns_failover_hint() {
        let mut tracker = QuotaTracker::default();
        tracker.check_and_increment("groq", 2).expect("first");
        tracker.check_and_increment("groq", 2).expect("second");
        let error = tracker.check_and_increment("groq", 2).expect_err("quota");
        assert_eq!(error.failover_hint, "use local_ollama");
        assert_eq!(error.limit, 2);
    }

    #[test]
    fn circuit_opens_after_five_failures_inside_sixty_seconds() {
        let mut tracker = CircuitBreakerTracker::default();
        for offset in [0, 10, 20, 30] {
            tracker.record_failure_at("groq", offset);
            assert_eq!(tracker.state_at("groq", offset), CircuitState::Closed);
        }

        tracker.record_failure_at("groq", 40);

        assert_eq!(tracker.state_at("groq", 41), CircuitState::Open);
        assert!(!tracker.can_call_at("groq", 41));
    }

    #[test]
    fn circuit_becomes_half_open_after_cooldown() {
        let mut tracker = CircuitBreakerTracker::default();
        for offset in [0, 10, 20, 30, 40] {
            tracker.record_failure_at("groq", offset);
        }

        assert_eq!(tracker.state_at("groq", 41), CircuitState::Open);
        assert_eq!(tracker.state_at("groq", 341), CircuitState::HalfOpen);
        assert!(tracker.can_call_at("groq", 341));
    }

    #[test]
    fn success_resets_circuit() {
        let mut tracker = CircuitBreakerTracker::default();
        for offset in [0, 10, 20, 30, 40] {
            tracker.record_failure_at("groq", offset);
        }

        tracker.record_success("groq");

        assert_eq!(tracker.state_at("groq", 41), CircuitState::Closed);
        assert!(tracker.can_call_at("groq", 41));
    }
}
