use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use jarvis_sync::{build_router, open_db_at_path, AppState, RegisterResponse};

#[test]
fn register_upload_and_fetch_bundle() {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    let db_path = std::env::temp_dir().join(format!("jarvis-sync-test-{nanos}.db"));
    let _ = std::fs::remove_file(&db_path);

    let state = AppState {
        db: Arc::new(Mutex::new(open_db_at_path(
            db_path.to_string_lossy().as_ref(),
        ))),
    };
    let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("bind");
    listener.set_nonblocking(true).expect("nonblocking");
    let addr: SocketAddr = listener.local_addr().expect("local addr");
    let app = build_router(state);
    thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("runtime");
        rt.block_on(async {
            let listener = tokio::net::TcpListener::from_std(listener).expect("tokio listener");
            axum::serve(listener, app).await.expect("serve");
        });
    });
    thread::sleep(Duration::from_millis(100));

    let client = reqwest::blocking::Client::new();
    let base = format!("http://{addr}");

    let register: RegisterResponse = client
        .post(format!("{base}/v1/devices/register"))
        .json(&serde_json::json!({ "label": "integration-test" }))
        .send()
        .expect("register")
        .json()
        .expect("register json");

    let bundle = "encrypted-test-bundle";
    let upload = client
        .post(format!("{base}/v1/sync/bundles"))
        .header("Authorization", format!("Bearer {}", register.device_token))
        .header("X-Jarvis-Device-Id", &register.device_id)
        .header("X-Jarvis-Sync-Version", "1")
        .body(bundle.to_string())
        .send()
        .expect("upload");
    assert_eq!(upload.status(), reqwest::StatusCode::NO_CONTENT);

    let latest = client
        .get(format!("{base}/v1/sync/bundles/latest"))
        .header("Authorization", format!("Bearer {}", register.device_token))
        .header("X-Jarvis-Device-Id", &register.device_id)
        .send()
        .expect("latest");
    assert_eq!(latest.status(), reqwest::StatusCode::OK);
    assert_eq!(latest.text().expect("body"), bundle);

    let _ = std::fs::remove_file(db_path);
}
