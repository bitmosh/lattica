# Platform Baseline — 2026-06-16

> **Historical snapshot — 2026-06-16.** References to rhyzome, bons.ai, and discord-bot reflect their status at that date; those modules are now deprecated and removed from the platform.

**Filed by:** lattica-claude (compile pass v0.3.5t)
**Compiled from:** project baselines at
`docs/coordination/baselines/2026-06-16/<project>/current_state.md`
**Compile date:** 2026-06-16
**Status:** snapshot — reflects baselines filed at compile time; refreshes are new dated passes
**Audience:** developer + lattica-claude + web-claude (planning federation interview round)

---

## Compile Discipline

This is a **faithful-relay-first** document. Each project's content is reported per the source baseline, with attribution. Lattica-claude has not re-evaluated what projects reported, recommended priorities, or inferred relationships that weren't in any baseline.

Synthesis additions (clearly marked as Lattica-claude observations):
- Section 3 (Cross-Project Dependencies): maps dependencies that span baselines
- Section 4 (Cross-Baseline Observations): surfaces patterns visible only when reading baselines side-by-side
- Section 6 (Compile-Time Issues): flags missing sections, ambiguities, or conflicts

The developer + web-claude shape the federation interview from this baseline; the compile provides the substrate.

---

## Section 1 — Baselines included

| Project | Filed | Current version | Identity (per baseline) |
|---------|-------|-----------------|-------------------------|
| Cerebra | yes | v0.4.4 (tag `v0.1`, commit `4efb2bb`) | Local-first cognitive cycle runtime that maintains durable memory, evaluates LLM outputs across six epistemological signals, enforces capability and leeway bounds, and emits graph-native events. |
| LumaWeave | yes | v0.19.0 (package.json; no tag) | Local-first, graph-based architecture-visualization workbench that renders code, docs, and configs as a typed node/edge network with custom physics layouts. |
| Policy Scout | yes | v0.3.9 (commit `bc33d04`) | Policy enforcement and governance CLI + Tauri desktop app that intercepts commands before execution, evaluates against configurable policy rules, and provides an audit-chained decision trail with HITL approval workflows. |
| ai-stack/Bo | yes | No semantic version; Ollama 0.21.0, fossic-py 0.1.0; most recent milestone: Phase 2a sidecar | GPU inference stack (Ollama + LiteLLM + Open-WebUI) that backs Bo's LLM calls and the platform's local-first inference layer, now emitting structured events to the shared fossic substrate. |
| Fossic | yes | v1.0.0aa (commit `b3a4527`) | Local-first, append-only, content-addressed event store — a substrate that application projects embed to get durable, causally-linked event histories with concurrent read performance, optimistic write guarding, and a subscription model that scales to glob patterns. |

---

## Section 2 — Per-project baselines

### 2.1 Cerebra

**Source:** `baselines/2026-06-16/cerebra/current_state.md` (filed by cerebra-claude)

#### What shipped since last baseline

Reference point: approximately v0.4.0 (WEB_CLAUDE_BRIEF_ITER5.md authoring).

**Phase 11 — Lifecycle manager (v0.4.1, commit `c271d3b`)**
`cerebra lifecycle archive/tombstone/restore` — three state transitions on memory records. Archive excludes from retrieval (reversible). Tombstone is permanent (blocks re-ingestion). Restore reverts archived records. All transitions emit `MemoryRecordArchived`, `MemoryRecordTombstoned`, `MemoryRecordRestored` events to `inspector_events`.

**Phase 12 — Graph export (v0.4.2, commit `04c4022`)**
`cerebra export graph` writes `.cerebra/graph.json` using the `cerebra/v1` schema. Node types: `spine` (source documents) and `memory_record`. Edge types: `contains`, `describes`, `sku-proximity`, `sku-exact`. Emits `GraphExported` event. Also wired into the `ingest` command as an automatic post-ingest step.

**Phase 13 — Inspector CLI (v0.4.3, commit `dbe81bd`)**
`cerebra inspect` — full observability surface with six command trees: `session list/show`, `cycle show`, `memory show`, `retrieval show`, `leeway active/history/revocations`, and `query` (event query with `--event-type`, `--signal-low`, `--severe-misses`, `--tail`, `--filter`, `--last`, `--cycle`). `inspect query --tail` polls `inspector_events` via rowid; FossicStore events accessible via `--event-type`. Added `FossicStore.read_events()` helper for stream/aggregate reads. 34 new unit tests.

**Phase 14 — Integration testing and polish / v0.1 ship gate (v0.4.4, commit `4efb2bb`, tag `v0.1`)**
`tests/integration/test_e2e_spine.py` — 11 E2E tests covering the full pipeline against real Ollama (`huggingface.co/unsloth/granite-4.1-3b-GGUF:Q4_K_M`). Tests cover: ingest, memory record verification, Ollama health check, cycle execution, step result verification, `cycle_episode_records` write, FossicStore event emission, `inspector_events` write, retrieval pipeline, graph export JSON validity. Runs in ~28s. README rewritten for v0.1. `examples/docs/` added with three sample documents for demo vault use. All 14 v0.1 done-when criteria from `CEREBRA_MVP_SPEC.md` confirmed met.

Total test count at v0.4.4: 1675 unit tests + 11 E2E tests. 2 skipped.

#### Visual elements available for Lattica

**FossicStore event streams — all emit to `cerebra/agent-trace/<session_id>` unless noted:**

| Event type | Stream | Key payload fields | Renderer exists | P-013 follow-up? |
|---|---|---|---|---|
| `SessionOpened` | `cerebra/agent-trace/<session_id>` | `session_id`, `goal`, `cycle_config`, `recursion_depth`, `vault_path` | No | Yes — session lifecycle tile |
| `CycleStarted` | `cerebra/agent-trace/<session_id>` | `session_id`, `cycle_id`, `config_name`, `goal`, `step_count` | No | Yes — cycle timeline |
| `StepStarted` | `cerebra/agent-trace/<session_id>` | `session_id`, `cycle_id`, `step_id`, `step_name`, `step_index` | No | Yes |
| `StepExecuted` | `cerebra/agent-trace/<session_id>` | `session_id`, `cycle_id`, `step_id`, `step_name`, `output_text` (truncated), `composite_score` | No | Yes |
| `StepExecutionFailed` | `cerebra/agent-trace/<session_id>` | `session_id`, `cycle_id`, `step_id`, `error` | No | Yes |
| `SignalEvaluated` | `cerebra/agent-trace/<session_id>` | `signal_name`, `signal_score`, `signal_strength`, `low_confidence`, `evaluated_at`, `evaluator_prompt_version` | **Yes** (SignalEvaluatedRenderer) | Yes — spider/radar chart per step |
| `ClutchDecisionMade` | `cerebra/agent-trace/<session_id>` | `action`, `rule_matched`, `cascade_depth`, `escalate_to_catalyst` | **Yes** (ClutchDecisionMadeRenderer) | Yes — decision timeline node |
| `LeewayGrantApplied` | `cerebra/agent-trace/<session_id>` | `rule_id`, `session_id`, `grant_reason`, `escalation_level` | No | Yes |
| `LeewayGrantDenied` | `cerebra/agent-trace/<session_id>` | `rule_id`, `reason` | No | Yes |
| `LeewayRevocationFired` | `cerebra/agent-trace/<session_id>` | `rule_id`, `revocation_reason` | No | Yes |
| `PredictionMade` | `cerebra/agent-trace/<session_id>` | `predicted_composite`, `confidence`, `model_version`, `step_id` | **Yes** (PredictionMadeRenderer) | Yes — prediction vs actual plot |
| `PredictionSevereMiss` | `cerebra/agent-trace/<session_id>` | `prediction_error`, `expected`, `actual` | No | Yes |
| `MemoryWriteFromCycle` | `cerebra/agent-trace/<session_id>` | `record_id`, `cycle_id`, `summary_text`, `source_record_ids` | No | Yes — links cycle → memory |
| `ContextPacketBuilt` | `cerebra/agent-trace/<session_id>` | `trace_id`, `query`, `selected_record_count`, `abstained` | No | Maybe |
| `ContinuationBundleCreated` | `cerebra/agent-trace/<session_id>` | `bundle_id`, `parent_session_id`, `distilled_context_length` | No | Low priority |
| `ReinjectionTriggered` | `cerebra/agent-trace/<session_id>` | `parent_session_id`, `child_session_id`, `trigger_reason` | No | Yes — re-injection arc |
| `CatalystInvoked` | `cerebra/agent-trace/<session_id>` | `session_id`, `arm_count`, `selected_arm` | No | Yes — bandit arm selection |
| `BanditSelection` | `cerebra/agent-trace/<session_id>` | `arm_id`, `arm_name`, `epsilon`, `was_explore` | No | Yes |
| `CycleCompleted` | `cerebra/agent-trace/<session_id>` | `session_id`, `cycle_id`, `outcome`, `total_steps`, `completed_at` | No | Yes — cycle summary |
| `SessionFlushed` | `cerebra/agent-trace/<session_id>` | `session_id`, `outcome`, `total_cycles`, `total_steps` | No | Yes |
| `CheckpointSaved` | `cerebra/agent-trace/<session_id>` | `session_id`, `bundle_id` | **Yes** (CheckpointSavedRenderer) | Low priority |
| `OutcomeRecorded` | `cerebra/agent-trace/<session_id>` | (per vocabulary) | **Yes** (OutcomeRecordedRenderer) | — |
| `LatticeCommit` | `cerebra/lattice/<lineage_id>` | `lineage_id`, `record_id`, `commit_type` | No | Yes — lattice graph node |
| `PostureChanged` | `cerebra/control` | (per vocabulary) | No | — |

