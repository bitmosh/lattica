# Advocate Profiles — Internal Fossic Implementation

Per-project interview responses on what an internal fossic/ES implementation
would look like from each project's perspective.

---

## lattica_response

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

**What's needed before Phase 6 cycle runtime:** agreement on the stream naming convention for agent-trace streams. The spec says the exporter subscribes to streams matching `*/agent-trace/*` by default, plus consumer-configured patterns. Cerebra's cycle runtime would write to `cerebra/agent-trace/cycles` (or similar). The exporter spec uses `stream_patterns=["*/agent-trace/*", "cerebra/*", "policy-scout/*"]` as the example config. **The pattern is a proposal; it hasn't been committed to in code.** Before Cerebra's Phase 6 emissions start, this needs to be locked: either adopt the `*/agent-trace/*` convention or choose a different convention. The span structure itself (llm_call/llm_response/tool_call/tool_result/reasoning_step) is locked — those payload shapes are in the vocabulary doc and the CCE test vectors.

**Cycle-vs-event span structure:** the vocabulary doc doesn't have a `cycle_started` / `cycle_completed` event type. A "cycle" span (a scope that wraps a full cognitive cycle) is implicit: the cycle's `correlation_id` ties all events within it, which becomes the OTel trace. Explicit `CycleStarted`/`CycleEnded` bookend events would make the span boundary unambiguous. Worth adding to the vocabulary before Phase 6 starts emitting.

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

---

## cerebra_extract

# ES Consumer Profile — Cerebra

You are the Cerebra advocate. We're building **ES**, a local-first
event sourcing library: Rust core, PyO3/napi-rs bindings, SQLite-backed,
content-addressed events, branchable history, pure synchronous reducers.
It's being extracted from Lattica's Phase 6 plans because Cerebra and
several other projects also want event sourcing capabilities.

Before we lock the v1 API, we need Cerebra's actual shape. Answers below
are grounded in the current codebase at `/home/boop/Projects/cerebra`
(v0.2.8, Phase 5 complete).

---

## Cerebra

### Language and runtime

**1. Primary language(s)?**
Python 3.12+. Strict mypy, ruff + black lint, pytest. Packaged with `uv` /
setuptools. Entry point: `cerebra` CLI via Click.

**2. In-process embedded library, long-running daemon, CLI tool, or hybrid?**
Hybrid: CLI tool for user-facing commands plus an in-process library used
internally during cognitive cycle execution. Inspector events are emitted
in-process as side effects of cognition actions — not sent to a daemon.
No server process runs between CLI invocations.

**3. Multi-process? Multi-thread? Async runtime?**
Single-process, single-thread, fully synchronous. No asyncio, no threading.
The codebase has zero async patterns. This is a deliberate constraint —
cognitive cycle execution is intended to be sequential and inspectable.

---

### What you want from ES

**4. The three top things you want from event sourcing:**

1. **Immutable cognitive action audit trail.** Every cognitive cycle action
   must emit a structured event that survives the process lifetime. Today
   this is a custom NDJSON + SQLite dual layer (see Q22). ES would replace
   both. The core invariant: if SQLite is lost, events can be replayed to
   rebuild queryable state.

2. **Agent trace export to LumaWeave.** The inspector event stream is
   Cerebra's integration contract with LumaWeave. LumaWeave reads events
   and renders them as typed graph nodes and edges. Events need to be
   queryable by session, by subject (memory record ID), and by time range.
   ES's structured log is the ideal substrate for this.

3. **Cross-correlation queries by session and subject.** The inspector CLI
   needs "all events in session X" and "all events touching memory record Y."
   Today these are `query_by_session` and `query_by_subject` on the SQLite
   log (`cerebra/inspector/sqlite_log.py:67–94`). These are the read
   patterns we'd expect ES to satisfy natively.

**5. Anything you DON'T need or actively don't want?**

- **Branches:** Not needed for v0.1. Could be useful later for running
  two cycle configurations against the same memory state (cognitive
  counterfactuals), but not blocking and shouldn't complicate the minimal
  integration path.
- **OTel export:** Don't need it. Not in scope.
- **Cross-process pub/sub / real-time subscriptions:** Not needed. Cerebra
  is single-process; polling is fine. Real-time delivery latency is
  irrelevant.
- **Distributed / multi-tenant anything:** Local-first, single-user. Hard
  no on anything that requires a network or multi-tenant auth layer.

---

### Scale and shape of writes

**6. Estimated write rate at steady state?**
Very low. A developer runs a cognitive cycle manually via CLI. Estimate:
10–100 events per cycle invocation, a few invocations per hour at most.
Steady-state is effectively 0 events/sec between runs. Peak burst is
~20 events/sec during a busy cycle step. This is not a high-throughput
workload.

**7. Burst profile?**
Tight clusters during cycle execution, followed by long idle periods.
The pattern is: `cerebra run-cycle` fires a burst of events over a few
seconds, then nothing until the next invocation.

**8. Typical payload size? Maximum? Any payloads >64KB?**
Typical: 100–500 bytes (a few structured fields plus a short summary).
Maximum: ~2–4KB for payloads that include chunk content excerpts or
retrieval trace summaries. Almost certainly never >64KB — nothing in the
event schema carries raw embeddings or document blobs.

**9. Number of distinct streams? Events per stream per day?**
Probably one stream per vault session. A developer might have 2–5 active
sessions in a working day. Events per stream: 50–500 for a typical session.
May also want a vault-global stream for system lifecycle events
(`VaultCreated`, `MigrationRun`) that belong to no session.

**10. Single writer per stream, or concurrent writers?**
Single writer. Single-process, single-user CLI. No concurrency concern.

---

### Reads

**11. Read patterns?**
All of the following are used today:
- Linear replay from beginning (debug a full session)
- Tail-the-latest (live `cerebra memory status` rendering)
- Time-range queries (inspector CLI — "what happened in the last hour")
- Random access by event_id (specific event lookup)
- Filtered by `session_id` (all events in a session, ordered by timestamp)
- Filtered by `subject_id` (all events touching a specific memory record)

**12. Live subscriptions, or polling acceptable?**
Polling is fine. No real-time delivery requirement in v0.1 or the foreseeable
future. The CLI inspector rerenders on demand, not on push.

