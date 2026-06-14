# LumaWeave — Capabilities Inventory

**Project:** lumaweave
**Last updated:** 2026-06-13
**Status:** Living document

This file catalogs what LumaWeave offers to the Lattica platform — capabilities
relevant for display, integration, or re-use by other project modules. It is
organized by category. Not every capability is immediately available to Lattica;
the integration phase column indicates when each becomes relevant.

---

## Graph Rendering Engine

**What:** LumaWeave renders typed node/edge graphs using Sigma.js with a custom
rendering layer. Nodes carry a `type` field (file, directory, module, registry,
barrel, export, external) that drives visual encoding — color, shape, label
treatment, selection highlight. Edges carry `type` (import, re-export, dynamic,
css-link, registry-member) with directional arrow rendering.

**Data shape:** Graph is loaded from a source adapter as a `GraphPayload`
(`{ nodes: GraphNode[], edges: GraphEdge[] }`). Any process that produces this
shape can drive the graph view.

**Integration relevance:**
- Cerebra's knowledge graph export (`GraphExported` event) can drive a LumaWeave
  graph view directly if the payload conforms to `GraphPayload`
- Portfolio-level dependency maps (planned, later phase) would be rendered here
- Currently Lattica observes LumaWeave's graph state; future phases may allow
  Lattica to request specific graph loads

**Phase:** Available now; cross-project payload conformance discussion pending.

---

## gwells Physics Engine

**What:** A custom multi-pass physics layout system (`src/physics/`) with named
dialects (compact, radial, hub-ring, etc.) configurable per graph load. Supports
adaptive well assignment, hub-ring crowding relief, structural resolvers, and
fallback seeding safety. Physics dialects are registry-driven
(`physicsDialectRegistry`).

**Integration relevance:**
- For any future Lattica graph view, gwells is available as the layout engine
- gwells scope (stay internal vs. extract to `packages/gwells/`) is an open
  decision (R-LW-006 from requirements.md)

**Phase:** Available now; packaging decision TBD.

---

## Tile and Panel System

**What:** A slot-anchor docking engine with:
- `tileSectionRegistry` — typed slot definitions with anchor (top/bottom/left/right),
  section type, and default state
- `TileProvider` / `TileLayer` / `FloatingTile` — the React components that host
  content in docked or floating mode
- Per-axis snap engine, resize reflow, FORM/BREAK group semantics
- Settings-persisted tile positions and visibility (Zustand, schema v95+)

**Current tile sections (live):** source-adapter, qa-feedback, system-index,
agent-chat, radial-inspector, graph-controls, theme-inspector, settings, and
several auxiliary panels.

**Integration relevance:**
- LumaWeave's tile system is the most production-validated tile architecture in the
  portfolio; Lattica Claude has it as a design reference (R-LW-002)
- Three sections (source-adapter, qa-feedback, system-index) are candidates for
  future relocation to a shared Lattica shell once the decision is made

**Phase:** Available now; relocation decision requires explicit coordination.

---

## Theme Token System

**What:** OKLCH design tokens defined in `src/styles/lumaweave-visual-handles.css`
and the token registry (`docs/theme/token-sets.md`). Token slots: `--lw-accent`,
`--lw-app-background`, `--lw-text-primary`, `--lw-panel-background`, graph-specific
tokens (`--lw-node-*`, `--lw-edge-*`), and a cluster color palette. Supports
live theme switching via CSS variable override injection.

**WCAG verification:** Contrast badge and per-criterion AA/AAA aggregation are live
in the theme inspector tile. All production tokens have been WCAG-audited.

**Integration relevance:**
- Lattica's own tile UI should use this vocabulary for consistent cross-app look
- Cerebra, Bo, and ai-stack tiles that render in Lattica should reference these
  tokens for semantic color (R-LW-001)
- Shared package vs. direct-read from lumaweave repo is an open question

**Phase:** Available now; shared publication mechanism TBD.

---

## Registry Architecture

**What:** 20+ typed registries, two tiers:
- **T1 (static):** `const`-array + pure helpers, no subscription. Examples:
  `physicsDialectRegistry`, `systemIndexRegistry`, `themeTargetRegistry`