**SQLite inspector_events (dual-written, not relayed to LumaWeave):**
Categories: ingest pipeline, retrieval, working memory, graph, lifecycle, governance events. Readable via `cerebra inspect query`. Not available to Lattica's fossic subscription path today.

**HTTP daemon endpoints (port per baseline §3; see Compile-Time Issues §6.1 for port discrepancy):**

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/status` | — | `{posture, cycle_running, active_session_id, cycle_count, last_outcome}` |
| POST | `/posture` | `{"state": "hold"|"auto"}` | `{"posture": "hold"|"auto"}` |
| POST | `/cycles` | `{"config_name": "...", "goal": "..."}` | `{"cycle_id": "...", "session_id": "..."}` (async) |
| POST | `/checkpoint` | `{}` | `{"bundle_id": "...", "session_id": "..."}` |

**File artifacts:**
`.cerebra/graph.json` — knowledge graph in `cerebra/v1` schema. Nodes: `id`, `label`, `fullLabel`, `type` (`spine`|`memory_record`), `cluster`, `status`, `tags`, `size`, `path`, `lastModified`, `raw`. Edges: `id`, `source`, `target`, `type` (`contains`|`describes`|`sku-proximity`|`sku-exact`), `raw`. See Compile-Time Issues §6.3 for LumaWeave adapter conflict.

#### Open items / known follow-ups

**Polish debt (open):** PD-001 through PD-006, PD-008 (see baseline §4 for full list). PD-007 resolved.

**Tech debt (open):** TD-001, TD-002, TD-003, TD-008, TD-009, TD-011, TD-012, TD-013, TD-017, TD-018, TD-019 (see baseline §4 for full list).

**Would do next without external direction:** Close TD-018 (small, known fix); investigate TD-019; begin Phase 15 (roadmap TBD; likely witness layer or daemon-to-LumaWeave tile wiring).

#### Cross-project signals

**fossic:** Cerebra actively uses FossicStore (local `.fossic/store.db`). `read_events()` uses both `ReadQuery` and `AggregateQuery`. Snapshots via `EventEmitter` every 20 events per stream. Purge audit path (TD-001) will matter when fossic v1.1 ships crypto-shredding. Open question: `stream_exists()` — Cerebra calls this before `ReadQuery`; if API changes, `FossicStore.read_events()` needs updating.

**LumaWeave:** `.cerebra/graph.json` is the primary cross-project data path today. Whether `CerebraReadAdapter` is actively maintained or stale is unknown from Cerebra's side. Daemon HTTP endpoints available but no tile consumes them yet (see version drift note in §6).

**Policy Scout:** No direct dependency or data path today. Pre-action constitutional rule shape (TD-012) may eventually align with Policy Scout's scope.

**ai-stack:** Cerebra depends on Ollama at `http://127.0.0.1:11434` (or `OLLAMA_BASE_URL`). Health check via `OllamaDirectAdapter.health_check()` uses a minimal inference call to warm the model. LiteLLM proxy (port 4000) also works but Cerebra defaults to direct Ollama.

**Lattica:** No direct runtime dependency. Cross-project coordination through file artifacts (`graph.json`) and this baseline.

#### Pre-federation exploratory thoughts

**Events that would stay local (high-volume, internal-only):** Ingest pipeline events (`SourceRegistered`, `SourceParsed`, `DocumentNormalized`, `ChunkCreated`, `MemoryRecordCreated`, `EmbeddingGenerated`, `LexicalIndexUpdated`, `SKUAssigned`); retrieval internals (`TraversalStepCompleted`, `SalienceScored`, `LatticeSiblingResolved`); working memory internals (`AttentionItemProposed`, `AttentionItemEvicted`, `AttentionItemDeferred`, tower tier operations).

**Events that would relay to hub (integration-worthy):** `CycleStarted`/`CycleCompleted`, `SignalEvaluated`, `ClutchDecisionMade`, `PredictionSevereMiss`, `MemoryWriteFromCycle`, `ReinjectionTriggered`, `GraphExported`, `LeewayGrantApplied`/`LeewayRevocationFired`.

**Existing data paths that might fold into local fossic store:** `inspector_events` SQLite (if fossic gains efficient event_type filtering on aggregates); `.cerebra/graph.json` (could become a FossicStore projection — `GraphExported` payload with full graph); `retrieval_traces`/`retrieval_steps`/`retrieval_candidates` SQLite tables; `runtime_sessions` table (already mirrored in FossicStore — split intentional and probably correct).

**Fossic features of interest:** `append_if` (leeway grant deduplication); branches (TD-006, counterfactual cognition); snapshots (already using via `EventEmitter`); aggregates (would benefit from efficient `event_type_filter`); transforms/projections (graph.json could be computed from event stream); similarity search (possible future memory retrieval).

**Concerns about federation:** Stream naming is vault-scoped, not globally unique — relay agent needs to discover active session IDs dynamically. Event volume at full relay may be too high; relay should filter to integration-worthy subset. Two-store split (FossicStore + SQLite) means relay agent needs access to both for full picture. Per Fossic §6 (cross-baseline observation): relay agents should relay decoded payloads (post-upcast), not raw bytes, to handle schema migration correctly.

---

### 2.2 LumaWeave

**Source:** `baselines/2026-06-16/lumaweave/current_state.md` (filed by lumaweave-claude)

#### What shipped since last baseline

**gwells lifecycle and performance arc (`c2eafbd` and prior):**
Added `GWRuntimeState`, `GWDebugEvent`, `pause()`, `resume()`, `stop()`, `step()`, injectable scheduler, headless stepping, benchmark matrix, and interaction indexing by source well type. Structural resolver (`structuralResolver.ts`) moved well assignment toward topology-aware roles (root, spine, container, leaf, orphan, hub, bridge).

**gwells interaction-index bug fix (`4f28c47`):**
`interactionsBySourceWellType` was declared and used in the step loop but never populated. All inter-node forces (attraction, repulsion, spring, perpendicular) were silently dead every frame — only `centerGravity` and `seedAdherence` ran. Nodes appeared to settle because seedAdherence pulled them toward seed positions, masking the breakage. Fixed: `rebuildResolvedInteractions()` now populates the index alongside the flat array. 12/12 gwells validation checks pass.

**gwells hub-ring radius fix (`856dcd3`):**
Both seeders were passing `Math.max(spineSpacing, directoryOffset)` (= 2400) as the arc-gap for hub-ring positioning. `directoryOffset` is a depth-level spacing value, not inter-ring-node clearance. With 46 root spines this produced a ring radius of ~35k. Fixed to `spineSpacing / 2` (= 600), giving ~8.8k radius.

**R-LW-005 — fossic event emission (`977a6e8`):**
LumaWeave now emits to fossic from the Rust Tauri backend. Stream `lumaweave/graph/events` declared. Five event types live: `SourceLoaded`, `SourceLoadFailed`, `SourceSwitched`, `ThemeChanged`, `GraphLayoutSettled` (command wired; frontend mount deferred pending gwells convergence signal). TypeScript invoke helpers in `src/lib/tauri-invoke.ts`. Wired at: `useGraphSourceSummary.ts` (SourceLoaded/Failed/Switched), `useLwThemeEventEmitter.ts` + `AppShell.tsx` (ThemeChanged).

**Re-settle audit:**
GWController has no `restart()`. Re-settle can be implemented as a `reheat()` method: zero all `nodeStates` velocities, optionally update `__gwellsSeedPositions` to current positions. Cost: S. `applyConfigOverride({ seedParams })` re-runs the seed function and resets positions — wrong path for Re-settle.

#### Visual elements available for Lattica

**Fossic event stream — `lumaweave/graph/events`**
Current store: `<project_root>/.lumaweave/fossic.db` (project-local — not yet on shared platform store; migration needed)

| Event type | Key payload fields | Renderer useful? |
|---|---|---|
| `SourceLoaded` | `adapter_id`, `source_key`, `node_count`, `edge_count` | Yes — primary health + size signal |
| `SourceLoadFailed` | `adapter_id`, `source_key`, `error` | Yes — error state, sticky in tile |
| `SourceSwitched` | `from_adapter_id`, `to_adapter_id` | Yes — context change signal |
| `ThemeChanged` | `from_theme_id`, `to_theme_id` | Optional — suppress by default |
| `GraphLayoutSettled` | `node_count`, `duration_ms` | Optional — dev/perf signal |

