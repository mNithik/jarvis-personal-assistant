# Lab graduation log

Labs remain **off by default** until each row meets automated pre-checks **and** manual cohort criteria ([E2E_RUNBOOK.md](./E2E_RUNBOOK.md) § F65–F70).

Record evidence here before changing `GatewayLabsConfig::default()` for new installs.

| ID | Flag | Automated | Manual criteria | Status | Evidence date | Notes |
|----|------|-----------|-----------------|--------|---------------|-------|
| F65 | `projectBundlePilot` | `f_project_bundle_execution.json` | ≥90% step success; &lt;5% abort; audit trail | **harness-ready** | 2026-07-09 | Golden pre-check green (Linux CI); 2-week dogfood not started; unblocks checklist row 9 harness sign-off |
| F66 | `councilVerifier` | `f_council_verifier_execution.json` | ≥80% bad-send caught; latency &lt;2× p95 | **harness-ready** | 2026-07-09 | Golden pre-check green (Linux CI); unblocks checklist row 10 harness sign-off |
| F67 | `councilRuntime` | council vote log evals | Vote log on ≥85% bundle replays | queued | 2026-07-08 | Awaiting F66 dogfood decision |
| F68 | `proactiveAnomaly` | proactive routes + UI spec | dismiss &lt;40%; accept &gt;25% / 2 weeks | queued | 2026-07-08 | Awaiting F67 |
| F69 | `worldModelQueries` | `f_world_model_execution.json` | ≥90% read-only queries; zero writes | queued | 2026-07-08 | Awaiting F68 |
| F70 | `ambientCopilot` | F64 + ambient spec | dismiss &lt;40%; zero auto-writes / 2 weeks | **dogfood-active** | 2026-07-10 | Wave 22 cycle re-opened; weekly metrics via `tools/export-labs-metrics.ps1`; decision target week 4 |

## F70 dogfood protocol — Wave 22 cycle (in progress)

**Started (2026-07-10):** Re-opened 2-week `ambientCopilot` dogfood per Wave 22 plan.

**Protocol:**
1. Enable `labs.ambientCopilot` in Gateway → Labs
2. Daily use with consent session; zero auto-writes
3. Weekly: `powershell -File tools/export-labs-metrics.ps1`
4. Week 4 decision: graduate or **not ready** with dismiss-rate evidence

**Prior cycle (2026-07-09):** **not ready** — dismiss cohort incomplete.

## F65 dogfood protocol (queued after F70)

Start after F70 graduation decision (target week 6):

1. Enable `labs.projectBundlePilot` in Gateway → Labs
2. Run a 4-step bundle; confirm audit refs under `app_data/bundles/`
3. Weekly: Operator panel bundle list + audit tail
4. After 2 weeks: ≥90% step success → mark **graduated**; else **not ready**

**Harness pre-check (2026-07-09):** `f_project_bundle_execution.json` indexed; RELEASE_CHECKLIST row 9 signed on fixture/harness basis.

## F66 harness pre-check (2026-07-09)

**Harness pre-check:** `f_council_verifier_execution.json` indexed; RELEASE_CHECKLIST row 10 signed on fixture/harness basis. Full dogfood queued after F65 cycle (target week 8).

## Quarter checkpoints (planned)

- Week 2: F70 first metrics export + dismissal baseline
- Week 4: F70 graduation decision (graduate or not-ready with evidence) — **not ready recorded 2026-07-09**
- Week 6: F65 start and first bundle success-rate sample
- Week 8: F65 decision + F66 kickoff if F65 stable
- Week 10: F67/F68 evidence pass or explicit not-ready notes
- Week 12: F69 decision + release-note summary

## Metrics source

Local metrics export: `get_proactive_metrics_cmd` → `app_data/metrics/proactive-summary.json`  
Eval harness summary: `JARVIS_EVALS_SUMMARY_PATH` or auto-export after `eval_golden_f_fabric_index`

## Promotion process

1. Lab meets graduation criteria on fabric + manual checklist
2. Opt-in banner for one release
3. Flip default for **new installs only**
4. Move to balanced track in ROADMAP; deprecate lab flag after one release
