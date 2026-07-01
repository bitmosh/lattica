# Cross-Pollination — fossic

All cross-pollination passes, chronological.

> **Note:** Rhyzome, bons.ai, and discord-bot are deprecated and removed from the platform. References to those modules in passes below are historical records of communications sent at the time; they no longer represent active consumers.

---

## fossic


---

## pass-09

---
pass: 9
version: v0.9.0
date: "(retroactive estimate, not verified)"
impacts: [cerebra, policy-scout, bo]
---

# Cross-Pollination — Pass 9 (v0.9.0)

> All items in this file are retroactive estimates created at the Aseptic bootstrap
> (Pass v0.10.x). Verify against git log before trusting as precise record.

## cerebra

**Severity:** NEEDS-AWARENESS

**What changed:** `Store.open()` in the Python binding now expands tilde (`~`) paths
before passing to SQLite. A call like `Store.open("~/.fossic/store.db")` previously
created a file at a literal path starting with `~`; it now opens the correct
home-relative path.

**Action required:** Verify any existing `Store.open()` calls in cerebra. If cerebra
uses `os.path.expanduser()` before passing a path, the behavior is unchanged (double
expansion is safe — expanduser on an already-expanded path is a no-op). If cerebra
passes a raw `~` path, behavior has changed to be correct.

**Advocate-agent message:**
> fossic v0.9.0 shipped. `Store.open()` in the Python binding now handles tilde
> expansion internally.
>
> Impact for cerebra: any `Store.open()` call with a `~`-prefixed path now correctly
> resolves to the home directory. If you were using `os.path.expanduser()` as a
> workaround, you can remove it (double expansion is safe) or leave it — no breaking
> change either way.
>
> Severity: NEEDS-AWARENESS. Verify your Store.open() call sites; most likely no
> action required.

---

## policy-scout

**Severity:** FYI

**What changed:** Same tilde expansion note as cerebra. Policy Scout's store paths
likely use absolute paths or env vars; tilde expansion is probably irrelevant but
confirmed no breaking change.

**Advocate-agent message:**
> fossic v0.9.0: Store.open() now handles ~ paths. Impact for policy-scout: FYI only.
> If your store path uses an absolute path or an env var, no change. No action needed.

---

## bo

**Severity:** FYI — same as policy-scout. No action needed.

---

## lumaweave, ai-stack

No impact. lumaweave uses Node binding (unchanged). ai-stack is indirect. (rhyzome and
bons.ai were benched at time of writing; now deprecated.)

---

## pass-10.0.t

---
pass: 10.0.t
version: v0.10.0t
date: 2026-06-12
summary: Cerebra's Phase 6/7/8 cycle runtime vocabulary contribution landed in AGENT_TRACE_VOCABULARY.md.
---

# Cross-Pollination — Pass 10.0.t (v0.10.0t)

> Cross-pollination records what adjacent projects need to know about changes made
> in this pass. Severity: **FYI** = awareness only, **NEEDS-AWARENESS** = read before
> implementing the named feature, **ACTION-REQUIRED** = breaking change; act before
> consuming the updated API.

---

## Cerebra

**Severity: NEEDS-AWARENESS**

Your Phase 6/7/8 cycle runtime vocabulary contribution is now canonical at `AGENT_TRACE_VOCABULARY.md §7`. The Consumer Extension Registry table includes Cerebra at §2. The OTel mapping table includes all 22 Cerebra event types at §8.2.

**What changed:** Your contribution (from `cerebra_phase6_event_vocabulary.md`) has been integrated into the fossic canonical vocabulary reference. Payload content was preserved exactly; formatting was adapted to match the doc's JSON code block style (from bullet lists). Stream pattern lock language was preserved verbatim per the "language is the contract" instruction.

**One discrepancy to resolve:** The pass prompt listed `StepExecutionFailed` as one of 23 events in the step execution group. Your contribution document defines 22 events — `StepExecutionFailed` has no schema there. It was not added (no fabricated schema). If this event type is planned for Phase 7/8, please provide its schema in a follow-up contribution.

