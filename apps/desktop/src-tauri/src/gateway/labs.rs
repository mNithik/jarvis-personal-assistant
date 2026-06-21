use std::fs;
use std::path::Path;

use super::config::GatewayConfig;

pub fn project_bundle_reply(
    config: &GatewayConfig,
    db_path: &Path,
    app_data_dir: &Path,
    command: &str,
) -> (bool, String) {
    if !config.labs.project_bundle_pilot {
        return (
            true,
            "Project bundle lab is disabled. Enable gateway.labs.projectBundlePilot first."
                .to_string(),
        );
    }

    let run_id = format!("bundle-{}", chrono::Utc::now().timestamp());
    let bundle_dir = app_data_dir.join("bundles").join(&run_id);
    if let Err(error) = fs::create_dir_all(&bundle_dir) {
        return (false, format!("Could not create bundle directory: {error}"));
    }

    let mut steps = vec![
        "Fetch related emails for the meeting".to_string(),
        "Refresh meeting prep memory".to_string(),
        "Draft follow-up email".to_string(),
        "Create Notion follow-up task".to_string(),
    ];

    if config.features.gmail {
        if let Ok(token) = crate::integrations::google::get_session_token("gmail") {
            if let Ok(emails) = crate::integrations::google::gmail::list_unread(&token, 3) {
                let _ = fs::write(
                    bundle_dir.join("emails.json"),
                    serde_json::to_string_pretty(&emails).unwrap_or_else(|_| "[]".into()),
                );
                steps[0] = format!("Fetched {} unread email(s)", emails.len());
            }
        }
    }

    if config.features.memory {
        if let Ok((prep, _)) = crate::memory::meeting::compose_meeting_copilot_v2(
            db_path,
            app_data_dir,
            Some(config),
            None,
            None,
        ) {
            let _ = fs::write(bundle_dir.join("meeting_prep.md"), prep);
            steps[1] = "Meeting prep refreshed with calendar + Notion context".to_string();
        }
    }

    let manifest = serde_json::json!({
        "runId": run_id,
        "command": command,
        "steps": steps,
    });
    let _ = fs::write(
        bundle_dir.join("manifest.json"),
        serde_json::to_string_pretty(&manifest).unwrap_or_default(),
    );

    (
        true,
        format!(
            "Project bundle {run_id} queued for: {command}\n{}",
            steps
                .iter()
                .enumerate()
                .map(|(index, step)| format!("{}. {step}", index + 1))
                .collect::<Vec<_>>()
                .join("\n")
        ),
    )
}

pub fn council_verifier_note(config: &GatewayConfig, command: &str, draft: &str) -> Option<String> {
    if !config.labs.council_verifier {
        return None;
    }
    match super::verifier::council_verify_send(
        config,
        super::types::GatewayPolicyClass::Send,
        command,
        draft,
    ) {
        Ok(()) => Some("Council verifier: approved.".to_string()),
        Err(reason) => Some(format!("Council verifier: {reason}")),
    }
}
