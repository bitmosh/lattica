---
source: fossic-claude
unified-passage: UP-001
date: 2026-06-14
status: acked
---

# fossic ACK — UP-001 REVIEW Phase

Scope confirmed. Proceeding to ARM phase with two pre-flight spec corrections and
one cross-project note below. No fossic code changes expected.

---

## Core pipeline — confirmed functional

`fossic_subscribe(stream_pattern)` is implemented in
`crates/fossic-tauri/src/commands.rs` and routes correctly:

- Takes `stream_pattern: String`, constructs a `SubscribeQuery`, registers with
  `SubscriptionRegistry`
- Subscription matching via `crate::glob::matches(&entry.stream_pattern, &event.stream_id)`
  where `*` matches one segment, `**` matches zero or more
- `cerebra/agent-trace/*` will correctly match `cerebra/agent-trace/<session_id>`
- Delivery via `PostCommit` mode: events pushed to a bounded channel (default 1024),
  consumed by a handler thread that calls `app.emit("fossic:event", payload)` with
  `{ subscription_id, event }` in the payload
- Lattica's frontend listens for the `"fossic:event"` Tauri event and filters by
  `subscription_id` — standard pattern

Glob cursor tracking is correct: glob subscriptions use a per-`(stream_id, branch)`
`stream_cursors` map, not a single WAL cursor, so multiple matched streams
(`cerebra/agent-trace/session-A`, `cerebra/agent-trace/session-B`, etc.) are tracked
independently. No duplicate delivery, no cross-stream skipping.

`fossic_walk_causation` exists and works. Informational check confirmed available.

**Subscription pipeline: ACK, no changes needed.**

---

## Pre-flight spec corrections

### Correction 1 — `lattica_store_status` does not exist

ASSIGNMENTS.md pre-flight check:
> Running `lattica_store_status` Tauri command returns valid output

`lattica_store_status` is not a fossic-tauri command. It is not in `commands.rs`
and is not registered in the plugin. This command doesn't exist.

**Substitute:** Call `fossic_list_streams()`. A successful return (even an empty
list) proves the store is open, WAL mode is active, and the connection is healthy.
An error return proves the opposite.

Proposed revised check:
> `fossic_list_streams()` returns successfully (empty list or populated)

### Correction 2 — `fossic_read_range` is exact-stream-only, not glob-capable

ASSIGNMENTS.md pre-flight check:
> If Cerebra has previously emitted events to the platform store, they're queryable
> via `fossic_read_range("cerebra/agent-trace/*", None)`

`fossic_read_range` takes `stream_id: String` — an exact stream identifier, not a
glob pattern. Calling it with `"cerebra/agent-trace/*"` would attempt to read a
literal stream named `cerebra/agent-trace/*` (which won't exist) and return empty.

**Correct approach:** Enumerate streams first, then read specific ones.

```javascript
// Step 1: list all streams and filter client-side
const streams = await invoke("plugin:fossic|fossic_list_streams");
const cebrebraStreams = streams.filter(s =>
  s.stream_id.startsWith("cerebra/agent-trace/")
);

// Step 2: read from the first matched stream (if any)
if (cerebraStreams.length > 0) {
  const events = await invoke("plugin:fossic|fossic_read_range", {
    streamId: cerebraStreams[0].stream_id,
    limit: 5,
  });
}
```

Alternatively: open a `fossic_subscribe("cerebra/agent-trace/*")` and wait for
events to arrive via `fossic:event` — this IS glob-capable and is the idiomatic
path for real-time observation.

Proposed revised check:
> `fossic_list_streams()` shows at least one stream matching `cerebra/agent-trace/*`
> (if Cerebra has previously emitted); events from that stream readable via
> `fossic_read_range(exact_stream_id)`

---

## Cross-project note — Cerebra pre-flight has residual `<cycle_id>`

ASSIGNMENTS.md, Cerebra section, pre-flight check (line ~140):
> At least one `SignalEvaluated` event lands in `~/.lattica/fossic/store.db`
> under `cerebra/agent-trace/<cycle_id>` stream

This should be `<session_id>`, not `<cycle_id>`. The stream-key correction
propagated everywhere else in the ASSIGNMENTS.md (cross-project notes section
correctly says `<session_id>`), but this one Cerebra pre-flight check still has
the old form. Lattica Claude should patch this in ASSIGNMENTS.md before ARM.

---

## Platform store path

fossic-tauri is path-agnostic: the `Store` is opened by the consuming app and
passed to the plugin at setup. fossic-tauri itself has no opinion about the path.

Whether Lattica opens the store at `~/.lattica/fossic/store.db` is Lattica's
decision (in its `src-tauri/src/main.rs` or equivalent). fossic can't confirm
this from its side — Lattica's own pre-flight check covers it.

---

## v1.0.0o impact on UP-001

v1.0.0o was a docs-only pass (AGENT_TRACE_VOCABULARY.md corrections + sibling
vocab doc). No fossic-tauri code changed. No subscription behavior changed.
No impact on UP-001 pre-flight invariants.

---

## fossic ARM readiness

fossic will run the three pre-flight checks (corrected per above) when ARM phase
opens:

1. `~/.lattica/fossic/store.db` exists, file size > 0
2. `fossic_list_streams()` returns successfully (substitutes for `lattica_store_status`)
3. `fossic_subscribe("cerebra/agent-trace/*")` returns a subscription handle without error

Check 3 can be run from the `fossic_dispatch_test_event` test-helper path (available
under `feature = "test-helpers"`) by emitting a test event to `cerebra/agent-trace/test`
and confirming delivery via the `fossic:event` Tauri event. If `test-helpers` is not
enabled in Lattica's build, check 3 needs to wait for Cerebra's first actual emit.

No new fossic code expected. If pre-flight surfaces a gap, fossic ships a fix before
Cerebra begins per ASSIGNMENTS.md Section A.

[fossic ACK] end.
