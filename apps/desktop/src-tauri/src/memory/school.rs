use std::path::Path;

use crate::models::SchoolPlanMemoryRecord;

use super::entity_store::{list_entity_metadata, upsert_domain_entity};

const DOMAIN: &str = "school";

pub fn list_school_plans(path: &Path) -> Result<Vec<SchoolPlanMemoryRecord>, String> {
    Ok(list_entity_metadata(path, DOMAIN)?
        .into_iter()
        .filter_map(|(entity_id, metadata_json)| {
            serde_json::from_str::<SchoolPlanMemoryRecord>(&metadata_json)
                .ok()
                .map(|mut record| {
                    record.id = format!("school-{entity_id}");
                    record
                })
        })
        .collect())
}

pub fn upsert_school_plan(path: &Path, record: &SchoolPlanMemoryRecord) -> Result<(), String> {
    let metadata_json = serde_json::to_string(record).map_err(|error| error.to_string())?;
    upsert_domain_entity(
        path,
        DOMAIN,
        &record.title,
        &metadata_json,
        &record.summary,
        &[],
    )?;
    Ok(())
}

pub fn import_school_plan_records(
    path: &Path,
    records: &[SchoolPlanMemoryRecord],
) -> Result<usize, String> {
    for record in records {
        upsert_school_plan(path, record)?;
    }
    Ok(records.len())
}

pub fn format_school_plan_summary(path: &Path) -> Result<String, String> {
    let items = list_school_plans(path)?;
    if items.is_empty() {
        return Ok("You do not have any saved school plans yet.".to_string());
    }
    let lines = items
        .iter()
        .take(5)
        .map(|item| item.title.clone())
        .collect::<Vec<_>>();
    Ok(format!(
        "I found {} saved school plan{}:\n{}",
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
        std::env::temp_dir().join(format!("jarvis-school-{nanos}.db"))
    }

    #[test]
    fn school_plan_round_trip() {
        let path = temp_db();
        migrate(&path).expect("migrate");
        upsert_school_plan(
            &path,
            &SchoolPlanMemoryRecord {
                id: "school-1".into(),
                title: "Week plan".into(),
                focus_summary: "Focus on calculus".into(),
                subjects: vec!["Math".into()],
                sessions: vec!["Mon 2h".into()],
                assignments: vec!["Problem set 3".into()],
                exam_countdowns: vec!["Final in 14 days".into()],
                summary: "Weekly school plan".into(),
                created_at: "2026-01-01T00:00:00Z".into(),
            },
        )
        .expect("upsert");
        let listed = list_school_plans(&path).expect("list");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].title, "Week plan");
        let _ = std::fs::remove_file(path);
    }
}
