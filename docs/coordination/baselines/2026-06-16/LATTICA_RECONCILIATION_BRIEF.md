# Lattica Reconciliation Brief

**Filed by:** lattica-claude (recompile pass v0.3.5s)
**Audience:** Lattica Claude (self-briefing), developer, web-claude
**Purpose:** Bring Lattica up to speed on what landed during reconciliation rounds. Reconciliation involved Cerebra, LumaWeave, Policy Scout, ai-stack/Bo, and Fossic Claudes iterating against each other's files across three cross-read rounds; Lattica was running v0.3.5u + v0.3.5t in parallel and is outside that loop. This brief is the bridging document.
**Status:** Brief — synthesis for Lattica's awareness. Canonical reconciled state is in `PLATFORM_BASELINE_2026-06-16_v2.md`.

---

## Why this brief exists

Substantial new content emerged during reconciliation that has no predecessor in v1 or any single original baseline:

- Cross-project architectural decisions reached convergence
- Several v1 conflicts got resolved
- One critical gap was surfaced that v1 missed entirely
- A D.X referencing convention used throughout reconciliation is unfamiliar to Lattica
- A federation interview agenda crystallized across all five projects
- New concepts (`GraphSnapshotAvailable`, witness model scope correction, two-case causation model) emerged that aren't in v1 at all

Lattica needs to internalize these before:
- Continuing Track B work (Policy Scout tile, LumaWeave tile, Fossic tile)
- Drafting the next claude-design iteration
- Participating meaningfully in federation interviews

---

## Section 1 — What changed since v1

### 1.1 New architectural decisions that emerged from reconciliation

**D.3 stream naming convention (conditional strip rule)**
Emerged from Cerebra's reconciliation (D.3); not in v1; not in any single original baseline. The problem: fossic's relay pseudocode uses `f"{source_prefix}/{event.stream_id}"` for hub stream naming. For Cerebra, this produces `"cerebra/cerebra/agent-trace/<session_id>"` — redundant double-prefix. Same for LumaWeave (`"lumaweave/lumaweave/graph/events"`) and ai-stack (`"ai-stack/ai-stack/gpu"`).

Cerebra's proposed resolution: if `stream_id.startswith(f"{source_prefix}/")`, use `stream_id` directly on the hub; otherwise prepend `f"{source_prefix}/"`. Applied to all three: streams pass through unchanged (`cerebra/agent-trace/<session_id>`, `lumaweave/graph/events`, `ai-stack/gpu`). Policy Scout's streams (`policy-scout/audit/<request_id>`) already start with `policy-scout/` and also pass through cleanly.

Endorsement state: **3 of 5 explicit endorsements** (Cerebra proposer, ai-stack/Bo Round 2 explicit, LumaWeave C.8 explicit). Policy Scout implicit alignment. Fossic: leading proposal, pending ratification. **Lattica has not taken a position — federation interview will need it.**

**Witness model framing (comprehensively corrected)**
Earlier framing "Bo reads from cerebra's witness model / cerebra is the all-seeing aggregator" was explicitly retracted by ai-stack/Bo in Round 3. Confirmed by Cerebra D.5, LumaWeave C.6, Policy Scout B-update, and Fossic Item 2.

Correct framing: the witness model is **Cerebra-internal infrastructure only**, scoped to Phase 15+. It enriches Cerebra's own cognitive cycle execution by projecting relevant hub events into Cerebra's memory layer. Bo never queries the witness model directly.

Bo's read paths under federation:
1. Cognitive cycle state → Cerebra daemon HTTP `GET /status` (posture, cycle_running, active_session_id, last_outcome)
2. Platform-wide state → Hub fossic store directly

The relay passes for Policy Scout and ai-stack are prerequisites for the witness model to have useful platform context — not because Bo queries it, but because the cognitive cycle itself benefits from knowing current platform state (lockdown status, GPU headroom, service health). Minimum hub coverage Cerebra needs projected: `{LockdownActivated, LockdownDeactivated, ApprovalRequested}` and `{VramBudgetChanged, ModelLoaded, ModelUnloaded}`.

