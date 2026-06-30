# Cerebra Read Adapter for lattica-es

*Design document — drafted 2026-06-12. Specifies what the Cerebra-side adapter needs to do, how Cerebra's existing event vocabulary maps to lattica-es event types, and what constraints Cerebra places on the adapter's behavior. Companion to ADR-002 (which establishes that lattica-es uses read adapters rather than migrating module-local event stores). Reference document for cross-Claude coordination during lattica-es design.*

---

## Purpose and scope

ADR-002 establishes that lattica-es does not replace Cerebra's `inspector_events` table. The table remains authoritative for Cerebra's internal cognitive operations. lattica-es instead provides a **read adapter** that surfaces `inspector_events` rows into the unified event vocabulary that Lattica's cross-module timeline and time-travel viewer consume.

This document specifies what the Cerebra-side of that adapter needs to provide. It is not a complete adapter specification — the lattica-es-side has its own concerns (registration, polling vs subscription, projection integration) that are out of scope here. What this document covers is everything the adapter implementer needs to know about Cerebra's event store, vocabulary, and semantic constraints.

The document is written to be passed to whoever is designing lattica-es's adapter layer. It is not an implementation specification for Cerebra itself — Cerebra continues to write to `inspector_events` exactly as it does today, with no schema changes and no API changes required for the adapter to work.

## What Cerebra's event store currently looks like

Cerebra's event store is a single SQLite table named `inspector_events`, accessed via Cerebra's Python code through the `cerebra/inspector/` module. The store has been the substrate for cognitive audit throughout Phases 1-5 of Cerebra's development and is the authoritative record of every cognitive operation Cerebra has performed.

The table's current schema, as of Migration009 with Phase 5 closed at v0.2.7:

```sql
CREATE TABLE inspector_events (
    event_id        TEXT PRIMARY KEY,
    event_type      TEXT NOT NULL,
    subject_type    TEXT NOT NULL,
    subject_id      TEXT NOT NULL,
    session_id      TEXT,
    occurred_at     INTEGER NOT NULL,
    data_json       TEXT NOT NULL,
    schema_version  INTEGER NOT NULL DEFAULT 1
);
```

Several properties matter for adapter design.

The `event_id` is currently a UUID generated at write time. It is not content-addressed in the lattica-es sense; two semantically identical events would have different event_ids. This means the adapter must compute synthetic content-addressed IDs at read time rather than using event_id directly.

The `subject_type` and `subject_id` together identify what the event is about. Cerebra's subject types include source, chunk, record, working_memory_item, tower_item, session, query, lattice_lineage, and others. The subject identifies the entity the event acted on, not the operation. This maps to lattica-es's notion of a stream (the entity being affected) plus the event itself.

The `session_id` is nullable. Events that happen outside an active session (ingestion, classifier operations, system-level events) have NULL session_id. Events within session context (working memory, tower, context) have a non-NULL session_id. This is a Cerebra-internal distinction; lattica-es may not care about it directly but should preserve it in the unified vocabulary so downstream consumers can filter session-scoped vs system-scoped activity.

The `occurred_at` is a Unix epoch in seconds (integer). Cerebra does not store millisecond precision in this column. This is a known limitation and is fine for cognitive operations (which happen at human-perceivable timescales), but the adapter should be aware that timestamp resolution is coarser than what lattica-es native events may provide.

The `data_json` is a JSON-encoded string containing event-type-specific payload. The schema of `data_json` is per-event-type and is documented elsewhere (cerebra/inspector/event.py defines the event types and their expected payload shapes). The adapter must parse `data_json` per event type to extract structured data.

