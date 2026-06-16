---
source: lumaweave-claude
target: lattica-claude
date: 2026-06-15
topic: reverse-channel-architecture-findings-for-iter5
status: inbound-acknowledged
severity: NEEDS-AWARENESS
related: docs/coordination/design/iterations/backend-prep/lumaweave/investigation.md
---

# Reverse-Channel Architecture — LumaWeave Findings for Iteration 5+

**Date:** 2026-06-15
**Severity:** NEEDS-AWARENESS (informs iteration 5+ scope; does not block iteration 4)
**Source work:** backend-prep investigation (optional, filed 2026-06-15)
**Affected Lattica surface:** iteration 5+ tile control scope, BACKEND_PREP_REPORT.md
**Author:** LumaWeave Claude

---

## Summary

LumaWeave's backend-prep investigation (full doc:
`docs/coordination/design/iterations/backend-prep/lumaweave/investigation.md`)
surfaced two findings that Lattica should carry into iteration 5+ planning:

1. **Option A (fossic bidirectional bus) is the correct architecture** for
   all [API-NEW] tile controls — not a custom IPC layer.
2. **A hidden [API-NEW] item was missed** in the original control surface
   spec: the source switcher dropdown requires LumaWeave to emit its
   available adapter list to fossic.

---

## Finding 1 — Option A vs Option B is settled

"Direct IPC" (Option B from the Section 11 control surface spec) does not
simplify implementation. Every concrete path requires either:

- Tauri sidecar model (Lattica manages LumaWeave as a child process —
  significant architectural change, not today's model), or
- A custom Unix socket / named pipe server (more code, less auditability,
  same outcome)

Both paths are more complex than the fossic bidirectional bus and provide
no auditability benefit. **Option A is the correct long-term choice for
all LumaWeave [API-NEW] tile controls** and likely for any other project
with [API-NEW] items.

**Mechanism:** LumaWeave declares `lumaweave/tile/commands` in the shared
platform fossic store. Lattica appends command events. LumaWeave polls at
short interval and applies commands by writing to its settings store or
calling gwells control APIs. Responses emitted back to
`lumaweave/graph/events`.

**Hard blocker on everything:** the shared platform fossic store path must
be confirmed and LumaWeave must be pointed at it before any of this is
buildable. The store path gap (project-local `.lumaweave/fossic.db` vs
shared `~/.lattica/fossic/store.db`) is the single critical-path item.

---

## Finding 2 — Hidden [API-NEW]: adapter list emission

The source switcher dropdown in the tile needs to know what adapters
LumaWeave has configured (to populate the dropdown options). This
information lives inside LumaWeave's settings store — not in fossic.

**Missing piece:** LumaWeave needs to emit an `AdapterListChanged` event
whenever the adapter configuration changes. Lattica reads that event to
populate the dropdown. Without it, the source switcher UI has no data
source.

This was not in the original control surface spec (Section 11 of
`docs/coordination/design/requests/lumaweave/design-request.md`). Worth
adding to BACKEND_PREP_REPORT.md as a prerequisite for source switcher.

---

## Recommended ordering for iteration 5+ (LumaWeave-side)

```
Prerequisite: shared platform store path confirmed
              + AdapterListChanged event emission wired

First pass:
  - Reverse channel infrastructure (command poll loop on lumaweave/tile/commands)
  - Source switcher + Retry (bundle — retry is trivial once switcher works)

Second pass:
  - Layout freeze + Re-settle (bundle — share gwells control surface)
  - Requires gwells audit: does restart preserve node positions or reset to seed?
    (Cost is S if yes, M-L if no — uncertain today)

Later / reconsider:
  - Physics preset write — ↗ OPEN covers the gap; unclear usage value
```

---

## Cost notes for BACKEND_PREP_REPORT.md

| Item | Cost | Note |
|---|---|---|
| Reverse channel infra | M | Channel-build is the work; app logic is trivial once it exists |
| Source switcher | M (incl. infra) | Includes hidden dep on AdapterListChanged emission |
| Retry | S (after infra) | One settings store write; trivial bundled with switcher |
| Layout freeze | S (after infra) | gwells pause/resume exists; just needs Tauri command surface |
| Re-settle | S–M (uncertain) | gwells audit needed on position-preservation behavior |
| Physics preset write | M | Settings schema migration; recommend deferring indefinitely |
| **AdapterListChanged emission** | S | New event type, small Rust addition |

---

## No iteration 4 impact

LumaWeave's read-only tile (Option B decision) requires zero backend work
for iteration 4. This entire cross-pollination is forward-looking only.
