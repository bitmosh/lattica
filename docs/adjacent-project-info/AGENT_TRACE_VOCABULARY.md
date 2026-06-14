---
title: Agent Trace Vocabulary — Pointer
canonical: ~/Projects/fossic/docs/implement/AGENT_TRACE_VOCABULARY.md
status: pointer
last_updated: 2026-06-14
---

# Agent Trace Vocabulary

The canonical vocabulary document is in **fossic**:

```
~/Projects/fossic/docs/implement/AGENT_TRACE_VOCABULARY.md
```

This file is a pointer, not a mirror. All edits land in fossic's copy. Fossic Claude
owns vocabulary evolution per the supervision model
(`docs/coordination/SUPERVISION_MODEL.md` or `docs/coordination/COORDINATION_PROTOCOL.md`).

## Why a pointer instead of a mirror

Mirrors drift. The previous Lattica-side copy (deleted in v0.2.1.c) had become 538 lines
stale against fossic's 919-line canonical — missing the Cerebra Consumer Extension
Registry and other later additions.

fossic publishes the vocabulary as part of its library API surface; Lattica is a
consumer. The canonical-and-pointer pattern is the standard for shared platform
artifacts where one project owns the substrate and others consume it.

## When this pointer needs updating

- If fossic moves the file within its own repo (unlikely)
- If the supervision model changes vocabulary ownership (also unlikely)

Otherwise this file is stable.

## Updates to the vocabulary

Cross-Claude relays routing vocabulary updates to Fossic Claude land in
`docs/coordination/outbound/` with topics like `cerebra-pass-9.X-vocabulary-route`.
Fossic Claude's responses come back via `docs/coordination/inbound/`.

When fossic ships a vocabulary edit, the update is referenced by version in fossic's
release notes; consumers don't need to do anything beyond reading the canonical file.

## History

Lattica previously held a copy of AGENT_TRACE_VOCABULARY.md at
`docs/implement/AGENT_TRACE_VOCABULARY.md`. It was moved to
`docs/adjacent-project-info/AGENT_TRACE_VOCABULARY.md` by an off-script Claude session
between v0.2.1.a and v0.2.1.c. The triage at `docs/coordination/off-script-triage.md`
identified the stale-copy risk; v0.2.1.c replaces the stale copy with this pointer
doc per the developer's decision.
