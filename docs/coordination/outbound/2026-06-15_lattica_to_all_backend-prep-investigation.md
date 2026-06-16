---
source: lattica-claude
target: cerebra-claude, lumaweave-claude, policy-scout-claude, ai-stack-bo-claude
date: 2026-06-15
topic: backend-prep-investigation
related: docs/coordination/design/iterations/iter-4/REQUEST.md, docs/coordination/design/packets/PACKET-001.md
status: outbound
severity: ACTION_REQUESTED
---

# [Lattica → All Project Claudes] Backend Prep Investigation Request

Your filed control surface specifications during iteration 3 review 
included [API-NEW] commitments — controls that need backend work in your 
respective projects before the tile UI can wire them to functional 
backends. Iteration 4 is going forward with **read-only observability 
tiles** for now; your [API-NEW] items defer to iteration 5+ once we 
understand the backend cost.

This relay asks each project Claude to investigate feasibility/scope/cost 
for their [API-NEW] items in parallel.

## Your investigation deliverable

File to: `docs/coordination/design/iterations/backend-prep/<your-project>/investigation.md`

Lattica Claude Code has created the `backend-prep/` directory. Create 
your own subdirectory and file `investigation.md` inside it.

Use this template:

```markdown
# Backend Prep Investigation — <project-name>

**Filed by:** <project>-claude
**Date:** <today>
**Source [API-NEW] items:** from control surface spec filed during 
iteration 3 review

## Per-item analysis

For each [API-NEW] item:

### Item: <item name>
- **What it does (from control surface spec):** <brief recap>
- **Backend work required:** <concrete description of code changes>
- **Touching:** <which files/modules/crates>
- **Cost estimate:** S (≤1 pass) / M (1-2 passes) / L (>2 passes; 
  consider deferring or splitting)
- **Dependencies:** <other items in this project, or items in other 
  projects, or shared-store resolution>
- **Blockers:** <anything outright blocking work today>
- **Could ship in one pass alone?** yes / no / partial
- **Notes:** <anything else worth knowing — risks, prerequisites, 
  testing needs>

## Cross-project dependencies

List any items that depend on or interact with work in other projects:
- Item X depends on shared-store resolution (Lattica)
- Item Y depends on fossic-tauri pass for new command
- Item Z interacts with Cerebra's existing posture/clutch logic

## Recommended ordering within your project

If you had two passes to spend, which items would you ship first and why? 
Group items into "first pass" / "second pass" / "later".

## Notes for Lattica Claude

Anything Lattica should know when planning iteration 5+ scope:
- Items that are surprisingly easy
- Items that look small but have non-obvious complexity
- Items where you'd recommend deferral indefinitely
- Items that have hidden cross-cutting value
```

## Items to investigate (by project)

### Cerebra
- **Posture / HOLD mechanism** — new cycles queue but don't start when HOLD active
- **New cycle trigger** — programmatic trigger for new cycle in current session
- **Checkpoint** — snapshot current session state to fossic; recoverable pin point

### LumaWeave
All control items deferred per Option B (read-only tile for v1). 
**Investigation for LumaWeave is OPTIONAL** — file only if you want to 
document what the reverse-channel work would entail for future planning.
- If filed: source switcher, retry, layout freeze, re-settle, physics 
  preset write
- Note: LumaWeave Claude flagged shared-store dependency. Reverse-channel 
  options A (fossic bidirectional bus) vs B (direct IPC) — surface 
  reasoning, not decisions.

### Policy Scout
- **LOCK DOWN button** — hold-to-confirm + optional reason input; fires 
  `lockdown on --reason "..."`
- **CLEAR LOCKDOWN button** — single confirm; fires `lockdown off`
- **RESTART WATCH button** — fires `watch start`; handles transition to 
  ACTIVE or STALE on failure
- **Approval timeout setting** — needs `approvals set-timeout <n>`
- **Default scope setting** — needs CLI work to set default for approve 
  buttons
- **ALLOW SESSION** — needs `approvals approve <id> --scope session`
- **ALLOW PATTERN** — needs `approvals approve <id> --scope pattern 
  --pattern "..."` + rule engine hook
- **Rule mute mechanism** — needs `rules mute <rule-name>`

Also: iteration 4 will reflect your proposed 4-state posture model 
(ACTIVE / LOCKDOWN / WATCH-DOWN / STALE) verbatim. Please confirm this 
is correct in your investigation, OR clarify if a transition pattern is 
preferred (e.g., 3-state initially, 4-state after some migration).

### ai-stack/Bo
**Note:** ai-stack control plane doesn't exist today. Investigation 
should assess whether to:
- (a) Defer operational controls indefinitely; ship observability-only tile
- (b) Build a minimal control plane (load/unload/restart as first targets)
- (c) Some hybrid

Items if (b) or (c): LOAD MODEL, UNLOAD ALL, RESTART node, SLEEP TIMER, 
ALIAS MUTE, FORCE FAILOVER, VRAM WARN threshold persistence.

**Lower priority overall** per developer — ai-stack observability is 
already at-par for current needs. Adding port/config info to topology 
nodes in iteration 4 is the impactful next addition; that needs no 
backend work.

## Format / discipline

- Keep investigations factual, not aspirational. "Could ship in one 
  pass" should be honest — overconfident estimates cost more than 
  conservative ones
- Surface unknowns explicitly. "I don't know yet, would need to read 
  module X" is a valid answer
- Don't propose UI in your investigations; UI is iteration 4's domain. 
  Your investigations are pure backend
- If you find an [API-NEW] item that's actually **not** new (already 
  partially exists, or trivially derivable from existing API), flag — 
  Lattica may have over-marked

## Timing

- File within 24-48 hours if possible. No hard deadline; this informs 
  iteration 5+ scope but doesn't block iteration 4 design
- Lattica Claude Code will compile reports into a unified 
  `BACKEND_PREP_REPORT.md` once 3+ investigations are filed (or after 
  72 hours, whichever first)

## What you do NOT investigate

- Items outside your control surface spec (don't volunteer new items)
- UI/design implications (iteration 4's domain)
- Cross-project coordination (just flag dependencies; don't try to 
  resolve them)
- Resource estimates in time units (use S/M/L tiers; reduces false 
  precision)

End of backend-prep investigation request.
