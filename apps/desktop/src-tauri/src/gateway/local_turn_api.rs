use std::sync::{Arc, Mutex, OnceLock};

use serde::Serialize;
use tauri::{AppHandle, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

use super::{
    channels::parse_local_channel_payload,
    config::GatewayConfig,
    orchestrator::GatewayOrchestrator,
    state::GatewayState,
    types::TurnRequest,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalTurnApiStatus {
    pub listening: bool,
    pub port: u16,
    pub last_error: Option<String>,
    pub last_request_at: Option<String>,
}

struct ApiRuntime {
    status: LocalTurnApiStatus,
    shutdown: bool,
}

static RUNTIME: OnceLock<Arc<Mutex<Option<ApiRuntime>>>> = OnceLock::new();

fn runtime() -> Arc<Mutex<Option<ApiRuntime>>> {
    RUNTIME
        .get_or_init(|| Arc::new(Mutex::new(None)))
        .clone()
}

pub fn get_local_turn_api_status() -> LocalTurnApiStatus {
    runtime()
        .lock()
        .ok()
        .and_then(|guard| guard.as_ref().map(|rt| rt.status.clone()))
        .unwrap_or(LocalTurnApiStatus {
            listening: false,
            port: 18789,
            last_error: None,
            last_request_at: None,
        })
}

pub fn sync_local_turn_api(app: AppHandle) {
    let config = match app.try_state::<GatewayState>() {
        Some(state) => state
            .config
            .lock()
            .map(|config| config.clone())
            .unwrap_or_default(),
        None => return,
    };

    if config.enabled && config.channels.local_ws_enabled {
        spawn_listener(app, &config);
    } else {
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

fn spawn_listener(app: AppHandle, config: &GatewayConfig) {
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
            status: LocalTurnApiStatus {
                listening: true,
                port,
                last_error: None,
                last_request_at: None,
            },
            shutdown: false,
        });
    }

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let addr = format!("127.0.0.1:{port}");
        let listener = match TcpListener::bind(&addr).await {
            Ok(listener) => listener,
            Err(error) => {
                set_error(&format!("Bind failed on {addr}: {error}"));
                return;
            }
        };

        loop {
            if should_shutdown() {
                break;
            }

            let accept = tokio::time::timeout(
                std::time::Duration::from_secs(1),
                listener.accept(),
            )
            .await;

            let Ok(Ok((mut stream, _))) = accept else {
                continue;
            };

            let token = token.clone();
            let app = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                let mut buffer = vec![0u8; 65536];
                let read = stream.read(&mut buffer).await.unwrap_or(0);
                if read == 0 {
                    return;
                }
                let request_text = String::from_utf8_lossy(&buffer[..read]).to_string();
                let response = handle_http_request(&app, &request_text, token.as_deref());
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

fn handle_http_request(app: &AppHandle, raw: &str, token: Option<&str>) -> String {
    let (method, path, headers, body) = parse_http(raw);

    if method == "GET" && path == "/health" {
        return http_response(200, r#"{"ok":true}"#);
    }

    if method != "POST" || path != "/turn" {
        return http_response(404, r#"{"error":"not found"}"#);
    }

    if let Some(expected) = token.filter(|value| !value.is_empty()) {
        let authorized = headers
            .iter()
            .any(|(key, value)| key.eq_ignore_ascii_case("authorization") && value == &format!("Bearer {expected}"));
        if !authorized {
            return http_response(401, r#"{"error":"unauthorized"}"#);
        }
    }

    let channel_request = match parse_local_channel_payload(body.trim()) {
        Ok(request) => request,
        Err(error) => return http_response(400, &format!(r#"{{"error":"{error}"}}"#)),
    };

    match run_channel_turn_internal(app, channel_request.into()) {
        Ok(response) => {
            let json = serde_json::to_string(&response).unwrap_or_else(|_| "{}".to_string());
            http_response(200, &json)
        }
        Err(error) => http_response(500, &format!(r#"{{"error":"{error}"}}"#)),
    }
}

pub fn run_channel_turn_internal(
    app: &AppHandle,
    turn_request: TurnRequest,
) -> Result<crate::gateway::orchestrator::GatewayTurnResponse, String> {
    let gateway_state = app
        .try_state::<GatewayState>()
        .ok_or_else(|| "Gateway state unavailable".to_string())?;
    let app_state = app
        .try_state::<crate::AppState>()
        .ok_or_else(|| "App state unavailable".to_string())?;

    let config = gateway_state
        .config
        .lock()
        .map_err(|error| error.to_string())?
        .clone();

    if !config.enabled {
        return Err("Gateway is disabled".to_string());
    }

    let session_id = turn_request
        .session_id
        .clone()
        .unwrap_or_else(|| "local-api".to_string());
    let turn_id = gateway_state.next_turn_id(&session_id)?;

    let router_context = crate::gateway::router::RouterContext {
        db_path: Some(app_state.db_path.clone()),
        config: config.clone(),
    };

    let mut bus = gateway_state.bus.lock().map_err(|error| error.to_string())?;
    let mut escalation = gateway_state
        .escalation
        .lock()
        .map_err(|error| error.to_string())?;

    Ok(GatewayOrchestrator::run_turn(
        turn_request,
        turn_id,
        &session_id,
        &config,
        &router_context,
        &mut bus,
        None,
        Some(crate::gateway::orchestrator::TurnExecutionEnv {
            db_path: &app_state.db_path,
            app_data_dir: &app_state.app_data_dir,
            escalation: &mut escalation,
        }),
    ))
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
}
