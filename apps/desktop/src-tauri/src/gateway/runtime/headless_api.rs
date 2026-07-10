use std::sync::{Arc, Mutex, OnceLock};

use serde::Serialize;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

use super::headless::HeadlessGatewayContext;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HeadlessLocalTurnApiStatus {
    pub listening: bool,
    pub port: u16,
    pub last_error: Option<String>,
    pub last_request_at: Option<String>,
}

struct ApiRuntime {
    status: HeadlessLocalTurnApiStatus,
    shutdown: bool,
}

static RUNTIME: OnceLock<Arc<Mutex<Option<ApiRuntime>>>> = OnceLock::new();

fn runtime() -> Arc<Mutex<Option<ApiRuntime>>> {
    RUNTIME.get_or_init(|| Arc::new(Mutex::new(None))).clone()
}

pub fn sync_headless_local_turn_api(ctx: Arc<HeadlessGatewayContext>) {
    let config = ctx.config();
    if config.enabled && config.channels.local_ws_enabled {
        ctx.append_service_log(&format!(
            "headless local API enabled on port {}",
            config.channels.local_ws_port
        ));
        spawn_listener(ctx, &config);
    } else {
        ctx.append_service_log("headless local API disabled");
        stop_listener();
    }
}

fn stop_listener() {
    if let Ok(mut guard) = runtime().lock() {
        if let Some(rt) = guard.as_mut() {
            rt.shutdown = true;
            rt.status.listening = false;
        }
        *guard = None;
    }
}

