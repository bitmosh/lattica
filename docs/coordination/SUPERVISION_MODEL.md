---
title: Supervision Model — Lattica / Fossic Peer Supervisor Split
status: live
version: v0.0.0y
last_reviewed: v0.0.0y
---

# Supervision Model

The Lattica platform spans more substrate than one Claude instance can supervise
attentively. From 2026-06-13 forward, the platform runs a peer-supervisor model
between Lattica Claude and Fossic Claude. This document captures the split.

---

## The split

### Lattica Claude owns

- Shell architecture (Tauri app structure, IPC topology, frontend hosting model)
- Composition tiles (cross-project React components that synthesize multiple
  projects' events into unified views)
- Tile registry, payload renderer registry, theme tokens (`--portfolio-*`)
- Advocate coordination across project Claudes (round structure, briefing
  synthesis, decision locking)
- Per-project `lattica_round_N.md` response drafts
- Cross-project ADRs (ADR-L-NNN family)
- Workspace composition (which tiles appear in which workspaces)

### Fossic Claude owns

- fossic-tauri / fossic-node integration into Lattica's Tauri shell
- Cross-consumer event vocabulary work (`AGENT_TRACE_VOCABULARY.md` evolution)
- fossic-side polish that affects Lattica consumers (subscription introspection
  surface expansion, multi-store support if ever needed, performance
  benchmarks)
- fossic-internal ADRs (ADR-F-NNN family)
- Substrate-side answers when Lattica needs to know about WAL behavior, append
  latency, schema migration, etc.

### Shared (cross-gated)

- Event vocabulary changes that affect both substrate semantics and tile
  rendering (e.g., adding a new standard event type)
- Causation ID conventions across projects
- Store topology decisions (single vs. multi; cross-store walk_causation
  semantics)

---

## Cross-gate protocol

At every arc close (group of related passes), each supervisor reviews the
other's work before the next arc begins:

1. Lattica Claude reviews Fossic Claude's recent passes for: impact on tile
   contracts, breaking changes affecting consumer projects' lattica-mode code,
   anything Lattica's existing decisions depend on.

2. Fossic Claude reviews Lattica Claude's recent passes for: assumptions about
   fossic API surface that may not hold, store topology implications, event
   vocabulary additions that need substrate support.

3. Findings are surfaced via `[Source → Target]` relay artifacts in
   `outbound/` for the other party's review.

4. If a finding requires action before the next arc begins, the action is
   tracked as a separate task with explicit owner.

This is not a code review pass — it's a substrate-coherence pass. Each
supervisor trusts the other on their own slice; the cross-gate catches issues
where the slices meet.

---

## When the split breaks down

Either supervisor can call for a joint pass when the work crosses substrate
boundaries deeply enough that single-supervisor coverage isn't viable. Examples:

- A new ADR that locks behavior on both sides (e.g., ADR-L-004 store topology
  needed both Lattica's preference and Fossic's safety confirmation)
- A platform-wide refactor that touches both fossic schema and tile rendering
  (e.g., a new event vocabulary that requires fossic side changes AND tile-side
  renderer registration)
- An incident affecting both layers (e.g., a subscription corruption bug that
  manifests as both fossic state drift and tile rendering failure)

A joint pass produces one `blast-radius/` file with both supervisors as
co-authors and explicit ownership of each section.

---

## When to add more supervisors

If a third substrate emerges that doesn't fit cleanly into Lattica or fossic
ownership (example: a hypothetical GPU-allocation supervisor for ai-stack-heavy
work, or a hypothetical UX-research supervisor for workspace composition
decisions), the right move is to add a third supervisor with its own slice and
its own cross-gate protocol with the existing two.

Don't try to expand Lattica Claude's or Fossic Claude's scope to absorb the new
substrate — the whole point of the split is bounded supervisor attention.

---

## Current arc close cadence

Arcs close roughly at every load-bearing version (`v0.1.0`, `v0.2.0`, etc.).
Descending-letter cleanup passes don't trigger arc closes by themselves.

The next scheduled arc close is `v0.1.0` (round-1 close). Both supervisors
will cross-gate before `v0.2.0` work begins.

---

*The supervision model evolves as the platform grows. Update this file when the
split changes.*
