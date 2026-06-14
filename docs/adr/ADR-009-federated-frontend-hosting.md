# ADR-009: Federated Frontend Hosting — Hybrid Composition + Selective Webview Embedding

**Status:** Accepted
**Date:** 2026-06-13
**Version:** v0.1.0 (the pass at which this decision is committed)
**Replaces:** Earlier draft of ADR-009 (single-bundle only) — refined per developer input during round-1 close
**Supersedes:** ADR-001 in spirit — earlier ADRs were starting material; ADR-009 is the first locked architectural decision

---

## Decision

Lattica adopts a **hybrid frontend composition model** with two integration modes used per-workspace and per-tile:

**Mode A — Single-bundle composition tiles.** Lattica's main React bundle hosts cross-project synthesis tiles (event timeline, causation DAG, reflective twin, signal correlation, unified workspace views) and renderer components contributed by projects without rich standalone frontends. LumaWeave's existing `tileSectionRegistry` (T2 registry pattern) is the platform tile registry composing this bundle.

**Mode B — Selective Tauri webview embedding.** Projects that have or will have rich standalone Tauri frontends (LumaWeave today, Cerebra post-Phase 11) are accessible via Tauri 2 child webviews when the user switches to a workspace that wants the full standalone experience. The embedded webview points at the project's own dev server or built bundle; the project's frontend runs unchanged from its standalone behavior.

Both modes coexist. Workspace composition determines which is used for any given user view. A workspace can be entirely Mode A (cross-project tiles only), entirely Mode B (one project's full standalone UI hosted in Lattica's window), or mixed (split layout with Mode B on one side and Mode A tiles on the other).

## Constraints (enforceable)

- **Lattica's main bundle is the host for Mode A composition tiles.** Tiles in Mode A are React components in the same React tree as Lattica's shell.
- **Mode A components reach the bundle at build time.** Project contributions to Mode A live in source code Lattica's bundler includes at build time (workspace package, npm publish, or path import). No runtime loading of arbitrary Mode A bundles.
- **Mode B webviews host the project's unchanged frontend code.** A Mode B project's lattica-mode rendering is the same code as its standalone frontend, hosted in a Tauri child webview pointed at the same dev server or build artifact. No project-side conditional behavior keyed on "am I in Lattica."
- **`tileSectionRegistry` is the platform tile registry.** No parallel registry exists. Mode A tiles register here. Mode B webviews are also registered as tiles (with `kind: "webview"` rather than `kind: "component"` — see ADR-016).
- **`payloadRendererRegistry` is the shared payload-renderer extensibility point.** Located in LumaWeave's control-plane as a T2 registry. Mode A renderer contributions go through this registry.
- **Theme propagation works across webview boundaries via CSS custom properties.** `--portfolio-*` tokens (ADR-015) are inherited from the host shell's stylesheet into Mode B webviews via standard cascade. Mode B projects read these tokens to render in Lattica's visual identity when embedded.
- **React context does NOT cross webview boundaries.** Mode B webviews are separate React trees with separate runtimes. Cross-webview communication uses `window.postMessage` or Tauri events, never shared context.
- **Each project's backend is unchanged.** Standalone-launched and lattica-launched share the same backend process, same dependencies, same lifecycle. No conditional behavior keyed on launch context.
- **Lattica's shell does not embed project backends.** Lattica connects to each project's running backend through that project's existing interface (Tauri IPC for projects with Tauri backends, subprocess CLI calls where applicable, fossic event subscriptions for event-only consumers).

## Boundaries (parallel-execution-safe)

Files this decision permits modification of:
- `~/Projects/lattica/src/` — Lattica's own frontend shell, when it exists
- `~/Projects/lattica/src-tauri/` — Lattica's own Tauri backend, when it exists, including child-webview spawning code
- `~/Projects/lattica/docs/` — all documentation
- Project-side: each project's `<repo>/src/` for Mode A component contributions (scoped to the project's own directory), and the project's existing frontend code for Mode B embedding

Files this decision PROHIBITS modification of (without revisiting this ADR):
- LumaWeave's `tileSectionRegistry` contract shape — ADR-016 governs this
- Any cross-project file outside the project's own repo

Other ADRs this decision depends on:
- ADR-015 (Platform Design Token Namespace) — `--portfolio-*` tokens propagate across both modes
- ADR-016 (Tile Registration Contract) — `TileSectionEntry` with `kind: "component" | "webview"` discriminator
- ADR-017 (Payload Renderer Registry) — Mode A renderer registration
- ADR-012 (Platform Fossic Store Topology) — single platform store at `~/.lattica/fossic/store.db`
- ADR-018 (Canonical vs. Live Graph Layer Ownership — planned, not yet filed) — Reflective Twin diff layer

## Invariants (testable)

- A project's standalone-launched test suite passes unchanged after Mode A contributions or Mode B embedding is added. Verified by each project's existing test runs.
- Lattica's bundle build produces a single JS bundle for the shell + Mode A contributions. No runtime fetch of Mode A code. Verified at build by examining build artifacts.
- Every registered tile section's `id` is unique across the registry, including across Mode A and Mode B tiles. Verified by `tileSectionRegistry` validation.
- Mode B webviews can read `--portfolio-*` CSS custom properties from the host shell's stylesheet at load time. Verified by a Playwright test (added when first Mode B project is integrated).

## Failure-mode preference

- A Mode A component that throws shows an error boundary state ("Renderer not registered for event type X" / "Cerebra offline — tile cannot render"). The Lattica shell remains functional; other tiles unaffected.
- A Mode B project whose dev server or build artifact is unreachable shows a clear "project unreachable" state in its webview slot. The Lattica shell remains functional.
- A project backend offline state is reflected in tile-level offline indicators with last-seen timestamps. Write actions (e.g., policy-scout HITL approve/deny) are explicitly disabled — no greyed-out buttons that silently do nothing.