**13. Cross-stream queries needed?**
Yes — by correlation field, not by scanning all streams. Specifically:
`session_id` as a cross-stream correlation key ("all events belonging to
session sess_xyz, regardless of which stream they landed in"). `subject_id`
as a secondary correlation key ("all events touching memory record M3_abc").
These are the two query patterns currently implemented in
`cerebra/inspector/sqlite_log.py`.

---

### Persistence and lifecycle

**14. How long do events need to live?**
Forever, ideally. The cognitive history IS the memory — being able to
replay why a memory record was created or promoted is a first-class
feature, not a nice-to-have. Configurable retention for large vaults
would be acceptable, but the default should be indefinite.

**15. Any need to delete individual events?**
No hard requirement for v0.1. Might want session-level tombstoning later
("forget everything from this session"), but not individual event deletion.
No PII concern by design — local-first, single-user, user's own content.

**16. Acceptable storage growth?**
"We'll cross that bridge later." Single-user local workstation; at the
write rates described above this won't be a problem for years. No bounded
retention policy needed now.

**17. Backup/restore expectations?**
Copy-the-SQLite-file is fine for v0.1. No streaming backup, no
point-in-time recovery, no replication. The NDJSON log already serves as
the human-readable backup; ES's append-only log would take that role.

---

### Security and deployment

**18. Sensitive data in event payloads?**
Potentially yes. Event payloads can contain document content excerpts,
memory record text, and user queries. This is the user's own local
content (their codebase, docs, notes), not cross-user data. No secrets
or credentials are expected in the event stream by design.

**19. Encryption at rest required?**
Not required for v0.1. Configurable encryption would be a welcome future
option (let the OS keyring manage the key), but blocking on it would delay
adoption unnecessarily.

**20. Single-user local-first, or multi-user/multi-tenant?**
Single-user, local-first. Hard constraint, not a roadmap item to revisit.

**21. Deployment target?**
Developer workstation only, in v0.1. Linux-first (current dev environment),
with Mac as a secondary target when Lattica desktop ships.

---

### Existing event/log infrastructure

**22. Does Cerebra already have an event store?**
Yes — a custom dual-layer setup built in Phase 0:

- **NDJSON append-only log** at `<vault>/events/events.ndjson` — the
  authoritative record. One JSON object per line. Written by
  `cerebra/inspector/ndjson_log.py`.
- **SQLite `inspector_events` table** — the queryable index. Written by
  `cerebra/inspector/sqlite_log.py`. Designed to be rebuildable from the
  NDJSON if lost.

Current event envelope schema:
```
event_id        TEXT  — "evt_<12-hex-uuid>"
event_type      TEXT  — controlled vocabulary (see event.py)
schema_version  INT   — currently always 1
timestamp       INT   — unix epoch seconds
session_id      TEXT  — nullable; null in Phase 0 events
cycle_id        TEXT  — nullable
step_id         TEXT  — nullable
subject_id      TEXT  — nullable; the resource this event touches
actor           TEXT  — e.g. "cycle_runtime"
summary         TEXT  — human-readable one-liner
data_json       TEXT  — JSON blob for event-specific payload
```

The intent was always to replace this with ES when it existed. Prefer
**full migration** (stop maintaining the custom layer) over bridging.

**23. If migrating: how many existing events would need translation?**
Very few — early development, probably a few hundred to a few thousand
events total across all test vaults. Migration cost is negligible.

---

### Integration shape

**24. How would you want to call ES?**
In-process Python API via PyO3 bindings. The cognition module calls
`emit_event()` (or equivalent) synchronously as a side effect of cognitive
actions — no IPC, no file-watching. The call must not block cycle execution;
a fire-and-forget synchronous append is the right model.

**25. Anything in the codebase that would make integration awkward?**
One significant friction point: **packaging a PyO3 extension alongside a
pure-Python `uv`-managed project.** Today `uv sync --extra dev` is the
entire setup. Adding a Rust extension means requiring a Rust toolchain at
build time (or maintaining pre-built wheels per platform). This is the
biggest adoption risk. Pre-built wheels for Linux x86_64 and macOS arm64
would close most of the gap.

No async patterns to worry about. No custom serializers that would conflict.
The existing `event_id` scheme (`evt_<uuid>`) would need to align with or
alias ES's content-addressed IDs — whether ES keeps a user-supplied ID
field alongside the blake3 hash matters for backward compatibility with
any stored events.

---

### Open questions and concerns

**26. What would make you NOT adopt ES?**
- If `uv sync` stops working for a developer who doesn't have Rust installed
  and there are no pre-built wheels available for their platform.
- If the API requires async (non-negotiable for Cerebra — the cognitive
  runtime is synchronous by design and that won't change).
- If schema evolution is rigid — Cerebra needs `schema_version` as a
  first-class field and must be able to add new event types without
  touching the ES library.
- If the minimal path (append + a few query patterns) pulls in the full
  branching/snapshot machinery as non-optional overhead.

**27. Anything in the ES design you'd push back on?**
- **Pure synchronous reducers** is a perfect fit. No pushback there.
- **Branchable history** is a nice-to-have for Cerebra (run two cycle
  configs against the same memory state, compare outcomes), but it should
  be opt-in — not something the simple append path has to reason about.
- **Content-addressed event IDs (blake3):** Cerebra currently uses
  `evt_<uuid>` IDs that are referenced in downstream code and test
  assertions. ES should either preserve a user-supplied ID field alongside
  the content hash, or provide a stable deterministic ID that doesn't
  change between writes.

---

## Additional Notes

The following context doesn't fit the ES consumer profile questions but
may be relevant for ES design and integration planning.

### Cerebra's role in the Lattica organism

Cerebra is the **hippocampus** — it remembers, attends, evaluates,
consolidates, and decides what cognitive process should happen next. It is
not the visualization layer (LumaWeave), not the governance daemon (Policy
Scout), not the inference layer (ai-stack). Its event stream is the primary
integration surface with LumaWeave: events become graph nodes and edges in
the reflective twin.

### Current implementation status (Phase 5 complete, v0.2.8)

Implemented modules: CLI, cognition (SKU addressing, truth tower, working
memory, Phase Lattice), governance (constitutional + leeway loaders),
inspector (event envelope, SQLite + NDJSON logs), memory records, retrieval
(ContextPacket, hybrid planner, salience scorer, lattice dedup), ingest
(markdown/text adapters, chunking, normalization pipeline), sources
(registry, hashing, discovery, detection), storage (SQLite store,
embeddings, graph store, lexical index, migration framework), vault init.

Phase 6 (cognitive extensions) is in design. ES adoption would ideally
land before or during Phase 6 so new phase events are emitted natively
through ES rather than the custom layer.

### Event vocabulary (controlled, versioned per phase)

Phase 0 types: `SystemInitialized`, `VaultCreated`, `MigrationRun`,
`ConfigLoaded`, `LeewayRuleLoaded`, `ConstitutionalBlock`.

Phase 5 types: `WorkingMemoryCreated`, `AttentionItemProposed/Promoted/
Evicted/Deferred`, `InterruptCandidateCreated`, `WorkingMemoryRendered/
Cleared`, `TowerInitialized`, `TowerItemPromoted/Evicted/CrossReferenceAdded/
Staled/Rendered`, `TowerTierRebuilt` (Phase 6+), `TowerCollapsed` (Phase 6+).

Lattice types: `LatticeCommit`, `LatticeSiblingResolved`.

New event types are added per phase in `cerebra/inspector/event.py`. ES
must not require recompiling or reconfiguring the library to register new
event type strings.

### LumaWeave rendering boundary

Cerebra ships: event emission infrastructure, structured event log, CLI
text rendering, query API. LumaWeave handles: visual graph rendering,
cross-session exploration, time-scrubber views. The rule is **Cerebra is
independently inspectable without LumaWeave** — the CLI inspector is the
floor. ES should support this: the CLI must be able to query and render
events without LumaWeave being present.

### Vault directory layout

```
<vault>/
  config.yaml
  data/cerebra.db         ← SQLite (all structured data incl. inspector_events)
  events/events.ndjson    ← append-only event log (authoritative)
  artifacts/
  indexes/
  exports/                ← graph export JSON for LumaWeave
  leeway/                 ← leeway rule YAML
  constitutional/         ← constitutional rule YAML
```

ES would take ownership of both `data/cerebra.db` (inspector_events table)
and `events/events.ndjson`, or consolidate them into a single ES-managed
store. The vault config (`config.yaml`) already handles vault path
resolution via a priority chain: `--vault` flag → `CEREBRA_VAULT` env →
`.cerebra/` ancestor search.

### Tech stack summary

Python 3.12+, SQLite, sentence-transformers (embeddings), Pydantic v2,
Click (CLI), uv (packaging). No cloud APIs. No async. Coverage ≥ 80%
enforced. Pre-commit hooks (ruff, black, mypy strict) gate every commit.

---

## lumaweave_extract

# ES Consumer Profile — LumaWeave

You are the LumaWeave advocate. We're building **ES**, a local-first
event sourcing library: Rust core, PyO3/napi-rs bindings, SQLite-backed,
content-addressed events, branchable history, pure synchronous reducers.
It's being extracted from Lattica's Phase 6 plans because LumaWeave and
several other projects also want event sourcing capabilities.

Before we lock the v1 API, we need LumaWeave's actual shape. Answers
below reflect the codebase as of v0.19.0 (arc v113 open, 2026-06-11).
Files cited are under `/home/boop/Projects/lumaweave/`.

---

## Language and runtime

**1. Primary language(s)?**
TypeScript (React 19, runs in Tauri's Chromium webview) + Rust (Tauri 2
backend). Node 22 for tooling. No Python anywhere in LumaWeave.

**2. In-process embedded library, long-running daemon, CLI tool, or hybrid?**
Hybrid. The TypeScript frontend is in-process via napi-rs bindings. The
Rust Tauri backend would call the crate directly (no IPC hop). The
frontend talks to the backend via Tauri's IPC channel; ES calls that
originate in TypeScript would go through a thin `tauri-invoke.ts` wrapper
(`src/lib/tauri-invoke.ts`) unless napi-rs puts the binding in the webview
process directly — clarification needed on which model ES targets for
Tauri webviews.

**3. Multi-process? Multi-thread? Async runtime in use?**
Tauri is multi-process: one Rust process (Tokio async runtime) + one
Chromium webview process. The webview JS context is single-threaded.
The Rust backend uses `tokio` (already in `Cargo.toml` with `rt` and
`time` features, added in v108). No multi-user, no multi-tenant.

---

## What you want from ES

**4. The three top things you want from ES:**

- **Semantic diff events for the Reflective Twin diff layer.** LumaWeave
  is the rendering surface for Graph A vs Graph B. The diff layer between
  them is a stream of semantic events (`Agent investigating`, `Repair
  pending`, `Consensus reached`). LumaWeave needs to subscribe to that
  stream and translate events into visual graph transitions in real time.
  This is the primary use case — not producing events, but consuming and
  rendering them.

- **Agent trace replay for the time-travel viewer.** When a Claude Code
  session or code repair run completes, LumaWeave should be able to
  scrub backward through the event log and re-render the graph state at
  any point. This requires ordered replay from a checkpoint, not just
  tail-the-latest.

- **Cross-stream correlation traversal.** Lighting up a subgraph
  associated with a causal chain (one user action triggering events
  across Cerebra, Policy Scout, and the graph layer). LumaWeave needs
  `correlation_id` lookup across streams to know which nodes to highlight.

**5. Anything you DON'T need or actively don't want?**

- **Branching for LumaWeave's own settings state.** The Zustand settings
  store (`src/control-plane/settings/settings.store.ts`, schema v95, 90+
  migrations) will NOT be migrated to ES. It stores current state only,
  and its migration chain is load-bearing for the existing app. ES is
  additive.
- **PII compliance / event deletion.** LumaWeave's graph data is file
  paths, node types, and edge relationships — no PII, no credentials.
  Append-only is fine.
- **Encryption at rest for v1.** Single developer workstation, no
  sensitive payload content.
- **Multi-user / multi-tenant** — completely out of scope.

---

## Scale and shape of writes

**6. Estimated write rate at steady state?**
Very low — LumaWeave is primarily a visualization consumer, not a heavy
producer. At idle: near zero. During an active agent run: estimate
10–50 events/sec burst, then silence.

**7. Burst profile?**
Tight clusters. When Claude Code fires a tool call sequence, many events
arrive quickly. Between agent runs, nothing for minutes or hours.

**8. Typical payload size? Maximum?**
Small. Agent trace steps: a few KB. Graph diff events: a few hundred
bytes to ~2 KB. No LumaWeave-originated payload expected to exceed 64 KB.

**9. Number of distinct streams? Events per stream per day?**
A handful active at any time: one per agent run, one per source adapter
load session, one for graph state transitions, one for UI-level
interactions worth recording. Estimate 5–10 concurrent active streams;
most streams quiescent. Events per stream per day: highly variable —
zero on idle days, hundreds during an active coding session.

**10. Single writer per stream, or concurrent writers?**
Single writer. Tauri's architecture means one Rust process owns the
backend. No concurrent writers from LumaWeave's side.

---

## Reads

**11. Read patterns?**
Three patterns all needed:
- **Tail-the-latest** — Graph B (live state) subscribes to new events as
  they arrive; this is the primary real-time display path.
- **Replay from a checkpoint** — time-travel viewer scrubs back to a
  specific version and re-derives graph state forward.
- **Random access by event ID / correlation_id** — clicking a node in
  the graph queries which events are causally associated with it.

**12. Live subscriptions — real-time or polling acceptable?**
Real-time required for Graph B. The visual layer needs to feel live;
lagged delivery would break the "watching the system think" experience.
Acceptable latency for a graph node to light up after the event is
recorded: <100 ms. Tauri's IPC event channel is already used for similar
real-time updates (`refreshToken` increment pattern in
`useGraphSourceSummary` — `src/source-adapter/sourceAdapterRegistry.ts`).
ES can follow the same model: Tauri command writes → emits a typed IPC
event to the frontend → Zustand slice updates → Sigma re-renders.

**13. Cross-stream queries needed?**
Yes. `correlation_id` traversal across streams is the mechanism for
subgraph highlighting. Example: a user triggers a source adapter reload
(stream A), which causes a Cerebra retrieval (stream B), which triggers a
Policy Scout check (stream C). LumaWeave needs to find all three from the
single originating event's `correlation_id` to draw the causal subgraph
overlay.

---

## Persistence and lifecycle

**14. How long do events need to live?**
Forever, or at least until the developer explicitly archives. The
Reflective Twin invariant requires Graph A to be reproducible from the
event log at any time. Lossy retention breaks that invariant structurally.
For non-canonical streams (e.g. debug traces), configurable retention
would be a nice-to-have but not required for v1.

**15. Any need to delete individual events?**
No. No PII, no compliance driver. Append-only is the right model for
LumaWeave.

**16. Acceptable storage growth?**
Developer workstation; the developer manages disk. No programmatic bound
required for v1. If retention policy is added later, it should be
opt-in per stream.

**17. Backup/restore expectations?**
Just-the-SQLite-file is fine. Same approach LumaWeave already uses for
Tauri's app data directory — developer copies the directory to back up.

---

## Security and deployment

**18. Sensitive data in event payloads?**
No. Graph data is file paths, node types, edge relationships, agent
reasoning steps. No credentials. Source adapter configs contain file
paths but those don't flow into event payloads.

**19. Encryption at rest required?**
Not required for v1. Single-user developer workstation.

**20. Single-user local-first, or multi-user / multi-tenant?**
Completely single-user local-first. No remote sync in scope.

**21. Deployment target?**
Developer workstation only. No server, no container, no edge device.

---

## Existing event/log infrastructure

**22. Existing event store, audit log, or similar?**
None. The `agents.inference` chat history (`AgentChatTile` introduced in
v112) is held in React component state — transient, not persisted. The
Zustand settings store uses versioned migrations (v95, 90+ entries in
`src/control-plane/settings/settings.migrations.ts`) but stores only
current state, not event history. ES is additive; no bridge or migration
required.

**23. If migrating — how many existing events to translate?**
Zero. No prior event store exists.

---

## Integration shape

**24. How would you want to call ES?**
Primary path: in-process Rust (Tauri backend calls the `lattica-es` crate
directly when handling a Tauri command). Secondary path: napi-rs binding
in the TypeScript frontend for subscriptions and queries that don't need
to go through the Rust backend. The Tauri IPC channel then carries typed
events to the React layer (`useEffect` keyed to an IPC listener →
Zustand update → re-render). File-watching bridge not needed — LumaWeave
is not config-file-driven the way Policy Scout is.

**25. Anything in the codebase that would make integration awkward?**

- **`__lwTauriMock` shim** (`src/lib/tauri-invoke.ts`) — Playwright tests
  intercept Tauri invocations via this shim (gated on `DEV || PLAYWRIGHT`).
  Any ES-backed Tauri command needs a mock entry here or it throws in the
  test suite.
- **Zustand settings store is NOT a candidate for migration.** Its 90+
  migration chain is load-bearing for existing installed builds; touching
  it for ES is out of scope.
- **`transport: "live"` slot in `sourceAdapterRegistry`**
  (`src/source-adapter/sourceAdapterRegistry.ts`) — this declared slot is
  how live data sources (Policy Scout JSONL, etc.) will push into the
  graph. ES event delivery and this slot should compose, not compete; the
  integration design should clarify which layer owns delivery to the
  `useGraphSourceSummary` effect.
- **Playwright test discipline** — new Tauri commands need corresponding
  `__lwTauriMock` entries and `controlSurfaceContractRegistry` entries
  (`src/control-plane/contracts/controlSurfaceContract.registry.ts`) if
  they add user-facing UI. This is not optional; it's enforced by the QA
  registry contract tests.

---

## Open questions and concerns

**26. What would make you NOT adopt ES?**

The biggest risk is startup overhead. Tauri webview cold start is already
a known CI pain point (E2E in CI deferred precisely because Vite + Tauri
startup is too slow for GitHub Actions' runner tier). If the napi-rs
binding has a non-trivial initialization cost — spinning up a Tokio
runtime, opening and checking the SQLite WAL, running schema migrations —
it compounds an existing problem. The question is: does `@lattica/es`
expose a `connect()` that blocks until ready, and can it share the Tokio
runtime already owned by the Tauri process rather than creating a second
one?

A long-running separate daemon (not in-process) would also be a
non-starter — one Rust process per Tauri app is the supported model.

**27. Anything in the ES design to push back on?**

Nothing fundamental. The append-only, content-addressed, SQLite-backed
design aligns cleanly with the Reflective Twin invariant.

One API question: `EVENT_FABRIC.md` says WAL mode is mandatory and opens
with `PRAGMA journal_mode = WAL`. LumaWeave's Tauri backend already opens
SQLite connections for the settings store via Tauri's app data directory
(implicitly, via the `tauri-plugin-store` path). Are the ES SQLite file
and the Tauri settings store in separate files? If they share a
connection pool or accidentally share a file, WAL locking behavior
becomes a concern. Assume separate files but worth confirming.

---

*Compile the response as a single markdown section under
"## LumaWeave" suitable for inclusion in ES_CONSUMER_PROFILES.md.*

---

## LumaWeave

**Language/runtime:** TypeScript (React 19 in Tauri 2 webview) + Rust
(Tokio async backend). Single-user, developer workstation only. No Python.

**Integration shape:** In-process Rust crate calls from the Tauri backend;
napi-rs binding in the webview for subscriptions and queries. Tauri IPC
channel carries typed events to React. Existing `__lwTauriMock` shim in
`tauri-invoke.ts` must cover any ES-backed Tauri commands for Playwright
compatibility.

**What we want:** (1) Real-time semantic diff event subscription for
rendering Graph B live in Sigma.js — this is the primary use case.
(2) Ordered replay from a checkpoint for the time-travel viewer.
(3) `correlation_id` cross-stream traversal for causal subgraph
highlighting.

**What we don't need:** Branching for our own settings state (Zustand
handles it, migration chain is load-bearing). PII deletion. Encryption
at rest. Multi-user.

**Writes:** Low-volume, bursty. 10–50 events/sec during agent runs, near
zero at idle. Small payloads (< 64 KB). Single writer per stream.

**Reads:** Tail-the-latest (live Graph B), replay-from-checkpoint
(time-travel), random-access-by-correlation-id (subgraph highlight). Live
subscription latency target: < 100 ms for visual update.

**Persistence:** Forever — Reflective Twin invariant requires Graph A
reproducibility from the full event log. Append-only is correct. WAL SQLite
file only; no streaming backup needed.

**Existing infra:** None. Zero events to migrate. Zustand settings store
(v95, 90+ migrations) stays separate and is not a candidate for ES.

**Key risk:** Startup overhead. Tauri cold-start is already a CI
bottleneck. ES init must share the existing Tokio runtime or initialize
lazily. A second daemon process is not acceptable.

**Open question:** Does `@lattica/es`'s napi-rs binding initialize
synchronously, and does it share or conflict with the Tauri process's
existing Tokio runtime?

---

## Additional notes — LumaWeave architecture reference for Lattica integration

*This section captures LumaWeave's current built state as a reference for
Lattica phase work. It is not part of the ES consumer profile above.*

### Version and status

- **Version:** 0.19.0 · arc v113 open (source adapter UX maturity)
- **Active branch:** `feat/gwells-c10a-structural-resolver` (gwells hardening)
- **Mid-migration:** "everything in AppShell" → "everything through a registry." Both patterns coexist; migrate selectively.

### Registry spine

20+ typed registries. Two tiers:

- **T1** (const-array + pure helpers) — static list known at build time; no mutation.
- **T2** (register + subscribe) — entries added at runtime; UI reacts via `subscribe()`. Use for new Lattica module registration.

Key T2 registries for Lattica integration:

| Registry | File | Lattica hook |
|---|---|---|
| `sourceAdapterRegistry` | `src/source-adapter/sourceAdapterRegistry.ts` | Phase 2 (`transport:"live"`), Phase 4 (`database-schema` slot) |
| `tileSectionRegistry` | `src/control-plane/panels/tileSectionRegistry.ts` | New module panels register here |
| `inspectorSpokeRegistry` | `src/themes/inspectorSpokeRegistry.ts` | New inspector spokes (e.g. Cerebra spoke) |
| `themeTargetRegistry` | `src/themes/themeTargetRegistry.ts` | Atmosphere theming layer (Phase 4) |
| `physicsDialectRegistry` | `src/graph/physics/physicsDialectRegistry.ts` | New gwells layouts for Platform-specific graphs |
| `commandRegistry` | `src/control-plane/commands/command-registry.ts` | New platform commands |

### Source adapter integration seams

`src/source-adapter/sourceAdapterRegistry.ts`

- **`database-schema` slot** — `adapterType: "database-schema"` declared, status `candidate`. Hook for Phase 4 (Cerebra SQLite adapter).
- **`transport: "live"` slot** — declared as a forward-compat field on file-envelope adapters. Hook for Phase 2 (Policy Scout JSONL live source).
- **`coupling: "sibling-module"`** — declared on `SourceAdapterEntry` type, unused today. Reserved for Cerebra vault and other in-process Lattica adapters (vs `"external"` for user-supplied paths).
- **`registerSourceAdapter(entry)`** — T2 pattern; no core change needed to add a new adapter.

### Settings store

`src/control-plane/settings/settings.store.ts` — schema v95, 90+ sequential additive migrations.

- **Read pattern in callbacks:** always use `useSettingsStore.getState().field` — never capture in a closure (stale-closure trap documented in `docs/agent/KNOWN_SHARP_EDGES.md`).
- **Adding a slice:** add field to schema, write migration `CURRENT_SCHEMA_VERSION → CURRENT_SCHEMA_VERSION + 1`, add default. Skipping the migration silently drops state on load.
- **Agent inference config** (v95): `settings.agents.inference.{endpoint, model, byokKey}`. Default endpoint is Ollama at `http://localhost:11434/v1`. This is the hook point for Phase 3 (route through Cerebra's retrieval layer).
- **Dev mode gate** (v94): `settings.devMode` — controls `requiresDevMode` tile visibility. 3 tiles currently dev-gated (QaPanel, system-index, graph-visual-inventory).

### Rust Tauri commands

`src-tauri/src/`

| Command | Purpose |
|---|---|
| `read_file` | Project-relative file read; `canonicalize → starts_with` path validation |
| `run_script` | Allowlisted scripts; 60 s timeout, 10 MB output cap |
| `list_files` | Recursive directory listing; depth cap 20/50 |
| `read_user_file` | User-supplied absolute path; symlink-rejected, regular-file only |
| `read_vault_file` | Relative path under caller-supplied root; `canonicalize → starts_with` |
| `get_project_root` | Returns project root (pops `src-tauri/` suffix if present) |
| `open_in_ide` | Opens file:line URL in configured editor |
| `chat` | Proxies chat message to inference backend endpoint |
| `test_inference_connection` | Tests connectivity to configured inference endpoint |

TypeScript wrappers: `src/lib/tauri-invoke.ts`. New commands go here. The `__lwTauriMock` shim in the same file intercepts calls in `DEV || PLAYWRIGHT` — required for Playwright testability.

### gwells physics engine

`src/physics/` — N-body simulation. Extensible via `physicsDialectRegistry` (T2) and `seedFunctionRegistry` (T1). Recent hardening: structural resolver for well assignment (current branch). This is the shared physics engine for Platform-level graphs (Policy Scout DAGs, Cerebra retrieval overlays).

### Playwright suite

- **Run:** `npm run qa:e2e` · `npm run typecheck` (requires `npm run generate:graph` first)
- **CI state:** lint-css + typecheck only; E2E in CI deferred (Vite cold-start too slow)
- **No `test.only`** — disables the rest of the file; use `test.fixme` for pending
- New module UI needs `controlSurfaceContractRegistry` entries and `__lwTauriMock` entries

### Phase hook table

| Lattica phase | LumaWeave hook | Status |
|---|---|---|
| Phase 0 (monorepo + identity) | `tauri.conf.json` rename; pnpm workspace init; `moduleRegistry.ts` stub | Planned |
| Phase 1 (ai-stack) | `agents.inference` endpoint → LiteLLM; config hot-reload (`fs::watch` → IPC → Zustand) | Schema present; hot-reload not yet built |
| Phase 2 (Policy Scout) | `transport: "live"` slot in `sourceAdapterRegistry` | Slot declared; loader not yet written |
| Phase 3 (Cerebra) | Extend `InferenceBackend` trait; `coupling: "sibling-module"` on Cerebra vault adapter | Trait present; sibling-module coupling declared but unused |
| Phase 4 (Cerebra SQLite) | `database-schema` adapter in `sourceAdapterRegistry` | Slot declared as `candidate`; loader not yet written |
| Phase 4 (visual identity) | `themeTargetRegistry` atmosphere extension; `tileSectionRegistry` multi-pass layout | ADR-007 patterns documented; not yet implemented |
| Phase 4+ (breadcrumb nav) | `moduleRegistry.ts` (Phase 0 deliverable) + breadcrumb chrome | Not yet built |
| All phases | New tile sections → `tileSectionRegistry`; new commands → `commandRegistry` | Registries present and working |

---

## policy_scout_extract

# ES Consumer Profile — policy-scout

You are the policy-scout advocate. We're building **ES**, a local-first
event sourcing library: Rust core, PyO3/napi-rs bindings, SQLite-backed,
content-addressed events, branchable history, pure synchronous reducers.
It's being extracted from Lattica's Phase 6 plans because policy-scout and
several other projects also want event sourcing capabilities.

Before we lock the v1 API, we need your project's actual shape. Please
answer the questions below as concretely as possible — "I don't know yet"
and "we don't care about this" are both valid and useful answers.

---

## Language and runtime

**1. Primary language(s)?**
Python 3.12+ is the core. Rust (Tauri 2) for the desktop shell. TypeScript/React for the UI webview. The event-writing hot path is entirely Python.

**2. In-process embedded library, long-running daemon, CLI tool, or hybrid?**
Hybrid. Three distinct entry points:
- Short-lived CLI invocations (`policy-scout check`, `audit list`, etc.) — the common case.
- A long-running watch daemon (`policy-scout watch start`) that monitors filesystem changes in the background.
- A Tauri desktop app that drives the CLI as a subprocess and reads results over stdout JSON.

**3. Multi-process? Multi-thread? Async runtime?**
Multi-process — the Tauri shell spawns Python CLI subprocesses; the watch daemon runs as a separate OS process. Python side is synchronous throughout (no asyncio, no threading). No async runtime in use.

---

## What you want from ES

**4. Top three things wanted from event sourcing:**

1. **Durable audit trail with `request_id` correlation.** Every agent command flows through a pipeline: `CommandRequested → CommandClassified → PolicyMatched → DecisionIssued → (ApprovalRequested →) SandboxInstall → ExecutionCompleted`. Today these are separate SQLite rows. What's missing is the ability to replay or walk the full causal chain for a single `request_id` across all event types efficiently.

2. **Retention-aware storage with selective deletion.** The project already has a cleanup/deletion path (`policy-scout data cleanup --apply`). ES owning the lifecycle — TTL policies, PII scrub on individual events — would replace a bespoke maintenance job.

3. **Cross-process write ordering guarantee.** The CLI and the watch daemon can both emit events to the same SQLite file. Today this relies on SQLite's WAL mode and Python's `sqlite3` connection-level locks. A proper ES layer with a single-writer log would eliminate the occasional duplicate/lost write on rapid bursts.

**5. Things from the ES spec we DON'T need or actively don't want:**

- **Branching / branchable history**: Don't need. policy-scout has no experimental-scenario or what-if workflow.
- **Agent trace adapter**: Neutral — we have our own `request_id` correlation scheme. An adapter would only matter if we wanted to export traces to OTel, which isn't on the roadmap.
- **Snapshots**: Don't need. Event counts are low enough that full replay is never a bottleneck.
- **Multi-tenant / multi-user**: Actively don't want. This is a single-developer local tool and adding tenant isolation would be pure overhead.

---

## Scale and shape of writes

**6. Estimated write rate at steady state:**
Very low. Idle: 0 events/min. Active sweep: ~5–20 events/min (one sweep emits `SweepStarted`, per-finding events, `SweepCompleted`). A sandbox install burst: ~8–12 events over 2–5 seconds.

**7. Burst profile:**
Tight clusters. A `policy-scout check npm install lodash` emits 5–8 events in under 500ms, then silence. Sweeps are slightly longer bursts (seconds, not minutes). The watch daemon adds a low-level trickle of `FileChanged` events during active development.

**8. Typical payload size / maximum:**
Typical: 200–2 KB. The `data_json` column holds the serialized `data` dict from each `AuditEvent`. Largest payloads are `SweepCompleted` (full findings list) and `SandboxInstallCompleted` (transitive dep tree from pnpm/pip). Largest observed: ~40 KB for a large Python transitive tree. Nothing reliably over 64 KB.

**9. Number of distinct streams / events per stream per day:**
If streams map 1:1 to `request_id`: tens to low hundreds of streams per active day, each with 5–15 events. If streams map to `event_type`: ~25 named types (see `EventType` in `policy_scout/audit/events.py`), uneven distribution — `DecisionIssued` and `CommandRequested` are the highest-volume.

**10. Single writer per stream, or concurrent writers?**
Effectively single writer per `request_id` stream (the CLI process that owns that request). But the watch daemon writes to the same SQLite file concurrently with foreground CLI invocations, so at the store level there are concurrent writers.

---

## Reads

**11. Read patterns:**
- **Tail-the-latest**: most common — `audit list` returns recent N events sorted by timestamp DESC.
- **Type-filtered tail**: `audit type SweepCompleted` — same but filtered.
- **Correlation walk**: `audit list --request-id <id>` returns all events for a request, sorted ASC (causal order). This is the most valuable read pattern and the hardest with the current flat table.
- **Random access by event_id**: used by the detail view (`audit show <event_id>`).
- No full replay from version 0 needed today.

**12. Live subscriptions:**
Polling is fine. The Tauri UI refreshes on demand (button / filter change). The watch daemon writes and moves on — no consumers waiting on a subscription.

**13. Cross-stream queries:**
Yes — the `request_id` correlation query is the primary one. Also: "all events in the last hour", "all `DecisionIssued` events where decision = BLOCKED". These are currently SQL WHERE clauses on the flat table; they'd need to remain efficient in an ES layer.

---

## Persistence and lifecycle

**14. How long do events need to live?**
Configurable retention, defaulting to 90 days. The project already has a `--retention-days` flag on the cleanup command.

**15. Any need to delete individual events?**
Yes. Two drivers:
- **PII/credential scrub**: command arguments can contain secrets or personal paths. The store already runs `redact_dict()` at write time, but post-hoc scrub of mis-recorded data is needed.
- **Cleanup by age**: the existing deletion path targets events older than a retention window.

**16. Acceptable storage growth:**
Bounded by retention policy. Not disk-bounded — a developer machine has ample space. The goal is to avoid unbounded growth, not to fit in a tight budget.

**17. Backup/restore:**
Just-the-SQLite-file is fine. No streaming backup or PITR needed.

---

## Security and deployment

**18. Sensitive data in event payloads?**
Yes. Command arguments can contain package names with embedded secrets, filesystem paths that reveal project structure, and occasionally credentials passed as CLI flags. The store already applies a `redact_dict()` pass before writing (`sqlite_store.py:96–98`), but the raw `data_json` column still holds structured command data.

**19. Encryption at rest required?**
Not required for v1. Nice-to-have. If added, OS keyring (secretservice/Keychain) is the preference — no env-var secrets.

**20. Single-user local-first, or multi-user / multi-tenant?**
Single-user, local-first. One developer, one machine.

**21. Deployment target:**
Developer workstation only (Linux primary, macOS secondary via Tauri app). No server, container, or edge.

---

## Existing event/log infrastructure

**22. Does this project already have an event store?**
Yes — a SQLite-backed audit store at `~/.policy_scout/audit.db`.

Schema (abridged from `sqlite_store.py:47–89`):
```sql
CREATE TABLE audit_events (
    event_id        TEXT PRIMARY KEY,       -- "evt_<ulid>"
    event_type      TEXT NOT NULL,
    timestamp       TEXT,                   -- ISO-8601
    request_id      TEXT,                   -- correlation key
    actor_type      TEXT,
    actor_name      TEXT,
    summary         TEXT,
    data_json       TEXT NOT NULL,          -- serialized AuditEvent.data dict
    schema_version  INTEGER NOT NULL,       -- currently 1
    created_at      TEXT,
    decision_id     TEXT,                   -- FK-style denorm
    approval_id     TEXT,
    sandbox_id      TEXT,
    sweep_id        TEXT,
    report_id       TEXT,
    execution_id    TEXT
);
-- Indexes: request_id, event_type
```

There is also a JSONL writer (`audit/jsonl_writer.py`) used for file-based export.

Migration preference: **bridge first, migrate later**. A read-only ES adapter over the existing table would let us validate the integration without a flag-day migration. Full migration only after the API is proven stable.

**23. If migrating: how many existing events?**
Unknown — depends on install age. A typical active installation: 500–5,000 events. An older heavy-use installation: up to ~50,000.

---

## Integration shape

**24. How would you want to call ES?**
In-process Python API is strongly preferred for the write path — the hot path is Python and adding a subprocess round-trip per event would be unacceptable. For the Tauri shell, the current pattern (invoke Python CLI as subprocess, parse stdout JSON) could call `audit` subcommands that internally use ES — no Rust-native ES integration needed in v1.

**25. Anything awkward about integration today?**

- The Tauri shell calls Python as a subprocess. If ES exposes a Rust-native API (via napi-rs), that doesn't reach the Python write path without an extra IPC hop. PyO3 bindings would be the right fit here.
- The existing `request_id` scheme (a `ulid`-prefixed string generated per CLI invocation) would need to map to ES's stream identity concept. If ES streams are content-addressed or use a different ID scheme, there's a translation layer to design.
- The `redact_dict()` pass happens at write time inside `SQLiteAuditStore.write_event()`. That logic would need to move to the ES integration point, not be bypassed.

---

## Open questions and concerns

**26. What would make you NOT adopt ES?**

- **Migration pain.** If there's no bridge/adapter path and migration requires a one-shot ETL of existing events, that's a blocking risk — the store is write-audited and a failed migration could silently drop the trail.
- **PyO3 dependency conflict.** policy-scout's Python env is intentionally lean (only `pyyaml` as a runtime dep). A heavy Rust extension with transitive C deps would complicate the install story for non-Rust developers.
- **Write latency regression.** Today a `write_event()` call completes in <5ms locally. If ES adds synchronous overhead (content-addressing, Merkle ops) that pushes this above ~20ms, it shows up in the CLI's interactive response time.

**27. Anything in the ES design to push back on?**

Haven't seen `EVENT_FABRIC.md` or `ADR-002` — can't review specific design decisions without those. General concern: if content-addressing means every event write involves a hash of the full payload, that needs benchmarking against the 40 KB sweep payloads mentioned above. Hashing is cheap but it's not free at the tail end of an interactive command.

---

## policy-scout

policy-scout is a local-first safety harness for agent command execution on developer workstations. It intercepts package installs, shell commands, and file changes; runs them through a policy engine; and emits a structured audit trail. The existing audit store is a flat SQLite table (`audit_events`) with a `request_id` correlation key. Write volume is low and bursty; read patterns skew heavily toward recent-N and correlation walks. The biggest wins from ES would be durable causal ordering across multi-step request pipelines, and a principled retention/deletion mechanism to replace the bespoke cleanup job. Integration preference is a PyO3 in-process Python API with a bridge adapter over the existing table as the first step.

---

## aistack_extract

# ES Consumer Profile — ai-stack / claw-code

You are the ai-stack advocate. We're building **ES**, a local-first
event sourcing library: Rust core, PyO3/napi-rs bindings, SQLite-backed,
content-addressed events, branchable history, pure synchronous reducers.
It's being extracted from Lattica's Phase 6 plans because ai-stack and
several other projects also want event sourcing capabilities.

Before we lock the v1 API, we need your project's actual shape.

---

## Language and runtime

**1. Primary language(s)?**

The ai-stack is a Docker Compose stack, not a single-language project:

- **Infrastructure layer**: Docker / YAML. Four services:
  - `ollama` — GPU-accelerated local LLM inference (pre-built image, no code)
  - `litellm` — OpenAI-compatible API proxy, Python (async), custom Dockerfile based on `ghcr.io/berriai/litellm:main` with `async_generator` added
  - `tts` — text-to-speech via `openedai-speech`, GPU-enabled, Python
  - `open-webui` — React chat frontend served at `:3000`, talks to LiteLLM at `:4000`

- **Agent harness sub-project (`claw-code`)**: Rust (primary runtime, `cargo` workspace in `rust/`) + Python companion workspace in `src/` (Python 3.x, `venv` present). The Python layer is the reference implementation; Rust is the production surface.

**2. In-process embedded library, long-running daemon, CLI tool, or hybrid?**

Hybrid across two surfaces:
- The four Docker services are **long-running daemons** (container restart policy `unless-stopped`).
- `claw-code` is a **CLI tool** (`claw prompt "..."`, `claw doctor`, etc.) that spawns sessions and exits. The Python companion is also CLI-oriented.

**3. Multi-process? Multi-thread? Async runtime?**

- Docker services run in separate processes (separate containers, separate network namespaces). They communicate over HTTP (OpenAI-compatible APIs on `:11434`, `:4000`).
- LiteLLM is **async Python** (likely asyncio under the hood — it wraps aiohttp/httpx).
- The TTS service is Python, likely sync or gevent.
- `claw-code` Rust: unclear from source whether Tokio is in use; the Python companion is **synchronous** (no `asyncio` in the Python files read).
- Open WebUI is a containerized web server (its internals are not in this repo).

---

## What you want from ES

**4. The three top things you want from event sourcing:**

1. **Agent trace logging and replay** — `claw-code` currently tracks session events in `TranscriptStore` (in-memory list), `HistoryLog` (in-memory title/detail pairs), and `stream_events` (a tuple of raw dicts on `RuntimeSession`). These are ephemeral or saved as flat JSON files in `.port_sessions/`. There is no queryable history, no causal ordering, and no replay from a durable store. ES would replace this with content-addressed, replayable session traces — critical for debugging autonomous agent failures after the fact.

2. **LLM call audit trail** — `CostTracker` is in-memory only (`total_units` + list of `label:units` strings). LiteLLM logs requests internally but doesn't expose them durably to other services. An append-only event store per session/stream would make token spend, routing decisions (which model alias resolved to which backend), and latency fully auditable without scraping logs.

3. **Cross-service event stream for clawhip integration** — The broader claw-code philosophy (see `PHILOSOPHY.md`, `ROADMAP.md`) is building toward typed lifecycle events: `lane.started`, `lane.ready`, `prompt.accepted`, `lane.commit.created`, etc. Today these are emitted as Discord channel messages or scraped from terminal output. ES would provide the durable, ordered, machine-readable backbone that clawhip currently has to reconstruct heuristically from prose.

**5. ES features you DON'T need or actively don't want:**

- **Branching for experiments** — the roadmap mentions `branch.stale_against_main` but that's a git branch concept, not ES branch. A single developer running serial sessions has no need for ES-level branching.
- **OTel export** — not in the stack today; would be a nice-to-have but not a v1 requirement.
- **Cross-process pub/sub at ES layer** — the services communicate via HTTP already. ES as a shared in-process event log is more useful than ES as a message bus; pub/sub can stay at the LiteLLM / clawhip network layer.
- **Snapshots** — session event streams are short enough (hundreds of events per session, not millions) that replaying from zero is fine.

---

## Scale and shape of writes

**6. Estimated write rate at steady state:**

Low. A human-paced interactive session generates roughly 10–50 events/minute during active use. An autonomous claw loop running unattended might hit 100–300 events/minute during a busy execution phase.

**7. Burst profile:**

Tight clusters. A single LLM turn generates a batch of events atomically: `stream_events` (multiple), `turn_result`, `command_execution_messages`, `tool_execution_messages` — then silence until the next prompt. Bursts last seconds; quiet periods last minutes.

**8. Typical payload size? Maximum?**

- Small for lifecycle/history events: `HistoryEvent` is a title string + detail string, typically < 500 bytes.
- Medium for stream events: raw JSON dicts from the LLM streaming API, typically 1–10 KB per event.
- Large for turn results: full LLM response text can be 10–100 KB for long coding outputs.
- Maximum: LiteLLM response payloads from a large model could theoretically exceed 64 KB for very long completions. This is not routine but is possible.

**9. Number of distinct streams? Events per stream per day?**

A single developer might run 5–20 sessions per day. One stream per session is the natural model. Each session stream might accumulate 50–500 events. Total: a few thousand events/day across all streams.

**10. Single writer per stream, or concurrent writers?**

Single writer per stream. One session = one agent process = one writer. No concurrent writers to the same session stream.

---

## Reads

**11. Read patterns:**

- **Linear replay from version 0** — the primary use case for session debugging (reconstruct what happened).
- **Tail-the-latest** — for live clawhip monitoring of an active session.
- Random access by event ID is not needed.
- Time-range queries would be useful for "show me all events from the last run" but not critical at v1.

**12. Live subscriptions needed?**

Polling is acceptable for v1. Real-time delivery (clawhip watching an active lane) would be a nice upgrade but is not blocking. If real-time: latency of 1–2 seconds is acceptable; sub-100ms is not required.

**13. Cross-stream queries needed?**

Nice-to-have, not required at v1. Example: "all `prompt.accepted` events across all sessions today." The current design has no cross-session queries at all. A simple linear scan across stream metadata would satisfy most needs.

---

## Persistence and lifecycle

**14. How long do events need to live?**

Effectively forever for a single developer. Session volumes are small enough that there is no practical pressure to expire anything. Configurable retention would be welcome but is not a v1 requirement.

**15. Need to delete individual events?**

No. There is no PII in the payload (the system handles code and LLM responses, not user personal data). No compliance driver for deletion.

**16. Acceptable storage growth?**

Bounded by disk in practice. At the write rates above, even a year of sessions would be tens of megabytes — well within any modern disk. No retention policy needed; "we'll cross that bridge later" applies.

**17. Backup/restore expectations?**

Just-the-SQLite-file is fine. The developer already has `webui.db` and `chroma.sqlite3` on disk with no special backup infrastructure.

---

## Security and deployment

**18. Sensitive data in event payloads?**

- LLM response content may contain proprietary code or internal reasoning.
- API keys (`ANTHROPIC_API_KEY`, `sk-fake` LiteLLM master key) are passed via environment variables and should never land in event payloads — this is a caller-side discipline concern, not an ES-level one.
- No PII expected.

**19. Encryption at rest required?**

No. Single-developer local machine. OS-level disk encryption (if any) is sufficient.

**20. Single-user local-first, or multi-user?**

Single-user, local-first. The entire stack runs on one developer workstation.

**21. Deployment target:**

Developer workstation running Docker. All services are containers on the local machine. The Rust `claw` binary runs natively on the host. No cloud, no server, no edge devices.

---

## Existing event/log infrastructure

**22. Does this project already have an event store or audit log?**

Yes, several partial ones that don't talk to each other:

| Surface | Location | Format | Queryable? |
|---|---|---|---|
| Chat history | `webui-data/webui.db` | SQLite (Open WebUI schema) | Via WebUI only |
| Vector store | `webui-data/vector_db/chroma.sqlite3` | ChromaDB SQLite | Via ChromaDB API |
| Session store | `.port_sessions/<id>.json` | JSON files | No — filename lookup only |
| Transcript | `TranscriptStore` in `src/transcript.py` | In-memory list | No — only `replay()` dumps all |
| History log | `HistoryLog` in `src/history.py` | In-memory list of `HistoryEvent` | No |
| Cost tracker | `CostTracker` in `src/cost_tracker.py` | In-memory list of strings | No |
| LiteLLM logs | Container stdout + LiteLLM internals | Text/structured | Via LiteLLM UI only |

The session JSON files (`StoredSession`: session_id, messages tuple, input_tokens, output_tokens) are the closest thing to a durable event store. They are written once per session and never appended to.

Migration posture: **bridge first, then selectively migrate**. The WebUI SQLite and ChromaDB are owned by upstream projects and should be left alone. The claw-code Python/Rust surfaces (session store, transcript, history, cost tracker) are owned locally and would benefit most from ES migration.

**23. If migrating: how many existing events would need translation?**

Minimal — this is a relatively new local setup. At most a few dozen JSON session files. Translation would be straightforward: one `StoredSession` → one stream with a handful of events (session_started, each message, session_ended with token counts).

---

## Integration shape

**24. How would you want to call ES?**

- **In-process API** for the `claw-code` Rust binary (via the Rust core directly) and for the Python companion (via PyO3 bindings).
- A **file-watching bridge or HTTP adapter** for LiteLLM: LiteLLM is a containerized Python service that can't easily embed a Rust library; a sidecar or callback hook writing to a shared SQLite file is more practical.
- Open WebUI: read-only adapter at most — we'd read events from ES to display session history, not write from WebUI to ES.

**25. Anything in the codebase that would make integration awkward?**

- **LiteLLM is async Python** (`asyncio`) — the PyO3 bindings would need to be safe to call from async contexts, or we'd need a sync wrapper / background thread pattern.
- **Container isolation** — LiteLLM, Ollama, and TTS run in separate containers. A shared SQLite file would require a volume mount across containers; a network-accessible ES daemon would require a new service. Neither is terrible, but both add complexity.
- **claw-code Rust**: the existing Python session store uses flat JSON files; replacing it with ES would be a clean win but requires touching the `session_store.py` / Rust equivalent and the `RuntimeSession` struct.
- The Python companion in `src/` appears to be a reference/porting workspace rather than production code — so Python integration is lower priority than the Rust integration.

---

## Open questions and concerns

**26. What would make you NOT adopt ES?**

- If the Rust core requires a separate daemon or background thread just to do simple appends — the current session store is a one-liner `path.write_text(...)`. If ES adds significant startup latency or process complexity for what is today a CLI tool, that friction is real.
- If the SQLite file must be accessed by multiple containers simultaneously without a locking story. LiteLLM and claw may both want to write events; SQLite WAL mode handles this, but it needs to be explicitly designed for.
- If PyO3 bindings don't support being called from async Python cleanly — LiteLLM is the most interesting integration point and it's fully async.

**27. Anything in the ES design you'd push back on?**

- **Pure synchronous reducers**: fine for the CLI harness, but LiteLLM's middleware context is async. If "pure synchronous reducer" means "cannot be called from an async event loop without `run_in_executor`," that's a friction point worth solving at the binding layer.
- **Content-addressed events**: welcome for dedup and replay integrity, but the address scheme needs to handle large payloads (LLM response text up to 100 KB) without making append noticeably slower than a file write.
- **Branchable history**: not needed here, but the API surface for it shouldn't add conceptual weight to the common case (linear append + replay). If branching is opt-in and the default API is just `append` / `replay`, no objection.

---

Compile the response as a single markdown section under
"## ai-stack / claw-code" suitable for inclusion in
ES_CONSUMER_PROFILES.md.

---

## bo_cerebra_agent

> **Note:** Bo is no longer a standalone discord-bot module. Bo is a live, bootstrapped agent inside Cerebra — part of Cerebra's cognitive system, not a separate project. The profile below is historical (captured when Bo was still a standalone discord-bot); it remains useful as a record of Bo's ES requirements, which now apply to Cerebra's live agent layer.

# ES Consumer Profile — Bo (Cerebra live agent, formerly discord-bot)

You are the Bo advocate. We're building **ES**, a local-first
event sourcing library: Rust core, PyO3/napi-rs bindings, SQLite-backed,
content-addressed events, branchable history, pure synchronous reducers.
It's being extracted from Lattica's Phase 6 plans because Bo and
several other projects also want event sourcing capabilities.

Before we lock the v1 API, we need your project's actual shape. Please
answer the questions below as concretely as possible — "I don't know yet"
and "we don't care about this" are both valid and useful answers.

If you need to look at the codebase to answer any of these, do so. Cite
files/lines where helpful.

## Language and runtime
1. **Primary language(s)?** Python 3.12 (venv-isolated). No Rust, no TypeScript.

2. **In-process embedded library, long-running daemon, CLI tool, or hybrid?**
   Long-running daemon. `bot.py` runs as a persistent async process connected to Discord's gateway.

3. **Multi-process? Multi-thread? Async runtime in use?**
   Single process, single thread, asyncio throughout. All Discord I/O and HTTP calls (`discord.py`, `AsyncOpenAI`, `httpx`) are async. No threads in use.

## What you want from ES
4. **The three top things you want from event sourcing:**
   - **Conversation persistence** — replace the current session-only context window (`gather_context()` fetches live Discord history on every message; `bot.py:252–290`). ES would let us persist and replay conversation streams across restarts without re-fetching from Discord.
   - **Agent trace logging** — the bot produces `(thinking, content, status_tag)` tuples on every inference (`bot.py:290–404`). Right now those thinking traces disappear after being posted to Discord threads. We want a durable, queryable log of reasoning chains for debugging and future replay.
   - **Lightweight audit trail** — who triggered what, which LLM backend was used, whether a retry or synthesis fallback fired. Currently only surfaced via status tags in Discord messages (`"_(retried)_"`, `"_(synthesized from reasoning)_"`); no persistent record.

5. **Anything from the ES spec you DON'T need?**
   - **Branching** — don't need it. This is a 1:1 private bot with linear conversation history. No experiments, no forks.
   - **OTel export** — don't need it at this stage. No metrics infrastructure, no tracing backend.
   - **Snapshots** — we don't care about them yet. Context windows are small (≤10 messages by default, `CONTEXT_HISTORY_SIZE`). Full replay is fine.
   - **Multi-agent / agent trace adapter** — could be interesting later (Bo mentions Bandit as a collaborator), but not a v1 need.

## Scale and shape of writes
6. **Estimated write rate at steady state:**
   Very low. Maybe 2–10 events/minute during an active conversation, effectively 0 when idle. This is a single developer's private bot.

7. **Burst profile:**
   Tight clusters during an active exchange (user sends message → bot replies → user follows up), then silence for hours. No sustained load.

8. **Typical payload size? Maximum payload size?**
   Typical: 200–1000 bytes per Discord message or LLM reply. Thinking traces can be larger — Qwen 3.5 reasoning blocks can run 2–8KB. Absolute max we'd ever expect: ~16KB (a long thinking trace). Nothing exceeds 64KB.

9. **Number of distinct streams? Events per stream per day?**
   A handful of Discord channels (≤5 active). Each channel is a stream, or each thread within a channel is a sub-stream. At most 20–50 events/stream/day on an active day, effectively 0 most days.

10. **Single writer per stream, or concurrent writers?**
    Single writer. One bot process, one Discord account.

## Reads
11. **Read patterns:**
    Primarily **tail-the-latest** — `gather_context()` wants the N most recent messages to build the LLM context window (`bot.py:252`). Occasionally linear replay from beginning of a thread when summarizing. No random access by event ID today.

12. **Live subscriptions: real-time delivery or polling?**
    Polling is fine. The bot's latency requirement is "respond before the user notices a delay" — a few hundred milliseconds. No sub-second streaming needed from the store itself; Discord's gateway push handles real-time delivery of new messages.

13. **Cross-stream queries needed?**
    Not today. Could be useful later ("what did Bo say about X across all channels"), but not a v1 requirement. We'd rather keep it simple.

## Persistence and lifecycle
14. **How long do events need to live?**
    "We'll cross that bridge later." Probably indefinitely for reasoning traces (they're rare and valuable for debugging), and 30–90 days for raw message history. No hard requirement yet.

15. **Any need to delete individual events?**
    Not currently. No PII obligations articulated. The server is private and single-user. If Discord message content is ever considered sensitive, we'd want tombstoning — but that's not a v1 driver.

16. **Acceptable storage growth?**
    Not a concern at this scale. The bot produces maybe 1–5MB/month of event data. Bounded by disk is fine; we'll never hit it.

17. **Backup/restore expectations?**
    Just-the-SQLite-file is perfectly fine. No streaming backup, no point-in-time recovery needed.

## Security and deployment
18. **Sensitive data in event payloads?**
    Potentially yes — Discord messages from a private server could contain personal conversation content. Not credentials or secrets, but private chat. Treat as "user content, private."

19. **Encryption at rest required?**
    No hard requirement. It's a local single-user setup. Would be nice-to-have but not a blocker.

20. **Single-user local-first, or multi-user / multi-tenant?**
    Single-user, local-first. One developer, one bot, one server.

21. **Deployment target:**
    Developer workstation today. Possibly a low-power server (Raspberry Pi class) in the future. Definitely not container orchestration or cloud.

## Existing event/log infrastructure
22. **Does this project already have an event store or audit log?**
    No. Context is entirely session-in-memory. `gather_context()` (`bot.py:252`) re-fetches Discord history on every trigger using the Discord API. There is no local store, no schema, nothing to migrate. Fresh start.

23. **If migrating: how many existing events?**
    N/A — no migration. We'd be bootstrapping from zero.

## Integration shape
24. **How would you want to call ES?**
    In-process embedded library, called from async Python. The natural integration point is `gather_context()` (`bot.py:252`) — replace the live Discord fetch with an ES-backed query for recent events, then append new events after each exchange. A secondary integration point is `ask_local_model()` (`bot.py:290`) — append thinking trace + final response as events for the trace log.

25. **Anything in the codebase that would make integration awkward?**
    One friction point: **ES uses pure synchronous reducers**, and the entire bot is asyncio. Calling synchronous Rust-backed code from an async context requires `loop.run_in_executor()` or a sync wrapper — not a blocker, but it's a seam that needs care. The `gather_context()` function is already documented as "the seam for future memory architecture" (`bot.py:252`), so the plug-point is intentional and clean.

## Open questions and concerns
26. **What would make you NOT adopt ES?**
    - If the PyO3/napi-rs bindings don't have a Python wheel and require a Rust toolchain to install — this bot runs on a workstation where `pip install` is the expected flow.
    - If the SQLite WAL or locking behavior causes the bot process to stall during high-frequency reads (e.g., every message triggers a context fetch). At this scale it's unlikely, but worth verifying.
    - If the API surface is large — this bot is intentionally 600 lines and growing slowly. We'd want a thin slice: append-event, fetch-recent-N, done.

27. **Anything in the ES design you'd push back on?**
    The **pure synchronous reducer** constraint is the only flag. If reducers must be sync, projections derived from conversation history (e.g., "summarize last 20 messages for context") can't be async — that's fine for simple reads, but if we ever want a projection that itself calls the LLM (to summarize before feeding context), it'll need an executor bridge. Worth noting in the API docs. Not a blocker for v1.

---

## Bo (Cerebra live agent)

**Summary for ES_CONSUMER_PROFILES.md:**

Bo is a live agent embedded in Cerebra's runtime. Historically implemented as a Python 3.12 asyncio Discord bot (~610 lines, single file) that routes @mentions to a local Qwen 3.5 LLM via LiteLLM/Ollama. It is single-user, local-first, low-volume (2–10 events/burst, effectively 0 at idle), and has no existing event store — context today is live-fetched from Discord's API on every message. The primary integration point is `gather_context()` (`bot.py:252`), already designed as a plug-in seam for persistent memory. ES would replace live Discord fetches with local event replay and add a durable reasoning-trace log. Requirements are minimal: append-event, fetch-recent-N, SQLite on a workstation. Does not need branching, OTel, or snapshots. Payloads max ~16KB. One friction point: synchronous ES reducers will need `run_in_executor()` wrappers in an asyncio context.

---