**GraphSnapshotAvailable as replacement for graph.json file-artifact consumption**
The Cerebra/LumaWeave CerebraReadAdapter conflict (flagged in v1 §6.3) is now fully resolved. Both projects confirmed independently that the adapter was never built and file-polling is the wrong direction.

Agreed federation target: Cerebra emits a `GraphSnapshotAvailable` hub event with snapshot reference; LumaWeave receives it and loads the graph. `.cerebra/graph.json` file continues to be written by Cerebra on every ingest but becomes an implementation detail, not the coordination mechanism.

LumaWeave's consumer requirements (filed as formal spec input — B.1): snapshot reference (file path or content hash), `lineage_id` or equivalent graph identity field, and enough context to determine whether to trigger a load. Event schema and stream target (`cerebra/lattice/<lineage_id>` vs. `cerebra/graph/<lineage_id>`) are open for the federation interview.

**Two-case causation model**
Fossic formalized in Item 1; adopted by all five projects. Prior framing "cross-store causal traversal always requires going back to originating store" is more precisely:

- **Case 1:** Hub event → local event NOT relayed → `walk_causation` fails; consumer must use `source_store` indexed_tag to route back to originating store.
- **Case 2:** Hub event → local event that WAS relayed → hub-side `walk_causation` works because the hub has the target event.

The Policy Scout→Cerebra chain (`CommandRequested.upstream_causation_id` → `ActionProposed`) is case 2 — hub-traversable once both projects relay. The future `GraphSnapshotAvailable → SourceLoaded` chain is also case 2 — hub-traversable without any back-reference logic.

**Relay agent process model (leading direction)**
Cerebra D.7 #2 stated preference: standalone Python process (option a) — a small `cerebra-relay.py` with `RelayConfig` pointing `.fossic/store.db` → `~/.lattica/fossic/store.db`. ai-stack/Bo aligned. Not ratified; pending federation interview.

**Bo and ai-stack are distinct repositories**
v1's single-row "ai-stack sidecar + Bo" entry in the asymmetric maturity table conflates two separate codebases: ai-stack sidecar at `/home/boop/Projects/ai-stack/fossic_sidecar.py` and Bo at `/home/boop/Projects/discord-bot/bot.py`. Both write to `~/.lattica/fossic/store.db` today; under federation they would share one local store (co-resident, tightly coupled at service level) with a single relay agent carrying two filter rules.

### 1.2 v1 baseline conflicts that got resolved

**CerebraReadAdapter conflict (v1 §6.3) — CLOSED**
Both Cerebra and LumaWeave confirmed: the adapter was never built, never in progress, not stale, not in a subdirectory. LumaWeave: "does not exist in any form." Cerebra: "I was describing the intended consumption relationship, not confirmed current state." Resolution: GraphSnapshotAvailable hub event design replaces file-polling entirely. File-polling model should not appear in any future federation design document as a live dependency.

**Cerebra daemon-tile consumption version drift (v1 §6) — CLOSED**
Cerebra's reconciliation confirms: 7432 is the correct default port (verified against `cerebra/cli/daemon.py:290`). Lattica's v0.3.5u wiring at 7432 is correct. The baseline §3 statement "not yet consumed by any Lattica tile" was a timing artifact of baseline filing before v0.3.5u committed.

**Policy Scout Tauri response shape wrapper (v1 §6.2) — CLARIFIED**
Policy Scout explicitly answered: the two patterns should stay separate. Policy Scout's outer `CliJsonResponse` wrapper (`{ok, exit_code, data, error, stderr_summary}`) serves policy-scout's own UI diagnostic needs; Lattica's inner-JSON parsing is the correct integration pattern for Lattica's use case. Mark this non-blocking; document in Track B spec so future tile authors don't accidentally add wrapper parsing.

### 1.3 Things Lattica didn't know

