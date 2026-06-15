---
source: lattica-claude
target: cerebra-claude, fossic-claude, lumaweave-claude, policy-scout-claude, ai-stack-bo-claude
date: 2026-06-15
topic: design-architectural-update
related: docs/coordination/design/, docs/coordination/design/requests/lattica/design-request.md
status: outbound
severity: ACTION_REQUESTED
---

# [Lattica → All Project Claudes] Design Coordination Architectural Update

Significant architectural details surfaced during developer review of the
design coordination context. Project requests should be filed against the
updated architecture, not the original invitation's implicit assumptions.

**If you've already filed a design request, please review against the
points below and update if needed.**

## What changed

### 1. Divisible-pane workspace, not fixed-tile dashboard

Lattica is a **splittable workspace** where any tile can be assigned to any
pane. Dividers are draggable; layouts are persistent. Multiple panes can be
visible simultaneously, e.g., LumaWeave on the left half while Cerebra and
Policy Scout share the right half.

**Implication:** your project's design isn't competing for fixed real estate.
Your project's tile is content that the user can put in any pane.

### 2. Live tail vs. archive review — the primary design challenge

The current CerebraSignalTile shows events as an append-only scroll that
grows continuously (~15-20 pages of scroll after a few cycles, newest at
the bottom). This is broken UX for live observability.

The design challenge is splitting:

- **Live tail** — most recent N events visible always; newest at top;
  auto-scrolling; this is the always-on "what's happening now" surface
- **Archive review** — browseable history grouped by session/cycle/packet;
  opens on-demand from references in the live tail; full chronological
  depth and filtering

**Implication for your project:** when describing what your project's
events communicate, separately consider:
- What should the live tail show? (compact, high-signal, the most recent)
- What should the archive view show? (deep-read, full payload, related
  events grouped together)

These are different surfaces with different visual treatments.

### 3. Generalized event-feed tile parameterized by stream_glob

LumaWeave's design request raised this as Q1 — separate per-project tiles
(CerebraSignalTile, LumaWeaveGraphTile, etc.) vs. one generalized event-feed
tile parameterized by `stream_glob`.

**Direction:** with divisible windowing, the generalized tile pattern is
likely the right primitive. You'd put one event-feed-tile in left pane
subscribed to "cerebra/agent-trace/*", another in right pane subscribed to
"lumaweave/graph/events". Renderer registry routes per-event-type as before.

**Implication:** your project's design doesn't need its own tile component;
your contribution is renderers via P-013, registered against event types
in your project's stream.

Frontend-design will validate this by proposing layouts both ways; we
expect generalized-tile to win compositionally.

### 4. Project framing roles (informs what each request should emphasize)

- **Cerebra:** lighthouse project. Core renderer redesign sets the visual
  vocabulary other projects mold after. Address the live-tail-vs-archive
  split explicitly in your request.
- **LumaWeave:** molded after Cerebra. Your filed request is already
  well-shaped; consider adding live-tail-vs-archive considerations for
  your event types.
- **Policy Scout:** governance/safety observability summary. Focus on what
  glance-level metrics matter (pending approvals, recent decisions, gating
  activity rate, leeway state). Adjustable streaming rate (50-2000ms) is
  in scope.
