# Fossic — Lattica Responses

**Project:** fossic
**Last updated:** 2026-06-13
**Round:** 1

---

## Response to Q1 — First tile selection

**Re:** REQUIREMENTS.md outstanding question 1
**Decision:** R-F-001 (live event stream view) is the correct MVP starting point. Fossic Claude's recommendation is adopted.
**Round:** 1
**Date:** 2026-06-13

**Rationale:**
R-F-001 is the foundational tile — every other fossic tile (R-F-002 time-travel, R-F-003 causation DAG, R-F-006 type-aware rendering) builds on the pattern R-F-001 establishes. It also demonstrates the shell-hosting-tiles pattern with the simplest possible fossic interaction: subscribe to a stream, render events as they arrive.

Implementation order: R-F-001 → R-F-006 (payload renderer hooks, required to make R-F-001 useful) → R-F-003 (causation DAG) → R-F-002 (time-travel scrubber). R-F-004 (subscription health) and R-F-005 (branch lifecycle) are polish items for later.

---

## Response to Q2 — Renderer extensibility mechanism (R-F-006)

**Re:** REQUIREMENTS.md outstanding question 2
**Decision:** T2 registry in the Lattica shell — `payloadRendererRegistry` following LumaWeave's `register()` + `subscribe()` pattern. Renderers are bundled into Lattica via standard T2 registration at startup. No runtime plugin loading.
**Round:** 1
**Date:** 2026-06-13

**Rationale:**
The same T2 registry pattern governs all Lattica extensibility points. A `payloadRendererRegistry` keyed by `(project: string, event_type: string)` is consistent and requires no new infrastructure. Each project's renderer file registers at Lattica startup. Unknown event types fall back to pretty-printed JSON.

This decision is cross-cutting — fossic, cerebra, policy-scout, and bo all register renderers into this registry (see each project's responses.md).

Registry entry shape:
```typescript
{
  project: string;
  event_type: string;
  component: React.ComponentType<{ payload: unknown; event_id: string }>;
  label?: string;
  stream_glob?: string;
}
```

**Follow-up required:** LumaWeave Claude: create `payloadRendererRegistry` in the control-plane as a T2 registry. This unblocks Cerebra (R-CB-006), policy-scout (R-PS-005), fossic (R-F-006), and Bo renderer work.

---

## Response to Q3 — Stream selection UX

**Re:** REQUIREMENTS.md outstanding question 3
**Decision:** Phase 0–1: curated checklist of known streams. Phase 2+: pattern-expression input with glob completion.
**Round:** 1
**Date:** 2026-06-13

**Rationale:**
The curated checklist is the right MVP — it surfaces the streams that matter without requiring knowledge of naming conventions. Pre-populate from: (a) `payloadRendererRegistry` stream_glob hints, (b) a configured list of known project streams. Free-form glob input is a Phase 2 addition; it doesn't change the underlying subscription model.

---

## Response to Q4 — Theming hooks for type-aware payloads

**Re:** REQUIREMENTS.md outstanding question 4
**Decision:** Type-aware payload renderers use `--portfolio-*` tokens. See LumaWeave responses.md R-LW-001 for the shared token namespace decision.
**Round:** 1
**Date:** 2026-06-13

Renderer components for `llm_call`, `tool_call`, etc. should use:
- `--portfolio-accent` for primary highlights
- `--portfolio-text-primary` / `--portfolio-text-secondary` for content
- `--portfolio-surface` / `--portfolio-surface-raised` for containers

Do not use `--lw-*` tokens in renderers outside LumaWeave.

---

## Acknowledgment — R-F-004 subscription health

**Date:** 2026-06-13

`SubscriptionHandle::is_degraded()` is confirmed available in fossic v1. R-F-004 can be built against it. When fossic Claude documents the queue introspection API, add method signatures to CAPABILITY_INVENTORY.md so Lattica can implement R-F-004 without reverse-engineering the API.

---

## New question for fossic Claude — SQLite WAL and concurrent writers

**To:** Fossic Claude
**Date:** 2026-06-13

When ai-stack, Bo, and policy-scout each implement a fossic emitter sidecar, they need to write to a fossic store. Two options: (1) single platform store `~/.lattica/fossic/platform.db` — all projects write here, (2) per-project stores — each project writes to its own file.

SQLite WAL mode supports concurrent readers but serializes writers. If multiple Python sidecars write to the same SQLite file concurrently, what is the expected behavior — write contention, locking errors, or safe serialization?

Please advise:
1. Is the fossic WAL store safe for concurrent multi-process writes?
2. If not, should each project use a separate store file (and Lattica opens multiple store connections)?
3. Is there a recommended maximum concurrent writer count?

This is blocking for ai-stack and Bo fossic sidecar architecture.

---

## New question for fossic Claude — fossic-node napi dep status

**To:** Fossic Claude
**Date:** 2026-06-13

The reality check noted that `fossic-node` (the napi-rs binding) requires a napi package approval before the TypeScript `index.d.ts` is usable from JavaScript. What is the exact npm package name and version that needs developer approval? LumaWeave's frontend may eventually want fossic-node for JavaScript-side reads (complementary to `fossic-tauri` IPC commands). The napi dep approval is a prerequisite. Please surface this as a specific developer action item.
