# Fossic — Lattica Capability Inventory

**Project:** fossic
**Author:** Fossic Claude (acting as fossic advocate)
**Date:** 2026-06-13
**Status:** Initial capability inventory

This document catalogs what fossic structurally can visually represent.
It is not a list of tile requests — Lattica decides which capabilities
become which tiles in which views. This is the substrate inventory
fossic can provide.

Capabilities are grouped into three categories: substrate (universal,
work on any stream), semantic (event-type-aware, require payload
knowledge), and operational (fossic's own state).

For each capability, fossic specifies:
- **What it shows** — the visual content
- **Data source** — which fossic API provides it
- **Refresh model** — live subscription, on-demand query, hybrid
- **Composition hints** — what this pairs well with
- **Fossic-side contract** — what fossic guarantees, what's left to
  Lattica

---

## Substrate capabilities

These work on any fossic stream regardless of consumer. They're the
universal lenses.

### S-001 — Event timeline
**What it shows:** Chronological events for selected streams, with
version, timestamp, event_type visible.

**Data source:** `read_range` for historical, `subscribe` for live.

**Refresh model:** Hybrid — initial historical load, then live
subscription for new events.

**Composition hints:** Pairs with payload viewer (semantic), causation
walker (substrate), scrubber (substrate).

**Fossic-side contract:** Events delivered in version-monotonic order
within each stream. Cross-stream ordering by commit timestamp. Sub-50ms
live delivery in PostCommit mode. Degraded subscriptions surface
explicit state (not silent dropping).

---

### S-002 — Density heatmap
**What it shows:** Events-per-unit-time over a window, colored by
event_type. Shows burst patterns and rhythm at a glance without
reading individual events.

**Data source:** `aggregate` query with time-bucketing client-side, or
streaming aggregation client-side from subscription.

**Refresh model:** Live with sliding window.

**Composition hints:** Pairs with timeline (zoom from heatmap to
timeline at clicked region).

**Fossic-side contract:** Timestamps are commit-time, not event-time
(events don't have user-specified timestamps).

---

### S-003 — Causation walker
**What it shows:** DAG of events linked by causation_id, walked
forward and backward from a selected event. Cross-stream chains
rendered when causation crosses stream boundaries.

**Data source:** `walk_causation(event_id, direction, max_depth)`.

**Refresh model:** On-demand query, refreshable as new events arrive.

**Composition hints:** Pairs with timeline (click event → expand
causation), payload viewer (click node → see payload).

**Fossic-side contract:** Returns full StoredEvent records, not just
IDs — Lattica has everything needed to render without follow-up
queries. Depth-limited; unlimited depth available but caller's
responsibility to handle large results.

---

### S-004 — Branch tree
**What it shows:** Tree of branches for a stream, with lifecycle
states (ephemeral/promoted/dead_end) visually distinguished.
Divergence points marked with parent event reference.

**Data source:** `list_branches(stream_id)` plus per-branch
metadata.

**Refresh model:** On-demand; branches don't change frequently.

**Composition hints:** Pairs with branch comparison (S-005),
timeline (selecting a branch filters the timeline to that branch).

**Fossic-side contract:** Main branch is implicit; not returned by
list_branches. Branch info includes id, parent_id, parent_version,
lifecycle, description, alternatives.

---

### S-005 — Branch comparison
**What it shows:** Diff between two branches from their divergence
point — events present in one but not the other, payload differences
for events shared but differing.

**Data source:** `read_range` on each branch, client-side diff.

**Refresh model:** On-demand.

**Composition hints:** Pairs with branch tree (S-004) for branch
selection.

**Fossic-side contract:** Branches share events up to divergence
point; diff is meaningful only from divergence onward.

---

### S-006 — Time-travel scrubber
**What it shows:** Scrub a timeline; for streams with registered
reducers, show derived state at scrubber position. Multi-stream
synchronized scrubbing supported (advance multiple streams by
matching wall-clock time).

**Data source:** `read_state_at_version(stream, branch, version,
reducer_name)`.

**Refresh model:** On-demand at each scrubber position change.

**Composition hints:** Pairs with timeline, payload viewer, state
delta viewer.

**Fossic-side contract:** Reducer state queries require reducer
registration. Pattern-based reducers; specificity ranking resolves
which reducer applies. Returns reducer state as opaque bytes;
deserialization is consumer-side (fossic-py exposes serialized
state; consumers deserialize per their reducer's schema).

---

### S-007 — Correlation grouping
**What it shows:** Events grouped by correlation_id — the "this
work session" or "this request" identifier. Within a correlation,
events are typically causally related but may span streams.

**Data source:** `aggregate` filtered by correlation_id.

**Refresh model:** On-demand or live (subscribe with client-side
correlation filtering).

**Composition hints:** Pairs with timeline (correlation as
swim-lane grouping), causation walker (causation within a
correlation is the common case).

**Fossic-side contract:** correlation_id is consumer-set; fossic
doesn't validate semantics, just indexes for query.

---

## Semantic capabilities

These require knowledge of specific event payloads. Each consumer
contributes semantic lenses for their event types via a renderer
plugin mechanism (TBD with Lattica Claude).

Fossic itself contributes semantic lenses for the standard agent-
trace types (llm_call, llm_response, tool_call, tool_result,
reasoning_step) — these are fossic-owned.

### M-001 — LLM conversation view
**What it shows:** For `llm_call`/`llm_response` paired events,
render as a conversation — role-colored bubbles, parameters in
metadata sidebar, finish_reason and usage stats inline.

**Data source:** Standard agent-trace event types.

**Refresh model:** Live subscription within selected stream.

**Composition hints:** Pairs with tool invocation view (M-002) when
tool calls happen mid-conversation.

**Fossic-side contract:** Renderer ships with fossic. Standard
agent-trace payload schemas in AGENT_TRACE_VOCABULARY.md §3.

---

### M-002 — Tool invocation view
**What it shows:** For `tool_call`/`tool_result` paired events,
show tool name prominently, arguments and results in expandable
blocks, determinism flag indicated.

**Data source:** Standard agent-trace event types.

**Refresh model:** Live subscription.

**Composition hints:** Pairs with LLM conversation view (M-001) when
embedded in larger LLM flows.

**Fossic-side contract:** Renderer ships with fossic.

---

### M-003 — Field histogram
**What it shows:** For any numeric payload field across selected
events, render distribution as histogram.

**Data source:** Client-side aggregation from subscription or
`read_range`.

**Refresh model:** Live with rolling window or on-demand snapshot.

**Composition hints:** Pairs with field time series (M-004),
outlier surfacing (M-005).

**Fossic-side contract:** Universal renderer; works on any numeric
field. Field path specified as dot-notation. Type coercion: numeric
strings counted; non-numeric values excluded with explicit count
of exclusions.

---

### M-004 — Field time series
**What it shows:** For any numeric payload field, render as time
series. Multi-field overlay supported.

**Data source:** Client-side from subscription/read_range.

**Refresh model:** Live with sliding window.

**Composition hints:** Pairs with scrubber (M-004 + scrubber
position annotation), correlation grouping (show field trajectory
per correlation).

**Fossic-side contract:** Universal; works on any numeric field.

---

### M-005 — Outlier surfacing
**What it shows:** Events whose payload field values are
statistical outliers (configurable: 2σ, 3σ, percentile-based).

**Data source:** Client-side from accumulated subscription.

**Refresh model:** Live with running statistics.

**Composition hints:** Pairs with timeline (highlight outliers on
the timeline view).

**Fossic-side contract:** Universal.

---

## Operational capabilities

These show fossic's own state. fossic-owned, not consumer-specific.

### O-001 — Subscription health
**What it shows:** For each active Lattica subscription, queue
depth, degraded status, events/second, last event timestamp.

**Data source:** Subscription introspection API (currently
exists but underdocumented — worth a fossic-side polish to
formalize).

**Refresh model:** Live polling, every ~1s.

**Composition hints:** Standalone operational tile.

**Fossic-side contract:** `is_degraded()` and queue introspection
exist. Worth a small fossic-side pass to formalize the
introspection API and document it. Filing as PD-010.

---

### O-002 — Cursor positions
**What it shows:** Per-stream, all known cursor positions across
consumers, with lag indicator relative to stream head.

**Data source:** `list_cursors(stream_id)` or similar (currently
not a public API — worth adding).

**Refresh model:** Live polling.

**Composition hints:** Pairs with timeline (cursor positions
overlaid on timeline).

**Fossic-side contract:** Cursor enumeration is a small fossic-side
addition. Filing as PD-011.

---

### O-003 — System event log
**What it shows:** Chronological view of `_fossic/system` stream
events: Purged, SubscriptionDegraded, ShreddedStreamMarker, etc.

**Data source:** Subscription to `_fossic/system` with
include_system=true.

**Refresh model:** Live.

**Composition hints:** Pairs with subscription health (O-001),
purge audit view.

**Fossic-side contract:** _fossic/system stream events have stable
schemas (documented in FOSSIC_V1_SPEC.md §16).

---

### O-004 — Store metadata
**What it shows:** Open stores, file paths, declared streams per
store, current head versions, total event counts.

**Data source:** `list_streams()`, `stream_head_version()`, store
introspection APIs.

**Refresh model:** On-demand, refresh on user action.

**Composition hints:** Standalone tile or as part of an
operational dashboard.

**Fossic-side contract:** APIs exist; documentation may need polish.

---

## Composition patterns we anticipate Lattica will want

These aren't requirements; they're hints to Lattica Claude about
what composition shapes pair well based on use case.

### Deep-dive on one consumer
Timeline (S-001) + that consumer's semantic lenses + causation
walker (S-003) pinned for selected events.

### Cross-project debugging
Multi-stream timeline (S-001) + cross-stream causation graph
(S-003) + correlation grouping (S-007).

### Platform operational view
Subscription health (O-001) + cursor positions (O-002) + system
event log (O-003) + store metadata (O-004).

### Exploration / unknown territory
Density heatmap (S-002) + event type histogram (M-003 generalized)
+ scrubber (S-006) with payload viewer.

### Counterfactual exploration
Branch tree (S-004) + branch comparison (S-005) + scrubber (S-006)
spanning branches.

### Performance / load investigation
Field histogram (M-003) for latency/token counts + field time
series (M-004) for trajectories + outlier surfacing (M-005) for
anomalies.

---

## What fossic doesn't represent visually

For clarity:

- **Real-time updates from external systems** — fossic is local, not
  a hub for external feeds. If you want Discord activity in Lattica,
  Bo emits to fossic and Lattica reads from there.
- **Direct file system view** — fossic stores events about file
  operations (rhyzome writes a file, that emits an event), but doesn't
  expose the file system itself.
- **Code execution** — fossic doesn't run anything; consumers do, and
  emit events about what they did.
- **Schema validation** — payloads are opaque to fossic core. Schema
  validation, if Lattica wants it, is client-side per event type.

---

## Outstanding questions for Lattica Claude

1. **Semantic lens plugin mechanism.** How do consumers contribute
   their type-aware renderers? Bundled into Lattica? Loaded as plugins?
   Defined in consumer projects and discovered at runtime? Each model
   has tradeoffs.

2. **Composition primitives.** What are the fundamental layout
   primitives Lattica exposes for tile composition? Grid? Splits?
   Free-form positioning? This affects how the composition patterns
   above translate to actual tile arrangements.

3. **Theming token interaction.** When LumaWeave theming gets
   migrated, semantic lenses need theme-aware rendering. What's the
   theme token vocabulary that lens authors should target?

4. **Multi-store support.** Will Lattica connect to one fossic store
   or potentially multiple (e.g., per-project stores)? This affects
   the substrate lens APIs.

5. **Bookmarks and persistence.** Lattica's own UI state (saved
   filter expressions, bookmark positions, layout preferences) needs
   to persist. Use fossic for this? Separate config storage? Could go
   either way.

---

## Fossic-side action items surfaced by this inventory

A few small fossic-side polish items surfaced while writing this:

- **PD-010** — formalize subscription introspection API
  (`is_degraded()` exists; queue depth, events/second, last event
  timestamp need documenting/exposing)
- **PD-011** — add cursor enumeration API (`list_cursors(stream_id)`)
- **PD-012** — TypeScript SDK with React hooks for fossic-node, for
  Lattica development ergonomics

These don't block Lattica planning; they land as fossic v1.0.x patch
releases when Lattica needs them.

---

*End of fossic capability inventory. Status: open for Lattica Claude
review and composition planning. Locked decisions go in
fossic/decisions.md after group rounds.*