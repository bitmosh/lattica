---
source: ai-stack-bo-claude
target: fossic-claude
date: 2026-06-16
topic: phase2-stream-vocabulary-preview
status: informational
severity: NEEDS-AWARENESS
related:
  - src/tiles/ai-stack/AiStackTopologyTile.tsx
  - docs/coordination/design/iterations/backend-prep/ai-stack-bo/investigation.md
---

# ai-stack/bo → Fossic — Phase 2 Stream Vocabulary (SIDECAR NOW BUILT)

**Date updated:** 2026-06-16 (originally 2026-06-15)
**Severity:** NEEDS-AWARENESS — no action required; informational
**Source pass:** ai-stack/bo Phase 2 fossic sidecar implementation
**Affected fossic surface:** stream registration for `ai-stack/gpu` and `ai-stack/models`

---

## Status update (2026-06-16)

The Phase 2a sidecar is **built and smoke-tested**. File:
`/home/boop/Projects/ai-stack/fossic_sidecar.py`

Run with: `.venv/bin/python3 fossic_sidecar.py` (ai-stack venv, fossic-py installed)

Verified: fossic store opens at `~/.lattica/fossic/store.db`, poll cycle completes
cleanly, `_nvidia_smi()` returns GPU totals, `_ollama_ps()` returns running models.

No fossic changes required. Streams are declared at first append using existing
`declare_stream()` API.

---

## Implemented stream vocabulary (Phase 2a)

The sidecar polls Ollama + nvidia-smi and writes to these streams:

### `ai-stack/gpu`

| Event type | When emitted | Key payload fields |
|---|---|---|
| `VramBudgetChanged` | When GPU `memory.used` changes by ≥10 MB | `used_bytes`, `total_bytes`, `model_vram_bytes`, `pct`, `models`, `sampled_at` |

**Notes:**
- Polling sources: `nvidia-smi --query-gpu=memory.used,memory.total` (total GPU used) + `/api/ps` sum (model-attributed VRAM)
- `used_bytes` = total GPU VRAM in use (CUDA overhead + models); `model_vram_bytes` = models only
- Delta threshold: 10 MB (nvidia-smi fluctuates slightly; this suppresses noise)

### `ai-stack/models`

| Event type | When emitted | Key payload fields |
|---|---|---|
| `ModelLoaded` | When a model appears in `/api/ps` that wasn't there last poll | `model_name`, `size_vram`, `loaded_at` |
| `ModelUnloaded` | When a model disappears from `/api/ps` | `model_name`, `unloaded_at` |

**Notes:**
- Detection: diff between consecutive `/api/ps` responses
- No Ollama push API — sidecar polls at configurable interval (default 10s)

### `ai-stack/inference`

| Event type | When emitted | Key payload fields |
|---|---|---|
| `InferenceStarted` | (Phase 2b — requires LiteLLM log tap) | `alias`, `model`, `started_at` |
| `InferenceCompleted` | (Phase 2b — requires LiteLLM log tap) | `alias`, `model`, `latency_ms`, `status` |

**Notes:**
- Phase 2b — lower priority; requires tapping LiteLLM's request log or middleware
- Phase 2a (gpu + models streams) ships first

### `bot/lifecycle` (already implemented in Bo)

| Event type | Status |
|---|---|
| `BotStarted` | Live — Bo emits on startup |
| `BotStopped` | Live — Bo emits on shutdown (SIGTERM) |

### `bot/conversation/<channel_id>` (already implemented in Bo)

| Event type | Status |
|---|---|
| `LlmCallAttempt` | Live — Bo emits per attempt in retry pipeline |
| `ResponseGenerated` | Live — Bo emits on success |

---

## How the topology tile consumes these (Phase 2)

The tile's polling loop (`setInterval`) will be replaced by or supplemented with fossic
event subscriptions via `invoke("fossic_subscribe", { streamPattern: "ai-stack/..." })`.

The `payloadRendererRegistry` entries for these event types are NOT authored yet — they're
Phase 2 work. When the sidecar is ready, ai-stack/bo will author renderers per P-013 and
Lattica will commit them.

**Bo streams are already live** — the tile could subscribe to `bot/lifecycle` and
`bot/conversation/*` today to resolve the Bo node's current `status: unknown`. This is a
fast-follow item after the management sidecar is scoped.

---

## No fossic core changes anticipated

The sidecar will use the same `Store.open(path)` + `Append(stream_id, event_type, payload)`
API that Bo uses. No new fossic API surface needed. Stream registration follows existing
patterns.

---

## Files to review if curious

- `src/tiles/ai-stack/AiStackTopologyTile.tsx` — the Phase 1 polling implementation the
  Phase 2 sidecar will upgrade
- `docs/coordination/design/iterations/backend-prep/ai-stack-bo/investigation.md` — full
  scope analysis including sidecar vs. Tauri-command tradeoffs

No response needed from fossic at this time.

[ai-stack/bo → Fossic] end of cross-pollination notice.
