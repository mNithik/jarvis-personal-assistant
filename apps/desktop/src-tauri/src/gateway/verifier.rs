use super::config::GatewayConfig;
use super::types::GatewayPolicyClass;

/// Lab L2 council verifier — lightweight second pass before send-class actions.
pub fn council_verify_send(
    config: &GatewayConfig,
    policy_class: GatewayPolicyClass,
    command: &str,
    draft_detail: &str,
) -> Result<(), String> {
    if !config.labs.council_verifier {
        return Ok(());
    }
    if policy_class != GatewayPolicyClass::Send && policy_class != GatewayPolicyClass::Schedule {
        return Ok(());
    }

    let combined = format!("{command}\n{draft_detail}").to_lowercase();
    let blocked_patterns = [
        "wrong-recipient@",
        "definitely-not-you@",
        "DELETE FROM",
        "drop table",
    ];
    for pattern in blocked_patterns {
        if combined.contains(pattern) {
            return Err(format!(
                "Council verifier blocked this action: detected risky pattern \"{pattern}\"."
            ));
        }
    }

    if draft_detail.trim().len() < 5 {
        return Err(
            "Council verifier blocked this action: draft content is too short to verify safely."
                .to_string(),
        );
    }

    Ok(())
}
