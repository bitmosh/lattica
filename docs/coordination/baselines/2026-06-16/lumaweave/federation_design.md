# LumaWeave — Federation Design Response

**Date:** 2026-06-16
**Filed by:** lumaweave-claude
**In response to:** federation interview round; inputs: `PLATFORM_BASELINE_2026-06-16_v2.md`, `LATTICA_RECONCILIATION_BRIEF.md`

---

## Section A — Input read confirmation

Both documents read in full. §2.2 and §4.X match the reconciliation file exactly. No corrections required before proceeding.

---

## Section B — LumaWeave federation design

### B.1 — Local store shape

**Current store:** `<project_root>/.lumaweave/fossic.db`
**Federation model:** local-store-per-project; relay agent writes to hub. No change to local store path.

#### Stream 1: `lumaweave/graph/events` (current, primary)

Event types live: `SourceLoaded`, `SourceLoadFailed`, `SourceSwitched`, `ThemeChanged`, `GraphLayoutSettled`

**Snapshot cadence:** every 10 events. Source lifecycle events are rare (occasional user actions, not continuous), so 10 events will span multiple sessions. At that cadence, cold-start replay is bounded without burning write cycles. The hub tile's subscribe snapshot (seeded at last `SourceLoaded`) is the operationally important snapshot; local store snapshot cadence is a fault-recovery parameter.

**Reducer registrations:** none required. Hub tile derives graph health from the most recent `SourceLoaded`/`SourceLoadFailed` event — a simple last-event scan, no aggregation. No reducer needed at the store level.

**Branch usage pattern:** layout experiments fork from `main` at the point of the most recent `GraphLayoutSettled`. Experimental gwells dialect configurations produce further `GraphLayoutSettled` events on the experiment branch. Decision points:
- Experiment keeper → merge to `main`; hub relay picks up merged events
- Experiment abandoned → drop branch; no hub pollution

**Prerequisite for branch usage:** gwells must add a convergence detection signal (GWRuntimeState "settled" variant). Until then, `GraphLayoutSettled` cannot be reliably emitted from the frontend, and branch management has no stable fork point. Branch adoption is deferred until gwells convergence lands.

**Which experiments fork from main:**
- Alternative gwells dialect (e.g., trying `gwells.dialect.radial` on a graph currently loaded with `gwells.dialect.spine-force`)
- Physics parameter sweep (e.g., higher springStrength)
- Seeder overrides (e.g., manual well assignment overrides on a specific graph)

Everything that changes how the graph looks but not what it represents. Source switches (new adapter/source_key) stay on main — they are not layout experiments; they change the underlying data.

#### Stream 2: `lumaweave/layout/<adapter_id>` (proposed future, not yet implemented)

When layout branch experiments mature and the branch lifecycle becomes operational, separating layout history per adapter will make branch management cleaner. `lumaweave/graph/events` carries lifecycle events (source load/switch); a per-adapter layout stream carries settled layout snapshots and experiment results.

**Event types (proposed):** `GraphLayoutSettled` (with full node count + dialect config in payload), `GraphLayoutBranchStarted`, `GraphLayoutBranchMerged`. Not implementing now; noting the design direction so the relay agent isn't designed against a stream shape that will change.

**Branch usage:** same experiment pattern above but isolated per loaded adapter — forking at the last `GraphLayoutSettled` for that adapter.

**Dependency:** gwells convergence detection, fossic branch adoption in Tauri bindings.

---

### B.2 — Relay filter design

#### Streams that relay to hub

**`lumaweave/graph/events`** — partial relay (event type filter):

| Event type | Relay? | Rationale |
|---|---|---|
| `SourceLoaded` | **Yes** | Architectural decision: which source is loaded. Hub-visible. |
| `SourceLoadFailed` | **Yes** | Error state. Hub-visible for monitoring. |
| `SourceSwitched` | **Yes** | Context change. Hub-visible. |
| `ThemeChanged` | **No** | Visual/UI preference. Not an architectural event. Local only. |
| `GraphLayoutSettled` | **Yes** | Architecture-level state: which dialect produced this layout. Hub-visible. |

