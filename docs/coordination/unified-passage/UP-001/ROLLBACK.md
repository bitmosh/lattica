---
unified-passage: UP-001
last_reviewed: 2026-06-14
---

# UP-001 — Rollback Plan

Drafted at DRAFT phase per UNIFIED_PASSAGE.md discipline. Executed only if EXECUTE
or POST_FLIGHT fails.

The point of pre-drafting: no agent should be improvising rollback under failure
pressure. Every plausible failure mode in ASSIGNMENTS.md maps to a section here.

## Rollback order

Reverse of execution order — undo dependencies last:

1. **Lattica** (executed last, rolled back first)
2. **Cerebra** (renderer + emission)
3. **fossic** (only if fossic made a code change during execute)

## Trigger conditions

ROLLBACK kicks in when any of these is true:

- A critical invariant (per OVERVIEW.md) fails at POST_FLIGHT
- An EXECUTE-phase pass surfaces an unrecoverable error and the project Claude can't
  fix in scope
- An integration smoke test fails in a way that suggests platform-wide state is wrong

ROLLBACK does NOT trigger when:

- An optional invariant fails (log as DEVIATION, passage closes degraded)
- A project's pre-flight fails (ARM phase didn't authorize EXECUTE; nothing to roll back)
- A code-fix in scope resolves the failure (forward-fix, not rollback)

## Per-project rollback steps

### Section A — fossic rollback (only if fossic shipped a fix during execute)

**If fossic shipped a fix during pre-flight or execute that needs reverting:**

1. fossic Claude identifies the commits that need reverting (single pass or
   multi-commit?)
2. If single commit: `git revert <SHA>` in fossic repo
3. If multi-commit pass: `git revert <SHA1>..<SHA>` or rebase if cleanest
4. Push the revert commit
5. File a cross-pollination at
   `<fossic-repo>/docs/aseptic/cross-pollination/pass-X.Y.rollback.md` notifying
   that fossic's UP-001 fix was reverted
6. Mirror to `~/Projects/lattica/docs/coordination/cross-pollination/fossic/`
7. State after rollback: same as fossic's pre-UP-001 state

### Section B — Platform store corruption recovery

**If the platform store at `~/.lattica/fossic/store.db` is missing or corrupted
discovered during ARM or EXECUTE:**

1. Check for backup: `~/.lattica/fossic/backup/` or similar
2. If backup exists: restore via `cp` and verify with
   `lattica_store_status` Tauri command
3. If no backup: accept loss. Recreate by deleting the corrupted file and letting
   Lattica's startup recreate it (per ADR-014's create-on-startup discipline)
4. Existing Cerebra events are lost in the recreate case — Cerebra cycles run
   again post-recovery will repopulate
5. UP-001 may need to restart from ARM phase after store recovery
6. Cross-pollination as above

### Section C — Cerebra renderer rollback

**If Cerebra's renderer component is broken and can't be fixed in scope:**

1. Cerebra Claude identifies the commits that introduced the renderer
2. `git revert <SHA>` in Cerebra repo for the renderer-introducing commits
3. The registration call against `payloadRendererRegistry` is reverted with the
   commit (registration is in source code; revert removes it)
4. Push the revert
5. File cross-pollination at
   `<cerebra-repo>/docs/aseptic/cross-pollination/pass-X.Y.rollback.md`
6. Mirror to `~/Projects/lattica/docs/coordination/cross-pollination/cerebra/`
7. State after rollback: registry has no Cerebra entry; subscribers fall through
   to JSON pretty-print fallback

**Note:** The Cerebra events already emitted to the platform store are durable
artifacts. Don't try to delete them — that would corrupt the audit trail. They
become "ghost events" that subsequent UP-001 attempts can subscribe to and verify
ingestion against. No data loss; just events without a renderer until UP-001 retries.

### Section D — Cerebra emit-path rollback (events going to wrong store)

**If Cerebra's emit code is sending events to the wrong store path (e.g., per-vault
instead of platform):**

1. This is typically a small fix, not a full rollback. Cerebra Claude fixes the
   emit path; rolls forward instead of rolling back.
2. If forward-fix isn't possible within the pass: revert the Cerebra commit that
   changed emit path (which restores previous behavior — likely also wrong, but
   at least consistent with pre-UP-001 state)
3. The wrong-store events become orphans — harmless, not removed
4. Cross-pollination per Section C pattern

