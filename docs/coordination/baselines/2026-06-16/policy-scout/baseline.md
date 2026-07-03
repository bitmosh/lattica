# Baseline — policy-scout (2026-06-16)

> **Historical snapshot — 2026-06-16.** References to [redacted], [redacted], and discord-bot reflect their status at that date; those modules are now deprecated and removed from the platform.

---

## federation_design

# Policy Scout — Federation Design Response

**Date:** 2026-06-16
**Filed by:** policy-scout-claude
**In response to:** Federation interview round
**Inputs read:** PLATFORM_BASELINE_2026-06-16_v2.md, LATTICA_RECONCILIATION_BRIEF.md

---

## Section A — Input confirmation and corrections

Both documents read. §2.3 and §4.X accurately represent Policy Scout's reconciled position with one precision note:

**§2.3 precision note — fossic path:**
v2 §2.3 says "fossic emit staged (not committed)" and §2.6 says the shared hub is at `~/.lattica/fossic/store.db`. The staged code in `sqlite_store.py` opens a LOCAL store at `~/.local/share/policy-scout/fossic.db` (per `_init_fossic()`, line 110), not the shared hub. This is correct and intentional — same local-store pattern as Cerebra. The relay agent bridges local → hub. No correction to v2; this is just making the store path explicit.

**§4.X — no corrections.** All 34 settled items are accurate for Policy Scout's position.

---

## Section B — Policy Scout's federation design

### B.1 — Local store shape

**Proposed stream structure (two stream types):**

#### `policy-scout/audit/<request_id>` — per-request governance pipeline

All governance and approval lifecycle events for a single command evaluation request:

| Event type | When emitted |
|---|---|
| CommandRequested | Command intercepted, evaluation begins |
| CommandParsed | Command text parsed |
| CommandClassified | Risk band assigned |
| PolicyMatched | Matching policy rule identified |
| DecisionIssued | Final governance decision |
| PolicyError | Rule evaluation error |
| ApprovalRequested | HITL approval ticket created |
| ApprovalApprovedOnce | Approval granted |
| ApprovalDeniedOnce | Approval denied |
| ApprovalExpired | Approval timed out (future — watch daemon scheduler) |
| CommandExecutionCompleted | Command executed after ALLOW/approval |
| CommandExecutionBlocked | Command blocked (DENY path) |

**Rationale for keeping approvals in audit stream:** Approval events carry `request_id` and are causally downstream of `CommandRequested`. Keeping them together in the per-request stream means "show me everything that happened to request X" is a single stream read. Pattern-subscribing to `policy-scout/audit/*` captures all approval events across requests.

**Snapshot cadence:** Snapshot after `DecisionIssued`. This is the natural terminal event for the governance pipeline. The snapshot at this point captures: command identity, risk band, decision outcome, and whether approval is pending. Lattica's tile subscribing to `policy-scout/audit/*` cold-starts with this snapshot and immediately knows which requests have pending approvals. (Implements the canonical cold-start pattern from S-026.)

---

#### `policy-scout/posture` — global posture transitions (NEW stream)

All posture-affecting state changes that are NOT request-scoped:

| Event type | When emitted |
|---|---|
| LockdownActivated | `lockdown on` command succeeds |
| LockdownDeactivated | `lockdown off` command succeeds |
| WatchDaemonStarted | Watch daemon process starts |
| WatchDaemonStopped | Watch daemon process exits |

**Rationale for separate posture stream:** Lockdown and watch daemon events are global platform state — they don't belong to any single request. A global singleton stream (`policy-scout/posture`) lets Cerebra's witness model subscribe to exactly one stream for all policy posture signals.

**Snapshot cadence:** Snapshot after each `LockdownActivated` and `LockdownDeactivated`. Current lockdown state (`{active: bool, reason: str|null}`) is the primary posture signal. Subscribers get immediate posture on subscribe without replaying history.

**Implementation note:** Current `_emit_to_fossic()` routes all events to `policy-scout/audit/<request_id>` and returns early if `request_id` is absent. Posture events may arrive without request_id. This requires a routing change in `_emit_to_fossic()` — route based on event_type, not solely on request_id presence. This is a Pass E implementation item.

---

### B.2 — Relay filter design

**Hub relay criteria (relay agent applies these in order):**

```python
ALWAYS_RELAY_EVENT_TYPES = {
    "LockdownActivated",
    "LockdownDeactivated",
    "WatchDaemonStopped",    # posture stream — all transitions relay
    "WatchDaemonStarted",    # posture stream — startup confirmation
    "ApprovalRequested",     # time-sensitive HITL event
    "ApprovalApprovedOnce",  # closes pending approval state in hub
    "ApprovalDeniedOnce",    # closes pending approval state in hub
}

def should_relay(event) -> bool:
    if event.event_type in ALWAYS_RELAY_EVENT_TYPES:
        return True
    # High-severity decisions from audit stream
    payload = event.deserialize_payload_json()
    if payload.get("decision") == "DENY_AND_ALERT":
        return True
    if payload.get("risk_band") == "critical":
        return True
    return False
```

**Stays local (no relay):**
- `CommandRequested` — high-frequency (6-12/min at agent pace); routine permits are noise at hub level. Exception: relays if `decision == "DENY_AND_ALERT"` or `risk_band == "critical"` (covered by severity filter above)
- `CommandParsed`, `CommandClassified`, `PolicyMatched`, `PolicyError` — sub-pipeline detail; hub doesn't need them
- `DecisionIssued` for ALLOW/ALLOW_LOGGED/REQUIRE_APPROVAL/SANDBOX_FIRST/DENY where risk_band ∉ {critical} — routine governance traffic
- `CommandExecutionCompleted`, `CommandExecutionBlocked` — execution outcomes for already-decided commands
- `ApprovalExpired` — NOT relayed (see B.4)

**Per-event indexed_tags for relayed events:**