Relay filter set: `{SourceLoaded, SourceLoadFailed, SourceSwitched, GraphLayoutSettled}`

#### Streams that stay local-only

- **Per-frame node positions** — entirely in-memory during gwells convergence; never written to fossic. Not a filter question.
- **Intermediate layout states** — in-memory only during gwells step loop. Not written to fossic.
- **Pin state changes** — stored in `useSettingsStore` (Zustand + localStorage); not in fossic.
- **`ThemeChanged` events** — written to fossic locally; NOT relayed.
- **helixTwist changes** — rendering parameter, never in fossic.
- **UI layout preferences** (panel widths, collapsed sections) — in `useSettingsStore`, never in fossic.

#### indexed_tags per event (S-013 + S-016)

All relayed events receive `source_store: "lumaweave"` from the relay agent (not set by emitter; relay agent adds it per S-013).

Emitter-side indexed_tags (must be added to events.rs before relay pass — currently missing; see needs-wiring.md):

| Event type | indexed_tags fields |
|---|---|
| `SourceLoaded` | `{adapter_id, source_key}` |
| `SourceLoadFailed` | `{adapter_id, source_key}` |
| `SourceSwitched` | `{to_adapter_id}` — the destination adapter; `from_adapter_id` in payload |
| `GraphLayoutSettled` | `{dialect_id}` — currently missing from command signature; see needs-wiring.md |

