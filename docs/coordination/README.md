---
title: Cross-Claude Coordination — Lattica Working Files
status: live
version: v0.0.0y
---

# Coordination

This directory holds artifacts for cross-Claude coordination across the Lattica
platform — relay messages between project Claudes, briefings, supervisor-pass
findings, and platform-level methodology that governs how multiple Claude
instances work together on the same codebase.

This is separate from `docs/aseptic/` which holds per-pass methodology. Aseptic
governs how one agent runs one pass. Coordination governs how multiple agents
synchronize across passes and projects.

---

## File structure

| File / Dir | Purpose |
|---|---|
| `README.md` | This file — entry point and structure map |
| `COORDINATION_PATTERNS.md` | Durable methodology patterns for cross-Claude work |
| `SUPERVISION_MODEL.md` | The Lattica/Fossic peer-supervisor split, formalized |
| `inbound/` | Messages received from other project Claudes via the user |
| `outbound/` | Messages drafted for relay to other project Claudes via the user |
| `archive/` | Concluded relay threads, moved here when topic is fully resolved |

---

## Relay convention

Cross-Claude messages use the `[Source → Target]` prefix convention, adopted from
Fossic Claude's initial briefing:

- `[Fossic → Lattica]` — Fossic Claude → Lattica Claude
- `[Lattica → Cerebra]` — Lattica Claude → Cerebra Claude
- etc.

Filenames follow `YYYY-MM-DD_<source>_to_<target>_<topic>.md`. Example:
`2026-06-13_fossic_to_lattica_round1_briefing.md`.

When a relay thread concludes (decision locked, action complete), move all
related files from `inbound/` and `outbound/` to `archive/`.

---

## When to read what

| Situation | Read |
|---|---|
| Starting a new round of advocate coordination | `COORDINATION_PATTERNS.md`, recent `inbound/` |
| Joining as supervisor / quality-gate | `SUPERVISION_MODEL.md` |
| Drafting a relay message | Convention section above + recent `outbound/` examples |
| Reviewing a closed coordination thread | `archive/<thread>` |
