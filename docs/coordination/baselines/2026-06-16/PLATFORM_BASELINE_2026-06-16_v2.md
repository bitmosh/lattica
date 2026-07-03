# Platform Baseline — 2026-06-16 (v2)

> **Historical snapshot — 2026-06-16.** References to [redacted], [redacted], and discord-bot reflect their status at that date; those modules are now deprecated and removed from the platform.

**Compiled by:** lattica-claude (pass v0.3.5s — Reconciled Baseline + Lattica Brief Recompile)
**Compile date:** 2026-06-16
**Replaces:** `PLATFORM_BASELINE_2026-06-16.md` (v1, preserved at original path — do not modify)
**Status:** Authoritative reconciled snapshot as of 2026-06-16

## Compile Discipline

Source files are relayed faithfully. Every attribution is explicit. Estimates are the filing project's, not the compiler's. Open questions from reconciliation are relayed verbatim; the compiler does not take positions on them.

**D.X referencing convention:** Throughout this document and the source reconciliation files, `D.X` references (e.g., D.3, D.5, D.7) refer to items in Cerebra's reconciliation D-section (`baselines/2026-06-16/cerebra/reconciliation.md`). These items emerged as shared cross-project reference points during reconciliation because Cerebra was the most active proposer of naming/protocol conventions. The references are convenient shorthand; Cerebra's reconciliation should be consulted for the full item text. Per-project reconciliation files are in `baselines/2026-06-16/<project>/reconciliation.md`.

---

## §1 — Filing Metadata

| Field | Value |
|---|---|
| Baseline date | 2026-06-16 |
| Compile pass | v0.3.5s |
| v1 compile pass | v0.3.5t |
| v1 preserved at | `baselines/2026-06-16/PLATFORM_BASELINE_2026-06-16.md` |
| Reconciliation rounds | 3 (cross-read + write iterations) |
| Projects in reconciliation | Cerebra, LumaWeave, Policy Scout, ai-stack/Bo, Fossic |
| Projects outside reconciliation | Lattica (was running v0.3.5u + v0.3.5t in parallel) |
| Fossic settled items | 34 items (most comprehensive reconciliation) |
| Open items for federation interview | 9 items |

---

## §2 — Per-Project State (Reconciled)

### §2.1 Cerebra

**Path:** `/home/boop/Projects/cerebra/`
**Language:** Python 3.12+
**Current version:** 0.9.x (per original baseline)
**Fossic maturity:** Local store, ready to migrate; fossic-py integrated; `compute_event_id` available

**Reconciled state (from `cerebra/reconciliation.md`):**

Architecture confirmed:
- Daemon runs at port **7432** (confirmed against `cerebra/cli/daemon.py:290`; v1 §6.1 "7474 vs 7432" conflict is CLOSED)
- Cognitive cycle: Lattice ingest → Signal detect → Signal batch → LLM query → Action propose → Execute → Reflect
- Vault-scoped local fossic store: `.fossic/store.db` (per-project Cerebra vault directory)
- fossic-py fully integrated; `compute_event_id` available for indexed_tags relay protocol

**Wire-up with Lattica (confirmed):**
- Lattica's CerebraSignalTile polls `GET /status` (posture, cycle_running, active_session_id, last_outcome) — correct
- Lattica's v0.3.5u wiring at port 7432 is correct (daemon port confirmed)
- CerebraSignalTile fossic subscription `cerebra/agent-trace/*` on `~/.lattica/fossic/store.db` — **currently dark** (see §6.3)

**Indexed_tags adoption (pre-relay prerequisite):**
- `emit_cycle_event()`: add `{session_id, cycle_id, signal_name}` before relay pass
- `emit_lattice_event()`: same fields where applicable

**Relay protocol position:**
- Branch field: confirmed required (was missing in initial relay pseudocode — corrected)
- source_store indexed_tag: accepted; `"cerebra"` will be the value
- Relay agent preference: standalone Python process (option a) — small `cerebra-relay.py` with `RelayConfig`

**Witness model (Cerebra-internal, Phase 15+):**
- Projects relevant hub events into Cerebra's memory layer for cognitive cycle enrichment
- NOT a Bo query interface; Cerebra-internal only
- Minimum hub coverage needed: `LockdownActivated`, `LockdownDeactivated`, `ApprovalRequested` (from PS relay) + `VramBudgetChanged`, `ModelLoaded`, `ModelUnloaded` (from ai-stack relay)
- Prerequisites: Policy Scout relay + ai-stack relay must exist first

**Silent VRAM consumer:** `OllamaDirectAdapter.health_check()` loads `granite-4.1-3b-GGUF:Q4_K_M` into VRAM as a minimal inference call. This is the second of two independent silent VRAM consumers (LiteLLM health probe is the first). The 92% VRAM reading at baseline filing had two independent causes.

**Open questions filed in D.7:** GraphSnapshotAvailable stream target, relay agent process location, snapshot coordination, witness model projection wiring.

---

### §2.2 LumaWeave

**Path:** `src/` (within Lattica monorepo)
**Language:** TypeScript, React 19, Sigma.js, Zustand, Vite
**Current version:** per `package.json`
**Fossic maturity:** Local store, blocked on migration; one-line path change once shared store path confirmed

**Reconciled state (from `lumaweave/reconciliation.md`):**

CerebraReadAdapter: **does not exist in any form** — not stale, not in a subdirectory, not behind a feature flag. "It is simply unbuilt." (LumaWeave B.1; v1 §6.3 conflict CLOSED)

**GraphSnapshotAvailable — LumaWeave consumer requirements (B.1, filed as formal spec input):**
- Snapshot reference: file path or content hash
- `lineage_id` or equivalent graph identity field
- Enough context to determine whether to trigger a load (e.g., schema_version or event count)
- Stream target: open — `cerebra/lattice/<lineage_id>` OR dedicated `cerebra/graph/<lineage_id>` (federation interview item)
- Causation chain: GraphSnapshotAvailable → SourceLoaded = **case 2** (hub-traversable; `walk_causation` works because hub has both events once LumaWeave relays)

