# Wasm Skill Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class `wasm` installed-skill handler that validates local Wasm artifacts at load time and executes them through a constrained text-only sandbox path.

**Architecture:** Extend the existing installed-skill pipeline instead of inventing a parallel system. `skills.rs` remains the manifest validation and registry seam, `builder/sandbox.rs` becomes the small Wasm helper boundary for resolution and execution, and `skills_executor.rs` remains the only place that turns a valid manifest into a `StepResult`.

**Tech Stack:** Rust, Tauri desktop backend, `wasmparser`, `wasmtime`, existing gateway eval/test harness, Cargo unit tests.

---

## File map

- Modify: `apps/desktop/src-tauri/Cargo.toml`
  - add the minimal Wasm runtime dependency for actual guest execution
- Modify: `apps/desktop/src-tauri/src/gateway/skills.rs`
  - add `SkillHandler::Wasm`
  - validate Wasm manifests against the selected skill root
  - add manifest-level tests for valid and invalid Wasm skills
- Modify: `apps/desktop/src-tauri/src/builder/sandbox.rs`
  - keep byte validation
  - add skill-local path resolution, entrypoint validation, and bounded execution helpers
  - add focused sandbox tests
- Modify: `apps/desktop/src-tauri/src/gateway/skills_executor.rs`
  - route `wasm` handlers through the sandbox helper and convert output to `StepResult`
  - add executor tests for success and failure paths
- Modify: `apps/desktop/src-tauri/src/gateway/evals.rs`
  - extend F63-style execution coverage with one Wasm-backed installed skill case
- Modify: `docs/ARCHITECTURE_WAVE17.md`
  - note that constrained Wasm execution is now part of T17-B current status

### Task 1: Add the Wasm runtime dependency

**Files:**
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Test: `apps/desktop/src-tauri/Cargo.toml` resolves during `cargo test --no-run`

- [ ] **Step 1: Add the failing dependency expectation to the plan context**

We need a runtime that can instantiate a guest and call one exported entrypoint. The current file only includes `wasmparser`, so execution cannot be implemented yet.

- [ ] **Step 2: Add the minimal dependency**

```toml
# apps/desktop/src-tauri/Cargo.toml
[dependencies]
wasmparser = "0.244"
wasmtime = { version = "25", default-features = false, features = ["cranelift", "runtime"] }
```

- [ ] **Step 3: Run dependency resolution**

Run: `cargo test --lib --no-default-features --no-run -j 1`

Expected: dependency resolution succeeds and compilation now reaches source errors about missing Wasm handler/runtime code instead of crate-resolution failures.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/Cargo.lock
git commit -m "build: add wasmtime for skill execution"
```

### Task 2: Add manifest support and load-time Wasm validation

**Files:**
- Modify: `apps/desktop/src-tauri/src/gateway/skills.rs`
- Modify: `apps/desktop/src-tauri/src/builder/sandbox.rs`
- Test: `apps/desktop/src-tauri/src/gateway/skills.rs` unit tests

- [ ] **Step 1: Write failing Wasm manifest tests in `skills.rs`**

Add tests that express the required loader behavior before touching implementation:

```rust
#[test]
fn validates_local_wasm_manifest() {
    let dir = temp_skill_dir("wasm-valid");
    let manifest = manifest(
        "wasm-skill",
        &[],
        SkillHandler::Wasm {
            module: "dist/skill.wasm".to_string(),
            entrypoint: Some("run".to_string()),
        },
    );
    write_wasm_fixture(&dir, "dist/skill.wasm", minimal_wasm_with_export("run"));
    assert!(validate_manifest_at_root(&manifest, &dir).is_ok());
}

#[test]
fn rejects_wasm_manifest_that_escapes_skill_root() {
    let dir = temp_skill_dir("wasm-escape");
    let manifest = manifest(
        "wasm-skill",
        &[],
        SkillHandler::Wasm {
            module: "../escape.wasm".to_string(),
            entrypoint: Some("run".to_string()),
        },
    );
    let error = validate_manifest_at_root(&manifest, &dir).expect_err("escape should fail");
    assert!(error.contains("inside the skill directory"));
}

