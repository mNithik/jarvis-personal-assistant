use std::cell::RefCell;
use std::collections::HashMap;

use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use reqwest::Method;
use serde_json::Value;

#[cfg(test)]
thread_local! {
    static MOCK_RESPONSES: RefCell<Option<HashMap<String, String>>> = const {
        RefCell::new(None)
    };
}

fn google_client() -> Result<Client, String> {
    Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|error| format!("Failed to initialize Google API client: {error}"))
}

fn auth_headers(token: &str) -> Result<HeaderMap, String> {
    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {token}")).map_err(|error| error.to_string())?,
    );
    Ok(headers)
}

#[cfg(test)]
fn lookup_mock(method: &Method, url: &str) -> Option<String> {
    MOCK_RESPONSES.with(|cell| {
        let responses = cell.borrow();
        let map = responses.as_ref()?;
        let key = format!("{method} {url}");
        if let Some(body) = map.get(&key).or_else(|| map.get(url)) {
            return Some(body.clone());
        }
        map.iter()
            .find(|(pattern, _)| url.contains(pattern.as_str()))
            .map(|(_, body)| body.clone())
    })
}

pub(crate) fn api_get(token: &str, url: &str) -> Result<Value, String> {
    #[cfg(test)]
    if let Some(body) = lookup_mock(&Method::GET, url) {
        return serde_json::from_str(&body)
            .map_err(|error| format!("Failed to parse mock Google API response: {error}"));
    }

    let client = google_client()?;
    let response = client
        .get(url)
        .headers(auth_headers(token)?)
        .send()
        .map_err(|error| format!("Google API request failed: {error}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().unwrap_or_default();
        return Err(format!("Google API request failed with {status}: {body}"));
    }
    response
        .json()
        .map_err(|error| format!("Failed to parse Google API response: {error}"))
}

pub(crate) fn api_post(token: &str, url: &str, body: Value) -> Result<Value, String> {
    #[cfg(test)]
    if let Some(mock_body) = lookup_mock(&Method::POST, url) {
        return serde_json::from_str(&mock_body)
            .map_err(|error| format!("Failed to parse mock Google API response: {error}"));
    }

    let client = google_client()?;
    let mut headers = auth_headers(token)?;
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    let response = client
        .post(url)
        .headers(headers)
        .json(&body)
        .send()
        .map_err(|error| format!("Google API request failed: {error}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().unwrap_or_default();
        return Err(format!("Google API request failed with {status}: {body}"));
    }
    response
        .json()
        .map_err(|error| format!("Failed to parse Google API response: {error}"))
}

pub(crate) fn api_delete(token: &str, url: &str) -> Result<(), String> {
    #[cfg(test)]
    if lookup_mock(&Method::DELETE, url).is_some() {
        return Ok(());
    }

    let client = google_client()?;
    let response = client
        .delete(url)
        .headers(auth_headers(token)?)
        .send()
        .map_err(|error| format!("Google API request failed: {error}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().unwrap_or_default();
        return Err(format!("Google API request failed with {status}: {body}"));
    }
    Ok(())
}

#[cfg(test)]
pub fn set_mock_responses(responses: HashMap<String, String>) {
    MOCK_RESPONSES.with(|cell| {
        *cell.borrow_mut() = Some(responses);
    });
}

#[cfg(test)]
pub fn clear_mock_responses() {
    MOCK_RESPONSES.with(|cell| {
        *cell.borrow_mut() = None;
    });
}
