use std::path::Path;

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
