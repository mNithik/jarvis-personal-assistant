# Wave 5 architecture — Intelligence

Wave 5 closes the self-improving router loop: opt-in training export, deploy gate, local Ollama router model, supervisor recovery, and SQLite-backed phrase learning.

## Training pipeline (S16)

| Stage | Path / command |
|-------|----------------|
| Export | `{app_data}/training-export.jsonl` (opt-in via gateway config) |
| Anonymize | `anonymize_training_export` Tauri command or `scripts/anonymize_training_export.ps1` |
| Eval gate | `run_training_eval_gate` — scans `tests/evals/f*.json` route goldens |

Deploy gate rules ([`eval_gate.rs`](../apps/desktop/src-tauri/src/training/eval_gate.rs)):

- Current accuracy must meet `training.evalMinAccuracyPct` (default 95%)
- When baseline &lt; 99%, current must beat baseline by ≥ 5 points
- When baseline ≥ 99%, current must match baseline

## jarvis-router Ollama model (S17)

- Modelfile: [`training/jarvis-router.Modelfile`](../apps/desktop/training/jarvis-router.Modelfile)
- Create script: `scripts/create-jarvis-router.ps1` → `ollama create jarvis-router`
- L2 adapter: [`router/l2.rs`](../apps/desktop/src-tauri/src/gateway/router/l2.rs) tries `jarvis-router` before the configured Ollama model when `routing.jarvisRouterEnabled` is true

## L3 / L4 supervisor recovery (S18)

Multi-step `supervisor.delegate` turns in [`task_loop.rs`](../apps/desktop/src-tauri/src/gateway/task_loop.rs):

1. **L3** — `replan_supervisor_step` re-routes a failed sub-command
2. **L4** — `verify_with_builder` falls back to Builder debug when L3 still fails

Recovery emits `Thinking` trace events (`L3 supervisor replan`, `L4 builder verify`).

## Semantic learning panel (S19)

- UI: [`SemanticLearningPanel.tsx`](../apps/desktop/src/ui/cockpit/SemanticLearningPanel.tsx)
- Storage: existing `learned_intents` SQLite table (no schema migration)
- Routing: [`router/l1.rs`](../apps/desktop/src-tauri/src/gateway/router/l1.rs) maps saved capability IDs from the registry

## Verify gate

```powershell
cd apps/desktop/src-tauri; cargo test --lib -j 1
cd ../..; npx tsc --noEmit
npm run build
```
