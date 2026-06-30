# Current States

Per-project current state snapshots.

---

## fossic (snapshot)

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

---

## fossic - current_state

# Fossic — Current State

**Last updated:** 2026-06-14
**Version:** v1.0.0o (vocab doc) / Cargo.toml bindings at 0.1.0

---

## What shipped recently

- **v1.0.0o** (this pass) — `AGENT_TRACE_VOCABULARY.md` corrections: stream key `<cycle_id>` → `<session_id>` throughout §7.1, §7.2; Correction A (`CatalystArmSelected` `score_components` v0.2 gap documented); Correction B (`ReinjectionTriggered` stale schema replaced — `trigger_predicate`, `continuation_bundle_id`, `recursion_depth`, causation fixed to `SessionFlushed`); §8.2 OTel attributes corrected; sibling vocab scope note added
- **v1.0.0p** — prior vocab pass (DEVIATION.md last_reviewed)
- **v0.10.0r** — Justfile + unified test surface, CI fix

## Core capabilities (stable)

- Append-only CCE event store (Rust, SQLite+WAL, `std::thread` + `crossbeam-channel`)
- Python binding (`fossic-py`), Node binding (`fossic-node`, package name: `"fossic"`), Tauri plugin (`fossic-tauri`)
- `just test` — canonical full-suite command
- Glob subscriptions, snapshot caching, CCE encoder exposed to Python

## Platform store topology (confirmed)

- Single platform store at `~/.lattica/fossic/store.db` (per Lattica ADR-012)
- `fossic-tauri` opens via `app.path().home_dir()?.join(".lattica/fossic/store.db")`
- `fossic-node` install key: `"fossic": "file:../../fossic/fossic-node"` (not `"fossic-node"`)

## Open action items

- **Policy Scout round 2** — fossic round 2 response to policy-scout drafted (this pass)
- **fossic-tauri integration pass** — waiting for Lattica Phase 1 Rust shell setup
- **`fossic_subscription_status` Tauri command** — ships before LumaWeave R-F-004
- **PD-007** — blake3 install approved, `compute_event_id()` via PyO3 pending

## Open tech debt

- TD-001 (MEDIUM): PyO3 bridge latency at high event counts — mitigation: snapshot every 10 events
- TD-003 (LOW): `time = "=0.3.37"` exact pin in fossic-tauri
- TD-004 (MEDIUM): `SimilaritySearchProvider` declared in spec, absent from code
- PD-005 (LOW): snake_case vs PascalCase naming convention note needed in vocab §9
- PD-007 (LOW): blake3 not in Python test env — `event_id` derivation untested at Python level

## Dependencies on other projects

- Cerebra: passes cross-pollination files for vocab updates; v0.2 will add `ActionProposed` event (no current action)
- Policy Scout: Phase 2 fossic-py emit pending developer approval of fossic-py install
- LumaWeave: R-F-004, R-F-006 integration pending fossic-tauri pass

---

## cerebra - current_state

---
project: cerebra
updated: 2026-06-16
updated_by: cerebra-claude
version: v0.4.0
head: 520cb46
branch: main
---

# Cerebra — Current State

Local-first cognitive runtime. Python 3.12, SQLite vault, fossic-py event store,
Click CLI. Daemon server (`cerebra serve`) on `127.0.0.1:7432`. No async — `std::thread`
equivalent via Python threading.

---

## What shipped this session (in order)

| Commit | What |
|---|---|
| `af51e00` | Phase 9 Step 1 — Full ClutchEngine (expanded predicates, cascade, escalate hook) |
| `a596fd0` | Phase 9 Step 2 — BanditSelector primitive (seventh vendored primitive) |
| `432b834` | Phase 9 Step 3 — CatalystEngine (bandit-driven cognitive strategy selector) |
| various  | TD-018 fix — `CliRunner(mix_stderr=False)` removed (Click 8.4.1 compat) |
| various  | TD-019 fix — `test_lattice_against_vault` schema check via PRAGMA, not data state |
| various  | Daemon — `cerebra serve` (4 endpoints, DaemonState, checkpoint, posture control) |
| various  | PATH fix — `~/.local/bin/cerebra` symlink → `.venv/bin/cerebra` |
| `cdca7dc` | **Phase 10 — cognitive loop closure** (Migration018, EpisodeWriter dual-write, vocab §8) |
| `520cb46` | chore: bump to v0.4.0 |

---

## Phase 10 — what changed (v0.4.0)

**Milestone: cognitive loop closes.** Cycle output is now visible to the retrieval
pipeline. EpisodeWriter.write() dual-writes atomically to:
- `cycle_episode_records` — primary, for session queries
- `memory_records` (`record_type='cycle_episode'`) — bridge, for retrieval visibility

**Migration018_SyntheticEpisodeProvenance** inserts permanent sentinel rows:
- `sources.source_id = 'cerebra_synthetic_source'` (`canonical_path = 'cerebra://cycle-episodes'`)
- `documents.document_id = 'cerebra_synthetic_document'`
- `chunks.chunk_id = 'cerebra_synthetic_chunk'`

These are FK anchors. All `memory_records` with `record_type='cycle_episode'` point to
them. They are INSERT OR IGNORE — idempotent on re-migration.

After each write, `queue_for_embedding(db_path, [record_id])` is called so the vector
index picks up cycle content (best-effort, outside the transaction).

---

## Agent trace vocabulary

`docs/planning/AGENT_TRACE_VOCABULARY.md` §8 is now the authoritative reference for
all `cerebra/*` stream event types. Covers:

- §8.1 Session/cycle lifecycle (`AgentTraceOpened`, `CycleCompleted`, `ReinjectionTriggered`)
- §8.2 Step-level (`StepExecuted`, `MemoryWriteFromCycle`)
- §8.3 Clutch/catalyst (`ClutchDecisionMade`, `CatalystInvoked`, `CatalystArmSelected`)
- §8.4 Signal evaluation (`SignalEvaluated`, `EvaluationComposed`)
- §8.5 Predictions (`PredictionMade`, `OutcomeRecorded`)
- §8.6 Daemon/control (`PostureChanged` on `cerebra/control`, `CheckpointSaved` on `cerebra/agent-trace/<session_id>`)

---

## Daemon surface (stable since v0.3.7)

`cerebra serve` — `http://127.0.0.1:7432` (CEREBRA_DAEMON_URL override)

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | liveness; returns `{"status":"ok","posture":"auto|hold"}` |
| `/posture` | POST | `{"posture":"hold"|"auto"}` — emits `PostureChanged` on `cerebra/control` |
| `/checkpoint` | POST | `{"session_id":"..."}` — emits `CheckpointSaved` on session stream |
| `/status` | GET | full daemon state snapshot |

---

## retrieval_pipeline surface (for Lattica queries)

Memory retrieval reads from `memory_records`. Since Phase 10, entries with
`record_type='cycle_episode'` appear here alongside `source_chunk` entries.
Distinguish them by `record_type` in any retrieval display.

---

## Open deferred items

| ID | Item | Severity |
|---|---|---|
| — | Scorer weighting: cycle_episode vs source_chunk (retrieval ranking) | medium |
| — | Old cycle_episode_records backfill decision (pre-Phase 10 episodes not in memory_records) | low |
| — | Traversal edge cases (lattice lineage across cycle boundaries) | low |
| — | `cerebra --version` hardcoded "0.0.0" (cosmetic) | negligible |
| daemon-v1 | Lattica iter-5 Track B — HOLD/checkpoint button integration | pending Lattica |

---

