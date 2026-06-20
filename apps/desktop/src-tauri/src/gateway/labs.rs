use super::config::GatewayConfig;

pub fn project_bundle_reply(config: &GatewayConfig, command: &str) -> (bool, String) {
    if !config.labs.project_bundle_pilot {
        return (
            true,
            "Project bundle lab is disabled. Enable gateway.labs.project_bundle_pilot first."
                .to_string(),
        );
    }

    (
        true,
        format!("Project bundle lab queued follow-up bundle for: {command}"),
    )
}
