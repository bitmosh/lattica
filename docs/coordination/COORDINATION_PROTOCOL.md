# Cross-Claude Coordination — Quick Reference

This is the platform-wide coordination protocol for all project Claudes working on the
Lattica platform. Read once at the start of every grounding pass. Replaces ad-hoc relay
arrangements.

---

## Where to look for messages

**Project Claudes (everyone except Lattica Claude):**

- **Round-based discussion**: `~/Projects/lattica/docs/requirements/<your-project>/` — 
  multi-round design discussion, requirements deposits, responses 
  (`requirements.md`, `capabilities.md`, `current_state.md`, 
  `lattica_round1.md`, `<your-project>_round2.md`, etc.). Check this directory for 
  messages addressed to you; file responses in the same directory.

- **Direct relays**: `~/Projects/lattica/docs/coordination/outbound/` — direct relay 
  messages from Lattica Claude to you. Filenames follow 
  `YYYY-MM-DD_lattica_to_<your-project>_<topic>.md`. Reply by writing to 
  `~/Projects/lattica/docs/coordination/inbound/` with 
  `YYYY-MM-DD_<your-project>_to_lattica_<topic>.md`.

**Lattica Claude (only):**

- Check `~/Projects/lattica/docs/coordination/inbound/` for incoming messages.
- Write responses to `~/Projects/lattica/docs/coordination/outbound/`.

---

## Cross-pollination — mirror your file into Lattica's central index

When an Aseptic pass in your project generates a cross-pollination file:

- Your own file stays at `<your-project>/docs/aseptic/cross-pollination/pass-X.Y.md` 
  (authoritative — preserve Aseptic discipline)
- **Also copy** to `~/Projects/lattica/docs/coordination/cross-pollination/<your-project>/pass-X.Y.md`
  (platform-wide navigation index)

**Filename convention:** identical to your own file. Straight copy, no transformation.

**Why both:** Your repo's copy is the authoritative version for your project's audit 
trail. The Lattica mirror is the platform-wide index — any Claude can browse 
`lattica/docs/coordination/cross-pollination/` to see what's happened recently across 
all projects.

**Pre-created subdirectories** (under 
`~/Projects/lattica/docs/coordination/cross-pollination/`): `cerebra/`, `fossic/`, 
`lumaweave/`, `policy-scout/`, `bo/`, `ai-stack/`.

---

## Mail routing manifest

Every coordination file you file gets a one-line entry in 
`~/Projects/lattica/docs/coordination/mail_routing.md`. This is the chronological index 
of all coordination motion across the platform.

**Format:**
```
YYYY-MM-DD · [source → target] · channel · filename.md
```

Append at the bottom; never edit historical entries. Add the entry immediately after 
filing the file — don't batch.

**Don't add manifest entries for:** living report updates, blast-radius files, 
pass-complete files, ADR creations, internal project files (only the Lattica-side 
mirror of a cross-pollination gets an entry — not your project's authoritative 
original).

---

## End-of-pass manifest snippets — reduce courier load

When any Claude completes a pass (or any response) that writes coordination files
or needs another Claude to chime in, the response ends with a structured manifest
snippet per recipient. The developer copy-pastes these snippets verbatim to the
recipient Claude's session.

**Why this discipline exists:**

The developer is the courier between Claude sessions. Couriering content (full
relay text, file contents) is expensive — high context-switch load, error-prone,
scales badly with project count. Couriering manifest snippets is cheap — short,
grep-able, copy-paste-ready, and exercises the grounding-pass discipline.

The recipient Claude reads the manifest, runs their grounding pass to find the
referenced files in `~/Projects/lattica/docs/coordination/`, and acts on them.

**Format:**

```
For <recipient-project>:
- File: <absolute-path-to-file>
- From: <source-project> (or "Lattica" for coordination-hub messages)
- Action: <one-line ask — what they need to do>
```

One block per recipient project. Multiple files per recipient combine into one
block:

```
For cerebra:
- File: ~/Projects/lattica/docs/coordination/outbound/2026-06-14_lattica_to_cerebra_up-001-arm-trigger.md
- File: ~/Projects/lattica/docs/coordination/cross-pollination/lattica/pass-0.3.0.md
- From: Lattica
- Action: Run UP-001 pre-flight per ASSIGNMENTS.md Cerebra section; file at UP-001/pre-flight/cerebra.md
```

**When to include a manifest snippet:**

- Any coordination file was filed addressed to that project (inbound for them,
  outbound from this Claude to them)
- A cross-pollination file mirrors into their index requiring their review
- A unified-passage phase moved and they participate
- A platform decision was locked affecting their work
- Their state-change is awaited (e.g., "waiting for Cerebra ACK")

**When NOT to include a manifest snippet:**

- The pass was purely internal (no cross-project impact)
- The change is informational only — already covered by mail_routing.md
- The project's role is wait-and-see, not take-action

**Symmetric discipline:** every project Claude follows this, not just Lattica.
Cerebra's pass reports include "For lattica:" / "For fossic:" snippets when
their work affects those projects. Fossic does the same. Etc.

**Hybrid forwarding:**

- **Notification-only (default):** developer pastes the manifest snippet into the
  recipient Claude's session. Recipient grounding-passes to find the referenced
  files. Lower friction; exercises the discipline.
- **Copy-paste fallback:** if the relay is urgent, load-bearing, or the recipient
  has shown inconsistency at grounding-pass discipline, paste the full file
  contents alongside the manifest. Belt-and-suspenders.

The discipline takes load OFF the developer (less to courier) and ONTO the
filesystem-based coordination hub (which was designed to take this load).

**Example — Lattica completing a pass that touches Cerebra and Fossic:**

