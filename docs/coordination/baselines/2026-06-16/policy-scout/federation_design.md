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