The `schema_version` is currently 1 for all events. Future Cerebra migrations may bump this if event payload schemas change. The adapter must handle multiple schema versions gracefully (probably via a per-event-type upcaster registry, mirroring lattica-es's upcaster pattern).

## Event vocabulary inventory

Cerebra emits the following event types, organized by the cognitive phase that introduced them. The list is current as of v0.2.7 (Phase 5 close + Lattice Step 1) and will grow as further phases ship.

The structure of each entry: the Cerebra event_type name, what cognitive operation produced it, what subject_type it carries, what the data_json payload contains, and the proposed unified-vocabulary mapping.

### Phase 1-2 events (source ingestion and classification)

**SourceIngested**
- Produced when a source document enters the vault via `cerebra ingest`
- Subject type: `source`, subject_id: source_id (a UUID)
- Payload: `{path, content_hash, parse_warnings, chunks_created, token_count}`
- Proposed unified type: `source_ingested`

**ChunkExtracted**
- Produced for each chunk derived from a source during ingestion
- Subject type: `chunk`, subject_id: chunk_id
- Payload: `{source_id, position, content_hash, token_estimate, chunk_text}`
- Proposed unified type: `chunk_extracted`

**RecordClassified**
- Produced when a chunk gets its SKU classification (top-1 commit)
- Subject type: `record`, subject_id: record_id
- Payload: `{chunk_id, sku_address, confidence, classifier_version, model}`
- Proposed unified type: `record_classified`

**ClassificationDistributionRecorded**
- Produced alongside RecordClassified, captures the full distribution
- Subject type: `chunk`, subject_id: chunk_id
- Payload: `{distribution: {category_d1: confidence}, top_1, threshold}`
- Proposed unified type: `classification_distribution_recorded`
- Note: this event is the substrate for the dark matter / shadow capture work; the adapter should preserve the full distribution

### Phase 3 events (storage and index layer)

**EmbeddingComputed**
- Produced when a record gets vector-embedded
- Subject type: `record`, subject_id: record_id
- Payload: `{embedding_model, model_version, dim, latency_ms}`
- Proposed unified type: `embedding_computed`

**LexicalIndexed**
- Produced when a record enters FTS5 lexical index
- Subject type: `record`, subject_id: record_id
- Payload: `{indexer_version, tokens_count}`
- Proposed unified type: `lexical_indexed`

**GraphEdgeAdded**
- Produced when a structural or semantic edge is written
- Subject type: `graph_edge`, subject_id: edge_id
- Payload: `{from_node_id, to_node_id, edge_type, edge_subtype}`
- Proposed unified type: `graph_edge_added`

**IndexStateUpdated**
- Produced when an index's freshness state changes
- Subject type: `index`, subject_id: index_name
- Payload: `{old_state, new_state, records_affected}`
- Proposed unified type: `index_state_updated`

### Phase 4 events (retrieval orchestration)

**QueryReceived**
- Produced when a query enters the retrieval pipeline
- Subject type: `query`, subject_id: query_id
- Payload: `{query_text, query_source, vault_path}`
- Proposed unified type: `query_received`

**QueryPlanned**
- Produced after the planner classifies the query into D1 categories
- Subject type: `query`, subject_id: query_id
- Payload: `{sku_d1, mode, keywords_matched, planner_version}`
- Proposed unified type: `query_planned`

**TraversalStepCompleted**
- Produced after each of the six traversal steps in retrieval
- Subject type: `query`, subject_id: query_id (same as parent QueryPlanned)
- Payload: `{step_number, step_name, candidates_added, candidates_total}`
- Proposed unified type: `traversal_step_completed`
- Note: six of these fire per query; lattica-es should probably treat them as span events on the query span rather than separate top-level events

**SalienceScored**
- Produced after composite salience is computed for all candidates
- Subject type: `query`, subject_id: query_id
- Payload: `{candidates_scored, weight_profile, score_floor}`
- Proposed unified type: `salience_scored`

**ContextPacketBuilt**
- Produced when the final ContextPacket is assembled
- Subject type: `query`, subject_id: query_id
- Payload: `{packet_id, selected_count, packet_version, abstained}`
- Proposed unified type: `context_packet_built`

**RetrievalAbstained**
- Produced when retrieval refuses to commit (best score below floor)
- Subject type: `query`, subject_id: query_id
- Payload: `{best_score_seen, floor_used, abstention_rationale}`
- Proposed unified type: `retrieval_abstained`

### Phase 5 events (working memory and truth tower)

**WorkingMemoryCreated**
- Produced when a new session starts and gets its working memory
- Subject type: `session`, subject_id: session_id
- Payload: `{vault_path, slot_capacities}`
- Proposed unified type: `working_memory_created`

**AttentionItemProposed**
- Produced before a working memory item insert is committed
- Subject type: `working_memory_item`, subject_id: wm_item_id
- Payload: `{session_id, slot_type, record_id, salience_score, is_synthetic}`
- Proposed unified type: `attention_item_proposed`

**AttentionItemPromoted**
- Produced after successful working memory insert
- Subject type: `working_memory_item`, subject_id: wm_item_id
- Payload: `{session_id, slot_type, record_id, salience_score, is_pinned}`
- Proposed unified type: `attention_item_promoted`

**AttentionItemEvicted**
- Produced when a working memory item is evicted
- Subject type: `working_memory_item`, subject_id: wm_item_id
- Payload: `{session_id, slot_type, reason, was_tower_cited}`
- Proposed unified type: `attention_item_evicted`

**AttentionItemDeferred**
- Produced when a promotion is rejected because slot is full of pinned items
- Subject type: `working_memory_item`, subject_id: proposed_wm_item_id
- Payload: `{session_id, slot_type, record_id, reason}`
- Proposed unified type: `attention_item_deferred`

**TowerInitialized**
- Produced exactly once per session, on first T1 promotion
- Subject type: `session`, subject_id: session_id
- Payload: `{session_id, t1_capacity, t2_capacity}`
- Proposed unified type: `tower_initialized`

**TowerItemPromoted**
- Produced when an item is added to the truth tower (T1 or T2)
- Subject type: `tower_item`, subject_id: tower_item_id
- Payload: `{session_id, tier, record_id, wm_item_id, salience_score, is_pinned, t1_citation_id}`
- Proposed unified type: `tower_item_promoted`

**TowerCrossReferenceAdded**
- Produced when a T2 item cites a T1 item (atomic with T2 promotion)
- Subject type: `tower_item`, subject_id: t2_tower_item_id
- Payload: `{session_id, citing_t2_id, cited_t1_id}`
- Proposed unified type: `tower_cross_reference_added`

**TowerItemEvicted**
- Produced when a tower item is evicted
- Subject type: `tower_item`, subject_id: tower_item_id
- Payload: `{session_id, tier, reason, stale_t2_count}`
- Proposed unified type: `tower_item_evicted`

**TowerItemStaled**
- Produced per T2 item marked stale due to T1 eviction
- Subject type: `tower_item`, subject_id: t2_tower_item_id
- Payload: `{session_id, citing_t1_id, evicted_at}`
- Proposed unified type: `tower_item_staled`

**TowerRendered**
- Produced when render_chronological or to_tower_field runs
- Subject type: `session`, subject_id: session_id
- Payload: `{render_format, t1_count, t2_count, stale_count}`
- Proposed unified type: `tower_rendered`

**WorkingMemoryRendered**
- Produced by cerebra memory status
- Subject type: `session`, subject_id: session_id
- Payload: `{format, slot_counts}`
- Proposed unified type: `working_memory_rendered`

### Lattice events (post-Phase-5 architectural addition)

**LatticeCommit**
- Produced when a chunk multi-commits to multiple SKU categories
- Subject type: `chunk`, subject_id: chunk_id
- Payload: `{sibling_record_ids, sibling_count, confidence_distribution, threshold_used, classifier_top_1}`
- Proposed unified type: `lattice_commit`

**LatticeSiblingResolved**
- Will be produced once Lattice Step 2 ships; captures retrieval-time sibling routing
- Subject type: `lattice_lineage`, subject_id: lattice_lineage_id
- Payload: `{siblings_considered, winner_record_id, routing_basis, query_sku_d1, winner_sku_d1, query_id}`
- Proposed unified type: `lattice_sibling_resolved`
- Note: not yet in production (Lattice Step 2 prompt drafted but not implemented as of v0.2.7)

## Synthetic content-addressed ID derivation

lattica-es uses `blake3(event_type + payload + causation_id)` as the content-addressed event ID for native events. Cerebra's events do not have content-addressed IDs; they have UUIDs assigned at write time.

The adapter must produce stable, deterministic content-addressed IDs for Cerebra events so they participate correctly in the unified timeline. The proposed derivation:

```
synthetic_id = blake3(
    unified_event_type +    # the mapped type per the inventory above
    data_json +              # the original payload, byte-identical
    event_id                 # the original UUID, serving as causation surrogate
)
```

The original `event_id` serves as the causation surrogate because it is unique per event in Cerebra's store, even if not content-derived. Including it ensures that two events with identical payloads (which can happen — same query run twice produces identical query_received payloads) get different synthetic IDs. Without this, the adapter would produce duplicate IDs and corrupt the unified timeline.

Once derived, the synthetic_id is stable. Re-running the adapter on the same `inspector_events` row produces the same synthetic_id. This means consumers of the unified timeline can rely on IDs being durable — caching, deduplication, and cross-reference all work correctly.

The adapter must persist the mapping from `event_id → synthetic_id` somewhere so that adapter restarts don't produce different IDs for the same source rows. A simple SQLite table managed by the adapter is sufficient:

```sql
CREATE TABLE cerebra_event_id_mapping (
    event_id         TEXT PRIMARY KEY,
    synthetic_id     BLOB NOT NULL,
    adapter_version  INTEGER NOT NULL,
    mapped_at        INTEGER NOT NULL
);
```

If `adapter_version` ever changes (because the unified vocabulary mapping or derivation logic changes), the adapter can re-derive IDs and migrate the mapping. The `adapter_version` field is the version safety net.

## Stream identification for Cerebra events

lattica-es organizes events into streams. The natural stream identification for Cerebra events follows from the subject_type and subject_id:

- Events about a source go in stream `cerebra/source/<source_id>`
- Events about a chunk go in stream `cerebra/chunk/<chunk_id>`
- Events about a record go in stream `cerebra/record/<record_id>`
- Events about a session go in stream `cerebra/session/<session_id>`
- Events about a query go in stream `cerebra/query/<query_id>`
- Events about a working memory item go in stream `cerebra/wm/<wm_item_id>`
- Events about a tower item go in stream `cerebra/tower/<tower_item_id>`
- Events about a lattice lineage go in stream `cerebra/lattice/<lattice_lineage_id>`

The `cerebra/` prefix namespaces Cerebra's streams against other modules' streams in the unified timeline. Policy Scout's adapter would use `policy_scout/` prefix; LumaWeave's adapter would use `lumaweave/` prefix; native lattica-es streams would use their own naming convention.

This stream identification is consistent with how Cerebra's events naturally aggregate. A query's lifecycle (received → planned → traversal steps → scored → packet built) lives in one stream. A session's lifecycle (created → many working memory operations → tower operations → eventually closed) lives in one stream. The unified timeline can present any of these stream-shaped views to consumers.

## Causation and correlation

Many Cerebra events carry data that implicitly references other events. For example, ContextPacketBuilt's payload includes `packet_id`, but the relevant TraversalStepCompleted events that contributed candidates aren't directly linked except via the shared `query_id` subject. lattica-es supports causation_id as a first-class concept; the adapter should populate it where possible.

The proposed causation mapping for Cerebra events:

For query-lifecycle events (QueryReceived through ContextPacketBuilt), the causation_id is the synthetic_id of the QueryReceived event for that query. Every subsequent query-lifecycle event has the same causation_id, anchoring it to the query that initiated the chain.

For session-lifecycle events (WorkingMemoryCreated through TowerRendered), the causation_id is the synthetic_id of the WorkingMemoryCreated event for that session.

For tower events that cite specific T1 items (TowerCrossReferenceAdded, TowerItemStaled), the causation_id is the synthetic_id of the cited T1's TowerItemPromoted event.

For lattice events that resolve sibling routing (LatticeSiblingResolved, when Step 2 ships), the causation_id is the synthetic_id of the QueryReceived event for the query that triggered the resolution.

For ingestion-lifecycle events (SourceIngested → ChunkExtracted → RecordClassified → EmbeddingComputed → LexicalIndexed), the causation chain follows the natural data dependency: each event's causation_id is the synthetic_id of its immediate upstream event.

The adapter must compute these causation_ids by looking up prior events in its mapping table. This is straightforward for in-session events (the session_id provides natural scoping) but requires a small amount of join logic for cross-event lookups. The lookups are bounded — each event has at most one causation_id, and the lookup is by indexed columns.

## Event ordering and timestamp resolution

Cerebra's `occurred_at` is Unix epoch in seconds. lattica-es native events likely store millisecond or microsecond precision. The adapter must handle the resolution mismatch without introducing ordering bugs.

Within a single second, multiple Cerebra events can occur (the classifier writes RecordClassified and ClassificationDistributionRecorded back-to-back; the retrieval pipeline writes six TraversalStepCompleted events in sequence). The adapter must preserve their original ordering.

The proposed approach: use the original `event_id` UUID as a secondary sort key when `occurred_at` is identical. UUID generation includes a monotonic component that approximates ordering even when timestamps tie. This is not a perfect solution (UUIDs are not strictly monotonic) but it is good enough for Cerebra's actual write patterns, which don't produce true concurrent writes within a single second.

The adapter exposes the original `occurred_at` as the event's timestamp in the unified timeline. Downstream consumers (the time-travel viewer, the diff layer) see Cerebra events at second-precision and lattica-es native events at finer precision. This is acceptable; the cognitive operations Cerebra performs happen at human-perceivable timescales where second-precision is the right granularity.

## What the adapter must NOT do

Several behaviors are explicitly forbidden to preserve Cerebra's authority over its own event store.

The adapter must not write to `inspector_events`. It is strictly read-only against Cerebra's store. Any need to record adapter-specific state (the synthetic ID mapping, the adapter's last-read cursor, error states) goes in adapter-owned tables, not in Cerebra's tables.

