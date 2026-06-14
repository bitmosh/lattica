# Cerebra — Capabilities for Lattica

**Project:** cerebra
**Author:** Cerebra Claude
**Date:** 2026-06-13
**Purpose:** Catalog of Cerebra capabilities relevant for display or utilization in Lattica.

This is a reference document, not a requirements list. It answers "what can
Cerebra give Lattica to work with?" Each section is a distinct capability
surface. Cross-reference with `requirements.md` for what Cerebra *needs* from
Lattica to surface these well.

---

## 1. Fossic event streams

Cerebra writes to two fossic stream families. Both are readable via the shared
fossic store at `<vault_path>/.fossic/store.db`.

### 1.1 `cerebra/agent-trace/<cycle_id>`

The primary observability stream. One stream per cycle run. Contains the full
record of a cognitive cycle from open to close.

**22 event types** across 9 groups:

| Group | Event types | Count |
|---|---|---|
| Session / cycle lifecycle | `SessionOpened`, `CycleStarted`, `CycleCompleted`, `SessionFlushed` | 4 |
| Step execution | `StepStarted`, `ContextPacketBuilt`, `StepExecuted`, `StepExecutionFailed` | 4 |
| Prediction | `PredictionMade` | 1 |
| Signal evaluation | `SignalEvaluated` ×6, `EvaluationComposed` | 7 |
| Outcome recording | `OutcomeRecorded`, `PredictionSevereMiss` | 2 |
| Control decisions | `ClutchDecisionMade`, `CatalystInvoked`, `CatalystArmSelected` | 3 |
| Safety gate | `LeewayGrantApplied` | 1 |
| Re-injection | `ContinuationBundleCreated`, `ReinjectionTriggered` | 2 |
| Memory + close | `MemoryWriteFromCycle` | 1 |
| Consolidation | `ConsolidationStarted`, `ConsolidationCompleted` | 2 |
| Graph export | `GraphExported` | 1 |

Full schemas: `fossic/docs/implement/AGENT_TRACE_VOCABULARY.md §7`.
OTel span mapping: same doc `§8.2`.

**Causation chain:** Every event in a cycle links via `causation_id` back
through the chain to `SessionOpened` at the root. Lattica can walk any event
forward or backward to the session root using `fossic.walk_causation`.

**Indexed tags on every event:** `session_id`, `cycle_id`, `step_id` — plus
event-specific tags (`action`, `outcome`, `arm_id`, `write_reason`). Tag
queries are O(1) without payload scan.

**Typical event volume per cycle:**
- Minimal (1 step, no catalyst): ~14 events
- Typical (3–5 steps): 50–80 events
- Heavy (many refine loops + catalyst): 100–200 events

### 1.2 `cerebra/lattice/<lineage_id>`

Classification aggregate stream. One stream per SKU lineage (knowledge graph
node family). Written during `cerebra classify` runs when a knowledge record
is assigned to a category lineage.

**Status:** Active writes; vocabulary addendum documenting event types is
in progress (Phase 8 lattice addendum). Snapshot cadence fires at cycle
boundaries via `EventEmitter.trigger_lattice_snapshots_at_cycle_boundary()`.

Lattica should prefer `read_state_at_version` for lattice aggregate views
rather than linear replay from event 0.

---

## 2. Six cognitive signals

Every step in a cycle is scored across six epistemic dimensions. These are
Cerebra's primary quality metric and the richest time-series Cerebra produces.

| Signal | What it measures |
|---|---|
| `COHERENCE` | Internal logical consistency of the step output |
| `GROUNDEDNESS` | Anchor to retrieved memory and cited sources |
| `GENERATIVITY` | Novel insight beyond prior step outputs |
| `RELEVANCE` | Alignment with the session goal |
| `PRECISION` | Specificity and absence of vague language |
| `EPISTEMIC_HUMILITY` | Appropriate acknowledgment of uncertainty |

Each signal fires as a `SignalEvaluated` event with:
- `signal_name`, `signal_score` (0.0–1.0)
- `signal_strength` (confidence in the score; optional)
- `low_confidence` boolean flag
- `evaluator_prompt_version` (which prompt template scored this)

Six of these fire per step; they compose into `EvaluationComposed` with a
weighted `composite_score`. Weights are per-cycle-config and stored in
`EvaluationComposed.weights_used`.

**Visualization potential:** Per-step signal score matrix, per-signal
trajectory line plot across a session, low-confidence step markers.

