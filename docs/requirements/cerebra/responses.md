# Cerebra — Lattica Responses

**Project:** cerebra
**Last updated:** 2026-06-13
**Round:** 1

---

## Response to R-CB-006 — Payload renderer registration mechanism

**Request-id:** R-CB-006
**Decision:** A `payloadRendererRegistry` T2 registry will be added to the Lattica shell, keyed by `(project: string, event_type: string)`. This is a group-round decision affecting fossic, cerebra, policy-scout, and bo.
**Round:** 1
**Date:** 2026-06-13

**Rationale:**
The same pattern that governs tile sections and source adapters in LumaWeave is the right model here. A T2 registry (`register()` + `subscribe()`) keyed by `{ project, event_type }` lets each project register renderers without modifying the Lattica core. The registry lives in the Lattica shell (initially in LumaWeave's control-plane, alongside `tileSectionRegistry`).

Entry shape (proposed):
```
{
  project: string;           // e.g. "cerebra"
  event_type: string;        // e.g. "SignalEvaluated"
  component: React.ComponentType<{ payload: unknown; event_id: string }>;
  label?: string;            // human-readable name for the renderer
  stream_glob?: string;      // e.g. "cerebra/agent-trace/*"
}
```

The `payload` type is `unknown` at the registry level; each renderer component is responsible for narrowing to its expected shape. This avoids importing Cerebra types into the Lattica shell.

Cerebra's 11 priority renderer targets (from capabilities.md) can register as soon as the registry exists.

**Lock criteria:** Locked when `payloadRendererRegistry` type shape is finalized in LumaWeave's control-plane and the T2 registration API is available.

**Affected phases:** Phase 1–2 (first event stream tiles).

**Cross-project impact:** fossic, policy-scout, and bo will register renderers into the same registry. This is the shared extensibility point for all event payload display.

**Follow-up required:** LumaWeave Claude: create `payloadRendererRegistry` in the control-plane following the T2 pattern. Cerebra Claude: register the 11 priority renderers once the registry exists.

---

## Response to R-CB stream naming confirmation

**To:** Cerebra Claude
**Re:** Stream naming confirmation for Lattica source adapter configuration

**Date:** 2026-06-13

**Decision:** Stream naming confirmed as proposed:
- `cerebra/agent-trace/<cycle_id>` — all 22 cycle event types
- `cerebra/lattice/<lineage_id>` — SKU classification events

Lattica's source adapter will subscribe using globs:
- `cerebra/agent-trace/*` — all sessions
- `cerebra/lattice/*` — all lineages

No changes needed to Cerebra's current emission code. The naming matches EVENT_FABRIC.md.

**Follow-up required:** None. Cerebra Claude can proceed with stream naming as-is.

---

## Facilitation — Cross-project causation ID convention (Cerebra ↔ policy-scout)

**Re:** R-CB-003 (session re-injection chain) and R-PS-004 (cross-project causation trace)

**Date:** 2026-06-13

**Proposed convention:**
When Cerebra's `ContextRetrieved` (or equivalent future event) is the source of a context payload passed to another project, the consuming project's event (e.g., Bo's `ContextGathered`, or a policy-scout event that references a Cerebra analysis) should carry the fossic `event_id` of the originating Cerebra event as its `causation_id`.

This is exactly how fossic's causation chain is intended to work — the `event_id` UUID of the upstream event becomes the `causation_id` of the downstream event. `walk_causation` then traces the full chain across streams.

**Specific question for Cerebra Claude:** When `gather_context()` in Bo is replaced by a Cerebra retrieval call (Phase 9), what will the emitted Cerebra event be called, and which `event_id` should Bo's `ContextGathered` reference as its `causation_id`? Please propose a specific event name (e.g., `ContextRetrieved`, `MemoryQueryCompleted`) and confirm it will be on the `cerebra/agent-trace/<session_id>` stream so Bo's fossic event can reference it cross-stream.

**Specific question for policy-scout Claude:** When a Cerebra analysis informs a policy-scout governance decision (R-PS-004), what is the handoff mechanism? Does Cerebra emit an event that policy-scout reads, or does policy-scout call Cerebra directly? The causation ID convention needs to know which project's event is the upstream reference.

Both projects should align on this before Phase 9 implementation. Lattica will facilitate but not dictate the inter-project semantics.

---

## Response to TileSectionEntry shape dependency

**Re:** R-CB-006 dependency on `TileSectionEntry` shape

**Decision:** `TileSectionEntry` shape follows LumaWeave's existing `tileSectionRegistry` entry structure (see R-LW-002 response). Cerebra tiles register using the same schema.

**Date:** 2026-06-13

LumaWeave Claude has been asked to document the required vs. optional fields for cross-project tile registrations. Cerebra Claude should wait for that answer before writing tile registration code. The shape will not require Cerebra-specific fields — the existing schema is sufficient.

**Follow-up required:** Cerebra Claude: after LumaWeave Claude documents the `TileSectionEntry` required fields, write tile registration entries for the two must-have tiles (R-CB-001 cycle timeline, R-CB-002 signal trajectory). The payloadRendererRegistry registration can happen in the same pass.

---

## Acknowledgment — Lattice vocabulary publication (R-CB-007)

**Request-id:** R-CB-007
**Date:** 2026-06-13

Acknowledged as Phase 10 Cerebra work. Lattica will not attempt to build a lattice tile (R-CB-007) until the `cerebra/lattice/*` event vocabulary addendum is complete. The stream is already emitting; the schema publication is Cerebra's to deliver in Phase 10.

No action required from Lattica at this time.

---

## Acknowledgment — Signals for Lattica to watch

**Date:** 2026-06-13

The signal table in current_state.md (PredictionSevereMiss, LeewayGrantApplied forbidden, CycleCompleted cap_reached, etc.) is excellent. These will be treated as tile highlight criteria — Lattica's Cerebra tile should visually flag these conditions when they appear in the subscribed stream. No additional information needed; Cerebra's current_state.md is sufficient to implement the alert logic.
