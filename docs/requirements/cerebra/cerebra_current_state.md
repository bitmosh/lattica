---
project: cerebra
last_updated: 2026-06-13
current_version: v0.3.6 (Phase 9 in progress)
status: active_development
next_milestone: v0.1 (after Phase 11)
---

# Cerebra Current State

Cross-project visibility into Cerebra's development. Maintained for fossic and Lattica coordination. Updated at the close of each major arc (phase close), not per-step.

---

## Headline

Cerebra is in **Phase 9 of 11** for v0.1. Cycle runtime is operational (Phase 8). Cognitive loop is mostly assembled: deterministic Clutch cascade + strategic Catalyst escalation + bandit-based arm learning. Re-injection (continuation across context windows) and consolidation are the remaining v0.1 architecture pieces.

---

## Currently in flight

**Phase 9 — Cognitive control loop integration** (`v0.3.6` continuing)
- Step 1 (closed) — Full ClutchEngine with `escalate_to_catalyst` flag, 8 new built-in predicates, ClutchCycleState class
- Step 2 (closed) — Bandit primitive at `cerebra/_primitives/bandit.py` (seventh primitive)
- **Step 3 (just closed) — CatalystEngine consumer**, Migration017, `planning.adaptive.v0` cycle config, 3-factor scoring (base_reward × type_penalty × confidence_ramp)
- Step 4 (next) — Re-injection trigger + child session spawn + Phase 9 close

Phase 9 closes the cognitive loop. After Step 4, Cerebra has end-to-end: deterministic rule cascade → strategic escalation → learning across selections → continuation across context windows.

---

## Recently shipped (last 5 versions)

| Version | Phase | What |
|---|---|---|
| v0.3.6 (in progress) | Phase 9 | ClutchEngine + Bandit primitive + CatalystEngine + planning.adaptive.v0 (Step 4 pending) |
| v0.3.5a | Phase 8 close | Migration016 cycle_episode_records + EpisodeWriter + D1 closure + salience boost |
| v0.3.5 | Phase 8 Step 3 | ContinuationBundle + BundleDistiller + Migration015 + `cerebra run-cycle` CLI |
| v0.3.4 | Phase 8 Step 2 | CycleConfig + ClutchStubEngine + StopConditionEvaluator + CycleRuntime |
| v0.3.3 | Phase 8 Step 1 | RuntimeSession + SessionManager + Migration014 (runtime_sessions) |

Detailed pass-level changelog: see Discord `#changelog` or `docs/agent/deviations/v0.3.*.md` files.

---

## Architecture status

### Working today

- **Cycle runtime** (Phase 8) — Sessions execute multi-step cycles against pluggable cycle configs (`simple.planning.v0`, `planning.adaptive.v0`). Step lifecycle managed via state machine.
- **Working memory** (Phase 5) — SKU-based memory substrate with retrieval, salience scoring, working set management. Context packet assembly into LLM calls.
- **Storage and index layer** (Phase 3) — Polymorphic graph store, 22+ edge types, event-driven `pending_embeddings` queue. mxbai-embed-large-v1 (1024 dims, Matryoshka) on RTX 4070 SUPER.
- **ClutchEngine** (Phase 9 Step 1) — Rule cascade decision-making with cascade_depth tracking, escalate_to_catalyst flag, 12 built-in predicates.
- **Bandit primitive** (Phase 9 Step 2) — UCB-based arm selector with per-arm reward tracking. Seventh primitive in `_primitives/`.
- **CatalystEngine** (Phase 9 Step 3) — Strategic catalyst consumer of Bandit. 3-factor scoring (base × type_penalty × confidence_ramp), weighted-random sampling, per-session persistence.
- **Pre-action constitutional gate** (Phase 7) — `LeewayPreActionGate` with composition-by-union (currently advisory; `forbids()` always returns False in v0.1 per DEV-009).
- **Prediction pipeline** (Phase 6) — Signal evaluation × 6 dimensions, EvaluationComposer, PredictionPipeline.

### Pending (this phase)

- **Re-injection trigger** (Phase 9 Step 4) — BundleDistiller wired into cycle execution flow; ReinjectionTriggered events; child session spawn with `parent_session_id` and `recursion_depth`.

### Pending (next phases)

- **Consolidation** (Phase 10) — Pulls cycle outputs into retrieval-active state. Closes TD-015 (cycle outputs not yet influencing retrieval).
- **Graph export to LumaWeave** (Phase 11) — Bridge from Cerebra's polymorphic graph store to LumaWeave's visualization graph.

### Deferred to v0.2+ (per CEREBRA_CATALYST.md MVP scope)

