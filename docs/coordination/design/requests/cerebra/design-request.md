# Design Request — Cerebra

## Section 1 — Project identity

- **Project name:** cerebra
- **Filed by:** cerebra-claude
- **Date:** 2026-06-15
- **Role:** lighthouse project — core renderer redesign sets the visual vocabulary
  other projects mold after

## Section 1b — Platform positioning

**Cerebra is observability-heavy.**

The signal feed should communicate ambient cognitive state at a glance — is a
cycle running, is it accepting, are signal scores healthy? Drill-down depth
(specific per-signal numbers, prediction error details, rule names) is
diagnostic and should open on demand, not be always-on.

## Section 2 — What this project contributes visually

Cerebra emits events on `cerebra/agent-trace/<session_id>`. Four renderers
are live; one (ContextPacketBuilt) is pending the new visual vocabulary.

**Live renderers (P-013 guest contributions committed to Lattica):**

- **ClutchDecisionMade** — the cycle's control decision: accept / refine /
  stop, which clutch rule fired, cascade depth, whether the catalyst engine
  was invoked. Communicates: "did the cycle accept this step or force a
  retry/halt?" This is the highest-signal single event per step.
- **SignalEvaluated** — six cognitive signal scores (COHERENCE, GROUNDEDNESS,
  GENERATIVITY, RELEVANCE, PRECISION, EPISTEMIC_HUMILITY) + composite +
  low-confidence flag. Communicates: "how did this step score on each
  dimension?"
- **PredictionMade** — expected composite + per-signal scores before the
  step runs; basis (trajectory / config / baseline) + confidence.
  Communicates: "what did Cerebra expect from this step?"
- **OutcomeRecorded** — actual composite + signed prediction error +
  error_classification (noise / notable / severe) + per-signal signed
  errors. Communicates: "how far off was the prediction, and does it matter?"

**Pending renderer (drafted after new visual vocabulary lands):**

- **ContextPacketBuilt** — what retrieval surfaced before the step: mode,
  candidate count, abstained flag, retrieval scores. Communicates: "what
  context did Cerebra have going into this step?"

**Other event types on the stream (no renderer yet; lifecycle markers):**

- SessionOpened, CycleStarted, StepStarted, StepExecuted,
  EvaluationComposed, CycleCompleted, SessionFlushed,
  LeewayGrantApplied, MemoryWriteFromCycle

## Section 3 — Visual priority hierarchy

- **Highest priority — observability (at-a-glance):**
  - Is a cycle currently running? (session/cycle active indicator)
  - What was the last clutch decision? (accept green / refine orange / stop red)
  - Are composite scores healthy? (score bar or color-coded pulse)
  - Is the most recent prediction error notable or severe? (classification badge)
