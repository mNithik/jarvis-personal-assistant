# Lab graduation log

Labs remain **off by default** until each row meets automated pre-checks **and** manual cohort criteria ([E2E_RUNBOOK.md](./E2E_RUNBOOK.md) § F65–F70).

Record evidence here before changing `GatewayLabsConfig::default()` for new installs.

| ID | Flag | Automated | Manual criteria | Status | Evidence date | Notes |
|----|------|-----------|-----------------|--------|---------------|-------|
| F65 | `projectBundlePilot` | `f_project_bundle_execution.json` | ≥90% step success; &lt;5% abort; audit trail | pending | | |
| F66 | `councilVerifier` | `f_council_verifier_execution.json` | ≥80% bad-send caught; latency &lt;2× p95 | pending | | |
| F67 | `councilRuntime` | council vote log evals | Vote log on ≥85% bundle replays | pending | | |
| F68 | `proactiveAnomaly` | proactive routes + UI spec | dismiss &lt;40%; accept &gt;25% / 2 weeks | pending | | |
| F69 | `worldModelQueries` | `f_world_model_execution.json` | ≥90% read-only queries; zero writes | pending | | |
| F70 | `ambientCopilot` | F64 + ambient spec | dismiss &lt;40%; zero auto-writes / 2 weeks | pending | | |

## Metrics source

Local metrics export: `get_proactive_metrics_cmd` → `app_data/metrics/proactive-summary.json`  
Eval harness summary: `JARVIS_EVALS_SUMMARY_PATH` after `cargo test gateway::evals::`

## Promotion process

1. Lab meets graduation criteria on fabric + manual checklist
2. Opt-in banner for one release
3. Flip default for **new installs only**
4. Move to balanced track in ROADMAP; deprecate lab flag after one release
