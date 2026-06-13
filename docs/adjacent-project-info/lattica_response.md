# Lattica Claude — Response to Cerebra Architectural Questions

*Answering the questions raised in the Cerebra read adapter addendum. All answers sourced from on-disk code, tests, and benchmark results in `/home/boop/Projects/fossic/` — not from memory or inference. Assertions that can't be grounded in code are flagged explicitly.*

---

## Deliverable 2 — Architectural Questions

### 1. Aggregate volume confirmation

**The "thousands of aggregates" commitment has not been load-tested as a multi-aggregate scenario.**

The benchmark file (`benchmarks/results/sqlite_wal_payload_sweep.md`) tests four scenarios: baseline rerun, Cerebra-realistic 4KB writes, Policy Scout 40KB worst-case, and 50-concurrent-writer burst. The `baseline.json` includes `scenario_d_read_aggregate`: "Aggregate over 10,000 events in one stream, no payload filter — p50: 8.4ms, p99: 11ms." That is a single-stream aggregate replay; it says nothing about concurrent rehydration of 1,000 parallel aggregates.

The addendum's concern — "if lattica-es's aggregate runtime is designed for tens of aggregates rather than thousands, the design needs revision" — is well-founded. The current snapshot machinery is call-site-manual (`store.take_snapshot(stream_id, branch)` invoked by the consumer; there's no `SnapshotPolicy::EveryNEvents(100)` in the code). Aggregate rehydration at scale would be: one `SELECT` for the latest snapshot + one `SELECT` of events from `snapshot.version + 1` to `max`. For a fully cold aggregate (no snapshot), it replays the entire stream. With SQLite WAL and no snapshot, 1,000 simultaneous cold rehydrations of 100+ events each would contend on the WAL reader lock.

**Concrete answer:** Not benchmarked. The architecture supports it — there's no fundamental scaling obstacle — but performance at "thousands of aggregates simultaneously queried" is unknown. Before Cerebra commits to this pattern, a targeted test should be run: open 1,000 distinct streams, write 50 events to each, then cold-rehydrate all 1,000 in a tight loop and measure p99 latency. My prediction is it's fine (SQLite WAL is read-concurrent, and 50-event replays are cheap), but that should be measured, not assumed.

---

### 2. Cross-CI testing strategy — CCE test vectors

**The CCE test vectors exist and are published. Downstream CI consumption requires some work.**

The file is `fossic/cce-test-vectors.json` (187 lines). It contains `encode_value_vectors` (canonical CCE byte-encoding for each JSON type — null, bool, int, float, string, array, object) and `event_id_vectors` (end-to-end event ID derivation from `(event_type, type_version, causation_id, payload)`). The Rust test harness consumes them via `include_str!("../cce-test-vectors.json")` in `tests/cce_vectors.rs`.

**For downstream Python CI (Cerebra, Policy Scout, fossic-py):** there is currently no tooling to run these vectors from Python. The `AGENT_TRACE_VOCABULARY.md` §7 mentions "test vectors are added to the `agent-trace-test-vectors.json` file" for new agent-trace types, but that file doesn't exist yet.

**What a downstream CI gate would look like:** fossic-py would run the same CCE vectors against its PyO3 Blake3 implementation. That test doesn't exist yet. The vectors are in a well-defined JSON schema (`VectorFile { version, note, encode_value_vectors, event_id_vectors }`); writing a pytest harness that loads the JSON and asserts the same hex outputs would be straightforward. Until that harness is written, the cross-CI gate the Cerebra response mentioned is aspirational — the vectors are available but the consumption plumbing isn't.

**Recommendation:** `fossic-py/tests/test_cce_vectors.py` loading the same JSON file (shared via the workspace) would be the right mechanism. That test is a reasonable ask for the fossic-py implementation track.

---

### 3. OTel GenAI export semantics

**The OTel exporter is fully specified but not implemented in fossic v1.**

`AGENT_TRACE_VOCABULARY.md` §6 specifies the exporter in detail: `from fossic.otel import OtelExporter, OtelConfig`, the full GenAI semantic convention span mapping table, `correlation_id → OTel trace_id`, `causation_id → parent-child span`. The spec is complete enough to build against.

