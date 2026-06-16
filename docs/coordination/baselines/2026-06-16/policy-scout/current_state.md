# Policy Scout — Current State Baseline

**Date:** 2026-06-16
**Filed by:** policy-scout-claude

---

## Section 1 — Current version + identity

- **Current version:** 0.3.9
- **Most recent tag:** `bc33d04 chore: bump version to 0.3.9`
- **Most recent milestone:** VS Code/Cursor extension Phase 4 (git hook surface) — phases 1–4 shipped in sequence since v0.3.6
- **Identity:** Policy enforcement and governance CLI + Tauri desktop app that intercepts commands before execution, evaluates them against configurable policy rules, and provides an audit-chained decision trail with HITL approval workflows.

---

## Section 2 — What just shipped since last baseline

Chronological, most recent first:

**VS Code extension (Phases 1–4, v0.3.7–v0.3.9):**
- Phase 1: Extension scaffold (VS Code/Cursor)
- Phase 2: Sweep → DiagnosticCollection (surfaces policy findings as editor diagnostics)
- Phase 3: MCP server registration
- Phase 4: Git hook surface

**Lockdown bundle + approval timeout (this session, uncommitted):**
- `lockdown on --json` and `lockdown off --json` flags — both mutation commands now emit structured JSON, making them scriptable/Tauri-callable
- `approvals set-timeout <hours> [--json]` — new CLI subcommand, configures default approval expiry window; range 1–8760h, default 24h
- `policy_scout/core/config.py` — new settings persistence layer at `~/.local/share/policy-scout/settings.json`; both `ApprovalRequest` construction sites updated to read configured timeout
- `activate_lockdown(reason?)`, `deactivate_lockdown()`, `restart_watch()` — three new Tauri commands in policy-scout's own desktop app (`ui/desktop/src-tauri/src/lib.rs`)
- 1143 tests passing, 2 skipped (no regression from lockdown bundle changes)

**Fossic Phase 2 parallel emit (staged, uncommitted):**
- `policy_scout/audit/sqlite_store.py` — parallel fossic emit after SQLite commit; non-fatal (fossic on non-critical path); streams named `policy-scout/audit/<request_id>`; uses redact-before-emit approach

**Prior recent (committed since v0.3.6):**
- v0.3.7: Server-side pagination for audit events list
- v0.3.8: Sandbox results list pagination, severity filter on sweep findings preview
- v0.3.6: Data cleanup deletion path (`--apply` flag, confirmation prompt, path-safe execute)

**Uncommitted UI component work (developer-authored, untracked):**
- `ApprovalsView.tsx`, `LiveStatusCard.tsx`, `OverviewView.tsx`, `ScanView.tsx`, `Shell.tsx`, `BrandMark.tsx`, `HelpDrawer.tsx`, `Toast.tsx`, `Chip.tsx`, `Icons.tsx`, `SandboxLaunchCard.tsx`, `PolicySimulateCard.tsx`, `AuditVerifyChainCard.tsx`
- New type files: `approvals.ts`, `run.ts`, `scan.ts`, `system.ts`
- New mocks: `approvals_list.json`, `lockdown_status.json`, `watch_status.json`, `sandbox_launch_result.json`, `scan_injection_result.json`, etc.
- `PS-Frontend/` — appears to be a parallel frontend exploration directory

---

## Section 3 — Visual elements available for Lattica

### Tauri commands (policy-scout's own UI) — response shapes

These are registered in policy-scout's `ui/desktop/src-tauri/src/lib.rs`. Lattica's Track A has equivalent wrappers in Lattica's own Rust backend that shell-exec the CLI.

**`activate_lockdown(reason?: string)`**
```json
// success
{"ok": true, "exit_code": 0, "data": {"ok": true, "active": true, "reason": "..."}, "error": null}
// already active
{"ok": true, "exit_code": 0, "data": {"ok": false, "already_active": true}, "error": null}
// failure
{"ok": false, "exit_code": 1, "data": null, "error": "..."}
```

**`deactivate_lockdown()`**
```json
// success
{"ok": true, "exit_code": 0, "data": {"ok": true, "active": false}, "error": null}
// already inactive
{"ok": true, "exit_code": 0, "data": {"ok": false, "already_inactive": true}, "error": null}
```

**`restart_watch()`**
```json
// success — watch stop is best-effort, response is from watch start
{"ok": true, "exit_code": 0, "data": {"ok": true, "pid": 12345}, "error": null}
// failure (platform not supported, or start failed)
{"ok": false, "exit_code": 1, "data": null, "error": "..."}
```

All three follow the outer `CliJsonResponse` struct: `{ok, exit_code, data, error, stderr_summary}`.

### Fossic event emission (staged, not yet committed)

When fossic emit ships, policy-scout writes to `policy-scout/audit/<request_id>` streams. Planned event types per `POLICY_SCOUT_EVENT_VOCABULARY.md`:

**Governance pipeline (per request):** `CommandRequested`, `CommandParsed`, `CommandClassified`, `PolicyMatched`, `DecisionIssued`, `PolicyError`

**HITL approvals:** `ApprovalRequested`, `ApprovalApprovedOnce`, `ApprovalDeniedOnce`, `ApprovalExpired`

