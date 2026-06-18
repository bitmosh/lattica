# iter-4 Extraction — Pushback Notes

## Lattica

### Phase 1 — Foundation Extraction

**Tile picker hover state uses CSS `:hover` not inline `style-hover`**
The iter-4 dc.html prototype used a custom `style-hover` attribute (a design-canvas feature) to express hover background on tile picker options. In React/CSS, this is implemented as `.la-tile-picker-option:hover { background: rgba(34,224,196,0.08) }` in TilePicker.css. Functionally identical; no interaction change.

**Activity scope is a static visual in Phase 1**
The prototype renders 6 live event-tick lanes in the topbar header. Phase 1 renders the same 6 labeled lane tracks with empty (no-event) backgrounds. This is correct — event data flows through tile daemons which are wired in later phases. The lane structure (labels + tracks) is pixel-faithful to iter-4.

**Drawer is a Phase 1 stub**
The prototype drawer shows a full module dependency map (module rows + fossil pillar SVG). Phase 1 renders a single stub line. The drawer toggle button and open/close animation are fully functional — only the content is deferred.

**`defaultAnchor` is not a field in TilePicker options or TILE_INFO**
Per CORE.md §3.4 (micro-fix): `defaultAnchor` is application-side only, resolved by the compositor from `category`. Tile specs do not declare it. Omitted from `TILE_INFO` and tile registration data structures.

**FreezeOverlay `queuedCount` is 0 in Phase 1**
The count of queued events while frozen requires a live event buffer per pane. That buffer is wired when tile daemons connect. Phase 1 shows the overlay with `0 events queued` — correct placeholder, not a regression.

**`min-width: 1280px; min-height: 760px` from prototype not enforced**
The prototype declared those minimum dimensions. Omitted from the Phase 1 shell to avoid layout constraints at Tauri dev window sizes. Can be added to `la-shell` once window sizing is finalized.