The adapter must not modify any Cerebra schema. If a future Cerebra migration changes the inspector_events schema, the adapter must update to handle the new schema rather than the other way around.

The adapter must not assume real-time read latency. Cerebra is a CLI-invoked process; the inspector_events table may have writes happening intermittently rather than continuously. The adapter should poll or subscribe with appropriate intervals, not assume sub-second freshness. For the cross-module timeline, a polling interval of 1-5 seconds is acceptable; the time-travel viewer can tolerate looking back into a stream that hasn't quite caught up to the absolute current state.

The adapter must not deduplicate based on payload similarity. Two Cerebra events with identical data_json but different event_ids are different events — they happened separately, even if they look the same. The synthetic_id derivation handles this correctly via the event_id inclusion; the adapter should not add its own deduplication logic on top.

The adapter must not depend on Cerebra-specific Python imports. The adapter is part of lattica-es and may be implemented in Rust (with the adapter logic in the Rust core) or Python (with adapter logic in PyO3-exposed code). Either way, it reads inspector_events through standard SQLite queries, not through Cerebra's Python module imports. This decouples lattica-es's adapter from Cerebra's release cycle.

## What Cerebra commits to

In exchange for the adapter being non-invasive, Cerebra makes a few commitments back.

The inspector_events schema is stable. Cerebra may add new columns in future migrations but will not remove or rename existing columns. New columns will be nullable so the adapter can ignore them gracefully.

