---
pass: 0.3.5p
version: v0.3.5p
date: 2026-06-18
summary: iter-4 Phase 1 — 3-pane shell + workspace primitives extracted from prototype
---

# Blast Radius — Pass 0.3.5p (v0.3.5p)

Phase 1 of the iter-4 extraction. Full workspace shell and all primitive
components extracted from the Lattica Prototype.dc.html design canvas into
the React codebase. App.tsx and App.css updated to mount the new shell.

## Files

### Modified
- `src/App.css` — replaced portfolio-tokens-only import with iter4 design system imports
- `src/App.tsx` — replaced HelloTile with `<Shell><PaneWorkspace /></Shell>`

### Created
- `src/styles/iter4-design-system.css` — Geist fonts, neutral palette vars, 14+ keyframes
- `src/components/livevalue/LiveValueChip.tsx` — 7-state discriminated chip component
- `src/components/livevalue/LiveValueChip.css` — chip styles for all 7 LiveValue states
- `src/components/workspace/Shell.tsx` — topbar + drawer + activity scope + layout
- `src/components/workspace/Shell.css` — shell chrome styles
- `src/components/workspace/PaneWorkspace.tsx` — 3-pane grid with resizable splitters
- `src/components/workspace/PaneWorkspace.css` — grid layout styles
- `src/components/workspace/Pane.tsx` — per-pane container (Phase 1: cerebra + policy routing)
- `src/components/workspace/Pane.css` — pane chrome styles
- `src/components/workspace/TilePicker.tsx` — overlay tile selector with TILE_INFO registry
- `src/components/workspace/TilePicker.css` — picker styles
- `src/components/workspace/EmptyPane.tsx` — empty-pane placeholder with open-picker cta
- `src/components/workspace/EmptyPane.css` — empty pane styles
- `src/components/workspace/FreezeOverlay.tsx` — freeze overlay with queued-count display
- `src/components/workspace/FreezeOverlay.css` — overlay styles
- `docs/coordination/iter_4_extraction/pushback_notes.md` — Phase 1 deviations from prototype
- `docs/aseptic/blast-radius/pass-0.3.5p.md` — this file

---

## Public APIs

### Added
- `Pane` component — routes `TileKey` to tile components; `PaneId` prop for anchor-side logic
- `PaneWorkspace` component — manages pane state (tileKeys, frozen, pickerOpen) for 3 panes
- `Shell` component — topbar, drawer, activity scope wrapper
- `LiveValueChip` component — renders 7 LvStateKind states with color tokens
- `TilePicker` component — overlay picker; `TILE_INFO` record exported
- `TileKey`, `PaneId` types — exported from TilePicker.tsx

---

## Schema changes

None.

## Configuration changes

None.

## Dependency changes

None.

## Behavior changes

`App.tsx` now renders the full 3-pane workspace shell instead of `<HelloTile />`.
`App.css` imports the iter4 design system, making all `--la-*` tokens available globally.
