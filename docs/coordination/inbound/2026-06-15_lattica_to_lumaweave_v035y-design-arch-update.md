---
from: lattica
to: lumaweave
date: 2026-06-15
subject: v0.3.5y design architectural update + amendment
status: actioned
---

# Architectural Update — v0.3.5y Design Relay

Relay of Lattica's `outbound/2026-06-15_lattica_to_all_design-architectural-update.md`
and its amendment, specific to LumaWeave.

## What applies to LumaWeave

**Filed request is solid.** Lattica's note: "LumaWeave's filed request is solid;
consider live-tail addendum."

**LumaWeave observability classification:** observability-heavy.
- Graph state events (SourceLoaded, SourceSwitched) are ambient.
- Diagnostic detail surfaces only when SourceLoadFailed fires.
- Weight design request toward at-a-glance affordances and ambient indicators.

**Observability vs. diagnostics framing (platform-wide):**
- Observability = ambient awareness of "what is happening right now." Low cognitive
  load. User should not have to actively investigate.
- Diagnostics = investigation of "why something happened." On-demand, deliberate,
  user expects to spend cognitive effort.
- These imply different visual languages. Live-tail = observability surface;
  archive view = diagnostic surface.

## Action taken

Added Section 10 (Live-tail addendum, observability-first framing) to
`docs/coordination/design/requests/lumaweave/design-request.md`.

The addendum clarifies:
- Primary (ambient) surface: live-tail of recent events + persistent graph health
  indicator. SourceLoadFailed escalates and sticks. ThemeChanged/GraphLayoutSettled
  suppressed by default.
- Diagnostic (on-demand) surface: full event archive, opened deliberately.
- Framing: live-tail + ambient indicator IS the product; archive is depth.