---

## 3. Prediction and calibration data

Before each step executes, Cerebra records a prediction (`PredictionMade`):
- `expected_composite_score` (0.0–1.0)
- `expected_per_signal` (predicted per-signal scores)
- `prediction_basis` — how the prediction was made:
  - `prior_step_trajectory` — extrapolated from recent composites
  - `cycle_config_default` — from config baseline
  - `static_baseline` — fixed fallback

After evaluation, `OutcomeRecorded` computes:
- `prediction_error` = actual − expected (signed float)
- `error_classification`: `noise` (|err| < 0.10), `notable` (0.10–0.40), `severe` (> 0.40)
- `per_signal_error` — error per signal

Severe misses also fire a `PredictionSevereMiss` event for targeted subscriber
attention.

Post-session, `ConsolidationCompleted` carries `calibration_audit`:
```json
{
  "per_signal_calibration_delta": {"COHERENCE": 0.02, ...},
  "overall_calibration_status": "improving" | "stable" | "degrading"
}
```

**Visualization potential:** Prediction error histogram, severity
distribution (noise/notable/severe), calibration trend across sessions,
per-signal calibration delta heatmap.

---

## 4. Clutch decision stream

The ClutchEngine is a deterministic predicate cascade that fires after every
step evaluation to decide what to do next. Each decision is recorded in
`ClutchDecisionMade`:

| Action | Meaning |
|---|---|
| `accept` | Step output is good enough; advance to next step |
| `refine` | Re-run the same step with refinement prompt |
| `critique` | Re-run with critique prompt |
| `explore` | Re-run with exploration prompt |
| `branch` | Fork the cycle into a new branch |
| `retrieve_more` | Trigger additional memory retrieval |
| `consolidate` | Consolidate prior outputs before continuing |
| `ask_user` | Pause for human input |
| `pause` | Explicit pause |
| `stop` | Terminate the cycle |

Each `ClutchDecisionMade` carries:
- `action` — the decision taken
- `rule_matched` — the specific Clutch rule that fired
- `cascade_depth` — how many rules evaluated before one matched
- `escalate_to_catalyst` — whether the Catalyst was invoked for strategy selection

**Visualization potential:** Action distribution per cycle (pie/bar), action
sequence timeline (shows rhythm of accept/refine/stop), cascade depth histogram
(shows how "hard" each decision was), rule-matched frequency table.

---

## 5. CatalystEngine / bandit arm selection

When the Clutch escalates (`escalate_to_catalyst: true`), the CatalystEngine
(Phase 9) runs a bandit-based strategy arm selection.

`CatalystInvoked` records:
- `vocabulary_size` — how many arms were available
- `leeway_filtered_vocabulary_size` — after leeway pre-filtering

`CatalystArmSelected` records:
- `arm_name` — the selected strategy arm
- `arm_score` — the multi-factor score at selection
- `selection_method` — `weighted_random` (v0.1)
- `arm_stats_pre` — arm's historical stats before this selection (optional)
- `all_arm_scores` — full distribution across all arms at selection time (optional)

**Visualization potential:** Arm visit count bar chart, arm reward mean over
time (per-arm line), exploration vs. exploitation selection mode ratio,
arm-score distribution scatter at selection points.

---

## 6. Leeway gate decisions

Before any state-mutating action (primarily `MemoryWriteFromCycle`),
`LeewayGrantApplied` records:
- `proposed_action` — what was proposed
- `grants_applied` — which leeway rules permitted it
- `final_decision` — `permitted` / `requires_review` / `forbidden`
- `forbidden_by` — rule that blocked it (when forbidden)
- `review_required_by` — rules requiring HITL review (when requires_review)

**Visualization potential:** Gate decision badge (green/amber/red) on
each step, forbidden decision alert, HITL review queue count, rule
name frequency table.

---

## 7. Session re-injection / continuation chain

When a cycle hits context budget or the Clutch issues a continuation:

`ContinuationBundleCreated` captures the distilled context bundle:
- `distilled_goal`, `truth_tower_projection`, `cognitive_insights`
- `next_focus`, `open_questions`, `constraints`
- `recursion_depth`, `bundle_size_bytes`
- `truncation_applied` — whether the bundle hit the size cap

`ReinjectionTriggered` records:
- `child_session_id` — the new session spawned
- `trigger_reason` — `context_budget` / `clutch_spawn` / `explicit_continuation`
- `recursion_cap_hit` — whether the max recursion depth was reached

