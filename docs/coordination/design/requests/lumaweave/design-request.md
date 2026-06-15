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
