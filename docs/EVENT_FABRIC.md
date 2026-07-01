# Lattica — Event Fabric Architecture

**Document status:** Architecture specification — Phase 6 pre-implementation
**Last updated:** 2026-06-11
**Governs:** ES toolkit (lattica-es), all module event streams, agent trace adapter, time-travel viewer

---

## 1. Why Event Sourcing, Not a Message Broker

### The NATS rejection

NATS was the obvious first choice. It is fast, well-documented, has client libraries in every language Lattica uses, and is trivially embeddable. For a system where multiple modules need to communicate asynchronously, it checks every conventional box.

It was rejected because of what it does not do.

NATS delivers events and then forgets them. A subscriber that was offline when an event was published simply missed it. NATS JetStream adds persistence and replay, but replay in that model means re-delivering the same bytes — the stream is a sequence of messages, and "state" is whatever your application reconstructs on top. NATS has no concept of branching, no concept of applying a reducer to a segment of history to compute a derived state, no concept of forking execution at event N to explore a counterfactual outcome. It solves the pub/sub problem. It does not solve the history problem.

Lattica's reflective twin architecture requires both.

### What the reflective twin actually needs

The reflective twin is a three-layer structure:

**Graph A — canonical snapshot.** Stable, versioned, reproducible. The last known coherent state of the system. This graph is what you commit. It is not constantly changing. It is the baseline against which everything else is measured.

**Graph B — live state.** Constantly evolving. Current observations, current agent activity, current execution. This graph is always ahead of Graph A, always in flux, and may contain events that have not yet been validated or promoted to canonical.

**Diff layer — the event fabric.** The substrate that connects A to B. Not a line diff. Not a byte diff. Semantic events: *Agent investigating file*, *Policy violation detected*, *Repair pending*, *Consensus reached*, *Node promoted from live to canonical*. The diff layer is what gives the separation between A and B its meaning.

A message broker solves the problem of getting events from producers to consumers in real time. The diff layer requires something different: an immutable record of how the system got from A to B, with the ability to fork that record at any point and ask "what would B look like if this event had not occurred, or if this different event had occurred instead?"

That is event sourcing, not pub/sub.

### The Git framing

Git is the clearest analogy. Git does not just deliver file changes between machines — it maintains the complete, immutable history of every change, allows branching at any commit, allows replaying history on a different base, and provides merge semantics for combining divergent histories. You can check out any point in history, not because someone saved a snapshot there, but because the history is the data structure.

The ES toolkit is Git for application state. The SQLite store is the object database. Events are commits. Branches are branches. Reducers are the equivalent of Git's tree-hashing — they derive the current state from the log, deterministically. Snapshots are equivalent to Git's pack files — an optimization that avoids replaying the entire log, but never required for correctness.

The implication is that every interesting state transition in the platform is queryable, diffable, and counterfactually explorable in perpetuity. Cerebra's retrieval and memory sessions do not disappear when the agent stops. Policy Scout's audit decisions form a branching history, not a flat log. This is the property that justifies building the toolkit rather than adopting NATS.

### Why the immutable log matters for the reflective twin specifically

The twin architecture has a specific invariant: Graph A must be reproducible from the event log at any time. If the event log is lossy (NATS without JetStream, or JetStream with retention limits), this invariant cannot be maintained without external snapshotting discipline, which always eventually fails. With an immutable append-only log, Graph A is defined as: "apply the canonical reducer to all events up to version N." No external discipline required. The structure enforces the invariant.

---

## 2. ES Toolkit Architecture

### Why Rust for the core

The ES toolkit is written in Rust for a specific reason: it is the single implementation that all language bindings wrap. There is no separate Python implementation of the storage layer, no separate TypeScript implementation. There is one implementation, in Rust, and the bindings expose it.

This matters because:

- **Correctness is centralized.** A bug in the snapshot logic, the blake3 ID computation, or the branch resolution is fixed once and immediately propagated to all consumers. There is no Python/TypeScript drift.
- **PyO3 provides zero-overhead Python bindings.** The Python modules (Cerebra, Policy Scout) call the Rust implementation through PyO3 with no intermediate serialization for in-process calls.
- **napi-rs provides Node.js bindings** for the LumaWeave/Lattica TypeScript frontend. The same Rust crate, different binding layer.
- **The Tauri backend uses the crate directly.** The Rust-to-Rust path is the most efficient — no serialization at all, direct function calls. IPC from the Tauri backend to the frontend crosses the boundary once, not twice.
- **SQLite via rusqlite is safe and well-tested.** The Rust ecosystem's SQLite story is mature. WAL mode, prepared statements, and connection pooling are all well-understood.

The toolkit crate is `lattica-es`. The Python package is `lattica_es` (PyO3-generated). The npm package is `@lattica/es` (napi-rs-generated). All three are thin wrappers over the same crate.

### The 3-table SQLite schema

```sql
-- Primary event log. Append-only. No row is ever updated or deleted.
CREATE TABLE IF NOT EXISTS events (
    id            TEXT    NOT NULL,          -- blake3 content-addressed ID (hex)
    stream_id     TEXT    NOT NULL,          -- e.g. "cerebra/vault-01/retrieval"
    branch        TEXT    NOT NULL DEFAULT 'main',
    version       INTEGER NOT NULL,          -- monotonic per (stream_id, branch)
    event_type    TEXT    NOT NULL,          -- e.g. "QueryReceived"
    type_version  INTEGER NOT NULL DEFAULT 1,-- schema version for this event type
    payload       BLOB    NOT NULL,          -- msgpack-encoded payload
    causation_id  TEXT,                      -- ID of the event that caused this one
    correlation_id TEXT,                     -- shared across a causal chain
    timestamp     INTEGER NOT NULL,          -- Unix microseconds (UTC)
    recorded_at   INTEGER NOT NULL,          -- wall clock at insert time (Unix microseconds)
    PRIMARY KEY (stream_id, branch, version),
    UNIQUE (id)
);

-- Snapshot cache. Optimization only. Correctness does not depend on this table.
-- A snapshot records the reducer output at a given version so replay
-- can start from the snapshot rather than event 0.
CREATE TABLE IF NOT EXISTS snapshots (
    stream_id        TEXT    NOT NULL,
    branch           TEXT    NOT NULL DEFAULT 'main',
    version          INTEGER NOT NULL,       -- version the snapshot was taken after
    reducer_name     TEXT    NOT NULL,       -- which reducer produced this snapshot
    state            BLOB    NOT NULL,       -- msgpack-encoded state
    created_at       INTEGER NOT NULL,
    PRIMARY KEY (stream_id, branch, version, reducer_name)
);

-- Branch registry. A branch is a pointer into the event log, not a copy of events.
-- Events on a branch are stored with branch = branch.id in the events table.
-- The parent_version is the event version in the parent branch where this branch diverged.
-- Events at or before parent_version are shared (read from parent), not duplicated.
CREATE TABLE IF NOT EXISTS branches (
    id              TEXT    NOT NULL PRIMARY KEY,  -- branch name/ID (e.g. "cerebra/vault-01/counterfactual-b")
    stream_id       TEXT    NOT NULL,
    parent_id       TEXT    NOT NULL,              -- parent branch ID ("main" for root branches)
    parent_version  INTEGER NOT NULL,              -- divergence point in parent
    description     TEXT,
    created_at      INTEGER NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES branches(id)
);

-- Indices for common query patterns
CREATE INDEX IF NOT EXISTS idx_events_stream_branch_version
    ON events (stream_id, branch, version);

CREATE INDEX IF NOT EXISTS idx_events_type
    ON events (stream_id, event_type);

CREATE INDEX IF NOT EXISTS idx_events_timestamp
    ON events (stream_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_events_causation
    ON events (causation_id)
    WHERE causation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_correlation
    ON events (correlation_id)
    WHERE correlation_id IS NOT NULL;
```

