# Baseline — ai-stack (2026-06-16)

> **Historical snapshot — 2026-06-16.** References to rhyzome, bons.ai, and discord-bot reflect their status at that date; those modules are now deprecated and removed from the platform.

---

## federation_design

# ai-stack — Federation Design Response

**Date:** 2026-06-16
**Filed by:** ai-stack-claude
**In response to:** PLATFORM_BASELINE_2026-06-16_v2.md + LATTICA_RECONCILIATION_BRIEF.md + federation interview prompt
**Scope:** ai-stack GPU infrastructure (Ollama, LiteLLM, Open-WebUI, TTS). Bo is out of scope — discord connectivity migrates to Cerebra.

---

## Section A — Input confirmation

### A.1 — Documents read

Both input documents read:
- `PLATFORM_BASELINE_2026-06-16_v2.md` — §2.4 (ai-stack state), §4.X settled items (S-001 through S-034), §8 federation interview agenda reviewed in full.
- `LATTICA_RECONCILIATION_BRIEF.md` — §1 new architectural decisions, §2 tile implications, §3 open items reviewed.

### A.2 — §2.4 corrections

Two items in v2 §2.4 require correction given the scope change and developer clarification:

**S-010 partially stale:**
v2 §2.4 says "Under federation: one shared local store (co-resident with Bo), single relay agent with two filter rule sets (one per stream prefix)." This no longer applies. Bo's discord connectivity migrates into Cerebra; the discord-bot project is archived. ai-stack's relay agent is standalone, handling only `ai-stack/*` streams. There is no shared-with-Bo local store and no two-filter relay agent. ai-stack's fossic substrate is autonomous.

The settled item S-032 ("Bo relay filter spec for bot/* streams — open for federation interview §8.8") is therefore moot for ai-stack. It remains Cerebra's concern if Cerebra inherits Bo's fossic streams.

**§4.5 / S-018 framing corrected per developer:**
The v2 "dual-cause" framing for the 92% VRAM reading was a reconciliation artifact that missed the master/slave relationship. The correct framing:

- Cerebra is master of model loading decisions. ai-stack's Ollama serves Cerebra exclusively.
- Cerebra hosts both the training model and the witness model (Phase 15+), both via the same Ollama instance.
- LiteLLM is downstream of Cerebra's model selections — its health probe loading `qwen3.5:latest` is a symptom of Cerebra's routing configuration propagated through LiteLLM, not an independent load decision.
- The 92% VRAM floor reflects Cerebra's active model portfolio, not two competing independent consumers.

ai-stack's sidecar is purely an observer of this. `VramBudgetChanged` reports what is loaded; it does not and should not reason about why. GPU allocation design (baseline VRAM floor under both training + witness model active) is Cerebra's work; ai-stack reports the outcome.

---

## Section B — ai-stack federation design

### B.1 — Sidecar role under federation

**Confirmed with one refinement.**

Under federation:
- `fossic_sidecar.py` moves from writing to the shared hub (`~/.lattica/fossic/store.db`) to writing to ai-stack's **local fossic store** at `~/.../ai-stack/.fossic/store.db` (see §B.2 for exact path).
- A separate `ai-stack-relay.py` (standalone Python process) subscribes to `ai-stack/**` on the local store and relays filtered transitions to the hub.
- The sidecar and relay agent are **separate processes**, not co-located. Rationale: sidecar restarts (on Ollama/nvidia-smi error recovery) should not interrupt the relay backlog; relay restarts (on hub connection issues) should not interrupt sidecar emit. Each can recover independently. They share a venv.

The `FOSSIC_STORE_PATH` constant in `fossic_sidecar.py` is the only change needed for the local store migration: from `Path.home() / ".lattica" / "fossic" / "store.db"` to `Path.home() / "Projects" / "ai-stack" / ".fossic" / "store.db"`. This is consistent with Cerebra's vault-scoped `.fossic/store.db` pattern.

The hub sees the same stream names under D.3 (see §C.6): `ai-stack/gpu` and `ai-stack/models` pass through unchanged.

---

### B.2 — Local store shape

#### Streams

