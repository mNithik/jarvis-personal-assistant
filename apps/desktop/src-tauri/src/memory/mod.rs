pub mod brief;
pub mod cag;
pub mod controls;
pub mod day_plan_store;
pub mod embed;
pub mod entity_store;
pub mod expense;
pub mod knowledge_router;
pub mod meeting;
pub mod package;
pub mod people;
pub mod planner;
pub mod recall;
pub mod schema;
pub mod school;
pub mod topic_graph;
pub mod travel;
pub mod travel_copilot;
pub mod triples;
pub mod vault;
pub mod world_model;

use std::path::Path;

use rusqlite::{params, Connection};

use crate::models::{
    ExpenseMemoryRecord, MeetingPrepMemoryRecord, PackageMemoryRecord, PersonMemoryRecord,
    SchoolPlanMemoryRecord, TravelMemoryRecord,
};

use self::expense::{
    format_expense_summary, format_monthly_expense_summary, format_recurring_expense_summary,
    format_weekly_expense_summary,
};
use self::meeting::format_meeting_prep_summary;
use self::package::{
    format_arriving_tomorrow_summary, format_delayed_package_summary, format_package_summary,
};
use self::people::{format_people_summary, upsert_person};
use self::recall::{recall, store_chunk_with_embedding};
use self::schema::migrate;
use self::school::format_school_plan_summary;
use self::travel::{format_travel_checklist, format_travel_summary, format_travel_timeline};
use self::triples::{lookup_birthday, lookup_entity_fact};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MemoryAction {
    Remember { content: String },
    RecallBirthday { query: String },
    ListPeople,
    ListTravel,
    ListExpenses,
    ListRecurringExpenses,
    ListPackages,
    ListPackagesArrivingTomorrow,
    ListDelayedPackages,
    ListMeetingPrep,
    MeetingCopilot,
    ListSchoolPlans,
    CreateDailyBrief,
    ListWeeklyExpenses,
    ListMonthlyExpenses,
    ListMonthlyExpensesByCategory { category: String },
    ShowTravelChecklist,
    ShowTravelTimeline,
    Recall { query: String },
}

pub fn ensure_schema(path: &Path) -> Result<(), String> {
    migrate(path)
}

