# Backend Prep Investigation — LumaWeave

**Filed by:** lumaweave-claude
**Date:** 2026-06-15
**Source [API-NEW] items:** from control surface spec — Section 11 of
`docs/coordination/design/requests/lumaweave/design-request.md`
**Note:** Investigation is optional per Lattica's relay (LumaWeave
deferred to Option B read-only tile for v1). Filed for future planning —
this is not blocking iteration 4.

---

## Context: the reverse-channel problem

All five [API-NEW] items require Lattica to send commands TO LumaWeave.
This is the inverse of the current architecture: LumaWeave emits to
fossic, Lattica reads. A command channel runs the other direction.

Before per-item analysis, the channel options must be understood since
they govern cost for every item below.

### Option A — fossic bidirectional bus

LumaWeave declares a `lumaweave/tile/commands` stream in the shared
platform fossic store. Lattica appends command events (e.g.,
`{ event_type: "SwitchSource", payload: { adapter_id: "..." } }`).
LumaWeave polls this stream at a short interval (~200ms) and applies
commands by writing to its settings store or calling gwells control APIs.
LumaWeave confirms execution by emitting a response event back to
`lumaweave/graph/events`.

**Pros:**
- Decoupled: Lattica writes events, doesn't need to know LumaWeave's
  internals
- Auditable: command history lives in fossic alongside event history
- Architecturally consistent with the event-sourcing model
- Command + response pair is the natural fossic pattern

**Cons:**
- Polling latency (~200ms round-trip minimum) — noticeable for
  interactive controls like the source switcher
- LumaWeave needs a command-poll loop running alongside event emission
- Blocked on shared platform store (the Section 8 operational flag);
  cannot build until `~/.lattica/fossic/store.db` is the confirmed path

**Hard blocker:** fossic bidirectional bus requires the shared platform
store. LumaWeave currently writes to `<project_root>/.lumaweave/fossic.db`.
This cannot be built today.

### Option B — direct Tauri IPC (as "direct IPC" was intended in Section 11)

LumaWeave and Lattica are separate OS processes (both Tauri 2 apps).
"Direct IPC" in practice means one of:
- Tauri 2 `emit_all()` / `emit_to()` — works if Lattica manages LumaWeave
  as a Tauri sidecar (LumaWeave spawned as a child); not the current model
- Unix domain socket / named pipe — LumaWeave runs an IPC server;
  Lattica connects as a client
- Shared SQLite file (a lightweight fossic, effectively) — which
  collapses back into Option A with extra steps

Honest assessment: there is no "simpler" Option B. Every concrete
implementation either requires Lattica to manage LumaWeave's process
lifecycle (sidecar model, significant arch change) or introduces custom
socket code with all its auth/framing/error-handling overhead. Option B
is NOT simpler — it's more complex than Option A for less auditability.

**Recommendation:** Option A (fossic bus) is the correct architecture.
The only reason to avoid it is the shared-store blocker. When that blocker
resolves, build Option A. Do not invest in a custom socket server.

---

## Per-item analysis

### Item: Source switcher

- **What it does:** dropdown in tile chrome lets user swap LumaWeave's
  active data source without opening LumaWeave
- **Backend work required:** (1) Reverse channel (Option A: poll
  `lumaweave/tile/commands` stream for `SwitchSource` events). (2)
  Command handler that writes `settings.sources.active` via the settings
  store on LumaWeave's side — the source-load effect follows automatically
  since `useGraphSourceSummary` already reacts to `settings.sources.active`
  changes.
- **Touching:** `src-tauri/src/` (new command-poll mechanism or Tauri
  listener), `src/graph/ingest/useGraphSourceSummary.ts` (no changes
  needed — already reactive to store), `useSettingsStore` (write
  `sources.active`)
- **Cost estimate:** M — the command receipt loop is the work; source
  switch application is trivial (1 store write). If shared store is
  already in place, closer to S.
- **Dependencies:** shared platform fossic store (hard blocker). Source
  switcher also needs the tile to know which adapters are configured —
  currently an internal LumaWeave concern. Adapter list would need to be
  emitted to a fossic stream (new event type: `AdapterListChanged`) for
  Lattica to populate the dropdown.
- **Blockers:** shared store; adapter-list emission (undiscovered
  [API-NEW] — not in the original spec)
- **Could ship in one pass alone?** no — blocked on shared store
- **Notes:** the adapter-list dependency was not in the original
  control surface spec. The dropdown cannot be populated without LumaWeave
  emitting what adapters are available. This is a hidden [API-NEW] item
  worth flagging to Lattica.

### Item: Retry

- **What it does:** `↺ RETRY` button visible only on SourceLoadFailed —
  triggers a source reload in LumaWeave
- **Backend work required:** command handler for `RetryLoad` event.
  Application is a single `settings.sources.refreshToken` increment in
  the settings store, which already triggers `useGraphSourceSummary` to
  re-run.
- **Touching:** same command receipt infrastructure as source switcher;
  `useSettingsStore` (increment `sources.refreshToken`)
- **Cost estimate:** S — once the reverse channel exists, retry is a
  one-liner. No new Rust needed.
- **Dependencies:** same reverse channel as source switcher. Ships after
  source switcher infrastructure is in place.
- **Blockers:** shared store (same as source switcher)
- **Could ship in one pass alone?** partial — trivial implementation,
  but cannot function without the shared reverse channel
- **Notes:** the cheapest [API-NEW] item by a wide margin once the
  channel is built. Should bundle with source switcher in the same pass.

### Item: Layout freeze

- **What it does:** LIVE/FROZEN toggle pauses/resumes gwells physics
  engine from the tile
