# ai-stack — Lattica Requirements

**Project:** ai-stack
**Author:** ai-stack Claude (acting as ai-stack advocate)
**Date:** 2026-06-13
**Status:** Initial requirements deposit

ai-stack is operational infrastructure — GPU-backed Docker Compose services
(Ollama, LiteLLM, openedai-speech/TTS, Open-WebUI) that supply local model
serving to every other project in the portfolio. Its Lattica contribution is
operational visibility tiles, not domain-event tiles: the things that break
when ai-stack is unhealthy affect the whole platform, and right now there is
no unified place to see that.

---

---
id: R-AS-001
category: tile-design
priority: must-have
---

## R-AS-001 — Service health tile (container status per service)

**Category:** tile-design
**Priority:** must-have

**Specific need:**
Lattica must provide an operational tile that shows live health status for each
ai-stack service: Ollama (`:11434`), LiteLLM (`:4000`), TTS, and Open-WebUI
(`:3000`). At minimum: up/down/degraded per service, last-checked timestamp,
and a recent-error indicator.

**Why it matters:**
Every project that uses local model serving (Bo routes through LiteLLM → Ollama;
Cerebra will do the same) is downstream of ai-stack health. There is currently no
single surface that shows whether the stack is operational. When something breaks,
the first question is always "is Ollama up?" — this tile answers it without
checking containers manually.

**Constraints:**
- Health checks should be lightweight (HTTP probe or Docker health endpoint),
  not full inference round-trips
- Polling interval of ~10s is acceptable; sub-second is not required
- Must not become a hard dependency — Lattica crashing should not affect ai-stack

**Adjacent project awareness:**
Bo and Cerebra both depend on LiteLLM availability. A red service-health tile
is operationally meaningful for any project consuming model APIs. Shared tile
design may serve multiple projects; worth coordinating with the Bo advocate.

