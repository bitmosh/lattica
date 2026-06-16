# Backend Prep Investigation — ai-stack / bo

**Filed by:** ai-stack-bo-claude
**Date:** 2026-06-15
**Source [API-NEW] items:** from control surface spec filed during iteration 3 review

---

## Framing: option assessment first

The outbound brief asks whether to:

- **(a) Defer all operational controls** — observability-only tile
- **(b) Build a minimal control plane** — load/unload/restart as first targets
- **(c) Some hybrid**

**Recommendation: (c) hybrid, with a concrete split.**

The key finding from this investigation is that the seven [API-NEW] items are not uniform in backend cost. Two require nothing new (client-side config). Two more need only existing Ollama HTTP API calls that Tauri's webview can reach directly today — they are marked [API-NEW] in the control surface spec but are effectively [API-EXISTS]. The remaining three genuinely require new infrastructure (management sidecar or new Tauri commands). Bundling all seven as "operational controls to defer" throws away the cheap half.

**Proposed staging:**

| Tier | Items | Why |
|---|---|---|
| Iteration 5 (low cost) | VRAM WARN, ALIAS MUTE, LOAD MODEL, UNLOAD ALL | S cost each; zero or existing backend |
| Iteration 6+ (infrastructure first) | SLEEP TIMER, RESTART, FORCE FAILOVER | M cost; need sidecar or Tauri shell-command work |

Developer priority call: ai-stack observability is "already at-par for current needs" (per outbound brief), so even the iteration 5 tier is non-urgent. This investigation is filed to support iteration 5+ planning, not to push for immediate work.

---

## Per-item analysis

### Item: VRAM WARN threshold

- **What it does:** Persist a warn threshold N% (default 80%); VRAM bar changes color when VRAM usage exceeds it
- **Backend work required:** None. The threshold is a client-side preference. Lattica's local state (Tauri's persistent storage or a local JSON config) can hold it. The VRAM data already arrives via polling (`nvidia-smi` / Ollama `/api/ps`); the color change is a pure render decision.
- **Touching:** Lattica frontend only — state store + topology renderer for the Ollama node
- **Cost estimate:** S
- **Dependencies:** None
- **Blockers:** None
- **Could ship in one pass alone?** yes
- **Notes:** This item was over-marked [API-NEW]. It needs no new API. It's a visual threshold preference stored locally. Could arguably ship in iteration 4 as client-side config if frontend-design exposes the input — but the collapsible settings panel is explicitly out of scope for iter 4, so iteration 5 is the right home.

---

### Item: ALIAS MUTE

- **What it does:** Per-alias toggle (bot-local, bot-escalated, etc.); muted aliases show dashed in topology — does NOT actually modify LiteLLM routing
- **Backend work required:** None, if interpreted as a topology view filter (which the control surface spec implies — "muted aliases show dashed in topology"). This is a client-side display preference: store which alias slugs are "muted"; topology renderer renders those edges dashed/dimmed instead of solid.
- **Touching:** Lattica frontend only — local state + topology edge renderer
- **Cost estimate:** S
- **Dependencies:** Alias list comes from LiteLLM `/v1/models` or `/model/info` polling, which is already in scope for the topology tile's data layer
- **Blockers:** None
- **Could ship in one pass alone?** yes
- **Notes:** Explicitly does NOT route LiteLLM traffic differently. If future scope wants actual routing mute (disable alias at the LiteLLM level), that's a different and larger item. This investigation addresses the visual-filter interpretation only. If the developer wants true routing mute, flag for separate spec.

---

### Item: LOAD MODEL