| Event type | indexed_tags |
|---|---|
| `LockdownActivated` | `{reason: str\|null, source_store: "policy-scout"}` |
| `LockdownDeactivated` | `{reason: str\|null, source_store: "policy-scout"}` |
| `WatchDaemonStarted` | `{source_store: "policy-scout"}` |
| `WatchDaemonStopped` | `{source_store: "policy-scout"}` |
| `ApprovalRequested` | `{request_id, approval_id, risk_band, source_store: "policy-scout"}` |
| `ApprovalApprovedOnce` | `{request_id, approval_id, source_store: "policy-scout"}` |
| `ApprovalDeniedOnce` | `{request_id, approval_id, source_store: "policy-scout"}` |
| `DecisionIssued` (critical/DENY_AND_ALERT only) | `{request_id, risk_band, decision, source_store: "policy-scout"}` |
| `CommandRequested` (critical/DENY_AND_ALERT only) | `{request_id, source_store: "policy-scout"}` |

Note: `risk_band` is added to `ApprovalRequested` beyond the reconciliation minimum — the witness model benefits from knowing whether the pending approval is for a critical-risk command.

**causation_id handling per relayed event:**

Standard relay: `causation_id = local_event.id` for all relayed events (the relay agent's local fossic event ID becomes the hub event's causation_id, chaining hub event → local event).

The cross-project causation chain (CommandRequested → ActionProposed in Cerebra) lives in the PAYLOAD field `upstream_causation_id`, not in the fossic header `causation_id`. The relay agent passes the payload through intact (post-upcast); `upstream_causation_id` is preserved in the hub event payload. Traversal from hub CommandRequested to hub ActionProposed is application-level (read payload.upstream_causation_id, look up that event ID on hub). This is case-2: both events are on the hub once both PS and Cerebra relay.

See B.5 for detail on the current code behavior.

**Relay agent process model:**

Standalone Python process (`policy-scout-relay.py`), consistent with S-027 (leading preference). Configuration:

```python
RelayConfig(
    local_store_path="~/.local/share/policy-scout/fossic.db",
    hub_store_path="~/.lattica/fossic/store.db",
    source_prefix="policy-scout",
    subscribe_pattern="policy-scout/**",
    relay_filter=should_relay,  # callable, not a set — see filter spec above
    batch_size=50,
    reconnect_delay_ms=5000,
)
```

