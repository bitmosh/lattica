---
title: Lattica Now — Live State
status: Phase 0 — v0.3.5k — platform live with 5 active tiles
last_updated: 2026-06-29
---

# Lattica Now

This file holds live state. Everything in `docs/` other than this file is
timeless or aspirational. When in doubt about what is currently true, this
file wins.

## Version

`v0.3.5k` — Shell activity lanes live: fossic `**` subscription, 6 project
SVG tick lanes, real-time rate counter. Five tiles active. fossic subscription
pattern established platform-wide.

`package.json` version: `0.3.5` (sub-version letter tracked in pass names only).
`src-tauri/Cargo.toml` version: `0.2.0` (needs bump — tracked in H3/known bugs).

## Current phase

**Phase 0 — Platform Bootstrap.** The bootstrap architecture is locked (ADR-009
through ADR-014). All six advocate coordination rounds complete. The phase is
significantly further than documented as of 2026-06-14 — five tiles are live,
the fossic subscription pattern is in use by four components, and Shell has
live event-stream monitoring.

Phase 0 exit criteria (from `docs/PHASES.md`) are not yet fully met: Playwright
test suite is absent and LumaWeaveTile has no live data source. All other tiles
are live.

## What exists right now

### App shell

- **`src/components/workspace/Shell.tsx`** — topbar with brand, 6-lane event
  activity scope (lattica / cerebra / lumaweave / policy / fossic / aistack),
  real-time rate counter, platform drawer (stub). Subscribes `fossic **` on
  mount; routes events to per-lane SVG tick buffers via `routeToScope()`. 1 Hz
  clock drives tick position. 15 s prune interval keeps WINDOW_MS = 90 s
  rolling window. Known bug: brand label shows `v0.3.4` (M10).

- **`src/components/workspace/PaneWorkspace.tsx`** — three-pane layout
  (left / topRight / bottomRight). Tile picker per pane. Freeze state tracked
  per pane (`frozen: Record<PaneId, boolean>`). Default tiles: cerebra / policy /
  fossic.

- **`src/components/workspace/Pane.tsx`** — renders tile component by key via
  if/else chain, freeze button, FreezeOverlay when frozen. Known bug:
  `queuedCount={0}` hardcoded (H4 — freeze wiring incomplete).

- **`src/components/workspace/FreezeOverlay.tsx`** — displays "N events queued"
  badge + thaw button. Reads `queuedCount` prop (currently always 0).

### Tiles (all live unless noted)

- **`src/tiles/cerebra-signal/CerebraSignalTile.tsx`** — fossic subscription to
  `cerebra/agent-trace/*`. Maintains rolling history of `SignalEvaluated` events.
  Renders signal name, prediction, outcome, confidence per event. Backfills
  history on mount via `fossic_query` IPC call.

- **`src/tiles/policy-scout/PolicyScoutTile.tsx`** — two tracks:
  - Track A: 30 s CLI poll for current posture state
  - Track B: fossic subscription to `policy-scout/**` streams; posture fast-path
    (immediate UI update on posture-change events), decisions feed (rendered
    decision events with outcome badges)
  `trackBState` transitions `'idle' → 'connecting' → 'live'` on first event.

- **`src/tiles/fossic/FossicTile.tsx`** — 6-lane event hub visualizer. Same
  SCOPE_PROJECTS as Shell. SVG tick lanes + per-lane event rate. Known bug:
  LANES static array has hardcoded `relayStatus` / `healthy` fields that do not
  reflect actual relay liveness (C2 — scheduled fix).

- **`src/tiles/ai-stack/AiStackTopologyTile.tsx`** — live fetch to local AI
  service endpoints (Ollama, LiteLLM, Open WebUI). Polls on mount and on
  user-triggered refresh.

- **`src/tiles/lumaweave/LumaWeaveTile.tsx`** — static stub. Renders
  placeholder content only. Live data source (LumaWeave graph + fossic remote
  store federation) is Phase 2+ work.

### Control plane / infrastructure

