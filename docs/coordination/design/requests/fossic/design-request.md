# Design Request — fossic

## Section 1 — Project identity

- **Project name:** fossic
- **Filed by:** fossic-claude
- **Date:** 2026-06-15
- **Updated:** 2026-06-15 (architectural reframe — divisible-pane workspace, observability/diagnostics split, structural visualization framing)

---

## Section 2 — What this project contributes visually

Fossic is the **substrate** — not a project that emits domain events to display, but the store that all projects write to and read from. Its visual footprint is infrastructure health and optional topology. It does not contribute P-013 renderers for domain event types; it contributes a substrate status surface and (optionally) a substrate visualization tile.

**Always-on surface (ambient):**
- **FOSSIC STORE status panel** — store reachability and write-path health. Currently one of four status panels in the header. Communicates: is the substrate alive, can events be written.

**Optional visualization tile (the design question of this request — see Section 9):**
- **Stream activity** — which streams are active, their event rate, last event type, time since last event
- **Subscriber topology** — how many subscribers are attached to each stream; their health state (alive / degraded / dropped)
- **Cross-stream causation** — edges between events across stream boundaries (e.g., Cerebra's `ActionProposed` → Policy Scout's `CommandRequested` via `causation_id`)
- **Canary stream heartbeat** — the `lattica/canary` stream emits a `startup_ping` on every Lattica launch; its presence and recency prove the write path is alive end-to-end

---

## Section 3 — Visual priority hierarchy

**Highest priority (ambient; must register at-a-glance):**
- Is the fossic store reachable and writable? (binary: green / red)
- Are any subscribers degraded? (binary: clean / degraded indicator)
- Is event flow happening? (subtle activity pulse on active streams)

**Medium priority (visible without effort):**
- Number of active streams + subscriber count
- Per-stream activity rate (events/min or "quiet" state)
- Which streams are flowing vs. idle

**Low priority (diagnostic; open on investigation):**
- Individual event IDs
- Per-event payload content
- Causation chain depth statistics
- WAL file size, SQLite page count
- Store path (static configuration; not runtime signal)
- Subscriber queue fill levels (relevant only during degradation)

---

## Section 4 — What a glance should communicate

Within 2 seconds of looking at the fossic surface:

- "The fossic store is healthy — events can be written"
- "N streams are active; M subscribers attached across them"
- "Cerebra's agent-trace stream is flowing" (or: "quiet — no cycles running")
- "All subscribers healthy" (or: "1 subscriber degraded — amber indicator")

The fossic surface does not need to communicate event content. The event content is visible in the other projects' tiles (Cerebra, Policy Scout, etc.). Fossic's surface communicates **whether the plumbing is working**, not **what is flowing through it**.

---

## Section 5 — What doesn't matter at-a-glance

- Individual event IDs — internal identifiers; suppress in default view
- Causation chain depth — investigative, not ambient
- WAL file size in bytes — health is binary (OK or not); raw bytes add noise
- Store file path — static config; not a runtime signal worth showing
- Subscriber queue sizes when healthy — only relevant during degradation events
- Exact event counts — "N events today" is trivia; rate and recency matter more
- Content of events — that's the other projects' tile surfaces, not fossic's

---

## Section 6 — Cross-project visual relationships

Fossic's role in cross-project visuals is **infrastructure correlation**, not data adjacency:

- When Cerebra's tile shows a `SignalEvaluated` event and fossic's substrate shows Cerebra's stream active with 6 subscribers, that's the same event from two angles. The visual idiom should make this legible (e.g., identical stream path shown in both contexts: `cerebra/agent-trace/sess_6a9133171f5d`).
- When a subscriber goes degraded in fossic (queue overflow), the affected project's tile may stop receiving events. The fossic degradation indicator should be visually correlatable to the "quiet" state in that project's tile without requiring investigation to connect.
- The cross-stream causation visualization (Option C/D below) makes the Cerebra → Policy Scout `causation_id` link visible as an edge. This is a structural relationship that only fossic's substrate view can show — it's orthogonal to the per-project event feeds.

---

## Section 7 — Current implementation

Frontend-design is **encouraged to diverge**.

