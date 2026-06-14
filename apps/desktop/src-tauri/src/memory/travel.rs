use std::path::Path;

use crate::models::TravelMemoryRecord;

use super::entity_store::{list_entity_metadata, upsert_domain_entity};

const DOMAIN: &str = "travel";

pub fn list_travel(path: &Path) -> Result<Vec<TravelMemoryRecord>, String> {
    Ok(list_entity_metadata(path, DOMAIN)?
        .into_iter()
        .filter_map(|(entity_id, metadata_json)| {
            serde_json::from_str::<TravelMemoryRecord>(&metadata_json)
                .ok()
                .map(|mut record| {
                    record.id = format!("travel-{entity_id}");
                    record
                })
        })
        .collect())
}

pub fn upsert_travel(path: &Path, record: &TravelMemoryRecord) -> Result<(), String> {
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

pub fn import_travel_records(path: &Path, records: &[TravelMemoryRecord]) -> Result<usize, String> {
    for record in records {
        upsert_travel(path, record)?;
    }
    Ok(records.len())
}

pub fn format_travel_summary(path: &Path) -> Result<String, String> {
    let items = list_travel(path)?;
    if items.is_empty() {
        return Ok("You do not have any saved travel summaries yet.".to_string());
    }
    let lines = items
        .iter()
        .take(5)
        .map(|item| {
            format!(
                "{}{}",
                item.title,
                item.departure
                    .as_ref()
                    .map(|value| format!(" - {value}"))
                    .unwrap_or_default()
            )
        })
        .collect::<Vec<_>>();
    Ok(format!(
        "I found {} saved travel item{}:\n{}",
        items.len(),
        if items.len() == 1 { "" } else { "s" },
        lines.join("\n")
    ))
}

pub fn format_travel_checklist(path: &Path) -> Result<String, String> {
    let items = list_travel(path)?;
    let Some(trip) = items.first() else {
        return Ok("There is no saved trip in travel memory yet. Extract travel from an email first.".to_string());
    };
    if trip.checklist.is_empty() {
        return Ok(format!(
            "I found your trip \"{}\", but no travel checklist items are saved yet.",
            trip.title
        ));
    }
    Ok(format!(
        "Travel checklist for \"{}\":\n{}",
        trip.title,
        trip.checklist
            .iter()
            .map(|item| format!("- {item}"))
            .collect::<Vec<_>>()
            .join("\n")
    ))
}

pub fn format_travel_timeline(path: &Path) -> Result<String, String> {
    let items = list_travel(path)?;
    let Some(trip) = items.first() else {
        return Ok("There is no saved trip in travel memory yet. Extract travel from an email first.".to_string());
    };
    if trip.timeline.is_empty() {
        return Ok(format!(
            "I found your trip \"{}\", but no trip timeline cues are saved yet.",
            trip.title
        ));
    }
    Ok(format!(
        "Trip timeline for \"{}\":\n{}",
        trip.title,
        trip.timeline
            .iter()
            .map(|item| format!("- {item}"))
            .collect::<Vec<_>>()
            .join("\n")
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
        std::env::temp_dir().join(format!("jarvis-travel-{nanos}.db"))
    }

    #[test]
    fn travel_upsert_and_list_round_trip() {
        let path = temp_db();
        migrate(&path).expect("migrate");
        let record = TravelMemoryRecord {
            id: "travel-test".into(),
            title: "Trip to NYC".into(),
            source_email_subject: "Flight confirmation".into(),
            transport: Some("Flight".into()),
            departure: Some("JFK".into()),
            arrival: Some("LGA".into()),
            hotel: None,
            check_in: None,
            check_out: None,
            confirmation_code: None,
            calendar_linked_at: None,
            segment_count: 1,
            timeline: vec!["Depart".into()],
            checklist: vec!["Passport".into()],
            summary: "NYC business trip".into(),
            created_at: "2026-01-01T00:00:00Z".into(),
        };
        upsert_travel(&path, &record).expect("upsert");
        let listed = list_travel(&path).expect("list");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].title, "Trip to NYC");
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn travel_checklist_uses_first_saved_trip() {
        let path = temp_db();
        migrate(&path).expect("migrate");
        let record = TravelMemoryRecord {
            id: "travel-test".into(),
            title: "Trip to NYC".into(),
            source_email_subject: "Flight confirmation".into(),
            transport: Some("Flight".into()),
            departure: Some("JFK".into()),
            arrival: Some("LGA".into()),
            hotel: None,
            check_in: None,
            check_out: None,
            confirmation_code: None,
            calendar_linked_at: None,
            segment_count: 1,
            timeline: vec!["Depart".into()],
            checklist: vec!["Passport".into(), "Boarding pass".into()],
            summary: "NYC business trip".into(),
            created_at: "2026-01-01T00:00:00Z".into(),
        };
        upsert_travel(&path, &record).expect("upsert");
        let summary = format_travel_checklist(&path).expect("checklist");
        assert!(summary.contains("Passport"));
        assert!(summary.contains("Trip to NYC"));
        let _ = std::fs::remove_file(path);
    }
}
