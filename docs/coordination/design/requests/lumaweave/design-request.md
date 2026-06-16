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