- **What it does:** Opens a model picker; triggers `ollama pull` if not cached, then loads model into VRAM
- **Backend work required:** Ollama already exposes all needed endpoints:
  - `GET localhost:11434/api/tags` — list models available locally (already pulled)
  - `POST localhost:11434/api/pull {"model": "<name>"}` — pull from registry if not cached
  - `POST localhost:11434/api/generate {"model": "<name>", "prompt": ""}` — loads model into VRAM (Ollama lazy-loads on first request)
  Tauri's webview can fetch `localhost:11434` without restrictions (local HTTP). No new backend is needed; the control wires to existing Ollama API directly from the frontend.
- **Touching:** Lattica frontend — model picker component + Ollama API client calls; no ai-stack files touched
- **Cost estimate:** S (the API is already there; work is frontend picker UX + fetch calls)
- **Dependencies:** Ollama must be up (guarded by STACK / Ollama node health state before enabling the button)
- **Blockers:** None. This is [API-EXISTS], not [API-NEW].
- **Could ship in one pass alone?** yes
- **Notes:** The "model picker" UX needs a design decision: show only locally-available models (from `/api/tags`), or also allow typing an Ollama registry name to pull fresh? For iteration 5, locally-available-only is simpler and avoids pull progress UX complexity. Pull-from-registry can be a separate scope item.

---

### Item: UNLOAD ALL

- **What it does:** Sends unload request to Ollama API; frees VRAM immediately
- **Backend work required:** Ollama exposes `POST /api/generate {"model": "<name>", "keep_alive": 0}` to unload a specific model from VRAM. No delete — just evicts from memory. "Unload all" means: fetch running models from `/api/ps`, then send `keep_alive: 0` for each.
  Two calls:
  1. `GET localhost:11434/api/ps` → get list of loaded models
  2. For each: `POST localhost:11434/api/generate {"model": "...", "keep_alive": 0}`
  Tauri webview can do this directly.
- **Touching:** Lattica frontend only — button action + Ollama API client
- **Cost estimate:** S
- **Dependencies:** Requires LOAD MODEL's Ollama API client to be in place (shared code — same module)
- **Blockers:** None. [API-EXISTS], not [API-NEW].
- **Could ship in one pass alone?** yes (same pass as LOAD MODEL; they share the Ollama API client module)
- **Notes:** After UNLOAD ALL completes, the VRAM gauge should update visually within the next polling cycle (~5-10s). If the polling interval is slow, consider a local optimistic update (set gauge to near-zero immediately, confirm on next poll).

---

### Item: SLEEP TIMER

- **What it does:** Auto-unload all models after N minutes of idle (0 = disabled); shows countdown
- **Backend work required:**
  - Tracking "last inference" time: Phase 2 fossic events (`LlmCallAttempt`) are the clean signal; Phase 1 requires polling Ollama `/api/ps` and watching for model activity, or relying on Bo's heartbeat for conversation activity.
  - The timer itself: a client-side interval that compares current time to last-known inference time and fires UNLOAD ALL when threshold exceeded.
  - The countdown: client-side display.
  - No ai-stack backend changes needed for a basic implementation — it's a client-side scheduler that calls the same Ollama unload API as UNLOAD ALL.
- **Touching:** Lattica frontend — timer logic + UNLOAD ALL composition
- **Cost estimate:** S for basic client-side timer; M if we want reliable cross-session persistence (timer surviving Lattica window close/reopen) or system-level enforcement (ai-stack sidecar that runs even when Lattica is not open)
- **Dependencies:** UNLOAD ALL (composes directly); Phase 2 fossic sidecar for the cleanest "last inference" signal. Works at Phase 1 via polling but with lower precision.
- **Blockers:** None for basic implementation. Phase 2 sidecar is a dependency for high-precision idle detection.
- **Could ship in one pass alone?** yes (basic client-side version); no (system-level sidecar version)
- **Notes:** The developer's use case ("keep VRAM free overnight") is well-served by the basic client-side version. System-level enforcement (timer runs even when Lattica is closed) would need the ai-stack Phase 2 sidecar to also act as a watchdog — that's a meaningful scope expansion. File as a future enhancement rather than blocking the basic version.

---

### Item: RESTART node