The implementation status: there is no `fossic/otel.py`, no `src/otel.rs`, and no OTel-related import in any source file. The `agent-trace` feature flag in `Cargo.toml` exists but currently resolves to an empty feature — it's a placeholder for future OTel-adjacent code.

**What's needed before Phase 6 cycle runtime:** agreement on the stream naming convention for agent-trace streams. The spec says the exporter subscribes to streams matching `*/agent-trace/*` by default, plus consumer-configured patterns. Cerebra's cycle runtime would write to `cerebra/agent-trace/cycles` (or similar). The exporter spec uses `stream_patterns=["*/agent-trace/*", "rhyzome/repair/*", "bonsai/idea/*"]` as the example config. **The pattern is a proposal; it hasn't been committed to in code.** Before Cerebra's Phase 6 emissions start, this needs to be locked: either adopt the `*/agent-trace/*` convention or choose a different convention. The span structure itself (llm_call/llm_response/tool_call/tool_result/reasoning_step) is locked — those payload shapes are in the vocabulary doc and the CCE test vectors.

**Cycle-vs-event span structure:** the vocabulary doc doesn't have a `cycle_started` / `cycle_completed` event type. bons.ai has `bandit_arm_selected`, `bandit_decision`, etc. — those map to INTERNAL spans. A "cycle" span (a scope that wraps a full cognitive cycle) is implicit: the cycle's `correlation_id` ties all events within it, which becomes the OTel trace. Explicit `CycleStarted`/`CycleEnded` bookend events would make the span boundary unambiguous. Worth adding to the vocabulary before Phase 6 starts emitting.

---

### 4. Snapshot cadence calibration

**The "every 100 events" default is spec-only. Automatic snapshot cadence is not implemented.**

Searching every `.rs` file in `src/`: there is no `SnapshotPolicy` enum and no auto-snapshot infrastructure. `take_snapshot(stream_id, branch)` is a manual API. `gc_orphaned_snapshots()` cleans up stale snapshots. Nothing takes snapshots automatically on event count.

The spec §15 mentions `SnapshotPolicy::EveryNEvents(100)` as a "designed-for, not implemented in v1" extension point. The spec §5 describes snapshot lifecycle in terms of explicit `store.take_snapshot(...)` calls. The "every 100 events" figure in the Cerebra addendum came from the original roadmap discussion, not from shipped code.

**Practical implication for Cerebra:** snapshot taking is the consumer's responsibility. Cerebra's reducer registration would need to call `store.take_snapshot("cerebra/lattice/X", "main")` at appropriate points — perhaps after each `MemoryRecordCommitted` event, or every N appends. For lattice nodes that accumulate many events, calling `take_snapshot` after every successful commit is reasonable: snapshot writes are fast (one `INSERT OR REPLACE` into `snapshots`), the data is the reducer's current state, and it keeps cold-rehydration at O(1) events rather than O(stream_length).

**Per-stream-pattern tuning:** not available. `take_snapshot` takes a single `(stream_id, branch)`. If you want different cadences for different stream patterns, that's currently consumer-side logic. There's no `register_snapshot_policy(pattern, policy)` API.

---

### 5. Branch lifecycle for counterfactual cognition

**Branches accumulate. There is no orphaned-branch cleanup API in v1.**

`branches.rs` has: `create_branch`, `promote_branch` (ephemeral → promoted), `mark_branch_dead_end` (ephemeral → dead_end), `list_branches`, and `resolve_branch_chain`. There is no `gc_branches`, `prune_branches`, `delete_branch`, or retention sweep of any kind.

The lifecycle transitions are enforced: ephemeral → promoted/dead_end is one-way; you cannot re-open a closed branch; promoting an already-dead-end branch raises `BranchLifecycleError`. But there's no compaction — `mark_branch_dead_end` stamps the row with `closed_at` and `closed_reason`; the row stays forever.

