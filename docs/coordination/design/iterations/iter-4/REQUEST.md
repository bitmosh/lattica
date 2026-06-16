# Iteration 4 — control surface, polish, and pattern locking

Iteration 3 landed close to ship-ready. Fossic substrate hybrid (horizontal 
flow lanes with center-beam lattica node) works. Per-tile picker + inline 
dropdown clean separation from global ⌘K. Cerebra archive view with arc 
grouping operational. FROZEN/THAW state across Cerebra and Policy Scout 
panes with hatch-overlay treatment. 6-lane top-bar activity scope refined 
with project labels.

Iteration 4 is mostly **control surface additions** that emerged from each 
project Claude's persistent-control-surface specification + a small number 
of polish items + one architectural confirmation.

---

## §0 — Architectural confirmations (apply across all tiles)

These are decisions made between iterations 3 and 4. Iteration 4 reflects 
them as built-in assumptions, not new asks:

### Read-only tile pattern (Option B)

**Tiles are observability surfaces, not control planes.** Each project's 
tile shows state, accepts client-side filter chips, and provides escape 
hatches to deeper tools — but does NOT issue commands back to project 
backends in iteration 4.

The action escape hatch convention: a small `↗ OPEN [project]` affordance 
in the tile header that opens the project's own application/window where 
configuration, control, and deeper interaction live.

This applies to:
- LumaWeave (escape via `↗ OPEN LumaWeave`)
- Policy Scout (no application yet; CLI escape: `↗ POLICY SCOUT CLI`)
- ai-stack/Bo (escape via `↗ OPEN [terminal/dashboard]`)
- Cerebra (escape via `↗ CEREBRA CLI`)

The `↗ OPEN` button is small (chrome-level, not feed-level), always 
visible in tile header alongside the live/archive toggle and FROZEN state.

### Per-tile control real-estate budget

Each tile gets a **fixed-height chrome row** (~36-44px) holding state pills, 
counts, filter chips, and the `↗ OPEN` escape. Below that: optional 
collapsible settings panel (defaults collapsed, ~40px collapsed / 
~100-180px when expanded). Below that: the actual tile content surface.

Iteration 4 should show the chrome row populated for each project tile. 
The collapsible panel is OUT OF SCOPE for iteration 4 (defer to iter 5+).

---

## §1 — Lattica top bar additions

Three new platform-level chrome elements in the top bar:

### Event flow badge
- Type: badge
- Always visible: yes
- Renders: `↯ 24/min` when events flowing across any stream; `QUIET` when 
  all streams idle in last 60s
- Position: top bar, near 6-lane activity scope (consider integrating with 
  it visually)
- Purpose: tells the user if anything is happening platform-wide; goes to 
  QUIET when all agents idle

### Active sessions badge
- Type: badge
- Visible: on-event (hidden or `—` when no sessions open)
- Renders: `◉ 2 ACTIVE` when ≥1 session open across all projects; absent 
  when no sessions
- Position: top bar, near event flow badge
- Purpose: aggregates session count across Cerebra and other session-aware 
  emitters

### Motion mute toggle + tick button (paired affordance)

This is two elements that work together:

**Motion toggle:**
- Type: toggle pill
- Always visible: yes
- States: `MOTION · ON` (default) / `MOTION · STILL`
- When STILL: all ambient animations pause — pane breathing, causation 
  link pulse, edge animations, history rail glow. Data still arrives 
  silently; visual updates suppress.
- When ON: normal animations resume.

**Tick button:**
- Type: button (one-shot)
- Always visible: when MOTION is STILL
- Label: `TICK` or single icon (claude-design's choice — small, 
  unambiguous)
- Behavior: forces one animation cycle so visual state catches up to 
  current data state. Returns to STILL after the tick.

The pair: motion mute is for users who find ambient motion distracting; 
tick lets them deliberately refresh visual state without committing to 
continuous animation.

Position: top bar, right side near platform-pulse pill.

**Discipline:** motion mute does NOT freeze data — it's strictly about 
ambient animation suppression. Per-tile FROZEN state is a separate concept 
(actually pauses data flow for that tile). Don't conflate.

---

## §2 — Per-tile state pills (observability, no backend dependency)

Each project tile gets a state pill in its chrome row. These read state 
that's already derivable from the event stream — no [API-NEW] required.

### Cerebra: Agent state pill
- States: `RUNNING` (neon-green) / `IDLE` (dim) / `ERROR` (neon-red) / 
  `HOLD` (amber)
- Derives from: `SessionOpened → CycleStarted → CycleCompleted` chain
- Idle state: `IDLE` in text-secondary, no pulse
- Note: HOLD state is [API-NEW] (Cerebra posture work); render the pill 
  state vocabulary as defined but show RUNNING/IDLE/ERROR in iteration 4

