use std::path::Path;

use crate::gateway::config::GatewayConfig;
use crate::integrations::{google, notion};
use crate::memory::knowledge_router;
use crate::models::MeetingPrepMemoryRecord;

use super::entity_store::{list_entity_metadata, upsert_domain_entity};

const DOMAIN: &str = "meeting_prep";

pub fn list_meeting_prep(path: &Path) -> Result<Vec<MeetingPrepMemoryRecord>, String> {
    Ok(list_entity_metadata(path, DOMAIN)?
        .into_iter()
        .filter_map(|(entity_id, metadata_json)| {
            serde_json::from_str::<MeetingPrepMemoryRecord>(&metadata_json)
                .ok()
                .map(|mut record| {
                    record.id = format!("meeting-{entity_id}");
                    record
                })
        })
        .collect())
}

pub fn upsert_meeting_prep(path: &Path, record: &MeetingPrepMemoryRecord) -> Result<(), String> {
    let metadata_json = serde_json::to_string(record).map_err(|error| error.to_string())?;
    upsert_domain_entity(
        path,
        DOMAIN,
        &record.event_title,
        &metadata_json,
        &record.summary,
        &[],
    )?;
    Ok(())
}

pub fn import_meeting_prep_records(
    path: &Path,
    records: &[MeetingPrepMemoryRecord],
) -> Result<usize, String> {
    for record in records {
        upsert_meeting_prep(path, record)?;
    }
    Ok(records.len())
}

pub fn format_meeting_prep_summary(path: &Path) -> Result<String, String> {
    let items = list_meeting_prep(path)?;
    if items.is_empty() {
        return Ok("You do not have any saved meeting prep summaries yet.".to_string());
    }
    let lines = items
        .iter()
        .take(5)
        .map(|item| item.event_title.clone())
        .collect::<Vec<_>>();
    Ok(format!(
        "I found {} saved meeting prep item{}:\n{}",
        items.len(),
        if items.len() == 1 { "" } else { "s" },
        lines.join("\n")
    ))
}

fn format_event_start_label(start: Option<&str>) -> String {
    let Some(raw) = start else {
        return "soon".to_string();
    };
    chrono::DateTime::parse_from_rfc3339(raw)
        .map(|timestamp| timestamp.format("%I:%M %p").to_string())
        .unwrap_or_else(|_| raw.to_string())
}

pub fn compose_meeting_copilot_reply(
    path: &Path,
    next_event_summary: Option<&str>,
    next_event_start: Option<&str>,
) -> Result<String, String> {
    let items = list_meeting_prep(path)?;

    if let Some(summary) = next_event_summary {
        let summary_lower = summary.to_lowercase();
        if let Some(item) = items.iter().find(|entry| {
            let title = entry.event_title.to_lowercase();
            title.contains(&summary_lower) || summary_lower.contains(&title)
        }) {
            let actions = if item.action_items.is_empty() {
                "No action items saved.".to_string()
            } else {
                item.action_items
                    .iter()
                    .map(|action| format!("- {action}"))
                    .collect::<Vec<_>>()
                    .join("\n")
            };
            return Ok(format!(
                "Meeting prep for \"{}\":\nFocus: {}\nAction items:\n{}",
                item.event_title, item.focus_summary, actions
            ));
        }

        return Ok(format!(
            "\"{}\" starts at {} — you do not have saved prep for it yet. Say \"show meeting prep\" to review saved items.",
            summary,
            format_event_start_label(next_event_start)
        ));
    }

    format_meeting_prep_summary(path)
}

#[derive(Debug, Clone, Default)]
pub struct MeetingCopilotEnrichment {
    pub related_email_count: usize,
    pub related_task_count: usize,
    pub vault_snippet_count: usize,
}

