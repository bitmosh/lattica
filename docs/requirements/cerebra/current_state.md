# Cerebra — Current State (Living Document)

**Project:** cerebra
**Maintainer:** Cerebra Claude
**Last updated:** 2026-06-13
**Version:** v0.3.7

This file tracks Cerebra's live implementation state for Lattica's reference.
Update it at the start of each significant pass. Lattica Claude should read this
before making assumptions about what Cerebra has or hasn't shipped.

---

## Version and phase summary

| Version | Phase | Status |
|---|---|---|
| v0.3.7 | Phase 9 — CatalystEngine | ✅ Complete (current) |
| v0.3.6 | Phase 9 Step 2 — Bandit Selector primitive | ✅ Complete |
| v0.3.5a | Phase 8 — Full cycle runtime (CycleRuntime) | ✅ Complete |
| v0.3.x | Phase 6–7 — Evaluation pipeline, leeway gate | ✅ Complete |
| v0.2.x | Phase 4–5 — Working memory, retrieval pipeline | ✅ Complete |

---

## What is fully implemented

### Cycle runtime (Phase 8, v0.3.5a)

`CycleRuntime` in `cerebra/cognition/cycle_runtime.py` is the live cycle
execution engine. It executes synchronously, single-threaded, and produces the
full event stream documented in capabilities.md §1.

- **SessionOpened / SessionFlushed** — session bookends
- **CycleStarted / CycleCompleted** — cycle bookends
- **StepStarted / ContextPacketBuilt / StepExecuted / StepExecutionFailed** — step lifecycle
- **PredictionMade** — pre-step quality prediction
- **SignalEvaluated ×6 / EvaluationComposed** — six-signal scoring and composition
- **OutcomeRecorded / PredictionSevereMiss** — prediction vs. actuals
- **ClutchDecisionMade** — step action routing
- **CatalystInvoked / CatalystArmSelected** — bandit arm selection (when configured)
- **LeewayGrantApplied** — pre-write safety gate
- **MemoryWriteFromCycle** — episodic memory write with citation tracking
- All events use `EventEmitter` with automatic causation chaining within a cycle

### CatalystEngine / bandit (Phase 9, v0.3.7)

`CatalystEngine` in `cerebra/cognition/catalyst.py` is the bandit-based
strategy arm selector. Activated when `cycle_config.catalyst_arms` is non-empty.
`BanditSelector` primitive in `cerebra/_primitives/bandit.py` provides the
weighted-random arm selection.

### ClutchEngine (Phase 9 Step 1 / v0.3.6)

`ClutchEngine` in `cerebra/cognition/clutch.py` is the expanded predicate
cascade with: consecutive-below-floor tracking, catalyst escalation flag,
cascade depth reporting, full action set.

### Leeway pre-action gate (Phase 7, v0.3.x)

`LeewayPreActionGate` in `cerebra/governance/pre_action_gate.py`. Evaluates
`ProposedAction` against `DEFAULT_LEEWAY_RULES` and `DEFAULT_CONSTITUTIONAL_RULES`.
Emits `LeewayGrantApplied` via `gate_events.emit_leeway_grant_applied`.

### Episode writer (Phase 8, v0.3.5a)

`EpisodeWriter` in `cerebra/cognition/episode_writer.py`. Real DB writes to
`cycle_episode_records`. Citation extraction (`rec_<12hex>` pattern) and salience
boost for cited records via `WorkingMemory.promote`.

### Retrieval pipeline (Phase 5, v0.2.x)

Three-stage pipeline: `query_plan` → `run_traversal` → `score_candidates`.
Builds a `ContextPacket` for each step with a floor threshold (`_RETRIEVAL_FLOOR
= 0.35`). Abstains if no candidates clear the floor. Emits `ContextPacketBuilt`.

### Working memory (Phase 5, v0.2.x)

`WorkingMemory` in `cerebra/cognition/working_memory.py`. Manages
working memory slots with salience scoring, slot eviction, and pinned
entries. `get_active_session()` for vault-scoped session lookup.

### Fossic integration (Phase 6, v0.3.x)

`FossicStore` at `cerebra/storage/fossic_store.py` wraps `fossic.Store` with
auto-stream-declaration, causation chaining, and snapshot support.

- Store lives at `<vault_path>/.fossic/store.db`
- `EventEmitter` (`cerebra/cognition/event_emitter.py`) handles stream naming and
  causation auto-chaining for `cerebra/agent-trace/<cycle_id>` streams
- `emit_lattice_event()` handles `cerebra/lattice/<lineage_id>` streams
- Lattice snapshot cadence fires at `CycleCompleted` boundaries
- fossic-py (PyO3 v1.0.0-rc.1) is the binding

### SKU classification / lattice (Phase 4, v0.2.x)

`SKUClassifier` in `cerebra/cognition/sku_classifier.py`. Multi-commit lattice
decision logic via `evaluate_lattice()`. Writes to `cerebra/lattice/<lineage_id>`
streams. `cerebra classify` CLI command.

### Primitives (vendored, v0.3.x)

Seven vendored Lattica primitives in `cerebra/_primitives/`:
`Clutch`, `ModeRouter`, `ScoreComposer`, `TombstoneSet`, `Trajectory`,
`Triangulator`, `BanditSelector`. Verbatim per LATTICA_PRIMITIVES.md spec.
Dependency-free (stdlib only).