---

## Context

**What round 1 revealed.** All six advocate Claudes implicitly assumed a single-bundle compile-time React composition model. None proposed Tauri multi-webview, micro-frontends, runtime loading, or iframes. Pure single-bundle was the path of least resistance.

**Where pure single-bundle falls short.** The developer's stated invariant is "each project stays standalone." Pure single-bundle makes this partially fictional — LumaWeave's lattica-mode components living inside Lattica's bundle means LumaWeave is no longer truly standalone in lattica-mode. Active LumaWeave development (currently on `feat/gwells-c10a-structural-resolver`) would couple to Lattica's CI.

**Where pure multi-webview falls short.** Lattica's value proposition is cross-project synthesis: the killer features (causation chains spanning Cerebra→Bo→ai-stack, reflective twin showing canonical+live graph diff, unified event timeline) require components that reach into multiple projects' event streams and render them together. In multi-webview, these cross-project tiles don't naturally belong to any one project's webview — they'd live in Lattica's own webview and re-implement the renderer registry via `postMessage` choreography. Painful.

**Why hybrid resolves the tension.** Composition value lives where composition is easy (single bundle). Standalone value lives where standalone is real (separate webview). Lightweight projects (Cerebra until Phase 11, Bo, ai-stack, policy-scout) contribute Mode A components since they don't have standalone frontends to embed. LumaWeave (today) and Cerebra (post-Phase 11) get Mode B embedding for their rich standalone experiences. Workspaces compose freely across both modes.

**Cerebra's Phase 11 trajectory.** Developer confirmed Cerebra will acquire a Tauri frontend post-Phase 11. This means Cerebra moves from Mode A only (renderer contributions for tiles) to optionally Mode B (full standalone UI embedded). The hybrid model accommodates this evolution without architectural change — when Cerebra's frontend ships, it just becomes embeddable.

---

## Consequences

### Positive

- **Each project's "standalone" invariant is preserved** for Mode B projects. LumaWeave runs as LumaWeave; Lattica points a webview at it.
- **Cross-project synthesis is easy** — Mode A tiles share React context, type safety, and one renderer registry. The platform's value-add lives where it's cheapest to deliver.
- **Independent project release cadence for Mode B projects** — LumaWeave updates without Lattica rebuilding. Mode A contributions still couple to Lattica's build, but only the project's lattica-mode code does, not the project's standalone frontend.
- **Workspaces (the btop-style composable UI the developer envisions) compose freely** across both modes. A "LumaWeave focus" workspace is Mode B at full window; a "cross-project debug" workspace is Mode A tiles; a "LumaWeave + Cerebra signals" workspace is split.
- **Crash isolation is real for Mode B projects.** A bug in LumaWeave's webview can't crash Lattica's shell. Mode A still relies on React error boundaries for isolation — adequate but not as strong.

### Negative / Risks

- **Two implementation paths to maintain.** Mode A tile registration is different from Mode B tile registration. ADR-016 must address both cleanly without introducing accidental complexity.
- **CSS theme propagation needs explicit design.** `--portfolio-*` tokens must be available in Mode B webviews. The mechanism (inject the host stylesheet, use a shared stylesheet served from a known path, etc.) needs to be decided in ADR-015.
- **Cross-Mode communication is asymmetric.** Mode A tiles can communicate via shared React state. Mode B webviews communicate with the shell via Tauri events / `postMessage`. Mixing the two in one workspace requires bridging.
- **Bundle size still grows with Mode A contributions.** Mode B doesn't help here — only projects with no standalone frontend get the bundle-bloat-mitigating Mode B path. At today's scale this is fine; revisit if Mode A contributions accumulate beyond reasonable bundle size.

### Mitigations baked into the decision

- `tileSectionRegistry` with the `kind` discriminator (ADR-016) means Mode A and Mode B tiles register through the same surface. The developer doesn't have to think about which mode when registering a tile — the registration's `kind` field captures it.
- Theme propagation has a clear mechanism path: CSS custom properties inherited via `:root` in the embedded webview, populated from the host's stylesheet at webview creation time. ADR-015 specifies the exact mechanism.
- Mode B is opt-in per project. No project is forced to expose a webview-embeddable mode. Projects that prefer to contribute only via Mode A stay that way.

---

## Notes on relationship to earlier ADRs

ADR-001 ("Lattica IS LumaWeave extended") is acknowledged as starting material. The codebase-absorption framing is not what's happening; ADR-009 is what's happening. ADR-001 is left in place as historical record.

ADR-002 (event fabric via fossic), ADR-003 (eval-core standalone), ADR-006 (monorepo structure), and ADR-007 (LumaShell pattern absorption) remain useful starting material. A separate pass marks them as "starting material — superseded in part by ADR-009 family" rather than "Accepted."

ADR-004 (Policy Scout governance scope), ADR-005 (Cerebra API surface), and ADR-008 (Phase 12 research exploration) are project-scoped or research-scoped and don't conflict with ADR-009.

---

## What ADR-009 does NOT decide

- **fossic store topology** — decided in ADR-012 (single platform store).
- **Specific Tauri 2 child-webview API mechanics** — implementation detail, captured in the LumaWeave + Cerebra Mode B integration ADRs when those work begins.
- **gwells extraction scope** — R-LW-006 is the developer's call.
- **Cerebra's library-only `run-cycle` state** — Lattica is observer for Phase 1.
- **Bo's lack of process supervisor** — operational concern.

---

*This ADR is the first locked architectural decision in the Lattica platform. Earlier ADRs were starting material; this one carries the platform's identity going forward.*
