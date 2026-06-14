---
unified-passage: UP-001
last_reviewed: 2026-06-14
---

# UP-001 — Per-Project Assignments

Three projects participate in UP-001: fossic (verify-only), Cerebra (substantive work),
Lattica (substantive work). Each project's section below specifies their work scope,
what they provide for the passage, what they depend on, their pre-flight checks, and
their failure modes that ROLLBACK.md handles.

Each project Claude reviews their own section in REVIEW phase and ACKs by filing
`acknowledgments/<project>.md`, or pushes back with proposed changes.

---

## fossic

**Scope:** Pre-flight verification only. Confirm the fossic-tauri subscription
pipeline correctly serves `cerebra/agent-trace/*` stream events from the platform
store at `~/.lattica/fossic/store.db`. No new code expected. If verification
surfaces a gap, fossic ships a fix as a separate small pass before Cerebra begins.

**Provides:**
- Confirmation that `fossic_subscribe("cerebra/agent-trace/*")` returns the
  expected event stream when Cerebra cycles are emitting
- Confirmation that subscription event delivery latency is acceptable (no specific
  threshold; observable behavior)
- Confirmation that `walk_causation` works correctly across cycle event chains
  (informational; not strictly required for UP-001 but useful to verify while
  pre-flight is running)

**Unblocks:** Cerebra and Lattica both proceed once fossic pre-flight passes.

**Depends-on-execution:** Nothing. First step in the chain.

**Invariants at end of execution:**

1. Subscription via fossic-tauri's `fossic_subscribe` returns events under
   `cerebra/agent-trace/*` glob when invoked from Lattica's frontend
