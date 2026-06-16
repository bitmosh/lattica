# LumaWeave — Current State Baseline

**Date:** 2026-06-16
**Filed by:** lumaweave-claude

---

## Section 1 — Current version + identity

- **Current version:** v0.19.0
- **Most recent tag:** none (version tracked in package.json only)
- **Most recent milestone commits:**
  - `4f28c47` — gwells: fix interaction index never populated (critical correctness fix)
  - `856dcd3` — gwells: fix hub-ring radius scaling
  - `977a6e8` — feat(events): add lifecycle event bridge (R-LW-005)
  - `c2eafbd` — feat(gwells): close lifecycle and headless polish
- **Identity:** A local-first, graph-based architecture-visualization workbench that renders code, docs, and configs as a typed node/edge network with custom physics layouts.

---

## Section 2 — What just shipped since last baseline

**gwells lifecycle and performance arc (c2eafbd and prior):**
Added `GWRuntimeState`, `GWDebugEvent`, `pause()`, `resume()`, `stop()`, `step()`, injectable scheduler, headless stepping, benchmark matrix, and interaction indexing by source well type. Structural resolver (`structuralResolver.ts`) moved well assignment away from string-literal filesystem matching toward topology-aware roles (root, spine, container, leaf, orphan, hub, bridge).

**gwells interaction-index bug fix (`4f28c47`):**
The ChatGPT-authored performance optimization declared `interactionsBySourceWellType` and switched the step loop to use it but never populated the Map. All inter-node forces (attraction, repulsion, spring, perpendicular) were silently dead every frame — only centerGravity and seedAdherence still ran. Nodes appeared to settle because seedAdherence pulled them toward seed positions, masking the breakage. Fixed: `rebuildResolvedInteractions()` now populates the index alongside the flat array. 12/12 gwells validation checks pass.

**gwells hub-ring radius fix (`856dcd3`):**
Both seeders were passing `Math.max(spineSpacing, directoryOffset)` (= 2400) as the arc-gap for hub-ring positioning. `directoryOffset` is a depth-level spacing value, not inter-ring-node clearance. With 46 root spines this produced a ring radius of ~35k. Fixed to `spineSpacing / 2` (= 600), giving ~8.8k radius.

**R-LW-005 — fossic event emission (`977a6e8`):**
LumaWeave now emits to fossic from the Rust Tauri backend. Stream `lumaweave/graph/events` declared. Five event types live: SourceLoaded, SourceLoadFailed, SourceSwitched, ThemeChanged, GraphLayoutSettled (command wired; frontend mount deferred pending gwells convergence signal). TypeScript invoke helpers in `src/lib/tauri-invoke.ts`. Wired at: `useGraphSourceSummary.ts` (SourceLoaded/Failed/Switched), `useLwThemeEventEmitter.ts` + `AppShell.tsx` (ThemeChanged).

**Re-settle audit:**
GWController has no `restart()`. Re-settle can be implemented as a `reheat()` method: zero all `nodeStates` velocities, optionally update `__gwellsSeedPositions` to current node positions so seedAdherence doesn't fight the new layout. Cost: S. `applyConfigOverride({ seedParams })` re-runs the seed function and resets positions — wrong path for Re-settle.

---

## Section 3 — Visual elements available for Lattica

### Fossic event stream

**Stream:** `lumaweave/graph/events`
**Current store:** `<project_root>/.lumaweave/fossic.db` (project-local — not yet on shared platform store; migration needed)

| Event type | Key payload fields | Renderer useful? |
|---|---|---|
| `SourceLoaded` | `adapter_id`, `source_key`, `node_count`, `edge_count` | Yes — primary health + size signal |
| `SourceLoadFailed` | `adapter_id`, `source_key`, `error` | Yes — error state, sticky in tile |
| `SourceSwitched` | `from_adapter_id`, `to_adapter_id` | Yes — context change signal |
| `ThemeChanged` | `from_theme_id`, `to_theme_id` | Optional — suppress by default |
| `GraphLayoutSettled` | `node_count`, `duration_ms` | Optional — dev/perf signal |

All types are flat PascalCase (matching Cerebra convention). No renderers exist yet — deferred until iter-4 design output and shared store are both in place.

### Cerebra `graph.json` adapter

Not built. No adapter for consuming `{vault}/.cerebra/graph.json` exists in the source adapter registry. Current adapter types: `self-graph`, `git-codebase`, `website-url`, `markdown-vault`, `cytoscape-json`, `openapi-spec`, `database-schema`, `package-dependency`, `cloud-infrastructure`, `issue-tracker`, `csv-edge-list`.

A Cerebra adapter would fit the registry shape and could be built when `graph.json` format is stable. Nothing blocks it architecturally — it's purely unbuilt.

### Iter-4 tile elements (wired status)

These were specified in the iter-4 design request. None are wired in Lattica's tree yet (read-only tile deferred to Track B):
- Graph health pill (LOADED / FAILED / LOADING / IDLE) — derivable from SourceLoaded/SourceLoadFailed events ✓
- Node/edge count badge — from SourceLoaded payload ✓
- Active source label — from SourceLoaded/SourceSwitched payload ✓
- Event type filter toggles [SRC] [LAYOUT] [THEME] — client-side, no API needed ✓
- All [API-NEW] controls (source switcher, retry, layout freeze, re-settle, physics preset) — blocked on shared store + reverse channel

---

## Section 4 — Open items / known follow-ups

