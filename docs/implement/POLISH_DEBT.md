# Polish Debt
_audited 2026-07-07_

Dormant functionality that exists in the codebase but is not yet surfaced in the running UI.
Items are factual — code exists for each entry. Nothing speculative.

---

## Phase 2 gated — complete, blocked on `ai-stack-relay.py`

All five renderers below are fully implemented. They are registered in `src/registrations.tsx`
behind a single commented block: `// PHASE 2 — uncomment when ai-stack-relay.py is running live`.
No code changes needed — activate by starting the relay process and uncommenting.

| Item | File | What it does |
|---|---|---|
| `VramBudgetChangedRenderer` | `src/renderers/ai-stack/VramBudgetChangedRenderer.tsx` | Renders GPU VRAM budget change events in the event feed |
| `ModelLoadedRenderer` | `src/renderers/ai-stack/ModelLoadedRenderer.tsx` | Renders model-load events with model name and size |
| `ModelUnloadedRenderer` | `src/renderers/ai-stack/ModelUnloadedRenderer.tsx` | Renders model-unload events |
| `SidecarStartedRenderer` | `src/renderers/ai-stack/SidecarStartedRenderer.tsx` | Renders sidecar process startup events |
| `SidecarStoppedRenderer` | `src/renderers/ai-stack/SidecarStoppedRenderer.tsx` | Renders sidecar process stop events |
| AiStackTile Phase 2 footer | `src/tiles/ai-stack/AiStackTopologyTile.tsx:554` | Live VRAM + model event chips in the inference stack tile footer |

---

## Orphaned components — built, not reachable in the UI

| Item | File | What it does | Gap |
|---|---|---|---|
| `HelloTile` | `src/tiles/HelloTile.tsx` | Full diagnostic tile: store health, canary counter, renderer count, postMessage demo button, live tile entry list | Absent from `TILE_OPTIONS`, `TILE_RENDERERS`, and `TILE_INFO` — users cannot select it |
| `LumaWeaveTile` | `src/tiles/lumaweave/LumaWeaveTile.tsx` | Reflective Twin Architecture stub (Graph A/B live relay) | Selectable but renders placeholder only — live data source is Phase 2+ |

---

## Infrastructure built, runtime counterpart not yet present

| Item | File | What it does | Gap |
|---|---|---|---|
| `tileSectionRegistry` | `src/control-plane/tile-section/tileSectionRegistry.ts` | Registry of 5 tile metadata entries | `Pane.tsx` routes tiles by `TileKey` directly — registry is populated but never consulted |
| postMessage bridge | `src/ipc/postMessageBridge.ts` | ADR-010 `sendToEmbedded()` / `onMessageFromEmbedded()` IPC bridge | `sendToEmbedded()` is a no-op until the Mode B embedded webview exists |

---

## Tauri commands — registered in Rust, no frontend callers

16 of 21 `fossic-tauri` commands are unused by the frontend.
Active commands: `fossic_subscribe`, `fossic_unsubscribe`, `fossic_read_range`, `fossic_list_streams`, `lattica_store_status`.

| Command | Purpose |
|---|---|
| `fossic_list_branches` | List WAL branches |
| `fossic_read_one` | Fetch single event by ID |
| `fossic_read_by_external_id` | Fetch event by external correlation ID |
| `fossic_read_batch` | Fetch a batch of events by ID list |
| `fossic_read_by_correlation` | Walk all events in a correlation chain |
| `fossic_walk_causation` | Walk causation tree from a root event |
| `fossic_read_range_bounded` | Range read with cursor bounds |
| `fossic_read_range_from_cursor` | Range read from cursor position |
| `fossic_read_by_correlation_bounded` | Bounded correlation walk |
| `fossic_read_by_correlation_from_cursor` | Cursor-based correlation walk |
| `fossic_walk_causation_bounded` | Bounded causation walk |
| `fossic_walk_causation_from_cursor` | Cursor-based causation walk |
| `fossic_aggregate_bounded` | Aggregate events within bounds |
| `fossic_read_state_at_version` | Time-travel: state at a specific version |
| `fossic_list_subscribers` | List active subscriptions |
| `fossic_subscription_status` | Health/status of a named subscription |
| `fossic_dispatch_test_event` | Fire a synthetic test event into the store |

---

## Known display bug

| ID | File | Description |
|---|---|---|
| C2 | `src/tiles/fossic/FossicTile.tsx:35–93` | `LANES` static array hardcodes `relayStatus` and `healthy`. The tile correctly computes live health from event buffers, but the static config overrides the chip label — cerebra, lumaweave, policy, and aistack lanes permanently show "pre-relay" regardless of actual subscription activity. Fix: derive `relayStatus` from live buffer activity rather than the static constant. |
