use std::path::{Path, PathBuf};
use std::process::Command;

pub fn resolve_jarvis_project_dir(start: &Path) -> Result<PathBuf, String> {
    let mut dir = start.to_path_buf();
    loop {
        if dir.join("package.json").is_file() && dir.join("src-tauri").join("Cargo.toml").is_file()
        {
            return Ok(dir);
        }
        if !dir.pop() {
            break;
        }
    }
    Err(format!(
        "Could not find JARVIS project root from {}",
        start.display()
    ))
}

pub fn run_project_checks(project_dir: &Path) -> Result<String, String> {
    let manifest_path = project_dir.join("src-tauri").join("Cargo.toml");
    let manifest_arg = manifest_path.to_string_lossy().into_owned();

    let tsc_output = Command::new("npm")
        .args(["exec", "tsc", "--noEmit"])
        .current_dir(project_dir)
        .output()
        .map_err(|error| format!("Failed to run TypeScript checks: {}", error))?;

    let cargo_output = Command::new("cargo")
        .args(["check", "-j", "1", "--manifest-path", &manifest_arg])
        .current_dir(project_dir)
        .output()
        .map_err(|error| format!("Failed to run Rust checks: {}", error))?;

    let tsc_stdout = String::from_utf8_lossy(&tsc_output.stdout);
    let tsc_stderr = String::from_utf8_lossy(&tsc_output.stderr);
    let cargo_stdout = String::from_utf8_lossy(&cargo_output.stdout);
    let cargo_stderr = String::from_utf8_lossy(&cargo_output.stderr);
    let summary = format!(
        "TypeScript: {}\n{}\n{}\nRust: {}\n{}\n{}",
        if tsc_output.status.success() {
            "passed"
        } else {
            "failed"
        },
        tsc_stdout.trim(),
        tsc_stderr.trim(),
        if cargo_output.status.success() {
            "passed"
        } else {
            "failed"
        },
        cargo_stdout.trim(),
        cargo_stderr.trim(),
    );

    if !tsc_output.status.success() || !cargo_output.status.success() {
        return Err(summary);
    }

    Ok(summary)
}

pub fn checks_succeeded(summary: &str) -> bool {
    summary.contains("TypeScript: passed") && summary.contains("Rust: passed")
}
