# Cerebra — Lattica Requirements

**Project:** cerebra
**Author:** Cerebra Claude (acting as cerebra advocate)
**Date:** 2026-06-13
**Status:** Initial requirements deposit

Cerebra is the most fossic-engaged consumer in the portfolio: Phase 8 cycle
runtime is live, emitting 22 structured event types per-cycle across prediction,
evaluation, clutch control, catalyst arm selection, leeway gate, and memory write
paths. Lattica's primary value for Cerebra is surfaces that make this event
stream legible — cycle timelines, signal trajectories, session trees, and
calibration dashboards that no general-purpose trace viewer provides.

---

## Capabilities Cerebra offers Lattica

### Streams and event vocabulary

Cerebra emits to two stream families via `EventEmitter` (in-process, Python,
fossic-py):

**`cerebra/agent-trace/<cycle_id>`** — all cycle runtime events.
22 event types documented in `fossic/docs/implement/AGENT_TRACE_VOCABULARY.md §7`
and OTel-mapped in `§8.2`. A typical step produces 12–18 events:

| Group | Event types |
|---|---|
| Session/cycle lifecycle | `SessionOpened`, `CycleStarted`, `CycleCompleted`, `SessionFlushed` |
| Step execution | `StepStarted`, `ContextPacketBuilt`, `StepExecuted`, `StepExecutionFailed` |
| Prediction + evaluation | `PredictionMade`, `SignalEvaluated` ×6, `EvaluationComposed`, `OutcomeRecorded`, `PredictionSevereMiss` |
| Control decisions | `ClutchDecisionMade`, `CatalystInvoked`, `CatalystArmSelected` |
| Safety gate | `LeewayGrantApplied` |
| Re-injection | `ContinuationBundleCreated`, `ReinjectionTriggered` |
| Memory + session close | `MemoryWriteFromCycle`, `SessionFlushed` |
| Consolidation | `ConsolidationStarted`, `ConsolidationCompleted` |
| Export | `GraphExported` |

Full causation chain: every event within a cycle links back through
`causation_id` to `SessionOpened` at the root. The chain is walkable
forward and backward with `fossic.walk_causation`.

**Indexed tags shipped on every emit:** `session_id`, `cycle_id`, `step_id`,
`action` (on clutch decisions), `outcome` (on cycle completions), `arm_id`
(on catalyst selections). Cross-stream queries by these tags do not require
payload scanning.

**`cerebra/lattice/<lineage_id>`** — SKU classification aggregate events.
Vocabulary is forthcoming (Phase 8 lattice event addendum in progress).
Streams have automatic snapshot cadence (`LATTICE_SNAPSHOT_CADENCE` constant)
at cycle boundaries; Lattica should prefer `read_state_at_version` for lattice
aggregates over linear replay.

### Semantic lenses Cerebra can contribute

- **Cycle quality lens:** composite score per step as a time-ordered series —
  shows how cognitive quality evolves within and across cycles.
- **Signal decomposition lens:** six signal scores (`COHERENCE`,
  `GROUNDEDNESS`, `GENERATIVITY`, `RELEVANCE`, `PRECISION`,
  `EPISTEMIC_HUMILITY`) per step — each is independently meaningful and
  their relative pattern is a diagnostic fingerprint.
- **Prediction calibration lens:** `prediction_error` and `error_classification`
  (`noise` / `notable` / `severe`) across steps — aggregable into a calibration
  dashboard unique to Cerebra.
- **Control flow lens:** `ClutchDecisionMade.action` per step — shows the
  rhythm of accept/refine/critique/explore/stop decisions across a cycle.
- **Catalyst arm lens:** `CatalystArmSelected.arm_name` and `arm_score` —
  shows which bandit arms were invoked and how they performed over a session.
- **Session lineage lens:** `ReinjectionTriggered` parent→child links — shows
  the re-injection tree for multi-continuation sessions.

### Payload renderers Cerebra can contribute

Cerebra will contribute type-aware payload renderers for all 22 event types to
whatever renderer registration mechanism Lattica settles on (see R-CB-006).
This is Cerebra's contribution to the portfolio-wide renderer registry; we do
not need Lattica core to know Cerebra's schema, only to provide a registration
point.

---

## Requirements Cerebra has of Lattica

---

### R-CB-001 — Cycle timeline tile

**Category:** tile-design
**Priority:** must-have

**Specific need:**
A tile that, given a `cycle_id`, renders the cycle as a horizontal timeline
of steps. Each step shows: step index, step type (generate/refine/critique),
composite score (as a bar or number), clutch action taken, and whether
catalyst or leeway gate fired. The timeline should be driven by subscribing
to `cerebra/agent-trace/<cycle_id>` and reacting to events as they arrive
(live) or from replay (post-hoc).

