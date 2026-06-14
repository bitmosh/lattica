---
pass: 0.2.1z
version: v0.2.1z
content_sha: 40817bc
blast_radius_sha: e3560e7
date: 2026-06-14
status: AWAITING_APPROVAL
---

# Merge Gate — Pass v0.2.1z

**Two commits on `main`. No push yet. Awaiting developer approval.**

---

## Commits

| # | SHA | Subject |
|---|-----|---------|
| 1 | `40817bc` | docs(adr): backfill contract ADRs 015/016/017 + sweep ADR-009 refs + version-drift note (v0.2.1z content) |
| 2 | `e3560e7` | docs(aseptic): close pass-0.2.1z blast-radius with content SHA |

---

## What landed

**New ADRs:**
- `docs/adr/ADR-015-platform-design-token-namespace.md` — `--portfolio-*` token namespace decision
- `docs/adr/ADR-016-tile-registration-contract.md` — `TileSectionEntry` with `kind` discriminator
- `docs/adr/ADR-017-payload-renderer-registry.md` — T2 payload renderer registry extensibility

**ADR-009 reference sweep:**
- ADR-L-001 → ADR-015
- ADR-L-002 → ADR-016
- ADR-L-003 → ADR-017
- ADR-L-004 → ADR-012 (already filed)
- ADR-L-005 → ADR-018 (planned, not yet filed — annotated as forward reference)

**VERSION_CONVENTION.md:** format drift note appended

**Living reports + README:** bumped to v0.2.1z

---

## Verification checklist

- [x] ADR-015, ADR-016, ADR-017 exist with correct content ✅
- [x] `grep ADR-L- docs/adr/ADR-009-federated-frontend-hosting.md` returns zero results ✅
- [x] VERSION_CONVENTION.md has drift note appended ✅
- [x] Living reports + README bumped to v0.2.1z ✅
- [x] blast-radius `sha: 40817bc` matches commit 1 ✅
- [x] Exactly two new commits ✅
- [x] Working tree clean (except pass-0.2.1.c-merge-gate.md straggler — not part of this pass) ✅
- [x] No push performed ✅

---

## Straggler note

`docs/aseptic/merge-gates/pass-0.2.1.c-merge-gate.md` is untracked — written at the
end of v0.2.1.c but that pass correctly used only its two canonical commits. Left
unstaged; can be committed in a future cleanup or ignored.

---

## Approve to push

Ping #approve-this (`1506441138612080680`) with approval to push these two commits.
After push, PASS COMPLETE goes to #changelog (`1509728570367283250`).
