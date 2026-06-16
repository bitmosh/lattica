# Fossic — Current State Baseline

**Date:** 2026-06-16
**Filed by:** fossic-claude

---

## Section 1 — Current version + identity

**Current version:** v1.0.0aa

**Identity:** Fossic is a local-first, append-only, content-addressed event store — a substrate that application projects embed to get durable, causally-linked event histories with concurrent read performance, optimistic write guarding, and a subscription model that scales to glob patterns.

---

## Section 2 — What just shipped since last baseline

Chronological order from approximately WEB_CLAUDE_BRIEF_ITER5.md forward:

**Phase 1 — Upcaster consistency + transform `**` glob fix**
Upcasters now fire on all read paths that were missing them (`aggregate`, `walk_causation`, `read_by_correlation`). The `**` transform pattern was fixed to match all streams correctly. Previously, some read paths returned un-upcasted events silently.

**Phase 2 — Tauri observability: `fossic_list_subscribers`, `fossic_subscription_status`**
Two new Tauri commands expose the live subscription registry to LumaWeave's frontend: list all active subscribers with their stream patterns, modes, and cursor positions; query a single subscriber's degraded status. Required for LumaWeave's graph tile to show what's being watched.

**Phase 3 — PD-007: `compute_event_id` via PyO3 (commit d6d4a06)**
`compute_event_id(event_type, payload, type_version, causation_id)` exposed from fossic-py. Routes through fossic's own blake3 path — no Python-side blake3 dependency. 8 tests in `test_event_id.py` confirm byte identity between pre-computed IDs and what `Store.append()` assigns. Closes the Python-level CCE verification gap. Required for Cerebra's relay agent to verify hub event IDs.

**Phase 4A — `indexed_tags` SQL filter + glob semantic fix in `aggregate`**
`AggregateQuery.indexed_tags_filter` now pushes a flat AND exact-match filter into SQL rather than post-filtering in fold. Glob patterns in `aggregate` stream matching fixed. `_fossic/*` streams excluded from glob aggregates unless `include_system = true`.

**Phase 4B — `read_batch`: fetch multiple events by CCE ID in one query**
`Store::read_batch(ids: &[EventId])` returns a `Vec<StoredEvent>` for a batch of event IDs in a single SQL `IN (...)` query. Available via `fossic_read_batch` Tauri command. Enables efficient causal-graph traversal without N round-trips.

**Phase 5 — Glob subscription cursor seeding (v1.0.0u)**
Glob subscriptions previously initialized cursors to -1, causing full history replay on every new subscriber. Fixed: at subscribe time, `MAX(version)` per matching stream is snapshot into `stream_cursors`, so only future events are delivered. New streams created after subscription still receive their first event correctly via `unwrap_or(&-1)`. 2 new integration tests confirm no replay and correct new-stream delivery.

**Phase 6a — `append_if`: optimistic-concurrency append (v1.0.0v)**
`Store::append_if(a: Append, condition: FnOnce(&Connection) -> Result<bool, Error>)` — condition closure runs inside an `IMMEDIATE` transaction. Returns `Ok(None)` without committing if condition returns false. Enables version-guard patterns, idempotency checks, and state-machine transitions without external locking. 7 integration tests.

**Phase 6b — Read connection pool (v1.0.0w)**
`StoreInner` now holds a crossbeam-channel bounded pool of N read connections (default `read_pool_size: 4`). All pure-read methods (`read_range`, `aggregate`, `walk_causation`, `read_batch`, `snapshot_info`, etc. — 16 methods) draw from the pool rather than the write mutex. Pool connections are opened with `PRAGMA query_only = ON` as write-accident guard. `ReadGuard` RAII struct returns connection on drop. `Error::PoolExhausted` returned after configurable timeout (`read_pool_timeout_ms`, default 30s). Zero new dependencies — crossbeam-channel was already in the workspace.

**v1.0.0x — Registry reconciliation**
TD-007/TD-008/PD-009 added to canonical registries; PD-005 marked resolved. Blast-radius ID collision from pass-1.0.0w corrected.

**v1.0.0y — TD-008 resolved: subscribe seed queries moved to read pool**
Both seed queries in `Store::subscribe` (glob `MAX(version) GROUP BY stream_id` and exact-stream `MAX(version)`) moved from write connection to `read_conn()`. Subscribe setup no longer contends with concurrent appends.

**v1.0.0z — PD-009 resolved: `PoolExhausted` integration test + configurable timeout**
`OpenOptions::read_pool_timeout_ms` added. `test-helpers` feature exposes `Store::_test_hold_read_conn` for integration tests. `pool_exhausted_returns_error` test verifies the error variant fires correctly.

**v1.0.0aa — PD-007 registry close**
POLISH_DEBT.md updated to reflect PD-007 resolved (implementation was already in d6d4a06, registry entry was stale).

---

## Section 3 — Visual elements / capabilities available for Lattica

### Tauri commands (new since last baseline)

