//! Windows sidecar: proactive heartbeat + trigger queue worker + channel ingress.
//! Console: `jarvis-service --console` or set `JARVIS_SERVICE_CONSOLE=1`.
//! Install: `apps/desktop/scripts/install-jarvis-service.ps1`

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use jarvis_lib::gateway::runtime::headless::HeadlessGatewayContext;

fn resolve_app_data() -> PathBuf {
    std::env::var("JARVIS_APP_DATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            std::env::var("APPDATA")
                .map(|appdata| PathBuf::from(appdata).join("com.jarvis.app"))
                .unwrap_or_else(|_| PathBuf::from("."))
        })
}

fn run_service_loop() {
    let app_data = resolve_app_data();
    let db_path = app_data.join("jarvis.db");
    let _ = jarvis_lib::init_database(&db_path);

    let ctx = Arc::new(HeadlessGatewayContext::new(app_data, db_path));
    jarvis_lib::gateway::discord::sync_discord_bot_headless(ctx.clone());
    jarvis_lib::gateway::telegram::sync_telegram_bot_headless(ctx.clone());

    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("tokio runtime");

    runtime.block_on(async {
        loop {
            ctx.reload_config();
            if ctx.config().enabled {
                let _ = ctx.run_proactive_tick_headless();
            }
            tokio::time::sleep(Duration::from_secs(30)).await;
        }
    });
}

#[cfg(windows)]
mod windows {
    use super::*;
    use std::ffi::OsString;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    use std::time::Duration as StdDuration;
    use windows_service::{
        define_windows_service,
        service::{
            ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus,
            ServiceType,
        },
        service_control_handler::{self, ServiceControlHandlerResult},
        service_dispatcher,
    };

    define_windows_service!(ffi_service_main, service_main);

    pub fn run() {
        if std::env::var("JARVIS_SERVICE_CONSOLE")
            .map(|value| value == "1")
            .unwrap_or(false)
            || std::env::args().any(|arg| arg == "--console")
        {
            run_service_loop();
            return;
        }

        if let Err(error) = service_dispatcher::start("jarvis-service", ffi_service_main) {
            eprintln!("jarvis-service SCM dispatch failed: {error}. Running console loop.");
            run_service_loop();
        }
    }

    fn service_main(_arguments: Vec<OsString>) {
        let shutdown = Arc::new(AtomicBool::new(false));
        let shutdown_flag = shutdown.clone();

        let event_handler = move |control_event| -> ServiceControlHandlerResult {
            match control_event {
                ServiceControl::Stop | ServiceControl::Shutdown => {
                    shutdown_flag.store(true, Ordering::SeqCst);
                    ServiceControlHandlerResult::NoError
                }
                ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
                _ => ServiceControlHandlerResult::NotImplemented,
            }
        };

        let status_handle =
            service_control_handler::register("jarvis-service", event_handler).expect("handler");

        let _ = status_handle.set_service_status(ServiceStatus {
            service_type: ServiceType::OWN_PROCESS,
            current_state: ServiceState::Running,
            controls_accepted: ServiceControlAccept::STOP | ServiceControlAccept::SHUTDOWN,
            exit_code: ServiceExitCode::Win32(0),
            checkpoint: 0,
            wait_hint: StdDuration::from_secs(30),
            process_id: None,
        });

        std::env::set_var("JARVIS_SERVICE_CONSOLE", "1");
        let worker = std::thread::spawn(run_service_loop);

        while !shutdown.load(Ordering::SeqCst) {
            std::thread::sleep(StdDuration::from_secs(1));
        }

        let app_data = resolve_app_data();
        HeadlessGatewayContext::new(app_data.clone(), app_data.join("jarvis.db")).clear_service_status();

        let _ = status_handle.set_service_status(ServiceStatus {
            service_type: ServiceType::OWN_PROCESS,
            current_state: ServiceState::Stopped,
            controls_accepted: ServiceControlAccept::empty(),
            exit_code: ServiceExitCode::Win32(0),
            checkpoint: 0,
            wait_hint: StdDuration::default(),
            process_id: None,
        });

        let _ = worker.join();
    }
}

fn main() {
    #[cfg(windows)]
    windows::run();

    #[cfg(not(windows))]
    run_service_loop();
}
