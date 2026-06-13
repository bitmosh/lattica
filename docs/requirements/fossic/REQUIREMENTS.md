# Fossic — Lattica Requirements

**Project:** fossic
**Author:** Fossic Claude (acting as fossic advocate)
**Date:** 2026-06-13
**Status:** Initial requirements deposit

Fossic is a local-first event sourcing library. From Lattica's
perspective, fossic is the substrate that makes cross-project
observability possible — every consumer project (Cerebra, rhyzome,
bons.ai, Policy Scout, LumaWeave, Bo) emits events to a shared
fossic store. Lattica reads those events.

This document lists what fossic-as-substrate needs from Lattica to
make the observability story coherent. Items are prioritized;
must-haves are tile-level capabilities, nice-to-haves are polish.

---

## R-F-001 — Live event stream view with subscription
**Category:** Tile design
**Priority:** Must-have

Lattica needs to render fossic events as they commit, across selected
streams. Specifically:

- Subscribe to fossic stream patterns via glob (`cerebra/agent-trace/*`,
  `rhyzome/repair/*`, etc.)
- Render events as they arrive with low latency (~50ms from commit
  to visible)
- Filter by event type within selected streams
- Filter by payload field expressions (e.g., `signal_score < 0.5`)
- Handle subscription degradation gracefully — when fossic's
  PostCommit queue overflows, show degraded state explicitly, don't
  silently drop events

**Why it matters:** This is the core observability use case. Without
it, Lattica doesn't earn its place as a unique surface; every
consumer already has its own activity log. The "see everything
happening right now across all projects" view is what only Lattica
can provide.

**Constraints we're aware of:** Tauri frontend talks to fossic via
the `fossic-tauri` companion crate. The subscription API is async;
the frontend needs to handle event delivery via Tauri's IPC events
mechanism (the companion crate already provides this).

**Adjacent project awareness:** All projects benefit from this; not
fossic-specific.

---

## R-F-002 — Time-travel scrubber with reducer state
**Category:** Tile design
**Priority:** Must-have (post-MVP)

Lattica should expose fossic's time-travel capability as a primary
interaction. Specifically:

- Scrub a timeline to any point in any selected stream
- Show events at or near the scrubber position with full payload
- Show reducer state at scrubber position (via
  `read_state_at_version`)
- Support multi-stream synchronized scrubbing (advance both
  `cerebra/agent-trace/*` and `lumaweave/graph/*` together)

**Why it matters:** "What was the state when this happened?" is the
fundamental debugging question. Fossic supports the answer
structurally; Lattica should surface it visually.

**Constraints:** Reducer state queries require knowing which reducer
to apply. The selection UI needs to map stream-pattern to
registered-reducer (the matching is via fossic's pattern specificity
ranking).

---

## R-F-003 — Cross-stream causation visualization
**Category:** Tile design
**Priority:** Must-have (post-MVP)

Fossic events have causation_id chains. Across streams, these form a
DAG. Lattica should render the DAG for selected events.

- Click any event → show causation chain forward and backward
- Render as a directed graph with stream-color-coded nodes
- Depth control (1, 3, unlimited)
- Cross-project chains rendered correctly when causation crosses
  stream boundaries (Cerebra emits → LumaWeave consumes → emits its
  own event referencing Cerebra's)

**Why it matters:** This is the killer feature for cross-project
debugging. "Why did this happen?" becomes traceable across project
boundaries. No other tool in the platform provides this.

**Constraints:** Uses fossic's `walk_causation` API (forward and
backward, depth-limited). Performance is good for shallow chains;
deep chains (depth > 20) may need pagination.

---

## R-F-004 — Subscription health dashboard
**Category:** Tile design
**Priority:** Nice-to-have

For each active subscription Lattica has open, show:
- Queue depth
- Degraded status (red/green)
- Events per second over last N seconds
- Last event timestamp

**Why it matters:** Without this, a degraded subscription silently
drops events and Lattica shows incomplete data — worse than no data
because it's confidently wrong. Operational visibility into the
observation layer itself.

**Constraints:** Requires fossic-side `is_degraded()` and queue
introspection APIs, which exist but aren't well-documented yet.
Worth a small fossic-side polish to document and ergonomically
expose subscription introspection.

---

## R-F-005 — Branch lifecycle visualization
**Category:** Tile design
**Priority:** Nice-to-have

Fossic branches have lifecycle states (ephemeral, promoted,
dead_end). Lattica should render these visually:
- Ephemeral: transient styling, dimmed
- Promoted: solid, prominent
- Dead-end: visible but marked terminated