The event_type vocabulary is append-only. New event types may be added; existing event types will not be renamed or repurposed. If a Cerebra event_type is deprecated, it stops being emitted but the existing rows remain valid and the adapter mapping for them continues to work.

The data_json payload schemas are versioned via schema_version. If a payload schema changes, the schema_version increments and the adapter's upcaster registry can handle the migration. The current schema_version is 1 for all events; future increments will be communicated explicitly when they happen.

The list of event_type strings is enumerable. Cerebra's `cerebra/inspector/event.py` module defines the full set as Python constants. The adapter can read this file (or be passed the list at registration time) to know which event types to expect. Unknown event types should be logged but not crash the adapter; Cerebra may emit new types between adapter releases.

The naming convention for new event types follows the existing pattern: PascalCase with the cognitive operation as the noun (TowerItemPromoted, LatticeCommit, AttentionItemDeferred). The adapter can probably handle naming convention parsing if needed but should not have to.

## Migration path for the existing 745 records

When the adapter is first deployed, Cerebra's dev vault already contains thousands of `inspector_events` rows from past cognitive operations. The adapter must handle this backfill gracefully.

The proposed approach: on first run, the adapter performs a one-time backfill pass over all existing inspector_events rows, computing synthetic_ids and writing them to the mapping table. Subsequent runs only process new rows (events with `event_id` not in the mapping table).

