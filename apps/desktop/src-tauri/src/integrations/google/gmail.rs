use base64::engine::general_purpose::URL_SAFE;
use base64::Engine as _;
use serde_json::Value;

use crate::gateway::models::GmailMessageRecord;

use super::client;

const GMAIL_API_BASE: &str = "https://gmail.googleapis.com/gmail/v1";

fn percent_encode(input: &str) -> String {
    let mut encoded = String::new();
    for byte in input.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    encoded
}

pub fn list_unread(token: &str, max_results: u32) -> Result<Vec<GmailMessageRecord>, String> {
    let path = format!(
        "{GMAIL_API_BASE}/users/me/messages?labelIds=INBOX&maxResults={max_results}&q={}",
        percent_encode("is:unread")
    );
    let response = client::api_get(token, &path)?;
    let messages = message_refs(&response);
    if messages.is_empty() {
        return Ok(Vec::new());
    }
    hydrate_messages(token, &messages)
}

pub fn search(
    token: &str,
    query: &str,
    max_results: u32,
) -> Result<Vec<GmailMessageRecord>, String> {
    let path = format!(
        "{GMAIL_API_BASE}/users/me/messages?maxResults={max_results}&q={}",
        percent_encode(query.trim())
    );
    let response = client::api_get(token, &path)?;
    let messages = message_refs(&response);
    if messages.is_empty() {
        return Ok(Vec::new());
    }
    hydrate_messages(token, &messages)
}

fn message_refs(response: &Value) -> Vec<(String, String)> {
    response
        .get("messages")
        .and_then(|value| value.as_array())
        .map(|messages| {
            messages
                .iter()
                .filter_map(|message| {
                    let id = message.get("id")?.as_str()?;
                    let thread_id = message
                        .get("threadId")
                        .and_then(|value| value.as_str())
                        .unwrap_or(id)
                        .to_string();
                    Some((id.to_string(), thread_id))
                })
                .collect()
        })
        .unwrap_or_default()
}

fn hydrate_messages(
    token: &str,
    messages: &[(String, String)],
) -> Result<Vec<GmailMessageRecord>, String> {
    messages
        .iter()
        .map(|(id, thread_id)| {
            let path = format!("{GMAIL_API_BASE}/users/me/messages/{id}?format=full");
            let response = client::api_get(token, &path)?;
            map_message_record(&response, thread_id)
        })
        .collect()
}

pub fn map_message_record(message: &Value, thread_id: &str) -> Result<GmailMessageRecord, String> {
    let id = message
        .get("id")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    let subject = get_header(message, "Subject").unwrap_or_else(|| "(no subject)".to_string());
    let from = get_header(message, "From").unwrap_or_else(|| "Unknown sender".to_string());
    let snippet = message
        .get("snippet")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    let date = format_internal_date(message.get("internalDate").and_then(|value| value.as_str()));
    let body = extract_plain_text_from_part(message.get("payload"));

    Ok(GmailMessageRecord {
        id,
        thread_id: message
            .get("threadId")
            .and_then(|value| value.as_str())
            .unwrap_or(thread_id)
            .to_string(),
        subject,
        from,
        snippet,
        date,
        body,
    })
}

fn get_header(message: &Value, header_name: &str) -> Option<String> {
    let normalized = header_name.to_lowercase();
    message
        .get("payload")
        .and_then(|payload| payload.get("headers"))
        .and_then(|headers| headers.as_array())
        .and_then(|headers| {
            headers.iter().find_map(|header| {
                let name = header.get("name")?.as_str()?.to_lowercase();
                if name == normalized {
                    header.get("value")?.as_str().map(|value| value.to_string())
                } else {
                    None
                }
            })
        })
}

fn format_internal_date(value: Option<&str>) -> String {
    let Some(raw) = value else {
        return String::new();
    };
    let Ok(millis) = raw.parse::<i64>() else {
        return String::new();
    };
    chrono::DateTime::from_timestamp_millis(millis)
        .map(|timestamp| timestamp.format("%Y-%m-%d %H:%M").to_string())
        .unwrap_or_default()
}

