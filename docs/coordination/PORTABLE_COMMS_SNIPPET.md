---
title: Portable Comms Protocol Snippet
purpose: Paste-into-prompt block for project Claude prompts
last_reviewed: v0.2.1.c
---

# Portable Comms Protocol Snippet

Paste this block into every project Claude's prompt (whether the prompt is hand-written 
or in a Claude Code task file). It's the minimum context any project Claude needs to 
participate in platform coordination correctly.

---

## Snippet (copy-paste from here ↓ to the next horizontal rule)

You are participating in the Lattica platform coordination system. Before any 
substantive coding work, run a grounding pass:

1. **Check mail** at `~/Projects/lattica/docs/requirements/<your-project>/` for 
   messages addressed to you. Also check 
   `~/Projects/lattica/docs/coordination/outbound/` for direct relays from Lattica 
   Claude.
2. **Check cross-pollination** at 
   `~/Projects/lattica/docs/coordination/cross-pollination/<other-projects>/` for new 
   files since your last grounding pass.
3. **Check current states** at 
   `~/Projects/lattica/docs/coordination/current-states/<other-projects>/current_state.md` 
   for any project your work depends on.
4. **Check unified-passage** at 
   `~/Projects/lattica/docs/coordination/unified-passage/` for any UP-NNN directories 
   with PLAN*.md drafts needing your input or ACK.

When you produce a cross-pollination file in your project's 
`docs/aseptic/cross-pollination/`, also mirror it to 
`~/Projects/lattica/docs/coordination/cross-pollination/<your-project>/` with the 
same filename.

When you file any coordination file (inbound response, outbound message, 
cross-pollination mirror), append a one-line entry to 
`~/Projects/lattica/docs/coordination/mail_routing.md` in the format:
`YYYY-MM-DD · [source → target] · channel · filename.md`

Update your project's `~/Projects/lattica/docs/coordination/current-states/<your-project>/current_state.md` 
when your project ships a version, resolves/surfaces a blocker, or changes a 
dependency on another project.

The full protocol is at 
`~/Projects/lattica/docs/coordination/COORDINATION_PROTOCOL.md`. The unified-passage 
methodology is at `~/Projects/lattica/docs/aseptic/UNIFIED_PASSAGE.md`. Use Claude 
Code (or filesystem access) to verify state rather than asking the developer.

---

## When to update this snippet

Keep this snippet at roughly 30 lines. If it grows beyond ~40 lines, the snippet has 
become too heavy to paste — split into the most critical fragment plus a reference to 
the full protocol.

Update when:
- The directory layout for coordination changes
- The grounding-pass checklist changes
- A new mandatory step is added to the protocol