The backfill must be resumable. If it fails partway, restart picks up where it left off. The adapter's mapping table can have a `backfill_complete` flag column or equivalent state to track this.

The backfill should be ordered by `occurred_at` ascending, so the unified timeline gets historical events in their original temporal order. Downstream consumers that care about ordering (the time-travel viewer especially) can rely on the events arriving in causal order during backfill.

Performance estimate: with ~5000 inspector_events rows in a typical dev vault and ~1ms per blake3 computation, the backfill completes in a few seconds. Not an operational concern.

## What this design does and does not specify

This document specifies the Cerebra-side contract: what events exist, what their payloads look like, what the mapping to the unified vocabulary should be, how synthetic IDs derive, what causation patterns make sense, what the adapter must and must not do.

This document does not specify the lattica-es-side implementation: how the adapter registers, where adapter code physically lives in the repo, how the polling-vs-subscription model works, how projections built on top of the unified vocabulary are organized, what the API surface for consumers of the unified stream looks like. Those decisions belong to lattica-es's design and may be made independently of Cerebra's constraints.

The two sides meet at the unified event vocabulary. Cerebra commits to producing events that map cleanly into that vocabulary; lattica-es commits to consuming the mapped events without requiring further structure from Cerebra. The vocabulary itself is the contract.

## Open questions for cross-Claude coordination

A few specific decisions need resolution between Cerebra-side and lattica-es-side. These are flagged for explicit attention during the lattica-es design pass.

The unified event vocabulary naming convention. This document proposes snake_case unified event types (lattice_commit, tower_item_promoted) versus Cerebra's PascalCase native types (LatticeCommit, TowerItemPromoted). The convention should be consistent across all modules' adapters. If lattica-es prefers a different convention (CamelCase, kebab-case, etc.), the proposal here can be revised to match. The naming should be locked before adapter implementation begins.

The treatment of TraversalStepCompleted events. Six of these fire per query as part of the retrieval pipeline. They are semantically span events on the query span rather than top-level cognitive events. lattica-es may want to model them as nested spans inside the query stream rather than as separate stream entries. The Cerebra-side payload is sufficient to either; the modeling decision belongs to lattica-es.

The OTel export semantics for Cerebra events. Per ADR-002, OTel GenAI span export is supported from Phase 6. For Cerebra events specifically, what becomes a span and what becomes a span event needs to be decided. A reasonable mapping: query streams become parent spans, traversal steps become child spans, individual cognitive events become span events on the appropriate span. The detailed mapping can be deferred to OTel implementation time but worth flagging as a decision point.

The adapter's update cadence. Polling vs SQLite WAL subscription vs periodic full scans. Cerebra writes are intermittent (CLI-invoked, not continuous), so high-frequency polling produces mostly empty results. A polling interval of 1-5 seconds is recommended as a starting point; the actual cadence depends on lattica-es's read-latency requirements which Cerebra does not need to know about.

The migration path for Lattice Step 2's not-yet-emitted events. LatticeSiblingResolved is in the vocabulary inventory above but has not yet been produced by Cerebra (Step 2 prompt drafted but not implemented as of v0.2.7). The adapter should be designed to handle event types that don't yet exist, so that when Cerebra ships Step 2 the adapter doesn't need updating. This is probably already the natural behavior of an event-type-keyed mapping table, but worth confirming.

---

*This document is intended to be passed to whoever is designing lattica-es's adapter layer. Questions about Cerebra's event store, vocabulary, or semantic constraints can be addressed by reading this document; questions about lattica-es's internal design or consumer API are out of scope here. A reader new to the ADR-002 architecture should read that ADR first for the broader context.*
# Cerebra Read Adapter — Addendum: Event-Sourced Aggregate Proposal

*Addendum to cerebra_read_adapter_design.md — drafted 2026-06-12 following an architectural insight that emerged in design conversation. Proposes that Cerebra's relationship with lattica-es extends beyond a read adapter for inspector_events into a fuller event-sourced aggregate architecture where Cerebra's lattice nodes become aggregates with reducers in the lattica-es sense. Intended to be shared with Lattica Claude as a proposal for cross-Claude reaction.*

