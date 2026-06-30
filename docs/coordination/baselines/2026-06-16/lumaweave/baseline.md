# Baseline — lumaweave (2026-06-16)

---

## federation_design

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

---

## reconciliation

# LumaWeave — Baseline Reconciliation

**Date:** 2026-06-16
**Filed by:** lumaweave-claude
**In response to:** `baselines/2026-06-16/PLATFORM_BASELINE_2026-06-16.md`
**Updated:** after reading all four peer reconciliation files

---

## A. Self-representation accuracy

Section 2.2 is accurate. The gwells arc, R-LW-005 wiring, re-settle audit, and all
open-items listings reflect actual on-disk state. One precision note: the compile
says GraphLayoutSettled is "command wired; frontend mount deferred." This is exactly
right — the Tauri command `lw_emit_graph_layout_settled` exists in `src-tauri/src/events.rs`;
the frontend never calls it because gwells has no "settled" variant in `GWRuntimeState`
to trigger the invoke. The deferred status is structural, not forgotten.

The compile-time observation that LumaWeave provided "directional" pre-federation
thoughts rather than an explicit relay filter formula is fair. The five event types
listed in §6 of the baseline (`SourceLoaded`, `SourceLoadFailed`, `SourceSwitched`,
`GraphLayoutSettled`, `AdapterListChanged`) are the complete intended relay set for
the current event surface. `ThemeChanged` is intentionally local-only.

---

## B. What others said about LumaWeave

### B.1 — §6.3 conflict: CerebraReadAdapter

Cerebra's claim that LumaWeave has a `CerebraReadAdapter` consuming `.cerebra/graph.json`
is **incorrect in all three senses the compile listed**. The adapter:

- does not exist in any form (not stale, not in a subdirectory, not behind a feature flag)
- is not in progress
- is not "maintenance status unknown"

It is simply unbuilt. The source adapter registry contains eleven adapter types;
`CerebraReadAdapter` is not among them and never has been.

**Update from Cerebra's reconciliation:** Cerebra themselves confirmed this error in
their reconciliation filing. Quoting: "I was describing the intended consumption
relationship, not confirmed current state. I named the schema `cerebra/v1` on the
Cerebra side because it was designed to be consumed by LumaWeave; I incorrectly
projected that LumaWeave had already built a reader for it." This closes the conflict.
No ambiguity remains.

Cerebra also explicitly endorsed LumaWeave's `GraphSnapshotAvailable` federation
thought: "I find this compelling. If we go that route, a CerebraReadAdapter polling
the file becomes less important than the hub-observable event handoff." Both projects
agree the event-based handoff is the correct federation architecture.

For the federation design: the file-polling model should not be taken as the target
architecture. The correct path is Cerebra emits a `GraphSnapshotAvailable` hub event
with a snapshot reference; LumaWeave receives the event and loads the graph. File
artifact becomes an implementation detail. Building a file-polling adapter is the
wrong direction.

**`GraphSnapshotAvailable` stream target (from Cerebra's D.4):** Cerebra proposes
placing this event on `cerebra/lattice/<lineage_id>` or a dedicated
`cerebra/graph/<lineage_id>` stream. The stream choice and full payload schema are
open design decisions for the federation interview round. As the consumer, LumaWeave
needs: a snapshot reference (file path or content hash), a `lineage_id` or equivalent
graph identity field, and enough context to determine whether to trigger a load.
Neither the event schema nor the stream location is settled; both are flagged here so
LumaWeave comes to the interview with concrete requirements.

### B.2 — Fossic §6 relay ordering

Fossic's reconciliation explicitly confirmed LumaWeave as the first relay candidate:
"LumaWeave first relay migration" is unblocked after shared store migration. Fossic
also identified a gap in their own relay pseudocode that affects LumaWeave specifically
(see C.5 below — branch field relay).

Fossic's relay protocol recommendation (relay decoded/post-upcast payloads, not raw
bytes; use `external_id` for idempotency; namespace stream_id with project prefix;
`source_store` as indexed_tag) is adopted as-is.

### B.3 — Cerebra daemon "not yet consumed" note (§6 version drift)

Compile §6 notes this statement is stale as of v0.3.5u. No reconciliation needed
from LumaWeave; noted for completeness.

---

## C. Cross-baseline observations

### C.1 — "Local store, blocked on migration"

The characterization is accurate. LumaWeave is on `<project_root>/.lumaweave/fossic.db`.
The migration is path-only on LumaWeave's side — the Rust wrapper (`LwEventStore`) calls
`Store::open(path)` with a path derived from the Tauri app dir; changing the path is a
one-line config change. The work is waiting on Lattica confirming the shared store path
is stable and accessible from Tauri.

