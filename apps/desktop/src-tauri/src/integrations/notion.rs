use std::path::Path;

use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde_json::json;

use crate::db::{get_notion_config, log_action};
use crate::env_local;
use crate::models::NoteRecord;

const NOTION_VERSION: &str = "2022-06-28";

fn notion_client() -> Result<Client, String> {
    Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|error| format!("Failed to initialize Notion client: {error}"))
}

fn notion_headers(token: &str) -> Result<HeaderMap, String> {
    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {token}")).map_err(|error| error.to_string())?,
    );
    headers.insert(
        "Notion-Version",
        HeaderValue::from_str(NOTION_VERSION).map_err(|error| error.to_string())?,
    );
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    Ok(headers)
}

fn extract_notion_title_property(database: &serde_json::Value) -> Result<String, String> {
    database
        .get("properties")
        .and_then(|value| value.as_object())
        .and_then(|properties| {
            properties.iter().find_map(|(name, property)| {
                property
                    .get("type")
                    .and_then(|value| value.as_str())
                    .is_some_and(|kind| kind == "title")
                    .then(|| name.to_string())
            })
        })
        .ok_or_else(|| "Could not find the title property in the Notion database.".to_string())
}

fn extract_notion_title(page: &serde_json::Value, title_property_name: &str) -> String {
    page.get("properties")
        .and_then(|value| value.get(title_property_name))
        .and_then(|value| value.get("title"))
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.get("plain_text").and_then(|value| value.as_str()))
                .collect::<Vec<_>>()
                .join("")
        })
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "Untitled note".to_string())
}

fn extract_notion_plain_text(items: &[serde_json::Value]) -> String {
    items
        .iter()
        .filter_map(|item| item.get("plain_text").and_then(|value| value.as_str()))
        .collect::<Vec<_>>()
        .join("")
}

fn find_notion_property_name(
    database: &serde_json::Value,
    candidates: &[&str],
    supported_types: &[&str],
) -> Option<(String, String)> {
    let properties = database.get("properties")?.as_object()?;
    for candidate in candidates {
        for (name, property) in properties {
            let property_type = property.get("type")?.as_str()?;
            if !supported_types.contains(&property_type) {
                continue;
            }
            if name.eq_ignore_ascii_case(candidate) {
                return Some((name.to_string(), property_type.to_string()));
            }
        }
    }
    for candidate in candidates {
        let normalized_candidate = candidate.to_lowercase();
        for (name, property) in properties {
            let property_type = property.get("type")?.as_str()?;
            if !supported_types.contains(&property_type) {
                continue;
            }
            if name.to_lowercase().contains(&normalized_candidate) {
                return Some((name.to_string(), property_type.to_string()));
            }
        }
    }
    None
}

fn extract_notion_property_display_value(
    page: &serde_json::Value,
    property_name: &str,
    property_type: &str,
) -> Option<String> {
    let property = page.get("properties")?.get(property_name)?;
    let value = match property_type {
        "status" => property
            .get("status")
            .and_then(|value| value.get("name"))
            .and_then(|value| value.as_str())
            .map(|value| value.to_string()),
        "select" => property
            .get("select")
            .and_then(|value| value.get("name"))
            .and_then(|value| value.as_str())
            .map(|value| value.to_string()),
        "date" => property
            .get("date")
            .and_then(|value| value.get("start"))
            .and_then(|value| value.as_str())
            .map(|value| value.to_string()),
        "rich_text" => property
            .get("rich_text")
            .and_then(|value| value.as_array())
            .map(|entries| extract_notion_plain_text(entries)),
        _ => None,
    }?;
    let trimmed = value.trim().to_string();
    (!trimmed.is_empty()).then_some(trimmed)
}

fn map_notion_note_record(
    page: &serde_json::Value,
    title_property_name: &str,
    database: &serde_json::Value,
) -> NoteRecord {
    let title = extract_notion_title(page, title_property_name);
    let url = page
        .get("url")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    let id = page
        .get("id")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    let last_edited_time = page
        .get("last_edited_time")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    let status_property =
        find_notion_property_name(database, &["Status"], &["status", "select", "rich_text"]);
    let due_property = find_notion_property_name(
        database,
        &["Due", "Due Date", "Deadline"],
        &["date", "rich_text"],
    );

    let mut summary_lines = Vec::new();
    if let Some((property_name, property_type)) = status_property {
        if let Some(value) =
            extract_notion_property_display_value(page, &property_name, &property_type)
        {
            summary_lines.push(format!("Status: {value}"));
        }
    }
    if let Some((property_name, property_type)) = due_property {
        if let Some(value) =
            extract_notion_property_display_value(page, &property_name, &property_type)
        {
            summary_lines.push(format!("Due: {value}"));
        }
    }

    let summary = if summary_lines.is_empty() {
        title.clone()
    } else {
        summary_lines.join("\n")
    };

    NoteRecord {
        id,
        summary,
        title,
        url,
        last_edited_time,
    }
}

pub fn resolve_credentials(db_path: &Path) -> Result<(String, String), String> {
    let (mut access_token, database_id) = get_notion_config(db_path)?;
    if access_token
        .as_ref()
        .map(|value| value.trim().is_empty())
        .unwrap_or(true)
    {
        access_token = env_local::provider_api_key("notion");
    }
    let token = access_token
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| {
            "Notion access token is missing. Set it in Notion config or JARVIS_NOTION_TOKEN in .env."
                .to_string()
        })?;
    let db_id = database_id
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Notion database ID is missing.".to_string())?;
    Ok((token, db_id))
}

