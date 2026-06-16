# Cerebra — Current State Baseline

**Date:** 2026-06-16
**Filed by:** cerebra-claude

---

## Section 1 — Current version + identity

- **Current version:** 0.4.4 (pyproject.toml); `cerebra --version` reports 0.4.0 due to stale editable install — actual shipped version is 0.4.4.
- **Most recent tag:** `v0.1` (pushed 2026-06-16, commit 4efb2bb)
- **Most recent milestone:** Phase 14 — Integration Testing and Polish. Full spine E2E test (ingest → run-cycle → retrieve → export graph → inspect events) passing against real Ollama. All 14 v0.1 done-when criteria from CEREBRA_MVP_SPEC.md confirmed met.
- **Identity:** Cerebra is a local-first cognitive cycle runtime that maintains durable memory, evaluates LLM outputs across six epistemological signals, enforces capability and leeway bounds, and emits graph-native events — the execution engine that Bons.ai will eventually express as configuration.

---

## Section 2 — What just shipped since last baseline

Reference point: approximately v0.4.0 era (WEB_CLAUDE_BRIEF_ITER5.md authoring).

**Phase 11 — Lifecycle manager (v0.4.1, commit c271d3b)**
`cerebra lifecycle archive/tombstone/restore` — three state transitions on memory records. Archive excludes from retrieval (reversible). Tombstone is permanent (blocks re-ingestion). Restore reverts archived records. All transitions emit `MemoryRecordArchived`, `MemoryRecordTombstoned`, `MemoryRecordRestored` events to `inspector_events`.

**Phase 12 — Graph export (v0.4.2, commit 04c4022)**
`cerebra export graph` writes `.cerebra/graph.json` using the `cerebra/v1` schema consumed by LumaWeave's `CerebraReadAdapter`. Node types: `spine` (source documents) and `memory_record`. Edge types: `contains`, `describes`, `sku-proximity`, `sku-exact`. Emits `GraphExported` event. Also wired into the `ingest` command as an automatic post-ingest step.

**Phase 13 — Inspector CLI (v0.4.3, commit dbe81bd)**
`cerebra inspect` — full observability surface with six command trees: `session list/show`, `cycle show`, `memory show`, `retrieval show`, `leeway active/history/revocations`, and `query` (event query with `--event-type`, `--signal-low`, `--severe-misses`, `--tail`, `--filter`, `--last`, `--cycle`). `inspect query --tail` polls `inspector_events` via rowid; FossicStore events are accessible via `--event-type` on the FossicStore-backed subcommands. Added `FossicStore.read_events()` helper for stream/aggregate reads. 34 new unit tests.

**Phase 14 — Integration Testing and Polish / v0.1 ship gate (v0.4.4, commit 4efb2bb, tag v0.1)**
`tests/integration/test_e2e_spine.py` — 11 E2E tests covering the full pipeline against a real Ollama instance (`huggingface.co/unsloth/granite-4.1-3b-GGUF:Q4_K_M`). Tests cover: ingest, memory record verification, Ollama health check, cycle execution with step result verification, `cycle_episode_records` write, FossicStore event emission, `inspector_events` write, retrieval pipeline, graph export JSON validity. Runs in ~28s. README rewritten for v0.1 with quickstart, prerequisites, and architecture overview. `examples/docs/` added with three sample documents for demo vault use.

---

## Section 3 — Visual elements available for Lattica

### FossicStore event streams

All cognitive session events emit to `cerebra/agent-trace/<session_id>`. Lattice node events emit to `cerebra/lattice/<lineage_id>`.