**Script location:** `policy-scout-relay.py` lives at the root of `/home/boop/Projects/policy-scout/`. Each relay agent lives in the project it serves — schema-coupling is decisive (relay filter and indexed_tags must update in the same commit as event vocabulary changes). Suggested locations across the platform: `cerebra-relay.py` in cerebra/, `lumaweave-relay.py` in lumaweave/ (standalone repo at `~/Projects/lumaweave`, per ADR-001 — not inside Lattica's tree), `ai-stack-relay.py` in ai-stack/ (owns both ai-stack + Bo filter rules). Lattica does not own or version relay agents; who signals "start now" is §8.3 open question.

Under D.3 conditional strip rule: `policy-scout/audit/<request_id>` and `policy-scout/posture` already start with `policy-scout/`, so hub stream names are identical to local stream names. No double-prefix.

---

### B.3 — indexed_tags addition to staged fossic emit (§6.6 OPEN)

**Target function: `_emit_to_fossic()` in `policy_scout/audit/sqlite_store.py` (line 120)**

This is the single fossic emit point. All other functions (`write_event()`, etc.) call it. No other functions need changes for indexed_tags.

**Implementation outline:**

```python
def _emit_to_fossic(self, redacted_data: Dict[str, Any]) -> None:
    if self._fossic is None:
        return
    event_type = redacted_data.get("event_type", "")
    data = redacted_data.get("data") or {}

    # Route to correct stream
    request_id = redacted_data.get("request_id")
    if event_type in ("LockdownActivated", "LockdownDeactivated",
                       "WatchDaemonStarted", "WatchDaemonStopped"):
        stream_id = "policy-scout/posture"
    elif request_id:
        stream_id = f"policy-scout/audit/{request_id}"
    else:
        return  # non-posture event without request_id: no valid stream

    # Build indexed_tags based on event type
    indexed_tags: Dict[str, Any] = {"source_store": "policy-scout"}
    if request_id:
        indexed_tags["request_id"] = request_id
    if event_type in ("LockdownActivated", "LockdownDeactivated"):
        reason = data.get("reason")
        if reason:
            indexed_tags["reason"] = reason
    if event_type in ("ApprovalRequested", "ApprovalApprovedOnce",
                      "ApprovalDeniedOnce", "ApprovalExpired"):
        approval_id = data.get("approval_id")
        if approval_id:
            indexed_tags["approval_id"] = approval_id
    if event_type == "ApprovalRequested":
        risk_band = data.get("risk_band")
        if risk_band:
            indexed_tags["risk_band"] = risk_band
    if event_type in ("DecisionIssued", "CommandRequested"):
        for field in ("risk_band", "decision"):
            val = data.get(field)
            if val:
                indexed_tags[field] = val

    # causation_id: cross-project link to Cerebra's ActionProposed
    causation_id = None
    upstream = data.get("upstream_causation_id")
    if upstream and FossicEventId is not None:
        try:
            causation_id = FossicEventId.from_hex(upstream)
        except Exception:
            pass

    try:
        self._fossic.declare_stream(stream_id, declared_by="policy-scout")
        self._fossic.append(Append(
            stream_id=stream_id,
            event_type=event_type,
            payload=data,
            external_id=redacted_data["event_id"],
            causation_id=causation_id,
            indexed_tags=indexed_tags,
        ))
    except Exception as e:
        print(f"Warning: Failed to emit audit event to fossic: {e}",
              file=__import__("sys").stderr)
```

**New indexed_tags fields emerging from federation design:**

- `source_store: "policy-scout"` — required on every relayed event per S-013; adding to ALL local events so the relay agent can pass them through without special-casing
- `risk_band` on `ApprovalRequested` — not in original reconciliation minimum; added for witness model richness (see B.4)

**Verify before commit:** confirm `indexed_tags` parameter is accepted by the installed version of `fossic-py`'s `Append` class. See `needs-wiring.md`.

---

### B.4 — Witness model relay feed

**Confirmed — all three S-008 events are in the relay filter:**

| Event | Stream | Relay? | indexed_tags for witness model |
|---|---|---|---|
| `LockdownActivated` | `policy-scout/posture` | Yes (always) | `{reason, source_store}` |
| `LockdownDeactivated` | `policy-scout/posture` | Yes (always) | `{reason, source_store}` |
| `ApprovalRequested` | `policy-scout/audit/<request_id>` | Yes (always) | `{request_id, approval_id, risk_band, source_store}` |

The witness model reducer can subscribe to `policy-scout/posture` for lockdown signals and filter `policy-scout/audit/*` for `ApprovalRequested` events. Both subscription patterns work under D.3 hub stream naming.

**ApprovalExpired — NOT relayed by Policy Scout.**

`ApprovalExpired` is not in the relay filter. Rationale:
1. The event is not yet emitted (vocabulary ghost; watch daemon scheduler is unscheduled)
2. Even once the scheduler exists, expiry is derivable display-side from `expires_at` on `ApprovalRequested`
3. The hub tile should derive expiry from the ISO 8601 `expires_at` field on the `ApprovalRequested` hub event rather than waiting for an expiry signal
4. When the scheduler pass eventually ships, this can be added to the relay filter as a follow-on; it's not required for the witness model's minimum projection scope

---

### B.5 — Cross-store causation (S-006)

**Confirmed — field exists in current code:**

From `_emit_to_fossic()` (lines 131-145 of the staged `sqlite_store.py`):

```python
upstream = (redacted_data.get("data") or {}).get("upstream_causation_id")
if upstream and FossicEventId is not None:
    try:
        causation_id = FossicEventId.from_hex(upstream)
    except Exception:
        pass
```

`upstream_causation_id` is read from the post-redact payload data and used as the local fossic event's `causation_id`. This wires the local PS fossic event's causal header to Cerebra's ActionProposed event ID.

**Field preservation through relay:**

When the relay agent relays a PS CommandRequested event to hub:
- Relay agent sets hub event `causation_id = local_ps_event.id` (standard relay, per fossic relay spec)
- The payload (post-upcast) contains `upstream_causation_id = <cerebra_action_proposed_hex_id>` intact
- Hub traversal: consumer reads `hub_command_requested.payload.upstream_causation_id`, looks up that event ID on hub, finds Cerebra's ActionProposed (if Cerebra also relayed it) — case-2 traversal

The relay agent does NOT need special logic to preserve the causation chain. The payload field carries the cross-project link; standard relay preserves payloads intact.

**Open — redaction may strip upstream_causation_id.** The field is read from `redacted_data` (post-redaction). If `upstream_causation_id` is treated as sensitive by the redaction layer, `causation_id` silently becomes `None` on the local event, and the hub payload also loses the field. See `needs-wiring.md` item W-001.

**Display-side rendering:** Not Policy Scout's concern. Lattica's tile is responsible for traversing `upstream_causation_id` payload links to surface the Cerebra → PS causal chain visually. PS emits the field; Lattica renders it.

---

### B.6 — Tauri command response wrapper

**Confirmed — no change needed.**

Per S-021/S-022:
- Policy Scout's `CliJsonResponse` outer wrapper (`{ok, exit_code, data, error, stderr_summary}`) is Policy Scout's own desktop app diagnostic envelope
- Lattica's integration pattern: shell-exec PS CLI, parse inner JSON (`{ok, active, reason}` etc.) directly from stdout
- The two patterns are intentionally separate and serve different consumers

**Note for future tile authors (do not add wrapper parsing):**

When writing Lattica tile code that calls Policy Scout CLI via Tauri subprocess:
- Parse the raw stdout as JSON directly — this is the CLI's semantic output
- Do NOT wrap or unwrap CliJsonResponse; that struct only exists inside PS's own desktop app
- CLI outputs on exit 0: inner JSON with semantic fields (e.g., `{"ok": true, "active": true, "reason": "..."}`)
- CLI failures: non-zero exit code; stdout may be empty or contain a plain error string

---

## Section C — Cross-cutting items

### C.1 — Broken-pending UI discipline

Complete table for Policy Scout-related tile elements in Lattica's tree:

| Tile element | What blocks live data | Broken-pending? |
|---|---|---|
| 4-state posture pill | Watch daemon emit + hub relay (posture stream) | Yes — fossic relay path pending; CLI polling is interim |
| Risk band gradient | DecisionIssued events + relay | Yes |
| Risk score numeric display | DecisionIssued payload + relay | Yes |
| Approval queue list | fossic relay live + hub snapshot (S-026) | Yes |
| ApprovalExpired countdown | Display-time derivation from expires_at | Yes — derivation logic not yet implemented |
| ALLOW ONCE button | Tauri command (working, Track A) | No — already live |
| ALLOW SESSION button | ALLOW SESSION enforcement (L-cost, deferred) | Yes |
| ALLOW PATTERN button | ALLOW PATTERN enforcement (deferred) | Yes |
| DENY button | Tauri command (working, Track A) | No — already live |
| LOCK DOWN button | Tauri command (working, Track A) | No — already live |
| CLEAR LOCKDOWN button | Tauri command (working, Track A) | No — already live |
| RESTART WATCH button | Tauri command (working, Track A) | No — already live |
| Rule mute toggle | Rule mute mechanism (deferred) | Yes |
| Audit event history list | fossic emit + relay (full audit trail on hub) | Yes |
| Audit chain verify display | Pass E not yet complete (AuditVerifyChainCard) | Yes |
| Scan results view | Pass D not yet built | Yes |

**Notes:**
- "4-state posture pill" has a live interim path via CLI polling (`get_system_health`). The posture pill WORKS today via polling. The "broken-pending" flag applies specifically to the fossic-relay-driven version (Phase 2 tile wiring). If the tile uses CLI polling as its live source, this is not broken-pending; if it's designed for hub subscription from the start, it is.
- "ApprovalExpired countdown" can be implemented purely from `expires_at` ISO 8601 on `ApprovalRequested` — the countdown logic itself is display-time; what's missing is getting real `ApprovalRequested` events from the hub.
- Policy simulate card (Pass C) is wired and live — not in this table.
- Sandbox launch card — wired if sandbox backend is live; not a fossil relay dependency.

---

### C.2 — Hard-coded values register

See `needs-wiring.md` (filed alongside this document).

---

### C.3 — Cross-Claude question protocol

One outbound question filed:

**`2026-06-16_policy-scout_to_cerebra_binding-question-upstream-causation-id.md`**
Filed at: `~/Projects/lattica/docs/coordination/outbound/`

Topic: Does `upstream_causation_id` in the `CommandRequested` payload contain a hex-encoded fossic `EventId` string from Cerebra's local store? And is this value set on commands triggered by Cerebra actions (i.e., when the command originates from an `ActionProposed` event)?

This binding question must be answered before Pass E to confirm the causation link is actually populated in practice.

---

### C.4 — File ownership boundaries

**Files in Policy Scout's tree:**

| File/path | Owns |
|---|---|
| `policy_scout/audit/sqlite_store.py` | Fossic emit logic, stream routing, indexed_tags |
| `policy_scout/audit/events.py` | AuditEvent type definitions |
| `policy_scout/audit/redaction.py` | Redaction rules — what fields are stripped before fossic emit |
| `policy_scout/docs/POLICY_SCOUT_EVENT_VOCABULARY.md` | Event vocabulary, payload schemas, `expires_at` description |
| `ui/desktop/src-tauri/src/lib.rs` | PS's own Tauri commands (`activate_lockdown`, `deactivate_lockdown`, `restart_watch`) |
| `ui/desktop/src/` | PS's own UI components (ApprovalsView, LiveStatusCard, ScanView, etc.) |

Naming conventions (PS tree):
- Python: snake_case modules, PascalCase classes
- Event types: PascalCase (CommandRequested, DecisionIssued, etc.)
- Stream names: `policy-scout/<category>/<id>` (kebab-case segments)

**Files in Lattica's tree that are Policy Scout-interface-authored:**

| File | What | Ownership note |
|---|---|---|
| Lattica `src-tauri/src/lib.rs` (partial) | `activate_lockdown`, `deactivate_lockdown`, `restart_watch` Tauri command wrappers | Lattica authored; PS interface contract; PS owns the CLI contract these wrap |
| Future: Lattica tile renderers for PS events | `LockdownActivatedRenderer`, `ApprovalRequestedRenderer`, `DecisionIssuedRenderer`, etc. | Lattica authors; PS's `POLICY_SCOUT_EVENT_VOCABULARY.md` is the source schema |

**claude-design export mapping target:**

When claude-design exports PS event renderers, the mapping is:
- Hub event type → renderer component
- Source schema: `POLICY_SCOUT_EVENT_VOCABULARY.md` (PS tree) → renderer output: Lattica tile card components
- One renderer per relayed event type: `LockdownActivated`, `LockdownDeactivated`, `WatchDaemonStopped`, `ApprovalRequested`, `ApprovalApprovedOnce`, `ApprovalDeniedOnce`, `DecisionIssued` (critical/DENY_AND_ALERT variant)

---

### C.5 — Net-writer / net-reader role

**Policy Scout is a net-writer.** Governance decisions are made from:
1. The command being evaluated (intercepted at execution)
2. Policy rules (local SQLite/config)
3. Current posture state (local SQLite, not fossic reads)

PS does not subscribe to or depend on other projects' hub events to perform governance. No fossic read path required for core function.

**No net-reader needs at this time.**

One potential future need: reading posture state from the hub rather than from CLI polling. Under Phase 2 tile wiring (Track B), the Lattica tile would subscribe to `policy-scout/posture` on the hub instead of calling `lockdown status --json` on a timer. But this is Lattica's read concern, not PS's. PS itself does not need to read from the hub.

---

### C.6 — D.3 stream naming convention ratification

**Policy Scout explicitly endorses D.3.**

Under the conditional strip rule: if `stream_id.startswith(f"{source_prefix}/")`, use `stream_id` directly on hub; otherwise prepend `f"{source_prefix}/"`.

Applied to PS streams:
- `policy-scout/audit/<request_id>` starts with `policy-scout/` → passes through unchanged ✓
- `policy-scout/posture` starts with `policy-scout/` → passes through unchanged ✓

No double-prefix issue. Hub stream names under D.3 are identical to local stream names. This is the endorsement position going into the federation interview ratification vote.

---

## Summary: open items requiring federation interview resolution

| Item | PS position | Status |
|---|---|---|
| D.3 ratification | Explicit endorsement | Pending Fossic + Lattica positions |
| Relay agent process model | Standalone Python (`policy-scout-relay.py`) | Pending platform ratification |
| `policy-scout/posture` stream routing in `_emit_to_fossic()` | Route based on event_type, not request_id presence | Requires code change in Pass E |
| `indexed_tags` parameter in fossic-py `Append` | Must be accepted by installed version | See needs-wiring.md W-002 |
| `upstream_causation_id` redaction survival | Must survive redaction for causation chain | See outbound question + needs-wiring.md W-001 |
| Hub-side snapshot adoption for approval queue cold-start | Lattica-side; PS seeds snapshot at DecisionIssued | S-026; adoption is Lattica's tile wiring task |
| ApprovalExpired scheduler (S-023) | Watch daemon; `append_if` guard; unscheduled | S-M cost; separate pass after relay is live |

---

*End of federation design — Policy Scout — 2026-06-16*

---

## reconciliation

# Policy Scout — Baseline Reconciliation

**Date:** 2026-06-16
**Filed by:** policy-scout-claude
**Source:** PLATFORM_BASELINE_2026-06-16.md
**Addressing:** three general questions + three policy-scout-specific items

---

## General Question A — Self-representation accuracy

The policy-scout baseline accurately represents state at filing time. No corrections needed.

One precision point: "uncommitted" for the lockdown bundle is accurate — the code was complete and functionally verified, but the commit hadn't happened yet. The VS Code extension phases 1–4 are correctly listed as committed. The developer-authored UI components (ApprovalsView, LiveStatusCard, etc.) are correctly labeled as untracked — these were not produced in this session and I did not stage or verify them.

The 4-state posture derivation table and approval card wiring status are accurate. The `ApprovalExpired` vocabulary-ghost call-out (defined, not emitted) is accurate.

---

## General Question B — What others said about policy-scout

The compile's representation of policy-scout is accurate. Three observations from reading the cross-project view:

1. **Tauri command response shape conflict (§6.2):** Correctly flagged and correctly characterized as non-blocking. The outer `CliJsonResponse` wrapper is policy-scout's own UI diagnostic envelope; Lattica's inner-JSON parsing is the correct integration pattern. No action needed from policy-scout's side.

2. **Maturity position ("Pre-fossic"):** Accurate. Policy-scout is the least advanced in fossic adoption of the five projects. "SQLite-authoritative; fossic emit staged but not committed" is the precise characterization.

3. **Relay filter formula:** The compile credits policy-scout with the most precise relay filter of the three projects. The formula as reported is accurate.

One note on §5 ("Policy Scout lockdown CLI Tauri commands — smoke confirmed via direct CLI subprocess, not via webview invoke()"): this is correct and expected. Lattica's Track A authoring confirmed CLI subprocess as the integration pattern. Webview invocation of Lattica's own wrapper commands (`invoke('activate_lockdown')`) is the final step; that hasn't been smoke-tested through the webview yet.

---

## General Question C — Cross-baseline observations accuracy

The cross-baseline observations in §4 are accurate from policy-scout's vantage point. Specific confirmations:

- **Shared store path as integration blocker:** Policy-scout's fossic path (local vs. shared) is genuinely unresolved — policy-scout's staged fossic emit uses a local store; migration to shared is a separate, future concern. The compile correctly categorizes this as "primary blocker" across multiple projects.
- **`append_if` independent interest:** Confirmed independently from policy-scout's §6 (lockdown posture idempotency under concurrent terminal invocations). The four-way convergence the compile notes is real.
- **Relay filter pattern — "transitions not measurements":** Policy-scout's filter formula is a direct expression of this principle.
- **Daemon health monitoring gap:** Policy-scout's posture polling via CLI subprocess is the working interim; the gap is that webview invocation is unverified and fossic-driven posture is a future Track B change. Compile is accurate.

---

## Policy-Scout-Specific Item 1 — Tauri response shape wrapper difference

**Compile question:** Outer `CliJsonResponse` (policy-scout's Tauri) vs. inner CLI JSON (Lattica's Track A parsing) — worth converging?

**Answer: No. The two patterns serve different purposes and should stay separate.**

Policy-scout's outer `CliJsonResponse` wrapper (`{ok, exit_code, data, error, stderr_summary}`) exists for policy-scout's own desktop UI diagnostic needs. The wrapper gives policy-scout's frontend:
- Structured error context when the subprocess fails at the OS level (not just policy-scout logic)
- Exit code for debugging
- A consistent envelope for all CLI-wrapping Tauri commands regardless of what the inner JSON contains

Lattica's approach — shell-exec the CLI, parse inner JSON (`{ok, active, reason}`) directly — is correct for Lattica's use case. Lattica wants the semantic response, not the diagnostic wrapper. Lattica is not policy-scout's diagnostic layer.

The patterns should not converge. If anything, the distinction should be documented in Lattica's Track B spec so future tile authors don't add wrapper parsing by accident. The inner CLI output is the stable contract; the outer wrapper is an implementation detail of policy-scout's own app.

---

## Policy-Scout-Specific Item 2 — Fossic emission status refinement

**Compile question:** "Staged, uncommitted" — what's blocking, what's the plan?

**What's blocking:** Nothing architectural. The code in `sqlite_store.py` is complete and functional. It was staged at session end but not committed because the session was in the middle of a multi-file pass (lockdown bundle + fossic emit) that hadn't reached a clean commit gate yet.

**Current state of the staged code:**
- After SQLite `conn.commit()`, the existing `write_event()` path calls fossic emit as a non-fatal parallel write
- Stream naming: `policy-scout/audit/<request_id>`
- Redact-before-emit approach (sensitive fields stripped before hitting fossic)
- If fossic store is unavailable, emit silently degrades — SQLite audit chain is unaffected

**The fossic store path question:** The staged code opens a local fossic store (path alongside `audit.db`), not the shared `~/.lattica/fossic/store.db`. This is intentional — policy-scout's audit stream is high-frequency governance data, not platform topology data. The local-store path follows the same pattern as Cerebra. Migration to a shared store (if ever appropriate) is a later concern; the relay agent handles federation, not the emitter.

**The plan:** Commit the fossic emit code as part of the next commit pass (Pass E, bundled with audit chain verify and other pending changes). No design work remains — this is a commit-gate issue, not a completion-gate issue.

---

## Policy-Scout-Specific Item 3 — Approval expiry under federation

**Compile question:** Where does `ApprovalExpired` detection logic live — policy-scout background process, tile display-time, relay agent, or undecided?

**Position: Policy-scout background process (watch daemon), with tile display-time as interim.**

**Reasoning:**

Policy-scout's SQLite audit store is the authoritative source for approval state. It holds `expires_at` on every `ApprovalRequest` record. The process that knows when approvals expire should be the process that owns approval state — which is policy-scout, not Lattica and not a relay agent.

The natural home is the watch daemon (already long-running, already manages posture state). A low-frequency scheduler loop (e.g., every 60s) could scan SQLite for pending approvals where `expires_at <= now()`, emit `ApprovalExpired` to the audit chain and to fossic, and mark the record as expired. This would close the vocabulary-ghost gap: the event type is defined and the emit path exists, it just needs the scheduler trigger.

**Display-time derivation (tile side) is necessary but not authoritative.** Even after the background emitter exists, the tile must still derive expiry from the ISO 8601 `expires_at` timestamp — there's no guarantee the background emitter runs before the user opens the tile, and there's no guarantee the `ApprovalExpired` event reaches Lattica before the timestamp passes. Display-time derivation is the correct UX fallback. It's not the event-record source of truth.

**Relay agent detection is the wrong home.** The relay agent should relay events that policy-scout emitted, not synthesize new event types. If `ApprovalExpired` detection lived in the relay agent, federation design would determine when and whether policy-scout's approvals expire — a bad coupling.

**Recommended implementation order when this gets scheduled:**
1. Add scheduler to watch daemon: scan `approvals` SQLite, emit `ApprovalExpired` for overdue records
2. Wire `ApprovalExpired` into fossic emit path (already exists for other approval events)
3. Tile can subscribe to `ApprovalExpired` events once they're live; display-time fallback remains for latency resilience

Cost: S-M. The SQLite scan and event emit are straightforward; the scheduler integration into the watch daemon is the only non-trivial part.

**Current status: undecided/unscheduled** — this reconciliation is the first explicit position. Flagging for federation design round consideration.

---

## Cross-Project Reconciliation Update

*Filed after reading Cerebra, Fossic, LumaWeave, and ai-stack/Bo reconciliation files.*

---

### A update — Self-representation: no corrections

No other project's reconciliation surfaces any inaccuracy in policy-scout's baseline.
The original A response stands.

---

### B update — What others said about policy-scout (new signals)

**Fossic reconciliation — `POLICY_SCOUT_EVENT_VOCABULARY.md` scope question:**
Fossic Item 1 notes: "if `POLICY_SCOUT_EVENT_VOCABULARY.md` is in fossic's tree, I should check and update [the `expires_at` description]. If it's in policy-scout's tree, they own it."

Clarification: `POLICY_SCOUT_EVENT_VOCABULARY.md` lives in **policy-scout's tree** (`policy_scout/docs/` or project docs directory), not fossic's. Fossic has `AGENT_TRACE_VOCABULARY.md` for Cerebra event types. The `expires_at` update is policy-scout's responsibility to make. The outbound route (`2026-06-15_lattica_to_fossic_ps-approval-timeout-route.md`) was correctly informational; no fossic-side change is needed or expected.

**Fossic reconciliation — `upstream_causation_id` cross-store causation resolution:**
Fossic addresses policy-scout's cross-store causation concern in Item 1 with a concrete protocol decision:

> "if Policy Scout relays to hub and Cerebra relays to hub, the hub eventually has both events — but they're in different project namespaces. The `walk_causation` on the hub would find Cerebra's event if it was relayed with the same `id`. This is the one case where hub-side causal traversal works for cross-project chains — as long as both projects relay and both use the source event_id as the hub event's `causation_id`."

This is a materially better outcome than my original "concern/unknown" characterization. **Updated position:** Cross-store causation via `CommandRequested.upstream_causation_id` is resolvable at the hub if both policy-scout and Cerebra relay their respective events. The causation chain `Cerebra:ActionProposed → PS:CommandRequested` becomes hub-traversable. The requirement: Cerebra's relay agent must be live when the federation interview round happens.

**Cerebra reconciliation — hub is aggregation point:**
Cerebra explicitly clarifies (Item 3): "The hub is the right aggregation point for cross-project queries, not Cerebra." This is relevant to Item 3 of this reconciliation. Original reasoning ("policy-scout owns expiry detection, not Cerebra, not the relay agent") is confirmed by this framing.

**ai-stack/Bo reconciliation — two separate repos:**
The compile treated ai-stack and Bo as one entry. ai-stack-bo-claude clarifies they are separate codebases (`/home/boop/Projects/ai-stack/` vs `/home/boop/Projects/discord-bot/`). Both write to `~/.lattica/fossic/store.db` and will share a local store under federation. Under federation, policy-scout's relay agent and ai-stack's relay agent are separate processes. The hub they both write to is already active with ai-stack sidecar events.

**ai-stack/Bo reconciliation — Bo's read path (revised):**
The original ai-stack/Bo reconciliation stated Bo's reads go through cerebra's witness model. Their own cross-read update (Item 2, marked [REVISED]) corrects this. The accurate picture:

- **Cognitive cycle state** → Cerebra daemon HTTP `GET /status` (posture, cycle_running, active_session_id, last_outcome) — bounded, stable contract, no store access
- **Platform-wide state** (including policy posture, GPU state, service health) → **hub fossic store** once relay is live — this is the correct aggregation point for cross-project queries, not cerebra
- The witness model is a cerebra-internal design for augmenting cognitive cycle processing; it is NOT a substitution for the hub as platform aggregation layer

Implication for policy-scout: if Bo needs to answer "is the system in lockdown?" or "are there pending approvals?", the correct answer path under federation is the hub fossic store, where PS's relayed `LockdownActivated`/`LockdownDeactivated`/`ApprovalRequested` events would live. This means policy-scout's relay landing on the hub directly enables Bo's platform-state awareness. No cerebra mediation required for policy posture queries.

**Witness model feedback loop — corrected per Cerebra D.5:** PS relay serves two distinct purposes. (1) **Bo's direct hub queries**: once PS relay is live, Bo reads platform-wide state (posture, GPU, service health) directly from the hub fossic store — no witness model involved. (2) **Cerebra's cognitive cycle enrichment**: PS's relayed governance transitions (`LockdownActivated`, `LockdownDeactivated`, `ApprovalRequested`) feed the witness model's hub projection reducer, so Cerebra's cognitive cycles can factor in platform state (e.g., "system is under lockdown") as context during cycle execution. Cerebra D.5 is explicit: the relay passes are prerequisites for the witness model to have useful platform context "not because Bo's queries route through it, but because the cognitive cycle itself benefits from knowing platform state." The witness model is NOT Bo's query interface for posture questions — those go directly to the hub.

---

### C update — Cross-baseline observations: new specifics

**`indexed_tags` adoption gap:**
Fossic's reconciliation (Item 4) identifies an adoption gap for Cerebra: their existing events lack `indexed_tags`, so `indexed_tags_filter` can't SQL-push filter on their historical events. Fossic recommends this as a prerequisite before the Cerebra relay pass.

Policy-scout has the same gap. The staged fossic emit in `sqlite_store.py` does not set `indexed_tags` on any events. Planned `indexed_tags` fields for policy-scout's key events:
- `CommandRequested`, `DecisionIssued`: `{request_id, risk_band, decision}`
- `ApprovalRequested`, `ApprovalApprovedOnce`, `ApprovalDeniedOnce`, `ApprovalExpired`: `{request_id, approval_id}`
- `LockdownActivated`, `LockdownDeactivated`: `{reason}` (if present)

Adding these before the relay pass lets Lattica's hub aggregate by `risk_band == "critical"` or `decision == "DENY_AND_ALERT"` via SQL push rather than fold-time Python filter. This is a small additional pass on `sqlite_store.py` before committing.

**Snapshot cold-start analogy (from ai-stack/Bo):**
ai-stack identified a concrete cold-start problem for tile subscriptions: when the tile switches from direct polling to hub subscription, it sees no events until the next sidecar emit fires (up to 10 seconds). They propose a snapshot on `ai-stack/gpu` to seed the tile's initial state.

Policy-scout has an equivalent concern for the approval queue: when Lattica's tile first subscribes to `policy-scout/audit/*` on the hub, it won't know about pending approvals that were created before the subscription. A snapshot on each `policy-scout/audit/<request_id>` stream at the point of a `DecisionIssued` would give the tile its initial state without replaying all events. Noting this for the relay design pass, not a current blocker. Fossic's updated Item 4 now explicitly names the PS approval queue as the third canonical cold-start case alongside ai-stack and LumaWeave — all three solvable with the existing snapshot API, all three requiring per-project adoption.

---

### Item 2 update — Fossic emission status: two additions

Both are additions, not corrections, to the original Item 2 response.

**Addition 1 — `indexed_tags` before commit:**
Based on fossic's reconciliation recommendation, policy-scout should add `indexed_tags` to the staged `sqlite_store.py` before committing. The fields listed in C update above. Cost: S (a few additional dict fields on each Append call). This means the commit bundle for Pass E should include: fossic emit + indexed_tags + lockdown bundle.

**Addition 2 — Fossic relay protocol adoption:**
Fossic's reconciliation (Item 3) formalizes the relay agent spec. Policy-scout's eventual relay agent should adopt:
- Relay decoded (post-upcast) payloads via `event.deserialize_payload_json()`
- `external_id = event.id.hex()` for idempotency on hub restart
- `causation_id = event.id` for causal link back to local store
- `source_store = "policy-scout"` as an `indexed_tag` to enable cross-store traversal hints
- `branch = event.branch` pass-through
- Hub stream naming: open question for federation interview round. Cerebra's D.3 proposes a concrete rule: if `stream_id.startswith(f"{source_prefix}/")`, use `stream_id` as-is; otherwise prefix. Under this rule, `policy-scout/audit/<request_id>` already starts with `policy-scout/` and passes through unchanged — no double-prefix. If adopted, PS avoids the redundancy entirely. Await federation convention decision before finalizing relay agent.
- Local relay filter: `event_type ∈ {LockdownActivated, LockdownDeactivated, ApprovalRequested, ApprovalApprovedOnce, ApprovalDeniedOnce, ApprovalExpired, WatchDaemonStopped}` OR `risk_band == "critical"` OR `decision == "DENY_AND_ALERT"` (unchanged from baseline §6 formula)

No relay agent implementation now. This is what the relay agent should look like when scheduled.

---

### Item 3 update — Approval expiry: position confirmed, `append_if` adoption noted

Cerebra's Item 3 confirms: "The hub is the right aggregation point for cross-project queries, not Cerebra." This supports the original Item 3 position: policy-scout owns expiry detection as a background scheduler, not the relay agent or hub. Position unchanged.

One addition: fossic confirmed `append_if` is available and specifically designed for this class of race. The approval expiry scheduler should use `append_if` when emitting `ApprovalExpired` — the condition closure checks that no `ApprovalExpired` for this `approval_id` already exists in the stream, preventing duplicate expiry events if the scheduler loop runs twice before a database update commits. The primitive is already available; adoption is an implementation detail of the scheduler pass.

---

### Summary of net-new positions from cross-project reading

| Topic | Original position | Updated position |
|---|---|---|
| `upstream_causation_id` cross-store causation | Concern/unknown; flagged for federation design | Resolvable at hub if both PS and Cerebra relay; causation chain becomes hub-traversable |
| `indexed_tags` on fossic events | Not mentioned | Should be added before Pass E commit; listed fields above |
| Hub as aggregation point | Implied; not explicit | Confirmed by Cerebra reconciliation explicitly |
| `POLICY_SCOUT_EVENT_VOCABULARY.md` scope | Ambiguous in fossic's outbound | Clarified: lives in PS's tree; PS owns the `expires_at` update |
| Relay agent protocol | "CLI subprocess stays as-is" | Fossic relay spec adopted as target for future relay agent; stream naming open pending federation interview |
| Snapshot cold-start | Not flagged | Noted as future concern for tile subscription cold-start; not a current blocker |
| `append_if` for expiry scheduler | Not mentioned in Item 3 | Should be used in expiry emitter to guard against duplicate `ApprovalExpired` events |
| Bo's policy posture query path | "Routes through cerebra's witness model" (initial reading) | Corrected: platform-wide state goes to hub fossic store; witness model is for cognitive cycle queries only |
| Stream naming double-prefix | "Open — wait for federation interview" | Still open, but Cerebra's proposed rule eliminates the double-prefix for PS (stream already starts with `policy-scout/`) |
| Witness model feedback loop | Not captured | PS relay serves two purposes: (1) enabling Bo's direct hub queries for platform-wide state, and (2) feeding Cerebra's witness model reducer for cognitive cycle enrichment. Witness model is NOT Bo's posture query path (Cerebra D.5 explicit). |

---

*End of reconciliation (updated after cross-project review).*

---

## needs-wiring

# Policy Scout — Needs Wiring

**Filed:** 2026-06-16
**Purpose:** Hard-coded values, ambiguous bindings, and unconfirmed assumptions encountered during federation design. Do NOT hard-code these — each entry must be resolved before the relevant code ships.

---

## W-001 — upstream_causation_id redaction survival — RESOLVED

**Resolution (2026-06-16, via Cerebra response):**
- Format confirmed: 32-char lowercase hex (`event.id.hex()`)
- PS must add `upstream_causation_id` to the redaction exemption list in `policy_scout/audit/redaction.py`
- Cerebra parses it back via `FossicEventId.from_hex()` — same format PS's `_emit_to_fossic()` already uses

**Pre-commit action required (Pass E):** Add `upstream_causation_id` to the redaction exemption list in `redaction.py`. Without this, the field is stripped before `_emit_to_fossic()` reads it, `causation_id` silently becomes `None`, and the case-2 causation chain (CommandRequested → ActionProposed) breaks at the local store level and propagates broken through relay.

**Context:** S-006 / S-029. Once exempted, the field survives post-redact as a 32-char hex string; `FossicEventId.from_hex()` parses it cleanly; `causation_id` on the local fossic event is set correctly.

---

## W-002 — indexed_tags parameter accepted by installed fossic-py Append

**Element / binding location:**
`_emit_to_fossic()` — the planned `Append(... indexed_tags=indexed_tags)` call.

**Assumed correct behavior:** The installed version of `fossic-py` accepts `indexed_tags` as a keyword argument on `Append`.

**Who needs to confirm:** Policy Scout developer — check fossic-py version in `requirements.txt` or `pyproject.toml` against fossic changelog to confirm `indexed_tags` is available on `Append` in the installed version. If not available, the import will either fail silently or raise a TypeError at emit time.

**Confidence:** Medium — fossic is at v1.0.0aa and `indexed_tags` is a Phase 4A feature per the baseline. Need to verify the python binding exposes it.

**Context:** Per v2 §6.6 (OPEN): indexed_tags must be added before the fossic emit commit (Pass E). If the installed version doesn't support it, we either need to bump fossic-py (requires developer approval per security constraint) or defer indexed_tags to a separate pass.

---

## W-003 — fossic-py Append signature: branch parameter — RESOLVED

**Resolution (2026-06-16, via Fossic Rust source review):**
- `Append.branch` is a Rust `String` with default `"main"` — NOT `Option<String>`.
- Omitting `branch` in the Python call → stored event carries `"main"`. This is the correct path for PS's local emit.
- `branch=None` or `branch=Ellipsis` → TypeError at the pyo3 boundary (Rust can't coerce Python None to String). Would silently drop the emit since `_emit_to_fossic` wraps the append in `try/except`.
- `StoredEvent.branch` always returns a concrete `str` — relay reads `event.branch` → `"main"` → passes `branch=event.branch` to hub Append → hub stores `"main"`. Round-trip is clean and lossless.

**Action taken (Pass E):** `_emit_to_fossic()` already omits `branch` (correct). No change needed.

**Danger note:** Never pass `branch=None` to `Append` — it silently eats the event via the try/except wrapper. If PS ever needs a non-main branch, pass the branch name as a string literal, not None.

---

## W-004 — posture stream routing: do LockdownActivated/Deactivated arrive via write_event()

**Element / binding location:**
The new `policy-scout/posture` stream routing in `_emit_to_fossic()`.

**Assumed correct behavior:** `LockdownActivated` and `LockdownDeactivated` events are written to SQLite via `write_event()` (which calls `_emit_to_fossic()`), and they either arrive without a `request_id` or with one.

**Who needs to confirm:** Policy Scout developer — trace the lockdown command path in `cli/main.py` to confirm how `LockdownActivated`/`LockdownDeactivated` are written. If they arrive via a separate SQLite write path that doesn't go through `write_event()`, `_emit_to_fossic()` will never see them and the posture stream will be empty.

**Confidence:** Low. The current `_emit_to_fossic()` has an early return on `if not request_id`. If posture events do have request_id, the current routing (posture events in the audit stream) would work — but they'd be in a request-scoped stream rather than the singleton `policy-scout/posture` stream. The federation design calls for a separate posture stream; this must be confirmed as achievable with the current SQLite write path.

**Context:** B.1 in federation_design.md — the two-stream design requires posture events to route separately. If they always arrive via the same write_event() path as governance events, the routing change is trivial. If they don't go through write_event() at all, the fossic emit for posture events needs to be wired separately.

---

*End of needs-wiring.md*

---

## current_state

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

---

