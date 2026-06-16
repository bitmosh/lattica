---
project: fossic
updated: 2026-06-16
updated_by: fossic-claude
branch: main
head: b3a4527
---

# fossic — current state

Local-first append-only event store. Rust core, SQLite+WAL, single
`Mutex<Connection>`. Content-addressed event IDs (CCE/blake3). Python
binding (PyO3/maturin), Tauri IPC plugin. No Tokio — `std::thread` +
`crossbeam-channel` throughout.

---

## What shipped this session (in order)

| Commit | What |
|---|---|
| `cb45101` | Phase 1 — upcaster consistency in `walk_causation`, `read_by_correlation`, `aggregate`; `PayloadTransform` now uses `**`-aware glob |
| `b9eaa20` | Phase 2 — `fossic_list_subscribers`, `fossic_subscription_status` Tauri commands |
| `d6d4a06` | Phase 3 — `compute_event_id()` via PyO3 (pre-compute CCE ID without writing) |
| `8b24ec1` | Phase 4B — `read_batch(&[EventId])` in Rust + Python + Tauri (`fossic_read_batch`) |
| `b3a4527` | Phase 4A — `AggregateQuery.indexed_tags_filter`; glob semantic fix in `aggregate` |

---

## Tauri command surface (for Lattica's IPC layer)

All commands are registered in `fossic_tauri::plugin()` and
`fossic_tauri::plugin_with_test_helpers()`.

### Stream / branch
| Command | Args | Returns |
|---|---|---|
| `fossic_list_streams` | — | `SerializedStreamInfo[]` |
| `fossic_list_branches` | `stream_id: string` | `SerializedBranchInfo[]` |

### Read
| Command | Args | Returns |
|---|---|---|
| `fossic_read_range` | `stream_id, branch?, from_version?, to_version?, limit?, event_type_filter?` | `SerializedEvent[]` |
| `fossic_read_one` | `event_id: string` (64-char hex) | `SerializedEvent \| null` |
| `fossic_read_batch` | `event_ids: string[]` (hex array) | `SerializedEvent[]` |
| `fossic_read_by_external_id` | `stream_id, external_id` | `SerializedEvent \| null` |
| `fossic_read_by_correlation` | `correlation_id: string` (hex) | `SerializedEvent[]` |
| `fossic_walk_causation` | `start: string`, `direction: "forward"\|"backward"`, `max_depth?: number` | `SerializedEvent[]` |
| `fossic_read_state_at_version` | `stream_id, branch, version, reducer_name?` | `any` (JSON state) |

### Subscriptions
| Command | Args | Returns |
|---|---|---|
| `fossic_subscribe` | `stream_pattern, branch?, include_system?, queue_size?` | `string` (subscription UUID) |
| `fossic_unsubscribe` | `subscription_id: string` | — |
| `fossic_list_subscribers` | — | `SubscriberSnapshot[]` |
| `fossic_subscription_status` | `subscription_id: string` | `{ active, degraded, queue_depth, queue_capacity }` |

`fossic_subscribe` emits `fossic:event` Tauri events with payload
`{ subscription_id: string, event: SerializedEvent }`.

### `SerializedEvent` shape
```ts
{
  id: string,              // 64-char hex CCE event ID
  stream_id: string,
  branch: string,
  version: number,
  timestamp_us: number,    // microseconds since epoch
  event_type: string,
  type_version: number,
  payload: any,            // decoded JSON
  causation_id: string | null,
  correlation_id: string | null,
  external_id: string | null,
  indexed_tags: object | null,
}
```

### `fossic_read_batch` notes
- Results ordered `timestamp_us ASC` regardless of input order
- Missing IDs silently omitted — check `result.length < event_ids.length` to detect gaps
- Keep batches ≤ 4,096 IDs (SQLite 32,766 parameter ceiling)

---

## Python API surface (fossic-py)

```python
from fossic import (
    Store, Append, ReadQuery, AggregateQuery, EventId, StoredEvent,
    SubscriptionMode, SubscriptionHandle, compute_event_id,
    cce_encode_value, cce_encode_bytes_raw, cce_encode_f64_bits,
)

store = Store.open("path/to/store.db")

# Append
eid = store.append(Append(
    stream_id="my/stream",
    event_type="ThingHappened",
    payload={"x": 1},
    indexed_tags={"session_id": "s1"},
))

# Read
events = store.read_range(ReadQuery(stream_id="my/stream"))
event  = store.read_one(eid)
batch  = store.read_batch([eid1, eid2, eid3])

# Aggregate with indexed_tags SQL filter
events = store.aggregate(AggregateQuery(
    stream_pattern="cerebra/**",
    indexed_tags_filter={"session_id": "s1", "composite_floor_violated": True},
))

# Pre-compute event ID without writing
expected_id = compute_event_id("ThingHappened", {"x": 1}, type_version=1)
assert expected_id == eid
```

---

## AggregateQuery.indexed_tags_filter semantics

- **Flat AND**: all key-value pairs must match
- **Supported types**: `str`, `bool`, `int`, `float`, `None`
- **Booleans**: matched as integers in SQLite (1=true, 0=false)
- **No OR, no IN, no ranges**: complex predicates stay in `fold()`
- **Key constraint**: `[a-zA-Z0-9_]` only

---

## Subscription delivery model

Subscriptions use `stream_pattern` glob (`*` = one segment, `**` = any depth)
and `branch` filter. Two delivery modes:

- **PostCommit** (default, `queue_size=1024`): bounded channel, per-sub handler
  thread. If queue fills, sub marks `degraded=true`; a `SubscriptionDegraded`
  event is written to `_fossic/system`. Tauri side emits `fossic:event` events.
- **Synchronous**: fires while write lock is held. Panics caught; sub marked degraded.

---

## What's next (open phases)

| Phase | Description | Status |
|---|---|---|
| Phase 5 | Glob subscription cursor: new glob subs start from `now`, not `-1` | Ready to start |
| Phase 6 | Connection pool for concurrent reads; `append_if` optimistic concurrency | Ready to start |
| PD-005 | One-sentence naming convention note in AGENT_TRACE_VOCABULARY §9 | Micro-pass |

---

## Known constraints

- **Single connection**: all reads and writes share one `Mutex<Connection>`. Long
  reads block writes. Phase 6 adds a read pool.
- **No concurrent inter-process writers**: WAL mode supports one writer at a time.
  Multiple processes opening the same store file is untested and unsupported.
- **Similarity search**: `SimilaritySearchProvider` trait is a stub. Not implemented.
- **`indexed_tags` not in CCE hash**: events differing only in tags deduplicate.
  Tags must be consistent with payload for the same logical event.