| Command | What it does |
|---|---|
| `fossic_list_subscribers` | Returns all live PostCommit subscribers: ID, stream pattern, branch, cursor position, degraded flag. Lattica's tile system can surface this as a "what is being watched" inspector. |
| `fossic_subscription_status` | Returns degraded status + cursor for a single subscriber ID. Useful for health checks. |
| `fossic_read_batch` | Fetches multiple events by CCE ID in one SQL query. Enables causal graph traversal tiles — given a root event, walk causation_id chains in batches rather than N sequential reads. |

### Query capabilities

**`indexed_tags_filter` on `AggregateQuery`** — flat AND exact-match, SQL-pushed. Lattica can aggregate across streams (e.g., all `cerebra/*`) and filter by `{session_id: "abc"}` or `{cycle_id: "xyz"}` without loading every event into fold. Useful for cross-project rollup tiles once hub streams are populated.

**`read_batch`** — multi-event fetch by CCE ID. Pairs with causation_id traversal for reconstructing event lineage in a single render cycle.

**Glob subscriptions without history replay** — Lattica can subscribe to `cerebra/**` on the hub store without replaying all historical Cerebra events. Only new events land after subscription.

### Write capabilities

**`append_if`** — optimistic-concurrency append available to all embedding projects. Enables version guards, idempotency checks, and state-machine transitions. The condition closure sees the live database state inside the transaction.

### Observability — `_fossic/system` stream

The `_fossic/system` stream currently emits one event type:

- **`SubscriptionDegraded`** — fired when a subscriber's handler returns an error and the subscription is marked degraded. Payload includes `subscription_id` and error context. Lattica can subscribe to `_fossic/system` (requires `include_system: true` on the `SubscribeQuery`) to monitor store health and surface degraded subscriptions in a tile.

Note: `_fossic/system` is excluded from glob matches and aggregate queries unless `include_system` is explicitly set. This prevents system noise from leaking into application-level event streams.

### Read performance

The read connection pool means concurrent read operations (multiple tile queries firing simultaneously) no longer queue behind each other or behind the write path. At `read_pool_size: 4` (default), four concurrent reads can run in parallel. LumaWeave's dashboard rendering benefits immediately without any API changes.

---

## Section 4 — Open items / known follow-ups

### Open Tech Debt (all externally triggered)

| ID | Severity | Trigger |
|---|---|---|
| TD-001 | MEDIUM | Python DynReducer bridge cost (~47μs/event over PyO3). Trigger: Cerebra witness layer + measurable user-facing latency. Mitigation: aggressive snapshot cadence (every 10 events). |
| TD-003 | LOW | `time = "=0.3.37"` exact pin in fossic-tauri. Trigger: Tauri bumps cookie version. |
| TD-004 | MEDIUM | `SimilaritySearchProvider` trait stub absent from code (feature flag is a placeholder). Trigger: bons.ai requests vector search. |
| TD-007 | LOW | `take_snapshot` dual-acquisition TOCTOU (read conn released before write conn acquired). Snapshots are idempotent so not a data-loss risk. Trigger: snapshot staleness observed under high concurrent write load. |

### Open Polish Debt

None. All PD items resolved.

### Not-yet-built federation items

From the feasibility analysis:

- **`relay_append` convenience helper** — a method that accepts a source `EventId` and sets both `external_id` and `causation_id` correctly for relay. Not built; the protocol works with raw `Append` fields today.
- **In-process relay subscription** — a `subscribe_to_store(remote: &Store, pattern: &str)` primitive that eliminates a separate relay process when both stores are in the same runtime. Not built; relay agents are out-of-process today.

---

## Section 5 — Cross-project signal

**Read concurrency is now non-blocking.** The pool (Phase 6b) means all projects embedding fossic get concurrent read performance without API changes. Multiple tile queries, subscription dispatches, and aggregate computations run in parallel. Previously they queued behind the write mutex.

**`append_if` unlocks state-machine patterns.** Projects that need to guard appends on current state (version checks, duplicate detection, condition-gated transitions) now have a clean primitive. The condition sees the live transaction — no external locking needed.

**`indexed_tags_filter` is SQL-pushed.** Projects using `aggregate` or planning hub-level cross-stream queries should prefer `indexed_tags` for filterable fields. The filter is now a `WHERE json_extract(...)` clause, not a fold-time filter. For high-cardinality streams (thousands of events), this is a significant throughput difference.

**Glob subscriptions no longer replay history.** Any project that creates glob subscriptions (e.g., Cerebra subscribing to `lattice_nodes/**`) gets correct from-now semantics automatically. No code changes needed; it's in the subscription setup path.

**`compute_event_id` is available in Python.** Cerebra's relay agent can pre-compute the hub-store event_id from (event_type, payload, causation_id) before appending to the hub. This enables round-trip verification: append to hub, read back, confirm event_id matches the pre-computed value.

---

## Section 6 — Pre-federation exploratory thoughts

### The relay agent interface — current best draft

The relay protocol is simple because fossic already has the primitives:

