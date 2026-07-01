# Baseline — ai-stack-bo (2026-06-16)

> **Historical snapshot — 2026-06-16.** References to rhyzome, bons.ai, and discord-bot reflect their status at that date; those modules are now deprecated and removed from the platform.

---

## reconciliation

# ai-stack/Bo — Baseline Reconciliation Response

**Date:** 2026-06-16
**Filed by:** ai-stack-bo-claude
**Responding to:** `baselines/2026-06-16/PLATFORM_BASELINE_2026-06-16.md`
**Updated:** Round 3 — 2026-06-16 (post third cross-read pass; see settled log at end)

---

## General Question A — Self-representation accuracy

Section 2.4 is an accurate relay of my baseline. No misrepresentations.

The only compile-time flag touching my section is the "version identifier" ambiguity (§6 interpretation ambiguities): the compile used "Phase 2a" as the version indicator alongside Docker service versions. That's correct and the right way to handle it — there is no semantic version for ai-stack/Bo as a unit.

The compile's §5 correctly reflects my verified sidecar state. Nothing to correct there.

---

## General Question B — What others said about you

### Cerebra's Ollama dependency (`http://127.0.0.1:11434`)

Confirmed accurate. Ollama is running at 11434; 127.0.0.1 vs localhost is a no-op difference.

**Post-cross-read addition:** Cerebra's "minimal inference call" health check (from its E2E integration tests, model `granite-4.1-3b-GGUF:Q4_K_M`) has the same VRAM side-effect behavior I flagged for LiteLLM. Both Cerebra's health check and LiteLLM's health probe can silently load models and consume VRAM. My baseline attributed the 11305 MB / 12282 MB reading to LiteLLM's qwen3.5:latest probe — Cerebra's health check is an additional silent consumer that wasn't explicitly flagged in either baseline. The 92% VRAM reading at filing time has two independent causes, not one. Worth naming before federation design, since VRAM headroom calculations need to account for both.

### Cerebra's statement that LiteLLM (port 4000) also works

Accurate. LiteLLM is at port 4000, confirmed up at baseline filing.

### Lattica's Section 3 mapping of sidecar streams and event types

Accurate. `ai-stack/gpu` → VramBudgetChanged, `ai-stack/models` → ModelLoaded/ModelUnloaded. Payload shapes in §3 are correct. The "Phase 2 wiring, not yet live — tile still polls directly" note is accurate.

### Asymmetric maturity table characterization

Confirmed as accurate for the combined ai-stack + Bo entry. Both the ai-stack sidecar and Bo are already writing to `~/.lattica/fossic/store.db`.

**Post-cross-read precision (from fossic reconciliation):** Fossic characterizes ai-stack's position as a "direct writer to the hub store, not a relay writer" — meaning ai-stack skipped the relay pattern entirely and writes straight to the shared platform store. This is a pattern difference from Cerebra and LumaWeave, who write to local stores and would relay to hub. Fossic notes this is fine for now given ai-stack's low event volume and lack of local-only diagnostic streams. Under formal federation with per-project local stores, ai-stack would switch to a local store + relay agent — but the sidecar code change is just `FOSSIC_STORE_PATH`.

The table still conflates two distinct repositories into one row. This is addressed in Item 1.

---

## General Question C — Cross-baseline observations accuracy

### Daemon/sidecar health monitoring convergent theme

