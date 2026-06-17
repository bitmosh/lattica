# LumaWeave — Needs Wiring Log

**Date:** 2026-06-16
**Filed by:** lumaweave-claude
**Purpose:** Track hard-coded values, missing bindings, and wiring ambiguities surfaced during federation design. All items must be resolved before or during the relay pass.

---

## Item 1 — indexed_tags missing: adapter_id, source_key on source events

**Element / binding location:** `events.rs:48`, `emit()` helper; specifically the `..Append::default()` spread. Affects calls at lines 72-77 (`lw_emit_source_loaded`), 87-91 (`lw_emit_source_load_failed`), 100-103 (`lw_emit_source_switched`).

**Assumed correct token/variable:**
- `SourceLoaded`: `indexed_tags = {adapter_id: <adapter_id param>, source_key: <source_key param>}`
- `SourceLoadFailed`: `indexed_tags = {adapter_id: <adapter_id param>, source_key: <source_key param>}`
- `SourceSwitched`: `indexed_tags = {to_adapter_id: <to_adapter_id param>}`

**Who needs to confirm:** LumaWeave (self — this is our own code to fix; no external confirmation needed).

**Confidence level:** high — these fields are agreed in reconciliation (S-016) and in the v2 §2.6 indexed_tags table.

**Brief context:** The `emit()` helper uses `..Append::default()` which leaves `indexed_tags` empty. The `adapter_id` and `source_key` values are passed as command parameters and written to the JSON payload, but NOT written to `indexed_tags`. Without indexed_tags, hub consumers cannot SQL-filter by adapter or source; `indexed_tags_filter` is a no-op. Must be fixed before relay pass. Fix: either update `emit()` to accept indexed_tags, or reconstruct the `Append` struct directly in each command function.

---

## Item 2 — indexed_tags missing: dialect_id on GraphLayoutSettled

**Element / binding location:** `events.rs:124-132`, `lw_emit_graph_layout_settled` command. Currently takes `node_count: u32` and `duration_ms: u32`. `dialect_id` is absent from the command signature, the JSON payload, and indexed_tags.

**Assumed correct token/variable:** `indexed_tags = {dialect_id: <active gwells dialect id at settle time>}`. The dialect id is the string identifier from `GW_DIALECT_REGISTRY` (e.g., `"gwells.dialect.spine-force"`).

**Who needs to confirm:** LumaWeave (self). The call site in the frontend must identify the active dialect at settle time; likely readable from `useSettingsStore.getState().physics.activeDialect`.

**Confidence level:** high — agreed in reconciliation (S-016) and v2 §2.6 table.

**Brief context:** This field must be added in two places: (1) the Rust `lw_emit_graph_layout_settled` command signature and JSON payload; (2) `invokeEmitGraphLayoutSettled` in `tauri-invoke.ts`. The frontend call site (currently deferred — gwells has no convergence signal) will also need to pass the active dialect ID when it's wired.

---

## Item 3 — dialect_id missing from GraphLayoutSettled command signature (Rust + TS)

**Element / binding location:**
- Rust: `events.rs:124`, `pub fn lw_emit_graph_layout_settled(store, node_count: u32, duration_ms: u32)`
- TS: `tauri-invoke.ts`, `invokeEmitGraphLayoutSettled(nodeCount: number, durationMs: number)`

**Assumed correct token/variable:** add `dialect_id: String` (Rust) / `dialectId: string` (TS) as a third parameter.

**Who needs to confirm:** LumaWeave (self).

**Confidence level:** high.

**Brief context:** Companion to Item 2. The command signature itself needs updating before the indexed_tags fix in Item 2 can take effect. The frontend mount point for this command is also deferred (gwells convergence signal), so the fix can be made without breaking anything active.

---

## Item 4 — Hub store path in relay agent (not yet written)

**Element / binding location:** `lumaweave-relay.py` — relay agent config (file does not exist yet).

**Assumed correct token/variable:** `hub_store_path = "~/.lattica/fossic/store.db"` (or resolved absolute path equivalent).

