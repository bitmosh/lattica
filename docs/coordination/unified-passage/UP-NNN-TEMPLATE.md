---
template-name: UP-NNN-skeleton
template-version: v1
last_reviewed: v0.2.1.c
---

# UP-NNN Template

Skeleton for unified passage directories. To start a new unified passage:

```bash
NEW_UP=UP-002  # or whatever the next number is
mkdir -p ~/Projects/lattica/docs/coordination/unified-passage/$NEW_UP/{acknowledgments,pre-flight}
cd ~/Projects/lattica/docs/coordination/unified-passage/$NEW_UP/
cp ../UP-NNN-TEMPLATE.md ./README.md
# Then create OVERVIEW.md, ASSIGNMENTS.md, ROLLBACK.md per the templates below
```

The six required files in every unified passage directory:

| File | Owner | When | Purpose |
|---|---|---|---|
| `OVERVIEW.md` | Lattica Claude | DRAFT | What the passage accomplishes, success criteria, dependency graph |
| `ASSIGNMENTS.md` | Lattica Claude | DRAFT | Per-project scope, invariants, dependencies, provides/unblocks |
| `ROLLBACK.md` | Lattica Claude | DRAFT | Failure-mode handling drafted before execution |
| `acknowledgments/<project>.md` | Each project | REVIEW | ACK or pushback on assignment |
| `pre-flight/<project>.md` | Each project | ARM | Pre-flight readiness check result |
| `EXECUTION_LOG.md` | All projects | EXECUTE | Append-only log of execution commits |
| `POST_FLIGHT.md` | Lattica Claude | POST | Platform-wide verification result |

---

## OVERVIEW.md template

```markdown
---
unified-passage: UP-NNN
status: draft | review | armed | executing | post-flight | complete | rolled-back
created: YYYY-MM-DD
target-execution-date: YYYY-MM-DD or "when all PRE_FLIGHT PASS"
participating-projects:
  - lattica
  - cerebra
  - fossic
  - ...
---

# UP-NNN — <Title>

## What this passage accomplishes

<One paragraph. The platform-wide outcome, not per-project deliverables. Success 
criterion stated in user-observable terms.>

## Why this requires synchronization

<Why a unified passage rather than sequential per-project passes? What goes wrong if 
projects execute out of order or in isolation?>

## Critical invariants (must hold at POST_FLIGHT)

1. <Invariant 1>
2. <Invariant 2>
3. ...

## Optional invariants (failure logged as DEVIATION but passage still closes)

1. <Invariant 1>
2. ...

## Dependency graph

\`\`\`
fossic → cerebra → lattica
  ↓
policy-scout
\`\`\`

(Or written explicitly: "fossic must execute first; cerebra and policy-scout both 
depend on fossic; lattica depends on cerebra.")

## Execution order (topological sort of dependency graph)

1. fossic
2. cerebra
3. policy-scout (parallel with lattica step 4 — no inter-dependency)
4. lattica

## Estimated coordination overhead

DRAFT: <hours/days>
REVIEW: <hours/days>
ARM: <hours/days>
EXECUTE: <hours/days>
POST_FLIGHT: <hours/days>

(Helps the developer scope the passage realistically.)
```

---

## ASSIGNMENTS.md template

```markdown
---
unified-passage: UP-NNN
last_reviewed: YYYY-MM-DD
---

# UP-NNN — Per-Project Assignments

## <project-name>

**Scope:** <What this project does in this passage. Concrete and bounded.>

**Provides:**
- <What this project's slice makes available to other projects>

**Unblocks:**
- <Which other projects depend on this slice completing>

**Depends-on-execution:**
- <Other projects whose work must land first>

**Invariants at end of execution:**
1. <Invariant>
2. <Invariant>

**Failure modes:**
- <Specific failure mode> → <Handled by ROLLBACK section X>

**Pre-flight checks:**
- [ ] Working tree clean
- [ ] <project-specific check>
- [ ] <project-specific check>

**Pass version:** <project>/vX.Y.Z

---

(Repeat per project.)
```

---

## ROLLBACK.md template

```markdown
---
unified-passage: UP-NNN
last_reviewed: YYYY-MM-DD
---

# UP-NNN — Rollback Plan

Drafted at DRAFT phase. Executed only if EXECUTE or POST_FLIGHT fails.

## Rollback order (reverse of execution order)

1. <last project to execute>
2. ...
N. <first project to execute>

## Per-project rollback steps

### <project-name>

**If this project's execute failed:**
- <Specific revert steps>

**If a later project's execute failed and we need to undo this one:**
- <Specific revert steps; may differ from above>

**Cross-pollination on rollback:**
- File `<project>/docs/aseptic/cross-pollination/pass-X.Y.rollback.md`
- Mirror to `lattica/docs/coordination/cross-pollination/<project>/`
- Notify: <list of affected projects>

---

(Repeat per project, in rollback order.)
```

---

## EXECUTION_LOG.md template (starts empty; projects append during EXECUTE)

```markdown
---
unified-passage: UP-NNN
status: in-progress | complete
---

# UP-NNN — Execution Log

Append-only. Each project appends their entry immediately after their pass commits.

\`\`\`
YYYY-MM-DD HH:MM · <project> · vX.Y.Z · <commit-SHA> · <one-line summary>
\`\`\`

(Starts empty. Projects append in dependency order during EXECUTE.)
```

---

## acknowledgments/\<project\>.md template

```markdown
---
unified-passage: UP-NNN
project: <project-name>
status: acked | pushback | acked-with-conditions
date: YYYY-MM-DD
---

# UP-NNN Acknowledgment — <project-name>

<One paragraph: ACK, pushback, or ACK-with-conditions. If pushback, specify proposed 
changes. If ACK-with-conditions, list the conditions.>
```

---

## pre-flight/\<project\>.md template

```markdown
---
unified-passage: UP-NNN
project: <project-name>
status: pass | fail | warn | executed
date: YYYY-MM-DD
---

# UP-NNN Pre-Flight — <project-name>

## Checks
- [x] Working tree clean
- [x] <project-specific check>
- [ ] <project-specific check> — FAIL: <reason>

## Result
<PASS | FAIL | WARN with explanation>

## Notes
<Anything the project Claude wants Lattica to know before EXECUTE>
```

---

## POST_FLIGHT.md template

```markdown
---
unified-passage: UP-NNN
status: complete | degraded | rolled-back
date: YYYY-MM-DD
---

# UP-NNN — Post-Flight Verification

## Critical invariants
- [x] <Invariant 1> — verified by <how>
- [ ] <Invariant 2> — FAILED: <reason>

## Optional invariants
- [x] <Invariant 1>
- [ ] <Invariant 2> — failed; logged as DV-NNN

## Cross-project integration smoke tests
- <Test name>: PASS / FAIL

## Final state
- <project>: <version>, <SHA>
- <project>: <version>, <SHA>
- ...

## Result
<COMPLETE | DEGRADED-BUT-COMPLETE | ROLLED-BACK with explanation>
```

---

*Template version 1. Update when methodology evolves.*
