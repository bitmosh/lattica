# Design Requests

Per-project design requests for the Lattica platform integration round.

---

## lattica

# Design Request — Lattica

## Section 1 — Project identity

- **Project name:** lattica
- **Filed by:** lattica-claude
- **Date:** 2026-06-15
- **Updated:** 2026-06-15 (v0.3.5y architectural reframe — divisible-pane workspace; observability-first amendment)

## Section 1b — Platform positioning

**Lattica is observability-first, diagnostics-second.**

- **Observability surfaces** — always-on, ambient awareness, low cognitive
  load. Status panels, live tail, activity indicators. The user should know
  at a glance if things are working without actively investigating.
- **Diagnostic surfaces** — on-demand, deliberate, high cognitive focus.
  Archive views, causation traces, structured detail tables. These open only
  when the user chooses to investigate.

The workspace chrome, status panels, and live tail are all observability
surfaces. Archive views, debug panels, and raw event detail are diagnostic
surfaces. Design should reflect this split in visual weight and chrome.

Lattica's own visual footprint is **observability-heavy** — the platform
shell exists to communicate ambient platform health, not to be a diagnostic
tool for itself. Diagnostic depth for substrate investigation belongs to
Fossic's surface, not Lattica's chrome.

## Section 2 — What this project contributes visually

Lattica's footprint is the **platform workspace itself** — not a fixed-tile
dashboard, but a divisible workspace where panes can be split, resized, and
assigned different tiles. Each pane hosts one tile; layouts are configurable
and persistent.

The Lattica-scoped visual surface includes:

- **Header** — Lattica branding, version (auto-derived from package.json),
  subtitle. Communicates: which build is running, that the platform is alive.
