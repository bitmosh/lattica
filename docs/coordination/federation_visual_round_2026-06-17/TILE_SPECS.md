# Tile Specs — Federation Visual Round (2026-06-17)

---

## cerebra — cerebra_tile_spec

# Cerebra — Tile Specification
## Federation Visual Round 2026-06-17

**Author:** cerebra-claude
**Date:** 2026-06-17
**Accent token:** `--project-accent-cerebra` (`#540fa8`)

---

## §1 — Tile identifier and current state

### CerebraSignalTile

| Field | Value |
|---|---|
| **Tile name** | CerebraSignalTile |
| **ID** | `cerebra-signal-feed` |
| **File** | `src/tiles/cerebra-signal/CerebraSignalTile.tsx` |
| **Current state** | Partial — daemon HTTP poll live, fossic subscription live (from-now only), 5 payload renderers registered; no cold-start; no session context section; no signal score display; event feed renders registered types inline |
| **Authoring intent** | P-013 by Cerebra: tile extension + new renderer files authored by Cerebra Claude, committed to Lattica tree per guest-author protocol. Lattica wires registrations in `registrations.tsx`. |

No second tile proposed in this round. The signal feed tile covers all Cerebra-visible state. A future `CerebraGraphTile` (for GSA events and lineage history) is noted as deferred.

---

## §2 — Visible elements

Grouped by tile section top to bottom.

### Header

| Element | Description |
|---|---|
| `agent_state_pill` | 5-state agent status pill: RUNNING / IDLE / ERROR / OFFLINE / UNKNOWN. Derived from daemon health + recent fossic events. |
| `posture_toggle` | HOLD / AUTO toggle button. Current posture from daemon poll; click writes to daemon. Accent-colored when HOLD is active. |
| `checkpoint_btn` | "Checkpoint" action button. Triggers immediate snapshot of current session state to fossic. Disabled when no active session. |

### Session Context

| Element | Description |
|---|---|
| `session_id_label` | Truncated session UUID (first 8 chars + ellipsis). From `DaemonStatus.active_session_id`. |
| `cycle_config_label` | Cycle config name. From most recent `SessionOpened.payload.cycle_config`. |
| `goal_preview` | Session goal text, truncated to 60 chars. From most recent `SessionOpened.payload.goal`. |
| `cycle_count_badge` | Integer count of cycles run in this session. From `DaemonStatus.cycle_count`. |
| `recursion_depth_chip` | Shown only when `SessionOpened.payload.recursion_depth > 0`. Indicates this is a reinjected sub-session. |

### Signal Scores

| Element | Description |
|---|---|
| `signal_score_rows` | Six rows, one per signal (COHERENCE, GROUNDEDNESS, GENERATIVITY, RELEVANCE, PRECISION, EPISTEMIC_HUMILITY). Each row: signal name label + 10-block score bar + percentage + `low_confidence` warning badge. Shows scores from the most recent completed evaluation step. |
| `composite_score_bar` | Full-width composite score bar. Floor threshold marker at `composite_floor` from cycle config. Turns amber when `composite_floor_violated` is true. |

### Clutch / Catalyst Strip

| Element | Description |
|---|---|
| `clutch_action_badge` | Latest ClutchDecisionMade action: refine / accept / stop / critique / explore / escalate. Color-coded: accept → success green, stop → danger red, others → neutral. |
| `clutch_rule_chip` | `rule_matched` string from ClutchDecisionMade payload. Small monospace chip. Hidden when rule_matched is null. |
| `catalyst_arm_chip` | Shown when most recent CatalystArmSelected has a non-null `arm_id`. Displays `arm_id` + `mapped_action`. Hidden otherwise. |
| `prediction_error_chip` | Shown when most recent OutcomeRecorded has `error_classification` set. Displays `error_classification` label + `prediction_error` delta. Color-coded: severe → danger red, minor → amber. Hidden when `error_classification` is null. |

### Event Feed

| Element | Description |
|---|---|
| `event_feed_rows` | Scrollable list of recent events from `cerebra/agent-trace/**` and `cerebra/control`. Most recent first. Each row: event_type badge (violet) + abbreviated stream identifier + relative timestamp. |
| `event_detail_expander` | Click a row to expand inline payload renderer. If no renderer registered for that event_type, falls through to JSON pretty-print. Collapse on second click. |
| `relay_pending_notice` | Steel blue notice shown when fossic subscription is open but no events have arrived (pre-relay or no-data-yet). Text: "Awaiting cerebra-relay.py — hub events not yet flowing." Replaced by event feed rows as soon as first event arrives. |

### GSA Chip

| Element | Description |
|---|---|
| `gsa_chip` | Appears when a `GraphSnapshotAvailable` event has been received on `cerebra/graph/**` within the last 60 minutes. Shows `lineage_id` (truncated) + `graph_version`. Clicking expands the full GSA payload. Sourced from a separate hub subscription (not via relay — GSA is hub-direct). |

### Footer

| Element | Description |
|---|---|
| `daemon_poll_ts` | "polled Xs ago" — time elapsed since last successful daemon poll. Updates on each poll tick. |

---

## §3 — Token bindings per element

### Data source A — Daemon HTTP poll

- **Endpoint:** `GET http://127.0.0.1:7432/status` (configurable via `VITE_CEREBRA_DAEMON_URL`)
- **Update frequency:** 30s polling; immediate on mount
- **Error behavior:** failed fetch → `DaemonHealth = "offline"`; `DaemonStatus = null`

| Element | Response field |
|---|---|
| `agent_state_pill` | Derived: `status.cycle_running` + `daemonHealth` + recent fossic events (see §4) |
| `posture_toggle` | `response.posture` → `"auto" \| "hold"` |
| `session_id_label` | `response.active_session_id` (nullable) |
| `cycle_count_badge` | `response.cycle_count` |
| `daemon_poll_ts` | Client timestamp at last successful poll |

### Data source B — Fossic hub subscription (agent-trace)

- **Stream pattern:** `cerebra/agent-trace/**`
  (covers all `cerebra/agent-trace/<session_id>` per-session streams)
- **Update frequency:** event-driven
- **Cold-start:** REQUIRED before subscribe — see §9 open item 1

| Element | Event type | Payload fields |
|---|---|---|
| `cycle_config_label` | `SessionOpened` | `payload.cycle_config` |
| `goal_preview` | `SessionOpened` | `payload.goal` |
| `recursion_depth_chip` | `SessionOpened` | `payload.recursion_depth` |
| `signal_score_rows` | `SignalEvaluated` | `payload.signal_name`, `payload.signal_score`, `payload.signal_strength`, `payload.low_confidence` |
| `composite_score_bar` | `EvaluationComposed` | `payload.composite_score`, `payload.composite_floor_violated` |
| `clutch_action_badge` | `ClutchDecisionMade` | `payload.action`, `payload.rule_matched`, `payload.escalate_to_catalyst` |
| `clutch_rule_chip` | `ClutchDecisionMade` | `payload.rule_matched` |
| `catalyst_arm_chip` | `CatalystArmSelected` | `payload.arm_id`, `payload.mapped_action`, `payload.selection_reason` |
| `prediction_error_chip` | `OutcomeRecorded` | `payload.error_classification`, `payload.prediction_error` |
| `event_feed_rows` | all | `event.event_type`, `event.stream_id`, `event.timestamp_us` |
| `relay_pending_notice` | (subscription state) | no events received yet |

**indexed_tags available for cold-start filtering** (confirmed from source):

| Event type | indexed_tags keys |
|---|---|
| `SessionOpened` | `cycle_config`, `recursion_depth`, `parent_session_id` |
| `CycleStarted` | `session_id`, `cycle_id`, `cycle_config` |
| `SignalEvaluated` | `signal_name`, `low_confidence` |
| `EvaluationComposed` | `composite_floor_violated` |
| `ClutchDecisionMade` | `session_id`, `cycle_id`, `step_id`, `action` |
| `CatalystArmSelected` | `session_id`, `cycle_id`, `step_id`, `arm_id` |
| `OutcomeRecorded` | `error_classification` |
| `CycleCompleted` | `session_id`, `cycle_id`, `outcome` |
| `SessionFlushed` | `session_id`, `cycle_id`, `final_outcome` |
| `CheckpointSaved` | `session_id` |
| `LeewayGrantApplied` | `session_id`, `cycle_id`, `step_id`, `final_decision` |

### Data source C — Fossic hub subscription (control)

- **Stream pattern:** `cerebra/control`
- **Update frequency:** event-driven (low frequency — posture changes only)

| Element | Event type | Payload fields |
|---|---|---|
| `posture_toggle` | `PostureChanged` | `payload.posture` — reconcile with daemon poll value |

### Data source D — Fossic hub subscription (graph)

- **Stream pattern:** `cerebra/graph/**`
- **Update frequency:** event-driven (infrequent — one per graph export)
- **Notes:** Hub-direct writes — does NOT require cerebra-relay.py to ship. Cerebra's hub-direct GSA emission is implemented (2026-06-17) in `export_graph()` (`cerebra/graph/exporter.py`). Requires `CEREBRA_PLATFORM_STORE` env var pointing to `~/.lattica/fossic/store.db`; no hub write occurs if the variable is unset.

| Element | Event type | Payload fields |
|---|---|---|
| `gsa_chip` | `GraphSnapshotAvailable` | `payload.lineage_id`, `payload.graph_version`, `payload.content_hash`, `payload.snapshot_ref`, `payload.node_count`, `payload.edge_count`, `payload.triggered_by` (optional) |

**Cold-start for GSA:** Issue `read_range` for each known lineage stream, or use a wildcard pattern if CORE.md §9.5 `ReadQuery` glob support is confirmed. Safe pre-confirmation pattern: if no active lineage is known, skip cold-start and show `no-data-yet`; the first live `GraphSnapshotAvailable` event on the subscription populates `gsa_chip`. Then subscribe from-now to `cerebra/graph/**`.

---

## §4 — Visual states per element

### agent_state_pill

Pure derivation — no LiveValue wrapper. Color mapping:

| State | Color |
|---|---|
| RUNNING | `var(--portfolio-color-success)` `#5eba7d` |
| IDLE | `var(--portfolio-text-secondary)` `#a28fc0` |
| ERROR | `var(--portfolio-color-danger)` `#e05c5c` |
| OFFLINE | `var(--lv-source-unreachable)` amber |
| UNKNOWN | `var(--portfolio-text-secondary)` muted |

Derivation: OFFLINE if daemon health = offline; ERROR if recent `SessionFlushed.payload.final_outcome === "error"`; RUNNING if `DaemonStatus.cycle_running === true`; IDLE if recent events in last 5 min; UNKNOWN otherwise.

### Session Context section — LiveValue\<DaemonStatus\> (source A)

| LV state | Treatment |
|---|---|
| `live` | Show session_id, config, goal, cycle count |
| `source-unreachable` | Amber row: "Cerebra daemon offline" — session fields hidden |
| `no-data-yet` | Grey placeholder shimmer on all session fields |

### Signal Score rows — LiveValue\<StepEvaluation\> (source B)

| LV state | Treatment |
|---|---|
| `live` | Six score rows rendered with values |
| `pre-relay` | Six rows with `--lv-pre-relay` steel blue placeholders; label text "relay pending" |
| `no-data-yet` | Six rows at 0.6 opacity with shimmer; no score values |
| `data-stale` (thresholdMs: 300000) | Amber timestamp overlay; existing scores preserved; "last eval Xm ago" note |

### composite_score_bar — same LiveValue as signal scores

| LV state | Treatment |
|---|---|
| `live` | Bar rendered; floor marker visible; amber fill when `composite_floor_violated` |
| `pre-relay` | Placeholder bar in steel blue |
| `no-data-yet` | Grey empty bar at 0.6 opacity |

### Event feed — LiveValue\<EventFeed\> (source B)

| LV state | Treatment |
|---|---|
| `live` | Event rows list |
| `pre-relay` | Single row: steel blue "Awaiting cerebra-relay.py — hub events not yet flowing" |
| `no-data-yet` | Single row: grey "Waiting for Cerebra signals…" (current behavior) |
| `subscription-closed` | Red reconnection row at top of feed |

### gsa_chip — LiveValue\<GSAEvent\> (source D)

| LV state | Treatment |
|---|---|
| `live` | Violet chip with lineage_id + graph_version |
| `no-data-yet` | Hidden — GSA chip only appears once a snapshot has been written |

### posture_toggle, checkpoint_btn

Static — no LiveValue wrapper. Disabled states handled in §5.

---

## §5 — Interaction surfaces

### posture_toggle

- **Trigger:** click
- **Action:** `POST http://127.0.0.1:7432/posture` with body `{ "state": "hold" | "auto" }` (toggles current state)
- **Response shape:** `{ "posture": "hold" | "auto" }` (200) or error (400/409)
- **On success:** update local posture state immediately; daemon poll will confirm on next tick
- **On failure:** revert toggle visual; show brief inline error
- **Disabled when:** `DaemonHealth === "offline"`

