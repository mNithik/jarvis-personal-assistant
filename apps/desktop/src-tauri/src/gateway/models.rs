use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GmailMessageRecord {
    pub id: String,
    pub thread_id: String,
    pub subject: String,
    pub from: String,
    pub snippet: String,
    pub date: String,
    pub body: String,
}

static SESSION_EMAILS: OnceLock<Mutex<HashMap<String, Vec<GmailMessageRecord>>>> = OnceLock::new();

fn session_emails() -> &'static Mutex<HashMap<String, Vec<GmailMessageRecord>>> {
    SESSION_EMAILS.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn store_session_emails(session_id: &str, emails: Vec<GmailMessageRecord>) {
    if let Ok(mut sessions) = session_emails().lock() {
        sessions.insert(session_id.to_string(), emails);
    }
}

pub fn get_session_emails(session_id: &str) -> Vec<GmailMessageRecord> {
    session_emails()
        .lock()
        .ok()
        .and_then(|sessions| sessions.get(session_id).cloned())
        .unwrap_or_default()
}

pub fn clear_session_emails(session_id: &str) {
    if let Ok(mut sessions) = session_emails().lock() {
        sessions.remove(session_id);
    }
}

#[cfg(test)]
pub fn clear_all_session_emails() {
    if let Ok(mut sessions) = session_emails().lock() {
        sessions.clear();
    }
}

pub fn get_current_email(session_id: &str) -> Option<GmailMessageRecord> {
    get_session_emails(session_id).into_iter().next()
}

pub fn get_email_by_index(session_id: &str, index: u32) -> Option<GmailMessageRecord> {
    if index == 0 {
        return None;
    }
    get_session_emails(session_id).get((index - 1) as usize).cloned()
}

pub fn find_email_by_query(session_id: &str, query: &str) -> Option<GmailMessageRecord> {
    let normalized = query.trim().to_lowercase();
    if normalized.is_empty() {
        return None;
    }

    get_session_emails(session_id).into_iter().find(|email| {
        format!(
            "{} {} {} {}",
            email.subject, email.from, email.snippet, email.body
        )
        .to_lowercase()
        .contains(&normalized)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_email(subject: &str) -> GmailMessageRecord {
        GmailMessageRecord {
            id: format!("id-{subject}"),
            thread_id: "thread-1".to_string(),
            subject: subject.to_string(),
            from: "sender@example.com".to_string(),
            snippet: "snippet".to_string(),
            date: "2026-06-14".to_string(),
            body: format!("Body for {subject}"),
        }
    }

    #[test]
    fn session_email_store_supports_index_and_query_lookup() {
        clear_all_session_emails();
        let session = "session-email-store";
        store_session_emails(
            session,
            vec![
                sample_email("Invoice due"),
                sample_email("Flight confirmation"),
            ],
        );

        assert_eq!(
            get_current_email(session)
                .as_ref()
                .map(|email| email.subject.as_str()),
            Some("Invoice due")
        );
        assert_eq!(
            get_email_by_index(session, 2)
                .as_ref()
                .map(|email| email.subject.as_str()),
            Some("Flight confirmation")
        );
        assert_eq!(
            find_email_by_query(session, "flight")
                .as_ref()
                .map(|email| email.subject.as_str()),
            Some("Flight confirmation")
        );
    }
}
