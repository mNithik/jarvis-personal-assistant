use std::{
    fs,
    path::{Path, PathBuf},
    time::SystemTime,
};

use crate::models::FileRecord;

pub fn user_documents_dir() -> Result<PathBuf, String> {
    let user_profile = std::env::var("USERPROFILE")
        .map_err(|error| format!("Could not resolve USERPROFILE for file search: {}", error))?;
    Ok(Path::new(&user_profile).join("Documents"))
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
