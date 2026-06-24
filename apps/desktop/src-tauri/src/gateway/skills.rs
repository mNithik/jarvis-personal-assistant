use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillManifest {
    pub id: String,
    pub version: String,
    pub label: String,
    pub keywords: Vec<String>,
    pub agent: String,
    pub permissions: Vec<String>,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub handler: SkillHandler,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SkillHandler {
    #[serde(rename = "http")]
    Http { url: String, method: String },
    #[serde(rename = "script")]
    Script { command: String },
    #[serde(rename = "wasm")]
    Wasm {
        module: String,
        #[serde(default)]
        entrypoint: Option<String>,
    },
    #[serde(rename = "route")]
    Route { capability_id: String },
}

impl Default for SkillHandler {
    fn default() -> Self {
        Self::Route {
            capability_id: "command.general".to_string(),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledSkillRecord {
    pub id: String,
    pub version: String,
    pub label: String,
    pub enabled: bool,
    pub keywords: Vec<String>,
    pub source_scope: String,
    pub profile_id: Option<String>,
}

#[derive(Debug, Clone)]
struct LoadedSkillRecord {
    manifest: SkillManifest,
    skill_root: PathBuf,
    source_scope: String,
    profile_id: Option<String>,
}

static SKILL_CACHE: OnceLock<Mutex<HashMap<String, SkillManifest>>> = OnceLock::new();

fn cache() -> &'static Mutex<HashMap<String, SkillManifest>> {
    SKILL_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn skills_root(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("skills")
}

fn profile_skills_root(app_data_dir: &Path, profile_id: &str) -> PathBuf {
    skills_root(app_data_dir).join(profile_id)
}

pub fn validate_manifest(manifest: &SkillManifest) -> Result<(), String> {
    validate_manifest_common(manifest)?;
    validate_handler_manifest(manifest)
}

fn validate_manifest_common(manifest: &SkillManifest) -> Result<(), String> {
    if manifest.id.trim().is_empty() {
        return Err("skill id is required".to_string());
    }
    if manifest.keywords.is_empty() {
        return Err("skill keywords are required".to_string());
    }
    if manifest.version.trim().is_empty() {
        return Err("skill version is required".to_string());
    }
    Ok(())
}

fn validate_manifest_at_root(manifest: &SkillManifest, skill_root: &Path) -> Result<(), String> {
    validate_manifest_common(manifest)?;
    validate_handler_manifest_at_root(manifest, skill_root)
}

fn has_permission(permissions: &[String], required: &str) -> bool {
    permissions
        .iter()
        .any(|permission| permission.eq_ignore_ascii_case(required))
}

fn validate_handler_manifest(manifest: &SkillManifest) -> Result<(), String> {
    match &manifest.handler {
        SkillHandler::Route { .. } => Ok(()),
        SkillHandler::Http { url, method } => validate_http_handler(manifest, url, method),
        SkillHandler::Script { command } => validate_script_handler(manifest, command),
        SkillHandler::Wasm { .. } => Ok(()),
    }
}

fn validate_handler_manifest_at_root(
    manifest: &SkillManifest,
    skill_root: &Path,
) -> Result<(), String> {
    match &manifest.handler {
        SkillHandler::Route { .. } => Ok(()),
        SkillHandler::Http { url, method } => validate_http_handler(manifest, url, method),
        SkillHandler::Script { command } => validate_script_handler(manifest, command),
        SkillHandler::Wasm { module, entrypoint } => {
            let export = entrypoint.as_deref().unwrap_or("run");
            crate::builder::validate_wasm_artifact(skill_root, module, export).map(|_| ())
        }
    }
}

fn validate_http_handler(manifest: &SkillManifest, url: &str, method: &str) -> Result<(), String> {
    if !has_permission(&manifest.permissions, "read") {
        return Err(format!(
            "Installed skill \"{}\" v{} needs read permission for HTTP handlers.",
            manifest.label, manifest.version
        ));
    }
    if !method.eq_ignore_ascii_case("GET") {
        return Err(format!(
            "Installed skill \"{}\" v{} only supports local GET HTTP handlers in v2 MVP.",
            manifest.label, manifest.version
        ));
    }
    let parsed = reqwest::Url::parse(url).map_err(|error| {
        format!(
            "Installed skill \"{}\" v{} has an invalid HTTP url: {}.",
            manifest.label, manifest.version, error
        )
    })?;
    let Some(host) = parsed.host_str() else {
        return Err(format!(
            "Installed skill \"{}\" v{} must target a local host.",
            manifest.label, manifest.version
        ));
    };
    if !matches!(host, "localhost" | "127.0.0.1" | "::1") {
        return Err(format!(
            "Installed skill \"{}\" v{} only allows local HTTP targets right now.",
            manifest.label, manifest.version
        ));
    }
    Ok(())
}

fn validate_script_handler(manifest: &SkillManifest, command: &str) -> Result<(), String> {
    if !has_permission(&manifest.permissions, "execute") {
        return Err(format!(
            "Installed skill \"{}\" v{} needs execute permission for script handlers.",
            manifest.label, manifest.version
        ));
    }
    if ["&&", "||", "|", ">", "<", ";"]
        .iter()
        .any(|token| command.contains(token))
    {
        return Err(format!(
            "Installed skill \"{}\" v{} script command is unsafe for v2 MVP execution.",
            manifest.label, manifest.version
        ));
    }
    let parts = command.split_whitespace().collect::<Vec<_>>();
    if parts.is_empty() {
        return Err(format!(
            "Installed skill \"{}\" v{} script handler is empty.",
            manifest.label, manifest.version
        ));
    }
    if !matches!(
        parts[0].to_ascii_lowercase().as_str(),
        "cmd" | "powershell" | "pwsh"
    ) {
        return Err(format!(
            "Installed skill \"{}\" v{} script handlers must start with cmd, powershell, or pwsh in v2 MVP.",
            manifest.label, manifest.version
        ));
    }
    Ok(())
}

fn load_skill_manifests_from_root(root: &Path) -> Result<Vec<(SkillManifest, PathBuf)>, String> {
    if !root.exists() {
        return Ok(Vec::new());
    }

    let mut manifests = Vec::new();
    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry
            .file_type()
            .map_err(|error| error.to_string())?
            .is_dir()
        {
            continue;
        }
        let manifest_path = entry.path().join("skill.json");
        if !manifest_path.exists() {
            continue;
        }
        let raw = fs::read_to_string(&manifest_path).map_err(|error| error.to_string())?;
        let manifest: SkillManifest =
            serde_json::from_str(&raw).map_err(|error| error.to_string())?;
        validate_manifest_at_root(&manifest, &entry.path())?;
        manifests.push((manifest, entry.path()));
    }

    Ok(manifests)
}

fn load_skill_records_from_disk(
    db_path: &Path,
    app_data_dir: &Path,
) -> Result<Vec<LoadedSkillRecord>, String> {
    let active_profile_id = crate::gateway::profiles::active_profile_id_or_default(db_path)?;
    let mut manifests_by_id = HashMap::new();
    for (manifest, skill_root) in load_skill_manifests_from_root(&skills_root(app_data_dir))? {
        manifests_by_id.insert(
            manifest.id.clone(),
            LoadedSkillRecord {
                manifest,
                skill_root,
                source_scope: "global".to_string(),
                profile_id: None,
            },
        );
    }
    let active_profile_root = profile_skills_root(app_data_dir, &active_profile_id);
    for (manifest, skill_root) in load_skill_manifests_from_root(&active_profile_root)? {
        manifests_by_id.insert(
            manifest.id.clone(),
            LoadedSkillRecord {
                manifest,
                skill_root,
                source_scope: "profile".to_string(),
                profile_id: Some(active_profile_id.clone()),
            },
        );
    }
    let mut loaded = manifests_by_id.into_values().collect::<Vec<_>>();
    loaded.sort_by(|left, right| left.manifest.id.cmp(&right.manifest.id));

    if let Ok(mut guard) = cache().lock() {
        guard.clear();
        for skill in &loaded {
            guard.insert(skill.manifest.id.clone(), skill.manifest.clone());
        }
    }

    Ok(loaded)
}

pub fn load_skills_from_disk(
    db_path: &Path,
    app_data_dir: &Path,
) -> Result<Vec<SkillManifest>, String> {
    Ok(load_skill_records_from_disk(db_path, app_data_dir)?
        .into_iter()
        .map(|skill| skill.manifest)
        .collect())
}

pub fn list_installed_skills(
    db_path: &Path,
    app_data_dir: &Path,
) -> Result<Vec<InstalledSkillRecord>, String> {
    Ok(load_skill_records_from_disk(db_path, app_data_dir)?
        .into_iter()
        .map(|skill| InstalledSkillRecord {
            id: skill.manifest.id,
            version: skill.manifest.version,
            label: skill.manifest.label,
            enabled: skill.manifest.enabled,
            keywords: skill.manifest.keywords,
            source_scope: skill.source_scope,
            profile_id: skill.profile_id,
        })
        .collect())
}

pub fn skill_root_for_manifest(
    db_path: &Path,
    app_data_dir: &Path,
    skill_id: &str,
) -> Result<PathBuf, String> {
    load_skill_records_from_disk(db_path, app_data_dir)?
        .into_iter()
        .find(|skill| skill.manifest.id == skill_id)
        .map(|skill| skill.skill_root)
        .ok_or_else(|| format!("Installed skill \"{skill_id}\" was not found on disk."))
}

pub fn dynamic_skill_keywords(
    db_path: &Path,
    app_data_dir: &Path,
) -> Result<Vec<(String, String)>, String> {
    Ok(load_skills_from_disk(db_path, app_data_dir)?
        .into_iter()
        .filter(|manifest| manifest.enabled)
        .flat_map(|manifest| {
            manifest
                .keywords
                .into_iter()
                .map(move |keyword| (keyword, manifest.id.clone()))
        })
        .collect())
}

pub fn match_dynamic_skill(
    command: &str,
    db_path: &Path,
    app_data_dir: &Path,
) -> Option<SkillManifest> {
    let normalized = command.trim().to_lowercase();
    load_skills_from_disk(db_path, app_data_dir)
        .ok()?
        .into_iter()
        .find(|manifest| {
            manifest.enabled
                && manifest
                    .keywords
                    .iter()
                    .any(|keyword| normalized.contains(&keyword.to_lowercase()))
        })
}

pub fn install_fixture_skill(app_data_dir: &Path) -> Result<(), String> {
    let skill_dir = skills_root(app_data_dir).join("hello");
    fs::create_dir_all(&skill_dir).map_err(|error| error.to_string())?;
    let manifest = SkillManifest {
        id: "hello".into(),
        version: "1.0.0".into(),
        label: "Hello skill".into(),
        keywords: vec!["hello skill".into(), "wave16 hello".into()],
        agent: "command".into(),
        permissions: vec!["read".into()],
        enabled: true,
        handler: SkillHandler::Route {
            capability_id: "command.general".into(),
        },
    };
    let raw = serde_json::to_string_pretty(&manifest).map_err(|error| error.to_string())?;
    fs::write(skill_dir.join("skill.json"), raw).map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gateway::profiles::{seed_default_profiles, switch_profile};

    fn write_skill(
        dir: &Path,
        id: &str,
        label: &str,
        keywords: &[&str],
        enabled: bool,
    ) -> Result<(), String> {
        let skill_dir = dir.join(id);
        fs::create_dir_all(&skill_dir).map_err(|error| error.to_string())?;
        let manifest = SkillManifest {
            id: id.to_string(),
            version: "1.0.0".to_string(),
            label: label.to_string(),
            keywords: keywords.iter().map(|keyword| keyword.to_string()).collect(),
            agent: "command".to_string(),
            permissions: vec!["read".to_string()],
            enabled,
            handler: SkillHandler::Route {
                capability_id: "command.general".to_string(),
            },
        };
        let raw = serde_json::to_string_pretty(&manifest).map_err(|error| error.to_string())?;
        fs::write(skill_dir.join("skill.json"), raw).map_err(|error| error.to_string())
    }

    fn manifest(id: &str, permissions: &[&str], handler: SkillHandler) -> SkillManifest {
        SkillManifest {
            id: id.to_string(),
            version: "1.0.0".to_string(),
            label: id.to_string(),
            keywords: vec![id.to_string()],
            agent: "command".to_string(),
            permissions: permissions.iter().map(|value| value.to_string()).collect(),
            enabled: true,
            handler,
        }
    }

    fn temp_skill_dir(label: &str) -> std::path::PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!("jarvis-{label}-{nanos}"));
        fs::create_dir_all(&dir).expect("temp skill dir");
        dir
    }

    fn minimal_wasm_with_export(export_name: &str) -> Vec<u8> {
        let mut bytes = vec![
            0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, // header
            0x01, 0x04, 0x01, 0x60, 0x00, 0x00, // type section
            0x03, 0x02, 0x01, 0x00, // function section
        ];

        let name_bytes = export_name.as_bytes();
        let export_len = 1 + 1 + name_bytes.len() + 1 + 1;
        bytes.extend_from_slice(&[0x07, export_len as u8, 0x01, name_bytes.len() as u8]);
        bytes.extend_from_slice(name_bytes);
        bytes.extend_from_slice(&[0x00, 0x00]);
        bytes.extend_from_slice(&[0x0a, 0x04, 0x01, 0x02, 0x00, 0x0b]);
        bytes
    }

    fn write_wasm_fixture(dir: &Path, relative_path: &str, bytes: Vec<u8>) {
        let path = dir.join(relative_path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("fixture parent");
        }
        fs::write(path, bytes).expect("write wasm fixture");
    }

    #[test]
    fn validates_and_matches_fixture_skill() {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!("jarvis-skill-{nanos}"));
        let db_path = std::env::temp_dir().join(format!("jarvis-skill-{nanos}.db"));
        fs::create_dir_all(&dir).expect("dir");
        seed_default_profiles(&db_path, &dir).expect("seed");
        install_fixture_skill(&dir).expect("install");
        let matched = match_dynamic_skill("run hello skill", &db_path, &dir).expect("match");
        assert_eq!(matched.id, "hello");
        let listed = list_installed_skills(&db_path, &dir).expect("list");
        assert_eq!(listed.len(), 1);
        let _ = std::fs::remove_dir_all(dir);
        let _ = std::fs::remove_file(db_path);
    }

    #[test]
    fn profile_skills_are_scoped_to_active_profile() {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!("jarvis-skill-profile-{nanos}"));
        let db_path = std::env::temp_dir().join(format!("jarvis-skill-profile-{nanos}.db"));
        fs::create_dir_all(&dir).expect("dir");
        seed_default_profiles(&db_path, &dir).expect("seed");
        write_skill(
            &profile_skills_root(&dir, "work"),
            "work-only",
            "Work Only",
            &["launch plan"],
            true,
        )
        .expect("write work skill");
        write_skill(
            &profile_skills_root(&dir, "personal"),
            "personal-only",
            "Personal Only",
            &["dinner plan"],
            true,
        )
        .expect("write personal skill");

        let work_match =
            match_dynamic_skill("open the launch plan", &db_path, &dir).expect("work match");
        assert_eq!(work_match.id, "work-only");
        assert!(match_dynamic_skill("open the dinner plan", &db_path, &dir).is_none());

        switch_profile(&db_path, &dir, "personal").expect("switch");
        let personal_match =
            match_dynamic_skill("open the dinner plan", &db_path, &dir).expect("personal match");
        assert_eq!(personal_match.id, "personal-only");
        assert!(match_dynamic_skill("open the launch plan", &db_path, &dir).is_none());

        let listed = list_installed_skills(&db_path, &dir).expect("list personal");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].id, "personal-only");

        let _ = std::fs::remove_dir_all(dir);
        let _ = std::fs::remove_file(db_path);
    }

    #[test]
    fn profile_skill_overrides_global_manifest_with_same_id() {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!("jarvis-skill-override-{nanos}"));
        let db_path = std::env::temp_dir().join(format!("jarvis-skill-override-{nanos}.db"));
        fs::create_dir_all(&dir).expect("dir");
        seed_default_profiles(&db_path, &dir).expect("seed");
        write_skill(
            &skills_root(&dir),
            "shared-skill",
            "Global Skill",
            &["shared command"],
            true,
        )
        .expect("write global skill");
        write_skill(
            &profile_skills_root(&dir, "personal"),
            "shared-skill",
            "Personal Skill",
            &["personal command"],
            true,
        )
        .expect("write personal override");

        switch_profile(&db_path, &dir, "personal").expect("switch");
        let listed = list_installed_skills(&db_path, &dir).expect("list");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].label, "Personal Skill");
        assert!(match_dynamic_skill("run personal command", &db_path, &dir).is_some());
        assert!(match_dynamic_skill("run shared command", &db_path, &dir).is_none());

        let _ = std::fs::remove_dir_all(dir);
        let _ = std::fs::remove_file(db_path);
    }

    #[test]
    fn resolves_global_skill_root_for_manifest() {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!("jarvis-skill-root-global-{nanos}"));
        let db_path = std::env::temp_dir().join(format!("jarvis-skill-root-global-{nanos}.db"));
        fs::create_dir_all(&dir).expect("dir");
        seed_default_profiles(&db_path, &dir).expect("seed");
        write_skill(
            &skills_root(&dir),
            "shared-skill",
            "Global Skill",
            &["shared command"],
            true,
        )
        .expect("write global skill");

        let skill_root =
            skill_root_for_manifest(&db_path, &dir, "shared-skill").expect("resolve skill root");
        assert_eq!(skill_root, skills_root(&dir).join("shared-skill"));

        let _ = std::fs::remove_dir_all(dir);
        let _ = std::fs::remove_file(db_path);
    }

    #[test]
    fn resolves_profile_skill_root_for_active_profile_override() {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!("jarvis-skill-root-profile-{nanos}"));
        let db_path = std::env::temp_dir().join(format!("jarvis-skill-root-profile-{nanos}.db"));
        fs::create_dir_all(&dir).expect("dir");
        seed_default_profiles(&db_path, &dir).expect("seed");
        write_skill(
            &skills_root(&dir),
            "shared-skill",
            "Global Skill",
            &["shared command"],
            true,
        )
        .expect("write global skill");
        write_skill(
            &profile_skills_root(&dir, "personal"),
            "shared-skill",
            "Personal Skill",
            &["personal command"],
            true,
        )
        .expect("write personal override");

        switch_profile(&db_path, &dir, "personal").expect("switch");
        let skill_root =
            skill_root_for_manifest(&db_path, &dir, "shared-skill").expect("resolve skill root");
        assert_eq!(
            skill_root,
            profile_skills_root(&dir, "personal").join("shared-skill")
        );

        let _ = std::fs::remove_dir_all(dir);
        let _ = std::fs::remove_file(db_path);
    }

    #[test]
    fn validates_local_http_get_manifest() {
        let manifest = manifest(
            "http-skill",
            &["read"],
            SkillHandler::Http {
                url: "http://127.0.0.1:8787/health".to_string(),
                method: "GET".to_string(),
            },
        );
        assert!(validate_manifest(&manifest).is_ok());
    }

    #[test]
    fn rejects_http_manifest_without_read_permission() {
        let manifest = manifest(
            "http-skill",
            &[],
            SkillHandler::Http {
                url: "http://127.0.0.1:8787/health".to_string(),
                method: "GET".to_string(),
            },
        );
        let error = validate_manifest(&manifest).expect_err("missing read permission");
        assert!(error.contains("read permission"));
    }

    #[test]
    fn rejects_http_manifest_with_non_get_method() {
        let manifest = manifest(
            "http-skill",
            &["read"],
            SkillHandler::Http {
                url: "http://127.0.0.1:8787/health".to_string(),
                method: "POST".to_string(),
            },
        );
        let error = validate_manifest(&manifest).expect_err("non-get method");
        assert!(error.contains("GET HTTP"));
    }

    #[test]
    fn rejects_http_manifest_with_remote_target() {
        let manifest = manifest(
            "http-skill",
            &["read"],
            SkillHandler::Http {
                url: "https://example.com/health".to_string(),
                method: "GET".to_string(),
            },
        );
        let error = validate_manifest(&manifest).expect_err("remote target");
        assert!(error.contains("local HTTP targets"));
    }

    #[test]
    fn validates_safe_script_manifest() {
        let manifest = manifest(
            "script-skill",
            &["execute"],
            SkillHandler::Script {
                command: "cmd /C echo skill-script".to_string(),
            },
        );
        assert!(validate_manifest(&manifest).is_ok());
    }

    #[test]
    fn rejects_script_manifest_without_execute_permission() {
        let manifest = manifest(
            "script-skill",
            &[],
            SkillHandler::Script {
                command: "cmd /C echo skill-script".to_string(),
            },
        );
        let error = validate_manifest(&manifest).expect_err("missing execute permission");
        assert!(error.contains("execute permission"));
    }

    #[test]
    fn rejects_script_manifest_with_unsafe_token() {
        let manifest = manifest(
            "script-skill",
            &["execute"],
            SkillHandler::Script {
                command: "cmd /C echo one && echo two".to_string(),
            },
        );
        let error = validate_manifest(&manifest).expect_err("unsafe token");
        assert!(error.contains("unsafe"));
    }

    #[test]
    fn rejects_script_manifest_with_unsupported_entrypoint() {
        let manifest = manifest(
            "script-skill",
            &["execute"],
            SkillHandler::Script {
                command: "python -c print('hi')".to_string(),
            },
        );
        let error = validate_manifest(&manifest).expect_err("unsupported entrypoint");
        assert!(error.contains("must start with cmd, powershell, or pwsh"));
    }

    #[test]
    fn validates_local_wasm_manifest() {
        let dir = temp_skill_dir("wasm-valid");
        write_wasm_fixture(&dir, "dist/skill.wasm", minimal_wasm_with_export("run"));
        let manifest = manifest(
            "wasm-skill",
            &[],
            SkillHandler::Wasm {
                module: "dist/skill.wasm".to_string(),
                entrypoint: Some("run".to_string()),
            },
        );
        assert!(validate_manifest_at_root(&manifest, &dir).is_ok());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn rejects_wasm_manifest_that_escapes_skill_root() {
        let dir = temp_skill_dir("wasm-escape");
        let manifest = manifest(
            "wasm-skill",
            &[],
            SkillHandler::Wasm {
                module: "../escape.wasm".to_string(),
                entrypoint: Some("run".to_string()),
            },
        );
        let error = validate_manifest_at_root(&manifest, &dir).expect_err("escape should fail");
        assert!(error.contains("inside the skill directory"));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn rejects_wasm_manifest_with_missing_entrypoint() {
        let dir = temp_skill_dir("wasm-missing-export");
        write_wasm_fixture(&dir, "dist/skill.wasm", minimal_wasm_with_export("other"));
        let manifest = manifest(
            "wasm-skill",
            &[],
            SkillHandler::Wasm {
                module: "dist/skill.wasm".to_string(),
                entrypoint: Some("run".to_string()),
            },
        );
        let error = validate_manifest_at_root(&manifest, &dir).expect_err("entrypoint should fail");
        assert!(error.contains("entrypoint"));
        let _ = std::fs::remove_dir_all(dir);
    }
}
