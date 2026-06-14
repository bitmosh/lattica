# ADR-012: fossic as Platform Store

**Status:** Accepted
**Date:** 2026-06-14
**Version:** v0.2.0 (first wired)
**Depends on:** ADR-010 (IPC channels), fossic v0.1.0

---

## Decision

Lattica uses a single fossic `Store` instance as the platform-wide event store, opened at
`~/.lattica/fossic/store.db` on every app launch.

The store is opened in Rust inside Tauri's `.setup()` closure using `fossic::Store::open()`.
It is managed as Tauri app state (`app.manage(store)`) and accessed by Tauri commands via
`State<'_, Store>`.

**fossic_append is NOT a Tauri command.** All event writes happen from the Rust side. The
frontend reads events via fossic-tauri's 10 read commands and `fossic_subscribe`.

---

## Store path

```
~/.lattica/fossic/store.db
```

Resolved at runtime via Tauri's `app.path().home_dir()`, not the `directories` crate (avoids
an extra dependency; Tauri ships `home_dir()` as a first-party API).

The parent directory `~/.lattica/fossic/` is created with `std::fs::create_dir_all` on first
launch.

---

## fossic-tauri integration

fossic-tauri is integrated via the `register_commands` path (not the `plugin()` path):

```rust
// In setup():
app.manage(store);
fossic_tauri::register_commands(app)?;

// In invoke_handler:
fossic_tauri::commands::fossic_list_streams,
fossic_tauri::commands::fossic_subscribe,
// ... all 10 read commands
```

The `register_commands` path is chosen because Lattica needs access to the `Store` before
handing it to Tauri state (to emit the canary event at ADR-014). The `plugin()` path moves
the store into the plugin setup closure making it unavailable for the canary append.

---

## Exposed Tauri commands (fossic read surface)

| Command | Purpose |
|---|---|
| `fossic_list_streams` | List all streams in the store |
| `fossic_list_branches` | List branches for a stream |
| `fossic_read_range` | Read events in a version range |
| `fossic_read_one` | Read a single event by ID |
| `fossic_read_by_external_id` | Look up event by external ID |
| `fossic_read_state_at_version` | Reduce stream state at a version |
| `fossic_subscribe` | Subscribe to a stream pattern (push) |
| `fossic_unsubscribe` | Cancel a subscription |
| `fossic_read_by_correlation` | Read events sharing a correlation ID |
| `fossic_walk_causation` | Walk the causation chain from an event |

Frontend events arrive as Tauri event `"fossic:event"` with payload
`{ subscription_id: string, event: SerializedEvent }`.

---

## Stream namespace convention

| Prefix | Owner |
|---|---|
| `lattica/*` | Lattica shell — platform lifecycle and coordination events |
| `lumaweave/*` | LumaWeave — future Mode B subscriptions (v0.3+) |
| `cerebra/*` | Cerebra — future subscriptions (post-Phase 11) |

Lattica's shell is read-only on `lumaweave/*` and `cerebra/*` streams. It writes only to
`lattica/*`. This invariant is enforced by convention (fossic_append is not a Tauri command);
violations require direct Rust-side changes that surface in code review.

---

## Cargo path deps

```toml
fossic = { path = "../../fossic" }
fossic-tauri = { path = "../../fossic/crates/fossic-tauri" }
```

These are path deps pointing to the sibling fossic repo at `~/Projects/fossic/`. They are
resolved at build time; the fossic workspace handles its own internal dep versions.