fn decode_base64_url(value: &str) -> String {
    let normalized = value.replace('-', "+").replace('_', "/");
    let padding = (4 - normalized.len() % 4) % 4;
    let padded = format!("{normalized}{}", "=".repeat(padding));
    URL_SAFE
        .decode(padded)
        .ok()
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .unwrap_or_default()
}

fn extract_plain_text_from_part(part: Option<&Value>) -> String {
    let Some(part) = part else {
        return String::new();
    };

    if part.get("mimeType").and_then(|value| value.as_str()) == Some("text/plain") {
        if let Some(data) = part
            .get("body")
            .and_then(|body| body.get("data"))
            .and_then(|value| value.as_str())
        {
            return decode_base64_url(data).trim().to_string();
        }
    }

    if let Some(children) = part.get("parts").and_then(|value| value.as_array()) {
        for child in children {
            let child_text = extract_plain_text_from_part(Some(child));
            if !child_text.is_empty() {
                return child_text;
            }
        }
    }

    part.get("body")
        .and_then(|body| body.get("data"))
        .and_then(|value| value.as_str())
        .map(decode_base64_url)
        .map(|value| value.trim().to_string())
        .unwrap_or_default()
}

pub fn format_unread_reply(emails: &[GmailMessageRecord]) -> String {
    if emails.is_empty() {
        return "I checked Gmail, but there are no unread emails right now.".to_string();
    }
    let summary = emails
        .iter()
        .map(|email| {
            format!(
                "{}. {} — {}",
                email_list_index(emails, email),
                email.subject,
                email.from
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    format!(
        "I found {} unread emails in Gmail.\n{summary}",
        emails.len()
    )
}

pub fn format_search_reply(query: &str, emails: &[GmailMessageRecord]) -> String {
    if emails.is_empty() {
        return format!("I did not find any Gmail messages matching {query}.");
    }
    let summary = emails
        .iter()
        .map(|email| {
            format!(
                "{}. {} — {}",
                email_list_index(emails, email),
                email.subject,
                email.from
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    format!(
        "I found {} Gmail messages matching {query}.\n{summary}",
        emails.len()
    )
}

pub fn format_email_for_notion(email: &GmailMessageRecord) -> String {
    let body = email.body.trim();
    let mut lines = vec![
        format!("Email: {}", email.subject),
        String::new(),
        format!("From: {}", email.from),
    ];
    if !email.date.is_empty() {
        lines.push(format!("Date: {}", email.date));
    }
    lines.push(String::new());
    if body.is_empty() {
        lines.push(if email.snippet.trim().is_empty() {
            "No preview available.".to_string()
        } else {
            email.snippet.clone()
        });
    } else {
        lines.push(email.body.chars().take(4000).collect::<String>());
    }
    lines
        .into_iter()
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn format_read_reply(email: &GmailMessageRecord) -> String {
    let body = if email.body.trim().is_empty() {
        email.snippet.clone()
    } else {
        email.body.clone()
    };
    format!(
        "Alright, here is the email about {}.\nSubject: {}\nFrom: {}\n{}\n\n{}",
        email.subject,
        email.subject,
        email.from,
        if email.date.is_empty() {
            String::new()
        } else {
            format!("Date: {}", email.date)
        },
        if body.trim().is_empty() {
            "No email body was available.".to_string()
        } else {
            body
        }
    )
}

pub fn format_triage_reply(emails: &[GmailMessageRecord]) -> String {
    if emails.is_empty() {
        return "Your inbox looks clear — no unread emails to triage.".to_string();
    }

    let summary = emails
        .iter()
        .enumerate()
        .map(|(index, email)| {
            let urgency = triage_urgency(&email.subject, &email.snippet);
            format!(
                "{}. [{}] {} — from {}",
                index + 1,
                urgency,
                email.subject,
                email.from
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    format!(
        "Inbox triage — {} unread email(s):\n{summary}\n\nSay \"draft a reply to email 1\" to draft a response.",
        emails.len()
    )
}

pub fn format_draft_reply(email: &GmailMessageRecord) -> String {
    format!(
        "Draft reply for \"{subject}\" (from {from}):\n\nHi,\n\nThank you for your email about {subject}. I will follow up shortly.\n\nBest,\n\n---\nThis draft was not sent. Confirm before sending.",
        subject = email.subject,
        from = email.from
    )
}

pub fn is_urgent_email(email: &GmailMessageRecord) -> bool {
    triage_urgency(&email.subject, &email.snippet) == "urgent"
}

fn triage_urgency(subject: &str, snippet: &str) -> &'static str {
    let combined = format!("{subject} {snippet}").to_lowercase();
    if contains_any(
        &combined,
        &[
            "urgent",
            "asap",
            "action required",
            "overdue",
            "final notice",
        ],
    ) {
        "urgent"
    } else if contains_any(
        &combined,
        &["invoice", "payment", "billing", "receipt", "deadline"],
    ) {
        "action"
    } else {
        "normal"
    }
}

fn contains_any(text: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| text.contains(needle))
}

fn email_list_index(emails: &[GmailMessageRecord], target: &GmailMessageRecord) -> usize {
    emails
        .iter()
        .position(|email| email.id == target.id)
        .map(|index| index + 1)
        .unwrap_or(1)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    use crate::integrations::google::auth;
    use crate::integrations::google::client;

    const LIST_FIXTURE: &str = r#"{
      "messages": [
        { "id": "msg-1", "threadId": "thread-1" },
        { "id": "msg-2", "threadId": "thread-2" }
      ]
    }"#;

    const MESSAGE_FIXTURE: &str = r#"{
      "id": "msg-1",
      "threadId": "thread-1",
      "snippet": "Invoice attached",
      "internalDate": "1718380800000",
      "payload": {
        "mimeType": "text/plain",
        "headers": [
          { "name": "Subject", "value": "Invoice due" },
          { "name": "From", "value": "billing@example.com" }
        ],
        "body": { "data": "SW52b2ljZSBib2R5" }
      }
    }"#;

    #[test]
    fn map_message_record_decodes_headers_and_body() {
        let message: Value = serde_json::from_str(MESSAGE_FIXTURE).expect("fixture");
        let record = map_message_record(&message, "thread-1").expect("record");
        assert_eq!(record.subject, "Invoice due");
        assert_eq!(record.from, "billing@example.com");
        assert_eq!(record.body, "Invoice body");
    }

    #[test]
    fn list_unread_uses_mock_responses_without_live_google() {
        client::set_mock_responses(HashMap::from([
            (
                format!("GET {GMAIL_API_BASE}/users/me/messages?labelIds=INBOX&maxResults=5&q=is%3Aunread"),
                LIST_FIXTURE.to_string(),
            ),
            (
                format!("GET {GMAIL_API_BASE}/users/me/messages/msg-1?format=full"),
                MESSAGE_FIXTURE.to_string(),
            ),
            (
                format!("GET {GMAIL_API_BASE}/users/me/messages/msg-2?format=full"),
                MESSAGE_FIXTURE
                    .replace("msg-1", "msg-2")
                    .replace("Invoice due", "Flight confirmation"),
            ),
        ]));

        let emails = list_unread("test-token", 5).expect("emails");
        assert_eq!(emails.len(), 2);
        assert_eq!(emails[0].subject, "Invoice due");

        client::clear_mock_responses();
        let _ = auth::clear_test_tokens();
    }

    #[test]
    fn format_unread_reply_lists_messages() {
        let emails = vec![GmailMessageRecord {
            id: "1".into(),
            thread_id: "t1".into(),
            subject: "Hello".into(),
            from: "a@example.com".into(),
            snippet: String::new(),
            date: String::new(),
            body: String::new(),
        }];
        let reply = format_unread_reply(&emails);
        assert!(reply.contains("1 unread emails"));
        assert!(reply.contains("Hello"));
    }
}
