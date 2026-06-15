# Design Request — [Project Name]

> Each project files ONE design request covering their entire visual footprint
> in Lattica's UI. Fill out the sections below and save at:
> `docs/coordination/design/requests/<project>/design-request.md`

## Section 1 — Project identity

- **Project name:** [e.g., cerebra]
- **Filed by:** [project-claude session]
- **Date:** [YYYY-MM-DD]

## Section 2 — What this project contributes visually

Describe what data your project produces that surfaces in Lattica's UI.
List the event types, tiles, status panels, or other visual elements. Be
concrete:

- [Event type or tile #1] — what data does it carry; what does seeing it
  communicate to the user
- [Event type or tile #2] — same
- ...

This isn't an inventory of current files. It's a list of what NEEDS visual
representation for your project's information to be legible in the platform.

## Section 3 — Visual priority hierarchy

For the items above, rank what matters most at-a-glance vs. on-deep-read.
Frontend-design will use this to allocate visual weight.

- **Highest priority (must register at-a-glance):** [item or attribute]
- **Medium priority (visible without effort):** [items]
- **Low priority (deep-read only; can be tucked):** [items]

## Section 4 — What a glance should communicate

For your project's contributions in the feed/UI, what should a user understand
within ~2 seconds of looking?

- "Cerebra is currently running" / "Cerebra accepted the cycle" / "Policy
  Scout flagged this for approval" / etc.
- Concrete behavioral signal, not abstract attribute

## Section 5 — What doesn't matter at-a-glance

Explicit: what can frontend-design treat as low-visual-priority or hide
behind expand-to-see actions?

- e.g., "event_id is technical; users won't read it; design can suppress it"
- e.g., "checklist_details is structured nested data; surface only as
  expand-on-click"

## Section 6 — Cross-project visual relationships

Does your project's UI need to relate visually to other projects? Examples:

- "Cerebra's PredictionMade events should be visually adjacent to OutcomeRecorded
  events from the same cycle"
- "Policy Scout's approval events should visually escalate when associated
  with ActionProposed events"
- "LumaWeave's graph state events should signal which Cerebra cycle
  triggered the graph rebuild"

If no cross-project visual relationships, say "none."

## Section 7 — Current implementation (reference only)

Frontend-design is **encouraged to diverge** from current implementation.
This section is reference, not constraint.

- Current file paths: [src/renderers/<project>/...]
- Current visual approach (1-2 sentences): [brief description]
- What works in current treatment: [what to potentially preserve]
- What doesn't work: [what to definitely change]

## Section 8 — Constraints (real ones only)

Hard constraints that frontend-design must respect:

- ADR contracts (e.g., ADR-017 PayloadRendererProps shape)
- Existing design tokens you must use (--portfolio-* namespace)
- Accessibility constraints
- Technical constraints (e.g., monospace required because the rendered text
  is data, not prose)

Do not list preferences here. Preferences belong in Section 3-5.

## Section 9 — Open questions for frontend-design

Questions you'd like the design iteration to specifically address:

- "How do we distinguish accept vs. stop vs. refine decisions visually
  when they share most card structure?"
- "Should low-confidence states be visually attenuated, bordered, or
  badged?"
- ...
