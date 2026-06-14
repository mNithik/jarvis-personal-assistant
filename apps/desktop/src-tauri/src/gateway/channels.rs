use serde::{Deserialize, Serialize};

use crate::gateway::types::TurnRequest;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelTurnRequest {
    pub channel: String,
    pub session_id: Option<String>,
    pub command: String,
}

impl From<ChannelTurnRequest> for TurnRequest {
    fn from(value: ChannelTurnRequest) -> Self {
        TurnRequest {
            session_id: value
                .session_id
                .or_else(|| Some(format!("channel-{}", value.channel))),
            command: value.command,
            source: Some(crate::gateway::types::TurnSource::Automation),
            idempotency_key: None,
        }
    }
}

pub fn parse_local_channel_payload(raw: &str) -> Result<ChannelTurnRequest, String> {
    serde_json::from_str(raw).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_channel_turn_json() {
        let request = parse_local_channel_payload(
            r#"{"channel":"ws","command":"open chrome","sessionId":"s1"}"#,
        )
        .expect("parse");
        assert_eq!(request.channel, "ws");
        assert_eq!(request.command, "open chrome");
    }
}
