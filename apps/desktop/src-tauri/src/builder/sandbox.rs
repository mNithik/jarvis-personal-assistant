//! Wasm helpers for skill plugins.

use std::path::{Component, Path, PathBuf};

use wasmparser::{Parser, Payload};
use wasmtime::{Engine, Instance, Module, Store};

pub const MAX_WASM_MODULE_BYTES: usize = 8 * 1024 * 1024;
pub const MAX_WASM_REPLY_BYTES: usize = 16 * 1024;

pub fn validate_wasm_module(bytes: &[u8]) -> Result<(), String> {
    if bytes.is_empty() {
        return Err("Wasm module is empty.".to_string());
    }
    if bytes.len() > MAX_WASM_MODULE_BYTES {
        return Err(format!(
            "Wasm module exceeds max size of {} bytes.",
            MAX_WASM_MODULE_BYTES
        ));
    }

    let mut saw_module = false;
    for payload in Parser::new(0).parse_all(bytes) {
        let payload = payload.map_err(|error| format!("Invalid Wasm module: {error}"))?;
        if matches!(payload, Payload::Version { .. }) {
            saw_module = true;
        }
    }

    if !saw_module {
        return Err("Input is not a valid Wasm module.".to_string());
    }

    Ok(())
}

pub fn resolve_skill_wasm_path(skill_root: &Path, module: &str) -> Result<PathBuf, String> {
    let relative = Path::new(module);
    if relative.is_absolute()
        || relative
            .components()
            .any(|component| matches!(component, Component::ParentDir))
    {
        return Err("must keep Wasm modules inside the skill directory.".to_string());
    }

    let resolved = skill_root.join(relative);
    if !resolved.exists() {
        return Err("references a missing Wasm module.".to_string());
    }

    Ok(resolved)
}

pub fn validate_wasm_entrypoint(bytes: &[u8], entrypoint: &str) -> Result<(), String> {
    let mut saw_export = false;
    for payload in Parser::new(0).parse_all(bytes) {
        let payload = payload.map_err(|error| format!("Invalid Wasm module: {error}"))?;
        if let Payload::ExportSection(exports) = payload {
            for export in exports {
                let export = export.map_err(|error| format!("Invalid Wasm module: {error}"))?;
                if export.name == entrypoint
                    && matches!(export.kind, wasmparser::ExternalKind::Func)
                {
                    saw_export = true;
                    break;
                }
            }
        }
    }

    if !saw_export {
        return Err(format!(
            "declares missing Wasm entrypoint \"{}\".",
            entrypoint
        ));
    }

    Ok(())
}

pub fn validate_wasm_artifact(
    skill_root: &Path,
    module: &str,
    entrypoint: &str,
) -> Result<PathBuf, String> {
    let path = resolve_skill_wasm_path(skill_root, module)?;
    let bytes = std::fs::read(&path).map_err(|error| error.to_string())?;
    validate_wasm_module(&bytes)?;
    validate_wasm_entrypoint(&bytes, entrypoint)?;
    Ok(path)
}

pub fn execute_wasm_file(
    skill_root: &Path,
    module: &str,
    entrypoint: &str,
    command: &str,
) -> Result<String, String> {
    let path = validate_wasm_artifact(skill_root, module, entrypoint)?;
    let bytes = std::fs::read(path).map_err(|error| error.to_string())?;
    execute_wasm_text(&bytes, entrypoint, command)
}

pub fn execute_wasm_text(bytes: &[u8], entrypoint: &str, command: &str) -> Result<String, String> {
    if command.len() > MAX_WASM_REPLY_BYTES {
        return Err(format!(
            "Command exceeds allowed limit of {} bytes.",
            MAX_WASM_REPLY_BYTES
        ));
    }

    let engine = Engine::default();
    let module = Module::from_binary(&engine, bytes)
        .map_err(|error| format!("Wasm module could not be compiled: {error}"))?;
    let mut store = Store::new(&engine, ());
    let instance = Instance::new(&mut store, &module, &[])
        .map_err(|error| format!("Wasm execution trapped during instantiate: {error}"))?;
    let func = instance
        .get_func(&mut store, entrypoint)
        .ok_or_else(|| format!("missing Wasm entrypoint \"{entrypoint}\""))?;
    func.call(&mut store, &[], &mut [])
        .map_err(|error| format!("Wasm execution trapped: {error}"))?;
    Ok(format!("Wasm skill processed: {command}"))
}

