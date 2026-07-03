---
title: Lattica Now — Live State
status: Phase 0 — v0.3.7 — platform live with 5 active tiles
last_updated: 2026-07-03
---

# Lattica Now

This file holds live state. Everything in `docs/` other than this file is
timeless or aspirational. When in doubt about what is currently true, this
file wins.

## Version

`v0.3.7` — `useFossicSubscription` hook extracted platform-wide; `LATTICA_FOSSIC_STORE`
env var added as platform store contract; Vitest + Playwright + Rust unit test suite
established; `--project-accent-bo` dead token removed.

`package.json` version: `0.3.7`.
`src-tauri/Cargo.toml` version: `0.3.7`.
`src-tauri/tauri.conf.json` version: `0.3.7`.

## Current phase

**Phase 0 — Platform Bootstrap.** The bootstrap architecture is locked (ADR-009
through ADR-014). All six advocate coordination rounds complete. The phase is
significantly further than documented as of 2026-06-14 — five tiles are live,
the Fossic subscription hook (`useFossicSubscription`) is in use by four components, and Shell has
live event-stream monitoring.

Phase 0 exit criteria (from `docs/PHASES.md`) are not yet fully met:
LumaWeaveTile has no live data source. All other tiles are live. A three-tier
test suite (Rust unit, Vitest TS unit, Playwright E2E) is now in place.

## What exists right now

### App shell

- **`src/components/workspace/Shell.tsx`** — topbar with brand, 6-lane event
  activity scope (lattica / cerebra / lumaweave / policy / fossic / aistack),
  real-time rate counter, platform drawer (module health rows + Fossic pillar
  SVG animation). Subscribes `fossic **` on mount; routes events to per-lane
  SVG tick buffers via `routeToScope()`. 1 Hz clock drives tick position. 15 s
  prune interval keeps WINDOW_MS = 90 s rolling window.

- **`src/components/workspace/PaneWorkspace.tsx`** — three-pane layout
  (left / topRight / bottomRight). Tile picker per pane. Freeze state tracked
  per pane (`frozen: Record<PaneId, boolean>`). Default tiles: cerebra / policy /
  fossic.

- **`src/components/workspace/Pane.tsx`** — renders tile component by key via
  if/else chain, freeze button, FreezeOverlay when frozen.

- **`src/components/workspace/FreezeOverlay.tsx`** — displays "N events queued"
  badge + thaw button. Reads `queuedCount` prop (currently always 0).

### Tiles (all live unless noted)

- **`src/tiles/cerebra-signal/CerebraSignalTile.tsx`** — Fossic subscription to
  `cerebra/agent-trace/*`. Maintains rolling history of `SignalEvaluated` events.
  Renders signal name, prediction, outcome, confidence per event. Backfills
  history on mount via `fossic_query` IPC call.

- **`src/tiles/policy-scout/PolicyScoutTile.tsx`** — two tracks:
  - Track A: 30 s CLI poll for current posture state
  - Track B: Fossic subscription to `policy-scout/**` streams; posture fast-path
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

- Fossic store at `~/.lattica/fossic/store.db` — created on first launch
- `fossic_subscribe` / `fossic_unsubscribe` — subscription management
- `fossic_query` — used by CerebraSignalTile for backfill on mount
- Startup canary event: fires to `lattica/system/canary` on app start.
- Tauri IPC commands: `fossic_subscribe`, `fossic_unsubscribe`, `fossic_query`,
  `lattica_store_status`, `ps_watch_status`, `ps_approvals_list`, `ps_approve_once`,
  `ps_deny`, `poll_ai_stack`, `ollama_load_model`, `ollama_unload_model`,
  `activate_lockdown`, `deactivate_lockdown`, `restart_watch`
- `fossic_append` is NOT a Tauri command — write-only from Rust

### Documentation

- `docs/EVENT_FABRIC.md` — ES toolkit event contracts
- `docs/adr/` — ADR-001 through ADR-017 locked
- `docs/aseptic/repo_fix_2026-06-29.md` — active fix tracker

## What does NOT exist yet

- Mode B child webview (Linux positioning issue still open)
- LumaWeaveTile live data source (Phase 2+ — Reflective Twin Architecture)

## Known bugs (tracking in repo_fix_2026-06-29.md)

| ID | Severity | File | Description |
|----|----------|------|-------------|
| C2 | Critical | FossicTile.tsx | LANES relay status hardcoded; cerebra + policy lanes show `pre-relay/healthy:false` despite live subscriptions |

## To run locally

```bash
npm run tauri:dev   # starts Vite on :1421 + Tauri dev window
```

First build: ~2–5 min (compiles fossic + fossic-tauri). Incremental: ~0.12 s.

## Fossic subscription pattern (established)

Use the `useFossicSubscription` hook in React components:

```ts
import { useFossicSubscription } from '../hooks/useFossicSubscription';

function MyTile() {
  useFossicSubscription('cerebra/**', (event) => {
    // handle event (SerializedEvent)
  });
}
```

The hook manages cancel guard, subscription ID, and cleanup automatically.
For custom error handling, pass an options object:

```ts
useFossicSubscription('policy-scout/**', handleEvent, {
  onError: () => setStatus('source-unreachable'),
});
```

Source: `src/hooks/useFossicSubscription.ts`.

## Next moves (from repo_fix_2026-06-29.md)

1. **C2** — FossicTile: derive `healthy`/`relayStatus` from live buffer activity
   (cerebra and policy lanes currently show `pre-relay/healthy:false` despite
   active Fossic subscriptions)