**Migration (C.1):**
- Blocked on: shared store path confirmation from Lattica's Tauri backend
- Implementation: one-line path change (`~/.lattica/fossic/store.db`) once confirmed
- Caveat: even after LumaWeave migrates, Cerebra's cycle events remain absent from hub until Cerebra also migrates or relay agent runs

**Relay protocol additions (C.5):**
- `branch` field: confirmed required (corrects the initial relay spec gap)
- `source_store` indexed_tag: `"lumaweave"` for all relayed events
- `causation_id`: source local event's ID for derived events; `None` for events without upstream cause
- `indexed_tags`: `{adapter_id, source_key}` on SourceLoaded/SourceFailed/SourceSwitched; `{dialect_id}` on GraphLayoutSettled (pre-relay prerequisite)
- External_id: source event's hex ID (idempotency gate)

**Settings hub-observability partition (C.3):**
- Hub-observable (relay-worthy): `sources.active`, `activeDialect`
- Local only (not hub-worthy): `helixTwist`, pin state, UI preferences

**D.3 endorsement (C.8):** LumaWeave explicitly endorses conditional strip rule. LumaWeave's hub stream names under D.3: `lumaweave/graph/events`, `lumaweave/layout/<graph_id>`, etc. (identical to local; no double-prefix).

**Snapshot cold-start (C.7):** Tile subscribes after LumaWeave already in loaded state → blank until user triggers source load. Resolution: snapshot seeded at last `SourceLoaded` event on subscribe.

**Bo read-path correction (C.6):** Confirmed: cognitive cycle state → Cerebra daemon HTTP; platform-wide state → hub directly. Witness model is not in Bo's read path.

---

### §2.3 Policy Scout

**Path:** `/home/boop/Projects/policy-scout/`
**Language:** Python 3.12+
**Current version:** per original baseline
**Fossic maturity:** Pre-fossic; SQLite-authoritative; fossic emit staged (not committed)

**Reconciled state (from `policy-scout/reconciliation.md`):**

**Fossic emit (Item 2, updated):**
- `policy_scout/audit/sqlite_store.py`: complete and functional
- Local store path: intentional design (same pattern as Cerebra); per-project vault approach
- indexed_tags to be added before commit (Pass E bundle): `{request_id, risk_band, decision}` on CommandRequested/DecisionIssued; `{request_id, approval_id}` on ApprovalRequested/Approved; `{reason}` on LockdownActivated/LockdownDeactivated
- `POLICY_SCOUT_EVENT_VOCABULARY.md`: lives in policy-scout's own tree; PS owns the expires_at field and will update the vocabulary itself

**ApprovalExpired detection (Item 3):**
- Home: watch daemon scheduler (~60s loop, scan SQLite for `expires_at <= now()`)
- `append_if` as duplicate-emission guard (prevents double-emit on loop overlap)
- Display-time derivation necessary for UX but not authoritative
- Relay agents relay; they do not synthesize new event types
- Status: design settled; implementation unscheduled (S-M cost)

**Tauri response wrapper (B.1, clarified):**
- Policy Scout's `CliJsonResponse` wrapper (`{ok, exit_code, data, error, stderr_summary}`) serves PS's own UI diagnostic needs
- Lattica's inner-JSON parsing is the correct integration pattern
- Two patterns confirmed intentionally separate; non-blocking

**Cross-store causation (upstream_causation_id):**
- `CommandRequested.upstream_causation_id` → `ActionProposed` (Cerebra) = case 2 once both relay
- Hub-traversable causation chain: no store-boundary back-reference needed once both PS and Cerebra relay
- `upstream_causation_id` field accepted in PS's relay protocol adoption

**Witness model feedback loop:** PS relay serves two functions: (1) Bo's direct hub queries for governance transitions; (2) Cerebra's witness model reducer input for cognitive cycle context.

**Snapshot cold-start concern:** approval queue blank on first tile subscribe. Resolution: snapshot seeded at most recent `DecisionIssued` event on subscribe. Adoption is Lattica-side.

**Bo read-path correction:** confirmed adopted in Policy Scout reconciliation.

**Open items:** ALLOW SESSION enforcement (L-cost, deferred); ALLOW PATTERN; Rule mute mechanism.

---

### §2.4 ai-stack

**Path:** `/home/boop/Projects/ai-stack/`
**Key files:** `fossic_sidecar.py` (at repo root)
**Language:** Python + Docker (Ollama, LiteLLM, Open WebUI)
**Fossic maturity:** Most advanced — writing directly to shared `~/.lattica/fossic/store.db`

**Reconciled state (from `ai-stack-bo/reconciliation.md`, Round 3):**

**Repository identity (Item 1):**
- ai-stack sidecar: `/home/boop/Projects/ai-stack/fossic_sidecar.py`
- Distinct from Bo (separate codebases, different vocabularies)
- Under federation: one shared local store (co-resident with Bo), single relay agent with two filter rule sets (one per stream prefix)

**Relay protocol adoption (Item 3, Round 2):**
- D.3 conditional strip rule: **explicitly endorsed** (most advanced current fossic user; Round 2 explicit)
- `branch` field: confirmed in relay agent design
- `source_store` indexed_tag: `"ai-stack"` for all sidecar-emitted events
- `external_id`: local event hex ID for idempotency
- Post-upcast payload: payload upcasted at local boundary before relay
- indexed_tags gap identified: `{model_name}` on ModelLoaded/ModelUnloaded; `{warn: bool}` on VramBudgetChanged — must be added before relay pass

**Silent VRAM consumer:** LiteLLM health probe probes `ollama/qwen3.5:latest` → loads model into VRAM. The 92% VRAM reading at baseline filing had two independent causes (this + Cerebra health_check).

**Hub-mediated arc confirmed:** sidecar → local store → relay agent → hub → Lattica tile (Round 3 confirmation).

