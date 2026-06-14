---
title: Coordination Patterns — Cross-Claude Methodology
status: live
version: v0.0.0y
last_reviewed: v0.0.0y
---

# Coordination Patterns

Durable methodology patterns for cross-Claude work on the Lattica platform.
These are observations from coordination experience (initially fossic's build,
which used Aseptic discipline across multiple parallel agents), banked here as
patterns to reuse and extend.

Each pattern is one observation. New patterns get added as they're discovered.
Old patterns are not deleted — if a pattern stops working, it gets a "Status:
deprecated" note with explanation, but the entry stays.

---

## P-001 — Categorization-before-action

When facing a list of items that need triage, produce a categorization report
before any work. The categorization itself surfaces issues.

**Fossic example:** Pass 8.6 ran 27 test failures through a six-bucket
categorization (TEST_BUG / REAL_BUG / DESIGN_GAP / severity / etc.) before
touching any code. This caught real bugs that fix-first prompts would have
papered over.

**Lattica application:** When projects deposit requirements, produce a
categorization (convergent / conflicting / synergistic / underspecified) before
drafting resolutions. Round 1 followed this pattern; resulting briefing was
substantially more useful than a per-project response would have been.

---

## P-002 — Honest self-correction builds cross-Claude trust

Predictions that hold up across cross-Claude work are themselves trust-building
artifacts. Equally, walkbacks when evidence contradicts predictions are
trust-building.

**Fossic example:** Fossic Claude predicted sub-1ms benchmark performance and
then walked it back when measured reality showed 4.7ms due to PyO3 bridge cost.
Cerebra Claude explicitly noted the walkback as a positive coordination signal.

**Lattica application:** Be willing to revise positions when evidence comes in.
Don't anchor on initial assessments to preserve consistency. The user catches
weak arguments; surface the actual reasoning rather than rationalize.

---

## P-003 — Pre-drafted notification text reduces relay friction

When locking decisions that affect specific projects, include the pre-drafted
notification text in the decision document or relay artifact. The user relays
it; the affected project's Claude responds.

**Pattern:** Don't make the user synthesize the notification — write it in the
voice that will be relayed, ready to copy-paste.

---

## P-004 — Cross-Claude relay prefix convention

Use `[Source → Target]` prefixes on every cross-Claude message:
- `[Fossic → Cerebra]` for fossic-side outbound
- `[Cerebra → Lattica]` for Cerebra-side outbound
- `[Lattica → <project>]` for Lattica-side outbound

Parser-friendly for the user, unambiguous when reading transcripts later.

---

## P-005 — Self-referential bootstrap as coherence test

When producing coordination patterns (group rounds, decision documents, etc.),
apply them to yourself first. If the coordinator can't follow its own
coordination protocol, the protocol is wrong.

**Fossic example:** When fossic bootstrapped the Aseptic methodology on itself,
the bootstrap pass produced its own blast-radius file documenting its own
scope. The outputs fitting the formats they documented was the first signal
that the methodology was self-consistent.

**Lattica application:** The bootstrap pass `v0.0.0` filed its own
`blast-radius/pass-00.md` per Aseptic discipline. Same self-referential check.

---

## P-006 — Late-stage spec reviews catch drift

When integration passes produce artifacts derived from prior decisions, the
verification should explicitly diff against the decision record, not just check
that content landed.

**Fossic example:** Post-tag review of `AGENT_TRACE_VOCABULARY.md` §8.2 found
four real discrepancies between the doc and the locked Cerebra coordination
decisions. The integration pass had verified content arrived but hadn't diffed
against the source-of-truth decisions.

**Lattica application:** When closing a round, the closing pass should diff its
outputs against the `decisions.md` records, not just check that files exist.

---

## P-007 — Format conventions drift silently when not load-bearing for code

Format isn't load-bearing for code work, so agents reconstruct it from fuzzy
memory if the canonical template isn't pasted directly into the prompt.

**Fossic example:** The PASS COMPLETE format and the version letter convention
both drifted across agent sessions when prompts didn't paste the canonical
structure verbatim.

**Lattica application:** Any structured artifact wanted consistent across
project Claudes (decision document format, requirements template, relay format)
— paste the canonical template directly into the briefing each Claude receives.
Don't expect reconstruction.

---

## P-008 — "Tests pass for me" doesn't always match consumer environments

The pass-level "all tests pass" signal may not catch cases where the agent's
environment has features enabled that a fresh consumer environment doesn't.

**Fossic example:** `cargo test --workspace` failed under default features
because feature-gated test files weren't properly gated. The agent's environment
had the features enabled; the user's fresh shell didn't.

**Lattica application:** When locking decisions about Lattica's runtime
behavior, define the canonical verification command and require that command to
be the verification signal, not "it worked in my session."

---

## P-009 — Methodology observations have to translate into behavior changes

Observations are cheap; behavior changes from observations are the actual asset.

**Fossic example:** Fossic Claude noted multiple times that "pass-completion
verification should match consumer invocations" but kept relying on
agent-environment success as the verification signal until the user hit the test
swamp at rc.1.

**Lattica application:** When spotting a coordination pattern that's working or
failing, update actual behavior. Don't just note it for later.

---

## P-010 — Assistant-supervisor split scales coordination

When one Claude instance can't oversee all of a multi-project platform, split by
substrate: one Claude owns one slice, another owns a different slice, peers
cross-gate at arc boundaries.

**Lattica application:** Lattica Claude owns shell architecture, frontend
hosting, tile composition, advocate coordination, locked-decision discipline.
Fossic Claude owns event sourcing — fossic-tauri/fossic-node integration,
cross-consumer event vocabulary, fossic-side polish affecting Lattica consumers.
Each cross-gates the other's work between arc closes. See `SUPERVISION_MODEL.md`
for full detail.

---

*New patterns get appended as they're discovered. Patterns are observations, not
rules — when a pattern stops working, it gets a deprecation note with
explanation, not a deletion.*