**Suggested action:** When Phase 7/8 implementation references the canonical vocabulary, link to `AGENT_TRACE_VOCABULARY.md §7` rather than the contribution document. Your `cerebra_phase6_event_vocabulary.md` remains the implementation-side reference with full `indexed_tags` recommendations and required-vs-optional field rationale. For `StepExecutionFailed`, either add it to your contribution doc and file a follow-up integration pass, or confirm it was an editorial error in the pass prompt.

**Pre-drafted advocate-agent message:**
"Cerebra Phase 6/7/8 cycle runtime vocabulary is now canonical in fossic's AGENT_TRACE_VOCABULARY.md at §7. Consumer Extension Registry includes Cerebra at §2. OTel mapping includes all 22 defined events at §8.2. Your contribution landed without modification beyond editorial formatting to match the receiving doc's style. Phase 7/8 implementation can reference the canonical doc. One open item: `StepExecutionFailed` was listed as event 23 in the pass prompt but has no schema in your contribution — please confirm whether it's planned for Phase 7/8."

---

## LumaWeave

**Severity: NEEDS-AWARENESS**

`AGENT_TRACE_VOCABULARY.md` now documents Cerebra's 22 cycle runtime event types and the complete OTel GenAI span mapping for those events. When LumaWeave's time-travel viewer renders Cerebra cycle traces, use this as the canonical reference.

**What changed:** §7 documents all 22 Cerebra event types with full JSON payload schemas. §8.2 documents the OTel span structure: span hierarchy is session > cycle > step (INTERNAL spans throughout). Re-injection sessions are linked via OTel span links on `ReinjectionTriggered`.

**Suggested action:** Reference `AGENT_TRACE_VOCABULARY.md §7` and §8.2 when designing the time-travel viewer's cycle rendering. The span hierarchy (session > cycle > step) maps directly to LumaWeave's expected visualization shape. The `gen_ai.cerebra.*` namespace is the attribute reference for Cerebra-specific span attributes.

---

## Policy Scout / Bo / ai-stack

**Severity: FYI**

The Consumer Extension Registry pattern now exists at §2. If these projects develop their own agent-trace event vocabularies, §2 is where a new row gets added, and a new section (§10+) is where the events get documented.

No action required. Awareness only.

---

## Rhyzome / bons.ai *(deprecated — historical record only)*

**Severity: FYI**

AGENT_TRACE_VOCABULARY.md section numbers shifted — rhyzome vocabulary was §5 (was §4); bons.ai vocabulary was §6 (was §5). These modules are now deprecated; no action needed.

---

## pass-10.1

---
pass: 10.1
version: v0.10.1
date: 2026-06-12
summary: Add event_type_filter to ReadQuery across all four layers
---

# Cross-Pollination — Pass 10.1 (v0.10.1)

> Cross-pollination records what adjacent projects need to know about changes made
> in this pass. Severity: **FYI** = awareness only, **NEEDS-AWARENESS** = read before
> implementing the named feature, **ACTION-REQUIRED** = breaking change; act before
> consuming the updated API.

---

## Cerebra

**Severity: FYI**

- `ReadQuery` now accepts `event_type_filter`. Cerebra's `LatticeNodeReducer` replays
  all events on a stream (no filter needed) — no action required. If Cerebra later
  needs to read only specific event types from a mixed stream, `event_type_filter` is
  now available.

---

## Policy Scout

**Severity: NEEDS-AWARENESS**

- The primary motivation for this pass was Policy Scout's use case: reading only
  `PolicyViolation` events from a mixed audit stream without client-side filtering.
  When Policy Scout implements its audit stream reader, use:
  ```python
  store.read_range(ReadQuery(stream_id="policy-scout/audit", event_type_filter="PolicyViolation"))
  ```
  Server-side filtering; no bandwidth waste on non-violation events.

---

## LumaWeave (src/)