#[test]
fn rejects_wasm_manifest_with_missing_entrypoint() {
    let dir = temp_skill_dir("wasm-missing-export");
    let manifest = manifest(
        "wasm-skill",
        &[],
        SkillHandler::Wasm {
            module: "dist/skill.wasm".to_string(),
            entrypoint: Some("run".to_string()),
        },
    );
    write_wasm_fixture(&dir, "dist/skill.wasm", minimal_wasm_with_export("other"));
    let error = validate_manifest_at_root(&manifest, &dir).expect_err("entrypoint should fail");
    assert!(error.contains("entrypoint"));
}
```

- [ ] **Step 2: Run the targeted tests to verify failure**

Run: `cargo test --lib gateway::skills::tests::validates_local_wasm_manifest --no-default-features -j 1`

Expected: FAIL because `SkillHandler::Wasm`, `validate_manifest_at_root`, and Wasm fixture helpers do not exist yet.

- [ ] **Step 3: Add the Wasm manifest shape**

Extend `SkillHandler` and split validation so root-aware handlers can validate against a concrete skill directory:

```rust
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SkillHandler {
    Http { url: String, method: String },
    Script { command: String },
    Route { capability_id: String },
    Wasm { module: String, #[serde(default)] entrypoint: Option<String> },
}

pub fn validate_manifest(manifest: &SkillManifest) -> Result<(), String> {
    validate_manifest_common(manifest)?;
    validate_handler_manifest(manifest)
}

fn validate_manifest_at_root(manifest: &SkillManifest, skill_root: &Path) -> Result<(), String> {
    validate_manifest_common(manifest)?;
    validate_handler_manifest_at_root(manifest, skill_root)
}
```

- [ ] **Step 4: Add Wasm-specific sandbox validation helpers**

In `sandbox.rs`, add focused helpers used by the loader:

```rust
pub fn resolve_skill_wasm_path(skill_root: &Path, module: &str) -> Result<PathBuf, String> {
    let relative = Path::new(module);
    if relative.is_absolute() || relative.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err("Wasm modules must stay inside the skill directory.".to_string());
    }
    let resolved = skill_root.join(relative);
    if !resolved.exists() {
        return Err("Wasm module is missing.".to_string());
    }
    Ok(resolved)
}

pub fn validate_wasm_artifact(skill_root: &Path, module: &str, entrypoint: &str) -> Result<PathBuf, String> {
    let path = resolve_skill_wasm_path(skill_root, module)?;
    let bytes = std::fs::read(&path).map_err(|error| error.to_string())?;
    validate_wasm_module(&bytes)?;
    validate_wasm_entrypoint(&bytes, entrypoint)?;
    Ok(path)
}
```

- [ ] **Step 5: Implement loader-side Wasm validation**

Wire `skills.rs` to call the sandbox helpers when a real skill directory is known:

```rust
fn validate_handler_manifest_at_root(manifest: &SkillManifest, skill_root: &Path) -> Result<(), String> {
    match &manifest.handler {
        SkillHandler::Route { .. } => Ok(()),
        SkillHandler::Http { url, method } => validate_http_handler(manifest, url, method),
        SkillHandler::Script { command } => validate_script_handler(manifest, command),
        SkillHandler::Wasm { module, entrypoint } => {
            let export = entrypoint.as_deref().unwrap_or("run");
            crate::builder::sandbox::validate_wasm_artifact(skill_root, module, export).map(|_| ()).map_err(|error| {
                format!(
                    "Installed skill \"{}\" v{} {}",
                    manifest.label, manifest.version, error
                )
            })
        }
    }
}
```

- [ ] **Step 6: Make disk loading validate against each actual skill directory**

Update the loader so each `skill.json` is validated against its containing folder:

```rust
let skill_root = entry.path();
let manifest: SkillManifest = serde_json::from_str(&raw).map_err(|error| error.to_string())?;
validate_manifest_at_root(&manifest, &skill_root)?;
manifests.push(manifest);
```

- [ ] **Step 7: Run the focused Wasm manifest tests**

Run: `cargo test --lib gateway::skills::tests --no-default-features -j 1`

Expected: PASS for the new Wasm manifest validation tests and existing route/http/script tests.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src-tauri/src/gateway/skills.rs apps/desktop/src-tauri/src/builder/sandbox.rs
git commit -m "feat: validate wasm installed skills at load time"
```

### Task 3: Add bounded Wasm execution helpers in the sandbox

**Files:**
- Modify: `apps/desktop/src-tauri/src/builder/sandbox.rs`
- Test: `apps/desktop/src-tauri/src/builder/sandbox.rs` unit tests

- [ ] **Step 1: Write failing sandbox execution tests**

Add tests that define the runtime contract:

```rust
#[test]
fn executes_wasm_entrypoint_and_returns_text() {
    let bytes = minimal_wasm_returning_text("run", "hello from wasm");
    let reply = execute_wasm_text(&bytes, "run", "run wasm skill").expect("execute");
    assert_eq!(reply, "hello from wasm");
}

#[test]
fn rejects_wasm_output_larger_than_limit() {
    let bytes = minimal_wasm_returning_large_text("run");
    let error = execute_wasm_text(&bytes, "run", "run wasm skill").expect_err("oversized output should fail");
    assert!(error.contains("allowed limit"));
}
```

- [ ] **Step 2: Run the targeted sandbox tests to verify failure**

Run: `cargo test --lib builder::sandbox::tests --no-default-features -j 1`

Expected: FAIL because `execute_wasm_text` and output bounds do not exist yet.

- [ ] **Step 3: Add small execution primitives**

Add constants and a single public execution helper:

```rust
pub const MAX_WASM_REPLY_BYTES: usize = 16 * 1024;

pub fn execute_wasm_file(skill_root: &Path, module: &str, entrypoint: &str, command: &str) -> Result<String, String> {
    let path = validate_wasm_artifact(skill_root, module, entrypoint)?;
    let bytes = std::fs::read(path).map_err(|error| error.to_string())?;
    execute_wasm_text(&bytes, entrypoint, command)
}
```

- [ ] **Step 4: Implement the text-only runtime contract**

Use one small helper that instantiates the module, passes command text through guest memory, and reads back one bounded UTF-8 reply:

```rust
fn execute_wasm_text(bytes: &[u8], entrypoint: &str, command: &str) -> Result<String, String> {
    let engine = wasmtime::Engine::default();
    let module = wasmtime::Module::from_binary(&engine, bytes)
        .map_err(|error| format!("Wasm module could not be compiled: {error}"))?;
    let mut store = wasmtime::Store::new(&engine, GuestIo::from_command(command));
    let mut linker = wasmtime::Linker::new(&engine);
    bind_text_host_functions(&mut linker)?;
    let instance = linker.instantiate(&mut store, &module)
        .map_err(|error| format!("Wasm execution trapped during instantiate: {error}"))?;
    call_text_entrypoint(&mut store, &instance, entrypoint)?;
    store.data().take_reply(MAX_WASM_REPLY_BYTES)
}
```

- [ ] **Step 5: Run the sandbox tests**

Run: `cargo test --lib builder::sandbox::tests --no-default-features -j 1`

Expected: PASS for byte validation, entrypoint validation, and bounded text execution tests.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src-tauri/src/builder/sandbox.rs
git commit -m "feat: add bounded wasm sandbox execution"
```

### Task 4: Wire Wasm execution into the installed-skill executor

**Files:**
- Modify: `apps/desktop/src-tauri/src/gateway/skills_executor.rs`
- Modify: `apps/desktop/src-tauri/src/agents/command.rs` only if the executor now needs `app_data_dir`/skill-root context passed explicitly
- Test: `apps/desktop/src-tauri/src/gateway/skills_executor.rs`

- [ ] **Step 1: Write failing executor tests**

Add the new behavior next to the current route/http/script tests:

```rust
#[test]
fn wasm_handler_executes_and_returns_reply() {
    let dir = temp_skill_dir("wasm-exec");
    write_wasm_fixture(&dir, "dist/skill.wasm", minimal_wasm_returning_text("run", "skill-wasm"));
    let result = execute_skill(
        &manifest(
            "wasm-skill",
            &[],
            SkillHandler::Wasm {
                module: "dist/skill.wasm".to_string(),
                entrypoint: Some("run".to_string()),
            },
        ),
        Some(&dir),
        "run wasm skill",
    );
    assert!(result.success);
    assert!(result.reply.contains("skill-wasm"));
}
```

- [ ] **Step 2: Run the executor tests to verify failure**

Run: `cargo test --lib gateway::skills_executor::tests --no-default-features -j 1`

Expected: FAIL because the executor does not yet accept Wasm context or route Wasm handlers.

- [ ] **Step 3: Expand the executor signature minimally**

Move from a manifest-only executor to one that can receive skill-root and command text when needed:

```rust
pub fn execute_skill(
    manifest: &SkillManifest,
    skill_root: Option<&Path>,
    command: &str,
) -> StepResult
```

Keep `route`, `http`, and `script` behavior unchanged by passing through the extra arguments unused where not needed.

- [ ] **Step 4: Add the Wasm executor arm**

```rust
SkillHandler::Wasm { module, entrypoint } => {
    let Some(skill_root) = skill_root else {
        return StepResult::failed(format!(
            "Installed skill \"{}\" v{} is missing its skill directory context.",
            manifest.label, manifest.version
        ));
    };
    let export = entrypoint.as_deref().unwrap_or("run");
    match crate::builder::sandbox::execute_wasm_file(skill_root, module, export, command) {
        Ok(reply) => StepResult::ok(format!(
            "Installed skill \"{}\" v{} Wasm reply:\n{}",
            manifest.label, manifest.version, reply
        )),
        Err(error) => StepResult::failed(format!(
            "Installed skill \"{}\" v{} {}",
            manifest.label, manifest.version, error
        )),
    }
}
```

- [ ] **Step 5: Thread through the selected skill directory**

If `CommandAgent` currently only passes the manifest, introduce the smallest possible way to recover the chosen skill directory from the matched installed skill record and pass it to `execute_skill(...)`.

```rust
let skill = crate::gateway::skills::match_dynamic_skill(&ctx.command, &ctx.db_path, &ctx.app_data_dir)
    .ok_or_else(|| "Installed skill not found".to_string())?;