---

## What this addendum proposes

The original read adapter design treats the relationship between Cerebra and lattica-es as primarily a *read* relationship. Cerebra writes events to its own inspector_events table; lattica-es provides a read adapter that surfaces those events into the unified timeline. The relationship is one-directional and limited to observability.

This addendum proposes extending that relationship into a fuller event-sourced architecture where Cerebra's lattice nodes (multi-commit memory records and their siblings) become aggregates in the lattica-es sense — entities with identity, reducers, and state derived from accumulated events. The implication is that Cerebra becomes both a producer and consumer of lattica-es events, with its cognitive substrate's behavior shaped by aggregate state rather than by static row values.

This is a substantial architectural commitment. It changes what lattica-es needs to support for Cerebra specifically, and it changes how Cerebra reasons about its own data. The addendum specifies what changes, why it works architecturally, and what specific feedback lattica-es should provide before the proposal is committed.

## Why this proposal exists

The architectural insight emerged from working through several previously-separate concerns in the Cerebra design:

- The interpretive lattice multi-commits records at write time, but currently records are static after commit
- The witness substrate was specified as a separate aggregation layer over inspector events
- The cycle runtime needs continuous cognitive context but the event log provides discrete entries
- The dark matter substrate captured shadows in a parallel data structure to memory records
- Counterfactual cognition needed mechanism that wasn't yet designed

Each concern had a reasonable independent solution. Together they implied substantial architectural sprawl. The insight that resolves them: each is a different consumer of the same underlying event stream. The lattice node updating its state when promoted is observing events. The witness layer aggregating patterns is observing the same stream at coarser granularity. The cycle runtime reading current cognitive field is reading projections that derive from the stream. The dark matter substrate captures additional event types in the same stream. Counterfactual cognition branches the stream.

Once events become first-class and consumption varies, the parallel-layer architecture collapses. There is one event substrate. Multiple consumers operate against it. Each derives what it needs from the same events.

The full articulation of this pattern lives in the event_sourced_cognitive_substrate.md concept document. This addendum focuses on the implications for lattica-es specifically.

## What changes from the original adapter design

The original read adapter design assumes Cerebra continues writing to inspector_events as it does today, and lattica-es provides a read-only adapter that surfaces those events into the unified timeline. Cerebra's internal architecture is unchanged.

Under the proposed event-sourced aggregate architecture, Cerebra continues writing to inspector_events (no migration cost, no change to existing code), but *additionally* registers its lattice nodes as aggregates within lattica-es. The aggregate reducers fold events from the same stream the adapter is surfacing into the unified timeline.

The same event stream serves both purposes. The adapter surfaces events to consumers of the unified timeline. The lattica-es aggregate machinery folds events into reducers for Cerebra's lattice nodes. Cerebra reads aggregate state when its retrieval pipeline needs to know "what does this record know about its own usage history."

This means lattica-es is consumed by Cerebra in two distinct ways:

1. **As an event store and adapter** for the unified timeline (current design)
2. **As an aggregate runtime** that runs reducers over Cerebra's lattice node streams (proposed addition)

The two consumption patterns are independent in implementation. The unified timeline consumers see events; Cerebra's retrieval pipeline reads aggregate state. They don't need to coordinate. But they're consuming the same underlying lattica-es services, which is the elegance of the architecture.

## What lattica-es needs to support

The proposal does not require lattica-es features beyond what ADR-002 specifies. Specifically, it depends on:

**Aggregate identity and stream organization** — Each lattice node has a stream; the stream ID derives deterministically from the lineage identifier. Reading the node's current state means rehydrating the aggregate from its stream. This is core ES toolkit functionality.

**Pure synchronous reducers** — The reducer for a lattice node takes (current_state, event) and produces new_state with no I/O, no side effects, no async. ADR-002 already specifies this as the reducer contract.

**Reactive subscriptions** — The witness layer needs to be notified asynchronously when aggregate state changes. PyO3 exposes this as async generators per the ADR.

**Snapshot support** — Replaying every event from a stream's beginning becomes expensive at scale. Snapshots optimize this. ADR-002 specifies snapshots as optimization that must never be required for correctness.

**Branching** — Counterfactual cognition requires branching the event stream and replaying with modifications. ADR-002 specifies branching as a v1 capability.

All five capabilities are already in the lattica-es design. The proposal uses them in a specific configuration but does not request new features. This is important: the proposal does not extend lattica-es's scope; it intensifies Cerebra's consumption of lattica-es's existing scope.

## Specific architectural commitments the proposal implies

If lattica-es accepts this proposal as part of Cerebra's consumption pattern, several specific commitments follow:

**Cerebra's lattice nodes have streams in lattica-es.** Stream naming convention: `cerebra/lattice/<lineage_id>` per the adapter design, with all events affecting nodes in that lineage written to that stream. Single-commit (non-lattice) records also get streams: `cerebra/record/<record_id>`. The two patterns coexist; lattice members use the lineage stream, non-lattice members use the record stream.

**Cerebra registers reducers for these streams.** The reducer logic is Cerebra-side code, written in Python via the PyO3 adapter. lattica-es invokes the reducers when aggregate state is queried or when events arrive. The reducer is pure and synchronous per ADR-002's contract.

**Aggregate state is queryable through lattica-es.** Cerebra's retrieval pipeline asks lattica-es "what is the current state of aggregate X" and receives the folded state. Internally this might involve replay from a snapshot or full replay from stream beginning; the consumer doesn't need to know which.

**Subscriptions for the witness layer.** The witness layer subscribes to lattica-es streams asynchronously, receives event notifications, and updates its own witness-layer aggregates accordingly. Subscriptions are independent — the witness's subscription doesn't affect Cerebra's reducers, and vice versa.

**Snapshot cadence is calibrated.** Lattice nodes might accumulate many events over their lifetime. Snapshot cadence should be tuned so that aggregate rehydration is fast enough for Cerebra's retrieval latency requirements. Probably every 100 events per stream is a reasonable starting point per the original toolkit roadmap.

**Branch support for counterfactual queries.** When the cycle runtime or witness layer wants to ask "what would have happened if event X had been different," lattica-es's branching is the mechanism. The branch is created, replayed with the modification, and aggregate state on the branch is compared to the canonical state.

## What this changes for lattica-es's read adapter design

The original adapter design specified surfacing Cerebra's events into the unified timeline. Under this proposal, the adapter has the same surface but operates within a richer context.

The adapter's responsibilities remain:
- Read inspector_events rows from Cerebra's SQLite store
- Compute synthetic content-addressed IDs per the specified derivation
- Map Cerebra's event vocabulary to the unified vocabulary
- Surface events into lattica-es streams with proper causation chains
- Handle backfill of existing rows

The adapter's relationship to aggregates becomes:
- Events surfaced by the adapter feed both (a) the unified timeline consumers and (b) the aggregate reducers for Cerebra's lattice nodes
- The aggregate reducers are Cerebra-side code that lattica-es invokes
- The unified timeline consumers see the events; the aggregate machinery sees the folded state
- These are independent consumption patterns of the same underlying events

No additional adapter infrastructure is needed. The adapter's job is the same. What changes is that the events it surfaces are also consumed by aggregate reducers within lattica-es itself, producing the aggregate-state architecture Cerebra needs.

## Where this proposal might surprise lattica-es Claude

Several aspects of the proposal might warrant pushback or alternative framings:

**The volume of aggregates is substantial.** A typical Cerebra vault has hundreds to thousands of memory records, each potentially its own aggregate. If lattica-es's aggregate runtime is designed for tens of aggregates rather than thousands, the scaling assumptions might be wrong. Worth confirming that lattica-es can handle this volume gracefully.

**The reducer logic is Cerebra-specific.** lattica-es is being designed as a general-purpose event sourcing toolkit. Cerebra-specific reducers might feel like an inappropriate Cerebra concern leaking into the toolkit. The proposed pattern (consumer-registered reducers via PyO3) keeps the toolkit general while letting consumers customize their aggregate behavior; the question is whether this consumer registration pattern matches lattica-es's intended API.

**Async at the consumption boundary needs to be solid.** The proposed architecture relies on async subscriptions for the witness layer and for any other reactive consumer. PyO3 exposes async generators per ADR-002, but the actual subscription semantics (delivery guarantees, ordering across subscribers, backpressure) need to be specified. Worth confirming these are nailed down.

**The relationship to Cerebra's existing inspector_events isn't fully clear.** Cerebra writes events to its own SQLite table; lattica-es reads them via the adapter; the same events feed lattica-es aggregates. There are conceptually two storage layers (Cerebra's inspector_events and lattica-es's events table). The proposal doesn't migrate Cerebra's events into lattica-es's storage. Whether this dual-storage pattern is acceptable to lattica-es's architecture might need explicit confirmation.

**Counterfactual cognition uses branching in a specific way.** When Cerebra branches an event stream for counterfactual exploration, it's not for time-travel debugging (the original use case) but for cognitive operation. The branches might be short-lived (created for a single counterfactual query, then discarded) or persistent (kept around for ongoing reflection). Either way, lattica-es needs to handle the volume of branches the cognitive runtime might create. Worth confirming branching is intended to scale to this use pattern.

## What feedback Cerebra Claude needs from Lattica Claude

For this proposal to be committed, several specific questions need answers from the lattica-es side:

**Can lattica-es support thousands of aggregates per consuming project?** The volume of Cerebra's lattice nodes is non-trivial. If the toolkit assumes tens of aggregates, the design needs revision before Cerebra commits to this pattern.

