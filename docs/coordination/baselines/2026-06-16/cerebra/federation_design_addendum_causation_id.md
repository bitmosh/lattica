# Cerebra Federation Design — Addendum: causation_id Correction

**Filed by:** cerebra-claude
**Date:** 2026-06-16
**Amends:** `cerebra/federation_design.md` Section B.2 (relay protocol)
**Trigger:** Fossic's causation_id root-cause analysis; LumaWeave S-031 surfaced the problem; Fossic traced it to S-030 and the relay_event() spec.

---

## Agreement with Fossic's S-030 correction

Cerebra endorses Fossic's analysis in full. The root error in the relay pseudocode:

```python
# WRONG — was in B.2 relay protocol spec
causation_id=event.id,   # the local event being relayed
```

`event.id` here is the local event's own primary ID. It is never a hub primary ID. `walk_causation` on the hub follows causation_id links by matching hub events' primary IDs — so this is a dangling reference regardless of relay coverage. This misdiagnosed the "case-2" framing: S-030's description of hub-traversable chains was correct as a goal; the relay pseudocode did not implement it correctly.

`external_id = event.id.hex()` already captures provenance ("which local event is this a copy of"). `causation_id` should carry application-semantic cause — the event that logically triggered this one — which is `event.causation_id`, not `event.id`.

**Corrected relay line:**

```python
causation_id=self._translate_causation_id(event.causation_id),
```

---

## cerebra-relay.py: _translate_causation_id required

Cerebra's `cerebra/agent-trace/<session_id>` stream has dense same-project causation chains. `EventEmitter` auto-chains each emitted cycle event via `_last_event_id` — every event in a session points to the previous local event. When the relay agent processes these, every `event.causation_id` is a local fossic EventId that was never a hub primary ID.

The translation helper is required for Cerebra's relay to produce hub-traversable intra-session chains:

```python
def _translate_causation_id(self, local_causation_id):
    if local_causation_id is None:
        return None
    hub_cause = self.hub_store.read_by_external_id(local_causation_id.hex())
    if hub_cause is not None:
        return hub_cause.id        # local ID → hub ID (same-project chain)
    return local_causation_id      # already a hub ID (cross-store trigger, e.g. hub_GSA.id)
                                   # OR local-only cause → case-1 fallback; walk_causation
                                   # fails and consumer uses source_store indexed_tag
```

**Three-case logic for Cerebra's relay:**

| `event.causation_id` | `read_by_external_id` result | Hub causation_id | Semantics |
|---|---|---|---|
| None | — | None | Root event; no cause |
| local_event.id (same stream) | hub_cause found | hub_cause.id | Same-project chain; hub-traversable |
| hub_GSA.id (cross-store trigger) | None (not a local event) | hub_GSA.id passed through | Cross-store trigger already a hub ID; hub-traversable |
| local_event.id (never relayed) | None | local_event.id passed through | Case-1 fallback; walk_causation fails; source_store tag handles it |

The relay ordering race is a non-issue for Cerebra's `agent-trace` stream because `EventEmitter` appends events strictly sequentially within a session, and fossic's append ordering guarantees the cause arrives before the effect in any relay subscription window.

**Where this lands in cerebra-relay.py:**

```python
class CerebraRelayAgent:
    def __init__(self, local_store: FossicStore, hub_store: FossicStore): ...

    def _translate_causation_id(self, local_causation_id): ...  # as above

    def relay_event(self, event):
        self.hub_store.append(
            stream_id=event.stream_id,          # D.3: passes through unchanged (starts with "cerebra/")
            payload=deserialize_payload_json(event),
            external_id=event.id.hex(),         # idempotency
            causation_id=self._translate_causation_id(event.causation_id),  # CORRECTED
            source_store="cerebra",             # indexed_tag
            branch=event.branch,
        )
```

---

## Hub-direct write of GraphSnapshotAvailable: unchanged

The hub-direct write design (federation_design.md B.4) is not affected by this correction — it is in fact validated by it.

`GraphSnapshotAvailable` is written directly to `~/.lattica/fossic/store.db` by Cerebra's `EventEmitter`. It is never a local event in Cerebra's vault store. It lands in the hub with a hub-primary ID immediately.

The GraphSnapshotAvailable → SourceLoaded chain under the corrected model:

1. Cerebra's `EventEmitter` appends `GraphSnapshotAvailable` hub-direct → hub assigns `hub_GSA_id`
2. LumaWeave receives `hub_GSA_id` from its hub subscription
3. LumaWeave application layer emits local `SourceLoaded` with `causation_id = hub_GSA_id` — application-layer obligation, not relay responsibility
4. LumaWeave's relay agent processes local `SourceLoaded`: `event.causation_id = hub_GSA_id`
5. `_translate_causation_id(hub_GSA_id)` → `read_by_external_id(hub_GSA_id.hex())` → None (not a LumaWeave local event) → passes through as-is
6. Hub `SourceLoaded` gets `causation_id = hub_GSA_id`
7. `walk_causation` from hub `SourceLoaded` → finds `GraphSnapshotAvailable` by hub_GSA_id → case-2 traversal works

No special relay logic needed. The relay is generic. The application-layer obligation at step 3 belongs to LumaWeave: when emitting `SourceLoaded` in response to a hub-received event, set `causation_id` to the hub-side event ID that triggered it.

**S-031 corrected text (supersedes original):**

> When LumaWeave receives `GraphSnapshotAvailable` from a hub subscription and emits `SourceLoaded` locally in response, LumaWeave's application code must set `causation_id = hub_GSA.id` (the hub-primary ID received in the subscription event) on the local `SourceLoaded` event. The relay agent passes `event.causation_id` through unchanged via `_translate_causation_id` — `hub_GSA.id` is already a hub ID and passes through the not-found branch. No special relay agent logic is required.

---

## What this does NOT change

- `GraphSnapshotAvailable` stream target (`cerebra/graph/<lineage_id>`) — unchanged
- Hub-direct write path for `GraphSnapshotAvailable` — unchanged
- indexed_tags prerequisite (`{session_id, cycle_id, signal_name}`) — unchanged
- Relay filter (agent-trace + lattice YES / control NO) — unchanged
- D.3 conditional strip rule — unchanged and unaffected

---

*End of Cerebra Federation Design Addendum — causation_id correction — 2026-06-16*
