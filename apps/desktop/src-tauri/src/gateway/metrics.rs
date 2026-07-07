//! Local metrics export for lab graduation and eval harness summaries.

use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::Connection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProactiveMetrics {
    pub shown: u64,
    pub dismissed: u64,
    pub accepted: u64,
    pub dismiss_rate: f64,
    pub accept_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvalsSummary {
    pub fabric_count: usize,
    pub gateway_eval_tests: usize,
    pub task_eval_pass_rate: Option<f64>,
    pub timestamp: String,
}

pub fn proactive_metrics(db_path: &Path) -> Result<ProactiveMetrics, String> {
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    let shown: u64 = conn
        .query_row(
            "SELECT COUNT(*) FROM proactive_nudge_log WHERE status = 'shown'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    let dismissed: u64 = conn
        .query_row(
            "SELECT COUNT(*) FROM proactive_nudge_log WHERE status = 'dismissed'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    let accepted: u64 = conn
        .query_row(
            "SELECT COUNT(*) FROM proactive_nudge_log WHERE status = 'accepted'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    let acted = dismissed + accepted;
    let dismiss_rate = if acted == 0 {
        0.0
    } else {
        dismissed as f64 / acted as f64
    };
    let accept_rate = if acted == 0 {
        0.0
    } else {
        accepted as f64 / acted as f64
    };
    Ok(ProactiveMetrics {
        shown,
        dismissed,
        accepted,
        dismiss_rate,
        accept_rate,
    })
}

pub fn write_proactive_metrics_snapshot(
    app_data_dir: &Path,
    db_path: &Path,
) -> Result<PathBuf, String> {
    let metrics = proactive_metrics(db_path)?;
    let dir = app_data_dir.join("metrics");
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let path = dir.join("proactive-summary.json");
    let raw = serde_json::to_string_pretty(&metrics).map_err(|error| error.to_string())?;
    fs::write(&path, raw).map_err(|error| error.to_string())?;
    Ok(path)
}

pub fn write_evals_summary(app_data_dir: &Path, summary: &EvalsSummary) -> Result<PathBuf, String> {
    if let Ok(path) = std::env::var("JARVIS_EVALS_SUMMARY_PATH") {
        let target = PathBuf::from(path);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let raw = serde_json::to_string_pretty(summary).map_err(|error| error.to_string())?;
        fs::write(&target, raw).map_err(|error| error.to_string())?;
        return Ok(target);
    }
    let dir = app_data_dir.join("metrics");
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let path = dir.join("evals-summary.json");
    let raw = serde_json::to_string_pretty(summary).map_err(|error| error.to_string())?;
    fs::write(&path, raw).map_err(|error| error.to_string())?;
    Ok(path)
}
