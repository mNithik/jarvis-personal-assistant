use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::gateway::config::GatewayConfig;
use crate::gateway::router::{route_turn, RouterContext};
use crate::gateway::types::TurnRequest;

use super::training_export::{append_training_record, load_training_records};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TrainingEvalGateResult {
    pub total_cases: usize,
    pub correct_cases: usize,
    pub accuracy_pct: f64,
    pub baseline_pct: f64,
    pub min_accuracy_pct: u32,
    pub passed: bool,
    pub export_record_count: usize,
    pub eval_files_scanned: usize,
}

#[derive(Debug, Deserialize)]
struct GoldenRouteCase {
    phrase: String,
    #[serde(rename = "capabilityId")]
    capability_id: String,
}

pub fn evals_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("tests")
        .join("evals")
}

pub fn discover_route_eval_files(dir: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    let entries = fs::read_dir(dir).map_err(|error| error.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let file_name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default();
        if !file_name.starts_with('f') {
            continue;
        }
        if file_name.contains("execution") || file_name.contains("fabric") {
            continue;
        }
        let raw = fs::read_to_string(&path).map_err(|error| error.to_string())?;
        if serde_json::from_str::<Vec<GoldenRouteCase>>(&raw).is_ok() {
            files.push(path);
        }
    }
    files.sort();
    Ok(files)
}

pub fn run_route_eval(context: &RouterContext, eval_dir: &Path) -> Result<(usize, usize), String> {
    let files = discover_route_eval_files(eval_dir)?;
    let mut total = 0usize;
    let mut correct = 0usize;

    for path in files {
        let raw = fs::read_to_string(&path).map_err(|error| error.to_string())?;
        let cases: Vec<GoldenRouteCase> =
            serde_json::from_str(&raw).map_err(|error| error.to_string())?;
        for case in cases {
            total += 1;
            let route = route_turn(
                &TurnRequest {
                    session_id: None,
                    command: case.phrase.clone(),
                    source: None,
                    idempotency_key: None,
                },
                context,
            );
            if route.capability_id == case.capability_id {
                correct += 1;
            }
        }
    }

    Ok((correct, total))
}

pub fn accuracy_pct(correct: usize, total: usize) -> f64 {
    if total == 0 {
        return 100.0;
    }
    (correct as f64 / total as f64) * 100.0
}

pub fn deploy_gate_passed(current_pct: f64, baseline_pct: f64, min_pct: u32) -> bool {
    if current_pct + f64::EPSILON < min_pct as f64 {
        return false;
    }
    if baseline_pct >= 99.0 {
        return current_pct + f64::EPSILON >= baseline_pct;
    }
    current_pct + f64::EPSILON >= baseline_pct + 5.0
}

pub fn run_training_eval_gate(
    config: &GatewayConfig,
    export_path: &Path,
) -> Result<TrainingEvalGateResult, String> {
    let eval_dir = evals_dir();
    let min_accuracy_pct = config.training.eval_min_accuracy_pct.max(1);

    let mut baseline_config = config.clone();
    baseline_config.routing.l2_enabled = false;
    baseline_config.routing.jarvis_router_enabled = false;
    let baseline_context = RouterContext {
        db_path: None,
        config: baseline_config,
    };

    let current_context = RouterContext {
        db_path: None,
        config: config.clone(),
    };

    let eval_files = discover_route_eval_files(&eval_dir)?;
    let (baseline_correct, baseline_total) = run_route_eval(&baseline_context, &eval_dir)?;
    let (current_correct, current_total) = run_route_eval(&current_context, &eval_dir)?;

    let baseline_pct = accuracy_pct(baseline_correct, baseline_total);
    let current_pct = accuracy_pct(current_correct, current_total);
    let export_record_count = load_training_records(export_path).map(|records| records.len()).unwrap_or(0);

    Ok(TrainingEvalGateResult {
        total_cases: current_total,
        correct_cases: current_correct,
        accuracy_pct: current_pct,
        baseline_pct,
        min_accuracy_pct,
        passed: deploy_gate_passed(current_pct, baseline_pct, min_accuracy_pct),
        export_record_count,
        eval_files_scanned: eval_files.len(),
    })
}

pub fn anonymize_export_file(input_path: &Path, output_path: &Path) -> Result<usize, String> {
    let records = load_training_records(input_path)?;
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    if output_path.exists() {
        fs::remove_file(output_path).map_err(|error| error.to_string())?;
    }
    for record in &records {
        append_training_record(output_path, record)?;
    }
    Ok(records.len())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deploy_gate_requires_five_point_lift_when_baseline_below_ninety_nine() {
        assert!(deploy_gate_passed(95.0, 90.0, 90));
        assert!(!deploy_gate_passed(94.0, 90.0, 90));
    }

    #[test]
    fn deploy_gate_matches_baseline_when_already_high() {
        assert!(deploy_gate_passed(100.0, 100.0, 95));
        assert!(!deploy_gate_passed(99.0, 100.0, 95));
    }

    #[test]
    fn route_eval_files_include_supervisor_golden() {
        let files = discover_route_eval_files(&evals_dir()).expect("discover");
        assert!(files.iter().any(|path| path.ends_with("f_l3_supervisor.json")));
    }

    #[test]
    fn training_eval_gate_passes_on_golden_routes() {
        let config = GatewayConfig::default();
        let export_path = std::env::temp_dir().join(format!(
            "jarvis-training-eval-{}.jsonl",
            std::process::id()
        ));
        let result = run_training_eval_gate(&config, &export_path).expect("gate");
        assert!(result.total_cases >= 20, "expected many golden route cases");
        assert_eq!(result.accuracy_pct, 100.0);
        assert!(result.passed);
    }
}