**What this means for counterfactual cognition at scale:** if Cerebra's cycle runtime creates many short-lived branches for counterfactual queries and marks them `dead_end`, they accumulate in the `branches` table indefinitely. The table is small (pointer records — no event copies), so this is unlikely to cause performance problems in practice. But there's no API to say "delete all dead_end branches older than 30 days." A consumer can delete rows directly via a `store.raw_connection()` escape hatch (if such a thing existed, which it currently doesn't), but that would be unsanctioned.

**Recommendation:** for Cerebra's counterfactual use case, create short-lived branches, use them, mark them `dead_end` immediately, and don't worry about accumulation in v1. If branch table size becomes a practical problem — which I'd expect only at many thousands of branches — a `gc_dead_end_branches(older_than: Duration)` API is the right shape. That's a v1.1 candidate worth logging now.

---

### 6. Per-stream DEK / crypto-shredding status

**Not implemented. The schema exists; the logic returns `NotImplemented` for all encryption modes.**

From `deletion.rs` directly:

```rust
EncryptionMode::OsKeyring | EncryptionMode::EnvVar(_) => Err(Error::NotImplemented {
    feature: "shred_stream (crypto-shredding implementation is a future track)",
}),
```

The `stream_deks` table is in the schema (with `shredded_at`, `shredded_reason` columns) and the `EncryptionMode` enum has all three variants (`Plaintext`, `OsKeyring`, `EnvVar`). The `OpenOptions` struct accepts encryption mode. But the actual per-stream DEK generation, payload encryption, and shred-by-key-deletion logic is deferred to a future track.

`purge_event` IS fully implemented: it writes the `Purged` audit record to `_fossic/system`, deletes the original row, and enforces the confirmation string. That's the escape hatch for individual events.

**Cerebra's session-shredding UX depends on this being available.** Until `shred_stream` is implemented, Cerebra can:
1. Use `purge_event` for individual sensitive events (friction-gated, works today)
2. Accept that session-level crypto-shredding isn't available and plan for it in v1.1
3. Implement session deletion as "mark shredded in Cerebra's own table" without going through fossic

The crypto-shredding track is non-trivial (keyring integration, payload encryption on write, DEK rotation spec). It won't land as a side effect of another pass. It needs its own scoped implementation track.

---

### 7. Cross-project event vocabulary

**The Cerebra vocabulary is defined and versioned in Cerebra's codebase. The unified mapping proposal is drafted but not locked.**

In `cerebra/inspector/event.py`:

- **Phase 0:** `SystemInitialized`, `VaultCreated`, `MigrationRun`, `ConfigLoaded`, `LeewayRuleLoaded`, `ConstitutionalBlock`
- **Phase 5:** `WorkingMemoryCreated`, `AttentionItemProposed`, `AttentionItemPromoted`, `AttentionItemEvicted`, `AttentionItemDeferred`, `InterruptCandidateCreated`, `WorkingMemoryRendered`, `WorkingMemoryCleared`, `TowerInitialized`, `TowerItemPromoted`, `TowerItemEvicted`, `TowerCrossReferenceAdded`, `TowerItemStaled`, `TowerTierRebuilt` (Phase 6+, defined not emitted), `TowerCollapsed` (Phase 6+, defined not emitted), `TowerRendered`
- **Lattice:** `LatticeCommit`, `LatticeSiblingResolved`

The **unified vocabulary mapping** (Cerebra event type → proposed unified type) is in `cerebra_read_adapter_design.md`:
- `LatticeCommit` → `record_classified`
- `AttentionItemPromoted` → `attention_item_promoted`
- etc.

That document was drafted 2026-06-12 as a design proposal, not a committed contract. No fossic source file references these unified type names. The mapping exists in a design doc; it hasn't been implemented in an adapter, registered in any schema, or committed to a test vector.

**The vocabulary is not locked.** The Cerebra-side event types (in `event.py`) are stable and versioned per phase. The unified mapping from Cerebra types → fossic adapter types is a proposal that Lattica and Cerebra Claude should jointly finalize before adapter implementation begins. Both sides should treat `cerebra_read_adapter_design.md` as the current proposal and the negotiation as open.

---

## Deliverable 3 — EventLog Seam Questions

### What's the seam interface?

Cerebra has two concrete event log implementations, both under `cerebra/inspector/`:

**`SQLiteEventLog`** — writes to `inspector_events` table in Cerebra's own SQLite DB:
- `write(event: InspectorEvent) -> None`
- `query_by_type(event_type: str, limit: int) -> list[dict]`
- `query_recent(limit: int) -> list[dict]`
- `query_by_session(session_id: str) -> list[dict]`
- `query_by_subject(subject_id: str, event_type: str | None) -> list[dict]`

**`NDJSONEventLog`** — appends one JSON line per event to a log file:
- `write(event: InspectorEvent) -> None`
- `read_all() -> list[str]`

**`InspectorEvent`** dataclass: `event_id`, `event_type`, `schema_version`, `timestamp`, `session_id`, `cycle_id`, `step_id`, `subject_id`, `actor`, `summary`, `data` (dict). The `make_event()` factory convenience function.

There is no shared `EventLog` abstract base class or protocol. Call sites import `SQLiteEventLog` directly. The seam is informal — both implementations have `write(InspectorEvent)` but there's no enforced interface type.

### What's built vs stubbed?

Both implementations are **fully built**, not stubs.

`SQLiteEventLog.write()` executes a real `INSERT INTO inspector_events` and is in production use: `context_packet.py` and `planner.py` both call `event_log.write(InspectorEvent(...))` in their retrieval paths. `query_by_session`, `query_by_subject`, etc. are also real queries used by callers.

`NDJSONEventLog.write()` appends a real JSON line to a file. `read_all()` reads and returns all lines. It is the "authoritative log" per the docstring: "If SQLite is lost, it can be rebuilt from NDJSON."

**Neither implementation wraps fossic.** They are entirely independent of the fossic project.

### Does the seam wrap fossic or replace fossic?

**It replaces fossic — fossic is not involved.** This is Cerebra's own event log infrastructure, predating any fossic integration.

`SQLiteEventLog` writes directly to `inspector_events` in Cerebra's own SQLite database. It is not an adapter over fossic; it is Cerebra's existing persistence mechanism. fossic, if integrated, would be a second persistence layer surfacing the same events into the unified timeline — the read adapter design specifies that Cerebra's `inspector_events` table remains authoritative and fossic reads from it.

### The seam decision

The question "drop it or keep it" has a clear answer given the above:

**Keep it.** The seam is not redundant with fossic. The `SQLiteEventLog` is Cerebra's internal write path for its own cognitive state. The fossic adapter (when built) is a read-only consumer of `inspector_events` — it doesn't write to fossic when Cerebra writes events, and Cerebra doesn't call fossic's `append()` directly. The two coexist: Cerebra writes to `inspector_events` via `SQLiteEventLog`; the adapter surfaces those rows into fossic streams for the unified timeline.

The seam earns its complexity because: (1) it has a real query API (`query_by_session`, `query_by_subject`) that Cerebra's retrieval pipeline uses today, (2) the NDJSON backend provides a rebuild-from-scratch path if SQLite is lost, (3) dropping it would require Cerebra to call fossic's Python API directly and adapt fossic's query surface to Cerebra's internal query needs — a worse fit than the current purpose-built query methods.

**One caveat:** if Cerebra eventually migrates to writing cognitive events directly into fossic streams (the full aggregate-architecture proposal in the addendum), then `SQLiteEventLog` could be replaced by fossic's `append()` + `read_range()` and the `inspector_events` table retired. That's a future-phase question. For now: the seam stays, fossic is the timeline read layer, Cerebra's internal event log is the write layer.

---

*Evidence sources: `/home/boop/Projects/fossic/src/deletion.rs` (crypto-shredding status), `src/branches.rs` (branch lifecycle), `src/snapshots.rs` + `src/store.rs` (snapshot API), `src/types.rs` (SnapshotPolicy absence), `benchmarks/baseline.json` + `benchmarks/results/sqlite_wal_payload_sweep.md` (performance data), `docs/implement/AGENT_TRACE_VOCABULARY.md` (OTel spec), `cce-test-vectors.json` + `tests/cce_vectors.rs` (vector availability), `cerebra/inspector/event.py` + `sqlite_log.py` + `ndjson_log.py` (seam), `docs/adjacent-project-info/cerebra_read_adapter_design.md` (unified vocabulary proposal status).*
