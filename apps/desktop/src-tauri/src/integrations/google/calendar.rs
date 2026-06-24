use chrono::{
    DateTime, Datelike, Duration, Local, NaiveDate, NaiveDateTime, NaiveTime, TimeZone, Timelike,
    Utc,
};
use regex::Regex;
use serde_json::{json, Value};

use crate::gateway::models::GmailMessageRecord;

use super::client;

const CALENDAR_API_BASE: &str = "https://www.googleapis.com/calendar/v3";

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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CalendarEventRecord {
    pub id: String,
    pub summary: String,
    pub start: Option<String>,
    pub end: Option<String>,
    pub html_link: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedCalendarEvent {
    pub title: String,
    pub start: DateTime<Local>,
    pub end: DateTime<Local>,
}

pub fn list_today(token: &str) -> Result<Vec<CalendarEventRecord>, String> {
    let now = Local::now();
    let start = now.date_naive().and_hms_opt(0, 0, 0).expect("midnight");
    let end = start + Duration::days(1);
    let start_utc = Local
        .from_local_datetime(&start)
        .single()
        .ok_or_else(|| "Failed to resolve local start of day.".to_string())?
        .with_timezone(&Utc);
    let end_utc = Local
        .from_local_datetime(&end)
        .single()
        .ok_or_else(|| "Failed to resolve local end of day.".to_string())?
        .with_timezone(&Utc);

    let url = format!(
        "{CALENDAR_API_BASE}/calendars/primary/events?timeMin={}&timeMax={}&singleEvents=true&orderBy=startTime&maxResults=10",
        percent_encode(&start_utc.to_rfc3339()),
        percent_encode(&end_utc.to_rfc3339())
    );
    let response = client::api_get(token, &url)?;
    Ok(response
        .get("items")
        .and_then(|value| value.as_array())
        .map(|items| items.iter().map(map_event_record).collect())
        .unwrap_or_default())
}

pub fn create_event(
    token: &str,
    title: &str,
    start: DateTime<Local>,
    end: DateTime<Local>,
) -> Result<CalendarEventRecord, String> {
    let url = format!("{CALENDAR_API_BASE}/calendars/primary/events");
    let body = json!({
        "summary": title,
        "description": "Created by JARVIS",
        "start": {
            "dateTime": start.to_rfc3339(),
        },
        "end": {
            "dateTime": end.to_rfc3339(),
        }
    });
    let response = client::api_post(token, &url, body)?;
    Ok(map_event_record(&response))
}

fn map_event_record(item: &Value) -> CalendarEventRecord {
    CalendarEventRecord {
        id: item
            .get("id")
            .and_then(|value| value.as_str())
            .unwrap_or_default()
            .to_string(),
        summary: item
            .get("summary")
            .and_then(|value| value.as_str())
            .unwrap_or("Untitled event")
            .to_string(),
        start: event_time_value(item.get("start")),
        end: event_time_value(item.get("end")),
        html_link: item
            .get("htmlLink")
            .and_then(|value| value.as_str())
            .map(|value| value.to_string()),
    }
}

fn event_time_value(value: Option<&Value>) -> Option<String> {
    value.and_then(|entry| {
        entry
            .get("dateTime")
            .or_else(|| entry.get("date"))
            .and_then(|raw| raw.as_str())
            .map(|raw| raw.to_string())
    })
}

pub fn parse_calendar_from_nl(command: &str) -> Option<ParsedCalendarEvent> {
    let trimmed = command.trim();
    let normalized = trimmed.to_lowercase();
    let has_calendar_intent = normalized.contains("calendar")
        || normalized.contains("schedule")
        || normalized.starts_with("add ")
        || normalized.starts_with("schedule ");
    if !has_calendar_intent {
        return None;
    }

    let time_re =
        Regex::new(r"(?i)\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)").ok()?;
    let captures = time_re.captures(trimmed)?;
    let day_token = captures.get(1)?.as_str();
    let time_token = captures.get(2)?.as_str();
    let day = resolve_day_reference(day_token, Local::now().date_naive())?;
    let clock = parse_clock_time(time_token)?;
    let start = combine_day_and_clock(day, clock)?;
    let end = start + Duration::minutes(parse_duration_minutes(trimmed) as i64);

    let trigger_patterns = [
        "add ",
        "schedule ",
        "create an event ",
        "create event ",
        "put ",
    ];
    let mut title = trimmed.to_string();
    for prefix in trigger_patterns {
        if normalized.starts_with(prefix) {
            title = trimmed[prefix.len()..].trim().to_string();
            break;
        }
    }

    let time_fragment_re = Regex::new(&format!(
        r"(?i)\b{}\b\s+at\s+{}",
        regex::escape(day_token),
        regex::escape(time_token)
    ))
    .ok()?;
    title = time_fragment_re.replace_all(&title, "").to_string();
    title = title
        .replace("to my calendar", "")
        .replace("in my calendar", "")
        .replace("for 1 hour", "")
        .replace("for 2 hours", "")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    if title.trim().is_empty() {
        title = "New event".to_string();
    }

    Some(ParsedCalendarEvent { title, start, end })
}

pub fn build_calendar_from_email(email: &GmailMessageRecord) -> Option<ParsedCalendarEvent> {
    let combined = format!("{} {} {}", email.subject, email.snippet, email.body);
    let start = parse_date_from_email_text(&combined)?;
    let end = start + Duration::hours(1);
    let cleaned_title = Regex::new(r"(?i)\b(invite|invitation|event|meeting)\b[:\-\s]*")
        .ok()?
        .replace_all(&email.subject, "")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let title = if cleaned_title.trim().is_empty() {
        email.subject.clone()
    } else {
        cleaned_title
    };

    Some(ParsedCalendarEvent { title, start, end })
}

fn parse_date_from_email_text(text: &str) -> Option<DateTime<Local>> {
    let relative_re = Regex::new(
        r"(?i)\b(?:on\s+)?(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b\s+(?:at|from)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)",
    )
    .ok()?;
    if let Some(captures) = relative_re.captures(text) {
        let day = resolve_day_reference(captures.get(1)?.as_str(), Local::now().date_naive())?;
        let clock = parse_clock_time(captures.get(2)?.as_str())?;
        return combine_day_and_clock(day, clock);
    }
    None
}

fn parse_clock_time(value: &str) -> Option<NaiveTime> {
    let re = Regex::new(r"(?i)^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$").ok()?;
    let captures = re.captures(value.trim())?;
    let mut hours: u32 = captures.get(1)?.as_str().parse().ok()?;
    let minutes: u32 = captures
        .get(2)
        .map(|m| m.as_str())
        .unwrap_or("0")
        .parse()
        .ok()?;
    let meridiem = captures.get(3).map(|m| m.as_str().to_lowercase());

    if minutes > 59 || hours > 24 {
        return None;
    }

    if let Some(meridiem) = meridiem {
        if hours == 12 {
            hours = if meridiem == "am" { 0 } else { 12 };
        } else if meridiem == "pm" {
            hours += 12;
        }
    } else if hours == 24 {
        hours = 0;
    }

    if hours > 23 {
        return None;
    }

    NaiveTime::from_hms_opt(hours, minutes, 0)
}

fn resolve_day_reference(day_token: &str, now: NaiveDate) -> Option<NaiveDate> {
    let normalized = day_token.trim().to_lowercase();
    if normalized == "today" {
        return Some(now);
    }
    if normalized == "tomorrow" {
        return Some(now + Duration::days(1));
    }

    let names = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
    ];
    let target_index = names.iter().position(|name| *name == normalized)?;
    let current_index = now.weekday().num_days_from_sunday() as usize;
    let mut diff = (target_index + 7 - current_index) % 7;
    if diff == 0 {
        diff = 7;
    }
    Some(now + Duration::days(diff as i64))
}

