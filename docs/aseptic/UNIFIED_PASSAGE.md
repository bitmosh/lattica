---
title: Unified Passage — Synchronized Cross-Project Execution
status: live
version: v0.2.1.c
last_reviewed: v0.2.1.c
---

# Unified Passage

A **unified passage** is one synchronized motion executed across multiple projects in 
the Lattica platform. Where normal Aseptic discipline scopes one agent to one project's 
pass, a unified passage scopes a coordinated wave: N projects each execute their slice 
of a shared deliverable, with explicit pre-flight readiness, dependency-ordered 
execution, and unified post-flight verification.

Unified passages are **expensive**. They consume DRAFT + REVIEW + ARM + EXECUTE + 
POST_FLIGHT cycles across multiple Claude sessions. Use them only when the deliverable 
genuinely requires synchronization — cross-project schema changes, platform-wide 
migrations, multi-project integrations, coordinated releases.

For everything else, per-project Aseptic + cross-pollination + the standard relay 
machinery is enough. Don't make unified passages the default; the methodology has 
overhead that doesn't pay for itself on routine work.

---

## When to run a unified passage

Use a unified passage when **all** of these are true:

1. The deliverable's success criterion is platform-wide, not per-project ("the user 
   launches Lattica and sees a Cerebra event flow end-to-end" — not "Cerebra ships 
   v0.5.0")
2. Partial completion produces a worse state than no completion ("if Fossic ships the 
   schema change but Cerebra doesn't update its emit code, we have broken events")
3. The work spans 2+ projects with explicit dependencies between them
4. Sequential execution with cross-pollination notifications isn't sufficient (would 
   take too long, or the dependencies are too tight)

If any of these is false, use normal per-project passes with cross-pollination 
instead.

---

## Versioning

Unified passages have their own namespace, parallel to per-project versions:

- `UP-001` — first unified passage
- `UP-002`
- `UP-003`

Each project's contribution within a unified passage still gets its own per-project 
version (`cerebra/v0.5.0`, `lattica/v0.3.0`, etc.) per existing Aseptic discipline. The 
project's blast-radius file references both the project version AND the unified 
passage ID.

A unified passage's directory is at 
`~/Projects/lattica/docs/coordination/unified-passage/UP-NNN/` and contains six files 
(see UP-NNN-TEMPLATE.md for the skeleton):

- `OVERVIEW.md` — what this passage accomplishes, why it has to be unified
- `ASSIGNMENTS.md` — per-project scope with explicit invariants
- `PRE_FLIGHT.md` — readiness checks each project completes before arming
- `EXECUTION_LOG.md` — chronological record of commits as they land
- `POST_FLIGHT.md` — verification across all projects after execution
- `ROLLBACK.md` — drafted **before execution**, not improvised after failure

---

## The four-phase pattern

Every unified passage follows this sequence.

### Phase 1 — DRAFT (Lattica Claude owns)

Lattica Claude drafts `OVERVIEW.md` and `ASSIGNMENTS.md`. Per-project assignment 
specifies:

- What work the project does (scoped, concrete)
- Invariants that must hold at end of execution
- Dependencies on other projects' work landing first (in execution order)
- Failure modes that need to be handled in `ROLLBACK.md`
- Provides — what this project's slice unblocks for others
- Unblocks — which other projects depend on this slice completing

Lattica Claude also drafts `ROLLBACK.md` at this phase. Pre-drafted rollback is 
load-bearing — if execution fails, no agent should be improvising rollback steps under 
pressure.

### Phase 2 — REVIEW (all project Claudes)

Each project Claude reads their assignment. Two possible outcomes:

- **ACK** — file `unified-passage/UP-NNN/acknowledgments/<project>.md` with `status: 
  acked` and a one-line confirmation
- **Pushback** — file the same file with `status: pushback` and proposed changes; 
  Lattica iterates ASSIGNMENTS.md until all projects ACK

REVIEW phase ends when all participating projects have ACKed. No project is allowed to 
start ARM until REVIEW closes.

### Phase 3 — ARM (all project Claudes prepare)

Each project Claude executes pre-flight checks:

- Working tree clean (or known intentional state)
- Dependencies met (versions, schemas, expected files in place)
- Scope-specific verification (project-defined — typechecks pass, fossic store contains 
  expected events, etc.)

Pre-flight result is filed in `unified-passage/UP-NNN/pre-flight/<project>.md` with 
`status: pass | fail | warn`. If FAIL: the project surfaces the blocker; Lattica 
decides whether to abort the passage, re-scope, or wait for resolution. If WARN: 
project explains and waits for ACK before continuing. If PASS: project is armed and 
awaits EXECUTE signal.

ARM phase ends when all participating projects show `status: pass`.