2. Subscription event delivery is observable end-to-end (events appear in the
   subscriber's queue when Cerebra emits)
3. Platform store at `~/.lattica/fossic/store.db` is healthy (WAL mode, no
   corruption signals)

**Failure modes:**

- **Subscription returns empty when events exist** → investigate fossic-tauri
  glob matching; likely small fix. See ROLLBACK section A.
- **Subscription crashes the Tauri backend** → investigate threading or panic
  in fossic-tauri command. See ROLLBACK section A.
- **Platform store missing or corrupted** → restore from latest backup if available;
  if not, accept the loss and recreate. See ROLLBACK section B.

**Pre-flight checks:**

- [ ] `~/.lattica/fossic/store.db` exists, file size > 0
- [ ] Running `lattica_store_status` Tauri command returns valid output
- [ ] Manually invoking `fossic_subscribe("cerebra/agent-trace/*")` from a test
      harness (or via Lattica's HelloTile if extended) returns subscription handle
      without error
- [ ] If Cerebra has previously emitted events to the platform store, they're
      queryable via `fossic_read_range("cerebra/agent-trace/*", None)`

**Pass version:** No version change expected. If a fix is needed, fossic determines
appropriate version per its own discipline (descending-letter cleanup or small
forward bump depending on the fix).

**Cross-pollination:** If fossic ships a fix during UP-001, file a cross-pollination
under `<fossic-repo>/docs/aseptic/cross-pollination/` and mirror to
`~/Projects/lattica/docs/coordination/cross-pollination/fossic/`. Notify Lattica
and Cerebra via the standard relay mechanism.

---

## Cerebra

**Scope:** Two parallel sub-tasks within Cerebra's pass:

(a) **Renderer component:** Ship a React component that renders `SignalEvaluated`
event payloads. Register it against `payloadRendererRegistry` with
`project: "cerebra"`, `event_type: "SignalEvaluated"`. The component's location and
naming follow Cerebra's existing frontend code organization (Cerebra Claude determines).

(b) **Event emission:** Ensure Cerebra cognitive cycles emit `SignalEvaluated`
events to the platform fossic store at `~/.lattica/fossic/store.db` (NOT
per-vault store) on the stream key `cerebra/agent-trace/<session_id>` (per the
2026-06-14 stream-key correction; NOT `<cycle_id>` — the prior round-3 doc had
this wrong). At least one cycle must complete and emit during pre-flight; the
events must be readable from the platform store.

**Provides:**
- A working `SignalEvaluated` React renderer component registered against
  `payloadRendererRegistry`
- Cerebra cycles emitting to the platform store, observable via fossic-tauri
  subscription
- A structural marker in the rendered output (data attribute, class name, or
  component tree shape) that lets Lattica's POST_FLIGHT verify the render came
  from Cerebra's component, not the fallback

**Unblocks:** Lattica's tile work — Lattica's execute depends on Cerebra's renderer
existing in the registry AND events being emittable for the smoke test.

**Depends-on-execution:** fossic pre-flight passes.

**Invariants at end of execution:**

1. `payloadRendererRegistry` contains a registered entry for
   `{ project: "cerebra", event_type: "SignalEvaluated" }` with a defined React
   component
2. The renderer component accepts `PayloadRendererProps` (locked shape per
   2026-06-14 cerebra/lumaweave alignment: `{ payload: unknown, event_id: string }`
   — no `event_type`, `stream_path`, or `timestamp` in props; all context derives
   from `payload`)
3. The renderer renders without throwing on a valid `SignalEvaluated` payload
4. Cerebra cycles emit `SignalEvaluated` events to the platform store on stream
   `cerebra/agent-trace/<session_id>`; at least one such event exists in the store
   at end of Cerebra's execute phase
5. The rendered output contains the agreed-upon structural marker for render-path
   verification (Cerebra Claude proposes specific marker in ACK; e.g.,
   `data-cerebra-renderer="SignalEvaluated"`)

**Failure modes:**

- **Renderer component compile fails** → fix locally before commit; no rollback
- **Renderer throws on valid payload** → fix; if can't fix in pass scope, roll back
  Cerebra's commit (ROLLBACK section C) and surface for follow-up
- **Cycles don't emit to platform store** → investigate store path resolution or
  permissions in Cerebra's emit code; may require small Cerebra-side fix
  (ROLLBACK section D)
- **Cycles emit but to wrong store** (e.g., per-vault instead of platform) → small
  fix to redirect emission; revert previous wrong-store emission isn't necessary
  (events become orphaned but harmless)

**Pre-flight checks:**

- [ ] Cerebra's frontend codebase compiles; renderer component type-checks
- [ ] Manually invoking a Cerebra cycle to completion succeeds
- [ ] At least one `SignalEvaluated` event lands in
      `~/.lattica/fossic/store.db` under `cerebra/agent-trace/<cycle_id>` stream
- [ ] `payloadRendererRegistry` registration call doesn't throw at module-load time
- [ ] The renderer's structural marker is verifiable via DOM inspection of a test
      render (Cerebra Claude provides test harness or verification path)

**Pass version:** Cerebra Claude determines per Cerebra's existing version discipline.
Likely a forward version (the work delivers user-noticeable behavior — a rendered
event in Lattica's UI). Could be e.g. `cerebra/v0.5.0` or whatever Cerebra's next
forward increment is.

**Cross-pollination:** Standard cross-pollination cycle. File in Cerebra's own repo
under `docs/aseptic/cross-pollination/pass-X.Y.md`; mirror to
`~/Projects/lattica/docs/coordination/cross-pollination/cerebra/`. The mirror is
essential — it's how Lattica and fossic learn the renderer is shipped.

---

## Lattica

**Scope:** Wire the cerebra signal tile into Lattica's main shell. Subscribe to
`cerebra/agent-trace/*` via fossic-tauri's `fossic_subscribe` command (the wildcard
matches the `<session_id>` segment per the corrected stream-key form). Route
incoming event payloads through `payloadRendererRegistry` lookup (matching by
`{ project, event_type }`). Render the returned component inside the tile.

The tile design is intentionally minimal for UP-001 — a single tile slot, the most
recent received event renders. Multi-event lists, sorting, filtering, etc. are
post-UP-001 work.

**Provides:**
- A registered cerebra signal tile in `tileSectionRegistry`
- An active subscription to `cerebra/agent-trace/*` running when the tile is mounted
- Event-to-renderer routing through `payloadRendererRegistry`
- User-observable rendering in the Lattica UI

**Unblocks:** Nothing within UP-001. (UP-002+ likely builds on this — multi-event
timelines, cross-project correlation, etc. But UP-001 closes when Lattica's tile
works.)

**Depends-on-execution:** fossic pre-flight passes AND Cerebra's execute phase
completes (renderer registered, events emitting).

**Invariants at end of execution:**

1. A new tile entry in `tileSectionRegistry` with
   `id: "lattica.cerebra-signal"` (or similar — Lattica Claude finalizes naming),
   `kind: "component"`, and the tile component reference
2. The tile component subscribes to `cerebra/agent-trace/*` on mount and
   unsubscribes on unmount
3. Incoming events are looked up in `payloadRendererRegistry` by their
   `{ project: "cerebra", event_type: "SignalEvaluated" }` shape
4. The looked-up renderer component renders inside the tile's content area
5. The render path is verifiable as Cerebra's renderer (via the agreed structural
   marker), not the fallback JSON pretty-print
6. End-to-end render latency from event emission to UI appearance is observable
   (informational logging — actual values recorded in POST_FLIGHT)

**Failure modes:**

- **Subscription doesn't return events** → likely fossic-tauri command issue
  (covered by fossic pre-flight); if surfaces during execute, surface to fossic
  and roll back Lattica's pass (ROLLBACK section E)
- **Registry lookup fails** → check that Cerebra's renderer registration ran before
  Lattica's subscription opened; may be timing / module-load order. Fix in
  Lattica's pass (ROLLBACK section F if can't fix in scope)