### checkpoint_btn

- **Trigger:** click
- **Action:** `POST http://127.0.0.1:7432/checkpoint` with body `{}`
- **Response shape:** `{ "bundle_id": string, "session_id": string }` (200) or `{ "error": string }` (409)
- **On success:** brief "Checkpointed" confirmation inline (500ms); no state change needed — the fossic event will arrive via subscription
- **On failure:** show inline error message
- **Disabled when:** `DaemonStatus.active_session_id === null` or `DaemonHealth === "offline"`

### event_feed_row click

- **Trigger:** click on any event row in the feed
- **Action:** toggle inline expansion of payload renderer for that event
- **If renderer registered:** render `<EventTypeRenderer payload={row.payload} event_id={row.id} />`
- **If no renderer:** render JSON pretty-print of payload
- **State:** client-side toggle per row ID; no Tauri command

---

## §6 — Tile registration shape

```typescript
tileSectionRegistry.register({
  id: "cerebra-signal-feed",
  label: "Cerebra Signal Feed",
  category: "right-panel",
  defaultWidth: 420,
  defaultHeight: 560,
  collapsible: true,
  defaultVisible: true,
  defaultExpanded: true,
  content: () => <CerebraSignalTile />,
});
```

`defaultWidth: 420` fits the signal score rows + composite bar comfortably. `defaultHeight: 560` accommodates header + session context + six signal rows + clutch strip + event feed at default expansion. Both are starting hints; the tile's sections are individually collapsible.

---

## §7 — Cross-tile relationships

| Target tile | Relationship |
|---|---|
| `AiStackTopologyTile` | **Shared daemon endpoint** — both tiles independently poll `GET /status` at `:7432`. The BO node in AiStackTopologyTile reflects Cerebra daemon up/down; CerebraSignalTile reflects the same. No shared React state; they poll independently. No coordination needed; both correctly show "down" when daemon is offline. |

No fossic subscription sharing. No click navigation to other tiles in this spec.

Two additional cross-tile relationships flagged in CORE.md §8.1 — both deferred:

| From tile | Pattern | Status |
|---|---|---|
| LumaWeaveSourceTile | Causation arc: `SourceLoaded.causation_id` → `GraphSnapshotAvailable` on `cerebra/graph/**`. Hub-traversable; no `fossic_query_remote_store` needed (both events live on the hub). | Deferred (causation arc in Lattica shell) — LumaWeave S-031 receive path not built. cerebra-relay.py is NOT a blocker — GSA is hub-direct (CORE.md §9.6). Note: `cerebra-snapshot` source adapter implemented in LumaWeave (2026-06-17, `src/source-adapter/adapters/cerebraSnapshotAdapter.ts`) — `snapshot_ref` read path ready on both sides. Hub causation arc awaits S-031. |
| PolicyScoutTile | `tile:focus-event` — on resolving `DecisionIssued.upstream_causation_id` to a Cerebra hub event, PS proposes emitting a cross-tile signal for this tile to scroll + highlight the event. Payload shape and listener contract unresolved. | Deferred — iter-5+, developer decision. No cross-tile protocol in scope for iter-4. PS read-only provenance lookup via `fossic_query_remote_store` requires no Cerebra tile action (PS §9.7; CORE.md §8.1). |

---

## §8 — P-013 authorship intent

### Tile component

`src/tiles/cerebra-signal/CerebraSignalTile.tsx` — **Cerebra-authored, extended.**
The existing component is the base. Cerebra adds: session context section, signal score section, clutch/catalyst strip, GSA chip, cold-start logic. CSS companion at `src/tiles/cerebra-signal/CerebraSignalTile.css` extended in the same pass.

### Existing renderer files — extend in place

All 5 files exist at `src/renderers/cerebra/`:

| File | Extension needed |
|---|---|
| `SignalEvaluatedRenderer.tsx` | Add `signal_strength` secondary bar; style `low_confidence` warning more prominently |
| `OutcomeRecordedRenderer.tsx` | Add `error_classification` color coding (minor → amber, severe → red); show `prediction_error` delta |
| `ClutchDecisionMadeRenderer.tsx` | Add `rule_matched` chip; add `escalate_to_catalyst` indicator badge |
| `PredictionMadeRenderer.tsx` | No change needed |
| `CheckpointSavedRenderer.tsx` | No change needed |

### New renderer files

Eight new files, authored by Cerebra, committed to Lattica tree:

```
src/renderers/cerebra/CycleStartedRenderer.tsx
src/renderers/cerebra/CycleStartedRenderer.css
src/renderers/cerebra/StepExecutedRenderer.tsx
src/renderers/cerebra/StepExecutedRenderer.css
src/renderers/cerebra/EvaluationComposedRenderer.tsx
src/renderers/cerebra/EvaluationComposedRenderer.css
src/renderers/cerebra/CatalystArmSelectedRenderer.tsx
src/renderers/cerebra/CatalystArmSelectedRenderer.css
src/renderers/cerebra/LeewayGrantAppliedRenderer.tsx
src/renderers/cerebra/LeewayGrantAppliedRenderer.css
src/renderers/cerebra/SessionOpenedRenderer.tsx
src/renderers/cerebra/SessionOpenedRenderer.css
src/renderers/cerebra/SessionFlushedRenderer.tsx
src/renderers/cerebra/SessionFlushedRenderer.css
src/renderers/cerebra/CycleCompletedRenderer.tsx
src/renderers/cerebra/CycleCompletedRenderer.css
```

### registerPayloadRenderer calls to add

Add to `src/registrations.tsx` alongside existing 5 Cerebra registrations:

```typescript
registerPayloadRenderer({
  project: "cerebra", event_type: "CycleStarted",
  component: CycleStartedRenderer,
  label: "Cerebra — Cycle Started",
  stream_glob: "cerebra/agent-trace/*",
});
registerPayloadRenderer({
  project: "cerebra", event_type: "StepExecuted",
  component: StepExecutedRenderer,
  label: "Cerebra — Step Executed",
  stream_glob: "cerebra/agent-trace/*",
});
registerPayloadRenderer({
  project: "cerebra", event_type: "EvaluationComposed",
  component: EvaluationComposedRenderer,
  label: "Cerebra — Evaluation Composed",
  stream_glob: "cerebra/agent-trace/*",
});
registerPayloadRenderer({
  project: "cerebra", event_type: "CatalystArmSelected",
  component: CatalystArmSelectedRenderer,
  label: "Cerebra — Catalyst Arm Selected",
  stream_glob: "cerebra/agent-trace/*",
});
registerPayloadRenderer({
  project: "cerebra", event_type: "LeewayGrantApplied",
  component: LeewayGrantAppliedRenderer,
  label: "Cerebra — Leeway Grant Applied",
  stream_glob: "cerebra/agent-trace/*",
});
registerPayloadRenderer({
  project: "cerebra", event_type: "SessionOpened",
  component: SessionOpenedRenderer,
  label: "Cerebra — Session Opened",
  stream_glob: "cerebra/agent-trace/*",
});
registerPayloadRenderer({
  project: "cerebra", event_type: "SessionFlushed",
  component: SessionFlushedRenderer,
  label: "Cerebra — Session Flushed",
  stream_glob: "cerebra/agent-trace/*",
});
registerPayloadRenderer({
  project: "cerebra", event_type: "CycleCompleted",
  component: CycleCompletedRenderer,
  label: "Cerebra — Cycle Completed",
  stream_glob: "cerebra/agent-trace/*",
});
```

Note: `StepStarted`, `ContextPacketBuilt`, `CatalystInvoked`, `MemoryWriteFromCycle`, and `PredictionSevereMiss` also emit on `cerebra/agent-trace/*`. Renderers for these are not listed above — they fall through to JSON pretty-print until a future pass adds them. This is correct behavior per ADR-017.

---

## §9 — Open items

**1. Cold-start session binding pattern**

The tile must perform a snapshot read before subscribing to seed current session context and the most recent evaluation state.

**ReadQuery glob caveat (CORE.md §9.5):** Whether `ReadQuery` supports the same glob semantics as `subscribe()` is **unconfirmed**. `subscribe("cerebra/agent-trace/**")` works via the Rust subscription registry; `read_range(ReadQuery("cerebra/agent-trace/**"))` uses a separate query path and may only accept exact stream names. Until confirmed, the safe cold-start pattern is one `read_range` per known exact stream:

```python
# Phase 1: snapshot — safe pattern (one read per exact stream)
# active_session_id is available from the daemon poll; use it to target exactly
session_stream = f"cerebra/agent-trace/{active_session_id}"
past = store.read_range(ReadQuery(session_stream))

# Fold: find most recent SessionOpened → extract session_id, goal, cycle_config
# Fold: find most recent 6 SignalEvaluated events (no step_id in indexed_tags —
#       correlate by timestamp proximity to most recent EvaluationComposed)

# Phase 2: subscribe from now
with store.subscribe("cerebra/agent-trace/**") as sub:
    ...
```

If `active_session_id` is null at tile open (daemon offline or no active session), the cold-start snapshot is skipped; tile shows `no-data-yet` until a live `SessionOpened` event arrives.

`SignalEvaluated` events do NOT carry `step_id` in `indexed_tags` (only `signal_name` and `low_confidence`). Reconstructing the last step's 6-signal bundle from cold-start requires: find the most recent `EvaluationComposed` event, then back-collect the 6 `SignalEvaluated` events immediately preceding it by causation chain or timestamp proximity. This correlation pattern needs to be resolved before cold-start signal score seeding can be implemented. Declaring the gap here.

**2. subscribe_pattern depth for agent-trace**

Current tile uses `cerebra/agent-trace/*` (one segment deep). Session streams are `cerebra/agent-trace/<session_id>` — flat, one segment. Pattern is correct for current stream naming. If reinjected sub-sessions ever use deeper paths (e.g. `cerebra/agent-trace/<session_id>/<child_id>`), pattern would need `cerebra/agent-trace/**`. No change required now; noting for relay agent spec consistency.

**3. GSA subscription timing**

`cerebra/graph/**` subscription (data source D) works independently of cerebra-relay.py — GSA is hub-direct. However, Lattica's `fossic_subscribe` Tauri command opens the hub store (`~/.lattica/fossic/store.db`), which must exist. Hub store is created on first Lattica app run. GSA subscription is safe to open on tile mount; `no-data-yet` state is the correct treatment until Cerebra has run a graph export with `CEREBRA_PLATFORM_STORE` set. GSA emission is implemented (2026-06-17) — stream is `cerebra/graph/<lineage_id>` where `lineage_id` is a stable 16-char hex hash of the vault path. LumaWeave's `cerebra-snapshot` adapter (also implemented 2026-06-17) reads `snapshot_ref` directly via the existing `read_user_file` Tauri command — no new Tauri commands required. Both ends of the snapshot data path are now live.

**4. Deferred — CerebraGraphTile**

A dedicated `CerebraGraphTile` showing GSA lineage history (multiple lineages, snapshot provenance, graph_version progression) is deferred. The `gsa_chip` element in CerebraSignalTile is a lightweight indicator only — one chip per lineage, most recent snapshot. Full lineage history is a separate tile spec for a future round.

---

*Cerebra tile spec complete — 2026-06-17*

---

## lumaweave — lumaweave_tile_spec

# LumaWeave — Tile Specification
## Federation Visual Round 2026-06-17

**Filed by:** lumaweave-claude
**Date:** 2026-06-17
**In response to:** `CORE.md` Stage 1a spec-authoring round

---

## §1 — Tile identifier and current state

### Tile: LumaWeave Graph Status

| Field | Value |
|---|---|
| **Tile name** | LumaWeave Graph Status |
| **Current state** | Not yet built — new tile, no file exists |
| **Target file path (Lattica tree)** | `src/tiles/lumaweave/LumaWeaveGraphTile.tsx` |
| **Authorship intent** | P-013: LumaWeave authors component + renderer files; Lattica wires `registrations.tsx` entries |
| **Project accent** | `--project-accent-lumaweave` (`#96f35a`, lime green) |

**One tile only.** LumaWeave's hub-visible state fits a single tile. A future second tile (fossic event history inspector) may emerge once the relay agent is live; not scoping it here.

---

## §2 — Visible elements (canonical enumeration)

### Header

| Element | Description |
|---|---|
| `project_accent_bar` | Thin 2px horizontal rule in `--project-accent-lumaweave` at top of tile chrome; identifies project at a glance |
| `graph_health_pill` | State badge: one of `LOADED`, `FAILED`, `IDLE`, or `--`; color-coded green/red/slate; derived from most recent SourceLoaded or SourceLoadFailed event on hub |
| `adapter_label` | Current `adapter_id` text; derived from most recent SourceLoaded payload; monospace |
| `source_key_label` | Current `source_key` text beneath adapter_label; secondary color |
| `node_edge_count_badge` | Compact badge: "N nodes · E edges"; derived from most recent SourceLoaded `node_count` and `edge_count`; monospace |