**Why it matters:**
A cycle with 15 steps and three refine loops followed by a stop looks like
noise in raw JSON. As a timeline it's immediately legible: you see the
quality trajectory, where refines clustered, where the leeway gate blocked
a write, and where the catalyst changed strategy. This is the primary
debugging surface for Cerebra users.

**Constraints:**
- Must handle cycles in progress (live event stream) and completed cycles
  (replay from fossic history) with the same tile.
- Step events arrive in a predictable ordering within a cycle (StepStarted →
  ... → ClutchDecisionMade is always causation-ordered). The tile can rely
  on causation ordering for step sequencing.
- A cycle may produce up to ~300 events across 20 steps. The tile should
  aggregate to step level, not render every raw event inline.

**Adjacent project awareness:**
Fossic's R-F-001 (live event stream) and R-F-006 (type-aware rendering) are
prerequisites. The cycle timeline tile is a specialized consumer of the same
subscription infrastructure, not a replacement for it.

**Outstanding questions:**
1. Is the cycle timeline its own tile type, or a mode of the generic event
   stream tile (R-F-001) with Cerebra-contributed layout logic?
2. How does tile selection work when a Lattica panel subscribes to
   `cerebra/agent-trace/*` — does each cycle get its own tile, or is there
   a "most recent cycle" default?

---

### R-CB-002 — Signal trajectory plot

**Category:** tile-design
**Priority:** must-have

**Specific need:**
A tile that renders the six `SignalEvaluated` scores per step as parallel
time series within a selected cycle or session. X axis: step index. Y axis:
0.0–1.0. Six lines, one per signal, in distinct colors. Optional: overlay
the composite score as a seventh line. Should support both within-cycle
(step_index) and cross-cycle (cumulative step count in session) modes.

**Why it matters:**
"When was GROUNDEDNESS low across this session?" and "did GENERATIVITY drop
after the refine loop?" are the questions Cerebra users ask when debugging
cycle quality. The signal scores are all present in the event stream;
without this tile they are buried in 22-event-per-step output. Signal
trajectory is the unique analytic surface for Cerebra that no other project
in the portfolio would produce.

**Constraints:**
- Six `SignalEvaluated` events fire per step, each with `signal_name` and
  `signal_score`. The tile accumulates these by step_index.
- `signal_strength` (confidence in the score) is an optional field — the
  tile should optionally render low-confidence scores with visual
  distinction (e.g., dashed line segment).
- `checklist_details` is NOT exported to OTel and should not be required
  by this tile; `signal_score` and `signal_name` are sufficient.

**Adjacent project awareness:**
Signal trajectory is Cerebra-specific. No other current consumer produces
multi-signal per-step scores. However, the tile design could generalize
to any event stream producing repeated instances of a (dimension_name,
score) pair — bons.ai's arm reward stream follows a similar shape.

**Outstanding questions:**
Is the signal trajectory tile a Cerebra-contributed widget that Lattica
hosts, or must Lattica core implement it? Clarifying the contributed-vs-core
boundary (see R-CB-006) would answer this.

---

### R-CB-003 — Session re-injection chain visualization

**Category:** tile-design
**Priority:** nice-to-have

**Specific need:**
A tile that renders the parent-child session tree formed by re-injection.
`ReinjectionTriggered` events carry `session_id` (parent), `child_session_id`,
`trigger_reason`, and `recursion_cap_hit`. `SessionOpened` carries
`parent_session_id` and `recursion_depth`. Together these define a tree.
The tile should show sessions as nodes (with recursion depth, trigger reason,
and outcome from `SessionFlushed`), and parent→child as directed edges.

**Why it matters:**
Multi-continuation sessions are hard to follow in isolation: each continuation
is a separate stream with a separate `cycle_id`. Without a cross-session view,
users don't know a session is a continuation, or how deep the chain goes.
"What did the parent session achieve before spawning this child?" requires
walking the chain manually today.

**Constraints:**
- Session chain data spans multiple fossic streams
  (`cerebra/agent-trace/<cycle_id>` per session). The tile must aggregate
  across streams — a cross-stream query by correlation (or a reducer over
  the `ReinjectionTriggered` event type across `cerebra/agent-trace/*`)
  is the required mechanism.
- Recursion depth cap is configurable (default 5). The visualization should
  make `recursion_cap_hit: true` visually distinct (e.g., a warning marker).

**Adjacent project awareness:**
None. Re-injection is Cerebra-specific.

**Outstanding questions:**
Does Lattica expose a cross-stream aggregation API at the tile level? The
session tree requires reading events from *n* streams (one per session in
the chain). If the tile API can only subscribe to one stream pattern at a
time, this would require either a fossic reducer over `cerebra/agent-trace/*`
or a Lattica-side aggregation helper.

---

### R-CB-004 — Prediction calibration dashboard

**Category:** tile-design
**Priority:** nice-to-have

