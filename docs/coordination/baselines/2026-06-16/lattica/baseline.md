# Baseline — lattica (2026-06-16)

---

## federation_design

# Lattica Federation Design Response

**Filed by:** lattica-claude
**Date:** 2026-06-16
**Round:** Federation Interview — Hub Owner / Consumer / Visual Layer
**Companion file:** `needs-wiring.md` (same directory)

---

## Section A — Context confirmation

Both baseline documents were authored during v0.3.5s; context is fresh. One material fact confirmed from on-disk code before filing this response (not present in the baselines, worth surfacing):

**§8.5 RESOLVED from Lattica's side.** The hub store path is hard-coded in `src-tauri/src/lib.rs:133` as `home.join(".lattica/fossic/store.db")`. This is the canonical path; it is stable. LumaWeave's one-line migration is unblocked from Lattica's end. No coordination needed — LumaWeave can target `~/.lattica/fossic/store.db` now.

Also confirmed from code: CerebraSignalTile's fossic subscription IS wired in Lattica code (`CerebraSignalTile.tsx:74`: `invoke("fossic_subscribe", { streamPattern: "cerebra/agent-trace/*" })`). The subscription fires, the channel is open, and zero events arrive. This is consistent with §6.5 — the subscription is structurally correct; the stream is dark until Cerebra migrates or relay runs.

No corrections to the baseline documents are needed.

---

## Section B — Lattica's federation design

### B.1 — Hub role confirmation

**Hub store path:** `~/.lattica/fossic/store.db` — confirmed stable in `src-tauri/src/lib.rs:133`. Path resolves using `home_dir()` from the `dirs` crate; consistent cross-platform. Accessible from Rust backend via `fossic-tauri` commands. All fossic-tauri tile subscriptions already target this path.

**No code change needed for hub role.** The hub exists, relay agents can append to it today (ai-stack sidecar and Bo already do). The Tauri backend exposes `fossic_subscribe` and `fossic_query` commands; relay agents bypass Tauri entirely (they use `Store.open()` from fossic-py or the Rust crate directly). Lattica has no gatekeeping role in the relay path.

**Capacity and contention:** Fossic's WAL-based SQLite design handles concurrent writers correctly. Relay agents appending and Lattica tiles subscribing are the expected multi-writer/multi-reader pattern fossic was designed for. No Lattica-side concern. Backup is a system-level concern (outside this design scope).

**One concern to surface:** The Tauri backend hard-codes the store path rather than reading it from Lattica's settings store. If the path ever needs to be configurable (e.g., a custom vault location), that requires a Rust change + settings migration. This is a known limitation, not an immediate problem; logging in needs-wiring.md.

---

### B.2 — LiveValue<T> type pattern design

The governing constraint: every dynamically-displayed value must be live-wired or shown in a defined error state. The type system enforces this — the UI cannot access `.value` without pattern-matching on `.state`. No hard-coded fallback values.

**Refined type definition:**

```typescript
type LiveValue<T> =
  | { state: 'live';  value: T;  lastUpdated: number; stream?: string }
  | { state: 'error'; reason: ErrorReason; lastAttempt: number; stream?: string };

type ErrorReason =
  | { kind: 'no-data-yet' }                        // subscription established; no events yet
  | { kind: 'source-unreachable' }                 // hub down, daemon down, or connection lost
  | { kind: 'pre-relay' }                          // wiring correct; upstream relay not live
  | { kind: 'wiring-incomplete' }                  // subscription not yet coded in Lattica
  | { kind: 'data-stale'; thresholdMs: number }    // last event older than threshold
  | { kind: 'subscription-closed' };               // was live; subscription closed unexpectedly
```

**Changes from the prompt's starting point:**

- Added `subscription-closed` — distinguishes "never connected" from "was connected, then lost". The two have different UX treatments (see visual design below). Without this, `source-unreachable` conflates initial failures with mid-stream failures.
- Added `thresholdMs` field to `data-stale` — enables the renderer to display "last seen X ago" relative to the threshold, not just a generic stale warning.
- Added optional `stream?: string` field to both variants — the stream-of-origin identifier requested in B.2. Optional so existing usages that don't have a stream binding yet compile cleanly; filled in as subscriptions are instrumented.
- Preserved all original five kinds; no removals.

**Component tree placement — per-connection model (recommended):**

