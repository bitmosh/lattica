---
title: Lattica Now — Live State
status: Phase 0 — Round 1 closed
last_updated: 2026-06-13
---

# Lattica Now

This file holds live state. Everything in `docs/` other than this file is
timeless or aspirational. When in doubt about what is currently true, this
file wins.

## Version

`v0.1.0` — round-1 architectural lock. No source code yet.

## Current phase

**Phase 0 — Platform Bootstrap.** Architecture locked at v0.1.0 via ADR-009
(hybrid composition + selective webview embedding). Round-1 advocate coordination
complete; all six project deposits received and responded. ADR-L-001 through
ADR-L-005 family referenced in ADR-009; full content drafts in v0.1.1.

**Round-1 summary:** Six project advocates (fossic, lumaweave, cerebra,
policy-scout, ai-stack, bo) filed requirements, capabilities, and current_state
deposits. Lattica Claude synthesized cross-project architecture and dispatched
round-1 responses (`docs/requirements/<project>/lattica_round1.md`). Two
outbound relays sent to fossic and lumaweave. Structural code work has not
begun.

## What exists right now

- Planning documents: ADR-001 through ADR-008, EVENT_FABRIC.md, CLAUDE.md,
  SENIOR_DEV_REVIEW.md, AGENT_TRACE_VOCABULARY.md
- Aseptic methodology working copy at `docs/aseptic/` (adopted from fossic;
  living reports are seeded with Lattica-specific bootstrap entries)
- Advocate-coordination scaffolding at `docs/requirements/` (templates +
  per-project subdirectories; one deposit so far: `requirements/fossic/`)

## What does NOT exist yet

- Tauri application code (LumaWeave remains a separate repo at
  `~/Projects/lumaweave/`; ADR-001 structural absorption not started)
- The monorepo workspaces declared in ADR-006 (no pnpm-workspace.yaml,
  no uv workspace, no Cargo workspace)
- `transport:"live"` on the sourceAdapterRegistry entry type in LumaWeave
- `moduleRegistry` and `commandRegistry` in LumaWeave
- `minimumViableSize` / `preferredSize` / `priority` on TileSectionEntry
  (ADR-007 multi-pass layout fields — design-deferred)
- `docs/DESIGN.md`, `docs/PHASES.md`, `docs/agent/` subtree
- Phase 0 deliverables generally

## Naming drift to be reconciled

Several committed documents (ADR-002, DESIGN.md ref, EVENT_FABRIC.md, ADR-006)
refer to the event sourcing library as "ES toolkit" or "lattica-es". The
canonical name is **fossic** across all layers (Rust crate, npm, PyPI, git
commits). A naming reconciliation pass will scrub these references; the
drift is captured in `docs/aseptic/POLISH_DEBT.md` as PD-001.

## Known bugs

None. There is no code.

## Fossic API ground truth (as of 2026-06-13)

For advocates writing requirements against fossic:

- Core `Store` API is stable: `append`, `read_state`, `read_state_at_version`,
  `subscribe`, `walk_causation`, `promote_branch`, `mark_branch_dead_end`,
  `resolve_chain`
- `SubscriptionMode::PostCommit` and `::Synchronous` both shipped
- `SubscriptionHandle::is_degraded()` present
- Three `NotImplemented` gates in v1: encryption (non-Plaintext), manual
  checkpoint, built-in similarity search (requires external provider injection)
- Tauri commands: 11 shipped (reads/subscribe/walk/state — **append is NOT
  a Tauri command**; writes require direct Rust plugin usage)
- fossic-py: maturin build configured; file-path dep, wheel requires build
- fossic-node: napi-rs build configured; napi dep approval pending

## Next moves

1. ADR-L family drafts (ADR-L-001 through ADR-L-005) — full content pass
2. Naming reconciliation pass (PD-001 resolution — ES toolkit / lattica-es → fossic)
3. Round-2 iterations:
   - Cerebra ↔ policy-scout causation ID convention
   - LumaWeave DV-001 confirmation (commandRegistry / moduleRegistry status)
   - ai-stack / bo sidecar architecture (post fossic-py approval)
4. Begin Mode A composition tile scaffolding — start with fossic R-F-001
   (live event stream view as MVP)