**Specific need:**
A tile that aggregates `OutcomeRecorded` events across a selected session
(or vault-wide) and renders: distribution of `error_classification` (noise/
notable/severe), histogram of `prediction_error` values, per-signal calibration
delta (from `ConsolidationCompleted.calibration_audit`), and overall
calibration status. Time-series mode: calibration trend across sessions.

**Why it matters:**
The prediction pipeline (PredictionMade → OutcomeRecorded) is the mechanism
Cerebra uses to track whether its step-quality predictions are improving over
time. Without visualization, the calibration data sits in fossic unobserved.
A dashboard that shows "prediction error is trending down over the last 10
sessions" or "severe misses cluster in PRECISION" gives Cerebra users
actionable information about their cycle config.

**Constraints:**
- `OutcomeRecorded.prediction_error` is a signed float (actual − expected).
  The histogram should distinguish over-prediction (positive) from
  under-prediction (negative).
- `ConsolidationCompleted.calibration_audit` is structured as
  `{per_signal_calibration_delta: {...}, overall_calibration_status: "..."}`.
  This is the canonical post-session calibration summary; the tile should
  use it when available rather than re-deriving from raw signal scores.
- Dashboard is vault-global, not per-cycle; requires querying across many
  `cerebra/agent-trace/*` streams.

**Adjacent project awareness:**
None. Prediction calibration is Cerebra-specific.

**Outstanding questions:**
None at this stage — this is clearly nice-to-have and the design can
proceed after the must-have tiles are settled.

---

### R-CB-005 — Catalyst arm performance view

**Category:** tile-design
**Priority:** future

**Specific need:**
A tile showing CatalystEngine bandit arm statistics for a session: arm names,
visit counts, reward means, and recent reward trend. Driven by
`CatalystArmSelected` and `CatalystInvoked` events. Arm names are in
`arm_name`; scores in `arm_score`; `all_arm_scores` (optional field) provides
the full distribution at selection time.

**Why it matters:**
The CatalystEngine (Phase 9) is a bandit selector over cognitive strategy arms.
Knowing which arms are being preferred and whether reward is converging or
noisy is useful for tuning the arm vocabulary. This view makes the bandit's
internal state observable without requiring Cerebra-side CLI introspection.

**Constraints:**
- Arm statistics are derived from the event stream, not stored separately.
  The tile must aggregate `CatalystArmSelected` events across a session.
- `arm_stats_pre` (optional field) provides pre-selection arm state and
  can be used for a more accurate view than post-hoc reconstruction.

**Adjacent project awareness:**
Bons.ai uses a similar bandit architecture (`bandit_arm_selected`,
`bandit_arm_updated` in §6 of AGENT_TRACE_VOCABULARY.md). The arm
performance tile design could potentially be shared between Cerebra and
bons.ai if the payload shapes are aligned. Worth a cross-project coordination
round when bons.ai un-benches.

**Outstanding questions:**
None at this stage — future priority, deferred until must-haves are settled.

---

### R-CB-006 — Extensible payload renderer registration for cycle events

**Category:** registry-extension
**Priority:** must-have

**Specific need:**
Lattica must provide a mechanism for Cerebra to register type-aware payload
renderers for its 22 event types without modifying Lattica core. Cerebra will
contribute renderers that know how to present `SignalEvaluated` (signal name
as colored label + score bar), `ClutchDecisionMade` (action as styled badge,
rule matched as secondary text), `LeewayGrantApplied` (permitted/forbidden
badge, grants list), `PredictionMade` / `OutcomeRecorded` (paired predicted
vs actual), etc. The registration mechanism must be stable enough that
Cerebra's renderers don't require rebuild on Lattica version bumps.

**Why it matters:**
Raw JSON for a Cerebra step event sequence is unreadable at speed: a typical
step produces 12–18 events. Even with syntax highlighting, users cannot
follow the cycle at a glance. Type-aware renderers transform this into a
structured, at-a-glance view. Without a registration mechanism, Cerebra
either builds renderers into Lattica core (coupling) or users get generic JSON
(unusable for cycle debugging).

**Constraints:**
- The registration mechanism must not require Lattica core to import Cerebra
  code. The renderers should be loadable as Lattica-side TypeScript modules
  that Cerebra contributes.
- Renderer registration should happen at Lattica startup or plugin load, not
  per-tile.
- Cerebra renderers should be able to reference Lattica's theme tokens for
  consistent color/spacing — no hardcoded values.

**Adjacent project awareness:**
Fossic R-F-006 raises the same need from the substrate level. Rhyzome and
bons.ai (when un-benched) will also need renderer registration. This is
a shared infrastructure requirement that affects all consumer projects.
The registration design should be discussed as a group-round item, not
resolved unilaterally for Cerebra.