**Blocked on shared platform fossic store:**
- All five [API-NEW] tile controls (source switcher, retry, layout freeze, re-settle, physics preset write)
- Lattica-side tile wiring (Track B, upcoming)
- Hidden [API-NEW] prerequisite: `AdapterListChanged` event emission needed for source switcher dropdown

**Deferred engine work:**
- `reheat()` controller method (S cost, waiting on Track B / tile control pass)
- `GraphLayoutSettled` frontend mount (gwells has no "settled" `GWRuntimeState` variant in v0.1.5; command registered in Rust, frontend not wired)
- Phase 2–6 gwells: macro controls, profile layer, specialized seed layouts, recommendation loop (all design-doc-only, not runtime)

**Known duplicate registry:**
`src/graph/physics/physicsDialectRegistry.ts` is a legacy v86e inventory registry still consumed by `GraphVisualInventoryPanel.tsx` for display listing. The real engine uses `GW_DIALECT_REGISTRY` from `src/physics/gwells/dialects.ts`. Different ID namespacing (`dialect.gwells.*` vs `gwells.dialect.*`). Safe to clean up — panel should iterate `listDialects()` from dialects.ts, then old registry deleted. Deferred.

**UI coverage gap:**
Engine supports `wellOverrides` and `interactionOverrides` via `applyConfigOverride` but UI only sends `seedParams`. Well/interaction controls not yet exposed.

---

## Section 5 — Cross-project signal

**gwells interaction-index bug interpretation note:**
Prior to `4f28c47` (landed 2026-06-15), all LumaWeave graph layouts were running without inter-node forces. Nodes settled via seedAdherence and centerGravity only. Layout behavior before this fix should be considered "seed-anchored drift," not full physics. Any visual benchmarks, screenshots, or layout quality assessments from before `4f28c47` reflect the broken state.

**Re-settle cost resolved:**
`reheat()` approach (S cost) is the correct implementation. Updating `BACKEND_PREP_REPORT.md` if not already reflected.

**Fossic path dep pattern:**
LumaWeave's `Option<Store>` degraded-mode Rust wrapper is documented in the cross-pollination file `cross-pollination/lumaweave/r-lw-005-fossic-emitter.md` — worth reading for any Tauri project integrating fossic.

---

## Section 6 — Pre-federation exploratory thoughts

**What stays local (high-volume, substrate-level):**
- Per-frame node position updates during gwells convergence — these are continuous mutations, not events. Not fossic-appropriate. Already handled entirely in-memory by the physics engine.
- Pin state changes (user dragging nodes) — fast, continuous, local
- Intermediate layout states during re-seeding or helix twist adjustments

**What relays to Lattica's hub (architectural decisions, completed states):**
- `SourceLoaded` / `SourceLoadFailed` / `SourceSwitched` — graph lifecycle events already live in fossic; these are exactly the kind of architectural decisions that are hub-relevant
- `GraphLayoutSettled` — final layout state, not intermediate frames; hub-relevant once the convergence signal is wired
- `ThemeChanged` — probably local only (may not be meaningful to the platform)
- Future: `AdapterListChanged` (needed for source switcher anyway)

**Existing data paths outside fossic:**
- `useSettingsStore` (Zustand + localStorage) — all settings including active adapter, dialect, helix twist, pin state. This is the primary LumaWeave state store. Not in fossic today.
- `src/fixtures/self-graph-generated.json` — the self-graph fixture, generated, not committed
- Local `fossic.db` at `<project_root>/.lumaweave/` — needs migration to shared platform store

**Fossic features worth specifically considering:**

*Branches* — Fossic flagged branches as genuinely applicable to LumaWeave's domain. This resonates: layout explorations are naturally branch-like. "I'm trying a knowledge-garden layout on this graph" = a branch of `lumaweave/graph/*`. If the layout doesn't work, drop the branch. If it does, merge it as the canonical layout state. This maps well onto how users actually experiment with gwells.

*Snapshots* — Graph state at convergence (node positions, well assignments, active dialect config) is exactly the kind of thing worth snapshotting. "What did this graph look like after I loaded the Cerebra source last Tuesday?" Currently nothing preserves this.

*Transforms at append time* — Less obvious utility for LumaWeave currently. Maybe: normalizing adapter_id to a display label at write time so downstream consumers don't need to dereference it. Exploratory.

*Aggregates over node/edge history* — Interesting if LumaWeave tracks graph growth over time (node count trending up/down as the codebase evolves). Not a current use case but natural for architecture visualization.

**Cerebra graph.json adapter — does federation change the consumption model?**
Yes, probably. Today the mental model is: LumaWeave polls a file artifact (`graph.json`). In a federated model, the cleaner path is: Cerebra emits a `GraphSnapshotAvailable` hub event with a reference to the snapshot, LumaWeave receives it and loads the graph. This avoids polling, makes the handoff observable, and fits naturally into the hub-relay pattern. The file artifact becomes an implementation detail, not the coordination mechanism.

**Concerns / unknowns:**
- Shared platform store path needs to be confirmed before anything can flow. This has been the blocker on all LumaWeave–Lattica integration work and should be the first thing resolved in the federation conversation.
- The settings store (Zustand/localStorage) and the fossic store represent two parallel state systems for LumaWeave. Federation may want some settings to be hub-observable (active adapter, dialect) which would require either emitting settings-change events or migrating those settings into fossic-backed storage. Worth scoping explicitly.
- If layout branches land, pin state needs to be branch-aware. Pins are currently stored in `useSettingsStore`. A branch switch should restore the pins that were active when that branch was last on. This is a medium-complexity constraint that affects any pin + branch design.
