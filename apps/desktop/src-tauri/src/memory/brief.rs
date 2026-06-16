use std::path::Path;

use crate::gateway::config::GatewayConfig;

use super::{
    expense, knowledge_router, meeting, package, school, travel, MemoryAction,
};

pub fn compose_daily_brief_v2(
    db_path: &Path,
    app_data_dir: Option<&Path>,
    config: Option<&GatewayConfig>,
) -> Result<String, String> {
    let mut sections = Vec::new();

    sections.push("Daily brief".to_string());

    if let Ok(text) = expense::format_weekly_expense_summary(db_path) {
        if !text.trim().is_empty() && !text.contains("No expense") {
            sections.push(format!("Expenses this week:\n{text}"));
        }
    }

    if let Ok(text) = package::format_arriving_tomorrow_summary(db_path) {
        if !text.trim().is_empty() && !text.contains("No package") {
            sections.push(format!("Packages arriving tomorrow:\n{text}"));
        }
    }

    if let Ok(text) = meeting::format_meeting_prep_summary(db_path) {
        if !text.trim().is_empty() && !text.contains("No meeting") {
            sections.push(format!("Meeting prep:\n{text}"));
        }
    }

    if let Ok(text) = school::format_school_plan_summary(db_path) {
        if !text.trim().is_empty() && !text.contains("No school") {
            sections.push(format!("School plans:\n{text}"));
        }
    }

    if let Ok(text) = travel::format_travel_summary(db_path) {
        if !text.trim().is_empty() && !text.contains("No travel") {
            sections.push(format!("Travel:\n{text}"));
        }
    }

    let knowledge = knowledge_router::recall_context_with_config(
        db_path,
        app_data_dir,
        config,
        "search vault for today priorities",
        3,
    );
    if !knowledge.snippets.is_empty() {
        sections.push(format!("Notes & vault:\n{}", knowledge.summary));
    }

    if config.is_some_and(|value| value.features.calendar) {
        sections.push(
            "Calendar: enable Gmail/Calendar bridge for live events (hybrid handoff).".to_string(),
        );
    }

    if sections.len() <= 1 {
        sections.push("No memory records yet. Add expenses, packages, or notes to enrich your brief.".to_string());
    }

    Ok(sections.join("\n\n"))
}

pub fn is_daily_brief_command(command: &str) -> bool {
    matches!(
        super::parse_memory_command(command),
        Some(MemoryAction::CreateDailyBrief)
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    #[test]
    fn compose_brief_returns_sections() {
        let db_path = std::env::temp_dir().join(format!(
            "jarvis-brief-v2-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        db::init_database(&db_path).expect("init");
        let brief = compose_daily_brief_v2(&db_path, None, None).expect("brief");
        assert!(brief.contains("Daily brief"));
        let _ = std::fs::remove_file(db_path);
    }
}