**Outstanding questions:**
1. Is the renderer registry a Lattica-core concept (module loaded at startup
   from project-specific packages) or a LumaWeave plugin system (inherited
   from LumaWeave's existing registry architecture)?
2. Do renderer modules ship with Lattica's source tree (monorepo), or are
   they loaded from consumer project packages at runtime?

---

### R-CB-007 — Lattice stream integration when vocabulary ships

**Category:** phase-dependency
**Priority:** future

**Specific need:**
When the Phase 8 lattice event vocabulary is published
(`cerebra/lattice/<lineage_id>` streams), Lattica should be able to link
SKU classification events in lattice streams to the cycle events that
triggered them. The linkage is via `cycle_id` — a lattice event carries a
`cycle_id` reference back to the `cerebra/agent-trace/<cycle_id>` stream
that drove the classification.

**Why it matters:**
The full Cerebra picture is two-stream: cognitive cycle events in
`agent-trace`, knowledge graph classification events in `lattice`. Without
lattice stream visibility, Lattica's Cerebra view is the cognitive process
only, not its outcome. "What knowledge was produced by this cycle?" requires
the lattice stream.

**Constraints:**
- The lattice vocabulary is not yet published. This requirement is filed
  as a forward reservation, not an immediate need.
- Snapshot cadence: lattice streams snapshot every `LATTICE_SNAPSHOT_CADENCE`
  events at cycle boundaries. Lattica should prefer `read_state_at_version`
  for aggregate views rather than replaying from event 0.

**Adjacent project awareness:**
None yet — lattice streams are Cerebra-specific. If other projects develop
similar dual-stream patterns (agent-trace + domain-stream), the linking
mechanism should be generalizable.

**Outstanding questions:**
Deferred until Phase 8 lattice vocabulary is published.

---

## Considerations on fossic integration

**Python binding.** Cerebra uses fossic-py (PyO3). The Tauri IPC layer and
fossic-node (napi-rs) are what Lattica uses. These talk to the *same*
SQLite store — Cerebra writes, Lattica reads — with no shared process.
This is the intended architecture; no concern here.

**Stream naming is locked.** `cerebra/agent-trace/<cycle_id>` is the
canonical stream pattern per AGENT_TRACE_VOCABULARY.md §7.1. The lock
exists explicitly to give Lattica a stable subscription pattern. No
Cerebra-side change anticipated.

**Indexed tags reduce scan cost.** Cerebra ships indexed tags on every
event (`session_id`, `cycle_id`, `step_id`, etc.). Lattica tile developers
should prefer tag-based queries over full payload scan when filtering by
session or cycle — this is load-bearing for the low-traffic but
pattern-rich Cerebra stream.

**Lattice snapshot awareness.** `EventEmitter.trigger_lattice_snapshots_at_cycle_boundary()`
fires after `CycleCompleted`. Lattica can expect a snapshot at each cycle
boundary for active lattice streams. Use this to anchor time-travel scrubber
position to cycle boundaries for clean state reads.

**Event count per cycle varies.** A minimal single-step cycle with no
catalyst invocation produces ~14 events. A multi-step cycle with repeated
refines and catalyst invocations can produce 100+. Lattica tile rendering
should aggregate to step level (not event level) for the timeline tile to
remain legible at any cycle size.

---

## Open questions

1. **Tile ownership boundary.** For R-CB-001 (cycle timeline) and R-CB-002
   (signal trajectory): are these Lattica-core tile types or
   Cerebra-contributed extensions? If Lattica core only ships a generic
   event stream tile (R-F-001), Cerebra needs the extension mechanism
   (R-CB-006) to exist before any Cerebra-specific tile can land. What is
   the Phase 0 commitment on extensibility?

2. **Cross-stream aggregation at tile level.** R-CB-003 (session tree) and
   R-CB-004 (calibration dashboard) require querying across *n* streams
   (one per session). Does Lattica's tile API support a reducer over
   `cerebra/agent-trace/*` (all streams matching the pattern) natively, or
   does Cerebra need to contribute a fossic reducer that pre-aggregates?

3. **Live vs. replay tile parity.** R-CB-001 asks for the same tile to work
   on live cycles (streaming) and completed cycles (replay). Is this a Lattica
   core guarantee or does each tile need to implement both modes separately?

4. **Renderer contributed-vs-bundled decision.** R-CB-006's outstanding
   question about whether renderer modules are in the monorepo or loaded from
   consumer packages at runtime. This decision affects how Cerebra ships its
   renderers and what toolchain it needs to maintain them.

5. **Lattice stream visibility timing.** Phase 8 lattice event vocabulary is
   in progress. When it ships, Cerebra will want Lattica to pick it up without
   a Lattica architecture change. What's the process for adding a new stream
   family to Lattica's subscription set after initial integration?

---

*End of Cerebra requirements deposit. Status: open for Lattica Claude review.
Lock decisions in `cerebra/decisions.md` when committed.*
