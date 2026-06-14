use std::path::Path;

use rusqlite::{params, Connection};

use crate::models::PersonMemoryRecord;

use super::triples::upsert_fact;

pub fn list_people(path: &Path) -> Result<Vec<PersonMemoryRecord>, String> {
    super::ensure_schema(path)?;
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT id, label, metadata_json, created_at, updated_at
             FROM memory_entities
             WHERE domain = 'people'
             ORDER BY updated_at DESC",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    rows.into_iter()
        .map(|(entity_id, label, metadata_json, created_at, updated_at)| {
            build_person_record(
                &connection,
                entity_id,
                label,
                metadata_json,
                created_at,
                updated_at,
            )
        })
        .collect()
}

fn build_person_record(
    connection: &Connection,
    entity_id: i64,
    label: String,
    metadata_json: String,
    created_at: String,
    updated_at: String,
) -> Result<PersonMemoryRecord, String> {
    let birthday_label = connection
        .query_row(
            "SELECT object_value FROM memory_facts WHERE entity_id = ?1 AND predicate = 'birthday'",
            params![entity_id],
            |row| row.get::<_, String>(0),
        )
        .unwrap_or_default();

    let metadata: serde_json::Value =
        serde_json::from_str(&metadata_json).unwrap_or_else(|_| serde_json::json!({}));

    Ok(PersonMemoryRecord {
        id: format!("person-{entity_id}"),
        name: label,
        birthday_label: if birthday_label.is_empty() {
            metadata
                .get("birthdayLabel")
                .and_then(|value| value.as_str())
                .unwrap_or("")
                .to_string()
        } else {
            birthday_label
        },
        month: metadata
            .get("month")
            .and_then(|value| value.as_i64())
            .unwrap_or(0) as i32,
        day: metadata
            .get("day")
            .and_then(|value| value.as_i64())
            .unwrap_or(0) as i32,
        age: metadata
            .get("age")
            .and_then(|value| value.as_i64())
            .map(|value| value as i32),
        relationship: metadata
            .get("relationship")
            .and_then(|value| value.as_str())
            .map(str::to_string),
        gift_notes: metadata
            .get("giftNotes")
            .and_then(|value| value.as_array())
            .map(|values| {
                values
                    .iter()
                    .filter_map(|entry| entry.as_str().map(str::to_string))
                    .collect()
            })
            .unwrap_or_default(),
        contact_notes: metadata
            .get("contactNotes")
            .and_then(|value| value.as_array())
            .map(|values| {
                values
                    .iter()
                    .filter_map(|entry| entry.as_str().map(str::to_string))
                    .collect()
            })
            .unwrap_or_default(),
        last_contact_label: metadata
            .get("lastContactLabel")
            .and_then(|value| value.as_str())
            .map(str::to_string),
        follow_up_due_label: metadata
            .get("followUpDueLabel")
            .and_then(|value| value.as_str())
            .map(str::to_string),
        follow_up_reason: metadata
            .get("followUpReason")
            .and_then(|value| value.as_str())
            .map(str::to_string),
        reminder_lead_days: metadata
            .get("reminderLeadDays")
            .and_then(|value| value.as_i64())
            .unwrap_or(7) as i32,
        calendar_linked_at: metadata
            .get("calendarLinkedAt")
            .and_then(|value| value.as_str())
            .map(str::to_string),
        source: metadata
            .get("source")
            .and_then(|value| value.as_str())
            .unwrap_or("manual")
            .to_string(),
        created_at,
        updated_at,
    })
}

pub fn upsert_person(path: &Path, person: &PersonMemoryRecord) -> Result<(), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    let metadata = serde_json::json!({
        "birthdayLabel": person.birthday_label,
        "month": person.month,
        "day": person.day,
        "age": person.age,
        "relationship": person.relationship,
        "giftNotes": person.gift_notes,
        "contactNotes": person.contact_notes,
        "lastContactLabel": person.last_contact_label,
        "followUpDueLabel": person.follow_up_due_label,
        "followUpReason": person.follow_up_reason,
        "reminderLeadDays": person.reminder_lead_days,
        "calendarLinkedAt": person.calendar_linked_at,
        "source": person.source,
    });
    let metadata_json = serde_json::to_string(&metadata).map_err(|error| error.to_string())?;

    let entity_id = if let Ok(existing_id) = connection.query_row(
        "SELECT id FROM memory_entities WHERE domain = 'people' AND lower(label) = lower(?1)",
        params![person.name],
        |row| row.get::<_, i64>(0),
    ) {
        connection
            .execute(
                "UPDATE memory_entities SET metadata_json = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
                params![metadata_json, existing_id],
            )
            .map_err(|error| error.to_string())?;
        existing_id
    } else {
        connection
            .execute(
                "INSERT INTO memory_entities (domain, label, metadata_json) VALUES ('people', ?1, ?2)",
                params![person.name, metadata_json],
            )
            .map_err(|error| error.to_string())?;
        connection.last_insert_rowid()
    };

    if !person.birthday_label.trim().is_empty() {
        upsert_fact(&connection, entity_id, "birthday", &person.birthday_label)?;
    }

    Ok(())
}

pub fn format_people_summary(path: &Path) -> Result<String, String> {
    let people = list_people(path)?;
    if people.is_empty() {
        return Ok("No people are saved in memory yet.".to_string());
    }
    let lines = people
        .iter()
        .take(5)
        .map(|person| {
            if person.birthday_label.trim().is_empty() {
                person.name.clone()
            } else {
                format!("{} ({})", person.name, person.birthday_label)
            }
        })
        .collect::<Vec<_>>();
    Ok(format!(
        "Saved {} {} in memory:\n{}",
        people.len(),
        if people.len() == 1 { "person" } else { "people" },
        lines.join("\n")
    ))
}
