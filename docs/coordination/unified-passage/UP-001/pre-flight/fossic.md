---
unified-passage: UP-001
project: fossic
status: warn
date: 2026-06-14
---

# fossic ARM Pre-flight — UP-001

## Summary

Core subscription machinery: **PASS** (Rust-level, all tests green).
Platform store + Tauri IPC checks: **WARN** — environment uninitialized; Lattica
has never been launched in this environment. Checks 1–3 self-resolve on first
`npm run tauri dev`. No fossic code gap.

---

## Check 1 — `~/.lattica/fossic/store.db` exists, file size > 0

**WARN — store not yet initialized.**

`~/.lattica/fossic/` does not exist. The store has never been created in this
environment. This is an environment state issue, not a fossic defect.

Lattica's `src-tauri/src/lib.rs` setup function does the right thing on launch:

```rust
let home = app.path().home_dir()?;
let store_path = home.join(".lattica/fossic/store.db");
if let Some(parent) = store_path.parent() {
    std::fs::create_dir_all(parent)?;
}
let store = Store::open(&store_path, OpenOptions::default())?;
```

`create_dir_all` creates the directory, `Store::open` creates + WAL-initializes
the database, and a canary event is appended on every startup (ADR-014). The store
will exist and be healthy after the first `npm run tauri dev`.

**Resolution:** developer runs Lattica once.

---

## Check 2 — `fossic_list_streams()` returns valid output

**BLOCKED** by check 1. No store to query.

`lattica_store_status` is in scope for this check too — it is defined in
Lattica's own `src-tauri/src/lib.rs` (not fossic-tauri). Original ASSIGNMENTS.md
was correct that it exists as a Tauri command; my earlier ACK correction was
accurate that it's absent from fossic-tauri but missed that Lattica owns it.
Either `fossic_list_streams()` or `lattica_store_status` works as the health
check — both need a live store.

**Expected result once store exists:** `fossic_list_streams()` returns successfully;
`lattica_store_status` returns `{ ok: true, stream_count: 1 }` (at minimum, the
canary stream `lattica/canary` from startup).

---

## Check 3 — `fossic_subscribe("cerebra/agent-trace/*")` returns subscription handle

**BLOCKED** by check 1 (requires live store + running Tauri instance).

**Rust-level verification (what can be checked now):**

All 19 subscription tests pass, including the directly relevant cases:

```
test glob_star_receives_multiple_matching_streams ... ok
test glob_double_star_receives_all_matching_streams ... ok
test subscribe_filters_by_stream ... ok
test drop_handle_stops_delivery ... ok
test post_commit_fires_after_append ... ok
test post_commit_queue_overflow_marks_degraded ... ok
```

The `cerebra/agent-trace/*` pattern will match any stream of the form
`cerebra/agent-trace/<session_id>` via `crate::glob::matches` (`*` = one segment).
Delivery via `EmitHandler.on_event` → `app.emit("fossic:event", payload)` is the
correct Tauri IPC path for Lattica's frontend to receive events.

fossic-tauri build: **PASS** (clean, no warnings).
Full workspace test suite: **PASS** (0 failures across all crates).

---

## Check 4 — Cerebra events queryable if previously emitted

**N/A** — no store, no events. Once store exists: use `fossic_list_streams()` to
find `cerebra/agent-trace/*` streams, then `fossic_read_range(<exact_stream_id>)`.
Cerebra hasn't emitted yet anyway (pre-flight order: fossic → Cerebra → Lattica).

---

## Additional finding — `lattica_store_status` correction

My REVIEW ACK stated "`lattica_store_status` doesn't exist in fossic-tauri" (accurate)
and suggested removing it from pre-flight. On reading Lattica's `src-tauri/src/lib.rs`
during this pre-flight, I found it IS defined there as a Lattica-owned Tauri command.
The ASSIGNMENTS.md substitution (fossic_list_streams) is fine and equivalent; I just
want to log that the original command exists.

---

## Resolution path

1. Developer runs `npm run tauri dev` in Lattica's repo once — store initializes,
   canary event appends, `~/.lattica/fossic/store.db` is created
2. Verify check 1: `stat ~/.lattica/fossic/store.db` → non-zero size
3. Verify check 2: invoke `fossic_list_streams()` or `lattica_store_status` from
   Lattica's frontend → healthy response
4. Verify check 3: `fossic_subscribe("cerebra/agent-trace/*")` → subscription handle
5. fossic updates this file to `status: pass`

**No fossic code changes expected.** The subscription pipeline is verified at the
Rust level. ARM pre-flight will be `pass` once the environment is initialized.