**WAL mode is mandatory.** The ES toolkit opens every store with `PRAGMA journal_mode = WAL;`. WAL allows concurrent readers while a writer is active, which is required when the time-travel viewer is reading while the main application is appending.

**Store location — `LATTICA_FOSSIC_STORE`.** All federation consumers that open the hub store directly (Cerebra, LumaWeave, Policy Scout) must resolve the path using the same rule:

1. If the env var `LATTICA_FOSSIC_STORE` is set, use its value as the absolute path.
2. Otherwise default to `~/.lattica/fossic/store.db`.

The Lattica Tauri backend (`src-tauri/src/lib.rs`) follows this rule and is the store's owner — it creates the file and parent directory on startup. Consumers should never create the file themselves; they open it read-only or rely on WAL's concurrent-write semantics. Absence of the file on a consumer's first open should be treated as "hub not yet started", not a fatal error.

**No foreign keys from events to branches.** This is intentional. The branch lookup is done by the read path in Rust, not by the database engine. Enforcing the constraint at the DB layer would complicate branch deletion semantics and add unnecessary overhead on every append.

### Content-addressed event IDs

Every event has a stable, deterministic ID computed as:

```
id = blake3(event_type || "::" || type_version || "::" || causation_id || "::" || payload_bytes)
```

Where `||` is byte concatenation and `causation_id` is the empty string if absent. The payload is the raw msgpack bytes, not a canonical JSON encoding — this means payload encoding must be deterministic, which msgpack satisfies (maps are encoded with sorted keys in the toolkit's serializer).

Content-addressed IDs mean:

- **Deduplication is structural.** If the same event is appended twice (e.g., a retry after a network partition in a distributed future), the ID collision is detected at insert time and the duplicate is silently discarded.
- **Causation graphs are verifiable.** The causation_id field references another event's ID. Since IDs are content-addressed, the causal chain is tamper-evident — altering any event in the chain invalidates every event that transitively caused.
- **Cross-store verification.** If two stores receive the same event through different paths, the IDs will match. This is the foundation for eventual cross-module event deduplication.

### The branch-as-pointer pattern

Branches do not copy events. The `branches` table records only the divergence point: `(stream_id, parent_id, parent_version)`. When reading from a branch, the query engine in Rust resolves the branch ancestry chain and constructs a logical view:

1. Walk the branch ancestry chain from the requested branch back to `main`.
2. For each segment, the events in that segment are: all events in the parent branch at or before `parent_version`, plus all events in the child branch at any version.
3. The logical event sequence for a branch is: `[parent events 0..parent_version] ++ [branch events 0..N]`.

This means a branch with 5 events after a divergence point at version 1000 occupies only 5 rows in the events table, not 1005. The 1000 parent events are shared storage. Deeply nested branches (branch of a branch of a branch) resolve by walking the chain at read time — the chain length is bounded by the number of nested branches, which in practice never exceeds single digits.

**The constraint design implication:** it is structurally impossible to have inconsistent branch state. The branch table records the divergence point, and the read path is deterministic given that record. No synchronization logic, no "did I remember to copy the events" discipline.

### Reactive subscriptions

The Rust core exposes a subscription API:

```rust
pub trait EventSubscriber: Send + 'static {
    fn on_event(&self, event: &StoredEvent);
}

impl EventStore {
    pub fn subscribe(
        &self,
        stream_id: &str,
        branch: &str,
        subscriber: Box<dyn EventSubscriber>,
    ) -> SubscriptionHandle;
}
```

Subscriptions fire synchronously on every append, in the same transaction commit callback. This means the subscriber receives the event exactly once, with no polling, and the delivery is linearizable with the append (if the append committed, the subscriber fired; if the subscriber panicked, the append was still committed — the subscriber is notified, not the gatekeeper).

Subscriptions are in-process only in v1. Cross-process notification uses a SQLite WAL hook — consumers in other processes poll on a `NOTIFY`-equivalent mechanism using SQLite's `sqlite3_update_hook` via a background thread that debounces at 50ms. This is an acknowledged trade-off: the polling approach is not zero-latency, but it avoids the complexity of a socket-based notification layer before cross-process subscription is a validated need.

### Pure and synchronous reducers

Reducers are the mechanism for deriving current state from the event log. The toolkit enforces two invariants at the type level:

```rust
pub trait Reducer: Send + Sync + 'static {
    type State: Clone + Send + Sync;
    type Event;

    // No I/O. No async. No mutation of external state.
    // Given the same (state, event) inputs, must produce the same output.
    fn apply(&self, state: Self::State, event: &Self::Event) -> Self::State;

    fn initial_state(&self) -> Self::State;
}
```

**Why no I/O.** If a reducer can perform I/O, then replaying the same event log on two different machines may produce different state — a database read returns different results, a filesystem stat finds a different file. This breaks the central promise of event sourcing: that the event log is the ground truth and state is derived. With pure reducers, state derivation is deterministic across machines, across time, and across branches.

**Why synchronous.** Async reducers introduce the possibility of interleaved state derivation — event N+1 is applied before event N's reducer completes. The synchronous constraint means state derivation is always sequential, and the snapshot at version N is always the result of applying events 0..=N in order with no interleaving.

**The replay guarantee.** Because reducers are pure and synchronous, and because tool call outputs are stored in event payloads (see Section 6), a complete replay of any event stream will produce exactly the same derived state as the original run. This is not a soft guarantee — it is enforced by the type system. A reducer that violates purity cannot be registered.

---

## 3. Language Bindings

### Rust core (direct crate use in Tauri backend)

The `lattica-es` crate is the authoritative implementation. The Tauri backend (the Rust process that hosts the webview) uses the crate directly:

```rust
use lattica_es::{EventStore, EventBuilder, BranchOptions};

// Opening a store
let store = EventStore::open("~/.lattica/events.db")?;

// Appending an event
let event = EventBuilder::new("lumaweave/graph", "SourceLoaded")
    .payload(serde_json::json!({
        "adapter_id": "markdown-vault",
        "node_count": 42,
        "edge_count": 18
    }))?
    .causation_id("prev-event-id")
    .build()?;

store.append(&event)?;

// Reading events
let events = store.read("lumaweave/graph", "main", 0..=u64::MAX)?;

// Subscribing
let handle = store.subscribe("lumaweave/graph", "main", Box::new(MySubscriber));

// Creating a branch
let branch = store.create_branch(BranchOptions {
    stream_id: "cerebra/vault-01/retrieval",
    branch_id: "vault-01/counterfactual-b",
    parent_id: "main",
    parent_version: 23,
    description: Some("Counterfactual: alternative retrieval strategy from event 23"),
})?;
```

The Tauri backend exposes events to the frontend via Tauri's IPC command system. Rather than serializing the raw event store API across IPC, the backend exposes domain-specific commands (`get_agent_trace`, `get_stream_since`, `create_branch`) that return msgpack-encoded event sequences. This keeps the IPC surface small and avoids exposing store internals through the command boundary.

### PyO3 Python bindings (`lattica_es`)

The Python bindings are generated by PyO3 at build time. The API mirrors the Rust core but uses Python conventions:

```python
from lattica_es import EventStore, EventBuilder

# Opening a store (same file, can be opened by multiple bindings simultaneously in WAL mode)
store = EventStore.open("~/.lattica/events.db")

# Appending — payload is any JSON-serializable dict
store.append(
    stream_id="cerebra/vault-01/retrieval",
    event_type="QueryReceived",
    payload={
        "query_text": "what did I learn about SQLite WAL mode?",
        "vault_id": "vault-01",
        "session_id": "session-abc123"
    },
    causation_id=None  # optional
)

# Reading — returns a list of StoredEvent objects
events = store.read(stream_id="cerebra/vault-01/retrieval", branch="main", from_version=0)
for event in events:
    print(event.id, event.event_type, event.payload)  # payload is auto-deserialized dict

# Subscribing (fires in a background thread — callback must be thread-safe)
def on_event(event):
    print(f"New event: {event.event_type}")

handle = store.subscribe("cerebra/vault-01/retrieval", "main", on_event)
handle.unsubscribe()  # cleanup

# Branch operations
store.create_branch(
    stream_id="cerebra/vault-01/retrieval",
    branch_id="vault-01/counterfactual-b",
    parent_id="main",
    parent_version=23
)
```

**Python consumers by module:**

- **Cerebra** — appends retrieval trace events in the `cerebra/{vault_id}/retrieval` stream. Reads its own event history for context reconstruction. The store lives at `~/.lattica/events.db` (shared with all modules).
- **Policy Scout** — appends governance decision events in the `policy-scout/audit` stream. Uses the bridge adapter (Section 5) to mirror its existing `audit.db` JSONL into the shared store.

### napi-rs TypeScript bindings (`@lattica/es`)

The TypeScript bindings are generated by napi-rs and distributed as a native Node.js addon. The API is Promise-based (all store operations are async at the binding boundary to avoid blocking the Node.js event loop):

```typescript
import { EventStore, type StoredEvent } from '@lattica/es';

// Opening a store
const store = await EventStore.open('~/.lattica/events.db');

// Appending — payload is any JSON-serializable object
await store.append({
  streamId: 'lumaweave/graph',
  eventType: 'PhysicsDialectChanged',
  payload: {
    previousDialect: 'radial-backbone',
    newDialect: 'parallel-spines',
    triggeredBy: 'user',
  },
  causationId: undefined,
});

// Reading — returns StoredEvent[]
const events = await store.read({
  streamId: 'lumaweave/graph',
  branch: 'main',
  fromVersion: 0,
  toVersion: undefined, // latest
});

// Subscribing — callback fires via Node.js event emitter (no thread crossing)
const handle = store.subscribe('lumaweave/graph', 'main', (event: StoredEvent) => {
  console.log(event.eventType, event.payload);
});
handle.unsubscribe();

// Time-travel query — read the state of a stream at a specific timestamp
const historicalEvents = await store.readBefore({
  streamId: 'cerebra/vault-01/retrieval',
  branch: 'main',
  beforeTimestamp: Date.now() - 3600 * 1000, // 1 hour ago
});

// Branch operations
await store.createBranch({
  streamId: 'cerebra/vault-01/retrieval',
  branchId: 'vault-01/counterfactual-b',
  parentId: 'main',
  parentVersion: 23n, // BigInt for u64 compatibility
});
```

**TypeScript consumers:**

- **LumaWeave frontend** — reads graph state events to drive reactive graph updates. Subscribes to `lumaweave/graph` stream for live state changes. Reads agent trace events to drive the visual agent overlay (Phase 8).
- **Lattica time-travel viewer** — reads any stream as a historical view, uses the branch API to visualize counterfactual branches (Section 7).
- **Lattica system panel** — reads `lattica/system` stream for module lifecycle events.

**Note on the dual-path for TypeScript.** The napi-rs bindings are for the Tauri frontend process (the webview, running in a Node.js-compatible environment via Tauri's use of the V8 runtime). The Tauri backend (Rust) communicates with the frontend via IPC commands, not by sharing the store directly. In practice, the frontend uses IPC for most store operations (routed through the Tauri backend) and uses the napi-rs bindings directly only when running outside Tauri (tests, the time-travel viewer as a standalone web page, Storybook).

---

## 4. Stream Taxonomy

### Naming convention

Stream IDs follow a hierarchical path convention: `{module}/{resource-id}/{domain}`. The resource-id segment is omitted for module-level streams with no per-resource partitioning.

Rules:
- All lowercase, hyphen-separated words
- Segments separated by `/`
- Variable segments use `{variable}` in documentation, replaced with actual IDs at runtime (e.g., `cerebra/vault-production/retrieval`)
- No trailing slashes
- Maximum segment count: 4 (enforced at append time to prevent unbounded path growth)

The global namespace is a flat SQLite table — streams are not pre-registered, they come into existence when the first event is appended. This means a typo in a stream ID silently creates a new stream. The toolkit logs a warning when an event is appended to a stream that has never received an event before (first-write detection), which surfaces stream ID typos during development.

### Module stream inventory

**lattica/system**
Platform lifecycle. The Tauri Rust backend owns this stream.
- `ModuleRegistered` — a module was added to the module registry
- `ModuleActivated` — a module's IPC handlers are live
- `ModuleDeactivated` — a module was shut down cleanly
- `ModuleFaulted` — a module encountered an unrecoverable error
- `PlatformStarted` — the Lattica application launched
- `PlatformShuttingDown` — orderly shutdown initiated

**cerebra/{vault_id}/ingest**
Document ingestion pipeline.
- `DocumentSubmitted` — raw document received for ingestion
- `ChunkingStarted` — chunking strategy selected and started
- `ChunkProduced` — a single chunk extracted from a document
- `EmbeddingQueued` — chunk queued for embedding
- `DocumentIndexed` — all chunks embedded and written to vector index
- `DocumentFailed` — ingestion failed with error details

**cerebra/{vault_id}/retrieval**
Query trace. Every retrieval produces a structured event sequence.
- `QueryReceived` — query text + session context
- `QueryPlanned` — retrieval strategy selected (HyDE/sparse/hybrid/direct)
- `TraversalStepCompleted` — one hop in the knowledge graph traversal
- `SalienceScored` — salience score assigned to a candidate chunk
- `ContextPacketBuilt` — final context window assembled
- `RetrievalAbstained` — query answerable from working memory, no retrieval performed
- `RetrievalFailed` — error during retrieval

**cerebra/{vault_id}/memory**
Knowledge graph lifecycle.
- `GraphNodeLifecycleChanged` — node created, promoted, demoted, or expired
- `GraphEdgeLifecycleChanged` — edge created, weight updated, or expired
- `WorkingMemoryCreated` — a new working memory slot allocated
- `WorkingMemoryPromoted` — working memory slot moved to long-term
- `WorkingMemoryExpired` — working memory slot TTL elapsed

**cerebra/{vault_id}/embedding**
GPU embedding pipeline.
- `EmbeddingGenerated` — embedding vector produced for a chunk (includes model ID, latency)
- `VectorIndexUpdated` — FAISS/SQLite-vec index rebuilt or incrementally updated
- `EmbeddingFailed` — GPU OOM or model error

**policy-scout/audit**
Governance decisions. Mirrors Policy Scout's existing audit.db schema via the bridge adapter (Section 5).
- `CommandRequested` — shell command or file mutation requested by an agent
- `CommandParsed` — intent extracted from the raw command string
- `PolicyMatched` — a policy rule matched the request (may be allow or deny)
- `DecisionIssued` — final allow/deny decision with risk score
- `SandboxWorkflowStarted` — HITL sandbox workflow initiated
- `ApprovalGranted` — human approved the sandboxed action
- `ApprovalDenied` — human denied the sandboxed action
- `PackageInstallRequested` — package install attempt intercepted

**ai-stack/gateway**
LiteLLM inference gateway.
- `InferenceRequested` — request received at gateway with model alias
- `InferenceCompleted` — response returned with token counts and latency
- `InferenceFailed` — error from upstream model
- `ModelAliasResolved` — logical alias resolved to physical model ID
- `RateLimitApplied` — request throttled

**ai-stack/models**
Ollama model lifecycle.
- `ModelLoaded` — model loaded into VRAM (includes VRAM delta)
- `ModelUnloaded` — model evicted from VRAM
- `VramBudgetChanged` — total available VRAM changed (e.g., another process claimed GPU memory)
- `ModelPullStarted` — new model being downloaded
- `ModelPullCompleted` — model available for inference

**cerebra/agent-trace**
Bo live agent (inside Cerebra) conversation lifecycle events.
- `MessageReceived` — Discord message received
- `ContextGathered` — context window assembled (shows whether Cerebra retrieval was used)
- `TierSelected` — resilience tier chosen (primary/fallback/emergency)
- `ResponseGenerated` — response produced and sent
- `MemoryUpdated` — rolling conversation memory updated

**lumaweave/graph**
LumaWeave graph state.
- `SourceLoaded` — source adapter finished loading (node/edge counts)
- `AdapterRegistered` — new source adapter registered in the registry
- `NodeSelected` — user selected a node in the graph
- `EdgeSelected` — user selected an edge
- `PhysicsDialectChanged` — gwells physics dialect changed
- `LayoutSettled` — physics simulation reached equilibrium
- `TileSectionToggled` — a tile section opened or closed

**eval/run**
eval-core evaluation runs.
- `RunStarted` — evaluation run initiated (module, suite, case count)
- `CaseExecuted` — individual test case result (pass/fail/skip, latency)
- `RegressionDetected` — a previously-passing case now fails
- `BaselineUpdated` — a new baseline was accepted
- `RunCompleted` — run closed with aggregate statistics

---

## 5. Cross-Language Bridge for Existing Event Stores

Cerebra and Policy Scout both predated the ES toolkit decision and have their own event persistence mechanisms. These are not replaced. Replacing them would require coordinated migrations across two Python projects with active development, and would break the isolation that makes each module independently testable. Instead, the toolkit provides read adapters — bridge processes that translate each store's existing schema into the unified event vocabulary.

The bridges are one-directional: existing stores → ES toolkit. The existing stores remain the authoritative write path for their modules. The ES toolkit streams are derived views.

### Cerebra bridge

Cerebra's existing event store is a SQLite table (`inspector_events`) and an NDJSON log file (`~/.cerebra/logs/retrieval.ndjson`). The schema for `inspector_events` is approximately:

```
inspector_events(
    id INTEGER PRIMARY KEY,
    session_id TEXT,
    event_type TEXT,
    payload TEXT (JSON),
    created_at REAL (Unix seconds)
)
```

The bridge adapter is a Python process that:
1. Opens the Cerebra SQLite with WAL read access.
2. Opens the ES toolkit store at `~/.lattica/events.db`.
3. Maintains a cursor table (`lattica_bridge_cursors`) in the Cerebra SQLite recording the last processed `id` per event type.
4. On startup, replays all events after the cursor into the appropriate ES toolkit streams.
5. Uses SQLite's WAL mode concurrent read to poll for new rows every 100ms (debounced, backed off to 1s when no new events for 30s).
6. Translates each `inspector_events` row to an ES event:

```python
def translate_cerebra_event(row: dict) -> ESEvent:
    vault_id = row['session_id'].split('/')[0]  # convention: session_id = vault_id/session
    stream_id = f"cerebra/{vault_id}/retrieval"
    
    # Map Cerebra event types to canonical vocabulary
    type_map = {
        'query_start':        'QueryReceived',
        'retrieval_step':     'TraversalStepCompleted',
        'salience_scored':    'SalienceScored',
        'context_built':      'ContextPacketBuilt',
        'query_abstained':    'RetrievalAbstained',
    }
    
    return ESEvent(
        stream_id=stream_id,
        event_type=type_map.get(row['event_type'], f"cerebra:{row['event_type']}"),
        payload=json.loads(row['payload']),
        causation_id=None,  # causation IDs not present in Cerebra's original schema
        timestamp=int(row['created_at'] * 1_000_000),  # seconds → microseconds
    )
```

The bridge is idempotent: if the bridge process crashes and restarts, the cursor ensures it replays only unprocessed events. Content-addressed IDs mean duplicate appends are silently discarded.

The NDJSON log is treated as a secondary source — only events that appear in NDJSON but not in `inspector_events` (due to a process crash during SQLite write) are ingested from the NDJSON path. The NDJSON bridge uses a file offset cursor.

### Policy Scout bridge

Policy Scout's event store is `audit.db` (SQLite) with a corresponding JSONL audit log at `~/.policy-scout/audit.jsonl`. The `audit.db` schema:

```
audit_events(
    id TEXT PRIMARY KEY,        -- UUID
    timestamp TEXT,             -- ISO 8601
    command TEXT,
    risk_score REAL,
    decision TEXT,              -- 'allow' | 'deny' | 'sandbox'
    policy_id TEXT,
    agent_id TEXT,
    metadata TEXT               -- JSON blob
)
```

The Policy Scout bridge is simpler than the Cerebra bridge because Policy Scout's event types are already well-defined:

```python
def translate_policy_scout_event(row: dict) -> ESEvent:
    metadata = json.loads(row.get('metadata', '{}'))
    
    # Policy Scout emits a single row per decision, but the ES vocabulary
    # models the full decision pipeline as multiple events with causation chains.
    # The bridge produces a synthetic causation chain from the single row.
    
    base_id = compute_blake3(row['id'])  # stable ID from Policy Scout's UUID
    
    events = [
        ESEvent(
            stream_id='policy-scout/audit',
            event_type='CommandRequested',
            payload={'command': row['command'], 'agent_id': row['agent_id']},
            timestamp=parse_iso(row['timestamp']),
        ),
        ESEvent(
            stream_id='policy-scout/audit',
            event_type='DecisionIssued',
            payload={
                'decision': row['decision'],
                'risk_score': row['risk_score'],
                'policy_id': row['policy_id'],
                **metadata,
            },
            causation_id=base_id,  # DecisionIssued caused by CommandRequested
            timestamp=parse_iso(row['timestamp']),
        ),
    ]
    return events
```

The bridge produces two events per audit row: `CommandRequested` and `DecisionIssued` with a causation link. This preserves the causal structure in the unified vocabulary even though Policy Scout's original schema collapsed it to one row.

### Bridge process lifecycle

Both bridges run as lightweight daemons launched by the Tauri backend on startup (Phase 6). They are supervised — if a bridge process exits unexpectedly, the Tauri backend restarts it with exponential backoff. Bridge health is reported as `lattica/system` events (`ModuleFaulted` if a bridge fails to restart after 3 attempts).

The bridges are stateless except for their cursors, which are stored in the source database (to avoid a third SQLite file). Cursor storage in the source database means the cursor and the source data are always in the same atomic transaction domain — a crash that rolls back a Cerebra write also rolls back the cursor update, preventing cursor-ahead-of-data inconsistency.

---

## 6. Agent Trace Adapter

### Motivation

Every agent in Lattica — Cerebra's cognitive cycles, Bo's inference pipeline, and any Claude Code invocation routed through the platform — executes as a sequence of LLM calls, tool calls, and reasoning steps. Without structured event recording, these sessions are opaque: you see the input and the output, but not the chain of reasoning that produced the output.

The agent trace adapter standardizes the event vocabulary for agent activity so that every agent session is fully replayable, counterfactually explorable, and exportable to OpenTelemetry.

### Standard event types

**`llm_call`**

Emitted when an agent submits a prompt to an LLM. Payload:

```typescript
interface LlmCallPayload {
  session_id: string;          // agent session ID
  call_index: number;          // position in the session (0-indexed)
  model_id: string;            // e.g. "qwen2.5-coder:14b"
  model_alias: string;         // LiteLLM alias, if used
  messages: Array<{            // full message history at time of call
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
  }>;
  tools_available: string[];   // tool names available for this call
  temperature: number;
  max_tokens: number;
  prompt_tokens: number;       // filled by the response adapter
  start_timestamp_us: number;
}
```

**`llm_response`**

Emitted when the LLM returns. Paired with `llm_call` via causation_id:

```typescript
interface LlmResponsePayload {
  session_id: string;
  call_index: number;
  completion_tokens: number;
  latency_ms: number;
  stop_reason: 'stop' | 'tool_use' | 'max_tokens' | 'error';
  response_text: string | null;    // null if stop_reason is tool_use
  tool_calls: ToolCallSpec[];      // populated when stop_reason is tool_use
  raw_response_id: string;         // provider-assigned response ID
}
```

**`tool_call`**

Emitted when the agent invokes a tool (before execution):

```typescript
interface ToolCallPayload {
  session_id: string;
  call_index: number;
  tool_call_id: string;      // provider-assigned tool call ID
  tool_name: string;
  tool_input: Record<string, unknown>;  // full input arguments
}
```

**`tool_result`**

Emitted when the tool returns. **This is the load-bearing event for deterministic replay.** The tool output is stored here in full — on replay, the agent does not re-invoke the tool, it reads this event.

```typescript
interface ToolResultPayload {
  session_id: string;
  call_index: number;
  tool_call_id: string;
  tool_name: string;
  result: unknown;           // full tool output, JSON-serializable
  is_error: boolean;
  execution_latency_ms: number;
  deterministic: boolean;    // false for tools like "get current time" that should re-execute on replay
}
```

The `deterministic` flag is the escape hatch. Tools that return wall-clock time, random numbers, or live network responses should set `deterministic: false`. On replay, non-deterministic tools are re-executed; deterministic tools read from the stored result. The default is `true` — the toolkit errs on the side of deterministic replay.

**`reasoning_step`**

Emitted when the agent performs explicit reasoning (chain-of-thought, scratchpad, or internal monologue that is logged but not sent to the LLM as a message):

```typescript
interface ReasoningStepPayload {
  session_id: string;
  step_index: number;
  reasoning_type: 'chain_of_thought' | 'strategy_evaluation' | 'error_diagnosis' | 'plan';
  content: string;           // full text of the reasoning step
  confidence: number | null; // 0.0-1.0 if the agent provides a confidence estimate
}
```

### How Cerebra uses the trace adapter

Cerebra's cognitive cycle is the primary agent to integrate the trace adapter. Each retrieval session maps to a `cerebra/{vault_id}/retrieval` stream. The session produces a sequence:

```
QueryReceived
  → llm_call (retrieval planning)
  → tool_call (QueryKnowledgeGraph: target vault)
  → tool_result (graph traversal results)
  → llm_response (with StrategySelected tool call)
  → reasoning_step (rationale for chosen retrieval strategy)
  → TraversalStepCompleted
  → SalienceScored
  → ContextPacketBuilt
```

The branch API enables counterfactual exploration: at any decision point, a branch can be created that replays the same inputs but applies a different strategy. The `tool_result` events for knowledge graph reads before the branch point are replayed from storage. This enables comparing retrieval quality across different strategies against the same vault state.

### OpenTelemetry GenAI span export

The agent trace adapter includes an exporter that converts ES agent trace events to OTel GenAI semantic convention spans. The mapping:

| ES event type  | OTel span kind | OTel attributes                                          |
|----------------|----------------|----------------------------------------------------------|
| `llm_call`     | CLIENT         | `gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.input_tokens` |
| `llm_response` | (end of span)  | `gen_ai.usage.output_tokens`, `gen_ai.response.finish_reasons` |
| `tool_call`    | INTERNAL       | `gen_ai.tool.name`, `gen_ai.tool.call.id`                |
| `tool_result`  | (end of span)  | `gen_ai.tool.result` (truncated to 1KB)                  |

The exporter runs as a background task in the Rust core, reading from a subscription on `cerebra/*` and `policy-scout/*` streams and forwarding to the configured OTel collector endpoint (defaults to `localhost:4317` for the local Grafana stack from Phase 1). Export is optional — if no collector is configured, the exporter is a no-op.

---

## 7. The Time-Travel Viewer

### Architecture overview

The time-travel viewer is a separate consumer of the ES store. It does not share state with the main Lattica application — it reads the store directly via the napi-rs TypeScript bindings and renders a scrubbable timeline in a LumaWeave panel tile.

The viewer has three display modes:
1. **Stream view** — a linear timeline of events for a single stream, with the reducer state displayed at the selected point.
2. **Branch view** — a branching timeline showing the main branch and all counterfactual branches, with visual divergence points.
3. **Cross-stream view** — a correlated timeline of multiple streams, time-aligned on the horizontal axis.

### Scrubbable timeline

The timeline is rendered on an HTML canvas element (not SVG — the event density at scale would make SVG too slow). The canvas is divided into horizontal swim lanes, one per stream. Events are represented as vertical tick marks, sized by event payload size (larger events are more visually prominent). The scrubber is a vertical line that can be dragged left and right.

At any scrubber position, the viewer displays:
- The current state derived by applying the reducer to all events up to that point (right panel)
- The event at or immediately before the scrubber (center panel, full payload)
- The delta between the previous event's state and the current event's state (diff panel, colored by add/remove/change)

The scrubber position is stored as an event version number, not a timestamp. This makes the scrubber deterministic — the same version number always shows the same state, regardless of when the user opens the viewer.

### Diff between two event points

The viewer supports a two-point selection mode: the user can anchor the scrubber at version N and drag a second cursor to version M. The diff panel shows:
- All events between N and M (list view, filterable by type)
- The state delta between versions N and M (the output of `reducer.apply_range(state_at_n, events[n+1..=m])`)
- A visual summary of which fields in the state changed, by how much

This is the primary tool for understanding "what changed between these two points in the system's history." For example: "what changed in the `cerebra/vault-01/retrieval` stream between the time a Cerebra retrieval session started and when it completed?"

### Filtering

The viewer supports three filter axes, applied simultaneously:
- **Stream filter** — show only events from selected stream IDs (multi-select dropdown)
- **Event type filter** — show only events of selected types
- **Time range filter** — collapse the timeline to a specific wall-clock window

Filters are stored in the URL fragment (for the standalone web mode) or in the Zustand store (for the embedded panel mode). Filter state can be bookmarked via LumaWeave's existing bookmark registry.

### Embedding in LumaWeave

The time-travel viewer is registered as a LumaWeave tile section in the `tileSectionRegistry`:

```typescript
tileSectionRegistry.register({
  id: 'TimeTravelViewer',
  label: 'Time-Travel Viewer',
  icon: 'timeline',
  defaultExpanded: false,
  component: TimeTravelViewerTile,
  // Not gated behind DEV_ONLY — this is a user-facing feature in Phase 6
});
```

The tile embeds the canvas timeline in the panel system's tile layout. The four-mode multi-pass panel layout (inherited from LumaShell, ADR-007) supports a "wide" mode where the time-travel tile expands to occupy the full panel width — essential for seeing long timelines.

### Canonical snapshot vs live state visualization

The time-travel viewer's most important integration with the reflective twin is the canonical/live diff visualization. LumaWeave maintains two graph instances (the twin architecture):

- **Graph A (canonical)** — loaded from the ES store at a pinned version (the last `GraphSourceLoaded` event with `source: 'canonical'`)
- **Graph B (live)** — loaded from the current state of all subscribed streams

The time-travel viewer can place the scrubber at any point and show: "if the canonical snapshot were taken here, what would Graph A look like, and how does that differ from today's Graph B?"

The diff is visualized as:
- Edges that exist in Graph B but not at scrubber-point Graph A → highlighted in `var(--color-accent-amber)` (new since canonical)
- Edges that existed at scrubber-point Graph A but not in Graph B → highlighted in `var(--color-accent-red)` (removed since canonical)
- Nodes present in both but with changed properties → highlighted in `var(--color-accent-blue)` (modified since canonical)

This is the diff layer made visible. The event fabric is the substrate; the time-travel viewer is the lens.

---

## 8. Branching and Counterfactual Exploration

### How branch-as-pointer storage works in practice

A branch is created with a (stream_id, parent_id, parent_version) triple. From that point, events appended to the branch are stored in the `events` table with `branch = branch_id`. The parent's events are not duplicated.

The read path for a branch resolves the full logical event sequence:

```rust
fn read_branch(
    conn: &Connection,
    stream_id: &str,
    branch_id: &str,
    from_version: u64,
    to_version: u64,
) -> Result<Vec<StoredEvent>> {
    // Walk the ancestry chain
    let chain = resolve_branch_chain(conn, stream_id, branch_id)?;
    // chain = [(main, 0..=23), (repair-42/strategy-a, 24..=N)]
    // for a branch created at parent_version=23

    let mut events = Vec::new();
    for (segment_branch, version_range) in chain {
        let clipped_range = clip(version_range, from_version, to_version);
        if clipped_range.is_empty() { continue; }
        
        let rows = conn.prepare(
            "SELECT * FROM events WHERE stream_id = ?1 AND branch = ?2
             AND version >= ?3 AND version <= ?4 ORDER BY version ASC"
        )?.query_map(
            params![stream_id, segment_branch, clipped_range.start, clipped_range.end],
            row_to_event,
        )?;
        events.extend(rows);
    }
    Ok(events)
}
```

The chain resolution is cached in a `BTreeMap<(stream_id, branch_id), Vec<BranchSegment>>` within the `EventStore` handle. The cache is invalidated when a new branch is created on any ancestor of the cached branch. Cache misses are rare in practice (branches are created infrequently relative to reads).

### Example: Cerebra retrieval counterfactual

A Cerebra retrieval session is running on `cerebra/vault-01/retrieval`, branch `main`. At version 23, the agent chose strategy A (semantic vector search). The results had low salience scores. The developer wants to explore: "would strategy B (keyword + rerank) have produced higher-salience results?"

1. Create the branch: `store.create_branch({ stream_id: "cerebra/vault-01/retrieval", branch_id: "session-42/strategy-b", parent_id: "main", parent_version: 23 })`
2. The branch record is written to `branches`. No events are copied.
3. Cerebra's counterfactual runner reads the branch: it gets events 0..=23 from `main` (the same query and vault state) and appends new events starting at version 24 on `session-42/strategy-b` (the different strategy selection, new traversal, new salience scoring).
4. `tool_result` events for knowledge graph reads before version 23 are deterministic — they replay from storage without re-querying the vault. The vault state at analysis time is guaranteed to be the same in both the main branch and the counterfactual.
5. `tool_result` events for writes and downstream scoring after version 23 are non-deterministic — they execute against the actual vault state. This is correct: strategy B's results should be evaluated against the real knowledge graph, not a stored snapshot.

The result: two complete retrieval session histories, sharing events 0..=23 (the shared query context, stored once), diverging at event 24. The time-travel viewer can display both branches side by side, with the divergence point visually marked.

### LumaWeave branch visualization

In the LumaWeave graph, branches are visualized in the time-travel viewer's branch view mode:

- The main branch timeline is rendered in `var(--color-node-default)` (the base graph color from the theme token system).
- Each branch gets a distinct color pulled from the theme's accent palette, assigned by branch index.
- The divergence point is marked with a diamond node on the timeline.
- When the scrubber is in the branch of a counterfactual, the graph overlay shows branched events with a dashed edge style and the branch's assigned color.

The color assignment uses the existing `themeTargetRegistry` — branch colors are registered as theme targets, allowing the developer to customize them through the Appearance tile section without code changes.

### Merge semantics (future work, not Phase 6)

Phase 6 does not implement branch merging. The branch model is write-once-per-branch: once a branch is created, its events are appended-to but never merged back to the parent. This is an intentional constraint — merge semantics for event logs are significantly more complex than for file diffs, and the primary use case (counterfactual exploration) does not require merging.

Branch merging, if needed in a future phase, would be implemented as a new event type (`BranchMergeRecorded`) that records the merge decision and the resulting state. The original branches remain immutable.

---

## 9. Implementation Roadmap for Phase 6

### Work breakdown

**Step 1: Rust core — linear store (weeks 1–2)**

Build the `lattica-es` crate with:
- SQLite schema creation and migration (the DDL from Section 2)
- `append()` — single event append with content-addressed ID computation
- `read()` — sequential read from a stream with version range
- `subscribe()` — in-process subscription via `Arc<Mutex<Vec<Box<dyn EventSubscriber>>>>`
- WAL mode configuration
- Basic error types

No branch support yet. No snapshots. The store is a single-branch linear log.

**Exit criterion:** A Rust test appends 10,000 events to a stream, reads them back in order, verifies all IDs are correct, and verifies the subscription fired for each append. Runs in under 500ms on the development machine.

**Risks at step 1:** blake3 hashing of msgpack-encoded payloads requires stable msgpack serialization (maps must sort keys). The `rmp-serde` crate is the planned serializer; verify key sorting behavior with a property test before proceeding.

**Step 2: Snapshot support (week 2)**

Add:
- `Reducer` trait definition
- `take_snapshot()` — serialize reducer state to msgpack and write to `snapshots` table
- `read_from_snapshot()` — find the latest snapshot before a version, deserialize, replay remaining events
- `auto_snapshot()` — take a snapshot every N events (configurable, default N=500)

**Exit criterion:** A stream with 5,000 events and a snapshot at version 2,500 reads current state in under 50ms (vs. replaying all 5,000 events). Verify that removing all snapshots and replaying from zero produces identical state.

**Risks at step 2:** The `Reducer::State` type must implement `Clone + Send + Sync`. Complex state types (e.g., large graph structures) may have expensive clones. Document the expectation that reducer state types should be designed for cheap cloning (Arc-wrapped interior data if large).

**Step 3: Branch support (weeks 3–4)**

Add:
- `branches` table migration
- `create_branch()` — insert into `branches` table
- `resolve_branch_chain()` — walk ancestry
- Modify `read()` to accept a branch parameter and resolve the chain
- Modify `append()` to accept a branch parameter
- Branch chain cache with invalidation

**Exit criterion:** Create a branch at version 50 of a 100-event stream. Append 10 events to the branch. Read the branch — verify exactly 60 events (50 shared + 10 branch-specific). Read the parent — verify exactly 100 events (unchanged). Delete the branch record — verify no events were deleted (shared events intact).

**Risks at step 3:** The branch chain cache must handle concurrent branch creation correctly. A branch can be created from any thread; the cache must be invalidated atomically with the branch write. This requires a `RwLock<HashMap>` pattern on the cache, not a bare `HashMap`. Test with concurrent branch creation under load.

**Step 4: PyO3 Python bindings (week 5)**

Add:
- `lattica_es` Python module using `pyo3`
- Python wrappers for `EventStore`, `EventBuilder`, `StoredEvent`, `SubscriptionHandle`
- Automatic msgpack ↔ Python dict conversion for payloads
- Thread-safe subscription callbacks (GIL management — callbacks must release the GIL before firing)
- maturin build configuration for the Python package

**Exit criterion:** The Cerebra bridge adapter prototype (Section 5) runs correctly using the Python bindings. Append 1,000 synthetic Cerebra events from Python, read them back, verify no data loss. Run under `pytest` with `maturin develop`.

**Risks at step 4:** GIL management for subscription callbacks is the primary risk. If the GIL is held when the Rust callback fires, and Python code in a different thread is waiting to acquire the GIL, a deadlock is possible. The safe pattern is: Rust fires the callback, callback acquires the GIL, calls the Python function, releases the GIL. The `pyo3` documentation on `Python::with_gil` is the reference. Write a GIL deadlock test before shipping.

**Step 5: TypeScript bindings via napi-rs (week 6)**

Add:
- `@lattica/es` npm package using `napi-rs`
- TypeScript wrappers with full type definitions
- Promise-based async API (all store operations return `Promise<T>`)
- Node.js event emitter for subscriptions (avoids callback threading complexity)
- napi build configuration with pre-built binaries for the development platform (linux x86_64)

**Exit criterion:** The LumaWeave time-travel viewer prototype (Section 7) can read 1,000 events from the store using the TypeScript bindings from within a Vite dev server. TypeScript types are complete (no `any` in the public API surface).

**Risks at step 5:** The napi-rs build requires the Rust toolchain to be configured with the correct target for the Node.js ABI. The Tauri setup already handles this; verify that the existing Tauri Rust toolchain produces a compatible napi binary without a separate toolchain installation.

**Step 6: Agent trace adapter (weeks 7–8)**

Add:
- Standard event payload types for `llm_call`, `llm_response`, `tool_call`, `tool_result`, `reasoning_step`
- `AgentTraceRecorder` — a Rust struct with methods for each event type, managing the causation chain automatically
- Python wrapper `AgentTraceRecorder` for Cerebra and Policy Scout
- OTel GenAI span exporter (Rust, tokio async, targets `localhost:4317`)
- Deterministic replay runner (Rust, reads a session stream, replays non-deterministic tool calls, returns final state)

**Exit criterion:** A synthetic Cerebra retrieval session (20 events, 3 tool calls) is recorded, exported to OTel (verify spans appear in Grafana Tempo), and replayed deterministically (verify final state matches original). The replay must complete without invoking any actual tools — all tool results are served from storage.

**Risks at step 6:** The OTel exporter adds a `tokio` async runtime dependency. The Rust core is currently synchronous (by design — reducers are synchronous). The exporter must run on a separate tokio runtime spawned in a background thread, not on the main store thread. This is a known-acceptable trade-off: the exporter is explicitly async-I/O (network calls), while the store is explicitly sync (SQLite calls). They must not share a runtime.

**Step 7: Time-travel viewer (weeks 9–10)**

Add:
- `TimeTravelViewerTile` React component, registered in `tileSectionRegistry`
- Canvas-based timeline renderer (one swim lane per selected stream)
- Scrubber interaction (mouse drag, keyboard navigation)
- State panel (current reducer state at scrubber position)
- Diff panel (state delta between two scrubber positions)
- Stream/type/time filters
- Branch visualization (branch overlay with divergence diamonds)

**Exit criterion:** Open the time-travel viewer in LumaWeave's panel system with a store containing 5,000 events across 4 streams. The scrubber moves smoothly at 60fps. Selecting two scrubber positions shows the correct state delta. The branch view correctly shows a branched session from the Cerebra trace adapter integration test.

**Risks at step 7:** Canvas rendering at 60fps for 5,000 events requires careful culling — only events in the visible time window should be rendered. The initial implementation will use a simple O(n) scan with a time-range index; if performance is inadequate, a segment tree index over the `events` table indexed by timestamp will be added. Profile before optimizing.

### Phase 6 exit criteria

Phase 6 is complete when:

1. The `lattica-es` crate passes all unit tests including concurrent access, branch operations, and snapshot correctness.
2. The Python bindings run the Cerebra and Policy Scout bridge adapters in production against real data from each module.
3. The TypeScript bindings serve the time-travel viewer in LumaWeave in production.
4. The agent trace adapter records a complete Cerebra retrieval session (real session, not synthetic) and exports valid OTel GenAI spans visible in Grafana Tempo.
5. The time-travel viewer correctly shows the canonical/live diff for the LumaWeave graph state.
6. The Cerebra and Policy Scout event stores are bridged and visible in the cross-module event timeline in Lattica.
7. All existing LumaWeave Playwright tests pass (no regressions from the ES integration).
8. No new `console.log` or diagnostic instrumentation is committed to the main branch.

### Known unknowns entering Phase 6

- **SQLite contention under multi-module write load.** All modules share `~/.lattica/events.db`. SQLite WAL mode supports concurrent readers but serializes writers. If Cerebra's embedding pipeline, Policy Scout's audit daemon, and the bot's conversation recorder are all writing simultaneously, writer contention may introduce latency spikes. Mitigation: measure write latency under synthetic concurrent load before deploying the shared store; fallback option is per-module SQLite files with a read-aggregator layer.

- **msgpack schema evolution.** As modules evolve, event payload schemas will change. The `type_version` field in the events table is the versioning hook, but no migration tooling exists yet. The plan is to treat `type_version` as documentation in Phase 6 and address schema migration tooling in Phase 10 (evaluation platform) where versioned payload schemas become a first-class concern.

- **napi-rs binary distribution.** The `@lattica/es` package will include a pre-built native addon binary. Tauri's build pipeline will need to include the napi binary in the application bundle. This is standard practice but has not been validated in the LumaWeave Tauri build configuration yet. Validate early in Step 5.

- **PyO3 build in the uv workspace.** The Python workspace uses `uv`. PyO3 extensions built with `maturin` may require explicit integration with `uv`'s dependency resolution. The `maturin` + `uv` combination is documented but relatively new; test the build pipeline in CI before committing to it as the standard build path for Python modules.