**Severity: FYI**

- `fossic_read_range` Tauri IPC command now accepts `event_type_filter` as an optional
  parameter. Existing calls without the parameter continue to work (Tauri deserializes
  absent JSON keys as `None`). If LumaWeave uses `read_range` IPC calls and wants to
  filter by event type, it can now pass `eventTypeFilter` in the IPC payload.

- `fossic-node` `index.d.ts` was empty before this pass — now fully populated. If
  LumaWeave imports TypeScript types from `fossic`, it can now get proper type checking.

---

## Bo / ai-stack

**Severity: FYI**

- No impact. Bo reads events but does not use `ReadQuery` with type filtering yet.

---

## Rhyzome *(deprecated — historical record only)*

**Severity: FYI**

- Rhyzome used `read_range` for stream introspection. Module is now deprecated.

---

## bons.ai *(deprecated — historical record only)*

**Severity: FYI**

- The `event_type_filter` field added ReadQuery parity with AggregateQuery. Module is now deprecated.

---

## pass-10

---
pass: 10
version: v0.10.0
date: "(retroactive estimate, not verified)"
impacts: [cerebra]
---

# Cross-Pollination — Pass 10 (v0.10.0)

> All items in this file are retroactive estimates created at the Aseptic bootstrap
> (Pass v0.10.x). Verify against git log before trusting as precise record.

## cerebra

**Severity:** NEEDS-AWARENESS

**What changed:** The Python `read_state` path now uses snapshot caching via the Rust
DynReducer bridge instead of full-event replay. Functionally identical output; substantially
different performance characteristic. The aggregate volume benchmark confirmed: p99 with
snapshot every 10 events is 0.054ms; with no snapshot, 46.6ms.

The benchmark also confirmed that the PyO3 bridge overhead is ~47μs/event. For Cerebra's
use case (thousands of lattice-node streams, continuous event appends), a snapshot cadence
of every 10 events keeps individual `read_state` calls well under 1ms. Without regular
snapshots, latency grows linearly with event count.

**Action required:**
1. The DynReducer protocol now requires class-level attributes: `name: str`, `version: int`,
   `state_schema_version: int` in addition to `initial_state()` and `apply()`. Verify
   Cerebra's reducer classes have these attributes.
2. Implement a snapshot cadence policy. `Store.take_snapshot(stream_id, branch)` should
   be called after every ~10 appends for each active lattice-node stream to keep `read_state`
   sub-millisecond.

**Advocate-agent message:**
> fossic v0.10.0 shipped. read_state now uses snapshot caching via the Rust DynReducer
> bridge (was: pure-Python full-event replay every call).
>
> Impact for cerebra:
>
> 1. Reducer protocol update required: your reducer classes must now have class-level
>    attributes `name: str`, `version: int`, `state_schema_version: int`. If missing,
>    `register_reducer` will raise at registration time (fail-loudly). Verify your
>    reducer classes.
>
> 2. Snapshot cadence matters now. Benchmark result: p99 with snap every 10 events =
>    0.054ms; p99 with no snap (1000-event replay) = 46.6ms. For lattice-node streams
>    with continuous appends, call `take_snapshot(stream_id, "main")` every ~10 appends
>    per stream. Without this, read_state latency will grow linearly with event count.
>
> The output of read_state is functionally identical — only the performance profile changed.
>
> Severity: NEEDS-AWARENESS. Action required: verify reducer class attributes; implement
> snapshot cadence.

---

## bons.ai *(deprecated — historical record only)*

**Severity:** FYI

**What changed:** Same DynReducer protocol update as cerebra. bons.ai was benched at
time of writing; module is now deprecated.

---

## policy-scout, bo, lumaweave, ai-stack

No impact. policy-scout and bo don't use reducers. lumaweave uses the Node binding
(no Python reducer path). ai-stack is indirect. (rhyzome was benched at time of writing; now deprecated.)

---

## pass-10.v