---

## What is NOT yet implemented

| Item | Notes | Target phase |
|---|---|---|
| `cerebra run-cycle` CLI command | Cycle execution is library-only; no CLI entry point | Phase 10 |
| ~~Re-injection (`ReinjectionTriggered`)~~ | **✅ Shipped — Phase 9 Step 4, b175874** | Done |
| `cerebra/lattice/*` event vocabulary (formal) | Writes are live but the vocabulary addendum doc is incomplete | Phase 10 |
| Re-injection / continuation (`ReinjectionTriggered`) | `ContinuationBundleCreated` logic exists; spawning a child session is not wired | Phase 10 |
| Consolidation (`ConsolidationStarted/Completed`) | Schema and event types defined; the `cerebra consolidate` CLI command is stubbed | Phase 10 |
| Phase 10 consolidation memory write | `SessionFlushed.consolidation_pending: true` is set but the consolidation pass is not implemented | Phase 10 |
| Lattica-facing read adapter | No Tauri command or HTTP endpoint for Lattica to query Cerebra data | Lattica Phase 3–4 |
| Cross-project causation to policy-scout | `causation_id` convention for Cerebra→PS hand-off not defined | Post round-01 |

---

## Fossic store: what Lattica can read today

The fossic store at `<vault_path>/.fossic/store.db` is written on every
`cerebra run-cycle` (library invocation) or any command that triggers cycle
execution. It is **readable by Lattica** via `fossic-tauri` IPC commands
immediately.

**Available streams right now:**
- `cerebra/agent-trace/<cycle_id>` — all cycle runtime events (22 types, fully live)
- `cerebra/lattice/<lineage_id>` — SKU classification events (vocabulary TBD)

**What Lattica can subscribe to:**
- `cerebra/agent-trace/*` glob — picks up all sessions in the vault
- `cerebra/lattice/*` glob — picks up all lineages

**Indexed tags available for cross-stream queries:**
- `session_id`, `cycle_id`, `step_id` on every cycle event
- `action` on `ClutchDecisionMade`
- `outcome` on `CycleCompleted`
- `arm_id` on `CatalystArmSelected`
- `write_reason` on `MemoryWriteFromCycle`

---

## Open decisions blocking Lattica integration

These are items where Cerebra is ready to move but is waiting on round-01
synthesis or a cross-project decision.

| Blocker | Blocking what | Owner |
|---|---|---|
| `payloadRendererRegistry` mechanism spec | R-CB-006 — Cerebra can't ship renderers without registration target | Lattica Claude (R-F-006 / R-LW-005 group-round item) |
| Stream naming convention confirmation | Lattica source adapter pointing to correct glob | Lattica Claude (round-01) |
| Cross-project causation ID convention (Cerebra→PS) | R-CB-003, R-PS-004 — session tree crossing project boundaries | Lattica Claude to facilitate; Cerebra + PS Claude to agree |
| `cerebra/lattice/*` vocabulary publication | R-CB-007 — Lattica can't build lattice tile without schema | Cerebra (Phase 10 addendum) |
| `TileSectionEntry` shape | R-LW-001 — affects how Cerebra tiles register | Lattica Claude (round-01) |

---

## Test coverage

```
tests/
  test_bandit.py           ← BanditSelector (Phase 9 Step 2)
  test_catalyst.py         ← CatalystEngine (Phase 9 Step 3)
  test_clutch.py           ← ClutchEngine (Phase 9 Step 1)
  test_cycle_runtime.py    ← CycleRuntime integration (Phase 8)
  test_evaluation.py       ← six-signal evaluation pipeline
  test_predictions.py      ← PredictionPipeline, OutcomeRecorded
  test_leeway_gate.py      ← LeewayPreActionGate
  test_retrieval.py        ← retrieval pipeline stages
  test_working_memory.py   ← WorkingMemory operations
  test_sku_classifier.py   ← lattice classification logic
```

All passing as of v0.3.7. No skips, no `test.only`.

---

## Signals for Lattica to watch

If Lattica reads Cerebra's fossic store and sees any of the following, it
indicates something worth surfacing:

| Signal | Meaning |
|---|---|
| `PredictionSevereMiss` event | Step quality far outside prediction; may indicate model drift or prompt issue |
| `LeewayGrantApplied.final_decision == "forbidden"` | A write was blocked by governance; user may want to know |
| `CycleCompleted.outcome == "cap_reached"` | Cycle hit step cap without natural stop; may indicate loop |
| `ContinuationBundleCreated.truncation_applied == true` | Bundle hit size limit; context was compressed |
| No `ReinjectionTriggered` after `SessionFlushed` (and session has `recursion_depth > 0`) | Max recursion depth reached; chain terminated — depth-limit block emits no event in v0.1; `ReinjectionBlocked` planned for v0.2 |
| `StepExecutionFailed` | LLM call failed after retry; check model endpoint health |
| `ContextPacketBuilt.abstained == true` | Retrieval returned nothing above floor; step ran without memory context |

---

*This document is a living record. Update version, phase status, and open
decisions at the start of each significant Cerebra development pass.*
