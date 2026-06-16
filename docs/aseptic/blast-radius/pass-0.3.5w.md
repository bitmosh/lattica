---
pass: 0.3.5w
version: v0.3.5w
sha: 0bccf1e
date: 2026-06-15
summary: Iteration 4 design ask + backend-prep relay to all five project Claudes; two parallel coordination tracks dispatched; v0.3.5x stragglers absorbed
---

# Blast Radius — Pass 0.3.5w (v0.3.5w)

Dispatch pass. Two parallel coordination tracks:

1. **Iteration 4 design ask** — REQUEST.md filed at 
   `docs/coordination/design/iterations/iter-4/` for developer to carry into 
   claude-design session. Focus: control surface additions (per-tile 
   state pills, filter chips, motion mute + tick, fossic legend footer, 
   Policy Scout 4-state posture pill correction). All read-only observability; 
   no [API-NEW] items in scope. Explicit out-of-scope list provided.

2. **Backend-prep relay** — outbound to all five project Claudes asking 
   them to investigate feasibility/scope/cost of their [API-NEW] items 
   in parallel. Outputs land at 
   `docs/coordination/design/iterations/backend-prep/<project>/investigation.md`.
   Lattica Claude Code compiles into `BACKEND_PREP_REPORT.md` in follow-up 
   pass once 3+ investigations are filed (or after 72 hours).

## Why combined

Both tracks are coordination work, both fire-and-forget. No reason to 
serialize. Iteration 4 design and backend investigation run in parallel 
across the next 24-72 hours; intersection happens at iteration 5 scoping.

## Files

### Created
- `docs/coordination/design/iterations/iter-4/REQUEST.md`
- `docs/coordination/design/iterations/backend-prep/` (directory)
- `docs/coordination/outbound/2026-06-15_lattica_to_all_backend-prep-investigation.md`
- `docs/aseptic/blast-radius/pass-0.3.5w.md` — this file

### Modified
- `docs/coordination/mail_routing.md` — Pass v0.3.5w section appended
- Living reports (`TECH_DEBT.md`, `POLISH_DEBT.md`, `DEVIATION.md`) — `last_reviewed: v0.3.5w`
- `docs/aseptic/README.md` — `version: v0.3.5w`

### Absorbed
- `docs/aseptic/pass-complete/pass-0.3.5x.md`
- `docs/aseptic/merge-gates/pass-0.3.5x-merge-gate.md`

## Living report updates

### New entries this pass
- TECH_DEBT, POLISH_DEBT, DEVIATION: No new entries.

### Methodology observation
- Combined coordination passes work cleanly when both tracks are 
  fire-and-forget. Avoids serialization without conflating concerns. 
  REQUEST.md and outbound relay are distinct artifacts with distinct 
  audiences.

## Adjacent project impact

### For cerebra:
- File: `docs/coordination/outbound/2026-06-15_lattica_to_all_backend-prep-investigation.md`
- From: Lattica
- Action: Investigate backend work required for posture/HOLD mechanism, 
  new cycle trigger, and checkpoint snapshot. File to 
  `docs/coordination/design/iterations/backend-prep/cerebra/investigation.md`.

### For lumaweave:
- File: same outbound relay
- From: Lattica
- Action: Investigation OPTIONAL per Option B (read-only tile for v1). 
  File only if documenting reverse-channel work for future planning.

### For policy-scout:
- File: same outbound relay
- From: Lattica
- Action: Investigate LOCK DOWN / CLEAR LOCKDOWN / RESTART WATCH / 
  approval timeout / default scope / ALLOW SESSION / ALLOW PATTERN / 
  rule mute. Also confirm 4-state posture model (ACTIVE / LOCKDOWN / 
  WATCH-DOWN / STALE) is correct as-filed in REQUEST.md.

### For ai-stack-bo:
- File: same outbound relay
- From: Lattica
- Action: Lower priority. Assess defer-all vs. minimal-control-plane vs. 
  hybrid. Port/config info additions need no backend work.
