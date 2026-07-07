//! Jarvis hosted sync server binary.

use std::net::SocketAddr;

use jarvis_sync::{open_db_from_env, serve, AppState};
use std::sync::{Arc, Mutex};

#[tokio::main]
async fn main() {
    let bind = std::env::var("JARVIS_SYNC_BIND").unwrap_or_else(|_| "127.0.0.1:8787".to_string());
    let addr: SocketAddr = bind.parse().expect("valid JARVIS_SYNC_BIND");
    let state = AppState {
        db: Arc::new(Mutex::new(open_db_from_env())),
    };
    println!("jarvis-sync listening on http://{addr}");
    serve(addr, state).await;
}