- **Current:** FOSSIC STORE status panel (one of four in the header row). Shows store health as a binary green state, canary stream indicator, tile registry count, POSTMESSAGE demo button.
- **What works:** binary health at-a-glance, ALL CAPS label treatment, the status panel idiom (terse; doesn't compete with tile content).
- **What doesn't work:** shows nothing about individual stream activity, no subscriber visibility, no flow rate, no degradation signal beyond store-level. Covers the substrate's existence but not its behavior.

---

## Section 8 — Constraints

- Fossic's Tauri commands expose: `fossic_list_streams`, `fossic_list_branches`, `fossic_read_range`, `fossic_subscribe`, `fossic_walk_causation`. All topology and event data is available via these IPC calls from the frontend.
- `fossic_subscribe(stream_pattern)` accepts glob patterns (`cerebra/agent-trace/*`, `**`). The visualization can subscribe to a meta-stream or poll via `fossic_list_streams` + per-stream `fossic_read_range` — the IPC surface supports both.
- No `fossic_stream_metrics` command exists yet. If the design calls for per-stream event rate or subscriber count, that capability needs to be added to fossic-tauri. Rate this as a potential small fossic pass if needed.
- `--portfolio-*` design token namespace (ADR-015).
- Monospace for event IDs and stream paths; sans-serif for chrome.
- The substrate visualization is read-only. Fossic doesn't take write commands from the UI.
- Update interval is a design parameter. Polling `fossic_list_streams` every 1-5 seconds is reasonable for ambient health; 50-500ms for live-flow visualization.

---

## Section 9 — Enumerated substrate visualization options

**Fossic enumerates the design space; developer + frontend-design choose the level of investment for this iteration.**

The options below are ordered from minimal to structurally ambitious. Each is a self-consistent design — not steps in a progression. The choice affects what fossic-tauri needs to expose (noted per option).

---

### Option A — Enhanced status panel (minimal)

**Surface:** header status panel, same location as current FOSSIC STORE.

**What it shows:**
- Store health: green dot (healthy) / red dot (unreachable / error)
- Stream count: `12 streams`
- Active subscriber count: `7 subscribers`
- Canary heartbeat: last ping timestamp (`canary 0:03 ago`)
- Degraded indicator: amber badge if any subscriber is degraded

**Observability axis:** pure observability. No diagnostic depth.

**Data sources:** `fossic_list_streams()` polled every 2-5s; canary stream `fossic_read_range` for last event timestamp.

**Fossic-tauri additions needed:** none (current IPC surface is sufficient if subscriber count is derived from `SubscriptionMap` state — requires exposing an active-subscriber count command, or deriving from stream metadata if fossic tracks this).

**Density behavior:** none needed — it's always one line per metric.

**When to choose:** design wants fossic's footprint to stay in the status panel row, not occupy a pane.

---

### Option B — Tabular stream dashboard (moderate)

**Surface:** fossic substrate tile in a pane (parameterized: `stream_glob="**"` to show all streams).

**What it shows:**
- Table: one row per stream. Columns: stream path, event count, last event type, time since last event, subscriber count, health indicator.
- Subscriber rows expandable under each stream: one row per subscriber, showing subscription pattern, delivery mode, degraded state.
- Sortable by: activity (most recent first), health (degraded first), stream path (alphabetical).
- Row highlight: degraded subscribers surface to top regardless of sort.

**Observability axis:** observability-heavy (table scan for health), with diagnostic capability (expand row for detail).

**Data sources:** `fossic_list_streams()` for stream list; per-stream `fossic_read_range(limit=1)` for last event; active subscriber state (requires new fossic-tauri command — see below).

**Fossic-tauri additions needed:** `fossic_list_subscribers()` command exposing active subscription state from `SubscriptionMap` (stream pattern, degraded flag, delivery mode). This is a small fossic-tauri pass.

**Density behavior (dense state):**
- Table rows compress to single-line summary at high stream counts
- A "show idle" / "hide idle" toggle suppresses streams with no activity in last N minutes
- Stream groups by prefix: `cerebra/agent-trace/*` collapses to one expandable row showing N matched streams

**When to choose:** design wants a scannable dashboard that surfaces health problems quickly without graph rendering complexity.

---

### Option C — Streams-as-flows structural visualization (structural)

**Surface:** fossic substrate tile. Visualization layout — **this is a real layout problem, not a styling problem.**

**What it shows:**

```
         [events as points on time axis → ]
stream A ●─────●───●──────────────────────●── → now
         └─ [sub: Lattica/cerebra-tile] 🟢
         └─ [sub: Cerebra/replay] 🟢

stream B ●──●────────────●────────────────── → now
         └─ [sub: Policy Scout/audit] 🟢

         ┆  causation link (↕ edge between events on different streams)
         ●─ ─ ─ ─ ─ ─ ─→●  (ActionProposed → CommandRequested)
```

- **Streams as horizontal flows:** each stream is a horizontal row with a time axis. Events appear as dots (or minimal marks) along the axis, newest at right.
- **Subscribers as nodes hanging below their stream:** each active subscriber is a node attached to its subscribed stream with a short vertical stem. Node color: green (alive), amber (degraded), gray (dropped handle).
- **Causation links as vertical edges:** when `fossic_walk_causation` reveals a cross-stream causation link, a vertical dashed line connects the two event dots across streams.
- **Activity indicators:** streams with recent events pulse; idle streams are muted.
- **Hover reveals:** hovering a stream row shows event rate. Hovering a subscriber node shows pattern, delivery mode, queue fill %. Hovering an event dot shows event type and timestamp. Hovering a causation edge shows the `causation_id`.

**Observability axis:** observability-heavy (layout encodes health at a glance — color, activity, topology) with diagnostic on hover/click.

**Data sources:** `fossic_list_streams()` + `fossic_subscribe("**")` for live events + `fossic_walk_causation` for edges + `fossic_list_subscribers()` (new command, same as Option B).

**Fossic-tauri additions needed:** `fossic_list_subscribers()` (same as Option B). The causation visualization benefits from a `fossic_query_causation_edges(since_ms)` to batch-query recent cross-stream links rather than walking per-event.

**Density behavior (the hard design problem):**
- **10+ streams, 20+ subscribers, hundreds of events/minute:** the flows layout becomes visually saturated.
- **LOD strategies:**
  - *Level 0 (sparse):* streams visible with individual event dots
  - *Level 1 (moderate):* event dots collapse to activity bars showing density histogram per time window
  - *Level 2 (dense):* streams collapse to single health-coded bars; no event-level detail visible; causation edges hidden; subscriber nodes become counts
- **Time-window control:** slider to set the visible time window (last 30s / 5min / 30min). Dense windows compress more; sparse windows show more granularity.
- **Stream grouping:** streams with the same prefix group into a collapsible band (`cerebra/agent-trace/* (12)` collapses to one row).
- **Subscriber count threshold:** at >N subscribers per stream, nodes collapse to a count badge rather than individual nodes.

**When to choose:** design wants the fossic visualization to reflect what fossic structurally is — familiar to event-sourcing practitioners, and explanatory to newcomers.

---

### Option D — Full directed graph topology (elaborate)

**Surface:** fossic substrate tile, force-directed or hierarchically laid out.

**What it shows:**
- **Nodes:** each stream is a node; each subscriber is a node; each project's emitter is a node.
- **Edges:** subscription edges (subscriber → stream), emission edges (emitter → stream), causation edges (event → event, cross-stream).
- **Node status rings:** green/amber/red ring on each node encoding health.
- **Edge animation:** events traveling along edges in real-time (particles or pulses).
- **Clusters:** streams with common prefixes cluster spatially (`cerebra/*` cluster, `policy-scout/*` cluster, `lattica/*` cluster).
- **Click to expand:** clicking a node reveals its detail panel (event history, subscriber list, emitter origin).

**Observability axis:** observability-heavy in healthy state (the graph is visually quiet when everything is green). Diagnostic on interaction (expand nodes for depth).

**Data sources:** everything from Option C plus graph-layout computation (D3 force or similar). Most complex frontend implementation.

**Fossic-tauri additions needed:** same as Option C plus a topology snapshot command to avoid graph recomputation on every poll.

**Density behavior:**
- Dense state is the primary failure mode for this option. A graph with 30 nodes and 50+ edges is not legible at small tile sizes.
- Mitigation: aggressive clustering, LOD on zoom, suppress idle nodes by default.
- **Risk:** this option risks visual complexity that obscures rather than reveals. Recommend only if the workspace is frequently split to give fossic a large pane.

**When to choose:** the team specifically wants the graph metaphor and is prepared to invest in tuning the layout. Not recommended as the first iteration — better as UP-002+ after the simpler options prove out.

---

### Fossic's recommendation

Not proposing a single answer — that's the developer + frontend-design's call. One structural observation: **Option C (streams-as-flows) reflects what fossic actually is.** Option A is the minimum that fixes the current status panel's blind spots. Option B is the pragmatic middle. Option D has the most explanatory power but the highest visual complexity risk.

If the design iteration targets one option: **B for speed, C for correctness.**

---

## Live tail vs. archive framing (fossic substrate)

The live-tail / archive split applies to the substrate visualization as follows:

**Ambient (always-on):** health indicators, active stream count, subscriber status, activity pulse. These are status signals, not event-content signals. They don't scroll; they update in place.

**Diagnostic (on-demand):** causation chain trace (triggered by clicking an event or edge), event payload inspection (clicking an event dot), stream history (full chronological depth via `fossic_read_range`). These open as a detail panel or drawer, not in the main tile surface.

The substrate tile is structurally different from a per-project event feed: there is no "live tail of fossic events" in the way Cerebra has a live tail of `SignalEvaluated` events. The ambient surface shows topology and health; the diagnostic surface shows event history and causation on demand.
