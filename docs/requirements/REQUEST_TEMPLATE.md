# Requirements Request Template

Use this format when filing a `requirements.md` for your project. Each requirement
is an independent entry. File as many as needed; group by priority tier.

Advocate Claudes: read `docs/LATTICA_NOW.md` and the relevant extract doc in
`docs/adjacent-project-info/` before filing. Do not request infrastructure that
LATTICA_NOW.md already flags as missing — capture those as dependencies, not
assumptions.

---

## File front-matter

```markdown
# <Project Name> — Lattica Requirements

**Project:** <project-name>
**Author:** <Project> Claude (acting as <project> advocate)
**Date:** YYYY-MM-DD
**Status:** Initial requirements deposit | Revised round N

<One-sentence framing of what this project needs from Lattica and why.>
```

---

## Per-requirement entry format

```markdown
---
id: R-<PROJECT-CODE>-NNN
category: <tile-design | registry-extension | event-subscription | ipc-contract |
           phase-dependency | infrastructure | naming-convention | other>
priority: <must-have | nice-to-have | future>
---

## R-<PROJECT-CODE>-NNN — <Short title>

**Category:** <same as above>
**Priority:** <must-have | nice-to-have | future>

**Specific need:**
One to three sentences. What Lattica must provide, expose, or guarantee.
Be concrete: name the API, registry field, event type, or tile slot.

**Why it matters:**
What breaks or degrades if this need is not met. Quantify if possible
(e.g., "without this, Cerebra cannot surface memory events in real time").

**Constraints:**
Any constraints on how the need is met:
- Latency requirements (e.g., "must be visible within 50ms of commit")
- Schema requirements (e.g., "payload must include session_id")
- Compatibility requirements (e.g., "must not require a fossic API not in v1")

**Adjacent project awareness:**
Does meeting this need affect any other project? Name them and describe the
dependency. If none, write "None."

**Outstanding questions:**
Questions that need Lattica Claude's answer before this requirement can be
refined. If none, write "None."
```

---

## Example entry

```markdown
---
id: R-F-001
category: tile-design
priority: must-have
---

## R-F-001 — Live event stream view with subscription

**Category:** tile-design
**Priority:** must-have

**Specific need:**
Lattica must provide a tile that subscribes to fossic stream patterns via
glob (`cerebra/agent-trace/*`, `rhyzome/repair/*`, etc.) and renders events
as they arrive, with event type, version, stream ID, and payload summary visible.

**Why it matters:**
Without this, Lattica cannot serve as an observability platform for the
portfolio. The live event view is the core value proposition of Lattica's
Phase 2–4 integration.

**Constraints:**
- Latency: visible within ~50ms of commit (PostCommit subscription mode)
- Must handle a mix of active streams across multiple projects simultaneously
- Payload summary must be legible without knowing the specific event type schema

**Adjacent project awareness:**
All other consumer projects (Cerebra, policy-scout, bo, rhyzome) have
similar needs — a shared subscription tile may satisfy multiple projects
if it supports glob patterns.

**Outstanding questions:**
Will the subscription tile use `fossic-node` (napi-rs) or `fossic-tauri`
IPC? The Tauri IPC layer does not expose an `append` command, which is fine
for read-only observation, but `fossic_subscribe` in the Tauri plugin
requires knowing the Tauri state management approach.
```
