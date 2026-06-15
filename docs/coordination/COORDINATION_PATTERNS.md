---
title: Coordination Patterns — Cross-Claude Methodology
status: live
version: v0.3.2y
last_reviewed: v0.3.2y
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

## P-011 — Grounding pass before substantive coding pass

Before any substantive coding pass, run a grounding pass first. It's lightweight (5-10 
minutes of reading, no writes) but it prevents working against stale assumptions.

**Grounding pass checklist:**

1. **Check mail** — your `requirements/<project>/` directory for new messages 
   addressed to you; `coordination/outbound/` (if non-Lattica) or `coordination/inbound/` 
   (if Lattica) for direct relays
2. **Check cross-pollination** — browse 
   `coordination/cross-pollination/<other-projects>/` for new pass-X.Y.md files since 
   your last grounding pass; identify anything affecting your scope
3. **Check current states** — read 
   `coordination/current-states/<other-projects>/current_state.md` for any project your 
   upcoming work depends on
4. **Check unified-passage** — `coordination/unified-passage/` for UP-NNN directories 
   with PLAN*.md drafts needing your input or ACK
5. **Update your own current_state.md** if relevant

The grounding pass produces no commits. It's pure preparation. After grounding, you 
either proceed with your planned coding pass (now informed by current platform state) 
or surface that the work needs to wait or change scope.

**Why this works:** stale assumptions about platform state are the most common source 
of cross-project bugs. 5-10 minutes of grounding prevents 1-2 hours of correction work 
later. The discipline pays for itself within the first week.

**Lattica Claude application:** Lattica Claude does grounding pass at the start of 
every session by reading the current STATUS.md and mail_routing.md plus relevant 
recent inbound/cross-pollination. Project Claudes follow the same pattern in their 
own sessions.

---

## P-012 — End-of-pass-report "For <project>:" sections

Every Claude Code pass report (the message the developer sees after a pass completes)
ends with a "For <project>:" section per affected project. Each section is a short
copy-paste snippet the developer can forward verbatim to the named project's Claude
session.

**Format:**

```
For cerebra: <one-paragraph snippet describing what's waiting for them and where>

For fossic: <one-paragraph snippet>

For lumaweave: <one-paragraph snippet>
```

Each snippet:
- Names a specific file or directory the project Claude should read
- States what action (if any) the project Claude should take
- Is self-contained — the project Claude doesn't need any other context to know what
  to do

**When to include a "For <project>:" section:**

- A coordination file was filed addressed to that project (inbound for them, outbound
  from Lattica to them)
- A cross-pollination file mirrors into that project's index requiring their review
- A unified passage moved phase (DRAFT, REVIEW, ARM, etc.) and that project is a
  participant
- A platform decision was locked that affects how that project does work going forward
- A change in another project's state affects that project's dependencies

**When NOT to include a "For <project>:" section:**

- The pass was purely internal to Lattica (e.g., updating Lattica's own
  blast-radius), no cross-project impact
- The change is informational only — already covered by the standard mail_routing
  manifest, no need for a separate snippet
- The project's involvement is "wait and see" rather than "take action" — surface
  via current-state, not a per-project snippet

**Why this works:** The developer is the courier between Claude sessions. Every
courier task that's manual is a chance for things to drop. Per-project snippets that
are copy-paste-ready reduce courier overhead to the minimum: read the report, see who
has mail, forward the snippet to that Claude session.

**This pattern also applies to project Claudes' own end-of-pass reports.** When a
project Claude (Cerebra, Fossic, etc.) completes a pass that affects others, their
end-of-pass report should include "For <other-project>:" sections too. Symmetric
discipline across all project Claudes.