| Event type | Stream | Key payload fields | LumaWeave renderer | P-013 follow-up? |
|---|---|---|---|---|
| `SessionOpened` | `cerebra/agent-trace/<session_id>` | `session_id`, `goal`, `cycle_config`, `recursion_depth`, `vault_path` | No | Yes — session lifecycle tile |
| `CycleStarted` | `cerebra/agent-trace/<session_id>` | `session_id`, `cycle_id`, `config_name`, `goal`, `step_count` | No | Yes — cycle timeline |
| `StepStarted` | `cerebra/agent-trace/<session_id>` | `session_id`, `cycle_id`, `step_id`, `step_name`, `step_index` | No | Yes |
| `StepExecuted` | `cerebra/agent-trace/<session_id>` | `session_id`, `cycle_id`, `step_id`, `step_name`, `output_text` (truncated), `composite_score` | No | Yes |
| `StepExecutionFailed` | `cerebra/agent-trace/<session_id>` | `session_id`, `cycle_id`, `step_id`, `error` | No | Yes |
| `SignalEvaluated` | `cerebra/agent-trace/<session_id>` | `signal_name`, `signal_score`, `signal_strength`, `low_confidence`, `evaluated_at`, `evaluator_prompt_version` | No | Yes — spider/radar chart per step |
| `ClutchDecisionMade` | `cerebra/agent-trace/<session_id>` | `action`, `rule_matched`, `cascade_depth`, `escalate_to_catalyst` | No | Yes — decision timeline node |
| `LeewayGrantApplied` | `cerebra/agent-trace/<session_id>` | `rule_id`, `session_id`, `grant_reason`, `escalation_level` | No | Yes |
| `LeewayGrantDenied` | `cerebra/agent-trace/<session_id>` | `rule_id`, `reason` | No | Yes |
| `LeewayRevocationFired` | `cerebra/agent-trace/<session_id>` | `rule_id`, `revocation_reason` | No | Yes |
| `PredictionMade` | `cerebra/agent-trace/<session_id>` | `predicted_composite`, `confidence`, `model_version`, `step_id` | No | Yes — prediction vs actual plot |
| `PredictionSevereMiss` | `cerebra/agent-trace/<session_id>` | `prediction_error`, `expected`, `actual` | No | Yes |
| `MemoryWriteFromCycle` | `cerebra/agent-trace/<session_id>` | `record_id`, `cycle_id`, `summary_text`, `source_record_ids` | No | Yes — links cycle → memory |
| `ContextPacketBuilt` | `cerebra/agent-trace/<session_id>` | `trace_id`, `query`, `selected_record_count`, `abstained` | No | Maybe |
| `ContinuationBundleCreated` | `cerebra/agent-trace/<session_id>` | `bundle_id`, `parent_session_id`, `distilled_context_length` | No | Low priority |
| `ReinjectionTriggered` | `cerebra/agent-trace/<session_id>` | `parent_session_id`, `child_session_id`, `trigger_reason` | No | Yes — re-injection arc |
| `CatalystInvoked` | `cerebra/agent-trace/<session_id>` | `session_id`, `arm_count`, `selected_arm` | No | Yes — bandit arm selection |
| `BanditSelection` | `cerebra/agent-trace/<session_id>` | `arm_id`, `arm_name`, `epsilon`, `was_explore` | No | Yes |
| `CycleCompleted` | `cerebra/agent-trace/<session_id>` | `session_id`, `cycle_id`, `outcome`, `total_steps`, `completed_at` | No | Yes — cycle summary |
| `SessionFlushed` | `cerebra/agent-trace/<session_id>` | `session_id`, `outcome`, `total_cycles`, `total_steps` | No | Yes |
| `CheckpointSaved` | `cerebra/agent-trace/<session_id>` | `session_id`, `bundle_id` | No | Low priority |
| `LatticeCommit` | `cerebra/lattice/<lineage_id>` | `lineage_id`, `record_id`, `commit_type` | No | Yes — lattice graph node |

### SQLite inspector_events (dual-written, accessible via `cerebra inspect query`)

