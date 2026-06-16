use std::{path::Path, process::Command};

use crate::db::log_action;

#[derive(Clone, Copy)]
pub struct DesktopTarget {
    pub label: &'static str,
    pub target: &'static str,
}

/// During `cargo test`, desktop spawns are skipped so VS Code, Explorer, Calendar, etc.
/// are not left open. Set `JARVIS_DESKTOP_LIVE_TEST=1` to run real open/close integration tests.
pub fn desktop_spawns_disabled() -> bool {
    if !cfg!(test) {
        return false;
    }
    std::env::var("JARVIS_DESKTOP_LIVE_TEST")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
        == false
}

pub fn run_study_setup(db_path: &Path) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let targets = [
            DesktopTarget {
                label: "Google Calendar",
                target: "https://calendar.google.com",
            },
            DesktopTarget {
                label: "Google Docs",
                target: "https://docs.google.com",
            },
            DesktopTarget {
                label: "VS Code",
                target: "code",
            },
            DesktopTarget {
                label: "File Explorer",
                target: "explorer",
            },
        ];

        for target in targets {
            open_windows_target(target)?;
        }

        log_action(
            db_path,
            "Open my study apps",
            "launch_study_setup",
            "success",
            "Google Calendar, Google Docs, VS Code, File Explorer",
        )?;

        Ok(
            "Opened Google Calendar, Google Docs, VS Code, and File Explorer for your study routine."
                .to_string(),
        )
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = db_path;
        Err("Study setup is currently implemented for Windows only.".to_string())
    }
}

pub fn open_named_target(db_path: &Path, name: &str) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Err("No desktop target was provided.".to_string());
        }

        if desktop_spawns_disabled() {
            log_action(
                db_path,
                &format!("Open {trimmed} (test noop)"),
                "open_desktop_target",
                "success",
                trimmed,
            )?;
            return Ok(format!("Opened {} (test noop).", trimmed));
        }

        Command::new("cmd")
            .args(["/C", "start", "", trimmed])
            .spawn()
            .map_err(|error| format!("Failed to open {trimmed}: {error}"))?;

        log_action(
            db_path,
            &format!("Open {trimmed}"),
            "open_desktop_target",
            "success",
            trimmed,
        )?;

        Ok(format!("Opened {}.", trimmed))
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (db_path, name);
        Err("Desktop target opening is currently implemented for Windows only.".to_string())
    }
}

/// Best-effort cleanup for live desktop integration tests (Notepad, Calculator, etc.).
pub fn close_named_target(name: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let normalized = name.trim().to_lowercase();
        let image = match normalized.as_str() {
            "notepad" => Some("notepad.exe"),
            "calculator" | "calc" => Some("CalculatorApp.exe"),
            "chrome" | "google chrome" => Some("chrome.exe"),
            "msedge" | "edge" | "microsoft edge" => Some("msedge.exe"),
            _ => None,
        };
        let Some(image) = image else {
            return Ok(());
        };
        let status = Command::new("taskkill")
            .args(["/IM", image, "/F"])
            .status()
            .map_err(|error| format!("Failed to close {name}: {error}"))?;
        if status.success() {
            Ok(())
        } else {
            Err(format!("No running process matched {image} for close."))
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = name;
        Ok(())
    }
}

#[cfg(target_os = "windows")]
fn open_windows_target(target: DesktopTarget) -> Result<(), String> {
    if desktop_spawns_disabled() {
        return Ok(());
    }

    Command::new("cmd")
        .args(["/C", "start", "", target.target])
        .spawn()
        .map_err(|error| format!("Failed to open {}: {}", target.label, error))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn desktop_spawns_are_noop_under_cargo_test_by_default() {
        assert!(desktop_spawns_disabled());
        let db = std::env::temp_dir().join(format!("jarvis-desktop-noop-{}.db", std::process::id()));
        let _ = std::fs::remove_file(&db);
        crate::db::init_database(&db).expect("init db");
        let reply = open_named_target(&db, "notepad").expect("noop open");
        assert!(reply.contains("test noop"));
        let _ = std::fs::remove_file(db);
    }

    #[test]
    #[ignore = "live Windows integration: set JARVIS_DESKTOP_LIVE_TEST=1"]
    fn live_open_and_close_notepad() {
        std::env::set_var("JARVIS_DESKTOP_LIVE_TEST", "1");
        let db = std::env::temp_dir().join(format!("jarvis-desktop-live-{}.db", std::process::id()));
        let _ = std::fs::remove_file(&db);
        crate::db::init_database(&db).expect("init db");
        open_named_target(&db, "notepad").expect("open notepad");
        std::thread::sleep(std::time::Duration::from_millis(800));
        let _ = close_named_target("notepad");
        let _ = std::fs::remove_file(db);
        std::env::remove_var("JARVIS_DESKTOP_LIVE_TEST");
    }
}
