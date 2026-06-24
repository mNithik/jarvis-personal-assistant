use std::fs;
use std::path::Path;

use super::audit::{self, AuditOutcome, AuditRecord};
use super::config::GatewayConfig;
use super::types::GatewayPolicyClass;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectBundleStep {
    pub label: String,
    pub status: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectBundleRecord {
    pub run_id: String,
    pub command: String,
    pub steps: Vec<ProjectBundleStep>,
    pub created_at: String,
}

fn write_manifest(bundle_dir: &Path, record: &ProjectBundleRecord) -> Result<(), String> {
    fs::write(
        bundle_dir.join("manifest.json"),
        serde_json::to_string_pretty(record).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())
}

fn initial_steps() -> Vec<ProjectBundleStep> {
    vec![
        ProjectBundleStep {
            label: "Fetch related emails for the meeting".to_string(),
            status: "pending".to_string(),
        },
        ProjectBundleStep {
            label: "Refresh meeting prep memory".to_string(),
            status: "pending".to_string(),
        },
        ProjectBundleStep {
            label: "Draft follow-up email".to_string(),
            status: "pending".to_string(),
        },
        ProjectBundleStep {
            label: "Create Notion follow-up task".to_string(),
            status: "pending".to_string(),
        },
    ]
}

pub fn run_project_bundle(
    config: &GatewayConfig,
    db_path: &Path,
    app_data_dir: &Path,
    command: &str,
) -> Result<(ProjectBundleRecord, String), String> {
    if !config.labs.project_bundle_pilot {
        return Err(
            "Project bundle lab is disabled. Enable gateway.labs.projectBundlePilot first."
                .to_string(),
        );
    }

    let plan = "1) emails 2) meeting prep 3) draft follow-up 4) notion task";
    let _ = super::council_runtime::maybe_run_council_runtime(
        config,
        app_data_dir,
        chrono::Utc::now().timestamp() as u64,
        command,
        plan,
    );

    let run_id = format!("bundle-{}", chrono::Utc::now().timestamp());
    let created_at = chrono::Utc::now().to_rfc3339();
    let bundle_dir = app_data_dir.join("bundles").join(&run_id);
    fs::create_dir_all(&bundle_dir).map_err(|error| error.to_string())?;

    let mut steps = initial_steps();
    let mut record = ProjectBundleRecord {
        run_id: run_id.clone(),
        command: command.to_string(),
        steps: steps.clone(),
        created_at: created_at.clone(),
    };
    write_manifest(&bundle_dir, &record)?;

    // Step 1 — emails
    if config.features.gmail {
        if let Ok(token) = crate::integrations::google::get_session_token("gmail") {
            match crate::integrations::google::gmail::list_unread(&token, 5) {
                Ok(emails) => {
                    let _ = fs::write(
                        bundle_dir.join("emails.json"),
                        serde_json::to_string_pretty(&emails).unwrap_or_else(|_| "[]".into()),
                    );
                    steps[0] = ProjectBundleStep {
                        label: format!("Fetched {} unread email(s)", emails.len()),
                        status: "complete".to_string(),
                    };
                }
                Err(error) => {
                    steps[0] = ProjectBundleStep {
                        label: format!("Email fetch failed: {error}"),
                        status: "failed".to_string(),
                    };
                }
            }
        } else {
            steps[0].status = "skipped".to_string();
            steps[0].label = "Gmail not connected — skipped email fetch".to_string();
        }
    } else {
        steps[0].status = "skipped".to_string();
    }
    record.steps = steps.clone();
    write_manifest(&bundle_dir, &record)?;

    // Step 2 — meeting prep
    let mut meeting_title = "Meeting follow-up".to_string();
    if config.features.memory {
        match crate::memory::meeting::compose_meeting_copilot_v2(
            db_path,
            app_data_dir,
            Some(config),
            None,
            None,
        ) {
            Ok((prep, _enrichment)) => {
                let _ = fs::write(bundle_dir.join("meeting_prep.md"), &prep);
                if let Some(start) = prep.find("Meeting prep for \"") {
                    let rest = &prep[start + 18..];
                    if let Some(end) = rest.find('"') {
                        meeting_title = rest[..end].to_string();
                    }
                }
                steps[1] = ProjectBundleStep {
                    label: "Meeting prep refreshed with calendar + Notion context".to_string(),
                    status: "complete".to_string(),
                };
            }
            Err(error) => {
                steps[1] = ProjectBundleStep {
                    label: format!("Meeting prep failed: {error}"),
                    status: "failed".to_string(),
                };
            }
        }
    } else {
        steps[1].status = "skipped".to_string();
    }
    record.steps = steps.clone();
    write_manifest(&bundle_dir, &record)?;

    // Step 3 — draft follow-up
    let prep_text = fs::read_to_string(bundle_dir.join("meeting_prep.md")).unwrap_or_default();
    let draft = if prep_text.trim().is_empty() {
        format!(
            "Hi,\n\nThank you for meeting about {meeting_title}. Here are the next steps we discussed.\n\nBest,"
        )
    } else {
        let subject = format!("Follow-up: {meeting_title}");
        let snippet = prep_text.lines().take(3).collect::<Vec<_>>().join(" ");
        crate::integrations::google::gmail::format_draft_reply(
            &crate::gateway::models::GmailMessageRecord {
                id: "bundle-draft".into(),
                thread_id: "bundle-thread".into(),
                subject,
                from: "meeting@jarvis.local".into(),
                snippet: snippet.chars().take(120).collect(),
                date: chrono::Utc::now().to_rfc3339(),
                body: prep_text.chars().take(800).collect(),
            },
        )
    };
    let _ = fs::write(bundle_dir.join("followup_draft.md"), &draft);
    steps[2] = ProjectBundleStep {
        label: "Draft follow-up email saved to bundle".to_string(),
        status: "complete".to_string(),
    };
    record.steps = steps.clone();
    write_manifest(&bundle_dir, &record)?;

    // Step 4 — Notion follow-up task
    if config.features.notion {
        let task_title = format!("Follow up: {meeting_title}");
        match crate::integrations::notion::create_followup_task(
            db_path,
            &task_title,
            &draft.chars().take(500).collect::<String>(),
        ) {
            Ok(note) => {
                let rollback = format!(r#"{{"type":"notion","pageId":"{}"}}"#, note.id);
                let _ = audit::append_entry(
                    app_data_dir,
                    AuditRecord {
                        policy_class: GatewayPolicyClass::Write,
                        agent: "labs.bundle",
                        capability_id: "labs.bundle",
                        session_id: "bundle",
                        turn_id: 0,
                        outcome: AuditOutcome::Executed,
                        detail: &task_title,
                        rollback_ref: Some(&rollback),
                    },
                );
                steps[3] = ProjectBundleStep {
                    label: format!("Created Notion task \"{task_title}\""),
                    status: "complete".to_string(),
                };
            }
            Err(error) => {
                steps[3] = ProjectBundleStep {
                    label: format!("Notion task failed: {error}"),
                    status: "failed".to_string(),
                };
            }
        }
    } else {
        steps[3].status = "skipped".to_string();
        steps[3].label = "Notion disabled — skipped follow-up task".to_string();
    }

    record.steps = steps.clone();
    write_manifest(&bundle_dir, &record)?;

    let reply = format!(
        "Project bundle {run_id} completed for: {command}\n{}",
        steps
            .iter()
            .enumerate()
            .map(|(index, step)| format!("{}. {} [{}]", index + 1, step.label, step.status))
            .collect::<Vec<_>>()
            .join("\n")
    );
    Ok((record, reply))
}

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
    match run_project_bundle(config, db_path, app_data_dir, command) {
        Ok((_record, reply)) => (true, reply),
        Err(error) => (false, error),
    }
}

pub fn list_project_bundles(
    app_data_dir: &Path,
    limit: usize,
) -> Result<Vec<ProjectBundleRecord>, String> {
    let bundles_dir = app_data_dir.join("bundles");
    if !bundles_dir.exists() {
        return Ok(Vec::new());
    }

    let mut records = Vec::new();
    let entries = fs::read_dir(&bundles_dir).map_err(|error| error.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry
            .file_type()
            .map_err(|error| error.to_string())?
            .is_dir()
        {
            continue;
        }
        let manifest_path = entry.path().join("manifest.json");
        if !manifest_path.exists() {
            continue;
        }
        let raw = fs::read_to_string(&manifest_path).map_err(|error| error.to_string())?;
        if let Ok(record) = serde_json::from_str::<ProjectBundleRecord>(&raw) {
            records.push(record);
            continue;
        }
        if let Ok(legacy) = serde_json::from_str::<LegacyProjectBundleManifest>(&raw) {
            records.push(legacy.into_record());
        }
    }

    records.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    records.truncate(limit);
    Ok(records)
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacyProjectBundleManifest {
    run_id: String,
    command: String,
    steps: Vec<LegacyProjectBundleStep>,
    created_at: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(untagged)]
enum LegacyProjectBundleStep {
    Text(String),
    Structured(ProjectBundleStep),
}

impl LegacyProjectBundleManifest {
    fn into_record(self) -> ProjectBundleRecord {
        ProjectBundleRecord {
            run_id: self.run_id,
            command: self.command,
            steps: self
                .steps
                .into_iter()
                .map(|step| match step {
                    LegacyProjectBundleStep::Text(label) => ProjectBundleStep {
                        label,
                        status: "complete".to_string(),
                    },
                    LegacyProjectBundleStep::Structured(step) => step,
                })
                .collect(),
            created_at: self
                .created_at
                .unwrap_or_else(|| chrono::Utc::now().to_rfc3339()),
        }
    }
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_app_data() -> std::path::PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        std::env::temp_dir().join(format!("jarvis-bundle-test-{nanos}"))
    }

    #[test]
    fn list_project_bundles_reads_structured_manifest() {
        let app_data = temp_app_data();
        let run_id = "bundle-test-1";
        let bundle_dir = app_data.join("bundles").join(run_id);
        fs::create_dir_all(&bundle_dir).expect("dir");
        let record = ProjectBundleRecord {
            run_id: run_id.to_string(),
            command: "run project bundle".to_string(),
            steps: vec![ProjectBundleStep {
                label: "Fetched 2 unread email(s)".to_string(),
                status: "complete".to_string(),
            }],
            created_at: "2026-06-18T12:00:00Z".to_string(),
        };
        fs::write(
            bundle_dir.join("manifest.json"),
            serde_json::to_string_pretty(&record).expect("json"),
        )
        .expect("write");

        let listed = list_project_bundles(&app_data, 5).expect("list");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].run_id, run_id);
        assert_eq!(listed[0].steps[0].status, "complete");

        let _ = fs::remove_dir_all(&app_data);
    }
}