---
pass: 10.v
version: v0.10.v
date: 2026-06-12
summary: Spec clarification — purge semantics, branch conventions, BranchInfo fields, tilde expansion, upcaster docstring
---

# Cross-Pollination — Pass 10.v (v0.10.v)

> Cross-pollination records what adjacent projects need to know about changes made
> in this pass. Severity: **FYI** = awareness only, **NEEDS-AWARENESS** = read before
> implementing the named feature, **ACTION-REQUIRED** = breaking change; act before
> consuming the updated API.

---

## Cerebra

**Severity: FYI**

- Purge semantics clarified in §9.3. `read_one` returns `None` after purge; the
  `Purged` audit event is in `_fossic/system`, NOT in the original stream. Cerebra
  has not implemented purge workflows yet — no action needed now, but ensure Cerebra's
  purge path (when implemented) reads `_fossic/system` for audit, not the original stream.

---

## Policy Scout

**Severity: FYI**

- `list_branches` behavior documented in §8 ("Default branch convention"): returns empty
  list for streams with no forked branches — not an error, not an indication that main
  doesn't exist. If Policy Scout audits branch state, it should not treat an empty
  `list_branches` result as "no history."

---

## LumaWeave (src/)

**Severity: NEEDS-AWARENESS**

- §4.3 (Node binding) now has an explicit note: `Store.open` expands `~` paths via
  `shellexpand`. If LumaWeave's Tauri backend opens a fossic store with a tilde path
  via the Node binding (unlikely — the Tauri path uses the Rust core directly), do not
  pre-expand the path. The Rust `Store::open` does NOT apply shellexpand (only the
  language bindings do); for the Tauri consumer, use `app.path().app_data_dir()` as
  shown in §4.4.

---

## Bo / ai-stack

**Severity: FYI**

- No impact. Spec clarifications in this pass do not affect Bo's use of fossic (Bo
  is Python, reads events, does not use branches or purge).

---

## Rhyzome *(deprecated — historical record only)*

**Severity: FYI**

- `BranchInfo` field names documented canonically in §8: `.id`, `.lifecycle`
  (not `.branch_id`, `.status`). Module is now deprecated.

---

## pass-8.5

---
pass: 8.5
version: v0.8.1
date: "(retroactive estimate, not verified)"
impacts: [lumaweave]
---

# Cross-Pollination — Pass 8.5 (v0.8.1)

> All items in this file are retroactive estimates created at the Aseptic bootstrap
> (Pass v0.10.x). Verify against git log before trusting as precise record.

## lumaweave

**Severity:** NEEDS-AWARENESS

**What changed:** The Node binding subscription surface now correctly implements
`[Symbol.asyncIterator]` and `[Symbol.asyncDispose]` via a JS wrapper class in
`fossic-node/index.js`. Prior to v0.8.1, subscriptions were accessible but could
not be used with `for await...of` syntax or the `await using` disposer pattern.

**Action required:** Verify. If LumaWeave's planned Graph B (live state) integration
with fossic subscriptions uses `for await...of`, it can now proceed. No breaking
changes — this is additive.

**Advocate-agent message:**
> fossic v0.8.1 shipped. Node binding subscriptions now implement Symbol.asyncIterator
> and Symbol.asyncDispose correctly via a JS wrapper class.
>
> Impact for lumaweave: Graph B's live-state subscription pattern (`for await (const event of store.subscribe(streamId))`) is now available in the Node binding. No changes needed if you haven't integrated yet; this unblocks the Graph B subscription integration when you're ready.
>
> Severity: NEEDS-AWARENESS. No action needed now.

---

## cerebra, policy-scout, bo, ai-stack

No impact. Python binding unchanged. This pass touched only `fossic-node/index.js`. (rhyzome and bons.ai were listed here at time of writing; now deprecated.)

---

## pass-9.4

# Pass 9.4 — Cerebra → fossic Cross-Pollination