### Main — Graph state section

| Element | Description |
|---|---|
| `active_dialect_chip` | Rounded chip showing current `dialect_id` (e.g., `gwells.dialect.spine-force`); derived from most recent GraphLayoutSettled `indexed_tags.dialect_id`; uses project accent border |
| `settle_state_indicator` | SETTLING / SETTLED badge; broken-pending — blocked on gwells convergence detection signal (GWRuntimeState "settled" variant, not yet in v0.1.5); renders in wiring-incomplete state |
| `layout_settle_time_label` | "settled Nms" from last GraphLayoutSettled `payload.duration_ms`; secondary color; monospace; shown only when active_dialect_chip is live |

### Main — Event feed section

| Element | Description |
|---|---|
| `event_feed_header` | Section label "RECENT EVENTS" in small-caps; static |
| `event_feed_list` | Rolling list of recent LumaWeave events from hub subscription; each row is one StoredEvent |
| `event_feed_row_type_pill` | Per-row: event_type rendered as a colored pill (SourceLoaded=green, SourceLoadFailed=red, SourceSwitched=blue, GraphLayoutSettled=amber) |
| `event_feed_row_timestamp` | Per-row: relative time ("3m ago"); derived from `event.timestamp_us / 1000`; monospace |
| `event_feed_row_summary` | Per-row: one-line summary from payload renderer (adapter_id + source_key for source events; dialect_id for GraphLayoutSettled); falls back to event_type if no renderer |
| `event_feed_row_causation_link` | Per-row (only if `event.causation_id !== null`): small arc icon indicating a causal parent; clickable to trigger causation traversal |
| `event_feed_row_expand_chevron` | Per-row: chevron toggle to expand full payload inline |
| `event_feed_empty_placeholder` | Shown when no events received yet or subscription in pre-relay state |

### Main — Source switcher section (broken-pending)

| Element | Description |
|---|---|
| `source_switcher_header` | Section label "SOURCE" in small-caps; static |
| `source_list_rows` | List of available source adapters; broken-pending — blocked on `AdapterListChanged` event type (not yet implemented) and relay agent being live |
| `cerebra_snapshot_row` | Special row in source list for "Load Cerebra graph snapshot"; broken-pending — blocked on LumaWeave's automated S-031 receive path (hub subscription + GSA handler + causation_id plumbing); shows grayed out with "awaiting receive path" label. NOTE: Cerebra's `_emit_snapshot_available()` is now live; GSA events are hub-direct (CORE.md §9.6) — `cerebra-relay.py` is NOT a prerequisite. LumaWeave's `cerebra-snapshot` adapter (`adapters/cerebraSnapshotAdapter.ts`) is now registered and can load a snapshot manually given a `snapshot_ref` path; the automated trigger flow is what remains unbuilt. |
| `source_switcher_current_chip` | Chip showing currently loaded source (adapter_id); derived from SourceLoaded; live once relay is up (only current-source display, not the switcher affordance) |

### Footer

| Element | Description |
|---|---|
| `last_event_timestamp` | "last event N ago" derived from most recent event's `timestamp_us / 1000`; monospace; secondary color |
| `relay_status_chip` | Small chip: "RELAY LIVE" (green) or "PRE-RELAY" (steel blue); derived from LiveValue state; shown at all times so the developer knows why the tile is empty |

---

## §3 — Token bindings per element

All hub-side data flows through one LiveValue per source kind. LumaWeave's tile has two sources:
- **Source A** — hub fossic subscription to `lumaweave/**` (from-now delivery + cold-start fold)
- **Source B** — static / derived (no external source)

---

### Current-state elements (graph_health_pill, adapter_label, source_key_label, node_edge_count_badge)

**source_kind:** fossic-subscribe (hub store) + cold-start `read_range`

**source_detail:**
- Hub store path: `~/.lattica/fossic/store.db`
- Subscribe stream pattern: `lumaweave/**`
- Branch: `"main"`
- Relevant event type: `SourceLoaded`, `SourceLoadFailed`
- Payload fields consumed:
  - `graph_health_pill` ← fold of SourceLoaded/SourceLoadFailed events; last event determines state
  - `adapter_label` ← most recent `SourceLoaded.payload.adapter_id`
  - `source_key_label` ← most recent `SourceLoaded.payload.source_key`
  - `node_edge_count_badge` ← most recent `SourceLoaded.payload.node_count`, `SourceLoaded.payload.edge_count`

**Cold-start pattern (required — these elements show "current value"):**

*Conceptual pseudocode (Python API shape). Lattica's tile implementation uses the Rust fossic crate, not Python — CORE.md §5.6. ReadQuery uses exact stream name `"lumaweave/graph/events"` (not a glob) — safe per CORE.md §9.5.*

```python
import os
# CORE.md §9.4: Store.open() does NOT expand ~ in Python; use expanduser
store = Store.open(os.path.expanduser("~/.lattica/fossic/store.db"))
past = store.read_range(ReadQuery("lumaweave/graph/events"))  # exact name, not a glob
# fold: find last SourceLoaded or SourceLoadFailed by timestamp_us
last_source_event = max(
    (e for e in past if e.event_type in {"SourceLoaded", "SourceLoadFailed"}),
    key=lambda e: e.timestamp_us, default=None
)
# seed LiveValue.value from last_source_event.payload()
# then subscribe for incremental updates
with store.subscribe("lumaweave/**") as sub:
    for event in sub:
        if event.event_type in {"SourceLoaded", "SourceLoadFailed", "SourceSwitched"}:
            update_graph_health(event)
```

**update_frequency:** event-driven (from-now via subscribe after cold-start fold)

---

### active_dialect_chip, layout_settle_time_label

**source_kind:** fossic-subscribe (hub store) + cold-start `read_range`

**source_detail:**
- Same subscription as above (`lumaweave/**`) — same LiveValue (Source A)
- Relevant event type: `GraphLayoutSettled`
- Payload fields consumed:
  - `active_dialect_chip` ← most recent `GraphLayoutSettled.indexed_tags().get("dialect_id")`
    - Note: `indexed_tags()` is a method call; returns `None` until indexed_tags pass ships on LumaWeave side (needs-wiring.md items 2-3). Until then, fall back to `payload.get("dialect_id")` — not present in current payload either. Element shows `no-data-yet` until indexed_tags ships.
  - `layout_settle_time_label` ← most recent `GraphLayoutSettled.payload()["duration_ms"]`

**Cold-start:** same `read_range` pass above; fold to find last GraphLayoutSettled.

**update_frequency:** event-driven

---

### event_feed_list rows

**source_kind:** fossic-subscribe (hub store, from-now only)

**source_detail:**
- Same subscription (`lumaweave/**`), same LiveValue (Source A)
- All four relayed event types: `SourceLoaded`, `SourceLoadFailed`, `SourceSwitched`, `GraphLayoutSettled`
- Per-row bindings:
  - `event_feed_row_type_pill` ← `event.event_type`
  - `event_feed_row_timestamp` ← `event.timestamp_us / 1000` (ms → Date)
  - `event_feed_row_summary` ← dispatched to payload renderer via `getPayloadRenderer({ project: "lumaweave", event_type: event.event_type })`; falls back to JSON pretty-print
  - `event_feed_row_causation_link` ← `event.causation_id !== null` (conditional render)

**Cold-start:** NO cold-start for the event feed. Feed shows events since tile mount only. Cold-start is only needed for "current state" elements above.

**update_frequency:** event-driven (each new event appends a row; cap at last 50 rows)

---

### source_switcher_section

**source_kind:** wiring-incomplete (no AdapterListChanged event type exists; relay agent not yet written)

**source_detail:** none — entire section renders in `wiring-incomplete` state until:
1. Relay agent is live (hub receives LumaWeave events)
2. `AdapterListChanged` event type is designed and implemented in LumaWeave
3. Source switcher interaction path is built (reverse channel API)

**update_frequency:** N/A (broken-pending)

---

### relay_status_chip, last_event_timestamp

**source_kind:** derived from LiveValue state (no separate source)

- `relay_status_chip` ← `liveValue.state === 'live'` → "RELAY LIVE"; `state === 'pre-relay'` → "PRE-RELAY"; other error states → their respective treatment
- `last_event_timestamp` ← `liveValue.state === 'live' ? liveValue.lastUpdated : null`

**update_frequency:** updates whenever LiveValue state transitions

---

## §4 — Visual states per element

### LiveValue Source A (hub fossic subscription `lumaweave/**`)

Applies to: `graph_health_pill`, `adapter_label`, `source_key_label`, `node_edge_count_badge`, `active_dialect_chip`, `layout_settle_time_label`, `event_feed_list`.

| State | Treatment |
|---|---|
| `no-data-yet` | cold-start read complete but no events yet in hub store; `graph_health_pill` shows `--` in `--lv-no-data-yet` (`#4a5568`); feed shows placeholder; `relay_status_chip` shows "PRE-RELAY" |
| `pre-relay` | relay agent not live yet; same visual as `no-data-yet` but `relay_status_chip` explicitly shows "PRE-RELAY" in `--lv-pre-relay` (`#4a7a9b`); does not read as an error — this is the expected initial state for all LumaWeave elements |
| `live` | normal render; `graph_health_pill` colored by derived state (LOADED=`--portfolio-color-success`, FAILED=`--portfolio-color-danger`, IDLE=slate) |
| `source-unreachable` | hub store unreachable; `graph_health_pill` shows `--` in `--lv-source-unreachable` amber; feed shows last known rows with amber overlay chip |
| `data-stale` (graph_health_pill, adapter_label) | thresholdMs: 3_600_000 (1 hour); stale overlay on graph_health_pill; `--lv-data-stale` dark amber; source events are rare so 1h is appropriate before flagging |
| `data-stale` (active_dialect_chip) | thresholdMs: 7_200_000 (2 hours); GraphLayoutSettled is rarer than source events |
| `subscription-closed` | red `--lv-subscription-closed` chip on feed header; reconnect indicator; last known state values shown but labeled stale |

### settle_state_indicator

| State | Treatment |
|---|---|
| `wiring-incomplete` | Always; shows purple `--lv-wiring-incomplete` badge "SETTLING (wiring incomplete)" in dev mode; hides entirely in production builds |

### source_switcher_section (entire section)

| State | Treatment |
|---|---|
| `wiring-incomplete` | Section renders with purple border and "awaiting relay + AdapterListChanged" dev-mode label in dev builds; `cerebra_snapshot_row` shows "awaiting receive path" with steel blue `pre-relay` treatment |

### Static elements

`project_accent_bar`, `event_feed_header`, `source_switcher_header`, `event_feed_row_expand_chevron` — no LiveValue wrapper; static render.

---

## §5 — Interaction surfaces

### 1 — Event feed row expand

| Field | Value |
|---|---|
| **Trigger** | click on `event_feed_row_expand_chevron` or anywhere on row |
| **Action** | Toggle inline expansion showing full JSON payload via payload renderer (or JSON pretty-print fallback) |
| **Tauri command** | none — pure UI state |
| **Disabled state** | none; always interactive |

### 2 — Causation link click

| Field | Value |
|---|---|
| **Trigger** | click on `event_feed_row_causation_link` (only shown when `event.causation_id !== null`) |
| **Action** | Attempt causation traversal; invoke `fossic_query_remote_store` when chain crosses a store boundary (Case-1 only) |
| **Tauri command** | `fossic_query_remote_store({ source_store: "cerebra", event_id: event.causation_id })` — Case-1 only (see exception below) |
| **Response shape** | `SerializedEvent \| null` (see CORE.md §3.7) |
| **Error display** | See table below |
| **Deferred state** | Non-interactive arc icon until hub has events with causation_id set (requires relay agent live + S-031 receive path built on LumaWeave) |

**Case-2 exception (LumaWeave `SourceLoaded` ← Cerebra `GraphSnapshotAvailable`):** This specific chain is hub-traversable — both events reside on the hub store. `fossic_query_remote_store` is NOT invoked. Read the causal parent directly from the hub via a standard hub `read_one` call. CORE.md §8.1 confirms this; CORE.md §6.3 step 2 covers the pattern.

Causation traversal error display:

| Error variant | Visual treatment |
|---|---|
| `registry_not_found` | Dashed arc with "vault registry not populated" label in secondary color |
| `project_not_registered` | Dashed arc with "cerebra not in registry" |
| `store_not_found` | Dashed arc with path shown in monospace |
| `store_error` | Arc with amber warning chip; `message` field truncated to 80 chars |
| `null` return | Arc rendered; "origin event not found in vault" label |
| loading | Spinner on arc link while awaiting command response |

