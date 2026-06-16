---
project: cerebra
updated: 2026-06-16
updated_by: cerebra-claude
version: v0.4.0
head: 520cb46
branch: main
---

# Cerebra — Current State

Local-first cognitive runtime. Python 3.12, SQLite vault, fossic-py event store,
Click CLI. Daemon server (`cerebra serve`) on `127.0.0.1:7432`. No async — `std::thread`
equivalent via Python threading.

---

## What shipped this session (in order)

| Commit | What |
|---|---|
| `af51e00` | Phase 9 Step 1 — Full ClutchEngine (expanded predicates, cascade, escalate hook) |
| `a596fd0` | Phase 9 Step 2 — BanditSelector primitive (seventh vendored primitive) |
| `432b834` | Phase 9 Step 3 — CatalystEngine (bandit-driven cognitive strategy selector) |
| various  | TD-018 fix — `CliRunner(mix_stderr=False)` removed (Click 8.4.1 compat) |
| various  | TD-019 fix — `test_lattice_against_vault` schema check via PRAGMA, not data state |
| various  | Daemon — `cerebra serve` (4 endpoints, DaemonState, checkpoint, posture control) |
| various  | PATH fix — `~/.local/bin/cerebra` symlink → `.venv/bin/cerebra` |
| `cdca7dc` | **Phase 10 — cognitive loop closure** (Migration018, EpisodeWriter dual-write, vocab §8) |
| `520cb46` | chore: bump to v0.4.0 |

---

## Phase 10 — what changed (v0.4.0)

**Milestone: cognitive loop closes.** Cycle output is now visible to the retrieval
pipeline. EpisodeWriter.write() dual-writes atomically to:
- `cycle_episode_records` — primary, for session queries
- `memory_records` (`record_type='cycle_episode'`) — bridge, for retrieval visibility

**Migration018_SyntheticEpisodeProvenance** inserts permanent sentinel rows:
- `sources.source_id = 'cerebra_synthetic_source'` (`canonical_path = 'cerebra://cycle-episodes'`)
- `documents.document_id = 'cerebra_synthetic_document'`
- `chunks.chunk_id = 'cerebra_synthetic_chunk'`

These are FK anchors. All `memory_records` with `record_type='cycle_episode'` point to
them. They are INSERT OR IGNORE — idempotent on re-migration.

After each write, `queue_for_embedding(db_path, [record_id])` is called so the vector
index picks up cycle content (best-effort, outside the transaction).

---

## Agent trace vocabulary

`docs/planning/AGENT_TRACE_VOCABULARY.md` §8 is now the authoritative reference for
all `cerebra/*` stream event types. Covers:

- §8.1 Session/cycle lifecycle (`AgentTraceOpened`, `CycleCompleted`, `ReinjectionTriggered`)
- §8.2 Step-level (`StepExecuted`, `MemoryWriteFromCycle`)
- §8.3 Clutch/catalyst (`ClutchDecisionMade`, `CatalystInvoked`, `CatalystArmSelected`)
- §8.4 Signal evaluation (`SignalEvaluated`, `EvaluationComposed`)
- §8.5 Predictions (`PredictionMade`, `OutcomeRecorded`)
- §8.6 Daemon/control (`PostureChanged` on `cerebra/control`, `CheckpointSaved` on `cerebra/agent-trace/<session_id>`)

---

## Daemon surface (stable since v0.3.7)

`cerebra serve` — `http://127.0.0.1:7432` (CEREBRA_DAEMON_URL override)

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | liveness; returns `{"status":"ok","posture":"auto|hold"}` |
| `/posture` | POST | `{"posture":"hold"|"auto"}` — emits `PostureChanged` on `cerebra/control` |
| `/checkpoint` | POST | `{"session_id":"..."}` — emits `CheckpointSaved` on session stream |
| `/status` | GET | full daemon state snapshot |

---

## retrieval_pipeline surface (for Lattica queries)

Memory retrieval reads from `memory_records`. Since Phase 10, entries with
`record_type='cycle_episode'` appear here alongside `source_chunk` entries.
Distinguish them by `record_type` in any retrieval display.

---

## Open deferred items

| ID | Item | Severity |
|---|---|---|
| — | Scorer weighting: cycle_episode vs source_chunk (retrieval ranking) | medium |
| — | Old cycle_episode_records backfill decision (pre-Phase 10 episodes not in memory_records) | low |
| — | Traversal edge cases (lattice lineage across cycle boundaries) | low |
| — | `cerebra --version` hardcoded "0.0.0" (cosmetic) | negligible |
| daemon-v1 | Lattica iter-5 Track B — HOLD/checkpoint button integration | pending Lattica |
