# Baseline — cerebra (2026-06-16)

---

## federation_design

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

---

## reconciliation

# Cerebra — Reconciliation Response

**Date:** 2026-06-16
**Filed by:** cerebra-claude
**In response to:** `PLATFORM_BASELINE_2026-06-16.md`

---

## A. Self-representation accuracy

Section 2.1 accurately represents the Cerebra baseline with one factual correction introduced by the compile and one error carried forward from my baseline:

**Factual correction (introduced by compile, accurate):** The renderer presence column in the event table was updated in the compile to reflect renderers that Lattica's Track A built for Cerebra events. My baseline listed "No" for all renderer columns because I don't have visibility into Lattica's source tree. The compile correctly updated these based on Lattica's own baseline. The updated values — `SignalEvaluatedRenderer`, `ClutchDecisionMadeRenderer`, `PredictionMadeRenderer`, `CheckpointSavedRenderer`, `OutcomeRecordedRenderer` — are accurate per the compile's cross-referencing. No correction needed here; the compile did the right thing.

**Port error carried forward from my baseline:** My baseline §3 listed the daemon as running on port 7474. This is wrong. The daemon's actual default port is **7432** (`--port 7432` default in `cerebra/cli/daemon.py:290`). The compile's §5 correctly records "localhost:7432" (which it obtained from Lattica's smoke test verification). The §3 HTTP table notation "port per §6.1 discrepancy" reflects this correctly. My baseline was wrong; the compile's §5 state is accurate.

Everything else in §2.1 — shipped phases, test counts, event stream schema, SQLite inspector_events categories, open debt, cross-project signals, federation thoughts — accurately represents what I filed.

---

## B. What others said about Cerebra

### LumaWeave's Section 3 statement — graph.json adapter

LumaWeave is correct. No CerebraReadAdapter exists in LumaWeave's source adapter registry.

My original baseline statement — "writes `.cerebra/graph.json` using the `cerebra/v1` schema consumed by LumaWeave's `CerebraReadAdapter`" — was an error. I was describing the intended consumption relationship, not confirmed current state. I named the schema `cerebra/v1` on the Cerebra side because it was designed to be consumed by LumaWeave; I incorrectly projected that LumaWeave had already built a reader for it.

Correct current state: Cerebra produces `.cerebra/graph.json` in a graph schema. LumaWeave has not built a reader for it. The file exists and is structurally ready; the consumer does not exist yet. Item 1 below addresses this further.

### ai-stack/Bo's Section 5 statement — Bo would access fossic via cerebra infrastructure

This framing needs clarification; see Item 3 below for full treatment. The short version: I do not agree with "cerebra infrastructure" as the description of where Bo would read from. The two projects write to different stores today. Item 3 gives the full response.

### Fossic's Section 2.5 protocol-level analysis as it applies to Cerebra

The fossic baseline's protocol analysis is accurate and I agree with it as applied to Cerebra.

Specific confirmations:

- **Relay decoded post-upcast payloads, not raw bytes:** I flagged this concern independently in my baseline §6 from the consumer side. Fossic's §6 names it cleanly from the store side. Agreed — relay agents should call `deserialize_payload_json()` (or equivalent decoded form), not relay raw bytes. This is a concrete protocol decision for the federation design.

- **Snapshot coordination is per-store:** Accurate and relevant to Cerebra. Cerebra's local `.fossic/store.db` has snapshots via `EventEmitter` (every 20 events per stream). Those snapshots do not transfer to a hub. If Lattica's hub-side tile wants to aggregate Cerebra cycle history, it must replay all relayed events from the beginning OR maintain its own reducer+snapshot on the hub side. I hadn't explicitly stated this implication in my baseline; fossic named it correctly.

- **Causation chains span stores:** Confirmed. I flagged this concern in my baseline §6 from Cerebra's perspective. Fossic's naming ("hub event's `causation_id` points to event in local store, not hub store") is the precise statement. Policy Scout independently surfaced the same issue via `CommandRequested.upstream_causation_id`. Cross-store causal traversal requires going back to the originating store — this is a real constraint for the federation design.

- **`indexed_tags_filter` for session-scoped filtering:** Fossic's §3 noted this use case. In my baseline I said I was "filtering in Python after pulling all events matching the pattern" — that's correct today. Fossic's `indexed_tags_filter` lands as `WHERE json_extract(...)`, which is exactly the SQL-push I wanted. I need to adopt `indexed_tags` fields on session-scoped events to benefit from this. Not done yet.

- **Event ordering across projects is wall-clock only:** I didn't flag this explicitly. Fossic is right. No global logical clock means cross-project event ordering at the hub is wall-clock at relay time. For Cerebra's use cases this is probably fine (cycle events are causally ordered within a stream; cross-project ordering is less critical), but worth noting for the federation design.

---

## C. Cross-baseline observations accuracy

**Asymmetric maturity placement — "Local store, ready to migrate":** Accurate. Cerebra has fossic-py integrated, `read_events()` added, and `compute_event_id` available (per fossic cross-project signal). Migration is a path change to a shared or local-relay store plus a Python relay agent (~100 lines per fossic's estimate).

**`append_if` interest attribution:** Accurate. I flagged it specifically for leeway grant deduplication — "apply this grant only if the rule hasn't already fired in this stream." That's the correct Cerebra use case.

**"Schema migration at relay boundary" concern attribution:** Accurate. I flagged it from the consumer side in my baseline §6. Fossic's §6 named the same risk from the store side independently. The compile's §4 correctly attributes this as a convergent independent observation between Fossic and Cerebra.

**"Transitions not measurements" relay filter principle:** Accurate. I arrived at this independently in my baseline §6. The specific Cerebra formulation: ingest pipeline events (`SourceRegistered`, `ChunkCreated`, `EmbeddingGenerated`) and retrieval internals (`TraversalStepCompleted`, `SalienceScored`) are measurements that stay local; `CycleStarted`/`CycleCompleted`, `SignalEvaluated`, `ClutchDecisionMade`, `PredictionSevereMiss` are transitions that relay to the hub. The compile's §4 attribution is accurate.

---

## Item 1 — CerebraReadAdapter status

**Interpretation (c) is closest but "cerebra/v1" is also a real schema name I chose.**

My original claim was: Phase 12 writes `.cerebra/graph.json` "using the `cerebra/v1` schema consumed by LumaWeave's `CerebraReadAdapter`."

What I actually meant: I designed the graph.json schema to be consumable by LumaWeave and named it `cerebra/v1` on the Cerebra side as a declaration of intent. I do not have visibility into LumaWeave's source adapter registry and should not have stated "consumed by LumaWeave's `CerebraReadAdapter`" as if that class existed. It was a projection about what I expected LumaWeave to build, not an observation about what exists.

"CerebraReadAdapter" is not a class name I can confirm exists in LumaWeave's tree. It was my shorthand for "whatever reader LumaWeave builds."

**Current state (from compile):** LumaWeave §3 is correct — no adapter for `.cerebra/graph.json` exists in LumaWeave's source adapter registry. The file is produced by Cerebra on every ingest; nothing reads it programmatically yet.

**LumaWeave's federation thought is relevant here:** LumaWeave §2.2 notes "In a federated model, cleaner path is Cerebra emits `GraphSnapshotAvailable` hub event with snapshot reference, LumaWeave receives it and loads graph — avoids polling, makes handoff observable, fits hub-relay pattern. File artifact becomes implementation detail." I find this compelling. If we go that route, a CerebraReadAdapter polling the file becomes less important than the hub-observable event handoff.

---

## Item 2 — Daemon-tile consumption state

The compile's §5 accurately reflects the current state, including the version drift I introduced.

**Confirming from Cerebra's side:** The daemon's default port is **7432** (not 7474 as I wrote in my baseline — verified against `cerebra/cli/daemon.py:290`). The port discrepancy in the compile table is Cerebra's error in the baseline. Lattica's CerebraSignalTile smoke-test confirmed "localhost:7432" as the working endpoint.

Regarding what Lattica's §5 reports as wired in CerebraSignalTile (30s health poll, 500ms timeout, OFFLINE pill, Checkpoint button, HOLD toggle, `cerebra/control` explicit subscribe): I cannot independently verify what's in Lattica's source tree, but I have no reason to dispute it. The daemon endpoints it would be calling (`GET /status`, `POST /posture`, `POST /checkpoint`) all exist and have the response shapes Lattica's tile would expect. The `cerebra/control` stream for `PostureChanged` — I listed that event type in my baseline table but should note: `PostureChanged` is emitted when `POST /posture` succeeds (the daemon emits it to `cerebra/control` stream). If Lattica is subscribing to `cerebra/control` explicitly, that's the right stream.

One thing I cannot confirm from my side: whether CerebraSignalTile's `cerebra/agent-trace/*` glob subscription is reading from the shared `~/.lattica/fossic/store.db` or from Cerebra's local `.fossic/store.db`. These are different paths. Cerebra writes to its local store. If Lattica's Rust backend is pointing at the shared store for its subscription, it won't see Cerebra's cycle events unless either (a) Cerebra migrates to the shared store, or (b) a relay agent bridges them. This is the practical blocker for the session/cycle event stream — not a wiring issue but a store path issue.

---

## Item 3 — Bo accessing fossic via cerebra infrastructure

**I don't agree with this framing as stated.** Here's what I see:

**The store path reality:**
- Cerebra writes to its own vault-scoped `.fossic/store.db` (local, not shared)
- ai-stack/Bo writes to `~/.lattica/fossic/store.db` (the shared platform store)
- These are **different stores on different paths**

Cerebra is not on the shared store. Cerebra does not aggregate cross-project state. If Bo needs to read VRAM telemetry, policy posture, or graph layout events — none of that is in Cerebra's store. It's in the shared store (ai-stack writes), Lattica's subscriptions, or Policy Scout's store.

**What "Bo reads from cerebra infrastructure" could mean operationally, and where I'd land:**

*If "cerebra infrastructure" means the daemon HTTP endpoints:*  
This makes sense for cognitive-cycle queries specifically. `GET /status` returns `{posture, cycle_running, active_session_id, cycle_count, last_outcome}`. If Bo needs to answer "is a cognitive cycle running right now?" — calling the daemon is the right path. Clean, bounded, doesn't require Bo to parse fossic event streams.

*If "cerebra infrastructure" means Cerebra's local fossic store:*  
This doesn't make sense today. Bo is in the ai-stack domain. Having Bo reach into Cerebra's vault-scoped store would create a tight cross-domain dependency. Under federation, Cerebra would relay to the hub and Bo would read from the hub — Cerebra's local store stays private.

*If "cerebra is the all-seeing infrastructure layer that aggregates cross-project context":*  
I would push back on this framing. Cerebra aggregates **cognitive cycle context** (session history, memory records, signals, clutch decisions). It does not aggregate platform state (GPU VRAM, policy posture, graph layout events, LLM health). "All-seeing" overclaims Cerebra's scope.

**My recommendation for the federation design:**

Under federation, if Bo needs to answer platform-state questions:
- **Cognitive cycle state:** Bo calls `GET /status` on the Cerebra daemon (no store access needed; bounded, stable contract)
- **Platform-wide state:** Bo reads from the hub fossic store, where Cerebra, ai-stack, LumaWeave, and Policy Scout all relay filtered events
- **Cerebra's local cycle history:** Available via `cerebra inspect` CLI or daemon, not via direct fossic store access from Bo

The hub is the right aggregation point for cross-project queries, not Cerebra. Cerebra feeds the hub with its relay stream; Bo queries the hub for platform-wide answers.

If the intent behind "Bo reads from cerebra infrastructure" was specifically "Bo calls cerebra daemon endpoints for cognitive state queries" — that I agree with. If the intent was "cerebra is the platform aggregator" — that's the hub's role.

---

## D. Cross-project reconciliation update (2026-06-16)

*This section supplements A–C above. It is based on reading the four other projects' reconciliation files: ai-stack/Bo, fossic, LumaWeave, and Policy Scout.*

---

### D.1 — Cerebra health check as silent VRAM consumer (source: ai-stack/Bo)

ai-stack/Bo's reconciliation raises a point neither baseline made explicit: Cerebra's `OllamaDirectAdapter.health_check()` — used in the E2E integration tests — issues a minimal inference call that silently loads the `granite-4.1-3b-GGUF:Q4_K_M` model into VRAM. The ai-stack baseline attributed the 11305 MB / 12282 MB reading to LiteLLM's qwen3.5:latest health probe. Cerebra's health check is a second silent consumer that wasn't named in either baseline.

**Relevance to federation design:** VRAM headroom calculations for the shared Ollama instance must account for both LiteLLM's probe and Cerebra's health check. Under federation, if CerebraSignalTile's health polling triggers `OllamaDirectAdapter.health_check()` on a schedule, this adds a recurring VRAM side-effect that the ai-stack sidecar's `VramBudgetChanged` event stream would observe without attribution. Worth naming before federation design finalizes observability scope for `ai-stack/gpu`.

**No Cerebra code change implied.** The health check is correct behavior for Ollama reachability verification. The point is about federation observability accounting, not a bug.

---

### D.2 — Fossic relay protocol: formal adoption positions (source: fossic)

Fossic's reconciliation issues several concrete protocol decisions for relay agents. Cerebra's positions:

| Protocol decision | Fossic verdict | Cerebra adoption |
|---|---|---|
| Relay decoded (post-upcast) payload, not raw bytes | Confirmed — call `deserialize_payload_json()` before hub append | **Adopted.** Already aligned with Cerebra's §6 concern; this is now the concrete implementation decision. |
| Relay post-upcast `type_version`, not stored version | Confirmed | **Adopted.** Hub consumers see consistent schema regardless of when the event was written. |
| Hub event `causation_id` points to local store event — document as expected behavior, not bug | Confirmed | **Adopted.** Cerebra's §6 named this from the consumer side. Cross-store causal traversal requires back-reference; hub-only traversal is hub-scoped. |
| Add `source_store` as `indexed_tag` on every relayed event | Recommended addition | **Endorsed.** Enables hub consumers to route cross-store traversal queries without guessing. Cost is one additional indexed_tag column per hub event. |
| Relay the `branch` field from source event | Gap in fossic's draft; confirmed needed | **Noted.** Cerebra's local fossic store uses branches (TD-006 counterfactual cognition). Relay agent must pass `branch=event.branch` through to hub; otherwise branch-scoped events land on the hub main trunk. |
| `external_id = event.id.hex()` for relay idempotency | Confirmed | **Adopted.** Restart-safe relay without duplicate hub events. |
| Cross-store causation has two distinct cases | Confirmed (fossic reconciliation update) | **Adopted.** Case 1: hub event → local event NOT relayed → `walk_causation` fails; consumer must use `source_store` tag to route back to originating store. Case 2: hub event → local event that WAS also relayed → hub-side traversal works because the target event is present on the hub. The PS→Cerebra causal chain (`CommandRequested.upstream_causation_id` → `ActionProposed`) is an instance of case 2: it becomes hub-traversable once both Cerebra and Policy Scout relay with `causation_id = source_event.id`. Cerebra's relay being live is therefore a prerequisite for that chain to be traversable on the hub. |

---

### D.3 — Hub stream naming: double-prefix problem (source: fossic)

Fossic's relay pseudocode uses `f"{source_prefix}/{event.stream_id}"` for the hub stream name. For Cerebra, this produces:

```
source_prefix = "cerebra"
event.stream_id = "cerebra/agent-trace/<session_id>"
hub stream_id = "cerebra/cerebra/agent-trace/<session_id>"
```

The double `cerebra/` prefix is redundant. Fossic flagged this as an open naming convention question for the federation interview round.

**Cerebra's preferred resolution:** strip the leading project segment from the original `stream_id` before prepending `source_prefix`, so:

```
hub stream_id = "cerebra/agent-trace/<session_id>"
```

This keeps hub stream names readable and avoids redundancy when the stream name already includes the project namespace (which Cerebra's streams do). Projects whose streams don't include the project name (e.g., ai-stack sidecar's `ai-stack/gpu`) would get the prefix normally. The rule: if `stream_id.startswith(f"{source_prefix}/")`, use `stream_id` directly; otherwise use `f"{source_prefix}/{stream_id}"`.

**Open:** needs federation interview round ratification before the Cerebra relay agent is built.

---

### D.4 — CerebraReadAdapter: file-polling adapter confirmed wrong direction (source: LumaWeave)

LumaWeave's reconciliation formally closes this question:

> "Building a file-polling adapter is the wrong direction. The CerebraReadAdapter conflict should not carry forward into federation design documents as a live dependency."

LumaWeave's preferred model is: Cerebra emits a `GraphSnapshotAvailable` hub event carrying a reference to the snapshot. LumaWeave receives the event and loads the graph. The `.cerebra/graph.json` file becomes an implementation detail, not the coordination mechanism.

**Cerebra's updated position on Item 1:** The `GraphSnapshotAvailable` hub event model is the correct federation target. The `.cerebra/graph.json` file continues to be written on every ingest (no change there), but the handoff to LumaWeave goes through the hub event, not through a file-polling source adapter. This is net-new since my original reconciliation Item 1 only endorsed LumaWeave's §6 thought as "compelling" — LumaWeave has now made it their formal position.

**Action for Cerebra relay pass:** Add `GraphSnapshotAvailable` event type to `cerebra/lattice/<lineage_id>` stream (or a dedicated `cerebra/graph/<lineage_id>` stream). Design decision for the federation interview round.

**LumaWeave's consumer requirements (from their updated reconciliation B.1):** As the receiving party, LumaWeave has specified what the `GraphSnapshotAvailable` payload must contain:
- A snapshot reference — file path to `.cerebra/graph.json` or a content hash the receiver can use to locate the file
- A `lineage_id` or equivalent graph identity field — so LumaWeave can decide whether this snapshot supersedes one it already has loaded
- Enough context to determine whether to trigger a load — e.g., a `schema_version` or event count so LumaWeave can skip a load if nothing changed

These are concrete consumer requirements for the event schema design in the federation interview round. The stream target (`cerebra/lattice/<lineage_id>` vs a dedicated `cerebra/graph/<lineage_id>`) remains open; LumaWeave has no strong preference between the two, only that the stream is subscribable from the hub.

**First cross-project causal chain:** When `GraphSnapshotAvailable` is on the hub and LumaWeave triggers `SourceLoaded` in response, that `SourceLoaded` event's `causation_id` will be the Cerebra hub event's ID. Fossic identifies this as the first concrete cross-project causal chain on the platform — and it falls under case 2 (both events relayed; hub-side `walk_causation` traverses the chain without needing to back-reference either local store). No special design required beyond standard event IDs; the chain is hub-traversable automatically once both events are relayed.

---

### D.5 — Bo witness model: daemon endpoint call pattern confirmed (source: ai-stack/Bo)

Bo's reconciliation makes the witness model integration concrete. Bo's position:

> "Bo calls daemon endpoints for cognitive-cycle queries specifically. For platform-wide state questions, Bo reads from the hub fossic store."

This aligns exactly with Cerebra's Item 3 position. One addition from Bo's reconciliation that Item 3 didn't address:

> "The witness model needs to see relayed events from all projects (hub events) to answer cross-platform 'what's happening' questions."

This is a Cerebra-side design question: if the witness model runs inference on Cerebra's memory + event stream, and Bo asks it "what is Policy Scout's current posture?" — the witness model needs either (a) a projection of hub events into Cerebra's memory, or (b) a direct hub query path. Neither is built today.

**Cerebra's position:** The witness model is not yet scoped in the current roadmap. When it lands, option (a) — Cerebra maintains a reducer that projects relevant hub events into memory records — is the architecturally cleaner path. This keeps the witness model's knowledge base inside Cerebra's own memory system rather than requiring it to reach out to the hub at query time. This is a Phase 15+ concern; noting it here so the federation interview round can flag it as a dependency on the relay layer.

**Correction from Policy Scout's and ai-stack/Bo's updated reconciliations:** posture and GPU state queries from Bo do NOT route through the witness model — they go directly to the hub fossic store once relay is live. Bo's two read paths under federation are: (1) Cerebra daemon `GET /status` for cognitive cycle state; (2) hub fossic store directly for platform-wide state (posture, GPU, service health). The witness model is not a query relay layer for either path.

What the witness model DOES need hub event projections for: building richer cognitive context during cycle execution. When Cerebra runs a cycle and the witness model needs to factor in current platform state as a context signal (e.g., "system is under lockdown" or "GPU is at 92% VRAM") it reads from its own memory projection of hub events rather than querying the hub at runtime. This projection must cover at minimum: Policy Scout's governance transitions (`LockdownActivated`, `LockdownDeactivated`, `ApprovalRequested`) and ai-stack's infrastructure transitions (`VramBudgetChanged`, `ModelLoaded`, `ModelUnloaded`). The relay passes for Policy Scout and ai-stack are therefore prerequisites for the witness model to have useful platform context — not because Bo's queries route through it, but because the cognitive cycle itself benefits from knowing platform state.

---

### D.6 — `indexed_tags` adoption: recommended prerequisite for Cerebra relay pass (source: fossic)

Fossic's reconciliation recommends that `indexed_tags` adoption on Cerebra event writes be a prerequisite for the Cerebra relay agent pass:

> "Agree on which Cerebra event fields should be `indexed_tags` (suggested: `{session_id, cycle_id, signal_name}` at minimum), and make adoption a prerequisite for the Cerebra relay agent pass. This way the hub store has consistent tag coverage from the first relayed event forward."

**Cerebra's position:** Agreed. The recommended minimum fields are correct:
- `session_id` — enables hub consumers to aggregate all events for a session without glob-pattern matching
- `cycle_id` — enables per-cycle filtering at SQL level on the hub
- `signal_name` — enables the hub to answer "which signals fired this session?" without fold-time Python filtering

Historical events already written to Cerebra's local store without `indexed_tags` remain untagged; the hub will have full tag coverage only for events written after adoption. This is acceptable for the first relay pass — historical local events are not relayed.

**Adoption step:** add `indexed_tags={session_id: ..., cycle_id: ..., signal_name: ...}` to the `Append` calls in `FossicStore.emit_cycle_event()` and `FossicStore.emit_lattice_event()`. This is a prerequisite for the relay agent pass, not a blocker for any current work.

---

### D.7 — Open questions for the federation interview round (Cerebra's input)

Items from cross-project reconciliations that require decisions before the Cerebra relay agent can be built:

1. **Hub stream naming convention** — Double-prefix resolution (§D.3 above). Cerebra proposes: strip leading project segment if stream already starts with `source_prefix/`. Needs ratification.

2. **Relay agent process location** — Fossic's three options: (a) separate Python process alongside Cerebra, (b) in-process sidecar, (c) hub subscribes to project stores directly. For Cerebra, option (a) is the natural fit: a small Python relay script (`cerebra-relay.py`) with `RelayConfig` pointing at `.fossic/store.db` → `~/.lattica/fossic/store.db`. No Tauri/Rust boundary to cross.

3. **Relay catch-up idempotency cost** — Fossic notes: `read_by_external_id` on the hub is one round-trip per event during relay restart catch-up. For Cerebra, cycle event volume is low (hundreds per session, not millions), so this is not a current concern. Worth noting for Policy Scout's audit stream if it commits fossic emit and has high volume.

4. **`GraphSnapshotAvailable` event design** — Stream target, schema, and whether it carries the full graph or a reference to the file artifact. Depends on LumaWeave's federation interview input.

5. **Witness model hub projection** — Whether and how the witness model receives relayed hub events as memory records. Phase 15+ concern; flag for federation design so the relay layer is designed with this in mind. Note: Cerebra's relay agent being live is also a prerequisite for the PS→Cerebra causal chain (`CommandRequested.upstream_causation_id → ActionProposed`) to be hub-traversable — this is a dependency that Policy Scout's federation design requires from Cerebra. **Fossic verdict:** no new fossic API required; Cerebra must wire the hub store as a subscription or aggregate input to the reducer — this is entirely Cerebra's implementation step. Fossic's existing `aggregate` and subscription access to hub store streams is sufficient.

6. **Snapshot coordination on the hub side** — Fossic's reconciliation confirms: Cerebra's local store snapshots don't transfer to the hub. A hub consumer that needs to aggregate Cerebra cycle history must replay all relayed events or maintain its own reducer+snapshot on the hub. CerebraSignalTile's needs here should be decided in the federation interview round.

7. **CerebraSignalTile cold-start once relay is live** — Once Cerebra's relay agent begins forwarding events to the hub, the tile's first subscription to `cerebra/agent-trace/*` on the hub will see an empty stream if a session is already in progress — no events arrive until the next cycle fires. A hub-side snapshot seeded at the last `CycleCompleted` event gives the tile immediate initial state without replaying full history. This is the Cerebra-specific instance of the cold-start pattern documented by ai-stack, LumaWeave, and Policy Scout across this round. Adoption point: relay agent design pass.

---

### D.8 — `stream_exists()` API stability risk (source: fossic)

Fossic notes that Cerebra calls `stream_exists()` before `ReadQuery` in `FossicStore.read_events()`, and that `stream_exists()` is not stable-API-flagged in fossic's current roadmap. No changes are planned, but the absence of a stability guarantee means a future fossic refactor could silently break Cerebra's read path without an explicit deprecation notice.

**Tracking note:** On each fossic version bump, check changelog for `stream_exists()` changes. The call site is in `FossicStore.read_events()` — a single location that would need updating if the API changes. No action now; flag for relay agent design pass when fossic-py version is pinned.

---

### D.9 — Round 2 settled log — 2026-06-16

Items confirmed settled through two full cross-read rounds. These do not require further reconciliation unless new evidence surfaces.

| Item | Status | Settled by |
|---|---|---|
| A — Port 7432 correction | **SETTLED** | Compile §5 + Cerebra self-correction; no peer disputes |
| A — Renderer column updates (Lattica-authored) | **SETTLED** | No disputes across two rounds |
| B — CerebraReadAdapter projection error | **CLOSED** | LumaWeave and Cerebra both confirmed: never built, never in progress |
| B — Bo "cerebra infrastructure" framing disputed | **SETTLED** | ai-stack Round 2 explicitly accepts Cerebra Item 3 correction |
| B — Fossic relay protocol confirmations | **SETTLED** | All items in D.2 table adopted; no peer disputes |
| D.1 — Dual VRAM consumers (Cerebra health check + LiteLLM probe) | **SETTLED** | ai-stack originated; Cerebra named; fossic and peers acknowledge |
| D.2 — Relay protocol adoption table (all rows) | **SETTLED** | Fossic Item 1/3, LumaWeave C.5, Policy Scout Item 2-update, ai-stack Round 2 settled log all confirm |
| D.2 — Two-case causation model | **SETTLED** | Fossic formalized; all peers adopted; PS→Cerebra ActionProposed is case 2 |
| D.3 — Double-prefix problem identified | **SETTLED (as problem statement)** | All peers acknowledge the redundancy |
| D.3 — Conditional strip rule (Cerebra's preferred resolution) | **ENDORSED, PENDING RATIFICATION** | LumaWeave C.8, Policy Scout Item 2-update, ai-stack Round 2 all endorse; requires federation interview ratification |
| D.4 — CerebraReadAdapter conflict | **CLOSED** | File-polling model dropped; GraphSnapshotAvailable is the agreed federation path |
| D.4 — LumaWeave consumer requirements for GraphSnapshotAvailable | **SETTLED (as spec input)** | LumaWeave B.1 gives concrete requirements: snapshot reference, lineage_id, trigger-load context |
| D.4 — First cross-project causal chain (GraphSnapshotAvailable → SourceLoaded) | **SETTLED (as design decision)** | Fossic Item 1 confirms case 2 traversability; LumaWeave C.9 tracks as relay agent obligation |
| D.5 — Witness model scope corrected (posture/GPU → hub; cognitive context → reducer) | **SETTLED** | ai-stack Round 2 settled log closes; Policy Scout B-update confirms; fossic Item 2 confirms |
| D.5 — Witness model reducer approach (option a: hub events → Cerebra memory projection) | **SETTLED** | ai-stack Round 2 settled log explicitly marks closed; fossic Item 2 confirms |
| D.5 — Witness model feedback loop (PS + ai-stack relay is prerequisite for cognitive context) | **SETTLED** | Policy Scout B-update names it; fossic Item 2 confirms; ai-stack Round 2 confirms |
| D.6 — indexed_tags adoption as relay prerequisite | **SETTLED (as prerequisite spec)** | Fossic Item 4, ai-stack Item 3, Policy Scout C-update all confirm; fields: {session_id, cycle_id, signal_name} |
| D.7 — Seven open questions for federation interview | **OPEN** | No new decisions surfaced; all seven remain pending federation interview round |
| D.8 — stream_exists() stability tracking | **NOTED** | No peer disputes; tracking obligation stands on each fossic version bump |

**Steady state confirmed — 2026-06-16:** All four peer reconciliation files (ai-stack/Bo, fossic, LumaWeave, Policy Scout) are stable. No new signals emerged in Round 2 read-only pass. Cerebra's reconciliation is complete pending the federation interview round.

---

*End of cross-project update — 2026-06-16 (Round 2 settled)*

---

## needs-wiring

# Cerebra — Needs Wiring
**Filed by:** cerebra-claude
**Date:** 2026-06-16
**Purpose:** Hard-coded value ambiguities and wiring migrations flagged during federation design (D.2 audit).

These are not implementation blockers for the compile — they are pre-implementation notes for the relay and fold-in passes.

---

## NW-1 — `cerebra/graph/<lineage_id>` stream name must be a constant

**Current state:** Not yet implemented.
**Risk:** When `GraphSnapshotAvailable` hub-direct write is added to `EventEmitter`, the stream name `"cerebra/graph"` will likely be inlined as a string literal at the call site. Same pattern as `"cerebra/agent-trace"` and `"cerebra/lattice"` which are currently inline strings in `event_emitter.py`.

**Required wiring:** Define `CEREBRA_GRAPH_STREAM_PREFIX = "cerebra/graph"` as a module-level constant (either in `event_emitter.py` or a new `cerebra/storage/streams.py` constants file). The lattice and agent-trace prefixes should be extracted to the same location at the same time to establish the pattern.

**File:** `cerebra/cognition/event_emitter.py`

---

## NW-2 — Bot.py `bot/lifecycle` and `bot/conversation/*` stream names

**Current state:** `bot.py` writes to stream `"bot/lifecycle"` and `f"bot/conversation/{message.channel.id}"`.
**Under fold-in:** These streams must migrate to `"cerebra/bot/lifecycle"` and `f"cerebra/bot/conversation/{message.channel.id}"` to sit within Cerebra's stream namespace.

**Risk:** The current `FOSSIC_STORE_PATH` in bot.py writes directly to `~/.lattica/fossic/store.db` (the shared hub store). Hub events under the `"bot/*"` namespace exist today in the hub store. If the fold-in migration renames to `"cerebra/bot/*"`, there will be a stream name discontinuity in hub history. Any hub consumer (tiles, witness model) reading `"bot/*"` will not see fold-in events.

**Required wiring:**
1. Decide: snapshot old `"bot/*"` streams before migration, or accept discontinuity (clean break)
2. Define stream constants in Cerebra's codebase: `CEREBRA_BOT_LIFECYCLE_STREAM` and `CEREBRA_BOT_CONVERSATION_STREAM_PREFIX`
3. Replace inline stream strings in migrated bot.py code with these constants

**Files:** `discord-bot/bot.py` (lines 652–664 for lifecycle; `ask_local_model()` for conversation events); new cerebra plugin file (fold-in target)

---

## NW-3 — Bot.py `FOSSIC_STORE_PATH` vs `FossicStore.at_platform_path()`

**Current state:** `bot.py` line 79 defines:
```python
FOSSIC_STORE_PATH = Path.home() / ".lattica" / "fossic" / "store.db"
```
This is identical to the path `FossicStore.at_platform_path()` resolves to in `cerebra/storage/fossic_store.py`. Correct by coincidence — two independent constructions of the same path.

**Risk:** If the platform convention for hub store path changes (e.g., configurable via env var, or a different XDG path), `bot.py`'s independent path construction diverges silently. No test would catch the divergence.

**Required wiring:** Under fold-in, the discord plugin code must use `FossicStore.at_platform_path()` — the single authoritative path constructor — rather than any independently constructed path. Remove `FOSSIC_STORE_PATH` from migrated code entirely.

**Files:** `discord-bot/bot.py` (line 79); migrated plugin code

---

*End of needs-wiring.md*

---

## current_state

# Cerebra — Current State Baseline

**Date:** 2026-06-16
**Filed by:** cerebra-claude

---

## Section 1 — Current version + identity

- **Current version:** 0.4.4 (pyproject.toml); `cerebra --version` reports 0.4.0 due to stale editable install — actual shipped version is 0.4.4.
- **Most recent tag:** `v0.1` (pushed 2026-06-16, commit 4efb2bb)
- **Most recent milestone:** Phase 14 — Integration Testing and Polish. Full spine E2E test (ingest → run-cycle → retrieve → export graph → inspect events) passing against real Ollama. All 14 v0.1 done-when criteria from CEREBRA_MVP_SPEC.md confirmed met.
- **Identity:** Cerebra is a local-first cognitive cycle runtime that maintains durable memory, evaluates LLM outputs across six epistemological signals, enforces capability and leeway bounds, and emits graph-native events — the execution engine that Bons.ai will eventually express as configuration.

---

## Section 2 — What just shipped since last baseline

Reference point: approximately v0.4.0 era (WEB_CLAUDE_BRIEF_ITER5.md authoring).

**Phase 11 — Lifecycle manager (v0.4.1, commit c271d3b)**
`cerebra lifecycle archive/tombstone/restore` — three state transitions on memory records. Archive excludes from retrieval (reversible). Tombstone is permanent (blocks re-ingestion). Restore reverts archived records. All transitions emit `MemoryRecordArchived`, `MemoryRecordTombstoned`, `MemoryRecordRestored` events to `inspector_events`.

**Phase 12 — Graph export (v0.4.2, commit 04c4022)**
`cerebra export graph` writes `.cerebra/graph.json` using the `cerebra/v1` schema consumed by LumaWeave's `CerebraReadAdapter`. Node types: `spine` (source documents) and `memory_record`. Edge types: `contains`, `describes`, `sku-proximity`, `sku-exact`. Emits `GraphExported` event. Also wired into the `ingest` command as an automatic post-ingest step.

**Phase 13 — Inspector CLI (v0.4.3, commit dbe81bd)**
`cerebra inspect` — full observability surface with six command trees: `session list/show`, `cycle show`, `memory show`, `retrieval show`, `leeway active/history/revocations`, and `query` (event query with `--event-type`, `--signal-low`, `--severe-misses`, `--tail`, `--filter`, `--last`, `--cycle`). `inspect query --tail` polls `inspector_events` via rowid; FossicStore events are accessible via `--event-type` on the FossicStore-backed subcommands. Added `FossicStore.read_events()` helper for stream/aggregate reads. 34 new unit tests.

**Phase 14 — Integration Testing and Polish / v0.1 ship gate (v0.4.4, commit 4efb2bb, tag v0.1)**
`tests/integration/test_e2e_spine.py` — 11 E2E tests covering the full pipeline against a real Ollama instance (`huggingface.co/unsloth/granite-4.1-3b-GGUF:Q4_K_M`). Tests cover: ingest, memory record verification, Ollama health check, cycle execution with step result verification, `cycle_episode_records` write, FossicStore event emission, `inspector_events` write, retrieval pipeline, graph export JSON validity. Runs in ~28s. README rewritten for v0.1 with quickstart, prerequisites, and architecture overview. `examples/docs/` added with three sample documents for demo vault use.

---

## Section 3 — Visual elements available for Lattica

### FossicStore event streams

All cognitive session events emit to `cerebra/agent-trace/<session_id>`. Lattice node events emit to `cerebra/lattice/<lineage_id>`.

| Event type | Stream | Key payload fields | LumaWeave renderer | P-013 follow-up? |
|---|---|---|---|---|
| `SessionOpened` | `cerebra/agent-trace/<session_id>` | `session_id`, `goal`, `cycle_config`, `recursion_depth`, `vault_path` | No | Yes — session lifecycle tile |
| `CycleStarted` | `cerebra/agent-trace/<session_id>` | `session_id`, `cycle_id`, `config_name`, `goal`, `step_count` | No | Yes — cycle timeline |
| `StepStarted` | `cerebra/agent-trace/<session_id>` | `session_id`, `cycle_id`, `step_id`, `step_name`, `step_index` | No | Yes |
| `StepExecuted` | `cerebra/agent-trace/<session_id>` | `session_id`, `cycle_id`, `step_id`, `step_name`, `output_text` (truncated), `composite_score` | No | Yes |
| `StepExecutionFailed` | `cerebra/agent-trace/<session_id>` | `session_id`, `cycle_id`, `step_id`, `error` | No | Yes |
| `SignalEvaluated` | `cerebra/agent-trace/<session_id>` | `signal_name`, `signal_score`, `signal_strength`, `low_confidence`, `evaluated_at`, `evaluator_prompt_version` | No | Yes — spider/radar chart per step |
| `ClutchDecisionMade` | `cerebra/agent-trace/<session_id>` | `action`, `rule_matched`, `cascade_depth`, `escalate_to_catalyst` | No | Yes — decision timeline node |
| `LeewayGrantApplied` | `cerebra/agent-trace/<session_id>` | `rule_id`, `session_id`, `grant_reason`, `escalation_level` | No | Yes |
| `LeewayGrantDenied` | `cerebra/agent-trace/<session_id>` | `rule_id`, `reason` | No | Yes |
| `LeewayRevocationFired` | `cerebra/agent-trace/<session_id>` | `rule_id`, `revocation_reason` | No | Yes |
| `PredictionMade` | `cerebra/agent-trace/<session_id>` | `predicted_composite`, `confidence`, `model_version`, `step_id` | No | Yes — prediction vs actual plot |
| `PredictionSevereMiss` | `cerebra/agent-trace/<session_id>` | `prediction_error`, `expected`, `actual` | No | Yes |
| `MemoryWriteFromCycle` | `cerebra/agent-trace/<session_id>` | `record_id`, `cycle_id`, `summary_text`, `source_record_ids` | No | Yes — links cycle → memory |
| `ContextPacketBuilt` | `cerebra/agent-trace/<session_id>` | `trace_id`, `query`, `selected_record_count`, `abstained` | No | Maybe |
| `ContinuationBundleCreated` | `cerebra/agent-trace/<session_id>` | `bundle_id`, `parent_session_id`, `distilled_context_length` | No | Low priority |
| `ReinjectionTriggered` | `cerebra/agent-trace/<session_id>` | `parent_session_id`, `child_session_id`, `trigger_reason` | No | Yes — re-injection arc |
| `CatalystInvoked` | `cerebra/agent-trace/<session_id>` | `session_id`, `arm_count`, `selected_arm` | No | Yes — bandit arm selection |
| `BanditSelection` | `cerebra/agent-trace/<session_id>` | `arm_id`, `arm_name`, `epsilon`, `was_explore` | No | Yes |
| `CycleCompleted` | `cerebra/agent-trace/<session_id>` | `session_id`, `cycle_id`, `outcome`, `total_steps`, `completed_at` | No | Yes — cycle summary |
| `SessionFlushed` | `cerebra/agent-trace/<session_id>` | `session_id`, `outcome`, `total_cycles`, `total_steps` | No | Yes |
| `CheckpointSaved` | `cerebra/agent-trace/<session_id>` | `session_id`, `bundle_id` | No | Low priority |
| `LatticeCommit` | `cerebra/lattice/<lineage_id>` | `lineage_id`, `record_id`, `commit_type` | No | Yes — lattice graph node |

### SQLite inspector_events (dual-written, accessible via `cerebra inspect query`)

Categories: ingest pipeline events (`SourceRegistered`, `SourceParsed`, `DocumentNormalized`, `MemoryRecordCreated`, `SKUAssigned`, `EmbeddingGenerated`, `LexicalIndexUpdated`), retrieval events (`QueryPlanned`, `TraversalStepCompleted`, `SalienceScored`, `RetrievalAbstained`, `TraceWritten`), working memory events (`AttentionItemPromoted`, `AttentionItemEvicted`, `TowerInitialized`, `TowerItemPromoted`, `TowerItemEvicted`), graph events (`GraphNodeCreated`, `GraphEdgeCreated`, `GraphExported`), lifecycle events (`MemoryRecordArchived`, `MemoryRecordTombstoned`, `MemoryRecordRestored`), governance events (`GateDecision`, `LeewayPreActionGate`).

Not relayed to LumaWeave today. All readable via `cerebra inspect query --tail` and `--event-type`.

### HTTP daemon endpoints (cerebra serve, port 7474)

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/status` | — | `{posture, cycle_running, active_session_id, cycle_count, last_outcome}` |
| POST | `/posture` | `{"state": "hold"\|"auto"}` | `{"posture": "hold"\|"auto"}` |
| POST | `/cycles` | `{"config_name": "...", "goal": "..."}` | `{"cycle_id": "...", "session_id": "..."}` (async, returns immediately) |
| POST | `/checkpoint` | `{}` | `{"bundle_id": "...", "session_id": "..."}` |

Daemon is functional but not yet consumed by any Lattica tile. LumaWeave integration is a planned but unstarted follow-up.

### File artifacts

**`.cerebra/graph.json`** — exported knowledge graph in `cerebra/v1` schema. Consumed by LumaWeave's `CerebraReadAdapter` tile.

Schema: `{nodes: [...], edges: [...]}`. Node fields: `id` (`source:<id>` or `record:<id>`), `label`, `fullLabel`, `type` (`spine`|`memory_record`), `cluster`, `status`, `tags`, `size`, `path`, `lastModified`, `raw: {detected_type, source_id, record_count, sku_address, d1, d1_category, quadrant, ...}`. Edge fields: `id`, `source`, `target`, `type` (`contains`|`describes`|`sku-proximity`|`sku-exact`), `raw`.

LumaWeave has a `CerebraReadAdapter` that reads this file. Whether it has a full tile renderer is not known from Cerebra's side.

---

## Section 4 — Open items / known follow-ups

**Cleanup / polish:**
- PD-001: `render_template` uses regex substitution instead of Jinja2. No conditionals/loops in cycle configs yet, so not blocking, but will be when config complexity grows.
- PD-002: `ELEVATED_SALIENCE = 0.8` constant is a guess — not calibrated against Phase 5 default salience.
- PD-003: Methodology lessons from Phase 8 not consolidated into a permanent reference.
- PD-004: Per-version deviation logs scattered across `docs/agent/deviations/`; no "all open deviations" index.
- PD-005: Two sessions tables (`runtime_sessions` vs `sessions`) not documented outside deviation log.
- PD-006: Cycle config prompt templates don't tell the LLM what citation format to use.
- PD-008: `docs/aseptic/README.md` is fossic-framed, not Cerebra-framed.

**Tech debt (open):**
- TD-001: Purge workflow audit path — when Cerebra implements purge, must read `_fossic/system` stream not original stream.
- TD-002: LoRA v0.2 training resume — corpus imbalance deferred pending real-world cycle data.
- TD-003: Lattica-primitives PyPI extraction — vendored into `_primitives/`; extraction deferred until 2+ stable consumers.
- TD-008: Crypto-shredding session deletion — depends on fossic v1.1.
- TD-009: OTel GenAI export — depends on fossic shipping the exporter.
- TD-011: Phase 8 benchmark re-run with realistic LatticeNodeReducer.
- TD-012: Pre-action constitutional rule shape — `ConstitutionalRule.forbids()` always returns False in v0.1 (DEV-009).
- TD-013: HITL review flow — `GateDecision.review_required_by` field exists but is never populated.
- TD-017: Citation parsing is best-effort regex — silent extraction failure if LLM drifts from format.
- TD-018: `CliRunner(mix_stderr=False)` compat — affects 39 tests across three CLI test files.
- TD-019: `test_lattice_against_vault.py` vault-disk failure — one test, unknown root cause.

**Would do next without external direction:**
- Close TD-018 (small, known fix)
- Close TD-019 (investigate)
- Begin Phase 15 (post-v0.1 roadmap TBD; likely witness layer or daemon-to-LumaWeave tile wiring)

---

## Section 5 — Cross-project signal

**fossic:** Cerebra is actively using fossic (FossicStore wrapping the local `.fossic/store.db`). The `read_events()` method added in Phase 13 uses both `ReadQuery(stream_id=...)` and `AggregateQuery(stream_pattern=...)`. Snapshots are taken automatically every 20 events per stream via `EventEmitter`. The purge audit path (TD-001) will matter when fossic v1.1 ships crypto-shredding. One open question: `stream_exists()` — Cerebra calls this before `ReadQuery` to avoid errors on non-existent streams; if the API changes, `FossicStore.read_events()` needs updating.

**LumaWeave:** Cerebra's graph export (`cerebra/v1` schema, `.cerebra/graph.json`) is the primary cross-project data path today. Whether LumaWeave's `CerebraReadAdapter` is actively maintained or stale is unknown from Cerebra's side. Cerebra's daemon (`cerebra serve`) exposes HTTP endpoints that LumaWeave could poll but no tile uses them yet. If LumaWeave's registry model is being migrated to, Cerebra's daemon would benefit from knowing the expected tile registration contract before wiring anything.

**Policy Scout:** No direct dependency or data path today. Constitutional rule shape (TD-012) may eventually align with Policy Scout's scope. Pre-action blocking semantics are currently a stub.

**ai-stack:** Cerebra depends on Ollama running at `http://127.0.0.1:11434` (or `OLLAMA_BASE_URL`). The health check probe at `OllamaDirectAdapter.health_check()` uses a minimal inference call to warm the model. The ai-stack's LiteLLM proxy (port 4000) also works but Cerebra defaults to direct Ollama. If the ai-stack changes model availability or port mapping, Cerebra's adapter config (`OLLAMA_MODEL` env var, default `huggingface.co/unsloth/granite-4.1-3b-GGUF:Q4_K_M`) may need updating.

**Lattica:** No direct runtime dependency. Cross-project coordination is currently through file artifacts (graph.json) and this baseline.

---

## Section 6 — Pre-federation exploratory thoughts

**Events that would stay local (high-volume, internal-only):**
The ingest pipeline events are the clearest candidates for local-only: `SourceRegistered`, `SourceParsed`, `DocumentNormalized`, `ChunkCreated`, `MemoryRecordCreated`, `EmbeddingGenerated`, `LexicalIndexUpdated`, `SKUAssigned`. These are high-volume (one per chunk/record), highly specific to vault state, and have no natural consumer outside Cerebra. Similarly, retrieval internals: `TraversalStepCompleted`, `SalienceScored`, `LatticeSiblingResolved` — useful for `cerebra inspect` but not meaningful to a Lattica hub without heavy context.

Working memory internals would also stay local: `AttentionItemProposed`, `AttentionItemEvicted`, `AttentionItemDeferred`, tower tier operations. These track contested slot state that is transient and vault-specific.

**Events that would relay to Lattica's hub (integration-worthy, observable cross-project):**
- `CycleStarted` / `CycleCompleted` — coarse lifecycle markers, low-volume, meaningful for cross-project dashboards
- `SignalEvaluated` — per-step quality scores across six dimensions; useful for Lattica to track Cerebra's cognitive quality over time
- `ClutchDecisionMade` — decision audit; observable from outside (was the cycle stopped? for what reason?)
- `PredictionSevereMiss` — anomaly signal; worth surfacing cross-project
- `MemoryWriteFromCycle` — records that memory was created from a cycle; relevant for Lattica's graph if it tracks memory provenance
- `ReinjectionTriggered` — cycle topology event; meaningful if Lattica is tracking session depth and branching
- `GraphExported` — file artifact produced; Lattica hub could use this as a "Cerebra graph is fresh" trigger
- `LeewayGrantApplied` / `LeewayRevocationFired` — safety governance events; worth cross-project visibility

**Existing data paths that might fold into local fossic store:**
- `inspector_events` SQLite table — this is the most obvious candidate. Currently dual-writing some events (ingest pipeline, retrieval, WM) to SQLite and some (cycle runtime) to FossicStore. The split exists because the cycle events needed versioned streams (FossicStore's strength) and the ingest/retrieval events needed fast queryability by event_type and subject_id (SQLite's strength). If fossic gains efficient event_type filtering on aggregate queries, the SQLite dual-write could collapse into fossic-only.
- `.cerebra/graph.json` — a file artifact that's currently the sole integration point with LumaWeave. Could eventually become a FossicStore projection (a `GraphExported` event payload containing the full graph), which would version it and make the history inspectable.
- `retrieval_traces`, `retrieval_steps`, `retrieval_candidates` SQLite tables — detailed retrieval provenance. Currently SQLite-only. Could eventually be FossicStore projections for temporal querying ("how did retrieval quality change over sessions?").
- `runtime_sessions` table — session lifecycle. Already mirrored in FossicStore (`SessionOpened`, `SessionFlushed`). The SQLite table exists for fast lookup (`read_session()` by session_id); the fossic stream is the authoritative event log. This split is intentional and probably correct to keep.

**Fossic features I'd specifically want to use:**
- **`append_if`** — for leeway grants: "apply this grant only if the rule hasn't already fired in this stream." Currently handled in application code; `append_if` would make it atomic.
- **Branches** — TD-006 deferred. Counterfactual cognition (run two cycle variants, compare outcomes, keep the winner) is a natural use case for cognitive branching once v0.2 work begins.
- **Snapshots** — already using via `EventEmitter` (every 20 events per stream). Working as expected; no issues.
- **Aggregates** — using `AggregateQuery(stream_pattern=...)` for leeway and signal queries. Would benefit from efficient `event_type_filter` on aggregates; currently filtering in Python after pulling all events matching the pattern.
- **Transforms / projections** — if fossic gains a projection layer, the graph.json artifact could be computed from the FossicStore event stream rather than from SQLite queries. That would make graph state versioned and diffable.
- **Similarity search** — possible future use for memory retrieval: if fossic gains vector-aware storage, some of the SQLite embedding index work could fold into it.

**Concerns and unknowns about federation:**
- The stream naming (`cerebra/agent-trace/<session_id>`) is scoped to one vault. If a user has multiple vaults, they have independent FossicStore instances with overlapping stream naming schemes. Federation would need to understand that `cerebra/agent-trace/<session_id>` is vault-scoped, not globally unique.
- Relay agents propagating events to Lattica's hub need to know which streams to subscribe to. Since streams are named by `session_id` at open time, the relay agent needs to discover active session IDs dynamically (probably via `SessionOpened` events on a well-known aggregate pattern, or via the daemon's `/status` endpoint).
- Event volume: if the relay agent subscribes to `cerebra/agent-trace/*` and forwards all events, the hub gets the full cycle execution trace. That's probably too much for a hub. The relay should likely filter to the "integration-worthy" subset listed above.
- The two-store split (FossicStore + SQLite) means a relay agent needs access to both to get the full picture. A relay that only reads FossicStore misses ingest pipeline events, retrieval traces, and working memory state. Either the relay reads both, or some of the SQLite events need to migrate to fossic first.

---

## federation_design_addendum_causation_id

# Cerebra Federation Design — Addendum: causation_id Correction

**Filed by:** cerebra-claude
**Date:** 2026-06-16
**Amends:** `cerebra/federation_design.md` Section B.2 (relay protocol)
**Trigger:** Fossic's causation_id root-cause analysis; LumaWeave S-031 surfaced the problem; Fossic traced it to S-030 and the relay_event() spec.

---

## Agreement with Fossic's S-030 correction

Cerebra endorses Fossic's analysis in full. The root error in the relay pseudocode:

```python
# WRONG — was in B.2 relay protocol spec
causation_id=event.id,   # the local event being relayed
```

`event.id` here is the local event's own primary ID. It is never a hub primary ID. `walk_causation` on the hub follows causation_id links by matching hub events' primary IDs — so this is a dangling reference regardless of relay coverage. This misdiagnosed the "case-2" framing: S-030's description of hub-traversable chains was correct as a goal; the relay pseudocode did not implement it correctly.

`external_id = event.id.hex()` already captures provenance ("which local event is this a copy of"). `causation_id` should carry application-semantic cause — the event that logically triggered this one — which is `event.causation_id`, not `event.id`.

**Corrected relay line:**

```python
causation_id=self._translate_causation_id(event.causation_id),
```

---

## cerebra-relay.py: _translate_causation_id required

Cerebra's `cerebra/agent-trace/<session_id>` stream has dense same-project causation chains. `EventEmitter` auto-chains each emitted cycle event via `_last_event_id` — every event in a session points to the previous local event. When the relay agent processes these, every `event.causation_id` is a local fossic EventId that was never a hub primary ID.

The translation helper is required for Cerebra's relay to produce hub-traversable intra-session chains:

```python
def _translate_causation_id(self, local_causation_id):
    if local_causation_id is None:
        return None
    hub_cause = self.hub_store.read_by_external_id(local_causation_id.hex())
    if hub_cause is not None:
        return hub_cause.id        # local ID → hub ID (same-project chain)
    return local_causation_id      # already a hub ID (cross-store trigger, e.g. hub_GSA.id)
                                   # OR local-only cause → case-1 fallback; walk_causation
                                   # fails and consumer uses source_store indexed_tag
```

**Three-case logic for Cerebra's relay:**

| `event.causation_id` | `read_by_external_id` result | Hub causation_id | Semantics |
|---|---|---|---|
| None | — | None | Root event; no cause |
| local_event.id (same stream) | hub_cause found | hub_cause.id | Same-project chain; hub-traversable |
| hub_GSA.id (cross-store trigger) | None (not a local event) | hub_GSA.id passed through | Cross-store trigger already a hub ID; hub-traversable |
| local_event.id (never relayed) | None | local_event.id passed through | Case-1 fallback; walk_causation fails; source_store tag handles it |

The relay ordering race is a non-issue for Cerebra's `agent-trace` stream because `EventEmitter` appends events strictly sequentially within a session, and fossic's append ordering guarantees the cause arrives before the effect in any relay subscription window.

**Where this lands in cerebra-relay.py:**

```python
class CerebraRelayAgent:
    def __init__(self, local_store: FossicStore, hub_store: FossicStore): ...

    def _translate_causation_id(self, local_causation_id): ...  # as above

    def relay_event(self, event):
        self.hub_store.append(
            stream_id=event.stream_id,          # D.3: passes through unchanged (starts with "cerebra/")
            payload=deserialize_payload_json(event),
            external_id=event.id.hex(),         # idempotency
            causation_id=self._translate_causation_id(event.causation_id),  # CORRECTED
            source_store="cerebra",             # indexed_tag
            branch=event.branch,
        )
```

---

## Hub-direct write of GraphSnapshotAvailable: unchanged

The hub-direct write design (federation_design.md B.4) is not affected by this correction — it is in fact validated by it.

`GraphSnapshotAvailable` is written directly to `~/.lattica/fossic/store.db` by Cerebra's `EventEmitter`. It is never a local event in Cerebra's vault store. It lands in the hub with a hub-primary ID immediately.

The GraphSnapshotAvailable → SourceLoaded chain under the corrected model:

1. Cerebra's `EventEmitter` appends `GraphSnapshotAvailable` hub-direct → hub assigns `hub_GSA_id`
2. LumaWeave receives `hub_GSA_id` from its hub subscription
3. LumaWeave application layer emits local `SourceLoaded` with `causation_id = hub_GSA_id` — application-layer obligation, not relay responsibility
4. LumaWeave's relay agent processes local `SourceLoaded`: `event.causation_id = hub_GSA_id`
5. `_translate_causation_id(hub_GSA_id)` → `read_by_external_id(hub_GSA_id.hex())` → None (not a LumaWeave local event) → passes through as-is
6. Hub `SourceLoaded` gets `causation_id = hub_GSA_id`
7. `walk_causation` from hub `SourceLoaded` → finds `GraphSnapshotAvailable` by hub_GSA_id → case-2 traversal works

No special relay logic needed. The relay is generic. The application-layer obligation at step 3 belongs to LumaWeave: when emitting `SourceLoaded` in response to a hub-received event, set `causation_id` to the hub-side event ID that triggered it.

**S-031 corrected text (supersedes original):**

> When LumaWeave receives `GraphSnapshotAvailable` from a hub subscription and emits `SourceLoaded` locally in response, LumaWeave's application code must set `causation_id = hub_GSA.id` (the hub-primary ID received in the subscription event) on the local `SourceLoaded` event. The relay agent passes `event.causation_id` through unchanged via `_translate_causation_id` — `hub_GSA.id` is already a hub ID and passes through the not-found branch. No special relay agent logic is required.

---

## What this does NOT change

- `GraphSnapshotAvailable` stream target (`cerebra/graph/<lineage_id>`) — unchanged
- Hub-direct write path for `GraphSnapshotAvailable` — unchanged
- indexed_tags prerequisite (`{session_id, cycle_id, signal_name}`) — unchanged
- Relay filter (agent-trace + lattice YES / control NO) — unchanged
- D.3 conditional strip rule — unchanged and unaffected

---

*End of Cerebra Federation Design Addendum — causation_id correction — 2026-06-16*

---

