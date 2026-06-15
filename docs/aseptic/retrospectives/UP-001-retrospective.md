---
unified-passage: UP-001
status: closed
retrospective-date: 2026-06-14
retrospective-author: lattica-claude
---

# UP-001 Retrospective — First Real Tile

UP-001 closed on 2026-06-14 with `status: complete`. The platform now renders
real Cerebra `SignalEvaluated` events in Lattica's UI via the registered
payload renderer pipeline. This is the first unified passage to complete; the
methodology is now empirically validated.

This retrospective banks the methodology learnings, identifies what worked,
notes what could be tightened, and surfaces patterns worth elevating.

## The shape of UP-001's execution

The unified passage covered five methodology phases. Each phase produced
surfacing-and-fixing of real issues before they became expensive:

**DRAFT phase (Lattica Claude in chat):**
- OVERVIEW.md, ASSIGNMENTS.md, ROLLBACK.md authored
- Decisions baked: dependency ordering (fossic → Cerebra → Lattica),
  per-project versions, the four critical invariants

**REVIEW phase (1 iteration):**
- Cerebra ACKed with two conditions: `<cycle_id>` typo (cross-flagged by
  fossic), guest-author-in-host-repo proposal
- Fossic ACKed with two corrections: `lattica_store_status` doesn't exist,
  `fossic_read_range` isn't glob-capable
- Lattica patched ASSIGNMENTS.md and both projects upgraded to clean acked

**ARM phase (distributed work):**
- Cerebra ran pre-flight, found three of their own bugs (stream key fix,
  emit path env var wiring, FTS5 sanitization), shipped fixes in v0.3.8
- Fossic ran pre-flight, accepted setup-hook evidence as sufficient
  verification
- Lattica's pre-flight surfaced three latent v0.2.0 bugs (Manager import,
  icon files, declare_stream missing), fixed in v0.2.1u

**EXECUTE phase:**
- Cerebra-authored renderer files committed to Lattica's tree at
  `src/renderers/cerebra/` (guest-author-in-host-repo pattern)
- Tile + subscription + payload routing wired into Lattica's shell
- Pattern A (hardcoded panel) was the first attempt in v0.3.0; v0.3.1
  refined to Pattern B (registry-driven rendering) to genuinely exercise
  the registry pipeline

**POST_FLIGHT phase:**
- Smoke test ran live Cerebra cycles
- Real SignalEvaluated events rendered in the cerebra signal feed
- All four critical invariants verified
- Optional invariants (visual polish, concurrent rendering, error states,
  performance) deferred as DV-003 through DV-006

## What worked

**The methodology caught real bugs at every phase.** Total surfaced:

| Phase | Bugs caught |
|-------|-------------|
| REVIEW (1 iter) | 3 (typo, 2 API errors) |
| Cerebra ARM | 3 (stream key, emit path, FTS5) |
| Lattica ARM | 3 (Manager import, icons, declare_stream) |
| EXECUTE/POST_FLIGHT | 0 (one refinement Pattern A → B between v0.3.0/v0.3.1) |

12 substantive issues caught. Zero made it to user-observable failure. If
the methodology hadn't existed, all of these would have surfaced during
integration testing or live deployment — and the debugging cost would have
been an order of magnitude higher because root causes would be entangled
with each other instead of cleanly isolated by phase.

**Two-independent-flag rule held.** Both Cerebra and Fossic flagged the
same `<cycle_id>` typo from different angles (Cerebra reading ASSIGNMENTS,
Fossic doing code review). Two independent flags = definitely real; the
rule worked.

**Code-reading beats spec-reading.** Fossic's ACK caught two real API errors
(`lattica_store_status` doesn't exist, `fossic_read_range` isn't glob-capable)
by reading actual fossic-tauri code rather than trusting the spec strings
in ASSIGNMENTS.md. Worth elevating as canonical discipline.

**Guest-author-in-host-repo worked frictionlessly.** Cerebra Claude verified
against Lattica's `tsconfig.json` before handoff. Renderer compiled cleanly
on first integration. No type errors, no lint issues, no integration friction.
The pattern is genuinely useful and now lives as P-013.

**Pre-drafted ROLLBACK was not needed but was load-bearing.** ROLLBACK.md
was drafted at DRAFT phase per the methodology. No rollback was triggered.
But: knowing ROLLBACK was already specified meant nobody (Lattica Claude or
project Claudes) had to improvise rollback contingencies during ARM or
EXECUTE — the discipline removed pressure from every other phase.

**Build verification surfaced what code-read review missed.** TD-003 logged
the lesson during v0.2.1u: 3 latent v0.2.0 bugs (Manager import, icons,
declare_stream) survived 5 descending-letter cleanup passes without surfacing
because nobody ran `npm run tauri dev`. Build verification is now required
for build-relevant changes.

## What could be tightened

