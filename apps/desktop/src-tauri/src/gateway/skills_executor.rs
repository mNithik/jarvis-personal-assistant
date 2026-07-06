use std::path::Path;
use std::process::Command;

use crate::agents::StepResult;
use crate::gateway::skills::{validate_manifest, SkillHandler, SkillManifest};

pub fn execute_skill(
    manifest: &SkillManifest,
    skill_root: Option<&Path>,
    _command: &str,
) -> StepResult {
    if let Err(error) = validate_manifest(manifest) {
        return StepResult::failed(format!(
            "Installed skill \"{}\" v{} manifest is invalid: {}",
            manifest.label, manifest.version, error
        ));
    }
    match &manifest.handler {
        SkillHandler::Route { capability_id } => StepResult::handoff(
            capability_id,
            "run_installed_skill",
            Some(manifest.id.clone()),
            format!(
                "Matched installed skill \"{}\" v{} and routed it via {}.",
                manifest.label, manifest.version, capability_id
            ),
        ),
        SkillHandler::Http { url, method } => execute_http_skill(
            &manifest.label,
            &manifest.version,
            &manifest.permissions,
            url,
            method,
        ),
        SkillHandler::Script { command } => execute_script_skill(
            &manifest.label,
            &manifest.version,
            &manifest.permissions,
            command,
        ),
        SkillHandler::Wasm { module, entrypoint } => {
            let Some(skill_root) = skill_root else {
                return StepResult::failed(format!(
                    "Installed skill \"{}\" v{} is missing its skill directory context.",
                    manifest.label, manifest.version
                ));
            };
            let export = entrypoint.as_deref().unwrap_or("run");
            match crate::builder::execute_wasm_file(skill_root, module, export, _command) {
                Ok(reply) => StepResult::ok(format!(
                    "Installed skill \"{}\" v{} Wasm reply:\n{}",
                    manifest.label, manifest.version, reply
                )),
                Err(error) => StepResult::failed(format!(
                    "Installed skill \"{}\" v{} {}",
                    manifest.label, manifest.version, error
                )),
            }
        }
    }
}

fn skill_has_permission(permissions: &[String], required: &str) -> bool {
    permissions
        .iter()
        .any(|permission| permission.eq_ignore_ascii_case(required))
}

fn execute_http_skill(
    label: &str,
    version: &str,
    permissions: &[String],
    url: &str,
    method: &str,
) -> StepResult {
    if !skill_has_permission(permissions, "read") {
        return StepResult::failed(format!(
            "Installed skill \"{}\" v{} needs read permission for HTTP handlers.",
            label, version
        ));
    }
    if !method.eq_ignore_ascii_case("GET") {
        return StepResult::failed(format!(
            "Installed skill \"{}\" v{} only supports local GET HTTP handlers in v2 MVP.",
            label, version
        ));
    }
    let parsed = match reqwest::Url::parse(url) {
        Ok(parsed) => parsed,
        Err(error) => {
            return StepResult::failed(format!(
                "Installed skill \"{}\" v{} has an invalid HTTP url: {}.",
                label, version, error
            ));
        }
    };
    let Some(host) = parsed.host_str() else {
        return StepResult::failed(format!(
            "Installed skill \"{}\" v{} must target a local host.",
            label, version
        ));
    };
    if !matches!(host, "localhost" | "127.0.0.1" | "::1") {
        return StepResult::failed(format!(
            "Installed skill \"{}\" v{} only allows local HTTP targets right now.",
            label, version
        ));
    }
    match reqwest::blocking::Client::new().get(parsed).send() {
        Ok(response) => {
            let status = response.status();
            match response.text() {
                Ok(body) if status.is_success() => StepResult::ok(format!(
                    "Installed skill \"{}\" v{} HTTP response:\n{}",
                    label, version, body
                )),
                Ok(body) => StepResult::failed(format!(
                    "Installed skill \"{}\" v{} returned HTTP {}.\n{}",
                    label, version, status, body
                )),
                Err(error) => StepResult::failed(format!(
                    "Installed skill \"{}\" v{} could not read HTTP response: {}.",
                    label, version, error
                )),
            }
        }
        Err(error) => StepResult::failed(format!(
            "Installed skill \"{}\" v{} HTTP request failed: {}.",
            label, version, error
        )),
    }
}

