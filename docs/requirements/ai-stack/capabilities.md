# ai-stack — Capabilities Inventory

**Project:** ai-stack
**Author:** ai-stack Claude
**Date:** 2026-06-13
**Purpose:** What ai-stack offers that is relevant for display or utilization in Lattica.

ai-stack is operational infrastructure. Its capabilities are service-level —
things Lattica can observe and surface, not high-level domain events. The value
it contributes to Lattica is **GPU resource visibility** and **model serving
status** that all other projects depend on but can't observe themselves.

---

## Services and their observable surfaces

### Ollama (port 11434)
- **`GET /api/ps`** — lists currently loaded models with size estimates and VRAM
  consumption. Returns model name, size, VRAM footprint, modification time.
  This is the primary VRAM pressure signal.
- **`GET /api/tags`** — lists all locally available models (pulled but not
  necessarily loaded). Shows what's available to load.
- **`POST /api/pull`** — model pull operation; Lattica can observe pull
  progress if ai-stack emits fossic events on pull start/complete.
- **GPU backend:** Ollama is configured with `driver: nvidia, count: all` —
  all available VRAM is offered to Ollama. VRAM total is derivable from
  `nvidia-smi` or inferred from Ollama's per-model footprint reporting.

### LiteLLM (port 4000)
- **`GET /model/info`** — returns the active routing table: alias names,
  underlying models, API bases. Exposes the alias → model → backend mapping.
- **`GET /health`** — liveness check. Returns ok/error with per-model
  provider health where available.
- **OpenAI-compatible completions endpoint** — all consumer projects call
  this; LiteLLM logs can surface request counts and latency if exposed.
- **Current alias table (from litellm-config.yaml):**
  - `bot-local` → `ollama/qwen3.5:latest` (Bo's primary model)
  - `bot-escalated` → `anthropic/claude-sonnet-4-6` (Bo's cloud fallback)
  - `cerebra-classifier` → `ollama/qwen3.5:latest`
  - `claude-3-sonnet`, `claude-3-haiku`, `claude-sonnet-4-6`, `claude-opus-4-6`,
    `sonnet`, `opus` → various Ollama models (local dev aliases)

### TTS / openedai-speech
- Serves on an internal port (not currently exposed externally)
- GPU-backed audio generation (configured `driver: nvidia, count: all`)
- Voice profiles: shimmer, fable, nova, onyx, alloy, echo (from tts-voices/)
- Two TTS engines: Kokoro (kokoro-cache/) and Piper (en_US-libritts_r-medium,
  en_GB-northern_english_male-medium)
- No external health or metrics endpoint currently configured

### Open-WebUI (port 3000)
- Chat web interface backed by LiteLLM
- Environment: `OPENAI_API_BASE=http://litellm:4000`, `OPENAI_API_KEY=dummy`
- No metrics endpoint; operational status derivable from HTTP probe

---

## What Lattica can display about ai-stack

### Operational tiles (displayable today, via polling)
1. **Service liveness** — HTTP probe each service; show up/down/degraded per
   container. Ollama: `GET /api/ps` (non-empty = up+loaded). LiteLLM: `GET /health`.
   Open-WebUI: `GET /` HTTP 200.
2. **Loaded model list** — Ollama `/api/ps` response; shows which models are
   currently resident in VRAM with approximate footprint.
3. **LiteLLM alias map** — LiteLLM `/model/info`; shows current routing table,
   distinguishes local (Ollama) vs. cloud (Anthropic) backends.
4. **Available model library** — Ollama `/api/tags`; shows what has been pulled
   and is available to load.

### Events ai-stack could emit (when fossic-integrated)
Stream prefix: `ai-stack/models` and `ai-stack/inference`

- `ModelLoaded` — a model moved into VRAM (detected via `/api/ps` diff)
- `ModelUnloaded` — a model left VRAM
- `VramBudgetChanged` — loaded model set changed, implying VRAM usage shifted
- `ModelPullStarted` — a pull operation began
- `ModelPullCompleted` — a pull operation finished (success or failure)
- `InferenceRequestReceived` — a request hit LiteLLM (alias, timestamp)
- `InferenceResponseSent` — response returned (alias, latency, status)
- `ServiceStarted` — a Docker container came up
- `ServiceStopped` — a Docker container went down

These events do not exist today. They require a fossic-py sidecar
that polls Ollama and LiteLLM and diffs state. The `.venv` is in place.

---

## What ai-stack does NOT offer Lattica

- ai-stack does not produce **domain-level events** (no conversation semantics,
  no signal scores, no safety decisions) — it is pure infrastructure
- ai-stack does not have a **push notification** mechanism — all current signals
  require polling Ollama/LiteLLM REST endpoints
- ai-stack does not currently have **fossic integration** — all events listed
  above are aspirational until a sidecar is built
- ai-stack does not control **which models other projects request** — it serves
  whatever is asked; VRAM contention is implicit
- TTS has **no observable metrics endpoint** in the current Docker config —
  adding one requires config changes

---

## Relevant fossic stream vocabulary

Per `EVENT_FABRIC.md` (fossic-side convention):
- `ai-stack/models/<model_name>` — per-model lifecycle events
- `ai-stack/inference` — aggregate inference traffic (request/response counts)

The vocabulary is compatible with the standard agent-trace event types from
`AGENT_TRACE_VOCABULARY.md` for the inference path (an `llm_call` from Bo
through LiteLLM is also observable at the ai-stack level as an inference event).

---

## Integration priority for Lattica

1. **Polling tiles first** (no fossic needed): Ollama `/api/ps`, LiteLLM
   `/model/info`, HTTP health probes. These give immediate operational value.
2. **fossic sidecar second**: adds VRAM change events and enables cross-stream
   causation with Bo and Cerebra inference requests.
3. **TTS telemetry last**: requires config changes to the TTS container; lower
   operational value than model/VRAM visibility.
