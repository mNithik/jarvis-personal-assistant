//! Jarvis hosted sync server library — router and storage for integration tests.

use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use axum::{
    body::Bytes,
    extract::State,
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tower_http::cors::CorsLayer;

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Mutex<Connection>>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub label: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterResponse {
    pub device_id: String,
    pub device_token: String,
}

pub fn open_db_from_env() -> Connection {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:jarvis-sync.db".to_string());
    open_db_at_path(url.strip_prefix("sqlite:").unwrap_or(&url))
}

pub fn open_db_at_path(path: &str) -> Connection {
    let conn = Connection::open(path).expect("open database");
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS devices (
            device_id TEXT PRIMARY KEY,
            device_token TEXT NOT NULL,
            label TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS bundles (
            device_id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(device_id) REFERENCES devices(device_id)
        );",
    )
    .expect("migrate");
    conn
}

pub fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/v1/devices/register", post(register_device))
        .route("/v1/sync/bundles", post(upload_bundle))
        .route("/v1/sync/bundles/latest", get(latest_bundle))
        .layer(CorsLayer::permissive())
        .with_state(state)
}

fn auth_device(state: &AppState, headers: &HeaderMap) -> Result<String, (StatusCode, String)> {
    let device_id = headers
        .get("x-jarvis-device-id")
        .and_then(|value| value.to_str().ok())
        .ok_or((StatusCode::BAD_REQUEST, "Missing X-Jarvis-Device-Id".into()))?;
    let auth = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    let token = auth
        .strip_prefix("Bearer ")
        .ok_or((StatusCode::UNAUTHORIZED, "Missing Bearer token".into()))?;
    let conn = state.db.lock().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Database lock poisoned".into(),
        )
    })?;
    let valid: bool = conn
        .query_row(
            "SELECT 1 FROM devices WHERE device_id = ?1 AND device_token = ?2",
            params![device_id, token],
            |_| Ok(true),
        )
        .unwrap_or(false);
    if !valid {
        return Err((StatusCode::UNAUTHORIZED, "Invalid device credentials".into()));
    }
    Ok(device_id.to_string())
}

async fn health() -> impl IntoResponse {
    Json(serde_json::json!({ "status": "ok", "service": "jarvis-sync" }))
}

async fn register_device(
    State(state): State<AppState>,
    Json(body): Json<RegisterRequest>,
) -> Result<Json<RegisterResponse>, (StatusCode, String)> {
    let device_id = format!("jarvis-{}", uuid::Uuid::new_v4());
    let device_token = format!("tok_{}", uuid::Uuid::new_v4());
    let now = chrono::Utc::now().to_rfc3339();
    let conn = state.db.lock().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Database lock poisoned".into(),
        )
    })?;
    conn.execute(
        "INSERT INTO devices (device_id, device_token, label, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![device_id, device_token, body.label, now],
    )
    .map_err(|error| (StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?;
    Ok(Json(RegisterResponse {
        device_id,
        device_token,
    }))
}

async fn upload_bundle(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<StatusCode, (StatusCode, String)> {
    let device_id = auth_device(&state, &headers)?;
    let payload = String::from_utf8(body.to_vec())
        .map_err(|error| (StatusCode::BAD_REQUEST, error.to_string()))?;
    let now = chrono::Utc::now().to_rfc3339();
    let conn = state.db.lock().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Database lock poisoned".into(),
        )
    })?;
    conn.execute(
        "INSERT INTO bundles (device_id, payload, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(device_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at",
        params![device_id, payload, now],
    )
    .map_err(|error| (StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

async fn latest_bundle(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let device_id = auth_device(&state, &headers)?;
    let conn = state.db.lock().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Database lock poisoned".into(),
        )
    })?;
    let payload: Option<String> = conn
        .query_row(
            "SELECT payload FROM bundles WHERE device_id = ?1",
            params![device_id],
            |row| row.get(0),
        )
        .ok();
    match payload {
        Some(blob) => Ok((StatusCode::OK, blob)),
        None => Err((StatusCode::NOT_FOUND, "No bundle stored for device".into())),
    }
}

pub async fn serve(addr: SocketAddr, state: AppState) {
    let app = build_router(state);
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("bind listen address");
    axum::serve(listener, app).await.expect("serve");
}
