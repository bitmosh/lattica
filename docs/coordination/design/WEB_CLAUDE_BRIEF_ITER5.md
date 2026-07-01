# Lattica — Web Claude Brief: Iteration 5 Scoping

**Date:** 2026-06-15
**Prepared by:** Lattica Claude Code
**Purpose:** Bring web Claude up to speed on Lattica's platform state, what the backend-prep investigation round surfaced, and what's in scope for iteration 5.

This document is self-contained. You do not need to read other files to understand it.

---

## 1. What Lattica Is

Lattica is a **local-first platform OS** — a single Tauri 2 desktop application (React 19 webview + Rust backend) that hosts observability tiles for a portfolio of AI and tooling projects running on one developer's machine. Think of it as a mission control dashboard: you open Lattica and see live event feeds, health states, and operational controls for all your projects in one place.

The portfolio projects are:

| Project | Language | What it does |
|---|---|---|
| **Cerebra** | Python 3.12 | Memory/knowledge agent — runs inference cycles, stores insights in SQLite |
| **LumaWeave** | TypeScript/React | Graph visualization — renders code and docs as a typed node/edge network |
| **Policy Scout** | Python 3.12 | Governance daemon — shell/package/file gate; approval workflows |
| **ai-stack / Bo** | Docker + Python | Local inference stack: Ollama + LiteLLM + Open WebUI; Bo is a live agent in Cerebra |
| **fossic** | Rust + Python + TS | Event sourcing library — the shared substrate for all event streams |

Each project is a standalone application. Lattica **does not absorb or replace** any of them. It surfaces their event streams and controls through a tile-based UI.

---

## 2. Architecture — How the Platform Works

### 2.1 The Fossic Event Substrate

Every project writes structured events to **fossic** — an append-only, content-addressed event store. Events are typed (e.g. `SignalEvaluated`, `LockdownActivated`, `PostureChanged`), carry a stream path (e.g. `cerebra/agent-trace/sess_8f88ab`), and are immutable once written.

Lattica subscribes to fossic streams and renders events in tiles. This is the primary data flow: **project → fossic → Lattica tile**.

### 2.2 Tiles

Each project gets one or more tiles in Lattica's UI. Tiles are registered in `src/registrations.tsx` via `tileSectionRegistry.register()`. A tile has:
- A live-tail event feed (newest events at top, bounded depth — always-on observability)
- An archive view (on-demand, full history, filtering)
- A per-tile chrome row (~36-44px): state pills, filter chips, `↗ OPEN` escape hatch to the project's own app, live/archive toggle

### 2.3 Read-Only Tile Pattern (current)

Through iteration 4, all tiles are **read-only observability surfaces**. They show what's happening; they do not send commands back. For anything requiring user action, the `↗ OPEN` escape hatch launches the project's own UI. This is called "Option B."

The next step (iteration 5+) is adding **operational controls** to selected tiles — buttons that send commands to the project. This requires a command channel running in the opposite direction of the event stream.

### 2.4 Command Channel Architecture (iteration 5+)

Two patterns are in play:

**Pattern A — fossic bidirectional bus (LumaWeave):** Lattica appends command events to a `lumaweave/tile/commands` stream in the shared fossic store. LumaWeave polls the stream and applies commands. Responses come back via `lumaweave/graph/events`. Architecturally clean; requires shared platform fossic store to be operational.

**Pattern B — HTTP daemon (Cerebra):** Cerebra now runs `cerebra serve` — a persistent HTTP daemon on port 7432. Lattica makes direct HTTP calls (`GET /status`, `POST /posture`, `POST /cycles`, `POST /checkpoint`). Simple and immediate; no fossic dependency for the control path.

**Pattern C — CLI subprocess (Policy Scout):** Lattica's Rust backend calls `policy-scout lockdown on --json` as a subprocess. `policy-scout` is a pipx-installed system binary. Tauri IPC is app-scoped (can't cross app boundaries); CLI is the correct integration surface.

**Pattern D — Direct Ollama HTTP (ai-stack):** Lattica's webview calls `localhost:11434` directly. Ollama's HTTP API is already there; no new backend needed for load/unload operations.

### 2.5 P-013 Protocol

