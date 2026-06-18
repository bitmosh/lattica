---
pass: 0.3.5k
version: v0.3.5k
date: 2026-06-18
summary: Shell activity lanes live — fossic subscription, per-lane SVG tick marks, live rate counter
---

# Blast Radius — Pass 0.3.5k (v0.3.5k)

Activates the 6-lane event visualization in the Shell top bar. Replaces static
Phase 1 stubs with a live `fossic_subscribe("**")` subscription, per-lane event
buffers, SVG tick circles animating rightward across each 7 px lane, and a live
total event rate counter.

## Files

### Modified
- `src/components/workspace/Shell.tsx` — +fossic_subscribe useEffect (unsubscribes on teardown), +listen<FossicEventPayload> handler routing by stream prefix, +per-lane LaneEvent buffers (Buffers type), +1 Hz setNow clock, +15 s prune interval, +routeToScope() prefix router (lattica/, cerebra/, lumaweave/, policy-scout/, fossic/, ai-stack/), lane render now contains <svg width="100%" height="7"> with tick circles, rate counter is now derived (events in RATE_WINDOW_MS / 10)

### Created
- `docs/aseptic/blast-radius/pass-0.3.5k.md` — this file

---

## Public APIs

None added.

## Behavior changes

**Activity lanes:** each of the 6 lanes in the top bar now renders up to 80 SVG
tick circles per lane over a 90 s window. Circles slide left over time as their
age fraction increases. Each lane uses its project accent color.

**Rate counter:** was hardcoded `"0.0/s"`. Now derived: sum of events across all
lanes within the last 10 s, divided by 10.

**Stream routing:**
- `lattica/` → lattica lane
- `cerebra/` → cerebra lane
- `lumaweave/` → lumaweave lane
- `policy-scout/` → policy lane
- `fossic/` → fossic lane
- `ai-stack/` → aistack lane

Events on unrecognized stream prefixes are silently dropped.

**Subscription:** single `fossic_subscribe("**")` per mount. Cleans up via
`fossic_unsubscribe` on unmount. Subscribe errors are console-logged only — UI
degrades silently to empty lanes (no error state shown; Shell is always visible).

## Schema changes

None.

## Dependency changes

None.

## Notes

Shell.css unchanged — `.la-shell-activity-lane` already had `position: relative;
height: 7px; border-radius: 1px;` which accommodates the SVG child.

The Phase 1 comment is removed; drawer stub text unchanged.