**Phase 2 tile wiring:** depends on indexed_tags implementation in sidecar (pre-relay prerequisite). Snapshot cold-start pattern planned: snapshot seeded at `ai-stack/gpu` on tile subscribe, eliminating up to 10s gap.

**Bo relay filter spec:** bot/* stream relay filter rules to be designed in ai-stack relay agent pass (open for federation interview).

---

### §2.5 Bo (discord-bot)

**Path:** `/home/boop/Projects/discord-bot/`
**Key file:** `bot.py`
**Language:** Python 3.11+
**Fossic maturity:** Writing to shared `~/.lattica/fossic/store.db`; net-writer only (no reads)

**Reconciled state (from `ai-stack-bo/reconciliation.md`, Round 3):**

**Repository identity:** Separate repo from ai-stack (confirmed). Same local store path as ai-stack today (co-resident). Under federation: stays co-resident; one shared local store, single relay agent with two filter rules.

**Current fossic role:** Net-writer only. Writes to `bot/lifecycle` and `bot/conversation/<channel_id>`. Does NOT subscribe/read from fossic currently.

**Bo read paths under federation (corrected — retraction of "Bo reads through witness model"):**
1. Cognitive cycle state → Cerebra daemon HTTP `GET /status` (posture, cycle_running, active_session_id, last_outcome)
2. Platform-wide state (governance, GPU headroom, service health) → Hub fossic store **directly**
3. Witness model: NOT in Bo's read path; Cerebra-internal only

**Relay filter spec for bot/* streams:** open for federation interview.

---

### §2.6 Fossic

**Path:** `/home/boop/Projects/lattica/lattica/eval-core/` (fossic library) + `~/.lattica/fossic/store.db` (shared store)
**Language:** Rust (crate), Python (fossic-py), TypeScript (napi-rs bindings)
**Fossic maturity:** Hub store itself; provides Store API to all consuming projects

**Reconciled state (from `fossic/reconciliation.md`):**

**Stream naming convention (Item 1, D.3):**
- Options 1-4 enumerated (flatten, conditional strip, explicit mapping, namespaced)
- D.3 conditional strip rule: **leading proposal**, 3-of-5 explicit endorsements (Cerebra proposer, ai-stack Round 2, LumaWeave C.8); Policy Scout implicit alignment; Fossic pending ratification; **Lattica position needed for full ratification**
- Rule: if `stream_id.startswith(f"{source_prefix}/")`, use `stream_id` on hub; else prepend `f"{source_prefix}/"`

**Two-case causation model (Item 1):**
- Case 1: Hub event A → local event B (NOT relayed) — `walk_causation` fails at `EventNotFound`; consumer must use `source_store` indexed_tag to route back to originating store
- Case 2: Hub event A → local event B (relayed) — hub-side `walk_causation` traverses; hub has both events

**Relay agent spec (Item 3, corrected):**
```python
@dataclass
class RelayConfig:
    local_store_path: str
    hub_store_path: str
    source_prefix: str
    subscribe_pattern: str
    relay_filter: set[str]
    batch_size: int = 50
    reconnect_delay_ms: int = 5000

def run_relay(config: RelayConfig) -> None:
    local_store = Store.open(config.local_store_path)
    hub_store = Store.open(config.hub_store_path)
    for event in local_store.subscribe(config.subscribe_pattern):
        if config.relay_filter and event.event_type not in config.relay_filter:
            continue
        if hub_store.read_by_external_id(event.id.hex()) is not None:
            continue
        payload = event.deserialize_payload_json()
        hub_store.append(Append(
            stream_id=f"{config.source_prefix}/{event.stream_id}",  # D.3 conditional strip applied here
            event_type=event.event_type,
            type_version=event.type_version,
            payload=payload,
            causation_id=event.id,
            external_id=event.id.hex(),
            branch=event.branch,   # CRITICAL: was missing in initial draft
            indexed_tags={**event.indexed_tags, "source_store": config.source_prefix},
        ))
```

**Per-project indexed_tags minimum fields (Item 4):**

| Project | Event type | Required indexed_tags |
|---|---|---|
| Cerebra | cycle events (emit_cycle_event, emit_lattice_event) | session_id, cycle_id, signal_name |
| LumaWeave | SourceLoaded, SourceFailed, SourceSwitched | adapter_id, source_key |
| LumaWeave | GraphLayoutSettled | dialect_id |
| Policy Scout | CommandRequested, DecisionIssued | request_id, risk_band, decision |
| Policy Scout | ApprovalRequested, Approved | request_id, approval_id |
| Policy Scout | LockdownActivated, LockdownDeactivated | reason |
| ai-stack | ModelLoaded, ModelUnloaded | model_name |
| ai-stack | VramBudgetChanged | warn (bool) |

**Snapshot cold-start (Item 2):** Three canonical cases, all solvable with existing fossic snapshot API:
- ai-stack: tile switches from Ollama polling to hub subscription; up to 10s gap; snapshot on `ai-stack/gpu` seeds state
- LumaWeave: tile subscribes when LumaWeave already loaded; blank until next source load; snapshot at last `SourceLoaded`
- Policy Scout: approval queue blank on first subscribe; snapshot at `DecisionIssued` seeds pending list

**Relay agent process location (Item 3):** open for federation interview; leading preference is standalone Python process per project.

---

### §2.7 Lattica

**Path:** `src/` (TypeScript/React shell) + `src-tauri/` (Rust backend)
**Fossic maturity:** Consumer only currently (Rust backend; both ingestion point AND read substrate in target)

**Current role:** Tiles subscribe from hub store via `fossic-tauri` Rust commands. Hub store at `~/.lattica/fossic/store.db` — this IS the shared federation hub.

**Federation target role:** BOTH ingestion point (relay agents from all projects append here) AND read substrate (tiles subscribe here). Lattica is the hub.

**CerebraSignalTile:** Fossic subscription `cerebra/agent-trace/*` on shared store — currently dark (Cerebra writes to local store; see §6.3). Daemon HTTP polling at 7432 works correctly.

**Shared store path:** Must be confirmed stable for LumaWeave migration. This is an actionable item — LumaWeave's migration is blocked on this confirmation from Lattica's Tauri backend.

---

## §3 — Cross-Project Dependencies (Reconciled)

### §3.1 Event/artifact dependencies

| Produces | Consumes | Mechanism | Status |
|---|---|---|---|
| Cerebra: `GraphSnapshotAvailable` (NEW) | LumaWeave: graph load trigger | Hub event subscription | **Not yet implemented** — Agreed federation direction; replaces file-artifact model |
| Cerebra: `GraphSnapshotAvailable` | LumaWeave: `SourceLoaded` (case 2 causation) | Hub `walk_causation` | Planned, pending both projects relaying |
| Cerebra: graph.json file | LumaWeave: (OLD — CerebraReadAdapter) | File polling | **DEPRECATED** — CerebraReadAdapter never built; this model is closed |
| Policy Scout: fossic emit (staged) | Cerebra: witness model input (via hub) | Hub relay | Pending: PS fossic commit + relay pass |
| Policy Scout: fossic emit | Bo: governance state queries | Hub direct | Pending: PS fossic commit + relay pass |
| ai-stack sidecar: fossic write | Lattica tiles: VramBudgetChanged | Hub subscription | Live (sidecar writes to shared store today) |
| ai-stack sidecar: fossic write | Cerebra: witness model (VramBudgetChanged etc.) | Hub relay (future) | Pending: indexed_tags + relay pass |
| Cerebra: daemon HTTP | Lattica: CerebraSignalTile status | HTTP GET /status | Live (7432 confirmed) |
| Policy Scout: CLI subprocess | Lattica: governance actions | Tauri subprocess | Live (Track A) |

### §3.2 Per-project indexed_tags (relay prerequisite)

See §2.6 table for per-project fields. All four emitting projects (Cerebra, LumaWeave, Policy Scout, ai-stack) must implement indexed_tags additions before their relay pass. This is a prerequisite, not an optional enhancement — the `source_store` field in particular is required for case-1 causation traversal.

### §3.3 Relay topology (target architecture)

```
[Cerebra vault store] ──relay──► [~/.lattica/fossic/store.db (hub)]
[LumaWeave local store] ──relay──►       (shared hub, ~/ path)
[Policy Scout local store] ──relay──►
[ai-stack+Bo local store] ──relay──►         ▲   ▲
                                       Lattica tiles read via fossic-tauri
```

Stream prefix conventions (under D.3 conditional strip rule, pending ratification):
- Cerebra events: `cerebra/<stream_name>` (e.g., `cerebra/agent-trace/<session_id>`)
- LumaWeave events: `lumaweave/<stream_name>` (e.g., `lumaweave/graph/events`)
- Policy Scout events: `policy-scout/<stream_name>` (e.g., `policy-scout/audit/<request_id>`)
- ai-stack events: `ai-stack/<stream_name>` (e.g., `ai-stack/gpu`)
- Bo events: `bot/<stream_name>` (e.g., `bot/conversation/<channel_id>`)

### §3.4 Asymmetric fossic maturity (updated — two rows for ai-stack and Bo)

| Project | Current fossic position |
|---|---|
| ai-stack sidecar | Most advanced: writing to shared `~/.lattica/fossic/store.db` directly |
| Bo (discord-bot) | Also writing to shared store; net-writer only (no reads) |
| Lattica (Rust backend) | Consumer only currently; both ingestion point AND read substrate in federation target |
| Cerebra | Local store, ready to migrate; fossic-py integrated; compute_event_id available |
| LumaWeave | Local store, migration blocked pending shared store path confirmation; one-line change once confirmed |
| Policy Scout | Pre-fossic; SQLite-authoritative; fossic emit staged (not committed); indexed_tags missing from staged code |

---

## §4 — Cross-Baseline Observations (Reconciled)

### §4.1 Transitions not measurements (confirmed platform-wide)

All five projects confirmed independently: fossic stores state transitions (events), not telemetry measurements. VramBudgetChanged emits when pressure band changes; not on every polling interval. LumaWeave emits SourceLoaded on transition, not on every frame. Policy Scout emits DecisionIssued on transition, not on every check. This is the correct model; confirmed across all reconciliation files.

### §4.2 Stream naming D.3 adoption pattern

D.3 is the platform-wide stream naming convention decision point. Without it, relay pseudocode produces redundant double-prefixes (`cerebra/cerebra/...`) across all emitting projects. The conditional strip rule resolves this cleanly for all four emitting projects under their current stream naming conventions. 3-of-5 endorsements. Lattica's position is the remaining needed input for full ratification (federation interview item 8.1).

### §4.3 Bo read-path correction (fully settled)

The formulation "Bo reads from Cerebra's witness model as all-seeing aggregator" was incorrect and is retracted. Correct model: Bo reads cognitive cycle state from Cerebra daemon HTTP; Bo reads platform-wide state from hub fossic store directly. The witness model is Cerebra-internal only. This correction propagated through all five reconciliation files (Cerebra D.5, LumaWeave C.6, Policy Scout B-update, ai-stack/Bo Round 3 retraction, Fossic Item 2).

### §4.4 Two-project convergences that emerged independently

These items were confirmed independently by two projects without the other's file being in context at the time:
- CerebraReadAdapter: both Cerebra and LumaWeave concluded "never built" independently
- D.3 endorsement: Cerebra proposed; ai-stack and LumaWeave endorsed in separate reconciliation files
- Bo read-path correction: originated in ai-stack/Bo Round 3 retraction; confirmed in all four other files
- indexed_tags as relay prerequisite: Fossic required it; all four emitting projects accepted it independently

### §4.5 Silent VRAM consumers (settled as dual-cause)

The 92% VRAM reading at baseline filing had two independent causes: (1) LiteLLM health probe loads `ollama/qwen3.5:latest`; (2) Cerebra `OllamaDirectAdapter.health_check()` loads `granite-4.1-3b-GGUF:Q4_K_M`. Both are always running at system baseline. This is not a spike — it is the steady-state floor with both services active.

### §4.6 Settings hub-observability partition

From LumaWeave C.3, endorsed by Fossic: LumaWeave settings split into hub-observable (relay-worthy) vs. local-only. Hub-observable: `sources.active`, `activeDialect`. Local-only: `helixTwist`, pin state, UI preferences. Hub-observable events from these settings feed into potential Cerebra cognitive context and Bo status queries; local-only settings do not belong on the hub.

---

## §4.X — Reconciliation Convergence (Settled Items Log)

This section preserves all settled items from the five reconciliation files, granularly with cross-attribution. Not compressed to themes. Items from multiple sources are cross-referenced.

**[S-001] Daemon port correction**
- Source: Cerebra D.9 item 1; v1 §6.1 CLOSED
- Cerebra daemon default port is **7432**, confirmed against `cerebra/cli/daemon.py:290`. The v1 "7474 vs 7432" conflict arose from a documentation inconsistency in an earlier file. Lattica's v0.3.5u wiring at 7432 is correct.

**[S-002] CerebraReadAdapter never built**
- Source: Cerebra D.9; LumaWeave B.1; Fossic settled log; v1 §6.3 CLOSED
- Cerebra: "I was describing the intended consumption relationship, not confirmed current state." LumaWeave: "does not exist in any form (not stale, not in a subdirectory, not behind a feature flag). It is simply unbuilt."
- Resolution: file-polling model closed; GraphSnapshotAvailable hub event model adopted as replacement.

**[S-003] GraphSnapshotAvailable as federation target**
- Source: Cerebra D.4; LumaWeave B.1; Fossic settled log
- Agreed: Cerebra emits `GraphSnapshotAvailable` hub event with snapshot reference; LumaWeave subscribes and loads graph. `graph.json` continues to be written by Cerebra on every ingest but becomes an implementation detail.
- LumaWeave consumer requirements (B.1): snapshot reference, lineage_id, enough context to trigger-or-skip load.
- Stream target and payload schema: open for federation interview (§8.2).

**[S-004] Two-case causation model**
- Source: Fossic Item 1 (formalized); adopted by all five projects
- Case 1: Hub event → local event NOT relayed → `walk_causation` fails; consumer routes back to originating store via `source_store` indexed_tag.
- Case 2: Hub event → local event that WAS relayed → hub-side `walk_causation` traverses; hub has both events.
- All downstream causal chain design should be classified against this model before implementation.

**[S-005] First cross-project causal chain: GraphSnapshotAvailable → SourceLoaded**
- Source: Cerebra D.9; LumaWeave C.9; Fossic settled log
- Classification: **Case 2** (hub-traversable). Both events will be relayed to hub. `walk_causation` from `SourceLoaded` traverses to `GraphSnapshotAvailable` without store-boundary back-reference.

**[S-006] PS → Cerebra causation chain**
- Source: Policy Scout reconciliation; Fossic settled log
- `CommandRequested.upstream_causation_id` → `ActionProposed` (Cerebra) = **Case 2** once both PS and Cerebra relay. Hub-traversable without requiring local store queries.

**[S-007] Witness model scope — Cerebra-internal only**
- Source: Cerebra D.5; LumaWeave C.6; Policy Scout B-update; ai-stack/Bo Round 3 (retraction); Fossic Item 2
- Witness model: enriches Cerebra's own cognitive cycle by projecting hub events into Cerebra's memory layer.
- Witness model is NOT a Bo query interface. Bo reads hub directly.
- Scoped to Phase 15+; does not affect current architecture.

**[S-008] Minimum witness model hub projection scope**
- Source: Cerebra D.5; Fossic settled log
- Minimum set of hub events Cerebra needs projected into witness model: `LockdownActivated`, `LockdownDeactivated`, `ApprovalRequested` (from Policy Scout relay) + `VramBudgetChanged`, `ModelLoaded`, `ModelUnloaded` (from ai-stack relay).
- Prerequisites: Policy Scout relay + ai-stack relay must exist first.

**[S-009] Bo read-path split**
- Source: ai-stack/Bo Round 3 (retraction of "Bo reads through witness model"); Cerebra D.9; LumaWeave C.6; Policy Scout B-update; Fossic Item 2
- Path 1 (cognitive cycle state): Cerebra daemon HTTP `GET /status`
- Path 2 (platform-wide state): Hub fossic store directly (once relay agents are live)
- Prior formulation "Bo reads from Cerebra's witness model as all-seeing aggregator" is retracted in all five reconciliation files.

**[S-010] Bo and ai-stack are separate repositories**
- Source: ai-stack/Bo Item 1; Fossic settled log
- ai-stack sidecar: `/home/boop/Projects/ai-stack/fossic_sidecar.py`
- Bo: `/home/boop/Projects/discord-bot/bot.py`
- Both write to shared `~/.lattica/fossic/store.db` today. Under federation: one shared local store, single relay agent with two filter rule sets (one per stream prefix).
- v1's single "ai-stack sidecar + Bo" row in the maturity table is corrected to two rows (see §3.4).

**[S-011] D.3 conditional strip rule — endorsement state**
- Source: Cerebra D.3 (proposer); ai-stack/Bo Round 2 (explicit); LumaWeave C.8 (explicit); Policy Scout (implicit); Fossic (pending ratification)
- Rule: if `stream_id.startswith(f"{source_prefix}/")`, use `stream_id` on hub; else prepend `f"{source_prefix}/"`.
- 3 of 5 explicit endorsements as of reconciliation close. Not yet ratified — federation interview item 8.1.
- Lattica position needed for full ratification.

**[S-012] Branch field corrected in relay agent spec**
- Source: Fossic Item 3; adopted by all emitting projects
- The initial relay pseudocode in Fossic's original baseline was missing `branch=event.branch` in the `hub_store.append()` call.
- Corrected spec is now canonical (see §2.6 relay agent code block).
- All per-project relay implementations must include this field.

**[S-013] source_store indexed_tag required**
- Source: Fossic Item 3; all emitting projects
- Every event relayed to hub must include `source_store: <source_prefix>` in indexed_tags.
- Purpose: enables case-1 causation traversal routing (consumer knows which local store to query for unrelayed targets).

**[S-014] External_id idempotency gate**
- Source: Fossic Item 3; all emitting projects
- Before appending to hub: `if hub_store.read_by_external_id(event.id.hex()) is not None: continue`
- Prevents duplicate relay on relay agent restart.

**[S-015] Post-upcast payload at local boundary**
- Source: ai-stack/Bo Item 3; Fossic settled log
- Payload is upcasted (deserialized from local typed struct → platform-compatible JSON) at the local relay agent boundary, before writing to hub. Hub stores platform-canonical JSON payloads.

**[S-016] indexed_tags as relay prerequisite**
- Source: Fossic Item 4; all four emitting projects accepted
- Per-project indexed_tags must be implemented before the relay pass. Per-project fields are in §2.6 table.
- Without indexed_tags, filtered subscriptions (`filter_by_tags`) and case-1 causation routing don't work on hub.

**[S-017] CerebraSignalTile fossic subscription currently dark**
- Source: Fossic reconciliation B; Cerebra Item 2
- CerebraSignalTile subscribes to `cerebra/agent-trace/*` on `~/.lattica/fossic/store.db`. Cerebra writes all cycle events to its local `.fossic/store.db`. These are different paths — subscription sees zero Cerebra cycle events.
- NOT a wiring bug; expected pre-migration/pre-relay state.
- Daemon HTTP polling (port 7432) is unaffected (different mechanism; works correctly).
- Unblocked when: (a) Cerebra migrates to shared store, OR (b) relay agent bridges local → hub.

**[S-018] Cerebra OllamaDirectAdapter health_check as second silent VRAM consumer**
- Source: Cerebra D.1; ai-stack/Bo Item 2; Fossic settled log
- `OllamaDirectAdapter.health_check()` loads `granite-4.1-3b-GGUF:Q4_K_M` into VRAM.
- LiteLLM health probe is the first silent consumer (loads `qwen3.5:latest`).
- 92% VRAM at baseline filing: both were running simultaneously.

**[S-019] LumaWeave migration is one-line**
- Source: LumaWeave C.1; Fossic settled log
- Once Lattica's Tauri backend confirms `~/.lattica/fossic/store.db` is stable, LumaWeave migration is a one-line path change.
- Blocker: shared store path confirmation from Lattica (actionable item — see §3 and §8.5).

**[S-020] LumaWeave migration store gap**
- Source: LumaWeave C.1; Fossic settled log
- Even after LumaWeave migrates to shared store, Cerebra's cycle events don't appear on hub until Cerebra also migrates or relay agent runs. Cross-project context (graph state + Cerebra session) requires both.

**[S-021] Policy Scout Tauri wrapper — intentionally separate**
- Source: Policy Scout B.1; Fossic settled log
- Policy Scout's `CliJsonResponse` outer wrapper (`{ok, exit_code, data, error, stderr_summary}`) serves PS's own UI diagnostic needs.
- Lattica's inner-JSON parsing is the correct integration pattern. Two patterns stay separate by design.
- Non-blocking.

**[S-022] Policy Scout fossic emit — complete, local store by design**
- Source: Policy Scout Item 2 update; Fossic settled log
- `policy_scout/audit/sqlite_store.py`: fossic emit code is complete and functional.
- Local store path is intentional design (per-project vault, same pattern as Cerebra).
- Must add indexed_tags before commit (Pass E).

**[S-023] ApprovalExpired — watch daemon scheduler**
- Source: Policy Scout Item 3; Fossic settled log; ai-stack/Bo settled log
- Home: watch daemon (~60s scan loop, `expires_at <= now()`, emit `ApprovalExpired`)
- `append_if` as duplicate-emission guard (prevents double-emit if loop fires near boundary)
- Display-time derivation: necessary for UX but not authoritative
- Relay agents: wrong home (relay agents relay; they do not synthesize event types)

**[S-024] POLICY_SCOUT_EVENT_VOCABULARY.md scope**
- Source: Policy Scout B-update; Fossic settled log
- `POLICY_SCOUT_EVENT_VOCABULARY.md` lives in policy-scout's own tree. PS owns the `expires_at` field and owns vocabulary updates. Not Fossic's to maintain.

**[S-025] Settings hub-observability partition**
- Source: LumaWeave C.3; Fossic settled log
- Hub-observable (relay-worthy): `sources.active`, `activeDialect`
- Local only: `helixTwist`, pin state, UI preferences

**[S-026] Snapshot cold-start — three canonical cases**
- Source: Fossic Item 2 (consolidated); ai-stack/Bo settled log; LumaWeave C.7; Policy Scout reconciliation
- All three solvable with existing fossic snapshot API:
  - ai-stack: up to 10s gap on subscribe; seed from snapshot at `ai-stack/gpu`
  - LumaWeave: blank on subscribe if already loaded; seed from snapshot at last `SourceLoaded`
  - Policy Scout: blank approval queue on subscribe; seed from snapshot at `DecisionIssued`

**[S-027] Relay agent process model — standalone Python (leading)**
- Source: Cerebra D.7 #2; ai-stack/Bo Item 3; Fossic settled log
- Leading preference: standalone Python process per project (option a). Not ratified; open for federation interview (§8.3).

**[S-028] Hub net-writer / net-reader roles**
- Source: Fossic Item 2 (net roles table); all projects
- Writers: ai-stack sidecar (most advanced, live), Bo (live), Cerebra relay (pending), LumaWeave relay (pending), PS relay (pending)
- Readers: Lattica tiles (live), Cerebra witness model (future), Bo (future, after relay live)

**[S-029] upstream_causation_id field accepted**
- Source: Policy Scout Item 3 (cross-store causation section)
- `CommandRequested.upstream_causation_id` field accepted into PS's relay protocol adoption.

**[S-030] Relay agent includes causation_id=source_event.id**
- Source: Fossic Item 3; LumaWeave C.5
- When relaying derived events (event B caused by event A): `causation_id=event.id` (the local source event's ID).
- For events without upstream cause at relay time: `causation_id=None`.

**[S-031] LumaWeave relay agent causation_id conditional logic**
- Source: LumaWeave C.9; Fossic settled log
- When `GraphSnapshotAvailable` is received and LumaWeave emits `SourceLoaded`: the relay agent must pass `causation_id=<local_source_loaded_event.id>` for the case-2 chain to be complete.
- This is the first non-pass-through relay agent logic; requires relay agent awareness of the incoming hub event.

**[S-032] Bo relay filter spec for bot/* streams**
- Source: ai-stack/Bo Item 1; Fossic settled log
- Bo's `bot/conversation/*` and `bot/lifecycle` streams need relay filter rules when the shared ai-stack+Bo relay agent is designed.
- Open for federation interview (§8.8).

**[S-033] Relay agent phase dependency**
- Source: Fossic settled log; ai-stack/Bo Phase 2 note
- Phase 2 tile wiring (Lattica tiles subscribing to hub streams) depends on relay agents being live first (for all emitting projects except ai-stack, which already writes to shared store).

**[S-034] upstream_causation_id — witness model enrichment path**
- Source: Cerebra D.5; Policy Scout reconciliation cross-project update; Fossic settled log
- PS relay and ai-stack relay are prerequisites for witness model to receive platform context — not because Bo queries witness model (it doesn't), but because the cognitive cycle benefits from knowing current governance and GPU state.

---

## §5 — Platform State Summary (Reconciled)

**Event fabric:** Append-only, content-addressed, store-per-project today. Relay agents will federate into shared hub at `~/.lattica/fossic/store.db`. Hub is Lattica's store; relay agents append to it; tiles subscribe from it.

**Active data flows (live today):**
- ai-stack sidecar → shared hub (live; most advanced)
- Bo → shared hub (live; net-writer only)
- Lattica tiles → shared hub read (live; Rust backend)
- Cerebra daemon → Lattica CerebraSignalTile HTTP (live; port 7432)
- Policy Scout → Lattica governance actions (live; CLI subprocess via Tauri)

**Data flows pending relay pass:**
- Cerebra local store → relay → hub
- LumaWeave local store → relay → hub (blocked on shared store path confirmation)
- Policy Scout local store → relay → hub (blocked on indexed_tags + fossic commit first)

**Key architectural decisions locked:**
- GraphSnapshotAvailable replaces CerebraReadAdapter (file-polling model closed)
- Witness model is Cerebra-internal; Bo reads hub directly
- D.3 conditional strip rule is the leading hub stream naming convention (pending ratification)
- Two-case causation model (hub-traversable vs. store-boundary)
- Relay agent process model: standalone Python (pending ratification)

**Key architectural decisions pending:**
- D.3 final ratification (Fossic + Lattica positions needed)
- GraphSnapshotAvailable event schema and stream target
- Relay agent process location (per-project vs. platform)
- Hub-side snapshot coordination
- Cross-substrate causation rendering in Lattica tiles

---

## §6 — Compile-Time Issues (Reconciled)

### §6.1 — Daemon port conflict (v1 §6.1) — CLOSED
- v1 flag: baseline docs disagreed on Cerebra daemon port (7474 in one source vs. 7432 in another)
- Reconciliation resolution: 7432 confirmed against `cerebra/cli/daemon.py:290`. Lattica's v0.3.5u wiring is correct.
- Status: **CLOSED**

### §6.2 — Policy Scout Tauri wrapper discrepancy (v1 §6.2) — CLOSED/CLARIFIED
- v1 flag: Policy Scout's Tauri response wrapper shape differs from Lattica's integration pattern
- Reconciliation resolution: Both patterns confirmed intentionally separate. PS outer wrapper is for PS's own diagnostic needs; Lattica's inner-JSON parsing is correct integration pattern. Non-blocking.
- Status: **CLOSED (non-blocking, intentional divergence)**

### §6.3 — CerebraReadAdapter conflict (v1 §6.3) — CLOSED
- v1 flag: Cerebra baseline said CerebraReadAdapter existed; LumaWeave baseline said it didn't. Compiler could not resolve.
- Reconciliation resolution: Both Cerebra and LumaWeave confirmed: never built, never in progress. Resolution is GraphSnapshotAvailable hub event model replacing file-artifact polling entirely.
- Status: **CLOSED**

### §6.4 — Daemon-tile version drift (v1 §6) — CLOSED
- v1 flag: Cerebra daemon version in docs predated Lattica tile wire-up; temporal gap unclear.
- Reconciliation resolution: Lattica's v0.3.5u wiring was committed after the baseline docs were filed. The version drift was a timing artifact, not a real inconsistency.
- Status: **CLOSED**

### §6.5 (NEW) — CerebraSignalTile fossic subscription dark — OPEN
- Surfaced by: Fossic reconciliation B; Cerebra Item 2
- CerebraSignalTile subscribes to `cerebra/agent-trace/*` on `~/.lattica/fossic/store.db`. Cerebra writes all cycle events to `.fossic/store.db` (vault-scoped local path). These are different paths on the same filesystem.
- The tile's fossic subscription currently sees zero Cerebra cycle events. This is not a wiring bug — it is the expected pre-migration state.
- Daemon HTTP polling (port 7432) is unaffected.
- **Unblocked when:** (a) Cerebra migrates to shared store, OR (b) relay agent bridges local → hub.
- Status: **OPEN — known pre-relay gap; no code fix needed now; track as data-availability blocker for cycle event display**

### §6.6 (NEW) — Policy Scout indexed_tags missing from staged fossic emit — OPEN
- Surfaced by: Policy Scout reconciliation Item 2 update
- Fossic emit code in `policy_scout/audit/sqlite_store.py` is complete and functional but does not yet include indexed_tags fields.
- indexed_tags must be added before the fossic emit commit (Pass E).
- Status: **OPEN — pre-commit action required**

---

## §7 — Snapshot Metadata (v2)

| Field | Value |
|---|---|
| Baseline version | v2 |
| Compiled by pass | v0.3.5s |
| Compile date | 2026-06-16 |
| Reconciliation rounds | 3 |
| Settled items (§4.X) | 34 items |
| v1 open issues CLOSED | §6.1, §6.2, §6.3, §6.4 |
| New open issues | §6.5 (CerebraSignalTile dark), §6.6 (PS indexed_tags) |
| Federation interview items | 9 (see §8) |
| Source reconciliation files | cerebra/reconciliation.md, lumaweave/reconciliation.md, policy-scout/reconciliation.md, ai-stack-bo/reconciliation.md, fossic/reconciliation.md |
| Lattica brief | `LATTICA_RECONCILIATION_BRIEF.md` (same directory) |
| Projects outside reconciliation | Lattica |

---

## §8 — Federation Interview Agenda

Items requiring cross-project decision. Not in priority order. Compiler does not take positions.

### §8.1 — D.3 Stream naming convention — ratification
**Affected projects:** All (Fossic, Lattica, + all four emitting projects)
**Current state:** D.3 conditional strip rule has 3-of-5 explicit endorsements (Cerebra proposer, ai-stack Round 2, LumaWeave C.8). Policy Scout implicit alignment. Fossic: leading proposal, pending ratification. Lattica: no position taken.
**Decision needed:** Full ratification (Fossic + Lattica positions). If not D.3, an alternative naming convention must be specified so relay agent implementations can be consistent.
**Stakes:** Affects hub stream names for all four emitting projects; affects Lattica tile stream prefix chip rendering.

### §8.2 — GraphSnapshotAvailable event schema and stream target
**Affected projects:** Cerebra (emitter), LumaWeave (consumer), Fossic (store/routing)
**Current state:** Direction agreed (hub event replaces file-polling). Schema and stream target not yet specified. LumaWeave consumer requirements filed: snapshot reference, lineage_id, enough context for trigger-or-skip decision.
**Decision needed:** Payload schema; stream target (`cerebra/lattice/<lineage_id>` vs. `cerebra/graph/<lineage_id>` vs. other).
**Stakes:** First causal chain implementation (case 2); unblocks LumaWeave tile's Cerebra graph display.

### §8.3 — Relay agent process location
**Affected projects:** All emitting projects (Cerebra, LumaWeave, Policy Scout, ai-stack/Bo)
**Current state:** Leading preference is standalone Python process per project (option a: small `cerebra-relay.py`, `lumaweave-relay.py`, etc.). Not ratified.
**Decision needed:** Per-project standalone, or platform relay coordinator, or Lattica-managed?
**Stakes:** Determines where relay agents live, who starts them, and how they're monitored.

### §8.4 — Witness model hub projection wiring
**Affected projects:** Cerebra (consumer), Policy Scout (relay prerequisite), ai-stack (relay prerequisite)
**Current state:** Minimum projection scope settled (see §4.X S-008). Implementation is Phase 15+ Cerebra. Relay layer must accommodate.
**Decision needed:** How does the projection reducer receive hub events — does it use the same local relay subscription, or does it subscribe to the hub store directly?
**Stakes:** Determines whether witness model projection is a relay-phase artifact or a separate Cerebra-side subscription.

### §8.5 — LumaWeave shared store path confirmation
**Affected projects:** LumaWeave (migrating), Lattica (hub owner)
**Current state:** LumaWeave migration is blocked on Lattica's Tauri backend confirming `~/.lattica/fossic/store.db` is stable and accessible at that exact path.
**Decision needed:** Lattica backend confirmation (or alternative path). Actionable in next Lattica pass.
**Stakes:** Unblocks LumaWeave migration (one-line change); unblocks LumaWeave → hub relay pass.

### §8.6 — Hub-side snapshot coordination
**Affected projects:** All (tile consumers + emitting projects)
**Current state:** Three canonical cold-start cases settled; existing fossic snapshot API supports resolution. Adoption per project is the remaining question.
**Decision needed:** Platform-wide snapshot adoption protocol; who seeds snapshots on which streams; on subscribe vs. on emit.
**Stakes:** Determines tile cold-start behavior across all five module tiles.

### §8.7 — Cross-substrate causation rendering in Lattica tiles
**Affected projects:** Lattica (visual design), Fossic (store API)
**Current state:** Two-case causation model settled. Case 1 (link target in local store — not relayed) requires special rendering treatment; no current design.
**Decision needed:** Visual treatment for case-1 causation links — "click to query originating store" vs. "link grayed out" vs. other.
**Stakes:** Determines how fossic exploration tiles handle causal chains that cross store boundaries.

### §8.8 — Bo relay filter spec for bot/* streams
**Affected projects:** ai-stack/Bo (relay emitter), Fossic (hub receiver)
**Current state:** Bo writes to shared store at `bot/lifecycle` and `bot/conversation/<channel_id>`. Relay filter rules for which streams to relay (and which to keep local) not yet designed.
**Decision needed:** Which bot/* streams to relay to hub; filter spec for the shared ai-stack+Bo relay agent.
**Stakes:** Determines hub visibility into Bo conversation and lifecycle events; affects witness model input scope.

### §8.9 — Phase 2 tile wiring sequencing
**Affected projects:** Lattica (tile consumer), all emitting projects (relay prerequisites)
**Current state:** Phase 2 tile wiring (tiles subscribe to hub streams instead of polling directly) depends on relay agents being live first per project.
**Decision needed:** Sequencing — which project's relay agent comes first? Is there a minimum relay set that unblocks tile wiring for at least one project?
**Stakes:** Determines when Lattica can begin Phase 2 tile wiring work.

End of PLATFORM_BASELINE_2026-06-16_v2.md.