**Date:** 2026-06-14
**Severity:** NEEDS-AWARENESS (docs-only, non-blocking)
**Source pass:** Cerebra Phase 9 Step 4 (v0.3.6)
**Affected fossic surface:** `docs/implement/AGENT_TRACE_VOCABULARY.md` §7 (Cerebra extension events)
**Author:** Cerebra Claude

---

## Summary

Phase 9 Step 4 wires `ReinjectionTriggerEvaluator` into `CycleRuntime`, making the
re-injection path active for cycle configs that declare `reinjection_triggers`. When a
cycle terminates with `outcome="cap_reached"` and no accepted step, `ReinjectionTriggered`
is emitted on the parent session's fossic stream before the child session spawns.

One new event is introduced:

- `ReinjectionTriggered` — emitted at cycle close on the PARENT stream when re-injection fires

The payload schema below is extracted from the **actual emission site in
`cerebra/cognition/cycle_runtime.py`** (method `_try_reinject`), not from the
pre-implementation kickoff schema in the Step 4 brief. Code is canonical.

---

## Event: ReinjectionTriggered

**When emitted:** After `SessionFlushed`, on the parent session's stream, when:
1. `CycleResult.outcome == "cap_reached"`
2. No step in the cycle had `clutch_action == "accept"`
3. `session.recursion_depth < config.max_recursion_depth`
4. A matching `reinjection_triggers` predicate fires

If `recursion_depth >= max_recursion_depth` (depth limit reached), NO event is emitted.
The cycle terminates normally with `outcome="cap_reached"` and `child_result=None`.

**Causation:** Auto-chained from the immediately prior emit (`SessionFlushed`) via
`EventEmitter._last_event_id`. Effective chain: `SessionFlushed → ReinjectionTriggered`.

**Stream:** Parent session's stream (`cerebra/agent-trace/<parent_session_id>`). The child
session's events appear on a separate stream starting with `SessionOpened`.

**Indexed tags:** `session_id`, `child_session_id`, `recursion_depth`

**Payload schema (actual):**

```json
{
  "session_id": "string (parent session_id)",
  "cycle_id": "string (parent cycle_id)",
  "trigger_predicate": "string (predicate name that fired)",
  "continuation_bundle_id": "string (bundle_XXXX... from continuation_bundles table)",
  "child_session_id": "string (newly spawned child session_id)",
  "recursion_depth": "int (CHILD's depth = parent_depth + 1)",
  "triggered_at": "int (Unix epoch milliseconds)"
}
```

**Convention note on `recursion_depth`:** This is the CHILD's depth, not the parent's.
A top-level parent (depth 0) spawning its first child emits `recursion_depth: 1`. A depth-1
child spawning a depth-2 grandchild emits `recursion_depth: 2`. This matches the
`SessionOpened.recursion_depth` convention for the child session. (DEV-040)

**Field semantics:**

| Field | Values / notes |
|---|---|
| `session_id` | Parent session that terminated and triggered re-injection |
| `cycle_id` | Cycle ID of the parent's most recent cycle |
| `trigger_predicate` | Name of the predicate that fired (`"max_steps_without_acceptance"` in v0.1) |
| `continuation_bundle_id` | ID of the `ContinuationBundle` written to the `continuation_bundles` table before spawning |
| `child_session_id` | `session_id` of the child session just created via `SessionManager.open_session` |
| `recursion_depth` | Child session's depth (parent depth + 1); NOT the parent's depth |
| `triggered_at` | Timestamp of emission in milliseconds |

---

## Chain context: parent vs child stream

`ReinjectionTriggered` appears on the PARENT stream. The child's stream is separate:

```
Parent stream (cerebra/agent-trace/<parent_session_id>):
  SessionOpened
  CycleStarted
  [step events...]
  CycleCompleted (outcome="cap_reached")
  SessionFlushed
  ReinjectionTriggered  ← parent stream ends here
  
Child stream (cerebra/agent-trace/<child_session_id>):
  SessionOpened  ← new stream begins; parent_session_id in payload
  CycleStarted
  [step events...]
  ...
```

