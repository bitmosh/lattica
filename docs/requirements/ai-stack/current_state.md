# ai-stack — Current State

**Project:** ai-stack
**Last updated:** 2026-06-13
**Living doc:** yes — update when stack configuration or integration status changes.

---

## What is running

Docker Compose stack on the local machine. Four services:

| Service | Image | Port | Status |
|---|---|---|---|
| ollama | `ollama/ollama` | 11434 | Running, GPU-backed |
| litellm | custom build (`./Dockerfile`) | 4000 | Running |
| tts | `ghcr.io/matatonic/openedai-speech:latest` | (internal) | Running, GPU-backed |
| open-webui | `ghcr.io/open-webui/open-webui:main` | 3000 | Running |

GPU config: both Ollama and TTS are configured `driver: nvidia, count: all`
(full GPU access). They share the same physical GPU.

---

## Models currently available

Pulled and available in Ollama (from `ollama list`):
- `qwen3.5:latest` — primary model for Bo (`bot-local`) and Cerebra classifier
- `llama3.1` — backing model for most LiteLLM aliases

TTS models on disk:
- `en_US-libritts_r-medium.onnx` (Piper)
- `en_GB-northern_english_male-medium.onnx` (Piper)
- Kokoro v1.0 (`kokoro-v1_0.pth`) + voice presets in `kokoro-cache/voices/`

---

## LiteLLM alias table (as of 2026-06-13)

| Alias | Backend | Model |
|---|---|---|
| `bot-local` | Ollama (local) | `qwen3.5:latest` |
| `bot-escalated` | Anthropic (cloud) | `claude-sonnet-4-6` |
| `cerebra-classifier` | Ollama (local) | `qwen3.5:latest` |
| `claude-3-sonnet` | Ollama (local) | `llama3.1` |
| `claude-3-haiku` | Ollama (local) | `qwen3.5` |
| `claude-sonnet-4-6` | Ollama (local) | `llama3.1` |
| `claude-opus-4-6` | Ollama (local) | `llama3.1` |
| `sonnet` | Ollama (local) | `llama3.1` |
| `opus` | Ollama (local) | `llama3.1` |

Note: `bot-escalated` → Anthropic is the only cloud-backed alias. All others
route to the local Ollama instance. The `ANTHROPIC_API_KEY` is required in the
environment for `bot-escalated` to work.

---

## Fossic integration status

**None.** ai-stack has no fossic integration today.

- No event emission for model load/unload events
- No VRAM change tracking
- No inference request telemetry
- The Python `.venv` is present and could host a fossic-py sidecar
- Implementing the sidecar is blocked on: (1) developer approval for the
  `fossic` Python package install; (2) fossic-py API surface confirmation

---

## Current observability

What can be read today without changes:

- `GET http://localhost:11434/api/ps` — loaded models + VRAM footprint
- `GET http://localhost:11434/api/tags` — available models
- `GET http://localhost:4000/health` — LiteLLM liveness
- `GET http://localhost:4000/model/info` — alias routing table
- `GET http://localhost:3000/` — Open-WebUI liveness (HTTP 200)
- `docker compose ps` — container status for all four services

No push/webhook mechanisms exist. All signals require polling.

---

## Known gaps for Lattica integration

1. **No fossic stream** — all Lattica tiles for ai-stack must use polling until
   a fossic-py sidecar is built
2. **No TTS metrics** — TTS has no exposed metrics endpoint; GPU competition
   from TTS is currently invisible
3. **VRAM total not natively reported by Ollama** — must be inferred from
   per-model footprint sums or queried from `nvidia-smi`
4. **No model-load-change push** — Lattica must poll `/api/ps` and diff to
   detect model transitions; no webhook or event exists

---

## What needs to happen next (for Lattica integration)

1. **Agree on polling vs. fossic** with Lattica Claude (see R-AS-001 open
   question) — this determines whether Lattica builds polling tiles or waits
   for the sidecar
2. **Implement fossic-py sidecar** (requires developer approval for the package)
   if fossic-backed tiles are the chosen path
3. **Confirm fossic-py API surface** — specifically the `append` path from the
   PyO3 binding; blocking for sidecar implementation
4. **Optional: expose TTS metrics** — requires Docker config change to add
   a metrics endpoint; low priority

---

*Update this file when: alias table changes, new models are pulled, fossic
integration lands, or a new service is added to the stack.*
