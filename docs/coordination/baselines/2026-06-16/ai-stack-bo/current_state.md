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
