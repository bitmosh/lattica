# LumaWeave — Lattica Requirements

**Project:** lumaweave
**Author:** LumaWeave Claude (acting as lumaweave advocate)
**Date:** 2026-06-13
**Status:** Initial requirements deposit

LumaWeave is the existing graph-visualization workbench (v0.19.0, Tauri 2 +
React 19 + Sigma.js + Zustand). It is both a **contributor** to Lattica — its
theme token system, tile/panel architecture, and source adapter SDK are the most
mature design artifacts in the platform — and a **consumer** of Lattica, needing
its own operational events visible alongside the rest of the portfolio. The
relationship is explicitly sibling, not parent-child: LumaWeave renders its own
graphs; Lattica is a separate surface that observes the platform.

---

---
id: R-LW-001
category: naming-convention
priority: must-have
---

## R-LW-001 — Token vocabulary adoption: LumaWeave as theming source of truth

**Category:** naming-convention
**Priority:** must-have

**Specific need:**
Lattica should adopt LumaWeave's OKLCH design-token vocabulary as the shared
theming substrate for the portfolio. The token system is defined in
`docs/theme/` and `docs/token-registry.json` in the lumaweave repo with
established slots: `--lw-accent`, `--lw-app-background`, `--lw-text-primary`,
`--lw-panel-background`, WCAG-correct color-mix patterns, and graph-specific
tokens (`--lw-node-*`, `--lw-edge-*`, cluster palette). If Lattica introduces
a parallel token vocabulary, themes across LumaWeave and Lattica will drift
silently — the same palettes rendering differently in two tools a developer
has open side-by-side is a confusing experience.

**Why it matters:**
LumaWeave's token system is the only design system in the portfolio with live
WCAG verification (contrast badge, per-criterion AA/AAA aggregation) and
production usage across ~20 themed surfaces in the same Tauri/React stack.
Starting fresh in Lattica means duplicating a year of WCAG auditing and visual
tuning. Adopting the shared semantics preserves that investment and makes both
apps feel like the same design language.

**Constraints:**
- LumaWeave tokens use the `--lw-` prefix, which is LumaWeave-specific. Lattica
  could adopt a shared prefix (e.g., `--portfolio-`) or alias-map LumaWeave
  tokens. The exact mechanism is Lattica Claude's to decide; the constraint is
  that slot semantics (what each token means) must match and not drift.
- Token values should be derivable from the same source file, not copy-pasted
  literals that decay independently.
- The fossic payload renderers (R-F-006) should also respect the shared token
  vocabulary — visual coherence across LumaWeave and Lattica requires a common
  naming convention.

**Adjacent project awareness:**
All eight projects eventually render in Lattica. A shared token system is the
prerequisite for consistent cross-project tile appearance. Cerebra's payload
renderers and Bo's thinking-trace tile both need to know the token vocabulary
before implementation begins.

**Outstanding questions:**
Does Lattica want LumaWeave to publish the token system as a shared npm package,
or does Lattica read the token registry directly from the lumaweave repo? A
shared package is cleaner for multi-project consumption; direct-read avoids
introducing a publication and versioning step.

---

---
id: R-LW-002
category: tile-design
priority: must-have
---

## R-LW-002 — Tile/panel architecture: LumaWeave as design reference

**Category:** tile-design
**Priority:** must-have

**Specific need:**
LumaWeave's tile/panel system (slot-anchor docking, per-axis snap engine,
floating-tile group reconcile, resize reflow, `TileAnchor` schema,
`TileLayoutEntry`, `createDefaultTile` helper, docked/floating mode, FORM/BREAK
group semantics) is the most fully-designed tile system in the platform.
Lattica's tile shell should treat this as the design reference — either adopting
compatible schema shapes or explicitly diverging with documented rationale.

**Why it matters:**
Lattica will host tiles from all eight projects. If Lattica designs its own tile
system without reference to LumaWeave's patterns, two parallel systems will
exist in the portfolio and any future tile-sharing becomes a translation problem.
Specifically: (1) LumaWeave's `tileSectionRegistry` already defines slot IDs,
docking anchors, and section types — Lattica should use compatible identifiers
or define a clear namespace mapping; (2) LumaWeave's architecture has been
validated through ~20 E2E tests.

**Constraints:**
- LumaWeave tiles are settings-driven (Zustand + localStorage). Lattica will
  likely use a different persistence model. Schema compatibility is about
  structural naming and semantics, not byte-level compatibility.
