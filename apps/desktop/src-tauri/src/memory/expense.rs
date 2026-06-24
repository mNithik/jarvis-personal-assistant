use std::path::Path;

use chrono::{Datelike, Local, NaiveDate};

use crate::models::ExpenseMemoryRecord;

use super::entity_store::{list_entity_metadata, upsert_domain_entity};

const DOMAIN: &str = "expense";

pub fn list_expenses(path: &Path) -> Result<Vec<ExpenseMemoryRecord>, String> {
    Ok(list_entity_metadata(path, DOMAIN)?
        .into_iter()
        .filter_map(|(entity_id, metadata_json)| {
            serde_json::from_str::<ExpenseMemoryRecord>(&metadata_json)
                .ok()
                .map(|mut record| {
                    record.id = format!("expense-{entity_id}");
                    record
                })
        })
        .collect())
}

pub fn list_recurring_expenses(path: &Path) -> Result<Vec<ExpenseMemoryRecord>, String> {
    Ok(list_expenses(path)?
        .into_iter()
        .filter(|item| item.recurring_likely)
        .collect())
}

pub fn upsert_expense(path: &Path, record: &ExpenseMemoryRecord) -> Result<(), String> {
    let metadata_json = serde_json::to_string(record).map_err(|error| error.to_string())?;
    let mut facts: Vec<(&str, &str)> = Vec::new();
    if let Some(amount) = record.amount.as_deref() {
        facts.push(("amount", amount));
    }
    if let Some(category) = record.category.as_deref() {
        facts.push(("category", category));
    }
    if let Some(expense_date) = record.expense_date.as_deref() {
        facts.push(("expense_date", expense_date));
    }
    upsert_domain_entity(
        path,
        DOMAIN,
        &record.title,
        &metadata_json,
        &record.summary,
        &facts,
    )?;
    Ok(())
}

pub fn import_expense_records(
    path: &Path,
    records: &[ExpenseMemoryRecord],
) -> Result<usize, String> {
    for record in records {
        upsert_expense(path, record)?;
    }
    Ok(records.len())
}

pub fn format_expense_summary(path: &Path) -> Result<String, String> {
    let items = list_expenses(path)?;
    if items.is_empty() {
        return Ok("You do not have any saved expense summaries yet.".to_string());
    }
    let lines = items
        .iter()
        .take(5)
        .map(|item| {
            format!(
                "{}{}{}",
                item.title,
                item.amount
                    .as_ref()
                    .map(|value| format!(" - {value}"))
                    .unwrap_or_default(),
                item.category
                    .as_ref()
                    .map(|value| format!(" [{value}]"))
                    .unwrap_or_default()
            )
        })
        .collect::<Vec<_>>();
    Ok(format!(
        "I found {} saved expense item{}:\n{}",
        items.len(),
        if items.len() == 1 { "" } else { "s" },
        lines.join("\n")
    ))
}

pub fn format_recurring_expense_summary(path: &Path) -> Result<String, String> {
    let items = list_recurring_expenses(path)?;
    if items.is_empty() {
        return Ok("You do not have any likely recurring charges saved yet.".to_string());
    }
    let lines = items
        .iter()
        .take(5)
        .map(|item| {
            format!(
                "{}{}",
                item.title,
                item.amount
                    .as_ref()
                    .map(|value| format!(" - {value}"))
                    .unwrap_or_default()
            )
        })
        .collect::<Vec<_>>();
    Ok(format!(
        "I found {} likely recurring charge{}:\n{}",
        items.len(),
        if items.len() == 1 { "" } else { "s" },
        lines.join("\n")
    ))
}

fn parse_expense_date(text: &str) -> Option<NaiveDate> {
    let trimmed = text.trim();
    NaiveDate::parse_from_str(&trimmed[..trimmed.len().min(10)], "%Y-%m-%d").ok()
}

fn filter_expenses_since(
    path: &Path,
    start: NaiveDate,
) -> Result<Vec<ExpenseMemoryRecord>, String> {
    Ok(list_expenses(path)?
        .into_iter()
        .filter(|item| {
            item.expense_date
                .as_deref()
                .and_then(parse_expense_date)
                .is_some_and(|date| date >= start)
        })
        .collect())
}

fn format_filtered_expense_summary(items: &[ExpenseMemoryRecord], window_label: &str) -> String {
    if items.is_empty() {
        return format!("You do not have any saved expenses for {window_label}.");
    }
    let total = items
        .iter()
        .filter_map(|item| item.amount_value)
        .sum::<f64>();
    let lines = items
        .iter()
        .take(8)
        .map(|item| {
            format!(
                "{}{}{}",
                item.title,
                item.amount
                    .as_ref()
                    .map(|value| format!(" - {value}"))
                    .unwrap_or_default(),
                item.category
                    .as_ref()
                    .map(|value| format!(" [{value}]"))
                    .unwrap_or_default()
            )
        })
        .collect::<Vec<_>>();
    format!(
        "I found {} expense item{} for {window_label}{}:\n{}",
        items.len(),
        if items.len() == 1 { "" } else { "s" },
        if total > 0.0 {
            format!(" (total ${total:.2})")
        } else {
            String::new()
        },
        lines.join("\n")
    )
}

