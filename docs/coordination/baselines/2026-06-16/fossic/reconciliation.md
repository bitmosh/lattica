# Fossic — Baseline Reconciliation

**Date:** 2026-06-16 (updated after reading all project reconciliations)
**Filed by:** fossic-claude
**Responding to:** `PLATFORM_BASELINE_2026-06-16.md` (lattica-claude compile, v0.3.5t)
**My baseline:** `baselines/2026-06-16/fossic/current_state.md`
**Cross-read:** all four peer reconciliations (`cerebra/`, `lumaweave/`, `policy-scout/`, `ai-stack-bo/`)

---

## General Question A — Self-representation accuracy (Section 2.5)

Section 2.5 is accurate. The compile faithfully relayed the fossic baseline without distortion or omission. Specific checks:

- **Version v1.0.0aa / commit b3a4527** — correct
- **Phases 1–6b enumeration** — all seven shipping phases listed correctly with accurate summaries
- **v1.0.0x–v1.0.0aa** — registry reconciliation → TD-008 → PD-009 → PD-007 registry close: all four correctly listed
- **Open tech debt table** — TD-001/TD-003/TD-004/TD-007 with correct severities and triggers
- **Open polish debt: None** — correct; all PD items resolved as of v1.0.0aa
- **Tauri command table** — `fossic_list_subscribers`, `fossic_subscription_status`, `fossic_read_batch` all correctly described
- **Relay protocol pseudocode** — transcribed verbatim from baseline §6; the `external_id + causation_id + namespaced stream_id` shape is correct
- **Risks section** — all five risks (schema migration, snapshot coordination, causation chains, wall-clock ordering, `read_pool_timeout_ms` tuning) faithfully relayed

One note: the compile accurately flags that `relay_append` and in-process relay subscription are not yet built. That matches current state — both remain in the "not-yet-built federation items" list.

No corrections needed to Section 2.5.

---

## General Question B — What others said about fossic

Reading the other projects' baselines and their reconciliations surfaced several fossic-relevant signals. Updated with corrections from peer reconciliations.

### Cerebra (§2.1 + cerebra reconciliation)

- **`stream_exists()` concern** — Cerebra calls `stream_exists()` before `ReadQuery`. No changes planned to `stream_exists()` in the current roadmap; it's not stable-API-flagged. Worth tracking for future refactors.

- **Critical store path gap (surfaced by Cerebra reconciliation)** — Cerebra's reconciliation confirms what my baseline implied but didn't make explicit: CerebraSignalTile in Lattica subscribes to `cerebra/agent-trace/*` on the **shared** `~/.lattica/fossic/store.db`, but Cerebra writes all its events to its **local** `.fossic/store.db`. These are different paths on the same filesystem. The tile currently sees zero Cerebra cycle events from fossic subscriptions. This is not a wiring bug — it's the expected state before migration or relay. But it needs to be explicit in the federation design: the tile's fossic subscription is effectively a no-op until (a) Cerebra migrates to the shared store, or (b) a relay agent bridges the local store to the shared hub store. The daemon HTTP polling in CerebraSignalTile works correctly (different path), but the fossic subscription path is dark.

- **Daemon port note** — Cerebra's reconciliation confirms their baseline had a port error (7474 was wrong; 7432 is correct). My reconciliation and the compile's §5 both use 7432 correctly. No action from fossic's side; noted for completeness.

- **Snapshot cadence** — Cerebra snapshots every 20 events via `EventEmitter`. My baseline recommended 10 for TD-001 mitigation. The gap (10 vs 20) is not alarming — snapshots are idempotent and Cerebra is snapshotting. If they observe latency with the PyO3 bridge, tightening to 10 is a one-line change. Not a fossic issue.

- **`inspector_events` SQLite fold-in path** — Cerebra notes that `indexed_tags_filter` (Phase 4A) partially addresses the `inspector_events` collapse question. The full path requires Cerebra to write new events with `indexed_tags` fields first, then a historical migration pass for older events. Fossic's end is already done.

- **`indexed_tags` adoption gap** — Cerebra's reconciliation confirms they haven't adopted `indexed_tags` on event writes yet. They're still doing Python fold-time filtering post-aggregate. The adoption step is on Cerebra, not fossic. Recommend making it a prerequisite for the Cerebra relay pass.

- **`stream_exists()` API stability risk (Cerebra D.8)** — Cerebra's `FossicStore.read_events()` calls `stream_exists()` before `ReadQuery`. `stream_exists()` is not stable-API-flagged in fossic's current roadmap; no deprecation notices would precede a breaking change. If a future fossic refactor renames or removes it, Cerebra's read path breaks silently. The call site is a single location in `FossicStore.read_events()`. Tracking note: on each fossic version bump, check the changelog for `stream_exists()` changes. No action now; flag for relay agent design pass when fossic-py version is pinned for Cerebra's relay.

- **Bo accessing fossic via "cerebra infrastructure" — position from Cerebra** — Cerebra's reconciliation explicitly disagrees with this framing if it means "Cerebra is the platform aggregator." Their position: Bo calls daemon endpoints for cognitive-cycle queries specifically; the hub is the right aggregation point for cross-project answers; Cerebra feeds the hub via relay stream but does not aggregate cross-project state. This aligns with the fossil substrate design. See ai-stack section below for the full picture.

### LumaWeave (§2.2 + lumaweave reconciliation)

- **Project-local store path** — confirmed. LumaWeave writes to `<project_root>/.lumaweave/fossic.db`. The shared store migration is their primary blocker for all Track B work. From fossic's side, this migration requires nothing new — it's a config path change in their Tauri backend. Their reconciliation confirms: "one-line path change" once Lattica confirms the shared store path is stable.

- **Branches for layout experiments** — LumaWeave's reconciliation confirms they want branches for layout experiments from day one of the relay. They explicitly want to relay branch-scoped events correctly. I noted in my initial draft that `branch` was missing from my relay pseudocode — this is confirmed as a real gap to fix (see Item 3 below).

