---
title: Pass Reporting — Structured Format
last_reviewed: v0.0.0x
---

# Pass Reporting — Structured Format

The structured pass report is the internal completion artifact for every Lattica pass.
It is written before the PASS COMPLETE Discord message — the Discord message is derived
from it, not the other way around.

---

## Required sections

```markdown
# Pass Report — Pass N (vX.Y.Z)

**Date:** YYYY-MM-DD
**Version:** vX.Y.Z
**Type:** load-bearing | cleanup (descending-letter)

---

## 1. Deliverables status

| Deliverable | Status | Notes |
|---|---|---|
| [what was specified] | DONE / PARTIAL / SKIPPED | reason if not DONE |

If partial or skipped: explain what remains and whether it's a STOP or a
deliberate deferral with a tracking entry.

---

## 2. Test results

```
[paste verbatim output of the test run — do not summarize]
```

Or if tests were not run: explain why (docs-only pass, no runnable tests affected).

---

## 3. Files touched

Reference the blast-radius file: `docs/aseptic/blast-radius/pass-N.md`

Summary here:
- Modified: [count] files
- Created: [count] files  
- Deleted: [count] files

Key files: [list the 3-5 most significant]

---

## 4. API changes

Reference the blast-radius file for full list. Highlight here:
- Breaking changes: [none | list]
- New public APIs: [none | list]
- Removals: [none | list]

---

## 5. Living report updates

### New entries this pass

- TECH_DEBT: [none | TD-NNN (title)]
- POLISH_DEBT: [none | PD-NNN (title)]
- DEVIATION: [none | DV-NNN (title)]

**If no new entries:** "No new entries this pass." (explicit confirmation required)

### Entries resolved this pass

- [none | ID — title — resolution summary]

---

## 6. Adjacent project impact

Reference the cross-pollination file if one was produced: `docs/aseptic/cross-pollination/pass-N.md`

If no cross-pollination file: "No adjacent-project impact this pass."

If cross-pollination file exists: list impacted projects and severity.

---

## 7. PASS COMPLETE message ready

The following is ready to post to #changelog:

```
── PASS COMPLETE · vX.Y.Z · YYYY-MM-DD ──────────────────────

Title: [4–8 word blog-suitable title]
Summary: [one sentence, 20–300 chars]
Project: lattica

Highlights:
· [concrete behavioral change — derived from blast-radius]
· [concrete behavioral change]
· [concrete behavioral change]

Learnings:
· [optional methodology/architecture insight]

Commit: [7-char merge SHA]
Tests: [N] passed · [M] failed · [K] skipped
Branch: clean
```
```

---

## The "no new entries" requirement — why it's structural

Section 5 requires an explicit "No new entries this pass" confirmation when there are
no living report updates. This is not optional.

The failure mode it prevents: an agent that made no living report updates is
indistinguishable from an agent that didn't check — unless absence is made explicit.
A pass report that simply omits Section 5 reads as "nothing to report here" but could
equally mean "I forgot to check."

Forced explicit confirmation converts the ambiguity into a clear signal: this agent
checked the living reports, found nothing new to add, and confirmed that explicitly.
If a future supervisor pass finds a debt that this pass should have caught, the gap
is visible: the agent said "no new entries" when there was one.

---

## Deviations from this format

If a pass has a good reason to omit or modify a section, document that in the report:

```markdown
## 2. Test results

Not applicable: this is a docs-only pass (v0.10.x). No source files were modified;
no test suite was run.
```

Omitting a section silently is not acceptable.

---

## Commit SHA recording — the two-commit pattern

The blast-radius file records the merge SHA of the pass it documents. Two
approaches exist; the **two-commit pattern** is canonical going forward.

### Old approach (amend-with-SHA) — DO NOT USE for new passes

1. Write blast-radius with `sha: <placeholder>`
2. Commit everything including the blast-radius file
3. Amend the commit to replace placeholder with the (now-orphaned)
   pre-amend SHA

Problem: `git commit --amend` rewrites the commit. The SHA referenced in
the blast-radius file is the pre-amend SHA, which becomes orphaned in
the reflog rather than reachable via branch traversal. The file points to
a commit that effectively no longer exists.

Used by: v0.0.0z, v0.0.0y, v0.1.0 (pre-fix). Cosmetic limitation; doesn't
affect git history correctness.

### New approach (two-commit) — use this

1. Stage the pass content (everything *except* the blast-radius file)
2. Write the blast-radius file with `sha: <will-record-after-content-commit>`
   as a placeholder — but do NOT stage it yet
3. Commit just the content as **commit 1**
4. Capture commit 1's real SHA: `SHA=$(git rev-parse --short HEAD)`
5. Edit the blast-radius file's `sha:` field with the actual `$SHA`
6. Stage and commit just the blast-radius file as **commit 2**

```
git add <all-pass-content-except-blast-radius>
git commit -m "<pass message>"
SHA=$(git rev-parse --short HEAD)
sed -i "s|sha: <will-record-after-content-commit>|sha: $SHA|" docs/aseptic/blast-radius/pass-X.Y.Z.md
git add docs/aseptic/blast-radius/pass-X.Y.Z.md
git commit -m "docs(aseptic): close pass-X.Y.Z blast-radius with content SHA"
```

Commit 1's SHA is stable and reachable via branch. Commit 2's SHA doesn't
matter because nothing references it. The blast-radius file in commit 2
correctly points to the content commit.

Used by: bootstrap pass v0.0.0 (which had a similar two-commit approach
for the same reason). v0.0.0x ratifies this as canonical and all passes
v0.0.0x forward use it.

### Why this matters

The PASS COMPLETE message (sent to blog.bumper / Discord) includes the
merge SHA. If that SHA is orphaned, links to "click here for the
commit" don't resolve. For dev-log credibility — and for the
self-referential audit trail Aseptic depends on — the SHA in the
blast-radius must point to a reachable commit.