```
── PASS COMPLETE · v0.X.Y · 2026-06-14 ──
[normal pass complete content]

────────────────────────────────────────
For cerebra:
- File: ~/Projects/lattica/docs/coordination/outbound/2026-06-14_lattica_to_cerebra_<topic>.md
- From: Lattica
- Action: <one-line ask>

For fossic:
- File: ~/Projects/lattica/docs/coordination/outbound/2026-06-14_lattica_to_fossic_<topic>.md
- From: Lattica
- Action: <one-line ask>
```

This pattern subsumes the previous "For <project>:" section convention (P-012
in COORDINATION_PATTERNS.md). The structured manifest replaces narrative
description — narrative is fine for context but the manifest is what the
developer actually forwards.

---

## Current state — your project's living dashboard

Each project maintains `~/Projects/lattica/docs/coordination/current-states/<your-project>/current_state.md`. 
This is the at-a-glance view of where your project is RIGHT NOW that other Claudes can 
read during their grounding passes.

Update your `current_state.md` whenever:
- Your project ships a version (note the version and what's in it)
- A blocker is resolved or a new one surfaces
- A dependency on another project's work becomes relevant
- You're about to ship something that affects cross-project state

Keep it short — one screen, scannable. Other Claudes read this during grounding to 
understand whether their work depends on or affects yours.

---

## Grounding pass — run before any coding pass

Before any substantive work pass, run a grounding pass first. It's lightweight (5-10 
minutes of reading, no writes) but it prevents working against stale assumptions.

**Grounding pass checklist:**

1. **Check mail** — your `requirements/<project>/` directory for new messages addressed 
   to you; `coordination/outbound/` (if you're a non-Lattica project) or 
   `coordination/inbound/` (if you're Lattica) for direct relays
2. **Check cross-pollination** — browse 
   `coordination/cross-pollination/<other-projects>/` for any new pass-X.Y.md files 
   since your last grounding pass; identify anything affecting your scope
3. **Check current states** — read 
   `coordination/current-states/<other-projects>/current_state.md` for any project your 
   upcoming work depends on; verify your assumptions match their actual state
4. **Check unified-passage** — read `coordination/unified-passage/` for any UP-NNN 
   directories with PLAN*.md drafts that need your input or ACK
5. **Update your own current_state.md** if relevant

The grounding pass produces no commits. It's pure preparation. After grounding, you 
either proceed with your planned coding pass (now informed by current platform state) 
or surface that the work needs to wait or change scope.

---

## Relay prefix convention

Cross-Claude messages start with the source → target prefix in the message body:

- `[Cerebra → Lattica]`
- `[Fossic → Policy Scout]`
- `[Lattica → LumaWeave]`

Makes transcripts grep-friendly and unambiguous when reading historical relay threads.

---

## YAML front matter on coordination files

Every file in `inbound/`, `outbound/`, and the cross-pollination mirrors needs YAML 
front matter:

```yaml
---
source: <project>-claude
target: <project>-claude
date: YYYY-MM-DD
topic: <short-topic-slug>
status: outbound | inbound | inbound-acknowledged | closed | superseded
related: <path-to-related-file-if-any>
severity: NEEDS-AWARENESS | BLOCKING | INFORMATIONAL  # cross-pollination only
---
```

**Exception:** living docs (`requirements.md`, `capabilities.md`, `current_state.md`) 
do not need front matter. These are append-update files, not coordination event files.

If you find a coordination event file without front matter, flag it — don't silently 
fix.

---

## PLAN*.md vs ADR*.md — naming convention for evolving decisions

While a platform decision is still being discussed and refined, the file is named 
`PLAN-NNN-<topic>.md` (matching the eventual ADR number).

When the decision solidifies and locks, rename to `ADR-NNN-<topic>.md` and update the 
Status field from `Draft` to `Accepted`.

This makes the distinction between "still being refined" and "locked decision" visible 
in directory listings without opening files.

---

## When a thread closes

A relay thread closes when the originating issue is resolved AND no further response is 
expected. Mark closed threads by setting `status: closed` in the file's front matter. 
Move closed threads to `~/Projects/lattica/docs/coordination/archive/` when convenient.

**Acknowledgment-of-acknowledgment is the loop terminator.** If you receive a message 
that's a close-close (e.g., "I confirm receipt of your acknowledgment, no further 
action"), don't respond. Mark closed and move on.

---

## When to ask the developer vs. use Claude Code

Almost never ask the developer. Use Claude Code (or your own filesystem access if you 
have it) to verify state before asking.

- **Don't ask** "where is X?" — search for X. The codebase is the source of truth.
- **Don't ask** "what did I send last week?" — read your own outbound history.
- **Don't ask** "has someone replied to Y?" — read your own inbound.
- **Do ask** when a decision genuinely requires the developer's judgment (taste, 
  priority, scope) — and ask once, decisively, not as a list of small things.

The developer is coordinating multiple projects in parallel. Their bandwidth is the 
scarcest resource. Save it for decisions, not lookups.

---

## Unified passage — when synchronized cross-project execution is needed

Most platform work is per-project + cross-pollination. Some work genuinely requires 
synchronized cross-project execution (schema migrations, platform-wide releases, 
multi-project integrations).

For those, see `~/Projects/lattica/docs/aseptic/UNIFIED_PASSAGE.md` for the methodology 
and `~/Projects/lattica/docs/coordination/unified-passage/` for active passages.

Unified passages are expensive (DRAFT → REVIEW → ARM → EXECUTE → POST_FLIGHT across N 
project Claudes). Use them when the deliverable genuinely requires synchronization, 
not as the default.

---

*Maintained at `~/Projects/lattica/docs/coordination/COORDINATION_PROTOCOL.md`. Update 
when the protocol changes. Per-project copies in each `requirements/<project>/` 
directory are mirrors for discoverability.*
