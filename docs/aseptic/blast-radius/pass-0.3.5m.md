---
pass: 0.3.5m
version: v0.3.5m
date: 2026-06-18
summary: iter-4 Phase 4 — full spawn_blocking async hardening, oa() helper, FossicTile stream visualizer
---

# Blast Radius — Pass 0.3.5m (v0.3.5m)

Phase 4 of the iter-4 extraction. Async hardening: all PS Tauri commands and
fossic_query_remote_store promoted to spawn_blocking. oa() helper introduced.
FossicTile live event-fabric visualizer added (6-lane, 90 s window, hub
subscription). fossic-stream-view registered in tileSectionRegistry (hidden by
default). Pane.tsx fossic routing branch added.

## Files

### Modified
- `src-tauri/src/lib.rs` — run_cli_json now async + spawn_blocking + Vec<String>; +oa() helper; activate_lockdown, deactivate_lockdown, ps_approve_once, ps_deny all async; ps_watch_status, ps_approvals_list async with own spawn_blocking; restart_watch gets two-phase spawn_blocking; fossic_query_remote_store async + spawn_blocking
- `src/components/workspace/Pane.tsx` — +FossicTile import + fossic routing branch
- `src/registrations.tsx` — +FossicTile import + fossic-stream-view registration
- `docs/coordination/iter_4_extraction/pushback_notes.md` — Phase 4 Lattica section added

### Created
- `src/tiles/fossic/FossicTile.tsx` — 6-lane event visualizer (hub subscription, 90 s window, tick marks)
- `src/tiles/fossic/FossicTile.css` — FossicTile styles (gold/pink beam, flares, lane tracks)
- `docs/aseptic/blast-radius/pass-0.3.5m.md` — this file

---

## Public APIs

### Added
- `FossicTile` component — live event fabric stream visualizer
- `fossic-stream-view` tileSectionRegistry entry (defaultVisible: false)

### Modified (breaking — Rust internal, no IPC shape change)
- `run_cli_json` — sync `fn(&[&str])` → async `fn(Vec<String>)` with spawn_blocking; internal only, no IPC consumers affected
- All PS commands (`activate_lockdown`, `deactivate_lockdown`, `restart_watch`, `ps_watch_status`, `ps_approvals_list`, `ps_approve_once`, `ps_deny`) — promoted from sync/bare-async to full async with spawn_blocking; IPC surface unchanged

---

## Schema changes

None.

## Configuration changes

None.

## Dependency changes

None.

## Behavior changes

All blocking Tauri commands now run in dedicated thread-pool threads via
`spawn_blocking`. IPC thread is no longer blocked by CLI subprocess waits
(up to ~2s for policy-scout watch stop). FossicTile subscribes to `"**"` on
the local hub store; non-lattica lanes show pre-relay chip until module relays
ship.