pub fn compose_meeting_copilot_v2(
    path: &Path,
    app_data_dir: &Path,
    config: Option<&GatewayConfig>,
    next_event_summary: Option<&str>,
    next_event_start: Option<&str>,
) -> Result<(String, MeetingCopilotEnrichment), String> {
    let event_title = next_event_summary
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("Upcoming meeting")
        .to_string();

    let mut enrichment = MeetingCopilotEnrichment::default();
    let mut email_lines = Vec::new();
    let mut task_lines = Vec::new();
    let mut vault_lines = Vec::new();

    if config.is_some_and(|value| value.features.gmail) {
        if let Ok(token) = google::get_session_token("gmail") {
            let query = format!("subject:({})", event_title.replace('"', ""));
            if let Ok(emails) = google::gmail::search(&token, &query, 5) {
                enrichment.related_email_count = emails.len();
                email_lines = emails
                    .iter()
                    .take(3)
                    .map(|email| format!("- {} ({})", email.subject, email.from))
                    .collect();
            }
        }
    }

    if notion::resolve_credentials(path).is_ok() {
        if let Ok(tasks) = notion::list_planner_tasks(path) {
            let title_lower = event_title.to_lowercase();
            let related: Vec<_> = tasks
                .iter()
                .filter(|task| {
                    let task_title = task.title.to_lowercase();
                    task_title.contains(&title_lower)
                        || title_lower
                            .split_whitespace()
                            .any(|word| word.len() > 3 && task_title.contains(word))
                })
                .take(5)
                .collect();
            enrichment.related_task_count = related.len();
            task_lines = related
                .iter()
                .map(|task| {
                    let due = task
                        .due
                        .as_deref()
                        .map(|value| format!(" (due {value})"))
                        .unwrap_or_default();
                    format!("- {}{}", task.title, due)
                })
                .collect();
        }
    }

    if let Some(config) = config {
        let knowledge = knowledge_router::recall_context_with_config(
            path,
            Some(app_data_dir),
            Some(config),
            &event_title,
            3,
        );
        enrichment.vault_snippet_count = knowledge.snippets.len();
        vault_lines = knowledge
            .snippets
            .iter()
            .take(3)
            .map(|snippet| format!("- {}", snippet.text.trim()))
            .collect();
    }

    let previous = list_meeting_prep(path)?;
    let changes = previous
        .iter()
        .find(|entry| {
            let title = entry.event_title.to_lowercase();
            let current = event_title.to_lowercase();
            title.contains(&current) || current.contains(&title)
        })
        .and_then(|entry| {
            if enrichment.related_email_count > 0 || enrichment.related_task_count > 0 {
                Some(format!(
                    "New context since last prep: {} email(s), {} related task(s).",
                    enrichment.related_email_count, enrichment.related_task_count
                ))
            } else {
                entry.changes_since_last_prep.clone()
            }
        });

    let focus_summary = if email_lines.is_empty() && task_lines.is_empty() {
        format!("Review agenda and open loops for \"{event_title}\".")
    } else {
        format!(
            "Focus on \"{event_title}\" with {} related email(s) and {} open task(s).",
            enrichment.related_email_count, enrichment.related_task_count
        )
    };

    let mut action_items = task_lines
        .iter()
        .map(|line| line.trim_start_matches("- ").to_string())
        .collect::<Vec<_>>();
    if action_items.is_empty() {
        action_items.push(format!("Confirm agenda for {event_title}"));
    }

    let email_section = if email_lines.is_empty() {
        "Related email: none matched.".to_string()
    } else {
        format!("Related email:\n{}", email_lines.join("\n"))
    };
    let task_section = if task_lines.is_empty() {
        "Related Notion tasks: none matched.".to_string()
    } else {
        format!("Related Notion tasks:\n{}", task_lines.join("\n"))
    };
    let vault_section = if vault_lines.is_empty() {
        "Memory / vault: no extra snippets.".to_string()
    } else {
        format!("Memory / vault:\n{}", vault_lines.join("\n"))
    };

    let reply = format!(
        "Meeting prep for \"{event_title}\" (starts {}):\n\nFocus: {focus_summary}\n\n{email_section}\n\n{task_section}\n\n{vault_section}\n\nSuggested action items:\n{}",
        format_event_start_label(next_event_start),
        action_items
            .iter()
            .map(|item| format!("- {item}"))
            .collect::<Vec<_>>()
            .join("\n")
    );

    let record = MeetingPrepMemoryRecord {
        id: format!("meeting-{}", event_title.to_lowercase().replace(' ', "-")),
        event_title: event_title.clone(),
        summary_title: format!("Prep: {event_title}"),
        focus_summary: focus_summary.clone(),
        action_items: action_items.clone(),
        related_people: Vec::new(),
        changes_since_last_prep: changes,
        summary: reply.clone(),
        created_at: chrono::Local::now()
            .format("%Y-%m-%dT%H:%M:%S")
            .to_string(),
    };
    upsert_meeting_prep(path, &record)?;

    Ok((reply, enrichment))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::memory::schema::migrate;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_db() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        std::env::temp_dir().join(format!("jarvis-meeting-{nanos}.db"))
    }

    #[test]
    fn meeting_prep_round_trip() {
        let path = temp_db();
        migrate(&path).expect("migrate");
        upsert_meeting_prep(
            &path,
            &MeetingPrepMemoryRecord {
                id: "meeting-1".into(),
                event_title: "Standup".into(),
                summary_title: "Daily standup prep".into(),
                focus_summary: "Review blockers".into(),
                action_items: vec!["Ask about API".into()],
                related_people: vec!["Alice".into()],
                changes_since_last_prep: None,
                summary: "Standup prep notes".into(),
                created_at: "2026-01-01T00:00:00Z".into(),
            },
        )
        .expect("upsert");
        let listed = list_meeting_prep(&path).expect("list");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].event_title, "Standup");
        let _ = std::fs::remove_file(path);
    }
}
