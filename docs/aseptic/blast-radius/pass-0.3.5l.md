---
pass: 0.3.5l
version: v0.3.5l
date: 2026-06-18
summary: PolicyScoutTile Track B live — fossic subscription, posture fast-path updates, recent decisions feed
---

# Blast Radius — Pass 0.3.5l (v0.3.5l)

Track B activation for PolicyScoutTile. Wires a `fossic_subscribe("policy-scout/**")`
subscription to the hub store, derives `trackBState` from live event arrival,
fast-paths `LockdownActivated`/`LockdownDeactivated` posture updates (with boot-time
replay guard), backfills historical PS events on mount, and renders a Recent
Decisions feed from `DecisionIssued` events.

## Files

### Modified
- `src/tiles/policy-scout/PolicyScoutTile.tsx` — Track B: +fossic_subscribe useEffect, +psEvents state, +trackBState derived from live events (was hardcoded 'pre-relay'), +posture fast-path on LockdownActivated/Deactivated (boot guard), +backfill from hub store streams, +recentDecisions computed from psEvents, Recent Decisions section now renders DecisionIssued rows, Track B pre-relay placeholder row removed
- `src/tiles/policy-scout/PolicyScoutTile.css` — +.ps-tile__decisions-list, +.ps-tile__decision-row, +.ps-tile__verdict-chip, +.ps-tile__decision-cmd, +.ps-tile__decision-age

### Created
- `docs/aseptic/blast-radius/pass-0.3.5l.md` — this file

---

## Public APIs

None added.

## Behavior changes

**Track B chip:** `trackBState` was `const = 'pre-relay'`. Now `useState('no-data-yet')` → `'live'` on first PS event from hub store, `'source-unreachable'` on subscribe failure.

**Posture fast-path:** `LockdownActivated` from Track B updates `lockdown` + `lockdownReason` immediately on event arrival (boot-time guard: events with `timestamp_us / 1000 < bootTimeMs` are accumulated but do not update posture state). `LockdownDeactivated` clears posture. Track A 15s poll remains as reconciliation tick — it always overwrites with current CLI reality.

**Recent Decisions section:** now renders `DecisionIssued` rows (newest-first, max 20) with verdict chip + cmd + age. Relay filter already ensures only DENY_AND_ALERT / critical events reach the hub — all events in the feed are rendered.

**Backfill:** on mount, reads up to 100 events per `policy-scout/*` stream from the hub store. Deduped against any live events already received. Historical events do NOT trigger posture state updates (boot-time guard applies only to live subscription events).

## Schema changes

None.

## Dependency changes

None.

## Notes

`CerebraSignalTile.tsx` has a pre-existing uncommitted change (backfill block) in the working tree that predates this session. NOT staged here — needs its own commit.
