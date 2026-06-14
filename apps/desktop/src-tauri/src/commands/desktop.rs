use std::{path::Path, process::Command};

use crate::db::log_action;

#[derive(Clone, Copy)]
pub struct DesktopTarget {
    pub label: &'static str,
    pub target: &'static str,
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

#[cfg(target_os = "windows")]
fn open_windows_target(target: DesktopTarget) -> Result<(), String> {
    Command::new("cmd")
        .args(["/C", "start", "", target.target])
        .spawn()
        .map_err(|error| format!("Failed to open {}: {}", target.label, error))?;
    Ok(())
}