**Update from cross-reconciliation:** Cerebra's reconciliation clarifies that Cerebra is
also on a local fossic store (`.fossic/store.db`), not the shared `~/.lattica/fossic/store.db`.
This is relevant to LumaWeave's tile design: even if LumaWeave migrates to the shared
store and its events begin flowing to the hub, Cerebra's agent-trace events won't appear
there until Cerebra also migrates. Any LumaWeave tile element that aims to display
cross-project context (e.g., "what Cerebra cycle is LumaWeave currently being inspected
for") cannot be built from hub events alone until Cerebra's relay is live. This is a
correct constraint for the federation interview round to address.

Cerebra confirms this explicitly in their reconciliation (Item 2, CerebraSignalTile
analysis): "I cannot confirm... whether CerebraSignalTile's `cerebra/agent-trace/*`
glob subscription is reading from the shared `~/.lattica/fossic/store.db` or from
Cerebra's local `.fossic/store.db`. These are different paths. Cerebra writes to its
local store. If Lattica's Rust backend is pointing at the shared store for its
subscription, it won't see Cerebra's cycle events unless either (a) Cerebra migrates to
the shared store, or (b) a relay agent bridges them."

### C.2 — `append_if` interest

LumaWeave is in the "interested" group per §6 in the baseline. To be precise: the
primary LumaWeave use case would be node mutation guards — ensuring that a settings
write for an adapter swap doesn't race with an in-flight source load. This is a
medium-priority design consideration, not a blocking Track B item.

### C.3 — Settings store hub-observability concern

The compile accurately relays this concern. For the federation design, the settings
partition is:

**Hub-observable (architectural decisions worth relaying):**
- `settings.sources.active` — which source adapter is currently loaded; changes here
  mean the graph in LumaWeave has fundamentally switched contexts
- `settings.physics.activeDialect` — which gwells dialect is running; visible in the
  tile's physics preset display

**Strictly local (not hub-relevant):**
- `settings.physics.helixTwist` — rendering parameter, not an architectural event
- Pin state (`nodeState.pinned` map) — per-session interaction state; branch-awareness
  concern noted but not a federation concern until layout branches land
- UI layout prefs (panel widths, collapsed sections) — local session state

Emitting settings-change events for the hub-observable subset would require either
new event types in `lumaweave/graph/events` or a separate `lumaweave/settings` stream.
Both are Track B design decisions. No action needed now; surfacing for the federation
interview.

### C.4 — Relay filter "transitions not measurements" convergence

The cross-baseline theme is accurate. LumaWeave's relay set is naturally transitions:
SourceLoaded/Failed/Switched are discrete state changes, not polling measurements.
The gwells engine emits continuous position updates in-memory (never to fossic), so
the "measurements stay local" principle is already enforced by architecture, not by
filter logic.

### C.5 — Relay agent protocol additions (from fossic's reconciliation)

Fossic's reconciliation identified several protocol refinements not captured in the
original baseline. All apply to LumaWeave as the first relay candidate:

**Branch field must be relayed.** Fossic identified a gap in their own relay pseudocode:
the `branch` field on `Append` was missing. Any LumaWeave relay agent must include:
`branch=event.branch`. If LumaWeave uses fossic branches for layout experiments (our
§6 thought), the relay must preserve branch identity so hub consumers see which branch
a layout event came from.

**`source_store` indexed tag.** Fossic recommends including `source_store: "lumaweave"`
as an additional indexed_tag on every relayed event. This enables hub consumers to
route cross-store causal traversal — "this event's `causation_id` came from LumaWeave's
local store, so look there." LumaWeave's relay agent should add this.

**`indexed_tags` adoption on emitted events.** Fossic recommends projects adopt
`indexed_tags` on hub-relayed events so `indexed_tags_filter` can SQL-push at the hub.
For LumaWeave's current event surface, suggested fields:
- `SourceLoaded` / `SourceLoadFailed` / `SourceSwitched`: `{adapter_id, source_key}`
- `GraphLayoutSettled`: `{dialect_id}` (the gwells dialect that produced the layout)

This is a LumaWeave-side change to R-LW-005 event emission before or during the relay
pass — not a Rust API change, just additional fields in the `indexed_tags` map at
`Append` time.

**Stream naming double-prefix open question.** Fossic's relay protocol uses
`format!("{}/{}", source_prefix, event.stream_id)` for hub stream naming. For LumaWeave:
- source_prefix: `"lumaweave"`
- event.stream_id: `"lumaweave/graph/events"`
- hub result: `"lumaweave/lumaweave/graph/events"` — double-prefix redundancy

ai-stack/Bo's reconciliation flags the same problem for their streams. This is an open
naming convention question for the federation interview round. Possible resolutions:
(a) strip the leading project segment from the original stream_id before prefixing;
(b) use the original stream_id as-is (no prefix, rely on unique stream naming);
(c) accept the double-prefix as canonical. LumaWeave has no strong position; we defer
to the federation convention decision, but flag that our stream `lumaweave/graph/events`
was deliberately namespaced with the project prefix in anticipation of hub use.

**Protocol decisions confirmed adopted (from fossic's summary table):**
- Relay decoded (post-upcast) payloads, not raw bytes ✓
- `external_id` = source event id hex (idempotency key) ✓
- LumaWeave as first relay candidate ✓

**Causation chain — two-case refinement (from fossic's updated reconciliation):**
The simple "not traversable on hub alone" statement in the original protocol is more
precisely two distinct cases:
1. Hub event → local event that was NOT relayed: `walk_causation` fails at
   `EventNotFound`. Requires going back to originating store. The `source_store`
   indexed_tag provides the routing hint.
2. Hub event → local event that WAS relayed: hub traversal works because the hub has
   the target event. This case applies when both the causing and caused events are
   relayed from their respective local stores.

For LumaWeave's current event surface (five event types on one stream), causation
chains are simple — LumaWeave events don't cause other projects' events and vice versa
at this scope. This matters more once cross-project causal chains emerge (e.g., a
Cerebra cycle produces a graph export that triggers a LumaWeave `SourceLoaded`).

**`causation_id=None` is correct for current LumaWeave events.** All five event types
(`SourceLoaded`, `SourceLoadFailed`, `SourceSwitched`, `ThemeChanged`,
`GraphLayoutSettled`) are triggered by Tauri frontend actions, not by incoming fossic
events from other projects. No upstream fossic `event_id` exists to link them to. The
relay agent should pass `causation_id: None` (or omit the field) for all current
LumaWeave events. When `GraphSnapshotAvailable` integration lands and a LumaWeave
`SourceLoaded` is directly caused by a Cerebra hub event, that becomes the correct
`causation_id` to carry forward.

### C.6 — Bo's read path under federation (from ai-stack/Bo's reconciliation, updated)

ai-stack/Bo's reconciliation was revised after cross-reading all peer reconciliations.
The original framing ("Bo reads from the cerebra witness model as the all-seeing
aggregator") was corrected. Cerebra pushed back directly: Cerebra aggregates cognitive
cycle context, not platform-wide state. Cerebra's vault-scoped store is not accessible
from Bo without creating a cross-domain dependency, and the hub is the right aggregation
point for cross-project queries.

**Corrected Bo read-path under federation:**
- Cognitive cycle state ("is a cycle running?") → Cerebra daemon HTTP `GET /status`
- Platform-wide state ("what is the GPU doing? what is LumaWeave visualizing?") → Hub
  fossic store, where all projects relay filtered events

The hub is Bo's write destination (via relay) AND its query source for platform-wide
questions. The witness model is NOT a query interface for Bo's platform state queries —
not even an indirect one. Bo's posture and GPU state queries go directly to the hub
fossic store once relay is live (per Cerebra's D.5 correction, Round 2). The witness
model's role is strictly Cerebra-internal: it enriches Cerebra's own cognitive cycle
execution by projecting hub events (from Policy Scout, ai-stack, and eventually
LumaWeave) into Cerebra's memory layer, so that during a cycle Cerebra has richer
platform context. Bo benefits from this indirectly when the Cerebra daemon's answers
become more contextually informed, but Bo never queries the witness model directly.

This matters for LumaWeave specifically: when Bo is asked "what is LumaWeave currently
visualizing?", the answer comes from the hub (our relayed `SourceLoaded`/`SourceSwitched`
events). This only works once LumaWeave is relaying to the hub. Until then, LumaWeave's
state is invisible to Bo's hub-query path.

### C.7 — Snapshot cold-start for LumaWeave tile (from policy-scout's reconciliation)

Policy Scout identified a cold-start problem for tile subscriptions that applies equally
to LumaWeave: when Lattica's tile first subscribes to the hub stream for a project, it
sees zero events until the next event fires. For the LumaWeave tile subscribing to
`lumaweave/graph/events`, this means the graph health pill, node/edge count badge, and
active source label are blank until the user triggers a source load — which may not
happen if LumaWeave is already in a loaded state when the tile opens.

A fossic snapshot on `lumaweave/graph/events` seeded at the last `SourceLoaded` event
gives the tile immediate initial state on subscribe, without replaying history. The
snapshot API is available and ready to use (confirmed by fossic's reconciliation). This
is not a current blocker but should be adopted when Phase 2 tile wiring lands.

### C.8 — Cerebra's preferred double-prefix resolution (from cerebra's reconciliation)

Cerebra's updated reconciliation (D.3) gives a specific resolution recommendation for
the hub stream naming double-prefix problem, going beyond the three options listed in
C.5. Their proposal: strip the leading project segment from the original `stream_id`
before prepending `source_prefix`, if the `stream_id` already starts with
`source_prefix/`. Example:

```
source_prefix = "cerebra"
event.stream_id = "cerebra/agent-trace/<session_id>"
→ strip "cerebra/" → "agent-trace/<session_id>"
→ hub stream = "cerebra/agent-trace/<session_id>"   ✓ (not "cerebra/cerebra/...")
```

For LumaWeave: `source_prefix = "lumaweave"`, `event.stream_id = "lumaweave/graph/events"`:
→ strip "lumaweave/" → `"graph/events"` → hub stream = `"lumaweave/graph/events"` ✓

This is Cerebra's preferred option; they note it requires the relay agent to know the
project's stream naming convention. LumaWeave has no objection to this resolution —
our stream was deliberately prefixed with the project name in anticipation of hub use,
so this stripping rule produces clean hub stream names.

**Round 2 update:** ai-stack formally endorsed this convention in their Round 2 update
(Item 3), explicitly stating that the double-prefix form (`ai-stack/ai-stack/gpu`) is
named in their file only to identify the problem — it is NOT their accepted outcome.
This is now the leading proposal backed by two of five projects (Cerebra + ai-stack)
going into the federation interview. LumaWeave makes three in endorsement.

### C.9 — `causation_id` upgrade obligation when `GraphSnapshotAvailable` lands

Fossic's reconciliation names the future `causation_id` evolution for LumaWeave explicitly
as "the first concrete cross-project causal chain in LumaWeave's event surface." It must
be tracked as a relay agent protocol obligation, not just a forward-looking note.

Current state: all five LumaWeave event types (`SourceLoaded`, `SourceLoadFailed`,
`SourceSwitched`, `ThemeChanged`, `GraphLayoutSettled`) carry `causation_id=None` because
they are triggered by Tauri frontend actions, not by incoming fossic events.

Future obligation: when `GraphSnapshotAvailable` integration lands and a LumaWeave
`SourceLoaded` is directly triggered by receiving that hub event, the relay agent must be
updated to pass `causation_id = <hub_event_id>` for that event. The triggering Cerebra hub
event's ID becomes the correct `causation_id` to carry forward to the hub.

**Causation chain classification (per Cerebra's D.4, Round 2):** This chain is case 2
of the two-case causation pattern — both `GraphSnapshotAvailable` (Cerebra's relayed
event) and `SourceLoaded` (LumaWeave's relayed event triggered by it) are present on
the hub. Hub-side `walk_causation` traverses the chain without needing to back-reference
either local store. No special routing design is required beyond the `causation_id` field
being set correctly. The `source_store` indexed_tag is not needed for this traversal
(that tag serves case 1 — where the causing event was NOT relayed to hub).

The relay agent as currently designed passes `causation_id=None` for all LumaWeave events
and will need a conditional branch once the `GraphSnapshotAvailable` receive path is wired:
if a `SourceLoaded` was triggered by a hub event, carry that event's ID; otherwise `None`.
This is a planned relay agent update, not a current action item.

---

## Items requiring developer or platform-side action

1. **Shared store path confirmation** — the only blocker on LumaWeave's Track B work.
   Once `~/.lattica/fossic/store.db` is confirmed stable and accessible from Tauri,
   LumaWeave's migration is a one-line path change.

2. **CerebraReadAdapter conflict — closed.** Cerebra confirmed the error in their
   reconciliation. No further action from either side. The federation model going
   forward is event-based (`GraphSnapshotAvailable`), not file-polling.

3. **Relay agent protocol gaps to implement before first relay pass:**
   - Add `branch=event.branch` to relay Append
   - Add `source_store: "lumaweave"` indexed_tag to relay Append
   - Add `indexed_tags` fields to R-LW-005 event emission (`adapter_id`, `source_key`,
     `dialect_id` where applicable)
   - Await federation interview resolution on stream naming double-prefix convention

4. **Federation interview scope** — LumaWeave is ready to participate. The highest-value
   discussion threads from LumaWeave's side:
   - Stream naming convention for hub (double-prefix resolution; Cerebra prefers
     strip-leading-segment, which works cleanly for LumaWeave's existing stream name)
   - `GraphSnapshotAvailable` event model for Cerebra→LumaWeave graph handoff: stream
     target, payload schema, and what fields LumaWeave needs as the consumer. Note: fossic's
     open question #4 in their Item 3 explicitly calls for LumaWeave and Cerebra to bring
     concrete payload requirements to this discussion. LumaWeave's requirements are already
     specified in B.1 above (snapshot reference, `lineage_id`, trigger-load context) and
     should be treated as LumaWeave's formal input to that open question, not a future TBD.
   - Settings hub-observability partition (sources.active and activeDialect as emitted
     events vs. Zustand-only state)
   - Relay agent process model (separate process, Tauri sidecar, or Lattica pull)
   - Hub-side reducer/snapshot for Lattica's LumaWeave tile: Cerebra's reconciliation
     (D.7) notes that hub consumers aggregating a project's state must either replay all
     relayed events from the beginning or maintain their own reducer+snapshot. The Lattica
     tile authors need to know this before Phase 2 tile wiring starts — a snapshot on the
     hub stream at subscription time is the concrete mitigation (see C.7).

---

## Settled items (confirmed across two cross-read rounds)

Items below are no longer in active dispute. They do not require re-litigating in future
rounds unless new evidence surfaces.

| Item | Settled by |
|---|---|
| B.1 — CerebraReadAdapter never built; file-polling model dropped | Cerebra confirmed error (Item 1); both projects converged on `GraphSnapshotAvailable` |
| B.2 — LumaWeave as first relay candidate | Fossic confirmed; unblocked once shared store path confirmed |
| C.1 — Local store migration is one-line path change | Fossic confirmed; no API changes needed on fossic side |
| C.3 — Settings partition (hub-observable: sources.active + activeDialect; local: rest) | Fossic and peers confirmed partition is clean |
| C.4 — "Transitions not measurements" principle applies to LumaWeave relay set | All five projects independently confirmed across two rounds |
| C.5 — Full relay protocol (branch, source_store, indexed_tags fields, two-case causation, causation_id=None, external_id) | Fossic Items 1/3, Cerebra D.2, ai-stack Round 2 all confirmed |
| C.6 — Bo read-path correction (daemon HTTP for cycle state; hub direct for platform-wide) | Cerebra D.5, ai-stack Item 2 revised, fossic Item 2 all confirmed; witness model not Bo's query interface |
| C.7 — Snapshot cold-start pattern (snapshot at SourceLoaded seeds tile on subscribe) | Fossic confirmed API ready; canonical pattern across ai-stack, LumaWeave, Policy Scout |
| C.8 — D.3 strip-leading-segment convention: endorsed by Cerebra + ai-stack + LumaWeave | ai-stack Round 2 Item 3 formal endorsement; three of five projects backing this going into federation interview |
| C.9 — GraphSnapshotAvailable → SourceLoaded is case 2 causation (hub-traversable, no back-reference needed) | Cerebra D.4 Round 2; classification confirmed |

---

End of reconciliation.

---

## needs-wiring

# LumaWeave — Needs Wiring Log

**Date:** 2026-06-16
**Filed by:** lumaweave-claude
**Purpose:** Track hard-coded values, missing bindings, and wiring ambiguities surfaced during federation design. All items must be resolved before or during the relay pass.

---

## Item 1 — indexed_tags missing: adapter_id, source_key on source events

**Element / binding location:** `events.rs:48`, `emit()` helper; specifically the `..Append::default()` spread. Affects calls at lines 72-77 (`lw_emit_source_loaded`), 87-91 (`lw_emit_source_load_failed`), 100-103 (`lw_emit_source_switched`).

**Assumed correct token/variable:**
- `SourceLoaded`: `indexed_tags = {adapter_id: <adapter_id param>, source_key: <source_key param>}`
- `SourceLoadFailed`: `indexed_tags = {adapter_id: <adapter_id param>, source_key: <source_key param>}`
- `SourceSwitched`: `indexed_tags = {to_adapter_id: <to_adapter_id param>}`

**Who needs to confirm:** LumaWeave (self — this is our own code to fix; no external confirmation needed).

**Confidence level:** high — these fields are agreed in reconciliation (S-016) and in the v2 §2.6 indexed_tags table.

**Brief context:** The `emit()` helper uses `..Append::default()` which leaves `indexed_tags` empty. The `adapter_id` and `source_key` values are passed as command parameters and written to the JSON payload, but NOT written to `indexed_tags`. Without indexed_tags, hub consumers cannot SQL-filter by adapter or source; `indexed_tags_filter` is a no-op. Must be fixed before relay pass. Fix: either update `emit()` to accept indexed_tags, or reconstruct the `Append` struct directly in each command function.

---

## Item 2 — indexed_tags missing: dialect_id on GraphLayoutSettled

**Element / binding location:** `events.rs:124-132`, `lw_emit_graph_layout_settled` command. Currently takes `node_count: u32` and `duration_ms: u32`. `dialect_id` is absent from the command signature, the JSON payload, and indexed_tags.

**Assumed correct token/variable:** `indexed_tags = {dialect_id: <active gwells dialect id at settle time>}`. The dialect id is the string identifier from `GW_DIALECT_REGISTRY` (e.g., `"gwells.dialect.spine-force"`).

**Who needs to confirm:** LumaWeave (self). The call site in the frontend must identify the active dialect at settle time; likely readable from `useSettingsStore.getState().physics.activeDialect`.

**Confidence level:** high — agreed in reconciliation (S-016) and v2 §2.6 table.

**Brief context:** This field must be added in two places: (1) the Rust `lw_emit_graph_layout_settled` command signature and JSON payload; (2) `invokeEmitGraphLayoutSettled` in `tauri-invoke.ts`. The frontend call site (currently deferred — gwells has no convergence signal) will also need to pass the active dialect ID when it's wired.

---

## Item 3 — dialect_id missing from GraphLayoutSettled command signature (Rust + TS)

**Element / binding location:**
- Rust: `events.rs:124`, `pub fn lw_emit_graph_layout_settled(store, node_count: u32, duration_ms: u32)`
- TS: `tauri-invoke.ts`, `invokeEmitGraphLayoutSettled(nodeCount: number, durationMs: number)`

**Assumed correct token/variable:** add `dialect_id: String` (Rust) / `dialectId: string` (TS) as a third parameter.

**Who needs to confirm:** LumaWeave (self).

**Confidence level:** high.

**Brief context:** Companion to Item 2. The command signature itself needs updating before the indexed_tags fix in Item 2 can take effect. The frontend mount point for this command is also deferred (gwells convergence signal), so the fix can be made without breaking anything active.

---

## Item 4 — Hub store path in relay agent (not yet written)

**Element / binding location:** `lumaweave-relay.py` — relay agent config (file does not exist yet).

**Assumed correct token/variable:** `hub_store_path = "~/.lattica/fossic/store.db"` (or resolved absolute path equivalent).

**Who needs to confirm:** CLOSED — confirmed by Lattica 2026-06-16.

**Confidence level:** confirmed.

**Brief context:** The relay agent is a standalone Python process separate from Tauri. It reads the local store at `<project_root>/.lumaweave/fossic.db` and writes to the hub. **Confirmed by Lattica:** the hub store is WAL-mode SQLite; `Store.open()` is designed for concurrent multi-process access — relay agents appending and Tauri tile subscriptions reading is the intended use pattern. No conflict. Hub path `~/.lattica/fossic/store.db` is stable across sessions. Relay agent config can hardcode this path.

---

## Item 5 — S-031 causation_id relay behavior ambiguity

**Element / binding location:** `lumaweave-relay.py` relay loop (not yet written); specifically the `causation_id` assignment when relaying a `SourceLoaded` event triggered by `GraphSnapshotAvailable`.

**Assumed correct token/variable:** when `event.causation_id` is not `None` on a local event (meaning LumaWeave set a causation_id at emit time pointing to a hub event): the relay agent should propagate `event.causation_id` to the hub copy rather than replacing it with `event.id`.

**Who needs to confirm:** Fossic (relay protocol authority) + Cerebra (chain design). Outbound filed: `outbound/2026-06-16_lumaweave_to_lattica_binding-question-s031-causation-relay.md`.

**Confidence level:** low — the v2 S-031 text says "causation_id = local_source_loaded_event.id" (same as S-030 standard relay behavior), but that would make the chain case-1 (local-store hop required), not case-2 (hub-traversable). The intent across reconciliation documents was case-2. There is a discrepancy between the S-031 text and the case-2 claim.

**Brief context:** The future `GraphSnapshotAvailable → SourceLoaded` chain requires the local `SourceLoaded` event to be emitted with `causation_id = <GraphSnapshotAvailable hub event ID>` (set by LumaWeave's frontend when it triggers a load from a hub event). The relay agent then propagates that causation_id to the hub copy, making the chain fully hub-traversable. If instead the relay agent replaces it with `event.id` (the local event's own ID), the hub chain becomes case-1 and requires a local-store query to traverse. Needs protocol confirmation before implementing either the relay agent or the SourceLoaded emitter changes.

---

## Item 6 — Local store path (informational; no fix required)

**Element / binding location:** `events.rs:34-35`
```rust
let db_dir = project_root.join(".lumaweave");
let db_path = db_dir.join("fossic.db");
```

**Assumed correct token/variable:** `<project_root>/.lumaweave/fossic.db` — intentional, correct for local-store-per-project model.

**Who needs to confirm:** no one; this is correct.

**Confidence level:** high — intentional design.

**Brief context:** This is LumaWeave's local store path. It does NOT need to change for federation. The relay agent handles the bridge to the hub. Logged here for completeness so future passes don't question this path.

---

## Item 7 — Hard-coded stream name constant

**Element / binding location:** `events.rs:5`
```rust
const STREAM: &str = "lumaweave/graph/events";
```

**Assumed correct token/variable:** correct as-is.

**Who needs to confirm:** no one; this is the agreed stream name per reconciliation and v2 §3.3.

**Confidence level:** high.

**Brief context:** Under D.3 (once ratified), this stream name passes through the relay agent unchanged — no double-prefix issue. Logged for awareness; no action required.

---

## Item 8 — SourceSwitched missing source_key in payload

**Element / binding location:** `events.rs:95-103`, `lw_emit_source_switched` command.

```rust
pub fn lw_emit_source_switched(
    store: State<'_, LwEventStore>,
    from_adapter_id: String,
    to_adapter_id: String,
) -> Result<(), String>
```

**Assumed correct token/variable:** consider adding `to_source_key: String` to the SourceSwitched payload. Currently SourceSwitched only carries adapter IDs, not source keys. Hub consumers who want to know "which specific source (not just adapter type) is now loaded" would need to cross-reference with the most recent SourceLoaded event.

**Who needs to confirm:** LumaWeave (self — design decision). Not a relay blocker; a payload completeness question.

**Confidence level:** medium — the current SourceSwitched shape may be sufficient if hub consumers always read the full SourceLoaded event for source_key context. Adding source_key to SourceSwitched is an enhancement, not a requirement.

**Brief context:** SourceLoaded carries both adapter_id and source_key. SourceSwitched only carries adapter IDs. If a user switches adapters, the hub event stream shows the transition (from/to adapter) but doesn't include the new source_key in the switch event itself. Lattica tile would need to join SourceLoaded to get the full picture. Adding to_source_key to SourceSwitched would make the tile simpler.

---

*End of needs-wiring.md*

---

## current_state

# LumaWeave — Current State Baseline

**Date:** 2026-06-16
**Filed by:** lumaweave-claude

---

## Section 1 — Current version + identity

- **Current version:** v0.19.0
- **Most recent tag:** none (version tracked in package.json only)
- **Most recent milestone commits:**
  - `4f28c47` — gwells: fix interaction index never populated (critical correctness fix)
  - `856dcd3` — gwells: fix hub-ring radius scaling
  - `977a6e8` — feat(events): add lifecycle event bridge (R-LW-005)
  - `c2eafbd` — feat(gwells): close lifecycle and headless polish
- **Identity:** A local-first, graph-based architecture-visualization workbench that renders code, docs, and configs as a typed node/edge network with custom physics layouts.

---

## Section 2 — What just shipped since last baseline

**gwells lifecycle and performance arc (c2eafbd and prior):**
Added `GWRuntimeState`, `GWDebugEvent`, `pause()`, `resume()`, `stop()`, `step()`, injectable scheduler, headless stepping, benchmark matrix, and interaction indexing by source well type. Structural resolver (`structuralResolver.ts`) moved well assignment away from string-literal filesystem matching toward topology-aware roles (root, spine, container, leaf, orphan, hub, bridge).

**gwells interaction-index bug fix (`4f28c47`):**
The ChatGPT-authored performance optimization declared `interactionsBySourceWellType` and switched the step loop to use it but never populated the Map. All inter-node forces (attraction, repulsion, spring, perpendicular) were silently dead every frame — only centerGravity and seedAdherence still ran. Nodes appeared to settle because seedAdherence pulled them toward seed positions, masking the breakage. Fixed: `rebuildResolvedInteractions()` now populates the index alongside the flat array. 12/12 gwells validation checks pass.

**gwells hub-ring radius fix (`856dcd3`):**
Both seeders were passing `Math.max(spineSpacing, directoryOffset)` (= 2400) as the arc-gap for hub-ring positioning. `directoryOffset` is a depth-level spacing value, not inter-ring-node clearance. With 46 root spines this produced a ring radius of ~35k. Fixed to `spineSpacing / 2` (= 600), giving ~8.8k radius.

**R-LW-005 — fossic event emission (`977a6e8`):**
LumaWeave now emits to fossic from the Rust Tauri backend. Stream `lumaweave/graph/events` declared. Five event types live: SourceLoaded, SourceLoadFailed, SourceSwitched, ThemeChanged, GraphLayoutSettled (command wired; frontend mount deferred pending gwells convergence signal). TypeScript invoke helpers in `src/lib/tauri-invoke.ts`. Wired at: `useGraphSourceSummary.ts` (SourceLoaded/Failed/Switched), `useLwThemeEventEmitter.ts` + `AppShell.tsx` (ThemeChanged).

**Re-settle audit:**
GWController has no `restart()`. Re-settle can be implemented as a `reheat()` method: zero all `nodeStates` velocities, optionally update `__gwellsSeedPositions` to current node positions so seedAdherence doesn't fight the new layout. Cost: S. `applyConfigOverride({ seedParams })` re-runs the seed function and resets positions — wrong path for Re-settle.

---

## Section 3 — Visual elements available for Lattica

### Fossic event stream

**Stream:** `lumaweave/graph/events`
**Current store:** `<project_root>/.lumaweave/fossic.db` (project-local — not yet on shared platform store; migration needed)

| Event type | Key payload fields | Renderer useful? |
|---|---|---|
| `SourceLoaded` | `adapter_id`, `source_key`, `node_count`, `edge_count` | Yes — primary health + size signal |
| `SourceLoadFailed` | `adapter_id`, `source_key`, `error` | Yes — error state, sticky in tile |
| `SourceSwitched` | `from_adapter_id`, `to_adapter_id` | Yes — context change signal |
| `ThemeChanged` | `from_theme_id`, `to_theme_id` | Optional — suppress by default |
| `GraphLayoutSettled` | `node_count`, `duration_ms` | Optional — dev/perf signal |

All types are flat PascalCase (matching Cerebra convention). No renderers exist yet — deferred until iter-4 design output and shared store are both in place.

### Cerebra `graph.json` adapter

Not built. No adapter for consuming `{vault}/.cerebra/graph.json` exists in the source adapter registry. Current adapter types: `self-graph`, `git-codebase`, `website-url`, `markdown-vault`, `cytoscape-json`, `openapi-spec`, `database-schema`, `package-dependency`, `cloud-infrastructure`, `issue-tracker`, `csv-edge-list`.

A Cerebra adapter would fit the registry shape and could be built when `graph.json` format is stable. Nothing blocks it architecturally — it's purely unbuilt.

### Iter-4 tile elements (wired status)

These were specified in the iter-4 design request. None are wired in Lattica's tree yet (read-only tile deferred to Track B):
- Graph health pill (LOADED / FAILED / LOADING / IDLE) — derivable from SourceLoaded/SourceLoadFailed events ✓
- Node/edge count badge — from SourceLoaded payload ✓
- Active source label — from SourceLoaded/SourceSwitched payload ✓
- Event type filter toggles [SRC] [LAYOUT] [THEME] — client-side, no API needed ✓
- All [API-NEW] controls (source switcher, retry, layout freeze, re-settle, physics preset) — blocked on shared store + reverse channel

---

## Section 4 — Open items / known follow-ups

**Blocked on shared platform fossic store:**
- All five [API-NEW] tile controls (source switcher, retry, layout freeze, re-settle, physics preset write)
- Lattica-side tile wiring (Track B, upcoming)
- Hidden [API-NEW] prerequisite: `AdapterListChanged` event emission needed for source switcher dropdown

**Deferred engine work:**
- `reheat()` controller method (S cost, waiting on Track B / tile control pass)
- `GraphLayoutSettled` frontend mount (gwells has no "settled" `GWRuntimeState` variant in v0.1.5; command registered in Rust, frontend not wired)
- Phase 2–6 gwells: macro controls, profile layer, specialized seed layouts, recommendation loop (all design-doc-only, not runtime)

**Known duplicate registry:**
`src/graph/physics/physicsDialectRegistry.ts` is a legacy v86e inventory registry still consumed by `GraphVisualInventoryPanel.tsx` for display listing. The real engine uses `GW_DIALECT_REGISTRY` from `src/physics/gwells/dialects.ts`. Different ID namespacing (`dialect.gwells.*` vs `gwells.dialect.*`). Safe to clean up — panel should iterate `listDialects()` from dialects.ts, then old registry deleted. Deferred.

**UI coverage gap:**
Engine supports `wellOverrides` and `interactionOverrides` via `applyConfigOverride` but UI only sends `seedParams`. Well/interaction controls not yet exposed.

---

## Section 5 — Cross-project signal

**gwells interaction-index bug interpretation note:**
Prior to `4f28c47` (landed 2026-06-15), all LumaWeave graph layouts were running without inter-node forces. Nodes settled via seedAdherence and centerGravity only. Layout behavior before this fix should be considered "seed-anchored drift," not full physics. Any visual benchmarks, screenshots, or layout quality assessments from before `4f28c47` reflect the broken state.

**Re-settle cost resolved:**
`reheat()` approach (S cost) is the correct implementation. Updating `BACKEND_PREP_REPORT.md` if not already reflected.

**Fossic path dep pattern:**
LumaWeave's `Option<Store>` degraded-mode Rust wrapper is documented in the cross-pollination file `cross-pollination/lumaweave/r-lw-005-fossic-emitter.md` — worth reading for any Tauri project integrating fossic.

---

## Section 6 — Pre-federation exploratory thoughts

**What stays local (high-volume, substrate-level):**
- Per-frame node position updates during gwells convergence — these are continuous mutations, not events. Not fossic-appropriate. Already handled entirely in-memory by the physics engine.
- Pin state changes (user dragging nodes) — fast, continuous, local
- Intermediate layout states during re-seeding or helix twist adjustments

**What relays to Lattica's hub (architectural decisions, completed states):**
- `SourceLoaded` / `SourceLoadFailed` / `SourceSwitched` — graph lifecycle events already live in fossic; these are exactly the kind of architectural decisions that are hub-relevant
- `GraphLayoutSettled` — final layout state, not intermediate frames; hub-relevant once the convergence signal is wired
- `ThemeChanged` — probably local only (may not be meaningful to the platform)
- Future: `AdapterListChanged` (needed for source switcher anyway)

**Existing data paths outside fossic:**
- `useSettingsStore` (Zustand + localStorage) — all settings including active adapter, dialect, helix twist, pin state. This is the primary LumaWeave state store. Not in fossic today.
- `src/fixtures/self-graph-generated.json` — the self-graph fixture, generated, not committed
- Local `fossic.db` at `<project_root>/.lumaweave/` — needs migration to shared platform store

**Fossic features worth specifically considering:**

*Branches* — Fossic flagged branches as genuinely applicable to LumaWeave's domain. This resonates: layout explorations are naturally branch-like. "I'm trying a knowledge-garden layout on this graph" = a branch of `lumaweave/graph/*`. If the layout doesn't work, drop the branch. If it does, merge it as the canonical layout state. This maps well onto how users actually experiment with gwells.

*Snapshots* — Graph state at convergence (node positions, well assignments, active dialect config) is exactly the kind of thing worth snapshotting. "What did this graph look like after I loaded the Cerebra source last Tuesday?" Currently nothing preserves this.

*Transforms at append time* — Less obvious utility for LumaWeave currently. Maybe: normalizing adapter_id to a display label at write time so downstream consumers don't need to dereference it. Exploratory.

*Aggregates over node/edge history* — Interesting if LumaWeave tracks graph growth over time (node count trending up/down as the codebase evolves). Not a current use case but natural for architecture visualization.

**Cerebra graph.json adapter — does federation change the consumption model?**
Yes, probably. Today the mental model is: LumaWeave polls a file artifact (`graph.json`). In a federated model, the cleaner path is: Cerebra emits a `GraphSnapshotAvailable` hub event with a reference to the snapshot, LumaWeave receives it and loads the graph. This avoids polling, makes the handoff observable, and fits naturally into the hub-relay pattern. The file artifact becomes an implementation detail, not the coordination mechanism.

**Concerns / unknowns:**
- Shared platform store path needs to be confirmed before anything can flow. This has been the blocker on all LumaWeave–Lattica integration work and should be the first thing resolved in the federation conversation.
- The settings store (Zustand/localStorage) and the fossic store represent two parallel state systems for LumaWeave. Federation may want some settings to be hub-observable (active adapter, dialect) which would require either emitting settings-change events or migrating those settings into fossic-backed storage. Worth scoping explicitly.
- If layout branches land, pin state needs to be branch-aware. Pins are currently stored in `useSettingsStore`. A branch switch should restore the pins that were active when that branch was last on. This is a medium-complexity constraint that affects any pin + branch design.

---

