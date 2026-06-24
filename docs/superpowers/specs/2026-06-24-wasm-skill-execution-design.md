# T17-B Wasm Skill Execution Design

## Goal

Land the first real Wasm execution path for Skill SDK v2 so an installed skill can execute a local Wasm artifact through the existing skill executor without gaining arbitrary host access.

This slice is intentionally narrower than the full Wave 17 sandbox vision. It should make Path C materially more real while keeping the trust boundary small enough to validate and ship incrementally.

## Current state

The codebase already has three relevant foundations:

- [skills.rs](C:/Users/nithi/OneDrive/Documents/jarvis/apps/desktop/src-tauri/src/gateway/skills.rs) loads installed skill manifests, scopes them by active profile, and validates `route`, `http`, and `script` handlers at load time.
- [skills_executor.rs](C:/Users/nithi/OneDrive/Documents/jarvis/apps/desktop/src-tauri/src/gateway/skills_executor.rs) executes the current handler set through a dedicated module boundary.
- [sandbox.rs](C:/Users/nithi/OneDrive/Documents/jarvis/apps/desktop/src-tauri/src/builder/sandbox.rs) validates raw Wasm bytes, but it does not yet participate in skill loading or execution.

The missing piece is a first-class `wasm` skill handler that turns the existing validator into a usable execution path.

## Scope

This design covers:

- a `wasm` skill handler in `skill.json`
- load-time validation for local Wasm artifacts
- executor support for running a Wasm-backed skill
- a minimal text-only host boundary
- unit and eval coverage proving the end-to-end path

This design does not cover:

- broad host capabilities such as filesystem, network, database, shell, or UI automation
- multi-function guest APIs
- remote module download or marketplace delivery
- full policy-matrix expansion beyond the first bounded execution path

## Recommended approach

Use a minimal real execution model.

The manifest should accept a `wasm` handler that references a module stored inside the installed skill directory. The loader validates that artifact at registration time. The executor then runs the module through a dedicated sandbox boundary and returns a bounded text reply.

This keeps the first milestone useful without pretending to solve the full sandbox problem. It also matches the current architecture: `skills.rs` remains the validation and registry seam, while `skills_executor.rs` remains the single execution seam.

## Manifest design

Add a new handler variant to `SkillHandler`:

```json
{
  "type": "wasm",
  "module": "dist/skill.wasm",
  "entrypoint": "run"
}
```

Rules:

- `module` is a relative path under the installed skill directory.
- absolute paths are rejected
- parent-directory traversal such as `..` is rejected
- `entrypoint` defaults to `run` when omitted
- the manifest still uses the existing top-level `permissions` array, but this first slice does not unlock extra host privileges

## Execution contract

The first Wasm host surface is intentionally tiny.

Guest input:

- command text that triggered the skill
- manifest metadata the runtime needs internally, not as guest-visible arbitrary host state

Guest output:

- one bounded UTF-8 text reply

Guest behavior:

- the module exports a single function named by `entrypoint`
- the function returns a text payload through a narrow ABI chosen during implementation
- failures map to a normal `StepResult::failed(...)`

Host restrictions:

- no direct file reads or writes
- no network access
- no subprocess launch
- no database access
- no ambient access to profile state outside the command text already being routed

## Sandbox boundary

The existing [sandbox.rs](C:/Users/nithi/OneDrive/Documents/jarvis/apps/desktop/src-tauri/src/builder/sandbox.rs) should evolve from byte validation into the home for Wasm execution helpers, while still keeping a small public surface.

The first implementation should provide:

- module byte validation
- module size limit enforcement
- local file resolution under the skill root
- entrypoint presence validation
- bounded execution with deterministic failure messages

The implementation may use a minimal runtime now and grow into full fuel-limited Wasmtime later, but this slice must preserve the isolation contract above and keep execution fully local.

## Loader behavior

`skills.rs` should treat Wasm artifacts as part of manifest validation, not as a best-effort runtime concern.

At load time the loader should reject:

- missing Wasm files
- paths that escape the skill directory
- empty modules
- invalid Wasm bytes
- modules above the configured maximum size
- manifests whose declared entrypoint is not present or not callable under the chosen ABI

This keeps unsupported or unsafe Wasm skills out of the active registry entirely, which matches how `http` and `script` handlers now fail early.

## Executor behavior

`skills_executor.rs` should add a `wasm` arm alongside `route`, `http`, and `script`.

Execution flow:

1. Revalidate the manifest defensively.
2. Resolve the skill-local Wasm artifact.
3. Invoke the sandbox runtime with the command text and configured entrypoint.
4. Convert the bounded text reply into `StepResult::ok(...)`.
5. Convert runtime traps, invalid output, and policy failures into `StepResult::failed(...)`.

The executor should not open new side channels around the sandbox. All Wasm-specific behavior should stay behind the sandbox helper boundary.

## Data and file layout

Installed skill layout remains profile-aware and unchanged at the directory level:

- `app_data/skills/<skill-id>/skill.json`
- `app_data/skills/<skill-id>/dist/skill.wasm`
- `app_data/skills/<profile-id>/<skill-id>/...` for profile-local skills

The loader resolves `module` relative to the specific skill directory already selected after global versus profile-local override logic.

## Error handling

Errors should be explicit and user-readable.

Loader-side examples:

- `Installed skill "planner" v1.0.0 references a missing Wasm module.`
- `Installed skill "planner" v1.0.0 must keep Wasm modules inside the skill directory.`
- `Installed skill "planner" v1.0.0 declares missing Wasm entrypoint "run".`

Executor-side examples:

- `Installed skill "planner" v1.0.0 Wasm execution trapped: ...`
- `Installed skill "planner" v1.0.0 returned invalid UTF-8 output.`
- `Installed skill "planner" v1.0.0 produced output larger than the allowed limit.`

## Testing plan

Add coverage at three levels.

Manifest validation in `skills.rs`:

- accepts a valid local Wasm manifest
- rejects escaping paths
- rejects missing files
- rejects invalid Wasm bytes
- rejects missing entrypoints

Executor tests in `skills_executor.rs`:

- executes a valid Wasm skill and returns bounded text
- converts guest failure into failed `StepResult`
- rejects oversized or invalid guest output

Eval coverage in `gateway/evals.rs`:

- extend F63 execution coverage with one Wasm-backed installed skill case so the Wave 17 lane proves real Wasm execution, not just route/http/script behavior

## Risks and tradeoffs

Main risk:

- the runtime/ABI choice can bloat the slice if it tries to solve too much at once

Mitigation:

- keep one entrypoint, one reply channel, and one bounded text output contract

Main tradeoff:

- this slice is intentionally less capable than a full plugin runtime

Why it is still worth doing:

- it establishes the real execution seam, keeps policy constraints explicit, and gives the Skill SDK v2 roadmap a concrete foundation instead of another placeholder

## Implementation sequence

1. Extend `SkillHandler` with `wasm`.
2. Add skill-root-aware Wasm manifest validation in `skills.rs`.
3. Expand `sandbox.rs` with artifact resolution and entrypoint validation helpers.
4. Add Wasm execution support in `skills_executor.rs`.
5. Add unit tests and one eval-level Wasm skill case.
6. Update Wave 17 docs to reflect that `wasm` is now a first-class constrained execution type.

## Success criteria

This slice is successful when:

- an installed skill can reference a local Wasm module in `skill.json`
- invalid Wasm manifests are rejected during skill loading
- a valid Wasm skill executes through the same installed-skill path as other handlers
- the guest can only produce bounded text output, not arbitrary host actions
- unit and eval coverage prove the path end to end