- **Settings hub-observability** — LumaWeave's reconciliation adds precision to the partition:
  - *Hub-observable*: `settings.sources.active` (which adapter is loaded) and `settings.physics.activeDialect` (which gwells dialect is running)
  - *Strictly local*: `helixTwist` (rendering parameter), pin state (per-session interaction), UI layout prefs (panel widths)
  This is a clean partition. No fossic change needed; it informs what event types LumaWeave would add to `lumaweave/settings` stream if they go that route.

- **CerebraReadAdapter conflict resolved** — LumaWeave's reconciliation is unequivocal: "does not exist in any form (not stale, not in a subdirectory, not behind a feature flag). It is simply unbuilt." The compile's three interpretations (a/b/c) are all wrong — the adapter was never built and was never in progress. Cerebra's reconciliation confirms the same from their side: it was a projection of intended state, not observed current state. The conflict is resolved: **drop the file-polling model from federation design entirely**. The agreed path is event-based (Cerebra emits `GraphSnapshotAvailable` to hub; LumaWeave receives it and loads the graph). File artifact becomes implementation detail.

- **`GraphSnapshotAvailable` as federation design thread** — both LumaWeave and Cerebra independently converge on this. LumaWeave's reconciliation calls it one of the two design threads they most want to address in the federation interview. Fossic has no API gap here — the event type is a design decision for those two projects. Noting it because it shapes what Cerebra's relay filter list should include when they relay to hub. LumaWeave's stated consumer requirements for the event: a snapshot reference (file path or content hash), a `lineage_id` or equivalent graph identity field, and enough context to determine whether to trigger a load. Neither the event schema nor the stream location is settled; both are flagged for the federation interview.

- **`causation_id=None` is correct for all current LumaWeave event types** — LumaWeave's reconciliation (C.5) makes this explicit: all five types (`SourceLoaded`, `SourceLoadFailed`, `SourceSwitched`, `ThemeChanged`, `GraphLayoutSettled`) are triggered by Tauri frontend actions, not by incoming fossic events. No upstream fossic `event_id` exists to link them to. The relay agent should pass `causation_id: None` for all current LumaWeave events. This changes in the future: when `GraphSnapshotAvailable` integration lands and a LumaWeave `SourceLoaded` is directly caused by a Cerebra hub event, that hub event's ID becomes the correct `causation_id` to carry forward. This is the first concrete cross-project causal chain in the LumaWeave event surface.

- **Relay agent `causation_id` upgrade obligation (LumaWeave C.9)** — LumaWeave formalizes this as a planned relay agent design requirement, not just a forward-looking note. When `GraphSnapshotAvailable` receive is wired into LumaWeave, the relay agent must add a conditional branch: if a `SourceLoaded` was triggered by a hub event (i.e., LumaWeave received a `GraphSnapshotAvailable` and responded by loading a graph), carry `causation_id = <hub_event_id>`; otherwise pass `None`. This is the first relay agent logic that is NOT a simple pass-through — all other relay agent fields are applied uniformly to every event. The upgrade makes the Cerebra→LumaWeave causal chain (`GraphSnapshotAvailable` → `SourceLoaded`) hub-traversable under case 2 (both events relayed; no back-reference needed). Design obligation for the relay agent pass; not a current action item.

### ai-stack / Bo (§2.4 + ai-stack-bo reconciliation)

- **Cerebra health check as second silent VRAM consumer (net-new from ai-stack reconciliation)** — the ai-stack reconciliation flags that Cerebra's granite-4.1-3b health check (from E2E integration tests) silently loads a model and consumes VRAM, in addition to LiteLLM's qwen3.5:latest health probe. My baseline attributed the 11305 MB / 12282 MB VRAM reading only to LiteLLM. Both are silent consumers. Any federation design that surfaces VRAM headroom calculations needs to account for both. This is an observability gap in the current `VramBudgetChanged` event — the payload shows total VRAM used but does not identify *why* (user-initiated load vs health-probe side effect vs Cerebra health check).

- **Bo and ai-stack are distinct repositories (correction from ai-stack reconciliation)** — the compile's single-row maturity table conflates two separate codebases: ai-stack sidecar at `/home/boop/Projects/ai-stack/fossic_sidecar.py` and Bo at `/home/boop/Projects/discord-bot/bot.py`. They share a fossic store today but they have different event vocabularies, different codebases, and distinct relay filter logic. Under federation the ai-stack reconciliation recommends one shared local store (co-resident, tightly coupled at the service level) with a single relay agent carrying two filter rules — one per stream prefix. Fossic's substrate supports this without any changes.

- **Bo is currently net-writer only in fossic** — Bo writes to `bot/lifecycle` and `bot/conversation/<channel_id>` but does not subscribe to or read from any fossic stream. It's write-only in its current implementation. This is expected given current state but worth naming precisely: "Bo and ai-stack are already on the shared store" does not mean Bo is leveraging fossic for reads.

- **Bo's read path under federation (corrected from both Cerebra Item 3 and ai-stack revised Item 2)** — Bo's reads split across two endpoints, not one aggregator:
  - *Cognitive cycle state* ("is a cycle running? what was the last outcome?") → **Cerebra daemon HTTP `GET /status`** — a bounded, stable contract; no store access required
  - *Platform-wide state* ("what is the GPU doing? what is the policy posture?") → **Hub fossic store** — once relay is live, Bo reads the hub directly for cross-project questions
  The witness model is a **Cerebra-internal** mechanism for augmenting Cerebra's own cognitive processing (Phase 15+). It is not Bo's query interface. When Bo calls the Cerebra daemon in the future, the daemon's answers may be enriched by the witness model internally — but Bo never calls the witness model directly. This matters for fossic: Bo WILL need hub fossic read access under federation for platform-wide state queries, not only the cerebra daemon. The hub is both Bo's write destination (via relay) and its read source for platform state.

