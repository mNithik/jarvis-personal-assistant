use super::{Agent, AgentContext, StepResult};
use crate::gateway::bus::EventBus;
use crate::gateway::types::{GatewayAgentKind, GatewayEvent, GatewayEventKind};

pub struct VisionAgent;

impl Agent for VisionAgent {
    fn kind(&self) -> GatewayAgentKind {
        GatewayAgentKind::Vision
    }

    fn run_step(&self, ctx: &AgentContext) -> Result<StepResult, String> {
        if !ctx.config.features.screen_ocr {
            return Ok(StepResult::failed(
                "Screen reading is disabled. Enable gateway.features.screen_ocr to run this via the gateway.",
            ));
        }

        #[cfg(target_os = "windows")]
        let uia_error = {
            match crate::tools::uia::read_foreground_tree() {
                Ok(tree) => {
                    let window_title = tree
                        .get("windowTitle")
                        .and_then(|value| value.as_str())
                        .unwrap_or_default()
                        .to_string();
                    let payload = tree.to_string();
                    let truncated = if payload.len() > 1200 {
                        format!("{}...", &payload[..1200])
                    } else {
                        payload.clone()
                    };

                    return Ok(StepResult::ok(format!(
                        "Read the foreground window \"{window_title}\" via UI Automation.\n{truncated}"
                    )));
                }
                Err(error) => {
                    Some(error)
                }
            }
        };

        #[cfg(not(target_os = "windows"))]
        let uia_error: Option<String> = None;

        let reply = crate::commands::vision::read_screen_via_ocr(&ctx.db_path, &ctx.app_data_dir)
            .map_err(|error| vision_degraded_message(uia_error.as_deref(), &error))?;
        Ok(StepResult::ok(reply))
    }
}

fn vision_degraded_message(uia_error: Option<&str>, ocr_error: &str) -> String {
    let uia_detail = uia_error.unwrap_or("not available on this platform or not attempted");
    format!(
        "Vision degraded mode: screen reading is unavailable. UIA: {uia_detail}. OCR: {ocr_error}. Try again with a visible foreground window, install or repair Tesseract, or use the legacy command path with gateway disabled."
    )
}

pub fn publish_screen_analyzed(
    bus: &mut EventBus,
    session_id: &str,
    turn_id: u64,
    payload: &str,
) {
    let truncated = if payload.len() > 500 {
        format!("{}...", &payload[..500])
    } else {
        payload.to_string()
    };
    bus.publish(GatewayEvent {
        id: format!("gateway-event-{turn_id}-screen-analyzed"),
        session_id: session_id.to_string(),
        turn_id: Some(turn_id),
        kind: GatewayEventKind::ScreenAnalyzed,
        message: truncated,
        created_at: super::unix_timestamp_string(),
        approval: None,
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn degraded_message_includes_uia_and_ocr_causes() {
        let message = vision_degraded_message(
            Some("No foreground window is available."),
            "Tesseract could not read text.",
        );

        assert!(message.contains("Vision degraded mode"));
        assert!(message.contains("No foreground window"));
        assert!(message.contains("Tesseract"));
        assert!(message.contains("gateway disabled"));
    }
}