fn combine_day_and_clock(day: NaiveDate, clock: NaiveTime) -> Option<DateTime<Local>> {
    let naive = NaiveDateTime::new(day, clock);
    Local
        .from_local_datetime(&naive)
        .single()
        .or_else(|| Local.from_local_datetime(&naive).earliest())
        .map(|value| value.with_timezone(&Local))
}

fn parse_duration_minutes(command: &str) -> u32 {
    let hour_re = Regex::new(r"(?i)\bfor\s+(\d+)\s+hour").ok();
    if let Some(re) = hour_re {
        if let Some(captures) = re.captures(command) {
            if let Ok(hours) = captures
                .get(1)
                .map(|m| m.as_str())
                .unwrap_or("0")
                .parse::<u32>()
            {
                return hours * 60;
            }
        }
    }

    let minute_re = Regex::new(r"(?i)\bfor\s+(\d+)\s+minute").ok();
    if let Some(re) = minute_re {
        if let Some(captures) = re.captures(command) {
            if let Ok(minutes) = captures
                .get(1)
                .map(|m| m.as_str())
                .unwrap_or("0")
                .parse::<u32>()
            {
                return minutes;
            }
        }
    }

    60
}

pub fn format_today_reply(events: &[CalendarEventRecord]) -> String {
    if events.is_empty() {
        return "You have no calendar events scheduled for today.".to_string();
    }
    let listing = events
        .iter()
        .map(|event| {
            format!(
                "- {} ({})",
                event.summary,
                format_calendar_event_time_label(event.start.as_deref())
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    format!(
        "You have {} event{} today:\n{listing}",
        events.len(),
        if events.len() == 1 { "" } else { "s" }
    )
}

pub fn format_create_reply(title: &str, html_link: Option<&str>) -> String {
    if let Some(link) = html_link {
        format!("Created a Google Calendar event for {title}: {link}")
    } else {
        format!("Created a Google Calendar event for {title}.")
    }
}

fn format_calendar_event_time_label(value: Option<&str>) -> String {
    let Some(raw) = value else {
        return "Unknown time".to_string();
    };
    DateTime::parse_from_rfc3339(raw)
        .map(|timestamp| timestamp.format("%I:%M %p").to_string())
        .unwrap_or_else(|_| raw.to_string())
}

/// Return the next calendar event starting within the given minute window.
pub fn find_event_starting_within(
    token: &str,
    within_minutes: i64,
) -> Result<Option<CalendarEventRecord>, String> {
    let events = list_today(token)?;
    let now = Local::now();
    let horizon = now + Duration::minutes(within_minutes);
    for event in events {
        let Some(start_raw) = event.start.as_deref() else {
            continue;
        };
        let Ok(start) = DateTime::parse_from_rfc3339(start_raw) else {
            continue;
        };
        let start_local = start.with_timezone(&Local);
        if start_local > now && start_local <= horizon {
            return Ok(Some(event));
        }
    }
    Ok(None)
}

pub fn delete_event(token: &str, event_id: &str) -> Result<String, String> {
    let url = format!("{CALENDAR_API_BASE}/calendars/primary/events/{event_id}");
    client::api_delete(token, &url)?;
    Ok(format!("Calendar event {event_id} deleted."))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    use crate::integrations::google::client;

    #[test]
    fn parse_calendar_from_nl_extracts_title_and_time() {
        let parsed = parse_calendar_from_nl("add gym tomorrow at 6 PM to my calendar")
            .expect("parsed event");
        assert_eq!(parsed.title.to_lowercase(), "gym");
        assert_eq!(parsed.start.hour(), 18);
    }

    #[test]
    fn list_today_uses_mock_responses_without_live_google() {
        client::set_mock_responses(HashMap::from([(
            "/calendars/primary/events".to_string(),
            r#"{
              "items": [
                {
                  "id": "evt-1",
                  "summary": "Standup",
                  "start": { "dateTime": "2026-06-14T09:00:00-04:00" },
                  "end": { "dateTime": "2026-06-14T09:30:00-04:00" },
                  "htmlLink": "https://calendar.google.com/event?eid=1"
                }
              ]
            }"#
            .to_string(),
        )]));

        let events = list_today("test-token").expect("events");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].summary, "Standup");
        client::clear_mock_responses();
    }

    #[test]
    fn find_event_starting_within_returns_upcoming_event() {
        let start = (Local::now() + Duration::minutes(10)).to_rfc3339();
        let end = (Local::now() + Duration::minutes(40)).to_rfc3339();
        client::set_mock_responses(HashMap::from([(
            "/calendars/primary/events".to_string(),
            format!(
                r#"{{
              "items": [
                {{
                  "id": "evt-soon",
                  "summary": "Product review",
                  "start": {{ "dateTime": "{start}" }},
                  "end": {{ "dateTime": "{end}" }},
                  "htmlLink": "https://calendar.google.com/event?eid=2"
                }}
              ]
            }}"#
            ),
        )]));

        let event = find_event_starting_within("test-token", 15)
            .expect("lookup")
            .expect("event");
        assert_eq!(event.summary, "Product review");
        client::clear_mock_responses();
    }

    #[test]
    fn build_calendar_from_email_uses_relative_date() {
        let email = GmailMessageRecord {
            id: "1".into(),
            thread_id: "t".into(),
            subject: "Meeting invite: Project sync".into(),
            from: "host@example.com".into(),
            snippet: String::new(),
            date: String::new(),
            body: "Let's meet tomorrow at 3pm".into(),
        };
        let parsed = build_calendar_from_email(&email).expect("parsed");
        assert!(parsed.title.contains("Project sync"));
        assert_eq!(parsed.start.hour(), 15);
    }
}