Not per-element (too much boilerplate) and not per-tile (too coarse — one bad value breaks the whole tile display). Instead: **one `LiveValue` per data source connection**. A tile with two data sources gets two LiveValues.

`CerebraSignalTile` as the canonical example:
- `daemonStatus: LiveValue<DaemonStatus>` — wraps the 30s HTTP poll to `/status`; currently `live`
- `fossicStream: LiveValue<FossicEventStream>` — wraps the `cerebra/agent-trace/*` subscription; currently `{ state: 'error', reason: { kind: 'pre-relay' }, ... }`

All elements backed by daemon data render from `daemonStatus.value`; all elements backed by fossic events render from `fossicStream.value`. Each connection's health propagates only to its dependent elements. Daemon going offline doesn't blank the event timeline; fossic subscription being dark doesn't blank the posture pill.

Per-element LiveValue remains available for tile elements with truly independent data bindings (e.g., a value fetched from a one-shot Tauri command vs. a subscription).

**Visual treatment per error kind:**

| Error kind | Color | Icon | Hover detail | Behaviour |
|---|---|---|---|---|
| `live` | Normal | None | Timestamp of last update | Normal display |
| `no-data-yet` | Muted / 60% opacity | Pulse shimmer | "Waiting for first event on `<stream>`" | Skeleton / shimmer animation |
| `source-unreachable` | Amber | ⚠ Warning triangle | "Cannot reach `<stream>` — hub or daemon offline" | Static amber placeholder; no animation |
| `pre-relay` | Blue-gray muted | ⏳ Clock / hourglass | "Awaiting relay: `<stream>` — feed live once `<dep>` relay runs" | Static muted placeholder; NOT styled as error |
| `wiring-incomplete` | Dev-mode only: purple | 🔧 Wrench | "Wiring not yet implemented for `<stream>`" | Developer-only indicator; hidden in production |
| `data-stale` | Amber + timestamp | ⏱ Stale clock | "Last seen `<N>` ago (threshold: `<thresholdMs>ms`)" | Shows stale value with overlay warning |
| `subscription-closed` | Red | ✖ Closed | "Subscription to `<stream>` closed unexpectedly — reconnecting" | Reconnection indicator; fades back to `no-data-yet` on retry |

