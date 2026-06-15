---
packet: PACKET-001
compiled: 2026-06-15
compiled_by: lattica-claude
status: draft — awaiting developer review before frontend-design handoff
sources:
  - docs/coordination/design/requests/lattica/design-request.md
  - docs/coordination/design/requests/cerebra/design-request.md
  - docs/coordination/design/requests/lumaweave/design-request.md
  - docs/coordination/design/requests/policy-scout/design-request.md
  - docs/coordination/design/requests/fossic/design-request.md
  - docs/coordination/design/requests/ai-stack-bo/design-request.md
---

# PACKET-001 — Lattica Visual Design Iteration 1

> **For frontend-design:** this packet is a briefing document. Read it fully
> before producing any layouts or proposals. It synthesizes six project design
> requests into a coherent design brief. File outputs in
> `docs/coordination/design/iterations/<iteration-name>/`.

---

## Section 1 — What this packet is and what to produce

**The design challenge in one sentence:** Lattica is a divisible-pane platform
workspace that needs a visual system for displaying live event streams from six
projects, with a clean split between ambient observability (always-on, low
cognitive load) and diagnostic investigation (on-demand, deliberate effort).

**What frontend-design should produce in this iteration:**

1. **Layout proposals** for the divisible-pane workspace — what the shell looks
   like, how panes are divided, what pane chrome looks like, where status panels
   live.

2. **Live-tail card treatment** for Cerebra's event types (the lighthouse
   project). The compact card design established here becomes the visual
   vocabulary for all other project event feeds.

3. **Archive/diagnostic view proposal** — how the on-demand detail surface
   opens, how it's organized, how it relates to the live tail.

4. **Generalized event-feed tile spec** — since all projects use the same tile
   component parameterized by stream_glob, the tile frame (chrome, header,
   live-tail section, depth control) is a platform primitive. Define it.

5. **Fossic substrate tile recommendation** — choose from Options A–D
   enumerated in §9.5. Can be a brief recommendation with rationale, or a
   sketch of the chosen option.

6. **Cross-project visual system** — how project identity is communicated
   when multiple panes are visible side-by-side.

**What frontend-design does NOT need to produce:**

- Per-project tile components (there are none; see §2)
- Complete design for all event types across all six projects — start with
  Cerebra as lighthouse, note what generalizes
- Policy Scout, ai-stack/Bo, LumaWeave visual treatments — these follow from
  the Cerebra-derived vocabulary; signal your direction, final iteration later

**Iteration scope:** workspace shell + generalized tile frame + Cerebra live-
tail card treatment + Fossic substrate tile option selection.

---

## Section 2 — Platform architecture

### The workspace

Lattica is not a fixed-tile dashboard. It is a **divisible-pane workspace**
where any pane can host any tile. Panes are split horizontally or vertically
(dividers are draggable), layouts are persistent, and each pane independently
shows a tile selected from the tile registry.

Example layout: LumaWeave in left half, Cerebra and Policy Scout stacked in
the right half. Every combination is possible.

**Implication:** the design target is a pane-and-tile system, not a dashboard.
Design the pane chrome (header showing which tile is active, divider affordance,
tile-selector) as a workspace primitive.

### The generalized event-feed tile

There is **one event-feed tile**, not per-project tiles. It is parameterized by
`stream_glob` (e.g., `"cerebra/agent-trace/*"` or `"lumaweave/graph/events"`).
Inside the tile, events are routed to per-event-type renderer components via
`payloadRendererRegistry` (an internal registry mapping event type → React
component). Projects contribute renderers via P-013; the tile frame hosts them.

**Implication:** design the tile frame (header, live-tail section, depth
affordance) once. Per-project visual variation lives in the renderer cards
inside the frame, not in separate tile components.

### The tile frame

Each event-feed tile has at minimum:
- **Tile header** — shows project name + stream glob, possibly a live/archive
  mode indicator
- **Live-tail section** — most recent N events, newest at top
- **Depth affordance** — "older →" or equivalent that opens the archive view
  for that tile's stream

The tile frame is the platform's contribution; the renderer cards are the
projects' contributions. Design both.