**What does consumer-registered reducer logic look like in PyO3?** The reducer is Cerebra-side Python code, but it must satisfy lattica-es's pure synchronous reducer contract. How does the consumer register the reducer? How does lattica-es enforce purity? How does the consumer access the current aggregate state from non-reducer code (the retrieval pipeline)?

**How are async subscription semantics specified?** Delivery guarantees (at-least-once, at-most-once, exactly-once), ordering (across subscribers, within a single subscriber), backpressure (what happens when a subscriber falls behind), failure modes (subscriber crashes, network partitions if any). These need to be specified before Cerebra builds against them.

**What is the snapshot strategy for high-event-volume aggregates?** Lattice nodes that are heavily used could accumulate hundreds of events quickly. The default snapshot cadence (every 100 events) might or might not be appropriate. Worth understanding lattica-es's snapshot story for this volume.

**How does branching scale to many short-lived branches?** Counterfactual cognition might create branches frequently. Each branch shares storage with its parent per ADR-002, but there's still bookkeeping overhead. Confirm lattica-es expects to handle this branch volume.

**Is there an aggregate-state-changed event type that lattica-es emits, or does each consumer infer state changes from the underlying events?** The witness layer wants to know "this aggregate's state changed." It can either subscribe to all events affecting the aggregate and infer state changes from there, or it can subscribe to a higher-level "aggregate state changed" notification that lattica-es emits. The two patterns have different cost profiles.

These questions don't need to be answered before the proposal is shared with Lattica Claude. They're the substantive points where Cerebra's needs intersect with lattica-es's design choices, and they should be discussed as part of integrating this proposal into lattica-es's overall plan.

## What happens if lattica-es can't or won't support this pattern

The proposal is substantial enough that lattica-es might reasonably push back. If for any reason this isn't the right architecture for lattica-es to support:

**Cerebra can implement the aggregate pattern internally.** Cerebra-side Python code can subscribe to inspector_events (via the lattica-es adapter or via direct SQLite reads), maintain its own aggregate state in Cerebra-owned tables, and serve aggregate-state queries from Cerebra's own code rather than from lattica-es. This produces a worse architecture (Cerebra rebuilds infrastructure lattica-es could provide) but it remains workable.

**The witness layer can be Cerebra-internal.** Instead of being a lattica-es-aware service that observes aggregate state, the witness can be Cerebra-internal code reading inspector_events directly. Less elegant but functional.

**The shadow substrate falls back to the parallel-table design.** The dark matter document originally specified a separate `lattice_shadows` table; that design works if shadows aren't events in the unified stream.

The proposal is the *better* architecture, but Cerebra can fall back to less integrated architectures if needed. Worth flagging so Lattica Claude knows the proposal isn't a hard requirement — it's an opportunity to consolidate that benefits both projects.

## What Cerebra Claude commits to providing

In exchange for lattica-es supporting this consumption pattern, Cerebra makes specific commitments:

The reducer logic for lattice node aggregates is Cerebra-owned and Cerebra-maintained. lattica-es provides the runtime; Cerebra provides the cognitive substrate semantics.

The aggregate state schema is Cerebra-owned. lattica-es doesn't need to understand what state Cerebra's reducers produce; it just runs them and serves the results back.

The event vocabulary that affects Cerebra aggregates is documented in the read adapter design. New event types added by future Cerebra phases will be added to the vocabulary documentation.

The reducer contract (pure, synchronous, no I/O) is honored. Cerebra-side reducers will not violate this contract. If a cognitive operation needs I/O, it happens outside the reducer.

The aggregate volume and event volume are within lattica-es's expected scaling envelope. If Cerebra discovers it's producing more aggregates or events than lattica-es can handle, Cerebra will redesign the aggregation pattern (perhaps coalescing related records into single aggregates) rather than asking lattica-es to scale beyond its design.

## Summary

The proposal extends Cerebra's relationship with lattica-es from "read adapter consumer" to "event-sourced aggregate consumer." Cerebra's lattice nodes become aggregates with reducers that fold events into continuous state. The witness layer observes aggregate state. The cycle runtime operates against aggregate state. Counterfactual cognition uses branching.

The proposal does not require new lattica-es features; it intensifies Cerebra's use of features ADR-002 already specifies. It implies specific commitments around aggregate volume, reducer registration, async subscription semantics, snapshot cadence, and branch handling.

Specific feedback from lattica-es Claude is requested on the questions in the "What feedback Cerebra Claude needs from Lattica Claude" section. The proposal can be committed once those questions are resolved or, if lattica-es pushes back on aspects of the architecture, the alternatives in "What happens if lattica-es can't or won't support this pattern" provide fallback paths.

Either way, the conversation surfaces architectural commitments that benefit from explicit treatment before implementation begins.

---

*This addendum extends cerebra_read_adapter_design.md with the event-sourced aggregate proposal. The full articulation of the architectural pattern lives in event_sourced_cognitive_substrate.md. A reader new to either document should read the original read adapter design first for the contract Cerebra commits to providing, then the concept document for the architectural rationale, then this addendum for the lattica-es-side implications.*
