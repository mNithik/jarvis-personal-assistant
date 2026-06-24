use serde::Serialize;
use std::path::{Component, Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodingCliStatus {
    pub pwsh: bool,
    pub powershell: bool,
    pub claude: bool,
    pub codex: bool,
    pub preferred_shell: String,
}

fn command_exists(name: &str) -> bool {
    #[cfg(windows)]
    {
        Command::new("where")
            .arg(name)
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }
    #[cfg(not(windows))]
    {
        Command::new("which")
            .arg(name)
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }
}

#[tauri::command]
pub fn detect_coding_clis() -> CodingCliStatus {
    let pwsh = command_exists("pwsh");
    let powershell = command_exists("powershell");
    let preferred_shell = if pwsh {
        "pwsh".to_string()
    } else if powershell {
        "powershell".to_string()
    } else {
        "powershell.exe".to_string()
    };

    CodingCliStatus {
        pwsh,
        powershell,
        claude: command_exists("claude"),
        codex: command_exists("codex"),
        preferred_shell,
    }
}

fn path_has_handoff_dir(path: &Path) -> bool {
    path.components().any(|component| {
        matches!(component, Component::Normal(name) if {
            name.to_string_lossy().eq_ignore_ascii_case("jarvis-handoffs")
        })
    })
}

fn is_allowed_handoff_path(path: &Path) -> bool {
    if !path.is_absolute() {
        return false;
    }

    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default();
    if !file_name.ends_with(".md") {
        return false;
    }

    if path_has_handoff_dir(path) {
        return true;
    }

    path.canonicalize()
        .ok()
        .is_some_and(|canonical| path_has_handoff_dir(&canonical))
}

pub fn extract_prompt_from_markdown(markdown: &str) -> Result<String, String> {
    const START: &str = "## Prompt\n\n";
    let start_index = markdown
        .find(START)
        .ok_or_else(|| "Prompt section not found in handoff markdown.".to_string())?
        + START.len();
    let rest = &markdown[start_index..];
    let end = rest
        .find("\n\n## ")
        .or_else(|| rest.find("\n## "))
        .unwrap_or(rest.len());
    Ok(rest[..end].trim().to_string())
}

#[tauri::command]
pub fn read_handoff_markdown(path: String) -> Result<String, String> {
    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        return Err("Handoff file not found.".to_string());
    }
    if !is_allowed_handoff_path(&path_buf) {
        return Err("Handoff path is not allowed.".to_string());
    }

    std::fs::read_to_string(&path_buf).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn read_handoff_prompt(path: String) -> Result<String, String> {
    let markdown = read_handoff_markdown(path)?;
    extract_prompt_from_markdown(&markdown)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn extract_prompt_from_markdown_reads_prompt_section() {
        assert_eq!(
            super::extract_prompt_from_markdown(
                "# Title\n\n## Prompt\n\nBuild the feature.\n\n## Safety Checks\n\n- safe\n"
            )
            .expect("prompt"),
            "Build the feature."
        );
    }

    #[test]
    fn rejects_relative_handoff_paths() {
        assert!(!is_allowed_handoff_path(Path::new(
            "jarvis-handoffs/test.md"
        )));
    }
}
