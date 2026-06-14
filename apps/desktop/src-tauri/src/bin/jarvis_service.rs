//! Windows sidecar: proactive heartbeat + trigger queue worker.
//! Install as a service in Phase 2; run manually with JARVIS_APP_DATA set.

use std::path::PathBuf;
use std::thread;
use std::time::Duration;

fn main() {
    let app_data = std::env::var("JARVIS_APP_DATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            std::env::var("APPDATA")
                .map(|appdata| PathBuf::from(appdata).join("com.jarvis.app"))
                .unwrap_or_else(|_| PathBuf::from("."))
        });
    let db_path = app_data.join("jarvis.db");
    let config = jarvis_lib::gateway::config::load_gateway_config(&app_data);

    eprintln!(
        "jarvis-service running — gateway enabled={}, data={}",
        config.enabled,
        app_data.display()
    );

    loop {
        if config.enabled {
            if let Ok(conn) = rusqlite::Connection::open(&db_path) {
                if let Ok(Some(event)) = jarvis_lib::gateway::trigger_queue::claim_next_trigger(&conn) {
                    eprintln!("Processed trigger {} ({})", event.id, event.kind);
                    let _ = jarvis_lib::gateway::trigger_queue::complete_trigger(&conn, &event.id, true);
                }
            }
            let heartbeat_path = app_data.join("HEARTBEAT.md");
            if heartbeat_path.exists() {
                eprintln!("Heartbeat tick at {}", chrono::Utc::now().to_rfc3339());
            }
        }
        thread::sleep(Duration::from_secs(30));
    }
}
