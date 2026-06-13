---
pass: "00"
version: v0.0.0
sha: becf6a3
date: 2026-06-13
summary: "Lattica repo bootstrap — git init, Aseptic adoption, requirements scaffolding"
---

# Blast Radius — Pass 00 (v0.0.0)

> The bootstrap pass. Lattica was created in this commit sequence.
> Files created across multiple atomic commits; this entry aggregates
> the bootstrap scope and will be updated with the closing SHA.

## Files

### Created (this pass)

**Root hygiene (commit 1):**
- `.gitignore` — Tauri/React/Rust/Python/Node monorepo defaults
- `README.md` — root README with project description and docs pointers

**LATTICA_NOW.md (commit 2):**
- `docs/LATTICA_NOW.md` — live state file with accurate Phase 0 ground truth

**Aseptic adoption (commit 3 — transforming existing fossic working copy):**
- `docs/aseptic/README.md` — rewritten as Lattica-specific (was "fossic Working Copy")
- `docs/aseptic/CROSS_POLLINATION.md` — adjacent projects table replaced with Lattica's
- `docs/aseptic/ADR_FORMAT.md` — namespace updated ADR-F-NNN → ADR-L-NNN
- `docs/aseptic/PASS_REPORTING.md` — example block updated Project: fossic → lattica
- `docs/aseptic/AGENT_BRIEFING.md` — all fossic project references updated to lattica
- `docs/aseptic/TECH_DEBT.md` — replaced with Lattica bootstrap seed (empty)
- `docs/aseptic/POLISH_DEBT.md` — replaced with PD-001 (naming drift)
- `docs/aseptic/DEVIATION.md` — replaced with DV-001 (ADR-001 registry hooks)
- `docs/aseptic/blast-radius/pass-00.md` — this file

**Requirements scaffolding (commit 4):**
- `docs/requirements/README.md`
- `docs/requirements/REQUEST_TEMPLATE.md`
- `docs/requirements/RESPONSE_TEMPLATE.md`
- `docs/requirements/fossic/responses.md`
- `docs/requirements/fossic/decisions.md`
- `docs/requirements/lumaweave/responses.md`
- `docs/requirements/lumaweave/decisions.md`
- `docs/requirements/cerebra/responses.md`
- `docs/requirements/cerebra/decisions.md`
- `docs/requirements/policy-scout/responses.md`
- `docs/requirements/policy-scout/decisions.md`
- `docs/requirements/bo/responses.md`
- `docs/requirements/bo/decisions.md`
- `docs/requirements/ai-stack/responses.md`
- `docs/requirements/ai-stack/decisions.md`
- `docs/requirements/rhyzome/responses.md`
- `docs/requirements/rhyzome/decisions.md`
- `docs/requirements/bonsai/responses.md`
- `docs/requirements/bonsai/decisions.md`
- `docs/requirements/group-rounds/.gitkeep`

**Existing files committed as-is (all prior docs committed in one of the above commits):**
- `CLAUDE.md`, `docs/adr/ADR-001` through `ADR-008`
- `docs/EVENT_FABRIC.md`, `docs/SENIOR_DEV_REVIEW.md`
- `docs/implement/` subtree (FOSSIC_V1_SPEC.md, CCE_SPEC.md, etc.)
- `docs/adjacent-project-info/` subtree (extract docs per project)
- `docs/requirements/fossic/REQUIREMENTS.md` (260 lines, deposited pre-bootstrap)
- `docs/aseptic/` spec files not edited above (INTRODUCTION.md, LIVING_REPORTS.md,
  BLAST_RADIUS.md, SUPERVISOR_PROTOCOL.md, VERSION_CONVENTION.md, aseptic-notes.md,
  aseptic-artifacts.md) — retained as fossic reference material
- `docs/aseptic/blast-radius/pass-01.md` through `pass-11.md` — fossic's historical
  blast-radius entries, retained as reference
- `docs/aseptic/cross-pollination/` — fossic's historical cross-pollination entries,
  retained as reference

### Modified

None in the traditional sense — this is a fresh repo.

### Deleted

None.

## Public APIs

### Added

None — docs-only pass.

## Schema changes

None.

## Configuration changes

None.

## Dependency changes

None.

## Behavior changes

None — no production code exists.

## Living report updates

### New entries this pass

- TECH_DEBT: none
- POLISH_DEBT: PD-001 — "ES toolkit" / "lattica-es" naming drift across planning docs
- DEVIATION: DV-001 — ADR-001 registry hooks assumed to exist but do not

### Entries resolved this pass

None.
