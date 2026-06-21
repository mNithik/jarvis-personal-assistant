use std::path::Path;

use chrono::Local;

use crate::gateway::config::GatewayConfig;
use crate::integrations::google;
use crate::integrations::notion::{self, NotionPlannerTask};
use crate::memory::{brief, day_plan_store};
use crate::models::DayPlanRecord;

pub fn is_plan_command(command: &str) -> bool {
    let normalized = command.trim().to_lowercase();
    matches!(
        normalized.as_str(),
        "plan my day"
            | "morning plan"
            | "create daily brief"
            | "make my daily brief"
            | "morning brief"
            | "save daily brief to notion"
    ) || normalized.starts_with("plan my day")
}

pub fn is_replan_command(command: &str) -> bool {
    let normalized = command.trim().to_lowercase();
    matches!(
        normalized.as_str(),
        "replan my day"
            | "adjust my plan"
            | "something came up"
            | "replan day"
    ) || normalized.starts_with("replan my day")
}

pub fn is_save_plan_command(command: &str) -> bool {
    let normalized = command.trim().to_lowercase();
    matches!(
        normalized.as_str(),
        "save plan to notion" | "save day plan to notion" | "save daily brief to notion"
    )
}

fn today_plan_date() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

fn now_timestamp() -> String {
    Local::now().format("%Y-%m-%dT%H:%M:%S").to_string()
}

fn is_done_status(status: Option<&str>) -> bool {
    status
        .map(|value| {
            let lower = value.to_lowercase();
            matches!(
                lower.as_str(),
                "done" | "complete" | "completed" | "closed" | "cancelled"
            )
        })
        .unwrap_or(false)
}

fn parse_due_date(value: &str) -> Option<chrono::NaiveDate> {
    if value.len() >= 10 {
        chrono::NaiveDate::parse_from_str(&value[..10], "%Y-%m-%d").ok()
    } else {
        chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d").ok()
    }
}

fn rank_tasks(tasks: &[NotionPlannerTask], today: chrono::NaiveDate) -> Vec<NotionPlannerTask> {
    let mut ranked = tasks
        .iter()
        .filter(|task| !task.is_done && !is_done_status(task.status.as_deref()))
        .cloned()
        .collect::<Vec<_>>();
    ranked.sort_by(|left, right| {
        let left_score = task_priority_score(left, today);
        let right_score = task_priority_score(right, today);
        right_score.cmp(&left_score).then_with(|| left.title.cmp(&right.title))
    });
    ranked
}

fn task_priority_score(task: &NotionPlannerTask, today: chrono::NaiveDate) -> i32 {
    let mut score = 0;
    if let Some(due) = task.due.as_deref().and_then(parse_due_date) {
        if due < today {
            score += 100;
        } else if due == today {
            score += 80;
        } else if due <= today + chrono::Duration::days(1) {
            score += 40;
        }
    }
    if task
        .status
        .as_deref()
        .is_some_and(|value| value.to_lowercase().contains("progress"))
    {
        score += 20;
    }
    score
}

fn build_top_three(tasks: &[NotionPlannerTask], today: chrono::NaiveDate) -> Vec<String> {
    rank_tasks(tasks, today)
        .into_iter()
        .take(3)
        .map(|task| {
            if let Some(due) = task.due.as_deref() {
                format!("{} (due {due})", task.title)
            } else {
                task.title
            }
        })
        .collect()
}

fn format_task_section(tasks: &[NotionPlannerTask], today: chrono::NaiveDate) -> String {
    let ranked = rank_tasks(tasks, today);
    if ranked.is_empty() {
        return "Notion tasks: none open for today.".to_string();
    }
    let lines = ranked
        .iter()
        .take(10)
        .map(|task| {
            let due = task
                .due
                .as_deref()
                .map(|value| format!(" due {value}"))
                .unwrap_or_default();
            let status = task
                .status
                .as_deref()
                .map(|value| format!(" [{value}]"))
                .unwrap_or_default();
            format!("- {}{}{}", task.title, due, status)
        })
        .collect::<Vec<_>>()
        .join("\n");
    format!("Notion tasks:\n{lines}")
}

fn format_calendar_section(config: Option<&GatewayConfig>, token: Option<&str>) -> String {
    let Some(token) = token else {
        if config.is_some_and(|value| value.features.calendar) {
            return "Calendar: connect Google Calendar in Settings to include live events.".to_string();
        }
        return "Calendar: disabled in gateway settings.".to_string();
    };
    match google::calendar::list_today(token) {
        Ok(events) => google::calendar::format_today_reply(&events),
        Err(error) => format!("Calendar: could not load today's events ({error})."),
    }
}

fn build_suggested_actions(tasks: &[NotionPlannerTask], today: chrono::NaiveDate) -> Vec<String> {
    let mut actions = Vec::new();
    for task in rank_tasks(tasks, today).into_iter().take(3) {
        if task
            .due
            .as_deref()
            .and_then(parse_due_date)
            .is_some_and(|due| due < today)
        {
            actions.push(format!("Move overdue task \"{}\" to tomorrow", task.title));
        }
    }
    if actions.is_empty() {
        actions.push("Review Top 3 and complete the smallest task first.".to_string());
    }
    actions
}