fn fetch_database(client: &Client, token: &str, db_id: &str) -> Result<serde_json::Value, String> {
    let response = client
        .get(format!("https://api.notion.com/v1/databases/{db_id}"))
        .headers(notion_headers(token)?)
        .send()
        .map_err(|error| format!("Failed to reach Notion: {error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "Notion database lookup failed with {}.",
            response.status()
        ));
    }
    response
        .json()
        .map_err(|error| format!("Failed to parse Notion database metadata: {error}"))
}

pub fn list_notes(db_path: &Path) -> Result<Vec<NoteRecord>, String> {
    let (token, db_id) = resolve_credentials(db_path)?;
    let client = notion_client()?;
    let database_value = fetch_database(&client, &token, &db_id)?;
    let title_property_name = extract_notion_title_property(&database_value)?;
    let query_response = client
        .post(format!("https://api.notion.com/v1/databases/{db_id}/query"))
        .headers(notion_headers(&token)?)
        .json(&json!({
            "page_size": 5,
            "sorts": [{ "timestamp": "last_edited_time", "direction": "descending" }]
        }))
        .send()
        .map_err(|error| format!("Failed to query Notion notes: {error}"))?;
    if !query_response.status().is_success() {
        let status = query_response.status();
        let body = query_response.text().unwrap_or_default();
        return Err(format!("Notion note query failed with {status}: {body}"));
    }
    let query_value: serde_json::Value = query_response
        .json()
        .map_err(|error| format!("Failed to parse Notion note list: {error}"))?;
    Ok(query_value
        .get("results")
        .and_then(|value| value.as_array())
        .map(|results| {
            results
                .iter()
                .map(|page| map_notion_note_record(page, &title_property_name, &database_value))
                .collect()
        })
        .unwrap_or_default())
}

pub fn search_notes(db_path: &Path, query: &str) -> Result<Vec<NoteRecord>, String> {
    let (token, db_id) = resolve_credentials(db_path)?;
    let client = notion_client()?;
    let database_value = fetch_database(&client, &token, &db_id)?;
    let title_property_name = extract_notion_title_property(&database_value)?;
    let query_response = client
        .post(format!("https://api.notion.com/v1/databases/{db_id}/query"))
        .headers(notion_headers(&token)?)
        .json(&json!({
            "page_size": 10,
            "filter": {
                "property": title_property_name,
                "title": { "contains": query.trim() }
            },
            "sorts": [{ "timestamp": "last_edited_time", "direction": "descending" }]
        }))
        .send()
        .map_err(|error| format!("Failed to search Notion notes: {error}"))?;
    if !query_response.status().is_success() {
        let status = query_response.status();
        let body = query_response.text().unwrap_or_default();
        return Err(format!("Notion note search failed with {status}: {body}"));
    }
    let query_value: serde_json::Value = query_response
        .json()
        .map_err(|error| format!("Failed to parse Notion note search: {error}"))?;
    Ok(query_value
        .get("results")
        .and_then(|value| value.as_array())
        .map(|results| {
            results
                .iter()
                .map(|page| map_notion_note_record(page, &title_property_name, &database_value))
                .collect()
        })
        .unwrap_or_default())
}

pub fn create_note(db_path: &Path, content: &str) -> Result<NoteRecord, String> {
    let (token, db_id) = resolve_credentials(db_path)?;
    let client = notion_client()?;
    let database_value = fetch_database(&client, &token, &db_id)?;
    let title_property_name = extract_notion_title_property(&database_value)?;
    let trimmed_content = content.trim();
    let title_text: String = trimmed_content.chars().take(60).collect();
    let mut properties = serde_json::Map::new();
    properties.insert(
        title_property_name.clone(),
        json!({ "title": [{ "text": { "content": title_text } }] }),
    );
    let create_response = client
        .post("https://api.notion.com/v1/pages")
        .headers(notion_headers(&token)?)
        .json(&json!({
            "parent": { "database_id": db_id },
            "properties": properties,
            "children": [{
                "object": "block",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{ "type": "text", "text": { "content": trimmed_content } }]
                }
            }]
        }))
        .send()
        .map_err(|error| format!("Failed to create Notion note: {error}"))?;
    if !create_response.status().is_success() {
        let status = create_response.status();
        let body = create_response.text().unwrap_or_default();
        return Err(format!("Notion note creation failed with {status}: {body}"));
    }
    let page_value: serde_json::Value = create_response
        .json()
        .map_err(|error| format!("Failed to parse Notion note response: {error}"))?;
    let note = map_notion_note_record(&page_value, &title_property_name, &database_value);
    log_action(
        db_path,
        &format!("Make a note {trimmed_content}"),
        "create_notion_note",
        "success",
        &note.url,
    )?;
    Ok(note)
}

pub fn format_notes_reply(notes: &[NoteRecord]) -> String {
    if notes.is_empty() {
        return "You have no Notion notes in the connected database.".to_string();
    }
    let listing = notes
        .iter()
        .map(|note| format!("- {} ({})", note.title, note.url))
        .collect::<Vec<_>>()
        .join("\n");
    format!("Here are your Notion notes:\n{listing}")
}