### Cerebra: Step counter
- Renders: `step 3 · cycle 7` during active cycle; slot empty when IDLE
- Position: in chrome row next to agent state pill
- Visible: on-event only (hidden when IDLE)

### LumaWeave: Graph health pill
- States: `LOADED` (green) / `FAILED` (red, bold) / `LOADING` (amber 
  pulse) / `IDLE` (gray)
- Click: scroll feed to most recent SourceLoad event
- Idle state: `LOADED` or `IDLE`

### LumaWeave: Node/edge count badge
- Renders: `145n · 312e` from last `SourceLoaded` event payload
- Resets to `— · —` on `FAILED` or `IDLE` state
- Position: next to graph health pill

### LumaWeave: Active source label
- Renders: adapter display name or `source_key` basename
- Shows `no source` when IDLE
- Position: next to node/edge count badge

### Policy Scout: 4-state posture pill (REPLACES iteration 3's WATCH pill)

**This is a correction from iteration 3** — Policy Scout's codebase uses 
a 4-state posture model, not the single-state `WATCH | soft block on 
anomalies` shown in the iteration 3 prototype. Iteration 4 replaces 
outright:

| State | Visual | Trigger |
|-------|--------|---------|
| ACTIVE | green neon | watch running + no lockdown |
| LOCKDOWN | red neon | lockdown on |
| WATCH-DOWN | amber | watch daemon stopped (clean) |
| STALE | amber blink | watch crashed (stale PID file) |

Click on posture pill: opens posture action menu (action buttons live 
there; chrome row stays clean)

Idle state: ACTIVE in green

### ai-stack: STACK aggregate pill
- States: `HEALTHY` / `DEGRADED` / `DOWN`
- Aggregates all node states
- Colors: neon-green / amber / red

### ai-stack: BOT pill
- Renders: `BOT LIVE · 23s` when heartbeat fresh; `BOT OFFLINE · 4m` 
  when stale
- Derives from: heartbeat JSON polling
- Stays active independently of Ollama state — Bo alive + Ollama idle is 
  a valid normal state

### ai-stack: MODELS badge
- Renders: `2 loaded` (neon-green) when models in VRAM; `IDLE` (amber) 
  when none loaded
- Derives from: Ollama `/api/ps`

### Fossic substrate tile: STORE health pill
- States: `STORE` cyan (writable) / `✕ STORE` red (unreachable)
- No click action (read-only)
- Idle state: cyan

---

## §3 — Per-tile filter chips (client-side, no backend)

Filter chips render in tile chrome row, dim when inactive, accent-colored 
when active. All client-side.

### Fossic substrate filters
- **SYS chip** — toggle; off = hide system streams (`_`-prefixed); default off
- **HIDE IDLE chip** — toggle; collapses streams with zero events in time window
- **DEGRADED ONLY chip** — toggle; shows only streams with degraded subscribers
- **Stream prefix chips** — auto-populated chips per detected prefix 
  (`CEREBRA`, `POLICY-SCOUT`, `LATTICA`, `+ ALL`); click filters to that prefix

### Cerebra filters
- **Action filter** — pill group `ALL / ✓ / ↩ / ✗`; filters 
  `ClutchDecisionMade` to accept/refine/stop respectively
- **Severity filter** — pill cycle `ALL → notable+ → severe`; activates 
  amber when notable/severe events exist in session

### Policy Scout filters
- **Risk filter chips** — `LOW · MED · HIGH · CRIT` four-chip row; click 
  to show/hide that risk band in live tail
- **Actor filter chips** — auto-populated per actor seen (`cerebra · 
  human · mcp-server`); visible only when >1 distinct actor; click 
  isolates that actor's audit trail

### LumaWeave filters
- **Event type filter** — three-toggle group `[SRC] [LAYOUT] [THEME]`; 
  SRC on by default; LAYOUT + THEME off by default

### ai-stack filters
- **DORMANT toggle** — `SHOW DORMANT · ON/OFF`; off hides grayed edges 
  (unused routes like bot-escalated)
- **VIEW toggle** — `TOPO · LIST`; switches between node-graph and 
  compact vertical service list

---

## §4 — Policy Scout streaming rate slider

- Type: slider, 50ms - 2000ms
- Snaps to: 50 / 100 / 200 / 500 / 1000 / 2000
- Current value displayed in Geist Mono at slider's right
- Visible: on hover (the chrome row shows a thin indicator; expands to 
  full slider on hover)
- Client-side only; controls how often Policy Scout's audit feed 
  re-renders. No backend change.

---

## §5 — Fossic substrate footer: legend + summary surface

Below the streams-as-flows surface, the tile gets an additional padded 
footer area (same padding amount as between existing stream rows). This 
footer serves dual purpose:

### Color/event legend
- Lists each event color used in the visualization with its meaning
- Examples:
  - `● cyan event dot — recent fossic event`
  - `● amber subscriber — degraded delivery state`
  - `● red — unreachable / error`
  - `─ horizontal flow line — stream`
  - `▪ chip cluster — subscriber attached to stream`