pub fn compose_morning_plan(
    db_path: &Path,
    app_data_dir: &Path,
    config: Option<&GatewayConfig>,
) -> Result<DayPlanRecord, String> {
    notion::resolve_credentials(db_path)?;
    let today = today_plan_date();
    let today_date = chrono::NaiveDate::parse_from_str(&today, "%Y-%m-%d")
        .map_err(|error| error.to_string())?;

    let memory_snapshot =
        brief::compose_daily_brief_v2(db_path, Some(app_data_dir), config)?;
    let tasks = notion::list_planner_tasks(db_path)?;
    let calendar_token = if config.is_some_and(|value| value.features.calendar) {
        google::get_session_token("calendar").ok()
    } else {
        None
    };
    let calendar_section = format_calendar_section(config, calendar_token.as_deref());
    let task_section = format_task_section(&tasks, today_date);
    let top_three = build_top_three(&tasks, today_date);
    let suggested_actions = build_suggested_actions(&tasks, today_date);

    let top_three_section = if top_three.is_empty() {
        "Top 3: add tasks in Notion to populate priorities.".to_string()
    } else {
        format!(
            "Top 3 priorities:\n{}",
            top_three
                .iter()
                .enumerate()
                .map(|(index, item)| format!("{}. {item}", index + 1))
                .collect::<Vec<_>>()
                .join("\n")
        )
    };

    let full_plan_text = format!(
        "# Day plan for {today}\n\n{top_three_section}\n\n{calendar_section}\n\n{task_section}\n\n## Memory snapshot\n\n{memory_snapshot}"
    );

    let timestamp = now_timestamp();
    let record = DayPlanRecord {
        plan_date: today.clone(),
        top_three,
        full_plan_text,
        notion_page_id: day_plan_store::get_day_plan(db_path, &today)?
            .and_then(|plan| plan.notion_page_id),
        suggested_actions,
        created_at: timestamp.clone(),
        updated_at: timestamp,
    };
    day_plan_store::upsert_day_plan(db_path, &record)?;
    Ok(record)
}

pub fn replan_day(
    db_path: &Path,
    app_data_dir: &Path,
    config: Option<&GatewayConfig>,
) -> Result<DayPlanRecord, String> {
    let baseline = compose_morning_plan(db_path, app_data_dir, config)?;
    let today_date = chrono::NaiveDate::parse_from_str(&baseline.plan_date, "%Y-%m-%d")
        .map_err(|error| error.to_string())?;
    let tasks = notion::list_planner_tasks(db_path)?;
    let revised_top_three = build_top_three(&tasks, today_date);
    let mut suggested_actions = build_suggested_actions(&tasks, today_date);
    suggested_actions.insert(
        0,
        "Calendar or tasks changed — review the revised Top 3.".to_string(),
    );

    let replan_note = if revised_top_three == baseline.top_three {
        "\n\nReplan note: priorities are unchanged; keep executing the current Top 3.".to_string()
    } else {
        "\n\nReplan note: priorities were refreshed based on the latest calendar and Notion tasks."
            .to_string()
    };

    let timestamp = now_timestamp();
    let record = DayPlanRecord {
        plan_date: baseline.plan_date,
        top_three: revised_top_three,
        full_plan_text: format!("{}{}", baseline.full_plan_text, replan_note),
        notion_page_id: baseline.notion_page_id,
        suggested_actions,
        created_at: baseline.created_at,
        updated_at: timestamp,
    };
    day_plan_store::upsert_day_plan(db_path, &record)?;
    Ok(record)
}

pub fn save_day_plan_to_notion(db_path: &Path) -> Result<DayPlanRecord, String> {
    let today = today_plan_date();
    let mut plan = day_plan_store::get_day_plan(db_path, &today)?
        .ok_or_else(|| "No day plan exists yet. Run \"plan my day\" first.".to_string())?;
    let note = notion::create_plan_page(db_path, &plan.plan_date, &plan.full_plan_text)?;
    plan.notion_page_id = Some(note.id);
    plan.updated_at = now_timestamp();
    day_plan_store::upsert_day_plan(db_path, &plan)?;
    Ok(plan)
}

pub fn format_day_plan_reply(plan: &DayPlanRecord) -> String {
    plan.full_plan_text.clone()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_plan_and_replan_commands() {
        assert!(is_plan_command("plan my day"));
        assert!(is_replan_command("replan my day"));
        assert!(!is_replan_command("plan my day"));
    }

    #[test]
    fn ranks_overdue_tasks_higher() {
        let today = chrono::NaiveDate::from_ymd_opt(2026, 6, 18).expect("date");
        let tasks = vec![
            NotionPlannerTask {
                id: "1".into(),
                title: "Future".into(),
                due: Some("2026-06-20".into()),
                status: None,
                is_done: false,
            },
            NotionPlannerTask {
                id: "2".into(),
                title: "Overdue".into(),
                due: Some("2026-06-10".into()),
                status: None,
                is_done: false,
            },
        ];
        let top = build_top_three(&tasks, today);
        assert_eq!(top.first().map(String::as_str), Some("Overdue (due 2026-06-10)"));
    }
}
