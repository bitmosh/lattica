# fossic — Needs Wiring

**Filed by:** fossic-claude
**Date:** 2026-06-16
**Companion file:** `fossic/federation_design.md`
**Purpose:** Log ambiguities, assumed tokens, and hard-coded values that need confirmation before Fossic substrate tile elements can be safely wired.

---

## Entry format

Each entry covers:
- **Element / binding location** — what is being wired and where
- **Assumed correct token / variable** — current best-guess value
- **Who needs to confirm** — project or person responsible
- **Confidence** — High / Medium / Low
- **Context** — why this is ambiguous or hard-coded

---

## Ambiguities and hard-coded values

---

### NW-001 — Hub store path stability

**Element / binding location:**
All fossic-tauri commands that open the hub store; LumaWeave migration; all relay agent `hub_store_path` configs.

**Assumed correct token:**
`~/.lattica/fossic/store.db`

**Who needs to confirm:**
Lattica (Tauri backend — `src-tauri/`). See v2 §8.5. This is flagged as the actionable blocker for LumaWeave migration.

**Confidence:** High (consistent across all five reconciliation files; ai-stack and Bo already write here successfully)

**Context:**
All projects have assumed `~/.lattica/fossic/store.db` as the canonical hub path. LumaWeave's migration is explicitly blocked on Lattica confirming this path is stable and that the Tauri backend will continue to reference it at this exact location. If Lattica's Tauri backend uses a resolved path (e.g., `/home/boop/.lattica/fossic/store.db`) internally, relay agent configs should match.

---

### NW-002 — fossic_read_event_from_store Tauri command existence

**Element / binding location:**
Case-1 causation rendering in Fossic substrate tile; any tile element that needs to query an originating local store when `walk_causation` fails.

**Assumed correct token:**
`fossic_read_event_from_store(store_path: String, event_id: String) -> Result<Option<SerializedEvent>, Error>`

**Who needs to confirm:**
fossic-tauri (fossic-claude + lattica-claude). This command does not yet exist. It is recommended in federation_design.md B.5 §8.7 as a small fossic-tauri addition.

**Confidence:** Low — command is not yet implemented; signature is a proposal

**Context:**
Without this command, case-1 causation chains (hub event → local event NOT relayed) cannot be resolved from Lattica tiles. The `source_store` indexed_tag identifies the originating project, but there is no current Tauri command to open an arbitrary store path and read by event ID. This is a federation pass deliverable, not a current blocker for relay agent work.

---

### NW-003 — Project-to-store-path resolution table

**Element / binding location:**
Lattica tile layer; the `resolveStorePathForProject(source_store: string)` call described in federation_design.md B.5 §8.7.

**Assumed correct token (current best-guess mapping):**

| source_store value | Local store path |
|---|---|
| `"cerebra"` | `/home/boop/Projects/cerebra/.fossic/store.db` (inferred from Cerebra reconciliation §2.1) |
| `"lumaweave"` | LumaWeave local store path — **not confirmed in any reconciliation file** |
| `"policy-scout"` | `/home/boop/Projects/policy-scout/.fossic/store.db` (inferred from PS reconciliation §2.3) |
| `"ai-stack"` | `~/.lattica/fossic/store.db` (ai-stack already writes to hub; local store = hub) |

**Who needs to confirm:**
Each emitting project must confirm their local store path for this table. Lattica needs to decide where this table lives (hardcoded in tile, or in a config file, or derived from relay agent configs).

**Confidence:** Medium for Cerebra and Policy Scout (vault pattern inferred); Low for LumaWeave (not stated); Low for ai-stack (writes directly to hub — "local store" may not exist as a separate path)

