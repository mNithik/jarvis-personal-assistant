# Metrics and evals v2

Extend fabric from **route/execution goldens** to **task-level success** (Tier Upgrade Wave 13).

## Task eval schema

```json
{
  "taskId": "meeting-follow-up-bundle",
  "steps": [
    { "command": "prep me for my next meeting", "expectSuccess": true },
    { "command": "draft follow-up email", "expectSuccess": true, "expectReplyContains": "thank" }
  ],
  "expectTaskSuccess": true,
  "maxDurationMs": 120000
}
```

Harness: `run_task_execution_file()` in `gateway/evals.rs`.

## KPI definitions

| KPI | Definition | Source |
|-----|------------|--------|
| Task completion rate | Tasks with all steps success / total tasks | Task eval harness |
| Step failure rate | Failed steps / total steps | Gateway bus + task_runs |
| Approval friction | Approvals / completed send+schedule actions | Audit log |
| Proactive accept rate | Accepted nudges / shown nudges | UI telemetry (local only) |
| Memory correction rate | User corrections / memory retrievals | Memory v2 events |

## Fabric expansion (Wave 13 targets)

| ID | Capability | Eval file | Type |
|----|------------|-----------|------|
| F43 | `core.mission` | `f_mission_control_routes.json` | route |
| F44 | `core.mission` | `f_task_run_execution.json` | execution |
| F45 | `core.policy` | `f_policy_execution.json` | execution |
| F46 | `integrations.gmail` | `f_email_copilot_routes.json` | route |
| F47 | `integrations.gmail` | `f_email_copilot_execution.json` | execution |
| F48 | `labs.bundle` | `f_project_bundle_execution.json` | execution (lab) |

Index assert bumps to **48** when Wave 13 evals land.

## Regression packs

Run on every PR (CI target):

| Pack | Covers |
|------|--------|
| `core` | clipboard, files, policy |
| `integrations` | gmail, calendar, notion |
| `memory` | life domains, meeting copilot |
| `automation` | schedules, triggers, ocr watch |
| `labs` | optional; skipped if labs disabled |

## Local summary export

After `cargo test --lib`, write `app_data/evals-summary.json`:

```json
{
  "fabricCount": 48,
  "taskEvalPassRate": 0.92,
  "timestamp": "..."
}
```

## Lens scoring (hybrid promotion)

Use three lenses from [TIER_UPGRADE_VISION.md](./TIER_UPGRADE_VISION.md):

- **Ship balanced feature** when Lens A neutral or better.
- **Promote lab** when Lens B or C improves ≥10% with Lens A unchanged.