**Update (v0.2.1v):** P-012 now uses the structured manifest format documented
in `docs/coordination/COORDINATION_PROTOCOL.md` ("End-of-pass manifest snippets
— reduce courier load") and `docs/aseptic/PASS_REPORTING.md`. The narrative
"For <project>: <prose>" format is superseded by:

```
For <recipient-project>:
- File: <absolute-path-to-file>
- From: <source-project>
- Action: <one-line ask>
```

The structured form is grep-able, copy-paste-ready, and reduces developer
courier load. Symmetric across all project Claudes.

---

## P-013 — Guest author in host repo

When a project needs to contribute UI code (React component, CSS, etc.) but
lacks a frontend codebase to ship it from, the contributing project (guest)
authors the file; the host project commits it to their tree. The guest owns
content; the host owns build integration.

**When to use:**

- A project contributes UI code (renderer, tile, component) to another project's repo
- The contributing project lacks compatible build infrastructure (e.g., a Python-only
  project contributes to a TypeScript-based host)
- The host project has the build/lint/type-check infrastructure that the contribution
  needs

**Host and guest are positional roles, not project identities.** Any project can be
a host (any project with the build infrastructure another project lacks). Any project
can be a guest (any project authoring content for another project's tree). The same
project can be host for one contribution and guest for another:

- **Cerebra is guest, Lattica is host** for SignalEvaluatedRenderer (validated UP-001)
- **Policy Scout will be guest, LumaWeave is host** when Policy Scout contributes a
  renderer to LumaWeave's payloadRendererRegistry
- **Future: ai-stack as guest, Lattica as host** when ai-stack contributes a
  ResponseGeneratedRenderer to Lattica's cerebra signal feed

The pattern generalizes across the platform.

**Ownership boundaries:**

- **Guest authority:** component logic (what it renders), payload
  interpretation, visual structure within host's design system, structural
  marker shape (for testability)
- **Host authority:** file location, registration call against any host
  registry, build system inclusion, type-check + lint integration
- **Shared discipline:** ADR-defined contracts (e.g., ADR-017 PayloadRendererProps),
  host's design token namespace, agreed structural marker conventions

**Logistics:**

1. Guest drafts the file content (via chat for developer to relay, or directly
   via filesystem access to the host's repo if available)
2. Host Claude Code commits the file to the host's tree with the standard
   registration boilerplate added
3. Updates follow the same pattern; the guest authors, the host commits
4. Git author is the host's identity (the committing Claude Code session);
   commit message body credits the guest as content author

**Empirical validation:**

UP-001 (closed 2026-06-14) exercised this pattern end-to-end. Cerebra
(Python-only, no TS codebase) authored `SignalEvaluatedRenderer.tsx` +
`.css`. Lattica Claude Code committed the files to `src/renderers/cerebra/`.
The renderer compiled cleanly under Lattica's `tsconfig.json` (Cerebra Claude
verified against `jsx: react-jsx`, `strict`, `noUnusedLocals`, etc. before
handoff). End-to-end smoke test showed real `SignalEvaluated` events rendering
via the guest-authored component without integration friction.

The pattern generalizes — host/guest pairings are emergent from build-infrastructure
asymmetries, not from specific project identities. Future UP candidates that exercise
this pattern between different host/guest pairings further validate the generalization.

**Generalization:**

Future renderer or tile contributions from Policy Scout, Bo, and ai-stack
follow this pattern. Each project's contributions land in `src/renderers/<project>/`
(payload renderers) or `src/tiles/<project>/` (tiles) in Lattica's tree.

See also: `docs/aseptic/UNIFIED_PASSAGE.md` for the methodology that surfaced
this pattern during REVIEW phase; ADR-017 for the PayloadRendererProps
contract; `docs/aseptic/retrospectives/UP-001-retrospective.md` for the full
context of pattern emergence.

---

## P-014 — Don't hardcode dynamic values

**The anti-pattern:** displaying values that should be computed at runtime as
literal strings in source code. Common offenders: version strings, item counts
(stream count, tile count, renderer count), timestamps, status indicators,
configuration paths.

**Why it bites:**

- The displayed value diverges from reality as soon as the underlying state
  changes
- Future agents (Claude or human) editing the surrounding code don't know the
  value is hardcoded vs. live
- The divergence often goes unnoticed for multiple passes until someone
  eyeballs the UI

**Concrete example (UP-001 smoke test):**

Lattica's v0.2.0 main shell showed:
- `"Lattica v0.2.0"` in the header (hardcoded; survived v0.3.0, v0.3.1, v0.3.2)
- `"Tauri + Vite + React + fossic scaffold"` as subtitle (hardcoded; no longer
  the full scope)
- The FOSSIC STORE panel's `"online · N stream(s)"` is the correct counter-example:
  queried fossic for actual stream count and rendered the result live

The two hardcoded strings were fixed in v0.3.2z. The FOSSIC STORE counter-example
shows the right pattern: query the source of truth, render the result.

**The discipline:**

For any value displayed in the UI that *could* change:

1. **Identify the source of truth.** Is it `package.json`? A registry? A
   subscribed event stream? A computed property?
2. **Read from source.** Use the appropriate hook, query, or function — not a
   literal string.
3. **If the value really is static** (e.g., a hardcoded version because it's
   for display only and doesn't track package.json), make the staticness
   explicit and reviewable — a comment indicating why this isn't dynamic.

**Audit pattern (worth running periodically):**

When in doubt, eyeball the UI and ask:
- Does anything displayed change at runtime?
- Does each "changing value" actually update when its source changes?
- Are there any version strings, counts, or status indicators that look
  suspicious?

If multiple display values match patterns from your training data ("Lattica v0.2.0"
literally appears as text in the source), they're almost certainly hardcoded.

**The audit identifies two failure modes, not one:**

1. **Static-should-be-live:** values displayed as literals that should derive from a
   source of truth (e.g., header version, counts, paths). Fix: wire to source.
2. **Live-should-be-static-with-rationale:** values that ARE genuinely static (e.g.,
   no source of truth exists, or staticness is intentional for the use case) but
   appear as bare literals without explanation. Fix: leave the literal, but add
   a comment explaining WHY it's static.

**Empirical example (v0.3.2y refinement):**

LumaWeave's P-014 audit (post-UP-001 check-in) found `<em>Contract registry v0.1.0</em>`
in QaPanel.tsx. The contract registry has no `REGISTRY_VERSION` export — there IS no
source of truth to derive from. The right fix isn't to wire it up (no wire to make);
it's to make the staticness explicit:

```typescript
<em>
  Contract registry v0.1.0{/* static — no REGISTRY_VERSION export exists yet */}
  • Source: src/control-plane/contracts/controlSurfaceContract.registry.ts
</em>
```

This satisfies P-014's intent without adding infrastructure complexity. Future readers
see immediately that the version is intentionally static and know why.

**When to leave a value static:**

- No source of truth exists in the codebase
- Adding a source of truth would be over-engineering for the value's actual mutability
  (e.g., a label that genuinely doesn't change)
- The value is locked by external contract (e.g., a vendored API version)

In each case, the discipline is the comment, not the wiring.

See also: ADR-014 (canary stream startup), `src/control-plane/tile-section/tileSectionRegistry.ts`
(`list()` returns current state).

---

*New patterns get appended as they're discovered. Patterns are observations, not
rules — when a pattern stops working, it gets a deprecation note with
explanation, not a deletion.*