**Note:** `fossic_query_remote_store` is currently non-functional (registry does not exist). The causation link renders as a static non-interactive icon until the relay agent ships and the developer creates `~/.lattica/project-registry.json`.

### 3 — Source switcher (broken-pending; not interactive)

| Field | Value |
|---|---|
| **Trigger** | click (future) |
| **Current state** | Entire section disabled; broken-pending |
| **Disabled reason** | wiring-incomplete — no AdapterListChanged event, no relay agent, no reverse channel API |

### 4 — Re-settle button (broken-pending; not interactive)

| Field | Value |
|---|---|
| **Trigger** | click (future) |
| **Current state** | Not yet included in tile; noting as future surface |
| **Disabled reason** | reverse channel API not designed or built |

---

## §6 — Tile registration shape

```typescript
tileSectionRegistry.register({
  id: "lumaweave-graph-status",
  label: "LumaWeave Graph Status",
  category: "right-panel",
  defaultWidth: 380,
  defaultHeight: 460,
  collapsible: true,
  defaultVisible: true,
  defaultExpanded: true,
  content: () => <LumaWeaveGraphTile />,
});
```

**Layout note:** Width 380px fits the header pill + badge row without overflow at standard type scale; height 460px fits header + three main sections + footer at default expansion. Both are starting hints to the compositor; users resize via grippable edges.

---

## §7 — Cross-tile relationships

### Cerebra Signal Feed (`cerebra-signal-feed`)

**Relationship type:** causation arc / click navigation

**Description:** Cerebra emits `GraphSnapshotAvailable` events; when LumaWeave's receive path is built (S-031, future), LumaWeave will emit `SourceLoaded` events with `causation_id = <GraphSnapshotAvailable hub event.id>`. This creates a hub-traversable causation chain linking the two tiles:

- Lattica's event feed for LumaWeave shows a `SourceLoaded` row with a causation link
- The causation link points directly to a hub `GraphSnapshotAvailable` event (Case-2: both events are on the hub; no cross-store query needed)
- Clicking the causation link may navigate to or highlight the corresponding row in the Cerebra Signal Feed tile

**Current state:** Deferred. Blockers, specifically:
- LumaWeave's automated S-031 receive path is not yet complete — adapter layer (`cerebraSnapshotAdapter.ts`) is registered; remaining: hub store subscription (Rust background task on `cerebra/graph/**`), causation_id plumbing through `lw_emit_source_loaded`, and frontend GSA event handler
- LumaWeave's relay agent (`lumaweave-relay.py`) is not live (SourceLoaded events don't reach hub)
- `cerebra-relay.py` is **NOT** a blocker — GSA events are hub-direct; Cerebra's `_emit_snapshot_available()` is now implemented and live (CORE.md §9.6; Cerebra §3 Source D)

No events have causation_id set at this time.

### All other tiles

No shared live state subscriptions or click-navigation relationships with other tiles at this time.

---

## §8 — P-013 authorship intent

### Renderer files (LumaWeave authors)

```
src/renderers/lumaweave/SourceLoadedRenderer.tsx
src/renderers/lumaweave/SourceLoadedRenderer.css
src/renderers/lumaweave/SourceLoadFailedRenderer.tsx
src/renderers/lumaweave/SourceLoadFailedRenderer.css
src/renderers/lumaweave/SourceSwitchedRenderer.tsx
src/renderers/lumaweave/SourceSwitchedRenderer.css
src/renderers/lumaweave/GraphLayoutSettledRenderer.tsx
src/renderers/lumaweave/GraphLayoutSettledRenderer.css
```

### Tile component (LumaWeave authors)

```
src/tiles/lumaweave/LumaWeaveGraphTile.tsx
src/tiles/lumaweave/LumaWeaveGraphTile.css
```

### Naming conventions

- Component files: PascalCase (e.g., `LumaWeaveGraphTile.tsx`, `SourceLoadedRenderer.tsx`)
- CSS companion: same base name + `.css`
- CSS class prefix: `lw-graph-tile__` for tile component; `lw-renderer-source-loaded__` etc. for renderer components
- Renderer components export a named function matching the file name

### registerPayloadRenderer calls (to be added to `src/registrations.tsx`)

```typescript
registerPayloadRenderer({
  project: "lumaweave",
  event_type: "SourceLoaded",
  component: SourceLoadedRenderer,
  label: "LumaWeave — Source Loaded",
  stream_glob: "lumaweave/**",
});

registerPayloadRenderer({
  project: "lumaweave",
  event_type: "SourceLoadFailed",
  component: SourceLoadFailedRenderer,
  label: "LumaWeave — Source Load Failed",
  stream_glob: "lumaweave/**",
});

registerPayloadRenderer({
  project: "lumaweave",
  event_type: "SourceSwitched",
  component: SourceSwitchedRenderer,
  label: "LumaWeave — Source Switched",
  stream_glob: "lumaweave/**",
});

registerPayloadRenderer({
  project: "lumaweave",
  event_type: "GraphLayoutSettled",
  component: GraphLayoutSettledRenderer,
  label: "LumaWeave — Graph Layout Settled",
  stream_glob: "lumaweave/**",
});
```

### Lattica-authored

Lattica wires the `tileSectionRegistry.register` call and adds the imports to `registrations.tsx` when the compositor lands. LumaWeave provides the component; Lattica handles the entry point wiring.

---

## §9 — Open items

1. **indexed_tags missing from events.rs (needs-wiring.md items 1–3).** `SourceLoaded`, `SourceLoadFailed`, and `SourceSwitched` currently emit with `indexed_tags = None` (the `..Append::default()` spread omits them). `GraphLayoutSettled` also lacks `dialect_id` in its command signature and payload. Until this ships: `active_dialect_chip` will show `no-data-yet` even when a `GraphLayoutSettled` event arrives (no `indexed_tags.dialect_id` to read); `adapter_label` / `source_key_label` will read from payload fields instead of indexed_tags (payload fields ARE present; indexed_tags are an additional filter optimization). The tile reads from payload for current-state elements — the missing indexed_tags are a relay-side filter concern, not a tile rendering blocker.

2. **Relay agent not yet written.** Hub store carries zero LumaWeave events until `lumaweave-relay.py` ships. All Source A LiveValue bindings start in `pre-relay` state. Cold-start `read_range` returns empty. Tile shows pre-relay treatment for all data-bound elements from first render until relay is live.

3. **GraphLayoutSettled frontend mount point deferred.** The `lw_emit_graph_layout_settled` Tauri command exists but has no call site in the frontend — gwells has no convergence detection signal yet (v0.1.5; `GWRuntimeState` lacks a "settled" variant). The `settle_state_indicator` element and `layout_settle_time_label` will remain in `wiring-incomplete` state until gwells adds convergence detection. This is a LumaWeave-internal prerequisite; does not affect other elements.

4. **Cold-start `read_range` returns empty until relay ships.** The cold-start pattern (read_range + subscribe) is correctly specified; it will return no events until the relay agent has relayed at least one event to the hub. After relay goes live, the cold-start pattern correctly seeds current state from hub history. No change to the binding spec needed; this is a timeline note.

5. **SourceSwitched `from_adapter_id` in payload only.** The `SourceSwitched` payload carries both `from_adapter_id` and `to_adapter_id`. The `SourceSwitchedRenderer` will display both. `indexed_tags.to_adapter_id` is missing (needs-wiring.md item 1); this affects only hub-side filter queries, not tile rendering.

6. **Relay agent path expansion (CORE.md §9.4).** Python's `Store.open()` does NOT expand `~` — the tilde is passed as a literal path component and the open fails. When `lumaweave-relay.py` is authored, it must expand all store paths before passing them to `RelayConfig` and `Store.open()`:
   ```python
   import os
   hub = os.path.expanduser("~/.lattica/fossic/store.db")
   local = os.path.expanduser("<project_root>/.lumaweave/fossic.db")
   cfg = RelayConfig(local_store_path=local, hub_store_path=hub, ...)
   ```
   The federation_design.md relay config block shows tilde paths — those must be expanded at runtime. This is a relay agent authoring concern, not a tile concern; the Lattica tile uses Rust, where path handling differs.

7. **Project registry path discrepancy (raise to Lattica).** CORE.md §6.2 shows the example registry entry for LumaWeave as `"lumaweave": "~/.local/share/lumaweave/fossic.db"`. This path is incorrect. LumaWeave's actual local store is `<project_root>/.lumaweave/fossic.db` (events.rs:34-35), where project_root is the Tauri app's data directory — not `~/.local/share/lumaweave/`. The correct absolute path depends on the installation and must be supplied by the developer when creating `~/.lattica/project-registry.json`. Lattica should correct §6.2 to use a placeholder that makes the project-root-relative nature clear, rather than a `~/.local/share` path that implies a fixed XDG location LumaWeave does not use.

---

*End of LumaWeave tile_spec.md*

---

## policy-scout — policy_scout_tile_spec

---
project: policy-scout
document: tile_spec
round: federation_visual_round_2026-06-17
status: filed
authored_by: policy-scout
---

# Policy Scout — Tile Specification

Federation visual round · 2026-06-17  
Authors: Policy Scout team (P-013 guest-author protocol)

---

## §1 Tile Identifier

| Field           | Value                        |
|-----------------|------------------------------|
| `id`            | `policy-scout-governance`    |
| `label`         | `"Policy Scout"`             |
| Component name  | `PolicyScoutTile`            |
| Source file     | `src/tiles/policy-scout/PolicyScoutTile.tsx` |
| CSS file        | `src/tiles/policy-scout/PolicyScoutTile.css` |
| Project accent  | `--project-accent-policy-scout: #cf0a5c` (crimson) |
| Category        | `right-panel`                |

The tile surfaces Policy Scout's governance posture (lockdown/watch status) and
per-request decision history. It does **not** embed the full Policy Scout UI — it
is a read-mostly status panel with targeted action affordances for pending
approvals.

---

## §2 Visible Elements

### 2.1 Header bar

A single-row banner using the project accent as a left border accent (4 px).

- Left: label "Policy Scout" in tile heading style.
- Right: a compact `LiveValue` status chip — one chip for Track A (CLI), one chip
  for Track B (fossic hub). Both chips render their `ErrorReason` independently.
  See §4 for state rendering rules.

### 2.2 Posture strip

A two-cell horizontal strip immediately below the header. Each cell is a pill
badge.

**Lockdown cell**

Source: Track A (`ps_lockdown_status` Tauri command).

| Condition        | Badge text      | Color                            |
|------------------|-----------------|----------------------------------|
| active = true    | `⬤ LOCKDOWN`    | `--project-accent-policy-scout`  |
| active = false   | `○ Unlocked`    | `--portfolio-text-secondary`     |
| error state      | `— Lockdown ?`  | `--lv-source-unreachable`        |

When lockdown is active and `payload.reason` is non-empty, the badge becomes a
tooltip trigger showing the reason string on hover (max 200 chars, clipped).

**Watch daemon cell**

Source: Track A (`ps_watch_status` Tauri command).

| `running` | `stale` | Badge text          | Color                            |
|-----------|---------|---------------------|----------------------------------|
| true      | —       | `⬤ Watch running`   | `--portfolio-color-success`      |
| false     | true    | `⚠ Watch stale`     | `--lv-data-stale`                |
| false     | false   | `○ Watch stopped`   | `--portfolio-text-secondary`     |
| error     | —       | `— Watch ?`         | `--lv-source-unreachable`        |

### 2.3 Pending approvals panel

Source: Track A (`ps_approvals_list` Tauri command filtered to `status = "pending"`).

Shows up to 5 pending approvals in a scrollable list. Each row:

```
┌─────────────────────────────────────────────────────┐
│ [risk_band chip]  command (truncated to 48 chars)   │
│ score: {risk_score}  expires: {expires_at relative} │
│                               [Approve] [Deny]      │
└─────────────────────────────────────────────────────┘
```

Risk band chip colors (local to tile, not a shared token):

| `risk_band`   | Background               | Text    |
|---------------|--------------------------|---------|
| `critical`    | `#b91c1c`                | white   |
| `high`        | `#c97b00`                | white   |
| `medium`      | `#b45309`                | white   |
| `low`         | `#166534`                | white   |
| `none`        | `--portfolio-surface`    | inherit |

`expires_at` is an ISO-8601 string; render as a relative duration ("in 4 h",
"expired 2 min ago"). Expired pending approvals render the expires label in
`--lv-source-unreachable` (amber) to signal urgency.

When there are no pending approvals: render a single muted line "No pending
approvals" inside the panel — do not collapse the panel.

When Track A is in error: render panel with `--lv-source-unreachable` background
tint and the error kind label ("CLI unreachable").

### 2.4 Recent decisions list