**CerebraSignalTile fossic subscription is currently dark** (surfaced by Fossic reconciliation B, confirmed by Cerebra Item 2)
This is the most actionable item for Lattica. CerebraSignalTile subscribes to `cerebra/agent-trace/*` on the shared `~/.lattica/fossic/store.db`. But Cerebra writes all cycle events to its local `.fossic/store.db`. These are **different paths**. The tile's fossic subscription sees zero Cerebra cycle events today. This is not a wiring bug — it's the expected state before migration or relay. The daemon HTTP polling (port 7432) works correctly (unrelated path). The fossic subscription path is dark until either (a) Cerebra migrates to the shared store, or (b) a relay agent bridges them. This was not explicit in v1.

**The "settled log" pattern and D.X referencing convention**
All five projects independently developed settled item logs during reconciliation. Fossic's settled log has 34 items. These are formal cross-project agreements with attribution. The `D.X` convention refers to specific items in Cerebra's D-section of their reconciliation (D.3 = stream naming, D.5 = witness model, D.7 = relay agent design questions, etc.). v2 baseline explains this inline.

**Per-project indexed_tags field specifications**
Fossic reconciliation (Item 4) established indexed_tags adoption as a prerequisite for the relay pass for all emitting projects. Fields agreed:
- Cerebra: `{session_id, cycle_id, signal_name}` on cycle events
- LumaWeave: `{adapter_id, source_key}` on source events; `{dialect_id}` on GraphLayoutSettled
- Policy Scout: `{request_id, risk_band, decision}` on governance events; `{request_id, approval_id}` on approval events
- ai-stack: `{model_name}` on model lifecycle; `{warn: bool}` on VramBudgetChanged
These must be implemented per project before their relay pass.

**Lattica's hub role in federation target**
The "consumer only" label in v1's asymmetric maturity table describes Lattica's *current* fossic usage. In the federation target architecture, Lattica's hub store is BOTH an ingestion point (relay agents from all projects append to it) AND a read substrate (tiles subscribe from it). Lattica is not "consumer only" in the target — it's the hub.

**Snapshot cold-start as platform-wide pattern**
Three canonical cases all solvable with existing fossic snapshot API: (1) ai-stack tile switching from direct Ollama polling to hub subscription — up to 10s gap; snapshot on `ai-stack/gpu` seeds immediate state; (2) LumaWeave tile subscribing when LumaWeave is already in loaded state — blank until user triggers source load; snapshot at last `SourceLoaded` seeds state; (3) Policy Scout approval queue on first tile subscribe — blank until next approval event; snapshot at `DecisionIssued` seeds pending list. All three are Lattica-side (or per-project-side) adoption of the existing API.

---

## Section 2 — Implications for Lattica's tile work

### 2.1 Track B implications

**LumaWeave tile** — Do not design around `graph.json` file-artifact polling. The CerebraReadAdapter model is closed. Plan for `GraphSnapshotAvailable` hub event subscription. When the tile shows Cerebra graph state, it receives a hub event, not polls a file. This is the leading design confirmed by both Cerebra and LumaWeave. Adopt snapshot on subscribe (C.7 pattern) to avoid blank state on tile open.

Also: even after LumaWeave migrates to the shared store, Cerebra's cycle events won't appear at the hub until Cerebra also migrates or a relay agent is running. Any tile element that aims to display cross-project context (graph state + active Cerebra session) depends on both migrations being live. Don't build that as an immediate deliverable.

**Cerebra tile** — CerebraSignalTile's fossic subscription is currently dark. Daemon HTTP polling at port 7432 works correctly (correct mechanism). The session/cycle event stream requires Cerebra to either migrate to the shared store or for a relay agent to run. Existing tile structure is correct; this is a data-availability gap, not a code bug. No code change needed now; note it in the tile's internal comment (or not, per coding discipline) and track it as the blocker for showing cycle events.

Witness model surfacing: the witness model is Cerebra-internal infrastructure. No Lattica tile should attempt to query it directly. If/when Cerebra exposes witness state through daemon endpoints, the tile can surface it via the existing daemon connection. Existing work is unaffected.