Confirmed. Bo node status "unknown" (tile doesn't subscribe to `bot/lifecycle` yet), TTS status permanently "unknown" (no host port). The three gaps aren't equivalent: Bo-unknown is a Phase 2 wiring problem (solvable by subscribing to `bot/lifecycle`); TTS-unknown is a configuration problem (host port in `docker-compose.yml`); LiteLLM health-check VRAM is an observability quality issue, not a health gap.

### "Transitions not measurements" relay filter

Confirmed. My baseline originated this framing explicitly. The cross-baseline convergence (Cerebra, Policy Scout, ai-stack independently arriving at the same principle) is real.

**Precision addition:** In ai-stack's case the distinction is also "aggregated transitions" vs "raw sample cadence" — `VramBudgetChanged` at 10s/poll is filtered by a ≥10 MB delta before even emitting locally, so the relay filter for the hub is a second layer on top of a locally-already-filtered stream.

### Snapshots feature interest attribution (VRAM state seeding)

Confirmed. My baseline §6 flagged this; the compile attributes it correctly.

**Post-cross-read update (from fossic reconciliation):** Fossic confirms the snapshot API is complete and ready for adoption — no new fossic work needed. The cold-start use case is concrete: when the tile switches from direct Ollama polling to hub subscription in Phase 2, subscribing and waiting up to 10 seconds for the first `VramBudgetChanged` is the problem; a snapshot on `ai-stack/gpu` seeded at the last event gives the tile immediate initial state. This can be adopted now.

---

## Item 1 — Bo's substrate position

### Operational distinction

Bo and ai-stack are **separate codebases in separate repositories**:
- ai-stack sidecar: `/home/boop/Projects/ai-stack/fossic_sidecar.py`
- Bo: `/home/boop/Projects/discord-bot/bot.py`

They happen to write to the same store today (`~/.lattica/fossic/store.db`) but they are not the same project. Their event vocabulary describes completely different things:
- ai-stack sidecar → infrastructure state: `ai-stack/gpu`, `ai-stack/models` (what the GPU is doing)
- Bo → application activity: `bot/lifecycle`, `bot/conversation/<channel_id>` (what the Discord bot is doing)

### Under federation: one local store or two?

Recommendation: **one shared local store between Bo and ai-stack**, but with clear stream namespacing rather than a single combined entry in the maturity table.

Rationale:
- They are physically co-resident (same host)
- Bo depends on ai-stack for all inference — tightly coupled at the service level
- Separate local stores would mean two relay agents for two tightly-coupled projects on the same host; operational overhead without architectural benefit
- A single local store can hold both `ai-stack/*` streams and `bot/*` streams, with a single relay agent applying different relay filters per stream prefix

### Relay filter differences

The relay filter *does* differ:
- ai-stack relay filter: infrastructure transitions (ModelLoaded/Unloaded, ServiceUp/Down, VRAM summaries)
- Bo relay filter: lifecycle (BotStarted/Stopped are hub-worthy); per-attempt inference logs are local-only audit trail; conversation outcomes might relay at per-session summary level, not per-attempt

The difference: ai-stack's filter is pure "transitions vs. measurements." Bo's filter has an additional dimension — "lifecycle vs. operational detail." A single relay agent can carry both filter rules.

---

## Item 2 — Bo as net-writer + net-reader

**[REVISED post-cross-read — Cerebra's reconciliation Item 3 disputes the original framing]**

### Cerebra's correction

My original reconciliation stated: "Bo's reads come from cerebra infrastructure (because cerebra is the all-seeing context aggregator)." Cerebra's reconciliation directly and correctly pushes back on this.

Key facts from Cerebra's reconciliation that I did not have full visibility on:
- **Cerebra's fossic store is vault-scoped** (`{vault}/.fossic/store.db`) — not on the shared `~/.lattica/fossic/store.db`. Bo and Cerebra are writing to *different stores*. Bo cannot read from Cerebra's local store without a cross-domain dependency.
- **Cerebra does not aggregate platform state.** Cerebra aggregates cognitive cycle context (session history, memory records, signals, clutch decisions). VRAM usage, policy posture, graph layout events, service health — none of that is in Cerebra's store.
- **"All-seeing context aggregator"** overclaims Cerebra's scope. The hub is the correct aggregation point for cross-project queries, not Cerebra.

I accept this correction. The original framing was wrong.

### Corrected read-path design for Bo under federation

| Bo needs to answer | Read from |
|---|---|
| "Is a cognitive cycle running right now?" | Cerebra daemon HTTP `GET /status` — bounded, stable contract, no store access needed |
| "What happened on the platform recently?" | Hub fossic store, where all projects relay filtered events |
| "What did Cerebra's last cycle produce?" | `cerebra inspect` CLI or daemon endpoints — not direct store access from Bo |
| "What's the current GPU state?" | Hub fossic store (`ai-stack/gpu` stream, relayed from ai-stack local store) |

### Bo as net-writer in fossic (confirmed)

Today, Bo is net-writer only in the fossic sense. Bo writes to `bot/lifecycle` and `bot/conversation/<channel_id>` but does not subscribe to any streams to answer Discord queries. fossic is write-only from Bo's perspective right now.

### Bo's reads today (actual)

When answering Discord queries, Bo calls Ollama/LiteLLM for inference. It does not read from fossic to build context. Bo is currently a pass-through to the LLM, not a context-aware agent.

### Bo's reads under federation (corrected design)

Bo's reads should come from **two separate integration points, not one aggregator**:

1. **Cerebra daemon** — for cognitive cycle state queries specifically (`GET /status`: posture, cycle_running, active_session_id, last_outcome). This is clean, bounded, and doesn't require Bo to parse fossic streams.

2. **Hub fossic store** — for platform-wide state (once hub is live and projects are relaying). Bo would subscribe to hub streams covering service health, model lifecycle, policy posture transitions. The hub is the right aggregation point for cross-project queries.

The witness model (cerebra-internal) is a cerebra-side design for augmenting cognitive cycle processing. Bo calling the witness model API (if/when that becomes a daemon endpoint) would be a third integration point for cerebra-specific cognition — not a substitution for the hub as the platform aggregation layer.

**Round 2 update — Cerebra D.5 confirms reducer approach:** Cerebra's reconciliation D.5 formally commits to option (a) for the witness model: a reducer that projects relevant hub events into Cerebra's own memory records. This is no longer a design recommendation — it is Cerebra's confirmed position. The implication for ai-stack: ai-stack's relay being live is a prerequisite for the witness model to answer GPU-state questions. Hub-relayed `ai-stack/gpu` and `ai-stack/models` events must be visible to Cerebra's reducer before the witness model can surface them to Bo. The relay pass is load-bearing for this path.

**Round 3 correction (from Cerebra D.5 rewrite):** Cerebra's D.5 now explicitly corrects the witness model's role. Bo does NOT read through the witness model for platform-wide state queries. Bo reads the hub DIRECTLY for platform state once relay is live. The witness model is Cerebra-internal — it enriches Cerebra's own cognitive cycle processing, not Bo's query path.

The correct feedback loop: Bo writes to hub via relay → witness model reads hub event projections into Cerebra's memory (for cognitive cycle enrichment) → when Bo queries the Cerebra daemon for cycle state, the daemon's responses may be richer as a result. Bo never calls the witness model directly. The relay passes for ai-stack and Policy Scout are prerequisites for the witness model to have useful platform context — not because Bo's queries route through it, but because the cognitive cycle itself benefits from knowing current GPU state, policy posture, and service health.

The phrase "Bo's read path goes through the witness model" (present in earlier drafts of this file) was wrong and is retracted.

---

## Item 3 — Tile + sidecar relationship under federation

### Does the tile subscribe to hub streams (replacing direct Ollama polling)?

Yes. The correct Phase 2 path is hub-mediated, not local-store-direct:

```
sidecar → ai-stack local store → relay agent → hub → Lattica fossic subscription → tile
```

Not direct from sidecar to tile. The tile (running in Lattica's webview) is agnostic about whether data came from a sidecar or another source. Direct Ollama polling in the tile can be removed once Phase 2 wiring is complete.

### Stream naming on hub — open question with leading proposal (from fossic + cerebra reconciliations)

**Post-cross-read addition:** Fossic's relay protocol draft uses `"{source_prefix}/{original_stream_id}"` for hub stream names. For ai-stack this produces:
- source_prefix: `"ai-stack"` + original stream_id: `"ai-stack/gpu"` → hub stream: `"ai-stack/ai-stack/gpu"`
- source_prefix: `"ai-stack"` + original stream_id: `"ai-stack/models"` → hub stream: `"ai-stack/ai-stack/models"`

The double-prefix is redundant. Fossic's reconciliation flags this as an open question. Cerebra's §D.3 proposes a concrete resolution:

> "If `stream_id.startswith(f'{source_prefix}/')`, use `stream_id` directly; otherwise use `f'{source_prefix}/{stream_id}'`."

Applied to ai-stack: `"ai-stack/gpu"` already starts with `"ai-stack/"`, so the hub stream stays `"ai-stack/gpu"` — no double-prefix. Same for `"ai-stack/models"`. This is the leading proposal for the federation interview round.

**Implication for Phase 2 tile wiring:** if Cerebra's proposed convention is ratified, the tile subscribes to `"ai-stack/gpu"` and `"ai-stack/models"` on the hub — same names as the local streams. The subscription target is stable pending ratification.

**Round 2 update — ai-stack's explicit position on D.3:** ai-stack endorses Cerebra's D.3 conditional rule as the preferred resolution for the federation interview. Under this rule, `"ai-stack/gpu"` and `"ai-stack/models"` already start with `"ai-stack/"` and pass through unchanged — no prefix is added. The double-prefix form (`"ai-stack/ai-stack/gpu"`) is named in this file only to identify the problem; it is NOT the intended hub stream name and is NOT ai-stack's accepted outcome. Fossic's prior reading of this file as "accepting the double-prefix" is a misread — the position has always been that the double-prefix is redundant.

### Does the sidecar's role expand?

The sidecar expands in one direction only: **more streams** (observability-only). Not management API.

Future sidecar streams:
- `ai-stack/health` — ServiceUp/ServiceDown per container (replaces tile's direct health polling)
- `ai-stack/inference` — InferenceStarted/InferenceCompleted via LiteLLM log tap (Phase 2b)
- `ai-stack/lifecycle` — SidecarStarted/SidecarStopped (trivial addition)

Management API (RESTART, FORCE FAILOVER, SLEEP TIMER) remains a separate future process with Docker socket access. The fossic sidecar is a passive observer; it doesn't become an actor.

### Relay agent implications for sidecar code

**Post-cross-read addition (from fossic reconciliation Item 3):** When the relay agent is built, the sidecar's current output needs no changes. The relay agent handles all hub-forwarding concerns. Specific protocol details now formalized by fossic:

- **Post-upcast payloads**: relay agent calls `event.deserialize_payload_json()` before hub append — triggers upcasters at local store boundary. No sidecar change needed; this is relay agent logic.
- **`causation_id=None` in sidecar appends**: fossic confirms this is fine for current events (VRAM and model lifecycle events aren't caused by upstream fossic events). When `ai-stack/inference` streams land and inference events are causally linked to Cerebra cycle events, `causation_id` would add value — but that's a Phase 2b decision.
- **`source_store` as indexed_tag**: fossic recommends relay agent adds `{"source_store": "ai-stack"}` to each relayed event's `indexed_tags`, enabling hub consumers to derive which local store to query for cross-store causal traversal. Relay agent adds this; sidecar is unaffected.
- **`branch` relay**: if ai-stack ever uses fossic branches (not currently planned), the relay agent must pass `branch=event.branch`. Current sidecar appends don't set branch; relay agent would relay `None`/default, which is correct.
- **`indexed_tags` adoption gap (prerequisite for relay pass)**: fossic's reconciliation calls `indexed_tags` adoption a prerequisite for the relay pass for all projects (Cerebra, Policy Scout both confirmed the same gap). The sidecar currently sets no `indexed_tags` on any `Append` call. Before the relay pass, sidecar events should carry at minimum:
  - `ModelLoaded` / `ModelUnloaded`: `{model_name: str}` — enables hub consumers to SQL-filter by specific model without fold-time Python filtering
  - `VramBudgetChanged`: `{warn: bool}` (whether `pct ≥ warn_threshold`) — enables hub to filter for warn-state transitions without loading every payload
  - `bot/lifecycle` events (Bo): `{event: str}` or similar — Bo's relay filter rules are simpler; exact fields TBD when relay is designed
  This is a sidecar-side change (add `indexed_tags={}` to the `Append` constructor calls), contingent on confirming fossic-py's `Append` class accepts `indexed_tags` in the installed version. Not a current blocker; a prerequisite for the relay pass.

### "Tile reads from hub, sidecar writes to local" arc — confirmed

| Layer | Process | Direction | What |
|---|---|---|---|
| Local substrate writer | `fossic_sidecar.py` | write | `ai-stack/gpu`, `ai-stack/models` → local store |
| Local substrate writer | `discord-bot/bot.py` | write | `bot/lifecycle`, `bot/conversation/*` → local store |
| Relay agent (not yet built) | TBD Python script | read local → write hub | filtered subset of `ai-stack/*` + `bot/*` streams |
| Hub consumer | `AiStackTopologyTile.tsx` | read | hub streams via Lattica's fossic subscription layer |

Sidecar and bot.py have zero knowledge of the hub. Tile has zero knowledge of the local store. Relay agent is the only process that knows about both.

---

## Summary of net-new content vs. original reconciliation

**Retained (unchanged):**
- Section 2.4 accurate, no misrepresentations
- Cerebra Ollama dependency confirmed
- Stream/payload mapping confirmed
- Bo and ai-stack are separate repositories; one local store recommended under federation
- Sidecar stays observability-only; management is a separate process
- Tile should target hub streams, not local store directly

**Revised:**
- **Item 2 (Bo read path)**: "cerebra as all-seeing aggregator" was wrong. Corrected to: cognitive cycle state → Cerebra daemon HTTP; platform-wide state → hub fossic store. Cerebra's vault-scoped store is not a platform aggregation layer and is not accessible from Bo without a cross-domain dependency.

**Added from cross-read:**
- Cerebra's health check is a second silent VRAM consumer alongside LiteLLM (two independent causes for the 92% baseline reading)
- ai-stack's direct-writer pattern is a pattern difference from the relay model, not just a config detail — fossic explicitly characterizes it this way
- Stream naming double-prefix problem (`ai-stack/ai-stack/gpu`) is an open convention question; Cerebra's §D.3 proposes the leading resolution (use `stream_id` directly if it already starts with `source_prefix/`), which would keep hub streams as `ai-stack/gpu` and `ai-stack/models`
- Relay protocol details now formalized: `source_store` indexed_tag, `branch` relay, post-upcast payload requirement — relay agent handles all of these; sidecar code unchanged
- `causation_id=None` acknowledged as correct for current sidecar events
- Snapshot API is ready to use now (fossic confirmed); cold-start use case is concrete and unblocked
- Witness model feedback loop: Bo's hub events (via relay) become visible to the witness model, which means ai-stack's relay is load-bearing for Bo's eventual context-aware responses even though Bo doesn't subscribe to the hub directly
- `indexed_tags` adoption is a prerequisite for the relay pass: sidecar currently sets none; minimum fields identified (`model_name` on model lifecycle events, `warn` on VramBudgetChanged); needs fossic-py API verification before implementation

---

## Round 3 settled log — 2026-06-16

Items confirmed settled through two full cross-read rounds. These do not require further reconciliation unless new evidence surfaces.

| Item | Status | Settled by |
|---|---|---|
| General A — Section 2.4 accuracy | **SETTLED** | No peer disputes across two rounds |
| General B — dual VRAM consumers (LiteLLM + Cerebra health check) | **SETTLED** | Cerebra confirmed D.1; all peers acknowledge |
| General B — stream/payload mapping accurate | **SETTLED** | Fossic confirmed in both rounds |
| General C — "transitions not measurements" principle | **SETTLED** | All five projects independently confirmed |
| General C — cascade-filtered VramBudgetChanged (two layers) | **SETTLED** | Fossic adopted precision; no disputes |
| General C — snapshot cold-start use case | **SETTLED** | Fossic confirms API ready; now platform-wide (ai-stack, LumaWeave, PS all have instances) |
| Item 1 — Bo and ai-stack are separate repos | **SETTLED** | All peers acknowledge; fossic corrected maturity table |
| Item 1 — one shared local store recommended | **SETTLED** | No disputes across two rounds |
| Item 2 — "cerebra as all-seeing aggregator" was wrong | **SETTLED** | Cerebra Item 3 corrected; all peers confirmed revised read-path design |
| Item 2 — Bo read-path table (daemon HTTP / hub / daemon endpoints) | **SETTLED** | LumaWeave C.6, Policy Scout B-update, fossic Item 2 all confirm |
| Item 2 — witness model reducer approach | **SETTLED** | Cerebra D.5 formally confirms option (a) — reducer projecting hub events into Cerebra memory |
| Item 2 — witness model is Cerebra-internal only; Bo reads hub directly for platform state | **SETTLED (Round 3)** | Cerebra D.5 rewrite + fossic summary table + Policy Scout B-update all confirm: Bo never reads through witness model; witness model enriches Cerebra cognitive cycles only |
| Item 2 — "Bo's read path goes through witness model" retracted | **SETTLED (Round 3)** | Incorrect claim removed from feedback loop paragraph |
| Item 3 — hub-mediated arc (sidecar → local → relay → hub → tile) | **SETTLED** | Fossic Item 2 table confirms; no disputes |
| Item 3 — relay protocol table (post-upcast, branch, source_store, external_id, causation two-case) | **SETTLED** | Fossic Item 1/3, Cerebra D.2, LumaWeave C.5, PS Item 2-update all confirmed |
| Item 3 — `causation_id=None` correct for current sidecar events | **SETTLED** | Fossic confirmed; noted for LumaWeave too |
| Item 3 — `indexed_tags` gap, minimum fields (`model_name`, `warn`) | **SETTLED (as prerequisite spec)** | Fossic Item 4 adopted; fields confirmed by fossic |
| Item 3 — ai-stack endorses Cerebra D.3 for hub stream naming | **SETTLED (Round 2, position stated)** | Position now explicit; double-prefix is NOT the target |
| CerebraReadAdapter conflict | **CLOSED** | Both Cerebra and LumaWeave confirmed: never built, file-polling model dropped |

**Still open (pending federation interview round):**
- Stream naming convention final ratification (D.3 is the leading proposal; needs platform-wide agreement)
- Relay agent process location (separate process vs. in-process; not yet decided)
- Phase 2 tile wiring (Lattica-side task with ai-stack authoring changes; not yet started)
- `indexed_tags` sidecar implementation (pre-relay prerequisite; needs fossic-py API verification)
- Bo's relay filter exact spec for `bot/*` streams (TBD when relay agent is designed)

---

## current_state

# ai-stack/Bo — Current State Baseline

**Date:** 2026-06-16
**Filed by:** ai-stack-bo-claude

---

## Section 1 — Current version + identity

**Docker compose services (as of 2026-06-16):**

| Service | Container | Status | Image |
|---|---|---|---|
| Ollama | ai-stack_ollama_1 | Up 4 days | ollama/ollama |
| LiteLLM | ai-stack_litellm_1 | Up 4 hours | ai-stack-litellm (local build) |
| Open-WebUI | ai-stack_open-webui_1 | Up 4 days (healthy) | ghcr.io/open-webui/open-webui:main |
| TTS | tts | Up 4 days | ghcr.io/matatonic/openedai-speech:latest |

**Component versions:**
- Ollama: 0.21.0
- GPU: NVIDIA GeForce RTX 4070 SUPER, 12282 MB VRAM
- fossic-py: 0.1.0 (installed from local wheel into ai-stack venv)

**Current GPU state (live at filing time):**
- `qwen3.5:latest` loaded — 11305 MB / 12282 MB used (92%)
- Note: LiteLLM health checks probe `ollama/qwen3.5:latest`, which triggers model load. This is a known side effect of LiteLLM's health polling; it's not user-initiated.

**Most recent milestone:** Phase 2a fossic sidecar built, smoke-tested, and live-verified with a full model load/unload cycle. All three event types confirmed in fossic store.

**Identity:** ai-stack is the local GPU inference stack (Ollama + LiteLLM + Open-WebUI) that backs Bo's LLM calls and the platform's local-first inference layer, now emitting structured events to the shared fossic substrate.

---

## Section 2 — What just shipped since last baseline

**1. AiStackTopologyTile.tsx + .css (P-013 guest-author into Lattica)**
Authored by ai-stack/bo Claude and committed into Lattica's tree by Lattica Claude (v0.3.5v). The tile is registered in `tileSectionRegistry` as `ai-stack-topology`, right panel, 480×520. It polls Ollama and LiteLLM on a 10s interval and renders the full stack topology with VRAM gauge, alias chips, and model controls. Visual verification is developer-manual (no display in CI). Lattica confirmed typecheck clean.

**2. fossic_sidecar.py (Phase 2a, ai-stack local substrate writer)**
New file: `/home/boop/Projects/ai-stack/fossic_sidecar.py` (212 lines). Standalone Python process. Polls Ollama `/api/ps` and `nvidia-smi` every 10 seconds; diffs model state and emits to `ai-stack/gpu` (VramBudgetChanged) and `ai-stack/models` (ModelLoaded, ModelUnloaded). Degrades silently if fossic store is unavailable. SIGTERM/SIGINT shutdown confirmed clean.

**3. fossic-py installed in ai-stack venv**
Developer-approved. Installed via `uv pip install` from local wheel (`fossic-0.1.0-cp312-cp312-linux_x86_64.whl`). Confirmed importable.

**4. Live sidecar verification**
End-to-end test: sidecar running → `qwen3.5:4b` loaded → `ModelLoaded` + `VramBudgetChanged` events confirmed in fossic store → model unloaded → `ModelUnloaded` confirmed. VRAM jump: 29.4% → 73.0% (3782 MB → 9402 MB used). All events readable via `Store.read_range(ReadQuery(...))`.

---

## Section 3 — Visual elements available for Lattica

### AiStackTopologyTile features
- **STACK status dot** — aggregate up/degraded/down dot in the tile header
- **TOPO/LIST toggle** — graph-layout topology view vs. flat list view (TOPO is default; LIST is placeholder in current build)
- **DORMANT toggle** — show/hide dormant model nodes
- **VRAM gauge** — filled bar showing model VRAM / total VRAM; threshold-based warn color (default 80%); total overridable via number input stored in `localStorage["aistack.vramTotalMb"]`
- **ALIAS MUTE chips** — per-alias mute toggles for `bot-local` and `bot-escalated`; muted aliases show struck-through chip + dimmed graph edge; persisted in `localStorage["aistack.mutedAliases"]`
- **LOAD MODEL** — dropdown of available Ollama models + confirm button; calls `POST /api/generate {model, prompt:"", keep_alive:"10m"}`; re-polls immediately after
- **UNLOAD ALL** — confirm button; calls unload for each running model; re-polls immediately after

### Sidecar event types and payload shapes

**Stream: `ai-stack/gpu`**
```
VramBudgetChanged {
  used_bytes: int,          // total GPU VRAM used (CUDA overhead + all models)
  total_bytes: int,         // GPU total capacity
  model_vram_bytes: int,    // sum of size_vram across running models only
  pct: float,               // used_bytes / total_bytes * 100, rounded to 1 decimal
  models: [{name: str, size_vram: int}],
  sampled_at: int           // Unix ms
}
```

**Stream: `ai-stack/models`**
```
ModelLoaded {
  model_name: str,
  size_vram: int,
  loaded_at: int            // Unix ms
}

ModelUnloaded {
  model_name: str,
  unloaded_at: int          // Unix ms
}
```

**Emit condition:** `VramBudgetChanged` only when GPU used VRAM shifts ≥10 MB from last reading (suppresses nvidia-smi polling noise). `ModelLoaded`/`ModelUnloaded` on every diff.

### Renderer utility for Lattica
A Lattica-side renderer for `VramBudgetChanged` would be useful — a compact VRAM bar with `pct` + model list would give Lattica's graph view real GPU state without polling. `ModelLoaded`/`ModelUnloaded` could annotate the model node timeline. Not authored yet; would follow the P-013 guest-author pathway.

### Bo heartbeat / status
- Bo (`discord-bot/bot.py`) emits to `bot/lifecycle` (BotStarted, BotStopped) and `bot/conversation/<channel_id>` (LlmCallAttempt, ResponseGenerated) — streams are live in the shared fossic store.
- No `~/.lattica/bo-heartbeat.json` file exists — Bo does not write a heartbeat file. The tile's Bo node is currently `status: "unknown"` (Phase 2 pending). Subscribing to `bot/lifecycle` events would resolve this; it's the fast-follow item after Phase 2 tile wiring.
- **TTS node:** `status: "unknown"` permanently with current config. The openedai-speech container exposes no host port (internal only). Can't be health-checked from the Tauri webview without either (a) adding a host port to `docker-compose.yml`, or (b) routing through a management sidecar with Docker socket access. Neither is in current scope.

### Connection details
- Ollama: `http://localhost:11434` — `/api/ps` (running models), `/api/tags` (available models), `/api/generate` (load/unload via keep_alive)
- LiteLLM: `http://localhost:4000` — `/v1/models` (alias list), `/health` (endpoint health); master key `sk-fake` (local only)
- Open-WebUI: `http://localhost:3000` — health-checked via HEAD
- TTS: no host port — unreachable externally
- LiteLLM config: `/home/boop/Projects/ai-stack/litellm/litellm-config.yaml`
- fossic store (shared): `~/.lattica/fossic/store.db`
- Sidecar venv: `/home/boop/Projects/ai-stack/.venv/bin/python3`

---

## Section 4 — Open items / known follow-ups

**Tile Phase 2 wiring (medium priority)**
`AiStackTopologyTile.tsx` still polls Ollama directly. To complete Phase 2, the polling loop needs to be replaced or supplemented with fossic subscriptions to `ai-stack/gpu` and `ai-stack/models` via Tauri `invoke("fossic_subscribe", ...)`. This resolves the VRAM gauge data source, the model list, and (via `bot/lifecycle`) the Bo node status. This is Lattica-side wiring work with ai-stack/bo authoring the tile changes.

**Bo node resolution (fast-follow after Phase 2 wiring)**
Subscribe to `bot/lifecycle` stream in the tile. `BotStarted`/`BotStopped` events are already live. Bo node moves from `status: "unknown"` to event-driven.

**Management sidecar (iteration 6+, gated)**
RESTART node, FORCE FAILOVER, SLEEP TIMER require Docker socket access or equivalent system access. Not scoped. These are the remaining iter-4 M-tier backend-prep items from the investigation doc. No design exists yet.

**`ai-stack/inference` stream (Phase 2b, low priority)**
`InferenceStarted`/`InferenceCompleted` events need either a LiteLLM log tap or middleware hook. Not designed. LiteLLM's request log location and format are unverified for this use case.

**Manual visual verification of tile**
The tile has never been visually inspected with all four services running simultaneously. LiteLLM was down during Lattica's smoke test. Developer task: run full stack → open Lattica → confirm LITELLM node flips to up, alias chips populate, VRAM gauge reflects live nvidia-smi values.

---

## Section 5 — Cross-project signal

**Fossic store path**
The sidecar is currently writing to: `~/.lattica/fossic/store.db` — the same shared store used by Bo, Cerebra, and Lattica. Streams `ai-stack/gpu` and `ai-stack/models` are now live in that store (confirmed). This is directly relevant to the federation conversation: in the current topology, ai-stack is a writer in the shared store, not a separate local store.

**TOPOLOGY_ALIASES hardcoded Set**
In `AiStackTopologyTile.tsx`:
```ts
const TOPOLOGY_ALIASES = new Set(["bot-local", "bot-escalated"])
```
These are the two aliases rendered as graph edges in the topology. If LiteLLM gains new routing aliases that the tile should represent, this Set must be updated manually. It's not derived from the LiteLLM config at runtime. In a future iteration, the tile could fetch `/v1/models` and auto-populate — but that requires a decision about which aliases are "routing-relevant" vs. internal.

**LiteLLM health check triggers model load**
LiteLLM probes `ollama/qwen3.5:latest` as its health endpoint, which causes Ollama to load that model into GPU. At filing time: 11305 MB / 12282 MB used with no user-initiated loads. Any project that looks at VRAM usage should be aware that the LiteLLM health poller has a persistent ~5-6 GB VRAM footprint as a side effect.

---

## Section 6 — Pre-federation exploratory thoughts

**What events ai-stack would emit to its local substrate**
Natural local stream candidates, roughly by volume:
- `ai-stack/gpu` — VramBudgetChanged (already live; 10s poll, filtered by ≥10 MB delta)
- `ai-stack/models` — ModelLoaded, ModelUnloaded (already live; event-driven off /api/ps diff)
- `ai-stack/inference` — InferenceStarted, InferenceCompleted (Phase 2b; needs LiteLLM tap)
- `ai-stack/health` — ServiceUp, ServiceDown per container (not yet designed; would replace the tile's direct polling)
- `ai-stack/lifecycle` — SidecarStarted, SidecarStopped (trivial addition to current sidecar)

**What would stay local vs. relay to hub**
The clearest split:
- **Relay to hub:** Model lifecycle transitions (ModelLoaded/ModelUnloaded) — these are meaningful platform-level signals. VRAM state summaries (pct, total_bytes) — hub can present GPU budget in the topology graph. ServiceUp/ServiceDown for named services — affects routing decisions in other projects.
- **Stay local:** Raw VramBudgetChanged at 10s poll rate — too high volume for a hub, better aggregated. Inference attempt logs — local audit trail; only summaries (latency_p50, error rates) would relay. Health poll noise.

The governing principle would probably be: relay *transitions*, not *measurements*. Measurements stay local for aggregation; transitions (load, unload, up, down) relay.

**Existing data paths outside fossic**
- `litellm-config.yaml` — static routing config. This is the alias→model mapping. It doesn't change at runtime; no obvious reason to fold it into the substrate. Could be event-sourced (AliasConfigChanged) if dynamic routing ever lands, but that's not a current need.
- `docker-compose.yml` — service topology declaration. Also static. Could seed an initial event (StackDeclared) at sidecar startup to give the hub a snapshot of the declared topology, but again not a current need.
- Ollama's model registry (`/api/tags`) — available-but-not-loaded models. This is the source-of-truth for what *can* be loaded. Could be snapshotted into a `ai-stack/registry` stream (ModelAvailable events at startup). Useful if the hub needs to show the full model inventory, not just what's hot.

None of these urgently need to fold into the substrate. They're static config; fossic is for runtime state.

**Fossic features that fit ai-stack's domain**
- **High-throughput append** — the sidecar's 10s poll rate is low; not a throughput concern right now. If inference-level events land (per-request), volume goes up. Read: not a concern today, might be relevant at Phase 2b.
- **Snapshots for VRAM state** — `VramBudgetChanged` is the current steady-state event; a snapshot at the `ai-stack/gpu` stream could give subscribers a fast initial read without replaying history. Worth considering once the tile subscribes instead of polling.
- **Transforms for normalizing nvidia-smi vs. Docker output** — nvidia-smi reports total GPU VRAM used (all consumers); Ollama's `/api/ps` reports model-attributed VRAM only. The sidecar already separates these into `used_bytes` vs. `model_vram_bytes` in the payload. A fossic transform could normalize historical events if the payload shape changes. Not needed today.
- **`read_by_correlation`** — could be useful for tracing an inference attempt (LlmCallAttempt → ResponseGenerated) if causation chains are set. Currently `causation_id=None` in all sidecar appends; no correlation chain exists.

**Sidecar design in a federation context**
Currently: a single process that opens the shared store directly and appends. In a federation where each project has its own local store, the sidecar would open a *local* store instead — zero design change needed for that transition, just a config path change (`FOSSIC_STORE_PATH`). The relay agent would sit between the local store and the hub, subscribing to `ai-stack/*` and forwarding designated transitions. The sidecar itself doesn't need to know about the hub at all, which is a clean separation.

One non-trivial question: if the shared store is replaced by per-project stores, what happens to the streams Bo already writes to (`bot/lifecycle`, `bot/conversation/*`)? Bo and the sidecar are both in the ai-stack domain but are separate processes. In a local-store model, both would write to the same local store; in the current model, both write to the shared store. This is probably the cleanest split already — they share a domain, so they share a local store. The relay agent handles federation.

**Concerns / unknowns**
- LiteLLM health-check VRAM side effect: the 5-6 GB persistent load from LiteLLM probing qwen3.5:latest is not surfaced anywhere in the current event stream. A `VramBudgetChanged` event just shows high usage without indicating *why*. An `InferenceStarted` event tagged with `alias: "health-check"` or similar would disambiguate. Not a blocker, but worth noting for observability design.
- Stream naming: `ai-stack/gpu`, `ai-stack/models` uses slash-namespacing consistent with `bot/lifecycle`, `cerebra/agent-trace/*`. If federation adds a project-prefix layer, these names might need qualification. Or the local-store path acts as the project boundary and stream IDs stay short. TBD.
- The tile doesn't subscribe to fossic yet — it still polls Ollama directly. Until Phase 2 wiring lands, the sidecar and tile operate in parallel with the same data, not in series. Not a bug, but means the fossic events aren't load-bearing yet.

---

