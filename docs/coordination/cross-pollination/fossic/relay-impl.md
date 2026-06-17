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