**Who needs to confirm:** Lattica — must confirm `~/.lattica/fossic/store.db` is stable and accessible from a Python process on the same host (§8.5 action item). Specifically: (a) the path is stable (won't move between sessions), (b) a Python process with fossic-py can open it at that path without Tauri being involved.

**Confidence level:** high that this is the correct path; confirmation from Lattica needed before hardcoding in relay agent.

**Brief context:** The relay agent is a standalone Python process separate from Tauri. It reads the local store at `<project_root>/.lumaweave/fossic.db` and writes to the hub. The hub path must be confirmed stable — if it's created/managed by Tauri at startup, there may be a lifecycle question about whether a standalone Python process can open it safely outside Tauri's lifecycle.

---

## Item 5 — S-031 causation_id relay behavior ambiguity

**Element / binding location:** `lumaweave-relay.py` relay loop (not yet written); specifically the `causation_id` assignment when relaying a `SourceLoaded` event triggered by `GraphSnapshotAvailable`.

**Assumed correct token/variable:** when `event.causation_id` is not `None` on a local event (meaning LumaWeave set a causation_id at emit time pointing to a hub event): the relay agent should propagate `event.causation_id` to the hub copy rather than replacing it with `event.id`.

**Who needs to confirm:** Fossic (relay protocol authority) + Cerebra (chain design). Outbound filed: `outbound/2026-06-16_lumaweave_to_lattica_binding-question-s031-causation-relay.md`.

**Confidence level:** low — the v2 S-031 text says "causation_id = local_source_loaded_event.id" (same as S-030 standard relay behavior), but that would make the chain case-1 (local-store hop required), not case-2 (hub-traversable). The intent across reconciliation documents was case-2. There is a discrepancy between the S-031 text and the case-2 claim.

**Brief context:** The future `GraphSnapshotAvailable → SourceLoaded` chain requires the local `SourceLoaded` event to be emitted with `causation_id = <GraphSnapshotAvailable hub event ID>` (set by LumaWeave's frontend when it triggers a load from a hub event). The relay agent then propagates that causation_id to the hub copy, making the chain fully hub-traversable. If instead the relay agent replaces it with `event.id` (the local event's own ID), the hub chain becomes case-1 and requires a local-store query to traverse. Needs protocol confirmation before implementing either the relay agent or the SourceLoaded emitter changes.

---

## Item 6 — Local store path (informational; no fix required)

**Element / binding location:** `events.rs:34-35`
```rust
let db_dir = project_root.join(".lumaweave");
let db_path = db_dir.join("fossic.db");
```

**Assumed correct token/variable:** `<project_root>/.lumaweave/fossic.db` — intentional, correct for local-store-per-project model.

**Who needs to confirm:** no one; this is correct.

**Confidence level:** high — intentional design.

**Brief context:** This is LumaWeave's local store path. It does NOT need to change for federation. The relay agent handles the bridge to the hub. Logged here for completeness so future passes don't question this path.

---

## Item 7 — Hard-coded stream name constant

**Element / binding location:** `events.rs:5`
```rust
const STREAM: &str = "lumaweave/graph/events";
```

**Assumed correct token/variable:** correct as-is.

**Who needs to confirm:** no one; this is the agreed stream name per reconciliation and v2 §3.3.

**Confidence level:** high.

**Brief context:** Under D.3 (once ratified), this stream name passes through the relay agent unchanged — no double-prefix issue. Logged for awareness; no action required.

---

## Item 8 — SourceSwitched missing source_key in payload

**Element / binding location:** `events.rs:95-103`, `lw_emit_source_switched` command.

```rust
pub fn lw_emit_source_switched(
    store: State<'_, LwEventStore>,
    from_adapter_id: String,
    to_adapter_id: String,
) -> Result<(), String>
```

**Assumed correct token/variable:** consider adding `to_source_key: String` to the SourceSwitched payload. Currently SourceSwitched only carries adapter IDs, not source keys. Hub consumers who want to know "which specific source (not just adapter type) is now loaded" would need to cross-reference with the most recent SourceLoaded event.

**Who needs to confirm:** LumaWeave (self — design decision). Not a relay blocker; a payload completeness question.

**Confidence level:** medium — the current SourceSwitched shape may be sufficient if hub consumers always read the full SourceLoaded event for source_key context. Adding source_key to SourceSwitched is an enhancement, not a requirement.

**Brief context:** SourceLoaded carries both adapter_id and source_key. SourceSwitched only carries adapter IDs. If a user switches adapters, the hub event stream shows the transition (from/to adapter) but doesn't include the new source_key in the switch event itself. Lattica tile would need to join SourceLoaded to get the full picture. Adding to_source_key to SourceSwitched would make the tile simpler.

---

*End of needs-wiring.md*