let skill_root = crate::gateway::skills::skill_root_for_manifest(&ctx.db_path, &ctx.app_data_dir, &skill.id)?;
Ok(crate::gateway::skills_executor::execute_skill(&skill, Some(&skill_root), &ctx.command))
```

- [ ] **Step 6: Run the executor tests**

Run: `cargo test --lib gateway::skills_executor::tests --no-default-features -j 1`

Expected: PASS for existing handlers and the new Wasm success/failure cases.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src-tauri/src/gateway/skills_executor.rs apps/desktop/src-tauri/src/agents/command.rs apps/desktop/src-tauri/src/gateway/skills.rs
git commit -m "feat: execute wasm installed skills"
```

### Task 5: Add eval coverage and update Wave 17 docs

**Files:**
- Modify: `apps/desktop/src-tauri/src/gateway/evals.rs`
- Modify: `docs/ARCHITECTURE_WAVE17.md`
- Test: eval/unit compile coverage

- [ ] **Step 1: Write the Wasm-backed F63 execution case**

Add a new installed skill fixture in the existing F63 execution-level test:

```rust
SkillManifest {
    id: "wasm-skill".into(),
    version: "1.0.0".into(),
    label: "Wasm Skill".into(),
    keywords: vec!["wasm skill".into()],
    agent: "command".into(),
    permissions: vec![],
    enabled: true,
    handler: SkillHandler::Wasm {
        module: "dist/skill.wasm".into(),
        entrypoint: Some("run".into()),
    },
}
```

Write the Wasm file into that fixture skill directory and assert:

```rust
let wasm_result = crate::agents::command::CommandAgent
    .run_step(&ctx_for("run wasm skill"))
    .expect("wasm step");
assert!(wasm_result.success);
assert!(wasm_result.reply.contains("skill-wasm"));
```

- [ ] **Step 2: Update the Wave 17 status note**

Add one concise line under T17-B current status:

```md
- `wasm` handlers now support a constrained MVP: skill-local modules, load-time validation, and bounded text-only execution through the sandbox boundary
```

- [ ] **Step 3: Run verification**

Run:

```powershell
cargo fmt
$env:CARGO_TARGET_DIR='C:\Users\nithi\OneDrive\Documents\jarvis\.tmp-cargo-target'; cargo test --lib --no-default-features --no-run -j 1
.\node_modules\.bin\tsc.cmd -p apps/desktop/tsconfig.json --noEmit
```

Expected:

- `cargo fmt` succeeds
- compile-only Rust verification succeeds
- TypeScript check remains green

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/src/gateway/evals.rs docs/ARCHITECTURE_WAVE17.md
git commit -m "test: cover wasm skill execution in evals"
```

## Self-review

- Spec coverage:
  - `wasm` handler shape is covered by Task 2.
  - load-time validation and skill-root resolution are covered by Tasks 2 and 3.
  - bounded text-only execution is covered by Tasks 3 and 4.
  - unit and eval coverage are covered by Tasks 2, 3, 4, and 5.
  - Wave 17 doc alignment is covered by Task 5.
- Placeholder scan:
  - no `TODO`, `TBD`, or “implement later” placeholders remain in the task steps.
- Type consistency:
  - the plan consistently uses `SkillHandler::Wasm`, `validate_manifest_at_root`, `validate_wasm_artifact`, `execute_wasm_file`, and `execute_skill(..., skill_root, command)`.