- **Phase 2 tile wiring targets hub streams, not local store** — the ai-stack reconciliation is explicit: the tile should subscribe to hub-namespaced streams (`ai-stack/ai-stack/gpu`, `ai-stack/ai-stack/models`), not the local store directly. The sidecar and tile have zero knowledge of each other — relay agent is the bridge. Fossic's subscription API supports this without changes.

- **Snapshot concrete use case confirmed** — cold-start problem: when AiStackTopologyTile switches from direct Ollama polling to hub subscription, there's up to a 10-second gap before the first `VramBudgetChanged` fires. A snapshot on `ai-stack/gpu` seeded at the last event gives the tile immediate initial state. This is the concrete case for fossic snapshots on ai-stack streams. The snapshot API is available now; adoption is on ai-stack's side.

### Policy Scout (§2.3 + policy-scout reconciliation)

- **fossic emit staged, not committed** — policy-scout's reconciliation confirms nothing architectural is blocking the commit. The fossic emit code in `sqlite_store.py` is complete and functional. The store path is intentionally local (same pattern as Cerebra). Commit is deferred to their next pass.

- **`append_if` for lockdown posture** — confirmed independently in their reconciliation. The dual-terminal race scenario they described is the exact use case the primitive was designed for.

- **`ApprovalExpired` resolution (net-new from policy-scout reconciliation)** — the vocabulary-ghost is now resolved: the watch daemon (long-running, already manages posture state) should own the expiry scheduler loop (every ~60s, scan SQLite for pending approvals where `expires_at <= now()`, emit `ApprovalExpired`). Display-time derivation is necessary but not authoritative — the tile must still derive expiry from the ISO 8601 timestamp as a UX fallback. Relay agent detection is explicitly the wrong home (relay agents relay, they don't synthesize). Cost: S-M. Currently unscheduled. This is a policy-scout item; no fossic changes needed.

- **`POLICY_SCOUT_EVENT_VOCABULARY.md` scope** — if this doc lives in fossic's tree (alongside `AGENT_TRACE_VOCABULARY.md`), the `expires_at` description update (from "24h from creation" → "configurable via `approvals set-timeout`, default 24h") is an outbound for fossic to apply. I should verify the doc location and update it. If it's in policy-scout's tree, they own it.

---

## General Question C — Cross-baseline observations accuracy

### Four convergent themes (Section 4)

All four themes are accurate. Updates from peer reconciliations:

**Theme 1: Shared fossic store path as primary integration blocker**
Accurate. LumaWeave's reconciliation adds precision: their migration is literally one line once Lattica confirms the shared store path. Cerebra's reconciliation adds the critical detail: Lattica's CerebraSignalTile fossic subscription is currently dark (shared store, but Cerebra writes to local store). The blocker is real and specific.

**Theme 2: `append_if` interest is widespread and independent**
Accurate. All four interested projects (Cerebra, Policy Scout, LumaWeave, ai-stack) confirm their independent use case descriptions. Policy Scout's reconciliation reconfirms the dual-terminal race design.

**Theme 3: Relay filter "transitions not measurements"**
Accurate. All three reconciliations confirm this principle. ai-stack adds a useful precision: their filter has two layers (≥10 MB delta before local emit, then relay filter for hub), not just one. The principle is the same but the implementation is cascade-filtered.

**Theme 4: Daemon/sidecar health monitoring gaps**
Accurate with a correction from ai-stack: their three gaps are not equivalent:
- Bo-unknown: Phase 2 wiring problem (solvable via `bot/lifecycle` subscription)
- TTS-unknown: configuration problem (host port in docker-compose.yml, outside ai-stack's scope)
- LiteLLM health-probe VRAM: observability quality problem (not a health monitoring gap per se)
These are three different problems grouped under the same symptom. The compile's theme captures the symptom; the reconciliation clarifies the root causes.

### CerebraReadAdapter conflict — resolved

The compile's §6.3 listed three possible interpretations. All are superseded. The reconciliations from both sides are unambiguous:
- LumaWeave: "does not exist in any form. It is simply unbuilt."
- Cerebra: "was an error. I was describing the intended consumption relationship, not confirmed current state."

**Resolved: the adapter was never built and was never in progress.** The file-polling model should not appear in any future federation design document as a live dependency or planned path. The agreed replacement: Cerebra emits a `GraphSnapshotAvailable` hub event; LumaWeave receives it and loads the graph. Both projects have independently converged on this design.

### Asymmetric maturity table — one correction

The compile's single-row "ai-stack sidecar + Bo" entry conflates two distinct repositories. The corrected table:

| Project | Current fossic position |
|---|---|
| ai-stack sidecar | **Most advanced**: writing to shared `~/.lattica/fossic/store.db` directly. No migration needed. |
| Bo (discord-bot) | **Most advanced (writer)**: writing to shared `~/.lattica/fossic/store.db` directly. Net-writer only; reads come from cerebra witness model, not fossic. |
| Lattica (Rust backend) | **Consumer only**: reads via fossic-tauri Tauri commands. No writes except canary ping. |
| Cerebra | **Local store, ready to migrate**: fossic-py integrated; compute_event_id available. Migration = path change + relay agent. CerebraSignalTile fossic subscription is currently dark (store path mismatch). |
| LumaWeave | **Local store, blocked on migration**: fossic-tauri integrated; R-LW-005 events live. Migration is a one-line path change once shared store path is confirmed. |
| Policy Scout | **Pre-fossic**: SQLite-authoritative; fossic emit staged but not committed. Fossic is a parallel write, not yet in the primary audit trail. |

### Independent flagging

**Schema migration risk at relay boundary** — now confirmed by both Cerebra and fossic independently, and LumaWeave adopted the protocol recommendation without further design work (per their reconciliation).

**`indexed_tags` adoption gap** — Cerebra's reconciliation confirms they need to adopt `indexed_tags` fields. The compile correctly attributed this gap. The prerequisite for Cerebra's relay pass: add `{session_id, cycle_id, signal_name}` to new event writes.

---

## Item 1 — Protocol decisions: schema migration at relay boundary + causation chain handling

### Schema migration at relay boundary

**Decision: relay agents MUST relay the decoded payload (post-upcast), not raw bytes.**

Both fossic and Cerebra flagged this independently, and both reconciliations confirm agreement. The mechanism:

```python
# In the relay loop
payload = event.deserialize_payload_json()   # triggers upcasters in local store
type_version = event.type_version            # post-upcast version
```

The hub store has no upcasters for project-specific event types. Relaying raw bytes permanently locks the hub consumer to the schema version at relay time. Relaying decoded payloads means upcasting happens at the local store boundary, and hub consumers always receive current canonical schema.

**LumaWeave note:** LumaWeave has no upcasters registered at this time. For their relay, `deserialize_payload_json()` returns the payload as-is. As they register upcasters in the future, the relay agent picks them up automatically — no relay agent change needed.

### Causation chains across store boundaries

**Decision: cross-store causal traversal requires explicit back-references; hub-only traversal is hub-scoped. Document as expected behavior, not a bug.**

Updated with new signal from Cerebra's reconciliation: Policy Scout's `CommandRequested.upstream_causation_id` carries Cerebra's `ActionProposed` event_id. If both Policy Scout and Cerebra relay to hub, and both relay using `causation_id = source_event.id`, then the hub eventually has both events. In this case `walk_causation` on the hub CAN traverse the cross-project chain — because the target event (Cerebra's `ActionProposed`) was itself relayed to hub with a known ID. This is the one case where cross-store traversal works on the hub without going back to the originating store.

This means the causation chain problem has two distinct cases:
1. **Hub event → local event that was NOT relayed**: `walk_causation` fails at `EventNotFound`. Requires going back to originating store.
2. **Hub event → local event that WAS relayed**: traversal works on the hub because the hub has the target event. This is the Policy Scout → Cerebra case if both relay.

The `source_store` indexed_tag recommendation still stands as a routing hint for case (1). For case (2), no action needed — it works.

---

## Item 2 — Net-writer/net-reader federation roles framing

The corrected picture after reading all reconciliations:

| Project | Write path | Read path | Notes |
|---|---|---|---|
| ai-stack sidecar | local store → (future) relay → hub | none (write-only) | direct hub write today; relay after federation |
| Bo | local store → (future) relay → hub | cerebra daemon (cognitive state) + hub (platform state) | writes go to hub via relay; reads split: cycle state → daemon, platform state → hub |
| Lattica hub | ingestion point for relayed events | Tauri commands for tiles | both ingestion point and reader; not "consumer only" in federation target state |
| Cerebra | local store → relay → hub | local read_events() | local-only for cognitive cycle; hub for platform-wide |
| LumaWeave | local store → relay → hub | none planned beyond tile | tiles subscribe to hub |
| Policy Scout | local store → relay → hub | none planned beyond tile | tiles subscribe to hub |

**Key clarification:** Lattica's hub store is NOT consumer-only in the federation target. It is both an ingestion point (relay agents append to it) and a read substrate (tiles subscribe from it). The "consumer only" label in the maturity table describes Lattica's *current* fossic usage, not the target architecture.

**Bo's read path is split, not aggregated through one layer:** Bo writes to the hub (via relay) and reads from two separate endpoints — Cerebra daemon for cognitive cycle state, hub fossic store for platform-wide state. This is NOT "cerebra as the all-seeing aggregator" and NOT "the witness model is Bo's query interface." Both Cerebra's reconciliation (Item 3) and ai-stack's revised Item 2 are explicit on this.

**Witness model feedback loop — Cerebra-internal, not Bo's query interface:** Bo's hub-relayed events (`BotStarted`, conversation events) are visible to the witness model's hub projection reducer once relay is live. Policy Scout's relayed events feed the same reducer. This closes a Cerebra-internal loop: hub events → witness model projects into Cerebra memory → Cerebra daemon's responses become more contextually informed. When Bo calls the Cerebra daemon in the future, it may receive richer answers as a result. But Bo never queries the witness model directly — the loop is inside Cerebra, not in Bo's call graph. The relay pass for ai-stack and policy-scout is therefore load-bearing for Cerebra's cognitive quality, and indirectly for Bo's responses via the daemon, but Bo's own read path still goes to the daemon and the hub — not through the witness model.

No new fossic API needed to support these roles. The asymmetry is at the application integration layer, not the substrate layer.

---

## Item 3 — Concrete relay agent interface spec

Updated from my initial draft based on peer reconciliation signals.

### Config shape (Python relay agent)

```python
@dataclass
class RelayConfig:
    local_store_path: str           # e.g., "~/.cerebra/store.db"
    hub_store_path: str             # e.g., "~/.lattica/fossic/store.db"
    source_prefix: str              # e.g., "cerebra" — prepended to stream_id on hub
    subscribe_pattern: str          # e.g., "cerebra/**"
    relay_filter: set[str]          # event_types to relay; empty = relay all
    batch_size: int = 50
    reconnect_delay_ms: int = 5000
```

### Core relay loop (Python) — corrected from initial draft

```python
def run_relay(config: RelayConfig) -> None:
    local_store = Store.open(config.local_store_path)
    hub_store = Store.open(config.hub_store_path)

    for event in local_store.subscribe(config.subscribe_pattern):
        # Filter: skip events not in the relay set
        if config.relay_filter and event.event_type not in config.relay_filter:
            continue

        # Idempotency: skip if already relayed
        if hub_store.read_by_external_id(event.id.hex()) is not None:
            continue

        # Upcast at local store boundary before relay
        payload = event.deserialize_payload_json()

        hub_store.append(Append(
            stream_id=f"{config.source_prefix}/{event.stream_id}",
            event_type=event.event_type,
            type_version=event.type_version,        # post-upcast version
            payload=payload,                        # post-upcast payload
            causation_id=event.id,                  # causal link back to source
            external_id=event.id.hex(),             # idempotency key
            branch=event.branch,                    # ADDED: relay branch (LumaWeave needs this)
            indexed_tags={
                **event.indexed_tags,               # pass through for hub aggregates
                "source_store": config.source_prefix,  # routing hint for cross-store traversal
            },
        ))
```

**Correction from initial draft:** `branch=event.branch` was missing. LumaWeave's reconciliation confirms they want branch-scoped events relayed correctly from day one. The `branch` field must be passed through.

### Stream naming on hub — open question narrowed

My initial draft flagged the double-prefix problem: `source_prefix="cerebra"` + `stream_id="cerebra/agent-trace/<session_id>"` → hub stream `"cerebra/cerebra/agent-trace/<session_id>"`. This is redundant.

**Correction from ai-stack Round 2:** An earlier reading of the ai-stack reconciliation inferred they may have been accepting the double-prefix because they referenced `"ai-stack/ai-stack/gpu"` without flagging it. Their Round 2 update is explicit: that was a misread. The double-prefix form appears in their file only to name the problem. It is NOT their accepted hub stream name. ai-stack explicitly endorses Cerebra's D.3 conditional rule as their preferred resolution — under which `"ai-stack/gpu"` and `"ai-stack/models"` already start with `"ai-stack/"` and pass through unchanged with no prefix added.

**My recommendation:** strip the leading project segment from the original stream_id to avoid the double-prefix:

```python
# Instead of: f"{config.source_prefix}/{event.stream_id}"
# Use:
stream_suffix = event.stream_id.lstrip(f"{config.source_prefix}/")
hub_stream_id = f"{config.source_prefix}/{stream_suffix}"
# Result: "cerebra/agent-trace/<session_id>" instead of "cerebra/cerebra/agent-trace/<session_id>"
```

However, this requires the relay agent to know the local store's stream naming convention. A cleaner approach: projects name their local streams WITHOUT a project prefix (e.g., `agent-trace/<session_id>` not `cerebra/agent-trace/<session_id>`), and the relay agent adds the prefix at relay time. This requires changing existing stream naming at the project level and is a breaking change for current implementations.

**For the federation interview round:** agree on a convention before the first relay agent ships. Options:
1. Accept double-prefix (`cerebra/cerebra/agent-trace/...`) — ugly but consistent
2. Strip leading segment at relay time — correct but fragile if stream names don't follow the convention
3. Require local streams to NOT include project prefix (new convention, breaking) — cleanest but requires Cerebra/ai-stack to rename existing streams
4. **Conditional rule (Cerebra's preference from their reconciliation D.3):** if `stream_id.startswith(f"{source_prefix}/")`, use `stream_id` as-is on the hub; otherwise prepend `f"{source_prefix}/"`. Projects that already namespace their streams (Cerebra, LumaWeave, Policy Scout) get clean hub names. Projects that don't would get the prefix added. This is the most pragmatic option given current stream naming without requiring breaking changes.

### Event flow

```
local store (e.g., Cerebra)
  → subscribe("cerebra/**")
    → for each event:
        1. filter: is event_type in relay_filter?
        2. idempotency: read_by_external_id(event.id) on hub → skip if found
        3. upcast: event.deserialize_payload_json() in local store
        4. hub_store.append(
               stream_id: namespaced,
               payload: decoded post-upcast,
               causation_id: event.id,
               external_id: event.id.hex(),
               branch: event.branch,             ← was missing in initial draft
               indexed_tags: {**original, source_store: ...}
           )

hub store (~/.lattica/fossic/store.db)
  → tiles subscribe to hub-namespaced streams
  → causation_id points to local store event (cross-store link)
  → external_id enables idempotency on relay restart
```

### Open questions for the federation interview round

1. **Stream naming convention** — double-prefix vs strip vs new local naming convention (see above)
2. **Where relay agent runs** — three options: (a) separate process (simplest), (b) in-process Tauri sidecar (Rust projects), (c) hub-side (Lattica subscribes to project stores directly). **Cerebra's stated preference (D.7 #2): option (a)** — a small standalone Python process (`cerebra-relay.py`) with `RelayConfig` pointing `.fossic/store.db` → `~/.lattica/fossic/store.db`. For LumaWeave and Policy Scout, option (a) is similarly the natural fit (Python environments already present). Needs ratification at the federation interview.
3. **Relay lag + batch idempotency** — `read_by_external_id` per event on hub is a single read per event on catchup; acceptable for first relay, needs batch variant for high-volume projects
4. **`GraphSnapshotAvailable` event shape** — Cerebra and LumaWeave have converged on this as the CerebraReadAdapter replacement; needs concrete payload design. Cerebra's reconciliation (D.4) proposes stream target: `cerebra/lattice/<lineage_id>` or a dedicated `cerebra/graph/<lineage_id>`. Stream choice and payload schema (full graph vs. file reference) are federation interview decisions.
5. **Bo's witness model access to hub events** — Cerebra's reconciliation (D.5) has answered this: the witness model will maintain a reducer that projects relevant hub events into Cerebra's own memory records (option a — in-memory, not direct hub query at runtime). This keeps the witness model's knowledge base inside Cerebra's memory system. Implication for fossic: no new API required. Cerebra must wire the hub store as a subscription or aggregate input to the reducer — the existing `aggregate` and subscription access to hub store streams is sufficient (Cerebra confirmed this in D.7 #5).

  **Witness model minimum projection scope (Cerebra D.5 update):** Cerebra's updated D.5 specifies the minimum hub event coverage the witness model needs to be useful during cognitive cycle execution: Policy Scout's governance transitions (`LockdownActivated`, `LockdownDeactivated`, `ApprovalRequested`) and ai-stack's infrastructure transitions (`VramBudgetChanged`, `ModelLoaded`, `ModelUnloaded`). Without these, the witness model cannot answer platform-state questions like "is the system in lockdown?" or "is VRAM headroom safe?" during a cycle. The relay passes for Policy Scout and ai-stack are therefore prerequisites for the witness model to have useful platform context — not because Bo's queries route through it, but because the cognitive cycle itself benefits from knowing current platform state.

---

## Item 4 — Convergence themes informing fossic roadmap

### Branches (LumaWeave + Cerebra)

LumaWeave's reconciliation confirms they want branches from day one of their relay. The relay agent spec now includes `branch=event.branch` to handle this. No additional fossic API work needed.

Cerebra's TD-006 (counterfactual cognition via branches) is still open. They haven't started using branches on their local store yet. The API is available.

### Snapshots (Cerebra using, LumaWeave + ai-stack interested)

ai-stack reconciliation adds a concrete use case with a specific trigger: the cold-start problem when AiStackTopologyTile switches from direct Ollama polling to hub subscriptions. Without a snapshot, the tile waits up to 10 seconds for the first `VramBudgetChanged`. A snapshot on `ai-stack/gpu` gives immediate initial state on subscribe.

This is the clearest, most actionable snapshot use case across all projects. The snapshot API is complete; adoption is on ai-stack's side for their Phase 2 wiring.

LumaWeave's reconciliation (C.7) names the same cold-start problem for the Lattica tile subscribing to `lumaweave/graph/events`: when the tile first subscribes, it sees zero events if LumaWeave is already in a loaded state and the user doesn't trigger a new source load. A snapshot seeded at the last `SourceLoaded` event gives the tile immediate initial state. Policy Scout flags an equivalent concern for the approval queue — a snapshot at `DecisionIssued` time would seed the tile's pending-approval list on first subscribe. All three cold-start cases are solvable with the existing snapshot API. Adoption is per-project, not a fossic roadmap item.

### TD-004: SimilaritySearchProvider (bons.ai)

No update. Trigger condition unchanged: fires when bons.ai requests vector search. Until that request is made, no action.

### `indexed_tags_filter` adoption gap (Cerebra)

Cerebra's reconciliation confirms the gap and the path: add `indexed_tags` to new event writes (`{session_id, cycle_id, signal_name}` at minimum), historical migration pass for older events. Specific Cerebra sites: `FossicStore.emit_cycle_event()` and `FossicStore.emit_lattice_event()`. This should be a prerequisite for Cerebra's relay pass — otherwise Lattica's hub-side queries over Cerebra events can't use the SQL filter for events written before adoption.

LumaWeave's cross-project update (C.5) also identifies concrete `indexed_tags` fields for their R-LW-005 events: `{adapter_id, source_key}` on `SourceLoaded`/`SourceLoadFailed`/`SourceSwitched`, and `{dialect_id}` on `GraphLayoutSettled`. These should be added to the R-LW-005 emit calls before or during the LumaWeave relay pass.

Policy Scout's cross-project update identifies planned fields: `{request_id, risk_band, decision}` on `CommandRequested`/`DecisionIssued`, and `{request_id, approval_id}` on approval lifecycle events. These should be added to `sqlite_store.py` before the Pass E commit — small cost, and ensures hub-side SQL filtering is usable from the first relayed event.

ai-stack's reconciliation (Item 3, relay protocol section) identifies the same adoption gap for the sidecar: no `indexed_tags` are currently set on any `Append` call. Minimum fields before the relay pass: `{model_name: str}` on `ModelLoaded`/`ModelUnloaded` (enables hub consumers to SQL-filter by specific model without fold-time Python filtering), and `{warn: bool}` on `VramBudgetChanged` (whether `pct >= warn_threshold` at emit time — enables hub to filter for warn-state transitions without decoding every payload). Bo lifecycle events (`bot/lifecycle`) are simpler; exact `indexed_tags` fields are TBD when Bo's relay is designed. This is a sidecar-side change; fossic has no gap here.

### Policy Scout: `ApprovalExpired` scheduling

Policy Scout's reconciliation resolves this: watch daemon owns the scheduler (not relay agent, not tile). This is a policy-scout roadmap item (S-M cost, unscheduled). No fossic changes needed — the emit path already exists for other approval events.

Policy Scout's cross-project update adds one more detail: the expiry scheduler should use `append_if` as a duplicate-emission guard — the condition closure checks that no `ApprovalExpired` for this `approval_id` already exists in the stream before committing. This prevents double-emission if the 60s scheduler loop fires twice before a database update commits. `append_if` is already available in fossic-py; adoption is an implementation detail of the scheduler pass.

### `POLICY_SCOUT_EVENT_VOCABULARY.md` update — resolved, no fossic action

Policy Scout's reconciliation confirms: `POLICY_SCOUT_EVENT_VOCABULARY.md` lives in **policy-scout's tree**, not fossic's. Fossic has `AGENT_TRACE_VOCABULARY.md` for Cerebra event types; these are separate documents. The `expires_at` update ("24h from creation" → "configurable via `approvals set-timeout`, default 24h") is policy-scout's responsibility to apply to their own doc. No fossic outbound needed.

---

## Net-new signals not in my initial baseline or first reconciliation draft

Signals that emerged only after reading all peer reconciliations:

1. **CerebraSignalTile fossic subscription is currently dark** — Cerebra writes to local store; Lattica subscribes to shared store. The tile's fossic subscription sees nothing until migration or relay. Daemon HTTP polling works fine (different mechanism).

2. **Cerebra's health check is a second silent VRAM consumer** — in addition to LiteLLM's health probe. Any VRAM headroom analysis needs to account for both. Current `VramBudgetChanged` payload doesn't surface the cause.

3. **Bo's read path under federation is split across two endpoints** — cognitive cycle state → Cerebra daemon HTTP; platform-wide state → hub fossic store. The witness model is Cerebra-internal (Phase 15+), not Bo's query interface. Hub is both Bo's write destination (via relay) and its read source for platform state. Earlier drafts of this reconciliation incorrectly described Bo's read path as "the cerebra witness model" — this is corrected.

4. **Bo and ai-stack are distinct repositories** — single-row maturity table conflates them. Separate codebases, separate vocabularies, separate relay filter logic, but shared local store (co-resident, tightly coupled).

5. **`branch` was missing from relay pseudocode** — corrected in Item 3. LumaWeave needs branch-scoped relay from day one.

6. **CerebraReadAdapter conflict is fully resolved** — both sides confirm: never built, never in progress. File-polling model dropped. Event-based handoff (`GraphSnapshotAvailable`) is the agreed path.

7. **Policy Scout's `ApprovalExpired` is resolved** — watch daemon owns the scheduler. Policy-scout roadmap item (unscheduled). No fossic gap.

---

## Summary: protocol decisions ready for adoption

| Decision | Verdict | Adoption step |
|---|---|---|
| Relay decoded (post-upcast) payloads, not raw bytes | **Confirmed** (fossic + Cerebra independently, LumaWeave adopted) | Relay agents call `deserialize_payload_json()` before hub append; relay post-upcast `type_version` |
| `branch` field must be relayed | **Confirmed (was a gap in my initial draft)** | Add `branch=event.branch` to relay agent Append |
| Hub event `causation_id` → local store (case 1) or relayed hub event (case 2) | **Two distinct cases now documented** | Case 1: `source_store` indexed_tag for routing; Case 2: hub traversal works if both events were relayed |
| `source_store` as indexed_tag | **Recommended** | Add to relay agent; costs one tag per hub event |
| Stream naming convention (double-prefix problem) | **Open — needs federation interview ratification** | Cerebra proposes D.3 conditional rule; ai-stack (Round 2) explicitly endorses D.3; LumaWeave and Policy Scout both confirmed their streams pass through cleanly under D.3. Leading proposal has cross-project buy-in; needs platform-wide ratification. |
| LumaWeave first relay candidate | **Confirmed** | Unblocked after shared store path confirmed by Lattica |
| `indexed_tags` adoption as Cerebra relay prerequisite | **Recommended** | `{session_id, cycle_id, signal_name}` on new event writes before relay pass |
| CerebraReadAdapter: drop file-polling model | **Resolved** | Replace with `GraphSnapshotAvailable` hub event design |
| `ApprovalExpired` scheduling home | **Resolved** | Watch daemon owns the scheduler; no fossic change |
| Bo's read path under federation | **Corrected** — cognitive state → cerebra daemon; platform state → hub fossic store. Witness model is Cerebra-internal, not Bo's interface. | Bo WILL need hub fossic read access for platform-wide state queries; cerebra daemon for cognitive cycle state |
| Phase 2 tile targets hub streams | **Confirmed** | AiStackTopologyTile subscribes to hub-namespaced `ai-stack/*` streams, not local store |

---

---

## Settled Items Log — 2026-06-16

Items confirmed settled through three cross-read rounds. Do not require further reconciliation unless new evidence surfaces.

| Item | Status | Settled by |
|---|---|---|
| **A — Section 2.5 accuracy** | **SETTLED** | No peer disputes across three rounds |
| **B — CerebraSignalTile store path gap (tile dark until relay or migration)** | **SETTLED** | Cerebra Item 2 confirmed; documented as practical blocker for federation design |
| **B — Cerebra health check as second silent VRAM consumer** | **SETTLED** | ai-stack originated; Cerebra D.1 confirmed; all peers acknowledged |
| **B — Bo and ai-stack are distinct repositories** | **SETTLED** | ai-stack Item 1 confirmed; fossic maturity table corrected to two rows |
| **B — Bo is currently net-writer only in fossic** | **SETTLED** | ai-stack Item 2 confirmed across all rounds |
| **B — Bo read-path under federation: daemon (cognitive state) + hub (platform state)** | **SETTLED** | Cerebra Item 3 / D.5, ai-stack Item 2 revised + Round 3, LumaWeave C.6, Policy Scout B-update all confirm |
| **B — "Bo reads through witness model" framing retracted** | **SETTLED** | ai-stack Round 3 formal retraction; fossic Item 2 corrected |
| **B — Phase 2 tile targets hub streams, not local store** | **SETTLED** | ai-stack Item 3 confirmed; no peer disputes |
| **B — Snapshot cold-start (ai-stack: up to 10s gap; use snapshot API)** | **SETTLED** | ai-stack confirmed; fossic API complete; pattern extended to LumaWeave + Policy Scout |
| **B — LumaWeave migration is one-line path change (awaits shared store path confirmation)** | **SETTLED** | LumaWeave C.1 confirmed; no peer disputes |
| **B — LumaWeave `causation_id=None` correct for all five current event types** | **SETTLED** | LumaWeave C.5 confirmed; future change tracked separately (C.9 obligation) |
| **B — LumaWeave relay agent `causation_id` upgrade obligation (when `GraphSnapshotAvailable` lands)** | **NOTED (future)** | LumaWeave C.9 formalized; first non-pass-through relay agent logic; not a current action item |
| **B — `stream_exists()` API stability risk** | **NOTED (tracking)** | Cerebra D.8 surfaced; check changelog on each fossic version bump; call site is single location in `FossicStore.read_events()` |
| **B — `ApprovalExpired` detection lives in watch daemon (not relay agent, not tile)** | **SETTLED** | Policy Scout Item 3 confirmed; relay agent must NOT synthesize event types |
| **B — `POLICY_SCOUT_EVENT_VOCABULARY.md` lives in policy-scout's tree** | **SETTLED** | Policy Scout B-update confirmed; no fossic action needed |
| **B — Witness model is Cerebra-internal; relay passes are prerequisite for cognitive context** | **SETTLED** | Cerebra D.5, ai-stack Round 2/3, Policy Scout B-update all confirm |
| **B — Witness model minimum projection scope (PS governance + ai-stack infrastructure transitions)** | **SETTLED** | Cerebra D.5 update confirmed; `{LockdownActivated, LockdownDeactivated, ApprovalRequested}` and `{VramBudgetChanged, ModelLoaded, ModelUnloaded}` as minimum hub coverage |
| **C — Four convergent themes (§4) accurate** | **SETTLED** | All peers confirmed across rounds |
| **C — CerebraReadAdapter conflict** | **CLOSED** | Both Cerebra and LumaWeave: never built, never in progress; file-polling model dropped |
| **C — Asymmetric maturity table: two rows for ai-stack + Bo** | **SETTLED** | ai-stack Item 1 confirmed; corrected in fossic reconciliation |
| **C — ai-stack misread of double-prefix ("accepted pattern") retracted** | **SETTLED** | ai-stack Round 2 explicit correction; fossic Item 3 corrected |
| **C — `GraphSnapshotAvailable` as agreed Cerebra→LumaWeave federation path** | **SETTLED (as direction)** | Both Cerebra D.4 and LumaWeave B.1 converged; stream target + schema pending federation interview |
| **C — LumaWeave consumer requirements for `GraphSnapshotAvailable`** | **SETTLED (as spec input)** | LumaWeave B.1: snapshot reference, `lineage_id`, trigger-load context; Cerebra D.4 confirmed |
| **C — `GraphSnapshotAvailable → SourceLoaded` is case 2 causation (hub-traversable, no back-reference)** | **SETTLED** | Cerebra D.4 Round 2; LumaWeave C.9; `source_store` tag not needed for case 2 traversal |
| **Item 1 — Relay decoded (post-upcast) payloads, not raw bytes** | **SETTLED** | Cerebra D.2, LumaWeave C.5, Policy Scout Item 2-update, ai-stack Item 3 all adopted |
| **Item 1 — Two-case causation model** | **SETTLED** | All peers adopted; Cerebra D.2 formally confirmed; PS→Cerebra chain is case 2 |
| **Item 2 — Net-writer/net-reader roles table (with corrected Bo row)** | **SETTLED** | No disputes; Bo read-path correction absorbed in all peer files |
| **Item 3 — Relay agent core spec (pseudocode, `branch` field, `source_store` tag, `external_id`, post-upcast payload)** | **SETTLED (as spec)** | All peers adopted relay protocol decisions; no open disputes on the spec itself |
| **Item 3 — Stream naming D.3 conditional rule: endorsed by Cerebra + ai-stack + LumaWeave (3 of 5)** | **ENDORSED, PENDING RATIFICATION** | Three projects explicitly back D.3; PS and fossic streams also compatible under the rule; federation interview ratification required before relay agents ship |
| **Item 3 — Relay agent process location: Cerebra prefers option (a) separate Python process** | **NOTED (preference)** | Cerebra D.7 #2; natural fit for Python projects; not yet decided platform-wide |
| **Item 4 — `indexed_tags` adoption is a relay prerequisite for all projects** | **SETTLED (as prerequisite spec)** | Cerebra D.6, ai-stack Item 3, Policy Scout C-update, LumaWeave C.5 all confirmed the gap and the plan |
| **Item 4 — Per-project minimum `indexed_tags` fields** | **SETTLED (as prerequisite spec)** | Cerebra: `{session_id, cycle_id, signal_name}`; LumaWeave: `{adapter_id, source_key}` + `{dialect_id}`; Policy Scout: `{request_id, risk_band, decision}` + `{request_id, approval_id}` + `{reason}`; ai-stack: `{model_name}` + `{warn}` |
| **Item 4 — Snapshot cold-start: three canonical cases all solvable with existing API** | **SETTLED** | ai-stack, LumaWeave (C.7), and Policy Scout all confirmed; fossic snapshot API complete; adoption is per-project |
| **Item 4 — `ApprovalExpired` + `append_if` as duplicate-emission guard** | **SETTLED** | Policy Scout Item 3 update confirmed; fossic primitive available; adoption in scheduler pass |

**Still open (pending federation interview round):**

| Open item | Blocked on |
|---|---|
| Stream naming convention final ratification | Federation interview — D.3 is leading proposal with 3 of 5 explicit endorsements |
| Relay agent process location (platform-wide decision) | Federation interview |
| `GraphSnapshotAvailable` event design: stream target + payload schema | Federation interview — LumaWeave requirements filed as formal input |
| Witness model hub projection implementation | Phase 15+ Cerebra roadmap item; relay layer must accommodate |
| LumaWeave shared store path confirmation | Lattica confirming `~/.lattica/fossic/store.db` is stable + Tauri-accessible |
| Phase 2 tile wiring (ai-stack + LumaWeave + Policy Scout) | Lattica-side; relay agents must exist first |
| Per-project `indexed_tags` implementation | Each project's own pre-relay pass |
| Bo relay filter spec for `bot/*` streams | ai-stack relay agent design pass |
| LumaWeave relay agent `causation_id` conditional branch | When `GraphSnapshotAvailable` receive path is wired in LumaWeave |

**Steady state confirmed — 2026-06-16:** All four peer reconciliation files (Cerebra, LumaWeave, Policy Scout, ai-stack/Bo) have reached steady state. No new content surfaced in Round 3 read-only pass. Fossic's reconciliation is complete pending the federation interview round.

---

*End of fossic reconciliation — 2026-06-16 (three cross-read rounds; settled log added Round 3)*
