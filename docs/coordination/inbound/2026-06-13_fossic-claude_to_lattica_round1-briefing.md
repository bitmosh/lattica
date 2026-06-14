# Lattica Round-1 Briefing Report

**For:** Lattica Claude (planning instance)
**From:** Claude Code investigation pass
**Date:** 2026-06-13
**Source:** `~/Projects/lattica/docs/requirements/` — all 6 project deposits + fossic
**Status:** Read-only synthesis — no files modified

---

## Section 1 — Executive Summary

Six mature-or-maturing projects filed complete deposits (requirements, capabilities, current_state). The picture that emerges is a platform that is *observation-ready* — every project except ai-stack and bo has some fossic emission already or a clear path to it — but which has not yet committed to a shell architecture. The critical finding: all tiles across all projects implicitly assume they will be React components bundled into a single Lattica/LumaWeave shell, but no deposit says this explicitly and ADR-009 has not answered it. This implicit assumption is either the right architecture or a load-bearing gap depending on what ADR-009 decides.

The five load-bearing open questions before round-1 can lock:

1. **SQLite WAL concurrent-writer safety** — determines single-store vs. per-project-store topology; blocks ai-stack and bo sidecar architecture. Needs Fossic Claude.
2. **Federated frontend hosting mechanism** — the ADR-009 question that zero deposits addressed. Must be resolved by Lattica Claude before any project builds lattica-mode components.
3. **payloadRendererRegistry contract finalization** — already proposed; needs LumaWeave Claude to create the T2 registry before any consumer project can register renderers.
4. **Tokio feature compatibility for LumaWeave Rust append** — blocks fossic integration in LumaWeave's Rust backend. Needs Fossic Claude.
5. **Cross-project causation ID convention (Cerebra ↔ policy-scout)** — specific event names and stream references needed before Phase 9 architecture is coherent.

---

## Section 2 — Cross-Project Categorization

### Convergent
Items where all relevant deposits agree and decisions can lock immediately.

- **fossic R-F-001, cerebra R-CB-001/R-CB-002, policy-scout R-PS-001, bo R-BO-002, ai-stack R-AS-001** — live stream/operational tiles as the MVP starting point. Polling-first path confirmed universally.
- **fossic R-F-006, cerebra R-CB-006, policy-scout R-PS-005** — extensible payload renderer registration needed by all three. `payloadRendererRegistry` as T2 registry locked as the shared pattern.
- **lumaweave R-LW-002 + all tile-registering projects** — LumaWeave's tile schema is the platform tile schema. No dissent; unanimous implicit acceptance.
- **R-LW-001 + cerebra/bo/ai-stack/policy-scout theming** — shared `--portfolio-*` token namespace for cross-project tile chrome. Locked.
- **bo R-BO-003, fossic R-F-003** — `walk_causation` as the cross-project causal trace API, with standard `llm_call` vocabulary extended by metadata fields. No conflict.

### Conflicting
Items where two deposits point in incompatible directions.

- **Policy-scout R-PS-002 HITL write-back vs. Lattica standalone posture.** Policy-scout's HITL approve/deny requires the policy-scout Tauri backend to be actively running. If Lattica is the "always-on" shell and policy-scout is a daemon that may be down, the HITL tile degrades silently to read-only. No deposit addresses the degraded UX. Resolution path: graceful offline state is adequate for Phase 1; but Lattica Claude must decide whether "Lattica cannot approve without policy-scout running" is acceptable long-term.
- **Single platform fossic store vs. per-project stores.** ai-stack and bo both assumed per-project isolation in their deposits but Lattica's tentative preference is a single store. No project explicitly argued for a single store. This is a real conflict of implicit assumptions — not a stated preference conflict.

### Synergistic
Items where one project's capabilities unlock another's requirements.

- **Cerebra Phase 9 → bo R-BO-005.** When Cerebra integration replaces `gather_context()`, Bo's fossic causation chain extends through `cerebra/agent-trace/*` streams. `walk_causation` on Bo's `ContextGathered` would trace into Cerebra's context retrieval, giving the cross-project "Discord → Cerebra → response" trace fossic R-F-003 specifies as a killer feature. Gated on causation ID convention (section 3d).
- **ai-stack R-AS-005 + bo R-BO-003 VRAM correlation.** If ai-stack emits `ModelLoaded` / `VramBudgetChanged` events and Bo's `LlmCallAttempt` references the same model name, Lattica can correlate Bo inference latency with VRAM state. Neither project's deposit is incompatible with this; they just need to agree on model name normalization.
- **LumaWeave fossic integration (R-LW-005) → fossic R-F-003 graph utility.** Once LumaWeave emits events on `lumaweave/graph/*`, Cerebra's future `GraphExported` driver events create an interesting cross-project causation chain (Cerebra knowledge → LumaWeave graph load → user sees visualization). This is the first real demonstration of the Reflective Twin Architecture.

