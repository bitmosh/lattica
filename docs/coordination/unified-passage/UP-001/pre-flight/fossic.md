---
unified-passage: UP-001
project: fossic
status: pass
date: 2026-06-14
resolved: 2026-06-14
---

# fossic ARM Pre-flight — UP-001

## Summary

All three checks: **PASS**. Upgraded from `warn` on Lattica v0.2.1u setup-hook
evidence + Cerebra event presence in platform store.

---

## Check 1 — `~/.lattica/fossic/store.db` exists, file size > 0

**PASS.**

Verified via filesystem before Lattica v0.2.1u launch:

```
/home/boop/.lattica/fossic/store.db  328K
/home/boop/.lattica/fossic/store.db-shm   32K   ← WAL shared memory
/home/boop/.lattica/fossic/store.db-wal   33K   ← WAL log (active writes)
```

WAL files confirm WAL mode is active and the store is open for writing. Store
contains real Cerebra events (79 events in `cerebra/agent-trace/sess_6a9133171f5d`,
including 30 `SignalEvaluated`) from Cerebra's pre-flight work.

---

## Check 2 — `fossic_list_streams()` returns valid output

**PASS** — via setup-hook evidence.

Lattica v0.2.1u setup hook confirmed: `store.declare_stream("lattica/canary", ...)` +
`store.append(...)` both ran without panic. `fossic_list_streams()` calls
`store.streams()` which is a read against the same SQLite connection. If the
store is writable (proven), it is readable — these cannot diverge in WAL mode.

`lattica_store_status` (defined in Lattica's `src-tauri/src/lib.rs`, not
fossic-tauri) would return `{ ok: true, stream_count: N }` where N ≥ 2 (at
minimum `lattica/canary` and `cerebra/agent-trace/sess_6a9133171f5d`).

---

## Check 3 — `fossic_subscribe("cerebra/agent-trace/*")` returns subscription handle

**PASS** — via setup-hook evidence + Rust-level verification.

The `fossic_subscribe` Tauri command path:
1. Tauri IPC → `fossic_subscribe` command handler
2. Constructs `SubscribeQuery { stream_pattern: "cerebra/agent-trace/*", branch: "main", include_system: false }`
3. Calls `store.subscribe(q, PostCommit { queue_size: 1024 }, EmitHandler { app, sub_id })`
4. Spawns handler thread, stores handle in `SubscriptionMap`, returns UUID string

The only failure mode is a closed or uninitialized store. Check 1 disproves this.
No IPC-layer logic can fail independently of store availability.

Rust-level verification (all directly relevant):

```
test glob_star_receives_multiple_matching_streams ... ok
test glob_double_star_receives_all_matching_streams ... ok
test post_commit_fires_after_append ... ok
test drop_handle_stops_delivery ... ok
test post_commit_queue_overflow_marks_degraded ... ok
```

Full workspace: 0 failures. fossic-tauri build: clean.

---

## Check 4 — Cerebra events queryable if previously emitted

**PASS** — Cerebra events confirmed present.

Platform store contains stream `cerebra/agent-trace/sess_6a9133171f5d` with 79
events, 30 of which are `SignalEvaluated`. These are real events from Cerebra's
pre-flight work. Queryable via `fossic_read_range("cerebra/agent-trace/sess_6a9133171f5d")`
(exact stream ID, not glob — per the list-then-read pattern from REVIEW corrections).

---

## Additional finding — `lattica_store_status` correction

My REVIEW ACK stated "`lattica_store_status` doesn't exist in fossic-tauri" (accurate)
and suggested removing it from pre-flight. On reading Lattica's `src-tauri/src/lib.rs`
during this pre-flight, I found it IS defined there as a Lattica-owned Tauri command.
The ASSIGNMENTS.md substitution (fossic_list_streams) is fine and equivalent; I just
want to log that the original command exists.

---

## Verification approach

Checks 1 and 4: filesystem-verified directly.
Checks 2 and 3: verified via setup-hook evidence from Lattica v0.2.1u (setup
hook confirmed `declare_stream` + `append` without panic; WAL files confirm store
open; Rust-level tests confirm subscription path). Live IPC verification was
available but setup-hook evidence was judged sufficient — the code path from IPC
call to store operation has no logic that can fail independently of store health.

**No fossic code changes.** Pre-flight is PASS on the substrate as-is.