Guest projects author renderer components (`.tsx` + `.css`) and write them directly to Lattica's source tree. Lattica Claude Code commits them and registers them. This is how project-specific event renderers (e.g. Cerebra's `SignalEvaluatedRenderer`) reach the tile without Lattica needing domain knowledge of each project's events.

---

## 3. What Was Built Through Iteration 4

### Delivered and live:

**Cerebra tile:**
- Live event feed for `cerebra/agent-trace/*` streams
- Payload renderers for: `SignalEvaluated`, `PredictionMade`, `OutcomeRecorded`, `ClutchDecisionMade` (all P-013, authored by Cerebra)
- event_type label fallback for unrecognized event types (renders the `event_type` string only; payload is not displayed)

**ai-stack topology tile (just landed, iter 5 prep):**
- VRAM fill gauge (polls `localhost:11434/api/ps`)
- VRAM WARN threshold slider (client-side, localStorage)
- GPU total MB input (denominator for gauge, default 12 282 MB)
- Alias mute chips (polls LiteLLM `/v1/models`, mutes stored in localStorage)
- LOAD MODEL dropdown + UNLOAD ALL button (direct Ollama HTTP)
- STACK status dot (derived from Ollama + LiteLLM health)
- TOPO / LIST view toggle, DORMANT edge toggle

**Infrastructure:**
- `tileSectionRegistry` with `register()`, `list()`, `subscribe()`
- `payloadRendererRegistry` with `registerPayloadRenderer()`, `getAllPayloadRenderers()`, `getPayloadRenderer()`
- `src/registrations.tsx` as the single wiring point for all tiles and renderers

### Not yet built (iteration 5+):
- Per-tile operational controls (HOLD toggle, New Cycle, Checkpoint, LOCK DOWN, etc.)
- Policy Scout tile
- Fossic tile
- LumaWeave tile (read-only first; controls require shared fossic store)
- Motion mute + tick
- Filter chips
- Top bar additions (event flow badge, active sessions count)
- Per-tile state pills for all projects

---

## 4. The Design System — Iteration 4 Visual Spec

A design packet (`docs/coordination/design/packets/PACKET-001.md`) was compiled from all six project design requests and handed off to claude-design for visual vocabulary work. Iteration 4 requested:

- **Top bar:** event flow badge (aggregate events/min), active sessions count, motion mute + tick control
- **Per-tile chrome:** state pills (per project), filter chips (all client-side), `↗ OPEN` escape, live/archive toggle
- **Policy Scout:** 4-state posture pill (ACTIVE / LOCKDOWN / WATCH-DOWN / STALE)
- **Fossic:** footer legend + summary row
- **Idle/standby treatments:** when a project has been silent for a configurable period

Iteration 4 design work (visual vocabulary, component specs) is **in progress** with claude-design. Iteration 5 implementation waits on those assets.