### Underspecified
Items without enough information to categorize or lock.

- **Federated frontend hosting mechanism** — no project deposit addresses this. All implicitly assume React-component-bundle-into-shell; none state it.
- **fossic store path convention for ai-stack and bo** — where do their sidecar stores live? `~/.lattica/fossic/`? Per-repo? Not specified.
- **Cerebra lattica-mode frontend ownership** — who builds the cycle timeline and signal trajectory tiles? Cerebra Claude? Lattica Claude? Cross-project collaboration? Not addressed in the deposit.
- **LumaWeave gwells scope** (R-LW-006) — stay internal or extract to `packages/gwells/`? The developer decision. Not a Lattica round-1 item.

### Load-bearing for ADR-009 redraft

ADR-009 must decide the Lattica shell architecture. These items directly constrain or inform that decision:

- **Implicit single-bundle assumption** — every project assumes its React components live in the same compiled bundle as LumaWeave. If ADR-009 picks micro-frontends or sub-iframes, all six projects' approaches change. Directly blocked by this decision: R-LW-002, R-CB-006, R-PS-005, R-F-006 (renderer registration).
- **R-LW-002 (tile schema locked)** — confirms LumaWeave's `tileSectionRegistry` is the platform tile registry. ADR-009 must accept this constraint or reopen it.
- **R-F-001 (live event stream MVP)** — the first functional Lattica tile. ADR-009 must describe how this tile gets hosted; that implies a hosting decision.
- **HITL write-back (R-PS-002)** — if ADR-009 adopts an isolation model (separate webview per project), IPC routing between Lattica shell and policy-scout's Tauri backend becomes non-trivial.

---

## Section 3 — Load-Bearing Open Questions

### 3a. Single platform fossic store — SQLite WAL concurrent-writer safety

**At stake:** If multiple Python sidecars (ai-stack, bo, policy-scout each running an emitter) write to a single SQLite file concurrently, the question is safety and latency. SQLite WAL mode allows one writer at a time — multiple writers serialize. This is safe (no corruption) but may cause write-lock contention if sidecars burst simultaneously. At expected load (ai-stack: ~1 event/5s; bo: ~5–8 events per Discord message; policy-scout: per governance decision), burst overlap is unlikely. However, SQLite's default `busy_timeout` is 0ms — a concurrent write attempt with no retry returns SQLITE_BUSY immediately, which would drop events if not handled.

**What the deposits say:** ai-stack deposit implicitly assumes a fossic store exists but doesn't specify where. Bo's deposit says "fossic-py sidecar writes to fossic store" with no location. Cerebra writes to `<vault_path>/.fossic/store.db` — per-vault, which is a natural isolation boundary. The per-project-store isolation model already exists in Cerebra's pattern.

**Recommendation:** Per-project fossic stores are the safer default. Each sidecar owns its store; Lattica opens multiple read connections (SQLite readers are non-blocking with WAL). The unified timeline view in Lattica is assembled by subscribing to all stores, not by writing to one. This requires Lattica to support multiple open Store connections — a modest engineering cost compared to the concurrency risk of a shared writer store. **Fossic Claude must confirm whether `fossic-tauri` supports connecting to multiple store paths or only one.**

**Needs Fossic Claude weigh-in:** Yes — on WAL busy_timeout behavior, multi-store Lattica support, and whether the concurrency concern is addressed already.

### 3b. payloadRendererRegistry contract

**At stake:** Three projects (fossic R-F-006, cerebra R-CB-006, policy-scout R-PS-005) and Bo all need renderer extensibility. The contract shape determines the coupling between Lattica core and consumer project tile code. A contract that's too loose (only `event_type: string`) makes deduplication and stream association hard. Too tight (requires stream path) couples renderer registration to deployment topology.