The `continuation_bundle_id` in `ReinjectionTriggered` is the bridge: reading
`continuation_bundles WHERE bundle_id = <id>` gives `distilled_goal`,
`summarized_prior_prompt`, `next_focus`, and `recursion_depth` for visualization.

---

## No event on depth-limit block

Per S4-D7: when the trigger predicate WOULD fire but `recursion_depth >= max_recursion_depth`
blocks it, **no event is emitted**. The cycle's `SessionFlushed` is the last event on the parent
stream. `child_result` in `CycleResult` is `None`. Lattica can detect this case by reading
the parent session's `recursion_depth` from `runtime_sessions` and comparing to
`config.max_recursion_depth`.

---

## Requested action on fossic side

Update `docs/implement/AGENT_TRACE_VOCABULARY.md` §7 to add `ReinjectionTriggered` to the
Cerebra event vocabulary. Suggested location: §7.5.4 (after `CatalystArmSelected` §7.5.3).

Key points for the vocabulary entry:
- Emitted on PARENT stream, not child stream
- `recursion_depth` is child's depth (see convention note above)
- Only emitted when trigger fires; blocked case produces no event
- `continuation_bundle_id` links to the `continuation_bundles` DB table
- v0.1 only ships `max_steps_without_acceptance` as trigger predicate

No fossic core changes required. Standard fossic event API; payload is opaque to fossic.

---

## Cerebra-side references

- Phase 9 Step 4 (v0.3.6)
- `cerebra/cognition/cycle_runtime.py` — `_try_reinject()` method (emission site)
- `cerebra/cognition/reinjection.py` — `ReinjectionTriggerEvaluator`, predicates
- `cerebra/cognition/continuation_bundle.py` — `BundleDistiller`, `write_bundle`
- `cerebra/cognition/session.py` — `SessionManager.open_session(parent_session_id=...)`

---

## relay-impl

---
date: 2026-06-16
summary: relay.py implementation, spec corrections, test suite, and architecture answers since federation interview
---

# Fossic → Lattica briefing: relay infrastructure

*Changes since federation interview · 2026-06-16*

---

## 1. relay.py — shipped

`python/fossic/relay.py` is implemented and exported from `fossic.__init__`. Four public symbols:

```python
from fossic import RelayConfig, RelayAgent, relay_append, run_relay
```

**`RelayConfig`** — dataclass holding both store paths, `source_prefix`, `subscribe_pattern`,
`relay_filter` (set of event_types; empty = relay all), and retry/reconnect tuning knobs
(`batch_size`, `reconnect_delay_ms`, `max_retry_attempts`, `retry_backoff_base_ms`).

**`relay_append`** — standalone helper that performs a single hub append enforcing all
protocol fields: D.3 stream naming, `causation_id` translation, `external_id = event.id.hex()`,
`branch` passthrough, `source_store` indexed_tag. Callers are responsible for the
idempotency check before calling it.

**`RelayAgent`** — wraps `RelayConfig`, exposes `relay_event(event)` for direct call
(returns `True`/`False`) and `run()` for the blocking subscription loop with `StorageError`
reconnect and per-event exponential backoff retry.

**`run_relay(config)`** — thin entry point; `RelayAgent(config).run()`.

---

## 2. Spec corrections found during implementation

Four API surface corrections caught against the real pyo3 bindings (not in `federation_design.md`):

| Wrong (spec) | Correct (actual) | Where it mattered |
|---|---|---|
| `read_by_external_id(external_id)` | `read_by_external_id(stream_id, external_id)` | idempotency check, `_translate_causation_id` |
| `event.deserialize_payload_json()` | `event.payload()` | relay_append payload arg |
| `event.indexed_tags` (property) | `event.indexed_tags()` (method, returns `Optional[dict]`) | indexed_tags merge in relay_append |
| `StoreConnectionError` | `StorageError` | reconnect loop in `run()` |