```
subscribe(local_store, "project/**", branch="main")
  → on each event:
      if hub_store.read_by_external_id(event.id.to_hex()) is Some:
          continue  # already relayed, idempotent
      hub_store.append(Append {
          stream_id: format!("project/{}", event.stream_id),  # namespaced
          event_type: event.event_type,
          payload: event.payload,
          causation_id: Some(event.id),     # preserves causal chain
          external_id: Some(event.id.to_hex()),  # idempotency key
          indexed_tags: event.indexed_tags,  # pass through for hub aggregates
          ..Default::default()
      })
```

Key properties:
- **Idempotent**: `external_id` check prevents double-relay on restart
- **Causal**: `causation_id = source_event.id` so hub events trace back to source
- **Filtered**: relay agent decides which event types cross the boundary (not all events should relay — only hub-relevant ones)
- **Namespaced**: `stream_id` is prefixed with the project name on the hub

The `relay_append` helper would encapsulate the `external_id` + `causation_id` pattern. Worth building before the second relay agent (after the first one proves the protocol), not before the first.

### Per-project local store shapes — do they hold up?

The shapes from the feasibility analysis hold. Minor refinements:

**Cerebra** — high snapshot cadence (every 10 events) is correct given TD-001. The relay filter list should be explicit: only `SessionOpened`, `MemoryWriteFromCycle`, `ClutchDecisionMade`, `CycleCompleted` relay to hub. All internal step-level events stay local. This keeps the hub clean.

**rhyzome** — still the most straightforward. Rust-native, no bridge overhead, fast `read_state` for bandit arm selection. Small pool size (2) is appropriate since reads are fast. Relay: `strategy_selected` events only.

**bons.ai** — one addition: `indexed_tags` should carry `{idea_id, query_id, session_id}` on every event. The hub's `indexed_tags_filter` then makes bons.ai queries filterable from Lattica without round-trips into bons.ai's local store.

**LumaWeave** — still the most interesting use of `branch`. Layout experiments (`layouts/experiment-*`) should live on a non-main branch; only promoted layouts relay to hub as `main` events. `append_if` is useful here: "append this node mutation only if the node still exists" is a natural state-machine guard for the graph.

### Recommended order of project migrations

1. **LumaWeave first** — it's already on fossic-tauri (already embedded). The relay is just adding a second store handle (the Lattica hub) and filtering which events forward. No new embedding work. Benefit: Lattica immediately gets an architectural event stream to visualize.

2. **Cerebra second** — fossic-py is already integrated. `compute_event_id` is live. The relay agent is a Python script (~100 lines). Benefit: hub gets the richest event stream; cross-project causal chains become real.

3. **rhyzome third** — simpler event shape, faster to wire. Rust-native, straightforward relay.

4. **bons.ai last** — depends on TD-004 (SimilaritySearchProvider) for its most interesting local capabilities. Can embed fossic now, but the full local store shape isn't final until vector search is unblocked.

### Risks other projects may not see

**Schema migration across store boundaries.** When Cerebra upcasts an event (say, `MemoryWriteFromCycle` v1 → v2), the hub store holds the original v1 bytes (relayed before the upcast existed). The hub has no upcaster for Cerebra's event types — it doesn't know about them. This means: hub consumers of Cerebra events must tolerate schema evolution independently, OR the relay agent must relay the already-upcasted payload. Recommendation: relay agents should relay `stored_event.deserialize_payload_json()` (the decoded payload, which triggers upcasters at read time in the local store) rather than the raw `stored_event.payload` bytes. This pushes upcasting to the local store boundary before relay.

**Snapshot coordination is per-store.** Snapshots on the local store don't transfer to the hub. If Lattica wants to aggregate Cerebra state via the hub, it has to replay all relayed Cerebra events from the beginning — no snapshot seeding from the local store is possible. For Cerebra's lattice nodes (which can have thousands of events), this matters. Mitigation: Lattica should maintain its own reducer+snapshot for hub-visible event types, or limit hub-side aggregation to summary events rather than full state reconstruction.

**Causation chains span stores.** A hub event's `causation_id` points to an event in the local store, not in the hub store. `read_one(causation_id)` on the hub will return `EventNotFound`. This is expected but consumers need to know: causal traversal across the hub/local boundary requires going back to the originating store. `walk_causation` on the hub only walks hub-internal chains.

**Event ordering across projects is wall-clock only.** The hub has no global logical clock. Events from Cerebra and rhyzome are ordered by `timestamp_us` (wall clock at relay time), which may not reflect actual causation order if the relay agents have different latencies. If strict ordering matters for a cross-project workflow, the relay agent should set `causation_id` explicitly to the hub event that triggered it (not just the local source event).

**`read_pool_timeout_ms` should be tuned per project.** The default 30s is conservative. Projects with tight latency requirements (LumaWeave UI rendering, rhyzome bandit selection) should set a shorter timeout with a fast fallback rather than waiting 30s for pool exhaustion.

### The `relay_append` helper — before or after first relay?

**After** the first relay. The raw protocol (`external_id` + `causation_id` + namespaced `stream_id`) is simple enough to wire by hand for the first relay agent. Building `relay_append` before the first relay means designing an abstraction without concrete usage to validate it. Let LumaWeave's relay agent prove the protocol, then extract `relay_append` as a convenience helper when writing the second one (Cerebra). That's when the pattern duplication becomes obvious.

---