- **Workspace shell** — the pane container: dividers (draggable), pane
  headers (each pane shows what tile it's hosting and offers tile selection),
  layout management affordances (split, close, save layout, recall layout).
- **Status panels (current 4)** — FOSSIC STORE, CANARY STREAM, TILE REGISTRY,
  POSTMESSAGE (ADR-010). Communicates: substrate health at a glance. With
  divisible windowing, these may move from "fixed top row" to "an always-on
  status pane" or "a peer tile users can pin in any pane."
- **Tile registry** — the catalog of available tiles, each parameterizable
  (e.g., event-feed-tile with stream_glob="cerebra/agent-trace/*" vs.
  stream_glob="lumaweave/graph/events"). Currently 2 tiles registered; will
  grow as projects contribute.
- **Future shell affordances** — settings, switching between workspace and
  immersive views, debug, etc. Out of scope for this iteration.

## Section 3 — Visual priority hierarchy

Lattica's chrome is **observability-heavy**. The hierarchy maps directly to
the observability/diagnostics axis: highest-priority items are ambient
observability; low-priority items are diagnostic.

- **Highest priority — observability (at-a-glance, always-on):**
  - Is the platform alive? (header heartbeat or status pulse)
  - Which build is running? (header version)
  - Are events flowing? (subtle activity indicator)
  - Which pane has my attention right now? (active pane affordance)
- **Medium priority — ambient-but-not-always-prominent:**
  - Pane header showing the active tile in each pane
  - Substrate stats (current status panel content) — accessible without
    effort, but not necessarily occupying constant chrome space
- **Low priority — diagnostic (can be tucked or on-demand):**
  - Specific counts beyond at-a-glance summary
  - Layout management UI (split/close buttons, save/recall) — affordances
    visible on hover or in a chrome strip; not always-on chrome
  - Debug/developer info (POSTMESSAGE demo button, raw event IDs)

## Section 4 — What a glance should communicate (observability surface)

Within 2 seconds of looking, a user should understand:

- "The platform is alive and events are flowing"
- "I'm looking at [N] panes, each showing [tile type for project X]"
- "The most recent activity in [pane I'm focused on] is [most-recent event]"
- "Build version is [v0.X.Y]"

## Section 4b — What investigation should reveal (diagnostic surface)

When the user deliberately opens a diagnostic surface (e.g., clicks "why is
this stream slow?"), they should be able to learn:

- Fossic substrate health detail — stream lag, subscriber counts, causation
  depth (this is Fossic's surface, surfaced through Lattica's chrome)
- Full session/cycle archive grouped by project event stream
- Layout management history if applicable

Lattica's chrome does **not** need to provide its own diagnostic depth
beyond what Fossic and per-project archive views already offer.

## Section 5 — What doesn't matter at-a-glance

- Specific event IDs (data-event-id) — DevTools-level only
- Raw timestamps to second precision — minute granularity is enough
- POSTMESSAGE demo button content — developer affordance; can be hidden
  behind a debug toggle entirely
- Layout management chrome when not being actively manipulated — should fade
  to subtle when users are reading content, become prominent on hover

## Section 6 — Cross-project visual relationships

- **Each pane is a project's surface** — when multiple projects' panes are
  visible side-by-side, the visual idiom should make project identity
  immediately clear (color accent, pane header treatment, etc.)
- **Cross-project relationships visible through pane layout** — putting
  Cerebra and LumaWeave panes side-by-side should make their interaction
  visually observable
- **Status panels' visual idiom should harmonize with tile idiom** — they're
  peer surfaces in the workspace, not different categories
- **Project accent colors** — each project gets a subtle accent (could be
  border tint, icon color, or background hue) for instant identification
  when scanning a multi-pane layout

## Section 7 — Current implementation (reference only — divergence encouraged)

Frontend-design is **strongly encouraged to diverge** from current
implementation. Current state is anchored to assumptions (fixed-tile layout,
project-specific tiles, append-only event scroll) that the architectural
reframe explicitly moves away from.

- Current files: `src/App.tsx`, `src/tiles/HelloTile.tsx`,
  `src/tiles/cerebra-signal/CerebraSignalTile.tsx`, registered renderers
  per project in `src/renderers/<project>/`
- Current visual approach: dark dashboard aesthetic, monospace, ALL CAPS
  section headers, four-column status row over content area
- What works: dark palette and monospace match the technical nature of the
  data; ALL CAPS section headers are good landmarks; the FOSSIC STORE /
  CANARY STREAM / etc. pattern works as a status idiom
- **What's broken — the scroll problem:** the current CerebraSignalTile
  shows events in arrival order with newest at the bottom of a continuously
  growing scroll. After a few cycles, the most recent information is at the
  bottom of a 15-20 page scroll. This is the most important design problem
  to solve in this iteration. **Live tail vs. archive review** is the
  architectural split the design should embody:
  - **Live tail (always visible in pane):** most recent ~10 events, newest
    at top, auto-scrolling. Shows "what's happening right now."
  - **Archive review (on-demand):** browsable history grouped by session/
    cycle/packet, opens from clicking on an event reference. Shows "what
    happened" — full chronological depth, filtering, search.

## Section 8 — Constraints (real ones only)

- **Tauri webview environment** — full CSS support; React 19; jsx react-jsx
- **`--portfolio-*` design token namespace** per ADR-015 (host owns tokens)
- **`payloadRendererRegistry`** — events route to project-contributed
  renderers via registry lookup; design must accommodate components
  contributed via P-013 (different projects produce different visual
  treatments within a coherent system)
- **`tileSectionRegistry`** is the canonical place tiles register;
  generalized event-feed tile (likely the platform's primary tile primitive)
  registers there parameterized by stream_glob
- **Monospace for event content** — event data is structured data, not
  prose; sans-serif for chrome/headers, monospace for content
- **Divisible-pane workspace is in architectural scope** — fixed-tile
  layouts are not the design target

## Section 9 — Open questions for frontend-design

**Most important — the live-tail-vs-archive split:**

- How should the live tail and archive views relate visually? Same tile
  showing different modes? Separate tiles? Modal/drawer for archive?
- What's the ideal depth for live tail (5 events? 10? scrolling within tile
  with a "older →" affordance opening archive?)
- How does archive view organize the data — by session, by event type, by
  timestamp, all of the above with toggles?
- For events that have rich payload content (Cerebra's SignalEvaluated card
  is information-dense), does live tail show a compact "summary card" with
  expand-to-see-full on click, vs. archive showing the full card by default?

**Divisible-pane architecture:**

- Pane header design — what does a pane's header look like? Tile name +
  tile-selector dropdown? More than that?
- Divider styling — subtle line? Active when hovered? Has a grab handle?
- Layout management UI — split horizontally/vertically buttons, close pane,
  save/recall layout. Where do these affordances live? Always-on chrome?
  Hover-revealed? Keyboard shortcuts?
- Empty pane state — when a pane is created but no tile assigned, what's the
  visual? "Select a tile" picker?

**Generalized event-feed tile (THE platform decision):**

- Is there one event-feed tile component parameterized by stream_glob,
  with renderer lookup via `payloadRendererRegistry`? OR are there
  per-project tiles (CerebraSignalTile, LumaWeaveGraphTile, etc.)?
- LumaWeave's Q1 surfaced this. With divisible windowing, the answer is
  likely "one generalized tile" — but frontend-design should validate this
  by proposing layouts both ways and identifying which composes better.

**Project identity affordances:**

- How is project identity communicated when multiple project panes are
  visible? Color accent? Icon? Both? Where on the tile?
- Project accent colors — should each project have a designated hue, or
  should all tiles share the same neutral palette with project identity
  signaled only via labels?

**Status panel placement in a divisible-pane world:**

- Are the four current status panels (FOSSIC STORE, etc.) still a fixed
  top row, or do they become an "always-on status pane" (one of the panes
  in the workspace), or do they become tiles users can pin where they want?
- If they remain a fixed row, do they appear above the workspace, below,
  or to the side?

---

## fossic

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

---

## cerebra

# Design Request — Cerebra

## Section 1 — Project identity

- **Project name:** cerebra
- **Filed by:** cerebra-claude
- **Date:** 2026-06-15
- **Role:** lighthouse project — core renderer redesign sets the visual vocabulary
  other projects mold after

## Section 1b — Platform positioning

**Cerebra is observability-heavy.**

The signal feed should communicate ambient cognitive state at a glance — is a
cycle running, is it accepting, are signal scores healthy? Drill-down depth
(specific per-signal numbers, prediction error details, rule names) is
diagnostic and should open on demand, not be always-on.

## Section 2 — What this project contributes visually

Cerebra emits events on `cerebra/agent-trace/<session_id>`. Four renderers
are live; one (ContextPacketBuilt) is pending the new visual vocabulary.

**Live renderers (P-013 guest contributions committed to Lattica):**

- **ClutchDecisionMade** — the cycle's control decision: accept / refine /
  stop, which clutch rule fired, cascade depth, whether the catalyst engine
  was invoked. Communicates: "did the cycle accept this step or force a
  retry/halt?" This is the highest-signal single event per step.
- **SignalEvaluated** — six cognitive signal scores (COHERENCE, GROUNDEDNESS,
  GENERATIVITY, RELEVANCE, PRECISION, EPISTEMIC_HUMILITY) + composite +
  low-confidence flag. Communicates: "how did this step score on each
  dimension?"
- **PredictionMade** — expected composite + per-signal scores before the
  step runs; basis (trajectory / config / baseline) + confidence.
  Communicates: "what did Cerebra expect from this step?"
- **OutcomeRecorded** — actual composite + signed prediction error +
  error_classification (noise / notable / severe) + per-signal signed
  errors. Communicates: "how far off was the prediction, and does it matter?"

**Pending renderer (drafted after new visual vocabulary lands):**

- **ContextPacketBuilt** — what retrieval surfaced before the step: mode,
  candidate count, abstained flag, retrieval scores. Communicates: "what
  context did Cerebra have going into this step?"

**Other event types on the stream (no renderer yet; lifecycle markers):**

- SessionOpened, CycleStarted, StepStarted, StepExecuted,
  EvaluationComposed, CycleCompleted, SessionFlushed,
  LeewayGrantApplied, MemoryWriteFromCycle

## Section 3 — Visual priority hierarchy

- **Highest priority — observability (at-a-glance):**
  - Is a cycle currently running? (session/cycle active indicator)
  - What was the last clutch decision? (accept green / refine orange / stop red)
  - Are composite scores healthy? (score bar or color-coded pulse)
  - Is the most recent prediction error notable or severe? (classification badge)
- **Medium priority — visible without effort:**
  - Which step is current, how many steps run this cycle
  - Signal breakdown for the most recent step (the 6-signal grid)
  - Prediction basis (trajectory vs. config vs. baseline — relevant when
    baseline fires because there's no trajectory yet)
- **Low priority — diagnostic (expand-on-click / archive only):**
  - Specific event IDs (decision_id, prediction_id, outcome_id)
  - Per-signal prediction errors (OutcomeRecorded signal grid)
  - Cascade depth and rule name in ClutchDecisionMade
  - Retrieval candidate scores (ContextPacketBuilt detail)
  - Raw timestamps to second precision
  - session_id / cycle_id / step_id strings

## Section 4 — What a glance should communicate

Within 2 seconds of looking at the Cerebra surface, a user should understand:

- "A cycle is running / the last cycle accepted / the last cycle stopped"
- "Composite score was around [X]% — healthy / borderline / poor"
- "The last prediction error was noise / notable / severe"

The live tail is the observability surface — it should make the above legible
with no investigation. Specific numbers, rule names, and signal breakdowns
are the diagnostic surface and open on demand.

## Section 5 — What doesn't matter at-a-glance

- Raw event IDs (data-event-id, decision_id, prediction_id) — suppress or
  DevTools-only
- Exact timestamps — time-of-day or relative ("2s ago") is enough in live tail
- Cascade depth integer in ClutchDecisionMade — visible on hover/expand only
- Per-signal prediction errors in OutcomeRecorded — archive-only detail
- Prediction confidence percentage — surfaced in archive; live tail shows
  basis badge only
- step_id / cycle_id strings — tooltip or archive-only; session_id truncated

## Section 6 — Cross-project visual relationships

- **Cerebra → Fossic (causation):** each Cerebra cycle event has a causation
  chain rooted in a SessionOpened event. Fossic's causation visualization
  should be able to highlight the chain when a Cerebra event is focused —
  this is a Fossic-side concern but Cerebra events carry the causation IDs.
- **Cerebra → LumaWeave (trigger):** when a Cerebra cycle triggers a
  LumaWeave graph rebuild, the two project panes side-by-side should make
  that relationship visible. No specific renderer change needed from Cerebra;
  this is a layout/design concern.
- **Per-step arc:** PredictionMade → SignalEvaluated → OutcomeRecorded is a
  natural grouping per step. In the archive view, these three events from the
  same step_id should read as a unit (grouped card or collapsible arc).
  In the live tail, only the most recent of the three needs to be visible.

## Section 7 — Current implementation (reference only — divergence encouraged)

- Current files: `src/renderers/cerebra/SignalEvaluatedRenderer.tsx/.css`,
  `PredictionMadeRenderer.tsx/.css`, `OutcomeRecordedRenderer.tsx/.css`,
  `ClutchDecisionMadeRenderer.tsx/.css`
- Current visual approach: dark monospace cards, `--portfolio-*` tokens,
  ALL CAPS labels, score bars (█░), colored classification badges,
  3×2 signal grids
- What works: dark palette and monospace match the cognitive/data nature;
  ALL CAPS section labels are strong landmarks; score bars communicate
  magnitude at a glance; color-coded action badges (green/orange/red) for
  accept/refine/stop are immediately legible
- **What's broken — the scroll problem:** CerebraSignalTile shows events
  append-only with newest at the bottom of a continuously growing scroll.
  After a few cycles, the most recent information is buried under 15-20
  pages of scroll. This is the most important design problem to solve.

## Section 8 — Live tail vs. archive split (the core design question for Cerebra)

This is the lighthouse problem. How Cerebra solves it informs every other
event-feed treatment in the system.

**Live tail (observability surface — always-on in pane):**
- Most recent ~5–10 events, newest at top, auto-scrolling stopped
- Each event is a compact card showing the highest-priority fields only
- ClutchDecisionMade: action badge + score summary is enough
- SignalEvaluated: composite score bar + classification is enough
- Lifecycle events (SessionOpened, CycleStarted, etc.): single-line status
  chips, not full cards
- "older →" affordance at bottom that opens archive for the current session

**Archive view (diagnostic surface — on-demand):**
- Browseable history grouped by session → cycle → step
- Per step: PredictionMade + SignalEvaluated + OutcomeRecorded shown as a
  unit (the prediction arc) with full payload detail
- ClutchDecisionMade shows rule name, cascade depth, escalate flag
- Filterable by action (show only stop/refine decisions), by session, by
  error classification

## Section 9 — Constraints

- `PayloadRendererProps: { payload: unknown, event_id: string }` — ADR-017,
  locked props contract
- `--portfolio-*` design token namespace — host owns tokens; no hardcoded
  colors in renderer CSS
- `jsx: react-jsx` (no `import React`), `strict: true`,
  `noUnusedLocals/Parameters: true`, React 19
- `data-cerebra-renderer="<EventType>"` structural marker on renderer root
  div — required for POST_FLIGHT smoke tests
- Stream glob: `cerebra/agent-trace/*`
- Monospace for event content — data, not prose; sans-serif for chrome only

## Section 10 — Open questions for frontend-design

- **Live tail depth:** 5 events? 10? Scrollable within tile with a depth
  cap? What triggers "spill to archive"?
- **Compact vs. full card in live tail:** should live tail show a reduced
  version of the current renderer cards (same component, fewer fields
  rendered), or a completely different "summary chip" component? The former
  is simpler; the latter may be necessary if the current cards are too dense
  at any reduction.
- **Per-step grouping in archive:** should PredictionMade + SignalEvaluated
  + OutcomeRecorded from the same step_id collapse into one grouped card with
  expand? Or stay as three adjacent cards with a visual separator?
- **Lifecycle events in live tail:** SessionOpened / CycleStarted /
  CycleCompleted are important context but carry no score data. Should they
  appear as full cards, one-line chips, or only as section dividers in the
  archive view?
- **Low-confidence flag treatment:** when SignalEvaluated has
  `low_confidence: true`, does the live-tail card visually attenuate
  (dimmed), border-highlight, or badge? This affects the visual language
  for uncertainty across all projects.
- **Severe miss escalation:** OutcomeRecorded with `error_classification:
  "severe"` is a signal that Cerebra's predictions are badly wrong. Should
  this escalate visually beyond the current danger-red border — e.g., pin
  to top of live tail, pulse, or persist in a "recent alerts" strip?

---

## lumaweave

# Design Request — LumaWeave

> Filed per `docs/coordination/design/REQUEST_TEMPLATE.md`

## Section 1 — Project identity

- **Project name:** lumaweave
- **Filed by:** lumaweave-claude
- **Date:** 2026-06-15

---

## Section 2 — What this project contributes visually

Stream: `lumaweave/graph/events`

All event types are flat PascalCase strings (same convention as Cerebra).

| Event type | Payload fields | What it communicates |
|---|---|---|
| `SourceLoaded` | `adapter_id`, `source_key`, `node_count`, `edge_count` | Graph is ready; how big it is |
| `SourceLoadFailed` | `adapter_id`, `source_key`, `error` | Graph unavailable; why |
| `SourceSwitched` | `from_adapter_id`, `to_adapter_id` | User changed the active data source |
| `ThemeChanged` | `from_theme_id`, `to_theme_id` | User changed visual theme (secondary signal) |
| `GraphLayoutSettled` | `node_count`, `duration_ms` | gwells physics converged; graph is visually stable (pending gwells convergence signal — command wired, frontend not yet mounted) |

All five are live in `lumaweave/graph/events` once LumaWeave is configured to
write to the shared platform store (see Section 8 — operational flag).

---

## Section 3 — Visual priority hierarchy

- **Highest priority (at-a-glance):** `SourceLoaded` and `SourceLoadFailed` —
  is the graph up and how large? An error state the user may need to act on.
- **Medium priority (visible without effort):** `SourceSwitched` — intentional
  context change; user chose to see different data.
- **Low priority (deep-read / tucked):** `ThemeChanged` (operational telemetry,
  no user action needed), `GraphLayoutSettled` (performance signal; useful in
  dev, noise in production).

---

## Section 4 — What a glance should communicate

Within ~2 seconds:

- "LumaWeave graph is loaded — 145 nodes, 312 edges" (SourceLoaded)
- "LumaWeave graph failed to load — [adapter name], [short error]" (SourceLoadFailed)
- "LumaWeave switched source" (SourceSwitched, with from/to labels if space allows)

ThemeChanged and GraphLayoutSettled don't need to register at-a-glance.

---

## Section 5 — What doesn't matter at-a-glance

- `source_key` (the raw file path or URL) — too long for a card; expose only
  on expand
- `adapter_id` raw string — should be replaced with a human label if available,
  or suppressed in favor of `source_key` basename
- `error` full text — show first line at-a-glance; full text on expand
- `from_theme_id` / `to_theme_id` raw IDs — not meaningful to most users;
  can be suppressed or shown only on expand
- `event_id` (blake3 hash) — never surface to users

---

## Section 6 — Cross-project visual relationships

None at current scope. Future: if Cerebra can trigger LumaWeave graph reloads
(e.g., Cerebra produces a new agent-trace stream → LumaWeave loads it), there
would be a causal link between Cerebra's `SessionOpened` and LumaWeave's
`SourceLoaded`. Not applicable yet.

---

## Section 7 — Current implementation (reference only)

- No renderer files exist yet. R-LW-005 shipped the Rust + TypeScript wiring
  (2026-06-15) but renderer components haven't been authored.
- Planned location: `src/renderers/lumaweave/` in Lattica's tree (P-013
  guest-author pattern)
- Registration: LumaWeave authors the TSX; Lattica commits and calls
  `registerPayloadRenderer()` for each event type

Frontend-design is free to diverge from any mental model I have here.

---

## Section 8 — Constraints

**Hard constraints:**

- `PayloadRendererProps` shape: `{ payload: unknown, event_id: string }` —
  renderer components receive these two props only. `event_type` and
  `stream_path` are not in props; add to the interface if needed.
- `--portfolio-*` token namespace for all cross-project colors/surfaces
- `--lw-*` tokens are available if Lattica imports `portfolio-tokens.css`
  (already imported in Lattica v0.2.0)
- No `stream_glob` differentiation needed — all LumaWeave events are on
  `lumaweave/graph/events`, single glob `"lumaweave/graph/*"` covers all

**Operational flag (not a design constraint — needs resolution before events
flow end-to-end):**

R-LW-005 currently writes to `<project_root>/.lumaweave/fossic.db` — a
project-local store that Lattica cannot read. For LumaWeave events to appear
in Lattica's event feed, LumaWeave needs to write to the shared platform store
(the equivalent of Lattica's `CEREBRA_PLATFORM_STORE`). Need Lattica to
confirm the shared store path so LumaWeave can add a startup config that opens
the correct store. Not blocking design iteration — just needs to be resolved
before integration testing.

---

## Section 9 — Open questions for frontend-design

**Q1 — Separate tile or generalized event-feed tile?**

The current `CerebraSignalTile` hard-codes subscription to
`cerebra/agent-trace/*`. LumaWeave's stream is `lumaweave/graph/events` —
a separate subscription. Two options:

- **A: Separate `LumaWeaveGraphTile`** — parallel to CerebraSignalTile, each
  subscribes to its own stream. Clean isolation; growing number of tiles as
  more projects ship events.
- **B: Generalized event-feed tile** — one configurable tile parameterized
  by `stream_glob` and a renderer registry lookup. Each project registers
  renderers; the tile is reused. More upfront design work; scales to N
  projects without N tiles.

LumaWeave has no preference. This is a platform design decision that affects
all future projects (Bo, Policy Scout, etc. may all emit events). Flagging
because it's in scope now while the design system is being built.

**Q2 — Graph health at-a-glance vs. error-only prominence**

Option A: `SourceLoaded` shows as a quiet status indicator (node/edge count
in small text, green dot). `SourceLoadFailed` escalates visually (red, bold
error). Graph health is implied by the absence of errors.

Option B: `SourceLoaded` shows the count prominently (badge or counter).
User can see graph size without expanding. Failure is still escalated.

Which matches the platform's information hierarchy?

**Q3 — ThemeChanged: surface or suppress?**

ThemeChanged is useful as a debugging signal ("the user changed themes at
14:33; that's when the rendering changed") but is noise in normal operation.
Should it be hidden by default with a "show system events" toggle? Or filtered
out entirely in the production event feed?

---

## Section 10 — Live-tail addendum (observability-first framing)

*Added 2026-06-15 following architectural update v0.3.5y.*

LumaWeave is observability-heavy. The primary event surface should provide
ambient awareness of graph state — not function as a diagnostic tool.

**Primary (ambient) surface — live-tail:**

- Show the last 3–5 events; older ones scroll out naturally
- A persistent graph health indicator (separate from the event list) shows
  current SourceLoaded state: graph up, node/edge count at a glance. This
  indicator should be visible without reading the event list at all
- `SourceLoadFailed` escalates visually even in the ambient view and stays
  sticky until superseded by a `SourceLoaded` — it's the one event that may
  require user action
- `SourceLoaded` and `SourceSwitched` can replace each other in live-tail:
  only current state matters. Showing "SourceLoaded 5 minutes ago" is noise
- `ThemeChanged` and `GraphLayoutSettled` are low-signal in live-tail;
  suppress by default (consistent with Q3 inclination above)

**Diagnostic (on-demand) surface — archive view:**

- Full event history, opened deliberately (click/expand)
- `SourceLoadFailed` full error text, adapter label, source path on expand
- `GraphLayoutSettled` useful here for performance tracking over time
- `ThemeChanged` visible in archive if "show system events" is toggled on

**Framing note:** the live-tail + ambient indicator IS the primary product.
The archive view is depth, not the starting point. Design should not bias
toward the archive-first pattern.

---

## Section 11 — Persistent control surface spec

*Added 2026-06-15 in response to PACKET-001 control surface request.*

| Element | Type | Always visible? | What it shows / does | Why it earns tile chrome |
|---|---|---|---|---|
| **Graph health pill** | pill | yes | `LOADED` (green neon) · `FAILED` (red neon, bold) · `LOADING` (amber pulse) · `IDLE` (gray). Click → scroll feed to most recent SourceLoad event. [STREAM] | Instant up/down read without scanning the feed. Primary at-a-glance signal; covers the most user-actionable state. At rest: `LOADED` or `IDLE`. |
| **Node / edge count** | badge | yes | `145n · 312e` from last SourceLoaded payload. Resets to `— · —` on FAILED or IDLE. [STREAM] | Core graph identity. "Is this a big graph?" answered without opening LumaWeave. |
| **Active source label** | pill | yes | Adapter display name or `source_key` basename if no label. Shows `no source` when IDLE. [STREAM] | Which dataset is loaded? Must be visible without drilling into events. |
| **Source switcher** | dropdown | yes | Lists all configured adapters; current one highlighted. Selecting one triggers a source-switch command in LumaWeave. [API-NEW — reverse channel required] | LumaWeave is a visualization tool; switching what it visualizes is the primary tile action. Idle default: shows current or `no source`. |
| **Retry** | btn | on-event (FAILED only) | `↺ RETRY` — triggers source reload in LumaWeave. Visible only when health = FAILED. [API-NEW — reverse channel] | SourceLoadFailed is the one event requiring user action. Retry must not require opening LumaWeave. Hidden at rest. |
| **Layout freeze** | toggle | yes | `LIVE` / `FROZEN`. LIVE = gwells physics active; FROZEN = layout pinned, no animation. [API-NEW — reverse channel] | gwells animation is distracting in a side panel. Freeze lets the graph stabilize once and hold. Default: `LIVE`. |
| **Re-settle** | btn | cond. (after SourceLoaded/Switched) | `⟳ SETTLE` — re-triggers gwells convergence from current node positions. [API-NEW — reverse channel] | After a source switch, node positions scatter. Re-settle without opening LumaWeave. Visible when LOADED; hidden when FAILED or IDLE. |
| **Open LumaWeave** | btn | yes | `↗ OPEN` — focuses the LumaWeave window. | Escape hatch for everything not on the tile: theme changes, adapter config, physics tuning, visual inspection. Small, always present. |
| **Event type filter** | toggle set | yes | Three micro-toggles: `[SRC]` `[LAYOUT]` `[THEME]`. SRC = SourceLoaded + Failed + Switched (on by default); LAYOUT = GraphLayoutSettled (off by default); THEME = ThemeChanged (off by default). [STREAM, client-side] | LumaWeave emits noisy low-signal events. Filter defaults match the priority hierarchy from Section 3; user can surface them without config. |
| **Idle / standby** | state | yes (when idle) | Health pill = `IDLE`, count = `— · —`, source label = `no source`, feed shows `waiting for source` placeholder. Source switcher remains interactive as the CTA. [STREAM] | Tile must be usable before LumaWeave has loaded a graph. Source switcher is the primary call-to-action in idle state. |
| **Settings panel** | panel | collapsible | Adapter labels list (no raw paths), gwells physics preset selector (`ORGANIC` / `TIGHT` / `SPARSE`), store path info (project-local vs platform store status). [API-NEW for preset write; store info is [STREAM]] | Adapter and physics config is infrequent but needed when something's wrong. Keeps tile chrome clean; depth on demand. |

**On the theme picker question:** No theme picker in the tile. Theme affects LumaWeave's rendering engine, not a stream signal. The tile shows current theme label (from ThemeChanged events, [STREAM]) in the settings panel only. Changing theme belongs in LumaWeave proper — the `↗ OPEN` button is the path.

**On [API-NEW] items — reverse channel note:**

Source switcher, Retry, Layout freeze, Re-settle, and physics preset write all require Lattica to send commands TO LumaWeave. LumaWeave's Tauri backend exposes commands, but Lattica cannot call them directly without an inter-process bridge.

Two realistic paths:
- **Option A (post shared-store):** Use fossic as a bidirectional bus. LumaWeave polls a `lumaweave/tile/commands` stream; Lattica appends command events. Natural fit once the shared platform store is in place (the same blocker as Section 8's operational flag).
- **Option B (v1 read-only tile):** Defer all [API-NEW] controls. Tile is read-only in v1 — health + count + source label + event feed only. `↗ OPEN` is the action path. Retry and switcher added in v2 when the shared store is confirmed.

LumaWeave recommends **Option B for v1**. The read-only ambient surface is the 80% value; the control surface is additive. This also keeps the tile design decoupled from the IPC architecture question.

---

## policy-scout

# Design Request — Policy Scout

> Filed per `docs/coordination/design/REQUEST_TEMPLATE.md`

## Section 1 — Project identity

- **Project name:** policy-scout
- **Filed by:** policy-scout-claude
- **Date:** 2026-06-15
- **Observability/diagnostics balance:** balanced (see §4 for the split)

---

## Section 2 — What this project contributes visually

Streams: `policy-scout/audit/<request_id>` (one per governance check),
`policy-scout/approval/<approval_id>` (one per HITL approval request).

The generalized event-feed tile subscribes to `policy-scout/audit/*` and
`policy-scout/approval/*` (two glob subscriptions, or one tile per stream,
or one tile with two subscriptions — Lattica's call).

### Primary visual events

| Event type | Payload highlights | What it communicates |
|---|---|---|
| `DecisionIssued` | `decision`, `risk_score`, `risk_band`, `command`, `reasons[0]` | The governance verdict — what was decided and why (high signal, always visible) |
| `ApprovalRequested` | `command`, `risk_band`, `expires_at` | Human action required — agent is blocked waiting for approval |
| `ApprovalApprovedOnce` | `approved_by`, `command` | Approval granted; agent may proceed |
| `ApprovalDeniedOnce` | `denied_by`, `command` | Approval denied; agent blocked |
| `ApprovalExpired` | `command`, `expired_at` | Approval window closed without resolution |

### Secondary visual events

| Event type | Payload highlights | What it communicates |
|---|---|---|
| `CommandRequested` | `command`, `actor_type`, `actor_name` | What came in and who sent it; context for the DecisionIssued that follows |
| `CommandExecutionCompleted` | `command`, `exit_code`, `duration_ms` | Command ran; outcome |
| `CommandExecutionBlocked` | `command`, `decision` | Command was stopped at the run gate |

### Ambient health metrics (not individual events — derived from stream)

- **Decisions per minute** — gating activity rate; tells user if the system
  is actively governing
- **Pending approvals count** — if >0, something needs the user's attention
- **Leeway/lockdown state** — global policy posture (locked down / active /
  leeway mode); this comes from `lockdown status` + `watch status` on the
  system side

---

## Section 3 — Visual priority hierarchy

- **Highest priority (must register at-a-glance):**
  - Decision outcome color band for `DecisionIssued`
    (ALLOW=green, ALLOW_LOGGED=teal, REQUIRE_APPROVAL=amber, SANDBOX_FIRST=orange,
    DENY=red, DENY_AND_ALERT=deep red)
  - `ApprovalRequested` escalation — visually distinct, attention-demanding
    (something is waiting for the user; blocked agent)
  - Pending approvals count (badge, always visible when >0)

- **Medium priority (visible without effort):**
  - Risk band for each decision (low / medium / high / critical)
  - Command summary (truncated, enough to identify what was checked)
  - Actor (who submitted: agent name, human, system)
  - Approval resolution (`ApprovalApprovedOnce` / `ApprovalDeniedOnce` with actor)

- **Low priority (deep-read / expand-to-see):**
  - Full `reasons` array (show first item at glance; expand for all)
  - `matched_rule` string
  - `risk_score` integer (band color already communicates the category)
  - `cwd` (context; not needed at glance)
  - Full causation chain per request_id
  - Cross-stream link to Cerebra `ActionProposed`
  - `request_id`, `event_id` (technical identifiers, never at glance)

---

## Section 4 — What a glance should communicate

**Observability surface (live tail — ambient):**

Within ~2 seconds:
- "Policy gate is active — N decisions in the last minute"
- "Last decision: ALLOW / DENY / flagged for approval" with command summary
- "2 approvals pending" — escalated if nonzero; invisible (no badge) if zero
- "Lockdown active" or "Watch running" — global policy posture as a persistent
  indicator (not per-event; derived from health status)

The live tail shows the most recent 5–10 `DecisionIssued` events with
color-coded decision bands. `ApprovalRequested` events are visually escalated
(amber, persistent until resolved). Approval resolutions (`Approved`,
`Denied`, `Expired`) appear inline in the live tail as resolution tags on the
pending approval card.

Streaming rate: 200–500ms for typical active governance; up to 2000ms for
low-frequency context. 50ms cap available for high-frequency scan session
monitoring (during package scan or supply chain sweep).

**Diagnostic surface (archive / on-demand):**

On-demand from the live tail (open per-request chain from a DecisionIssued card):
- Full governance pipeline for a single `request_id`: CommandRequested →
  CommandParsed → CommandClassified → PolicyMatched → DecisionIssued → (optional)
  ApprovalRequested → ApprovalApprovedOnce | DeniedOnce | Expired
- Full `reasons` array
- Risk score details
- Cross-stream causation link to Cerebra `ActionProposed` (when present; opens
  the Cerebra session context for the agent that triggered this governance check)

---

## Section 5 — What doesn't matter at-a-glance

- `request_id`, `decision_id`, `approval_id` — ULIDs; never surface to users
- `event_id` (Blake3 hash) — never surface to users
- `matched_rule` string — technical policy rule name; show in diagnostic only
- `risk_score` as a number — the band color already encodes it; integer is
  redundant at glance
- `cwd` (working directory) — context for diagnostics, not live tail
- Full `reasons` array — show `reasons[0]` at glance; expand for the rest
- `schema_version` — internal versioning field; suppress everywhere
- `actor_type` when it's `"agent"` and `actor_name` is already shown — redundant

---

## Section 6 — Cross-project visual relationships

**Cerebra causation link:**
When `CommandRequested.upstream_causation_id` is present, the governance check
was triggered by a Cerebra agent action. The `DecisionIssued` card for that
check should show a "↑ Cerebra" indicator linking to the originating Cerebra
session (opens the Cerebra event feed filtered to that session_id, if the
generalized tile supports cross-stream navigation).

Escalation implication: `ApprovalRequested` events that have a Cerebra
upstream link are particularly high-value to escalate visually — a blocked
agent is waiting, not just a human CLI user.

**No other cross-project relationships at current scope.**

---

## Section 7 — Current implementation (reference only)

- No renderer files exist in Lattica yet (pending `payloadRendererRegistry`
  availability for registration)
- Planned location: `src/renderers/policy-scout/` in Lattica's tree (P-013)
- Policy Scout's desktop app (`ui/desktop/`) has its own audit views
  (`AuditEventsListCard`, `AuditVerifyChainCard`, `DecisionCheckCard`) but
  these are Tauri/React components in the policy-scout repo — not in Lattica
- Event data shape in fossic: `policy-scout/audit/<request_id>` streams with
  `DecisionIssued`, `CommandRequested`, etc. as described in
  `~/Projects/fossic/docs/implement/POLICY_SCOUT_EVENT_VOCABULARY.md`

Frontend-design is free to diverge from the policy-scout desktop app's
existing visual treatments. The desktop app is reference, not constraint.

---

## Section 8 — Constraints

**Hard constraints:**

- `PayloadRendererProps` shape: `{ payload: unknown, event_id: string }` per
  ADR-017
- `--portfolio-*` token namespace for cross-project colors/surfaces
- Decision outcome colors should be semantically distinct and accessible
  (ALLOW vs DENY vs amber REQUIRE_APPROVAL vs orange SANDBOX_FIRST). These
  are safety-relevant states — colorblind-accessible differentiation matters.
- Monospace preferred for `command` text (it's a shell command, not prose)

**Non-blocking operational item:**

Policy Scout's fossic store is at `~/.local/share/policy-scout/fossic.db` by
default (configurable via `POLICY_SCOUT_FOSSIC_DB_PATH`). For events to flow
into Lattica's shared platform store, Policy Scout needs to be configured to
write there instead. Same operational-flag pattern as LumaWeave's §8 note.

---

## Section 9 — Open questions for frontend-design

**Q1 — Live tail event density for multi-agent governance**

In a session where a Cerebra agent is actively running (proposing one action
every 5–10 seconds), `DecisionIssued` events arrive at ~6–12 per minute.
The live tail needs to handle this rate without overwhelming. Options:

- **A: Deduplicate by recency** — show only the most recent DecisionIssued
  per actor in the live tail; older ones roll off. Count badge shows total.
- **B: Grouping by actor** — if the same actor is producing repeated ALLOW
  decisions (expected flow), collapse into a summary card ("Cerebra: 12 × ALLOW
  in last 60s") until something non-ALLOW appears
- **C: Rate indicator + sparse events** — live tail shows only non-routine
  events (DENY, REQUIRE_APPROVAL, DENY_AND_ALERT); a rate counter shows routine
  decisions numerically. This aligns with observability-first: the baseline
  is "everything is fine" communicated as a number, not a scroll of green cards.

Policy Scout has no preference; this is a UX question about information density.
Option C feels most consistent with observability-first positioning (ambient
health indicator, escalation only on anomaly).

**Q2 — Approval pending — persistent or event-in-feed?**

`ApprovalRequested` is different from all other events: it requires user action
and may stay unresolved for seconds to minutes. Options:

- **A: Persistent approval panel** — a fixed section above the event feed
  showing all unresolved approvals with approve/deny affordance inline
- **B: Escalated event card in feed** — `ApprovalRequested` renders as a
  full-width card in the feed with approve/deny buttons; resolved by inline
  interaction; resolved state transitions it to a dimmed resolved card

Option A (persistent panel) is probably better for governance UX — pending
approvals should never scroll out of view.

**Q3 — Lockdown/leeway state: where does it live?**

Global policy posture (lockdown active / watch running / leeway mode) is
system health, not per-event data. Options:

- **A: Status bar indicator** — a persistent status pill in the tile's chrome
  (always visible, no scroll)
- **B: Pinned card at top of feed** — a "system health" card that always
  appears at the top of the policy-scout event feed, showing current
  lockdown/watch state

Either works; A feels more lightweight and less noisy.

---

## ai-stack-bo

# Design Request — ai-stack / bo

## Section 1 — Project identity

- **Project name:** ai-stack-bo (combined — Bo is a node in the ai-stack topology)
- **Filed by:** bo-claude / ai-stack-claude
- **Date:** 2026-06-15
- **Architecture note:** Per v0.3.5y update, this is NOT a per-project tile. This is
  a renderer contribution to a generalized event-feed tile + a topology view component
  contributed via P-013. Bo gets a status node within the ai-stack topology, not a
  separate tile (future iteration).

---

## Section 2 — What this project contributes visually

### Topology view (primary surface)

One visual surface: the **ai-stack topology** — a node graph showing which services
are reachable and what is currently active.

**Nodes in the topology:**

- **Ollama** — LLM serving. Key state: up/down, which models are loaded in VRAM,
  current VRAM usage (numeric + gauge). "What is the GPU doing right now."
- **LiteLLM** — proxy/router. Key state: up/down, how many aliases are live, which
  upstream each alias routes to. "Which LLM aliases are wired."
- **openedai-speech (TTS)** — audio synthesis. Key state: up/down only; no rich
  runtime state at Phase 1. "Is TTS available."
- **Open-WebUI** — web front-end. Key state: up/down only. "Is the chat UI reachable."
- **Bo (Discord bot)** — Key state: running/stopped/offline (from heartbeat JSON),
  last-seen timestamp. "Is the bot alive." Bo is visually subordinate to the ai-stack
  topology — a labeled status node, not a peer to Ollama in visual weight.

**Edges in the topology:**

- Bo → LiteLLM (bot-local alias, always present)
- LiteLLM → Ollama (for local aliases)
- LiteLLM → external (bot-escalated → Anthropic, currently dormant — show as dashed
  or grayed until active)
- Open-WebUI → Ollama (direct)

### Event renderers (Phase 2, fossic-backed — future, but design for it now)

Renderers registered via P-013 against stream_glob patterns:

- `ai-stack/gpu` → `VramBudgetChanged` — delta in VRAM usage; updates the Ollama
  node's VRAM gauge live
- `ai-stack/models` → `ModelLoaded` / `ModelUnloaded` — model appears/disappears on
  Ollama node
- `bot/lifecycle` → `BotStarted` / `BotStopped` — Bo node status transition
- `bot/conversation/*` → `LlmCallAttempt` / `ResponseGenerated` — inference pipeline
  activity; could briefly animate the Bo→LiteLLM→Ollama edge on call

---

## Section 3 — Visual priority hierarchy

**Observability-heavy project.** Weight toward ambient indicators; diagnostics open
on investigation.

- **Highest (must register at-a-glance):**
  - Each node's health state (up / down / degraded / unknown) — color-coded on node
  - Which LLMs are currently loaded in VRAM — list on Ollama node
  - Is Bo alive — status dot on Bo node
  - Overall: "the stack is healthy / something is off"

- **Medium (visible without effort):**
  - VRAM usage (gauge or fill percentage on Ollama node)
  - Number of live LiteLLM aliases
  - Bo's last-seen timestamp ("37s ago")
  - Active inference activity — subtle edge pulse when Bo calls the stack

- **Low (deep-read only; on-click or hover):**
  - Individual model names with exact VRAM footprints
  - Full LiteLLM alias table with upstream mappings
  - Config file paths and section names
  - Per-request latencies and status_tag breakdowns
  - Historical event payload detail

---

## Section 4 — What a glance should communicate

Within 2 seconds of looking:

- "The LLM stack is healthy — Ollama up, one model loaded, GPU in use"
- "Bo is running (last heartbeat recent)"
- "LiteLLM routing looks normal"

Failure-mode glances (also within 2 seconds):
- "Ollama node is red — LLM serving is down"
- "Bo node is gray/offline — bot hasn't checked in"
- "LiteLLM is up but Ollama is down — aliases are live but inference will fail"

The topology view should make the failure dependency chain legible:
Bo down ≠ Ollama down ≠ both down. Each is a distinct situation.

---

## Section 5 — What doesn't matter at-a-glance

- Individual fossic event IDs
- Exact VRAM byte counts (percentage or gauge is sufficient)
- LiteLLM alias routing table in detail (count is enough until investigation)
- Config file paths (surface only when user clicks into a node)
- Per-request latency histograms (diagnostic surface only)
- Bot-escalated path (currently dormant; show as grayed dashed edge, not prominent)

---

## Section 6 — Cross-project visual relationships

- **Bo → Ollama (via LiteLLM):** When Bo is generating a response, the
  Bo→LiteLLM→Ollama edge should briefly animate (pulse or glow). Makes
  inference activity ambient-visible without requiring the user to look at a
  log. Duration: ~duration of inference call or a brief flash on completion.

- **Bo ↔ Cerebra (future):** When `gather_context()` in Bo eventually integrates
  with Cerebra, a Bo→Cerebra edge will appear. Not in scope now; design should
  leave conceptual room for a new edge to appear without reworking the layout.

- **ai-stack ↔ Policy Scout (future):** When a model pull or alias change needs
  approval, the edge to Policy Scout might light up. Not in scope; same note.

---

## Section 7 — Current implementation (reference only — diverge encouraged)

- `~/Projects/discord-bot/bot.py` — heartbeat JSON at `~/.lattica/bo-heartbeat.json`
  (polling-based, Phase 1); fossic emitter implemented for `bot/lifecycle` and
  `bot/conversation/<channel_id>` (Phase 2, live)
- `~/Projects/ai-stack/docker-compose.yml` — service definitions; no fossic sidecar
  yet (ai-stack Phase 2 pending)
- No current visual implementation for ai-stack or bo in Lattica
- What works: Bo heartbeat JSON is polling-ready now; fossic streams for Bo are live

**Phase 1 data available today (no blockers):**
- Bo: `~/.lattica/bo-heartbeat.json` — status + last_seen; poll at 60s
- Ollama: `/api/ps` (running models) + `nvidia-smi` (VRAM) — polling endpoints
- LiteLLM: `/health` + `/model/info` — health + alias table

**Phase 2 data (fossic, ai-stack sidecar pending):**
- `ai-stack/models`, `ai-stack/gpu`, `ai-stack/inference` — live event streams
- `bot/lifecycle`, `bot/conversation/*` — live event streams (implemented)

Design should work gracefully with Phase 1 polling data and upgrade seamlessly
when Phase 2 fossic streams come online.

---

## Section 8 — Constraints (real ones only)

- **ADR-017 PayloadRendererProps** — renderer contributions via P-013 must conform
- **`--portfolio-*` design token namespace** per ADR-015
- **Monospace for event payload content** — model names, alias strings, VRAM numbers
  are data, not prose
- **Topology must degrade gracefully:** when a service is not configured or
  unreachable, show it as absent/unknown rather than erroring out. Not all ai-stack
  services are guaranteed to be running at all times.
- **Bo is a node, not a tile:** at this iteration, Bo lives within the ai-stack
  topology. It does not get its own tile. Design must not imply Bo has peer
  visual weight to Ollama unless the developer explicitly changes scope.
- **Observability-first:** the ambient view (topology with status indicators) is
  always on. Diagnostics (model details, alias table, per-request breakdown) open
  on deliberate user action.

---

## Section 9 — Open questions for frontend-design

**Topology layout:**
- How does the topology handle idle Ollama state (`models: []` — no models loaded)?
  Empty Ollama node with "idle" indicator vs. dimmed node vs. same node with empty
  VRAM gauge?
- How does a "dashed/grayed" dormant edge (bot-escalated → Anthropic) differ from
  a "solid" active edge? Is the distinction clear without color alone?
- When a new model loads (Ollama event), does the topology animate the state change
  or just update silently?

**VRAM visualization:**
- Gauge/fill bar on the Ollama node, or a numeric percentage, or color-coded
  saturation? Gauge is more ambient; number is more precise — which fits
  observability-first?
- Should the VRAM indicator change color as pressure increases (green → yellow → red
  at thresholds)? Or is that too diagnostic for an ambient surface?

**Bo inference activity:**
- Edge pulse on inference: transient (flashes for ~1s on each call) vs. persistent
  (shows "N calls in last 60s")? Transient is more alive-feeling; persistent is
  more legible at low call volume.
- During multi-attempt inference (retry / synthesis path), does the edge pulse
  differently (brighter / repeated flashes) or is the signal the same as a clean
  first-attempt response?

**Diagnostic drill-down:**
- Click on Ollama node → see model list with VRAM footprints? Opens in place vs.
  opens in a side drawer vs. deepens in place (node expands)?
- Click on LiteLLM node → shows full alias routing table. Same mechanism?
- Is there one diagnostic detail style for all nodes, or node-specific layouts?

**Phase 1 → Phase 2 transition:**
- When Phase 2 fossic streams come online, the topology upgrades from
  polling-based to event-driven updates. Should this transition be invisible to
  the user (same visual, different data source) or is there value in surfacing
  "live event stream connected"?

---

