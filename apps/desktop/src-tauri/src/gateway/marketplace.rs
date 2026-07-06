//! T17-F marketplace — catalog discovery and skill install into `app_data/skills/`.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::skills::{self, SkillManifest};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceCatalogEntry {
    pub id: String,
    pub label: String,
    pub version: String,
    pub description: String,
    pub keywords: Vec<String>,
    pub source_path: String,
    pub operator_lane: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceInstallResult {
    pub skill_id: String,
    pub installed_path: String,
    pub message: String,
}

fn catalog_path() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("marketplace").join("catalog.json")
}

fn bundled_skill_root(relative: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join(relative)
}

pub fn list_marketplace_catalog() -> Result<Vec<MarketplaceCatalogEntry>, String> {
    let path = catalog_path();
    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("Failed to read marketplace catalog: {error}"))?;
    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

fn copy_dir_recursive(source: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir_all(target).map_err(|error| error.to_string())?;
    for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        let dest = target.join(entry.file_name());
        if file_type.is_dir() {
            copy_dir_recursive(&entry.path(), &dest)?;
        } else {
            fs::copy(entry.path(), dest).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

pub fn install_marketplace_skill(
    db_path: &Path,
    app_data_dir: &Path,
    skill_id: &str,
) -> Result<MarketplaceInstallResult, String> {
    let entry = list_marketplace_catalog()?
        .into_iter()
        .find(|item| item.id == skill_id)
        .ok_or_else(|| format!("Marketplace skill \"{skill_id}\" was not found."))?;

    let source_root = bundled_skill_root(&entry.source_path);
    if !source_root.join("skill.json").exists() {
        return Err(format!(
            "Marketplace source for \"{skill_id}\" is missing skill.json at {}",
            source_root.display()
        ));
    }

    let raw = fs::read_to_string(source_root.join("skill.json")).map_err(|error| error.to_string())?;
    let manifest: SkillManifest = serde_json::from_str(&raw).map_err(|error| error.to_string())?;
    skills::validate_manifest(&manifest)?;
    if manifest.id != entry.id {
        return Err(format!(
            "Catalog id \"{}\" does not match manifest id \"{}\".",
            entry.id, manifest.id
        ));
    }

    let target_root = skills::skills_root(app_data_dir).join(&manifest.id);
    if target_root.exists() {
        fs::remove_dir_all(&target_root).map_err(|error| error.to_string())?;
    }
    copy_dir_recursive(&source_root, &target_root)?;

    let _ = db_path;
    Ok(MarketplaceInstallResult {
        skill_id: manifest.id,
        installed_path: target_root.display().to_string(),
        message: format!(
            "Installed marketplace skill \"{}\" v{} into app_data/skills.",
            manifest.label, manifest.version
        ),
    })
}

pub fn operator_lane_summary(skill_id: &str) -> Result<String, String> {
    let entry = list_marketplace_catalog()?
        .into_iter()
        .find(|item| item.id == skill_id)
        .ok_or_else(|| format!("Marketplace skill \"{skill_id}\" was not found."))?;
    let lane = entry
        .operator_lane
        .unwrap_or_else(|| "general".to_string());
    Ok(format!(
        "Operator lane for {}: {lane}. Use project bundle pilot surfaces after manual lab sign-off.",
        entry.label
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_database;
    use crate::gateway::profiles::seed_default_profiles;

    #[test]
    fn marketplace_catalog_lists_bundled_skills() {
        let catalog = list_marketplace_catalog().expect("catalog");
        assert!(!catalog.is_empty());
        assert!(catalog.iter().any(|entry| entry.id == "hello"));
    }

    #[test]
    fn installs_catalog_skill_into_app_data() {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let db_path = std::env::temp_dir().join(format!("jarvis-market-db-{nanos}.db"));
        let app_data_dir = std::env::temp_dir().join(format!("jarvis-market-app-{nanos}"));
        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_dir_all(&app_data_dir);
        std::fs::create_dir_all(&app_data_dir).expect("dir");
        init_database(&db_path).expect("db");
        seed_default_profiles(&db_path, &app_data_dir).expect("profiles");

        let result = install_marketplace_skill(&db_path, &app_data_dir, "hello").expect("install");
        assert_eq!(result.skill_id, "hello");
        assert!(Path::new(&result.installed_path).join("skill.json").exists());

        let listed = skills::list_installed_skills(&db_path, &app_data_dir).expect("list");
        assert!(listed.iter().any(|skill| skill.id == "hello"));

        let _ = std::fs::remove_file(db_path);
        let _ = std::fs::remove_dir_all(app_data_dir);
    }
}
