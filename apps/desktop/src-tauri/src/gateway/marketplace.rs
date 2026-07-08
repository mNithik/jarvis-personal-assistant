//! T17-F marketplace — catalog discovery and skill install into `app_data/skills/`.

use std::fs;
use std::path::{Path, PathBuf};

use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;

use super::skills::{self, SkillManifest};

type HmacSha256 = Hmac<Sha256>;

const DEFAULT_REMOTE_CATALOG_URL: &str =
    "https://raw.githubusercontent.com/mNithik/jarvis-personal-assistant/main/apps/desktop/src-tauri/marketplace/catalog.json";

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
    pub catalog_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SignedMarketplaceCatalog {
    entries: Vec<MarketplaceCatalogEntry>,
    #[serde(rename = "mac")]
    mac: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillPublishPackage {
    pub skill_id: String,
    pub version: String,
    pub package_path: String,
    pub catalog_entry_json: String,
    pub instructions: String,
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

fn bundled_catalog() -> Result<Vec<MarketplaceCatalogEntry>, String> {
    let path = catalog_path();
    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("Failed to read marketplace catalog: {error}"))?;
    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

fn remote_catalog_cache_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("marketplace").join("remote-catalog.json")
}

fn remote_catalog_url() -> Option<String> {
    std::env::var("JARVIS_MARKETPLACE_CATALOG_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| Some(DEFAULT_REMOTE_CATALOG_URL.to_string()))
}

fn catalog_signing_secret() -> Option<String> {
    std::env::var("JARVIS_MARKETPLACE_CATALOG_SECRET")
        .ok()
        .filter(|value| !value.trim().is_empty())
}

fn compute_catalog_mac(entries: &[MarketplaceCatalogEntry], secret: &str) -> Result<String, String> {
    let payload = serde_json::to_string(entries).map_err(|error| error.to_string())?;
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .map_err(|error| error.to_string())?;
    mac.update(payload.as_bytes());
    Ok(STANDARD.encode(mac.finalize().into_bytes()))
}

fn verify_catalog_mac(entries: &[MarketplaceCatalogEntry], mac: &str) -> Result<(), String> {
    let secret = catalog_signing_secret()
        .ok_or_else(|| "Remote catalog is signed but JARVIS_MARKETPLACE_CATALOG_SECRET is not set.".to_string())?;
    let expected = compute_catalog_mac(entries, &secret)?;
    if expected != mac.trim() {
        return Err("Remote marketplace catalog signature verification failed.".to_string());
    }
    Ok(())
}

fn parse_remote_catalog(raw: &str) -> Result<Vec<MarketplaceCatalogEntry>, String> {
    if let Ok(signed) = serde_json::from_str::<SignedMarketplaceCatalog>(raw) {
        if let Some(mac) = signed.mac.as_deref() {
            verify_catalog_mac(&signed.entries, mac)?;
        }
        return Ok(signed.entries);
    }
    let entries: Vec<MarketplaceCatalogEntry> =
        serde_json::from_str(raw).map_err(|error| error.to_string())?;
    if catalog_signing_secret().is_some() {
        return Err(
            "Remote catalog must use signed wrapper { entries, mac } when JARVIS_MARKETPLACE_CATALOG_SECRET is set.".into(),
        );
    }
    Ok(entries)
}

pub fn refresh_remote_catalog_cache(app_data_dir: &Path) -> Result<Vec<MarketplaceCatalogEntry>, String> {
    let url = remote_catalog_url().ok_or_else(|| "Remote catalog URL is not configured.".to_string())?;
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|error| error.to_string())?;
    let response = client
        .get(&url)
        .send()
        .map_err(|error| format!("Failed to fetch remote catalog: {error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "Remote catalog returned HTTP {}",
            response.status()
        ));
    }
    let raw = response.text().map_err(|error| error.to_string())?;
    let entries = parse_remote_catalog(&raw)?;
    for entry in &entries {
        if entry.id.trim().is_empty() || entry.source_path.trim().is_empty() {
            return Err("Remote catalog entry is missing id or sourcePath.".to_string());
        }
    }
    let cache_dir = app_data_dir.join("marketplace");
    fs::create_dir_all(&cache_dir).map_err(|error| error.to_string())?;
    fs::write(remote_catalog_cache_path(app_data_dir), &raw)
        .map_err(|error| error.to_string())?;
    Ok(entries)
}