fn spawn_listener(
    ctx: Arc<HeadlessGatewayContext>,
    config: &crate::gateway::config::GatewayConfig,
) {
    let port = config.channels.local_ws_port;
    let token = config.channels.local_ws_token.clone();

    {
        let rt = runtime();
        let mut guard = rt.lock().expect("runtime lock");
        if let Some(existing) = guard.as_ref() {
            if existing.status.listening && existing.status.port == port {
                return;
            }
        }
        *guard = Some(ApiRuntime {
            status: HeadlessLocalTurnApiStatus {
                listening: true,
                port,
                last_error: None,
                last_request_at: None,
            },
            shutdown: false,
        });
    }

    tokio::spawn(async move {
        let addr = format!("127.0.0.1:{port}");
        let listener = match TcpListener::bind(&addr).await {
            Ok(listener) => {
                ctx.append_service_log(&format!("headless local API listening on {addr}"));
                listener
            }
            Err(error) => {
                ctx.append_service_log(&format!(
                    "headless local API bind failed on {addr}: {error}"
                ));
                set_error(&format!("Bind failed on {addr}: {error}"));
                return;
            }
        };

        loop {
            if should_shutdown() {
                break;
            }

            let accept =
                tokio::time::timeout(std::time::Duration::from_secs(1), listener.accept()).await;

            let Ok(Ok((mut stream, _))) = accept else {
                continue;
            };

            let ctx = ctx.clone();
            let token = token.clone();
            tokio::spawn(async move {
                let mut buffer = vec![0u8; 65536];
                let read = stream.read(&mut buffer).await.unwrap_or(0);
                if read == 0 {
                    return;
                }
                let request_text = String::from_utf8_lossy(&buffer[..read]).to_string();
                let response = match tokio::task::spawn_blocking(move || {
                    handle_http_request(&ctx, &request_text, token.as_deref())
                })
                .await
                {
                    Ok(response) => response,
                    Err(_) => http_response(500, r#"{"error":"handler task failed"}"#),
                };
                let _ = stream.write_all(response.as_bytes()).await;
                let _ = stream.flush().await;
                touch_request_time();
            });
        }

        if let Ok(mut guard) = runtime().lock() {
            if let Some(rt) = guard.as_mut() {
                rt.status.listening = false;
            }
        }
    });
}

fn should_shutdown() -> bool {
    runtime()
        .lock()
        .ok()
        .and_then(|guard| guard.as_ref().map(|rt| rt.shutdown))
        .unwrap_or(true)
}

fn set_error(message: &str) {
    if let Ok(mut guard) = runtime().lock() {
        if let Some(rt) = guard.as_mut() {
            rt.status.listening = false;
            rt.status.last_error = Some(message.to_string());
        }
    }
}

fn touch_request_time() {
    if let Ok(mut guard) = runtime().lock() {
        if let Some(rt) = guard.as_mut() {
            rt.status.last_request_at = Some(chrono::Utc::now().timestamp().to_string());
        }
    }
}

fn handle_http_request(
    ctx: &Arc<HeadlessGatewayContext>,
    raw: &str,
    token: Option<&str>,
) -> String {
    let (method, path, headers, body) = parse_http(raw);

    if method == "GET" && path == "/health" {
        return http_response(200, r#"{"ok":true}"#);
    }

    if requires_auth(token) && !is_authorized(&headers, token) {
        return http_response(401, r#"{"error":"unauthorized"}"#);
    }

    if method == "GET" && path == "/mobile/brief" {
        return match build_mobile_brief(ctx) {
            Ok(json) => http_response(200, &json),
            Err(error) => http_response(500, &format!(r#"{{"error":"{error}"}}"#)),
        };
    }

    if method == "GET" && path == "/mobile/approvals" {
        return match list_mobile_approvals(ctx) {
            Ok(json) => http_response(200, &json),
            Err(error) => http_response(500, &format!(r#"{{"error":"{error}"}}"#)),
        };
    }

    if method == "POST" && path.starts_with("/mobile/approvals/") {
        let parts: Vec<&str> = path.trim_start_matches('/').split('/').collect();
        if parts.len() == 4 {
            let approval_id = parts[2];
            let action = parts[3];
            return match resolve_mobile_approval(ctx, approval_id, action == "approve") {
                Ok(json) => http_response(200, &json),
                Err(error) => http_response(500, &format!(r#"{{"error":"{error}"}}"#)),
            };
        }
    }

    if method != "POST" || path != "/turn" {
        return http_response(404, r#"{"error":"not found"}"#);
    }

    let channel_request = match crate::gateway::channels::parse_local_channel_payload(body.trim()) {
        Ok(request) => request,
        Err(error) => return http_response(400, &format!(r#"{{"error":"{error}"}}"#)),
    };

    match ctx.run_turn(channel_request.into()) {
        Ok(response) => {
            let json = serde_json::to_string(&response).unwrap_or_else(|_| "{}".to_string());
            http_response(200, &json)
        }
        Err(error) => http_response(500, &format!(r#"{{"error":"{error}"}}"#)),
    }
}

fn requires_auth(token: Option<&str>) -> bool {
    token.filter(|value| !value.is_empty()).is_some()
}

fn is_authorized(headers: &[(String, String)], token: Option<&str>) -> bool {
    let Some(expected) = token.filter(|value| !value.is_empty()) else {
        return true;
    };
    headers.iter().any(|(key, value)| {
        key.eq_ignore_ascii_case("authorization") && value == &format!("Bearer {expected}")
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MobileBriefResponse {
    top_three: Vec<String>,
    pending_approval_count: usize,
    next_event: Option<String>,
}

fn build_mobile_brief(ctx: &Arc<HeadlessGatewayContext>) -> Result<String, String> {
    let config = ctx.config();
    if !config.channels.mobile_approve_enabled {
        return Err("Mobile approve is disabled".to_string());
    }

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let top_three = crate::memory::day_plan_store::get_day_plan(&ctx.db_path, &today)?
        .map(|plan| plan.top_three)
        .unwrap_or_default();
    let pending_approval_count = ctx.list_pending_approvals()?.len();
    let next_event = if config.features.calendar {
        google_next_event_summary().ok()
    } else {
        None
    };
    serde_json::to_string(&MobileBriefResponse {
        top_three,
        pending_approval_count,
        next_event,
    })
    .map_err(|error| error.to_string())
}

fn google_next_event_summary() -> Result<String, String> {
    let token = crate::integrations::google::get_session_token("calendar")?;
    let event = crate::integrations::google::calendar::find_event_starting_within(&token, 240)?;
    Ok(event
        .map(|entry| {
            format!(
                "{} ({})",
                entry.summary,
                entry.start.as_deref().unwrap_or("soon")
            )
        })
        .unwrap_or_else(|| "No upcoming events".to_string()))
}

fn list_mobile_approvals(ctx: &Arc<HeadlessGatewayContext>) -> Result<String, String> {
    let config = ctx.config();
    if !config.channels.mobile_approve_enabled {
        return Err("Mobile approve is disabled".to_string());
    }
    let approvals = ctx.list_pending_approvals()?;
    serde_json::to_string(&approvals).map_err(|error| error.to_string())
}

fn resolve_mobile_approval(
    ctx: &Arc<HeadlessGatewayContext>,
    approval_id: &str,
    approved: bool,
) -> Result<String, String> {
    let config = ctx.config();
    if !config.channels.mobile_approve_enabled {
        return Err("Mobile approve is disabled".to_string());
    }
    let pending = ctx
        .take_pending_approval(approval_id)?
        .ok_or_else(|| format!("No pending approval found for {approval_id}"))?;
    let mut bus = ctx.bus.lock().map_err(|error| error.to_string())?;
    let resolution = crate::gateway::orchestrator::GatewayOrchestrator::resolve_approval(
        &pending, approved, &config, &mut bus,
    );
    serde_json::to_string(&resolution).map_err(|error| error.to_string())
}

fn parse_http(raw: &str) -> (String, String, Vec<(String, String)>, String) {
    let mut lines = raw.split("\r\n");
    let request_line = lines.next().unwrap_or_default();
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("GET").to_string();
    let path = parts.next().unwrap_or("/").to_string();

    let mut headers = Vec::new();
    for line in lines.by_ref() {
        if line.is_empty() {
            break;
        }
        if let Some((key, value)) = line.split_once(':') {
            headers.push((key.trim().to_string(), value.trim().to_string()));
        }
    }

    let body = lines.collect::<Vec<_>>().join("\r\n");
    (method, path, headers, body)
}

fn http_response(status: u16, body: &str) -> String {
    let reason = match status {
        200 => "OK",
        400 => "Bad Request",
        401 => "Unauthorized",
        404 => "Not Found",
        _ => "Error",
    };
    format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_post_turn_request() {
        let raw = "POST /turn HTTP/1.1\r\nAuthorization: Bearer secret\r\nContent-Length: 10\r\n\r\n{\"command\":\"hi\",\"channel\":\"ws\"}";
        let (method, path, headers, body) = parse_http(raw);
        assert_eq!(method, "POST");
        assert_eq!(path, "/turn");
        assert!(headers
            .iter()
            .any(|(k, v)| k == "Authorization" && v == "Bearer secret"));
        assert!(body.contains("command"));
    }

    #[test]
    fn health_response_shape() {
        let response = http_response(200, r#"{"ok":true}"#);
        assert!(response.contains("200 OK"));
        assert!(response.contains(r#""ok":true"#));
    }

    #[test]
    fn unauthorized_and_not_found_responses_include_http_contract_headers() {
        let unauthorized = http_response(401, r#"{"error":"unauthorized"}"#);
        assert!(unauthorized.contains("401 Unauthorized"));
        assert!(unauthorized.contains("Content-Type: application/json"));
        assert!(unauthorized.contains("Connection: close"));

        let not_found = http_response(404, r#"{"error":"not found"}"#);
        assert!(not_found.contains("404 Not Found"));
        assert!(not_found.contains(r#""error":"not found""#));
        assert!(not_found.contains("Content-Length: "));
    }

    #[test]
    fn mobile_paths_parse_for_approve_and_deny() {
        let approve = "POST /mobile/approvals/apr-1/approve HTTP/1.1\r\n\r\n";
        let (method, path, _, _) = parse_http(approve);
        assert_eq!(method, "POST");
        let parts: Vec<&str> = path.trim_start_matches('/').split('/').collect();
        assert_eq!(parts, vec!["mobile", "approvals", "apr-1", "approve"]);

        let deny = "POST /mobile/approvals/apr-2/deny HTTP/1.1\r\n\r\n";
        let (_, deny_path, _, _) = parse_http(deny);
        let deny_parts: Vec<&str> = deny_path.trim_start_matches('/').split('/').collect();
        assert_eq!(deny_parts[3], "deny");
    }

    #[test]
    fn mobile_brief_requires_bearer_when_token_configured() {
        let headers = vec![("Authorization".to_string(), "Bearer secret".to_string())];
        assert!(is_authorized(&headers, Some("secret")));
        assert!(!is_authorized(&[], Some("secret")));
        assert!(requires_auth(Some("secret")));
        assert!(!requires_auth(Some("")));
        assert!(!requires_auth(None));
    }

    #[test]
    fn turn_request_body_parses() {
        let raw = "POST /turn HTTP/1.1\r\nContent-Type: application/json\r\nContent-Length: 44\r\n\r\n{\"command\":\"hi\",\"channel\":\"api\"}";
        let (method, path, _, body) = parse_http(raw);
        assert_eq!(method, "POST");
        assert_eq!(path, "/turn");
        let parsed: serde_json::Value = serde_json::from_str(body.trim()).expect("json");
        assert_eq!(parsed["command"], "hi");
        assert_eq!(parsed["channel"], "api");
    }

    #[test]
    fn mobile_brief_response_serializes() {
        let json = serde_json::to_string(&MobileBriefResponse {
            top_three: vec!["Ship planner".into()],
            pending_approval_count: 2,
            next_event: Some("Standup (soon)".into()),
        })
        .expect("serialize");
        assert!(json.contains("topThree"));
        assert!(json.contains("pendingApprovalCount"));
    }
}