**Context:**
Case-1 causation resolution requires Lattica tiles to know which filesystem path corresponds to each `source_store` value. This mapping is stable (project paths don't move) but has never been explicitly filed in a cross-project document. Each project's reconciliation mentions their own local store path; this table assembles them for Lattica's use.

---

### NW-004 — `_fossic/system` stream naming under D.3

**Element / binding location:**
Fossic substrate tile's event rate gauge; any tile element that subscribes to `_fossic/system`.

**Assumed correct token:**
`_fossic/system` — the leading underscore indicates a fossic-internal stream; it does not carry a project prefix and does not go through relay agents. Hub stream name is also `_fossic/system`.

**Who needs to confirm:**
fossic-claude (stream naming convention authority). Does D.3 apply to `_fossic/system`? The `_fossic` prefix does not match any `source_prefix` value used by relay agents.

**Confidence:** High (leading underscore is a clear namespace separator; D.3 conditional strip is a no-op for streams with no matching source_prefix)

**Context:**
The event rate gauge subscribes to `_fossic/system` on the hub store. Under D.3 the relay agent's `_hub_stream_id()` method only runs for events being relayed from a project's local store. `_fossic/system` is emitted directly by fossic (not relayed from any project store), so D.3 never applies. The stream name is `_fossic/system` on both hub and local stores. No ambiguity in practice; logging here for completeness.

---

### NW-005 — Event rate gauge window and update parameters

**Element / binding location:**
Fossic substrate tile event rate gauge (`_fossic/system` stream + relay event counts).

**Assumed correct token:**
- Window size: no canonical default; 60 seconds is a reasonable assumption
- Update frequency: no canonical default; once per `_fossic/system` event, or on a polling interval?

**Who needs to confirm:**
Lattica (tile design); fossic-claude (if `_fossic/system` emits rate metrics natively or if the tile must compute them).

**Confidence:** Low — neither `_fossic/system` event schema nor tile update cadence have been specified

**Context:**
The Fossic substrate tile's event rate gauge is marked broken-pending in federation_design.md C.1 (requires full relay coverage). Before it can be designed at all, the data source needs to be clear: does `_fossic/system` emit pre-computed rate metrics, or does the tile derive rates from event timestamps? If the latter, what window and update interval? This needs a design decision before tile implementation.

---

### NW-006 — Bo relay filter spec for bot/* streams (§8.8)

**Element / binding location:**
ai-stack+Bo shared relay agent `relay_filter` config; Fossic substrate tile per-project event counts.

**Assumed correct token:**
`{"BotLifecycleEvent", "MessageReceived", "MessageSent"}` (speculative — no canonical list exists)

**Who needs to confirm:**
ai-stack/Bo (relay filter spec owner, federation interview item §8.8); Cerebra (if Bo persona folds into Cerebra relay agent).

**Confidence:** Low — §8.8 is explicitly open for federation interview

**Context:**
Bo writes to `bot/lifecycle` and `bot/conversation/<channel_id>` on the hub today (direct writes, not via relay). Under federation, these streams would come through the relay agent. Which `bot/*` event types should relay to hub and which stay local is an open design question. Until decided, the relay filter for bot/* streams cannot be coded.

---

### NW-007 — source_prefix for Bo events after Cerebra fold

**Element / binding location:**
All relayed bot/* events' `source_store` indexed_tag; case-1 causation routing for bot/* event chains.

**Assumed correct token:**
Unclear — either `"bot"` (current stream prefix convention) or `"cerebra"` (if Bo becomes a Cerebra subsystem) or `"ai-stack"` (if the relay agent is the ai-stack+Bo shared agent).

**Who needs to confirm:**
Cerebra + ai-stack/Bo (federation design; Bo persona fold decision). Fossic confirmed in federation_design.md B.7 that no fossic-side change is needed, but the `source_store` tag value is not yet decided.

**Confidence:** Low — depends on Cerebra/Bo fold architecture

**Context:**
The `source_store` indexed_tag is how consumers route case-1 causation queries to the originating store. If bot/* events are `source_store: "bot"`, consumers need a mapping from `"bot"` to a store path. If they're `source_store: "cerebra"` (because Bo is absorbed into Cerebra), consumers use the Cerebra store path. If `source_store: "ai-stack"` (shared relay agent), consumers would use the ai-stack local store. This matters for NW-003's routing table.

---

## Summary by confidence

| ID | Description | Confidence | Blocks |
|---|---|---|---|
| NW-001 | Hub store path stability | High | LumaWeave migration, relay configs |
| NW-002 | fossic_read_event_from_store command | Low | Case-1 causation rendering |
| NW-003 | Project-to-store-path resolution table | Medium/Low | Case-1 causation rendering |
| NW-004 | _fossic/system stream under D.3 | High | Nothing (no issue in practice) |
| NW-005 | Event rate gauge parameters | Low | Tile design for rate gauge |
| NW-006 | bot/* relay filter spec | Low | ai-stack+Bo relay agent |
| NW-007 | source_store value for Bo events | Low | Case-1 routing for bot/* chains |

End of needs-wiring.md.
