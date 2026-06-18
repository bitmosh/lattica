---
pass: 0.3.5q
version: v0.3.5q
date: 2026-06-18
summary: iter-4 foundation — LiveValue type + project accent tokens + live-value tokens + fossic_query_remote_store command
---

# Blast Radius — Pass 0.3.5q (v0.3.5q)

Pre-iter-4 foundation: three new token/type files and one new Tauri command.
No UI structure changes; no tile or renderer additions.

## Files

### Modified
- `src-tauri/src/lib.rs` — added `fossic_query_remote_store` sync command + `RemoteStoreError`, `ProjectRegistry`, `expand_tilde`; updated fossic import to include `EventId`, `FirstOpenPolicy`; added `HashMap` import

### Created
- `src/types/live-value.ts` — `LiveValue` discriminated union type used by tile state machines
- `src/styles/project-accents.css` — `:root` CSS vars for all six project accent colors (`--project-accent-*`)
- `src/styles/live-value-tokens.css` — `:root` CSS vars for the seven LiveValue states (`--lv-*`)
- `docs/aseptic/blast-radius/pass-0.3.5q.md` — this file

---

## Public APIs

### Added
- `fossic_query_remote_store(source_store: String, event_id: String) -> Result<Option<SerializedEvent>, RemoteStoreError>` — reads a single event from a project's remote fossic store via the project-registry.json path table

---

## Schema changes

None.

## Configuration changes

None.

## Dependency changes

None.

## Behavior changes

`fossic_query_remote_store` is synchronous at this point; promoted to async + spawn_blocking in v0.3.5m.
