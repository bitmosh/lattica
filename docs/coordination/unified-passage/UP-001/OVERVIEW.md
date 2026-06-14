---
unified-passage: UP-001
status: draft
created: 2026-06-14
target-execution-date: when all PRE_FLIGHT PASS
participating-projects:
  - lattica
  - cerebra
  - fossic
review-gate: cleared 2026-06-14 — cerebra/lumaweave/policy-scout dependency-clearing closed cleanly; REVIEW phase ready to begin
---

# UP-001 — First Real Tile: Live Cerebra Event in Lattica

## What this passage accomplishes

When this passage closes, the developer can launch Lattica's dev environment, navigate
to the cerebra signal tile, and observe a real `SignalEvaluated` event from a Cerebra
cognitive cycle render via Cerebra's contributed React component. The full pipeline
runs on real data — Cerebra cycles emit to the platform fossic store, Lattica subscribes
via fossic-tauri, the event is routed through `payloadRendererRegistry` to Cerebra's
registered renderer, and the component renders inside Lattica's tile.

User-observable outcome: a Cerebra event you triggered appears in Lattica's UI, rendered
by Cerebra's code, within seconds of the cycle completing.

This is the validation passage for the unified-passage methodology itself — if UP-001
ships cleanly, the methodology is proven and subsequent passages can be more ambitious.

## Why this requires synchronization

Three projects must be in compatible states simultaneously:

- **Cerebra** must be emitting `SignalEvaluated` events to the platform fossic store
  AND must have its React renderer component registered against `payloadRendererRegistry`.
  Either alone is insufficient — events with no renderer fall through to JSON
  pretty-print fallback; renderer with no events produces an empty tile.

- **Fossic** must be serving subscriptions correctly against the platform store under
  the `cerebra/agent-trace/*` stream pattern. Events written by Cerebra must be
  observable by Lattica's subscriber.

- **Lattica** must wire the cerebra tile, subscribe via fossic-tauri, route incoming
  payloads through `payloadRendererRegistry`, and render the returned component.

Sequential per-project work with cross-pollination notifications would technically
deliver the same end state, but the coordination overhead would be high: each project
would need to wait on the others, surface back-and-forth, and discover integration
issues across multiple unconnected passes. The unified passage compresses this into
one synchronized motion with explicit pre-flight readiness.

Partial completion is also worse than no completion. If Cerebra ships the renderer
but events aren't being emitted, the tile renders empty — visible failure, not
progress. UP-001's wholeness is its value.

## Critical invariants (must hold at POST_FLIGHT)

1. **A real Cerebra `SignalEvaluated` event renders in Lattica's UI.** Not a mock,
   not a fixture, not a synthetic event. A cycle the developer manually triggers
   produces an event that arrives in the tile.

2. **The render uses Cerebra's contributed component**, not the fallback JSON
   pretty-print path. Verifiable via DOM inspection — the rendered output contains
   a structural marker only Cerebra's component produces (TBD by Cerebra Claude in
   ACK; e.g., a specific class name, data attribute, or component tree shape).

3. **End-to-end render latency is observable.** The integration smoke test logs the
   time between cycle emission and render appearance. Recorded in POST_FLIGHT.md.
   No threshold required for UP-001 success; observation alone satisfies this
   invariant.

4. **The smoke test is repeatable.** Triggering a second cycle produces a second
   rendered event (or the same tile re-renders with the new event, depending on
   tile design). The pipeline isn't a one-shot.

## Optional invariants (failure → DEVIATION, passage still closes)

1. **Visual polish on the renderer.** Specific styling, hover states, transitions,
   layout refinement. UP-001 ships the substance; polish is post-MVP.

2. **Multiple concurrent events render correctly.** One event is sufficient for
   UP-001 success. Concurrent rendering can be validated and fixed in a follow-up
   pass.

3. **Error states render gracefully.** If a malformed event arrives, the tile
   should show an error state rather than crash — but this can be validated
   separately if surfaced.

4. **Performance under sustained event volume.** UP-001 is a single-event
   integration test, not a load test. Performance characterization is post-MVP.

## Dependency graph

```
fossic (verify-only)
  ↓
Cerebra (ship renderer + emit events)
  ↓
Lattica (wire tile + subscribe + render)
```

`walk_causation` and `subscribe` pipelines through fossic-tauri are pre-existing — fossic's
role is verification, not new code. If verification surfaces a fix, fossic's
contribution becomes load-bearing.