**Why it matters:** When projects use branching for counterfactual
exploration (rhyzome's "what if strategy B?", bons.ai's mutation
exploration), the lifecycle tells the story of what alternatives
were tried and which won.

---

## R-F-006 — Type-aware event payload rendering
**Category:** Tile design
**Priority:** Must-have

Each event type has a payload schema. Lattica should render
type-aware:
- `llm_call`: role-colored message bubbles, parameters sidebar
- `tool_call`/`tool_result`: paired blocks with tool name prominent
- `SignalEvaluated`: signal name and score with visual indicator
- `LeewayGrantApplied`: permitted/forbidden styling
- Cerebra cycle events: lifecycle visualizations matching the
  cycle's structure
- Unknown types: pretty-printed JSON fallback

**Why it matters:** The difference between "I can see events" and
"I can understand what's happening." Raw JSON is the floor; type-
aware rendering is what makes the tool actually useful.

**Constraints:** The renderer registry needs to be extensible
without modifying Lattica core — new consumers should be able to
register payload renderers for their event types. Probably a
plugin-style registration mechanism.

**Adjacent project awareness:** Each consumer probably wants to
contribute their own payload renderers. Cerebra would contribute
renderers for cycle runtime events; rhyzome for repair events;
etc.

---

## R-F-007 — Cursor management visualization
**Category:** Tile design
**Priority:** Nice-to-have

Show all active cursors across consumers:
- Each cursor's position relative to stream head (lag indicator)
- Ability to manually advance/rewind cursors for testing

**Why it matters:** Debugging subscription state. When a consumer is
behind, knowing how far behind matters.

---

## R-F-008 — TypeScript SDK with React hooks
**Category:** Integration — fossic-side
**Priority:** Nice-to-have

This is a request from fossic to itself, but worth noting in Lattica
context: a higher-level fossic-node SDK with React hooks like
`useStreamSubscription(pattern)`, `useEventsAt(timestamp)`,
`useCausationChain(event_id)` would make Lattica development
substantially faster.

**Why it matters:** Without this, Lattica developers work with raw
napi-rs bindings, which is awkward for React components. With it,
Lattica tile development is significantly more ergonomic.

**Constraints:** Not blocking — Lattica can be built against raw
bindings and the SDK retrofits later. But if the SDK lands first,
Lattica development is faster.

---

## What fossic doesn't need from Lattica

For clarity, explicit non-requirements:

- Lattica is not a write surface for fossic — consumers write,
  Lattica reads
- Lattica is not in the hot path of any fossic operation
- Lattica doesn't manage fossic deployment, lifecycle, or
  configuration
- Lattica doesn't need consumer-specific business logic; it
  renders the event stream and lets consumers make sense of their
  own events
- Lattica doesn't need to write to fossic except for its own
  internal UI state (e.g., bookmarks, saved filter expressions),
  which can live in a separate `lattica/ui/*` stream if Lattica
  wants to use fossic for its own persistence

---

## On the architectural shape

Lattica is a pure observer of fossic. It opens fossic in read-mostly
mode, subscribes to streams, renders. If Lattica crashes, no
consumer is affected. If Lattica is closed, events continue
accumulating in fossic for later viewing.

This shape is intentional. Coupling Lattica into the write path of
any consumer would create a dependency that violates the local-first
principle. Lattica being optional is a feature.

---

## Outstanding questions for Lattica Claude

1. **First tile selection.** Of the must-haves (R-F-001, R-F-002,
   R-F-003, R-F-006), which is the right starting point? Fossic's
   advocate vote: R-F-001 (live event stream view) as MVP because
   it's the lowest-complexity unique-value tile and demonstrates the
   shell-hosting-tiles pattern cleanly.

2. **Renderer extensibility mechanism.** R-F-006 requires consumer
   projects to contribute payload renderers. What's the registration
   model? Bundled into Lattica core? Loaded as plugins? Defined in
   consumer projects and discovered at runtime?

3. **Stream selection UX.** Multi-stream subscription is the common
   case. What's the selection UX — a checklist of known streams? A
   pattern-expression input? A saved-search registry?

4. **Theming hooks for type-aware payloads.** When LumaWeave's
   theming gets migrated into Lattica, type-aware payload renderers
   should respect the theme tokens. Worth coordinating with
   LumaWeave's advocate on the token vocabulary.

---

*End of fossic requirements deposit. Status: open for Lattica Claude
review. Lock decisions in fossic/decisions.md when committed.*