**Note on SourceSwitched:** `SourceSwitched` currently takes `from_adapter_id` and `to_adapter_id` as payload fields. For indexed filtering at the hub, `to_adapter_id` is the more useful tag (what's active now). Adding both is optional; `to_adapter_id` alone is sufficient for "what's LumaWeave showing right now?"

#### causation_id per event (S-030, S-031)

**Current state — all five event types:** `causation_id=None`. Events are triggered by Tauri frontend actions (user interactions), not by incoming fossic events. No upstream fossic event_id exists at emit time.

**Future state — S-031 obligation (confirmed — Option A):** When `GraphSnapshotAvailable` integration lands and a `SourceLoaded` is triggered by receiving that hub event:

**Application-layer obligation (step 3):** When LumaWeave's receive path fires for a `GraphSnapshotAvailable` hub event and triggers a graph load, LumaWeave's emitter must set `causation_id = <GraphSnapshotAvailable hub event.id>` on the local `SourceLoaded` event at emit time. This is a LumaWeave application-layer responsibility — not something the relay agent infers. The Tauri command call site must be updated to accept the triggering hub event's ID and pass it as the fossic `Append` `causation_id`.

Full three-step sequence:
1. LumaWeave receives `GraphSnapshotAvailable` from hub; the hub event's ID is captured before triggering the load
2. **(Application-layer obligation)** `SourceLoaded` is emitted to local fossic store with `causation_id = <GraphSnapshotAvailable hub event.id>` — set at the call site, not by the relay agent
3. **(Relay filter pass-through — confirmed)** The relay agent propagates `event.causation_id` to the hub copy; it does NOT replace it with `event.id`

Relay agent causation_id rule (two cases):
- `event.causation_id` is `None` → relay sets `causation_id=None` on hub copy (standard case; all current LumaWeave events)
- `event.causation_id` is set → relay propagates `event.causation_id` to hub copy (GraphSnapshotAvailable → SourceLoaded case)

Result: hub SourceLoaded has `causation_id = GraphSnapshotAvailable hub event.id` → `walk_causation` traverses the full chain on the hub without a local-store hop. Case-2 confirmed.

**Outbound question closed:** `2026-06-16_lumaweave_to_lattica_binding-question-s031-causation-relay.md` — resolved as Option A.

#### Relay agent process model

Confirmed: **standalone Python process** (S-027 leading). A small `lumaweave-relay.py` using fossic-py `RelayConfig`:
```python
RelayConfig(
    local_store_path="<project_root>/.lumaweave/fossic.db",
    hub_store_path="~/.lattica/fossic/store.db",
    source_prefix="lumaweave",
    subscribe_pattern="lumaweave/**",
    relay_filter={"SourceLoaded", "SourceLoadFailed", "SourceSwitched", "GraphLayoutSettled"},
)
```

D.3 strip rule applies: `"lumaweave/graph/events"` already starts with `"lumaweave/"` → hub stream name is `"lumaweave/graph/events"` (unchanged, no double-prefix).

**Process start:** open question for §8.3. LumaWeave has no strong preference between:
- (a) Manually started (or via system service) — simplest for first pass
- (b) Tauri sidecar process started by LumaWeave's Rust backend — tighter lifecycle coupling
- Option (b) is operationally cleaner if LumaWeave is always running when the relay should run

---

### B.3 — GraphSnapshotAvailable schema (§8.2)

LumaWeave is the consumer. Confirmed consumer requirements from reconciliation (B.1), plus additional proposed fields:

**Required fields:**

| Field | Type | Shape / usage |
|---|---|---|
| `file_path` | string | Absolute filesystem path to `.cerebra/graph.json`. LumaWeave reads the file directly via Tauri's file-read command. Content hash as an alternative is more portable but adds complexity for a first implementation — prefer file path for now. |
| `lineage_id` | string (UUID or stable opaque ID) | Stable identifier for this Cerebra graph's identity. LumaWeave uses this to decide whether the incoming snapshot is the same graph it already has loaded (same lineage) or a different one (new lineage, always trigger load). |
| `event_seq` | integer | Number of Cerebra events processed to produce this snapshot. Used as a monotonic staleness signal: if `event_seq` for the incoming event ≤ the `event_seq` of the last loaded snapshot with the same `lineage_id`, skip the load. |
| `schema_version` | string | Identifies the graph.json schema (e.g., `"cerebra/v1"`). The LumaWeave adapter implementation needs to know which converter to apply. Required even for the first implementation — adding it after schema changes land is a breaking change. |

**Proposed additional fields:**

| Field | Type | Rationale |
|---|---|---|
| `node_count` | integer | Quick sanity check. LumaWeave can skip a parse round-trip if node_count matches the currently loaded graph and lineage_id matches — cheaper than reading the file to detect no-op. |
| `cerebra_session_id` | string (optional) | Which Cerebra session produced this snapshot. The LumaWeave tile can show "loaded from session X" for provenance. Not required for load/skip logic; useful for tile UX. |

**Stream target (open for federation interview):** LumaWeave has no strong preference between `cerebra/lattice/<lineage_id>` and `cerebra/graph/<lineage_id>`. The latter is slightly cleaner for LumaWeave's subscription pattern (subscribe to `cerebra/graph/*` to receive all graph snapshots, regardless of lineage). The former implies graph events are embedded in a broader lattice event stream, which may need filtering. LumaWeave's input: prefer a dedicated `cerebra/graph/<lineage_id>` stream.

---

### B.4 — Shared store path confirmation (§8.5)

**Hub path confirmed:** `~/.lattica/fossic/store.db` is the canonical hub store path. No ambiguity from LumaWeave's side — this is Lattica's store, Lattica must confirm it's stable at this path from Tauri.

**Local store path:** unchanged. `<project_root>/.lumaweave/fossic.db` remains LumaWeave's local store. The relay agent is the bridge; LumaWeave's `events.rs` does not need a path change for federation.

**Migration timing:** the indexed_tags prerequisite (adding `adapter_id`, `source_key`, `dialect_id` fields to R-LW-005 emit calls) CAN and SHOULD ship before the relay agent is built. That change is LumaWeave-internal, does not depend on relay agent design, and makes the local store's events hub-ready when the relay agent does land.

Sequence:
1. Add indexed_tags to events.rs — ship immediately (self-contained LumaWeave change)
2. Add dialect_id parameter to `lw_emit_graph_layout_settled` command — ship with step 1
3. Confirm `~/.lattica/fossic/store.db` stability from Lattica (Tauri backend Rust path)
4. Build `lumaweave-relay.py` using fossic-py RelayConfig
5. Test relay flow end-to-end

Steps 1-2 are unblocked now. Steps 3-5 are gated on Lattica confirmation.

---

### B.5 — Settings hub-observability partition (§8.7)

**Confirmed partition (from reconciliation S-025):**

Hub-observable: `sources.active`, `activeDialect`
Local-only: `helixTwist`, pin state, UI layout preferences

**How hub-observable fields become hub events:**

**`sources.active`:** Already covered. `SourceLoaded` and `SourceSwitched` events carry `adapter_id` + `source_key`, which collectively identify the active source. These are already emitted to fossic and will relay to hub. No new event type needed.

**`activeDialect`:** `GraphLayoutSettled` carries `dialect_id` (once the indexed_tags field is added — see needs-wiring.md). The hub observes dialect state via the most recent settled event for a given `adapter_id`. This is an eventually-consistent view: the hub sees the dialect of the LAST SETTLED layout, not immediately when the user switches dialects.

**Emission pattern for `activeDialect`:** emit on settled state only — after gwells settles and `GraphLayoutSettled` fires. Rate: once per layout convergence (occasional user action). This is appropriate for the hub use case. A user switching dialects mid-exploration won't pollute the hub event stream with every intermediate switch.

**If immediate hub visibility is needed:** add a `PhysicsDialectChanged` event type to `lumaweave/graph/events` that fires immediately on `activeDialect` settings change. This would be a new event type, not covered by the current R-LW-005 spec. Noting as a future option; not required for the first relay pass.

---

### B.6 — Cross-substrate causation rendering (§8.7)

LumaWeave itself is a graph visualizer; it currently has no event stream inspection UI. The question is how Lattica's tiles should render causation chains where LumaWeave events are involved. These are design inputs for Lattica, filed here from LumaWeave's perspective.

**Case-2 chains (hub-traversable, e.g., `GraphSnapshotAvailable → SourceLoaded`):**

Both events are on the hub. `walk_causation` traverses the full chain hub-side. Visual treatment: same as local-only chains. No special indicator needed. Optionally, a small "relayed from lumaweave" or "relayed from cerebra" badge on each event node to show provenance — cosmetic, not structural.

**Case-1 chains (hub event → local event NOT relayed):**

The hub event is visible; its `causation_id` points to a local store event (identified via `source_store` indexed_tag). The local event is not on the hub.

Proposed treatment:
- Render the hub portion of the chain inline
- At the point where the chain crosses to a local store: show a distinct visual break — dashed line, different color, or a "store boundary" marker
- On the break marker: show `source_store` value and a "Fetch from originating store" affordance
- On user intent to expand: attempt the local store query (requires knowing the store is accessible from the current context)
- Loading state: show a spinner on the break link while fetching
- If store is unreachable: show "Originating store unavailable" with `source_store` identifier and the raw event ID for manual lookup

This treatment works for any consumer of causation chains. LumaWeave would apply it when displaying fossic event history in its own event inspector (future, not yet built). Lattica's fossic tile should apply the same treatment when rendering chains involving LumaWeave events.

---

## Section C — Cross-cutting items

### C.1 — Broken-pending UI discipline

Confirmed: all identified elements bake in as broken-pending. Complete table including additions:

| Tile element | What blocks live data | Bake in as broken-pending? |
|---|---|---|
| Graph health pill (LOADED / FAILED / LOADING / IDLE) | Migration to hub + relay agent live | Yes |
| Node/edge count badge | Migration to hub | Yes |
| Active source label | Migration to hub | Yes |
| Active dialect indicator | Migration to hub + dialect_id in GraphLayoutSettled | Yes |
| Source switcher dropdown | `AdapterListChanged` event + migration + relay agent | Yes |
| Re-settle button | `reheat()` impl + reverse channel API | Yes |
| Layout freeze toggle | Reverse channel API | Yes |
| Physics preset write | Reverse channel API + shared store | Yes |
| Cerebra graph snapshot row (in source switcher) | `GraphSnapshotAvailable` receive path built | Yes |
| GraphLayoutSettled activity indicator (SETTLING / SETTLED) | gwells convergence detection + `GraphLayoutSettled` frontend mount | Yes |
| Cold-start snapshot seeding | Relay agent live + fossic snapshot adoption | Yes — tile shows stale/loading state on subscribe until snapshot or first event |

**Note on "Cerebra graph snapshot row":** when the source switcher dropdown is built, it will need a row for loading a Cerebra graph snapshot. This is blocked on both the `GraphSnapshotAvailable` receive path and relay being live. It bakes in as a broken-pending row in the switcher (grayed out, "awaiting Cerebra relay").

**Note on "GraphLayoutSettled activity indicator":** the tile can show whether LumaWeave's last known layout has settled. Blocked on `GraphLayoutSettled` frontend mount (gwells lacks convergence signal in v0.1.5). Bakes in as broken-pending SETTLING state display.

---

### C.2 — No hard-coded values discipline

Hard-coded values and missing bindings identified during source review are logged in `needs-wiring.md` (same directory as this file).

Summary of items logged:
1. **indexed_tags missing from all 5 R-LW-005 Append calls** — `adapter_id`, `source_key`, `dialect_id` not in indexed_tags (events.rs uses `..Append::default()`)
2. **`dialect_id` missing from `lw_emit_graph_layout_settled` command** — not a parameter; not in payload or indexed_tags
3. **Hub store path in relay agent (not yet written)** — pending Lattica confirmation of `~/.lattica/fossic/store.db` stability
4. **S-031 causation_id propagation design** — ambiguity in relay agent behavior; filed as cross-Claude question

Will follow LiveValue<T> pattern (once Lattica publishes it in their federation design response) for all tile data bindings. No tile code has been written yet for LumaWeave; the pattern will be applied from the start.

---

### C.3 — Cross-Claude question protocol

One outbound filed:

`~/Projects/lattica/docs/coordination/outbound/2026-06-16_lumaweave_to_lattica_binding-question-s031-causation-relay.md`

Question: S-031 describes the relay agent setting `causation_id = <local_source_loaded_event.id>` on the hub SourceLoaded. For the case-2 chain to be hub-traversable without a local-store hop, the local SourceLoaded should itself carry `causation_id = <GraphSnapshotAvailable hub event.id>` at emit time — and the relay agent should propagate `event.causation_id` (not replace with `event.id`) when the local event has a non-null causation pointing to a hub event. Is this the intended design, or does S-031 mean the standard S-030 behavior (relay agent always sets `causation_id = event.id`)?

---

### C.4 — File ownership boundaries and export-hurdle prep

#### LumaWeave's own tree (visual code files)

**Graph rendering:**
- `src/graph/SigmaGraphView.tsx` — main graph canvas; Sigma.js bindings
- `src/graph/SigmaContainer.tsx` — Sigma instance lifecycle
- `src/graph/ingest/` — source adapters and graph data loading hooks
- `src/graph/ingest/useGraphSourceSummary.ts` — R-LW-005 emission call sites (SourceLoaded, SourceLoadFailed, SourceSwitched)
- `src/physics/gwells/` — physics engine (not a React component, but drives the graph visual)

**Settings and panels:**
- `src/control-plane/settings/SettingsPanel.tsx` — settings UI
- `src/control-plane/panels/CollapsibleSection.tsx`, `TileProvider.tsx`, `TileLayer.tsx`, `FloatingTile.tsx`
- `src/themes/` — CSS variable tokens, theme target registry, override storage

**Theme emission:**
- `src/app/useLwThemeEventEmitter.ts` — ThemeChanged R-LW-005 call site
- `src/app/AppShell.tsx` — ThemeChanged wiring

**Naming conventions:**
- React components: PascalCase `.tsx` (e.g., `SigmaGraphView.tsx`)
- Hooks: camelCase prefixed with `use`, `.ts` (e.g., `useGraphSourceSummary.ts`)
- Registries: camelCase + `Registry` suffix, `.ts` (e.g., `physicsDialectRegistry.ts`)
- CSS: match component filename (e.g., `SigmaGraphView.css` alongside `SigmaGraphView.tsx`)
- Store/schema files: camelCase (e.g., `settingsStore.ts`, `settingsSchema.ts`)

#### Lattica's tree (LumaWeave-authored vs. Lattica-authored)

**Currently in Lattica's tree authored by LumaWeave:**
- No tile exists yet for LumaWeave
- No renderers exist yet for LumaWeave event types
- Type copies exist (verbatim, documented in-file): `src/control-plane/registry/RegistryContract.ts` (from LumaWeave's `registryContract.types.ts`), `src/control-plane/tile-section/types.ts` (from LumaWeave's `tile.types.ts`) — these are Lattica-maintained copies, not live-synced

**Target structure for LumaWeave tile (following existing Lattica pattern):**
- `src/tiles/lumaweave/` — LumaWeave tile components (new directory, following `src/tiles/ai-stack/`, `src/tiles/cerebra-signal/` pattern)
- `src/renderers/lumaweave/` — LumaWeave event renderers (new directory, following `src/renderers/cerebra/`)

**Export mapping for claude-design:**
- Visual component exports from claude-design should target:
  - LumaWeave tile → `src/tiles/lumaweave/<ComponentName>.tsx`
  - LumaWeave tile CSS → `src/tiles/lumaweave/<ComponentName>.css`
  - LumaWeave renderers → `src/renderers/lumaweave/<EventType>Renderer.tsx`
  - Shared tile utilities (if any) → `src/tiles/lumaweave/utils.ts`
- LumaWeave's own tree visual exports → `src/graph/` or `src/control-plane/panels/` depending on component type

---

### C.5 — Net-writer / net-reader role confirmation

**Confirmed: net-writer + net-reader.**

**Net-writer:** LumaWeave writes R-LW-005 events to local fossic store (`lumaweave/graph/events` stream). Relay agent forwards filtered subset to hub.

**Net-reader:** LumaWeave will receive `GraphSnapshotAvailable` hub events from Cerebra (future). This requires wiring a hub event subscription path into LumaWeave's Tauri backend — either a Rust-side fossic subscription or a Tauri command/event bridge. The receive path is not yet built; it's the second major integration milestone after relay is live.

No other hub read paths currently planned for LumaWeave.

---

### C.6 — D.3 stream naming convention ratification (§8.1)

**LumaWeave confirms endorsement of D.3 conditional strip rule** for the federation interview compile.

Rule: if `stream_id.startswith(f"{source_prefix}/")`, use `stream_id` directly on hub; else prepend `f"{source_prefix}/"`.

Applied to LumaWeave: `source_prefix="lumaweave"`, `stream_id="lumaweave/graph/events"` → starts with `"lumaweave/"` → hub stream = `"lumaweave/graph/events"`. No double-prefix.

Endorsement count with this confirmation: Cerebra (proposer) + ai-stack (Round 2 explicit) + LumaWeave (C.8 + confirmed here) + Policy Scout (implicit) = 4 of 5 project endorsements. Fossic + Lattica positions needed for full ratification.

---

## Summary of open questions filed or pending

| Item | Status | Filed where |
|---|---|---|
| S-031 causation_id relay behavior | Cross-Claude question filed | `outbound/2026-06-16_lumaweave_to_lattica_binding-question-s031-causation-relay.md` |
| indexed_tags missing from events.rs | Self-fix, pre-relay prerequisite | `needs-wiring.md` item 1-2 |
| dialect_id missing from GraphLayoutSettled command | Self-fix, pre-relay prerequisite | `needs-wiring.md` item 3 |
| Hub store path stability confirmation | Blocked on Lattica | `needs-wiring.md` item 4; §8.5 |
| GraphSnapshotAvailable stream target | Federation interview §8.2 | LumaWeave prefers `cerebra/graph/<lineage_id>` |
| Relay agent process start owner | Federation interview §8.3 | No strong preference; lean toward Tauri sidecar for lifecycle coupling |
| D.3 full ratification | Federation interview §8.1 | Endorsed above |

---

End of LumaWeave federation design response.
