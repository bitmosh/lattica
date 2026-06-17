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
