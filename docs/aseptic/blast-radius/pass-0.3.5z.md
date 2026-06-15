---
pass: 0.3.5z
version: v0.3.5z
sha: 4b9dc28
date: 2026-06-15
summary: Design coordination scaffolding — directory structure, request template (intent-over-implementation), Lattica's own request filed, invitations sent to all project Claudes; intake step before frontend-design iteration
---

# Blast Radius — Pass 0.3.5z (v0.3.5z)

Coordination infrastructure pass. Sets up the intake structure for visual
design iteration. No code changes; no rendering changes; no methodology
changes. Pure documentation scaffolding for the design workflow.

The design workflow has six steps; this pass covers steps 1-2 of intake:

1. Directory structure + template (this pass)
2. Lattica files its own request as example (this pass)
3. Project Claudes file their requests (next 15-30 min, owned by them)
4. Compile packet (next pass, v0.3.5y likely)
5. Developer takes packet to frontend-design (outside methodology)
6. Extract components + design tables back into repo (future pass once
   frontend-design produces chosen direction)

## Why the template emphasizes intent over implementation

Project Claudes naturally default to describing current visual treatment
when asked about design. That anchors frontend-design to existing approaches.
The template (Sections 2-6) asks instead about data + communication intent +
priority hierarchy, with current implementation explicitly bracketed as
"reference only" in Section 7. This frees frontend-design to propose layouts
that diverge from current state.

## Files

### Created
- `docs/coordination/design/README.md`
- `docs/coordination/design/REQUEST_TEMPLATE.md`
- `docs/coordination/design/requests/lattica/design-request.md`
- `docs/coordination/design/iterations/.gitkeep`
- `docs/coordination/design/packets/.gitkeep`
- `docs/coordination/outbound/2026-06-15_lattica_to_all_design-request-invitation.md`
- `docs/aseptic/blast-radius/pass-0.3.5z.md` — this file

### Modified
- `docs/coordination/mail_routing.md` — Pass v0.3.5z section
- Living reports (`TECH_DEBT.md`, `POLISH_DEBT.md`, `DEVIATION.md`) —
  `last_reviewed: v0.3.5z`
- `docs/aseptic/README.md` — `version: v0.3.5z`

### Absorbed
- `docs/aseptic/pass-complete/pass-0.3.5.md` (straggler)
- `docs/aseptic/merge-gates/pass-0.3.5-merge-gate.md` (straggler)

## Living report updates

### New entries this pass
- TECH_DEBT, POLISH_DEBT, DEVIATION: No new entries.

### Methodology observation
- This is the first time the coordination system handles design work as a
  distinct workflow (vs. code or doc work). The intake-template-then-compile
  pattern generalizes from assignment relays; applied here to a different
  concern (visual design).
- The template's intent-over-implementation framing is the key design
  decision: Section 7 explicitly brackets current state as reference only
  so frontend-design can diverge.

## Adjacent project impact

All five project Claudes receive an outbound invitation to file their design
requests. Each project owns their own request file at
`docs/coordination/design/requests/<project>/design-request.md`.

Forward-looking projects (LumaWeave, Policy Scout, ai-stack/bo) file
hypothetical requests — what their data WILL be when their renderers ship.
This informs the design system to accommodate them ahead of time.
