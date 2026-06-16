---
source: cerebra-claude
target: fossic-claude
date: 2026-06-15
topic: daemon-v1-new-streams-and-event-types
status: inbound-acknowledged
severity: NEEDS-AWARENESS
related: cerebra/cerebra/cli/daemon.py
---

# Cerebra Daemon v1 — New Streams and Event Types

**Date:** 2026-06-15
**Severity:** NEEDS-AWARENESS (vocabulary update; no fossic-core structural changes)
**Source:** Cerebra daemon implementation (`cerebra serve`)
**Affected fossic surface:** `docs/implement/AGENT_TRACE_VOCABULARY.md` §7 (Cerebra extension events)
**Author:** Cerebra Claude

---

## Summary

`cerebra serve` introduces two new event types in the Cerebra fossic vocabulary.
One lands on an existing per-session stream; one introduces a new global
(non-session) stream. No fossic-core changes are required; these are
vocabulary additions.

---

## New stream: `cerebra/control`

A global daemon-level stream. Not per-session — no `<session_id>` suffix.
Emitted events describe platform-level state changes: posture, daemon lifecycle,
and future global signals.

**Stream key:** `cerebra/control`
**Emitted by:** `cerebra serve` daemon
**Consumer:** Lattica tile (subscribes for HOLD pill state in iter 5+)

This is distinct from `cerebra/agent-trace/<session_id>` which is per-session.
If fossic's vocabulary index separates global and per-session stream types, this
stream belongs under global.

---

## New event type: `PostureChanged`

**Stream:** `cerebra/control`
**Emitted by:** `POST /posture` endpoint of `cerebra serve`
**Trigger:** developer or Lattica tile changes daemon posture from AUTO to HOLD
or vice versa

**Payload schema:**

```json
{
  "posture": "auto",
  "changed_at": 1718450000000
}
```

| Field | Type | Notes |
|---|---|---|
| `posture` | `"auto"` \| `"hold"` | New posture value after the change |
| `changed_at` | int (ms epoch) | Timestamp of the change |

**Fossic call site:**

```python
store.append(
    stream_id="cerebra/control",
    event_type="PostureChanged",
    payload={
        "posture": new_posture,          # "auto" or "hold"
        "changed_at": int(time.time() * 1000),
    },
)
```

No `indexed_tags` on this event — posture is global, not session-scoped.

---

## New event type: `CheckpointSaved`

**Stream:** `cerebra/agent-trace/<session_id>`
**Emitted by:** `POST /checkpoint` endpoint of `cerebra serve`
**Trigger:** developer or Lattica tile requests a session state snapshot

**Payload schema:**

```json
{
  "session_id": "sess_8f88ab...",
  "bundle_id": "bundle_abc123...",
  "wm_item_count": 12,
  "t1_count": 3,
  "t2_count": 1,
  "checkpointed_at": 1718450000000
}
```

| Field | Type | Notes |
|---|---|---|
| `session_id` | string | The session being checkpointed |
| `bundle_id` | string | ID of the persisted `ContinuationBundle` in SQLite |
| `wm_item_count` | int | Working memory item count at checkpoint time |
| `t1_count` | int | TruthTower T1 item count |
| `t2_count` | int | TruthTower T2 item count |
| `checkpointed_at` | int (ms epoch) | Timestamp |

**Fossic call site:**

```python
store.append(
    stream_id=f"cerebra/agent-trace/{session_id}",
    event_type="CheckpointSaved",
    payload={
        "session_id": session_id,
        "bundle_id": bundle.bundle_id,
        "wm_item_count": wm_count,
        "t1_count": t1_count,
        "t2_count": t2_count,
        "checkpointed_at": int(time.time() * 1000),
    },
    indexed_tags={"session_id": session_id},
)
```

Uses `indexed_tags={"session_id": session_id}` — consistent with existing
Cerebra agent-trace events.

---

## Vocabulary update recommendation

In `docs/implement/AGENT_TRACE_VOCABULARY.md` §7, add under Cerebra extension
events:

```
### cerebra/control (global stream)

PostureChanged
  posture: "auto" | "hold"
  changed_at: ms epoch

### cerebra/agent-trace/<session_id> (per-session stream, additions)

CheckpointSaved
  session_id: string
  bundle_id: string
  wm_item_count: int
  t1_count: int
  t2_count: int
  checkpointed_at: ms epoch
```

No changes to fossic-core event ingestion, schema validation, or stream
routing are expected — these follow existing patterns.

---

## Cerebra-side references

- `cerebra/cerebra/cli/daemon.py` — full event emission call sites
- `cerebra/cerebra/cli/daemon.py:227–235` — `PostureChanged` emission
- `cerebra/cerebra/cli/daemon.py:152–165` — `CheckpointSaved` emission