fn load_cached_remote_catalog(app_data_dir: &Path) -> Option<Vec<MarketplaceCatalogEntry>> {
    let path = remote_catalog_cache_path(app_data_dir);
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

pub fn list_marketplace_catalog_for_app(
    app_data_dir: &Path,
) -> Result<Vec<MarketplaceCatalogEntry>, String> {
    let mut merged = bundled_catalog()?;
    if let Ok(remote) = refresh_remote_catalog_cache(app_data_dir) {
        for entry in remote {
            if let Some(existing) = merged.iter_mut().find(|item| item.id == entry.id) {
                *existing = entry;
            } else {
                merged.push(entry);
            }
        }
    } else if let Some(cached) = load_cached_remote_catalog(app_data_dir) {
        for entry in cached {
            if let Some(existing) = merged.iter_mut().find(|item| item.id == entry.id) {
                *existing = entry;
            } else {
                merged.push(entry);
            }
        }
    }
    merged.sort_by(|left, right| left.id.cmp(&right.id));
    Ok(merged)
}

pub fn list_marketplace_catalog() -> Result<Vec<MarketplaceCatalogEntry>, String> {
    bundled_catalog()
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
    let entry = list_marketplace_catalog_for_app(app_data_dir)?
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

pub fn operator_lane_summary(skill_id: &str, app_data_dir: &Path) -> Result<String, String> {
    let entry = list_marketplace_catalog_for_app(app_data_dir)?
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

pub fn prepare_skill_publish(
    app_data_dir: &Path,
    skill_id: &str,
) -> Result<SkillPublishPackage, String> {
    let skill_root = skills::skills_root(app_data_dir).join(skill_id);
    if !skill_root.join("skill.json").exists() {
        return Err(format!(
            "Installed skill \"{skill_id}\" was not found under app_data/skills."
        ));
    }
    let raw = fs::read_to_string(skill_root.join("skill.json")).map_err(|error| error.to_string())?;
    let manifest: SkillManifest = serde_json::from_str(&raw).map_err(|error| error.to_string())?;
    skills::validate_manifest(&manifest)?;

    let publish_dir = app_data_dir.join("publish").join(&manifest.id);
    if publish_dir.exists() {
        fs::remove_dir_all(&publish_dir).map_err(|error| error.to_string())?;
    }
    copy_dir_recursive(&skill_root, &publish_dir)?;
    let package_path = publish_dir;

    let catalog_entry = MarketplaceCatalogEntry {
        id: manifest.id.clone(),
        label: manifest.label.clone(),
        version: manifest.version.clone(),
        description: format!("Published skill {}", manifest.label),
        keywords: manifest.keywords.clone(),
        source_path: format!("../tests/fixtures/skills/{}", manifest.id),
        operator_lane: Some("command".to_string()),
        catalog_version: Some(manifest.version.clone()),
    };
    let catalog_entry_json =
        serde_json::to_string_pretty(&catalog_entry).map_err(|error| error.to_string())?;

    let instructions = format!(
        "1. Copy {} to your catalog repo.\n2. Add source_path pointing at the skill fixture or hosted bundle.\n3. If using signed catalogs, wrap entries with mac via JARVIS_MARKETPLACE_CATALOG_SECRET.\n4. Open a PR to update marketplace/catalog.json.",
        package_path.display()
    );

    Ok(SkillPublishPackage {
        skill_id: manifest.id,
        version: manifest.version,
        package_path: package_path.display().to_string(),
        catalog_entry_json,
        instructions,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_database;
    use crate::gateway::profiles::seed_default_profiles;

    #[test]
    fn signed_remote_catalog_requires_valid_mac_when_secret_set() {
        let entries = vec![MarketplaceCatalogEntry {
            id: "hello".into(),
            label: "Hello".into(),
            version: "1.0.0".into(),
            description: "test".into(),
            keywords: vec!["hello".into()],
            source_path: "../tests/fixtures/skills/hello".into(),
            operator_lane: None,
            catalog_version: None,
        }];
        std::env::set_var("JARVIS_MARKETPLACE_CATALOG_SECRET", "test-secret");
        let mac = compute_catalog_mac(&entries, "test-secret").expect("mac");
        let raw = serde_json::to_string(&SignedMarketplaceCatalog {
            entries: entries.clone(),
            mac: Some(mac),
        })
        .expect("json");
        let parsed = parse_remote_catalog(&raw).expect("parse");
        assert_eq!(parsed.len(), 1);
        std::env::remove_var("JARVIS_MARKETPLACE_CATALOG_SECRET");
    }

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
