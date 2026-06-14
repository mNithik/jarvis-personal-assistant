use std::sync::{Arc, Mutex};

use super::types::GatewayEvent;

#[derive(Debug, Default)]
pub struct EventBus {
    events: Vec<GatewayEvent>,
    subscribers: Vec<Arc<Mutex<Vec<GatewayEvent>>>>,
}

impl EventBus {
    pub fn publish(&mut self, event: GatewayEvent) {
        self.events.push(event.clone());
        for subscriber in &self.subscribers {
            if let Ok(mut buffer) = subscriber.lock() {
                buffer.push(event.clone());
            }
        }
    }

    pub fn subscribe(&mut self) -> Arc<Mutex<Vec<GatewayEvent>>> {
        let subscriber = Arc::new(Mutex::new(Vec::new()));
        self.subscribers.push(subscriber.clone());
        subscriber
    }

    pub fn drain(&mut self) -> Vec<GatewayEvent> {
        std::mem::take(&mut self.events)
    }

    pub fn recent(&self, limit: usize) -> Vec<GatewayEvent> {
        let skip = self.events.len().saturating_sub(limit);
        self.events.iter().skip(skip).cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gateway::types::GatewayEventKind;

    fn sample_event(id: &str) -> GatewayEvent {
        GatewayEvent {
            id: id.to_string(),
            session_id: "session-a".to_string(),
            turn_id: Some(1),
            kind: GatewayEventKind::RouteDecided,
            message: "route decided".to_string(),
            created_at: "1".to_string(),
            approval: None,
        }
    }

    #[test]
    fn publishes_to_bus_buffer() {
        let mut bus = EventBus::default();
        bus.publish(sample_event("event-1"));
        let drained = bus.drain();
        assert_eq!(drained.len(), 1);
        assert_eq!(drained[0].id, "event-1");
    }

    #[test]
    fn subscriber_receives_published_events() {
        let mut bus = EventBus::default();
        let subscriber = bus.subscribe();
        bus.publish(sample_event("event-2"));

        let received = subscriber.lock().expect("lock subscriber");
        assert_eq!(received.len(), 1);
        assert_eq!(received[0].id, "event-2");
    }
}