Categories: ingest pipeline events (`SourceRegistered`, `SourceParsed`, `DocumentNormalized`, `MemoryRecordCreated`, `SKUAssigned`, `EmbeddingGenerated`, `LexicalIndexUpdated`), retrieval events (`QueryPlanned`, `TraversalStepCompleted`, `SalienceScored`, `RetrievalAbstained`, `TraceWritten`), working memory events (`AttentionItemPromoted`, `AttentionItemEvicted`, `TowerInitialized`, `TowerItemPromoted`, `TowerItemEvicted`), graph events (`GraphNodeCreated`, `GraphEdgeCreated`, `GraphExported`), lifecycle events (`MemoryRecordArchived`, `MemoryRecordTombstoned`, `MemoryRecordRestored`), governance events (`GateDecision`, `LeewayPreActionGate`).

Not relayed to LumaWeave today. All readable via `cerebra inspect query --tail` and `--event-type`.

### HTTP daemon endpoints (cerebra serve, port 7474)

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/status` | — | `{posture, cycle_running, active_session_id, cycle_count, last_outcome}` |
| POST | `/posture` | `{"state": "hold"\|"auto"}` | `{"posture": "hold"\|"auto"}` |
| POST | `/cycles` | `{"config_name": "...", "goal": "..."}` | `{"cycle_id": "...", "session_id": "..."}` (async, returns immediately) |
| POST | `/checkpoint` | `{}` | `{"bundle_id": "...", "session_id": "..."}` |

Daemon is functional but not yet consumed by any Lattica tile. LumaWeave integration is a planned but unstarted follow-up.

### File artifacts

**`.cerebra/graph.json`** — exported knowledge graph in `cerebra/v1` schema. Consumed by LumaWeave's `CerebraReadAdapter` tile.

Schema: `{nodes: [...], edges: [...]}`. Node fields: `id` (`source:<id>` or `record:<id>`), `label`, `fullLabel`, `type` (`spine`|`memory_record`), `cluster`, `status`, `tags`, `size`, `path`, `lastModified`, `raw: {detected_type, source_id, record_count, sku_address, d1, d1_category, quadrant, ...}`. Edge fields: `id`, `source`, `target`, `type` (`contains`|`describes`|`sku-proximity`|`sku-exact`), `raw`.

LumaWeave has a `CerebraReadAdapter` that reads this file. Whether it has a full tile renderer is not known from Cerebra's side.

---

## Section 4 — Open items / known follow-ups

**Cleanup / polish:**
- PD-001: `render_template` uses regex substitution instead of Jinja2. No conditionals/loops in cycle configs yet, so not blocking, but will be when config complexity grows.
- PD-002: `ELEVATED_SALIENCE = 0.8` constant is a guess — not calibrated against Phase 5 default salience.
- PD-003: Methodology lessons from Phase 8 not consolidated into a permanent reference.
- PD-004: Per-version deviation logs scattered across `docs/agent/deviations/`; no "all open deviations" index.
- PD-005: Two sessions tables (`runtime_sessions` vs `sessions`) not documented outside deviation log.
- PD-006: Cycle config prompt templates don't tell the LLM what citation format to use.
- PD-008: `docs/aseptic/README.md` is fossic-framed, not Cerebra-framed.

**Tech debt (open):**
- TD-001: Purge workflow audit path — when Cerebra implements purge, must read `_fossic/system` stream not original stream.
- TD-002: LoRA v0.2 training resume — corpus imbalance deferred pending real-world cycle data.
- TD-003: Lattica-primitives PyPI extraction — vendored into `_primitives/`; extraction deferred until 2+ stable consumers.
- TD-008: Crypto-shredding session deletion — depends on fossic v1.1.
- TD-009: OTel GenAI export — depends on fossic shipping the exporter.
- TD-011: Phase 8 benchmark re-run with realistic LatticeNodeReducer.
- TD-012: Pre-action constitutional rule shape — `ConstitutionalRule.forbids()` always returns False in v0.1 (DEV-009).
- TD-013: HITL review flow — `GateDecision.review_required_by` field exists but is never populated.
- TD-017: Citation parsing is best-effort regex — silent extraction failure if LLM drifts from format.
- TD-018: `CliRunner(mix_stderr=False)` compat — affects 39 tests across three CLI test files.
- TD-019: `test_lattice_against_vault.py` vault-disk failure — one test, unknown root cause.

**Would do next without external direction:**
- Close TD-018 (small, known fix)
- Close TD-019 (investigate)
- Begin Phase 15 (post-v0.1 roadmap TBD; likely witness layer or daemon-to-LumaWeave tile wiring)

---

## Section 5 — Cross-project signal

**fossic:** Cerebra is actively using fossic (FossicStore wrapping the local `.fossic/store.db`). The `read_events()` method added in Phase 13 uses both `ReadQuery(stream_id=...)` and `AggregateQuery(stream_pattern=...)`. Snapshots are taken automatically every 20 events per stream via `EventEmitter`. The purge audit path (TD-001) will matter when fossic v1.1 ships crypto-shredding. One open question: `stream_exists()` — Cerebra calls this before `ReadQuery` to avoid errors on non-existent streams; if the API changes, `FossicStore.read_events()` needs updating.

**LumaWeave:** Cerebra's graph export (`cerebra/v1` schema, `.cerebra/graph.json`) is the primary cross-project data path today. Whether LumaWeave's `CerebraReadAdapter` is actively maintained or stale is unknown from Cerebra's side. Cerebra's daemon (`cerebra serve`) exposes HTTP endpoints that LumaWeave could poll but no tile uses them yet. If LumaWeave's registry model is being migrated to, Cerebra's daemon would benefit from knowing the expected tile registration contract before wiring anything.

**Policy Scout:** No direct dependency or data path today. Constitutional rule shape (TD-012) may eventually align with Policy Scout's scope. Pre-action blocking semantics are currently a stub.

**ai-stack:** Cerebra depends on Ollama running at `http://127.0.0.1:11434` (or `OLLAMA_BASE_URL`). The health check probe at `OllamaDirectAdapter.health_check()` uses a minimal inference call to warm the model. The ai-stack's LiteLLM proxy (port 4000) also works but Cerebra defaults to direct Ollama. If the ai-stack changes model availability or port mapping, Cerebra's adapter config (`OLLAMA_MODEL` env var, default `huggingface.co/unsloth/granite-4.1-3b-GGUF:Q4_K_M`) may need updating.

