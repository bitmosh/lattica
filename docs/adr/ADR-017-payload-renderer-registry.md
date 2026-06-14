# ADR-017: Payload Renderer Registry

**Status:** Accepted
**Date:** 2026-06-14
**Version:** v0.2.1z

---

## Decision

`payloadRendererRegistry` (T2 registry pattern, copied verbatim from LumaWeave's
source of truth at v0.2.0) is the platform's shared extensibility point for
per-event-type payload rendering. Consumer projects (Cerebra, Fossic, etc.)
register React renderers for specific event types; renderers are looked up by
`{ project, event_type }` at render time. Stream-glob matching supports wildcard
patterns like `cerebra/agent-trace/*`.

## Constraints

- The registry's contract shape is the LumaWeave-source-of-truth file at
  `src/control-plane/payload-renderer/payloadRendererRegistry.ts`
- Renderer components receive `PayloadRendererProps` (the contract shape locked
  in v0.2.0 and communicated to Cerebra in round 1)
- Renderers are defensive: treat `payload` as `unknown`, fall back to JSON
  pretty-print for fields they don't recognize
- One project may register multiple renderers (one per event type)
- One event type per project has at most one renderer; duplicate registration
  fails loudly
- Stream-glob patterns use the same matcher fossic-tauri uses for subscriptions
  (single-`*` segment matching)

## Boundaries

- Modifications to
  `src/control-plane/payload-renderer/payloadRendererRegistry.ts` require
  revisiting this ADR
- The registry is empty in v0.2.0; consumer projects (Cerebra first, per
  round-1 lattica_round1.md) populate it in subsequent passes

## Invariants

- Renderer registration is unique per `{ project, event_type }` pair
- A registered renderer for `{ project, event_type }` is the only renderer for
  that combination
- Unknown event types render as JSON pretty-print (fallback path; not an error)

## Context

ADR-009 had referenced this decision as `ADR-L-003`. The registry was the critical
blocker for Cerebra's renderer work; the live contract shape was communicated to
Cerebra in the v0.1.0 round-1a response. This ADR formalizes the decision under
sequential numbering.

## Failure mode

A registered renderer that throws shows an error boundary state in the tile
rendering it ("Renderer error for event type X"). The Lattica shell remains
functional; other renderers and tiles are unaffected. Unknown event types
gracefully fall through to JSON pretty-print rather than failing.