**Outstanding questions:**
Does Lattica have a mechanism for HTTP-probe-based health tiles independent of
fossic subscriptions? If the health state is not emitted as fossic events (which
ai-stack doesn't do today), does Lattica need a direct polling tile type, or
should ai-stack emit `ai-stack/lifecycle/ServiceStarted` / `ServiceStopped`
events to fossic as the canonical health signal?

---

---
id: R-AS-002
category: tile-design
priority: must-have
---

## R-AS-002 — VRAM pressure visualization

**Category:** tile-design
**Priority:** must-have

**Specific need:**
A tile showing current VRAM allocation: which model(s) are loaded, estimated VRAM
consumption per model, total budget vs. used, and whether the GPU is under
pressure. When VRAM is contested (multiple consumers requesting different models),
the tile should show what is loaded and what is queued.

**Why it matters:**
VRAM is the single scarcest resource in the stack. When Bo is running a 9B
model, TTS is rendering audio, and Cerebra triggers a classification call, VRAM
pressure is real. Right now there is no visibility into this — you learn about
it when a request fails or times out. Lattica is the right place to surface this
before things break.

**Constraints:**
- Ollama exposes a REST endpoint (`/api/ps`) listing loaded models with size
  info; VRAM total is derivable from `nvidia-smi` or the Ollama response
- The fossic seed proposes `VramBudgetChanged` events on `ai-stack/models` —
  ai-stack would need to add an emitter (see R-AS-005)
- Visualization does not need millisecond precision; 5-second refresh is fine

**Adjacent project awareness:**
Any project that loads models (currently Bo via LiteLLM) contributes to VRAM
pressure. If Lattica can correlate an incoming request event from `bot/inference`
with a VRAM spike on `ai-stack/models`, that causation chain is high value.
Coordinate with Bo advocate on cross-stream causation (see R-F-003 in fossic
deposit).

**Outstanding questions:**
Should VRAM state be a fossic-subscribed stream or a direct Ollama poll? If
fossic, ai-stack needs to add instrumentation (see R-AS-005). If direct poll,
Lattica needs a polling tile primitive independent of fossic subscriptions.

---

---
id: R-AS-003
category: tile-design
priority: nice-to-have
---

## R-AS-003 — Model alias routing map

**Category:** tile-design
**Priority:** nice-to-have

**Specific need:**
A display of the LiteLLM routing table: alias name → underlying model →
backend URL. The current config has multiple aliases pointing to the same Ollama
model (e.g., `claude-sonnet-4-6` → `ollama/llama3.1`), which is intentional for
local dev but confusing at a glance. A read-only routing map tile would make the
active configuration legible without opening the yaml.

**Why it matters:**
When a consumer project (Bo, Cerebra, policy-scout) sends a request using a
specific alias, it's not obvious what model actually runs. Debugging an unexpected
response often starts with "wait, what does `bot-escalated` map to right now?"
This tile makes that answer immediate.

**Constraints:**
- LiteLLM exposes `/model/info` at its API port — the tile could poll this
- The config is static (not hot-reloaded without restart), so polling cadence
  can be slow (minutes)
- Display should distinguish: local Ollama backend vs. cloud API backend
  (currently `bot-escalated` → Anthropic, all others → Ollama)

**Adjacent project awareness:**
Bo's tier system (primary/fallback/emergency) maps to LiteLLM aliases. Bo's
advocate may want this tile surface as well — or the Bo tile could embed the
alias state rather than needing a separate ai-stack tile.

**Outstanding questions:**
None — this is a read-only display with no fossic dependency. Can be implemented
with a direct LiteLLM API poll.

---

---
id: R-AS-004
category: tile-design
priority: nice-to-have
---

## R-AS-004 — TTS activity indicator

**Category:** tile-design
**Priority:** nice-to-have

**Specific need:**
A lightweight indicator showing TTS service activity: requests per minute,
current voice/model in use, and GPU utilization for the TTS container. The
stack runs two TTS engines (Kokoro cache and openedai-speech/Piper), and it's
not obvious which is active at any time.

**Why it matters:**
TTS consumes GPU alongside Ollama. When audio generation is running, it competes
with inference. An indicator helps correlate VRAM pressure (R-AS-002) with TTS
activity specifically. Lower priority than VRAM overall, but fills out the
operational picture.

**Constraints:**
- No existing metrics endpoint for TTS — would require a request counter emitted
  to fossic or a lightweight sidecar
- Could be combined with R-AS-002 into a single GPU resource tile if that's
  architecturally simpler

**Adjacent project awareness:**
None currently. TTS is not yet consumed by other projects directly.

**Outstanding questions:**
Is there a sensible way to add TTS request telemetry without modifying the
container image? If not, this may need to wait until ai-stack adds a fossic
emitter wrapper.

---

---
id: R-AS-005
category: infrastructure
priority: must-have
---

## R-AS-005 — fossic integration point for ai-stack events

**Category:** infrastructure
**Priority:** must-have

**Specific need:**
ai-stack currently has no fossic integration. For Lattica to subscribe to
`ai-stack/models` and `ai-stack/inference` streams (as proposed in the fossic
seed), ai-stack needs a thin emitter process or sidecar that observes Ollama and
LiteLLM state changes and writes fossic events. The event vocabulary proposed
by the fossic seed is a good starting point: `ModelLoaded`, `ModelUnloaded`,
`VramBudgetChanged`, `ModelPullStarted`, `ModelPullCompleted`.

**Why it matters:**
Without a fossic emitter, R-AS-001 and R-AS-002 must be polling tiles (direct
HTTP probes to Ollama/LiteLLM) rather than fossic-subscribed tiles. Polling tiles
work, but they don't participate in cross-stream causation chains (R-F-003) and
can't be correlated with downstream consumer events. If Bo's `bot/conversation`
stream references a `ModelLoaded` event as causation, the cross-project trace
only works if ai-stack emits those events to fossic.

**Constraints:**
- The emitter does not need to be in-process — a Python sidecar polling Ollama's
  `/api/ps` every 5s and diffing model state is sufficient
- Must use the Python fossic binding (PyO3) — ai-stack's environment is Python
  (venv already present)
- This is infrastructure work in ai-stack, not Lattica work; flagged here so
  Lattica's tile design can account for whether fossic events are available

**Adjacent project awareness:**
Cross-stream causation from Bo's inference requests back to ai-stack model state
requires both sides to emit fossic events. Coordinate timing: if Bo emits first
and ai-stack emits later, the causation chain can still be reconstructed via
correlation IDs, but it's cleaner if both are emitting before Lattica tries to
render the combined view.

**Outstanding questions:**
What is the fossic Python binding's current API surface for the `append` path?
The fossic spec references PyO3 bindings, but the ai-stack advocate hasn't
confirmed whether `fossic-py` is published or only available from source.
Blocking item for implementing R-AS-005.

---

## What ai-stack doesn't need from Lattica

- Lattica is not a write surface or control plane for ai-stack — it cannot start,
  stop, or restart containers; that's `docker compose` territory
- Lattica doesn't manage model pulls or Ollama configuration
- Lattica doesn't need to own the TTS voice configuration or the LiteLLM routing
  table — those are static configs in the repo
- ai-stack does not produce domain-level events (no "conversation completed", no
  "signal evaluated") — Lattica should not treat ai-stack tiles as domain tiles

---

## Architectural note

ai-stack is the substrate for local model serving, not a consumer of application
logic. Its Lattica presence is analogous to an ops dashboard: "is the stack
healthy, what's loaded, is VRAM okay?" The tile footprint should be small — one
or two operational tiles is the right scope. The high-value cross-project signal
is VRAM pressure correlated with downstream consumer events (Bo inference
latency, Cerebra classification timing), which requires fossic integration on
both ends.

---

## Open questions for Lattica Claude

1. **Polling tiles vs. fossic subscriptions.** Before ai-stack implements a
   fossic emitter (R-AS-005), can Lattica provide operational tiles backed by
   direct HTTP polling? Or does the tile architecture assume all data flows
   through fossic subscriptions?

2. **VRAM data source.** Ollama's `/api/ps` gives loaded models and sizes but
   not raw VRAM byte counts — those come from `nvidia-smi`. Is Lattica expected
   to run shell commands, or should ai-stack normalize this into fossic events?

3. **Shared GPU resource tile.** Should the VRAM and TTS activity tiles be one
   combined "GPU resources" tile, or separate tiles that can be independently
   placed in the Lattica shell?

---

*End of ai-stack requirements deposit. Status: open for Lattica Claude review.*