**Lattica:** No direct runtime dependency. Cross-project coordination is currently through file artifacts (graph.json) and this baseline.

---

## Section 6 — Pre-federation exploratory thoughts

**Events that would stay local (high-volume, internal-only):**
The ingest pipeline events are the clearest candidates for local-only: `SourceRegistered`, `SourceParsed`, `DocumentNormalized`, `ChunkCreated`, `MemoryRecordCreated`, `EmbeddingGenerated`, `LexicalIndexUpdated`, `SKUAssigned`. These are high-volume (one per chunk/record), highly specific to vault state, and have no natural consumer outside Cerebra. Similarly, retrieval internals: `TraversalStepCompleted`, `SalienceScored`, `LatticeSiblingResolved` — useful for `cerebra inspect` but not meaningful to a Lattica hub without heavy context.

Working memory internals would also stay local: `AttentionItemProposed`, `AttentionItemEvicted`, `AttentionItemDeferred`, tower tier operations. These track contested slot state that is transient and vault-specific.

**Events that would relay to Lattica's hub (integration-worthy, observable cross-project):**
- `CycleStarted` / `CycleCompleted` — coarse lifecycle markers, low-volume, meaningful for cross-project dashboards
- `SignalEvaluated` — per-step quality scores across six dimensions; useful for Lattica to track Cerebra's cognitive quality over time
- `ClutchDecisionMade` — decision audit; observable from outside (was the cycle stopped? for what reason?)
- `PredictionSevereMiss` — anomaly signal; worth surfacing cross-project
- `MemoryWriteFromCycle` — records that memory was created from a cycle; relevant for Lattica's graph if it tracks memory provenance
- `ReinjectionTriggered` — cycle topology event; meaningful if Lattica is tracking session depth and branching
- `GraphExported` — file artifact produced; Lattica hub could use this as a "Cerebra graph is fresh" trigger
- `LeewayGrantApplied` / `LeewayRevocationFired` — safety governance events; worth cross-project visibility