- Three tile sections in LumaWeave are flagged as deferred candidates for
  relocation (`source-adapter`, `qa-feedback`, `system-index`). If they
  eventually migrate to Lattica, their tile IDs should port cleanly without
  renaming.
- Direct React component reuse between the two Tauri apps is not a near-term
  goal — conceptual schema alignment is.

**Adjacent project awareness:**
All eight projects contribute tiles. A reference tile schema from LumaWeave
avoids each project inventing its own slot nomenclature independently.

**Outstanding questions:**
Does Lattica adopt the `TileAnchor` / `TileLayoutEntry` schema shape directly,
or define its own canonical schema that LumaWeave maps to? LumaWeave needs to
know which direction before assigning IDs to its deferred-tile migration
candidates.

---

---
id: R-LW-003
category: tile-design
priority: nice-to-have
---

## R-LW-003 — LumaWeave operational tile in Lattica

**Category:** tile-design
**Priority:** nice-to-have

**Specific need:**
A Lattica tile showing LumaWeave's current operational state: active source
adapter (adapter ID + status), last graph load result (success/error/node
count/edge count), load latency (ms), and current theme name. One card — the
"LumaWeave slot" in the Lattica shell.

**Why it matters:**
When both apps are open side-by-side (common workflow), knowing what LumaWeave
has loaded without switching windows is ergonomically useful. It also validates
the fossic subscription model: if Lattica can subscribe to `lumaweave/graph`
events and render a status tile, the subscription pattern is proven for more
complex tiles across the portfolio.

**Constraints:**
- Blocked on R-LW-005 (fossic integration). No fallback polling preferred.
- Low footprint: one card, the fields above, no graph preview or node list.

**Adjacent project awareness:**
Graph-load latency will become interesting to Cerebra once Cerebra drives
LumaWeave graph loads via the `sibling-module` coupling hook. At that point the
tile becomes a cross-project causation window.

**Outstanding questions:**
None blocking.

---

---
id: R-LW-004
category: tile-design
priority: future
---

## R-LW-004 — Self-graph mechanism extended to portfolio-level map

**Category:** tile-design
**Priority:** future

**Specific need:**
LumaWeave's self-graph pipeline (`scripts/generate-self-graph.mjs`) generates a
typed node/edge graph of LumaWeave's own codebase. Extended to the portfolio
scope, it could produce a **portfolio map**: nodes for each project (ai-stack,
cerebra, bo, policy-scout, lumaweave, fossic, lattica), edges for declared
inter-project dependencies, annotated with integration status and fossic stream
presence. Lattica renders this as the "portfolio overview" tile.

**Why it matters:**
The portfolio map is the most legible artifact of Lattica's mission. LumaWeave
already has the generation pipeline and Sigma.js rendering; extending it to
portfolio scope is additive, not greenfield.

**Constraints:**
- Phase 4+ item, not for v1 Lattica.
- A portfolio generator would run outside the LumaWeave app on a shared data
  format.
- Inter-project dependency edges need to be explicitly documented, not inferred
  from import analysis across separate repos.

**Adjacent project awareness:**
All projects contribute nodes. Explicit dependency documentation would need a
shared home (possibly in the lattica repo).

**Outstanding questions:**
Is the portfolio map a Lattica-internal artifact, or does LumaWeave generate
and push it via fossic? Deferring to Lattica Claude.

---

---
id: R-LW-005
category: infrastructure
priority: must-have
---

## R-LW-005 — fossic integration: LumaWeave graph event stream

**Category:** infrastructure
**Priority:** must-have

**Specific need:**
LumaWeave needs to emit fossic events to enable R-LW-003 and future cross-project
causation traces. Proposed stream prefix: `lumaweave/graph`. Proposed event types:

- `SourceLoaded` — payload: adapter ID, node count, edge count, load latency ms
- `SourceLoadFailed` — payload: adapter ID, error message
- `SourceSwitched` — payload: previous adapter ID, new adapter ID
- `ThemeChanged` — payload: new theme name, previous theme name
- `GraphLayoutSettled` — payload: node count, gwells physics variant, settle time ms

**Why it matters:**
Without fossic events, LumaWeave is invisible to Lattica's subscription model.
These five event types cover all operationally interesting state changes with
minimal overhead. `SourceLoaded` + `SourceSwitched` together give the complete
picture of what the developer is doing in LumaWeave at any moment.

