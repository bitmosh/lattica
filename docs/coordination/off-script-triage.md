---
title: Off-Script Unstaged Work — Triage Report
date: 2026-06-14
pass-context: work left on disk after v0.2.1.a closed; authored by accidental B-prompt execution across ~5 Claude sessions
status: read-only-inspection
---

# Off-Script Unstaged Work — Triage Report

Inspection of all unstaged files left on disk after v0.2.1.a pushed. Read-only pass.
No staging, no edits, no commits.

---

## Section 1 — Inventory Summary

| File / Path | Change type | Lines | Likely source | Matches v0.2.1.b spec? |
|---|---|---|---|---|
| `docs/aseptic/UNIFIED_PASSAGE.md` | new (untracked) | 241 | accidental B-prompt | YES — exceeds spec (8 sections vs spec's implied 7) |
| `docs/coordination/PORTABLE_COMMS_SNIPPET.md` | new (untracked) | 64 | accidental B-prompt | YES — snippet ~35 lines (within spec intent) |
| `docs/coordination/unified-passage/UP-NNN-TEMPLATE.md` | new (untracked) | 284 | accidental B-prompt | YES — all 7 template sections present |
| `docs/aseptic/ADR_FORMAT.md` | modified | +29 lines | accidental B-prompt | YES — adds specified PLAN vs ADR section |
| `docs/coordination/COORDINATION_PATTERNS.md` | modified | +41 lines | accidental B-prompt | PARTIAL — P-011 present, P-012 absent; version bumped to v0.2.1.b |
| `docs/implement/AGENT_TRACE_VOCABULARY.md` | deleted | was 381 | accidental B-prompt | NOT IN SPEC — off-script reorganization |
| `docs/adjacent-project-info/AGENT_TRACE_VOCABULARY.md` | new (untracked) | 381 | accidental B-prompt | NOT IN SPEC — destination of above move |
| `docs/aseptic/merge-gates/pass-0.2.0-merge-gate.md` | new (untracked) | 96 | prior session artifact | not in scope — administrative straggler |

**What's NOT here:** No stash entries. No orphan branches. All changes are pure working-tree edits — the five accidental Claude sessions wrote files but never committed anything. `git reflog` shows clean linear history since v0.2.0. The off-script content is fully contained in the working tree.

---

## Section 2 — Per-File Findings

---

### `docs/aseptic/UNIFIED_PASSAGE.md`

**Change:** New file, 241 lines.

**Content summary:** Comprehensive methodology document for synchronized cross-project execution. Covers: when to run a unified passage (four criteria), versioning (UP-NNN namespace parallel to per-project versions), the five-phase execution pattern (DRAFT → REVIEW → ARM → EXECUTE → POST_FLIGHT), ROLLBACK discipline, concurrency model (filesystem-mediated coordination, developer authorizes ARM→EXECUTE only), sequential/conditional passes as the lightweight alternative, artifacts to track outside the passage directory, and a failure-classification decision tree (critical vs. optional invariants).

**Comparison against v0.2.1.b spec:**
- Spec said "seven major sections including the four-phase pattern, versioning, ROLLBACK." What's here has eight sections — the spec undercounted; all specified content is present.
- The "four-phase" label in the spec is slightly misleading; the implementation correctly has five phases (EXECUTE is split from REVIEW/ARM). The five-phase structure is better, not worse.
- The ROLLBACK section is full and pre-drafted as required. The spec said "ROLLBACK section" without content detail; the file has complete rollback discipline.
- Version stamp is `v0.2.1.b` (the accidental Claudes' version), not `v0.2.1.a`.

**Recommended action: ADOPT.** Content is correct, complete, and well-reasoned. The only thing to fix is the version string — update from `v0.2.1.b` to the adoption pass version before committing. No structural changes needed.

---

### `docs/coordination/PORTABLE_COMMS_SNIPPET.md`

**Change:** New file, 64 lines.

**Content summary:** A paste-into-prompt block for bootstrapping project Claudes in any new session. The snippet itself (~35 lines) covers the grounding pass checklist (4 steps), cross-pollination mirroring, mail_routing.md append discipline, current_state.md update triggers, and references to COORDINATION_PROTOCOL.md and UNIFIED_PASSAGE.md. A "When to update this snippet" section explains size management.

**Comparison against v0.2.1.b spec:**
- Spec said "~30-line paste-into-prompt block." The snippet portion is ~35 lines — within intent.
- The file has 64 lines total including the header and "When to update" section. Those are meta-content the spec didn't enumerate but which are obviously correct to include.
- The snippet references UNIFIED_PASSAGE.md at its correct path — consistent with the rest of the off-script work.
- Version stamp is `v0.2.1.b`.

**Recommended action: ADOPT.** Practical value is immediate — any new project Claude prompt can paste this block without reading 200 lines of protocol first. Fix version string before committing.

---

### `docs/coordination/unified-passage/UP-NNN-TEMPLATE.md`

**Change:** New file, 284 lines. The `unified-passage/` directory was also created; this is its only file.

**Content summary:** Skeleton for new unified passage directories. Includes a bash snippet for scaffolding the directory, a table of the seven required files with owner/when/purpose, and full template blocks for each: OVERVIEW.md, ASSIGNMENTS.md, ROLLBACK.md, EXECUTION_LOG.md, acknowledgments/\<project\>.md, pre-flight/\<project\>.md, and POST_FLIGHT.md.

**Comparison against v0.2.1.b spec:**
- Spec said "skeleton with six required-file template sections." File has seven — POST_FLIGHT.md was added, which is required by UNIFIED_PASSAGE.md's methodology. This is correct; the spec undercounted.
- Every template block is complete with front matter examples, placeholder comments, and decision guidance.
- The EXECUTION_LOG.md template is "starts empty; projects append" — correctly append-only.
- Version stamp is `v0.2.1.b`.

**Recommended action: ADOPT.** Complete and internally consistent with UNIFIED_PASSAGE.md. Fix version string before committing.

---

### `docs/aseptic/ADR_FORMAT.md`

**Change:** Modified (+29 lines appended). File had 181 lines committed; now 210.

**Content summary of diff:** Appends a "PLAN*.md vs ADR*.md — naming for evolving decisions" section. Content covers: mutable-vs-locked semantics, the rename from PLAN-NNN to ADR-NNN when decision solidifies, number stability across rename, when to use PLAN vs. ADR, and a discovery command (`ls docs/adr/PLAN-*` vs. `ls docs/adr/ADR-*`).

**Comparison against v0.2.1.b spec:**
- Spec said "addition of 'PLAN*.md vs ADR*.md' section." Exact match.
- Content is consistent with the same section already in COORDINATION_PROTOCOL.md (distributed in v0.2.1.a). The ADR_FORMAT.md version has slightly more detail, which is appropriate for its audience (Claude writing ADRs vs. Claude doing coordination).
- No version front matter in ADR_FORMAT.md, so no version-string cleanup needed.

**Recommended action: ADOPT.** Exact spec match, no gaps, no conflicts.

---

### `docs/coordination/COORDINATION_PATTERNS.md`

**Change:** Modified (+41 lines, 2-line front matter version bump).

**Content summary of diff:** Two changes:
1. Front matter `version` and `last_reviewed` bumped from `v0.0.0y` to `v0.2.1.b`.
2. New pattern P-011 appended ("Grounding pass before substantive coding pass") — 37-line section covering the 5-step grounding pass checklist, "why this works" rationale, and Lattica Claude application note.

**Comparison against v0.2.1.b spec:**
- Spec said "addition of P-011 (grounding pass) and P-012 (end-of-pass-report 'For project:' sections)."
- **P-011 ✓** — present and complete.
- **P-012 ✗** — ABSENT. The accidental Claudes added P-011 and stopped. P-012 specifying the "For project:" sections in end-of-pass reports is not in this file.
- Version bumped to `v0.2.1.b`. Since the v0.2.1.b blast-radius was never created, this version string is dangling. Should be updated to the adoption pass version.
- **Double horizontal rule** at line 167 (before P-011) — the diff shows `---\n\n---` (two consecutive horizontal rules). This is a minor cosmetic defect from the accidental Claude appending without checking the file's trailing state.

**Recommended action: MERGE.** P-011 is good — keep it. P-012 needs to be added before committing. The double horizontal rule should be cleaned up. Version string needs update. P-012 content is not in the working tree, so whoever executes the adoption pass will need to draft P-012 (end-of-pass-report "For project:" sections) — or the developer can provide P-012 content.

---

## Section 3 — AGENT_TRACE_VOCABULARY Situation

**Current state on disk in Lattica:**
- `docs/implement/AGENT_TRACE_VOCABULARY.md` — DELETED from working tree (unstaged deletion)
- `docs/adjacent-project-info/AGENT_TRACE_VOCABULARY.md` — NEW 381-line file (untracked)
- `diff` between the two: **identical** — this is a pure rename, zero content change

**Current state on disk in fossic:**
- `~/Projects/fossic/docs/implement/AGENT_TRACE_VOCABULARY.md` — EXISTS, **919 lines**
- Last commit note in Lattica git log for the Lattica copy: `28c8e50 chore(aseptic): adopt Aseptic methodology as Lattica's working copy` — meaning this file was copied into Lattica at repo inception, not updated since

**The divergence:** Fossic's canonical is 919 lines and includes a Consumer Extension Registry table at the top (listing Cerebra and Policy Scout as registered consumers). The Lattica copy (381 lines) predates this addition — it has an earlier scope line and lacks the Consumer Extension Registry table entirely. The Lattica copy is approximately the v1 draft; fossic's is the current document.

**Why the deletion + move happened:** The accidental Claudes likely recognized the file was out of place in `docs/implement/` (a directory for Lattica's own implementation docs, not adjacent project info). Moving it to `docs/adjacent-project-info/` (which already contains `cerebra_extract.md`, `aistack_extract.md`, etc.) is logically correct for a reference copy.

**The two interpretations:**

**(a) Fossic-only canonical, Lattica pointer only.** Delete the Lattica copy entirely. Replace with a pointer document in `docs/adjacent-project-info/AGENT_TRACE_VOCABULARY.md` (or elsewhere) that says "canonical is at `~/Projects/fossic/docs/implement/AGENT_TRACE_VOCABULARY.md`; read that, not this." This is the prior decision and remains the architecturally cleaner approach. The problem: Lattica Claudes working offline or without fossic context lose the vocabulary.

**(b) Keep the Lattica reference copy, accept drift.** Stage the rename (`implement/` → `adjacent-project-info/`) and accept that the Lattica copy will occasionally be stale relative to fossic. Lattica Claudes have local access to `~/Projects/fossic/`, so drift is discoverable by comparing. The problem: two copies invite version confusion and the accidental Claudes already demonstrated they use whichever copy is at hand without checking freshness.

**Decision-critical note:** The Lattica copy is currently **538 lines stale** (381 vs. 919). The fossic canonical added the Consumer Extension Registry and presumably Cerebra vocabulary sections. If Lattica Claude ever answers questions about agent trace event types from the Lattica copy, those answers will be wrong about Cerebra integration. This makes the "pointer only" option more compelling.

**Recommended action: DEFER.** This decision is the developer's. The triage report surfaces it; Claude Code won't act on it until directed. Once the developer decides, the mechanical execution is one of: (a) delete working-tree `adjacent-project-info/AGENT_TRACE_VOCABULARY.md` + restore `implement/AGENT_TRACE_VOCABULARY.md` + write a pointer doc; or (b) stage the rename as-is + plan a sync pass to update the Lattica copy from fossic.

---

## Section 4 — Overall Recommendation

**Least-effort path to clean state:** Run a single v0.2.1.c cleanup pass. Adopt `UNIFIED_PASSAGE.md`, `PORTABLE_COMMS_SNIPPET.md`, `UP-NNN-TEMPLATE.md`, and the `ADR_FORMAT.md` addition as-is (fix version strings from v0.2.1.b → v0.2.1.c). For `COORDINATION_PATTERNS.md`, adopt P-011 and draft P-012 (end-of-pass "For project:" section) in the same pass — it's a 20–30 line addition, scope is well-defined. Add `pass-0.2.0-merge-gate.md` to the commit as an administrative straggler. Leave `AGENT_TRACE_VOCABULARY.md` untouched (either way) until the developer decides the interpretation. 

**Adopts:**
- `docs/aseptic/UNIFIED_PASSAGE.md` — complete, correct, version string update only
- `docs/coordination/PORTABLE_COMMS_SNIPPET.md` — complete, version string update only
- `docs/coordination/unified-passage/UP-NNN-TEMPLATE.md` — complete, version string update only
- `docs/aseptic/ADR_FORMAT.md` additions — exact spec match
- `docs/aseptic/merge-gates/pass-0.2.0-merge-gate.md` — minor straggler, stage as-is

**Merges (needs one addition before committing):**
- `docs/coordination/COORDINATION_PATTERNS.md` — adopt P-011, draft+add P-012, fix double horizontal rule, update version string

**Defers (do not touch until developer decides):**
- `docs/implement/AGENT_TRACE_VOCABULARY.md` deletion + `docs/adjacent-project-info/AGENT_TRACE_VOCABULARY.md` creation

**Can v0.2.1.b be skipped?** Effectively yes — the content is 95% present from the accidental executions. The only gap is P-012. The v0.2.1.c cleanup pass absorbs that gap and closes the loop cleanly without needing to formally "run" the v0.2.1.b prompt as written.

---

## Section 5 — Recommended Next Pass

**Pass version:** `v0.2.1.c` (cleanup — absorb off-script B-prompt work)

**Scope:**
1. Add P-012 ("end-of-pass-report 'For project:' sections") to `docs/coordination/COORDINATION_PATTERNS.md` — one section, ~20-30 lines, follows P-011
2. Fix the double horizontal rule before P-011 in `COORDINATION_PATTERNS.md`
3. Update `version` / `last_reviewed` front matter in all four adopted files to `v0.2.1.c`
4. Stage and commit: `UNIFIED_PASSAGE.md`, `PORTABLE_COMMS_SNIPPET.md`, `unified-passage/UP-NNN-TEMPLATE.md`, `ADR_FORMAT.md` (diff already applied), `COORDINATION_PATTERNS.md` (with P-012 added), `merge-gates/pass-0.2.0-merge-gate.md`
5. Two-commit SHA pattern + merge gate at `docs/aseptic/merge-gates/pass-0.2.1.c-merge-gate.md`

**Living report bumps:** Bump to `v0.2.1.c`. No new entries expected.

**AGENT_TRACE_VOCABULARY:** NOT in scope. Separate decision + separate pass.

**v0.2.1.b prompt reuse:** The prompt as drafted is no longer needed if v0.2.1.c runs as described above. The content from the accidental executions already covers the deliverable; v0.2.1.c just closes the gap (P-012) and fixes version strings. Do not re-fire the v0.2.1.b prompt — it would write over files that are already mostly correct.

**P-012 content sketch** (developer may want to supply this, or Claude Code can draft it in-pass):

P-012 should describe the "For project:" section convention in end-of-pass reports — specifically how a project Claude writing a PASS COMPLETE or cross-pollination note formats the downstream implications for each relevant project. The pattern is already used informally; P-012 would codify: which projects to address, the `For <project>:` header format, what to include (version, relevant events, blocking/non-blocking status), and the ACK expectation.

---

*Report generated 2026-06-14. Read-only — no files modified during this inspection.*