**Execution:** `CommandExecutionCompleted`, `CommandExecutionBlocked`

**Posture transitions** (not yet implemented in fossic emit, but exist as SQLite audit events): `LockdownActivated`, `LockdownDeactivated`, `WatchDaemonStarted`, `WatchDaemonStopped`

Note: fossic emit currently covers only the governance pipeline and approval events. Posture transition events are in the SQLite audit log but not yet wired to fossic emit.

### 4-state posture model — derivation logic

Derived from two polling calls: `lockdown status --json` and `watch status --json` (combined in `get_system_health`).

| State | Condition | Visual |
|---|---|---|
| LOCKDOWN | `lockdown.active == true` (takes priority over watch state) | red neon |
| ACTIVE | `lockdown.active == false` AND `watch.running == true` | green neon |
| WATCH-DOWN | `lockdown.active == false` AND `watch.running == false` AND `watch.stale` absent/false | amber |
| STALE | `lockdown.active == false` AND `watch.running == false` AND `watch.stale == true` | amber blink |

LOCKDOWN takes priority — a locked-down system with watch stopped still shows LOCKDOWN.

### Approval card UI elements — current state

- **ALLOW ONCE** — fully wired. `approvals approve <id> --json` → `{approval_id, status: "approved_once"}`. Tauri: `approve_request(approval_id)`.
- **DENY** — fully wired. `approvals deny <id> --json`. Tauri: `deny_request(approval_id)`.
- **ALLOW SESSION** — model layer only. `ApprovalScope.SESSION` constant does not exist; `approve` CLI has no `--scope` argument; execute path hard-errors on non-"once" scope. UI should not wire this as functional yet.
- **ALLOW PATTERN** — not implemented. No pattern store, no engine hook.

`expires_at` on approval cards is now configurable (default 24h). Tile should render it as relative time ("expires in 2h") from the ISO 8601 value, not assume 24h.

### Risk bands

Four bands: `low`, `medium`, `high`, `critical`. `DecisionIssued` events carry both `risk_score` (int 0–100) and `risk_band` (string). Color encoding is policy-scout's responsibility to specify; the bands map to the four risk filter chips (`LOW · MED · HIGH · CRIT`) in the iter-4/5 tile design.

Six decision outcomes: `ALLOW`, `ALLOW_LOGGED`, `REQUIRE_APPROVAL`, `SANDBOX_FIRST`, `DENY`, `DENY_AND_ALERT`.

---

## Section 4 — Open items / known follow-ups

**L-cost items — PolicyEngine hot path, deferred:**
- **ALLOW SESSION enforcement** — model field `scope` round-trips through storage; `ApprovalScope.SESSION` constant doesn't exist; execute path (`main.py:~2465`) hard-rejects non-"once" scope; no session registry; no engine hook. Needs design decision on session lifecycle signals before implementation.
- **ALLOW PATTERN** — no pattern store, no CLI `--scope pattern` argument, no engine hook. Needs design decision on match semantics (glob vs. regex vs. structured token match) and TTL.
- **Rule mute mechanism** — no `rules` CLI subcommand at all; no mute store; no engine hook. Risk: muted rules are silenced enforcement gates; requires audit trail + listing command bundled in same pass.

**Uncommitted work pending commit:**
- Fossic Phase 2 emit (`sqlite_store.py`) — staged
- Lockdown bundle + approval timeout (`cli/main.py`, `lib.rs`, `core/config.py`) — partially staged
- Large body of developer-authored UI components (ApprovalsView, LiveStatusCard, ScanView, etc.) — untracked

**UI/backend coverage gaps (from `docs/UI_BACKEND_COVERAGE_AUDIT.md`, dated 2026-06-12):**
- `get_policy_overview` — fetched on mount, state orphaned (no view renders the data)
- `run_policy_validate` — handler registered, card component exists, disconnected from App.tsx
- `run_cleanup_apply` — dry-run shows plan, apply handler now exists (`run_cleanup_apply`) but wired state is unclear given subsequent UI churn
- Approvals queue — `ApprovalsView.tsx` now exists untracked, suggesting developer is addressing this

---

## Section 5 — Cross-project signal

**Lattica:**
- `activate_lockdown`, `deactivate_lockdown`, `restart_watch` now in Lattica's own `src-tauri/src/lib.rs` (Track A confirmed wired 2026-06-16). These shell-exec `policy-scout lockdown on/off --json` and `policy-scout watch start --json`.
- Approval timeout: `expires_at` on `ApprovalRequested` events is now user-configurable; tile should not assume 24h.

**Fossic:**
- `POLICY_SCOUT_EVENT_VOCABULARY.md` note: `expires_at` description should be updated from "24h from creation" to "configurable via `approvals set-timeout`, default 24h". Minor; no schema change. Routed via `2026-06-15_lattica_to_fossic_ps-approval-timeout-route.md`.

**Config layer pattern:**
- `policy_scout/core/config.py` — simple JSON settings at `~/.local/share/<project>/settings.json`; functions `read_settings()`, `write_setting(key, value)`, `get_approval_timeout_hours()`. Overridable via env var. Other projects wanting a config persistence layer can follow this pattern.