pub fn parse_memory_command(command: &str) -> Option<MemoryAction> {
    let trimmed = command.trim();
    let normalized = trimmed.to_lowercase();

    if matches!(
        normalized.as_str(),
        "show my people memory"
            | "show people memory"
            | "list people memory"
            | "who is in my people memory"
    ) {
        return Some(MemoryAction::ListPeople);
    }

    if matches!(
        normalized.as_str(),
        "show travel memory" | "list travel memory" | "show my travel plans"
    ) {
        return Some(MemoryAction::ListTravel);
    }

    if matches!(
        normalized.as_str(),
        "show expense memory" | "list expense memory" | "show my expenses"
    ) {
        return Some(MemoryAction::ListExpenses);
    }

    if matches!(
        normalized.as_str(),
        "show subscriptions"
            | "show recurring expenses"
            | "list subscriptions"
            | "list recurring expenses"
    ) {
        return Some(MemoryAction::ListRecurringExpenses);
    }

    if matches!(
        normalized.as_str(),
        "show package memory" | "list package memory" | "show my packages"
    ) {
        return Some(MemoryAction::ListPackages);
    }

    if normalized == "what's arriving tomorrow" || normalized == "what is arriving tomorrow" {
        return Some(MemoryAction::ListPackagesArrivingTomorrow);
    }

    if normalized == "show delayed packages" || normalized == "list delayed packages" {
        return Some(MemoryAction::ListDelayedPackages);
    }

    if matches!(
        normalized.as_str(),
        "prep for my next meeting"
            | "prep me for my next meeting"
            | "prepare me for my next meeting"
            | "refresh meeting prep"
    ) {
        return Some(MemoryAction::MeetingCopilot);
    }

    if matches!(
        normalized.as_str(),
        "show meeting prep memory" | "list meeting prep memory" | "show meeting prep"
    ) {
        return Some(MemoryAction::ListMeetingPrep);
    }

    if (normalized.contains("standup") || normalized.contains("next meeting"))
        && (normalized.contains("need") || normalized.contains("prep"))
    {
        return Some(MemoryAction::MeetingCopilot);
    }

    if matches!(
        normalized.as_str(),
        "show school memory" | "list school memory" | "show school plans"
    ) {
        return Some(MemoryAction::ListSchoolPlans);
    }

    if matches!(
        normalized.as_str(),
        "create daily brief"
            | "make my daily brief"
            | "save daily brief to notion"
            | "generate daily brief"
            | "brief me for today"
            | "morning brief"
    ) {
        return Some(MemoryAction::CreateDailyBrief);
    }

    if matches!(
        normalized.as_str(),
        "show weekly expenses" | "list weekly expenses" | "what did i spend this week"
    ) {
        return Some(MemoryAction::ListWeeklyExpenses);
    }

    if matches!(
        normalized.as_str(),
        "show monthly expenses" | "list monthly expenses" | "what did i spend this month"
    ) {
        return Some(MemoryAction::ListMonthlyExpenses);
    }

    if normalized.starts_with("how much did i spend on ") {
        let category = trimmed["how much did i spend on ".len()..]
            .trim()
            .trim_end_matches('?')
            .trim()
            .strip_suffix(" this month")
            .unwrap_or(
                trimmed["how much did i spend on ".len()..]
                    .trim()
                    .trim_end_matches('?'),
            )
            .trim()
            .to_string();
        if !category.is_empty() {
            return Some(MemoryAction::ListMonthlyExpensesByCategory { category });
        }
    }

    if matches!(
        normalized.as_str(),
        "show travel checklist" | "what do i need for this trip" | "what do i need for this travel"
    ) {
        return Some(MemoryAction::ShowTravelChecklist);
    }

    if matches!(
        normalized.as_str(),
        "show trip timeline" | "show travel timeline" | "what is the trip timeline"
    ) {
        return Some(MemoryAction::ShowTravelTimeline);
    }

    for prefix in [
        "remember that ",
        "remember ",
        "save that ",
        "please remember that ",
    ] {
        if normalized.starts_with(prefix) {
            let content = trimmed[prefix.len()..].trim();
            if !content.is_empty() {
                return Some(MemoryAction::Remember {
                    content: content.to_string(),
                });
            }
        }
    }

    if normalized.contains("birthday") {
        let query = normalized
            .replace("when is ", "")
            .replace("'s birthday", "")
            .replace(" birthday", "")
            .replace('?', "")
            .trim()
            .to_string();
        if !query.is_empty() {
            return Some(MemoryAction::RecallBirthday { query });
        }
    }

    if normalized.starts_with("recall ") {
        let query = trimmed["recall ".len()..].trim();
        if !query.is_empty() {
            return Some(MemoryAction::Recall {
                query: query.to_string(),
            });
        }
    }

    if normalized.contains("remember") || normalized.contains("preference") {
        return Some(MemoryAction::Recall {
            query: trimmed.to_string(),
        });
    }

    None
}

pub fn is_memory_command(command: &str) -> bool {
    if parse_memory_command(command).is_some() {
        return true;
    }
    let n = command.trim().to_lowercase();
    n.contains("birthday")
        || n.contains("people memory")
        || n.contains("travel memory")
        || n.contains("travel plans")
        || n.contains("expense memory")
        || n.contains("my expenses")
        || n.contains("recurring expenses")
        || n.contains("package memory")
        || n.contains("my packages")
        || n.contains("arriving tomorrow")
        || n.contains("delayed packages")
        || n.contains("meeting prep")
        || n.contains("next meeting")
        || n.contains("prep for")
        || n.contains("standup")
        || n.contains("school memory")
        || n.contains("school plans")
        || n.starts_with("remember ")
        || n.contains("daily brief")
        || n.contains("weekly expenses")
        || n.contains("monthly expenses")
        || n.contains("travel checklist")
        || n.contains("trip timeline")
        || n.contains("travel timeline")
        || n.starts_with("how much did i spend on ")
}

pub fn remember(path: &Path, content: &str, domain: &str) -> Result<String, String> {
    ensure_schema(path)?;
    let profile_id = crate::gateway::profiles::active_profile_id_or_default(path)?;
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO memory_documents (profile_id, domain, source, content) VALUES (?1, ?2, 'manual', ?3)",
            params![profile_id, domain, content],
        )
        .map_err(|error| error.to_string())?;
    let document_id = connection.last_insert_rowid();
    store_chunk_with_embedding(&connection, path, document_id, None, domain, content)?;
    Ok(format!("Remembered: {content}"))
}

pub fn recall_text(path: &Path, query: &str) -> Result<String, String> {
    ensure_schema(path)?;

    if let Some(reply) = lookup_birthday(path, query)? {
        return Ok(reply);
    }

    if let Some(reply) = lookup_entity_fact(path, query, "preference")? {
        return Ok(reply);
    }

    let hits = recall(path, query, 3)?;
    if hits.is_empty() {
        return Ok(format!(
            "I could not find anything in memory about \"{query}\"."
        ));
    }

    Ok(hits
        .iter()
        .map(|hit| hit.text.clone())
        .collect::<Vec<_>>()
        .join("\n"))
}