All types are flat PascalCase. No renderers exist yet — deferred until iter-4 design output and shared store are both in place.

**Cerebra graph.json adapter:**
Not built. No adapter for consuming `{vault}/.cerebra/graph.json` exists in the source adapter registry. Current adapter types: `self-graph`, `git-codebase`, `website-url`, `markdown-vault`, `cytoscape-json`, `openapi-spec`, `database-schema`, `package-dependency`, `cloud-infrastructure`, `issue-tracker`, `csv-edge-list`. (See Compile-Time Issues §6.3 for cross-baseline conflict with Cerebra's claim.)

**Iter-4 tile elements (Lattica wiring status):**
All five originally-planned read-only tile elements are derivable from existing events (graph health pill from SourceLoaded/SourceLoadFailed; node/edge count badge from SourceLoaded payload; active source label from SourceLoaded/SourceSwitched; filter toggles client-side). All [API-NEW] controls blocked on shared store + reverse channel.

#### Open items / known follow-ups

**Blocked on shared platform fossic store:** All five [API-NEW] tile controls (source switcher, retry, layout freeze, re-settle, physics preset write); Lattica-side tile wiring (Track B, upcoming); hidden [API-NEW] prerequisite: `AdapterListChanged` event emission for source switcher dropdown.

**Deferred engine work:** `reheat()` controller method (S cost, waiting on Track B); `GraphLayoutSettled` frontend mount (gwells has no "settled" `GWRuntimeState` variant in v0.1.5; command registered in Rust, frontend not wired); gwells Phases 2–6 (macro controls, profile layer, specialized seeds, recommendation loop — design-doc-only).

**Known duplicate registry:** `physicsDialectRegistry.ts` (legacy) still consumed by `GraphVisualInventoryPanel.tsx`; real engine uses `GW_DIALECT_REGISTRY` from `dialects.ts`. Safe to clean up — deferred.

**UI coverage gap:** Engine supports `wellOverrides` and `interactionOverrides` via `applyConfigOverride` but UI only sends `seedParams`.

#### Cross-project signals

**gwells interaction-index bug:** Prior to `4f28c47` (2026-06-15), all LumaWeave graph layouts ran without inter-node forces. Visual benchmarks, screenshots, or layout quality assessments from before this commit reflect the broken state (seed-anchored drift only).

**Re-settle cost resolved:** `reheat()` approach (S cost) is correct. Reflected in WEB_CLAUDE_BRIEF_ITER5.md.

**Fossic path dep pattern:** LumaWeave's `Option<Store>` degraded-mode Rust wrapper is documented in `cross-pollination/lumaweave/r-lw-005-fossic-emitter.md` — reference for other Tauri projects integrating fossic.

#### Pre-federation exploratory thoughts

**What stays local:** Per-frame node position updates during gwells convergence; pin state changes (user dragging nodes); intermediate layout states during re-seeding.

**What relays to hub:** `SourceLoaded`/`SourceLoadFailed`/`SourceSwitched` (already in fossic); `GraphLayoutSettled` (once convergence signal wired); `AdapterListChanged` (needed for source switcher anyway). `ThemeChanged` probably local only.

**Existing data paths outside fossic:** `useSettingsStore` (Zustand + localStorage) — active adapter, dialect, helix twist, pin state; `src/fixtures/self-graph-generated.json`; local `fossic.db` at `<project_root>/.lumaweave/`.

**Fossic features of interest:** Branches (layout explorations as branches; "knowledge-garden layout" = branch of `lumaweave/graph/*`; deferred branches mean drop it, if works promote it); snapshots (graph state at convergence — "what did this graph look like after loading Cerebra source last Tuesday?"); transforms at append time (less obvious utility, exploratory); aggregates over node/edge history (graph growth tracking, not a current use case).

**Cerebra graph.json adapter under federation:** In a federated model, cleaner path is Cerebra emits `GraphSnapshotAvailable` hub event with snapshot reference, LumaWeave receives it and loads graph — avoids polling, makes handoff observable, fits hub-relay pattern. File artifact becomes implementation detail.

**Concerns:** Shared platform store path needs confirmation before anything can flow (primary blocker on all LumaWeave–Lattica integration). Settings store (Zustand/localStorage) vs fossic store — federation may want some settings to be hub-observable (active adapter, dialect) which would require either events or migration. If layout branches land, pin state needs branch-awareness (currently in `useSettingsStore`; branch switch should restore pins from when that branch was last active).

---

### 2.3 Policy Scout

**Source:** `baselines/2026-06-16/policy-scout/current_state.md` (filed by policy-scout-claude)

#### What shipped since last baseline

**VS Code extension (Phases 1–4, v0.3.7–v0.3.9):**
- Phase 1: Extension scaffold (VS Code/Cursor)
- Phase 2: Sweep → DiagnosticCollection (surfaces policy findings as editor diagnostics)
- Phase 3: MCP server registration
- Phase 4: Git hook surface

**Lockdown bundle + approval timeout (this session, uncommitted per baseline):**
- `lockdown on --json` and `lockdown off --json` flags — both mutation commands now emit structured JSON
- `approvals set-timeout <hours> [--json]` — new CLI subcommand; range 1–8760h, default 24h
- `policy_scout/core/config.py` — settings persistence at `~/.local/share/policy-scout/settings.json`; both `ApprovalRequest` construction sites updated to read configured timeout
- `activate_lockdown(reason?)`, `deactivate_lockdown()`, `restart_watch()` — three new Tauri commands in policy-scout's own desktop app
- 1143 tests passing, 2 skipped

**Fossic Phase 2 parallel emit (staged, uncommitted per baseline):**
`policy_scout/audit/sqlite_store.py` — parallel fossic emit after SQLite commit; non-fatal; streams named `policy-scout/audit/<request_id>`; uses redact-before-emit approach.

**Prior committed since v0.3.6:** Server-side pagination for audit events list (v0.3.7); sandbox results list pagination, severity filter on sweep findings preview (v0.3.8); data cleanup deletion path with `--apply` flag (v0.3.6).

**Uncommitted developer-authored UI work (untracked per baseline):** `ApprovalsView.tsx`, `LiveStatusCard.tsx`, `OverviewView.tsx`, `ScanView.tsx`, `Shell.tsx`, `BrandMark.tsx`, `HelpDrawer.tsx`, `Toast.tsx`, `Chip.tsx`, `Icons.tsx`, `SandboxLaunchCard.tsx`, `PolicySimulateCard.tsx`, `AuditVerifyChainCard.tsx`; new type files; new mocks. `PS-Frontend/` directory noted as a parallel frontend exploration.

#### Visual elements available for Lattica

**Tauri commands (policy-scout's own UI) — response shapes:**

`activate_lockdown(reason?)`:
```json
// success
{"ok": true, "exit_code": 0, "data": {"ok": true, "active": true, "reason": "..."}, "error": null}
// already active
{"ok": true, "exit_code": 0, "data": {"ok": false, "already_active": true}, "error": null}
// failure
{"ok": false, "exit_code": 1, "data": null, "error": "..."}
```

`deactivate_lockdown()`:
```json
// success
{"ok": true, "exit_code": 0, "data": {"ok": true, "active": false}, "error": null}
// already inactive
{"ok": true, "exit_code": 0, "data": {"ok": false, "already_inactive": true}, "error": null}
```

`restart_watch()`:
```json
// success
{"ok": true, "exit_code": 0, "data": {"ok": true, "pid": 12345}, "error": null}
// failure
{"ok": false, "exit_code": 1, "data": null, "error": "..."}
```

Note: these are the response shapes from policy-scout's own Tauri app (outer `CliJsonResponse` wrapper). Lattica's v0.3.5u Tauri commands shell-exec the CLI directly and parse the inner CLI JSON (without the outer wrapper) — see §6.2 for detail.

**Fossic event emission (staged, not yet committed):**
Stream: `policy-scout/audit/<request_id>`

| Event type | Category |
|---|---|
| `CommandRequested`, `CommandParsed`, `CommandClassified`, `PolicyMatched`, `DecisionIssued`, `PolicyError` | Governance pipeline |
| `ApprovalRequested`, `ApprovalApprovedOnce`, `ApprovalDeniedOnce`, `ApprovalExpired` | HITL approvals |
| `CommandExecutionCompleted`, `CommandExecutionBlocked` | Execution |
| `LockdownActivated`, `LockdownDeactivated`, `WatchDaemonStarted`, `WatchDaemonStopped` | Posture transitions (SQLite only; not yet wired to fossic emit) |

**4-state posture model — derivation logic:**

| State | Condition | Visual per iter-4 design |
|---|---|---|
| LOCKDOWN | `lockdown.active == true` (priority over watch state) | red neon |
| ACTIVE | `lockdown.active == false` AND `watch.running == true` | green neon |
| WATCH-DOWN | `lockdown.active == false` AND `watch.running == false` AND `watch.stale` absent/false | amber |
| STALE | `lockdown.active == false` AND `watch.running == false` AND `watch.stale == true` | amber blink |

Derived from two polling calls: `lockdown status --json` and `watch status --json` (combined in `get_system_health`).

**Approval card UI elements — current wiring status:**
- ALLOW ONCE — fully wired. `approvals approve <id> --json` → `{approval_id, status: "approved_once"}`.
- DENY — fully wired. `approvals deny <id> --json`.
- ALLOW SESSION — model layer only; `ApprovalScope.SESSION` constant does not exist; execute path hard-errors on non-"once" scope. Do not wire as functional.
- ALLOW PATTERN — not implemented.
- `expires_at` on approval cards: now configurable (default 24h). Tile should render as relative time from ISO 8601 value, not assume 24h.

**Risk bands:** Four bands: `low`, `medium`, `high`, `critical`. `DecisionIssued` carries both `risk_score` (int 0–100) and `risk_band` (string). Six decision outcomes: `ALLOW`, `ALLOW_LOGGED`, `REQUIRE_APPROVAL`, `SANDBOX_FIRST`, `DENY`, `DENY_AND_ALERT`.

#### Open items / known follow-ups

**L-cost items (deferred):** ALLOW SESSION enforcement (no `ApprovalScope.SESSION`; no session registry; needs design decision on session lifecycle signals); ALLOW PATTERN (no store, no CLI `--scope pattern`, no engine hook; needs match semantics decision); Rule mute mechanism (no `rules` CLI subcommand; needs audit trail + listing bundled in same pass).

**Uncommitted work pending commit:** Fossic Phase 2 emit (staged); Lockdown bundle + approval timeout (partially staged); large body of developer-authored UI components (untracked).

**UI/backend coverage gaps (from `docs/UI_BACKEND_COVERAGE_AUDIT.md`, 2026-06-12):** `get_policy_overview` state orphaned; `run_policy_validate` disconnected from App.tsx; `run_cleanup_apply` wired state unclear.

#### Cross-project signals

**Lattica:** `activate_lockdown`, `deactivate_lockdown`, `restart_watch` now in Lattica's `src-tauri/src/lib.rs` (Track A confirmed wired 2026-06-16). These shell-exec `policy-scout lockdown on/off --json` and `policy-scout watch start --json`. `expires_at` on approval cards: tile should not assume 24h.

**Fossic:** `POLICY_SCOUT_EVENT_VOCABULARY.md` note: `expires_at` description should be updated from "24h from creation" to "configurable via `approvals set-timeout`, default 24h". Minor; no schema change. Routed via lattica outbound.

**Config layer pattern:** `policy_scout/core/config.py` — JSON settings at `~/.local/share/<project>/settings.json`; `read_settings()`, `write_setting(key, value)`, `get_approval_timeout_hours()`. Overridable via env var. Other projects wanting config persistence can follow this pattern.

#### Pre-federation exploratory thoughts

**High relay value (hub-worthy):** `LockdownActivated`/`LockdownDeactivated`; `ApprovalRequested`; `ApprovalApprovedOnce`/`ApprovalDeniedOnce`/`ApprovalExpired`; `DecisionIssued` where `decision == "DENY_AND_ALERT"` or `risk_band == "critical"`; watch daemon state transitions.

**Stays local (high-frequency):** Every `DecisionIssued` at normal agent pace (~6–12/minute during active Cerebra session); `CommandRequested`/`CommandParsed`/`CommandClassified`/`PolicyMatched`; `CommandExecutionCompleted`.

**Relay filter logic (per baseline):** Relay if: `decision ∈ {DENY_AND_ALERT}` OR `risk_band == critical` OR `event_type ∈ {LockdownActivated, LockdownDeactivated, ApprovalRequested, ApprovalApprovedOnce, ApprovalDeniedOnce, ApprovalExpired, WatchDaemonStopped}`.

**Existing data paths outside fossic:** `~/.local/share/policy-scout/settings.json` (stays separate — one integer, no meaningful history); SQLite audit chain at `~/.local/share/policy-scout/audit.db` (stays authoritative, fossic is parallel write not replacement); PID file (stays separate).

**Fossic features of interest:** `append_if` for posture transitions (prevents duplicate `LockdownActivated` if two CLI invocations race); snapshots for audit compaction (fossic snapshots could represent verified-clean audit state, enabling older raw events to archive without losing chain integrity); transforms at append time (normalize command text before storing, improve deduplication).

**CLI subprocess pattern under federation:** Stays as-is. Lattica calls `policy-scout lockdown on --json` as subprocess; federation doesn't change this. Relay agent is a separate layer on top of the local fossic store.

**Concerns:** Rate filtering — `DecisionIssued` at ~6–12/minute during active Cerebra session; relay needs severity filter; threshold is a UX decision. Cross-store causation — `CommandRequested.upstream_causation_id` carries Cerebra's `ActionProposed` event_id; if relay is selective, the originating event may never reach hub and causation link dangles. Posture derivation shift — Lattica currently polls via CLI subprocess; under federation posture would come from hub event stream (non-trivial Track B change). Approval expiry enforcement — `ApprovalExpired` event is defined in vocabulary but not yet emitted by any daemon/scheduler; needs background process or derived at display time.

---

### 2.4 ai-stack/Bo

**Source:** `baselines/2026-06-16/ai-stack-bo/current_state.md` (filed by ai-stack-bo-claude)

#### What shipped since last baseline

**1. AiStackTopologyTile.tsx + .css (P-013 guest-author into Lattica)**
Authored by ai-stack/bo Claude, committed into Lattica's tree by Lattica Claude (v0.3.5v). Registered in `tileSectionRegistry` as `ai-stack-topology`, right panel, 480×520. Polls Ollama and LiteLLM on 10s interval. Renders full stack topology with VRAM gauge, alias chips, and model controls. Visual verification is developer-manual.

**2. fossic_sidecar.py (Phase 2a, local substrate writer)**
`/home/boop/Projects/ai-stack/fossic_sidecar.py` (212 lines). Standalone Python process. Polls Ollama `/api/ps` and `nvidia-smi` every 10 seconds; diffs model state; emits to `ai-stack/gpu` (VramBudgetChanged) and `ai-stack/models` (ModelLoaded, ModelUnloaded). Degrades silently if fossic store unavailable. SIGTERM/SIGINT shutdown confirmed clean.

**3. fossic-py installed in ai-stack venv**
Developer-approved. Installed via `uv pip install` from local wheel (`fossic-0.1.0-cp312-cp312-linux_x86_64.whl`). Confirmed importable.

**4. Live sidecar verification**
End-to-end: sidecar running → `qwen3.5:4b` loaded → `ModelLoaded` + `VramBudgetChanged` confirmed in fossic store → unloaded → `ModelUnloaded` confirmed. VRAM: 29.4% → 73.0% (3782 MB → 9402 MB). All events readable via `Store.read_range(ReadQuery(...))`.

**Live service state at baseline filing:**

| Service | Status | Image |
|---|---|---|
| Ollama | Up 4 days | ollama/ollama |
| LiteLLM | Up 4 hours | ai-stack-litellm (local build) |
| Open-WebUI | Up 4 days (healthy) | ghcr.io/open-webui/open-webui:main |
| TTS | Up 4 days | ghcr.io/matatonic/openedai-speech:latest |

GPU at filing: RTX 4070 SUPER, 12282 MB total. `qwen3.5:latest` loaded — 11305 MB / 12282 MB (92%) — note: LiteLLM health checks probe `ollama/qwen3.5:latest`, triggering model load as a side effect; this is not user-initiated.

#### Visual elements available for Lattica

**AiStackTopologyTile features (registered, live in Lattica's tree):**
- STACK status dot — aggregate up/degraded/down dot in tile header
- TOPO/LIST toggle — graph-layout topology view vs. flat list view (TOPO default; LIST placeholder in current build)
- DORMANT toggle — show/hide dormant model nodes
- VRAM gauge — filled bar showing model VRAM / total VRAM; threshold-based warn color (default 80%); total overridable via number input stored in `localStorage["aistack.vramTotalMb"]`
- ALIAS MUTE chips — per-alias mute toggles for `bot-local` and `bot-escalated` (hardcoded Set); muted aliases show struck-through chip + dimmed graph edge; persisted in `localStorage["aistack.mutedAliases"]`
- LOAD MODEL — dropdown of available Ollama models + confirm; calls `POST /api/generate {model, prompt:"", keep_alive:"10m"}`; re-polls immediately after
- UNLOAD ALL — confirm button; calls unload for each running model; re-polls immediately

**Sidecar event types and payload shapes:**

Stream `ai-stack/gpu`:
```json
{
  "event_type": "VramBudgetChanged",
  "used_bytes": "<int — total GPU VRAM used>",
  "total_bytes": "<int — GPU total capacity>",
  "model_vram_bytes": "<int — sum of size_vram across running models>",
  "pct": "<float — used_bytes/total_bytes*100, 1 decimal>",
  "models": [{"name": "<str>", "size_vram": "<int>"}],
  "sampled_at": "<int — Unix ms>"
}
```

Stream `ai-stack/models`:
```json
{ "event_type": "ModelLoaded", "model_name": "<str>", "size_vram": "<int>", "loaded_at": "<int — Unix ms>" }
{ "event_type": "ModelUnloaded", "model_name": "<str>", "unloaded_at": "<int — Unix ms>" }
```

Emit condition: `VramBudgetChanged` only when GPU used VRAM shifts ≥10 MB from last reading. `ModelLoaded`/`ModelUnloaded` on every diff.

**Bo heartbeat / status:**
Bo (`discord-bot/bot.py`) emits to `bot/lifecycle` (BotStarted, BotStopped) and `bot/conversation/<channel_id>` (LlmCallAttempt, ResponseGenerated) — live in shared fossic store. No `~/.lattica/bo-heartbeat.json` file exists. Bo node in tile is currently `status: "unknown"` (Phase 2 pending). TTS node: `status: "unknown"` permanently — openedai-speech container exposes no host port.

**Connection details:**
- Ollama: `http://localhost:11434` — `/api/ps`, `/api/tags`, `/api/generate`
- LiteLLM: `http://localhost:4000` — `/v1/models`, `/health`; master key `sk-fake` (local only)
- Open-WebUI: `http://localhost:3000` — HEAD health check
- TTS: no host port — unreachable externally
- LiteLLM config: `/home/boop/Projects/ai-stack/litellm/litellm-config.yaml`
- fossic store (shared): `~/.lattica/fossic/store.db`
- Sidecar venv: `/home/boop/Projects/ai-stack/.venv/bin/python3`

**Renderer utility noted in baseline:** A Lattica-side renderer for `VramBudgetChanged` would be useful — compact VRAM bar with `pct` + model list. `ModelLoaded`/`ModelUnloaded` could annotate model node timeline. Not authored yet; would follow P-013 pathway.

#### Open items / known follow-ups

**Tile Phase 2 wiring (medium priority):** AiStackTopologyTile still polls Ollama directly. To complete Phase 2, polling loop needs to be replaced or supplemented with fossic subscriptions to `ai-stack/gpu` and `ai-stack/models` via `invoke("fossic_subscribe", ...)`. Lattica-side wiring work; ai-stack/bo authors tile changes.

**Bo node resolution (fast-follow after Phase 2 wiring):** Subscribe to `bot/lifecycle` stream; `BotStarted`/`BotStopped` already live.

**Management sidecar (iteration 6+, gated):** RESTART node, FORCE FAILOVER, SLEEP TIMER require Docker socket access or equivalent. Not scoped. These are the remaining M-tier backend-prep items from the investigation doc.

**`ai-stack/inference` stream (Phase 2b, low priority):** `InferenceStarted`/`InferenceCompleted` need either a LiteLLM log tap or middleware hook. Not designed. LiteLLM log location and format unverified for this use case.

**Manual visual verification:** Tile has never been visually inspected with all four services running simultaneously. LiteLLM was down during Lattica's smoke test.

**TOPOLOGY_ALIASES hardcoded Set:** `const TOPOLOGY_ALIASES = new Set(["bot-local", "bot-escalated"])` — not derived from LiteLLM config at runtime; must be manually updated if LiteLLM gains new routing aliases.

#### Cross-project signals

**Fossic store path:** Sidecar writes to `~/.lattica/fossic/store.db` — same shared store used by Bo, Cerebra, and Lattica. `ai-stack/gpu` and `ai-stack/models` streams are live in that store. Directly relevant to federation conversation: ai-stack is already a writer in the shared store, not a separate local store.

**LiteLLM health check VRAM side effect:** LiteLLM probes `ollama/qwen3.5:latest` as its health endpoint, causing Ollama to load that model. At filing time: 11305 MB / 12282 MB used with no user-initiated loads. Any project looking at VRAM usage should account for this persistent ~5-6 GB baseline footprint.

#### Pre-federation exploratory thoughts

**What stays local vs. relays to hub:**
- Relay: model lifecycle transitions (ModelLoaded/ModelUnloaded); VRAM state summaries (pct, total_bytes); ServiceUp/ServiceDown for named services
- Stay local: raw VramBudgetChanged at 10s poll rate (too high volume, better aggregated); inference attempt logs (local audit trail; only summaries relay); health poll noise
- Governing principle per baseline: relay *transitions*, not *measurements*.

**Existing data paths outside fossic:** `litellm-config.yaml` (static routing config; stays separate); `docker-compose.yml` (static topology declaration; stays separate); Ollama's model registry `/api/tags` (available-but-not-loaded models; could seed an `ai-stack/registry` stream but not a current need).

**Fossic features of interest:** Snapshots for VRAM state (fast initial read for tile subscribers without replaying history); `read_by_correlation` (for tracing inference attempts once causation chains are set; currently `causation_id=None` in all sidecar appends).

**Sidecar design under federation:** Sidecar opens the shared store directly. In a federation where each project has its own local store, sidecar opens a *local* store — zero design change, just a config path change (`FOSSIC_STORE_PATH`). Relay agent sits between local store and hub. Sidecar doesn't need to know about the hub — clean separation. Bo and sidecar both in ai-stack domain; both would write to the same local store; relay agent handles federation.

**Concerns:** LiteLLM health-check VRAM side effect not surfaced in event stream (`VramBudgetChanged` just shows high usage, not why); stream naming may need qualification under federation (per fossic relay protocol, stream_id is namespaced at relay time); tile doesn't subscribe to fossic yet — sidecar and tile operate in parallel with same data, not in series (fossic events not load-bearing yet).

---

### 2.5 Fossic

**Source:** `baselines/2026-06-16/fossic/current_state.md` (filed by fossic-claude)

#### What shipped since last baseline

Reference point: approximately WEB_CLAUDE_BRIEF_ITER5.md authoring.

**Phase 1 — Upcaster consistency + transform `**` glob fix**
Upcasters now fire on all read paths that were missing them (`aggregate`, `walk_causation`, `read_by_correlation`). `**` transform pattern fixed to match all streams correctly.

**Phase 2 — Tauri observability: `fossic_list_subscribers`, `fossic_subscription_status`**
Two new Tauri commands expose the live subscription registry: list all active subscribers with stream patterns, modes, cursor positions; query a single subscriber's degraded status.

**Phase 3 — PD-007: `compute_event_id` via PyO3 (commit `d6d4a06`)**
`compute_event_id(event_type, payload, type_version, causation_id)` exposed from fossic-py. Routes through fossic's own blake3 path. 8 tests in `test_event_id.py` confirm byte identity between pre-computed IDs and `Store.append()` output. Closes Python-level CCE verification gap.

**Phase 4A — `indexed_tags` SQL filter + glob semantic fix in `aggregate`**
`AggregateQuery.indexed_tags_filter` pushes flat AND exact-match filter into SQL. Glob patterns in `aggregate` stream matching fixed. `_fossic/*` excluded from glob aggregates unless `include_system = true`.

**Phase 4B — `read_batch` (commit `8b24ec1`)**
`Store::read_batch(ids: &[EventId])` returns `Vec<StoredEvent>` for a batch of event IDs in single SQL `IN (...)` query. Available via `fossic_read_batch` Tauri command. Enables efficient causal-graph traversal.

**Phase 5 — Glob subscription cursor seeding (v1.0.0u)**
Glob subscriptions previously initialized cursors to -1, causing full history replay on every new subscriber. Fixed: `MAX(version)` per matching stream snapshot into `stream_cursors` at subscribe time. Only future events delivered. New streams created after subscription still receive their first event correctly.

**Phase 6a — `append_if`: optimistic-concurrency append (v1.0.0v)**
`Store::append_if(a: Append, condition: FnOnce(&Connection) -> Result<bool, Error>)` — condition runs inside `IMMEDIATE` transaction; returns `Ok(None)` without committing if condition returns false. Enables version-guard patterns, idempotency checks, state-machine transitions without external locking.

**Phase 6b — Read connection pool (v1.0.0w)**
`StoreInner` holds a crossbeam-channel bounded pool of N read connections (default `read_pool_size: 4`). All 16 pure-read methods draw from pool rather than write mutex. `PRAGMA query_only = ON` write-accident guard. `ReadGuard` RAII struct returns connection on drop. `Error::PoolExhausted` after configurable timeout (`read_pool_timeout_ms`, default 30s). Zero new dependencies.

**v1.0.0x–v1.0.0aa:** Registry reconciliation; TD-008 resolved (subscribe seed queries moved to read pool); PD-009 resolved (`PoolExhausted` integration test + configurable timeout); PD-007 registry close.

#### Visual elements / capabilities available for Lattica

**New Tauri commands since last baseline:**

| Command | Purpose |
|---|---|
| `fossic_list_subscribers` | Returns all live PostCommit subscribers: ID, stream pattern, branch, cursor position, degraded flag |
| `fossic_subscription_status` | Returns degraded status + cursor for a single subscriber ID |
| `fossic_read_batch` | Fetches multiple events by CCE ID in one SQL query |

**Query capabilities:**
- `indexed_tags_filter` on `AggregateQuery` — flat AND exact-match, SQL-pushed. Lattica can aggregate across streams and filter by `{session_id: "abc"}` without loading every event into fold.
- `read_batch` — multi-event fetch by CCE ID. Pairs with `causation_id` traversal for event lineage in a single render cycle.
- Glob subscriptions without history replay — subscribe to `cerebra/**` without replaying historical events; only new events land after subscription.

**Write capabilities:**
- `append_if` — optimistic-concurrency append; condition closure sees live database state inside transaction.

**Observability — `_fossic/system` stream:**
Currently emits one event type: `SubscriptionDegraded` — fired when a subscriber's handler returns an error and the subscription is marked degraded. Payload includes `subscription_id` and error context. Lattica can subscribe to `_fossic/system` (requires `include_system: true`) to monitor store health.

**Read performance:** Concurrent reads no longer queue behind each other or behind the write path. At `read_pool_size: 4`, four concurrent reads run in parallel.

**`AggregateQuery.indexed_tags_filter` semantics:**
- Flat AND: all key-value pairs must match
- Supported types: `str`, `bool`, `int`, `float`, `None`
- Booleans matched as integers in SQLite (1=true, 0=false)
- No OR, no IN, no ranges; complex predicates stay in `fold()`
- Key constraint: `[a-zA-Z0-9_]` only

#### Open items / known follow-ups

**Open tech debt (all externally triggered):**

| ID | Severity | Trigger |
|---|---|---|
| TD-001 | MEDIUM | Python DynReducer bridge cost (~47μs/event over PyO3). Trigger: Cerebra witness layer + measurable latency. Mitigation: aggressive snapshot cadence (every 10 events). |
| TD-003 | LOW | `time = "=0.3.37"` exact pin in fossic-tauri. Trigger: Tauri bumps cookie version. |
| TD-004 | MEDIUM | `SimilaritySearchProvider` trait stub absent from code (feature flag placeholder). Trigger: bons.ai requests vector search. |
| TD-007 | LOW | `take_snapshot` dual-acquisition TOCTOU. Trigger: snapshot staleness under high concurrent write load. |

**Open polish debt:** None. All PD items resolved.

**Not-yet-built federation items:** `relay_append` convenience helper (not built; raw protocol works with `Append` fields today); in-process relay subscription (not built; relay agents are out-of-process today).

#### Cross-project signals

**Read concurrency is now non-blocking.** All projects embedding fossic get concurrent read performance without API changes.

**`append_if` unlocks state-machine patterns.** Projects needing to guard appends on current state have a clean primitive.

**`indexed_tags_filter` is SQL-pushed.** Projects using `aggregate` or planning hub-level cross-stream queries should prefer `indexed_tags` for filterable fields; filter is now `WHERE json_extract(...)`, not fold-time.

**Glob subscriptions no longer replay history.** Any project creating glob subscriptions gets correct from-now semantics automatically.

**`compute_event_id` available in Python.** Cerebra's relay agent can pre-compute hub-store event_id before appending to hub, enabling round-trip verification.

#### Pre-federation exploratory thoughts

**The relay agent interface — current best draft (per baseline §6):**

```
subscribe(local_store, "project/**", branch="main")
  → on each event:
      if hub_store.read_by_external_id(event.id.to_hex()) is Some:
          continue  # idempotent
      hub_store.append(Append {
          stream_id: format!("project/{}", event.stream_id),  # namespaced
          event_type: event.event_type,
          payload: event.payload,
          causation_id: Some(event.id),     # preserves causal chain
          external_id: Some(event.id.to_hex()),  # idempotency key
          indexed_tags: event.indexed_tags,  # pass through for hub aggregates
      })
```

Key properties: idempotent (`external_id` check prevents double-relay on restart); causal (`causation_id = source_event.id`); filtered (relay agent decides which event types cross boundary); namespaced (`stream_id` prefixed with project name on hub).

**Recommended order of project migrations (per baseline §6):**
1. LumaWeave first — already on fossic-tauri; relay just adds a second store handle + filter. Benefit: Lattica immediately gets an architectural event stream to visualize.
2. Cerebra second — fossic-py already integrated; `compute_event_id` live; relay agent is a Python script (~100 lines). Benefit: hub gets richest event stream; cross-project causal chains become real.
3. rhyzome third — simpler event shape, faster to wire, Rust-native.
4. bons.ai last — depends on TD-004 (SimilaritySearchProvider) for most interesting local capabilities.

**`relay_append` helper: after first relay.** Let LumaWeave's relay agent prove the protocol, then extract as convenience helper when writing the second (Cerebra).

**Risks other projects may not see:**
- **Schema migration at relay boundary:** Hub holds original payload bytes (relayed before upcast existed). Hub has no upcasters for project event types. Recommendation: relay agents should relay `stored_event.deserialize_payload_json()` (decoded, post-upcast payload) rather than raw bytes.
- **Snapshot coordination is per-store:** Snapshots on local store don't transfer to hub. Lattica aggregating Cerebra state via hub must replay all relayed Cerebra events from the beginning. Mitigation: Lattica maintains its own reducer+snapshot for hub-visible event types, or limits hub-side aggregation to summary events.
- **Causation chains span stores:** Hub event's `causation_id` points to event in local store, not hub store. `read_one(causation_id)` on hub will return `EventNotFound`. `walk_causation` on hub only walks hub-internal chains. Cross-store causal traversal requires going back to originating store.
- **Event ordering across projects is wall-clock only:** No global logical clock. Events from different projects ordered by `timestamp_us` (wall clock at relay time), which may not reflect actual causation order if relay agents have different latencies.
- **`read_pool_timeout_ms` should be tuned per project:** Default 30s is conservative. Projects with tight latency requirements should set a shorter timeout with a fast fallback.

---

## Section 3 — Cross-project dependencies

**Lattica-claude observation:** dependencies and integration points that span baselines.

### File artifact dependencies

| Producer | Artifact | Consumer | Status per baselines |
|----------|----------|----------|----------------------|
| Cerebra | `.cerebra/graph.json` (cerebra/v1 schema) | LumaWeave (claimed CerebraReadAdapter) | **Conflict** — Cerebra §3 says consumed by LumaWeave's `CerebraReadAdapter`; LumaWeave §3 says adapter not built. See §6.3. |

### Event stream dependencies

| Emitter | Stream | Consumer | Payload shape source |
|---------|--------|----------|---------------------|
| Cerebra | `cerebra/agent-trace/<session_id>` | Lattica CerebraSignalTile (4 renderers + event_type fallback) | Cerebra baseline §3; AGENT_TRACE_VOCABULARY.md §8 |
| Cerebra | `cerebra/control` | Lattica CerebraSignalTile (PostureChanged; explicit subscribe required) | Cerebra baseline §3 |
| ai-stack sidecar | `ai-stack/gpu` | AiStackTopologyTile (Phase 2 wiring, not yet live — tile still polls directly) | ai-stack baseline §3 |
| ai-stack sidecar | `ai-stack/models` | AiStackTopologyTile (Phase 2 wiring, not yet live) | ai-stack baseline §3 |
| Bo | `bot/lifecycle` | AiStackTopologyTile (Phase 2 wiring, pending — currently `status: "unknown"`) | ai-stack baseline §3 |
| Bo | `bot/conversation/<channel_id>` | No Lattica consumer yet | ai-stack baseline §3 |
| LumaWeave Rust backend | `lumaweave/graph/events` | No Lattica consumer yet; no renderers authored | LumaWeave baseline §3 |
| Policy Scout (staged) | `policy-scout/audit/<request_id>` | No Lattica consumer yet; not yet committed | Policy Scout baseline §3 |

### HTTP/IPC endpoint dependencies

| Provider | Endpoint | Consumer | Contract source |
|----------|----------|----------|----------------|
| Cerebra daemon (port per §6.1 discrepancy) | GET /status | Lattica CerebraSignalTile (30s poll, 500ms timeout) | Cerebra baseline §3; daemon-v1-lattica cross-pollination |
| Cerebra daemon | POST /posture | Lattica HOLD toggle | Cerebra baseline §3 |
| Cerebra daemon | POST /checkpoint | Lattica Checkpoint button | Cerebra baseline §3 |
| Cerebra daemon | POST /cycles | Not yet wired in Lattica | Cerebra baseline §3 |
| Ollama (port 11434) | /api/ps, /api/tags, /api/generate | AiStackTopologyTile (direct polling) + Cerebra (OllamaDirectAdapter) | ai-stack baseline §3; Cerebra baseline §5 |
| LiteLLM (port 4000) | /v1/models, /health | AiStackTopologyTile (direct polling) | ai-stack baseline §3 |

### Tauri command dependencies

| Project CLI | Lattica Tauri command | Status |
|-------------|---------------|--------|
| `policy-scout lockdown on [--reason ...] --json` | `activate_lockdown(reason?)` | Live (v0.3.5u) |
| `policy-scout lockdown off --json` | `deactivate_lockdown()` | Live (v0.3.5u) |
| `policy-scout watch stop` + `policy-scout watch start --json` | `restart_watch()` | Live (v0.3.5u) |

### Library / package dependencies

| Dependent | Depends on | Capability used |
|-----------|------------|----------------|
| Cerebra | fossic-py (local `.fossic/store.db`) | FossicStore, Append, ReadQuery, AggregateQuery, read_events(), compute_event_id |
| ai-stack sidecar | fossic-py (shared `~/.lattica/fossic/store.db`) | Store.open(), append() for VramBudgetChanged, ModelLoaded, ModelUnloaded |
| Bo | fossic-py (shared `~/.lattica/fossic/store.db`) | append() for bot/lifecycle, bot/conversation/* |
| LumaWeave Rust backend | fossic-tauri (Rust) | Append for lumaweave/graph/events stream |
| Lattica Rust backend | fossic-tauri (Rust) | fossic_subscribe, fossic_unsubscribe, fossic_list_streams, fossic_read_range, fossic_read_batch, fossic_subscription_status, fossic_list_subscribers |
| Policy Scout (staged) | fossic-py (local store TBD) | parallel emit to policy-scout/audit/<request_id> streams |

---

## Section 4 — Cross-baseline observations

**Lattica-claude observation:** patterns visible only when reading baselines side-by-side. Factual; no recommendations.

### Convergent themes

**Theme: Shared fossic store path is the primary integration blocker for multiple projects.**
LumaWeave (§4), LumaWeave (§6), Policy Scout (§5 via lattica cross-pollination), and ai-stack (§5) all touch this. LumaWeave writes to `<project_root>/.lumaweave/fossic.db` and identifies migration as its top blocker. ai-stack sidecar writes directly to `~/.lattica/fossic/store.db` (already on the shared path). Cerebra writes to a local `.fossic/store.db`. Policy Scout uses SQLite with fossic emit staged but not committed. The store path question appears across four of five baselines as either a blocker or an active design consideration.

**Theme: `append_if` interest is widespread and independent.**
Cerebra (leeway grant deduplication, §6), Policy Scout (lockdown posture idempotency, §6), LumaWeave (node mutation guards, §6), Fossic (implemented Phases 6a, §2). Four separate expressions of the same need. Fossic shipped the primitive without knowledge of this cross-baseline convergence.

**Theme: Relay filter design — "transitions not measurements."**
Cerebra (§6), Policy Scout (§6), and ai-stack/Bo (§6) all independently designed relay filter logic. All three converge on the same principle: high-volume measurements stay local; low-volume state transitions relay to the hub. The specific filter lists differ by project domain but the pattern is identical.

**Theme: Daemon/sidecar health monitoring under offline/recovery conditions.**
Cerebra (daemon offline detection + 30s recovery poll implemented in Lattica's CerebraSignalTile), Policy Scout (posture derivation shift under federation noted as non-trivial Track B change), ai-stack (Bo node status "unknown" pending Phase 2 wiring). All three projects have a Lattica tile that partially or fully lacks live health signal from its backend.

### Pre-federation alignment (from Section 6 thoughts)

**Local store shape patterns:**
Projects largely agree on the local-vs-relay split intuitively, though from different starting points. Cerebra and ai-stack have the most detailed Section 6 submissions with explicit filter lists. LumaWeave's thoughts are directional but less enumerated. Policy Scout's analysis is the most precise (specific relay filter formula provided). Fossic provided the authoritative relay protocol shape.

**Relay filter patterns:**
Three projects provided relay filters in Section 6:
- Cerebra: 8 named event types relay; ~14+ stay local (ingest pipeline, retrieval internals, WM internals)
- Policy Scout: explicit filter formula (`decision ∈ {DENY_AND_ALERT}` OR `risk_band == critical` OR `event_type ∈ {seven types}`)
- ai-stack: transitions relay (ModelLoaded/ModelUnloaded/ServiceUp/ServiceDown/VRAM summaries); measurements stay local

LumaWeave provided directional relay intent (5 event types) but acknowledged all five depend on the shared store migration first.

**Existing data paths outside fossic:**
Each project has significant state outside fossic today:
- Cerebra: `inspector_events` SQLite, retrieval SQLite tables, `runtime_sessions` SQLite, `.cerebra/graph.json` file artifact
- LumaWeave: Zustand/localStorage (active adapter, dialect, pin state), `fossic.db` on project-local path
- Policy Scout: `audit.db` SQLite (authoritative, hash-chained), `settings.json`, `watch.pid`
- ai-stack: `litellm-config.yaml` (static routing config), `docker-compose.yml` (static topology)

The non-fossic data falls into three categories: (a) static configuration that doesn't need event-sourcing; (b) fast-query SQLite that could fold into fossic if fossic gains efficient `event_type_filter` (Cerebra flagged this explicitly); (c) existing fossic-on-non-shared-path (LumaWeave) that needs migration not redesign.

**Fossic feature interest patterns:**

| Feature | Projects interested | Notes |
|---|---|---|
| `append_if` | Cerebra, Policy Scout, LumaWeave, Fossic (shipped) | 4 independent interests; now available |
| Branches | LumaWeave, Cerebra (TD-006) | Layout experiments, counterfactual cognition |
| Snapshots | Cerebra (already using), LumaWeave (graph state), ai-stack (VRAM state seeding) | Cerebra already using; LumaWeave and ai-stack identified need |
| `compute_event_id` | Fossic (shipped), Cerebra (needed for relay verification) | Available in fossic-py; Cerebra relay agent can use now |
| Aggregates with `event_type_filter` | Cerebra (post-aggregate Python filter today) | Landed as `indexed_tags_filter`; covers the pattern for indexed fields |
| Similarity search / vector | Fossic (TD-004 stub) | bons.ai dependency; not available |
| Transforms/projections | Cerebra (graph.json as projection), LumaWeave (exploratory) | Not yet built |

**Common concerns or unknowns:**

Schema migration at relay boundary: Both Fossic (§6) and Cerebra (§6) flagged this independently. Fossic recommends relaying decoded (post-upcast) payloads, not raw bytes. Cerebra expressed the concern from the consumer side. This is a concrete protocol decision for the federation design.

Causation chain handling across store boundaries: Fossic flagged explicitly (§6). Policy Scout flagged a variant (cross-store causation from `CommandRequested.upstream_causation_id`). The problem is: a hub event's `causation_id` points to an event in a local store that may not exist on the hub. Two baselines surface this from different angles.

### Independent flagging

**`append_if` for deduplication under concurrent invocation:** Cerebra flagged for leeway grants; Policy Scout flagged for lockdown posture (two terminals both running `lockdown on`). Both baselines described this scenario independently without reference to each other. Fossic shipped `append_if` independently of these use cases being articulated cross-project.

**Schema migration risk at relay boundary:** Fossic (§6) and Cerebra (§6) both flagged that relay agents need to relay decoded payloads (post-upcast), not raw bytes, to avoid hub consumers receiving stale schema versions. Independent observation from both the store maintainer and the primary consumer.

**`indexed_tags` for session-scoped filtering:** Fossic (§3) noted this use case for Lattica cross-project tiles; Cerebra (§6) flagged wanting `event_type_filter` efficiency on aggregates. The `indexed_tags_filter` solution addresses the filtering need from the fossic side; Cerebra hasn't yet adopted `indexed_tags` fields on all events for this purpose.

### Asymmetric maturity of fossic adoption

| Project | Current fossic position |
|---|---|
| ai-stack sidecar + Bo | **Most advanced federation position**: already writing to shared `~/.lattica/fossic/store.db` directly. No migration needed. |
| Lattica (Rust backend) | **Consumer only**: reads via fossic-tauri Tauri commands; fossil_subscribe for cerebra and control streams. No writes except canary ping. |
| Cerebra | **Local store, ready to migrate**: fossic-py integrated; read_events() added; compute_event_id available; on local `.fossic/store.db`. Migration = path change + relay agent. |
| LumaWeave | **Local store, blocked on migration**: fossic-tauri integrated; R-LW-005 events live; on `<project_root>/.lumaweave/fossic.db`. Migration is the primary blocker for all Track B work. |
| Policy Scout | **Pre-fossic**: SQLite-authoritative; fossic emit staged but not committed. Fossic is a parallel write, not integrated into the primary audit trail. |

---

## Section 5 — Platform state summary (factual)

### What's working end-to-end today

- Lattica CerebraSignalTile renders Cerebra `cerebra/agent-trace/*` events via four renderers (SignalEvaluated, PredictionMade, OutcomeRecorded, ClutchDecisionMade) and event_type label fallback for unrecognized types
- CheckpointSavedRenderer registered for CheckpointSaved events
- Cerebra daemon at localhost:7432 responds to all four endpoints (status, posture, cycles, checkpoint); confirmed in smoke test
- ai-stack fossic sidecar writes VramBudgetChanged, ModelLoaded, ModelUnloaded to `~/.lattica/fossic/store.db`; confirmed live with model load/unload cycle
- Bo writes BotStarted/BotStopped to `bot/lifecycle` and LlmCallAttempt/ResponseGenerated to `bot/conversation/<channel_id>` in shared fossic store
- LumaWeave emits SourceLoaded, SourceLoadFailed, SourceSwitched, ThemeChanged to local `fossic.db` via R-LW-005 (on project-local path, not shared store)
- Cerebra Phase 14 E2E integration test passing (full ingest → run-cycle → retrieve → export graph → inspect events pipeline against real Ollama, ~28s)
- Policy Scout lockdown CLI wired to Lattica Tauri commands (`activate_lockdown`, `deactivate_lockdown`, `restart_watch`) — confirmed via direct CLI smoke test
- AiStackTopologyTile registered in Lattica's tileSectionRegistry; typecheck and build clean
- Fossic read connection pool live (v1.0.0w); concurrent tile queries no longer queue behind write mutex
- Fossic glob subscriptions no longer replay history (v1.0.0u; Phase 5)

### What's in-tree but not yet end-to-end verified

- Lattica CerebraSignalTile daemon wiring: 30s health poll, cerebra/control subscribe, OFFLINE pill, Checkpoint button, HOLD toggle — code in tree; Tauri webview visual inspection manual-required (no display during smoke test)
- AiStackTopologyTile — visual inspection manual-required; LiteLLM was offline during Lattica's smoke test; tile has never been visually inspected with all four services simultaneously
- Lattica's three Policy Scout Tauri commands — smoke confirmed via direct CLI subprocess, not via webview `invoke()`; webview invocation not tested
- LumaWeave GraphLayoutSettled — Rust command registered; frontend mount deferred (gwells has no "settled" GWRuntimeState variant in v0.1.5)
- Policy Scout fossic emit — code staged in `sqlite_store.py`, not committed; no Lattica subscriber exists

### What's not yet built

- Policy Scout tile in Lattica's tree (exists as claude-design HTML mockup only)
- Fossic tile in Lattica's tree (exists as claude-design HTML mockup only)
- LumaWeave tile in Lattica's tree (exists as claude-design HTML mockup only)
- LumaWeave-Cerebra graph.json adapter in LumaWeave's source adapter registry (unbuilt per LumaWeave baseline; see §6.3 for cross-baseline conflict)
- AiStackTopologyTile Phase 2: fossic subscription to replace direct Ollama polling; Bo node live status
- LumaWeave AdapterListChanged event emission (hidden prerequisite for source switcher)
- Shared platform fossic store migration for LumaWeave (project-local fossic.db → ~/.lattica/fossic/store.db)
- Management sidecar for ai-stack (RESTART node, FORCE FAILOVER, SLEEP TIMER — require Docker socket access)
- Federation relay agents for any project (Fossic has the relay protocol drafted; none built)
- Policy Scout ALLOW SESSION enforcement, ALLOW PATTERN, Rule mute (all L-cost, pending design decisions)
- Cerebra: witness layer, daemon-to-LumaWeave tile wiring (Phase 15, roadmap TBD)

### Critical milestones reached since last baseline

- **Cerebra v0.1 shipped** — Phase 14 complete; tag `v0.1` pushed; 1675 unit tests + 11 E2E tests passing against real Ollama; all 14 CEREBRA_MVP_SPEC.md done-when criteria confirmed met
- **Fossic shipped Phases 1–6b plus debt cleanup** — v1.0.0aa; read connection pool, append_if, indexed_tags_filter, read_batch, glob subscription cursor seeding, compute_event_id all live
- **ai-stack Phase 2a sidecar live** — fossic_sidecar.py running; VramBudgetChanged, ModelLoaded, ModelUnloaded confirmed in shared store with live Ollama
- **Policy Scout LOCK DOWN bundle backend complete** — lockdown on/off --json, approval timeout, VS Code extension Phases 1–4 shipped
- **LumaWeave gwells closeout** — interaction-index bug fixed (`4f28c47`); hub-ring radius fixed (`856dcd3`); R-LW-005 fossic emitter live (`977a6e8`); re-settle cost resolved to S via reheat()
- **Lattica Track A functional wiring** — Cerebra daemon connected to CerebraSignalTile; Policy Scout CLI Tauri commands authored; CheckpointSavedRenderer registered; cerebra/control explicit subscribe

---

## Section 6 — Compile-time issues

**Lattica-claude observation:** issues encountered while compiling. Factual; no editorializing.

### Missing sections

No baseline had a missing section. All five baselines provided content for all six sections (§§1–6). Section 6 depth varied: Cerebra and Policy Scout provided the most detailed pre-federation thoughts; ai-stack and LumaWeave were directional; Fossic provided the most concrete protocol-level analysis. No section was absent; depth variation is noted for context.

### Interpretation ambiguities

**ai-stack/Bo baseline — version identifier:** ai-stack/Bo baseline does not provide a traditional semantic version. The baseline identifies the project by service versions (Ollama 0.21.0) and fossic-py version (0.1.0). The most recent milestone is "Phase 2a sidecar." Section 1 of this compile uses "Phase 2a" as the version indicator with the Docker service versions as context.

**Cerebra baseline — "Daemon is functional but not yet consumed by any Lattica tile" (§3):** This statement is stale as of v0.3.5u completion (2026-06-16). The baseline was filed on 2026-06-16; Lattica's Track A wiring (v0.3.5u) was completed the same day. The CerebraSignalTile daemon connection is live in Lattica's tree. Relayed faithfully from the baseline; noted as version drift.

### Cross-baseline conflicts

**Conflict: Cerebra graph.json adapter existence (§6.3)**
- **Cerebra baseline §3 says:** Phase 12 writes `.cerebra/graph.json` "using the `cerebra/v1` schema consumed by LumaWeave's `CerebraReadAdapter`"
- **LumaWeave baseline §3 says:** "Not built. No adapter for consuming `{vault}/.cerebra/graph.json` exists in the source adapter registry." Current adapter types listed; no CerebraReadAdapter among them.

Lattica-claude has not resolved this conflict. Both baselines are relayed faithfully. Possible interpretations: (a) Cerebra describes a planned/intended consumer that LumaWeave hasn't built yet; (b) a CerebraReadAdapter exists in LumaWeave's tree but outside the source adapter registry; (c) Cerebra is describing a future design, not current state. Developer + web-claude should verify against LumaWeave's actual source adapter registry in the federation interview round.

**Conflict: Policy Scout Tauri command response shape**
Policy Scout baseline §3 documents its own Tauri commands' response shapes with an outer `CliJsonResponse` wrapper: `{"ok": true, "exit_code": 0, "data": {...}, "error": null}`. Lattica's v0.3.5u Tauri commands shell-exec the CLI directly and parse the inner CLI JSON (without the outer wrapper): `{"ok": true, "active": true, "reason": "..."}`. Smoke confirmed Lattica's approach works against the CLI. The outer wrapper is specific to Policy Scout's own Tauri app; the inner CLI output is what Lattica parses. Not a blocking conflict but worth noting: if Lattica's tile ever needs to compare Tauri invocations across projects, the wrapper convention differs.

### Version drift since baseline collection

**Cerebra baseline:** Filed 2026-06-16; Lattica's v0.3.5u (functional daemon wiring) committed 2026-06-16. Cerebra's §3 statement "Daemon is functional but not yet consumed by any Lattica tile" reflects the state before v0.3.5u committed. In the compiled baseline, Cerebra's §3 is relayed faithfully with a note in §5 ("what's working end-to-end") reflecting the actual current state.

---

## Section 7 — Snapshot metadata

- **Compile date:** 2026-06-16
- **Baselines as-of:** All five baselines filed 2026-06-16 (same-day compile)
- **Total projects represented:** 5
- **Mandatory baselines filed:** 5/5
- **Note for next baseline pass:** A future baseline pass would use a different date stamp in the path; this snapshot remains stable at `baselines/2026-06-16/PLATFORM_BASELINE_2026-06-16.md`.

---

## What this document does NOT do

- Does NOT make federation design decisions (the federation interview round does)
- Does NOT recommend project sequencing
- Does NOT re-evaluate any project Claude's assessments
- Does NOT add content that wasn't in any source baseline
- Does NOT propose new dependencies beyond what baselines stated

End of PLATFORM_BASELINE_2026-06-16.md.