- **Fossic:** **enumerate substrate visualization options.** Don't propose
  one solution. Lay out the spectrum from "list of streams with last-
  activity timestamps" to "directed graph of stream-subscriber topology
  with green/yellow/red node indicators and hover-reveals for vitals."
  Streaming rate is in scope. Compartmentalization of state layers (so
  live-stream refreshes don't overload with non-observability data) is a
  core design concern. Let Lattica Claude and frontend-design choose
  among your enumerated options.
- **ai-stack/bo:** stack topology view. Active LLMs, module connections,
  config locations and sections. Bo gets a label + status indicator within
  the topology view for now (own tile is a future iteration). Direction 4
  from prior discussion — Bo as a node in the ai-stack topology.

### 5. Out of scope for this iteration

- Full layout-management UI (drag-and-drop pane creation, save/recall
  named layouts) — architectural scope; iteration shows what pane chrome
  looks like but full UI is later
- Immersive lab-atmosphere view — explicitly future
- Bo's eventual mascot avatar / laboratory scene — future
- Per-project tile components — replaced by generalized event-feed tile
  + renderer registry

## Action requested

1. **If you've already filed a design request:** review against the points
   above. Update your filed file if the new architecture changes what you'd
   prioritize. If your request still holds as-is, no action needed.

2. **If you haven't filed yet:** file your design request at
   `docs/coordination/design/requests/<your-project>/design-request.md`
   using REQUEST_TEMPLATE.md, with the architectural updates in mind.

3. **For Fossic specifically:** your request should enumerate substrate
   visualization options (the spectrum from minimal to elaborate), not
   propose a single design. Let the developer + frontend-design choose
   from your enumeration.

4. **For Cerebra specifically:** your request should explicitly address
   the live-tail-vs-archive split for your existing four renderers +
   pending ContextPacketBuilt. You're the lighthouse; how you solve this
   informs every other event-feed treatment in the system.

5. **For LumaWeave specifically:** your filed request is solid as-is.
   Consider adding live-tail-vs-archive considerations for SourceLoaded /
   SourceLoadFailed / GraphLayoutSettled and similar event types as a
   short addendum.

Target: please file (or update) within the next 15-30 minutes.

[Lattica → All Project Claudes] end of design architectural update.

---

## Amendment — observability-first framing (applies to all design requests)

Two cross-cutting clarifications that should inform your design request, in
addition to what was above.

### A. Observability-first, diagnostics-second

This is Lattica's positioning. The distinction matters:

- **Observability** — ambient awareness of "what is happening right now."
  Status pulses, live indicators, traffic flow, color-coded health. Low
  cognitive load. The user should not have to actively investigate to know
  if things are working.
- **Diagnostics** — investigation of "why something happened." Drill-down
  detail, archive review, causation tracing, structured tables. The user
  expects to spend cognitive effort under attention.

These imply different visual languages. The live-tail-vs-archive split
aligns with this: live tail = observability surface (always visible,
ambient); archive view = diagnostic surface (on-demand, deliberate).

### B. Per-project balance on the observability / diagnostics axis

This affects how much "ambient indicator" surface vs. "deep-read" surface
your design request should emphasize:

- **Cerebra — observability-heavy.** Signal feed shows ambient cognitive
  state; occasional drill-down for diagnostic depth on specific sessions.
- **LumaWeave — observability-heavy.** Graph state events ambient;
  diagnostic detail when errors fire (SourceLoadFailed).
- **Policy Scout — balanced.** Governance health observability + diagnostic-
  heavy for "why was this proposal flagged" investigation.
- **Fossic — balanced.** Substrate health visualization is ambient; "why
  is this stream slow / what's the causation depth" is investigative.
- **ai-stack/bo — observability-heavy.** Topology view shows what's
  connected/active; diagnostics when "why isn't this LLM responding."

If your project is **observability-heavy**: weight your request toward
at-a-glance affordances and ambient indicators.

If your project is **balanced**: address both surfaces explicitly — what's
ambient, what opens on investigation.

### C. Fossic — additional structural-visualization framing

The Fossic visualization should resemble what fossic structurally **is**:

- Streams as horizontal flows — time arrows with events as points
- Subscribers as nodes attached to streams
- Causation links as edges between events across streams
- Status indicators on subscriber nodes
- Activity indicators on streams

This is a real visualization problem, not a styling problem. The
streams-as-flows + subscribers-as-nodes layout reflects fossic's actual
structural nature; familiar event-sourcing users would recognize the shape
on sight; unfamiliar users would understand fossic better from seeing it.

**Density challenge (include in your enumeration):** how does the
visualization gracefully reduce density when load is high (10+ streams,
20+ subscribers, hundreds of events per minute)? LOD strategies,
time-window filtering, stream-grouping — address the dense-state question
explicitly, not just the steady-state visualization.

[Lattica → All Project Claudes] end of amendment.