**Existing data paths that might fold into local fossic store:**
- `inspector_events` SQLite table — this is the most obvious candidate. Currently dual-writing some events (ingest pipeline, retrieval, WM) to SQLite and some (cycle runtime) to FossicStore. The split exists because the cycle events needed versioned streams (FossicStore's strength) and the ingest/retrieval events needed fast queryability by event_type and subject_id (SQLite's strength). If fossic gains efficient event_type filtering on aggregate queries, the SQLite dual-write could collapse into fossic-only.
- `.cerebra/graph.json` — a file artifact that's currently the sole integration point with LumaWeave. Could eventually become a FossicStore projection (a `GraphExported` event payload containing the full graph), which would version it and make the history inspectable.
- `retrieval_traces`, `retrieval_steps`, `retrieval_candidates` SQLite tables — detailed retrieval provenance. Currently SQLite-only. Could eventually be FossicStore projections for temporal querying ("how did retrieval quality change over sessions?").
- `runtime_sessions` table — session lifecycle. Already mirrored in FossicStore (`SessionOpened`, `SessionFlushed`). The SQLite table exists for fast lookup (`read_session()` by session_id); the fossic stream is the authoritative event log. This split is intentional and probably correct to keep.

**Fossic features I'd specifically want to use:**
- **`append_if`** — for leeway grants: "apply this grant only if the rule hasn't already fired in this stream." Currently handled in application code; `append_if` would make it atomic.
- **Branches** — TD-006 deferred. Counterfactual cognition (run two cycle variants, compare outcomes, keep the winner) is a natural use case for cognitive branching once v0.2 work begins.
- **Snapshots** — already using via `EventEmitter` (every 20 events per stream). Working as expected; no issues.
- **Aggregates** — using `AggregateQuery(stream_pattern=...)` for leeway and signal queries. Would benefit from efficient `event_type_filter` on aggregates; currently filtering in Python after pulling all events matching the pattern.
- **Transforms / projections** — if fossic gains a projection layer, the graph.json artifact could be computed from the FossicStore event stream rather than from SQLite queries. That would make graph state versioned and diffable.
- **Similarity search** — possible future use for memory retrieval: if fossic gains vector-aware storage, some of the SQLite embedding index work could fold into it.

**Concerns and unknowns about federation:**
- The stream naming (`cerebra/agent-trace/<session_id>`) is scoped to one vault. If a user has multiple vaults, they have independent FossicStore instances with overlapping stream naming schemes. Federation would need to understand that `cerebra/agent-trace/<session_id>` is vault-scoped, not globally unique.
- Relay agents propagating events to Lattica's hub need to know which streams to subscribe to. Since streams are named by `session_id` at open time, the relay agent needs to discover active session IDs dynamically (probably via `SessionOpened` events on a well-known aggregate pattern, or via the daemon's `/status` endpoint).
- Event volume: if the relay agent subscribes to `cerebra/agent-trace/*` and forwards all events, the hub gets the full cycle execution trace. That's probably too much for a hub. The relay should likely filter to the "integration-worthy" subset listed above.
- The two-store split (FossicStore + SQLite) means a relay agent needs access to both to get the full picture. A relay that only reads FossicStore misses ingest pipeline events, retrieval traces, and working memory state. Either the relay reads both, or some of the SQLite events need to migrate to fossic first.
