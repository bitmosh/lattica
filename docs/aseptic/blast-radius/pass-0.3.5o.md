---
pass: 0.3.5o
version: v0.3.5o
date: 2026-06-18
summary: iter-4 Phase 2 — worker tiles authored (P-013): cerebra rework, Policy Scout initial, ai-stack full rework, 9 renderers
---

# Blast Radius — Pass 0.3.5o (v0.3.5o)

Phase 2 of the iter-4 extraction. All worker tiles extracted and registered.
CerebraSignalTile reworked with SignalPanel sub-component. AiStackTopologyTile
fully rewritten for iter-4 (node flow, VRAM gauge, model actions, alias chips).
PolicyScoutTile authored in Phase 2 state (Track A CLI wired, approvals in pre-relay).
Nine renderers created (6 cerebra + 3 PS); 5 ai-stack renderers created but
commented in registrations.tsx pending relay ship.

## Files

### Modified
- `src/tiles/ai-stack/AiStackTopologyTile.tsx` — full iter-4 rework: node flow, VRAM gauge (warn pct 90), model load/unload, alias chips, topo/list view toggle
- `src/tiles/ai-stack/AiStackTopologyTile.css` — full iter-4 rework styles
- `src/tiles/cerebra-signal/CerebraSignalTile.tsx` — reworked to route events through payloadRendererRegistry; fossic subscription retained
- `src/tiles/cerebra-signal/CerebraSignalTile.css` — reworked styles
- `src/registrations.tsx` — Phase 2 state: +StepStartedRenderer, +PolicyScoutTile, +4 PS renderers, +ai-stack renderer block (commented)

### Created
- `src/tiles/cerebra-signal/SignalPanel.tsx` — cycle feed panel with sparkline
- `src/tiles/cerebra-signal/SignalPanel.css` — signal panel styles
- `src/tiles/cerebra-signal/daemon.ts` — Cerebra fossic subscription daemon
- `src/tiles/cerebra-signal/state.ts` — tile state machine types
- `src/tiles/policy-scout/PolicyScoutTile.tsx` — Phase 2 tile: Track A/B chips, posture cells, pre-relay approvals section, action bar
- `src/tiles/policy-scout/PolicyScoutTile.css` — PS tile styles (pre-color-migration palette)
- `src/renderers/cerebra/StepStartedRenderer.tsx` — StepStarted event renderer
- `src/renderers/cerebra/StepStartedRenderer.css` — renderer styles
- `src/renderers/policy-scout/DecisionIssuedRenderer.tsx` — DecisionIssued renderer
- `src/renderers/policy-scout/DecisionIssuedRenderer.css`
- `src/renderers/policy-scout/ApprovalRequestedRenderer.tsx` — ApprovalRequested renderer
- `src/renderers/policy-scout/ApprovalRequestedRenderer.css`
- `src/renderers/policy-scout/LockdownActivatedRenderer.tsx` — LockdownActivated renderer
- `src/renderers/policy-scout/LockdownActivatedRenderer.css`
- `src/renderers/policy-scout/LockdownDeactivatedRenderer.tsx` — LockdownDeactivated renderer
- `src/renderers/policy-scout/LockdownDeactivatedRenderer.css`
- `src/renderers/ai-stack/VramBudgetChangedRenderer.tsx` (+ 4 more ai-stack renderers) — created, not yet activated
- `docs/coordination/iter_4_extraction/pushback_notes.md` — Phase 2 deviation sections added
- `docs/aseptic/blast-radius/pass-0.3.5o.md` — this file

---

## Public APIs

### Added
- `PolicyScoutTile` — Phase 2: Track A/B LiveValueChip display, posture cells, action bar
- `AiStackTopologyTile` — full iter-4 rework with topology + list views
- `StepStartedRenderer` — registered for cerebra/agent-trace/* StepStarted events
- 4 PS payload renderers registered for policy-scout/audit/** + policy-scout/posture

---

## Schema changes

None.

## Configuration changes

None.

## Dependency changes

None.

## Behavior changes

`PolicyScoutTile` Track A transitions to `source-unreachable` on first poll (ps_watch_status not yet in lib.rs at this commit — wired in v0.3.5n). Approvals section shows pre-relay treatment.