Source: Track B fossic hub stream `policy-scout/audit/**` — event type
`DecisionIssued`. Falls back to Track A (`ps_approvals_list` decisions) when
Track B is pre-relay.

Shows the last 10 DecisionIssued events in reverse-chronological order.

Each row:

```
┌─────────────────────────────────────────────────────┐
│ [DENY] rm -rf /tmp/build                            │
│        risk: 87  ·  critical  ·  2 reasons          │
└─────────────────────────────────────────────────────┘
```

Decision badge:

| `payload.decision`        | Text     | Color                          |
|---------------------------|----------|--------------------------------|
| `deny` / `deny_and_alert` | `DENY`   | `--project-accent-policy-scout` |
| `allow`                   | `ALLOW`  | `--portfolio-color-success`     |
| `approve_required`        | `HOLD`   | `--lv-data-stale`              |
| other                     | text     | `--portfolio-text-secondary`   |

`payload.command` truncated to 44 chars. `payload.reasons` count shown as "N
reasons"; clicking expands an inline list of the reason strings (collapse on
second click).

When Track B is pre-relay (see §4.2): the panel renders a `pre-relay` chip
using `--lv-pre-relay` (steel blue) in the section header — NOT an error color.
Rows are populated from Track A approval history instead. A one-line note reads
"Fossic feed pending relay — showing CLI history."

### 2.5 Track B event feed

Source: Track B fossic hub streams `policy-scout/audit/**` and
`policy-scout/posture`. Visible only when Track B is live.

A compact scrolling feed of the last 20 events across both streams. Each row
renders via the registered payload renderer for its event type (see §8.3). Falls
back to JSON pretty-print for unregistered types (per ADR-017).

When Track B is pre-relay: this panel is hidden entirely — it does not render a
skeleton or placeholder. The pending approvals panel (§2.3) and recent decisions
list (§2.4) together occupy the full tile height.

### 2.6 Action bar

A small row of contextual buttons at the tile bottom.

| Button              | Enabled when            | Tauri command         |
|---------------------|-------------------------|-----------------------|
| "Activate lockdown" | lockdown active = false | `activate_lockdown`   |
| "Deactivate"        | lockdown active = true  | `deactivate_lockdown` |
| "Restart watch"     | always                  | `restart_watch`       |

"Activate lockdown" opens a small inline text input for an optional reason string
(max 200 chars) before invoking the command. The reason value is passed as
`{ reason }` to `activate_lockdown`. Empty string → omit the field.

All three Tauri commands are already implemented in Lattica's `src-tauri/src/lib.rs`.

---

## §3 Token Bindings

### 3.1 Project accent

```css
border-left: 4px solid var(--project-accent-policy-scout);
/* Header bar accent stripe */
```

Active lockdown badge background: `var(--project-accent-policy-scout)`.

### 3.2 LiveValue error-state tokens

From `src/styles/live-value-tokens.css`:

| Token                     | Hex        | Usage in this tile                         |
|---------------------------|------------|--------------------------------------------|
| `--lv-pre-relay`          | `#4a7a9b`  | Track B pre-relay chip; pending feed note  |
| `--lv-no-data-yet`        | `#4a5568`  | First-load skeleton shimmer (Track A + B)  |
| `--lv-source-unreachable` | `#e0a800`  | CLI binary absent; expired approval label  |
| `--lv-data-stale`         | `#c97b00`  | Watch stale badge; HOLD decision badge     |
| `--lv-wiring-incomplete`  | `#9b59b6`  | Dev-only: fossic registry missing          |
| `--lv-subscription-closed`| `#e05c5c`  | fossic subscription dropped; reconnecting  |

### 3.3 Portfolio-level shared tokens

The tile uses these tokens but does not define them:

- `--portfolio-color-success` — watch running badge, ALLOW decision badge
- `--portfolio-text-secondary` — idle/inactive badge labels (`#a28fc0`)
- `--portfolio-surface` — "none" risk band chip background (no `--portfolio-color-muted` token exists; `--portfolio-surface` is the closest available)
- `--portfolio-color-warning` — maps to `--lv-source-unreachable` via `var()`
- `--portfolio-color-danger` — maps to `--lv-subscription-closed` via `var()`

### 3.4 Risk band colors

Defined locally in `PolicyScoutTile.css` as CSS custom properties scoped to
`.policy-scout-tile`. These are not registered in the global token sheet — they
are internal layout concerns.

```css
.policy-scout-tile {
  --ps-risk-critical: #b91c1c;
  --ps-risk-high:     #c97b00;
  --ps-risk-medium:   #b45309;
  --ps-risk-low:      #166534;
}
```

---

## §4 Visual States

### 4.1 Track A — CLI data states

Track A is polled via Tauri commands on a 10-second interval. Each data
category (`lockdown`, `watch`, `approvals`) has an independent `LiveValue<T>`.

| State                | Trigger                                     | Rendering behavior                       |
|----------------------|---------------------------------------------|------------------------------------------|
| `no-data-yet`        | First render before first poll completes    | Shimmer skeleton using `--lv-no-data-yet`|
| `live`               | Tauri command returned successfully         | Normal rendering (§2.2–2.3)              |
| `source-unreachable` | Tauri command exit nonzero or threw         | Amber tint + error chip in panel header  |
| `data-stale`         | >30 s since last successful response        | `--lv-data-stale` chip; data still shown |

Track A polling is gated on Lattica being open. If the user closes the tile,
polling stops. It resumes on tile re-expand.

### 4.2 Track B — fossic hub states

Track B uses the fossic cold-start pattern: `fossic_read_range()` for snapshot
then `fossic_subscribe()` from-now for incremental. Each stream is subscribed
independently.

| State                 | Trigger                                         | Rendering behavior                              |
|-----------------------|-------------------------------------------------|-------------------------------------------------|
| `pre-relay`           | `policy-scout-relay.py` not yet shipped         | Steel blue chip in §2.4 header; feed hidden     |
| `wiring-incomplete`   | `~/.lattica/project-registry.json` absent       | Purple chip (dev mode); feed hidden             |
| `no-data-yet`         | Subscribed but no events received yet           | Shimmer on §2.5 feed rows                       |
| `live`                | Events flowing from hub                         | Normal rendering (§2.4–2.5)                     |
| `source-unreachable`  | Fossic store not found at registry path         | Amber chip in §2.4 header                       |
| `subscription-closed` | `fossic_unsubscribe` fired or Tauri restart     | Red reconnect chip; tile auto-retries after 5 s |

**Critical:** `pre-relay` must use `--lv-pre-relay` (steel blue), not any error
color. It is an expected transition state, not a failure. The feed is simply
absent until the relay agent ships.

### 4.3 Compound states

Both tracks are independently live-valued. The tile header's two status chips
reflect this: Track A chip and Track B chip render separately. A tile can be
`Track A: live / Track B: pre-relay` — the normal expected state at federation
visual round launch.

The tile is considered "degraded but usable" when Track A is live and Track B is
pre-relay. Full fidelity requires both tracks live.

---

## §5 Interaction Surfaces

### 5.1 Approve Once

Trigger: "Approve" button in a pending approval row (§2.3).  
Tauri command: `ps_approve_once(approval_id: string) → CliJsonResponse`  
Status: **not yet added to lib.rs** (open item §9.1).

On success: the row transitions to a "Approved" confirmation state for 2 s then
disappears from the list. The `ps_approvals_list` poll fires immediately after
success to refresh the list.

On error: inline error message replaces the button row for 5 s.

The "Approve" button is disabled while its request is in-flight to prevent
double-submit.

### 5.2 Deny

Trigger: "Deny" button in a pending approval row (§2.3).  
Tauri command: `ps_deny(approval_id: string) → CliJsonResponse`  
Status: **not yet added to lib.rs** (open item §9.1).

Same flow as Approve Once above, with "Denied" confirmation text.

### 5.3 Activate Lockdown

Trigger: "Activate lockdown" button in the action bar (§2.6).  
Tauri command: `activate_lockdown(reason?: string) → CliJsonResponse`  
Status: **already implemented** in lib.rs.

On click: an inline text field appears directly beneath the button for an
optional reason string (max 200 chars, enforced client-side). A "Confirm" button
submits. Pressing Escape or clicking outside cancels without submitting.

On success: posture strip (§2.2) lockdown cell transitions to active state. Track
A poll fires immediately.

On error: inline error below the button for 5 s.

### 5.4 Deactivate Lockdown

Trigger: "Deactivate" button in the action bar (§2.6).  
Tauri command: `deactivate_lockdown() → CliJsonResponse`  
Status: **already implemented** in lib.rs.

No confirmation prompt (lockdown deactivation is low-risk relative to
activation). Transitions posture strip on success.

### 5.5 Restart Watch

Trigger: "Restart watch" button in the action bar (§2.6).  
Tauri command: `restart_watch() → CliJsonResponse`  
Status: **already implemented** in lib.rs.

The button shows a spinner while the Tauri call is in-flight. On success:
watch daemon cell transitions to "running" (after the next Track A poll confirms
the new PID).

### 5.6 Expand/Collapse reason list

Trigger: clicking a decision row in §2.4 that has `reasons.length > 0`.  
No Tauri call. Inline state toggle (`useState`). Only one row expanded at a time.

### 5.7 No keyboard actions required

This spec does not mandate keyboard shortcuts beyond standard focus/tab order.
Accessibility baseline (ARIA labels on all buttons, role="list" on scrollable
panels) is the P-013 author's responsibility.

---

## §6 Tile Registration Shape

The following registration snippet is authored by Policy Scout and placed in
`src/registrations.tsx` by the Lattica maintainer (P-013 §3 procedure).

```typescript
import { PolicyScoutTile } from "./tiles/policy-scout/PolicyScoutTile";

tileSectionRegistry.register({
  id: "policy-scout-governance",
  label: "Policy Scout",
  category: "right-panel",
  defaultWidth: 440,
  defaultHeight: 480,
  collapsible: true,
  defaultVisible: true,
  defaultExpanded: true,
  content: () => <PolicyScoutTile />,
});
```

Payload renderers are registered separately via `registerPayloadRenderer` (see
§8.3).

---

## §7 Cross-Tile Relationships

### 7.1 Causation arc to Cerebra tile

**Intent:** when a DecisionIssued event has a non-null
`payload.upstream_causation_id`, the tile offers a link that deep-links to the
originating Cerebra event in the Cerebra signal-feed tile.

**Part 1 — Provenance (iter-4 eligible once blockers clear):**
`fossic_query_remote_store("cerebra", upstream_causation_id)` — Tauri command
already implemented in `src-tauri/src/lib.rs`. Returns `SerializedEvent | null`.
On success, the origin event payload is shown inline within the PS tile. No
Cerebra tile participation required. Deferred until both blockers below clear.

**Part 2 — Navigate (iter-5+):**
After a successful provenance read, emit `tile:focus-event` for the Cerebra tile
to scroll to and highlight the matching event. Deferred to iter-5+ per developer
decision (§9.7). No cross-tile `tile:focus-event` protocol is in scope for iter-4.

**Blockers for Part 1:**

1. **CP-PS-4**: `policy-scout-relay.py` not yet shipped. DecisionIssued events
   from Policy Scout are not yet flowing through the fossic hub. The
   `upstream_causation_id` field on hub-visible DecisionIssued events is the
   carrier, but no hub events exist yet.

2. **CP-PS-6**: `upstream_causation_id` is not yet populated in the PS Python
   codebase. The field is defined and exempted from redaction in `redaction.py`
   (`_EXEMPT_KEYS = frozenset({"upstream_causation_id"})`), but no code path yet
   writes a value into it. Population requires Cerebra to pass its
   ActionProposed ID through the hook invocation call, and PS CLI to store it
   in the request context and propagate it through the event factories.

**Rendering:** Both parts are hidden from the tile UI until CP-PS-4 and CP-PS-6
clear. Once both blockers resolve, Part 1 (provenance display inline) silently
becomes available. Part 2 (scroll-and-highlight) remains deferred to iter-5+
regardless of blocker status.

### 7.2 No relationships to LumaWeave or ai-stack tiles

Policy Scout governance data is structurally independent of LumaWeave graph
nodes and ai-stack service topology. No cross-tile links or shared state stores
are planned for this round.

### 7.3 Read-only relationship to Fossic tile

The Fossic tile (if present) may display raw stream contents of
`policy-scout/audit/**` and `policy-scout/posture`. This is incidental — Policy
Scout has no API contract with the Fossic tile and does not need to coordinate
with it on stream layout.

---

## §8 P-013 Authorship Intent

Under the guest-author protocol, Policy Scout authors the following files in
Lattica's tree. Lattica registers them. All files below are new — none exist yet.

### 8.1 Tile component

```
src/tiles/policy-scout/PolicyScoutTile.tsx
src/tiles/policy-scout/PolicyScoutTile.css
```

