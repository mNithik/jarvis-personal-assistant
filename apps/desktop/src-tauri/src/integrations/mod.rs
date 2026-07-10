pub mod google;
pub mod notion;
pub mod slack;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NotionAction {
    ListNotes,
    SearchNotes { query: String },
    CreateNote { content: String },
    CreateTask { title: String },
}

pub fn parse_notion_command(command: &str) -> Option<NotionAction> {
    let trimmed = command.trim();
    let normalized = trimmed.to_lowercase();

    if matches!(
        normalized.as_str(),
        "show my notes" | "list my notes" | "show notes" | "what are my notes" | "list notes"
    ) {
        return Some(NotionAction::ListNotes);
    }

    const SEARCH_PREFIXES: &[&str] = &[
        "search notion for ",
        "search notes for ",
        "find notion note ",
    ];
    for prefix in SEARCH_PREFIXES {
        if normalized.starts_with(prefix) {
            let query = trimmed[prefix.len()..].trim();
            if !query.is_empty() {
                return Some(NotionAction::SearchNotes {
                    query: query.to_string(),
                });
            }
        }
    }

    const NOTE_PREFIXES: &[&str] = &[
        "make a note to ",
        "make a note ",
        "make me a note to ",
        "make me a note ",
        "create a note to ",
        "create a note ",
        "note this down: ",
        "note this down ",
        "remember this: ",
        "remember this ",
    ];
    for prefix in NOTE_PREFIXES {
        if normalized.starts_with(prefix) {
            let content = trimmed[prefix.len()..].trim();
            if !content.is_empty() {
                return Some(NotionAction::CreateNote {
                    content: content.to_string(),
                });
            }
        }
    }

    const TASK_PREFIXES: &[&str] = &["create a task ", "add a task ", "new task "];
    for prefix in TASK_PREFIXES {
        if normalized.starts_with(prefix) {
            let title = trimmed[prefix.len()..].trim();
            if !title.is_empty() {
                return Some(NotionAction::CreateTask {
                    title: title.to_string(),
                });
            }
        }
    }

    None
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SpotifyAction {
    Play,
    Pause,
    Skip,
    Previous,
    PlayQuery { query: String },
}

pub fn parse_spotify_command(command: &str) -> Option<SpotifyAction> {
    let normalized = command.trim().to_lowercase();
    if normalized.contains("pause") && normalized.contains("spotify") {
        return Some(SpotifyAction::Pause);
    }
    if (normalized.contains("skip") || normalized.contains("next"))
        && normalized.contains("spotify")
    {
        return Some(SpotifyAction::Skip);
    }
    if normalized.contains("previous") && normalized.contains("spotify") {
        return Some(SpotifyAction::Previous);
    }
    if normalized.contains("play") && normalized.contains("spotify") {
        for prefix in ["play ", "play music ", "play song "] {
            if let Some(rest) = normalized.strip_prefix(prefix) {
                let query = rest
                    .replace(" on spotify", "")
                    .replace("spotify", "")
                    .trim()
                    .to_string();
                if !query.is_empty() && query != "music" {
                    return Some(SpotifyAction::PlayQuery { query });
                }
            }
        }
        return Some(SpotifyAction::Play);
    }
    None
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GmailAction {
    ListUnread,
    TriageInbox,
    Search { query: String },
    ReadCurrentEmail,
    ReadEmailByIndex { index: u32 },
    ReadEmailByQuery { query: String },
    DraftReply { index: u32 },
}

pub fn parse_gmail_command(command: &str) -> Option<GmailAction> {
    let trimmed = command.trim();
    let normalized = trimmed.to_lowercase();

    if matches!(
        normalized.as_str(),
        "read this email" | "read current email" | "read the current email"
    ) {
        return Some(GmailAction::ReadCurrentEmail);
    }

    if let Some(index_str) = normalized
        .strip_prefix("read email ")
        .or_else(|| normalized.strip_prefix("show email "))
    {
        if let Ok(index) = index_str.trim().parse::<u32>() {
            return Some(GmailAction::ReadEmailByIndex { index });
        }
    }

    for prefix in [
        "read the email about ",
        "read email about ",
        "show the email about ",
        "show email about ",
    ] {
        if normalized.starts_with(prefix) {
            let query = trimmed[prefix.len()..].trim();
            if !query.is_empty() {
                return Some(GmailAction::ReadEmailByQuery {
                    query: query.to_string(),
                });
            }
        }
    }

    if matches!(
        normalized.as_str(),
        "triage my inbox" | "triage inbox" | "email triage" | "inbox triage"
    ) {
        return Some(GmailAction::TriageInbox);
    }

    if let Some(index_str) = normalized
        .strip_prefix("draft a reply to email ")
        .or_else(|| normalized.strip_prefix("draft reply to email "))
        .or_else(|| normalized.strip_prefix("draft a reply for email "))
    {
        if let Ok(index) = index_str.trim().parse::<u32>() {
            return Some(GmailAction::DraftReply { index });
        }
    }

    if matches!(
        normalized.as_str(),
        "check my email"
            | "check my emails"
            | "check email"
            | "check gmail"
            | "read my email"
            | "read my emails"
            | "show unread emails"
            | "list unread emails"
    ) || normalized.contains("unread email")
    {
        return Some(GmailAction::ListUnread);
    }

    for prefix in [
        "search gmail for ",
        "search email for ",
        "search emails for ",
        "find email ",
    ] {
        if normalized.starts_with(prefix) {
            let query = trimmed[prefix.len()..].trim();
            if !query.is_empty() {
                return Some(GmailAction::Search {
                    query: query.to_string(),
                });
            }
        }
    }

    None
}

pub fn is_notion_command(command: &str) -> bool {
    parse_notion_command(command).is_some() || {
        let n = command.trim().to_lowercase();
        n.contains("notion") || n.contains("my notes")
    }
}

pub fn is_spotify_command(command: &str) -> bool {
    parse_spotify_command(command).is_some() || {
        let n = command.trim().to_lowercase();
        (n.contains("spotify") || n.contains("music"))
            && (n.contains("play") || n.contains("pause") || n.contains("skip"))
    }
}

pub fn is_gmail_command(command: &str) -> bool {
    parse_gmail_command(command).is_some()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SlackAction {
    SummarizeChannel { channel: String },
    SummarizeThread { ref_id: String },
    WhatsChanged { channel: String },
    DraftUpdate { channel: String, topic: String },
    SendDraft { channel: String },
    UploadFile { channel: String, file_path: String },
    SaveActionItems,
}

fn extract_channel_token(command: &str) -> Option<String> {
    for token in command.split_whitespace() {
        if token.starts_with('#') && token.len() > 1 {
            return Some(token.to_string());
        }
    }
    None
}

pub fn parse_slack_command(command: &str) -> Option<SlackAction> {
    let trimmed = command.trim();
    let normalized = trimmed.to_lowercase();

    if normalized.starts_with("summarize slack channel ")
        || normalized.starts_with("summarise slack channel ")
    {
        return extract_channel_token(trimmed)
            .or_else(|| {
                trimmed
                    .split_whitespace()
                    .last()
                    .map(|value| value.to_string())
            })
            .map(|channel| SlackAction::SummarizeChannel { channel });
    }

    if normalized.starts_with("summarize slack thread ")
        || normalized.starts_with("summarise slack thread ")
    {
        let ref_id = trimmed["summarize slack thread ".len()..].trim().to_string();
        if !ref_id.is_empty() {
            return Some(SlackAction::SummarizeThread { ref_id });
        }
    }

    if normalized.starts_with("what changed in ") && normalized.contains(" today") {
        if let Some(channel) = extract_channel_token(trimmed) {
            return Some(SlackAction::WhatsChanged { channel });
        }
    }

    if normalized.starts_with("draft a slack update for ") {
        let rest = trimmed["draft a slack update for ".len()..].trim();
        if let Some(channel) = extract_channel_token(rest) {
            let topic = rest
                .split_once(" about ")
                .map(|(_, value)| value.trim().to_string())
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| "team update".to_string());
            return Some(SlackAction::DraftUpdate { channel, topic });
        }
    }

    if normalized.starts_with("send this to slack ") {
        if let Some(channel) = extract_channel_token(trimmed) {
            return Some(SlackAction::SendDraft { channel });
        }
    }

    if normalized.starts_with("upload file to slack ") || normalized.starts_with("send file to slack ") {
        let prefix = if normalized.starts_with("upload file to slack ") {
            "upload file to slack "
        } else {
            "send file to slack "
        };
        let rest = trimmed[prefix.len()..].trim();
        if let Some(channel) = extract_channel_token(rest) {
            let file_path = rest
                .split_once(" from ")
                .map(|(_, path)| path.trim().to_string())
                .or_else(|| {
                    rest.split_whitespace()
                        .skip_while(|token| token.starts_with('#'))
                        .next()
                        .map(|value| value.to_string())
                })
                .filter(|value| !value.is_empty());
            if let Some(file_path) = file_path {
                return Some(SlackAction::UploadFile { channel, file_path });
            }
        }
    }

    if normalized == "save slack action items to planner" {
        return Some(SlackAction::SaveActionItems);
    }

    None
}

pub fn is_slack_command(command: &str) -> bool {
    parse_slack_command(command).is_some() || {
        let normalized = command.trim().to_lowercase();
        normalized.contains("slack")
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CalendarAction {
    ListToday,
    CreateFromNl,
    CreateFromEmail,
}

pub fn parse_calendar_command(command: &str) -> Option<CalendarAction> {
    let trimmed = command.trim();
    let normalized = trimmed.to_lowercase();

    if matches!(
        normalized.as_str(),
        "what's on my calendar today"
            | "whats on my calendar today"
            | "show today's events"
            | "show todays events"
            | "what is on my calendar today"
            | "list today's events"
            | "list todays events"
    ) || normalized.contains("calendar today")
    {
        return Some(CalendarAction::ListToday);
    }

    if matches!(
        normalized.as_str(),
        "add this email to calendar"
            | "schedule this email"
            | "put this meeting on my calendar"
            | "make a calendar event from this email"
            | "turn this email into a calendar event"
    ) || (normalized.contains("email")
        && normalized.contains("calendar")
        && normalized.contains("add"))
    {
        return Some(CalendarAction::CreateFromEmail);
    }

    if normalized.contains("calendar")
        || normalized.starts_with("schedule ")
        || normalized.starts_with("add ")
    {
        return Some(CalendarAction::CreateFromNl);
    }

    None
}

pub fn is_calendar_command(command: &str) -> bool {
    parse_calendar_command(command).is_some()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OcrNotionAction {
    ReadScreenAndSave,
    SaveOcrHistory,
    SaveScreenText { scope: Option<String> },
}

pub fn parse_ocr_notion_command(command: &str) -> Option<OcrNotionAction> {
    let normalized = command.trim().to_lowercase();

    if matches!(
        normalized.as_str(),
        "save ocr history to notion"
            | "save screen history to notion"
            | "save screen read history to notion"
    ) {
        return Some(OcrNotionAction::SaveOcrHistory);
    }

    if matches!(
        normalized.as_str(),
        "save screen text to notion"
            | "save screenshot text to notion"
            | "ocr screen to notion"
            | "read screen and save to notion"
    ) {
        return Some(OcrNotionAction::ReadScreenAndSave);
    }

    if normalized.starts_with("save screen text from ") && normalized.contains("notion") {
        return Some(OcrNotionAction::SaveScreenText {
            scope: Some("app_window".to_string()),
        });
    }

    None
}

pub fn is_ocr_notion_command(command: &str) -> bool {
    parse_ocr_notion_command(command).is_some() || parse_ocr_watch_command(command).is_some() || {
        let n = command.trim().to_lowercase();
        n.contains("notion")
            && (n.contains("ocr") || n.contains("screen text") || n.contains("screen history"))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OcrWatchAction {
    StartWatch,
    StopWatch,
    ShowWatches,
    PauseWatches,
    ResumeWatches,
}

pub fn parse_ocr_watch_command(command: &str) -> Option<OcrWatchAction> {
    let normalized = command.trim().to_lowercase();

    if matches!(
        normalized.as_str(),
        "stop watching screen" | "stop screen watch" | "stop ocr watch"
    ) {
        return Some(OcrWatchAction::StopWatch);
    }

    if matches!(
        normalized.as_str(),
        "pause ocr watches" | "pause screen watches" | "pause watching screen"
    ) {
        return Some(OcrWatchAction::PauseWatches);
    }

    if matches!(
        normalized.as_str(),
        "resume ocr watches" | "resume screen watches" | "resume watching screen"
    ) {
        return Some(OcrWatchAction::ResumeWatches);
    }

    if matches!(
        normalized.as_str(),
        "show ocr watches" | "show screen watches" | "show watch dashboard"
    ) {
        return Some(OcrWatchAction::ShowWatches);
    }

    if normalized.starts_with("watch ") {
        return Some(OcrWatchAction::StartWatch);
    }

    None
}

pub fn is_ocr_watch_command(command: &str) -> bool {
    parse_ocr_watch_command(command).is_some()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EmailNotionAction {
    SaveCurrentEmail,
    SaveLatestEmail,
    SaveEmailDigest,
    SaveFirstEmails { count: u32 },
    SaveTravelCurrent,
    SaveExpenseCurrent,
    SavePackageCurrent,
    SaveEmailByIndex { index: u32 },
    SaveEmailByQuery { query: String },
    SaveTravelByIndex { index: u32 },
    SaveTravelByQuery { query: String },
    SaveExpenseByIndex { index: u32 },
    SaveExpenseByQuery { query: String },
    SavePackageByIndex { index: u32 },
    SavePackageByQuery { query: String },
}

pub fn parse_email_notion_command(command: &str) -> Option<EmailNotionAction> {
    let trimmed = command.trim();
    let normalized = trimmed.to_lowercase();

    if matches!(
        normalized.as_str(),
        "save this email to notion" | "save this email as a note" | "save current email to notion"
    ) {
        return Some(EmailNotionAction::SaveCurrentEmail);
    }

    if matches!(
        normalized.as_str(),
        "save latest email to notion" | "save my latest email to notion"
    ) {
        return Some(EmailNotionAction::SaveLatestEmail);
    }

    if matches!(
        normalized.as_str(),
        "save email digest to notion"
            | "save my email digest to notion"
            | "save unread emails to notion"
            | "summarize unread emails into notion"
    ) {
        return Some(EmailNotionAction::SaveEmailDigest);
    }

    if let Some(count_str) = normalized.strip_prefix("save first ") {
        if let Some(count_part) = count_str.strip_suffix(" emails to notion") {
            if let Ok(count) = count_part.trim().parse::<u32>() {
                return Some(EmailNotionAction::SaveFirstEmails { count });
            }
        }
    }

    if matches!(
        normalized.as_str(),
        "save this travel to notion"
            | "save travel from this email to notion"
            | "save current email travel to notion"
    ) {
        return Some(EmailNotionAction::SaveTravelCurrent);
    }

    if matches!(
        normalized.as_str(),
        "save this expense to notion"
            | "save expense from this email to notion"
            | "save current email expense to notion"
    ) {
        return Some(EmailNotionAction::SaveExpenseCurrent);
    }

    if matches!(
        normalized.as_str(),
        "save this package to notion"
            | "save package from this email to notion"
            | "save current email package to notion"
    ) {
        return Some(EmailNotionAction::SavePackageCurrent);
    }

    if let Some(rest) = normalized.strip_prefix("save email ") {
        if let Some(index_str) = rest.strip_suffix(" to notion") {
            if let Ok(index) = index_str.trim().parse::<u32>() {
                return Some(EmailNotionAction::SaveEmailByIndex { index });
            }
        }
    }

    if let Some(index_str) = normalized.strip_prefix("save travel from email ") {
        if let Some(index_part) = index_str.strip_suffix(" to notion") {
            if let Ok(index) = index_part.trim().parse::<u32>() {
                return Some(EmailNotionAction::SaveTravelByIndex { index });
            }
        }
    }

    if let Some(index_str) = normalized.strip_prefix("save expense from email ") {
        if let Some(index_part) = index_str.strip_suffix(" to notion") {
            if let Ok(index) = index_part.trim().parse::<u32>() {
                return Some(EmailNotionAction::SaveExpenseByIndex { index });
            }
        }
    }

    if let Some(index_str) = normalized.strip_prefix("save package from email ") {
        if let Some(index_part) = index_str.strip_suffix(" to notion") {
            if let Ok(index) = index_part.trim().parse::<u32>() {
                return Some(EmailNotionAction::SavePackageByIndex { index });
            }
        }
    }

    for (prefix, action) in [
        ("save travel from the email about ", "travel_query"),
        ("save travel from email about ", "travel_query"),
        ("save expense from the email about ", "expense_query"),
        ("save expense from email about ", "expense_query"),
        ("save package from the email about ", "package_query"),
        ("save package from email about ", "package_query"),
    ] {
        if normalized.starts_with(prefix) {
            let rest = trimmed[prefix.len()..].trim();
            let query = rest
                .strip_suffix(" to notion")
                .unwrap_or(rest)
                .trim()
                .to_string();
            if !query.is_empty() {
                return Some(match action {
                    "travel_query" => EmailNotionAction::SaveTravelByQuery { query },
                    "expense_query" => EmailNotionAction::SaveExpenseByQuery { query },
                    _ => EmailNotionAction::SavePackageByQuery { query },
                });
            }
        }
    }

    for prefix in [
        "save the email about ",
        "save email about ",
        "save notion note for email ",
    ] {
        if normalized.starts_with(prefix) {
            let query = trimmed[prefix.len()..].trim();
            if !query.is_empty() {
                return Some(EmailNotionAction::SaveEmailByQuery {
                    query: query.to_string(),
                });
            }
        }
    }

    if normalized.starts_with("save email to notion about ") {
        let query = trimmed["save email to notion about ".len()..].trim();
        if !query.is_empty() {
            return Some(EmailNotionAction::SaveEmailByQuery {
                query: query.to_string(),
            });
        }
    }

    None
}

pub fn is_email_notion_command(command: &str) -> bool {
    parse_email_notion_command(command).is_some() || {
        let n = command.trim().to_lowercase();
        n.contains("email") && n.contains("notion") && n.contains("save")
    }
}