pub fn format_weekly_expense_summary(path: &Path) -> Result<String, String> {
    let today = Local::now().date_naive();
    let start = today - chrono::Duration::days(6);
    let items = filter_expenses_since(path, start)?;
    Ok(format_filtered_expense_summary(&items, "the past week"))
}

pub fn format_monthly_expense_summary(path: &Path) -> Result<String, String> {
    let today = Local::now().date_naive();
    let start = NaiveDate::from_ymd_opt(today.year(), today.month(), 1)
        .ok_or_else(|| "Could not compute the start of the month.".to_string())?;
    let items = filter_expenses_since(path, start)?;
    Ok(format_filtered_expense_summary(&items, "this month"))
}

pub fn format_monthly_expense_summary_by_category(
    path: &Path,
    category: &str,
) -> Result<String, String> {
    let today = Local::now().date_naive();
    let start = NaiveDate::from_ymd_opt(today.year(), today.month(), 1)
        .ok_or_else(|| "Could not compute the start of the month.".to_string())?;
    let normalized_category = category.trim().to_lowercase();
    let items = filter_expenses_since(path, start)?
        .into_iter()
        .filter(|item| {
            item.category.as_deref().unwrap_or_default().to_lowercase() == normalized_category
        })
        .collect::<Vec<_>>();
    Ok(format_filtered_expense_summary(
        &items,
        &format!("this month in {category}"),
    ))
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
        std::env::temp_dir().join(format!("jarvis-expense-{nanos}.db"))
    }

    #[test]
    fn recurring_expense_filter() {
        let path = temp_db();
        migrate(&path).expect("migrate");
        upsert_expense(
            &path,
            &ExpenseMemoryRecord {
                id: "expense-1".into(),
                title: "Netflix".into(),
                source_email_subject: "Receipt".into(),
                merchant: Some("Netflix".into()),
                amount: Some("$15".into()),
                amount_value: Some(15.0),
                category: Some("subscription".into()),
                expense_date: Some("2026-01-15".into()),
                order_number: None,
                recurring_likely: true,
                summary: "Monthly Netflix".into(),
                created_at: "2026-01-15T00:00:00Z".into(),
            },
        )
        .expect("upsert");
        upsert_expense(
            &path,
            &ExpenseMemoryRecord {
                id: "expense-2".into(),
                title: "Coffee".into(),
                source_email_subject: "Receipt".into(),
                merchant: Some("Cafe".into()),
                amount: Some("$5".into()),
                amount_value: Some(5.0),
                category: Some("food".into()),
                expense_date: Some("2026-01-16".into()),
                order_number: None,
                recurring_likely: false,
                summary: "One-time coffee".into(),
                created_at: "2026-01-16T00:00:00Z".into(),
            },
        )
        .expect("upsert");
        let recurring = list_recurring_expenses(&path).expect("list");
        assert_eq!(recurring.len(), 1);
        assert_eq!(recurring[0].title, "Netflix");
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn weekly_expense_filter_uses_date_window() {
        let path = temp_db();
        migrate(&path).expect("migrate");
        let today = chrono::Local::now().date_naive();
        let recent = today.format("%Y-%m-%d").to_string();
        let old = (today - chrono::Duration::days(10))
            .format("%Y-%m-%d")
            .to_string();
        upsert_expense(
            &path,
            &ExpenseMemoryRecord {
                id: "expense-recent".into(),
                title: "Recent lunch".into(),
                source_email_subject: "Receipt".into(),
                merchant: Some("Cafe".into()),
                amount: Some("$12".into()),
                amount_value: Some(12.0),
                category: Some("food".into()),
                expense_date: Some(recent),
                order_number: None,
                recurring_likely: false,
                summary: "Recent".into(),
                created_at: "2026-01-16T00:00:00Z".into(),
            },
        )
        .expect("upsert");
        upsert_expense(
            &path,
            &ExpenseMemoryRecord {
                id: "expense-old".into(),
                title: "Old lunch".into(),
                source_email_subject: "Receipt".into(),
                merchant: Some("Cafe".into()),
                amount: Some("$8".into()),
                amount_value: Some(8.0),
                category: Some("food".into()),
                expense_date: Some(old),
                order_number: None,
                recurring_likely: false,
                summary: "Old".into(),
                created_at: "2026-01-01T00:00:00Z".into(),
            },
        )
        .expect("upsert");
        let summary = format_weekly_expense_summary(&path).expect("weekly");
        assert!(summary.contains("Recent lunch"));
        assert!(!summary.contains("Old lunch"));
        let _ = std::fs::remove_file(path);
    }
}
