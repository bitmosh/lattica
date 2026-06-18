# iter-4 Extraction — Pushback Notes

## Cerebra

### Phase 2 — Tile Extraction

**SignalEvaluated renders as individual cards, not grouped "× N"**
iter-4 fires one synthetic `SignalEvaluated` event with `count: 6` and renders "SIGNAL EVALUATED × 6" as a single batch card. Real Cerebra fires 6 separate `SignalEvaluated` events (one per signal name). Phase 2 renders each as its own compact row (`cst-card--signal`) showing signal abbreviation + block bar + %. Grouping consecutive events by `step_id` is deferred — the 6 individual rows convey the same data at slightly higher visual density.

**composite score source differs from prototype**
iter-4's signal panel uses `PredictionMade.composite` (expected score) for the composite bar. Phase 2 prefers `OutcomeRecorded.actual_composite_score` (the real evaluated composite) and falls back to `PredictionMade.expected_composite_score` when no outcome exists yet. This is a more accurate display and matches what a running Cerebra produces.

**ClutchDecisionMade included in sparkline, not in cycle feed body**
`ClutchDecisionMade` events are included in `FEED_EVENT_TYPES` for sparkline height contribution (70%) but `renderCard` returns null for them — they don't render in the cycle feed body, only the clutch strip. This matches iter-4 intent where clutch state lives in the control band, not the event feed.

## Policy Scout

### Phase 2 — Tile Extraction

**ps_watch_status and ps_approvals_list Tauri commands not yet in lib.rs**
Track A live state (lockdown status, watch daemon status, approvals list) requires `ps_watch_status` and `ps_approvals_list` commands in Lattica's `src-tauri/src/lib.rs`. Neither exists as of Phase 2. PolicyScoutTile starts in `no-data-yet` state for Track A and transitions to `source-unreachable` once the poll attempt fails. The action commands (`activate_lockdown`, `deactivate_lockdown`, `restart_watch`) exist and are wired. State query wiring is a Phase 3 item. See tile_spec.md §8.4 (CP-PS-5, CP-PS-6) and §9 open items.

**ps_approve_once and ps_deny not yet in lib.rs**
Approve/Deny buttons on the pending approvals panel require `ps_approve_once` and `ps_deny` Tauri commands. These don't exist yet. Pending approvals are shown in pre-relay treatment only (no live approval rows rendered). Buttons are deferred to Phase 3 wiring. See tile_spec.md §9.6.

**Pending approvals shown as pre-relay, not as live rows**
The iter-4 prototype renders approval rows with band tags, cmd, score, expiry, causation chips, and Approve/Deny buttons. Phase 2 renders the section header with pre-relay treatment (LiveValueChip + note). The row structure will be wired once `ps_approvals_list` + `ps_approve_once` / `ps_deny` land in lib.rs (Phase 3). Visual structure of approval rows is preserved in ApprovalRequestedRenderer.tsx for fossic-path rendering.

**Recent decisions section shows empty state**
The iter-4 prototype renders recent decisions from CLI history. No CLI query command exists for decisions history in lib.rs yet. Section renders with empty-state note. Wiring deferred to Phase 3.

**defaultAnchor: { edge: "right" } without offset**
tile_spec.md §6 explicitly removes the `defaultAnchor` offset (compositor concern, not worker concern). tileSectionRegistry validator requires `defaultAnchor` to be present (checked in validateShape). Registered with `{ edge: "right" }` — offset absent, compositor decides position. This diverges from existing cerebra-signal-feed and ai-stack-topology registrations which have explicit offsets.

## ai-stack

### Phase 2 — Tile Extraction

**defaultAnchor kept as `{ edge: "right" }` — tile_spec.md micro-fix cannot be applied**
tile_spec.md §6 (micro-fix pass) removed `defaultAnchor` entirely, arguing first-placement is compositor concern. The `TileSectionEntry` type declares `defaultAnchor` as required and `tileSectionRegistry.validateShape` rejects entries that omit it. Registered with `{ edge: "right" }` — no offset — so compositor can position freely. Type change would require a registry-contract update beyond Phase 2 scope.

**vramWarnPct default was 80 in Phase 1 — corrected to 90**
The original tile had `loadPref("aistack.vramWarnPct", 80)`. Phase 2 aligns to CP-C-6 (VRAM_WARN_PCT_THRESHOLD = 90 in fossic_sidecar.py). Existing localStorage values for users who previously loaded the tile will be overridden on their next cold-load if no stored value exists; stored values are unaffected.

**VRAM display changed from MB to GB**
iter-4 prototype shows "X.X / Y.Y GB" format. Phase 1 tile showed "XXXX MB / YYYY MB". Updated to GB for consistency with iter-4.

**Running models moved outside OLLAMA NodeCard**
iter-4 renders the running model list below the main BO→LITELLM→OLLAMA flow row, not inside the OLLAMA node card. Phase 2 matches this layout. Functionally equivalent; no data change.

**Renderer registrations commented — not activated**
tile_spec.md §8 specifies renderer registrations are added at relay ship time (ai-stack-relay.py running live). The 5 renderer files are created and the registration block is present but commented in registrations.tsx. Uncomment block when relay ships.

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

### Phase 3 — Wiring + Integration

**Fossic pane: no tile wired yet**
TilePicker exposes `key: 'fossic'` and Pane.tsx has a fallthrough for unrecognized keys (renders EmptyPane). A `FossicTile` stub following the same pre-relay pattern as `LumaWeaveTile` would round out the picker. Deferred: fossic substrate data is already visible via `fossic_subscribe` in CerebraSignalTile; a dedicated Fossic tile adds stream-browser UI not yet specced. Add to Phase 4 scope if desired.

**policy-scout-relay.py still unshipped — Track B permanently pre-relay**
`policy-scout-relay.py` is the only blocker for Track B going live. The fossic store path must use `os.path.expanduser()` when calling `Store.open()` in Python (see tile_spec.md §9.3). The relay filter logic and event type list are defined in the spec; implementation is a standalone PS pass.

**Recent decisions section still empty**
`ps_approvals_list` returns pending approvals only. Recent decisions (DENY/ALLOW history) requires either Track B fossic feed or a `policy-scout audit` CLI query. `audit` does not currently have a `--json` flag verified. Deferred to Phase 4 or Track B shipment.

**`defaultAnchor` now optional in TileSectionEntry**
Phase 3 removed `defaultAnchor` from the required fields list in `tileSectionRegistry.validateShape` and made it optional in the `TileSectionEntry` type. Existing registrations that supply `defaultAnchor` remain valid. New registrations (LumaWeave) may omit it; the compositor assigns placement from category.
