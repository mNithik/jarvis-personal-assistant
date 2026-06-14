use std::path::Path;

use crate::models::PackageMemoryRecord;

use super::entity_store::{list_entity_metadata, upsert_domain_entity};

const DOMAIN: &str = "package";

pub fn list_packages(path: &Path) -> Result<Vec<PackageMemoryRecord>, String> {
    Ok(list_entity_metadata(path, DOMAIN)?
        .into_iter()
        .filter_map(|(entity_id, metadata_json)| {
            serde_json::from_str::<PackageMemoryRecord>(&metadata_json)
                .ok()
                .map(|mut record| {
                    record.id = format!("package-{entity_id}");
                    record
                })
        })
        .collect())
}

pub fn list_packages_arriving_tomorrow(path: &Path) -> Result<Vec<PackageMemoryRecord>, String> {
    Ok(list_packages(path)?
        .into_iter()
        .filter(|item| item.arriving_tomorrow)
        .collect())
}

pub fn list_delayed_packages(path: &Path) -> Result<Vec<PackageMemoryRecord>, String> {
    Ok(list_packages(path)?
        .into_iter()
        .filter(|item| {
            item.status
                .as_deref()
                .map(|value| value.to_lowercase().contains("delayed"))
                .unwrap_or(false)
        })
        .collect())
}

pub fn upsert_package(path: &Path, record: &PackageMemoryRecord) -> Result<(), String> {
    let metadata_json = serde_json::to_string(record).map_err(|error| error.to_string())?;
    let mut facts: Vec<(&str, &str)> = Vec::new();
    if let Some(status) = record.status.as_deref() {
        facts.push(("status", status));
    }
    if let Some(delivery_date) = record.delivery_date.as_deref() {
        facts.push(("delivery_date", delivery_date));
    }
    if let Some(tracking_number) = record.tracking_number.as_deref() {
        facts.push(("tracking_number", tracking_number));
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

pub fn import_package_records(path: &Path, records: &[PackageMemoryRecord]) -> Result<usize, String> {
    for record in records {
        upsert_package(path, record)?;
    }
    Ok(records.len())
}

pub fn format_package_summary(path: &Path) -> Result<String, String> {
    let items = list_packages(path)?;
    if items.is_empty() {
        return Ok("You do not have any saved package summaries yet.".to_string());
    }
    let lines = items
        .iter()
        .take(5)
        .map(|item| {
            format!(
                "{}{}",
                item.title,
                item.status
                    .as_ref()
                    .map(|value| format!(" - {value}"))
                    .unwrap_or_default()
            )
        })
        .collect::<Vec<_>>();
    Ok(format!(
        "I found {} saved package item{}:\n{}",
        items.len(),
        if items.len() == 1 { "" } else { "s" },
        lines.join("\n")
    ))
}

pub fn format_arriving_tomorrow_summary(path: &Path) -> Result<String, String> {
    let items = list_packages_arriving_tomorrow(path)?;
    if items.is_empty() {
        return Ok("Nothing is marked as arriving tomorrow in package memory.".to_string());
    }
    let lines = items
        .iter()
        .map(|item| item.title.clone())
        .collect::<Vec<_>>();
    Ok(format!(
        "{} package{} arriving tomorrow:\n{}",
        items.len(),
        if items.len() == 1 { "" } else { "s" },
        lines.join("\n")
    ))
}

pub fn format_delayed_package_summary(path: &Path) -> Result<String, String> {
    let items = list_delayed_packages(path)?;
    if items.is_empty() {
        return Ok("You do not have any delayed packages saved in memory.".to_string());
    }
    let lines = items
        .iter()
        .map(|item| item.title.clone())
        .collect::<Vec<_>>();
    Ok(format!(
        "{} delayed package{}:\n{}",
        items.len(),
        if items.len() == 1 { "" } else { "s" },
        lines.join("\n")
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
        std::env::temp_dir().join(format!("jarvis-package-{nanos}.db"))
    }

    #[test]
    fn arriving_tomorrow_filter() {
        let path = temp_db();
        migrate(&path).expect("migrate");
        upsert_package(
            &path,
            &PackageMemoryRecord {
                id: "package-1".into(),
                title: "Headphones".into(),
                source_email_subject: "Shipping update".into(),
                carrier: Some("UPS".into()),
                merchant: Some("Amazon".into()),
                item_label: Some("Headphones".into()),
                status: Some("In transit".into()),
                delivery_date: Some("2026-06-01".into()),
                tracking_number: Some("1Z999".into()),
                status_history: vec![],
                arriving_today: false,
                arriving_tomorrow: true,
                summary: "Headphones arriving tomorrow".into(),
                created_at: "2026-05-31T00:00:00Z".into(),
                updated_at: "2026-05-31T00:00:00Z".into(),
            },
        )
        .expect("upsert");
        let tomorrow = list_packages_arriving_tomorrow(&path).expect("list");
        assert_eq!(tomorrow.len(), 1);
        assert_eq!(tomorrow[0].title, "Headphones");
        let _ = std::fs::remove_file(path);
    }
}