### Phase 4 — EXECUTE (dependency-ordered)

With all projects armed, execution proceeds in dependency order. The order is 
determined by topological sort of `depends-on-execution` declarations in 
`ASSIGNMENTS.md`. Lattica Claude publishes the execution sequence as part of OVERVIEW.

Each project Claude executes their assigned work as a single Aseptic pass:

1. Run the pass per normal Aseptic discipline
2. Append a one-line entry to `unified-passage/UP-NNN/EXECUTION_LOG.md` with the SHA 
   and timestamp
3. Signal completion by setting their `pre-flight/<project>.md` to `status: 
   executed`
4. Next project in dependency order reads EXECUTION_LOG, confirms upstream dependency 
   landed, executes

If any project's execution fails partway, the next project doesn't start. ROLLBACK 
kicks in (see below).

### Phase 5 — POST_FLIGHT (Lattica Claude + project Claudes)

After all projects' EXECUTE phases complete, POST_FLIGHT verification runs:

- Lattica Claude verifies the passage's stated invariants are met
- Each project Claude confirms their own slice landed as expected
- Cross-project integration smoke tests (where feasible)

POST_FLIGHT result is filed in `unified-passage/UP-NNN/POST_FLIGHT.md`. If invariants 
hold: passage closes successfully. If invariants fail: ROLLBACK kicks in even though 
individual commits succeeded — the platform-wide state is wrong.

---

## ROLLBACK

Drafted in Phase 1, executed only if needed.

`ROLLBACK.md` specifies, for each project's commit:

- Whether the commit can be safely reverted (`git revert`) or requires forward-fix
- The order of rollback (reverse of execution order — undo dependencies last)
- What state each project should be in after rollback (typically: same as pre-passage 
  state, but explicitly verified)
- Communication: rollback triggers cross-pollination notifications to all affected 
  projects so they know the platform state has changed

ROLLBACK is the most risky moment of a unified passage. The discipline of pre-drafting 
removes "improvising under pressure" from the failure mode.

---

## Concurrency and the user

The "in unison" framing is aspirational. In practice, each project's Claude Code 
session runs independently; the only synchronization mechanism is the filesystem (files 
in `unified-passage/UP-NNN/`).

The developer is **not** the coordinator during a unified passage. The developer 
authorizes ARM → EXECUTE transition (after seeing all projects PASS in pre-flight) but 
doesn't relay individual messages between Claudes. Each Claude reads the unified 
passage directory at the start of every grounding pass; coordination flows through 
files.

If a Claude session ends mid-passage, the next session picks up from EXECUTION_LOG. 
Resumability is a design requirement.

---

## Sequential / conditional passes — the lighter alternative

Not every cross-project deliverable needs a full unified passage. A common middle 
ground: **sequential / conditional passes** where projects coordinate via 
cross-pollination but execute sequentially:

- Project A runs a pass, files cross-pollination notifying Project B
- Project B's grounding pass picks up the cross-pollination, decides whether to run a 
  conditional pass that depends on A's state
- If B needs A's work before B can move, B waits for A's pass to land; otherwise B 
  proceeds independently

Sequential/conditional is the **default** for most cross-project work. Unified passage 
is the exception when synchronization is genuinely required. The cost ratio is roughly 
10x — a unified passage is 10x the coordination overhead of a sequential coordination, 
so it should deliver 10x the value (or be the only viable approach).

---

## What to track outside the passage directory

A unified passage produces lots of artifacts inside its own directory. Outside that 
directory:

- Each project's blast-radius file (their normal Aseptic pass record) references the 
  UP-NNN ID in its front matter
- `mail_routing.md` gets entries for each project's execution commit (channel: 
  `unified-passage`)
- Each project's PASS COMPLETE message mentions UP-NNN in the highlights

Outside the passage directory, normal Aseptic discipline applies. Inside the directory, 
the unified-passage methodology supersedes for the duration of the passage.

---

## When to call a unified passage failed (vs. degraded-but-complete)

Sometimes a unified passage's POST_FLIGHT finds that the stated invariants are 
partially met. Decision tree:

- **Critical invariant failed** → ROLLBACK
- **Optional invariant failed, critical met** → passage closes successfully with the 
  optional invariant logged as DEVIATION (DV-NNN) for follow-up
- **Critical invariant met but unexpected platform-wide regression discovered** → 
  ROLLBACK or surgical fix, depending on regression severity

The OVERVIEW.md defines which invariants are critical vs. optional at DRAFT time, so 
the decision criteria aren't improvised mid-failure.

---

*This methodology is platform-shared. Copies in cerebra, lumaweave, policy-scout, 
fossic `docs/aseptic/` directories are mirrors of this canonical. Updates land here 
first; mirrors propagate during the next platform-wide coordination cycle.*
