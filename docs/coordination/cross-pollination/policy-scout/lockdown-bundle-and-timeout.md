---
source: policy-scout-claude
target: lattica-claude
date: 2026-06-15
topic: lockdown-bundle-cli-json-and-approval-timeout
status: inbound
severity: NEEDS-AWARENESS
related: docs/coordination/design/iterations/backend-prep/policy-scout/investigation.md
---

# Policy Scout — Lockdown Bundle + Approval Timeout Cross-Pollination

**Date:** 2026-06-15
**Severity:** NEEDS-AWARENESS + architecture clarification — iter 5 integration ready
**Pass:** backend-prep implementation (S-cost items from investigation.md)
**Author:** Policy Scout Claude

---

## What shipped in this pass

Three CLI interface additions and one new config layer:

### 1. `lockdown on --json` and `lockdown off --json` (new flags)

Both lockdown mutation commands now support `--json` output:

```
policy-scout lockdown on --reason "supply chain incident" --json
→ {"ok": true, "active": true, "reason": "supply chain incident"}

policy-scout lockdown on --json   # already active
→ {"ok": false, "already_active": true}

policy-scout lockdown off --json
→ {"ok": true, "active": false}

policy-scout lockdown off --json  # already inactive
→ {"ok": false, "already_inactive": true}
```

`lockdown status --json` was already available and unchanged:
```
policy-scout lockdown status --json
→ {"active": bool, "reason": str | null}
```

These are the correct integration endpoints for Lattica's iter 5 tile controls.

### 2. `approvals set-timeout <hours>` (new subcommand)

Configures the default expiry window for new approval requests. Persisted to
`~/.local/share/policy-scout/settings.json` (same directory as `fossic.db`).

```
policy-scout approvals set-timeout 48 --json
→ {"ok": true, "approval_timeout_hours": 48}
```

Range: 1–8760 hours (1 hour to 1 year). Default remains 24h if not configured.
Path overridable via `POLICY_SCOUT_SETTINGS_PATH` env var.

**Tile implication:** `expires_at` on `ApprovalRequested` events is now configurable.
The tile should treat `expires_at` as an actual ISO 8601 value and display it
(e.g. "expires in 2h", "expires in 3 days") rather than assuming 24h.

### 3. Three Tauri commands registered in policy-scout's lib.rs

`activate_lockdown(reason?)`, `deactivate_lockdown()`, `restart_watch()` are
registered in policy-scout's desktop app invoke handler. These are for policy-scout's
own UI (`ui/desktop/`).

**These are NOT callable from Lattica's Tauri backend.** See architecture note below.

---

## Architecture clarification: Tauri IPC is app-scoped

**Q (raised during implementation): Does Policy Scout run as a Tauri app itself,
or are these commands exposed via some mechanism Lattica can call?**

Policy Scout's desktop app (`ui/desktop/`) is a fully independent Tauri application.
Tauri IPC (`invoke()`) is sandboxed to each app's own webview context — Lattica
cannot call `invoke('activate_lockdown')` and reach policy-scout's Tauri backend.
The two apps are compiled separately and have no IPC bridge.

**The correct integration surface for Lattica is the CLI**, using the same pattern
policy-scout's own Tauri backend uses internally:

```rust
// In Lattica's lib.rs — same Command::new pattern already used for other tools
Command::new("policy-scout")
    .args(["lockdown", "on", "--reason", &reason_str, "--json"])
    .output()
```

`policy-scout` is installed as a system binary (via pipx). It is available in PATH
in the same context Lattica's Rust backend runs. The `--json` flags added in this
pass make the CLI integration surface clean for programmatic use.

---

## Architecture clarification: LOCK DOWN in the tile — iter 5 scope confirmed

**Q: Is the LOCK DOWN button in the Lattica tile an exception to read-only
Option B? Or should it happen via ↗ POLICY SCOUT CLI?**

Iteration 4 was read-only (Option B); LOCK DOWN was dimmed/non-functional there.
We are now in **iteration 5 prep** — the controls below are in scope and the
backend is ready. LOCK DOWN as a functional tile button is the target.

When the LOCK DOWN button fires in the Lattica tile, Lattica's Rust backend calls
`policy-scout lockdown on [--reason <r>] --json` as a subprocess. No cross-app
Tauri IPC is needed or possible.

---

## Summary: iter 5 integration table

| Control | CLI command | JSON output | Status |
|---|---|---|---|
| LOCK DOWN button | `lockdown on [--reason <r>]` | `{"ok": bool, "active": bool, "reason": str}` | **backend ready** |
| CLEAR LOCKDOWN button | `lockdown off` | `{"ok": bool, "active": bool}` | **backend ready** |
| RESTART WATCH button | `watch stop` (best-effort) + `watch start` | `{"ok": bool, "pid": int}` | **backend ready** |
| Approval timeout setting | `approvals set-timeout <hours>` | `{"ok": bool, "approval_timeout_hours": int}` | **backend ready** |

Integration pattern for Lattica's Rust backend:

```rust
Command::new("policy-scout")
    .args(["lockdown", "on", "--reason", &reason_str, "--json"])
    .output()
// exit 0 + JSON on stdout = success; parse with serde_json
```

`policy-scout` is a pipx-installed system binary, available in PATH in the same
context Lattica's Rust backend runs.

No schema changes to fossic streams. No changes to event types. No changes to
existing Tauri commands in policy-scout.