**Proposed contract (from Claude Code responses this round):**
```typescript
{
  project: string;           // "cerebra" | "policy-scout" | "bo" | "fossic" | ...
  event_type: string;        // "SignalEvaluated" | "DecisionIssued" | etc.
  component: React.ComponentType<{ payload: unknown; event_id: string }>;
  label?: string;
  stream_glob?: string;      // optional hint, e.g. "cerebra/agent-trace/*"
}
```

**Versioning story:** Not addressed in any deposit. If `SignalEvaluated` payload shape changes in a future Cerebra version, the renderer that narrowed `unknown` to the old shape will silently misrender. The mitigation is: renderers should treat `unknown` defensively and fall back to JSON view for fields they don't recognize. No schema registry or versioned renderer contracts needed for Phase 1.

**Fallback for unknown event_type:** Pretty-printed JSON, as fossic R-F-006 specifies. No deposit dissented. Locked.

**Needs Fossic Claude weigh-in:** No, but LumaWeave Claude must create the registry before any consumer can register.

### 3c. Cerebra lattica-mode frontend

**At stake:** Cerebra has 22 live event types, a fully operational fossic store, and 5 open decisions blocked on Lattica round-1 synthesis. The frontend build is a real commitment — it's not a display of static data, it's a cycle lifecycle visualization over a live event stream.

**What the deposits provide:** Cerebra's capabilities.md lists 11 priority renderer targets. The minimum-viable Cerebra tile that demonstrates the full stack is the **signal trajectory plot (R-CB-002)** — it requires only the `SignalEvaluated ×6` events from a single cycle, which are always present in any cycle's fossic record. The cycle timeline (R-CB-001) is higher complexity (22 event types, horizontal layout) but higher value. The signal trajectory plot is the better starting tile because it can be built against a single stream, uses fossic's `read_state` for the 6-signal snapshot, and demonstrates the `payloadRendererRegistry` pattern for `SignalEvaluated`.

**Ownership:** Not addressed in deposits. Recommendation: Cerebra Claude provides the renderer component code for `SignalEvaluated` (it knows the payload shape); Lattica Claude / LumaWeave Claude owns the tile shell and layout.

**Needs Fossic Claude weigh-in:** No.

### 3d. Cross-project causation ID convention (Cerebra ↔ Policy Scout)

**At stake:** R-PS-004 (Cerebra→policy-scout trace) and R-BO-005 (Bo→Cerebra→response trace) both require a convention for referencing upstream events across stream boundaries. Without it, `walk_causation` terminates at the stream boundary and the cross-project trace is invisible.

**Current state:** No agreed convention. Cerebra's causation chaining is internal (within a cycle's stream); the `causation_id` field is an event_id UUID from the same store. If policy-scout references a Cerebra event as its causation, the causation_id is a UUID from a potentially different fossic store file (under the per-project-store model). `walk_causation` doesn't naturally traverse store boundaries.

**Gap:** This means cross-project causation may only work if all projects share one store. If Lattica adopts per-project stores (3a recommendation), cross-store `walk_causation` requires Lattica to stitch results from multiple store reads. Fossic's current API surface does not appear to support this.

