---
pass: 0.3.5y
version: v0.3.5y
sha: a3228b1
date: 2026-06-15
summary: Design coordination architectural update — divisible-pane workspace + live-tail-vs-archive split + generalized event-feed tile communicated to all project Claudes; Lattica's design request reframed; v0.3.5z stragglers absorbed
---

# Blast Radius — Pass 0.3.5y (v0.3.5y)

Coordination realignment pass before project Claudes file their design
requests. Significant architectural details surfaced during developer review:
divisible-pane workspace (not fixed-tile dashboard), live tail vs. archive
review split (the primary design challenge for event feeds), generalized
event-feed tile parameterized by stream_glob (vs. per-project tiles), and
per-project framing roles.

## Why this matters

Without this update, project Claudes would file requests against incorrect
architectural assumptions:
- They'd describe per-project tiles instead of renderers-against-stream
- They'd not address the live-tail-vs-archive split (the most important
  thing to solve)
- They wouldn't know about divisible-pane workspace and might compete for
  fixed real estate

Filing against the wrong architecture means frontend-design iteration
produces less useful output. The 10-minute realignment cost is much smaller
than the cost of frontend-design proposing layouts that don't compose.

## Pre-flight surface item

**LumaWeave already filed a design request** at
`docs/coordination/design/requests/lumaweave/design-request.md`. The request
is well-shaped — already raised Q1 (generalized vs. per-project tiles),
used correct stream path, covered five event types with priority hierarchy.
No refile needed; only a live-tail-vs-archive addendum would improve it.
Relay note to LumaWeave included accordingly.

## Files

### Created
- `docs/coordination/outbound/2026-06-15_lattica_to_all_design-architectural-update.md`
- `docs/aseptic/blast-radius/pass-0.3.5y.md` — this file

### Modified
- `docs/coordination/design/requests/lattica/design-request.md` — full
  reframe; original sections replaced with divisible-pane workspace
  framing, live-tail-vs-archive primary challenge, generalized event-feed
  tile architecture, project framing roles
- `docs/coordination/mail_routing.md` — Pass v0.3.5y section appended
- Living reports (`TECH_DEBT.md`, `POLISH_DEBT.md`, `DEVIATION.md`) —
  `last_reviewed: v0.3.5y`
- `docs/aseptic/README.md` — `version: v0.3.5y`

### Absorbed
- `docs/aseptic/pass-complete/pass-0.3.5z.md` (straggler)
- `docs/aseptic/merge-gates/pass-0.3.5z-merge-gate.md` (straggler)

## Living report updates

### New entries this pass
- TECH_DEBT, POLISH_DEBT, DEVIATION: No new entries.

### Methodology observation
- Mid-flight realignment is part of the workflow, not a methodology failure.
  Project Claudes had filed (LumaWeave) or were about to file (others)
  against an under-specified architectural context. The realignment cost
  is low; the cost of letting filed requests anchor frontend-design to
  wrong assumptions would be higher.

## Adjacent project impact

All five project Claudes receive the architectural-update relay. LumaWeave
(already filed) receives a note that their request is solid but a live-tail
addendum would improve it. Others receive full context to file correctly.
