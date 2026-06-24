mod checks;
mod planner;
mod sandbox;

pub use checks::{checks_succeeded, resolve_jarvis_project_dir, run_project_checks};
pub use planner::plan_coding_assist;
pub use sandbox::{execute_wasm_file, validate_wasm_artifact};

#[cfg(test)]
pub use sandbox::test_minimal_wasm_with_export;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BuilderAction {
    CreateHandoff {
        request: String,
        launch_executor: bool,
    },
    RunProjectChecks,
    OpenProjectInVscode,
    PlanDebug {
        command: String,
    },
}

pub fn parse_builder_command(command: &str) -> Option<BuilderAction> {
    let trimmed = command.trim();
    let normalized = trimmed.to_lowercase();

    if matches!(
        normalized.as_str(),
        "run project checks" | "run jarvis checks" | "check the project"
    ) {
        return Some(BuilderAction::RunProjectChecks);
    }

    if matches!(
        normalized.as_str(),
        "open project in vs code" | "open jarvis in vs code" | "open repo in vs code"
    ) {
        return Some(BuilderAction::OpenProjectInVscode);
    }

    for prefix in ["build ", "change ", "add ", "fix ", "implement "] {
        if normalized.starts_with(prefix) {
            for suffix in [" in jarvis", " for jarvis"] {
                if normalized.ends_with(suffix) {
                    return Some(BuilderAction::CreateHandoff {
                        request: trimmed.to_string(),
                        launch_executor: true,
                    });
                }
            }
        }
    }

    for prefix in [
        "create a build handoff for ",
        "create build handoff for ",
        "make a build handoff for ",
        "make build handoff for ",
        "prepare a build handoff for ",
        "prepare build handoff for ",
        "create a coding handoff for ",
        "create coding handoff for ",
        "make a coding handoff for ",
        "make coding handoff for ",
        "prepare a coding handoff for ",
        "prepare coding handoff for ",
    ] {
        if normalized.starts_with(prefix) {
            let request = trimmed[prefix.len()..].trim();
            if !request.is_empty() {
                return Some(BuilderAction::CreateHandoff {
                    request: request.to_string(),
                    launch_executor: false,
                });
            }
        }
    }

    if matches!(normalized.as_str(), "debug this repo" | "debug the repo") {
        return Some(BuilderAction::PlanDebug {
            command: trimmed.to_string(),
        });
    }

    None
}

pub fn is_builder_command(command: &str) -> bool {
    if parse_builder_command(command).is_some() {
        return true;
    }
    let n = command.trim().to_lowercase();
    n.contains("project checks")
        || n.contains("jarvis checks")
        || (n.contains("handoff") && (n.contains("coding") || n.contains("build")))
        || n.contains("open repo in vs code")
        || n.contains("open project in vs code")
        || n.contains("open jarvis in vs code")
        || ((n.contains(" in jarvis") || n.contains(" for jarvis"))
            && (n.starts_with("build ")
                || n.starts_with("change ")
                || n.starts_with("add ")
                || n.starts_with("fix ")
                || n.starts_with("implement ")))
        || n.contains("debug this repo")
        || n.contains("debug the repo")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_build_in_jarvis_handoff() {
        assert_eq!(
            parse_builder_command("build dark mode toggle in jarvis"),
            Some(BuilderAction::CreateHandoff {
                request: "build dark mode toggle in jarvis".to_string(),
                launch_executor: true,
            })
        );
    }

    #[test]
    fn parses_coding_handoff_without_executor() {
        assert_eq!(
            parse_builder_command("create a coding handoff for export daily brief"),
            Some(BuilderAction::CreateHandoff {
                request: "export daily brief".to_string(),
                launch_executor: false,
            })
        );
    }

    #[test]
    fn parses_run_project_checks() {
        assert!(matches!(
            parse_builder_command("run project checks"),
            Some(BuilderAction::RunProjectChecks)
        ));
    }

    #[test]
    fn parses_open_project_in_vscode() {
        assert!(matches!(
            parse_builder_command("open repo in vs code"),
            Some(BuilderAction::OpenProjectInVscode)
        ));
    }

    #[test]
    fn is_builder_command_includes_debug_repo() {
        assert!(is_builder_command("debug this repo"));
    }

    #[test]
    fn parses_debug_repo_plan() {
        assert_eq!(
            parse_builder_command("debug this repo"),
            Some(BuilderAction::PlanDebug {
                command: "debug this repo".to_string(),
            })
        );
    }
}