`PolicyScoutTile.tsx` owns:
- Both `LiveValue<T>` tracks (Track A: Tauri polling; Track B: fossic subscribe)
- Posture strip (§2.2)
- Pending approvals panel (§2.3)
- Recent decisions list (§2.4)
- Track B event feed (§2.5) — shown only when Track B is live
- Action bar (§2.6)
- State dispatch for `pre-relay` / error conditions

Implementation pattern follows `CerebraSignalTile.tsx` for Track B
(`fossic_subscribe` + `listen("fossic:event")`), and `AiStackTopologyTile.tsx`
for Track A (interval polling + `useState`).

### 8.2 Payload renderers

Four renderers. Each is one `{project, event_type}` pair per ADR-017. Unknown
event types fall through to the JSON pretty-print renderer built into the Lattica
renderer harness.

```
src/renderers/policy-scout/DecisionIssuedRenderer.tsx
src/renderers/policy-scout/DecisionIssuedRenderer.css

src/renderers/policy-scout/ApprovalRequestedRenderer.tsx
src/renderers/policy-scout/ApprovalRequestedRenderer.css

src/renderers/policy-scout/LockdownActivatedRenderer.tsx
src/renderers/policy-scout/LockdownActivatedRenderer.css

src/renderers/policy-scout/LockdownDeactivatedRenderer.tsx
src/renderers/policy-scout/LockdownDeactivatedRenderer.css
```

**DecisionIssuedRenderer** (`PayloadRendererProps`):

```typescript
// payload shape: { decision, risk_score, risk_band, reasons: string[] }
// Renders: decision badge + risk_score + risk_band chip + reasons list
```

**ApprovalRequestedRenderer** (`PayloadRendererProps`):

```typescript
// payload shape: { approval_id, command }
// Renders: command text + approval_id (truncated) + "awaiting decision" label
```

**LockdownActivatedRenderer** (`PayloadRendererProps`):

```typescript
// payload shape: { reason }
// Renders: "LOCKDOWN ACTIVATED" label in --project-accent-policy-scout
//          + reason string (or "no reason given" if absent)
```

**LockdownDeactivatedRenderer** (`PayloadRendererProps`):

```typescript
// payload shape: { cleared_by }
// Renders: "Lockdown cleared" label + cleared_by identity
```

### 8.3 Registration snippet for renderers

Policy Scout provides this snippet; Lattica inserts it into
`src/registrations.tsx` alongside the tile registration:

```typescript
import { DecisionIssuedRenderer }    from "./renderers/policy-scout/DecisionIssuedRenderer";
import { ApprovalRequestedRenderer } from "./renderers/policy-scout/ApprovalRequestedRenderer";
import { LockdownActivatedRenderer } from "./renderers/policy-scout/LockdownActivatedRenderer";
import { LockdownDeactivatedRenderer } from "./renderers/policy-scout/LockdownDeactivatedRenderer";

registerPayloadRenderer({ project: "policy-scout", event_type: "DecisionIssued",      component: DecisionIssuedRenderer,     label: "Policy Scout — Decision Issued",      stream_glob: "policy-scout/audit/**" });
registerPayloadRenderer({ project: "policy-scout", event_type: "ApprovalRequested",   component: ApprovalRequestedRenderer,  label: "Policy Scout — Approval Requested",   stream_glob: "policy-scout/audit/**" });
registerPayloadRenderer({ project: "policy-scout", event_type: "LockdownActivated",   component: LockdownActivatedRenderer,  label: "Policy Scout — Lockdown Activated",   stream_glob: "policy-scout/posture" });
registerPayloadRenderer({ project: "policy-scout", event_type: "LockdownDeactivated", component: LockdownDeactivatedRenderer, label: "Policy Scout — Lockdown Deactivated", stream_glob: "policy-scout/posture" });
```

Event types not listed above (`CommandRequested`, `CommandParsed`,
`CommandClassified`, `ApprovalApprovedOnce`, `ApprovalDeniedOnce`,
`WatchDaemonStarted`, `WatchDaemonStopped`) fall through to the JSON
pretty-print renderer. These event types carry low visual density and do not
warrant custom renderers in this round.

### 8.4 Track A Tauri command signatures (PS proposes, Lattica decides)

The following commands need to be added to `lib.rs`. Policy Scout proposes these
signatures; Lattica reviews before adding to `src-tauri/src/lib.rs`.

```rust
#[tauri::command]
fn ps_lockdown_status() -> CliJsonResponse {
    // policy-scout lockdown status --json
    // Returns: { ok, active: bool, reason?: string }
}

#[tauri::command]
fn ps_watch_status() -> Result<WatchStatusResponse, String> {
    // policy-scout watch status --json
    // Returns: { running: bool, pid?: number, stale?: bool, pid_file: string }
    // No `ok` field — use WatchStatusResponse, not CliJsonResponse (see §9.5)
}

#[tauri::command]
fn ps_approvals_list() -> ApprovalsListResponse {
    // policy-scout approvals list --json
    // Returns: { approvals: ApprovalItem[] }
}

#[tauri::command]
fn ps_approve_once(approval_id: String) -> CliJsonResponse {
    // policy-scout approvals approve <id> --json
}

#[tauri::command]
fn ps_deny(approval_id: String) -> CliJsonResponse {
    // policy-scout approvals deny <id> --json
}
```

`CliJsonResponse` is the existing struct in lib.rs. Three new structs needed
(CORE.md §8.2): `ApprovalItem`, `ApprovalsListResponse`, `WatchStatusResponse`.

```rust
#[derive(serde::Serialize, serde::Deserialize)]
struct ApprovalItem {
    approval_id: String,
    command: String,
    cwd: String,
    risk_score: f64,
    decision: String,
    reasons: Vec<String>,
    expires_at: Option<String>,    // ISO-8601
    recommended_action: String,
    scope: String,
    status: String,
}

#[derive(serde::Serialize)]
struct ApprovalsListResponse {
    approvals: Vec<ApprovalItem>,
}

#[derive(serde::Serialize)]
struct WatchStatusResponse {
    running: bool,
    pid: Option<u32>,
    stale: Option<bool>,
    pid_file: String,
}
```

---

## §9 Open Items

### 9.1 Missing Tauri commands (blocking Track A beyond lockdown/watch)

`ps_lockdown_status`, `ps_watch_status`, `ps_approvals_list`, `ps_approve_once`,
`ps_deny` are not yet in lib.rs.

`activate_lockdown`, `deactivate_lockdown`, and `restart_watch` **are** already
implemented — §5.3–5.5 can be built now.

`ps_lockdown_status` and `ps_watch_status` are thin wrappers over the existing
`run_cli_json()` helper pattern. `ps_approvals_list` requires a typed response
struct (§8.4). `ps_approve_once` and `ps_deny` need the `approvals approve <id>`
and `approvals deny <id>` CLI subcommands confirmed to accept `--json`.

**Resolution path:** Lattica adds the five commands to lib.rs after reviewing
§8.4 proposed signatures. PS confirms CLI flag compatibility. No new packages
required.

### 9.2 upstream_causation_id not yet populated (CP-PS-6)

`upstream_causation_id` is defined and redaction-exempted in `redaction.py`.
Population requires a separate pass: Cerebra passes its ActionProposed event ID
through the hook invocation; PS CLI captures it in the request context; event
factories propagate it. This is a multi-project coordination item.

Affects: §7.1 causation arc. Not blocking visual round launch.

### 9.3 policy-scout-relay.py not yet shipped (CP-PS-4)

Blocks Track B entirely (§4.2). The relay filter logic is fully defined
(relay_filter, _should_relay, event.payload()-only pattern) and is unblocked —
it can be implemented in a separate PS pass. Not blocking visual round launch;
the tile degrades gracefully to Track A + pre-relay chip.

**Path expansion note (CORE.md §9.4):** When authoring `policy-scout-relay.py`,
all fossic store paths passed to `RelayConfig` and `Store.open()` must use
`os.path.expanduser()`. Python's `Store.open()` does NOT expand `~` — the pyo3
binding passes the string directly to Rust `Path::from()`, which treats `~` as a
literal path component. Example:
```python
import os
hub  = os.path.expanduser("~/.lattica/fossic/store.db")
local = os.path.expanduser("~/.config/policy-scout/.fossic/store.db")
cfg  = RelayConfig(local_store_path=local, hub_store_path=hub, ...)
```

### 9.4 ~/.lattica/project-registry.json does not exist

`fossic_query_remote_store` reads `~/.lattica/project-registry.json` to find the
PS vault path. This file is not yet written. When Track B eventually goes live,
the registry must contain a `"policy-scout"` key pointing to the PS fossic vault
path. CORE.md §6.2 shows the expected entry:

```json
{ "projects": { "policy-scout": "~/.config/policy-scout/.fossic/store.db" } }
```

The tilde is expanded by Lattica's `expand_tilde()` at the Tauri boundary — the
registry entry may use `~/` syntax. The actual absolute path depends on the PS
installation location; developer confirms when creating the file.

### 9.5 watch status --json output shape

`daemon_status()` returns `{running, pid, stale?, pid_file}`. No `ok` field.
This means the `ps_watch_status` Tauri command needs to wrap the output in a
compatible shape or use a separate response type rather than `CliJsonResponse`.
PS will handle this in the lib.rs PR.

### 9.6 approvals deny CLI subcommand — flag confirmation needed

The `approvals approve <id> --json` path exists. The `approvals deny <id>` path
needs confirmation that it also accepts `--json` and returns a compatible JSON
response. To be verified before `ps_deny` command is wired.

### 9.7 tile:focus-event protocol — deferred to iter-5+

**Developer decision applied (Stage 2):** Both tiles (Policy Scout and Cerebra)
work independently for iter-4. The causation arc deep-link is deferred to iter-5+.
No cross-tile `tile:focus-event` protocol is in scope for this round.

The `fossic_query_remote_store` lookup (§7.1) remains specced and may be used for
read-only provenance display (showing the origin payload inline) without requiring
Cerebra tile to participate. The scroll-and-highlight interaction across tile
boundaries is the deferred part. No unilateral changes to Cerebra tile by Policy
Scout in iter-4.

### 9.8 ReadQuery glob support unconfirmed — audit stream cold-start

CORE.md §9.5 flags that `ReadQuery` glob support is unconfirmed. Whether
`read_range(ReadQuery("policy-scout/audit/**"))` works is not yet verified — the
glob matching in `subscribe()` lives in the Rust subscription registry; `read_range`
uses a separate query path.

**Impact:** The recent decisions list (§2.4) cold-start would need to read from
`policy-scout/audit/**` — a glob over per-request streams with unknown names.
`policy-scout/posture` cold-start is an exact stream name and is safe.

**Safe pattern until confirmed:** for the recent decisions cold-start, skip the
`read_range` glob and show from-now events only (no pre-load of historical
decisions). The posture cold-start (`read_range(ReadQuery("policy-scout/posture"))`)
is unaffected. When ReadQuery glob support is confirmed, the audit cold-start can
be added.

---

## ai-stack — aistack_tile_spec

# ai-stack Tile Specification
## Federation Visual Round — 2026-06-17

**Authored by:** ai-stack-claude
**Round:** Stage 1a — tile spec authoring; Stage 2 corrections applied 2026-06-17
**Target iteration:** iter-4 (claude-design next pass)

---

## §1 — Tile identifier and current state

### AiStackTopologyTile

| Field | Value |
|---|---|
| **Tile name** | AiStackTopologyTile |
| **Registration id** | `ai-stack-topology` |
| **Label** | "AI Stack Topology" |
| **File path** | `src/tiles/ai-stack/AiStackTopologyTile.tsx` |
| **CSS companion** | `src/tiles/ai-stack/AiStackTopologyTile.css` |
| **Current state** | Built — Phase 1 fully live |
| **Authoring model** | P-013: ai-stack authors tile + renderer files; Lattica commits into tree |
| **Project accent** | `--project-accent-ai-stack: #0d979e` (teal) |

**Phase 1 status (all elements live):**

Full HTTP polling at 10s interval across five endpoints:
- Ollama `/api/ps` — running models + VRAM usage
- Ollama `/api/tags` — locally available models
- LiteLLM `/v1/models` — alias list
- Open WebUI `HEAD /` — reachability
- Cerebra daemon `GET /status` — BO node (wired Wave 7 post-federation)

VRAM bar, model load/unload actions, topology view, list view, alias chip
panel, and dormant-alias toggle are all functional. `vramWarnPct` default
in the tile UI is 90 (user-configurable via slider, range 50–95 step 5),
aligned with `VRAM_WARN_PCT_THRESHOLD = 90` in `fossic_sidecar.py` per
CP-C-6 and the foundation pass fix to `AiStackTopologyTile.tsx`.

**Phase 2 status (deferred — pre-relay):**

