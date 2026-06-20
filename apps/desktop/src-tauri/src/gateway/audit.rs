use std::io::Write;
use std::path::Path;

use super::policy::policy_class_label;
use super::types::GatewayPolicyClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AuditOutcome {
    Executed,
    PendingApproval,
    Denied,
    BlockedSimulation,
}

impl AuditOutcome {
    fn as_str(self) -> &'static str {
        match self {
            AuditOutcome::Executed => "executed",
            AuditOutcome::PendingApproval => "pending_approval",
            AuditOutcome::Denied => "denied",
            AuditOutcome::BlockedSimulation => "blocked_simulation",
        }
    }
}

#[derive(Debug, Clone)]
pub struct AuditRecord<'a> {
    pub policy_class: GatewayPolicyClass,
    pub agent: &'a str,
    pub capability_id: &'a str,
    pub session_id: &'a str,
    pub turn_id: u64,
    pub outcome: AuditOutcome,
    pub detail: &'a str,
}

pub fn audit_log_path(app_data_dir: &Path) -> std::path::PathBuf {
    app_data_dir.join("audit.log")
}

pub fn append_entry(app_data_dir: &Path, record: AuditRecord<'_>) -> Result<(), String> {
    let path = audit_log_path(app_data_dir);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let stamp = chrono::Utc::now().to_rfc3339();
    let line = format!(
        "[{stamp}] class={} agent={} capability={} session={} turn={} outcome={} detail={}\n",
        policy_class_label(record.policy_class),
        sanitize_field(record.agent),
        sanitize_field(record.capability_id),
        sanitize_field(record.session_id),
        record.turn_id,
        record.outcome.as_str(),
        sanitize_field(record.detail),
    );

    std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|error| error.to_string())
        .and_then(|mut file| file.write_all(line.as_bytes()).map_err(|error| error.to_string()))
}

pub fn read_recent_entries(app_data_dir: &Path, limit: usize) -> Result<Vec<String>, String> {
    let path = audit_log_path(app_data_dir);
    if !path.exists() {
        return Ok(Vec::new());
    }

    let raw = std::fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let mut lines: Vec<String> = raw.lines().map(str::to_string).collect();
    if lines.len() > limit {
        lines = lines.split_off(lines.len().saturating_sub(limit));
    }
    Ok(lines)
}

fn sanitize_field(value: &str) -> String {
    value.replace('\n', " ").replace('\r', " ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gateway::types::GatewayPolicyClass;

    #[test]
    fn append_and_read_audit_log() {
        let dir = std::env::temp_dir().join(format!("jarvis-audit-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);

        append_entry(
            &dir,
            AuditRecord {
                policy_class: GatewayPolicyClass::Send,
                agent: "integrations",
                capability_id: "integrations.gmail",
                session_id: "session-1",
                turn_id: 7,
                outcome: AuditOutcome::PendingApproval,
                detail: "draft reply ready",
            },
        )
        .expect("append");

        let lines = read_recent_entries(&dir, 10).expect("read");
        assert_eq!(lines.len(), 1);
        assert!(lines[0].contains("class=send"));
        assert!(lines[0].contains("outcome=pending_approval"));

        let _ = std::fs::remove_dir_all(dir);
    }
}