fn execute_script_skill(
    label: &str,
    version: &str,
    permissions: &[String],
    command: &str,
) -> StepResult {
    if !skill_has_permission(permissions, "execute") {
        return StepResult::failed(format!(
            "Installed skill \"{}\" v{} needs execute permission for script handlers.",
            label, version
        ));
    }
    if ["&&", "||", "|", ">", "<", ";"]
        .iter()
        .any(|token| command.contains(token))
    {
        return StepResult::failed(format!(
            "Installed skill \"{}\" v{} script command is unsafe for v2 MVP execution.",
            label, version
        ));
    }
    let parts = command.split_whitespace().collect::<Vec<_>>();
    if parts.is_empty() {
        return StepResult::failed(format!(
            "Installed skill \"{}\" v{} script handler is empty.",
            label, version
        ));
    }
    if !matches!(
        parts[0].to_ascii_lowercase().as_str(),
        "cmd" | "powershell" | "pwsh" | "sh" | "bash" | "echo"
    ) {
        return StepResult::failed(format!(
            "Installed skill \"{}\" v{} script handlers must start with cmd, powershell, pwsh, sh, bash, or echo in v2 MVP.",
            label, version
        ));
    }
    match Command::new(parts[0]).args(&parts[1..]).output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            if output.status.success() {
                StepResult::ok(format!(
                    "Installed skill \"{}\" v{} script output:\n{}",
                    label,
                    version,
                    if stdout.is_empty() {
                        "(no output)"
                    } else {
                        stdout.as_str()
                    }
                ))
            } else {
                StepResult::failed(format!(
                    "Installed skill \"{}\" v{} script failed: {}",
                    label,
                    version,
                    if stderr.is_empty() { stdout } else { stderr }
                ))
            }
        }
        Err(error) => StepResult::failed(format!(
            "Installed skill \"{}\" v{} script failed to launch: {}.",
            label, version, error
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;

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

    #[test]
    fn route_handler_returns_handoff() {
        let result = execute_skill(
            &manifest(
                "route-skill",
                &["read"],
                SkillHandler::Route {
                    capability_id: "command.general".to_string(),
                },
            ),
            None,
            "run route skill",
        );
        assert!(result.success);
        assert!(result.integration_handoff.is_some());
    }

    #[test]
    fn local_http_handler_executes_get() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
        let port = listener.local_addr().expect("addr").port();
        let handle = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept");
            let mut request = [0_u8; 1024];
            let _ = stream.read(&mut request);
            stream
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 8\r\n\r\nskill-ok")
                .expect("write");
        });

        let result = execute_skill(
            &manifest(
                "http-skill",
                &["read"],
                SkillHandler::Http {
                    url: format!("http://127.0.0.1:{port}/health"),
                    method: "GET".to_string(),
                },
            ),
            None,
            "run http skill",
        );
        assert!(result.success);
        assert!(result.reply.contains("skill-ok"));

        handle.join().expect("join");
    }

    #[test]
    fn remote_http_handler_is_rejected() {
        let result = execute_skill(
            &manifest(
                "remote-http",
                &["read"],
                SkillHandler::Http {
                    url: "https://example.com".to_string(),
                    method: "GET".to_string(),
                },
            ),
            None,
            "run remote http",
        );
        assert!(!result.success);
        assert!(result.reply.to_lowercase().contains("local"));
    }

    #[test]
    fn safe_script_handler_executes() {
        let result = execute_skill(
            &manifest(
                "script-skill",
                &["execute"],
                SkillHandler::Script {
                    command: "cmd /C echo skill-script".to_string(),
                },
            ),
            None,
            "run script skill",
        );
        assert!(result.success);
        assert!(result.reply.to_lowercase().contains("skill-script"));
    }

    #[test]
    fn unsafe_script_handler_is_rejected() {
        let result = execute_skill(
            &manifest(
                "script-unsafe",
                &["execute"],
                SkillHandler::Script {
                    command: "cmd /C echo hi && dir".to_string(),
                },
            ),
            None,
            "run unsafe script",
        );
        assert!(!result.success);
        assert!(result.reply.to_lowercase().contains("unsafe"));
    }

    #[test]
    fn wasm_handler_requires_skill_root_context() {
        let result = execute_skill(
            &manifest(
                "wasm-skill",
                &[],
                SkillHandler::Wasm {
                    module: "dist/skill.wasm".to_string(),
                    entrypoint: Some("run".to_string()),
                },
            ),
            None,
            "run wasm skill",
        );
        assert!(!result.success);
        assert!(result.reply.contains("skill directory context"));
    }

    #[test]
    fn wasm_handler_executes_minimal_module() {
        use std::fs;

        let dir = std::env::temp_dir().join(format!("jarvis-wasm-exec2-{}", std::process::id()));
        let dist = dir.join("dist");
        fs::create_dir_all(&dist).expect("dist");
        let wasm_bytes = crate::builder::test_minimal_wasm_with_export("run");
        fs::write(dist.join("skill.wasm"), wasm_bytes).expect("write wasm");

        let result = execute_skill(
            &manifest(
                "wasm-skill",
                &[],
                SkillHandler::Wasm {
                    module: "dist/skill.wasm".to_string(),
                    entrypoint: Some("run".to_string()),
                },
            ),
            Some(&dir),
            "run wasm skill",
        );
        assert!(result.success, "expected wasm success, got {:?}", result.reply);
        assert!(result.reply.contains("run wasm skill"));
        let _ = fs::remove_dir_all(&dir);
    }
}
