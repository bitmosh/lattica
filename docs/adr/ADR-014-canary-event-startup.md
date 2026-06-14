# ADR-014: Canary Event on Startup

**Status:** Accepted
**Date:** 2026-06-14
**Version:** v0.2.0 (first wired)
**Depends on:** ADR-012 (fossic platform store)

---

## Decision

On every Lattica app launch, the Rust backend appends a `startup_ping` event to the
`lattica/canary` stream:

```rust
store.append(Append {
    stream_id: "lattica/canary".to_string(),
    event_type: "startup_ping".to_string(),
    payload: serde_json::json!({ "version": "0.2.0" }),
    ..Append::default()
})?;
```

This append happens in Tauri's `.setup()` closure, immediately after the store is opened.
If the append fails, `?` propagates the error and Tauri refuses to launch — intentionally.

---

## Purpose

The canary event is an infrastructure health signal, not a user-observable lifecycle event.
It proves three things on every launch:

1. **Store opened successfully** — `Store::open()` did not error
2. **Write path alive** — `store.append()` committed an event without error
3. **Subscription pipeline works** — the HelloTile subscribes to `lattica/canary` and
   counts arriving events, making the frontend subscription roundtrip visible

---

## What it is NOT

- Not a session lifecycle event. Sessions are not modeled at v0.2.0.
- Not user-visible telemetry. The event is in the platform store, not sent anywhere.
- Not deduplicated. Multiple launches accumulate multiple `startup_ping` events in the
  stream, which is correct: the growing count proves the store is append-only.

---

## Stream and branch

- **Stream:** `lattica/canary`
- **Branch:** `main` (default from `Append::default()`)
- **type_version:** 1 (default from `Append::default()`)

---

## Payload evolution

At v0.2.0, payload is `{ "version": "0.2.0" }`. Future passes may add fields as needed.
Schema changes to the `startup_ping` payload follow standard fossic versioning:
`type_version` bump + migration reducer if reduction semantics change.

---

## HelloTile integration

The HelloTile subscribes to `lattica/canary` via `fossic_subscribe` and counts received
events. A non-zero count after startup confirms the full pipeline:

```
Rust append → fossic WAL → fossic subscription → Tauri event → frontend listener → UI
```