- Cross-session catalyst learning (vault-wide arm_stats)
- chain_bonus and decay_factor in catalyst scoring (currently 3-factor; v0.2 brings to 5-factor)
- Multiple cycle configs with distinct vocabularies
- self_optimize catalyst action
- Leeway-catalyst integration filter
- Pre-action constitutional rules with non-trivial forbids() (DEV-009)
- HITL `requires_review` infrastructure (DEV-010)

### Deferred to v0.3+

- LoRA training resume (corpus imbalance work)
- Daemon mode (`cerebra serve`)
- Crypto-shredding session deletion (consumes from fossic v1.1)

---

## Items for fossic/Lattica downstream coordination

### Acknowledged + scheduled (no action needed from us)

- AGENT_TRACE_VOCABULARY.md §7.5.1 update: ClutchDecisionMade payload extension (`cascade_depth`, `escalate_to_catalyst`). Lattica Claude batched with other post-rc.1 doc corrections.

### Pending production on Cerebra side

- **AGENT_TRACE_VOCABULARY.md §7 — Catalyst events**: `CatalystInvoked` and `CatalystArmSelected` event payload schemas need to be communicated to fossic. Cross-pollination file (`pass-9.3.md`) is pending Cerebra-side production. Will land before Phase 9 closes.

### Known Cerebra-side test failures (informational)

- 39 failures across `test_memory_cli.py`, `test_abstention.py`, `test_memory_cli_against_vault.py` — pre-existing Click version compatibility (`mix_stderr=False` kwarg removed). Tracked as TD entry in Cerebra. Not blocking; does not affect fossic surfaces.
- 1 failure in `test_lattice_against_vault.py` — separate root cause, under investigation. Does not affect fossic.

---

## Primitives status

| Primitive | Status | Location | Used by |
|---|---|---|---|
| Clutch | Vendored | `cerebra/_primitives/clutch.py` | Cerebra ClutchEngine (consumer at `cognition/clutch.py`) |
| Triangulator | Vendored | `cerebra/_primitives/triangulator.py` | Cerebra (Phase 6 prediction pipeline) |
| Trajectory | Vendored | `cerebra/_primitives/trajectory.py` | Cerebra (pending consumer in Phase 9+) |
| HysteresisModeRouter | Vendored | `cerebra/_primitives/mode_router.py` | Cerebra (pending consumer) |
| ScoreComposer | Vendored | `cerebra/_primitives/score_composer.py` | Cerebra retrieval scorer |
| TombstoneSet | Vendored | `cerebra/_primitives/tombstone_set.py` | Cerebra (pending consumer) |
| **Bandit** | **Vendored (Phase 9 Step 2)** | `cerebra/_primitives/bandit.py` | Cerebra CatalystEngine (consumer at `cognition/catalyst.py`) |

Seven primitives total. Future PyPI extraction (`lattica-primitives`) is on the 9-12 month roadmap.

---

## Recent methodology lessons banked

- **3-layer audit pattern:** research-doc-level / pre-kickoff / during-implementation. Each layer catches what the prior couldn't.
- **Cross-reference scan as discipline:** when modifying structured docs, scan downstream references, file inventories, count references (not just placement).
- **Surface ambiguity rather than auto-fix:** implementing agents flag human-judgment territory rather than silently encoding choices.
- **Parallel streams pattern:** Claude Code for mechanical doc work + bandit for implementation work, when surfaces don't overlap.
- **Cross-pollination format works on first use:** structured artifact shape (severity tag + integration impact + action item) produces unambiguous action paths.

---

## Living reports

| File | Open entries | Last reviewed |
|---|---|---|
| `docs/aseptic/TECH_DEBT.md` | 13 | Phase 8 close (v0.3.5a); 2 candidates pending add this pass |
| `docs/aseptic/POLISH_DEBT.md` | 8 | Phase 8 close; PD-008 added recently |
| `docs/aseptic/FUTURE_DIRECTIONS.md` | 4 | New file (this pass) |
| `docs/agent/deviations/v0.3.6.md` | DEV-025 through DEV-035 | Per-pass |

---

## Maintenance

This file gets updated at:
- **Major arc close (phase complete):** full rewrite of "Currently in flight" + "Recently shipped" sections
- **Architecture changes:** "Architecture status" section
- **Cross-project surface changes:** "Items for fossic/Lattica downstream coordination" section
- **Methodology refinements:** "Recent methodology lessons banked" section

Cross-project coordination items get added IMMEDIATELY when surfaced. Other sections update on phase-close cadence.

Living reports counts get refreshed at every pass-close to stay accurate.