Phase 2 migrates VRAM bar and model list from HTTP polling to hub fossic
subscription. Blocked on `ai-stack-relay.py` running live (agent authored;
not yet started) and `~/.lattica/project-registry.json` being populated. All Phase 2 elements
declare `LiveValue` state `pre-relay` until the relay agent is live.

---

## §2 — Visible elements (canonical enumeration)

### Header

| Element | Description |
|---|---|
| `stack_status_dot` | Aggregate status indicator (up/down/unknown) derived from Ollama + LiteLLM states |
| `tile_title` | Static label "AI STACK" |
| `models_loaded_badge` | "N LOADED" count badge; visible only when models are in VRAM |
| `idle_badge` | "IDLE" badge; visible when Ollama is up but no models loaded |
| `view_toggle_pill` | "TOPO" / "LIST" toggle pill; persisted to localStorage |
| `dormant_toggle_pill` | "DORMANT" toggle pill; shows/hides dormant alias edges; persisted |
| `polling_spinner` | Spinner visible during active HTTP poll cycle |

### VRAM Section

| Element | Description |
|---|---|
| `vram_bar_track` | Full-width fill bar; width proportional to used / total VRAM |
| `vram_bar_fill` | Fill segment; changes to warn color (`--lv-source-unreachable` amber) when `usedPct >= vramWarnPct` |
| `vram_label_text` | Monospace text: "N MB / 12282 MB (N%)" |
| `vram_pct_text` | Percentage suffix in warn color when threshold exceeded |
| `vram_warn_slider` | Range input 50–95% step 5; sets `vramWarnPct`; persisted |
| `vram_warn_label` | Current warn threshold percentage readout |
| `gpu_total_input` | Number input for `vramTotalMb` override; persisted; fallback if Ollama doesn't report total |

### Topology View (topo mode)

| Element | Description |
|---|---|
| `bo_node_card` | BO node; status from Cerebra daemon HTTP at `:7432/status` |
| `alias_edge_row` | One row per alias in `TOPOLOGY_ALIASES` ("bot-local", "bot-escalated"); labeled with alias name and arrow |
| `dormant_alias_edge` | `bot-escalated` edge; styled as dormant; hidden when dormant toggle is off |
| `awaiting_aliases_placeholder` | Shown when LiteLLM is up but no topology aliases are in the alias list |
| `litellm_node_card` | LITELLM node with port `:4000`; alias count as detail |
| `local_edge` | Static "local →" connector from LiteLLM to Ollama |
| `ollama_node_card` | OLLAMA node with port `:11434`; running model list as child rows |
| `running_model_row` | One row per loaded model: name + VRAM size in MB |
| `no_models_detail` | "no models in VRAM" detail when Ollama up but nothing loaded |
| `openwebui_node_card` | OPEN-WEBUI node with port `:3000`; in secondary row |
| `tts_node_card` | TTS node; always "unknown" (no host port exposed) with note |

### List View (list mode)

| Element | Description |
|---|---|
| `list_table` | 5-row table: OLLAMA, LITELLM, OPEN-WEBUI, TTS, BO |
| `list_row_dot` | Status dot per row |
| `list_row_name` | Service name |
| `list_row_detail` | Port + summary detail (e.g. "N models running", "N aliases") |

### Model Actions

| Element | Description |
|---|---|
| `load_model_select` | Dropdown of locally available models; triggers Ollama warm-load on change |
| `loading_model_status` | "loading <model>…" inline text during load action |
| `unload_all_button` | "UNLOAD ALL" button; visible when models are loaded; danger style |
| `unloading_status` | "UNLOADING…" text during unload |
| `action_error_banner` | Error message from failed load/unload Ollama API call |

### Alias Panel

| Element | Description |
|---|---|
| `alias_chip_panel` | Section visible when LiteLLM alias list is non-empty |
| `alias_chip` | One chip per alias; click toggles mute in topology view; persisted |
| `alias_chip_topology_marker` | Chip gets topology CSS class when alias is in `TOPOLOGY_ALIASES` |
| `alias_chip_muted_state` | Muted style when alias is in `mutedAliases` set |

### Footer

| Element | Description |
|---|---|
| `poll_timestamp` | "polled HH:MM:SS" from `snap.lastPolled`; shown when snapshot exists |

### Phase 2 Additions (deferred — pre-relay)

| Element | Description |
|---|---|
| `vram_hub_bar` | Phase 2: VRAM bar driven by hub `VramBudgetChanged` payload instead of Ollama HTTP; replaces HTTP-backed `vram_bar_track` |
| `hub_warn_indicator` | Phase 2: "WARN" indicator backed by `indexed_tags.warn` from hub event (threshold = 90%); distinct from UI-preference warn at current slider value |
| `model_event_feed` | Phase 2: live feed of recent `ModelLoaded` / `ModelUnloaded` hub events with timestamp; supplements or replaces current running model list |
| `sidecar_status_chip` | Phase 2 (after lifecycle stream ships): "SIDECAR UP/DOWN" chip backed by `SidecarStarted`/`SidecarStopped` events on `ai-stack/lifecycle` |
| `relay_stream_badge` | Phase 2: small badge showing relay agent liveness; teal accent; `pre-relay` steel-blue when relay not yet live |

---

## §3 — Token bindings per element

### Phase 1 — HTTP polling (current)

All Phase 1 elements share a single `LiveValue<TopologySnapshot>` backed by
the 10-second `pollTopology()` cycle. The snapshot aggregates all five HTTP
endpoints in parallel (`Promise.allSettled`).

**Shared source:**

| Field | Value |
|---|---|
| `source_kind` | HTTP-poll |
| `source_detail` | Five parallel fetches (see below); result folded into `TopologySnapshot` |
| `update_frequency` | Every 10 000 ms (`POLL_MS = 10_000`) |

**Endpoint map:**

| Endpoint | JSON path | Drives elements |
|---|---|---|
| `GET http://localhost:11434/api/ps` | `response.models[*].{name, size_vram}` | `ollama` status, `runningModels`, `totalVramBytes`, `vram_bar_*`, `running_model_row`, `models_loaded_badge` |
| `GET http://localhost:11434/api/tags` | `response.models[*].{name, size}` | `load_model_select` option list |
| `GET http://localhost:4000/v1/models` | `response.data[*].id` | `litellm` status, `aliases`, `alias_chip_panel`, `alias_edge_row` |
| `HEAD http://localhost:3000` | HTTP 2xx/error | `openwebui` status, `openwebui_node_card` |
| `GET http://localhost:7432/status` | HTTP fulfilled/error | `cerebra` status → `bo_node_card`, `list_row` BO |

**Per-element bindings (Phase 1):**

| Element | Source field | Notes |
|---|---|---|
| `stack_status_dot` | derived: `ollama === "down" && litellm === "down"` → "down"; either "down" → "unknown"; else "up" | |
| `models_loaded_badge` | `snap.runningModels.length` | visible when > 0 |
| `idle_badge` | `snap.ollama === "up" && snap.runningModels.length === 0` | |
| `vram_bar_fill` width | `snap.totalVramBytes / (vramTotalMb * 1024² ) * 100` | capped at 100% |
| `vram_bar_fill` warn state | `usedPct >= vramWarnPct` (UI slider, default 90) | warn color = `--lv-source-unreachable` |
| `vram_label_text` | `fmtMb(snap.totalVramBytes)` + `vramTotalMb` + `usedPct` | |
| `bo_node_card` status | `snap.cerebra` | fulfilled = "up", rejected = "unknown" |
| `alias_edge_row` | `snap.aliases` filtered to `TOPOLOGY_ALIASES` = `{"bot-local", "bot-escalated"}` | |
| `running_model_row` | `snap.runningModels[*].{name, size_vram}` | |
| `load_model_select` | `snap.localModels[*].name` | |
| `poll_timestamp` | `snap.lastPolled` (ms since epoch) | |

**Cold-start (Phase 1):** First poll fires immediately on mount (`useEffect`
→ `runPoll()`). `snap` is `null` until first poll completes. Elements that
require `snap` render nothing or show placeholder until `snap` is non-null.
No fossic subscription involved.

---

### Phase 2 — fossic hub subscription (deferred)

Phase 2 elements are blocked on `ai-stack-relay.py` shipping. Until then,
all Phase 2 elements declare `LiveValue.state = 'pre-relay'`.

**VRAM bar (Phase 2):**

| Field | Value |
|---|---|
| `source_kind` | fossic-subscribe |
| `stream_pattern` | `ai-stack/gpu` (exact stream; no wildcard needed — single stream) |
| `event_type` | `VramBudgetChanged` |
| `payload fields` | `payload.used_bytes: int`, `payload.total_bytes: int`, `payload.pct: float`, `payload.model_vram_bytes: int`, `payload.models: [{name, size_vram}]`, `payload.sampled_at: int (ms)` |
| `indexed_tags` | `indexed_tags().warn: bool` — true when `pct >= 90` (VRAM_WARN_PCT_THRESHOLD) |
| `update_frequency` | Event-driven; emitted only when `abs(used_bytes - prev_used_bytes) >= 10 MB` |
| `hub_warn_indicator` binding | `event.indexed_tags().warn` — true/false; distinct from UI slider threshold |

**Cold-start (Phase 2 VRAM bar):**

Subscribe delivers from-now. To show current VRAM on tile open, a
cold-start `read_range(ReadQuery("ai-stack/gpu"))` is required before
subscribing. Fold the last `VramBudgetChanged` event into initial state.
Pattern per CORE.md §5.4.

**Model event feed (Phase 2):**

| Field | Value |
|---|---|
| `source_kind` | fossic-subscribe |
| `stream_pattern` | `ai-stack/models` (exact stream) |
| `event_type` | `ModelLoaded` or `ModelUnloaded` |
| `payload fields (ModelLoaded)` | `payload.model_name: str`, `payload.size_vram: int`, `payload.loaded_at: int (ms)` |
| `payload fields (ModelUnloaded)` | `payload.model_name: str`, `payload.unloaded_at: int (ms)` |
| `indexed_tags` | `indexed_tags().model_name: str` — model name string for tag-filtered queries |
| `update_frequency` | Event-driven; one event per load/unload transition |

**Cold-start (Phase 2 model list):**

`read_range(ReadQuery("ai-stack/models"))` to reconstruct current loaded
set: apply ModelLoaded/ModelUnloaded in sequence to derive present state.
Then subscribe for incremental transitions.

**Sidecar status chip (Phase 2 — lifecycle stream):**

| Field | Value |
|---|---|
| `source_kind` | fossic-subscribe |
| `stream_pattern` | `ai-stack/lifecycle` |
| `event_type` | `SidecarStarted` or `SidecarStopped` |
| `LiveValue state` | `pre-relay` — `ai-stack/lifecycle` stream is proposed; not yet implemented in `fossic_sidecar.py` (per DEP-F-1 verification: `SidecarStarted`/`SidecarStopped` absent from shipped code) |
| `update_frequency` | Event-driven; one event at sidecar start and stop |

---

## §4 — Visual states per element

### Phase 1 elements

Phase 1 elements are backed by HTTP polling. They do not use `LiveValue`
wrappers in the current implementation. States are expressed via the
`TopologySnapshot` and local React state:

| Element | States | Treatment |
|---|---|---|
| `stack_status_dot`, `bo_node_card`, `litellm_node_card`, `ollama_node_card`, `openwebui_node_card` | `up` / `down` / `unknown` | Green dot / red dot / gray dot via `aistack-dot--{status}` CSS classes |
| `vram_bar_fill` | normal / warn | Fill color; warn = `--lv-source-unreachable` amber when `usedPct >= vramWarnPct` |
| `polling_spinner` | shown during poll / hidden | `aistack-tile__spinner` |
| `poll_error_banner` | shown on HTTP failure / hidden | `aistack-error` role=alert |
| `action_error_banner` | shown on model action failure / hidden | `aistack-error` role=alert |
| `tts_node_card` | always `unknown` | No host port; static "no host port" note |

### Phase 2 elements — LiveValue states

