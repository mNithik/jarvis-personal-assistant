use std::io::Write;
use std::process::Command;

pub fn read_clipboard_text() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("powershell")
            .args(["-NoProfile", "-Command", "Get-Clipboard -Raw"])
            .output()
            .map_err(|error| format!("Failed to read clipboard: {}", error))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
        }

        return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Clipboard reading is currently implemented for Windows only.".to_string())
    }
}

pub fn write_clipboard_text(text: &str) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let mut child = Command::new("powershell")
            .args(["-NoProfile", "-Command", "Set-Clipboard"])
            .stdin(std::process::Stdio::piped())
            .spawn()
            .map_err(|error| format!("Failed to write clipboard: {}", error))?;

        if let Some(stdin) = child.stdin.as_mut() {
            stdin
                .write_all(text.as_bytes())
                .map_err(|error| format!("Failed to send clipboard text: {}", error))?;
        }

        let status = child
            .wait()
            .map_err(|error| format!("Failed to wait for clipboard write: {}", error))?;
        if !status.success() {
            return Err("Windows rejected the clipboard update.".to_string());
        }

        return Ok("Copied text to the clipboard.".to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Clipboard writing is currently implemented for Windows only.".to_string())
    }
}
