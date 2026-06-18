---
pass: 0.3.5n
version: v0.3.5n
date: 2026-06-18
summary: iter-4 Phase 3 — PS Tauri commands wired, LumaWeave stub, PS tile full rewrite with approval handling, PS color migration, Pane aistack/lumaweave routing
---

# Blast Radius — Pass 0.3.5n (v0.3.5n)

Phase 3 of the iter-4 extraction. Wiring pass: four new Policy Scout Tauri
commands, LumaWeaveTile stub, full PolicyScoutTile rewrite with live approval
rows, PS color migration (#cf0a5c → B46CFF), Pane.tsx extended with aistack
and lumaweave routing, tileSectionRegistry defaultAnchor made optional.

## Files

### Modified
- `src-tauri/src/lib.rs` — +WatchStatusResponse, +ApprovalItem, +ApprovalsListResponse; +ps_watch_status, +ps_approvals_list, +ps_approve_once, +ps_deny (sync); restart_watch promoted to async fn
- `src/components/workspace/Pane.tsx` — +AiStackTopologyTile, +LumaWeaveTile imports and routing branches
- `src/tiles/policy-scout/PolicyScoutTile.tsx` — full rewrite: +ApprovalItem/ApprovalsListResponse types, +riskBand/RISK_BAND_STYLE/relExpiry helpers, +approvals/inFlightIds state, +handleApproveOnce/handleDenyApproval, live approval row rendering, color migrated to PS purple
- `src/tiles/policy-scout/PolicyScoutTile.css` — +approval row classes, color migrated (#cf0a5c → B46CFF)
- `src/renderers/policy-scout/DecisionIssuedRenderer.tsx` — DENY badge color migrated
- `src/renderers/policy-scout/LockdownActivatedRenderer.css` — color migrated
- `src/registrations.tsx` — +LumaWeaveTile import, +lumaweave-graph registration, +B4 comment
- `src/control-plane/tile-section/tileSectionRegistry.ts` — defaultAnchor removed from required fields
- `src/control-plane/tile-section/types.ts` — defaultAnchor made optional (?: TileAnchor)
- `docs/coordination/iter_4_extraction/pushback_notes.md` — Phase 3 Lattica section added

### Created
- `src/tiles/lumaweave/LumaWeaveTile.tsx` — pre-relay stub tile (graph stream integration pending)
- `src/tiles/lumaweave/LumaWeaveTile.css` — LumaWeave tile styles (accent: #A6F35A)
- `docs/aseptic/blast-radius/pass-0.3.5n.md` — this file

---

## Public APIs

### Added
- `ps_watch_status() -> Result<WatchStatusResponse, String>` — polls `policy-scout watch status --json`
- `ps_approvals_list() -> Result<ApprovalsListResponse, String>` — polls `policy-scout approvals list --json`
- `ps_approve_once(approval_id: String) -> CliJsonResponse` — runs `policy-scout approvals approve <id> --json`
- `ps_deny(approval_id: String) -> CliJsonResponse` — runs `policy-scout approvals deny <id> --json`
- `LumaWeaveTile` component — pre-relay stub

### Modified (non-breaking)
- `TileSectionEntry.defaultAnchor` — was required, now optional

---

## Schema changes

None.

## Configuration changes

None.

## Dependency changes

None.

## Behavior changes

`restart_watch` promoted from sync to async fn — moves blocking watch-stop subprocess (~1.6s) off the Tauri IPC thread. Full spawn_blocking hardening applied in v0.3.5m. PS tile Track A now polls `ps_watch_status` + `ps_approvals_list` on 15s interval; approval rows render live when commands succeed.