- **What it does:** Triggers Docker service restart for a specific degraded node (e.g., `docker compose restart ollama`)
- **Backend work required:** Tauri's frontend cannot run Docker commands directly. Options:
  1. **Tauri Rust backend command** — add a new `#[tauri::command]` in Lattica's Rust backend that shells out to `docker compose -f <path> restart <service>`. Requires modifying Lattica's `src-tauri/` (Lattica codebase work, not ai-stack).
  2. **ai-stack management sidecar** — a small Python/Bash HTTP server in ai-stack that exposes `POST /management/restart/{service}` and runs the Docker command locally. ai-stack owns this; Lattica calls it.
  3. **Tauri `shell` plugin** — Tauri v2's `tauri-plugin-shell` allows executing shell commands from the frontend directly. If already included, this reduces the Rust work.
  
  Option 2 (sidecar) is architecturally cleaner: ai-stack owns its restart logic; Lattica just makes an HTTP call. Option 1 requires Lattica to know ai-stack's docker-compose path, which is a cross-project coupling smell.
- **Touching:** Either Lattica's `src-tauri/` (option 1) or a new `management-sidecar/` in ai-stack (option 2)
- **Cost estimate:** M (either path involves new code outside the current ai-stack/bo scope; management sidecar is the cleaner M)
- **Dependencies:** None for implementation; but this is the only item that genuinely needs new infrastructure
- **Blockers:** None blocking today; needs a scoping decision on option 1 vs. option 2 before starting
- **Could ship in one pass alone?** yes (option 2 — sidecar is self-contained); no for option 1 (requires Lattica code changes)
- **Notes:** The management sidecar also becomes the natural home for FORCE FAILOVER (see below). If building, scope it to cover both. The sidecar is intentionally minimal — just HTTP endpoints that shell out to Docker and LiteLLM config operations. No database; no auth (localhost-only is the threat model for a local-first stack).

---

### Item: FORCE FAILOVER

- **What it does:** Temporarily reroutes local LiteLLM aliases to an external endpoint when Ollama is down; reverts when Ollama recovers
- **Backend work required:** LiteLLM's routing config is in `litellm/litellm-config.yaml`. Two approaches:
  1. **Manual config edit + reload:** modify the yaml to add/change the fallback upstream for the affected alias; call `POST localhost:4000/reload` to apply. LiteLLM supports runtime config reload.
  2. **LiteLLM native fallback:** LiteLLM's config supports `fallbacks` natively — if the primary model returns 503, it automatically routes to the fallback. If configured upfront, failover becomes automatic (no button needed). The button would just toggle a pre-configured fallback rule on/off.
  
  Option 2 (native fallback) is architecturally superior and makes the "button" a simple config toggle rather than a live config editor. The prerequisite: add a `fallbacks` entry to `litellm-config.yaml` pointing `bot-local → claude-haiku-4-5-20251001` (or similar) as the external fallback. Then the toggle activates/deactivates that entry.
  
  Requires either the management sidecar (see RESTART) or direct file manipulation + LiteLLM reload call.
- **Touching:** `litellm/litellm-config.yaml` (add fallback entry now); management sidecar (for toggle at runtime); or manual config edit is the Phase 1 fallback
- **Cost estimate:** M (shares sidecar infrastructure with RESTART; incremental cost on top of RESTART is S)
- **Dependencies:** RESTART's management sidecar (or Tauri shell plugin) — shares infrastructure. LiteLLM must be running for `/reload` to work.
- **Blockers:** Need to decide what the external fallback endpoint is (Anthropic direct? A specific model alias?) — that's a developer configuration decision, not a code question.
- **Could ship in one pass alone?** yes, if management sidecar exists; no otherwise
- **Notes:** The fallback entry in `litellm-config.yaml` can be added as a dormant config change now (iteration 4 or 5) without the button — just document the manual procedure. The button enables/disables it at runtime without editing the file. This is a good candidate for "add the config entry now, build the button when the sidecar exists."

