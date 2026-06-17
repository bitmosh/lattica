# Cerebra Federation Design Response
**Filed by:** cerebra-claude
**Date:** 2026-06-16
**Input:** PLATFORM_BASELINE_2026-06-16_v2.md + reconciliation rounds 1–3 + Lattica reconciliation brief
**Purpose:** Cerebra's design response to the federation interview. Forms one of six inputs to FEDERATION_DESIGN_2026-06-16.md compile.

---

## Section A — Input Acknowledgment and Corrections

### A.1 Confirmed accurate

The following v2 baseline entries for Cerebra are accurate and require no correction:

- **Port 7432** (§2.1, S-001): confirmed against `cerebra/cli/daemon.py:4` (docstring) and line ~290. Lattica's v0.3.5u wiring at 7432 is correct.
- **FossicStore dual-path design** (§2.1): local store at `{vault_path}/.fossic/store.db`; shared hub accessible via `FossicStore.at_platform_path()` → `~/.lattica/fossic/store.db`. Confirmed against `cerebra/storage/fossic_store.py`.
- **CycleRuntime single-threaded constraint** (§2.1, D7): strictly sync, no async, no threading. Confirmed at `cerebra/cognition/cycle_runtime.py` header comment.
- **EventEmitter stream names** (§2.1): `cerebra/agent-trace/<session_id>` (cycle events, auto-causation chained) and `cerebra/lattice/<lineage_id>` (lattice ingest events). Confirmed at `cerebra/cognition/event_emitter.py`.
- **OllamaDirectAdapter health_check() VRAM issue** (S-018): confirmed — `health_check()` at `cerebra/cognition/llm_adapter.py:286` is a minimal inference probe that silently loads granite-4.1-3b-GGUF:Q4_K_M into VRAM. This is a known sharp edge.
- **CerebraSignalTile fossic subscription currently dark**: confirmed. The tile subscribes to `cerebra/agent-trace/*` on the shared hub store, but Cerebra writes cycle events to its local vault store. The data path is dark until Cerebra migrates or a relay agent runs. The daemon HTTP polling at 7432 is a separate, working path.
- **Two-case causation model**: confirmed as correct cross-project formalization.
- **indexed_tags prerequisite for relay pass**: confirmed. Cerebra's required fields: `{session_id, cycle_id, signal_name}` on cycle events, not yet implemented.

### A.2 Framing corrections

**A.2.1 — §4.5 "dual-cause VRAM" framing is incorrect**

v2 §4.5 describes VRAM consumption as "dual-cause (LiteLLM + Cerebra independent)." This framing misrepresents the control hierarchy.

Correct architecture:
- **Cerebra is master** of model usage decisions. Cerebra decides which model to load and when.
- **Ollama (via ai-stack)** is Cerebra's inference substrate — it serves inference requests that Cerebra initiates.
- **LiteLLM** is a downstream proxy that Cerebra may or may not route through (`ProxyLLMAdapter` in `llm_adapter.py`). LiteLLM is not an independent consumer making autonomous model load decisions.

The 92% VRAM baseline under active sessions reflects Cerebra's granite-4.1-3b model loaded for cognitive cycle inference — not two competing independent consumers. LiteLLM's presence in the VRAM picture is mediated by Cerebra's routing decisions. This has direct implications for the two-persona architecture design (see C.4).

**A.2.2 — CerebraReadAdapter (v1 §6.3) is definitively closed**

Cerebra confirms: the CerebraReadAdapter was never built and does not exist in any form. The file-polling model described in v1 should not appear in any federation design document as a live dependency. Resolution: `GraphSnapshotAvailable` hub event replaces file-polling entirely (see B.4).

**A.2.3 — Witness model scope (D.5) is Cerebra-internal only**