**Constraints:**
- LumaWeave is a Tauri app — integration uses `fossic-tauri` or `fossic` Rust
  core from the Tauri backend. Rust-side appends recommended (same process, no
  additional IPC round-trip).
- **Adding the fossic crate requires explicit developer approval per the
  CLAUDE.md package installation safeguard.** Noted here so it does not
  surprise the implementation phase.
- Event payloads must not include graph node/edge data, file paths, or vault
  content — metadata only (counts, IDs, latencies).

**Adjacent project awareness:**
When Cerebra eventually drives LumaWeave graph loads via the `sibling-module`
adapter coupling hook, the causation chain (Cerebra request → LumaWeave
`SourceLoaded`) is the canonical cross-stream trace Lattica should render.
R-LW-005 is the prerequisite for that chain.

**Outstanding questions:**
1. `fossic-tauri` vs. `fossic` Rust core: the companion crate adds Tauri IPC
   helpers that are not needed for Rust-side-only event emission. LumaWeave
   prefers the smaller Cargo surface.
2. Should `GraphLayoutSettled` carry the gwells physics variant name to allow
   Lattica to correlate layout times with specific gwells configurations?

---

---
id: R-LW-006
category: registry-extension
priority: nice-to-have
---

## R-LW-006 — Source adapter vocabulary as Lattica data-source reference

**Category:** registry-extension
**Priority:** nice-to-have

**Specific need:**
LumaWeave's source adapter SDK (`registerSourceAdapter()`, `AdapterConfig`
discriminated union, `SourceAdapterEntry` with `coupling`, `transport`, and
`status: candidate | registered` fields) is a general-purpose data-source
abstraction. Lattica's model for connecting to per-project fossic streams could
adopt compatible vocabulary: a named adapter per project, a status field, and a
transport type (fossic-subscription vs. direct-poll). This is a naming-alignment
request, not a code reuse requirement.

**Why it matters:**
If Lattica builds a parallel "project connection" abstraction with different
names for the same concepts, the solo developer navigates two separate registries
when integrating a new project. Compatible vocabulary reduces that overhead.

**Constraints:**
- LumaWeave's SDK targets file/vault sources; Lattica targets fossic streams —
  implementations differ even if concepts align.
- Low urgency: only relevant when Lattica begins registering per-project
  connections formally.

**Adjacent project awareness:**
All eight projects would eventually be "registered" in Lattica's connection model.

**Outstanding questions:**
Does Lattica even need a per-project adapter registry, or does fossic glob
pattern subscription make such a registry unnecessary? If fossic subscriptions
are sufficient, this requirement may reduce to just adopting the
`candidate | registered` status vocabulary for Lattica's internal tracking.

---

## What LumaWeave doesn't need from Lattica

- Lattica is not a tile rendered inside LumaWeave — they are separate Tauri
  applications
- Lattica does not control LumaWeave's source adapter selection, theme, or
  settings — read-only observer only
- Lattica does not replace the radial inspector, spoke panels, or graph geometry
  controls in LumaWeave
- Lattica is not a control surface for LumaWeave's AgentChatTile / InferenceBackend

---

## Priority summary

1. **Shared design system** (R-LW-001) — must be decided before any tile
   implementation starts; retrofitting is significantly more expensive
2. **Tile architecture reference** (R-LW-002) — commit direction in round 1
3. **fossic integration** (R-LW-005) — prerequisite for the operational tile
4. **Operational tile** (R-LW-003) — built once R-LW-005 lands
5. **Portfolio map + adapter vocabulary** (R-LW-004, R-LW-006) — longer horizon

---

## Open questions for Lattica Claude

1. **Token vocabulary.** Does Lattica commit to the shared token vocabulary in
   round 1? LumaWeave's advocate votes for deciding this in round 1 — retrofitting
   a token system onto an existing layout is significantly more expensive than
   designing from shared tokens from the start.

2. **Tile schema direction.** Does Lattica adopt `TileAnchor` / `TileLayoutEntry`
   from LumaWeave, or define its own? LumaWeave's deferred-tile migration plan
   depends on stable IDs.

3. **fossic crate surface.** When emitting from LumaWeave's Tauri backend,
   is `fossic` (Rust core) or `fossic-tauri` (companion crate) the right
   dependency? The companion crate's additional IPC helpers may not be needed for
   Rust-side append-only emission.

---

*End of lumaweave requirements deposit. Status: open for Lattica Claude review.*
