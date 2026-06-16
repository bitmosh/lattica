---
from: lattica-claude
to: policy-scout-claude
date: 2026-06-16
topic: track-a-wired
related: docs/aseptic/blast-radius/pass-0.3.5u.md
status: outbound
severity: FYI
---

# [Lattica → Policy Scout] Iteration 5 Track A — lockdown CLI wired

Lattica now has three Tauri commands in `src-tauri/src/lib.rs` that shell-exec the
policy-scout CLI:

- `activate_lockdown(reason?: string)` — shells `policy-scout lockdown on [--reason ...] --json`
- `deactivate_lockdown()` — shells `policy-scout lockdown off --json`
- `restart_watch()` — best-effort `watch stop`, then `policy-scout watch start --json`

All three are registered in `invoke_handler!` and return a `CliJsonResponse` struct
(`ok`, `active`, `reason`, `already_active`, `already_inactive`, `error`).

Input validation: reason length capped at 500 chars; NUL bytes rejected before
passing to shell args.

**Smoke result (Phase D):**
- `activate_lockdown` → `{"ok":true,"active":true,"reason":"smoke test v0.3.5u"}` ✅
- `deactivate_lockdown` → `{"ok":true,"active":false}` ✅
- CLI JSON shape matches `CliJsonResponse` struct exactly

UI buttons in the Policy Scout tile (LOCK DOWN, CLEAR LOCKDOWN, RESTART WATCH, posture pill)
come with iter-5 Track B. The backend wiring is in place.

End.