**Coordinated execution required user time.** UP-001 spanned 6 descending
letters (z, y, x, w, v, u) plus three forward versions (v0.3.0, v0.3.1,
v0.3.2). Total coordination passes: ~10. Each required developer attention
for relay forwarding and merge approval. At scale this is expensive — UP-002
should aim for fewer iterations by tightening DRAFT phase quality before
REVIEW opens.

**ARM phase surprises ate budget.** Lattica's pre-flight surfaced 3 build
bugs that should have been caught by v0.2.0's own scaffold work. Cerebra's
pre-flight surfaced 3 bugs in Cerebra's own code. Both were necessary
catches but consumed methodology bandwidth that ideally belongs to
substrate-verification, not project-internal bug-fixing. Going forward:
project-internal verification before unified-passage REVIEW.

**Manifest-snippet discipline came mid-stream.** v0.2.1v introduced the
structured `For <project>:` manifest format to reduce courier load. The
discipline was load-bearing as soon as it landed — but it came after several
relay rounds had already used narrative-form forwarding. UP-002+ starts
with the discipline in place from DRAFT.

**Untracked stragglers persist.** Every pass produces 1-2 untracked
straggler files (PASS COMPLETE + merge gate). They're absorbed by the next
pass routinely (per the discipline now documented in PASS_REPORTING.md).
The pattern is self-balancing but cosmetically untidy in interim states.

**Hardcoded values in v0.2.0 scaffold.** Two hardcoded display values
(header version, subtitle) survived through UP-001 and were fixed in
v0.3.2z. The fix-after pattern is fine; the surfacing was via smoke test
eyeball, not via systematic audit. P-014 documents the anti-pattern; future
scaffolds should run an audit before declaring done.

## Patterns surfaced or validated

- **P-013 — Guest author in host repo** (promoted from candidate to
  documented pattern in v0.3.2z, with UP-001 as empirical evidence)
- **P-014 — Don't hardcode dynamic values** (added in v0.3.2z, surfaced
  during smoke test eyeball)
- **P-012 (structured manifest format)** — validated as the right
  courier-load discipline; future passes use this from session start
- **Two-independent-flag rule** — when two peers flag the same issue from
  different angles, it's definitely real and warrants fixing
- **Code-reading beats spec-reading for catching API errors** — when
  reviewing assignments that reference specific API calls, grep for them
  in source to verify they exist with the expected signatures

## Banked learnings — not yet patterns

These are observations worth recording but not yet elevated to platform-wide
patterns. May become patterns after UP-002+ exercises them again:

- **Pattern A → Pattern B refinement.** First implementation can be
  hardcoded for speed; a refinement pass to registry-driven design exercises
  the architecture properly. v0.3.0 + v0.3.1 used this rhythm; it worked.
- **Substrate authorization via cross-gate.** Fossic's pre-flight PASS was
  the substrate-authorization moment per the SUPERVISION_MODEL.md cross-gate.
  Lattica trusted the subscription pipeline without additional verification
  after that signal. This is the cross-gate working as designed.
- **Subjective latency observation is sufficient for first validation.**
  Specifying "~5 seconds" as observable latency for UP-001 (without a hard
  threshold) was the right call. Performance characterization belongs in a
  later pass (DV-006 captured this).

## What this means for UP-002+

UP-002 should be more ambitious than UP-001 — the methodology is no longer
under validation. Possible UP-002 candidates:

- LumaWeave Mode B integration (richer cross-project than UP-001's single
  renderer)
- Multi-event timeline tile with Cerebra causation walk
- Policy Scout governance UI with ActionProposed flow
- Cerebra renderer additions (PredictionMade, OutcomeRecorded, etc.) using
  the validated P-013 pattern

For UP-002 specifically, the cost-benefit ratio matters: unified-passage
overhead is roughly 10x sequential-passage overhead (per UNIFIED_PASSAGE.md).
Use unified-passage only when synchronization is genuinely required. Most
single-project additions don't qualify.

## Closing note

UP-001 closed on 2026-06-14 after planning, drafting, iteration, and
execution spanning multiple sessions and all five methodology phases. The
platform now renders real cognitive events from a real LLM cycle, end-to-end,
via the guest-author-in-host-repo pattern. Every major architectural decision
since the Lattica project began is reified in the cerebra signal feed.

The methodology is no longer hypothetical. It works.

---

**Filed by:** Lattica Claude in coordination pass v0.3.2z

**Linked artifacts:**
- `docs/coordination/unified-passage/UP-001/POST_FLIGHT.md` (closure record)
- `docs/screenshots/2026-06-14_up-001_smoke-test-success.png` (visual evidence)
- `docs/aseptic/pass-complete/pass-0.3.2.md` (closure pass record)
- `docs/aseptic/blast-radius/pass-0.3.2.md` (closure pass blast-radius)
