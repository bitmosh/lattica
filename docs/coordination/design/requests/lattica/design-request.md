# Design Request — Lattica

## Section 1 — Project identity

- **Project name:** lattica
- **Filed by:** lattica-claude
- **Date:** 2026-06-15

## Section 2 — What this project contributes visually

Lattica's footprint is the platform shell itself — the structural elements
that wrap and host all other projects' contributions:

- **Header** — Lattica branding, version (from package.json), subtitle.
  What this communicates: which build is running, that the platform is alive.
- **Status panels (4 currently)** — FOSSIC STORE, CANARY STREAM, TILE REGISTRY,
  POSTMESSAGE (ADR-010). What these communicate: substrate health at a glance.
- **Registered tile slot** — below the status panels; renders whatever tiles
  are registered via tileSectionRegistry. Currently shows HelloTile and
  CerebraSignalTile. What this communicates: live platform activity.
- **Future shell affordances** — settings, switching between views (tile
  vs. immersive), version history, etc. Not implemented; out of scope for
  this iteration.

## Section 3 — Visual priority hierarchy

- **Highest priority (at-a-glance):** is the platform alive? are events
  flowing? which build is this? Status panel HEADERS (FOSSIC STORE, etc.)
  are at-a-glance landmarks.
- **Medium priority:** specific counts (stream count, tile count, event
  rates), event content within the tile slot
- **Low priority:** raw event IDs, full timestamps, technical details that
  belong in DevTools or expand-to-see contexts

## Section 4 — What a glance should communicate

Within 2 seconds of looking, a user should understand:

- "The platform is online; events are flowing"
- "There are N kinds of activity happening" (status panels show categories)
- "This is build v0.3.X" (header)
- "The most recent activity is [X type from Y project]" (tile slot)

## Section 5 — What doesn't matter at-a-glance

- Specific event IDs (data-event-id) — DevTools-level information
- Per-event timestamps to the second — minute-level granularity is enough
  for casual glances
- The POSTMESSAGE demo button content — it's a developer affordance, can be
  visually minor or moved to a settings/debug panel

## Section 6 — Cross-project visual relationships

- The status panels' visual idiom (uppercase header, body content, subtle
  border) sets the convention; project tiles in the registered slot should
  echo this idiom for visual cohesion
- The "v0.X.Y" version pill in the header sets the accent color (currently
  amber); other branding accents should harmonize
- Project tiles should not visually overpower the status panels — status
  panels are the platform's "vital signs"; tiles are content

## Section 7 — Current implementation (reference only)

- Current files: `src/App.tsx`, `src/tiles/HelloTile.tsx`,
  `src/tiles/cerebra-signal/CerebraSignalTile.tsx`
- Current visual approach: dark dashboard aesthetic, monospace technical
  feel, ALL CAPS section headers, amber accent for branding, green for
  status-positive, four-column status row with content below
- What works: the dashboard aesthetic feels right for a system-observability
  tool; the dark palette and monospace match the technical nature of the
  data; the status-panels-on-top-content-below structure is legible
- What doesn't work: visual hierarchy gets weaker as the tile slot fills
  (no visual scoping between projects); no clear way for future
  multi-project tile coexistence; the "v0.3.X" version pill orange could
  shift to a system-status indicator

## Section 8 — Constraints (real ones only)

- Tauri webview environment — full CSS support, no special browser APIs
  required; React 19 in JSX react-jsx mode
- `--portfolio-*` design token namespace per ADR-015 (host owns tokens)
- `tileSectionRegistry` is the canonical place tiles register; rendering
  slot iterates over `registry.list()` and renders content functions
- Monospace required for event content (data, not prose)

## Section 9 — Open questions for frontend-design

- How should the platform shell signal which projects have contributed
  events vs. which are connected but silent? Visual grouping by project?
  Color-coding? Icons?
- The status-panel-row vs. tile-slot vertical division — should there be
  more visual scoping between projects within the tile slot, or should
  the slot remain a unified stream?
- How does the shell scale when there are 5+ projects each with 2-5
  renderer types? Visual organization at scale?
- What's the right pattern for "platform-level affordances" (settings,
  view switching, debug)? Sidebar? Top-right corner? Modal?
- The tile registry count panel — should the "TILE REGISTRY" label and
  count remain a peer of FOSSIC STORE / CANARY STREAM / POSTMESSAGE,
  or should it move into a meta-level shell affordance?
