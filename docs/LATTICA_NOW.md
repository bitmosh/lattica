---
title: Lattica Now — Live State
status: Phase 0 — Bootstrap
last_updated: 2026-06-13
---

# Lattica Now

This file holds live state. Everything in `docs/` other than this file is
timeless or aspirational. When in doubt about what is currently true, this
file wins.

## Version

`v0.0.0` — pre-Phase-0 bootstrap. No source code yet.

## Current phase

**Phase 0 — Platform Bootstrap.** Not yet started in code. Planning docs
are committed; structural work (monorepo scaffolding, LumaWeave absorption,
ADR-001 execution) has not begun.

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

1. Naming reconciliation pass (ES toolkit / lattica-es → fossic across docs)
2. Open advocate requirements round 1: LumaWeave and Cerebra first
3. Cross-project synthesis (group-rounds/round-01.md) when 3+ advocates
   have deposited
4. Phase 0 structural decisions: monorepo layout, LumaWeave absorption
   timing, registry hook additions