One circular import resolved: `relay.py` importing `from fossic import Store` at module level
triggered `__init__.py` → `relay.py` loop. Fixed by moving the `Store` import inside `run()`
and using `TYPE_CHECKING` for the type annotation.

---

## 3. Addendum: causation_id correction (S-030 / S-031)

Filed `federation_design_addendum_causation_id.md` at
`baselines/2026-06-16/fossic/`.

The B.1 spec had `causation_id=event.id` — wrong. `event.id` is the local event's own ID;
it is never a hub primary ID, so `walk_causation` on hub produces a dangling reference.
`external_id=event.id.hex()` already captures provenance; `causation_id` should carry
application-semantic cause.

Correct implementation uses `_translate_causation_id(event.causation_id)` with three cases:

- `None` → `None`
- local event ID (found via `local_store.read_one()`) → resolved to hub ID via
  `hub_store.read_by_external_id(hub_stream, local_id.hex())`
- hub event ID (not found locally, e.g. a cross-store trigger like `hub_GSA_id`) →
  passed through as-is

The relay is generic. The cross-store causation obligation (S-031) lands on LumaWeave's
application layer: when `SourceLoaded` is emitted in response to a hub-received
`GraphSnapshotAvailable`, LumaWeave stores `causation_id = hub_GSA_id` in the local
event at emit time. The relay then passes it through naturally.

---

## 4. Test suite — 23 tests, all passing

`fossic-py/tests/test_relay.py`, running against real temp stores (no mocks):

- `_hub_stream_id` — 5 tests including D.3 boundary cases for all four projects
- `RelayConfig` defaults — 1 test
- `_translate_causation_id` — 4 tests: None, local→hub translation, hub-ID passthrough,
  unrelayed local fallback
- `relay_event` — 9 tests: basic relay, hub appearance, idempotency, `source_store` tag,
  branch preservation, filter allow/block, D.3 already-prefixed, D.3 not-prefixed
- `relay_append` indexed_tags — 4 tests: event tags preserved, `source_store` not
  overridable by event, extra tags merged, no-tags-on-event case

Full suite result: **134 passed, 2 skipped** (pre-existing skips unrelated to relay).

---

## 5. Architecture answers issued since the interview

**Branch semantics** (confirmed for Policy Scout / §8.3 compile):
`Append(branch=<omitted>)` stores `"main"` — the pyo3 signature default is
`"main".to_string()`, a `String` not `Option<String>`. Passing `None` raises `TypeError`
at the Rust boundary. `StoredEvent.branch` always returns a concrete `str`. Relay's
`branch=event.branch` round-trips cleanly.

**Hub store readiness handshake** (for §8.3 startup framing):
`Store.open()` default policy is `FirstOpenPolicy::CreateIfMissing`. It calls
`create_dir_all(parent)` and creates the SQLite file if absent — there is no
"hub not ready" failure mode at the `Store.open()` layer. The first caller initializes
the store; subsequent openers get an already-initialized schema. Recommendation:
implicit retry via `RelayAgent.run()`'s `StorageError` reconnect loop is the correct
transport primitive and is already implemented. A Tauri readiness signal (option c) is
a valid process-sequencing concern but orthogonal to store-open failure; frame it that
way in §8.3.

**relay_append sequencing decision**:
Ships as a standalone fossic pass first. Relay agents (one per project, living in each
project's own repo) co-ship with their project's first relay work.

---

## Files written since the federation interview

| File | Path |
|---|---|
| `federation_design.md` | `docs/coordination/baselines/2026-06-16/fossic/` |
| `needs-wiring.md` | `docs/coordination/baselines/2026-06-16/fossic/` |
| `federation_design_addendum_causation_id.md` | `docs/coordination/baselines/2026-06-16/fossic/` |
| `relay-impl.md` (this file) | `docs/coordination/cross-pollination/fossic/` |
| `relay.py` | `fossic-py/python/fossic/` |
| `test_relay.py` | `fossic-py/tests/` |

---