### Section E — Lattica tile rollback

**If Lattica's cerebra tile is broken in a way that affects shell stability or the
HelloTile baseline:**

1. Lattica Claude identifies the v0.3.0 commits to revert (two commits per the
   canonical two-commit pattern — content commit + blast-radius close)
2. `git revert <content-commit-SHA>` — reverts the substantive work
3. The blast-radius close commit can be deleted/orphaned (it references the
   reverted commit's SHA; doesn't matter that the SHA points to reverted content)
4. Push the revert commit
5. Verify HelloTile still works post-rollback (regression check)
6. Lattica's version effectively returns to v0.2.0 — file a small descending-letter
   pass (`v0.2.0z`? Actually v0.2.0 already had cleanup variants; figure out the
   next available descending letter) documenting the rollback
7. PASS COMPLETE for the rollback pass goes to #changelog (Blog Bumper picks it up)
8. Cross-pollination at `docs/aseptic/cross-pollination/pass-rollback.md`,
   mirrored to `docs/coordination/cross-pollination/lattica/`

### Section F — Lattica registry-lookup-miss recovery

**If Lattica's subscription works but the renderer registry lookup returns no match:**

This is typically not a rollback case — it's a fix-forward case. Likely causes:

- Naming mismatch (`SignalEvaluated` vs `signal_evaluated`)
- Module-load ordering (Lattica's subscription opens before Cerebra's registration
  ran)
- Cerebra's registration didn't actually run (silent failure)

1. Lattica Claude debugs the specific cause
2. Most likely fix: a one-line adjustment in Lattica's subscription wiring or
   payload normalization. Ships as forward-fix in the same pass.
3. Cerebra Claude's registration is unlikely to need changes (the contract from
   ADR-017 is stable; Cerebra adhered to it)
4. Only if forward-fix can't land: revert per Section E

## Cross-pollination on rollback (all sections)

Every rollback action produces a cross-pollination file:

```
<project>/docs/aseptic/cross-pollination/pass-X.Y.rollback.md
```

Format:

```markdown
---
source: <project>-claude
target: platform
date: YYYY-MM-DD
topic: UP-001-rollback-<section>
status: rollback
severity: BLOCKING (during rollback) | INFORMATIONAL (after rollback complete)
---

# Rollback — UP-001 Section <X>

[Brief: what was rolled back, why, post-rollback state, what consumers need to know.]
```

Mirrored to Lattica's central cross-pollination index per standard discipline.

## Notification chain

When ROLLBACK is triggered, notify all UP-001 participants AND adjacent projects
that might have been planning against UP-001's success:

- **fossic, Cerebra, Lattica:** direct cross-pollination per Section A/C/D/E
- **LumaWeave, Policy Scout, Bo, ai-stack:** informational note via Lattica's
  outbound channel that UP-001 rolled back; no action expected from them but
  awareness prevents them from assuming UP-001's deliverables are available

The informational notes are post-rollback (after stability is restored), not during.
Don't add cross-Claude noise during active rollback.

## Recovery and retry

After rollback completes:

1. Stability verification — each project confirms their pre-UP-001 state is restored
2. UP-001 is paused, not abandoned
3. Lattica Claude updates OVERVIEW.md and ASSIGNMENTS.md based on what was learned
4. REVIEW phase re-opens with the updated assignments (project Claudes re-ACK
   against the revised plan)
5. ARM and EXECUTE re-run after REVIEW closes
6. POST_FLIGHT same as before

A rolled-back UP-001 is a learning event, not a failed methodology. The
methodology proves its value by handling failure cleanly.

## Maximum rollback iterations

If UP-001 rolls back twice in a row, halt and reassess. Two rollbacks suggests
either:

- The scope is wrong (too ambitious for the methodology validation)
- The methodology is missing something (e.g., better integration testing in
  pre-flight)
- The platform isn't ready (some prerequisite work needs to happen first)

In any of those cases, drop UP-001, return to per-project work for a stretch, and
re-attempt unified-passage methodology with a smaller scope (UP-002 might become
"just Lattica renders ANY single event from a known fixture" — even narrower
than UP-001).

---

*This is UP-001 ROLLBACK.md. Sections A-F map to specific failure modes in
ASSIGNMENTS.md. The pre-drafted shape is the discipline; the actual execution
follows the steps as written.*