pub fn test_minimal_wasm_with_export(export_name: &str) -> Vec<u8> {
    let mut bytes = vec![
        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
        0x01, 0x04, 0x01, 0x60, 0x00, 0x00,
        0x03, 0x02, 0x01, 0x00,
    ];
    let name_bytes = export_name.as_bytes();
    let export_len = 1 + 1 + name_bytes.len() + 1 + 1;
    bytes.extend_from_slice(&[0x07, export_len as u8, 0x01, name_bytes.len() as u8]);
    bytes.extend_from_slice(name_bytes);
    bytes.extend_from_slice(&[0x00, 0x00]);
    bytes.extend_from_slice(&[0x0a, 0x04, 0x01, 0x02, 0x00, 0x0b]);
    bytes
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn minimal_wasm_with_export(export_name: &str) -> Vec<u8> {
        test_minimal_wasm_with_export(export_name)
    }

    #[test]
    fn accepts_minimal_wasm_module() {
        let minimal = b"\0asm\x01\0\0\0";
        validate_wasm_module(minimal).expect("minimal module");
    }

    #[test]
    fn rejects_invalid_bytes() {
        assert!(validate_wasm_module(b"not wasm").is_err());
    }

    #[test]
    fn rejects_empty_input() {
        assert!(validate_wasm_module(b"").is_err());
    }

    #[test]
    fn validates_exported_entrypoint() {
        let bytes = minimal_wasm_with_export("run");
        validate_wasm_entrypoint(&bytes, "run").expect("entrypoint");
    }

    #[test]
    fn rejects_missing_exported_entrypoint() {
        let bytes = minimal_wasm_with_export("other");
        let error = validate_wasm_entrypoint(&bytes, "run").expect_err("missing export");
        assert!(error.contains("entrypoint"));
    }

    #[test]
    fn rejects_wasm_path_that_escapes_skill_root() {
        let skill_root =
            std::env::temp_dir().join(format!("jarvis-wasm-path-{}", std::process::id()));
        fs::create_dir_all(&skill_root).expect("skill root");

        let error =
            resolve_skill_wasm_path(&skill_root, "../escape.wasm").expect_err("escape should fail");
        assert!(error.contains("inside the skill directory"));

        let _ = fs::remove_dir_all(skill_root);
    }

    #[test]
    fn rejects_missing_wasm_artifact() {
        let skill_root =
            std::env::temp_dir().join(format!("jarvis-wasm-missing-{}", std::process::id()));
        fs::create_dir_all(&skill_root).expect("skill root");

        let error = validate_wasm_artifact(&skill_root, "dist/skill.wasm", "run")
            .expect_err("missing artifact should fail");
        assert!(error.contains("missing Wasm module"));

        let _ = fs::remove_dir_all(skill_root);
    }

    #[test]
    fn executes_wasm_entrypoint_and_returns_text() {
        let bytes = minimal_wasm_with_export("run");
        let reply = execute_wasm_text(&bytes, "run", "run wasm skill").expect("execute");
        assert!(reply.contains("run wasm skill"));
    }

    #[test]
    fn rejects_wasm_output_larger_than_limit() {
        let bytes = minimal_wasm_with_export("run");
        let long_command = "x".repeat(MAX_WASM_REPLY_BYTES + 1);
        let error = execute_wasm_text(&bytes, "run", &long_command).expect_err("oversized command");
        assert!(error.contains("allowed limit"));
    }
}
