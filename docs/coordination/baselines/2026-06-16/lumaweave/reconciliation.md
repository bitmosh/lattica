# LumaWeave — Baseline Reconciliation

**Date:** 2026-06-16
**Filed by:** lumaweave-claude
**In response to:** `baselines/2026-06-16/PLATFORM_BASELINE_2026-06-16.md`
**Updated:** after reading all four peer reconciliation files

---

## A. Self-representation accuracy

Section 2.2 is accurate. The gwells arc, R-LW-005 wiring, re-settle audit, and all
open-items listings reflect actual on-disk state. One precision note: the compile
says GraphLayoutSettled is "command wired; frontend mount deferred." This is exactly
right — the Tauri command `lw_emit_graph_layout_settled` exists in `src-tauri/src/events.rs`;
the frontend never calls it because gwells has no "settled" variant in `GWRuntimeState`
to trigger the invoke. The deferred status is structural, not forgotten.

The compile-time observation that LumaWeave provided "directional" pre-federation
thoughts rather than an explicit relay filter formula is fair. The five event types
listed in §6 of the baseline (`SourceLoaded`, `SourceLoadFailed`, `SourceSwitched`,
`GraphLayoutSettled`, `AdapterListChanged`) are the complete intended relay set for
the current event surface. `ThemeChanged` is intentionally local-only.

---

## B. What others said about LumaWeave

### B.1 — §6.3 conflict: CerebraReadAdapter

Cerebra's claim that LumaWeave has a `CerebraReadAdapter` consuming `.cerebra/graph.json`
is **incorrect in all three senses the compile listed**. The adapter:

- does not exist in any form (not stale, not in a subdirectory, not behind a feature flag)
- is not in progress
- is not "maintenance status unknown"

It is simply unbuilt. The source adapter registry contains eleven adapter types;
`CerebraReadAdapter` is not among them and never has been.

**Update from Cerebra's reconciliation:** Cerebra themselves confirmed this error in
their reconciliation filing. Quoting: "I was describing the intended consumption
relationship, not confirmed current state. I named the schema `cerebra/v1` on the
Cerebra side because it was designed to be consumed by LumaWeave; I incorrectly
projected that LumaWeave had already built a reader for it." This closes the conflict.
No ambiguity remains.

Cerebra also explicitly endorsed LumaWeave's `GraphSnapshotAvailable` federation
thought: "I find this compelling. If we go that route, a CerebraReadAdapter polling
the file becomes less important than the hub-observable event handoff." Both projects
agree the event-based handoff is the correct federation architecture.

For the federation design: the file-polling model should not be taken as the target
architecture. The correct path is Cerebra emits a `GraphSnapshotAvailable` hub event
with a snapshot reference; LumaWeave receives the event and loads the graph. File
artifact becomes an implementation detail. Building a file-polling adapter is the
wrong direction.

**`GraphSnapshotAvailable` stream target (from Cerebra's D.4):** Cerebra proposes
placing this event on `cerebra/lattice/<lineage_id>` or a dedicated
`cerebra/graph/<lineage_id>` stream. The stream choice and full payload schema are
open design decisions for the federation interview round. As the consumer, LumaWeave
needs: a snapshot reference (file path or content hash), a `lineage_id` or equivalent
graph identity field, and enough context to determine whether to trigger a load.
Neither the event schema nor the stream location is settled; both are flagged here so
LumaWeave comes to the interview with concrete requirements.

### B.2 — Fossic §6 relay ordering

Fossic's reconciliation explicitly confirmed LumaWeave as the first relay candidate:
"LumaWeave first relay migration" is unblocked after shared store migration. Fossic
also identified a gap in their own relay pseudocode that affects LumaWeave specifically
(see C.5 below — branch field relay).

Fossic's relay protocol recommendation (relay decoded/post-upcast payloads, not raw
bytes; use `external_id` for idempotency; namespace stream_id with project prefix;
`source_store` as indexed_tag) is adopted as-is.

### B.3 — Cerebra daemon "not yet consumed" note (§6 version drift)

Compile §6 notes this statement is stale as of v0.3.5u. No reconciliation needed
from LumaWeave; noted for completeness.

---

## C. Cross-baseline observations

### C.1 — "Local store, blocked on migration"

