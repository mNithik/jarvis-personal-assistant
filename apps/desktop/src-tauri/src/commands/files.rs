use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::SystemTime,
};

use crate::models::FileRecord;

pub fn user_documents_dir() -> Result<PathBuf, String> {
    let user_profile = std::env::var("USERPROFILE")
        .map_err(|error| format!("Could not resolve USERPROFILE for file search: {}", error))?;
    Ok(Path::new(&user_profile).join("Documents"))
}

pub fn list_recent_local_files(limit: usize) -> Result<Vec<FileRecord>, String> {
    let base_dir = user_documents_dir()?;
    let mut files = Vec::new();
    collect_files_recursively(&base_dir, &mut files)?;
    files.sort_by(|left, right| right.modified_at.cmp(&left.modified_at));
    files.truncate(limit);
    Ok(files)
}

pub fn search_local_files(query: &str) -> Result<Vec<FileRecord>, String> {
    let base_dir = user_documents_dir()?;
    let normalized_query = query.trim().to_lowercase();
    if normalized_query.is_empty() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    collect_files_recursively(&base_dir, &mut files)?;
    files.retain(|file| file.name.to_lowercase().contains(&normalized_query));
    files.sort_by(|left, right| right.modified_at.cmp(&left.modified_at));
    files.truncate(10);
    Ok(files)
}

fn collect_files_recursively(base_dir: &Path, files: &mut Vec<FileRecord>) -> Result<(), String> {
    if !base_dir.exists() {
        return Ok(());
    }

    let entries = fs::read_dir(base_dir).map_err(|error| error.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        let metadata = entry.metadata().map_err(|error| error.to_string())?;

        if metadata.is_dir() {
            collect_files_recursively(&path, files)?;
            continue;
        }

        if !metadata.is_file() {
            continue;
        }

        let modified_at = metadata
            .modified()
            .unwrap_or(SystemTime::UNIX_EPOCH)
            .duration_since(SystemTime::UNIX_EPOCH)
            .map(|duration| duration.as_secs().to_string())
            .unwrap_or_else(|_| "0".to_string());

        let name = path
            .file_name()
            .map(|value| value.to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string_lossy().to_string());

        files.push(FileRecord {
            name,
            path: path.to_string_lossy().to_string(),
            modified_at,
        });
    }

    Ok(())
}

pub fn list_pdf_files() -> Result<Vec<FileRecord>, String> {
    let base_dir = user_documents_dir()?;
    let mut files = Vec::new();
    collect_files_recursively(&base_dir, &mut files)?;
    files.retain(|file| file.name.to_lowercase().ends_with(".pdf"));
    files.sort_by(|left, right| right.modified_at.cmp(&left.modified_at));
    Ok(files)
}

pub fn search_pdf_files(query: &str) -> Result<Vec<FileRecord>, String> {
    let normalized_query = query.trim().to_lowercase();
    if normalized_query.is_empty() {
        return Ok(Vec::new());
    }
    let mut files = list_pdf_files()?;
    files.retain(|file| file.name.to_lowercase().contains(&normalized_query));
    files.truncate(10);
    Ok(files)
}

pub fn open_file_path(path: &str) -> Result<String, String> {
    let file_path = PathBuf::from(path.trim());
    if !file_path.exists() {
        return Err("That file path does not exist anymore.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", file_path.to_string_lossy().as_ref()])
            .spawn()
            .map_err(|error| format!("Failed to open file: {}", error))?;
        return Ok(format!("Opened {}", file_path.to_string_lossy()));
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Local file opening is currently implemented for Windows only.".to_string())
    }
}

pub fn extract_pdf_text(path: &str) -> Result<String, String> {
    let file_path = PathBuf::from(path.trim());
    if !file_path.exists() {
        return Err("That PDF path does not exist.".to_string());
    }

    let extension = file_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_lowercase();
    if extension != "pdf" {
        return Err("That file is not a PDF.".to_string());
    }

    pdf_extract::extract_text(&file_path)
        .map(clean_pdf_text)
        .map_err(|error| format!("Could not read PDF text: {}", error))
}

fn clean_pdf_text(text: String) -> String {
    let mut cleaned = text.replace('\u{0}', " ").replace("\r\n", "\n");
    while cleaned.contains(" \n") || cleaned.contains("\t\n") {
        cleaned = cleaned.replace(" \n", "\n").replace("\t\n", "\n");
    }
    while cleaned.contains("\n\n\n") {
        cleaned = cleaned.replace("\n\n\n", "\n\n");
    }
    while cleaned.contains("  ") {
        cleaned = cleaned.replace("  ", " ");
    }
    cleaned.trim().to_string()
}

pub fn summarize_pdf_text(file_name: &str, text: &str) -> String {
    let cleaned = clean_pdf_text(text.to_string());
    let mut sentences = Vec::new();
    let mut current = String::new();
    for ch in cleaned.chars() {
        current.push(ch);
        if matches!(ch, '.' | '!' | '?') {
            let trimmed = current.trim().to_string();
            if trimmed.len() > 20 {
                sentences.push(trimmed);
            }
            current.clear();
            if sentences.len() >= 5 {
                break;
            }
        }
    }
    if sentences.len() < 5 {
        let trimmed = current.trim().to_string();
        if trimmed.len() > 20 {
            sentences.push(trimmed);
        }
    }

    let mut lines = vec![format!("PDF Summary: {file_name}"), String::new()];
    if sentences.is_empty() {
        lines.push("No readable summary content was extracted.".to_string());
    } else {
        for (index, sentence) in sentences.iter().enumerate() {
            lines.push(format!("{}. {sentence}", index + 1));
        }
    }
    lines.join("\n")
}

pub fn format_file_listing(files: &[FileRecord], label: &str) -> String {
    if files.is_empty() {
        return format!("No {label} found.");
    }
    let listing = files
        .iter()
        .enumerate()
        .map(|(index, file)| format!("{}. {} ({})", index + 1, file.name, file.path))
        .collect::<Vec<_>>()
        .join("\n");
    format!("{label}:\n{listing}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_recent_local_files_respects_limit() {
        let files = list_recent_local_files(3).expect("list recent files");
        assert!(files.len() <= 3);
    }

    #[test]
    fn list_recent_local_files_sorted_by_modified_desc() {
        let files = list_recent_local_files(10).expect("list recent files");
        for pair in files.windows(2) {
            assert!(pair[0].modified_at >= pair[1].modified_at);
        }
    }

    #[test]
    fn summarize_pdf_text_picks_sentences() {
        let summary = super::summarize_pdf_text(
            "report.pdf",
            "Short. This is a much longer sentence that should appear in the summary. Another long sentence follows here for testing.",
        );
        assert!(summary.contains("PDF Summary: report.pdf"));
        assert!(summary.contains("1."));
    }
}