**Recommendation for round-2:** Defer the cross-store causation rendering (fossic R-F-003 deep cross-project case) to Phase 2. For Phase 1, causation visualization is intra-project only. The convention decision (what event name Cerebra emits for context retrieval, what field Bo's `ContextGathered` uses) is still needed for Phase 9 planning, but doesn't block Phase 1 tile building. **Both Cerebra and policy-scout Claude should agree on naming before Phase 9 begins.**

**Needs Fossic Claude weigh-in:** Yes — on whether `walk_causation` can span multiple store files (critical if per-project stores are adopted).

### 3e. LumaWeave tile schema = Lattica tile schema

**What this means concretely:** The current `TileSectionEntry` shape in `tileSectionRegistry.ts` is the canonical type. All cross-project tiles register into this registry. The DV-001 deviation (missing ADR-007 layout fields, absent `commandRegistry` and `moduleRegistry`) means the registry currently lacks fields that the platform ADRs assumed would exist.

**Required fields for cross-project registrations:** Not yet documented. LumaWeave Claude was asked to document them. Until that answer arrives, no other project should write tile registration code. The minimum required fields are likely: `id`, `anchor` (TileAnchor), `defaultVisible`, `component`.

**ADR-007 multi-pass layout fields:** Not in current `TileSectionEntry`. The question is whether they enter the schema in Phase 1 or later. Recommendation: they enter Phase 1 — otherwise tiles registered without layout fields will need a migration when ADR-007 fields are added. Better to define the full schema upfront and let Phase 1 tiles populate what they know.

**Schema versioning:** Not addressed in any deposit. The settings schema (currently v95) handles LumaWeave settings. The tile registration schema is a TypeScript type, not a versioned document — changes are compile-time breaking, which is appropriate for Phase 1.

### 3f. Per-project polling intervals

**Proposed:** ai-stack ~10s for health probes, ~5s for VRAM. Bo heartbeat file every 60s. Policy-scout status poll ~5–10s.

**Contention concern:** With per-project fossic stores and SQLite WAL readers being non-blocking, there is no read contention concern even if all polling consumers read at the same cadence. The concern is write contention (see 3a) not read contention.

**Jitter convention:** Not needed for Phase 1. At 3–4 simultaneous 10-second polling sources, collision probability is low. Add jitter in Phase 2 if instrumentation shows contention.

### 3g. Federated frontend hosting mechanism

**This is the ADR-009 question.** No deposit addressed it. The implicit model in all six deposits is: project tile components are React components imported and bundled into the Lattica/LumaWeave shell. This is a **single-bundle, compile-time composition** model.

The alternative models that could have been proposed (micro-frontends with module federation, sub-iframes, server-rendered sections, runtime-loaded plugin bundles) appear nowhere in any deposit. Either the projects all independently converged on compile-time bundling, or they deferred the question to Lattica Claude.

**What this means for ADR-009:** If Lattica Claude accepts the implicit single-bundle model, ADR-009 can be short and confirmatory. If Lattica Claude wants to evaluate runtime loading or micro-frontend isolation, it must make that decision before any project writes a React tile component (because the API for registering a component differs significantly between bundled imports and runtime loading).

**Recommendation:** Accept the single-bundle model for Phase 0–2. The platform has one developer, a monorepo (planned), and a TypeScript-first stack. Micro-frontends add toolchain complexity with no benefit at this scale. ADR-009 should lock single-bundle + `tileSectionRegistry` as the hosting mechanism and note that runtime loading can be revisited in Phase 4+ when the platform has more modules.

---

## Section 4 — Per-Project Digest

### fossic

**Info quality:** Excellent

**One-sentence shape:** The event sourcing substrate that makes all cross-project observability possible; Lattica is its primary read consumer.

**Top 3 requirements:**
- R-F-001: Live event stream view — the MVP fossic tile; lowest-complexity first demonstration of the shell pattern
- R-F-003: Cross-project causation DAG — the platform's killer feature; requires resolving the multi-store span question first
- R-F-006: Type-aware payload rendering — prerequisite for R-F-001 being useful; unblocked by `payloadRendererRegistry` creation

**Critical capabilities:**
- `Store.append / read_state / read_state_at_version / walk_causation / subscribe` — full v1 API live
- `SubscriptionMode::PostCommit` with `SubscriptionHandle::is_degraded()` — degraded subscription detection
- `fossic-tauri`: 11 Tauri commands; notably `fossic_append` is NOT a command (Rust-only path)
- `fossic-py`: PyO3 binding, maturin build, available from source at RC1

**Current-state notes:**
- v1 API stable; 158/158 tests passing
- fossic-node (napi-rs) built but napi npm dep not yet approved — blocks JS-side reads
- No multi-store query API confirmed

**Open relay items:**
- SQLite WAL concurrent-writer safety (blocking for platform store topology)
- Tokio features compatibility with Tauri 2 (`["rt", "time"]` only — does fossic's append path need more?)
- `walk_causation` cross-store span support (blocking for cross-project R-F-003 in Phase 2)
- fossic-node napi dep package name for developer approval

**Round-2 likelihood:** Iteration likely on multi-store architecture once 3a is answered.

---

### lumaweave

**Info quality:** Very complete

**One-sentence shape:** The visual shell — graph rendering engine, tile system, theme tokens; the platform's primary UI host.

**Top 3 requirements:**
- R-LW-005: fossic crate for Rust-side append — locks once Tokio features confirmed; unlocks the 5 proposed graph event types
- R-LW-001: Token namespace — `--portfolio-*` locked; unblocks all cross-project tile theming
- R-LW-002: Tile schema direction — locked as LumaWeave-canonical; unblocks all project tile registrations

**Critical capabilities:**
- T2 registry pattern (`register()` + `subscribe()`) — the extensibility primitive that all Lattica integration points will use
- `tileSectionRegistry` (12 entries), `sourceAdapterRegistry` (14 adapters), `themeTargetRegistry` (24 targets) — live
- 80+ Playwright E2E tests, `__lwTauriMock` shim for `invoke()` — test infrastructure available
- `transport: "sibling-module"` source adapter coupling type — designed for cross-project module coupling

**Current-state notes:**
- v0.19.0, active gwells physics work on branch `feat/gwells-c10a-structural-resolver`
- DV-001: `commandRegistry` and `moduleRegistry` absent (capabilities.md claims them); `tileSectionRegistry` missing ADR-007 layout fields; `sourceAdapterRegistry` missing `transport: "live"` dimension
- fossic integration not started; Cargo.toml dep approval required

**Open relay items:**
- DV-001 registry gaps — LumaWeave Claude needs to confirm existence of `commandRegistry`, `moduleRegistry`; clarify ADR-007 field status
- `TileSectionEntry` required fields for cross-project registrations — documentation request pending
- `payloadRendererRegistry` T2 registry creation — action item for LumaWeave Claude (unblocks 3 other projects)

**Round-2 likelihood:** Single iteration on tile schema fields after DV-001 is resolved.

---

### cerebra

**Info quality:** Excellent

**One-sentence shape:** The cognitive memory/reasoning layer; most mature Python project; fossic integration already live and producing 22 event types.

**Top 3 requirements:**
- R-CB-001: Cycle timeline tile — minimum-viable cognitive visualization; requires subscribing to `cerebra/agent-trace/<cycle_id>`
- R-CB-002: Signal trajectory plot — simpler than R-CB-001, better starting tile; 6 `SignalEvaluated` events per cycle
- R-CB-006: Payload renderer registration — blocked on `payloadRendererRegistry` creation; 11 priority renderer targets ready

**Critical capabilities:**
- 22 live event types on `cerebra/agent-trace/<cycle_id>` — fully operational fossic store at `<vault_path>/.fossic/store.db`
- 6 cognitive signals (COHERENCE, GROUNDEDNESS, etc.) with calibrated prediction pipeline
- CatalystEngine (Phase 9, v0.3.7), CycleRuntime, ClutchEngine all passing all tests
- Fossic store readable by Lattica via `fossic-tauri` IPC today — no wait required

**Current-state notes:**
- v0.3.7, all tests passing; no CLI entry point for `run-cycle` (library only)
- Lattice stream vocabulary (`cerebra/lattice/*`) is live but vocabulary addendum is incomplete — R-CB-007 is Phase 10
- No Tauri command or HTTP endpoint for Lattica to query Cerebra data — all access via fossic store

**Open relay items:**
- Cross-project causation ID convention with policy-scout (facilitator: Lattica Claude)
- Specific Cerebra event name for context retrieval (needed for Bo Phase 9 wiring)
- Lattice vocabulary publication — Cerebra Phase 10, no action for Lattica now

**Round-2 likelihood:** None for tile design; one round expected on causation ID convention.

---

### policy-scout

**Info quality:** Good

**One-sentence shape:** The governance daemon with 27 live Tauri IPC handlers; write-back (HITL approve/deny) requires its Tauri backend to be running.

**Top 3 requirements:**
- R-PS-002: HITL approval widget with write-back — highest operational value; routes to existing `approve_request` / `deny_request` IPC commands
- R-PS-001: Governance pipeline tile — requires fossic integration for event history; polling IPC for live status in Phase 1
- R-PS-006: fossic bridge adapter — policy-scout owns new-event emitter; Lattica owns historical read adapter

**Critical capabilities:**
- 27 Tauri IPC handlers: `list_approvals`, `approve_request`, `deny_request`, `check_command`, `run_sandbox_install` — all live
- 70+ audit event types in the CLI audit stream
- Policy simulation, supply chain sweep — read-only from Lattica
- No streaming/push — all polling; no scan commands or audit-chain-verify as Tauri handlers

**Current-state notes:**
- v0.3.6, Python CLI mature; 9 views functional in Tauri app
- Two Tauri handler gaps: scan commands and audit chain verify (CLI exists, no Tauri)
- fossic integration not started; IPC-ready for Lattica reads today

**Open relay items:**
- Scan commands / audit chain verify Tauri handler status — clarification request pending
- Safe polling interval for lockdown/watch status tile — clarification request pending
- Causation ID convention coordination with Cerebra

**Round-2 likelihood:** One iteration on scan command handler gap; one on causation convention.

---

### ai-stack

**Info quality:** Very complete

**One-sentence shape:** GPU-backed Docker Compose infrastructure (Ollama, LiteLLM, TTS, Open-WebUI); Lattica's presence here is operational visibility, not domain events.

**Top 3 requirements:**
- R-AS-001: Service health tile — HTTP probe each service; achievable today with polling, no fossic required
- R-AS-002: VRAM pressure visualization — Ollama `/api/ps` + `nvidia-smi`; combined with R-AS-004 into one GPU resources tile
- R-AS-005: fossic-py sidecar — Python sidecar polling Ollama and diffing model state; requires fossic-py approval; Phase 2 item

**Critical capabilities:**
- Ollama `/api/ps` (loaded models + VRAM footprint), `/api/tags` (available models) — live, HTTP polled
- LiteLLM `/health`, `/model/info` (alias routing table) — live, HTTP polled
- `.venv` present; fossic-py installable once approved
- `bot-escalated` → Anthropic is the only cloud-backed alias; all others → local Ollama

**Current-state notes:**
- All four services running, GPU-backed
- No fossic integration; no push mechanism; no TTS metrics endpoint
- VRAM total not reported by Ollama natively — `nvidia-smi` required

**Open relay items:**
- fossic store path convention (where does the sidecar write?) — awaits 3a answer
- `nvidia-smi` availability confirmation — clarification request pending

**Round-2 likelihood:** None for Phase 1 polling tiles; one round expected when sidecar is implemented.

---

### bo

**Info quality:** Very complete

**One-sentence shape:** Discord bot with a 3-attempt inference retry pipeline; no fossic integration today; operational visibility requires either a heartbeat file (Phase 1 interim) or fossic lifecycle events (Phase 2).

**Top 3 requirements:**
- R-BO-001: Bot operational status tile — interim: heartbeat file; Phase 2: fossic `BotStarted`/`BotStopped` lifecycle events
- R-BO-002: Conversation metadata timeline — metadata only (latency, status tag, context size); requires fossic events for history
- R-BO-003: Causation chain for retry/synthesis pipeline — `llm_call` standard vocabulary with `attempt_number`, `has_nudge`, `is_synthesis` metadata fields

**Critical capabilities:**
- 3-attempt pipeline: first → retry+nudge → synthesis-from-thinking; `status_tag` in Discord reply is the observable signal
- `gather_context()` at `bot.py:252` is the explicit Cerebra integration seam — no refactoring needed
- Privacy posture: metadata only by default, content opt-in; already aligned with Lattica's posture

**Current-state notes:**
- Phase 0; Python process, no supervisor, no HTTP server
- `bot-escalated` alias defined in LiteLLM but not yet used — shadow mode only
- No fossic integration; `.venv` present; fossic-py approval required

**Open relay items:**
- Heartbeat file path convention (e.g., `~/.lattica/bo-heartbeat.json`) — proposed, not confirmed
- fossic store path (per-project vs. shared) — awaits 3a answer
- SIGTERM handler — implement during fossic integration pass

**Round-2 likelihood:** One iteration when fossic-py is approved and sidecar is built.

---

## Section 5 — Decisions Made This Round, Ready to Lock

Each entry: decision, what it unblocks, needs ADR?

1. **Polling-first tiles (ai-stack, bo).**
   What it unblocks: ai-stack R-AS-001 (polling health tile can be built now), R-AS-002 (VRAM tile can be built now), bo R-BO-001 (heartbeat file interim can be built now). No fossic dependency for Phase 1 ai-stack or bo tiles.
   Needs ADR? No — operational decision, not architectural.

2. **`--portfolio-*` shared token namespace; `--lw-*` stays LumaWeave-internal.**
   What it unblocks: R-LW-001 locked, all cross-project tile theming can proceed once `portfolio-tokens.css` exists.
   Needs ADR? Yes — **ADR-L-001: Platform Design Token Namespace** (cross-module visual consistency contract).

3. **LumaWeave tile schema = Lattica tile schema (`tileSectionRegistry`).**
   What it unblocks: R-LW-002 locked; all projects can write tile registration code once required fields are documented; `payloadRendererRegistry` can be added alongside.
   Needs ADR? Yes — **ADR-L-002: Tile Registration Contract** (defines the canonical TileSectionEntry shape, extensibility rules, and field versioning policy).

4. **`fossic` Rust core (not `fossic-tauri`) for LumaWeave Rust-side append.**
   What it unblocks: R-LW-005 path is clear; pending only Cargo.toml dev approval and Tokio features confirmation.
   Needs ADR? No — implementation detail. Document in LumaWeave `CLAUDE.md`.

5. **`payloadRendererRegistry` as T2 registry in LumaWeave control-plane.**
   What it unblocks: fossic R-F-006 (locked once registry exists), cerebra R-CB-006 (locked), policy-scout R-PS-005 (locked), bo thinking-trace renderer (unlocked).
   Needs ADR? Yes — **ADR-L-003: Payload Renderer Registry** (defines registration contract, versioning story for payload shapes, fallback JSON view policy).

6. **Policy-scout owns its fossic emitter; Lattica owns historical read adapter.**
   What it unblocks: R-PS-006 path is clear; policy-scout Claude can implement sidecar once fossic-py approved.
   Needs ADR? No — ownership split, not architecture.

7. **`bot/conversation/<channel_id>` per-channel streams for bo.**
   What it unblocks: R-BO-003 stream naming is stable; Bo Claude can implement emitter against this convention.
   Needs ADR? No.

8. **Single platform fossic store (tentative, pending WAL safety confirmation).**
   What it unblocks: If confirmed — simpler Lattica multi-stream subscription architecture. If not confirmed — per-project stores, and Lattica needs multi-store API.
   Needs ADR? Yes — **ADR-L-004: Platform Fossic Store Topology** (must lock before any sidecar is built). **Not lockable until Fossic Claude answers 3a.**

9. **Platform-level canonical/live diff layer; not LumaWeave-internal (R-LW-007).**
   What it unblocks: LumaWeave does not over-engineer for dual-graph rendering in Phase 1. Deferred to Phase 3+.
   Needs ADR? This is the Reflective Twin Architecture question — it belongs in an update to ADR-001 or a new **ADR-L-005: Canonical vs. Live Graph Layer Ownership**.

10. **R-F-001 (live event stream view) as MVP starting tile.**
    What it unblocks: Implementation sequence is clear; R-F-006 renderers can be designed alongside.
    Needs ADR? No.

---

## Section 6 — Relay Items Needing Lattica Claude Action

1. **[ADR-009]** Decide federated frontend hosting mechanism (single-bundle vs. runtime loading). All projects are waiting on this before building lattica-mode components.
2. **[LumaWeave]** Create `payloadRendererRegistry` T2 registry in control-plane. Unblocks 4 projects.
3. **[LumaWeave]** Document `TileSectionEntry` required fields for cross-project tile registrations. Unblocks all project tile code.
4. **[LumaWeave]** Create `src/styles/portfolio-tokens.css` with initial shared `--portfolio-*` token set. Unblocks cross-project theming.
5. **[LumaWeave]** Resolve DV-001: confirm or deny `commandRegistry`, `moduleRegistry` existence; clarify ADR-007 field status in `TileSectionEntry`.
6. **[fossic store topology]** After receiving Fossic Claude's WAL answer, decide single vs. per-project store and draft ADR-L-004.
7. **[cerebra + policy-scout]** Facilitate causation ID convention agreement — specific Cerebra event name for context retrieval; specific field Bo's `ContextGathered` references.
8. **[cerebra]** Decide who owns Cerebra's lattica-mode tile component code (Cerebra Claude or Lattica Claude with Cerebra Claude providing event specs).
9. **[ADR-009 draft]** Accept or reject the implicit single-bundle hosting model surfaced in this report.
10. **[ADRs]** Draft ADR-L-001 through ADR-L-005 as a round-1 output after ADR-009 is resolved.

---

## Section 7 — What Fossic Claude Needs to Weigh In On

1. **SQLite WAL concurrent-writer behavior** — is a shared fossic store safe for 3–4 Python sidecar processes writing simultaneously at low volume? What is fossic's `busy_timeout` setting, and does fossic handle SQLITE_BUSY with retry?
2. **Multi-store Lattica support** — does `fossic-tauri` support opening connections to multiple store files simultaneously, or is it a single-store-per-Tauri-app constraint? This determines whether per-project stores are architecturally viable for the Lattica shell.
3. **`walk_causation` cross-store traversal** — can `walk_causation` follow a `causation_id` that references an event in a different store file? If no, cross-project causation (fossic R-F-003 deep case) requires the single-store model.
4. **Tokio features compatibility with LumaWeave** — does fossic's Rust crate append path require more than `["rt", "time"]` Tokio features? If yes, is there a sync append path that avoids the Tokio runtime conflict with Tauri 2?
5. **fossic-node napi package** — exact npm package name and version for developer approval. Blocking for JS-side fossic reads from LumaWeave frontend.
6. **Queue introspection API documentation** — `is_degraded()` is confirmed; document the full introspection surface so R-F-004 can be implemented.

---

## Section 8 — Surprises and Red Flags

1. **No deposit addressed federated frontend hosting.** This is not a minor gap — it is the ADR-009 question, and six projects built their requirements against an implicit assumption that was never confirmed. Lattica Claude must decide and communicate this immediately, before any project writes a lattica-mode React component.

2. **DV-001: capabilities.md vs. on-disk mismatch in LumaWeave.** The capabilities.md says `commandRegistry` is a live T2 registry. The reality check found it absent from the codebase. This is an inconsistency in LumaWeave's own deposit — not a Lattica synthesis error. Lattica Claude should not assume `commandRegistry` exists until LumaWeave Claude confirms it.

3. **fossic-py at PyO3 v1.0.0-rc.1 in production.** Cerebra (v0.3.7) uses a release candidate of the fossic-py binding. RC versions are not stable API contracts. If fossic-py bumps to v1.0.0 final with breaking changes, Cerebra's store wrapper breaks silently. Flag to fossic Claude: publish a stable v1.0.0 or pin the RC explicitly in all consumers' lockfiles.

4. **Policy-scout HITL write-back requires policy-scout Tauri app to be running.** The current architecture makes Lattica's governance approval tile non-functional if policy-scout is offline. There is no queued approval mechanism, no fallback. For a single-developer workflow this is probably acceptable, but it should be explicit in the architecture — not a discovered limitation.

5. **LiteLLM alias table includes `claude-sonnet-4-6 → llama3.1` (local Ollama).** Any project that calls `claude-sonnet-4-6` expecting Claude 4 behavior will get llama3.1. This is a deliberate local dev alias but creates a subtle discrepancy: Lattica's model alias tile (R-AS-003) will correctly show the mapping, which may surprise project Claudes who assumed `claude-sonnet-4-6` was always Anthropic.

6. **Bo has no process supervisor.** A crash means Bo goes offline and stays offline until manually restarted. The heartbeat file workaround handles detection but not recovery. This is a known gap (listed in bo's current_state.md) but Lattica's operational health tile will show "offline" with no recovery path available from the Lattica UI.

7. **Cerebra's `run-cycle` CLI is library-only.** Lattica cannot trigger a Cerebra cycle from its UI today (no CLI, no Tauri command, no HTTP endpoint). The fossic store is readable but Lattica is a pure observer — it cannot initiate cognitive cycles. This is by design but limits the "platform OS" framing for Phase 1.

---

## Section 9 — Open Questions Back to Me

1. **ADR-009 draft scope:** Is the expectation that ADR-009 describes only the frontend hosting mechanism, or also the IPC topology, Rust plugin architecture, and cross-module communication patterns? The deposits don't give me enough to draft the IPC/Rust sections.

2. **`lattica_round1.md` format:** Should this be a single file synthesizing all six projects' responses, or one file per project? The deposits use per-project `responses.md` files; a separate `lattica_round1.md` implies a different purpose — maybe a synthesis document for the developer rather than a relay to project advocates?

3. **ADR-009 input from the developer:** The developer confirmed GitHub repo at bitmosh/lattica and has been the approver for all git operations. Has the developer expressed a preference on the shell architecture that isn't captured in any of the docs I can see? If there's a prior conversation or planning document that constrains ADR-009, I'd benefit from knowing the reference.

---

*End of briefing report.*
*File path: `/tmp/lattica_round1_briefing.md`*