- **Renderer invoked but throws** → Cerebra-side issue; surface to Cerebra Claude;
  Lattica rolls back to avoid shipping broken state
- **Renderer renders but with fallback path** (no Cerebra structural marker) →
  registry lookup miss; investigate why the lookup didn't match Cerebra's
  registration. May be naming mismatch (`SignalEvaluated` vs `signal_evaluated`,
  etc.)

**Pre-flight checks:**

- [ ] `npm run tauri dev` launches Lattica without errors
- [ ] HelloTile still renders (regression check — v0.2.0 baseline preserved)
- [ ] After Cerebra's execute phase, `payloadRendererRegistry` contains the
      Cerebra entry (verifiable via a brief debug log on Lattica startup or via
      a test harness)
- [ ] `fossic_subscribe("cerebra/agent-trace/*")` returns a valid subscription
      handle when invoked manually

**Pass version:** `v0.3.0` — first forward version since v0.2.0 (Tauri scaffold).
The work is user-observable: cerebra events render in the UI. Forward versioning
applies.

Two commits per the canonical two-commit pattern. Discord channel discipline per
v0.2.1z's pattern: START → work → merge gate with PASS COMPLETE draft → push
approval → push → PASS COMPLETE file saved (Blog Bumper picks up) → END.

**Cross-pollination:** Lattica's own cross-pollination file at
`docs/aseptic/cross-pollination/pass-0.3.0.md`, mirrored to
`docs/coordination/cross-pollination/lattica/` (note: Lattica's "own" mirror
in its own coordination directory — this is the pattern when Lattica is the
producing project).

---

## Cross-project notes

**Naming canonical-form:** Cerebra's event type is `SignalEvaluated` (flat PascalCase,
no namespacing, no underscores) per the 2026-06-14 cerebra/lumaweave alignment.
The registry key uses this exact string. If any project's code references it as
`signal_evaluated` or `Signal_Evaluated` or `cerebra/SignalEvaluated`, that's a
bug — surface and fix before execute. The string flows from Cerebra's emit code
through fossic's stream → Lattica's subscription → registry lookup; case mismatch
breaks the lookup silently.

**Stream key canonical-form:** Cerebra emits to `cerebra/agent-trace/<session_id>`
(NOT `<cycle_id>`). The 2026-06-14 stream-key correction propagated through all
affected docs (`lattica_round3.md`, `cerebra_round2a.md`, `fossic_round2.md`).
UP-001 inherits the corrected form.

**Structural marker for render verification:** Cerebra Claude proposes the marker
shape in their ACK. Suggestion: `data-cerebra-renderer="SignalEvaluated"` attribute
on the renderer's root element. Lattica's POST_FLIGHT smoke test asserts this
attribute is present on the rendered DOM. If Cerebra prefers a different marker
(e.g., a class name, a wrapper component), substitute in ACK.

**Render latency observation:** Lattica logs `console.info("UP-001 event rendered",
{ event_id, emit_ts, render_ts, latency_ms })` on each event render during the
smoke test window. POST_FLIGHT.md captures the values. No threshold required for
UP-001 success.

**Platform store path:** All three projects reference `~/.lattica/fossic/store.db`
per ADR-012 / ADR-014. If any project is still pointing at a per-vault store
(Cerebra's historical pattern), that's a bug — flag in pre-flight.

---

*This is UP-001 ASSIGNMENTS.md. Each project ACKs by filing
`acknowledgments/<project>.md` in REVIEW phase. Pushback uses the same file with
`status: pushback` and proposed changes.*