---

## Section 6 — Pre-federation exploratory thoughts

*Exploratory only — no design commitments.*

### What events would policy-scout emit to a federation hub

**High relay value (hub-worthy):**
- `LockdownActivated` / `LockdownDeactivated` — clear posture transitions; other projects benefit from knowing the system is in lockdown; low frequency
- `ApprovalRequested` — an agent is blocked; time-sensitive; Lattica tile's approval card needs this to escalate
- `ApprovalApprovedOnce` / `ApprovalDeniedOnce` / `ApprovalExpired` — approval resolution; closes the visual pending-approval state in the tile
- `DecisionIssued` where `decision == "DENY_AND_ALERT"` or `risk_band == "critical"` — severe decisions worth hub attention
- Watch daemon state transitions (started, stopped, crashed/stale) — posture-affecting

**Stays local (high-frequency, not hub-worthy):**
- Every `DecisionIssued` during an active Cerebra session: 6–12/minute at normal agent pace. These are noise at the hub level; the hub should see posture state, not every routine ALLOW.
- `CommandRequested` / `CommandParsed` / `CommandClassified` / `PolicyMatched` — sub-pipeline events for individual requests; full diagnostic depth; hub doesn't need them
- `CommandExecutionCompleted` — execution outcome for already-allowed commands; useful locally for audit trail, not for hub

**Filtering logic:** relay agent emits an event if: `decision ∈ {DENY_AND_ALERT}` OR `risk_band == critical` OR `event_type ∈ {LockdownActivated, LockdownDeactivated, ApprovalRequested, ApprovalApprovedOnce, ApprovalDeniedOnce, ApprovalExpired, WatchDaemonStopped}`.

### Existing data paths outside fossic

- **`~/.local/share/policy-scout/settings.json`** — stays separate. One integer (timeout hours). Making this a fossic stream would be over-engineering; no meaningful event history needed. `append_if` semantics could prevent races if multiple processes write concurrently, but that's not a current problem.
- **SQLite audit chain** (`~/.local/share/policy-scout/audit.db`) — stays authoritative. Blake3 hash-chained for tamper detection. Fossic emission is a parallel write, not a replacement. The audit trail's integrity guarantee is in the chain, not in fossic.
- **PID file** (`~/.local/share/policy-scout/watch.pid`) — stays separate. Daemon lifecycle signaling; not event-sourcing material.

### Fossic features that fit policy-scout's domain

- **`append_if`** for posture transitions — prevents duplicate `LockdownActivated` if two CLI invocations race (e.g., two terminal windows both running `lockdown on`). The idempotency check (`already_active: true` response) is already in the CLI; fossic's `append_if` would extend that guarantee to the event stream.
- **Snapshots for audit compaction** — the SQLite audit chain grows unboundedly. Fossic snapshots could represent a verified-clean audit state at a point in time, enabling older raw events to be archived without losing the chain integrity proof.
- **Transforms at append time** — could normalize command text (trim whitespace, resolve shell aliases) before storing, improving deduplication in the hub view. Not urgent; the current raw storage is correct.

### CLI subprocess pattern under federation

Stays as-is. Lattica calls `policy-scout lockdown on --json` as a subprocess; federation doesn't change this. The CLI is the stable, tested interface. The relay agent (fossic subscription → hub forwarding) is a separate layer on top of the local fossic store — it doesn't need to know about Lattica's subprocess calls.

### Concerns and unknowns

**Rate filtering:** During an active Cerebra session with a fast action loop, `DecisionIssued` events arrive at ~6–12/minute. If naively relayed to the hub, this is usable noise at low agent speed but could overwhelm at scale. A severity filter at the relay agent level (relay only `DENY*` and `REQUIRE_APPROVAL`) seems right, but the threshold is a UX decision (how much routine traffic does the hub want to show?).

**Cross-store causation:** `CommandRequested.upstream_causation_id` carries the Blake3 `EventId` of Cerebra's `ActionProposed` event in Cerebra's local fossic store. In a federated hub where both stores relay events, the hub could resolve cross-store causation links to connect a governance decision to the originating agent action. But if the relay is selective (only high-severity events relay), the `ActionProposed` that triggered a routine ALLOW may never reach the hub — the causation link would dangle. This needs a federation design decision: relay causation ancestors when a relay-worthy event carries an upstream link?

**Posture derivation shift:** Lattica currently polls posture state via `get_system_health` (CLI subprocess). Under federation, posture would come from the hub event stream (`LockdownActivated`/`LockdownDeactivated`/watch transition events). This is a cleaner model but requires Lattica's tile to switch from polling to event-driven posture — a non-trivial Track B change. The polling model works and is already live; no urgency to replace it.

**Approval expiry enforcement:** `ApprovalRequested` events carry `expires_at`. Nothing currently enforces expiry — a pending approval just sits in the SQLite store. If the hub shows pending approvals, it needs to age them out visually based on `expires_at`. The `ApprovalExpired` event is defined in the vocabulary but not yet emitted by any daemon/scheduler — it would need a background process or be derived at display time from the timestamp.
