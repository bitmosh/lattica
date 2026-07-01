# Requirements Response Template

Use this format in a project's `responses.md` file when Lattica Claude responds
to a filed requirement. Responses are added after round synthesis; individual
responses may be published before a full round closes if a decision is clear.

---

## File front-matter

```markdown
# <Project Name> — Lattica Responses

**Project:** <project-name>
**Last updated:** YYYY-MM-DD

<One-sentence status summary for this project's requirements.>
```

---

## Per-response entry format

```markdown
---
request-id: R-<PROJECT-CODE>-NNN
decision: <accepted | accepted-with-modifications | deferred | declined>
round: N
date: YYYY-MM-DD
---

## Response to R-<PROJECT-CODE>-NNN — <Short title>

**Decision:** <accepted | accepted-with-modifications | deferred | declined>

**Rationale:**
One to three sentences. Why this decision was made. If accepted-with-modifications,
describe what changed. If deferred, state the precondition. If declined, explain
what alternative satisfies the underlying need.

**Lock criteria:**
What makes this decision durable (i.e., what would need to change for it to be
revisited). Examples: "locked until LumaWeave registry extension ships", "locked
unless fossic v1 API changes", "revisit if Phase 3 scope changes".

**Affected phases:**
Which Lattica phases does this decision affect? (e.g., "Phase 2, Phase 4")

**Cross-project impact:**
Does this decision affect any other project? If yes, list the project and the
impact. If none, write "None."

**Follow-up required:**
Any action required by the advocate project before this decision can be
implemented. If none, write "None."
```

---

## Example response

```markdown
---
request-id: R-F-001
decision: accepted
round: 1
date: 2026-06-20
---

## Response to R-F-001 — Live event stream view with subscription

**Decision:** accepted

**Rationale:**
The live event stream view is Phase 2's primary deliverable. fossic's
`fossic-tauri` plugin exposes `fossic_subscribe` and `fossic_unsubscribe`
commands; the tile will use these via Tauri IPC. The 50ms latency target
is achievable with `SubscriptionMode::PostCommit`.

**Lock criteria:**
Locked unless fossic-tauri's subscription API changes or LumaWeave's
tileSectionRegistry type changes in a way that breaks the tile slot.

**Affected phases:**
Phase 2 (primary delivery), Phase 4 (multi-stream glob UI enhancement).

**Cross-project impact:**
Cerebra, policy-scout, bo all have similar subscription needs.
The tile will be generic (glob pattern input); no project-specific forks
needed. Addressed collectively in R-C-001, R-PS-001.

**Follow-up required:**
fossic advocate: confirm `fossic_subscribe` accepts a glob pattern or
requires a stream ID list. Current index.d.ts shows `ReadQuery.streamId`
as a single string — glob support may require a Tauri command extension.
```
