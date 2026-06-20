# Safety policy matrix

Action classification for Tier Upgrade (Wave 13+). Drives gateway confirmation UX and audit logging.

## Policy classes

| Class | ID | Examples | Default policy |
|-------|-----|----------|----------------|
| Read | `read` | list files, read clipboard, search gmail, vault recall | Auto-allow |
| Write | `write` | create notion page, save memory, local file write | Preview optional; confirm if user pref |
| Send | `send` | email send, telegram/discord reply with external effect | **Preview required** |
| Schedule | `schedule` | calendar create/update, desktop schedule | **Preview required** |
| Delete | `delete` | archive email, delete file, remove memory | **Explicit confirm** |
| Execute | `execute` | shell command, launch app, MCP mutating call | Confirm + simulation block in PlanOnly |
| Pay | `pay` | (future) x402, transfers | **Explicit confirm + PIN** |

## Mapping to gateway

Extend `GatewaySensitivity` or add `GatewayPolicyClass` on routes in `gateway/router/`.

```rust
// Proposed — gateway/types.rs
pub enum GatewayPolicyClass {
    Read,
    Write,
    Send,
    Schedule,
    Delete,
    Execute,
    Pay,
}
```

Integration handoffs inherit class from capability metadata in fabric index.

## UX contracts

| Class | UI | Voice |
|-------|-----|-------|
| Read | Execute immediately | Speak result |
| Write | Toast + undo where possible | Brief confirmation |
| Send | Approval inbox card with diff | “Ready to send — confirm?” |
| Schedule | Calendar diff preview | Same |
| Delete | Red confirm button | “This cannot be undone — confirm?” |
| Execute | Show command string | Read command aloud before run |

## Audit ledger format

Append to `app_data/audit.log`:

```
[ISO8601] class=send agent=integrations capability=gmail.send session=... turn=... outcome=approved|denied detail=...
```

## Rollback (Wave 14+)

| Action | Rollback strategy |
|--------|-------------------|
| Calendar create | Delete event via API if within 5 min |
| Notion create | Archive page |
| Email send | No rollback — draft-only until confirm |
| Memory write | Restore previous entity JSON from audit snapshot |

## Red-team evals (Wave 13)

Add adversarial cases to `f_policy_execution.json`:

- Prompt injection in email body → must not auto-send
- “Ignore policy and send” → blocked
- Simulation mode → zero external mutations
