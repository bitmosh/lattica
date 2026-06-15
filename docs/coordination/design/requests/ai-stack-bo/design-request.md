# Design Request — ai-stack / bo

## Section 1 — Project identity

- **Project name:** ai-stack-bo (combined — Bo is a node in the ai-stack topology)
- **Filed by:** bo-claude / ai-stack-claude
- **Date:** 2026-06-15
- **Architecture note:** Per v0.3.5y update, this is NOT a per-project tile. This is
  a renderer contribution to a generalized event-feed tile + a topology view component
  contributed via P-013. Bo gets a status node within the ai-stack topology, not a
  separate tile (future iteration).

---

## Section 2 — What this project contributes visually

### Topology view (primary surface)

One visual surface: the **ai-stack topology** — a node graph showing which services
are reachable and what is currently active.

**Nodes in the topology:**

- **Ollama** — LLM serving. Key state: up/down, which models are loaded in VRAM,
  current VRAM usage (numeric + gauge). "What is the GPU doing right now."
- **LiteLLM** — proxy/router. Key state: up/down, how many aliases are live, which
  upstream each alias routes to. "Which LLM aliases are wired."
- **openedai-speech (TTS)** — audio synthesis. Key state: up/down only; no rich
  runtime state at Phase 1. "Is TTS available."
- **Open-WebUI** — web front-end. Key state: up/down only. "Is the chat UI reachable."
- **Bo (Discord bot)** — Key state: running/stopped/offline (from heartbeat JSON),
  last-seen timestamp. "Is the bot alive." Bo is visually subordinate to the ai-stack
  topology — a labeled status node, not a peer to Ollama in visual weight.

**Edges in the topology:**

- Bo → LiteLLM (bot-local alias, always present)
- LiteLLM → Ollama (for local aliases)
- LiteLLM → external (bot-escalated → Anthropic, currently dormant — show as dashed
  or grayed until active)
- Open-WebUI → Ollama (direct)

### Event renderers (Phase 2, fossic-backed — future, but design for it now)

Renderers registered via P-013 against stream_glob patterns:

- `ai-stack/gpu` → `VramBudgetChanged` — delta in VRAM usage; updates the Ollama
  node's VRAM gauge live
- `ai-stack/models` → `ModelLoaded` / `ModelUnloaded` — model appears/disappears on
  Ollama node
- `bot/lifecycle` → `BotStarted` / `BotStopped` — Bo node status transition
- `bot/conversation/*` → `LlmCallAttempt` / `ResponseGenerated` — inference pipeline
  activity; could briefly animate the Bo→LiteLLM→Ollama edge on call

---

## Section 3 — Visual priority hierarchy

**Observability-heavy project.** Weight toward ambient indicators; diagnostics open
on investigation.

- **Highest (must register at-a-glance):**
  - Each node's health state (up / down / degraded / unknown) — color-coded on node
  - Which LLMs are currently loaded in VRAM — list on Ollama node
  - Is Bo alive — status dot on Bo node
  - Overall: "the stack is healthy / something is off"

- **Medium (visible without effort):**
  - VRAM usage (gauge or fill percentage on Ollama node)
  - Number of live LiteLLM aliases
  - Bo's last-seen timestamp ("37s ago")
  - Active inference activity — subtle edge pulse when Bo calls the stack

- **Low (deep-read only; on-click or hover):**
  - Individual model names with exact VRAM footprints
  - Full LiteLLM alias table with upstream mappings
  - Config file paths and section names
  - Per-request latencies and status_tag breakdowns
  - Historical event payload detail

---

## Section 4 — What a glance should communicate

Within 2 seconds of looking:

- "The LLM stack is healthy — Ollama up, one model loaded, GPU in use"
- "Bo is running (last heartbeat recent)"
- "LiteLLM routing looks normal"

Failure-mode glances (also within 2 seconds):
- "Ollama node is red — LLM serving is down"
- "Bo node is gray/offline — bot hasn't checked in"
- "LiteLLM is up but Ollama is down — aliases are live but inference will fail"

The topology view should make the failure dependency chain legible:
Bo down ≠ Ollama down ≠ both down. Each is a distinct situation.

---

## Section 5 — What doesn't matter at-a-glance

- Individual fossic event IDs
- Exact VRAM byte counts (percentage or gauge is sufficient)
- LiteLLM alias routing table in detail (count is enough until investigation)
- Config file paths (surface only when user clicks into a node)
- Per-request latency histograms (diagnostic surface only)
- Bot-escalated path (currently dormant; show as grayed dashed edge, not prominent)

---

## Section 6 — Cross-project visual relationships