The witness model is not Bo's query interface and not a shared platform service. It is Cerebra-internal infrastructure, Phase 15+ scope, that enriches Cerebra's own cognitive cycle by projecting hub events from other projects into Cerebra's memory layer. Bo's read paths under federation are: (1) daemon HTTP `GET /status` for cycle state, (2) hub fossic store directly for platform-wide state.

### A.3 Open items resolved by this document

The following items from D.7 (seven open questions) are resolved in Sections B–D below:
- D.7 #1 — relay process model: resolved in B.2
- D.7 #2 — relay agent isolation: resolved in B.2
- D.7 #3 — GraphSnapshotAvailable stream target: resolved in B.4
- D.7 #4 — witness model subscription path: resolved in B.3
- D.7 #5 — hub snapshot coordination: resolved in B.5
- D.7 #6 — discord-bot fold-in strategy: resolved in Section C
- D.7 #7 — D.3 ratification position: resolved in D.6

---

## Section B — Cerebra Federation Design

### B.1 Local store shape

**Store paths:**
- Local vault store: `{vault_path}/.fossic/store.db` — Cerebra's primary write target for cycle events
- Shared hub store: `~/.lattica/fossic/store.db` — accessed via `FossicStore.at_platform_path()`; relay agent writes here; witness model reducer reads from here

**Streams Cerebra writes:**

| Stream | Destination | Relay? | Description |
|--------|-------------|--------|-------------|
| `cerebra/agent-trace/<session_id>` | local vault | YES | Cycle events; auto-causation chained via `_last_event_id` |
| `cerebra/lattice/<lineage_id>` | local vault | YES | Lattice ingest events |
| `cerebra/control` | local vault | NO | PostureChanged, CheckpointSaved (daemon management only) |
| `cerebra/graph/<lineage_id>` | hub direct | N/A | GraphSnapshotAvailable (written directly to hub, not relay path) |

**indexed_tags prerequisite (not yet implemented):**
Before the relay pass, cycle events on `cerebra/agent-trace/<session_id>` must carry indexed_tags: `{session_id, cycle_id, signal_name}`. This enables hub-side filtering and cross-project correlation without full event deserialization.

**D.3 conditional strip rule applied to Cerebra:**
All Cerebra streams start with `cerebra/`. Under D.3, `stream_id.startswith("cerebra/")` is always true, so all streams pass through to the hub unchanged. No double-prefix problem for Cerebra.

### B.2 Relay filter and relay agent design

**Filter specification:**

| Stream pattern | Relay to hub? | Reason |
|----------------|---------------|--------|
| `cerebra/agent-trace/*` | YES | Cross-project platform context; PS and ai-stack witness projections depend on this |
| `cerebra/lattice/*` | YES | LumaWeave consumes for graph sync; inter-project causal chains |
| `cerebra/control` | NO | Local daemon management; no hub consumer; no cross-project value |

