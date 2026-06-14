---
pass: 0.2.1.b
version: v0.2.1.b
sha: content-absorbed-into-08fc325 (v0.2.1.c); living-report-close: 7850adb
date: 2026-06-14
summary: Methodology bundle — unified passage doc, template, PLAN/ADR naming convention, grounding-pass discipline, portable comms snippet
---

# Blast Radius — Pass 0.2.1.b (v0.2.1.b)

Methodology consolidation pass. Five related artifacts about "how Claudes work across 
the platform" written and committed together so they're internally consistent.

## Files

### Created
- `docs/aseptic/UNIFIED_PASSAGE.md` — methodology doc for synchronized cross-project execution
- `docs/coordination/unified-passage/UP-NNN-TEMPLATE.md` — skeleton future passages copy
- `docs/coordination/PORTABLE_COMMS_SNIPPET.md` — paste-into-prompt block for project Claudes
- `docs/aseptic/blast-radius/pass-0.2.1.b.md` — this file

### Modified
- `docs/aseptic/ADR_FORMAT.md` — added PLAN*.md → ADR*.md naming convention section
- `docs/coordination/COORDINATION_PATTERNS.md` — added P-011 grounding-pass discipline
- Living reports + README — `last_reviewed` / `version` bumps

## Living report updates

- TECH_DEBT: No new entries this pass.
- POLISH_DEBT: No new entries this pass.
- DEVIATION: No new entries this pass.

## Adjacent project impact

Methodology documents are platform-shared in intent. Mirror to each project's 
`docs/aseptic/` directory is a follow-up coordination action, not part of this pass. 
Each project Claude's next grounding pass will discover these via 
`COORDINATION_PROTOCOL.md` (if v0.2.1.a has landed and the per-project mirrors of the 
protocol exist).