- **Bo → Ollama (via LiteLLM):** When Bo is generating a response, the
  Bo→LiteLLM→Ollama edge should briefly animate (pulse or glow). Makes
  inference activity ambient-visible without requiring the user to look at a
  log. Duration: ~duration of inference call or a brief flash on completion.

- **Bo ↔ Cerebra (future):** When `gather_context()` in Bo eventually integrates
  with Cerebra, a Bo→Cerebra edge will appear. Not in scope now; design should
  leave conceptual room for a new edge to appear without reworking the layout.

- **ai-stack ↔ Policy Scout (future):** When a model pull or alias change needs
  approval, the edge to Policy Scout might light up. Not in scope; same note.

---

## Section 7 — Current implementation (reference only — diverge encouraged)

- `~/Projects/discord-bot/bot.py` — heartbeat JSON at `~/.lattica/bo-heartbeat.json`
  (polling-based, Phase 1); fossic emitter implemented for `bot/lifecycle` and
  `bot/conversation/<channel_id>` (Phase 2, live)
- `~/Projects/ai-stack/docker-compose.yml` — service definitions; no fossic sidecar
  yet (ai-stack Phase 2 pending)
- No current visual implementation for ai-stack or bo in Lattica
- What works: Bo heartbeat JSON is polling-ready now; fossic streams for Bo are live

**Phase 1 data available today (no blockers):**
- Bo: `~/.lattica/bo-heartbeat.json` — status + last_seen; poll at 60s
- Ollama: `/api/ps` (running models) + `nvidia-smi` (VRAM) — polling endpoints
- LiteLLM: `/health` + `/model/info` — health + alias table

**Phase 2 data (fossic, ai-stack sidecar pending):**
- `ai-stack/models`, `ai-stack/gpu`, `ai-stack/inference` — live event streams
- `bot/lifecycle`, `bot/conversation/*` — live event streams (implemented)

Design should work gracefully with Phase 1 polling data and upgrade seamlessly
when Phase 2 fossic streams come online.

---

## Section 8 — Constraints (real ones only)

- **ADR-017 PayloadRendererProps** — renderer contributions via P-013 must conform
- **`--portfolio-*` design token namespace** per ADR-015
- **Monospace for event payload content** — model names, alias strings, VRAM numbers
  are data, not prose
- **Topology must degrade gracefully:** when a service is not configured or
  unreachable, show it as absent/unknown rather than erroring out. Not all ai-stack
  services are guaranteed to be running at all times.
- **Bo is a node, not a tile:** at this iteration, Bo lives within the ai-stack
  topology. It does not get its own tile. Design must not imply Bo has peer
  visual weight to Ollama unless the developer explicitly changes scope.
- **Observability-first:** the ambient view (topology with status indicators) is
  always on. Diagnostics (model details, alias table, per-request breakdown) open
  on deliberate user action.

---

## Section 9 — Open questions for frontend-design

**Topology layout:**
- How does the topology handle idle Ollama state (`models: []` — no models loaded)?
  Empty Ollama node with "idle" indicator vs. dimmed node vs. same node with empty
  VRAM gauge?
- How does a "dashed/grayed" dormant edge (bot-escalated → Anthropic) differ from
  a "solid" active edge? Is the distinction clear without color alone?
- When a new model loads (Ollama event), does the topology animate the state change
  or just update silently?

**VRAM visualization:**
- Gauge/fill bar on the Ollama node, or a numeric percentage, or color-coded
  saturation? Gauge is more ambient; number is more precise — which fits
  observability-first?
- Should the VRAM indicator change color as pressure increases (green → yellow → red
  at thresholds)? Or is that too diagnostic for an ambient surface?

**Bo inference activity:**
- Edge pulse on inference: transient (flashes for ~1s on each call) vs. persistent
  (shows "N calls in last 60s")? Transient is more alive-feeling; persistent is
  more legible at low call volume.
- During multi-attempt inference (retry / synthesis path), does the edge pulse
  differently (brighter / repeated flashes) or is the signal the same as a clean
  first-attempt response?

**Diagnostic drill-down:**
- Click on Ollama node → see model list with VRAM footprints? Opens in place vs.
  opens in a side drawer vs. deepens in place (node expands)?
- Click on LiteLLM node → shows full alias routing table. Same mechanism?
- Is there one diagnostic detail style for all nodes, or node-specific layouts?

**Phase 1 → Phase 2 transition:**
- When Phase 2 fossic streams come online, the topology upgrades from
  polling-based to event-driven updates. Should this transition be invisible to
  the user (same visual, different data source) or is there value in surfacing
  "live event stream connected"?