**Key UX principle:** `pre-relay` must not look like an error. It is the expected state for most broken-pending elements — the wiring is correct and the data will flow when relay lands. Using amber or red for `pre-relay` trains users to ignore warnings (because they're persistent and expected). Blue-gray muted signals "pending, not broken."

**`wiring-incomplete` is developer-only** — it should gate on a build flag or dev mode. In production, a tile element in `wiring-incomplete` state should either not render or show `pre-relay` as a conservative fallback, depending on whether the wiring timeline is known.

---

### B.3 — Tile elements baking in as broken-pending

"Broken-pending" means: the UI element is added to the tile now; it starts in error state; it transitions to `live` when its upstream dependency lands. The LiveValue type enforces the error state cannot be bypassed.

Rows confirmed from Lattica's perspective. Project Claudes fill their tile-side rows in their federation responses.

| Tile | Element | Unblocking condition | LiveValue error state | Notes |
|------|---------|---------------------|----------------------|-------|
| CerebraSignalTile | Cycle event timeline (agent-trace stream) | Cerebra migration OR relay agent live | `pre-relay` | Subscription wired in CerebraSignalTile.tsx:74; stream dark |
| CerebraSignalTile | Session history / outcome list | Cerebra migration OR relay agent live | `pre-relay` | Same subscription |
| CerebraSignalTile | Posture pill | — | `live` (daemon HTTP) | Already working; NOT broken-pending |
| CerebraSignalTile | Cycle running indicator | — | `live` (daemon HTTP) | Already working |
| AiStackTopologyTile | VRAM bar / model list (Phase 2 hub) | Sidecar indexed_tags + Phase 2 wiring in Lattica | `wiring-incomplete` | Phase 1 direct-poll is live; Phase 2 hub-subscription not written yet |
| AiStackTopologyTile | OLLAMA / LITELLM / OPENWEBUI status nodes (Phase 2) | Same as above | `wiring-incomplete` | Phase 1 hardcoded-endpoint checks live |
| LumaWeave tile (not yet built) | Active adapter display | LumaWeave migration + Lattica wiring | `wiring-incomplete` | No LumaWeave tile in tree yet |
| LumaWeave tile | Source switcher dropdown | LumaWeave migration + relay + Lattica wiring | `wiring-incomplete` | |
| LumaWeave tile | Graph event history | LumaWeave migration + relay + Lattica wiring | `wiring-incomplete` | |
| LumaWeave tile | GraphSnapshotAvailable indicator | Cerebra + LumaWeave relay live | `pre-relay` | Becomes `wiring-incomplete` when tile is first scaffolded |
| Policy Scout tile (not yet built) | 4-state posture pill | Track A live (already); hub fossic events for history | `wiring-incomplete` | CLI subprocess works; posture display not wired |
| Policy Scout tile | Pending approvals list | PS fossic relay live | `wiring-incomplete` | PS fossic emit staged; indexed_tags + relay pending |
| Policy Scout tile | Recent decisions list | PS fossic relay live | `wiring-incomplete` | |
| Policy Scout tile | ApprovalExpired countdown | PS watch daemon scheduler + relay | `wiring-incomplete` | Design settled; scheduler unimplemented |
| Fossic substrate tile (not yet built) | Per-project event counts on hub | Per-project relay agents live | `wiring-incomplete` / `pre-relay` | ai-stack + Bo counts available now (write to shared store); rest pending relay |
| Fossic substrate tile | Stream prefix listing | Per-project relay agents live | Same as above | |
| CerebraSignalTile | Witness model projection panel | Phase 15+ Cerebra | `pre-relay` | Far-future; tile should not expose this element at all yet |

**Note on progression from `wiring-incomplete` to `pre-relay`:** When Lattica adds the subscription code for a tile element, it transitions from `wiring-incomplete` to `pre-relay`. The user experience changes (from dev-only indicator to the blue-gray "awaiting relay" state). The flip is a Lattica code change, not an upstream data change.

---

### B.4 — Cross-substrate causation rendering (§8.7)

Cross-substrate links arise when a hub event's causation chain crosses into a local project store (case-1: target event was never relayed). Per S-013, the `source_store` indexed_tag on hub events identifies which local store to query.

**Link styling differentiation:**

- **Case-2 (hub-traversable):** Solid arc in the event stream's theme color. `walk_causation` traverses the hub store directly. Normal rendering path — no special treatment.
- **Case-1 (cross-substrate):** Dashed arc in the same color, with a small substrate badge chip at the arc's target end showing the originating project name (e.g., "cerebra" chip). The dashed style signals "this link requires a store query; it may not always be available."

**Interaction for case-1:**

When the user hovers a case-1 arc: tooltip displays "Causation target in `<source_store>` local store — event type `<type>`, ID `<id>`."

When the user clicks a case-1 arc: trigger a Tauri IPC query to the originating store. The target event renders inline in a side panel or popover, not in a new view. The popover shows the full event details using the standard payload renderer, with a "from `<source_store>` local store" header. This keeps causation exploration in context.

The IPC path for cross-substrate queries requires a new Tauri command: `fossic_query_remote_store(store_path: string, event_id: string)`. The `store_path` derives from `source_store` indexed_tag mapped to the known per-project vault paths. This is a future implementation item; the arc can render as dashed with hover-only treatment until the IPC command exists.

**Error treatment if originating store unreachable:**

The dashed arc remains visible. Clicking it shows a loading state, then an error: "Cannot reach `<source_store>` local store — store offline or relay not running." The arc is preserved even when the target is unreachable — the causation structure is known even if the target content isn't fetched. Hiding the arc on error would destroy information.

**Phased implementation:**

1. Bake in: classify arcs as case-1 or case-2 using a hub `walk_causation` attempt; dashed arc for case-1, solid for case-2
2. Hover treatment: tooltip with event type + store attribution
3. Click treatment: inline popover with remote store IPC (new Tauri command)
4. Error state for unreachable stores

Phase 1 (arc classification + dashed style) is the most valuable increment and can land without the remote query IPC.

---

### B.5 — D.3 stream naming convention ratification (§8.1)

**Lattica explicitly endorses D.3** (conditional strip rule).

Reasoning: D.3 produces hub stream names identical to local stream names for all four emitting projects under their current conventions. For Lattica as tile consumer and stream prefix chip renderer, this is the cleanest possible outcome — no prefix stripping logic in rendering code, no documentation of "hub name differs from local name."

The conditional strip rule handles future projects correctly: projects that already namespace their streams with `<project>/` pass through unchanged; projects that don't get the prefix prepended. This is a sound default.

Ratification is now 4-of-5 explicit (Cerebra, ai-stack, LumaWeave, Lattica). Fossic's pending position is the final gate.

---

### B.6 — Other §8 items

**§8.2 — GraphSnapshotAvailable schema (rendering side needs)**

Beyond what Cerebra and LumaWeave have agreed (snapshot reference, lineage_id, trigger-load context), Lattica's rendering layer needs:

- `adapter_id` — which Cerebra source adapter produced this snapshot (e.g., `cerebra-lattice`, `cerebra-vault`). The LumaWeave tile display should show "Cerebra — `<adapter_id>`" as provenance.
- `event_count` (preferred over schema_version for trigger-load decision) — lets the tile compare against the currently-displayed graph's event count and decide whether to reload. `schema_version` signals compatibility; `event_count` signals whether this is actually a new snapshot worth displaying.
- These fields are additive to LumaWeave's requirements; no conflict.

Stream target preference: `cerebra/graph/<lineage_id>` — clean separation from `cerebra/lattice/<lineage_id>` which carries inference trace events. Mixing infrastructure events (snapshot available) with cognitive cycle events in the same stream makes subscription filtering harder.

**§8.3 — Relay agent process model**

Lattica preference: **standalone Python processes that launch independently of the Tauri shell.** Relay agents are infrastructure, not UI features. They should:
- Survive Lattica restarts (relay keeps running when the user closes the app)
- Start before Lattica starts (so events aren't lost during app boot)
- Be monitored by a process supervisor (systemd, launchd, or a simple watchdog script) rather than by Tauri

Lattica's role in relay agent management: **diagnostic only**. A relay agent health section in the Fossic substrate tile (showing which relay agents are active, their last relay timestamp, and event counts) is the right UI surface. Lattica does not start or stop relay agents.

One concern: if relay agents don't survive after Lattica is uninstalled or vault is moved, that's a cleanup problem worth a future protocol doc — not blocking.

**§8.6 — Hub-side snapshot coordination**

**Snapshot-on-subscribe** is Lattica's preferred pattern for tile cold-start. Rationale:

Tiles open and close throughout a session. Each subscribe should seed current state immediately — the user expects the tile to show current state when opened, not wait for the next event. The fossic snapshot API supports this today; adoption should be tile-by-tile as subscriptions are implemented.

Snapshot-on-emit is useful as a complementary mechanism (reduces query cost for long-running subscriptions) but should be additive, not the primary cold-start mechanism.

**§8.9 — Phase 2 tile wiring sequencing**

Recommended sequence:

1. **Immediately:** Confirm shared store path to LumaWeave (§8.5 resolved from Lattica's side — LumaWeave can act). This unblocks LumaWeave migration (one-line change) which unblocks LumaWeave relay which unblocks LumaWeave tile Phase 2 wiring.

2. **In parallel with (1):** ai-stack sidecar indexed_tags implementation. ai-stack already writes to shared store — once indexed_tags are added, the sidecar is relay-ready, and Phase 2 ai-stack tile wiring can proceed without waiting for relay (Phase 2 wiring consumes the hub events already present).

3. **After LumaWeave migration confirmed:** Phase 2 LumaWeave tile wiring in Lattica — high value, high visibility (drives the graph display use case).

4. **After ai-stack indexed_tags confirmed:** Phase 2 ai-stack tile wiring — cleaner than current Ollama direct-poll; snapshot-on-subscribe eliminates cold-start gap.

Policy Scout relay follows (requires indexed_tags + fossic commit first). Cerebra relay follows (migration + indexed_tags).

---

## Section C — Cross-cutting items

### C.1 — Broken-pending UI discipline

Covered in B.2 (LiveValue<T> type) and B.3 (per-tile element table). The type-level enforcement is the load-bearing mechanism: `LiveValue<T>` makes it structurally impossible to render a value without handling the error state. The visual design per-kind (B.2 table) ensures the UI communicates the right semantics — particularly distinguishing `pre-relay` (expected, pending) from actual errors.

Implementation path: a small pass to introduce `LiveValue<T>` as a shared type in `src/types/live-value.ts`, then a per-tile sweep to wrap existing dynamic values. The `needs-wiring.md` log (companion file) captures current hard-coded values to sweep.

### C.2 — No hard-coded values discipline

`needs-wiring.md` filed as companion document (same directory). Covers hard-coded values identified from on-disk code inspection: daemon URL, ai-stack endpoint constants, hub store path, and stream pattern literals in registrations.

### C.3 — Cross-Claude question protocol

Standard outbound routing path: `docs/coordination/outbound/<date>_lattica_to_<target>_<topic>.md`. For inbound routing asks, Lattica will route to the appropriate Claude within the session that receives the ask.

No new cross-Claude outbound files required from this pass — federation design responses are filed per-project, not via outbound routing.

### C.4 — File ownership boundaries

**Lattica-owned files (all files in `src/` not listed below):**
- All tile infrastructure: `src/tiles/` except P-013 files
- All registry and control-plane: `src/control-plane/`, `src/registrations.tsx`
- Shell and layout: `src/AppShell.tsx`, `src/GwellPanel.tsx`, `src/PanelManager.tsx`
- Tauri backend: `src-tauri/` entirely
- Physics, theme, graph core: `packages/gwells/`, `packages/es-toolkit/`

**Project-Claude-authored files in Lattica's tree (P-013 protocol):**
- `src/renderers/cerebra/PredictionMadeRenderer.tsx` + `.css` — cerebra-claude
- `src/renderers/cerebra/OutcomeRecordedRenderer.tsx` + `.css` — cerebra-claude
- `src/renderers/cerebra/ClutchDecisionMadeRenderer.tsx` + `.css` — cerebra-claude
- `src/tiles/ai-stack/AiStackTopologyTile.tsx` + `.css` — ai-stack-claude

**Naming convention for project-Claude-authored files:**
- Renderers: `src/renderers/<project>/<EventType>Renderer.tsx` + `.css`
- Tiles: `src/tiles/<project>/<ProjectName>Tile.tsx` + `.css` (or a descriptive feature name)
- The `<project>` subdirectory is the ownership signal — Lattica creates the directory; the project Claude authors the file

**claude-design export target structure:**

The final prototype from a claude-design session should map as follows:
- Tile-level layout/wrapper: `src/tiles/<project>/<FeatureName>Tile.tsx` + `.css`
- Renderer components (per event type): `src/renderers/<project>/<EventType>Renderer.tsx` + `.css`
- Sub-components that are tile-internal: `src/tiles/<project>/components/<Name>.tsx`
- Shared types for a tile: `src/tiles/<project>/types.ts`
- Shared hooks for a tile: `src/tiles/<project>/hooks.ts`
- State derivation: `src/tiles/<project>/state.ts` (following the CerebraSignalTile pattern)

Protocol for P-013 deposit: project Claude writes directly to these paths with explicit "P-013" comment header identifying authorship. Lattica Claude reviews before commit (not before authoring).

### C.5 — Net-reader role confirmation

Confirmed. Framing is correct:

- **Hub owner** — Lattica hosts `~/.lattica/fossic/store.db`; the substrate is Lattica's
- **Net-reader** — tiles subscribe from the hub (Lattica's Tauri commands read the hub store; no Lattica component writes to it in current architecture)
- **Relay hosts** — relay agents from other projects append to the hub; Lattica has no writer role in the relay path itself
- **Visual layer** — Lattica renders what arrives on the hub; it doesn't generate events

The "hub owner" role is neither reader nor writer — it's the host. The distinction matters for reasoning about who controls schema evolution and capacity.

---

## Section D — Open questions for peers

Items that emerged from Lattica's analysis that federation interview responses from other projects should address:

1. **§8.5 LumaWeave confirmation:** Lattica confirms hub store path at `~/.lattica/fossic/store.db` is stable. LumaWeave migration is unblocked. LumaWeave's response should confirm target path and timeline.

2. **GraphSnapshotAvailable stream target:** Lattica preference is `cerebra/graph/<lineage_id>` (separate from `cerebra/lattice/*`). Cerebra and LumaWeave should confirm.

3. **Relay agent health events:** Does fossic emit a synthetic relay-agent-health stream (e.g., `relay/status/<project>`) that Lattica's Fossic tile can subscribe to? Or is relay agent health monitored out-of-band? Fossic's response should address.

4. **`fossic_query_remote_store` IPC design:** For case-1 causation rendering (click to view target in originating store), Lattica needs a new Tauri command that opens a second `Store.open()` against the originating project's local vault path. This requires Fossic confirming the API is safe for multi-store concurrent opens. Fossic's response should address.

End of federation_design.md.

---

## needs-wiring

# Needs-Wiring Log — Lattica

**Filed by:** lattica-claude (federation interview pass)
**Date:** 2026-06-16
**Purpose:** Log of existing hard-coded values in Lattica's tree that should be replaced with live-wired LiveValue<T> bindings or moved to config constants. A sweep pass will act on these.

Entries confirmed from on-disk code inspection. This is not an exhaustive audit — a future sweep pass will cover the full tree.

---

## Format

| Element / binding | Location | Hard-coded value | Who confirms | Confidence | Notes |
|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... |

---

## Entries

| Element / binding | Location | Hard-coded value | Who confirms | Confidence | Notes |
|---|---|---|---|---|---|
| Cerebra daemon URL | `src/tiles/cerebra-signal/daemon.ts:1` | `"http://127.0.0.1:7432"` | Cerebra (port); Lattica (IP) | High | Already a named constant `DEFAULT_DAEMON_URL`; good pattern. Move to shared config if daemon port ever becomes user-configurable. No immediate action needed. |
| Hub store path | `src-tauri/src/lib.rs:133` | `home.join(".lattica/fossic/store.db")` | Lattica | Confirmed | Hard-coded in Rust. Stable path. §8.5 resolved. Consider extracting to a named constant in lib.rs for discoverability. Not urgent. |
| Ollama endpoint | `src/tiles/ai-stack/AiStackTopologyTile.tsx:31` | `"http://localhost:11434"` | ai-stack | High | Phase 1 direct-poll constant. Will become a `wiring-incomplete` LiveValue in Phase 2 when tile switches to hub subscription. Keep for now; sweep when Phase 2 wiring is written. |
| LiteLLM endpoint | `src/tiles/ai-stack/AiStackTopologyTile.tsx:32` | `"http://localhost:4000"` | ai-stack | High | Same as above. Phase 1 only. |
| Open WebUI endpoint | `src/tiles/ai-stack/AiStackTopologyTile.tsx:33` | `"http://localhost:3000"` | ai-stack | High | Same as above. Phase 1 only. |
| Cerebra agent-trace stream pattern | `src/tiles/cerebra-signal/CerebraSignalTile.tsx:74` | `"cerebra/agent-trace/*"` | Cerebra (D.3 ratification) | High | Stream name under D.3 is correct as-is (no double-prefix). No change needed if D.3 ratified. Log in case naming convention changes. |
| Cerebra control stream pattern | `src/tiles/cerebra-signal/CerebraSignalTile.tsx:81` | `"cerebra/control"` | Cerebra | High | Same as above. |
| Registrations stream globs (×5) | `src/registrations.tsx:16,24,32,40,48` | `"cerebra/agent-trace/*"` | Cerebra | High | Five separate `stream_glob` entries in payload renderer registrations. All identical. Under D.3, all correct. No change needed unless naming convention changes; log for post-ratification check. |
| fossic_subscribe branch null | `src/tiles/cerebra-signal/CerebraSignalTile.tsx:75` | `branch: null` | Lattica / Fossic | Medium | Null branch means "any branch." Fine for dev use. Consider whether production tiles should pin to a branch. Future design question, not immediate sweep item. |

---

## Sweep status

- **Completed:** On-disk inspection of `src/tiles/cerebra-signal/`, `src/tiles/ai-stack/`, `src-tauri/src/lib.rs`, `src/registrations.tsx`
- **Pending sweep:** `src/tiles/policy-scout/` (not yet built), `src/tiles/lumaweave/` (not yet built), full `src/` tree scan for additional endpoint literals
- **Action gating:** Sweep pass for Phase 1 → Phase 2 transitions; `LiveValue<T>` type introduction pass

---

## Notes

- The ai-stack endpoint constants (`OLLAMA`, `LITELLM`, `OPENWEBUI`) are well-named and file-scoped. The issue is not the naming — it's that they're static values that will need to transition to hub-event-backed display in Phase 2. The transition is `wiring-incomplete → pre-relay → live` as Phase 2 tile wiring lands.
- The daemon URL constant is already a good pattern (`DEFAULT_DAEMON_URL`). No change needed unless daemon becomes user-configurable.
- Hub store path is the highest-priority item for extractability — if a developer ever needs to change it, they need to find `lib.rs:133`. A named constant like `const HUB_STORE_FILENAME: &str = ".lattica/fossic/store.db"` would improve discoverability. Low priority; note for next Rust pass.

---