Cerebra has two parallel sub-tasks within its pass: ship the renderer component, and
ensure cycles are emitting to the platform store. These can run in parallel; the
ordering is internal to Cerebra's work.

Lattica's work depends on both Cerebra deliverables. Once Cerebra signals execute-complete,
Lattica can proceed.

## Execution order (topological sort)

1. **fossic** — pre-flight verification only (likely no code commit)
2. **Cerebra** — renderer component + emit verification (one pass, may be one or two
   commits per Cerebra discipline)
3. **Lattica** — cerebra tile wiring + subscription + render (one pass, two commits
   per Lattica two-commit pattern)

If fossic's pre-flight surfaces an issue requiring code change, fossic ships a fix
before Cerebra begins. Add fossic as a "fossic-fix" step before step 2 in that case.

## Per-project pass versions

Each project lands their UP-001 contribution at their own pass version per existing
Aseptic discipline:

- **lattica:** `v0.3.0` (forward — user-observable feature: cerebra events render in
  the UI)
- **cerebra:** version per Cerebra's existing trajectory (likely forward — shipping
  a new renderer component is user-noticeable for Lattica consumers; Cerebra Claude
  determines specific version)
- **fossic:** no version expected if pre-flight passes; if a fix is needed, a
  descending-letter cleanup or small forward bump per fossic's discipline

The unified passage ID (UP-001) is referenced from each project's blast-radius file.

## Estimated coordination overhead

| Phase | Estimate |
|---|---|
| DRAFT (Lattica Claude) | Done — this document + ASSIGNMENTS + ROLLBACK |
| REVIEW (all projects ACK or pushback) | 1-2 coordination cycles, depends on cerebra/lumaweave/policy-scout dependency-clearing closing first |
| ARM (each project pre-flights) | 1 day if no surprises; longer if pre-flight surfaces gaps |
| EXECUTE (dependency-ordered passes) | 1-2 days total across three projects |
| POST_FLIGHT (Lattica Claude + smoke test) | Same day as Lattica execute completes |

Total: roughly 1 week elapsed, several hours of active work per project.

This is expensive compared to per-project passes — the methodology overhead is real.
UP-001 earns it by being the methodology validation. UP-002+ should be evaluated
against the cost ratio in `UNIFIED_PASSAGE.md` ("10x overhead, must deliver 10x
value or be the only viable path").

## Sequencing note — dependency-clearing closed 2026-06-14

UP-001 DRAFT was filed concurrent with cerebra/lumaweave/policy-scout
dependency-clearing. That work closed cleanly on 2026-06-14 with substantive
artifacts produced:

- Stream-key correction propagated (cycle_id → session_id) across affected docs
- PayloadRendererProps locked at `{ payload: unknown, event_id: string }`
- Event type naming locked at flat PascalCase
- Policy Scout Phase 2 emit live (1143 tests passing); causation_id wires to
  ActionProposed when present
- POLICY_SCOUT_EVENT_VOCABULARY.md filed at fossic as a sibling to
  AGENT_TRACE_VOCABULARY.md

These outcomes are baked into UP-001 ASSIGNMENTS.md. REVIEW phase is clear to
begin. The developer signals REVIEW open; Lattica Claude triggers by notifying
Cerebra Claude and Fossic Claude that the assignment is ready for their ACK.

## What POST_FLIGHT verifies

After all three execute phases complete:

1. **Smoke test:** developer triggers a Cerebra cycle manually. Within ~5 seconds,
   the cerebra signal tile in Lattica's UI shows a rendered `SignalEvaluated` event
   (or events, if the cycle emits multiple — first one is sufficient).

2. **Render-path verification:** DOM inspection of the rendered tile content shows
   the structural marker Cerebra's component produces. Confirms the renderer is
   Cerebra's code, not the fallback.

3. **Repeat test:** developer triggers a second cycle. Second event renders.

4. **Cross-project integration log:** end-to-end latency from emit to render
   logged (informational; no threshold).

If all four hold, POST_FLIGHT.md records `status: complete`. Passage closes.

If 1 or 2 fail: ROLLBACK kicks in even though individual commits succeeded. The
platform-wide state is wrong.

If 3 fails: passage closes with DEVIATION DV-NNN logged for the repeatability gap.

If 4 fails: same — DEVIATION, passage closes.

---

*This is UP-001 OVERVIEW.md. See ASSIGNMENTS.md for per-project scope, ROLLBACK.md
for failure-mode handling.*