pub fn run_memory_action(path: &Path, command: &str) -> Result<String, String> {
    ensure_schema(path)?;
    let action = parse_memory_command(command).unwrap_or(MemoryAction::Recall {
        query: command.to_string(),
    });

    match action {
        MemoryAction::Remember { content } => remember(path, &content, "general"),
        MemoryAction::RecallBirthday { query } => recall_text(path, &query),
        MemoryAction::ListPeople => format_people_summary(path),
        MemoryAction::ListTravel => format_travel_summary(path),
        MemoryAction::ListExpenses => format_expense_summary(path),
        MemoryAction::ListRecurringExpenses => format_recurring_expense_summary(path),
        MemoryAction::ListPackages => format_package_summary(path),
        MemoryAction::ListPackagesArrivingTomorrow => format_arriving_tomorrow_summary(path),
        MemoryAction::ListDelayedPackages => format_delayed_package_summary(path),
        MemoryAction::ListMeetingPrep => format_meeting_prep_summary(path),
        MemoryAction::MeetingCopilot => meeting::compose_meeting_copilot_reply(path, None, None),
        MemoryAction::ListSchoolPlans => format_school_plan_summary(path),
        MemoryAction::CreateDailyBrief => {
            Err("Daily brief requires a desktop handoff.".to_string())
        }
        MemoryAction::ListWeeklyExpenses => format_weekly_expense_summary(path),
        MemoryAction::ListMonthlyExpenses => format_monthly_expense_summary(path),
        MemoryAction::ListMonthlyExpensesByCategory { category } => {
            expense::format_monthly_expense_summary_by_category(path, &category)
        }
        MemoryAction::ShowTravelChecklist => format_travel_checklist(path),
        MemoryAction::ShowTravelTimeline => format_travel_timeline(path),
        MemoryAction::Recall { query } => recall_text(path, &query),
    }
}

pub fn import_people_records(path: &Path, records: &[PersonMemoryRecord]) -> Result<usize, String> {
    ensure_schema(path)?;
    for person in records {
        upsert_person(path, person)?;
    }
    Ok(records.len())
}

pub fn import_travel_records(path: &Path, records: &[TravelMemoryRecord]) -> Result<usize, String> {
    travel::import_travel_records(path, records)
}

pub fn import_expense_records(
    path: &Path,
    records: &[ExpenseMemoryRecord],
) -> Result<usize, String> {
    expense::import_expense_records(path, records)
}

pub fn import_package_records(
    path: &Path,
    records: &[PackageMemoryRecord],
) -> Result<usize, String> {
    package::import_package_records(path, records)
}

pub fn import_meeting_prep_records(
    path: &Path,
    records: &[MeetingPrepMemoryRecord],
) -> Result<usize, String> {
    meeting::import_meeting_prep_records(path, records)
}

pub fn import_school_plan_records(
    path: &Path,
    records: &[SchoolPlanMemoryRecord],
) -> Result<usize, String> {
    school::import_school_plan_records(path, records)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_db() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        std::env::temp_dir().join(format!("jarvis-memory-mod-{nanos}.db"))
    }

    #[test]
    fn remember_and_recall_round_trip() {
        let path = temp_db();
        remember(&path, "Alice prefers jasmine tea", "general").expect("remember");
        let reply = recall_text(&path, "Alice tea preference").expect("recall");
        assert!(reply.to_lowercase().contains("alice"));
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn parses_birthday_query() {
        assert!(matches!(
            parse_memory_command("when is mom's birthday"),
            Some(MemoryAction::RecallBirthday { .. })
        ));
    }

    #[test]
    fn parses_travel_list_query() {
        assert!(matches!(
            parse_memory_command("show my travel plans"),
            Some(MemoryAction::ListTravel)
        ));
    }

    #[test]
    fn parses_recurring_expenses_query() {
        assert!(matches!(
            parse_memory_command("list recurring expenses"),
            Some(MemoryAction::ListRecurringExpenses)
        ));
    }

    #[test]
    fn parses_daily_brief_command() {
        assert!(matches!(
            parse_memory_command("create daily brief"),
            Some(MemoryAction::CreateDailyBrief)
        ));
    }

    #[test]
    fn parses_weekly_expenses_query() {
        assert!(matches!(
            parse_memory_command("show weekly expenses"),
            Some(MemoryAction::ListWeeklyExpenses)
        ));
    }

    #[test]
    fn parses_travel_checklist_query() {
        assert!(matches!(
            parse_memory_command("show travel checklist"),
            Some(MemoryAction::ShowTravelChecklist)
        ));
    }
}
