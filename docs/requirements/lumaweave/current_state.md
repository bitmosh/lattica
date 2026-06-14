# LumaWeave — Current State

**Project:** lumaweave
**Last updated:** 2026-06-13
**Status:** Living document — update this when anything below changes

This document tracks where LumaWeave is right now relative to the Lattica
integration effort. It is the quick-reference for any project needing to know
what LumaWeave has shipped, what is in progress, what is blocked, and what
decisions are pending. Update it after any integration milestone, decision lock,
or capability change.

---

## App version and phase

- **Current version:** v0.19.0 (branch: `feat/gwells-c10a-structural-resolver`)
- **Active development area:** gwells physics engine hardening
  (hub-ring crowding relief, structural resolver, fallback seeding safety)
- **Build state:** Compiling and running. TypeScript strict passes. E2E suite
  healthy (no known test failures as of last run).

---

## Integration with Lattica: current status

### fossic integration
- **Status:** Not started
- **Blocker:** fossic-tauri crate not yet added to `src-tauri/Cargo.toml`
  (requires explicit developer approval per package install safeguard)
- **When ready for:** After the package install approval and Lattica Claude
  confirms the fossic crate surface for Rust-side append (R-LW-005)
- **What will happen:** Rust-side event emission from source adapter load/unload,
  theme changes, graph layout settled. No payload data — metadata only.

### fossic-tauri IPC for Lattica UI reads
- **Status:** Not started
- **Blocker:** Depends on fossic-tauri IPC command surface decision (R-LW-004);
  command names and payload shapes must be stable before `tauri-invoke.ts`
  wrappers are written
- **Mock gap:** `__lwTauriMock` covers `invoke()` calls; `listen()` push events
  have no test shim (R-LW-008 open)

---

## Open decisions (need answer before implementation)

| Decision | Requirement | Owned by | Status |
|---|---|---|---
| fossic crate for Rust-side append: `fossic` core or `fossic-tauri`? | R-LW-005 | Lattica Claude | Open |
| Token namespace: shared `--portfolio-*` or alias from `--lw-*`? | R-LW-001 | Lattica Claude | Open |
| Tile schema direction: adopt `TileAnchor`/`TileLayoutEntry` or define Lattica's own? | R-LW-002 | Lattica Claude | Open |
| gwells scope: stay internal or extract to `packages/gwells/`? | R-LW-006 | Developer | Open |
| Canonical/live diff layer: platform pattern or LumaWeave-internal? | R-LW-007 | Lattica Claude | Open |
| Push event test mock for `listen()` path | R-LW-008 | LumaWeave | Parked (nice-to-have) |

---

## Recent milestones (LumaWeave-side)

| Date | Milestone |
|---|---|
| 2026-06-13 | LumaWeave requirements deposit filed in Lattica round 1 |
| 2026-06-13 | Lattica requirements README shows lumaweave deposited |
| v0.19.0 | gwells structural resolver added (R-LW-specific to physics, not Lattica blocking) |
| v0.17.x | Agent chat tile added (`AgentChatTile`, `InferenceBackend`) |
| v0.15.x | Source adapter registry promoted to T2 (register + subscribe) |

---

## Capabilities ready for integration now

(Full detail in `capabilities.md`)

- Graph rendering (Sigma.js + typed node/edge)
- gwells physics layout engine (all dialects)
- Tile and panel system (design reference, not yet shared code)
- Theme token system (OKLCH, WCAG-audited)
- T2 registry pattern (`sourceAdapterRegistry`, etc.)
- Source adapter SDK (`registerSourceAdapter`, `AdapterConfig`, `LoaderFn`)
- Tauri IPC infrastructure + `__lwTauriMock` shim

---

## Capabilities NOT yet available

- fossic event emission (nothing emitting yet)
- Cross-project causation chains (blocked on fossic integration)
- Push event test mock (`listen()` path)
- Portfolio graph generation (self-graph only)
- gwells as standalone package

---

## What Lattica Claude needs from LumaWeave next

In priority order:
1. **Token namespace decision feedback** — LumaWeave can't assign stable
   inter-project token names until the shared vocabulary is confirmed (R-LW-001)
2. **Tile schema direction** — deferred tile migration candidates need stable
   IDs before moving forward (R-LW-002)
3. **fossic crate surface confirmation** — which Cargo dependency to add for
   Rust-side append (R-LW-005)

---

## What LumaWeave is waiting for from other projects

- **fossic Claude:** Confirm whether fossic Rust core `append` works correctly
  without `fossic-tauri` for Rust-side-only emission; confirm `["rt", "time"]`
  Tokio features are compatible
- **Lattica Claude:** All three decisions in the "open decisions" table above
- **Cerebra Claude:** Causation ID convention for the Cerebra → LumaWeave graph
  load chain (when Cerebra drives a graph load via `sibling-module` adapter)

---

## Contacts / seams

- **Primary codebase:** `~/Projects/lumaweave`
- **Branch:** `feat/gwells-c10a-structural-resolver` (active development)
- **Main branch:** `main`
- **Tile registration point:** `src/control-plane/panels/tileSectionRegistry.ts`
- **Source adapter registration:** `src/control-plane/source-adapter/sourceAdapterRegistry.ts`
- **Tauri IPC shim:** `src/lib/tauri-invoke.ts`
- **Theme tokens:** `src/styles/lumaweave-visual-handles.css`

---

*Keep this file current. When a decision above is locked, move it to `decisions.md`
and remove it from the open-decisions table here.*