**`ai-stack/gpu`** — VramBudgetChanged
- Emitted when GPU used VRAM shifts ≥10 MB from previous reading (delta filter in sidecar — already in place).
- Payload: `{used_bytes, total_bytes, model_vram_bytes, pct, models, sampled_at}`
- **Snapshot cadence:** every 1 event. VRAM transitions are already delta-filtered (≥10 MB) so each event represents a meaningful state change. Snapshotting every event ensures the Lattica tile always has a fresh seed on cold-start subscribe. Volume is low (infrequent under normal Cerebra operation).
- No reducer registration needed at this time. The tile reads the latest event for current VRAM state.

**`ai-stack/models`** — ModelLoaded, ModelUnloaded
- Emitted on each polling diff (model appears or disappears from `/api/ps`).
- Payload: `{model_name, size_vram, loaded_at}` / `{model_name, unloaded_at}`
- **Snapshot cadence:** every 5 events. Model transitions are discrete and relatively infrequent; a snapshot every 5 events keeps the stream recoverable without per-event overhead.
- No reducer registration needed. The tile reconstructs current model set from the last N events on subscribe.

**`ai-stack/lifecycle`** — SidecarStarted, SidecarStopped (new, low cost)
- Emitted in `main()` at sidecar start and on clean shutdown (SIGTERM/SIGINT).
- Payload: `{started_at: int}` / `{stopped_at: int}`
- Provides hub-visible observability of the sidecar itself. Hub consumers (Lattica tile, Cerebra witness model) can detect a sidecar gap without needing external monitoring.
- **Snapshot cadence:** not needed (lifecycle events aren't used for cold-start tile seeding).
- Relay filter: `SidecarStarted` and `SidecarStopped` relay to hub alongside model and gpu events.

#### Streams deferred (Phase 2b or later)

**`ai-stack/health`** — ServiceUp, ServiceDown per container
Moving per-service health polling from the tile to the sidecar makes the health state hub-visible. Not shipped now — the tile currently polls Ollama, LiteLLM, and Open-WebUI directly and this works correctly as Phase 1. Adding health polling to the sidecar is a Phase 2b item that would require extending the sidecar's HTTP fetch loop. Flagged for future pass.

---

### B.3 — Relay filter design

**All ai-stack streams relay to hub.** They are all observability transitions (delta-filtered, discrete lifecycle events) with no high-frequency measurement noise.

#### Relay filter table

| Stream | Event types relayed | indexed_tags | causation_id | Notes |
|--------|--------------------|--------------|-|-------|
| `ai-stack/gpu` | VramBudgetChanged | `{warn: bool, source_store: "ai-stack"}` | None | `warn = (pct >= VRAM_WARN_PCT_THRESHOLD)` at emit time (default 80%); see §B.5 for implementation |
| `ai-stack/models` | ModelLoaded, ModelUnloaded | `{model_name: str, source_store: "ai-stack"}` | None | `model_name` enables hub SQL-filter by specific model without fold-time Python |
| `ai-stack/lifecycle` | SidecarStarted, SidecarStopped | `{source_store: "ai-stack"}` | None | Minimal tags; lifecycle events are simple |

`causation_id` is `None` for all current events — sidecar polls external services (Ollama, nvidia-smi); no upstream fossic event causes them. This is correct and matches S-030.

The relay agent passes `branch=event.branch` through as required (S-012). For current sidecar events, all events are on the default branch; this is a protocol correctness requirement, not a functional one today.

`external_id = event.id.hex()` for idempotency gate on relay restart (S-014).

Post-upcast payload via `event.deserialize_payload_json()` at local store boundary (S-015).

#### RelayConfig for ai-stack-relay.py

```python
@dataclass
class RelayConfig:
    local_store_path: str     # ~/.../ai-stack/.fossic/store.db
    hub_store_path: str       # ~/.lattica/fossic/store.db
    source_prefix: str        # "ai-stack"
    subscribe_pattern: str    # "ai-stack/**"
    relay_filter: set[str]    # {"VramBudgetChanged", "ModelLoaded", "ModelUnloaded", "SidecarStarted", "SidecarStopped"}
    batch_size: int = 50
    reconnect_delay_ms: int = 5000
```

Under D.3: `source_prefix = "ai-stack"`, `event.stream_id = "ai-stack/gpu"` → `stream_id.startswith("ai-stack/")` is True → hub stream stays `"ai-stack/gpu"`. No double-prefix. Same for `ai-stack/models` and `ai-stack/lifecycle`.

---

### B.4 — Cerebra master clarification

**Confirmed.**

Implications for ai-stack's sidecar design:

1. **Sidecar is purely informational.** `VramBudgetChanged` reports the GPU state; it has no opinion on what Cerebra should load or unload. `ModelLoaded`/`ModelUnloaded` names which model crossed the threshold; the load decision was Cerebra's.

2. **Both training model and witness model active simultaneously.** When Phase 15+ lands and Cerebra runs both concurrently, the VRAM floor rises further. The sidecar will see and report this correctly — no sidecar changes needed. `VramBudgetChanged.models` will list both; `model_vram_bytes` will sum both.

3. **GPU allocation tuning is upcoming developer work with Cerebra.** ai-stack's contribution is accurate VRAM reporting. The `VRAM_WARN_PCT_THRESHOLD` constant in the sidecar (see §B.5) sets when the `warn` indexed_tag fires — this threshold should align with Cerebra's expectations about what constitutes a headroom-constrained state. Open for developer decision; 80% default is used until Cerebra provides a number.

4. **LiteLLM health probe behavior.** LiteLLM's probing of `qwen3.5:latest` is a downstream side effect of Cerebra's model routing config. ai-stack has no action here. If Cerebra changes its routing alias targets, LiteLLM's probe behavior changes automatically. ai-stack observes and reports; it does not control.

---

### B.5 — indexed_tags pre-relay prerequisite

This is a **small standalone pass** — 5 targeted edits to `fossic_sidecar.py`. Does not fold into relay agent pass. Rationale: the relay agent cannot be built until the local store has indexed_tags on emitted events; running this first keeps the prerequisite clean.

#### Changes to `fossic_sidecar.py`

**Add constant** (near other config constants):
```python
VRAM_WARN_PCT_THRESHOLD = 80  # pct threshold for warn indexed_tag; align with Cerebra expectations
```

**Update `_emit()` signature** to accept indexed_tags:
```python
def _emit(stream_id: str, event_type: str, payload: dict, indexed_tags: dict | None = None) -> None:
```

**Update `_store.append()` call** inside `_emit()`:
```python
_store.append(Append(
    stream_id=stream_id,
    event_type=event_type,
    payload=payload,
    causation_id=None,
    indexed_tags=indexed_tags or {},
))
```

**Update VramBudgetChanged emit** in `_poll()`:
```python
_emit(STREAM_GPU, "VramBudgetChanged", {
    "used_bytes": used_bytes,
    ...
    "sampled_at": now_ms,
}, indexed_tags={"warn": (pct >= VRAM_WARN_PCT_THRESHOLD)})
```
(where `pct` is already computed as `round(used_bytes / total_bytes * 100, 1) if total_bytes else 0`)

**Update ModelLoaded emit** in `_poll()`:
```python
_emit(STREAM_MODELS, "ModelLoaded", {
    "model_name": name,
    "size_vram": size_vram,
    "loaded_at": now_ms,
}, indexed_tags={"model_name": name})
```

**Update ModelUnloaded emit** in `_poll()`:
```python
_emit(STREAM_MODELS, "ModelUnloaded", {
    "model_name": name,
    "unloaded_at": now_ms,
}, indexed_tags={"model_name": name})
```

`indexed_tags` support on `Append` needs to be confirmed available in fossic-py 0.1.0 before this pass executes. If the `Append` constructor does not accept `indexed_tags` yet, this is a fossic-py API gap to raise with Fossic. The field is described as available in the platform baseline relay spec (§2.6); treating it as available.

This standalone pass is the gate before: local store path migration + relay agent build.

---

### B.6 — Hub-side snapshot coordination

**`ai-stack/gpu` — snapshot needed. `ai-stack/models` — snapshot needed.**

**`ai-stack/gpu`:** When `AiStackTopologyTile` switches from direct Ollama polling (Phase 1) to hub subscription (Phase 2), the tile will have no VRAM state until the next `VramBudgetChanged` fires — up to 10 seconds. A snapshot on `ai-stack/gpu` seeded at the last event gives the tile immediate state on subscribe. Per §B.2: snapshot cadence every 1 event for this stream (VramBudgetChanged is delta-filtered to ≥10 MB, so each event is meaningful; per-event snapshot ensures freshness at negligible cost given the low event rate).

**`ai-stack/models`:** Same cold-start concern. The tile needs to know the currently loaded model set on subscribe, not wait for the next load/unload transition. A snapshot seeded at the most recent ModelLoaded/ModelUnloaded event gives the tile the current model set immediately.

**Snapshot emission design:**
Snapshot emission is a sidecar-side adoption of the fossic snapshot API. The exact call (`_store.snapshot(stream_id)` or a cadence-based `EventEmitter` config) needs to be verified from fossic-py docs before implementation. This is noted as a prerequisite for Phase 2 tile wiring, not a pre-relay prerequisite. The relay agent can ship before snapshot emission is wired; Phase 2 tile wiring requires it.

**On-hub adoption note for Lattica:**
Once the relay agent is live and both streams are populated on the hub, Lattica's tile subscribe should seed from the hub-side snapshot on first subscribe. This is a Lattica-side adoption of the fossic snapshot API (hub store read). Flagging for Lattica to address during Phase 2 tile wiring.

---

## Section C — Cross-cutting items

### C.1 — Broken-pending UI discipline

Full audit of `AiStackTopologyTile.tsx` tile elements:

| Tile element | Current data source | Blocks live data | Broken-pending? | Notes |
|---|---|---|---|---|
| STACK status dot | Direct Ollama + LiteLLM polling | Nothing | No — live (Phase 1) | Aggregate of ollama + litellm status |
| VRAM gauge | Ollama `/api/ps` + localStorage totalMb | Nothing | No — live | Shows model_vram_bytes vs. configurable total |
| Running model list | Ollama `/api/ps` | Nothing | No — live | |
| LITELLM node status | LiteLLM `/v1/models` | Nothing | No — live (when LiteLLM is up) | |
| ALIAS MUTE chips | LiteLLM `/v1/models` | Nothing | No — live | |
| TOPOLOGY_ALIASES edges | LiteLLM `/v1/models` filtered by hardcoded set | Nothing for current aliases | No — live | But alias names need Cerebra confirmation; see C.2 |
| OPEN-WEBUI node status | HEAD `localhost:3000` | Nothing | No — live | |
| TTS node | — | Always unknown (no host port) | No — permanently unknown by design | Not broken-pending; working as designed |
| BO node | Was pending Phase 2 heartbeat | Architecturally stale | **Yes — needs tile update** | Bo absorbed into Cerebra; BO node must be removed or repurposed; see below |
| Phase 2 hub subscription | Hub subscription replaces polling | indexed_tags + relay agent | Yes — broken-pending until relay agent is live | Not yet wired; Phase 1 polling stays active until Phase 2 lands |

**BO node:** The tile has a hardcoded BO `NodeCard` in topo view (line 409) and a `bo` row in list view (line 311). Both show `status: "unknown"` with note `"heartbeat pending"`. With Bo folded into Cerebra, this node is architecturally stale. Options: (a) remove the BO node entirely from the tile, (b) repurpose it as a CEREBRA node representing Cerebra's daemon status. This is a developer decision; flagged here and in C.2 needs-wiring.md.

### C.2 — No hard-coded values discipline

See `needs-wiring.md` filed alongside this document. Items catalogued there:
1. `TOPOLOGY_ALIASES` hardcoded Set — architecturally stale post-Bo-to-Cerebra migration
2. `DEFAULT_VRAM_TOTAL_MB = 12_282` — hardware-specific default
3. BO node stale references in tile
4. `FOSSIC_STORE_PATH` pointing to shared hub (pre-federation path)
5. `VRAM_WARN_PCT_THRESHOLD` (to be added) — alignment with Cerebra expected

### C.3 — Cross-Claude question protocol

One outbound binding question filed:
`outbound/2026-06-16_ai-stack_to_cerebra_binding-question-topology-aliases.md`

Question: once Cerebra absorbs Bo's discord connectivity, will the LiteLLM routing aliases currently named `"bot-local"` and `"bot-escalated"` be renamed? The `TOPOLOGY_ALIASES` constant in `AiStackTopologyTile.tsx` determines which aliases render as topology graph edges. If Cerebra renames these aliases, the tile constant must be updated. Asking before assuming.

### C.4 — File ownership boundaries

**ai-stack's tree** (`/home/boop/Projects/ai-stack/`):
- `fossic_sidecar.py` — sidecar process (ai-stack-authored, ai-stack-maintained)
- `docker-compose.yml` — service topology declaration
- `docker-compose.working.yml` — working reference config
- `litellm/litellm-config.yaml` — LiteLLM routing config
- `ai-stack-relay.py` — relay agent (to be created; ai-stack-authored, standalone Python)
- `.fossic/store.db` — ai-stack local fossic store (runtime artifact, under federation)

**Lattica's tree (ai-stack-authored):**
- `src/tiles/ai-stack/AiStackTopologyTile.tsx` — topology tile (authored by ai-stack-claude in P-013; committed into Lattica by Lattica-claude)
- `src/tiles/ai-stack/AiStackTopologyTile.css` — tile styles (same provenance)
- Future: `src/renderers/ai-stack/VramBudgetChangedRenderer.tsx` (Phase 2 — not yet authored)
- Future: `src/renderers/ai-stack/ModelLoadedRenderer.tsx` (Phase 2)
- Future: `src/renderers/ai-stack/ModelUnloadedRenderer.tsx` (Phase 2)

**Export hurdle prep:** The three renderer files above are Phase 2 deliverables that follow the P-013 guest-author pathway: ai-stack-claude authors them, Lattica-claude commits them into Lattica's tree. No cross-tree ownership ambiguity; the pathway is established.

### C.5 — Net-writer / net-reader role confirmation

**ai-stack is pure net-writer. No fossic read path exists or is needed.**

The sidecar polls external services (Ollama HTTP, nvidia-smi subprocess). Neither of these goes through fossic. The relay agent writes to the hub but does not subscribe to any hub stream. There is no use case today where ai-stack's sidecar needs to read fossic state — Cerebra makes model decisions and tells Ollama; ai-stack observes Ollama outcomes and reports them. The hub is write-destination only from ai-stack's perspective.

This may change if a future management sidecar (RESTART, FORCE FAILOVER, SLEEP TIMER — out of current scope) needs to subscribe to Cerebra-issued commands from the hub. That would add a net-reader role. Not in scope today; noted for completeness.

### C.6 — D.3 stream naming convention ratification

**D.3 confirmed. ai-stack endorsement stands.**

Under D.3: `stream_id.startswith(f"{source_prefix}/")` check for `source_prefix = "ai-stack"`:
- `"ai-stack/gpu"`.startswith(`"ai-stack/"`) → True → hub stream: `"ai-stack/gpu"` ✓
- `"ai-stack/models"`.startswith(`"ai-stack/"`) → True → hub stream: `"ai-stack/models"` ✓
- `"ai-stack/lifecycle"`.startswith(`"ai-stack/"`) → True → hub stream: `"ai-stack/lifecycle"` ✓

No double-prefix. All streams pass through unchanged. ai-stack explicitly ratifies D.3 for the federation interview compile.

---

## Section D — Implementation order

The correct sequencing for ai-stack's federation work, given inter-dependencies:

1. **Sidecar indexed_tags pass** (standalone, small): add `VRAM_WARN_PCT_THRESHOLD`, update `_emit()` to accept `indexed_tags`, add per-event tag dicts. Gate: fossic-py `Append` confirms `indexed_tags` parameter available.

2. **Local store path migration**: change `FOSSIC_STORE_PATH` from shared hub to `~/.../ai-stack/.fossic/store.db`. Declare and initialize the new stream paths. Confirm store.db does not need to be pre-seeded (fresh local store is correct; relay agent handles cold-start idempotency via `external_id`).

3. **`ai-stack/lifecycle` stream additions**: add `SidecarStarted` emit in `main()` and `SidecarStopped` emit in signal handler. Low cost; included in the local store migration pass.

4. **Relay agent (`ai-stack-relay.py`)**: standalone Python process with `RelayConfig` as specified in §B.3. Depends on steps 1–2 being complete (so the local store has tagged events before relay starts).

5. **Snapshot emission wiring**: add snapshot calls after each `VramBudgetChanged` and on model lifecycle events. Depends on verifying fossic-py snapshot API. Can ship slightly after relay agent — snapshot is for Phase 2 tile cold-start, not relay correctness.

6. **Phase 2 tile wiring** (Lattica-side, ai-stack-authored): replace tile's direct Ollama/nvidia-smi polling loop with hub fossic subscriptions. Depends on relay agent being live (steps 1–4). This is the Lattica pass; ai-stack authors the tile changes, Lattica commits them.

---

## Open questions carried forward

1. **TOPOLOGY_ALIASES alias names post-Bo-absorption** — sent to Cerebra (outbound binding question). Blocks tile update decision.
2. **VRAM_WARN_PCT_THRESHOLD alignment** — developer decision with Cerebra. Current default 80%; may change once both-models-active VRAM floor is established.
3. **BO node in tile** — developer decision: remove vs. repurpose as Cerebra node. Flagged in needs-wiring.md.
4. **fossic-py snapshot API surface** — needs verification against fossic-py 0.1.0 docs before step 5 above executes.
5. **D.3 final ratification** — pending Fossic + Lattica positions at federation interview compile.

---

*End of ai-stack federation design — 2026-06-16*

---

## needs-wiring

# ai-stack — Needs Wiring / Hard-coded Values Log

**Date:** 2026-06-16
**Filed by:** ai-stack-claude
**Purpose:** Catalogue hard-coded values and binding ambiguities in ai-stack and ai-stack-authored Lattica files.

---

## 1. TOPOLOGY_ALIASES hardcoded Set

**Element / binding location:**
`TOPOLOGY_ALIASES = new Set(["bot-local", "bot-escalated"])`
`src/tiles/ai-stack/AiStackTopologyTile.tsx:42`

**Assumed correct token/variable:**
Aliases named `bot-local` and `bot-escalated` in LiteLLM routing config. Used to filter which LiteLLM aliases render as graph edges in the topology view.

**Who needs to confirm:**
~~Cerebra-claude~~ — **ANSWERED 2026-06-16.** Aliases stay in LiteLLM config unchanged. Routing destination shifts from `bot.py` to Cerebra's `ProxyLLMAdapter`. `bot-local` may go dormant if Cerebra routes via `OllamaDirectAdapter` directly; `bot-escalated` stays relevant if escalation path uses LiteLLM. Cerebra will confirm routing path before fold-in implementation. No ai-stack config change needed.

**Confidence level:**
HIGH — alias names confirmed stable by Cerebra. Tile comment updated; constant unchanged.

**Brief context:**
The tile fetches all LiteLLM aliases dynamically via `/v1/models`, then filters to those in `TOPOLOGY_ALIASES` for edge rendering. If `bot-local` becomes dormant (removed from LiteLLM config), it simply won't appear in `snap.aliases` and no edge will render — the tile handles this gracefully without code changes. The `isDormant` styling on `bot-escalated` (tile line ~415) remains appropriate. Tile comment updated to reflect Cerebra as routing master.

---

## 2. DEFAULT_VRAM_TOTAL_MB hardcoded

**Element / binding location:**
`const DEFAULT_VRAM_TOTAL_MB = 12_282`
`src/tiles/ai-stack/AiStackTopologyTile.tsx:38`

**Assumed correct token/variable:**
VRAM total for NVIDIA GeForce RTX 4070 Super = 12,282 MB (from nvidia-smi). Comment in code documents the hardware.

**Who needs to confirm:**
Developer — confirms this machine's GPU. Can be overridden at runtime via `localStorage["aistack.vramTotalMb"]`.

**Confidence level:**
HIGH — verified against `nvidia-smi` output in sidecar log (12282 MB confirmed at 2026-06-16 10:32:49). Override mechanism exists. Low risk.

**Brief context:**
Ollama does not expose total VRAM via API; nvidia-smi is the authoritative source. The sidecar has access to nvidia-smi and already captures `total_bytes` in `VramBudgetChanged` events. Under Phase 2 tile wiring (hub subscription), the tile could read `total_bytes` from the hub event payload instead of using this constant — eliminating the hardcoded value entirely. Flagged as a Phase 2 cleanup opportunity.

---

## 3. BO node stale references in tile

**Element / binding location:**
- `NodeCard name="BO"` in topo view: `AiStackTopologyTile.tsx:409`
- `{ key: "bo", name: "BO", status: "unknown", detail: "heartbeat: phase 2 pending" }` in list view: `AiStackTopologyTile.tsx:311`
- `"heartbeat: phase 2 pending"` string: same file

**Assumed correct token/variable:**
N/A — these references are architecturally stale. Bo as a standalone service no longer exists (discord connectivity migrates to Cerebra).

**Who needs to confirm:**
~~Developer~~ — **RESOLVED 2026-06-16.** Decision: keep BO node, point at Cerebra discord module via `GET /status` at port 7432.

**Confidence level:**
RESOLVED — tile updated.

**Brief context:**
BO node polls `http://localhost:7432/status`. Status derives from whether the Cerebra daemon responds (`up`/`down`). CORS fix applied at `daemon.py:188` (`_send_json`) — all four endpoints (status, posture, cycles, checkpoint) return `Access-Control-Allow-Origin: *`. Verified live: BO node flips green with daemon running. `TOPOLOGY_ALIASES` edges from BO toward LiteLLM remain valid (see item 1 — alias names confirmed stable).

---

## 4. FOSSIC_STORE_PATH pointing to shared hub (pre-federation)

**Element / binding location:**
`FOSSIC_STORE_PATH = Path.home() / ".lattica" / "fossic" / "store.db"`
`/home/boop/Projects/ai-stack/fossic_sidecar.py:33`

**Assumed correct token/variable:**
Under federation: `Path.home() / "Projects" / "ai-stack" / ".fossic" / "store.db"` (ai-stack local store, vault-scoped, consistent with Cerebra's `.fossic/store.db` pattern).

**Who needs to confirm:**
Developer / Fossic-claude — confirm that the local store path convention for ai-stack should be `~/<project>/.fossic/store.db` or an alternative like `~/.lattica/ai-stack/fossic.db`. The path change is a one-line edit once confirmed.

**Confidence level:**
MEDIUM — the local store path pattern needs to be confirmed against the platform convention. Current path is the shared hub, which is correct for pre-federation but wrong under federation.

**Brief context:**
Currently the sidecar writes directly to the shared hub (`~/.lattica/fossic/store.db`). Under federation the sidecar writes to a local store; a relay agent bridges to hub. The path change is the only mechanical change in `fossic_sidecar.py` for the local store migration (besides the indexed_tags additions in §B.5 of federation_design.md).

---

## 5. VRAM_WARN_PCT_THRESHOLD (to be added)

**Element / binding location:**
Proposed constant in `fossic_sidecar.py` (does not exist yet; to be added in indexed_tags pass).
Will be used as: `indexed_tags={"warn": (pct >= VRAM_WARN_PCT_THRESHOLD)}`

**Assumed correct token/variable:**
Default `80` (percent), matching tile's `DEFAULT_VRAM_WARN_PCT = 80` pattern. But under Cerebra master model — both training and witness model active simultaneously — the "safe headroom" floor changes. Cerebra should define what percentage constitutes a warning state.

**Who needs to confirm:**
Developer, with Cerebra. The tile's warn threshold is a user-configurable UI preference; the hub-side `warn` indexed_tag is for platform-level query filtering (e.g., Cerebra witness model asking "is GPU under pressure?"). They may not need to match.

**Confidence level:**
LOW — correct default unknown until Cerebra's both-models-active VRAM floor is established.

**Brief context:**
The `warn` indexed_tag on `VramBudgetChanged` enables hub consumers to SQL-filter for warn-state transitions without decoding every payload (S-016). The threshold needs to be meaningful at the platform level, not just the tile UI level.

---

*End of needs-wiring.md — 2026-06-16*

---

