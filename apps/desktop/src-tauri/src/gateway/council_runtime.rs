use std::fs;
use std::path::Path;

use super::config::GatewayConfig;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CouncilVoteRecord {
    pub role: String,
    pub opinion: String,
    pub approved: bool,
}

pub fn maybe_run_council_runtime(
    config: &GatewayConfig,
    app_data_dir: &Path,
    turn_id: u64,
    command: &str,
    plan: &str,
) -> Option<String> {
    if !config.labs.council_runtime {
        return None;
    }
    let critic_note = if plan.lines().count() > 6 {
        "Critic: plan is long — consider splitting steps.".to_string()
    } else {
        "Critic: plan looks manageable.".to_string()
    };
    let votes = vec![
        CouncilVoteRecord {
            role: "planner".to_string(),
            opinion: plan.chars().take(160).collect(),
            approved: true,
        },
        CouncilVoteRecord {
            role: "critic".to_string(),
            opinion: critic_note.clone(),
            approved: !critic_note.contains("long"),
        },
        CouncilVoteRecord {
            role: "executor".to_string(),
            opinion: format!("Ready to execute: {command}"),
            approved: true,
        },
    ];
    let council_dir = app_data_dir.join("council");
    let _ = fs::create_dir_all(&council_dir);
    let path = council_dir.join(format!("turn-{turn_id}.json"));
    let _ = fs::write(
        &path,
        serde_json::to_string_pretty(&votes).unwrap_or_default(),
    );
    Some(format!(
        "Council runtime votes logged ({} approvals). Critic: {}",
        votes.iter().filter(|vote| vote.approved).count(),
        critic_note
    ))
}