- **Backend work required:** (1) Reverse channel (same as above). (2)
  Tauri command `lw_set_layout_frozen(frozen: bool)` that calls gwells
  pause/resume. (3) LumaWeave emits a `LayoutFreezeChanged` event to
  fossic so the tile state pill stays in sync with actual gwells state.
- **Touching:** `src-tauri/src/events.rs` (new Tauri command +
  `LayoutFreezeChanged` emit), `src/physics/` (gwells control API — need
  to confirm pause/resume surface; gwells already has `GWRuntimeState`
  with `paused` and `running` variants)
- **Cost estimate:** S–M — gwells pause/resume exists (`GWRuntimeState`
  already tracks it); the Tauri command surface is small. Cost is in the
  channel, same as above.
- **Dependencies:** reverse channel; gwells control surface needs review
  to confirm the right API (gwells has `pause()` equivalent but the hook
  is internal to `src/physics/`)
- **Blockers:** shared store; gwells control API audit
- **Could ship in one pass alone?** no
- **Notes:** gwells has no "settled" GWRuntimeState variant in v0.1.5
  (noted in the GraphLayoutSettled deferral), but it does have `paused`
  and `running`. Freeze/thaw maps cleanly onto these. No gwells changes
  needed, only a new Tauri command that reaches the gwells control surface.

### Item: Re-settle

- **What it does:** `⟳ SETTLE` button re-triggers gwells physics
  convergence from current node positions (resets momentum, restarts
  simulation)
- **Backend work required:** Tauri command `lw_retrigger_settle()` →
  calls gwells reset equivalent (stop + restart from current positions).
  Emits a `LayoutResettled` event so the tile knows convergence restarted.
- **Touching:** `src-tauri/src/events.rs`, `src/physics/` (gwells
  reset/restart API — need to audit whether "restart from current
  positions" is a supported mode or requires seed-position preservation)
- **Cost estimate:** S once channel exists; however there is an unknown:
  gwells restart may reset node positions to seed values rather than
  preserving current positions. If it does, Re-settle would scatter the
  graph (opposite of intent). Needs gwells internals audit before
  committing.
- **Dependencies:** reverse channel; gwells restart behavior audit
- **Blockers:** shared store; gwells audit (this is an unknown risk)
- **Could ship in one pass alone?** no — gwells audit is a prerequisite
- **Notes:** **gwells audit recommended before building this.** If gwells
  restart resets positions to seed values, this item needs gwells-level
  work to preserve or restore positions, which elevates cost to M-L. Flag
  to Lattica as "cost uncertain pending gwells audit."

### Item: Physics preset write (ORGANIC / TIGHT / SPARSE)

- **What it does:** settings panel preset selector writes a gwells
  physics configuration from the tile
- **Backend work required:** (1) Define three named preset configs
  (spring constant, repulsion, damping, etc. for each of ORGANIC / TIGHT /
  SPARSE). (2) Reverse channel command `ApplyPhysicsPreset`. (3)
  LumaWeave applies the preset by writing gwells parameters to
  `useSettingsStore`. (4) Emit `PhysicsPresetChanged` to fossic.
- **Touching:** `src-tauri/src/events.rs`, `useSettingsStore` (new
  gwells preset settings keys), `src/physics/` (preset parameter
  definitions), `src/control-plane/settings/` (schema and migration for
  new preset field)
- **Cost estimate:** M — settings schema migration + three preset
  definitions + Tauri command. Not complex but touches more files than the
  other items. Also lowest priority: physics presets affect developer
  experience, not operational state.
- **Dependencies:** reverse channel; settings store schema migration
- **Blockers:** shared store
- **Could ship in one pass alone?** no
- **Notes:** Lowest priority of the five items. Consider deferring
  indefinitely — physics presets are already adjustable in LumaWeave
  proper, and the tile's `↗ OPEN` escape hatch covers this case. Only
  valuable if users frequently adjust physics from Lattica without opening
  LumaWeave (unclear if that's a real usage pattern).

---

## Cross-project dependencies

- All five items depend on **shared platform fossic store resolution
  (Lattica + fossic)** — this is the hard blocker for Option A
- Source switcher additionally depends on **adapter-list emission**
  (new LumaWeave fossic event type: `AdapterListChanged`) — not in the
  current spec; flagged as hidden [API-NEW]
- Re-settle depends on **gwells internals audit** before cost can be
  confirmed — independent of cross-project work

---

## Recommended ordering within LumaWeave

**First pass (after shared store resolves):**
- Reverse channel infrastructure (shared across all items — build once)
- Source switcher + Retry (bundle; retry is trivial once switcher works)
- Requires: adapter-list emission as prerequisite

**Second pass:**
- Layout freeze + Re-settle (bundle; share gwells control surface)
- Requires: gwells audit on Re-settle behavior before starting

**Later / reconsider:**
- Physics preset write — low usage value; `↗ OPEN` covers the case

---

## Notes for Lattica Claude

- **Hidden [API-NEW]:** source switcher requires LumaWeave to emit
  available adapter list to fossic (so Lattica can populate the dropdown).
  This wasn't in the original control surface spec. Adds a small
  prerequisite to source switcher.
- **Re-settle cost is uncertain:** gwells restart behavior with position
  preservation is unknown. Recommend flagging as "S if position-preserving,
  M-L if not" until gwells audit happens.
- **Physics preset write is indefinitely deferrable:** the `↗ OPEN`
  escape hatch covers the gap adequately. Only worth building if user
  testing shows frequent cross-app physics adjustment.
- **Option A vs B decision is clear:** Option A (fossic bus) when shared
  store lands. No custom socket server or sidecar architecture needed.
  The shared-store blocker is the single critical path item.
- **Iteration 4 impact: none.** LumaWeave's read-only tile needs no
  backend work. This investigation is purely forward-looking for iter 5+.
