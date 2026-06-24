# Tier Upgrade — Moonshot labs

Labs lane: **30–40%** capacity. All features behind `gateway.labs` config flags (default **off**).

## Lab flags (proposed)

```json
{
  "labs": {
    "projectBundlePilot": false,
    "councilVerifier": false,
    "proactiveAnomaly": false,
    "worldModelQueries": false
  }
}
```

Add to `GatewayConfig` in `gateway/config.rs`; persist in `gateway.json`.

---

## Lab L1 — Project bundle pilot (Wave 13)

**Flag:** `labs.projectBundlePilot`

**Flow:** Meeting follow-up bundle

1. User: `run meeting follow-up bundle` (or proactive after meeting ends)
2. Planner decomposes: fetch related emails → update meeting prep memory → draft follow-up email → create Notion task
3. Mission control shows DAG; each step awaits policy approval where required
4. Evidence bundle written to `app_data/bundles/{run_id}/`

**Graduation criteria (→ production):**

- ≥90% step success on golden fixture set (10 runs)
- &lt;5% user hard-abort rate in manual testing
- Full audit trail for every external write

**Evals:** `f_project_bundle_execution.json` (F48, lab-only assert)

---

## Lab L2 — Council verifier on send (Wave 13)

**Flag:** `labs.councilVerifier`

**Flow:** Before `send` class actions, a second agent pass:

- **Executor** produces draft action
- **Verifier** checks: recipient match, tone, policy class, hallucination cues
- On disagreement → block + show both opinions in approval inbox

**Scope:** Email send and calendar create only (Wave 13).

**Graduation criteria:**

- Verifier catches ≥80% of injected bad-send fixtures
- Latency &lt;2× single-agent path p95

---

## Lab L3 — Multi-agent council (Wave 14)

**Flag:** `labs.councilRuntime`

Planner + critic + executor + verifier with logged votes. Complex tasks only (project bundles, doc pipelines).

**Graduation criteria (F67):**

- Vote log persisted under `app_data/council/{turn_id}.json` for bundle turns
- ≥85% bundle turns retain vote log on golden fixture replay
- No auto-execution without approval on hard tasks

---

## Lab L4 — Proactive anomaly (Wave 14)

**Flag:** `labs.proactiveAnomaly`

Detect calendar overload, deadline drift, inbox spike; propose interventions. Never auto-execute writes.

**Graduation criteria:** dismiss rate &lt;40%; accept rate &gt;25% over 2-week manual cohort.

---

## Lab L5 — Personal world model (Wave 15)

**Flag:** `labs.worldModelQueries`

Graph queries: people ↔ projects ↔ commitments. Simulation: “what if I cancel trip X?”

Requires Memory v2 topic graph in production first.

**Graduation criteria (F69):**

- Topic graph UI v2 shipped (canvas + neighbor drill-down)
- ≥90% world-model golden queries return read-only simulation text
- Zero external writes from world-model path

---

## Lab L6 — Ambient multimodal (Wave 16+)

**Flag:** `labs.ambientCopilot`

Real-time suggestions from desktop + OCR + voice during focus sessions. Strict consent UI; off by default.

**Graduation criteria (F70):**

- OCR/voice signals route through `record_ambient_signal_cmd` during consented sessions
- Dismiss rate &lt;40% over a 2-week manual cohort
- Zero auto-writes from ambient suggestions (read-only only)

---

## Promotion process

1. Lab meets graduation criteria on fabric + manual checklist
2. Flag default flips to `true` for new installs only (or opt-in banner)
3. Item moves to balanced track in ROADMAP; lab flag deprecated after one release
