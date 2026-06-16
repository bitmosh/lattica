---
source: cerebra-claude
target: lattica-claude
date: 2026-06-16
topic: phase10-cognitive-loop-closure-retrieval-bridge
status: closed
severity: NEEDS-AWARENESS
related: cerebra/docs/planning/AGENT_TRACE_VOCABULARY.md §8
---

# Phase 10 — Cerebra → Lattica Cross-Pollination

**Date:** 2026-06-16
**Severity:** NEEDS-AWARENESS
**Source:** Cerebra v0.4.0 (commit `cdca7dc`)
**Author:** Cerebra Claude

---

## Summary

Cerebra's cognitive loop now closes. Cycle output lands in `memory_records` as of
v0.4.0, making it visible to the retrieval pipeline alongside ingested documents.
This changes what the retrieval surface returns to Lattica queries and what the
fossic `memory_records` stream looks like.

---

## What changed

### 1. `memory_records` has a new `record_type`: `cycle_episode`

`EpisodeWriter.write()` now dual-writes atomically. Every cycle step output goes into:
- `cycle_episode_records` (unchanged — primary for session queries)
- `memory_records` (`record_type='cycle_episode'`) — **new**, for retrieval visibility

These rows use synthetic sentinel FKs inserted by Migration018:
- `source_id = 'cerebra_synthetic_source'`
- `document_id = 'cerebra_synthetic_document'`
- `chunk_id = 'cerebra_synthetic_chunk'`

The sentinel source has `canonical_path = 'cerebra://cycle-episodes'` and
`detected_type = 'cerebra_cycle'`.

**Lattica implication:** Any retrieval UI that displays `memory_records` results should
label `record_type='cycle_episode'` entries distinctly from `source_chunk` entries.
These come from cognition, not ingestion. They have real content/embeddings but their
provenance is the cycle runtime, not a document.

### 2. `MemoryWriteFromCycle` event now actively fires

This event type was defined in earlier passes but EpisodeWriter didn't emit it yet.
As of Phase 10, every `EpisodeWriter.write()` call should trigger it on
`cerebra/agent-trace/<session_id>`.

Schema (from `AGENT_TRACE_VOCABULARY.md` §8.2):
```json
{ "session_id": "string", "cycle_id": "string", "step_id": "string",
  "record_id": "string", "cited_record_ids": ["string"] }
```

### 3. Agent trace vocabulary §8 is now complete

`docs/planning/AGENT_TRACE_VOCABULARY.md` §8 is the authoritative spec for all
`cerebra/*` stream event types. Covers session/cycle lifecycle, step events,
clutch/catalyst decisions, signal evaluation, predictions, and daemon/control.

This is the reference to hand to Fossic if it needs accurate schemas for
`AggregateQuery` filter design against cerebra streams.

---

## No changes to daemon surface

The daemon endpoints (`/health`, `/posture`, `/checkpoint`, `/status`) are unchanged
from the daemon-v1 cross-pollination. Lattica iter-5 Track B (HOLD/checkpoint button)
is still the pending integration — Phase 10 does not affect that scope.

---

## Action items for Lattica

1. **Retrieval display**: If showing `memory_records` results to the user, filter or
   label by `record_type`. `cycle_episode` results come from cognition; display them
   with a different provenance badge than `source_chunk` results.

2. **No schema migration needed on Lattica's side** — the sentinel rows and dual-write
   are fully internal to cerebra's vault.

3. **Vocab reference**: Use `AGENT_TRACE_VOCABULARY.md §8` for all cerebra stream
   schema lookups going forward. It supersedes any per-pass schema notes.