**What exists in-tree as running code:** the Cerebra signal feed tile, four Cerebra payload renderers, and the ai-stack topology tile (all per §8). **What exists as claude-design HTML mockups only (not yet in Lattica's source tree):** the Policy Scout pane, the Fossic substrate horizontal-lanes layout, the archive view, and the divisible-pane workspace shell. The mockups define the target visual vocabulary; they are not components.

---

## 5. Backend-Prep Investigation Findings

Between iterations 4 and 5, all project Claudes investigated the backend work required for their [API-NEW] control surface items. This section compiles those findings.

Full report: `docs/coordination/design/iterations/backend-prep/BACKEND_PREP_REPORT.md`

### 5.1 Cerebra

**Items investigated:** HOLD mechanism, New cycle trigger, Checkpoint

| Item | Cost | Key finding |
|---|---|---|
| Checkpoint (save-only) | **S** | `BundleDistiller`, `write_bundle`, `FossicStore.at_platform_path` all exist. New CLI command (30-50 lines). Emits `CheckpointSaved` to `cerebra/agent-trace/<session_id>`. |
| Checkpoint (restore) | M | `--continue SESSION_ID` stub exists; not implemented. Save and restore scoped apart. |
| HOLD mechanism | **S** | Daemon (`cerebra serve`) shipped post-investigation, superseding the file-sentinel approach. Now a Lattica wiring task: HOLD button + state + `POST /posture` fetch. `PostureChanged` events land on `cerebra/control` stream (explicit fossic subscribe required — not covered by `*/agent-trace/*`). |
| New cycle trigger | **S (Cerebra side)** | CLI already exists (`cerebra run-cycle`). Cerebra's contribution is an optional stdin/env alias. Bulk of work is Lattica IPC. **Mis-labeled [API-NEW] on Cerebra's side.** |

**Since filed:** Cerebra shipped `cerebra serve` — a full HTTP daemon — as a proactive response to the daemon concern latent across all three items. Endpoint spec:
- `GET /status` → `{posture, cycle_running, active_session_id, cycle_count, last_outcome}`
- `POST /posture` → `{state: "hold"|"auto"}`; emits `PostureChanged` to `cerebra/control`
- `POST /cycles` → `{config_name, goal}`; 202 accepted, async
- `POST /checkpoint` → `{}`; emits `CheckpointSaved` to `cerebra/agent-trace/<session_id>`

Discovery: `$CEREBRA_DAEMON_URL` env var, default `http://127.0.0.1:7432`. Tile degrades to **OFFLINE** (fifth agent state pill) when daemon is unreachable; 30s auto-recover poll.

**Critical fossic constraint:** `cerebra/control` is NOT covered by a `*/agent-trace/*` wildcard subscription. It requires an explicit separate subscribe. Load-bearing for Lattica's HOLD pill implementation.

**Iteration 5 Lattica wiring items (Lattica-side work, independent of Cerebra):**
- Explicit `fossic_subscribe` to `cerebra/control` stream — required before HOLD pill can render `PostureChanged` events
- `CEREBRA_DAEMON_URL` env var read on tile mount; default `http://127.0.0.1:7432`
- OFFLINE agent state pill + `GET /status` health check on mount (~500ms timeout) + 30s auto-recover poll

**Recommended order:** Checkpoint save-only → HOLD (+ cerebra/control subscribe) → New cycle trigger (when Lattica IPC approach confirmed)

**Daemon constraints flagged by Cerebra Claude (load-bearing for Track A wiring):**

- **`/status` is ephemeral; fossic is truth for state history.** The daemon returns `posture: auto`, `cycle_running: false`, `active_session_id: null` after restart even if a session was previously active. Lattica's tile should derive RUNNING/IDLE/ERROR state from the `cerebra/agent-trace/*` fossic event stream, NOT from `/status`. `/status` is only for "is daemon reachable right now" health checks.

- **No explicit CycleCompleted event from the daemon.** Cycle runtime emits events during the cycle (ClutchDecisionMade, etc.) and session open/close events, but the daemon does not emit a clean terminal "cycle just ended" fossic event. Lattica should detect cycle end via `cycle_running: false` transition on `/status` poll, not via a fossic-based completion signal.

- **Checkpoint is point-in-time snapshot, not atomic with a cycle.** A checkpoint captures whatever is committed to SQLite at that moment (through the last completed step write). In-flight step output is not flushed first. UX should not promise "checkpoint in progress" or pause-then-capture semantics — it's a snapshot, not a pause.

- **Daemon binds strictly to 127.0.0.1; no auth.** Acceptable for single-developer localhost-only use. Iteration 5 Track A wiring should not introduce any configuration that exposes the daemon to non-localhost interfaces.

---

### 5.2 LumaWeave

**Items investigated:** Source switcher, Retry, Layout freeze, Re-settle, Physics preset write

All five items share one hard blocker: **shared platform fossic store** (`~/.lattica/fossic/store.db` as the confirmed path). LumaWeave currently writes to `<project_root>/.lumaweave/fossic.db`. Until the shared store is operational, none of these items can be built.

**gwells physics bug fixed (commit `4f28c47`):** During the Re-settle audit, LumaWeave Claude discovered and fixed a silent bug in gwells: `interactionsBySourceWellType` was being populated correctly but `.get()` returned `undefined` at force-application time, causing inter-node forces to be silently skipped for all node types. The fix is in the audit commit. 12/12 validation checks pass. This is a pre-existing correctness issue, not introduced by iteration 5 work — but it means the physics engine was not operating as designed prior to this fix. Re-settle implementation should proceed against the fixed engine.

| Item | Cost | Key finding |
|---|---|---|
| Source switcher | **M** (→ S if store in place) | Command handler writes `settings.sources.active`. Blocked on shared store + `AdapterListChanged` emission. |
| Retry | **S** (once channel exists) | `settings.sources.refreshToken` increment. Bundle with source switcher. |
| Layout freeze | **S–M** | gwells `GWRuntimeState` has `paused`/`running`. New Tauri command + `LayoutFreezeChanged` event. |
| Re-settle | **S** | gwells audit complete (LumaWeave Claude). Correct implementation: new `reheat()` method — zero node velocities, optionally update `__gwellsSeedPositions`. `applyConfigOverride({ seedParams })` would scatter the graph (wrong). No `restart()` call. Position preservation confirmed feasible at S cost. |
| Physics preset write | **M** | Lowest priority. `↗ OPEN` covers the case. Recommend indefinite deferral. |
| AdapterListChanged (hidden) | **S** | Not in original spec. Source switcher dropdown can't be populated without it. New fossic event type. |

**Architecture confirmed:** Option A (fossic bidirectional bus via `lumaweave/tile/commands` stream) is correct. No custom socket server or sidecar needed. Single blocker: shared store path.

**Iteration 4 impact:** None. LumaWeave's read-only tile requires zero backend work now. All of this is iter 5+.

---

### 5.3 Policy Scout

**Items investigated:** LOCK DOWN, CLEAR LOCKDOWN, RESTART WATCH, Approval timeout, Default scope, ALLOW SESSION, ALLOW PATTERN, Rule mute

**4-state posture model confirmed correct:**
- **ACTIVE** → `daemon_status().running == True` AND lockdown not active
- **LOCKDOWN** → lockdown flag active (regardless of watch state)
- **WATCH-DOWN** → `daemon_status().running == False` AND `stale` key absent (clean stop)
- **STALE** → `daemon_status().running == False` AND `stale == True` (PID file present, process dead)

| Item | Cost | Key finding |
|---|---|---|
| LOCK DOWN | **S** | CLI complete (`lockdown on --reason`). New Tauri IPC handler only. Now has `--json` flag for programmatic use. |
| CLEAR LOCKDOWN | **S** | CLI complete. Bundle with LOCK DOWN. |
| RESTART WATCH | **S** | CLI complete (`watch stop` + `watch start`). Bundle with LOCK DOWN. |
| Approval timeout | **S–M** | Config layer confirmed in `~/.local/share/policy-scout/settings.json`. CLI (`approvals set-timeout <hours>`) now shipped. S cost. |
| Default scope | **M** | Trivial config entry; meaningless until ALLOW SESSION enforcement exists. Ship together. |
| ALLOW SESSION | **M–L** | Model/parser layer (S); enforcement = session registry + `PolicyEngine.decide()` hot-path (M–L). Session ID source and lifecycle signals need a design decision. |
| ALLOW PATTERN | **L** | Pattern store + engine hot-path + audit trail. Highest-risk item (modifies enforcement hot path). Pattern matching semantics unresolved. |
| Rule mute | **L** | No `rules` CLI exists. New CLI + mute store + engine hook + listing command. Governance implications: mutes must write audit events, TTL required. |

**Architecture clarification:** Lattica integration uses CLI subprocess (`Command::new("policy-scout")` in Lattica's `lib.rs`), not cross-app Tauri IPC. `policy-scout` is a pipx-installed system binary.

**Since filed:** LOCK DOWN, CLEAR LOCKDOWN, RESTART WATCH Tauri handlers shipped in policy-scout's own desktop app. `approvals set-timeout` shipped with config persistence. These are now **backend-ready** for Lattica integration.

**Recommended order:**
1. First pass: LOCK DOWN + CLEAR LOCKDOWN + RESTART WATCH + approval timeout (single pass, all S)
2. Second pass: ALLOW SESSION model/parser + Default scope
3. Later: ALLOW SESSION enforcement → ALLOW PATTERN → Rule mute

---

### 5.4 ai-stack / Bo

**Items investigated:** VRAM WARN, ALIAS MUTE, LOAD MODEL, UNLOAD ALL, SLEEP TIMER, RESTART node, FORCE FAILOVER

**Key finding:** Four of seven [API-NEW] items need zero new backend. Two are pure client-side preferences. Two use existing Ollama HTTP API that Lattica's webview can already reach.

| Item | Cost | Key finding |
|---|---|---|
| VRAM WARN threshold | **S** | **No backend.** Client-side threshold stored in localStorage. Over-marked [API-NEW]. |
| ALIAS MUTE | **S** | **No backend.** Visual-filter preference; does NOT modify LiteLLM routing. Over-marked [API-NEW]. |
| LOAD MODEL | **S** | **[API-EXISTS].** Ollama `/api/tags` + `/api/pull` + `/api/generate`. Tauri webview reaches localhost:11434 directly. |
| UNLOAD ALL | **S** | **[API-EXISTS].** Ollama `/api/ps` → `keep_alive: 0` per model. Bundle with LOAD MODEL. |
| SLEEP TIMER (basic) | **S** | Client-side timer + UNLOAD ALL composition. Covers primary use case (overnight VRAM conservation). |
| SLEEP TIMER (system-level) | M | ai-stack sidecar watchdog; needed if user wants VRAM freed even when Lattica is closed. Future enhancement. |
| RESTART node | **M** | Management sidecar (Option 2, recommended) or Tauri Rust backend (Option 1, coupling smell). Sidecar = ai-stack owns restart API; Lattica calls HTTP. |
| FORCE FAILOVER | **M** (incr. S on sidecar) | LiteLLM native `fallbacks` config + toggle via sidecar. External endpoint decision required from developer. Dormant config entry can be added now. |

**Since filed:** ai-stack topology tile (VRAM gauge, ALIAS MUTE, LOAD MODEL, UNLOAD ALL, STACK status dot, TOPO/LIST toggle, DORMANT edge toggle) authored via P-013 and now **live in Lattica** (`src/tiles/ai-stack/AiStackTopologyTile.tsx`).

**Recommended order:**
1. Iteration 5 (zero new infra): already shipped in tile
2. Iteration 6: SLEEP TIMER (basic) + management sidecar foundation (RESTART first)
3. Iteration 7+: FORCE FAILOVER + SLEEP TIMER system-level

---

## 6. Cross-Investigation Observations

Things visible from looking across all four investigations simultaneously:

**1. Daemon convergence in Cerebra.** Three Cerebra items independently converge on needing `cerebra serve`. Cerebra proactively shipped it. This resolves the latent daemon concern.

**2. [API-EXISTS] mislabeling.** LOAD MODEL, UNLOAD ALL, VRAM WARN, and ALIAS MUTE were all labeled [API-NEW] in the original spec. None need new backend. Four of seven ai-stack "new API" items are either client-side preferences or existing Ollama endpoints.

**3. New cycle trigger is a Lattica IPC item, not a Cerebra backend item.** The CLI exists. Cerebra's optional contribution (stdin/env goal alias) is convenience, not a blocker.

**4. Policy Scout enforcement hot path concentration.** ALLOW SESSION enforcement, ALLOW PATTERN, and Rule mute all modify `PolicyEngine.decide()`. Each adds a new table/registry the engine must consult. This is the highest-risk area in the entire backend-prep scope — all three items share the same hot path, and all three have governance implications.

**5. First-pass readiness by project:**

| Project | First-pass candidates | Readiness |
|---|---|---|
| Cerebra | Checkpoint save-only | High |
| Policy Scout | LOCK DOWN + CLEAR LOCKDOWN + RESTART WATCH + approval timeout | High (CLI already shipped) |
| ai-stack | VRAM WARN + ALIAS MUTE + LOAD MODEL + UNLOAD ALL | Already live in tile |
| LumaWeave | None | Blocked on shared fossic store |

**6. ai-stack management sidecar compound value.** Once built for RESTART, the sidecar becomes the home for FORCE FAILOVER and any future ai-stack operational APIs. One M investment covers multiple items.

---

## 7. Open Architecture Decisions

These are the unresolved questions that should be answered before or during iteration 5 planning:

| Decision | Impact | Current status |
|---|---|---|
| **gwells position-preservation behavior** | Re-settle cost: S vs M–L | Audit required (read gwells source) |
| **Shared platform fossic store path** | All LumaWeave [API-NEW] items blocked | Not yet confirmed |
| **ai-stack external failover endpoint** | FORCE FAILOVER cannot be specified without it | Developer config decision |
| **Policy Scout session ID source for human/CLI actors** | ALLOW SESSION enforcement design | No decision yet |
| **FORCE FAILOVER external fallback model** | What does LiteLLM route to when Ollama is down? | Developer config decision |

---

## 8. What's in the Tree Right Now

```
lattica/
  src/
    registrations.tsx          — tile + renderer wiring (updated this pass)
    tiles/
      cerebra-signal/          — Cerebra signal feed tile
      ai-stack/                — AI stack topology tile (just landed, P-013)
    renderers/cerebra/         — SignalEvaluated, PredictionMade, OutcomeRecorded, ClutchDecisionMade
  docs/
    coordination/
      design/
        packets/PACKET-001.md  — compiled design brief for claude-design (6 project requests)
        iterations/
          iter-4/REQUEST.md    — iteration 4 visual spec (in design)
          backend-prep/
            BACKEND_PREP_REPORT.md   — this round's compile (source for §5 above)
            cerebra/investigation.md
            lumaweave/investigation.md
            policy-scout/investigation.md
            ai-stack-bo/investigation.md
      cross-pollination/       — inbound cross-pollination files from all projects
```

---

## 9. Iteration 5 Candidate Scope

Based on the backend-prep findings, a reasonable iteration 5 scope (in rough priority order):

**Tier 1 — Zero new backend, highest ROI:**
- Policy Scout tile: LOCK DOWN + CLEAR LOCKDOWN + RESTART WATCH + posture pill (4-state) — CLI subprocess pattern; all backend ready
- Policy Scout approval timeout (S; CLI shipped)
- Cerebra OFFLINE pill + daemon health check on tile mount (S; daemon exists; Lattica wiring only)
- Cerebra Checkpoint button (S; `cerebra serve POST /checkpoint` ready)
- Cerebra HOLD toggle + `cerebra/control` stream subscribe (S; `POST /posture` on daemon; explicit `fossic_subscribe` to `cerebra/control` required — not covered by `*/agent-trace/*` wildcard)

**Tier 2 — Small backend, high value:**
- Cerebra New Cycle button (S on Cerebra side; Lattica shell-exec pattern from policy-scout)
- ai-stack SLEEP TIMER basic (S; client-side only)

**Tier 3 — Infrastructure investment required:**
- ai-stack management sidecar (M; unlocks RESTART + FORCE FAILOVER)
- LumaWeave reverse channel (M; blocked on shared fossic store — needs that decision first)
- Policy Scout ALLOW SESSION model/parser layer + default scope (M; enforcement deferred to iter 6)

**Explicitly deferred (design decisions or L cost):**
- LumaWeave source switcher (shared store blocker)
- Policy Scout ALLOW PATTERN + Rule mute (L; governance implications; design decisions needed)
- LumaWeave Re-settle (gwells audit needed first)
- LumaWeave physics preset write (indefinitely deferrable; `↗ OPEN` covers it)
- ai-stack FORCE FAILOVER (external endpoint decision needed; RESTART sidecar prerequisite)

---

## 10. Questions for Web Claude

No specific questions are being asked here — this document is provided for awareness and planning input. Areas where additional perspective would be useful:

1. **Iteration 5 scope shape:** Does the tier 1/2/3 breakdown above seem right? Is there a sequencing risk or dependency being missed?
2. **Policy Scout enforcement sequencing:** The three L-cost items (ALLOW SESSION enforcement, ALLOW PATTERN, Rule mute) all modify the same hot path. Should they be batched into a single focused iteration or staged? Staging is safer but creates a period where scope is half-wired.
3. **gwells Re-settle audit:** Is a read-only audit of gwells `src/physics/` enough to resolve the position-preservation question, or does it need an experiment?
4. **Cerebra daemon management:** `cerebra serve` is now manually started by the developer. Is there a case for Lattica Tauri layer launching it automatically on startup? Or does manual launch (with OFFLINE tile degradation + 30s recovery) cover the use case well enough?