**Relay agent design (D.7 #1 and #2 resolved):**

Option selected: **standalone Python process** — `cerebra-relay.py` — a small script with `RelayConfig` pointing `.fossic/store.db` → `~/.lattica/fossic/store.db`. This is the same model ai-stack aligned to.

Rationale:
- Cerebra daemon is sync/single-threaded; embedding relay logic in the daemon creates threading complexity.
- Standalone relay can be started/stopped independently of the cognitive cycle.
- Failure in relay does not block cycle execution — acceptable decoupling.
- `cerebra-relay.py` can be co-started by the daemon's `__main__` as a subprocess, or run separately.

**Relay protocol (confirmed from S-028 and fossic relay pseudocode):**
- Post-upcast payloads via `deserialize_payload_json()`
- `external_id=event.id.hex()` for idempotency
- `causation_id=source_event.id`
- `source_store=cerebra` as indexed_tag
- `branch=event.branch` passthrough

**Two-case causation model application:**
- `cerebra/agent-trace` events relayed → **Case 2**: hub-traversable causation chain. PS governance → Cerebra command chain is hub-traversable once both relay.
- `cerebra/control` events NOT relayed → **Case 1** (if ever needed): consumer must use `source_store` tag to route back to local store. No known consumer today; noted for completeness.

### B.3 Witness model wiring

**Decision: hub-direct subscription (not relay agent path)**

The relay agent's job is to forward Cerebra's *local events* to the hub. The witness model needs to read hub events from *other* projects (Policy Scout governance transitions, ai-stack GPU/model lifecycle) — events that are not and will never be in Cerebra's local store. The relay agent wouldn't see those events.

**Implementation:**
- Witness model is a Cerebra-internal reducer registered on a `FossicStore` instance opened against `~/.lattica/fossic/store.db` via `FossicStore.at_platform_path()`
- Reducer registered via `store.register_reducer(reducer_fn, stream_patterns)`
- Runs in its own context (not on the cycle thread — CycleRuntime is strictly single-threaded, D7)
- Projects hub events into Cerebra's memory layer for cognitive cycle enrichment at cycle startup or on explicit query

**Minimum hub coverage for Phase 15+ scope:**
- Policy Scout streams: `LockdownActivated`, `LockdownDeactivated`, `ApprovalRequested` from `policy-scout/audit/*`
- ai-stack streams: `VramBudgetChanged`, `ModelLoaded`, `ModelUnloaded` from `ai-stack/gpu` and `ai-stack/models`

**Prerequisite:** Policy Scout and ai-stack relay passes must be live before the witness model has useful data. The reducer registration can be wired in advance; it will simply project nothing until relay agents produce hub events.

**Explicitly out of scope:**
- Bo does not query the witness model
- No external API surface for witness model state
- Phase 15+ only; no current implementation target

### B.4 GraphSnapshotAvailable schema

**Stream target decision: `cerebra/graph/<lineage_id>`**

Not `cerebra/lattice/<lineage_id>`. Rationale: `cerebra/lattice/<lineage_id>` carries lattice ingest events (cycle-level internal events). `GraphSnapshotAvailable` is a cross-project coordination signal to external consumers (LumaWeave). Conflating them pollutes the ingest event stream with consumer-facing notifications and would force LumaWeave to filter out ingest events it doesn't want.

**Write destination: hub direct**

`GraphSnapshotAvailable` is written directly to `~/.lattica/fossic/store.db` (not the local vault store). Rationale: this event's only consumers are external (LumaWeave via Lattica hub). Writing it to the local vault first and relaying it adds latency and a dependency on the relay agent being live. Since EventEmitter already has access to `FossicStore.at_platform_path()`, hub-direct write is the cleaner path.

**Event schema:**

```python
@dataclass
class GraphSnapshotAvailable:
    lineage_id: str          # graph identity — matches cerebra/lattice/<lineage_id>
    snapshot_ref: str        # absolute path to .cerebra/graph.json (stable convention)
    graph_version: int       # monotonically incrementing; resets on vault change
    content_hash: str        # sha256 of graph.json content — enables skip-if-unchanged
    triggered_by: str        # hex event_id of the ingest event that caused this snapshot
    source_prefix: str       # "cerebra" — explicit for cross-project consumers
```

**Emission cadence:**
- Emitted by `EventEmitter.trigger_lattice_snapshots_at_cycle_boundary()` when graph content actually changes (content_hash differs from last emission)
- NOT on every cycle — only on ingest completion that changes graph content
- `.cerebra/graph.json` continues to be written as the file artifact; `GraphSnapshotAvailable.snapshot_ref` points to it

**LumaWeave consumer requirements met:**
- `lineage_id` — graph identity for trigger-or-skip logic ✓
- `snapshot_ref` — file path for graph loading ✓
- `content_hash` — skip-if-unchanged without opening the file ✓
- `triggered_by` — causation chain for hub traversal (Case 2) ✓

### B.5 Hub snapshot coordination

**Cerebra's emitted snapshots:**

| Stream | Snapshot trigger | Purpose |
|--------|-----------------|---------|
| `cerebra/agent-trace/<session_id>` | `LATTICE_SNAPSHOT_CADENCE` threshold (existing behavior in EventEmitter) | Enables consumers to fast-forward to current state without replaying full event history |
| `cerebra/graph/<lineage_id>` | Each `GraphSnapshotAvailable` emission | Enables LumaWeave cold-start: subscribe → receive last snapshot → render graph immediately, not wait for next ingest |
| `cerebra/lattice/<lineage_id>` | Existing cadence in EventEmitter | Lattice state cold-start |

**Cold-start protocol for LumaWeave (Case 2):**
LumaWeave subscribes to `cerebra/graph/<lineage_id>`. On subscribe, Lattica's hub fossic API delivers last snapshot from that stream. LumaWeave receives `GraphSnapshotAvailable` with `snapshot_ref` and renders immediately. No blank state on tile open.

This is dependent on: (a) `GraphSnapshotAvailable` hub-direct write being live, (b) LumaWeave adopting snapshot-on-subscribe pattern (their B.1 cold-start case, confirmed in LumaWeave reconciliation C.7).

---

## Section C — Discord-bot Fold-in

### C.1 Bot.py component classification

Full read of `/home/boop/Projects/discord-bot/bot.py` (749 lines). Classification:

| Component | Lines | Classification | Disposition |
|-----------|-------|----------------|-------------|
| discord.py client setup, intents, on_ready, on_message | 652–732 | **Connectivity** | Migrate into Cerebra daemon discord plugin |
| `chunk_for_discord()`, `strip_self_mention()` | 117–143 | **Connectivity** | Migrate — Discord-specific utilities |
| `post_with_thinking_thread()` | 523–587 | **Connectivity** | Migrate — Discord posting layer |
| `thread_title_from_prompt()` | 505–520 | **Connectivity** | Migrate — Discord thread management |
| `_write_heartbeat()`, `_heartbeat_loop()` | 634–648 | **Connectivity** | Migrate simplified — heartbeat becomes daemon status endpoint data |
| `on_ready()` BotStarted emission | 652–664 | **Connectivity** | Migrate — lifecycle event; stream becomes `cerebra/bot/lifecycle` |
| `handle_command()` (thinking on/off/status) | 161–175 | **Additive** | Evaluate — could map to Cerebra daemon posture commands; not redundant but needs alignment |
| `extract_thinking()` | 178–198 | **Additive** | Migrate — thinking display logic; Cerebra doesn't have this; useful for bo persona output |
| `is_empty_response()` (defined twice at 442 + 454 — duplicate) | 442, 454 | **Additive** | Migrate one copy; deduplicate; small utility; ClutchEngine doesn't cover empty-response detection |
| `CONTEXT_BOT_ALLOWLIST` filtering in `_should_include_in_context()` | 248–260 | **Additive** | Evaluate — multi-bot context filtering concept; relevant when cerebra-persona and bo-persona share channels |
| `ask_via_litellm()`, `ask_via_ollama()` | 206–234 | **Redundant** | Discard — Cerebra has `OllamaDirectAdapter` + `ProxyLLMAdapter`; same capability, different implementations |
| `gather_context()` | 263–315 | **Redundant** | Discard — labeled as "seam for future memory architecture" in bot.py docstring; maps to Cerebra's `retrieval/context_packet.py` + `planner.py` + `traversal.py` stack |
| Retry attempts 1 + 2 (nudge retry) in `ask_local_model()` | 325–400 | **Redundant** | Discard — covered by Cerebra's ClutchEngine stop conditions and retry escalation |
| Retry attempt 3 (synthesis from reasoning) in `ask_local_model()` | 400–435 | **Additive** | Evaluate — Cerebra's LLM adapter does not have this fallback pattern; worth carrying forward |
| `_init_store()`, `_emit()` fossic wrapper | 591–619 | **Redundant** | Discard — use Cerebra's `FossicStore` directly; same hub path (`~/.lattica/fossic/store.db`) |
| `STATUS_TAG_RE`, `_strip_status_tags()` | 238–245 | **Additive** | Evaluate — status tag stripping in context history; relevant to context packet filtering |
| `__main__` signal handler, BotStopped | 736–748 | **Connectivity** | Migrate — lifecycle event; SIGTERM handler maps to daemon shutdown hook |

**Key wiring note on `gather_context()`:** The bot.py docstring explicitly flags this as an architecture seam: *"Replace or wrap it to plug in persistent memory, retrieval, summarization, etc."* The component is not a casualty — it's a deliberate migration point. Cerebra's retrieval stack (`context_packet.py`, `planner.py`, `traversal.py`) is exactly what should replace it.

### C.2 Migration plan

**Phase 1 — Training model (immediate target):**

The Discord connectivity layer (Connectivity-classified components above) migrates into Cerebra daemon as a discord plugin or sidecar that the daemon starts alongside cycle execution. The training model (granite-4.1-3b) handles bo's conversational responses.

Migration steps:
1. Discord client setup + on_message handler migrates to Cerebra daemon plugin
2. `gather_context()` is replaced by a thin wrapper that calls Cerebra's retrieval stack for context assembly
3. LLM routing goes through `OllamaDirectAdapter` (master path) — no `ask_via_litellm()` / `ask_via_ollama()` duplication
4. Fossic event emissions go through `FossicStore.at_platform_path()` — bo streams become `cerebra/bot/lifecycle` and `cerebra/bot/conversation/<channel_id>` (see D.2 for naming)
5. `_write_heartbeat()` replaced or simplified — heartbeat data surfaces through daemon `GET /status`
6. `extract_thinking()` and `is_empty_response()` migrated as utilities

**Phase 2 — Witness model persona (Phase 15+):**

Once the witness model is live, a platform-aware bo persona is layered on top. The witness model provides projection of current platform state (lockdown status, GPU headroom, active session state) into bo's context assembly. This enables bo to give platform-aware responses without querying multiple services.

### C.3 Persona architecture

**Bo persona as Cerebra capability:**
- Under Phase 1: bo is a Cerebra capability that uses the training model (granite-4.1-3b) for all conversational inference. Same model, same inference substrate.
- Under Phase 2: bo's context assembly is enriched by witness model projections. Bo knows platform state from Cerebra's internal projection, not from polling daemon HTTP or querying hub directly.

**Persona separation:**
- Cerebra's cognitive cycle persona (the reasoning agent executing cycles) and bo's conversational persona are distinct activation paths. They don't share a conversation thread.
- When both are active, they communicate via an inter-agent Discord channel. This is the mechanism for cerebra-persona to notify bo-persona of cycle completion, posture changes, or escalation events.

**Isolation boundary:**
- Bo's Discord responses do not trigger cognitive cycles.
- Cognitive cycles do not post to Discord directly.
- The inter-agent channel is the only intentional coupling point.

### C.4 Ollama master/slave correction

This is a required design clarification, not just a baseline fix.

**Correct hierarchy:**
```
Cerebra (master)
  └── decides: which model, when to load, inference parameters
        ├── OllamaDirectAdapter → Ollama (ai-stack sidecar) → VRAM
        └── ProxyLLMAdapter → LiteLLM → (same Ollama, or external endpoint)
```

**Incorrect framing to retire:** "dual-cause VRAM consumption (LiteLLM + Cerebra independent)." LiteLLM does not make independent model load decisions. LiteLLM proxies whatever Cerebra routes through it.

**Implications for two-persona architecture:**
- Both training model (bo persona) and reasoning model (cycle persona) are Cerebra-controlled.
- If both personas are active simultaneously, Cerebra must manage the VRAM budget across both — this is not ai-stack's responsibility.
- The ai-stack sidecar reports VRAM state; Cerebra decides what to load given that state.
- `health_check()` (S-018) must be addressed before two-persona operation: the silent VRAM probe on every health check becomes a VRAM management problem when two models may need to be loaded. Resolution options: (a) remove health check, (b) make it conditional on VRAM headroom, (c) cache the health state with TTL.

---

## Section D — Cross-cutting

### D.1 Broken-pending UI discipline

**Confirmed position:** Tile elements that depend on a data path that is not yet wired bake in as broken-pending — a first-class UX state, not an error state.

**Cerebra's current broken-pending elements:**
1. `CerebraSignalTile` fossic subscription: dark until relay agent runs or Cerebra migrates to shared store. Tile should render its fossic-dependent elements as broken-pending. Daemon HTTP polling elements are unaffected.
2. `GraphSnapshotAvailable` consumer tiles in LumaWeave: broken-pending until Cerebra ships hub-direct graph snapshot emission.

**Implementation note:** Broken-pending is a product of Cerebra's data path state, not a Lattica rendering decision. When Cerebra's relay pass lands, the broken-pending elements resolve automatically because the data path becomes live. No Lattica code change needed for the resolution.

### D.2 No hard-coded values

Audit of Cerebra's design decisions for hard-coded value ambiguities:

| Value | Current location | Status |
|-------|-----------------|--------|
| Port 7432 | `daemon.py:4` (docstring), configurable via click option | OK — configurable default, not hard-coded |
| Hub store path `~/.lattica/fossic/store.db` | `fossic_store.py` via `at_platform_path()` classmethod | OK — platform convention, single source of truth |
| `cerebra/agent-trace/<session_id>` stream name | `event_emitter.py` — session_id is runtime parameter | OK — parameterized |
| `cerebra/lattice/<lineage_id>` stream name | `event_emitter.py` — lineage_id is runtime parameter | OK — parameterized |
| `cerebra/graph/<lineage_id>` (proposed) | not yet implemented | FLAG — needs to be a constant, not inline string |
| `LATTICE_SNAPSHOT_CADENCE` | `event_emitter.py` — defined as module constant | OK |
| `bot/lifecycle` stream in bot.py | `bot.py:652` | **NEEDS WIRING** — becomes `cerebra/bot/lifecycle` under fold-in; current value is a hard-coded string; migration must use a constant |
| `bot/conversation/<channel_id>` stream in bot.py | `bot.py` dynamic | **NEEDS WIRING** — becomes `cerebra/bot/conversation/<channel_id>` under fold-in; prefix migration required |
| `FOSSIC_STORE_PATH` in bot.py | `bot.py:79` — `Path.home() / ".lattica" / "fossic" / "store.db"` | **NEEDS WIRING** — under fold-in, must use `FossicStore.at_platform_path()` instead of independent path construction; currently correct by coincidence |

Flagged wiring items are filed in `needs-wiring.md` in this directory.

### D.3 Cross-Claude question protocol

**Outbound question format:**
File at `~/Projects/lattica/docs/coordination/outbound/2026-06-16_cerebra_to_<target>_<topic>.md`

Required front matter:
```yaml
---
from: cerebra
to: <target-project>
date: 2026-06-16
topic: <topic slug>
status: open
---
```

**Thread closure:** ack-of-ack closes the thread. Cerebra acks the peer's response by updating the outbound file's `status: closed` and noting the resolution.

**No outbound questions filed for this pass.** All D.7 items are resolved within this document. If GraphSnapshotAvailable stream naming (`cerebra/graph/<lineage_id>`) needs LumaWeave confirmation before implementation, that is a pre-implementation verification, not a blocking question for the federation design compile.

### D.4 File ownership

**Cerebra writes:**
- `baselines/2026-06-16/cerebra/reconciliation.md` — Cerebra's cross-project reconciliation record
- `baselines/2026-06-16/cerebra/current_state.md` — Cerebra's current implementation state snapshot
- `baselines/2026-06-16/cerebra/federation_design.md` — this file
- `baselines/2026-06-16/cerebra/needs-wiring.md` — hard-coded value / wiring ambiguity tracker

**Cerebra does not write to other projects' baseline files.**

**Cross-pollination:** Key design decisions from this document are mirrored at `lattica/docs/coordination/cross-pollination/cerebra/` per the cross-Claude coordination protocol.

**The compile (`FEDERATION_DESIGN_2026-06-16.md`) is Lattica's artifact**, not Cerebra's. Cerebra provides this input file only.

### D.5 Net-writer / net-reader confirmation

**Cerebra is a NET WRITER to the hub for:**
- `cerebra/agent-trace/*` — cycle events (via relay agent, pending indexed_tags implementation)
- `cerebra/lattice/*` — lattice ingest events (via relay agent)
- `cerebra/graph/*` — GraphSnapshotAvailable (hub-direct, not relay path)
- `cerebra/bot/lifecycle` — BotStarted, BotStopped (via fold-in, Phase 1)
- `cerebra/bot/conversation/*` — LlmCallAttempt, ResponseGenerated (via fold-in, Phase 1)

**Cerebra is a NET READER from the hub for:**
- `policy-scout/audit/*` — governance transitions for witness model projection (Phase 15+)
- `ai-stack/gpu`, `ai-stack/models` — GPU/model lifecycle for witness model projection (Phase 15+)

**Cerebra does NOT write to:**
- Any other project's stream namespace
- `~/.lattica/fossic/store.db` for any stream outside the `cerebra/*` namespace

**No stream namespace conflicts identified** with other projects' declared write streams.

### D.6 D.3 Ratification position

**Cerebra RATIFIES D.3** — the conditional strip rule for hub stream naming.

Rule (verbatim from D.3 original proposal):
> If `stream_id.startswith(f"{source_prefix}/")`, use `stream_id` directly on the hub; otherwise prepend `f"{source_prefix}/"`.

**Applied to Cerebra:** All Cerebra streams (`cerebra/agent-trace/*`, `cerebra/lattice/*`, `cerebra/graph/*`, `cerebra/bot/*`) start with `"cerebra/"`. The condition is always true for Cerebra. All streams pass through to the hub unchanged. No double-prefix problem.

**Position on broader ratification:**
- Cerebra (proposer + ratifier): **RATIFIED**
- ai-stack: explicit endorsement (Round 2)
- LumaWeave: explicit endorsement (C.8)
- Policy Scout: implicit alignment confirmed
- Fossic: leading proposal, pending ratification
- Lattica: TBD (needed for canonical status)

D.3 is effectively ratified for implementation purposes by the four endorsing projects. Lattica's position would make it canonical. The compile (`FEDERATION_DESIGN_2026-06-16.md`) should record D.3 as ratified conditional on Lattica's response, and note that Lattica's hub-side tile rendering benefits from D.3 (hub stream names = local stream names, no prefix stripping in Fossic tile chip labels).

---

## Summary table — open items after this design

| Item | Status | Blocking what |
|------|--------|---------------|
| indexed_tags implementation on cycle events | Open — implementation work | Relay pass |
| `cerebra/graph/<lineage_id>` stream implementation | Open — hub-direct write in EventEmitter | GraphSnapshotAvailable consumption by LumaWeave |
| `health_check()` VRAM probe mitigation (S-018) | Open | Two-persona VRAM management |
| Standalone `cerebra-relay.py` implementation | Open | CerebraSignalTile fossic subscription |
| Bot.py fold-in Phase 1 | Open | Bo persona migration |
| Witness model reducer (Phase 15+) | Deferred | Platform context enrichment |
| D.3 Lattica ratification | Lattica's decision | Full canonical status |
| `stream_exists()` stability (D.8) | Tracking — not blocking | Relay agent stability |

---

*End of Cerebra Federation Design Response — 2026-06-16*
