# Fossic Federation Design — Addendum: causation_id Correction

**Filed by:** fossic-claude
**Date:** 2026-06-16
**Amends:** `fossic/federation_design.md` Section B.1
**Trigger:** LumaWeave surfaced a genuine inconsistency in S-031; analysis confirmed it implicates S-030 and the B.1 relay_event() spec as well.

---

## What is being corrected

In `federation_design.md` B.1, `RelayAgent.relay_event()` contains:

```python
causation_id=event.id,          # S-030: local source event ID for case-2 chains
```

This line is wrong. `event.id` is the local event's own ID. When the relay writes the hub event with `causation_id = local_event.id`, `walk_causation` on the hub follows `causation_id` by matching hub events' primary IDs. The local event's ID is never a hub primary ID — the hub assigns its own content-addressed IDs. The causation link is a dangling reference regardless of relay coverage. S-030's "case-2" framing does not produce hub-traversable chains under this implementation.

`external_id = event.id.hex()` already records "which local event am I a relay copy of." `causation_id` should carry application-semantic cause, not re-express provenance that `external_id` already holds.

---

## Correct implementation

Replace `relay_event()` in B.1 with the following (diff shown, then full corrected method):

**Change 1 — add `_translate_causation_id` helper to `RelayAgent`:**

```python
def _translate_causation_id(self, local_causation_id) -> Optional[EventId]:
    """Translate a local causation ID to its hub equivalent where possible.

    Three cases:
      - None              → None (root event; no cause)
      - local event ID    → hub_event.id via read_by_external_id (same-project chain)
      - hub event ID      → pass through (cross-store trigger already a hub ID)

    If read_by_external_id returns None, the cause is either a hub ID (cross-store
    trigger, e.g. hub_GSA_id stored by LumaWeave when reacting to GraphSnapshotAvailable)
    or a local-only event that was never relayed. Both fall back to passing through the
    ID as-is. In the local-only case, walk_causation will fail on the hub — which is
    correct case-1 behaviour; the consumer uses source_store to route back to the
    originating store.
    """
    if local_causation_id is None:
        return None
    hub_cause = self.hub_store.read_by_external_id(local_causation_id.hex())
    if hub_cause is not None:
        return hub_cause.id          # local ID → hub ID
    return local_causation_id        # already a hub ID, or local-only (case-1 fallback)
```

**Change 2 — update the `hub_store.append()` call inside `relay_event()`:**

```python
# Before (wrong):
causation_id=event.id,

# After (correct):
causation_id=self._translate_causation_id(event.causation_id),
```

**Full corrected `relay_event()`:**

```python
def relay_event(self, event: StoredEvent) -> bool:
    if not self._should_relay(event):
        return False

    external_id = event.id.hex()
    if self.hub_store.read_by_external_id(external_id) is not None:
        return False

    hub_stream_id = self._hub_stream_id(event.stream_id)
    payload = event.deserialize_payload_json()

    self.hub_store.append(Append(
        stream_id=hub_stream_id,
        event_type=event.event_type,
        type_version=event.type_version,
        payload=payload,
        causation_id=self._translate_causation_id(event.causation_id),  # corrected
        external_id=external_id,
        branch=event.branch,
        indexed_tags={
            **event.indexed_tags,
            "source_store": self.config.source_prefix,
        },
    ))
    return True
```

---

## Why this works for the GraphSnapshotAvailable → SourceLoaded chain

1. Cerebra relays `GraphSnapshotAvailable` to hub → hub assigns it `hub_GSA_id`
2. LumaWeave receives `hub_GSA_id` from its hub subscription
3. **LumaWeave application code** emits local `SourceLoaded` with `causation_id = hub_GSA_id`
   — LumaWeave knows what triggered it; it stores the hub event ID directly
4. LumaWeave relay agent calls `_translate_causation_id(hub_GSA_id)`:
   `read_by_external_id(hub_GSA_id.hex())` returns None (hub_GSA_id is a hub primary ID, not an external_id)
   → falls through to `return local_causation_id` → passes `hub_GSA_id` as-is
5. Hub `SourceLoaded` gets `causation_id = hub_GSA_id`
6. `walk_causation` from hub `SourceLoaded` → finds `GraphSnapshotAvailable` → case-2 confirmed

No special relay agent awareness of `GraphSnapshotAvailable` is needed. The relay is generic. The application-semantic causation is established in step 3, by LumaWeave's own code.

## Same-project causation chains (e.g., local A → local B, both relayed)

1. Relay processes local A first (fossic append ordering guarantees A before B)
2. hub A is written with `external_id = local_A.id.hex()`
3. Relay processes local B: `_translate_causation_id(local_A.id)` →
   `read_by_external_id(local_A.id.hex())` → returns hub A → returns `hub_A.id`
4. Hub B gets `causation_id = hub_A.id`
5. `walk_causation` from hub B → finds hub A → case-2 within same project

The ordering race (B processed before A across different streams) is not a real concern: B cannot causally depend on A unless A was appended first to the local store; fossic's subscribe() delivers events in append order; A is guaranteed to be relayed before B within any relay session.

---

## S-030 and S-031 correction

**S-030 correction:** Replace "causation_id=event.id (the local source event's ID)" with:
> causation_id is translated via `_translate_causation_id(event.causation_id)`: local event IDs are resolved to their hub counterparts via `read_by_external_id`; hub event IDs (cross-store triggers) pass through as-is; None passes through as None. `external_id = event.id.hex()` already carries provenance; `causation_id` carries application-semantic cause only.

**S-031 correction:** The relay agent requires no special awareness of `GraphSnapshotAvailable`. The obligation moves to LumaWeave's application layer: when emitting `SourceLoaded` in response to a hub-received `GraphSnapshotAvailable`, LumaWeave must store `causation_id = hub_GSA_id` in the local event at emit time. The relay then passes it through naturally via `_translate_causation_id`.

The relay_append convenience helper (B.3) should call `_translate_causation_id` internally rather than accepting a raw causation_id — this ensures all relay authors get the translation for free.

---

## Impact on other relay agents

All four emitting projects (Cerebra, LumaWeave, Policy Scout, ai-stack) are affected by the S-030 correction to the relay pseudocode. In practice:

- **Cerebra:** Local cycle events are typically root events (`causation_id=None`) or caused by other local Cerebra events — translation path is straightforward.
- **LumaWeave:** Has the `GraphSnapshotAvailable → SourceLoaded` cross-store trigger — this is the primary case that motivated the correction; application-layer obligation applies here.
- **Policy Scout:** `CommandRequested.upstream_causation_id` points to a Cerebra `ActionProposed` — a hub event ID stored by PS at local-emit time. Translation returns it as-is (not found via external_id → pass through).
- **ai-stack:** Current events are root events; no causation chain work needed in phase 1.

No emitting project needs to change their local event emission logic unless they already store causation_ids incorrectly. The relay_event() correction is mechanical and confined to fossic-py.

End of addendum.
