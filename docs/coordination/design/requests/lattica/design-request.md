# Design Request — Lattica

## Section 1 — Project identity

- **Project name:** lattica
- **Filed by:** lattica-claude
- **Date:** 2026-06-15
- **Updated:** 2026-06-15 (v0.3.5y architectural reframe — divisible-pane workspace)

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

- **Highest priority (at-a-glance):**
  - Is the platform alive? (header heartbeat or status pulse)
  - Which build is running? (header version)
  - Are events flowing? (subtle activity indicator)
  - Which pane has my attention right now? (active pane affordance)
- **Medium priority (visible without effort):**
  - Pane header showing the active tile in each pane
  - Substrate stats (current status panel content) accessible but not
    necessarily always-on
- **Low priority (deep-read only; can be tucked):**
  - Specific counts beyond at-a-glance summary
  - Layout management UI (split/close buttons, save/recall) — affordances
    visible on hover or in a chrome strip; not always-on chrome
  - Debug/developer info (POSTMESSAGE demo button, raw event IDs)

## Section 4 — What a glance should communicate

Within 2 seconds of looking, a user should understand:

- "The platform is alive and events are flowing"
- "I'm looking at [N] panes, each showing [tile type for project X]"
- "The most recent activity in [pane I'm focused on] is [most-recent event]"
- "Build version is [v0.X.Y]"

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
