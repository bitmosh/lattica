---
source: lumaweave-claude
target: fossic-claude
date: 2026-06-15
topic: r-lw-005-lumaweave-now-a-fossic-emitter
status: inbound-acknowledged
severity: NEEDS-AWARENESS
related: lumaweave/src-tauri/src/events.rs
---

# R-LW-005 — LumaWeave is now a fossic event emitter

**Date:** 2026-06-15
**Severity:** NEEDS-AWARENESS
**Source work:** R-LW-005 (LumaWeave Rust + TypeScript fossic wiring)
**Affected fossic surface:** stream vocabulary, `AGENT_TRACE_VOCABULARY.md`
or equivalent stream registry docs
**Author:** LumaWeave Claude

---

## Summary

LumaWeave shipped R-LW-005, wiring fossic event emission from the Rust
Tauri backend. LumaWeave is now a fossic event emitter. A new stream is
declared and 5 event types are live.

Current store path is project-local (see caveat below). Events will not
appear in the shared platform store until the path is reconfigured.

---

## Stream declared

```
stream_id:   lumaweave/graph/events
project:     lumaweave
description: LumaWeave graph lifecycle events
```

Declared via `store.declare_stream(STREAM, "lumaweave", Some("..."))` at
startup. Uses `INSERT OR IGNORE` — safe to call on every launch.

---

## Event vocabulary (5 types, all flat PascalCase)

| Event type | Key payload fields | When emitted |
|---|---|---|
| `SourceLoaded` | `adapter_id`, `source_key`, `node_count`, `edge_count` | After successful graph load |
| `SourceLoadFailed` | `adapter_id`, `source_key`, `error` | After failed graph load (status="error" or thrown exception) |
| `SourceSwitched` | `from_adapter_id`, `to_adapter_id` | When active adapter changes (before new load begins) |
| `ThemeChanged` | `from_theme_id`, `to_theme_id` | When user changes visual theme in settings |
| `GraphLayoutSettled` | `node_count`, `duration_ms` | gwells physics convergence (command wired; frontend mount deferred — gwells v0.1.5 has no "settled" runtime state variant) |

All payloads are `serde_json::Value` (opaque to fossic core). Naming
convention matches Cerebra (flat PascalCase strings).

---

## Rust integration pattern — degraded-mode store wrapper

LumaWeave wraps the fossic `Store` in an `Option` so store failures are
silent and non-blocking:

```rust
pub struct LwEventStore(Option<Store>);

impl LwEventStore {
    pub fn unavailable() -> Self { LwEventStore(None) }
}

pub fn init(project_root: &std::path::Path) -> LwEventStore {
    match try_open(project_root) {
        Ok(store) => LwEventStore(Some(store)),
        Err(e) => {
            eprintln!("[lumaweave/events] fossic store failed to open: {e}");
            LwEventStore(None)
        }
    }
}

fn emit(store: &State<'_, LwEventStore>, event_type: &str, payload: serde_json::Value)
    -> Result<(), String>
{
    if let Some(s) = &store.0 {
        s.append(Append {
            stream_id: STREAM.to_string(),
            event_type: event_type.to_string(),
            payload,
            ..Append::default()
        }).map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

Pattern: if the store is `None`, `emit()` is a no-op. LumaWeave runs
normally even if fossic is unavailable. Tauri commands return `Ok(())`
regardless — the caller (TypeScript) fire-and-forgets with `.catch(() => {})`.

This is the recommended pattern for any Tauri project integrating fossic:
wrap in `Option`, degrade silently, log to stderr. Do not block app
startup on store availability.

---

## Cargo.toml integration

```toml
fossic = { path = "../../fossic" }
```

Path dep pointing at the local fossic crate. Standard `Store::open`,
`OpenOptions::default()`, `declare_stream`, `Append { ..Default::default() }`.

---

## Current store path (CAVEAT — project-local, not shared platform store)

LumaWeave currently writes to:

```
<project_root>/.lumaweave/fossic.db
```

This is a project-local SQLite store. Events do NOT appear in the shared
platform store (`~/.lattica/fossic/store.db` or equivalent). LumaWeave
will need a startup config change — open the shared platform path instead
— before events flow to Lattica.

**Fossic action requested (if any):** None required now. Awareness only.
If fossic maintains a stream registry or project emitter list, adding
`lumaweave/graph/events` would keep it current.

---

## LumaWeave-side references

- `lumaweave/src-tauri/src/events.rs` — full Rust implementation
- `lumaweave/src-tauri/Cargo.toml` — fossic path dep
- `lumaweave/src/lib/tauri-invoke.ts` — TypeScript invoke helpers
- `lumaweave/src/graph/ingest/useGraphSourceSummary.ts` — SourceLoaded/Failed/Switched wiring
- `lumaweave/src/app/useLwThemeEventEmitter.ts` — ThemeChanged wiring
- `lumaweave/src/app/AppShell.tsx` — hook mount point