- Should be unobtrusive (small type, secondary text color) but readable 
  without zooming

### Summary statistics
- Total event count per stream type in the visible time window
- Severe-miss count (if applicable)
- Degraded subscriber count (if any)
- Last-event timestamp per stream (compact format)

The footer is **part of the tile chrome**, not the data surface. It's 
always visible (not behind a toggle). It scales with tile width.

**Discipline:** legend and summary occupy the same footer band but are 
visually distinct. Legend on the left (color key); summary on the right 
(numeric stats). Both align horizontally so the footer reads as one strip.

---

## §6 — Idle/standby tile treatments

Each project Claude specified what their tile looks like idle. Iteration 4 
should render these distinct from "running" states so users can tell 
"system up, nothing happening" from "system has events to show."

### Cerebra idle
- Agent state pill: `IDLE` (dim, text-secondary)
- Session badge: last session ID or `—`
- Step counter: hidden (empty slot)
- Live tail: shows last few events with greatly reduced visual emphasis, 
  or empty state with "no recent activity" placeholder

### LumaWeave idle
- Graph health pill: `IDLE` (gray)
- Node/edge count: `— · —`
- Active source label: `no source`
- Live tail: empty state placeholder; source picker dropdown is the CTA

### Policy Scout idle
- Posture pill: `ACTIVE` (green) — confirms system enforcing
- Decision rate: `Ø` (not a problem; confirms idle)
- Risk chips: all active (no filtering)
- Actor filter: hidden
- Live tail: single faded "last decision" entry with timestamp 
  (`14:03:22 · ALLOW (low) · ls -la /tmp`)
- No pending approvals badge
- LOCK DOWN button (deferred to iter 5) — not pulsing or colored, just 
  present at normal weight

### Fossic idle
- STORE pill: cyan (writable)
- Stream/sub counts: `0 STREAMS · 0 SUBS`
- Event rate: `—`
- Filter chips all visible but unfiltered
- Prefix strip: shows `ALL` only (no project chips populated yet)
- Flow area: "No active streams · waiting for emitters" centered

### ai-stack idle
- STACK pill: `HEALTHY`
- VRAM gauge: near-empty with `IDLE` badge (amber)
- BOT pill: stays `BOT LIVE · 23s` (Bo alive + Ollama idle is normal)
- MODELS badge: `IDLE` (amber)
- Topology edges at minimum weight
- INFERENCE indicator: dim

**Discipline:** the platform should feel alive at idle. Substrate health 
visible, canary pulsing, posture green — all valid "nothing to do right 
now" indicators. Idle is not broken.

---

## §7 — Verification from iteration 3

Confirm these landed (visible during iteration 4 review):

1. **Pane accent stripe breathing** — the accent stripe (left edge of 
   tile, header height) breathes when source is actively emitting. Subtle, 
   not decorative. Confirmed present per developer in current prototype.
2. **Ambient ~5s pulse on cross-pane causation link anchors** — the small 
   `↑ cerebra:step_14` indicator in Policy Scout approval card pulses 
   softly once every ~5s. Verify presence in iteration 4 prototype.
3. **Cross-pane causation arc on hover** — hovering a causation link 
   indicator draws an arc connecting the two related events across panes. 
   Verify presence.
4. **6-lane top-bar activity scope with project labels** — confirmed in 
   iteration 3. Keep as-is.

If any of these are absent from iteration 4 prototype, surface during 
review.

---

## §8 — Explicit out of scope for iteration 4

- Any [API-NEW] control (LOCK DOWN button, new cycle trigger, checkpoint 
  button, source switcher, model load/unload, etc.) — render dimmed or 
  hidden; functional implementations defer to iter 5+ after backend prep 
  investigation
- Collapsible settings panels (each project specified one; defer to 
  iter 5+)
- Layout management UI (split/close/save layout, preset selector)
- Theme/density menu
- Debug mode toggle and per-tile inspector
- Subscription manager (Fossic collapsible)
- ai-stack inference log panel
- Tile-level FROZEN state changes (iteration 3 has it; keep as-is, no 
  additions)

---

## §9 — Iteration workflow

1. Developer takes this REQUEST.md into claude-design session
2. Live review during session — minor tweaks, refinements as needed
3. Iteration 4 prototype produced (HTML mockup or interactive prototype)
4. Developer evaluates; iterates within claude-design if needed
5. When iteration 4 settles: extraction pass begins (design tokens + 
   components into Lattica repo)

In parallel: project Claudes work on backend-prep investigations (see 
separate relay). When investigations land, Lattica Claude Code compiles 
into BACKEND_PREP_REPORT.md. Iteration 5 scope draws from compiled report 
intersected with developer priorities.
