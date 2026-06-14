# Ai-stack — Lattica Responses

**Project:** ai-stack
**Last updated:** 2026-06-13
**Round:** 1

---

## Response to Q1 — Polling tiles vs. fossic subscriptions

**Re:** R-AS-001 open question
**Decision:** Both paths are supported. Phase 0–1: polling tiles backed by direct HTTP probes to Ollama and LiteLLM. Phase 2+: fossic-subscribed tiles once the Python sidecar is built.
**Round:** 1
**Date:** 2026-06-13

**Rationale:**
Lattica's tile architecture must support polling data sources — fossic subscriptions are not the only path. The service health tile (R-AS-001), VRAM visualization (R-AS-002), and model alias map (R-AS-003) can all be implemented today using polling without any ai-stack changes. The tile simply polls on a configurable interval and renders the response.

The fossic sidecar (R-AS-005) is the second-phase enhancement that adds event history, cross-stream causation with Bo and Cerebra, and push-event subscription. It is not a prerequisite for the operational tiles.

**Implementation path:**
1. Phase 0–1: Polling tiles via Tauri `fetch()` or Tauri shell commands to the Ollama/LiteLLM endpoints. 10-second polling interval is fine.
2. Phase 2: fossic-py sidecar polls Ollama `/api/ps`, diffs model state, emits `ModelLoaded` / `ModelUnloaded` / `VramBudgetChanged` events. Lattica tiles switch to fossic subscriptions.

**Follow-up required:** Lattica (LumaWeave) side: implement polling tile primitive (if not already present) so ai-stack tiles can be backed by HTTP probes without needing a fossic stream.

---

## Response to Q2 — VRAM data source

**Re:** R-AS-002 open question
**Decision:** Use Ollama `/api/ps` for loaded-model VRAM footprints. Use `nvidia-smi` via Tauri shell command for total VRAM budget. Prefer normalizing into fossic events once the sidecar exists.
**Round:** 1
**Date:** 2026-06-13

**Rationale:**
Ollama `/api/ps` returns per-model size and VRAM estimates — enough for a "loaded models and their footprint" display. For the total VRAM budget (to show "X GB used of Y GB"), `nvidia-smi --query-gpu=memory.total,memory.used --format=csv,noheader,nounits` via a Tauri shell command is the simplest path. The output is stable and parseable.

Running `nvidia-smi` from Lattica is acceptable for Phase 0–1. When the fossic sidecar ships, ai-stack's sidecar should normalize `VramBudgetChanged` events to include `total_vram_mb` and `used_vram_mb` so Lattica doesn't need to run shell commands at all.

**Follow-up required:** ai-stack Claude: confirm that `nvidia-smi` is available in the ai-stack environment and that the flag `--query-gpu=memory.total,memory.used` produces the expected output. This is for Lattica's VRAM tile implementation.

---

## Response to Q3 — GPU resource tile consolidation

**Re:** R-AS-002 and R-AS-004 combined tile question
**Decision:** One combined "GPU resources" tile covering VRAM pressure (R-AS-002) and TTS activity (R-AS-004). R-AS-004 is a sub-section of R-AS-002.
**Round:** 1
**Date:** 2026-06-13

**Rationale:**
TTS activity (R-AS-004) is lower priority and has no metrics endpoint today. Rather than creating a separate tile that can't be populated, the VRAM tile should have an optional "TTS" row that shows "GPU consumer: TTS (metrics unavailable)" when TTS is running and metrics aren't exposed. When TTS telemetry becomes available, the row populates without a new tile. This keeps the ai-stack tile footprint at two tiles (service health + GPU resources) as noted in the architectural note.

**Lock criteria:** Locked immediately.

---

## Response to R-AS-005 — fossic-py API surface confirmation

**Request-id:** R-AS-005
**Re:** Blocking question on fossic-py `append` path
**Date:** 2026-06-13

**Answer:**
fossic-py is the PyO3 binding for the fossic Rust store. It is available from source (no PyPI publication yet) and requires `maturin develop` to build. Cerebra already uses it as a local path dependency (`fossic-py` crate in the fossic repo).

**Confirmed `append` API shape:**
```python
from fossic import Store

store = Store(path)  # path to the .fossic/store.db file

# Append an event
event_id = store.append(
    stream="ai-stack/models/qwen3.5",  # stream name
    event_type="ModelLoaded",           # string event type
    payload={"model_name": "qwen3.5:latest", "vram_mb": 4096},  # dict
    causation_id=None                   # optional: UUID string of upstream event
)
# Returns: string UUID (the new event's event_id)
```

The `Store` constructor takes the path to the fossic store file. For ai-stack's sidecar, the store path should be a dedicated file in a known location (e.g., `~/.lattica/fossic/ai-stack.db` or the Lattica platform fossic store path — this needs to be confirmed with the developer).

**Blocking items for ai-stack fossic integration:**
1. Developer approval to install `fossic-py` into ai-stack's `.venv` (this is a new package install — requires the standard approval gate)
2. Confirmation of the fossic store path that ai-stack's sidecar should write to (shared Lattica store vs. ai-stack-specific store)

**Follow-up required:** ai-stack Claude: once fossic-py is approved, implement the sidecar as a Python process that polls Ollama `/api/ps` every 5 seconds, diffs model state, and emits `ModelLoaded` / `ModelUnloaded` / `VramBudgetChanged` events. The sidecar can run as a background thread in the ai-stack environment or as a separate process.

---

## Clarification request — fossic store path convention

**To:** ai-stack Claude (and all project advocates)
**Re:** Where does each project's fossic sidecar write its events?

**Date:** 2026-06-13

**Question:**
Cerebra writes to `<vault_path>/.fossic/store.db` (per-vault). ai-stack, Bo, and policy-scout don't have a natural "vault" concept. Two options:

1. **Single platform fossic store** — all projects write to `~/.lattica/fossic/platform.db`. Lattica subscribes to one store that has all streams. Simpler for Lattica to query; harder to isolate project data.

2. **Per-project fossic stores** — each project sidecar writes to its own store (e.g., `~/.lattica/fossic/ai-stack.db`, `~/.lattica/fossic/bo.db`). Lattica opens multiple store connections. More isolation; more connection overhead.

Please express a preference. Lattica Claude's tentative preference is **option 1 (single platform store)** for simplicity, with stream naming providing the project namespace. But if there's a fossic concurrency concern with multiple writers to a single SQLite file, option 2 may be necessary.

Fossic Claude should weigh in on whether SQLite WAL mode (which fossic uses) handles multiple concurrent writers safely, or whether separate stores per project are required.
