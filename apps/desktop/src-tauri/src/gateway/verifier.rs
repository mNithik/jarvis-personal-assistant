use super::config::GatewayConfig;
use super::types::GatewayPolicyClass;

/// Lab L2 council verifier — second pass before send-class actions.
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
        "bcc: wrong",
        "to: wrong-recipient",
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

    if policy_class == GatewayPolicyClass::Send {
        if combined.contains("to:") && !combined.contains('@') {
            return Err(
                "Council verifier blocked this action: send draft missing a valid recipient."
                    .to_string(),
            );
        }
        let risky_tone = ["asap delete", "wire transfer", "password is", "ssn:"];
        for pattern in risky_tone {
            if combined.contains(pattern) {
                return Err(format!(
                    "Council verifier blocked this action: risky tone detected (\"{pattern}\")."
                ));
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gateway::config::GatewayLabsConfig;

    fn config_with_verifier() -> GatewayConfig {
        let mut config = GatewayConfig::default();
        config.labs.council_verifier = true;
        config
    }

    #[test]
    fn blocks_wrong_recipient_fixture() {
        let config = config_with_verifier();
        let err = council_verify_send(
            &config,
            GatewayPolicyClass::Send,
            "send email",
            "To: wrong-recipient@evil.com\nBody: hello",
        )
        .expect_err("should block");
        assert!(err.contains("wrong-recipient"));
    }

    #[test]
    fn approves_safe_draft() {
        let config = config_with_verifier();
        council_verify_send(
            &config,
            GatewayPolicyClass::Send,
            "send email",
            "To: alex@example.com\nSubject: Thanks\nBody: Thank you for the meeting.",
        )
        .expect("approved");
    }
}
