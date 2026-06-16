use std::cell::RefCell;
use std::collections::HashMap;

use keyring::Entry;

const KEYRING_SERVICE_NAME: &str = "jarvis-ai-assistant";

#[cfg(test)]
thread_local! {
    static TEST_TOKEN_OVERRIDE: RefCell<Option<HashMap<String, String>>> = const {
        RefCell::new(None)
    };
}

pub fn account_for_google_session(kind: &str) -> Result<String, String> {
    match kind.trim().to_lowercase().as_str() {
        "calendar" | "gmail" => Ok(format!("google:{}:session", kind.trim().to_lowercase())),
        _ => Err("Google session kind must be 'calendar' or 'gmail'.".to_string()),
    }
}

pub fn get_session_token(kind: &str) -> Result<String, String> {
    #[cfg(test)]
    {
        let override_token = TEST_TOKEN_OVERRIDE.with(|cell| {
            cell.borrow()
                .as_ref()
                .and_then(|tokens| tokens.get(kind).cloned())
        });
        if let Some(token) = override_token {
            return Ok(token);
        }
    }

    get_session_token_from_keyring(kind)
}

pub fn get_session_token_from_keyring(kind: &str) -> Result<String, String> {
    let account = account_for_google_session(kind)?;
    let entry = Entry::new(KEYRING_SERVICE_NAME, &account)
        .map_err(|error| format!("Failed to open Windows Credential Manager entry: {error}"))?;
    entry.get_password().map_err(|error| {
        format!("Failed to read Google session token from Windows Credential Manager: {error}")
    })
}

pub fn save_session_token_to_keyring(kind: &str, token: &str) -> Result<(), String> {
    if token.trim().is_empty() {
        return Err("Google session token cannot be empty.".to_string());
    }
    let account = account_for_google_session(kind)?;
    let entry = Entry::new(KEYRING_SERVICE_NAME, &account)
        .map_err(|error| format!("Failed to create Windows Credential Manager entry: {error}"))?;
    entry
        .set_password(token.trim())
        .map_err(|error| format!("Failed to save Google session token: {error}"))
}

pub fn clear_session_token_from_keyring(kind: &str) -> Result<(), String> {
    let account = account_for_google_session(kind)?;
    let entry = Entry::new(KEYRING_SERVICE_NAME, &account)
        .map_err(|error| format!("Failed to open Windows Credential Manager entry: {error}"))?;
    entry.delete_credential().map_err(|error| {
        format!("Failed to delete Google session token from Windows Credential Manager: {error}")
    })
}

#[cfg(test)]
pub fn set_test_tokens(tokens: HashMap<String, String>) {
    TEST_TOKEN_OVERRIDE.with(|cell| {
        *cell.borrow_mut() = Some(tokens);
    });
}

#[cfg(test)]
pub fn clear_test_tokens() {
    TEST_TOKEN_OVERRIDE.with(|cell| {
        *cell.borrow_mut() = None;
    });
}