**Policy Scout tile** — When ALLOW SESSION enforcement lands (L-cost, deferred), the `causation_id` handling will involve `CommandRequested.upstream_causation_id` pointing across store boundaries. The visual treatment for "this link goes to a different substrate" is design-deferred, but note it's a case 2 chain (hub-traversable) not a case 1 (requires back-reference) once both PS and Cerebra relay.

Track A (activate_lockdown / deactivate_lockdown / restart_watch) unaffected by reconciliation — CLI subprocess pattern confirmed as the correct Lattica integration.

**Fossic tile** — D.3 stream naming convention affects how stream prefix chips render labels. Under D.3 (if ratified), hub stream names are `cerebra/agent-trace/*`, `lumaweave/graph/events`, `ai-stack/gpu` — i.e., same as local stream names. Chips can display stream names without needing to strip a relay prefix. Design with this assumption; if D.3 is not ratified, adjust.

**ai-stack tile** — The tile's Phase 2 wiring (subscribe to hub streams instead of polling Ollama directly) will target `ai-stack/gpu` and `ai-stack/models` on the hub. Under D.3, these hub stream names are identical to local stream names. Adopt snapshot on subscribe (cold-start pattern) to eliminate the up-to-10s gap. Note: the tile does not have visibility into which of the two silent VRAM consumers (LiteLLM health probe or Cerebra health check) caused a given VRAM reading — `VramBudgetChanged.pct` shows usage without attribution.

### 2.2 What to anticipate in the federation interview

When the federation interview round fires, Lattica will receive an interview prompt. Items to think through:

- **D.3 ratification** — Lattica is the 5th project; a position is needed for full ratification. D.3 produces clean hub stream names for all four emitting projects. Lattica's tile rendering is the consumer; D.3 is favorable for rendering since hub names match local names.
- **GraphSnapshotAvailable schema** — Lattica may be asked whether the schema design has rendering implications (e.g., does the tile need `lineage_id` to decide whether to refresh the displayed graph?).
- **Hub-side snapshot coordination** — affects how Lattica tiles handle cold-start on subscribe. The existing snapshot API is ready; adoption is the question.
- **Cross-substrate causation rendering** — if a causation link target lives in a different substrate (case 1), what visual treatment? "Click to query originating store" vs. "link grayed out"? Worth considering before the interview asks for it.
- **Lattica's hub role** — confirm or clarify the target architecture: Lattica's `~/.lattica/fossic/store.db` is the shared hub store; relay agents from all projects append to it; tiles subscribe from it. Lattica's fossil-tauri commands are the read layer for tiles.

---

## Section 3 — Open items where Lattica's view matters

| Item | Why Lattica's view matters | Status |
|------|---------------------------|--------|
| D.3 stream naming ratification | 5-of-5 makes it canonical; Lattica is the 5th | TBD by developer |
| GraphSnapshotAvailable schema | Lattica tile renders LumaWeave graph; consumes schema | TBD |
| Relay agent process model | Lattica may launch/monitor relay agents | TBD |
| Hub-side snapshot adoption | Determines tile cold-start behavior | TBD |
| Cross-substrate causation rendering | Lattica's visual design question | TBD |
| LumaWeave shared store path confirmation | Lattica's Tauri backend is the shared store; Lattica must confirm stability | **Actionable now** |
| CerebraSignalTile fossic subscription | Tile is dark until Cerebra migrates or relay runs | Noted; no code action needed |

---

## Section 4 — Methodology learning

- Three rounds of read-only + write iteration produced full convergence across all five projects. Single-round reconciliation would not have achieved this — stale info cleared naturally across rounds.
- Read-only passes between write passes were load-bearing (prevented projects from writing against stale peer files).
- The "settled log" pattern emerged organically across all five projects without coordination; worth codifying in a future small methodology pass.
- Lattica being outside the reconciliation loop produced a real gap; this brief addresses it. Future baseline cycles should plan Lattica's involvement at the reconciliation phase, not only the compile phase.
- The D.X referencing convention (Cerebra's D-section items as shared cross-project references) emerged organically; not designed. Future cross-project design work may benefit from a more explicit cross-file referencing system.

End of LATTICA_RECONCILIATION_BRIEF.md.