### Current tile registry

Two tiles registered today:
- `cerebra-signal-feed` — `cerebra/agent-trace/*`; right panel, 420×320
- One placeholder `HelloTile`

Both will be replaced by the generalized event-feed tile pattern.

---

## Section 3 — Core design problem: live tail vs. archive review

**This is the most important problem to solve in this iteration.**

The current `CerebraSignalTile` shows events in arrival order, newest at the
bottom of a continuously growing scroll. After a few cycles, the most recent
information is buried under 15-20 pages of scroll. This is broken UX for live
observability — the information the user most needs (what's happening right now)
is the hardest to find.

### The required split

**Live tail (observability surface — always-on in pane):**

- Most recent N events; newest at top; auto-updates; does NOT grow unbounded
- Each event is a compact card showing only the highest-priority fields
- Lifecycle markers (SessionOpened, CycleStarted) appear as single-line chips,
  not full cards
- A "depth affordance" (e.g., "older →" at bottom, or a count badge) opens
  the archive for this session

**Archive view (diagnostic surface — on-demand):**

- Opens from the live tail (click an event reference, click the depth
  affordance)
- Shows full chronological history grouped by session → cycle → step
- Full payload detail per event
- Filterable by session, event type, decision band, error classification, etc.
- Per-step arc view for Cerebra (see §9.1): PredictionMade + SignalEvaluated +
  OutcomeRecorded from the same step_id shown as a unit

### Cerebra is the lighthouse

Cerebra is the first project to have live renderers in the system. How Cerebra
solves the live-tail/archive split sets the visual vocabulary for all other
event feeds. The Cerebra treatment in this iteration is the reference design.

LumaWeave, Policy Scout, and ai-stack/Bo follow the same pattern. Per-project
visual variation is in the renderer cards; the tile frame + live-tail/archive
pattern is shared across all of them.

### Live tail depth

Design question: how many events in the live tail? Cerebra's request suggests
5–10. More than 10 risks re-creating the scroll problem at smaller scale. Less
than 5 risks losing context. Cerebra defers to frontend-design on the exact
number; the tile frame should make this a configurable parameter.

---

## Section 4 — Observability-first / diagnostics-second

**Lattica is an observability-first platform.** This principle shapes every
visual decision.

### The two surfaces

**Observability surface (always-on, ambient):**
Status pulses, live indicators, activity flow, color-coded health. Low cognitive
load. The user should know at a glance if things are working without actively
investigating. Examples: live tail, status panels, node health indicators in
ai-stack topology, substrate activity pulse in Fossic tile.

**Diagnostic surface (on-demand, deliberate):**
Archive review, causation tracing, drill-down detail, structured tables. The
user *expects* to spend cognitive effort here. Examples: archive view for a
session, causation chain detail in Fossic, full alias table in LiteLLM node
click-through.

### Per-project balance on the observability/diagnostics axis

| Project | Balance | Implication |
|---|---|---|
| Cerebra | observability-heavy | Signal feed is ambient; diagnostic depth (specific signal numbers, rule names) opens on demand |
| LumaWeave | observability-heavy | Graph state events ambient; diagnostic detail on SourceLoadFailed errors |
| Policy Scout | balanced | Governance health ambient + diagnostic for "why was this flagged" |
| Fossic | balanced | Substrate health ambient; causation depth investigative |
| ai-stack/Bo | observability-heavy | Topology always-on; diagnostics on node click |
| Lattica (platform shell) | observability-heavy | Chrome communicates platform health; diagnostic depth is Fossic's surface |

### What this means for visual language

**Observability surface visual language:**
- High contrast, color-coded status (green/amber/red)
- Dense but legible — compact cards, not long paragraphs
- Time expressed as relative age ("2s ago", "just now") not exact timestamps
- Suppresses technical identifiers (ULIDs, event IDs, hash strings)

**Diagnostic surface visual language:**
- More structured, tabular, exact
- Full payload visible; identifiers exposed
- Filtering, sorting, grouping controls
- Can afford complexity since user is actively investigating

These are different visual modes, not just different amounts of information.
The design should make the transition between them feel like entering a
different cognitive mode — not just scrolling further.

---

## Section 5 — Visual surface inventory

Six projects contribute to Lattica's visual surface. Each project's stream path,
event types, and visual role are listed below. Full per-project detail in §9.

### 5.1 Lattica (platform shell)

- **Surface type:** workspace chrome, not an event-feed tile
- **Observability/diagnostics:** observability-heavy
- **Visual elements:**
  - Workspace shell (pane dividers, pane headers, tile selector)
  - Status panels — FOSSIC STORE, CANARY STREAM, TILE REGISTRY, POSTMESSAGE
  - Header — branding, version (auto-derived), platform alive signal
- **Primary design challenge:** where do status panels live in a divisible-pane
  workspace? Fixed top row, always-on status pane, or user-pinnable tiles?

### 5.2 Cerebra (lighthouse — event-feed tile)

- **Stream:** `cerebra/agent-trace/<session_id>` (glob: `cerebra/agent-trace/*`)
- **Observability/diagnostics:** observability-heavy
- **Live renderers:** ClutchDecisionMade, SignalEvaluated, PredictionMade,
  OutcomeRecorded
- **Pending renderer:** ContextPacketBuilt
- **Primary design challenge:** live-tail compact card treatment sets vocabulary
  for all event feeds; per-step arc grouping in archive view

### 5.3 LumaWeave (event-feed tile)

- **Stream:** `lumaweave/graph/events`
- **Observability/diagnostics:** observability-heavy
- **Event types:** SourceLoaded, SourceLoadFailed, SourceSwitched,
  ThemeChanged, GraphLayoutSettled
- **No renderers yet** — design establishes vocabulary; implementation follows
- **Primary design challenge:** SourceLoadFailed diagnostic depth vs. ambient
  SourceLoaded/GraphLayoutSettled; live-tail-vs-archive addendum needed

### 5.4 Policy Scout (event-feed tile, balanced)

- **Streams:** `policy-scout/audit/*`, `policy-scout/approval/*`
- **Observability/diagnostics:** balanced
- **Key events:** DecisionIssued (verdict + color band), ApprovalRequested
  (blocks agent — requires user action), resolution events
- **Ambient derived metrics:** decisions/min, pending approval count, lockdown state
- **No renderers yet**
- **Primary design challenge:** ApprovalRequested is action-required, not
  informational — persistent panel vs. event-in-feed; decision density at
  high agent activity rate

### 5.5 Fossic (substrate tile — different from event-feed)

- **Observability/diagnostics:** balanced
- **Surface type:** infrastructure health visualization, NOT an event-feed tile
- **Four options enumerated** (see §9.5): enhanced status panel (A), tabular
  stream dashboard (B), streams-as-flows structural visualization (C), full
  directed graph (D)
- **Primary design challenge:** choose the option; address density for C/D

### 5.6 ai-stack / Bo (topology tile — different from event-feed)

- **Observability/diagnostics:** observability-heavy
- **Surface type:** node topology view, NOT an event-feed tile
- **Nodes:** Ollama, LiteLLM, openedai-speech, Open-WebUI, Bo (status node)
- **Phase 1 (polling, available now):** Bo heartbeat, Ollama /api/ps, LiteLLM /health
- **Phase 2 (fossic-backed, future):** ai-stack/gpu, ai-stack/models, bot/lifecycle
- **Primary design challenge:** edge animation on inference call; idle Ollama state;
  dormant vs. active edges; graceful degradation when services unreachable

---

## Section 6 — Cross-project visual relationships

### 6.1 Cerebra → Policy Scout (causation link)

When a Cerebra agent action triggers a Policy Scout governance check, the
`CommandRequested.upstream_causation_id` references the originating Cerebra
event. The `DecisionIssued` card for that check should show a "↑ Cerebra"
indicator linking to the originating Cerebra session.

**Escalation case:** `ApprovalRequested` with a Cerebra upstream link is
particularly high-value to escalate — a blocked agent is waiting. The link
should make this visible without requiring investigation.

### 6.2 Cerebra → LumaWeave (trigger relationship)

When a Cerebra cycle triggers a LumaWeave graph rebuild, the two project panes
side-by-side should make this relationship ambient-visible. No renderer change
is required from either project; the layout relationship communicates the
trigger. Frontend-design should note this as a desirable pane pairing.

### 6.3 Fossic ↔ all projects (substrate correlation)

When Fossic's substrate tile shows Cerebra's stream active with N subscribers,
and Cerebra's tile simultaneously shows live events — the user should be able
to visually correlate them without investigation. The stream path string
(`cerebra/agent-trace/sess_...`) should be the same in both contexts.

When a Fossic subscriber goes degraded, the affected project's tile will go
quiet. The Fossic degradation indicator should be visually correlatable to the
"quiet" state in the project tile — same project accent color, similar visual
language for the degraded state.

### 6.4 Per-step arc grouping (Cerebra archive)

`PredictionMade → SignalEvaluated → OutcomeRecorded` from the same `step_id`
form a natural unit — the "prediction arc" for one step. In the archive view,
these three events should be displayed as a grouped unit, not three isolated
cards. In the live tail, only the most recent (usually `OutcomeRecorded`) needs
to be visible.

### 6.5 Project identity in multi-pane layouts

When Cerebra and Policy Scout panes are visible side-by-side, project identity
needs to be immediately legible. Options: per-project accent colors (pane
header border tint, icon color, or background hue), or universal neutral with
project identity signaled via labels only. Frontend-design should propose how
project identity is communicated and choose or recommend the accent approach.

Accent colors from the Fossic blog bumper theme (informational only; not binding):
- Fossic: sky `#4cc9ff`
- Other projects: not yet designated

---

## Section 7 — Hard constraints (all designs must respect)

These are architectural contracts. They are not preferences.

### 7.1 PayloadRendererProps shape (ADR-017)

All renderer components contributed via P-013 receive exactly:
```typescript
type PayloadRendererProps = { payload: unknown; event_id: string }
```
No additional props. Renderers own their own type guard. Design must not
assume renderers receive layout, context, or callback props.

### 7.2 Design token namespace (ADR-015)

All colors, spacing, and surface tokens are in the `--portfolio-*` namespace.
Host (Lattica) owns the token definitions; guest (project) renderers reference
them. No hardcoded hex values in renderer CSS. Design proposals should specify
tokens by intent (e.g., `--portfolio-success-bg`, `--portfolio-danger-border`),
not by hex.

### 7.3 P-013 guest renderer pattern

Projects contribute renderer components to `src/renderers/<project>/` in
Lattica's tree via P-013. The host (Lattica) commits them and registers them.
Renderer components must stand alone and must not import from other project
subdirectories. The tile frame is Lattica's; the cards are project-contributed.

### 7.4 Structural marker requirement (Cerebra renderers)

Cerebra's renderer root divs carry `data-cerebra-renderer="<EventType>"` as a
structural marker for smoke tests. This is the existing pattern; any redesign
of Cerebra's renderer components must preserve it.

### 7.5 TypeScript constraints

`jsx: react-jsx` — no `import React`. `strict: true`, `noUnusedLocals: true`,
`noUnusedParameters: true`. React 19. Components must be named exports, not
default exports (current convention).

### 7.6 Typography

- **Monospace** for event content (event data is structured data, not prose)
- **Sans-serif** for chrome, headers, labels
- Mixed typography within a renderer card is expected: label (sans-serif) + value (monospace)

### 7.7 Tauri webview

Full modern CSS is available (CSS Grid, custom properties, container queries,
`:has()`, etc.). No browser-compatibility concerns; target Tauri's bundled
webview only.

### 7.8 Fossic-tauri capabilities

Current IPC surface: `fossic_list_streams`, `fossic_list_branches`,
`fossic_read_range`, `fossic_subscribe`, `fossic_walk_causation`.
`fossic_list_subscribers()` does not yet exist — any Fossic option that
requires subscriber state needs a small fossic-tauri pass.
`fossic_stream_metrics` does not exist — per-stream event rate needs either
a fossic-tauri addition or client-side derivation from events.

---

## Section 8 — Synthesized open questions (ranked by impact)

These are the decisions that most affect the entire system. Address in order.

### 8.1 [CRITICAL] Live-tail depth and overflow strategy

What is N (events shown in live tail) and what happens when N+1 arrives?

Options: fixed-depth cap (oldest falls off silently), visible count badge
("+ 47 older"), or scrollable within tile with a tile-height cap.

**Why it matters:** this decision determines whether the scroll problem is
actually solved or shifted. The answer must make the most recent information
always-visible without drift.

### 8.2 [CRITICAL] Compact card vs. summary chip in live tail

In the live tail, do Cerebra event cards render as:
- **Compact version of the current renderer card** (same component, fewer
  fields shown, lower card height), or
- **Summary chip** — a completely different component: one line, color-coded
  badge, no card structure at all?

**Why it matters:** the current Cerebra renderer cards are information-dense.
A "compact renderer" might still be too tall for a useful live tail at N=10.
Summary chips solve density but lose per-event structure.

**Cerebra's note:** the latter (summary chip) may be necessary if card
reduction still produces 10-card tiles that are too tall. Frontend-design
should sketch both and identify the crossover point.

### 8.3 [HIGH] Per-step arc grouping in archive

Should `PredictionMade + SignalEvaluated + OutcomeRecorded` from the same
`step_id` collapse into one grouped card with expand? Or stay as three
adjacent cards with a visual separator ("step N" header)?

The grouped-card approach is cleaner for archive reading but requires the
archive view to group by `step_id` before rendering — a non-trivial data
model. Frontend-design should propose which approach to implement and
note the data-model implication.

### 8.4 [HIGH] Status panel placement in divisible-pane workspace

The current four status panels (FOSSIC STORE, CANARY STREAM, TILE REGISTRY,
POSTMESSAGE) are a fixed top row above the workspace. In a divisible-pane
world, three options:

- **A: Fixed top row** — stays above the workspace; always visible; not in
  the pane system
- **B: Always-on status pane** — one pane in the workspace is designated as
  the status pane; user can't replace it with a content tile
- **C: Pinnable tile** — status panel is itself a tile; users pin it in
  whatever pane they want (or omit it entirely)

POSTMESSAGE is a developer affordance that can be hidden behind a debug
toggle regardless of choice.

### 8.5 [HIGH] ApprovalRequested handling in Policy Scout

`ApprovalRequested` is categorically different from other events: it requires
user action, may persist for seconds to minutes, and blocks a running agent.

- **A: Persistent approval panel** — always-on section above the event feed
  in the Policy Scout tile, showing all unresolved approvals
- **B: Escalated event card in feed** — full-width card in the live tail with
  inline approve/deny affordance; resolved state transitions it to a dimmed
  resolved card

Option A (persistent panel) keeps approval never-off-screen. Option B keeps
the UI simpler. Frontend-design should propose which one and sketch the UX
for the approval-resolution flow.

### 8.6 [HIGH] Fossic substrate tile option selection

Choose from Options A–D (full description in §9.5). Recommendation from
Fossic: **B for speed, C for correctness**. Option C requires a small
fossic-tauri pass for `fossic_list_subscribers()`. Option D is not recommended
as first iteration.

Frontend-design should select the option, note what it requires from fossic-
tauri, and sketch the density-reduction strategy for the chosen option.

### 8.7 [MEDIUM] Project accent color system

Each project needs a visual identity signal in multi-pane layouts. Choose:

- **Designated accent colors per project** — each project's pane header,
  tile chrome, and renderer card root carry a distinct project hue
- **Neutral palette, label-only identity** — all projects share the same
  neutral surface treatment; project identity is communicated only via text
  labels

The accent-color approach is stronger for scan-legibility in multi-pane
layouts. The neutral approach avoids palette coordination complexity.

If accent colors are chosen, designate the six project hues (Fossic already
has sky `#4cc9ff`; the others need designation).

### 8.8 [MEDIUM] Lifecycle events in Cerebra live tail

`SessionOpened`, `CycleStarted`, `CycleCompleted` are important context events
but carry no score data and fire once per session/cycle. Options:

- **Full card** — treated same as data events; take up live-tail slots
- **Single-line chip** — compact status line, visually distinct from data cards
- **Section dividers only** — appear as section headers in archive view;
  not in the live tail at all
- **Aggregated** — a persistent "session header" at top of live tail showing
  current session state, derived from lifecycle events rather than displaying them

### 8.9 [MEDIUM] Severe miss escalation in Cerebra

`OutcomeRecorded` with `error_classification: "severe"` indicates Cerebra's
predictions are badly wrong. Currently: danger-red border. Options for stronger
escalation:

- Pin to top of live tail until resolved
- Pulse/animation on arrival
- Persist in a "recent alerts" strip above the main event feed
- Current treatment (border only) is sufficient for Phase 1

### 8.10 [LOWER] LiteLLM alias dormant edge treatment

The `LiteLLM → external (bot-escalated → Anthropic)` edge is currently dormant.
How to render a "wired but inactive" connection? Dashed line? Grayed out?
Separate from an "unreachable" edge? Frontend-design should establish the visual
vocabulary for dormant-but-valid vs. degraded vs. absent edges in topology views.

---

## Section 9 — Per-project reference sheets

Quick references for each project. For full detail, read the filed design request.

### 9.1 Cerebra (lighthouse)

**Role:** lighthouse project — renderer redesign here sets visual vocabulary
for all other event feeds.

**Stream:** `cerebra/agent-trace/*`

**Live renderers:** ClutchDecisionMade, SignalEvaluated, PredictionMade,
OutcomeRecorded.

**Pending:** ContextPacketBuilt (after new visual vocabulary lands).

**Priority hierarchy:**
- At-a-glance: last clutch decision (accept/refine/stop + color), composite
  score health (bar or pulse), prediction error classification (noise/notable/
  severe), cycle running indicator
- Visible without effort: step count, per-signal 6-grid, prediction basis badge
- Diagnostic only: event IDs, per-signal prediction errors, cascade depth,
  rule name, raw timestamps, session/cycle/step ID strings

**The per-step arc:** `PredictionMade → SignalEvaluated → OutcomeRecorded`
from the same `step_id` is a unit. Archive view should group these as one
expandable arc. Live tail shows only the most recent.

**Key Cerebra-specific open questions:**
- Compact card vs. summary chip in live tail (§8.2 — critical)
- Per-step arc grouping in archive (§8.3)
- Lifecycle events as chips or section dividers (§8.8)
- Low-confidence flag visual treatment (dimmed? border? badge?)
- Severe miss escalation beyond danger border (§8.9)

**Current implementation:** `src/renderers/cerebra/` — dark monospace cards,
`--portfolio-*` tokens, ALL CAPS labels, score bars (█░), colored
classification badges, 3×2 signal grids. Dark palette and monospace are worth
preserving. The scroll problem (§3) is what must change.

---

### 9.2 LumaWeave

**Stream:** `lumaweave/graph/events`

**Observability balance:** observability-heavy.

**Event types and priorities:**

| Event | Priority | What it communicates |
|---|---|---|
| SourceLoaded | at-a-glance | Graph is ready; N nodes + edges loaded |
| SourceLoadFailed | at-a-glance | Graph source failed — most important error state |
| SourceSwitched | medium | User switched to a different data source |
| ThemeChanged | low | Visual palette update; no functional significance |
| GraphLayoutSettled | low | Physics simulation complete |

**No renderers yet** — design establishes vocabulary; P-013 implementation follows.

**Key question:** LumaWeave raised Q1 (per-project tile vs. generalized
event-feed tile). The answer (generalized tile) is established. LumaWeave's
events render inside the generalized tile subscribed to `lumaweave/graph/events`.

**Live tail:** SourceLoaded (compact status card), SourceLoadFailed (escalated
error card), SourceSwitched (compact), ThemeChanged/GraphLayoutSettled (chip-
level, very low visual weight).

**Diagnostic depth for SourceLoadFailed:** what failed and why; relevant
for investigation; shouldn't dominate the live tail.

**Operational note:** LumaWeave currently writes to project-local fossic store,
not shared platform store. Events won't flow to Lattica's tile until config is
aligned. This is an operational flag, not a design constraint.

---

### 9.3 Policy Scout

**Streams:** `policy-scout/audit/*` and `policy-scout/approval/*`

**Observability balance:** balanced — governance health is ambient; "why was
this flagged" is investigative.

**Primary events:**

| Event | Visual treatment | Priority |
|---|---|---|
| DecisionIssued | Color-banded card (ALLOW=green, DENY=red, REQUIRE_APPROVAL=amber) | at-a-glance |
| ApprovalRequested | Escalated — action required; user must respond | at-a-glance |
| ApprovalApprovedOnce/DeniedOnce | Resolution tag on the pending approval card | medium |
| ApprovalExpired | Warning card — action window closed | medium |
| CommandRequested | Context for DecisionIssued; can be suppressed until diagnostic | low |

**Ambient derived metrics (not individual events — derived from stream state):**
- Pending approval count badge (>0 demands attention; 0 = invisible)
- Decisions/min rate (is governance active?)
- Lockdown/watch state indicator (global policy posture — one persistent pill)

**Key design challenge (§8.5):** ApprovalRequested requires user action and
may persist. Persistent approval panel (Option A) vs. escalated event card
(Option B). Policy Scout leans Option A (persistent panel, never scrolls off).

**Decision density (§8.1 applied to Policy Scout):** at 6-12 DecisionIssued
events/min (Cerebra running), the live tail saturates. Policy Scout recommends
Option C (sparse events + rate counter): routine ALLOW decisions collapse to a
rate counter; only anomalies (DENY, REQUIRE_APPROVAL) appear as cards. This
aligns with observability-first — "everything is fine" = a number, not a scroll
of green cards.

**Accessibility note:** decision outcome colors (ALLOW=green, DENY=red,
REQUIRE_APPROVAL=amber, SANDBOX_FIRST=orange, DENY_AND_ALERT=deep red) are
safety-relevant states. Colorblind-accessible differentiation is a hard
requirement — do not rely on hue alone.

**No renderers yet.** `src/renderers/policy-scout/` pending vocabulary.

---

### 9.4 ai-stack / Bo

**Surface type:** topology view (not event-feed tile).

**Observability balance:** observability-heavy.

**Topology nodes:**

| Node | Key state | Priority |
|---|---|---|
| Ollama | up/down, models loaded in VRAM, VRAM gauge | at-a-glance |
| LiteLLM | up/down, N aliases live | at-a-glance |
| Bo (Discord bot) | running/offline, last-seen timestamp | at-a-glance |
| openedai-speech | up/down only | medium |
| Open-WebUI | up/down only | medium |

**Topology edges:**
- Bo → LiteLLM (solid, always-on when both running)
- LiteLLM → Ollama (solid, main inference path)
- Open-WebUI → Ollama (solid, direct)
- LiteLLM → external Anthropic (dashed/gray, dormant; see §8.10)

**Inference animation:** when Bo makes an inference call, the
Bo→LiteLLM→Ollama edge should briefly animate (pulse or glow). Duration ~1s
or inference duration. Makes inference activity ambient-visible.

**Phase 1 / Phase 2 graceful upgrade:** Phase 1 uses polling (Bo heartbeat
JSON, Ollama /api/ps, LiteLLM /health). Phase 2 upgrades to fossic event
streams. Design should work on Phase 1 data and upgrade invisibly when
Phase 2 comes online.

**Bo's role:** Bo is a node in the topology, not a peer tile. Visually
subordinate to Ollama in weight. Gets a status dot (running/offline) and
last-heartbeat timestamp.

**Key open questions for frontend-design:**
- VRAM as gauge/fill bar vs. numeric % (observability-first → gauge)
- Idle Ollama state treatment (no models loaded)
- Edge animation transient vs. persistent call counter
- Diagnostic drill-down: click node → expands in place vs. opens drawer

---

### 9.5 Fossic (substrate tile)

**Observability balance:** balanced — health is ambient; causation is
investigative.

**Surface type:** substrate health visualization (not event-feed tile). No
domain events to display. Infrastructure health and optional topology.

**Four design options (enumerate; developer + frontend-design choose):**

**Option A — Enhanced status panel (minimal)**
Enhanced version of the current FOSSIC STORE panel in the header. Adds:
stream count, subscriber count, canary heartbeat age, degraded indicator.
Pure observability. No diagnostic depth. No pane required — stays in the
status panel row. Fossic-tauri additions: none (or minor).

*Choose when:* fossic's footprint should stay in the status row.

**Option B — Tabular stream dashboard (moderate)**
Fossic substrate tile in a pane. Table: one row per stream with stream path,
event count, last event type, time-since-last, subscriber count, health
indicator. Expandable subscriber rows under each stream. Sortable; degraded
subscribers rise to top. Density controls: "hide idle" toggle, prefix grouping.
Fossic-tauri additions: `fossic_list_subscribers()` command.

*Choose when:* scannable dashboard for health problems with minimal layout risk.

**Option C — Streams-as-flows structural visualization (structural)**
Streams rendered as horizontal flows on a time axis. Events as dots on the axis.
Subscribers as nodes hanging below their stream. Causation links as vertical
dashed edges across streams.

```
         [events as points on time axis → ]
stream A ●─────●───●──────────────────────●── → now
         └─ [sub: Lattica/cerebra-tile] 🟢
         └─ [sub: Cerebra/replay] 🟢

stream B ●──●────────────●────────────────── → now
         └─ [sub: Policy Scout/audit] 🟢

         ┆  causation link (↕ edge between events)
         ●─ ─ ─ ─ ─ ─ ─→●  (ActionProposed → CommandRequested)
```

Density LOD: Level 0 (sparse, individual dots) → Level 1 (activity bars) →
Level 2 (health-coded bars only, causation edges hidden, nodes become counts).
Fossic-tauri additions: `fossic_list_subscribers()` + optionally
`fossic_query_causation_edges(since_ms)`.

*Choose when:* the visualization should reflect what fossic structurally is —
familiar to event-sourcing practitioners; explanatory to newcomers.

**Option D — Full directed graph (elaborate)**
Force-directed graph: streams, subscribers, emitters as nodes; subscription,
emission, causation edges. Real-time edge animation. Node status rings.
Highest visual complexity risk; density is the primary failure mode.
Not recommended for Phase 1.

*Choose when:* specifically want the graph metaphor and prepared for layout-
tuning investment.

**Fossic's structural recommendation:** Option C reflects what fossic actually
is. Option A is the minimum fix. Option B is pragmatic. Option D is elaboration
for later.

**Fossic-specific live-tail note:** the fossic tile does NOT have a live tail
of events in the way Cerebra does. The ambient surface shows topology/health
(updates in place). Diagnostic opens as a detail panel on interaction. The
tile frame for the fossic substrate tile is structurally different from the
generalized event-feed tile.

---

## Appendix A — Glossary

| Term | Meaning |
|---|---|
| P-013 | Protocol for guest projects to contribute renderer files to Lattica's tree via the host Claude Code |
| payloadRendererRegistry | Internal registry mapping `(event_type, stream_path) → ReactComponent` |
| tileSectionRegistry | Registry of available tiles; each tile is parameterizable |
| stream_glob | A glob pattern matching one or more Fossic streams (e.g., `cerebra/agent-trace/*`) |
| live tail | The always-on observability surface in an event-feed tile; newest events at top, bounded depth |
| archive view | The on-demand diagnostic surface; full chronological history, grouping, filtering |
| per-step arc | Cerebra's PredictionMade + SignalEvaluated + OutcomeRecorded from the same step_id, treated as a unit |
| lighthouse project | Cerebra — its renderer redesign sets the visual vocabulary others follow |
| ADR-015 | `--portfolio-*` design token namespace is host-owned |
| ADR-017 | PayloadRendererProps = `{ payload: unknown; event_id: string }` — locked renderer props contract |

---

*PACKET-001 · compiled 2026-06-15 · Lattica Claude Code · v0.3.5x draft*
