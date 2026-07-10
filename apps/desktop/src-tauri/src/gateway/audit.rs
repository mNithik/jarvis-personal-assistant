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
    RolledBack,
}

impl AuditOutcome {
    fn as_str(self) -> &'static str {
        match self {
            AuditOutcome::Executed => "executed",
            AuditOutcome::PendingApproval => "pending_approval",
            AuditOutcome::Denied => "denied",
            AuditOutcome::BlockedSimulation => "blocked_simulation",
            AuditOutcome::RolledBack => "rolled_back",
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
    pub rollback_ref: Option<&'a str>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditEntry {
    pub line_index: usize,
    pub timestamp: String,
    pub policy_class: String,
    pub agent: String,
    pub capability_id: String,
    pub session_id: String,
    pub turn_id: u64,
    pub outcome: String,
    pub detail: String,
    pub rollback_ref: Option<String>,
    pub raw_line: String,
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
    let rollback = record
        .rollback_ref
        .map(|value| format!(" rollback_ref={}", sanitize_field(value)))
        .unwrap_or_default();
    let line = format!(
        "[{stamp}] class={} agent={} capability={} session={} turn={} outcome={} detail={}{rollback}\n",
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
        .and_then(|mut file| {
            file.write_all(line.as_bytes())
                .map_err(|error| error.to_string())
        })
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

fn parse_audit_line(line: &str, line_index: usize) -> Option<AuditEntry> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }
    let timestamp = trimmed
        .trim_start_matches('[')
        .split(']')
        .next()
        .unwrap_or("")
        .to_string();
    let mut policy_class = String::new();
    let mut agent = String::new();
    let mut capability_id = String::new();
    let mut session_id = String::new();
    let mut turn_id = 0_u64;
    let mut outcome = String::new();
    let mut detail = String::new();
    let mut rollback_ref = None;

    for part in trimmed.split_whitespace() {
        if let Some((key, value)) = part.split_once('=') {
            match key {
                "class" => policy_class = value.to_string(),
                "agent" => agent = value.to_string(),
                "capability" => capability_id = value.to_string(),
                "session" => session_id = value.to_string(),
                "turn" => turn_id = value.parse().unwrap_or(0),
                "outcome" => outcome = value.to_string(),
                "detail" => detail = value.to_string(),
                "rollback_ref" => rollback_ref = Some(value.to_string()),
                _ => {}
            }
        }
    }

    Some(AuditEntry {
        line_index,
        timestamp,
        policy_class,
        agent,
        capability_id,
        session_id,
        turn_id,
        outcome,
        detail,
        rollback_ref,
        raw_line: line.to_string(),
    })
}

pub fn search_audit_log(
    app_data_dir: &Path,
    query: Option<&str>,
    policy_class: Option<&str>,
    since: Option<&str>,
    limit: usize,
) -> Result<Vec<AuditEntry>, String> {
    let path = audit_log_path(app_data_dir);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = std::fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let query_lower = query.unwrap_or("").trim().to_lowercase();
    let class_filter = policy_class.unwrap_or("").trim().to_lowercase();
    let since_filter = since.unwrap_or("").trim();

    let mut entries = Vec::new();
    for (index, line) in raw.lines().enumerate() {
        let Some(entry) = parse_audit_line(line, index) else {
            continue;
        };
        if !class_filter.is_empty() && entry.policy_class.to_lowercase() != class_filter {
            continue;
        }
        if !since_filter.is_empty() && entry.timestamp < since_filter.to_string() {
            continue;
        }
        if !query_lower.is_empty()
            && !entry.raw_line.to_lowercase().contains(&query_lower)
            && !entry.detail.to_lowercase().contains(&query_lower)
        {
            continue;
        }
        entries.push(entry);
    }
    if entries.len() > limit {
        entries = entries.split_off(entries.len().saturating_sub(limit));
    }
    Ok(entries)
}

pub fn rollback_audit_entry(
    app_data_dir: &Path,
    db_path: &Path,
    line_index: usize,
) -> Result<String, String> {
    let path = audit_log_path(app_data_dir);
    let raw = std::fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let line = raw
        .lines()
        .nth(line_index)
        .ok_or_else(|| "Audit entry not found.".to_string())?;
    let entry = parse_audit_line(line, line_index)
        .ok_or_else(|| "Could not parse audit entry.".to_string())?;
    let rollback_ref = entry
        .rollback_ref
        .as_deref()
        .ok_or_else(|| "This audit entry does not support rollback.".to_string())?;

    let value: serde_json::Value =
        serde_json::from_str(rollback_ref).map_err(|error| error.to_string())?;
    let kind = value
        .get("type")
        .and_then(|item| item.as_str())
        .unwrap_or("");
    let summary = match kind {
        "notion" => {
            let page_id = value
                .get("pageId")
                .and_then(|item| item.as_str())
                .ok_or_else(|| "Missing Notion page id.".to_string())?;
            crate::integrations::notion::archive_page_by_id(db_path, page_id)?
        }
        "calendar" => {
            let event_id = value
                .get("eventId")
                .and_then(|item| item.as_str())
                .ok_or_else(|| "Missing calendar event id.".to_string())?;
            let token = crate::integrations::google::get_session_token("calendar")?;
            crate::integrations::google::calendar::delete_event(&token, event_id)?
        }
        other => return Err(format!("Unsupported rollback type: {other}")),
    };

    append_entry(
        app_data_dir,
        AuditRecord {
            policy_class: GatewayPolicyClass::Write,
            agent: "audit",
            capability_id: "audit.rollback",
            session_id: &entry.session_id,
            turn_id: entry.turn_id,
            outcome: AuditOutcome::RolledBack,
            detail: &summary,
            rollback_ref: Some(rollback_ref),
        },
    )?;
    Ok(summary)
}

pub fn is_search_audit_command(command: &str) -> bool {
    let normalized = command.trim().to_lowercase();
    normalized.starts_with("search audit")
}

pub fn is_rollback_notion_command(command: &str) -> bool {
    let normalized = command.trim().to_lowercase();
    normalized.contains("rollback") && normalized.contains("notion")
}

fn audit_search_query(command: &str) -> Option<String> {
    let normalized = command.trim().to_lowercase();
    if let Some(rest) = normalized.strip_prefix("search audit log for ") {
        let query = rest.trim();
        if !query.is_empty() {
            return Some(query.to_string());
        }
    }
    if let Some(rest) = normalized.strip_prefix("search audit log") {
        let query = rest.trim().trim_start_matches("for ").trim();
        if !query.is_empty() {
            return Some(query.to_string());
        }
    }
    None
}

pub fn handle_audit_command(
    app_data_dir: &Path,
    db_path: &Path,
    command: &str,
) -> Result<String, String> {
    if is_search_audit_command(command) {
        let results = search_audit_log(
            app_data_dir,
            audit_search_query(command).as_deref(),
            None,
            None,
            10,
        )?;
        if results.is_empty() {
            return Ok("No audit entries matched that search.".to_string());
        }
        let summary = results
            .iter()
            .enumerate()
            .map(|(index, entry)| {
                format!(
                    "{}. [{}] {} — {} ({})",
                    index + 1,
                    entry.policy_class,
                    entry.capability_id,
                    entry.detail.chars().take(80).collect::<String>(),
                    entry.outcome
                )
            })
            .collect::<Vec<_>>()
            .join("\n");
        return Ok(format!("Audit log matches:\n{summary}"));
    }

    if is_rollback_notion_command(command) {
        let entries = search_audit_log(app_data_dir, None, None, None, 500)?;
        let target = entries
            .iter()
            .rev()
            .find(|entry| {
                entry.rollback_ref.as_ref().is_some_and(|value| value.contains("notion"))
            })
            .ok_or_else(|| {
                "No Notion write with rollback support found in the audit log.".to_string()
            })?;
        return rollback_audit_entry(app_data_dir, db_path, target.line_index);
    }

    Err("Unsupported audit command.".to_string())
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
                rollback_ref: None,
            },
        )
        .expect("append");

        let lines = read_recent_entries(&dir, 10).expect("read");
        assert_eq!(lines.len(), 1);
        assert!(lines[0].contains("class=send"));
        assert!(lines[0].contains("outcome=pending_approval"));

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn search_audit_log_filters_by_class() {
        let dir = std::env::temp_dir().join(format!("jarvis-audit-search-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        append_entry(
            &dir,
            AuditRecord {
                policy_class: GatewayPolicyClass::Write,
                agent: "memory",
                capability_id: "memory.planner",
                session_id: "s1",
                turn_id: 1,
                outcome: AuditOutcome::Executed,
                detail: "saved plan",
                rollback_ref: Some(r#"{"type":"notion","pageId":"page-1"}"#),
            },
        )
        .expect("append");
        let results = search_audit_log(&dir, None, Some("write"), None, 10).expect("search");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].policy_class, "write");
        let _ = std::fs::remove_dir_all(dir);
    }
}
