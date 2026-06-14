---
pass: 0.2.1.c
version: v0.2.1.c
sha: 08fc325
date: 2026-06-14
summary: Absorption + cleanup — off-script v0.2.1.b material absorbed, P-012 added, AGENT_TRACE_VOCABULARY canonicalized to fossic with Lattica pointer
---

# Blast Radius — Pass 0.2.1.c (v0.2.1.c)

Absorption pass. Brings the off-script work that landed between v0.2.1.a's close and
this pass into a properly-tracked state, adds the one missing piece (P-012), and
resolves the AGENT_TRACE_VOCABULARY situation per the developer's decision.

## Methodology note — v0.2.1.a discipline violation

v0.2.1.a landed with five commits where the two-commit SHA pattern called for two.
The violation is acknowledged here in the blast-radius narrative rather than tracked
as TECH_DEBT — the pattern is canonical going forward and v0.2.1.c uses it correctly
as the practical correction. Future passes follow the two-commit rule strictly;
violations get surfaced and stopped at merge gate before push, not absorbed as a
five-commit fait accompli.

## Files

### Created
- `docs/aseptic/UNIFIED_PASSAGE.md` — methodology doc (off-script, version-corrected to v0.2.1.c)
- `docs/coordination/unified-passage/UP-NNN-TEMPLATE.md` — passage skeleton (off-script, version-corrected)
- `docs/coordination/PORTABLE_COMMS_SNIPPET.md` — paste-into-prompt block (off-script, version-corrected)
- `docs/aseptic/merge-gates/pass-0.2.0-merge-gate.md` — backfilled merge gate record (off-script straggler)
- `docs/adjacent-project-info/AGENT_TRACE_VOCABULARY.md` — replaced (was 538-line stale copy, now pointer to fossic canonical)
- `docs/coordination/off-script-triage.md` — read-only triage report authored prior to this pass
- `docs/aseptic/blast-radius/pass-0.2.1.c.md` — this file

### Modified
- `docs/aseptic/ADR_FORMAT.md` — PLAN/ADR naming convention section (off-script, kept as-is)
- `docs/coordination/COORDINATION_PATTERNS.md` — P-011 grounding pass (off-script, kept); double-rule artifact fixed; P-012 end-of-pass-report "For project:" sections added this pass; version bumped to v0.2.1.c
- `docs/aseptic/PASS_REPORTING.md` — "For project:" end-of-pass-report section appended; `last_reviewed` bumped to v0.2.1.c
- `docs/aseptic/TECH_DEBT.md`, `POLISH_DEBT.md`, `DEVIATION.md` — `last_reviewed: v0.2.1.c`
- `docs/aseptic/README.md` — `version: v0.2.1.c`

### Deleted
- `docs/implement/AGENT_TRACE_VOCABULARY.md` — 381-line Lattica working copy removed (was already 538 lines stale vs. fossic canonical). Content superseded by pointer doc at `docs/adjacent-project-info/AGENT_TRACE_VOCABULARY.md`.

## Living report updates

- TECH_DEBT: No new entries.
- POLISH_DEBT: No new entries.
- DEVIATION: No new entries.

## Adjacent project impact

AGENT_TRACE_VOCABULARY canonical location locked: fossic's
`docs/implement/AGENT_TRACE_VOCABULARY.md`. Lattica holds only a pointer doc. All
projects consuming the vocabulary should reference fossic's path; no parallel copy
exists in Lattica anymore.

End-of-pass-report "For <project>:" convention now load-bearing in PASS_REPORTING.md
and COORDINATION_PATTERNS.md P-012. Project Claudes adopt this discipline starting
from their next grounding pass.

## For cerebra:
Methodology docs `UNIFIED_PASSAGE.md` and `PORTABLE_COMMS_SNIPPET.md` are now at their
canonical Lattica locations (`docs/aseptic/UNIFIED_PASSAGE.md` and
`docs/coordination/PORTABLE_COMMS_SNIPPET.md`). Read them at the start of your next
grounding pass. The new "For <project>:" end-of-pass-report convention applies
symmetrically — your cross-pollination passes should include "For lattica:" / "For
fossic:" sections when your work affects them. See
`docs/coordination/COORDINATION_PATTERNS.md` P-012.

## For fossic:
`AGENT_TRACE_VOCABULARY.md` is now canonical at your repo only
(`~/Projects/fossic/docs/implement/AGENT_TRACE_VOCABULARY.md`). Lattica's 381-line
working copy was replaced with a pointer doc at
`docs/adjacent-project-info/AGENT_TRACE_VOCABULARY.md`. No parallel maintenance going
forward. Future vocabulary updates land in your repo; Lattica reads via the pointer.

## For lumaweave:
No direct action. Unified passage methodology is available at
`~/Projects/lattica/docs/aseptic/UNIFIED_PASSAGE.md` for when LumaWeave participates
in a unified passage (likely the eventual Mode B integration).

## For policy-scout:
No direct action. Coordination protocol unchanged; the "For project:"
end-of-pass-report convention applies to your future pass reports when they affect
other projects. See `docs/coordination/COORDINATION_PATTERNS.md` P-012.

## For bo:
No direct action. Same as policy-scout.

## For ai-stack:
No direct action. Same.