- **T2 (runtime-reactive):** `register()` + `subscribe()` pattern. Examples:
  `sourceAdapterRegistry`, `tileSectionRegistry`, `inspectorSpokeRegistry`,
  `commandRegistry`

T2 registries are the extensibility surface — modules register into them at
startup without modifying core.

**Integration relevance:**
- Pattern reference for Lattica's own module registration
- `sourceAdapterRegistry` specifically is the extensibility point for new data
  sources; Lattica modules could register adapters here if the coupling model
  allows it

**Phase:** Available now as a pattern reference; direct extension requires
coordination on whether LumaWeave's registry is the right home for Lattica modules.

---

## Source Adapter SDK

**What:** A typed adapter registration system (`registerSourceAdapter()`,
`AdapterConfig` discriminated union) that decouples data sources from the graph
rendering layer. Adapters declare: `id`, `label`, `transport` (file | vault |
database-schema | sibling-module), `coupling` (standalone | registry-extension),
and `status` (candidate | registered).

**Current registered adapters:** file-tree (default), self-graph, and several
candidates in development.

**Integration relevance:**
- Any project that wants to drive a LumaWeave graph view contributes a source
  adapter (e.g., Cerebra contributing a `cerebra-knowledge-graph` adapter)
- The `transport: "sibling-module"` coupling type is specifically designed for
  cross-project module coupling within the Lattica context

**Phase:** Available now; Cerebra knowledge graph adapter is a planned extension.

---

## Self-Graph Pipeline

**What:** `scripts/generate-self-graph.mjs` generates a typed node/edge graph of
LumaWeave's own codebase from source analysis (import tracing, registry extraction,
barrel detection). Output is a `GraphPayload` JSON fixture.

**Integration relevance:**
- Can be extended to portfolio scope: a `generate-portfolio-graph.mjs` that maps
  all Lattica projects as nodes with inter-project dependency edges (R-LW-004,
  planned later phase)

**Phase:** Self-graph available now; portfolio-scope extension is future.

---

## E2E Test Infrastructure

**What:** Playwright E2E suite (`tests/e2e/`) covering graph load, tile visibility,
settings persistence, source adapter switching, theme changes, and control plane
interactions. ~80+ test cases, Node 22, `PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers`.

**Integration relevance:**
- Test patterns (especially the `__lwTauriMock` shim for Tauri invoke calls) are
  reference implementations for how to test Tauri-backed features without a real
  Tauri runtime
- The self-graph fixture generation step (`npm run generate:graph`) is a CI
  prerequisite — any Lattica CI that imports LumaWeave test infrastructure must
  include this step

**Phase:** Available now as a pattern reference.

---

## Tauri IPC Infrastructure

**What:** LumaWeave's Tauri 2 backend (`src-tauri/`) provides the IPC bridge between
the React webview and Rust. Key patterns:
- `src/lib/tauri-invoke.ts` — the `__lwTauriMock` shim for test/dev mode
- `tauri::async_runtime::spawn()` — the correct pattern for async Rust tasks
  (no second Tokio runtime)
- Tokio features: `["rt", "time"]` only (no `rt-multi-thread` — Tauri 2 provides
  its own multi-thread runtime)

**Integration relevance:**
- When `fossic-tauri` IPC commands are added, they follow this same pattern
- The mock shim pattern only covers `invoke()` — a separate mechanism is needed
  for `listen()` push events from fossic subscriptions (R-LW-008)

**Phase:** Available now; fossic IPC extension is pending fossic-tauri integration.

---

## Agent Chat Tile

**What:** An in-app agent chat panel (Phase v112) that supports multi-turn
conversations with a configurable inference backend, message history, and
streaming response rendering.

**Integration relevance:**
- The inference backend configuration here is an early form of what Lattica may
  eventually want as a cross-project chat/agent surface
- Currently scoped to LumaWeave only

**Phase:** Available now (v0.19.0+); Lattica cross-project coupling is future.

---

## Capabilities NOT currently available

These are planned but not implemented:
- **fossic event emission** — LumaWeave does not yet emit any fossic events
- **Cross-project causation chain** — depends on fossic integration
- **Push event test mock** — `listen()` path has no test shim (R-LW-008)
- **Portfolio graph generation** — self-graph only today
- **gwells as standalone package** — currently internal only

---

*Update this file when a capability ships, is deprecated, or changes scope.*