- `src/control-plane/registry/RegistryContract.ts` — registry contract
- `src/control-plane/tile-section/tileSectionRegistry.ts` — tile section registry
- `src/control-plane/payload-renderer/payloadRendererRegistry.ts` — payload
  renderer registry (used by CerebraSignalTile)
- `src/registrations.ts` — startup registrations (Cerebra SignalEvaluated renderer)

### Rust backend (`src-tauri/src/lib.rs`)

- fossic store at `~/.lattica/fossic/store.db` — created on first launch
- `fossic_subscribe` / `fossic_unsubscribe` — subscription management
- `fossic_query` — used by CerebraSignalTile for backfill on mount
- Startup canary event: fires to `lattica/system/canary` on app start.
  Known bug: version payload hardcoded `"0.2.0"` (H3 — one-line fix queued).
- `fossic_query_remote_store` — registered but has zero frontend callers.
  Intended for future LumaWeaveTile federation view (Phase 2+). Removal
  queued (H5).
- 10 read commands via Tauri IPC (ADR-012)
- `fossic_append` is NOT a Tauri command — write-only from Rust

### Documentation

- `docs/DESIGN.md` — platform architecture, module interaction model
- `docs/PHASES.md` — all 12 phases with exit criteria
- `docs/EVENT_FABRIC.md` — ES toolkit event contracts
- `docs/ADR/` — ADR-001 through ADR-014+ locked
- `docs/aseptic/repo_fix_2026-06-29.md` — active fix tracker

## What does NOT exist yet

- Playwright test suite (zero coverage — T11)
- Mode B child webview (Linux positioning issue still open)
- LumaWeaveTile live data source (Phase 2+ — Reflective Twin Architecture)
- Pane layout persistence across restarts (M6)
- `useFossicSubscription` hook — subscription setup/teardown copy-pasted
  into Shell, CerebraSignalTile, PolicyScoutTile, FossicTile (T13)
- Shared fossic types file — `SerializedEvent` / `FossicEventPayload` defined
  4× (T12)
- Platform drawer content (M9 — permanent stub)

## Known bugs (tracking in repo_fix_2026-06-29.md)

| ID | Severity | File | Description |
|----|----------|------|-------------|
| C2 | Critical | FossicTile.tsx | LANES relay status hardcoded; cerebra + policy lanes show `pre-relay/healthy:false` despite live subscriptions |
| H3 | High | lib.rs:319 | Canary event version payload frozen at `"0.2.0"` |
| H4 | High | Pane.tsx:115 | `queuedCount={0}` hardcoded; freeze button doesn't pause tile animation or count events |
| H5 | High | lib.rs:345 | `fossic_query_remote_store` registered with zero frontend callers |
| M10 | Medium | Shell.tsx:146 | Brand label shows `v0.3.4` |

## To run locally

```bash
cd ~/Projects/lattica
npm run tauri dev   # starts Vite on :1421 + Tauri dev window
```

First build: ~2–5 min (compiles fossic + fossic-tauri). Incremental: ~0.12 s.

## Fossic subscription pattern (established)

```ts
// invoke
const subId = await invoke<string>('fossic_subscribe', {
  streamPattern: 'cerebra/**',
  branch: null,
  includeSystem: false,
  queueSize: null,
});

// listen
const unlisten = await listen<FossicEventPayload>('fossic:event', e => {
  if (e.payload.subscription_id !== subId) return;
  // handle e.payload.event
});

// teardown
unlisten();
invoke('fossic_unsubscribe', { subscriptionId: subId }).catch(() => {});
```

Always use a cancel guard (`let cancelled = false`) between invoke and listen
to handle component teardown during async setup.

## Next moves (from repo_fix_2026-06-29.md)

1. **C2** — FossicTile: derive `healthy`/`relayStatus` from live buffer activity
2. **H3** — lib.rs: `"0.2.0"` → `env!("CARGO_PKG_VERSION")`
3. **H5** — Remove `fossic_query_remote_store` until LumaWeaveTile needs it
4. **H4** — Wire freeze button: animation pauses, subscription continues,
   queuedCount accumulates, thaw resumes live state (no replay)
5. **v0.3.6 bump** — letters running low; next meaningful batch of changes
   should bump the minor version