| Element | Applicable states | Notes |
|---|---|---|
| `vram_hub_bar` | `pre-relay`, `no-data-yet`, `live`, `data-stale`, `source-unreachable`, `subscription-closed` | `pre-relay` until relay agent ships; `data-stale` threshold = 30 000 ms (3× poll interval) |
| `hub_warn_indicator` | `pre-relay`, `live` | Derives from `vram_hub_bar` source |
| `model_event_feed` | `pre-relay`, `no-data-yet`, `live`, `subscription-closed` | No stale threshold — model events are transitions, not periodic |
| `sidecar_status_chip` | `pre-relay` | Lifecycle stream not yet implemented; always `pre-relay` until `SidecarStarted`/`SidecarStopped` ship in sidecar code |
| `relay_stream_badge` | `pre-relay`, `live` | Indicates relay agent liveness; `pre-relay` = steel blue `--lv-pre-relay` (#4a7a9b); `live` = teal `--project-accent-ai-stack` |

**`data-stale` threshold for `vram_hub_bar`:**
`thresholdMs: 30_000`. VRAM events emit only on ≥10 MB delta, so absence
of events is normal during idle. 30s aligns with 3× the 10s sidecar poll
interval — a reasonable "we should have seen something by now" signal.

**`source-unreachable` for `vram_hub_bar`:**
When the hub store itself is unreachable (hub process died, filesystem
issue). Distinct from relay agent not yet shipping (`pre-relay`).

---

## §5 — Interaction surfaces

### View toggle

| Field | Value |
|---|---|
| `trigger` | click on `view_toggle_pill` |
| `action` | Toggle `view` state between `"topo"` and `"list"`; persist to `localStorage["aistack.view"]` |
| `disabled state` | Never disabled |
| `current label` | "TOPO" when in topo mode; "LIST" when in list mode |

### Dormant alias toggle

| Field | Value |
|---|---|
| `trigger` | click on `dormant_toggle_pill` |
| `action` | Toggle `showDormant` boolean; persist to `localStorage["aistack.showDormant"]`; hides/shows `bot-escalated` edge in topo view |
| `disabled state` | Never disabled |

### VRAM warn threshold slider

| Field | Value |
|---|---|
| `trigger` | `input[type=range]` change event |
| `action` | Update `vramWarnPct`; persist to `localStorage["aistack.vramWarnPct"]`; immediately re-derives `vramExceeded` |
| `range` | 50–95 step 5 |
| `disabled state` | Never disabled |

### GPU total MB input

| Field | Value |
|---|---|
| `trigger` | `input[type=number]` change event |
| `action` | Update `vramTotalMb`; persist to `localStorage["aistack.vramTotalMb"]`; recalculates `usedPct` |
| `range` | 1024–49152 step 256 |
| `disabled state` | Never disabled |
| `note` | Override for hardware-specific GPU total; default = 12 282 MB (RTX 4070 Super) |

### Alias chip (mute toggle)

| Field | Value |
|---|---|
| `trigger` | click on `alias_chip` |
| `action` | Toggle alias presence in `mutedAliases` set; persist to `localStorage["aistack.mutedAliases"]`; muted aliases render with muted CSS in topo view |
| `title tooltip` | "unmute" when muted; "mute in topology" when not muted |
| `disabled state` | Never disabled |

### Load model select

| Field | Value |
|---|---|
| `trigger` | `select` onChange (value is model name) |
| `action` | Call `ollamaLoad(modelName)`: POST to `http://localhost:11434/api/generate` with `keep_alive: "10m"`; then `runPoll()` to refresh snapshot |
| `API shape` | `POST /api/generate` body: `{ model, prompt: "", keep_alive: "10m" }` |
| `loading state` | `loadingModel` set to model name; select disabled; "loading <model>…" status shown |
| `error state` | `actionError` set; `action_error_banner` shown |
| `disabled state` | `select` disabled while `loadingModel !== null` |
| `visibility` | Shown when `snap.ollama === "up" && snap.localModels.length > 0` |

### Unload all button

| Field | Value |
|---|---|
| `trigger` | click on `unload_all_button` |
| `action` | Call `ollamaUnload(name)` for each running model in parallel (`Promise.allSettled`); then `runPoll()` |
| `API shape` | `POST /api/generate` body: `{ model, prompt: "", keep_alive: 0 }` |
| `loading state` | `unloadingAll = true`; button label "UNLOADING…"; button disabled |
| `error state` | First rejection surfaces as `actionError` |
| `disabled state` | Disabled while `unloadingAll` |
| `visibility` | Shown when `hasRunning` (running models exist) |

---

## §6 — Tile registration shape

### Current registration (live in `src/registrations.tsx`)

```typescript
tileSectionRegistry.register({
  id: "ai-stack-topology",
  label: "AI Stack Topology",
  category: "right-panel",
  defaultWidth: 480,
  defaultHeight: 520,
  collapsible: true,
  defaultVisible: true,
  defaultExpanded: true,
  content: () => <AiStackTopologyTile />,
});
```

`defaultWidth: 480` and `defaultHeight: 520` are standalone content size
hints — 480px fits the topology view comfortably; 520px accommodates the
VRAM section + topology/list view + model actions + alias panel + footer
at default expansion. Panel category is `"right-panel"`; first-placement
is a workspace decision, not declared here.

### Proposed changes for Phase 2

No changes to `id`, `label`, `category`, `collapsible`, `defaultVisible`,
or `defaultExpanded`. The tile id `"ai-stack-topology"` is stable.

`defaultHeight` may need to increase when `model_event_feed` and
`sidecar_status_chip` Phase 2 elements are added (current 520px may be
tight). Proposed `defaultHeight: 620` for Phase 2. Compositor validates
against the actual viewport.

---

## §7 — Cross-tile relationships

### BO node → Cerebra daemon (cross-project HTTP integration)

`bo_node_card` status derives from `GET http://localhost:7432/status`
(Cerebra daemon). This is a direct HTTP integration from the tile to
Cerebra's process — not a fossic subscription, not a tile-to-tile state
share. CORS fix at `daemon.py:188` enables the webview fetch.

When Cerebra's Phase 2 tile wiring lands, there may be an opportunity to
share the daemon status signal via a shared LiveValue or Zustand slice
rather than maintaining duplicate HTTP polls. This is Lattica's design
decision; ai-stack declares the dependency here for awareness.

### Phase 2 VRAM → Cerebra tile (potential shared signal)

`VramBudgetChanged` events on the hub carry `indexed_tags.warn: bool`.
Cerebra's witness model tile (Phase 15+) may want to surface GPU pressure.
Whether that tile reads from the same hub subscription or from ai-stack's
tile state is Lattica's integration decision. ai-stack declares the signal
exists and is available on `ai-stack/gpu`.

### No other cross-tile relationships

AiStackTopologyTile has no direct state connections to LumaWeave, Policy
Scout, or Fossic tiles.

---

## §8 — P-013 authorship intent

### Three renderer files (per CP-AS-3)

When `ai-stack-relay.py` is live and hub events are flowing, ai-stack will
author three renderer files via the P-013 protocol. Lattica commits them
into the tree.

**Files to author:**

```
src/renderers/ai-stack/VramBudgetChangedRenderer.tsx
src/renderers/ai-stack/VramBudgetChangedRenderer.css
src/renderers/ai-stack/ModelLoadedRenderer.tsx
src/renderers/ai-stack/ModelLoadedRenderer.css
src/renderers/ai-stack/ModelUnloadedRenderer.tsx
src/renderers/ai-stack/ModelUnloadedRenderer.css
```

**Naming conventions:**

Component name = `<EventType>Renderer`. Export named, not default.
Example: `export function VramBudgetChangedRenderer({ payload, event_id })`.
CSS companion uses same base name.

**Renderer content intent (informational — not binding for claude-design):**

| Renderer | Intended display |
|---|---|
| `VramBudgetChangedRenderer` | VRAM bar (used/total MB, pct), warn indicator if `indexed_tags.warn === true`, model list from `payload.models`, `sampled_at` timestamp |
| `ModelLoadedRenderer` | Model name, VRAM size in MB, `loaded_at` timestamp |
| `ModelUnloadedRenderer` | Model name, `unloaded_at` timestamp |

All three renderers treat `payload` as `unknown` on entry; narrow with
guards before accessing fields. Fall back to JSON pretty-print for
unrecognized shapes per ADR-017.

**registerPayloadRenderer calls (to add in `src/registrations.tsx` at relay ship time):**

```typescript
registerPayloadRenderer({
  project: "ai-stack",
  event_type: "VramBudgetChanged",
  component: VramBudgetChangedRenderer,
  label: "ai-stack — VRAM Budget Changed",
  stream_glob: "ai-stack/gpu",
});

registerPayloadRenderer({
  project: "ai-stack",
  event_type: "ModelLoaded",
  component: ModelLoadedRenderer,
  label: "ai-stack — Model Loaded",
  stream_glob: "ai-stack/models",
});

registerPayloadRenderer({
  project: "ai-stack",
  event_type: "ModelUnloaded",
  component: ModelUnloadedRenderer,
  label: "ai-stack — Model Unloaded",
  stream_glob: "ai-stack/models",
});
```

### AiStackTopologyTile Phase 2 changes

`AiStackTopologyTile.tsx` is ai-stack's tile component (already in
Lattica's tree). Planned Phase 2 changes authored by ai-stack via P-013:

- Replace `pollTopology()` VRAM + model sections with fossic hub
  subscription to `ai-stack/gpu` and `ai-stack/models`
- Add `LiveValue<VramPayload>` and `LiveValue<ModelEvent[]>` state
- Add `vram_hub_bar` and `hub_warn_indicator` elements
- Add `model_event_feed` section
- Add `sidecar_status_chip` (initially `pre-relay` until lifecycle stream
  ships)
- Add `relay_stream_badge` to header chrome
- Keep Phase 1 HTTP polling for node status (Ollama up/down, LiteLLM
  up/down, etc.) — fossic subscriptions replace VRAM + model data only,
  not service reachability checks

---

## §9 — Open items

**Lifecycle stream not implemented:**
`SidecarStarted` and `SidecarStopped` are defined in the relay filter
(`ai-stack-relay.py`) and referenced in federation design §6.5, but are
absent from `fossic_sidecar.py` (confirmed per DEP-F-1 verification:
lines 142, 156, 165 show VramBudgetChanged, ModelLoaded, ModelUnloaded
only). The `sidecar_status_chip` element must declare `pre-relay`
LiveValue state until these event types are added to the sidecar and
the lifecycle stream is declared.

**FOSSIC_STORE_PATH migration complete; vault directory not yet created:**
`fossic_sidecar.py` now writes to `~/Projects/ai-stack/.fossic/store.db`
(migrated in the foundation pass). The `.fossic/` directory is created at
first `Store.open()` call via `create_dir_all(parent)` — no manual
creation needed. The vault will not exist until the sidecar has run at
least once against the new path.

**`~/.lattica/project-registry.json` not yet populated:**
`fossic_query_remote_store` returns `registry_not_found` until the developer
creates this file and adds the `"ai-stack"` entry pointing to
`~/Projects/ai-stack/.fossic/store.db`. Any Phase 2 causation arc click-through
from ai-stack events is functionally deferred until the registry exists.

**Phase 1 HTTP polling and Phase 2 fossic subscription coexist during
migration:**
Service status polling (Ollama up/down, LiteLLM up/down, Open WebUI
reachability, Cerebra daemon) stays HTTP-polled in Phase 2 — fossic
subscriptions replace VRAM and model data only. The two data sources
require separate `LiveValue` instances in the migrated tile. The Lattica
integration pass should wire them as independent connections, not a single
merged value.

**DEP-LA-3 notification not yet posted:**
When `ai-stack-relay.py` is started live for the first time, ai-stack will
post to #current-task with: project `"ai-stack"`, first event
`"VramBudgetChanged"`, subscribe_pattern `"ai-stack/**"`. This is the
handoff signal for Lattica to wire Phase 2 tile elements.

---

### Stage 2 corrections (2026-06-17)

**§8.3 — vramWarnPct resolved: aligned to 90%:**
Developer decided to align the tile UI slider default to 90%, consistent with
`VRAM_WARN_PCT_THRESHOLD = 90` in `fossic_sidecar.py` per CP-C-6.
Updated in §1 and §3. `AiStackTopologyTile.tsx` was fixed in the foundation pass.

**§9.4 — RelayConfig tilde paths corrected:**
`ai-stack-relay.py` previously passed tilde strings to `RelayConfig`
(`"~/Projects/ai-stack/.fossic/store.db"`, `"~/.lattica/fossic/store.db"`).
`Store.open()` does not expand `~` — pyo3 passes the string directly to Rust
`Path::from()`, which treats `~` as a literal path component. Fixed in relay
script: paths now use `os.path.expanduser()`. `fossic_sidecar.py` was already
correct (uses `Path.home()` for path construction).

**§9.5 — ReadQuery exact names (confirmed safe):**
Phase 2 cold-start declarations in §3 use exact stream names (`"ai-stack/gpu"`,
`"ai-stack/models"`) not globs. Whether `ReadQuery` supports glob semantics is
unconfirmed per §9.5. Exact names are the safe pattern; ai-stack's cold-start
declarations are compliant. No correction needed.

**§8.1 — Duplicate daemon poll (ratified):**
CORE.md §8.1 confirms the parallel poll of `:7432/status` by both ai-stack and
Cerebra is intentional for Phase 1 independence. §7 already documents the
eventual-share path as Lattica's design decision. No change.

---

*End of tile_spec.md — ai-stack — 2026-06-17*

---