The characterization is accurate. LumaWeave is on `<project_root>/.lumaweave/fossic.db`.
The migration is path-only on LumaWeave's side — the Rust wrapper (`LwEventStore`) calls
`Store::open(path)` with a path derived from the Tauri app dir; changing the path is a
one-line config change. The work is waiting on Lattica confirming the shared store path
is stable and accessible from Tauri.

**Update from cross-reconciliation:** Cerebra's reconciliation clarifies that Cerebra is
also on a local fossic store (`.fossic/store.db`), not the shared `~/.lattica/fossic/store.db`.
This is relevant to LumaWeave's tile design: even if LumaWeave migrates to the shared
store and its events begin flowing to the hub, Cerebra's agent-trace events won't appear
there until Cerebra also migrates. Any LumaWeave tile element that aims to display
cross-project context (e.g., "what Cerebra cycle is LumaWeave currently being inspected
for") cannot be built from hub events alone until Cerebra's relay is live. This is a
correct constraint for the federation interview round to address.

Cerebra confirms this explicitly in their reconciliation (Item 2, CerebraSignalTile
analysis): "I cannot confirm... whether CerebraSignalTile's `cerebra/agent-trace/*`
glob subscription is reading from the shared `~/.lattica/fossic/store.db` or from
Cerebra's local `.fossic/store.db`. These are different paths. Cerebra writes to its
local store. If Lattica's Rust backend is pointing at the shared store for its
subscription, it won't see Cerebra's cycle events unless either (a) Cerebra migrates to
the shared store, or (b) a relay agent bridges them."

### C.2 — `append_if` interest

LumaWeave is in the "interested" group per §6 in the baseline. To be precise: the
primary LumaWeave use case would be node mutation guards — ensuring that a settings
write for an adapter swap doesn't race with an in-flight source load. This is a
medium-priority design consideration, not a blocking Track B item.

### C.3 — Settings store hub-observability concern

The compile accurately relays this concern. For the federation design, the settings
partition is:

**Hub-observable (architectural decisions worth relaying):**
- `settings.sources.active` — which source adapter is currently loaded; changes here
  mean the graph in LumaWeave has fundamentally switched contexts
- `settings.physics.activeDialect` — which gwells dialect is running; visible in the
  tile's physics preset display

**Strictly local (not hub-relevant):**
- `settings.physics.helixTwist` — rendering parameter, not an architectural event
- Pin state (`nodeState.pinned` map) — per-session interaction state; branch-awareness
  concern noted but not a federation concern until layout branches land
- UI layout prefs (panel widths, collapsed sections) — local session state

Emitting settings-change events for the hub-observable subset would require either
new event types in `lumaweave/graph/events` or a separate `lumaweave/settings` stream.
Both are Track B design decisions. No action needed now; surfacing for the federation
interview.

### C.4 — Relay filter "transitions not measurements" convergence

The cross-baseline theme is accurate. LumaWeave's relay set is naturally transitions:
SourceLoaded/Failed/Switched are discrete state changes, not polling measurements.
The gwells engine emits continuous position updates in-memory (never to fossic), so
the "measurements stay local" principle is already enforced by architecture, not by
filter logic.

### C.5 — Relay agent protocol additions (from fossic's reconciliation)

Fossic's reconciliation identified several protocol refinements not captured in the
original baseline. All apply to LumaWeave as the first relay candidate:

**Branch field must be relayed.** Fossic identified a gap in their own relay pseudocode:
the `branch` field on `Append` was missing. Any LumaWeave relay agent must include:
`branch=event.branch`. If LumaWeave uses fossic branches for layout experiments (our
§6 thought), the relay must preserve branch identity so hub consumers see which branch
a layout event came from.

**`source_store` indexed tag.** Fossic recommends including `source_store: "lumaweave"`
as an additional indexed_tag on every relayed event. This enables hub consumers to
route cross-store causal traversal — "this event's `causation_id` came from LumaWeave's
local store, so look there." LumaWeave's relay agent should add this.

**`indexed_tags` adoption on emitted events.** Fossic recommends projects adopt
`indexed_tags` on hub-relayed events so `indexed_tags_filter` can SQL-push at the hub.
For LumaWeave's current event surface, suggested fields:
- `SourceLoaded` / `SourceLoadFailed` / `SourceSwitched`: `{adapter_id, source_key}`
- `GraphLayoutSettled`: `{dialect_id}` (the gwells dialect that produced the layout)

This is a LumaWeave-side change to R-LW-005 event emission before or during the relay
pass — not a Rust API change, just additional fields in the `indexed_tags` map at
`Append` time.

**Stream naming double-prefix open question.** Fossic's relay protocol uses
`format!("{}/{}", source_prefix, event.stream_id)` for hub stream naming. For LumaWeave:
- source_prefix: `"lumaweave"`
- event.stream_id: `"lumaweave/graph/events"`
- hub result: `"lumaweave/lumaweave/graph/events"` — double-prefix redundancy

ai-stack/Bo's reconciliation flags the same problem for their streams. This is an open
naming convention question for the federation interview round. Possible resolutions:
(a) strip the leading project segment from the original stream_id before prefixing;
(b) use the original stream_id as-is (no prefix, rely on unique stream naming);
(c) accept the double-prefix as canonical. LumaWeave has no strong position; we defer
to the federation convention decision, but flag that our stream `lumaweave/graph/events`
was deliberately namespaced with the project prefix in anticipation of hub use.

**Protocol decisions confirmed adopted (from fossic's summary table):**
- Relay decoded (post-upcast) payloads, not raw bytes ✓
- `external_id` = source event id hex (idempotency key) ✓
- LumaWeave as first relay candidate ✓

**Causation chain — two-case refinement (from fossic's updated reconciliation):**
The simple "not traversable on hub alone" statement in the original protocol is more
precisely two distinct cases:
1. Hub event → local event that was NOT relayed: `walk_causation` fails at
   `EventNotFound`. Requires going back to originating store. The `source_store`
   indexed_tag provides the routing hint.
2. Hub event → local event that WAS relayed: hub traversal works because the hub has
   the target event. This case applies when both the causing and caused events are
   relayed from their respective local stores.

For LumaWeave's current event surface (five event types on one stream), causation
chains are simple — LumaWeave events don't cause other projects' events and vice versa
at this scope. This matters more once cross-project causal chains emerge (e.g., a
Cerebra cycle produces a graph export that triggers a LumaWeave `SourceLoaded`).

**`causation_id=None` is correct for current LumaWeave events.** All five event types
(`SourceLoaded`, `SourceLoadFailed`, `SourceSwitched`, `ThemeChanged`,
`GraphLayoutSettled`) are triggered by Tauri frontend actions, not by incoming fossic
events from other projects. No upstream fossic `event_id` exists to link them to. The
relay agent should pass `causation_id: None` (or omit the field) for all current
LumaWeave events. When `GraphSnapshotAvailable` integration lands and a LumaWeave
`SourceLoaded` is directly caused by a Cerebra hub event, that becomes the correct
`causation_id` to carry forward.

### C.6 — Bo's read path under federation (from ai-stack/Bo's reconciliation, updated)

ai-stack/Bo's reconciliation was revised after cross-reading all peer reconciliations.
The original framing ("Bo reads from the cerebra witness model as the all-seeing
aggregator") was corrected. Cerebra pushed back directly: Cerebra aggregates cognitive
cycle context, not platform-wide state. Cerebra's vault-scoped store is not accessible
from Bo without creating a cross-domain dependency, and the hub is the right aggregation
point for cross-project queries.

**Corrected Bo read-path under federation:**
- Cognitive cycle state ("is a cycle running?") → Cerebra daemon HTTP `GET /status`
- Platform-wide state ("what is the GPU doing? what is LumaWeave visualizing?") → Hub
  fossic store, where all projects relay filtered events

The hub is Bo's write destination (via relay) AND its query source for platform-wide
questions. The witness model is NOT a query interface for Bo's platform state queries —
not even an indirect one. Bo's posture and GPU state queries go directly to the hub
fossic store once relay is live (per Cerebra's D.5 correction, Round 2). The witness
model's role is strictly Cerebra-internal: it enriches Cerebra's own cognitive cycle
execution by projecting hub events (from Policy Scout, ai-stack, and eventually
LumaWeave) into Cerebra's memory layer, so that during a cycle Cerebra has richer
platform context. Bo benefits from this indirectly when the Cerebra daemon's answers
become more contextually informed, but Bo never queries the witness model directly.

This matters for LumaWeave specifically: when Bo is asked "what is LumaWeave currently
visualizing?", the answer comes from the hub (our relayed `SourceLoaded`/`SourceSwitched`
events). This only works once LumaWeave is relaying to the hub. Until then, LumaWeave's
state is invisible to Bo's hub-query path.

### C.7 — Snapshot cold-start for LumaWeave tile (from policy-scout's reconciliation)

Policy Scout identified a cold-start problem for tile subscriptions that applies equally
to LumaWeave: when Lattica's tile first subscribes to the hub stream for a project, it
sees zero events until the next event fires. For the LumaWeave tile subscribing to
`lumaweave/graph/events`, this means the graph health pill, node/edge count badge, and
active source label are blank until the user triggers a source load — which may not
happen if LumaWeave is already in a loaded state when the tile opens.

A fossic snapshot on `lumaweave/graph/events` seeded at the last `SourceLoaded` event
gives the tile immediate initial state on subscribe, without replaying history. The
snapshot API is available and ready to use (confirmed by fossic's reconciliation). This
is not a current blocker but should be adopted when Phase 2 tile wiring lands.

### C.8 — Cerebra's preferred double-prefix resolution (from cerebra's reconciliation)

Cerebra's updated reconciliation (D.3) gives a specific resolution recommendation for
the hub stream naming double-prefix problem, going beyond the three options listed in
C.5. Their proposal: strip the leading project segment from the original `stream_id`
before prepending `source_prefix`, if the `stream_id` already starts with
`source_prefix/`. Example:

```
source_prefix = "cerebra"
event.stream_id = "cerebra/agent-trace/<session_id>"
→ strip "cerebra/" → "agent-trace/<session_id>"
→ hub stream = "cerebra/agent-trace/<session_id>"   ✓ (not "cerebra/cerebra/...")
```

For LumaWeave: `source_prefix = "lumaweave"`, `event.stream_id = "lumaweave/graph/events"`:
→ strip "lumaweave/" → `"graph/events"` → hub stream = `"lumaweave/graph/events"` ✓

This is Cerebra's preferred option; they note it requires the relay agent to know the
project's stream naming convention. LumaWeave has no objection to this resolution —
our stream was deliberately prefixed with the project name in anticipation of hub use,
so this stripping rule produces clean hub stream names.

**Round 2 update:** ai-stack formally endorsed this convention in their Round 2 update
(Item 3), explicitly stating that the double-prefix form (`ai-stack/ai-stack/gpu`) is
named in their file only to identify the problem — it is NOT their accepted outcome.
This is now the leading proposal backed by two of five projects (Cerebra + ai-stack)
going into the federation interview. LumaWeave makes three in endorsement.

### C.9 — `causation_id` upgrade obligation when `GraphSnapshotAvailable` lands

Fossic's reconciliation names the future `causation_id` evolution for LumaWeave explicitly
as "the first concrete cross-project causal chain in LumaWeave's event surface." It must
be tracked as a relay agent protocol obligation, not just a forward-looking note.

Current state: all five LumaWeave event types (`SourceLoaded`, `SourceLoadFailed`,
`SourceSwitched`, `ThemeChanged`, `GraphLayoutSettled`) carry `causation_id=None` because
they are triggered by Tauri frontend actions, not by incoming fossic events.

Future obligation: when `GraphSnapshotAvailable` integration lands and a LumaWeave
`SourceLoaded` is directly triggered by receiving that hub event, the relay agent must be
updated to pass `causation_id = <hub_event_id>` for that event. The triggering Cerebra hub
event's ID becomes the correct `causation_id` to carry forward to the hub.

**Causation chain classification (per Cerebra's D.4, Round 2):** This chain is case 2
of the two-case causation pattern — both `GraphSnapshotAvailable` (Cerebra's relayed
event) and `SourceLoaded` (LumaWeave's relayed event triggered by it) are present on
the hub. Hub-side `walk_causation` traverses the chain without needing to back-reference
either local store. No special routing design is required beyond the `causation_id` field
being set correctly. The `source_store` indexed_tag is not needed for this traversal
(that tag serves case 1 — where the causing event was NOT relayed to hub).

The relay agent as currently designed passes `causation_id=None` for all LumaWeave events
and will need a conditional branch once the `GraphSnapshotAvailable` receive path is wired:
if a `SourceLoaded` was triggered by a hub event, carry that event's ID; otherwise `None`.
This is a planned relay agent update, not a current action item.

---

## Items requiring developer or platform-side action

1. **Shared store path confirmation** — the only blocker on LumaWeave's Track B work.
   Once `~/.lattica/fossic/store.db` is confirmed stable and accessible from Tauri,
   LumaWeave's migration is a one-line path change.

2. **CerebraReadAdapter conflict — closed.** Cerebra confirmed the error in their
   reconciliation. No further action from either side. The federation model going
   forward is event-based (`GraphSnapshotAvailable`), not file-polling.

3. **Relay agent protocol gaps to implement before first relay pass:**
   - Add `branch=event.branch` to relay Append
   - Add `source_store: "lumaweave"` indexed_tag to relay Append
   - Add `indexed_tags` fields to R-LW-005 event emission (`adapter_id`, `source_key`,
     `dialect_id` where applicable)
   - Await federation interview resolution on stream naming double-prefix convention

4. **Federation interview scope** — LumaWeave is ready to participate. The highest-value
   discussion threads from LumaWeave's side:
   - Stream naming convention for hub (double-prefix resolution; Cerebra prefers
     strip-leading-segment, which works cleanly for LumaWeave's existing stream name)
   - `GraphSnapshotAvailable` event model for Cerebra→LumaWeave graph handoff: stream
     target, payload schema, and what fields LumaWeave needs as the consumer. Note: fossic's
     open question #4 in their Item 3 explicitly calls for LumaWeave and Cerebra to bring
     concrete payload requirements to this discussion. LumaWeave's requirements are already
     specified in B.1 above (snapshot reference, `lineage_id`, trigger-load context) and
     should be treated as LumaWeave's formal input to that open question, not a future TBD.
   - Settings hub-observability partition (sources.active and activeDialect as emitted
     events vs. Zustand-only state)
   - Relay agent process model (separate process, Tauri sidecar, or Lattica pull)
   - Hub-side reducer/snapshot for Lattica's LumaWeave tile: Cerebra's reconciliation
     (D.7) notes that hub consumers aggregating a project's state must either replay all
     relayed events from the beginning or maintain their own reducer+snapshot. The Lattica
     tile authors need to know this before Phase 2 tile wiring starts — a snapshot on the
     hub stream at subscription time is the concrete mitigation (see C.7).

---

## Settled items (confirmed across two cross-read rounds)

Items below are no longer in active dispute. They do not require re-litigating in future
rounds unless new evidence surfaces.

| Item | Settled by |
|---|---|
| B.1 — CerebraReadAdapter never built; file-polling model dropped | Cerebra confirmed error (Item 1); both projects converged on `GraphSnapshotAvailable` |
| B.2 — LumaWeave as first relay candidate | Fossic confirmed; unblocked once shared store path confirmed |
| C.1 — Local store migration is one-line path change | Fossic confirmed; no API changes needed on fossic side |
| C.3 — Settings partition (hub-observable: sources.active + activeDialect; local: rest) | Fossic and peers confirmed partition is clean |
| C.4 — "Transitions not measurements" principle applies to LumaWeave relay set | All five projects independently confirmed across two rounds |
| C.5 — Full relay protocol (branch, source_store, indexed_tags fields, two-case causation, causation_id=None, external_id) | Fossic Items 1/3, Cerebra D.2, ai-stack Round 2 all confirmed |
| C.6 — Bo read-path correction (daemon HTTP for cycle state; hub direct for platform-wide) | Cerebra D.5, ai-stack Item 2 revised, fossic Item 2 all confirmed; witness model not Bo's query interface |
| C.7 — Snapshot cold-start pattern (snapshot at SourceLoaded seeds tile on subscribe) | Fossic confirmed API ready; canonical pattern across ai-stack, LumaWeave, Policy Scout |
| C.8 — D.3 strip-leading-segment convention: endorsed by Cerebra + ai-stack + LumaWeave | ai-stack Round 2 Item 3 formal endorsement; three of five projects backing this going into federation interview |
| C.9 — GraphSnapshotAvailable → SourceLoaded is case 2 causation (hub-traversable, no back-reference needed) | Cerebra D.4 Round 2; classification confirmed |

---

End of reconciliation.
