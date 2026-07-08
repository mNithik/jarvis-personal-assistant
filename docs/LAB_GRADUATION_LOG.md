# Lab graduation log

Labs remain **off by default** until each row meets automated pre-checks **and** manual cohort criteria ([E2E_RUNBOOK.md](./E2E_RUNBOOK.md) § F65–F70).

Record evidence here before changing `GatewayLabsConfig::default()` for new installs.

| ID | Flag | Automated | Manual criteria | Status | Evidence date | Notes |
|----|------|-----------|-----------------|--------|---------------|-------|
| F65 | `projectBundlePilot` | `f_project_bundle_execution.json` | ≥90% step success; &lt;5% abort; audit trail | pending | | Start after F70 cycle |
| F66 | `councilVerifier` | `f_council_verifier_execution.json` | ≥80% bad-send caught; latency &lt;2× p95 | pending | | |
| F67 | `councilRuntime` | council vote log evals | Vote log on ≥85% bundle replays | pending | | |
| F68 | `proactiveAnomaly` | proactive routes + UI spec | dismiss &lt;40%; accept &gt;25% / 2 weeks | pending | | |
| F69 | `worldModelQueries` | `f_world_model_execution.json` | ≥90% read-only queries; zero writes | pending | | |
| F70 | `ambientCopilot` | F64 + ambient spec | dismiss &lt;40%; zero auto-writes / 2 weeks | **dogfooding** | 2026-07-08 | Baseline metrics export started; enable flag in Gateway → Labs |

## F70 dogfood protocol (active)

1. Enable `labs.ambientCopilot` in Gateway → Labs
2. Daily: consent → focus session → verify read-only suggestions only
3. Weekly: Operator panel → Export proactive metrics
4. After 2 weeks: if dismiss &lt;40% and zero auto-writes → mark **graduated**; else log **not ready**

## F65 dogfood protocol (scheduled)

Start after F70 cycle completes (pass or explicit not-ready):

1. Enable `labs.projectBundlePilot` in Gateway → Labs
2. Run a 4-step bundle; confirm audit refs under `app_data/bundles/`
3. Weekly: Operator panel bundle list + audit tail
4. After 2 weeks: ≥90% step success → mark **graduated**; else **not ready**

## Metrics source

Local metrics export: `get_proactive_metrics_cmd` → `app_data/metrics/proactive-summary.json`  
Eval harness summary: `JARVIS_EVALS_SUMMARY_PATH` or auto-export after `eval_golden_f_fabric_index`

## Promotion process

1. Lab meets graduation criteria on fabric + manual checklist
2. Opt-in banner for one release
3. Flip default for **new installs only**
4. Move to balanced track in ROADMAP; deprecate lab flag after one release