The `parent_session_id` on the child's `SessionOpened` closes the link.
Together these form a walkable parent→child session tree.

**Visualization potential:** Session lineage tree, recursion depth indicator,
trigger reason annotation on each edge, cap-hit warning on terminal nodes.

---

## 8. Memory and knowledge graph state

### 8.1 Episode records

`MemoryWriteFromCycle` fires when a step's output is accepted and written to
episodic memory (`cycle_episode_records` table). Carries:
- `record_id` — the new memory record ID
- `write_reason` — `accept` / `consolidate` / `branch_anchor`
- `content_summary` — first 200 chars of the accepted output
- `cited_record_ids` — memory records cited in the step output

Memory records that are cited during a step get promoted in working memory
with elevated salience (`ELEVATED_SALIENCE` constant).

### 8.2 Knowledge graph (SKU lattice)

`cerebra classify` runs assign knowledge records to SKU categories via the
lattice decision logic (`evaluate_lattice`, `LatticeDecision`). Multi-commit
path fires when ≥2 categories clear the confidence threshold. Results are
written to `cerebra/lattice/<lineage_id>` streams.

`GraphExported` fires on `cerebra export graph --out <path>`:
- `node_count`, `edge_count`
- `vault_path`, `session_filter`
- `include_lattice_lineages`

**Visualization potential:** Knowledge graph as a Sigma.js node/edge layer
in LumaWeave, lineage cluster view, multi-commit disambiguation display.

---

## 9. CLI commands (queryable from Lattica)

Cerebra exposes these CLI entry points. Lattica can invoke via Tauri
`run_script` (if approved) or a dedicated Tauri command.

| Command | What it produces |
|---|---|
| `cerebra init <path>` | Initializes a vault |
| `cerebra ingest <path>` | Discovers and ingests source files into memory_records |
| `cerebra classify` | Runs SKU classification on unclassified memory records |
| `cerebra status` | Vault health, record counts, working memory status |
| `cerebra config get/set` | Read/write vault config keys |
| `cerebra export graph --out <path>` | Exports knowledge graph as JSON |

No `cerebra run-cycle` command exists yet (cycle execution is currently
library-only via `CycleRuntime`). The CLI entry point for triggered cycle
runs is a Phase 10 item.

---

## 10. Vault structure (what Lattica can read)

A Cerebra vault at `<vault_path>/` contains:

| Path | Content |
|---|---|
| `<vault_path>/.fossic/store.db` | Primary fossic event store |
| `<vault_path>/cerebra.db` | SQLite: memory_records, cycle_episode_records, working_memory_sessions, working_memory_slots |
| `<vault_path>/cerebra.json` | Vault config (model endpoint, cycle config name, etc.) |
| `<vault_path>/sources/` | Ingested source artifacts (hashed, normalized) |

Lattica can open `<vault_path>/.fossic/store.db` read-only via the
fossic-tauri Tauri commands. Direct reads of `cerebra.db` for table-level
queries (memory record counts, working memory state) are also viable via a
dedicated read adapter.

---

## 11. Payload renderers Cerebra will contribute

Cerebra will supply type-aware renderers for all 22 event types once the
`payloadRendererRegistry` mechanism is specified (R-CB-006, R-LW-005,
R-F-006 group-round item).

Priority renderer targets:

| Event type | Render intent |
|---|---|
| `SignalEvaluated` | Signal name as colored label + score bar (0–1) |
| `ClutchDecisionMade` | Action as styled badge + rule matched as secondary text |
| `LeewayGrantApplied` | permitted/requires_review/forbidden badge + grants list |
| `PredictionMade` | Expected score with confidence indicator |
| `OutcomeRecorded` | Predicted vs. actual side-by-side, error classification badge |
| `PredictionSevereMiss` | Alert-styled card with error magnitude |
| `CatalystArmSelected` | Arm name + score + selection method |
| `MemoryWriteFromCycle` | Record ID link + write reason badge + content preview |
| `ReinjectionTriggered` | Trigger reason + child session link + recursion depth |
| `ContinuationBundleCreated` | Bundle size + truncation warning if applied |
| `SessionOpened` / `SessionFlushed` | Session bookend card with goal + outcome |
| `CycleStarted` / `CycleCompleted` | Cycle span with step count + outcome badge |

---

*End of Cerebra capabilities document.*
