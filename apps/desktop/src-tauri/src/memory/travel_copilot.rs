use std::path::Path;

use crate::gateway::config::GatewayConfig;
use crate::integrations::{google, notion};
use crate::models::TravelMemoryRecord;

use super::travel::list_travel;

pub fn compose_travel_copilot(
    db_path: &Path,
    config: Option<&GatewayConfig>,
) -> Result<String, String> {
    let trips = list_travel(db_path)?;
    let upcoming = trips.first().cloned().unwrap_or(TravelMemoryRecord {
        id: "travel-upcoming".into(),
        title: "Upcoming trip".into(),
        source_email_subject: String::new(),
        transport: None,
        departure: None,
        arrival: None,
        hotel: None,
        check_in: None,
        check_out: None,
        confirmation_code: None,
        calendar_linked_at: None,
        segment_count: 0,
        timeline: vec![],
        checklist: vec![],
        summary: "No saved travel memory yet.".into(),
        created_at: chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string(),
    });

    let mut sections = vec![format!(
        "# Travel copilot: {}\n\n{}",
        upcoming.title, upcoming.summary
    )];

    if config.is_some_and(|value| value.features.calendar) {
        if let Ok(token) = google::get_session_token("calendar") {
            if let Ok(events) = google::calendar::list_today(&token) {
                let travel_events: Vec<_> = events
                    .iter()
                    .filter(|event| {
                        let summary = event.summary.to_lowercase();
                        summary.contains("flight")
                            || summary.contains("hotel")
                            || summary.contains("travel")
                    })
                    .take(5)
                    .map(|event| {
                        format!(
                            "- {} ({})",
                            event.summary,
                            event.start.as_deref().unwrap_or("")
                        )
                    })
                    .collect();
                if !travel_events.is_empty() {
                    sections.push(format!(
                        "## Calendar travel signals\n{}",
                        travel_events.join("\n")
                    ));
                }
            }
        }
    }

    if config.is_some_and(|value| value.features.gmail) {
        if let Ok(token) = google::get_session_token("gmail") {
            let query = format!("subject:({})", upcoming.title.replace('"', ""));
            if let Ok(emails) = google::gmail::search(&token, &query, 3) {
                let lines = emails
                    .iter()
                    .map(|email| format!("- {} ({})", email.subject, email.from))
                    .collect::<Vec<_>>();
                if !lines.is_empty() {
                    sections.push(format!("## Related email\n{}", lines.join("\n")));
                }
            }
        }
    }

    if notion::resolve_credentials(db_path).is_ok() {
        if let Ok(tasks) = notion::list_planner_tasks(db_path) {
            let title_lower = upcoming.title.to_lowercase();
            let related: Vec<_> = tasks
                .iter()
                .filter(|task| task.title.to_lowercase().contains(&title_lower))
                .take(5)
                .map(|task| format!("- {}", task.title))
                .collect();
            if !related.is_empty() {
                sections.push(format!("## Trip tasks\n{}", related.join("\n")));
            }
        }
    }

    if !upcoming.checklist.is_empty() {
        sections.push(format!(
            "## Checklist\n{}",
            upcoming
                .checklist
                .iter()
                .map(|item| format!("- {item}"))
                .collect::<Vec<_>>()
                .join("\n")
        ));
    }

    Ok(sections.join("\n\n"))
}

pub fn is_travel_copilot_command(command: &str) -> bool {
    let normalized = command.trim().to_lowercase();
    matches!(
        normalized.as_str(),
        "prep me for my trip" | "travel copilot" | "refresh travel prep" | "prepare for my trip"
    ) || normalized.starts_with("prep me for trip")
}