- **Medium priority — visible without effort:**
  - Which step is current, how many steps run this cycle
  - Signal breakdown for the most recent step (the 6-signal grid)
  - Prediction basis (trajectory vs. config vs. baseline — relevant when
    baseline fires because there's no trajectory yet)
- **Low priority — diagnostic (expand-on-click / archive only):**
  - Specific event IDs (decision_id, prediction_id, outcome_id)
  - Per-signal prediction errors (OutcomeRecorded signal grid)
  - Cascade depth and rule name in ClutchDecisionMade
  - Retrieval candidate scores (ContextPacketBuilt detail)
  - Raw timestamps to second precision
  - session_id / cycle_id / step_id strings

## Section 4 — What a glance should communicate

Within 2 seconds of looking at the Cerebra surface, a user should understand:

- "A cycle is running / the last cycle accepted / the last cycle stopped"
- "Composite score was around [X]% — healthy / borderline / poor"
- "The last prediction error was noise / notable / severe"

The live tail is the observability surface — it should make the above legible
with no investigation. Specific numbers, rule names, and signal breakdowns
are the diagnostic surface and open on demand.

## Section 5 — What doesn't matter at-a-glance

- Raw event IDs (data-event-id, decision_id, prediction_id) — suppress or
  DevTools-only
- Exact timestamps — time-of-day or relative ("2s ago") is enough in live tail
- Cascade depth integer in ClutchDecisionMade — visible on hover/expand only
- Per-signal prediction errors in OutcomeRecorded — archive-only detail
- Prediction confidence percentage — surfaced in archive; live tail shows
  basis badge only
- step_id / cycle_id strings — tooltip or archive-only; session_id truncated

## Section 6 — Cross-project visual relationships

- **Cerebra → Fossic (causation):** each Cerebra cycle event has a causation
  chain rooted in a SessionOpened event. Fossic's causation visualization
  should be able to highlight the chain when a Cerebra event is focused —
  this is a Fossic-side concern but Cerebra events carry the causation IDs.
- **Cerebra → LumaWeave (trigger):** when a Cerebra cycle triggers a
  LumaWeave graph rebuild, the two project panes side-by-side should make
  that relationship visible. No specific renderer change needed from Cerebra;
  this is a layout/design concern.
- **Per-step arc:** PredictionMade → SignalEvaluated → OutcomeRecorded is a
  natural grouping per step. In the archive view, these three events from the
  same step_id should read as a unit (grouped card or collapsible arc).
  In the live tail, only the most recent of the three needs to be visible.

## Section 7 — Current implementation (reference only — divergence encouraged)

- Current files: `src/renderers/cerebra/SignalEvaluatedRenderer.tsx/.css`,
  `PredictionMadeRenderer.tsx/.css`, `OutcomeRecordedRenderer.tsx/.css`,
  `ClutchDecisionMadeRenderer.tsx/.css`
- Current visual approach: dark monospace cards, `--portfolio-*` tokens,
  ALL CAPS labels, score bars (█░), colored classification badges,
  3×2 signal grids
- What works: dark palette and monospace match the cognitive/data nature;
  ALL CAPS section labels are strong landmarks; score bars communicate
  magnitude at a glance; color-coded action badges (green/orange/red) for
  accept/refine/stop are immediately legible
- **What's broken — the scroll problem:** CerebraSignalTile shows events
  append-only with newest at the bottom of a continuously growing scroll.
  After a few cycles, the most recent information is buried under 15-20
  pages of scroll. This is the most important design problem to solve.

## Section 8 — Live tail vs. archive split (the core design question for Cerebra)

This is the lighthouse problem. How Cerebra solves it informs every other
event-feed treatment in the system.

**Live tail (observability surface — always-on in pane):**
- Most recent ~5–10 events, newest at top, auto-scrolling stopped
- Each event is a compact card showing the highest-priority fields only
- ClutchDecisionMade: action badge + score summary is enough
- SignalEvaluated: composite score bar + classification is enough
- Lifecycle events (SessionOpened, CycleStarted, etc.): single-line status
  chips, not full cards
- "older →" affordance at bottom that opens archive for the current session

**Archive view (diagnostic surface — on-demand):**
- Browseable history grouped by session → cycle → step
- Per step: PredictionMade + SignalEvaluated + OutcomeRecorded shown as a
  unit (the prediction arc) with full payload detail
- ClutchDecisionMade shows rule name, cascade depth, escalate flag
- Filterable by action (show only stop/refine decisions), by session, by
  error classification

## Section 9 — Constraints

- `PayloadRendererProps: { payload: unknown, event_id: string }` — ADR-017,
  locked props contract
- `--portfolio-*` design token namespace — host owns tokens; no hardcoded
  colors in renderer CSS
- `jsx: react-jsx` (no `import React`), `strict: true`,
  `noUnusedLocals/Parameters: true`, React 19
- `data-cerebra-renderer="<EventType>"` structural marker on renderer root
  div — required for POST_FLIGHT smoke tests
- Stream glob: `cerebra/agent-trace/*`
- Monospace for event content — data, not prose; sans-serif for chrome only

## Section 10 — Open questions for frontend-design

- **Live tail depth:** 5 events? 10? Scrollable within tile with a depth
  cap? What triggers "spill to archive"?
- **Compact vs. full card in live tail:** should live tail show a reduced
  version of the current renderer cards (same component, fewer fields
  rendered), or a completely different "summary chip" component? The former
  is simpler; the latter may be necessary if the current cards are too dense
  at any reduction.
- **Per-step grouping in archive:** should PredictionMade + SignalEvaluated
  + OutcomeRecorded from the same step_id collapse into one grouped card with
  expand? Or stay as three adjacent cards with a visual separator?
- **Lifecycle events in live tail:** SessionOpened / CycleStarted /
  CycleCompleted are important context but carry no score data. Should they
  appear as full cards, one-line chips, or only as section dividers in the
  archive view?
- **Low-confidence flag treatment:** when SignalEvaluated has
  `low_confidence: true`, does the live-tail card visually attenuate
  (dimmed), border-highlight, or badge? This affects the visual language
  for uncertainty across all projects.
- **Severe miss escalation:** OutcomeRecorded with `error_classification:
  "severe"` is a signal that Cerebra's predictions are badly wrong. Should
  this escalate visually beyond the current danger-red border — e.g., pin
  to top of live tail, pulse, or persist in a "recent alerts" strip?