---

## Cross-project dependencies

- **LOAD MODEL, UNLOAD ALL** — no cross-project deps; direct Ollama API calls from Lattica frontend
- **SLEEP TIMER** — soft dependency on ai-stack Phase 2 fossic sidecar for high-precision idle detection; basic version has no cross-project dep
- **RESTART node** — if using management sidecar (option 2): no Lattica dep; ai-stack owns the sidecar; Lattica calls it via HTTP. If using Tauri shell plugin (option 1): requires Lattica codebase change.
- **FORCE FAILOVER** — shared infrastructure with RESTART sidecar; LiteLLM config.yaml edit (ai-stack codebase); LiteLLM `/reload` endpoint (already exists at port 4000)
- **VRAM WARN, ALIAS MUTE** — no cross-project deps

---

## Recommended ordering within ai-stack/bo

### First pass (iteration 5)

1. **VRAM WARN threshold** — S, pure client-side config, zero backend
2. **ALIAS MUTE** — S, pure client-side view preference, zero backend
3. **LOAD MODEL + UNLOAD ALL** — S, one pass covering both (shared Ollama API client); these are the highest operational value items at lowest cost

Rationale: these four items cost one pass and deliver the two most frequently-needed operational actions (load a model, free VRAM) plus the two client-side config items. No new infrastructure required.

### Second pass (iteration 6)

4. **SLEEP TIMER** — basic client-side version (S), composes UNLOAD ALL
5. **management sidecar foundation** — M, scoped to RESTART first; the sidecar is the prerequisite for FORCE FAILOVER too

### Later (iteration 7+)

6. **FORCE FAILOVER** — builds on sidecar + requires developer decision on external fallback endpoint
7. **SLEEP TIMER system-level** — ai-stack watchdog version, if developer needs VRAM conservation even when Lattica is closed

---

## Notes for Lattica Claude

**Surprising findings:**

- **LOAD MODEL and UNLOAD ALL are effectively [API-EXISTS]**, not [API-NEW]. Ollama's HTTP API covers both; Tauri's webview can call localhost:11434 directly. These could be iteration 5 scope without any new backend infrastructure.
- **VRAM WARN and ALIAS MUTE need no backend at all.** They were over-marked. Both are client-side preferences that the frontend can implement with local state.

**Non-obvious complexity:**

- **RESTART via Tauri Rust backend** creates a cross-project coupling (Lattica's `src-tauri/` needs ai-stack's docker-compose path). The management sidecar pattern is the right architectural boundary — ai-stack owns its restart API. This is a scope/ownership decision, not a technical blocker.
- **FORCE FAILOVER depends on a developer configuration decision** (what's the external fallback endpoint?). Code is ready to build once that's answered; don't start implementation until the config question is answered.

**Indefinite deferral candidates:**

- None of the items are clearly "never build." RESTART and FORCE FAILOVER are M cost with management sidecar; the question is priority, not feasibility.

**Hidden cross-cutting value:**

- The **management sidecar** (needed for RESTART + FORCE FAILOVER) becomes the natural home for future ai-stack operational APIs — health probes, model management, LiteLLM config management. Building it cleanly in iteration 6 gives a reusable foundation for anything else that needs to interact with ai-stack services programmatically.
- **SLEEP TIMER** has value proportional to how often the developer runs heavy models that they forget to unload. If the RTX 4070 Super's 12 GB is routinely constrained, this pays for itself immediately. If VRAM is rarely the bottleneck, low urgency.

**Recommended iteration 5 scope signal:**

Given that observability is already at-par, the first-pass items (VRAM WARN, ALIAS MUTE, LOAD MODEL, UNLOAD ALL) are the ones worth surfacing as "these are surprisingly cheap and deliver real operational value." The remaining three can wait until the management sidecar is a prioritized scope item.
