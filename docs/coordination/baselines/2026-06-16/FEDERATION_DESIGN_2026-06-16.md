---
document: FEDERATION_DESIGN_2026-06-16
version: compile-1
note: "Historical snapshot 2026-06-16. [redacted], [redacted], and discord-bot references are from this date; those modules are now deprecated."
pass: v0.3.5r
date: 2026-06-16
compiled-by: lattica-claude
status: REVIEW-PENDING
source-documents:
  - baselines/2026-06-16/PLATFORM_BASELINE_2026-06-16_v2.md
  - baselines/2026-06-16/LATTICA_RECONCILIATION_BRIEF.md
  - baselines/2026-06-16/cerebra/federation_design.md
  - baselines/2026-06-16/cerebra/federation_design_addendum_causation_id.md
  - baselines/2026-06-16/lumaweave/federation_design.md
  - baselines/2026-06-16/policy-scout/federation_design.md
  - baselines/2026-06-16/ai-stack/federation_design.md
  - baselines/2026-06-16/fossic/federation_design.md
  - baselines/2026-06-16/fossic/federation_design_addendum_causation_id.md
  - baselines/2026-06-16/lattica/federation_design.md
  - baselines/2026-06-16/cerebra/needs-wiring.md
  - baselines/2026-06-16/lumaweave/needs-wiring.md
  - baselines/2026-06-16/policy-scout/needs-wiring.md
  - baselines/2026-06-16/ai-stack/needs-wiring.md
  - baselines/2026-06-16/fossic/needs-wiring.md
  - baselines/2026-06-16/lattica/needs-wiring.md
  - cross-pollination/cerebra/federation-post-2026-06-16.md
  - cross-pollination/ai-stack/2026-06-16_post-federation-briefing.md
  - cross-pollination/lumaweave/2026-06-16_lumaweave_to_lattica_federation-followup.md
  - cross-pollination/policy-scout/post-federation-impl-briefing.md
  - outbound/2026-06-16_lumaweave_to_lattica_binding-question-s031-causation-relay.md
  - outbound/2026-06-16_policy-scout_to_cerebra_binding-question-upstream-causation-id.md
  - outbound/2026-06-16_ai-stack_to_cerebra_binding-question-topology-aliases.md
  - outbound/2026-06-16_lattica_to_fossic_multi-store-ipc-safety.md
  - outbound/2026-06-16_lattica_to_cerebra_gsa-adapter-id-field-question.md
  - outbound/2026-06-16_lattica_to_lumaweave_hub-store-concurrent-access-confirmed.md
---

# Federation Design — 2026-06-16

**Compiled by:** lattica-claude (Pass v0.3.5r — Federation Design Compile)
**Status:** REVIEW-PENDING — do not commit until developer + web-claude approval

---

## Compile Discipline

This document applies **faithful-relay-first** discipline:

- Source estimates and positions are relayed verbatim. When a project's federation_design.md states a design, that position is reproduced here without paraphrase.
- Synthesis observations added during compilation are explicitly labeled **[lattica-claude observation]**.
- Where source documents contain discrepancies, both positions are recorded and the resolution (or open status) is noted.
- Locked decisions are decisions that appear settled across all relevant projects — they are labelled with the ratification count. "Locked" here means no project raised an objection during the federation round; it does not mean permanently frozen.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Locked Architectural Decisions](#2-locked-architectural-decisions)
3. [GraphSnapshotAvailable — Final Schema](#3-graphsnapshotavailable-final-schema)
4. [Causation ID Protocol — S-030 and S-031 Corrections](#4-causation-id-protocol-s-030-and-s-031-corrections)
5. [Relay Agent — Reference Implementation](#5-relay-agent-reference-implementation)
6. [Per-Project Federation Summary](#6-per-project-federation-summary)
7. [Needs-Wiring Consolidated View](#7-needs-wiring-consolidated-view)
8. [Shipped Infrastructure Inventory](#8-shipped-infrastructure-inventory)
9. [Implementation Sequencing — 7 Waves](#9-implementation-sequencing-7-waves)
10. [Deferred Items](#10-deferred-items)
11. [Compile-Time Issues and Methodology Notes](#11-compile-time-issues-and-methodology-notes)
12. [Cross-Pollination](#12-cross-pollination)
13. [Dependency Requests and Wiring Needs](#13-dependency-requests-and-wiring-needs)

---

## 1. Executive Summary

The 2026-06-16 federation round completed a single synchronous design interview across six Claude instances (Cerebra, LumaWeave, Policy Scout, ai-stack, Fossic, Lattica). The goal was to convert the v2 platform baseline and its 34 settled items into per-project implementation designs — concrete stream names, relay filter logic, indexed_tags schemas, causation chain topology, and wiring gaps.

**What the round accomplished:**

- All nine items on the §8 federation interview agenda reached resolution.
- The S-030 spec error (dangling causation_id reference) was caught, analyzed, and corrected via addendum before any relay agents were implemented. The corrected `_translate_causation_id` helper is the canonical implementation across all projects.
- The S-031 misframing was resolved: relay agents do not need GraphSnapshotAvailable awareness. The application layer (LumaWeave) sets `causation_id = hub_GSA.id` at emit time; relay passes through naturally.
- D.3 (conditional stream-ID strip rule) reached 5-of-5 ratification.
- The GraphSnapshotAvailable schema reached its final locked shape (5 required fields, 2 optional, 1 stream target).
- Fossic shipped relay.py (134 total tests, 23 relay tests). Policy Scout shipped Pass D (4 scan contracts, 29 tests) and Pass E (fossic emit live, two streams, indexed_tags).
- Cerebra's CORS issue was discovered and fixed (daemon.py:188), unblocking the Tauri webview → Cerebra channel.
- The Bo fold-in decision was settled: discord-bot is absorbed into Cerebra; ai-stack scope narrows to GPU infrastructure.

**What the round did NOT accomplish:**

- Relay agents for Cerebra, LumaWeave, and ai-stack are unwritten.
- indexed_tags are not yet wired in Cerebra, LumaWeave, or ai-stack.
- Bo fold-in pass is pending.

**[lattica-claude observation]** The round produced an unusually high ratio of corrections to new designs — S-030, S-031, the `branch=None` silent loss, the four pyo3 API errors in the original relay pseudocode, the "dual-cause VRAM" framing, the CORS issue — all caught before code shipped (except CORS, which was already live). This is the expected pattern when a careful gather pass precedes writing.

---

## 2. Locked Architectural Decisions

### 2.1 D.3 — Conditional Stream-ID Strip Rule

**Ratification: 5-of-5 (Cerebra proposer, ai-stack Round 2, LumaWeave C.8, Policy Scout explicit, Fossic relay.py encoded, Lattica B.5)**

When the relay agent maps a local stream ID to its hub-side stream ID:

```python
def _hub_stream_id(self, local_stream_id: str) -> str:
    prefix = self.config.source_prefix + "/"
    if local_stream_id.startswith(prefix):
        return local_stream_id        # already prefixed — use as-is
    return f"{prefix}{local_stream_id}"  # prepend source_prefix/
```

**Rationale (source: Cerebra proposer — relayed verbatim):** Stream IDs within a project may already be namespaced with the project prefix (e.g., `cerebra/graph/<lineage_id>`). A naive unconditional prepend would produce `cerebra/cerebra/graph/...`. The conditional strip avoids double-prefixing without requiring all local streams to be prefix-free.

**Scope:** All relay agents across all projects. This logic is encoded in Fossic's `RelayAgent._hub_stream_id` and is the canonical implementation. Other relay agents copy this pattern.

**Source references:** Cerebra fed design §D.3; ai-stack fed design §D.3; LumaWeave fed design §C.8; Fossic fed design §B.1 (`RelayAgent._hub_stream_id`); Lattica fed design §B.5.

---

### 2.2 Two-Case Causation Model

**Settled across: Cerebra, Fossic, Lattica (primary proposers); LumaWeave, Policy Scout (consumers)**

Hub events have two causation-traversal cases:

**Case 1:** Hub event was caused by a local event that was NOT relayed. `walk_causation` on the hub fails (the causing event is not in the hub store). Resolution: use the `source_store` indexed_tag on the hub event to route to the originating project's local vault store, fetch the event there.

**Case 2:** Hub event was caused by another hub event (the causing event was relayed, or was written hub-direct). `walk_causation` on the hub succeeds; no local-store hop required.

**Implications:**
- Relay agents MUST write `source_store` as an indexed_tag on every relayed event. The value is the originating project's name identifier string (e.g. `"cerebra"`, `"lumaweave"`) — set by `relay_append` as `source_prefix`. This is NOT a file path. Hub consumers routing on `source_store` treat it as a project name; Case 1 traversal requires a separate path-lookup to locate the remote vault store.
- Hub consumers that render causation chains must handle both cases.
- Lattica's cross-substrate causation rendering (dashed arcs + inline popover) implements Case 1 traversal via `fossic_query_remote_store` Tauri command (future implementation item — no phase assigned in Lattica's design).

**Source references:** Fossic fed design §B.3 (two-case model definition); Lattica fed design §D (cross-substrate causation rendering design).

---

### 2.3 Hub Store Path

**Settled: CLOSED (confirmed by Lattica lib.rs:133)**

```
~/.lattica/fossic/store.db
```

This path is stable across sessions. The value is encoded in `src-tauri/src/lib.rs:133`.

Relay agents from all projects configure `hub_store_path = "~/.lattica/fossic/store.db"` (or the resolved absolute equivalent) in their `RelayConfig`.

**Source references:** LumaWeave needs-wiring item 4 (closed); Lattica outbound to LumaWeave hub-store-concurrent-access-confirmed.md.

---

### 2.4 Per-Project Relay Agent Ownership

**Settled: all 5 active projects aligned**

Each project's relay agent lives in that project's own source tree. Rationale (source: Fossic fed design — relayed verbatim): the relay agent imports from the project's own store schema and must understand the project's event types to apply the relay filter correctly. Co-locating the relay agent with its project avoids the schema-coupling problem.

**Locations:**
- `cerebra/cerebra-relay.py` (not yet written)
- `lumaweave/lumaweave-relay.py` (not yet written)
- `policy-scout/policy-scout-relay.py` (not yet written)
- `ai-stack/ai-stack-relay.py` (not yet written)
- Fossic's relay agent is implemented as a library: `relay.py` (shipped)

**Source references:** Fossic fed design §B (RelayAgent/RelayConfig as exportable class); Cerebra fed design §B.3; Policy Scout post-federation-impl-briefing (relay agent unwritten, pending).

---

### 2.5 Snapshot-on-Subscribe (Cold-Start Pattern)

**Settled: Fossic recommended; Lattica endorsed; other projects consume**

When a subscriber connects to a hub stream, it requests the current snapshot before receiving incremental events. This is the canonical cold-start pattern.

Three canonical cold-start scenarios documented across the federation round:

| Project | Event | Cold-start snapshot |
|---|---|---|
| ai-stack/gpu | `VramBudgetChanged` | last known GPU metrics |
| LumaWeave | `SourceLoaded` | last source that was successfully loaded |
| Policy Scout | `DecisionIssued` | last governance decision |

**Source references:** Fossic fed design §C (snapshot-on-subscribe recommendation); Lattica fed design §B.6 (§8.6 — snapshot-on-subscribe preference).

---

### 2.6 Hub Store Concurrent Access Safety

**Settled: confirmed by Fossic IPC safety answer 2026-06-16**

Multiple processes may open the hub store simultaneously. `Store.open()` on the hub produces an independent `Arc<StoreInner>` tree. WAL-mode SQLite handles concurrent readers + writers across processes.

**Critical rule for non-owned stores:** Any project opening a store it does not own (e.g., Lattica opening Cerebra's vault) MUST use `OpenOptions(on_first_open="require_existing")`. Without this, `Store.open()` defaults to `CreateIfMissing` and silently creates an empty database at the target path.

```python
from fossic import Store, OpenOptions

remote = Store.open(
    "~/.cerebra/.fossic/store.db",
    OpenOptions(on_first_open="require_existing"),
)
# Raises StoreNotFoundError if path doesn't exist — correct signal for "not yet initialized"
```

**Source references:** Fossic IPC safety answer (outbound/2026-06-16_lattica_to_fossic_multi-store-ipc-safety.md).

---

### 2.7 Branch Field Semantics — Never Pass None

**Settled: Fossic (W-003 fix); confirmed by Policy Scout Pass E**

`Append.branch` is `String` (not `Option<String>`). Passing `branch=None` does NOT default to `"main"` — it raises a `TypeError` at the pyo3 boundary, which is silently swallowed by the `try/except` in the emit helper. The event is silently lost.

**Rule:** Always pass `branch=event.branch` when relaying, or hardcode `branch="main"` if branch context is unavailable. Never pass `None`.

This was caught in Policy Scout's Pass E (W-003 resolution) and confirmed in Fossic's relay.py implementation.

**Source references:** Policy Scout fed design §W-003; Fossic fed design §B (relay_append implementation); Policy Scout post-federation-impl-briefing (Pass E shipped).

---

### 2.8 Cerebra as Model Master

**Settled: Cerebra and ai-stack both confirmed; corrects v2 "dual-cause VRAM" framing**

Cerebra is the master of model loading decisions. Ollama is the inference substrate. LiteLLM is downstream of Cerebra's routing. The v2 framing ("two independent VRAM consumers") was incorrect — it implied LiteLLM and Cerebra consume VRAM in parallel as equals. The correct framing: Cerebra routes to Ollama; LiteLLM calls Ollama for external-compatible routes. Cerebra's routing layer governs what is loaded.

**Source references:** Cerebra fed design §A (model master framing); ai-stack fed design §A.2.1 (dual-cause VRAM correction).

---

### 2.9 Bo Fold-In — discord-bot Absorbed by Cerebra

**Settled: Cerebra and ai-stack both confirmed**

The discord-bot project (Bo) is folded into Cerebra. Bo's comms interface logic moves into Cerebra's daemon. ai-stack's scope narrows to GPU infrastructure only.

**Implications for federation:**
- `bot/*` streams become `cerebra/bot/lifecycle` and `cerebra/bot/conversation/<channel_id>` after fold-in. `TOPOLOGY_ALIASES` (`bot-local`, `bot-escalated`) are LiteLLM routing aliases — they remain unchanged and are distinct from fossic stream names. `bot-local` alias may go dormant post-fold-in once Bo is absorbed.
- Bo relay filter is subsumed into Cerebra's relay filter post fold-in.
- discord-bot archival pass is pending (not yet committed).
- The ai-stack `AiStackTopologyTile` BO node is now live (wired to Cerebra daemon via CORS-fixed endpoint).

**Source references:** Cerebra fed design §C (Bo fold-in classification table); ai-stack fed design §A.1 (Bo out of scope); ai-stack outbound to Cerebra binding-question-topology-aliases.md.

---

## 3. GraphSnapshotAvailable — Final Schema

**Status: LOCKED (all 6 projects aligned)**

### 3.1 Required Fields

| Field | Type | Source | Notes |
|---|---|---|---|
| `lineage_id` | `str` | Cerebra | Graph identity — stable identifier for a graph lineage across re-exports |
| `snapshot_ref` | `str` | Cerebra | Absolute path to `.cerebra/graph.json` |
| `graph_version` | `int` | Cerebra | Monotonically incrementing. LumaWeave calls this `event_seq` in its consumer code — same field. |
| `content_hash` | `str` | Cerebra | sha256 of the snapshot file. **NEW — not in v2.** Added during federation round. |
| `triggered_by` | `str` | Cerebra | Hex event_id of the ingest event that triggered this snapshot export. **NEW — not in v2.** |

### 3.2 Optional Fields

| Field | Type | Source | Notes |
|---|---|---|---|
| `cerebra_session_id` | `str` | Cerebra | Ties snapshot to the cognitive cycle; provenance for LumaWeave tile display. |
| `schema_version` | `str` | LumaWeave proposed | Compatibility check. Cerebra's graph.json already carries `"schema": "cerebra/v1"`. |

### 3.3 Dropped Fields

| Field | Reason |
|---|---|
| `adapter_id` | Not available at vault scope. Cerebra's export is vault-wide (mixed parser adapters); no single adapter identity exists at graph export time. `cerebra_session_id` + `lineage_id` provide sufficient provenance. (Confirmed: Cerebra response to Lattica outbound gsa-adapter-id-field-question.md) |
| `node_count` | Not in Cerebra's design. Cerebra did not propose it; it was in LumaWeave's initial schema proposal only. Not needed once `content_hash` enables skip-load decisions. |

### 3.4 Stream Target

```
cerebra/graph/<lineage_id>
```

One stream per graph lineage. Multiple lineages → multiple streams.

### 3.5 Write Mechanism

Cerebra `EventEmitter` writes hub-DIRECT (not via relay). The `GraphSnapshotAvailable` event goes directly to `~/.lattica/fossic/store.db` without passing through `cerebra-relay.py`. This is intentional: GSA is a platform event (hub-level) not a local Cerebra-internal event.

**[lattica-claude observation]** This means `cerebra-relay.py` has no special handling for `GraphSnapshotAvailable` — that event is already on the hub when relay starts. The relay agent's filter should exclude `GraphSnapshotAvailable` (or Cerebra's `cerebra/graph/*` streams) from relay processing to avoid double-writes.

### 3.6 Python Dataclass (Cerebra canonical)

```python
@dataclass
class GraphSnapshotAvailable:
    lineage_id: str          # graph identity
    snapshot_ref: str        # absolute path to .cerebra/graph.json
    graph_version: int       # monotonically incrementing (LumaWeave: event_seq)
    content_hash: str        # sha256 — NEW
    triggered_by: str        # hex event_id of triggering ingest event — NEW
    source_prefix: str       # "cerebra" (optional per Lattica/LumaWeave; emitter's choice)
    # Optional:
    cerebra_session_id: str | None = None
    schema_version: str | None = None
```

**Source references:** Cerebra fed design §B.4; LumaWeave fed design §B.3; Lattica fed design §B.6; LumaWeave fed follow-up item 2; Cerebra GSA adapter-id response.

---

## 4. Causation ID Protocol — S-030 and S-031 Corrections

### 4.1 S-030 — Original Spec Error

**Source: Fossic addendum (primary analysis); Cerebra addendum (endorsement)**

The original v2 relay pseudocode contained:

```python
# WRONG — original v2 S-030 spec:
hub_store.append(stream_id=hub_stream, payload=event.payload(), causation_id=event.id, ...)
```

This is incorrect. `event.id` is the local event's own ID — a primary key in the local store. It has never been written to the hub store. Using it as `causation_id` on the hub event creates a dangling reference: any hub-side `walk_causation` call will fail to find the event with that ID.

### 4.2 _translate_causation_id — Corrected Implementation

**Proposed by: Fossic addendum. Endorsed by: Cerebra addendum. Encoded in: Fossic relay.py.**

```python
def _translate_causation_id(
    local_store,
    hub_store,
    source_prefix: str,
    local_causation_id,
) -> EventId | None:
    """
    Three cases:
    1. local_causation_id is None → chain starts here; return None
    2. local_causation_id resolves in local_store → event was local; look up its hub copy
       by external_id and return the hub event's primary ID
    3. local_causation_id does NOT resolve in local_store → it is already a hub ID
       (cross-store causation from a hub-direct event like GSA); pass through as-is
    """
    if local_causation_id is None:
        return None

    local_cause = local_store.read_one(local_causation_id)
    if local_cause is None:
        # Case 3: already a hub ID — cross-store causation, pass through
        return local_causation_id

    # Case 2: local event — look up its hub copy
    hub_stream = _hub_stream_id(source_prefix, local_cause.stream_id)
    hub_cause = hub_store.read_by_external_id(hub_stream, local_causation_id.hex())
    if hub_cause is not None:
        return hub_cause.id  # translate: local ID → hub primary ID

    # Cause event not yet relayed — case-1 fallback
    # Return local ID; hub consumer uses source_store indexed_tag to fetch it
    return local_causation_id
```

**API notes (pyo3 boundary — corrected from addendum pseudocode):**
- `read_by_external_id` takes `(stream_id, external_id)` — both arguments required.
- `event.payload()` not `event.deserialize_payload_json()`.
- `event.indexed_tags()` is a method call (parens required), not a property.
- `StorageError` not `StoreConnectionError` for reconnect error handling.

### 4.3 Corrected relay_event() — Full Method

The corrected relay loop (from Fossic relay.py, used as the canonical reference for all relay agents):

```python
def relay_event(self, event) -> bool:
    """Returns True if relayed, False if filtered or already present."""
    if not self._should_relay(event):
        return False

    # D.3 must run before idempotency check — read_by_external_id needs hub stream_id
    hub_stream_id = self._hub_stream_id(event.stream_id)

    if self.hub_store.read_by_external_id(hub_stream_id, event.id.hex()) is not None:
        return False  # already relayed — idempotency guard

    relay_append(
        local_store=self.local_store,
        hub_store=self.hub_store,
        event=event,
        source_prefix=self.config.source_prefix,
        hub_stream_id=hub_stream_id,
        payload=event.payload(),
    )
    return True

def _should_relay(self, event) -> bool:
    """Empty relay_filter relays all event_types; non-empty is an allowlist."""
    if not self.config.relay_filter:
        return True
    return event.event_type in self.config.relay_filter
```

### 4.4 S-031 — Causation Chain for GraphSnapshotAvailable → SourceLoaded

**Source: LumaWeave outbound binding question; resolved as Option A**

The original S-031 text stated: relay agent needs special GraphSnapshotAvailable awareness to set `causation_id` correctly. This framing was wrong.

**Correct framing (Option A, settled):** This is an application-layer obligation at LumaWeave. When LumaWeave's frontend receives a `GraphSnapshotAvailable` hub event and decides to load it, it calls `lw_emit_source_loaded` with `causation_id = hub_GSA.id` (the hub event's primary ID). The relay agent then propagates this `causation_id` to the hub copy of `SourceLoaded` via `_translate_causation_id` (Case 3 — it is already a hub ID, pass through as-is).

**Why this works:**
- LumaWeave sets `causation_id` at emit time to a hub-direct event ID.
- `_translate_causation_id` Case 3 handles this: `local_store.read_one(hub_GSA.id)` returns `None` (hub IDs are not in the local store). The function passes `hub_GSA.id` through unchanged.
- The hub `SourceLoaded` event carries `causation_id = hub_GSA.id`. Hub `walk_causation` succeeds. Case 2 — fully hub-traversable.

**Source references:** LumaWeave outbound binding-question-s031-causation-relay.md; Fossic addendum §S-031 Option A resolution.

---

## 5. Relay Agent — Reference Implementation

### 5.1 RelayConfig and RelayAgent (Fossic canonical)

All relay agents across all projects MUST follow this interface. Fossic's implementation is the canonical reference.

```python
@dataclass
class RelayConfig:
    local_store_path: str          # absolute path to project's local fossic store
    hub_store_path: str            # "~/.lattica/fossic/store.db"
    source_prefix: str             # e.g. "cerebra", "lumaweave", "policy-scout"
    subscribe_pattern: str         # glob passed to local_store.subscribe()
    relay_filter: set[str] = field(default_factory=set)
    # Empty set = relay all event_types; non-empty = allowlist by event_type string
    batch_size: int = 50
    reconnect_delay_ms: int = 5000
    max_retry_attempts: int = 5
    retry_backoff_base_ms: int = 100


class RelayAgent:
    def __init__(self, config: RelayConfig):
        self.config = config
        self.local_store: Store | None = None
        self.hub_store: Store | None = None

    def _hub_stream_id(self, local_stream_id: str) -> str:
        """D.3 conditional strip rule — 5-of-5 ratified."""
        prefix = self.config.source_prefix + "/"
        if local_stream_id.startswith(prefix):
            return local_stream_id
        return f"{prefix}{local_stream_id}"

    def relay_event(self, event) -> bool:
        """Relay a single event. See §4.3 for full implementation."""
        ...

    def run(self) -> None:
        """Main relay loop with reconnect handling."""
        ...
```

### 5.2 relay_append Helper

For projects that want a functional rather than class-based API:

```python
def relay_append(
    local_store: Store,
    hub_store: Store,
    event,
    source_prefix: str,
    hub_stream_id: str,   # D.3 already applied by caller
    payload,              # event.payload() already called by caller
    extra_indexed_tags: dict | None = None,
) -> None:
    hub_causation = _translate_causation_id(
        local_store, hub_store, source_prefix, event.causation_id
    )
    hub_store.append(
        Append(
            stream_id=hub_stream_id,
            event_type=event.event_type,
            payload=payload,
            causation_id=hub_causation,
            external_id=event.id.hex(),
            branch=event.branch,          # NEVER pass None — raises TypeError at pyo3 boundary
            type_version=event.type_version,
            indexed_tags={
                **(event.indexed_tags() or {}),   # or {} guard: indexed_tags() returns Optional[dict]
                **(extra_indexed_tags or {}),
                "source_store": source_prefix,    # project name string, e.g. "cerebra" — NOT a file path
            },
        )
    )
```

### 5.3 Relay Filter Pattern

Two patterns are available, depending on the project's filtering requirements:

- **`set[str]` in `RelayConfig.relay_filter`** — simple event-type allowlist. The base `RelayAgent._should_relay()` checks `event.event_type in self.config.relay_filter`. Empty set = relay all. Use this when filtering can be expressed as a fixed set of event type names.
- **`RelayAgent._should_relay()` override** — for stream-ID-based or payload-conditional logic that cannot be expressed as an event-type set. Set `relay_filter=set()` in `RelayConfig` and subclass `RelayAgent`, overriding `_should_relay(self, event) -> bool`. The base `relay_event()` calls `_should_relay` before the idempotency check; the subclass only overrides the gate.

**ai-stack relay filter (per CP-AS-1 — set pattern, no subclass needed):**

```python
cfg = RelayConfig(
    local_store_path="~/Projects/ai-stack/.fossic/store.db",
    hub_store_path="~/.lattica/fossic/store.db",
    source_prefix="ai-stack",
    subscribe_pattern="ai-stack/**",
    relay_filter={"VramBudgetChanged", "ModelLoaded", "ModelUnloaded",
                  "SidecarStarted", "SidecarStopped"},
)
# No _should_relay override needed — all three ai-stack streams map cleanly to
# relay/no-relay by event_type name alone. (CP-AS-1)
```

**LumaWeave relay filter (per CP-LW-1 — set pattern, no subclass needed):**

```python
cfg = RelayConfig(
    local_store_path="<project_root>/.lumaweave/fossic.db",
    hub_store_path="~/.lattica/fossic/store.db",
    source_prefix="lumaweave",
    subscribe_pattern="lumaweave/**",
    relay_filter={"SourceLoaded", "SourceLoadFailed", "SourceSwitched",
                  "GraphLayoutSettled"},
)
# No _should_relay override needed. (CP-LW-1)
```

**Policy Scout relay filter (per CP-F-3, CP-PS-1, CP-PS-2 — _should_relay() override):**

PS's filter requires payload inspection: `DecisionIssued` appears in both relay-it and keep-local outcomes depending on payload content (`DENY_AND_ALERT` or `critical` risk_band relay; routine cases stay local). `CommandRequested` has no relay path — it always stays local (see "Stays local" note below). `relay_filter=set()` (relay-all gate disabled); override `_should_relay`:

```python
ALWAYS_RELAY_TYPES = {
    "LockdownActivated",
    "LockdownDeactivated",
    "WatchDaemonStarted",    # posture stream — startup confirmation
    "WatchDaemonStopped",    # posture stream — all transitions relay
    "ApprovalRequested",     # time-sensitive HITL event
    "ApprovalApprovedOnce",  # closes pending approval state in hub
    "ApprovalDeniedOnce",    # closes pending approval state in hub
}

class PolicyScoutRelayAgent(RelayAgent):
    def _should_relay(self, event) -> bool:
        if event.event_type in ALWAYS_RELAY_TYPES:
            return True
        # High-severity decisions from audit stream — payload-conditional
        if event.event_type == "DecisionIssued":
            payload = event.payload()   # NOT deserialize_payload_json() — method does not exist
            return (payload.get("decision") == "DENY_AND_ALERT"
                    or payload.get("risk_band") == "critical")
        return False
```

**Stays local (no relay):** `CommandRequested` (high-frequency; payload at this stage carries only the raw command string — no decision or risk_band field; those are set later by `CommandClassified` and `DecisionIssued` respectively), `CommandParsed`, `CommandClassified`, `PolicyMatched`, `PolicyError`, routine `DecisionIssued` (non-critical/non-DENY_AND_ALERT), `ApprovalExpired` (see §B.4 of PS fed design).

**Cerebra relay filter (per Cerebra fed design §B.2, CP-C-5 — _should_relay() override):**

Filter is stream-based, not event-type-based. `event.stream_id` is confirmed available on `StoredEvent` (CP-F-5). `relay_filter=set()` (relay-all gate disabled); override `_should_relay`:

```python
class CerebraRelayAgent(RelayAgent):
    def _should_relay(self, event) -> bool:
        # Cycle events — relay
        if event.stream_id.startswith("cerebra/agent-trace/"):
            return True
        # Lattice ingest events — relay
        if event.stream_id.startswith("cerebra/lattice/"):
            return True
        # Bot streams — relay post-fold-in
        if event.stream_id.startswith("cerebra/bot/"):
            return True
        # cerebra/graph/* written hub-DIRECT — DO NOT relay (avoids double-write)
        if event.stream_id.startswith("cerebra/graph/"):
            return False
        # cerebra/control — local daemon management only; NOT relayed
        if event.stream_id == "cerebra/control":
            return False
        return False
```

Confirmed event_type names for cerebra/agent-trace/* and cerebra/control are listed in §12.1 CP-C-7. The stream-namespace filter remains preferable as it covers all events without enumerating types.

### 5.4 Reconnect Loop Pattern

From Fossic relay.py (canonical):

```python
def run(self) -> None:
    # Import here to avoid circular import (Store imported at module level
    # triggers __init__.py → relay.py loop)
    from fossic import Store

    while True:
        try:
            self.local_store = Store.open(self.config.local_store_path)
            self.hub_store = Store.open(self.config.hub_store_path)
            # Both stores use default CreateIfMissing — Store has no .close() method (RAII)
            with self.local_store.subscribe(self.config.subscribe_pattern) as sub:
                for event in sub:
                    self._relay_with_retry(event)
        except StorageError as exc:  # NOT StoreConnectionError
            time.sleep(self.config.reconnect_delay_ms / 1000)
        except Exception:
            raise
```

**Note on import:** The `from fossic import Store` import inside `run()` (not at module level) is intentional. Moving it to module level triggers a circular import: `fossic/__init__.py` imports from `relay.py` which imports `Store` from `fossic/__init__.py`. Using `TYPE_CHECKING` for the annotation and deferring the runtime import to `run()` resolves this.

**Note on Store lifecycle:** `Store` has no `.close()` method — connections are managed via RAII and released when the store is garbage collected. Do not call `.close()`.

### 5.5 Hub Readiness

`Store.open()` default policy is `CreateIfMissing`. It calls `create_dir_all(parent)` and creates the SQLite file if absent — both stores open successfully regardless of startup order. No `StoreNotFoundError` will be raised with default options. The reconnect loop catches `StorageError` for genuine I/O failures (disk full, WAL corruption, locked file). No separate handshake protocol is needed.

**[lattica-claude observation]** This means relay agents can be started independently of the Tauri app startup order. The reconnect loop is the only coordination mechanism needed.

---

## 6. Per-Project Federation Summary

### 6.1 Fossic

**Role:** Local event store library. Provides `Store`, `Append`, `RelayConfig`, `RelayAgent`, `relay_append`, `run_relay` exports. The canonical relay implementation.

**Stream model:** One store per project. Hub store at `~/.lattica/fossic/store.db`. Project vault stores at project-specific paths (e.g., `<project_root>/.fossic/store.db`).

**Relay status:**
- ✅ `relay.py` shipped (134 total tests, 23 relay tests)
- ✅ `RelayConfig`, `RelayAgent`, `relay_append`, `run_relay` exported
- ✅ `_translate_causation_id` implemented (S-030 correction)
- ✅ D.3 encoded in `_hub_stream_id`
- ✅ 4 pyo3 API errors corrected before shipping

**Resolved needs-wiring items (all 7 closed):**
- NW-001: D.3 ratified ✅
- NW-002: `event.payload()` confirmed — method call, returns dict ✅
- NW-003: `read_by_external_id(stream_id, external_id)` confirmed — both args required ✅
- NW-004: Hub path confirmed — `~/.lattica/fossic/store.db` ✅
- NW-005: `event.indexed_tags()` confirmed — method call (parens required), returns `Optional[dict]` ✅
- NW-006: `StorageError` confirmed — correct exception class (`StoreConnectionError` does not exist) ✅
- NW-007: `event.branch` confirmed — `#[getter]` returning `&str`; always a non-None string on stored events ✅

**Source references:** Fossic fed design (579 lines); Fossic addendum causation_id (145 lines); Fossic needs-wiring (7 items).

---

### 6.2 Cerebra

**Role:** Memory/knowledge layer, model master, graph exporter, Bo fold-in target. Writes `GraphSnapshotAvailable` hub-DIRECT.

**Streams:**
- `cerebra/agent-trace/<session_id>` — cycle events; auto-causation chained via EventEmitter; RELAYED
- `cerebra/lattice/<lineage_id>` — lattice ingest events; RELAYED
- `cerebra/control` — PostureChanged; local daemon management only; NOT relayed
- `cerebra/graph/<lineage_id>` — hub-direct (GSA only; not via relay path)
- `cerebra/bot/lifecycle` — post-fold-in; BotStarted, BotStopped
- `cerebra/bot/conversation/<channel_id>` — post-fold-in; LlmCallAttempt, ResponseGenerated

**Relay status:**
- ❌ `cerebra-relay.py` not written
- ❌ `indexed_tags` not yet wired in Cerebra events
- ❌ Bo fold-in pass pending
- ✅ CORS fix shipped (daemon.py:188, `_send_json`, 4 endpoints)
- ✅ hub-direct GSA write mechanism designed (EventEmitter)

**Open needs-wiring items:**
- NW-1: `CEREBRA_GRAPH_STREAM` constant definition location
- NW-2: `bot/*` stream migration plan (post fold-in)
- NW-3: `FOSSIC_STORE_PATH` vs `FossicStore.at_platform_path()` API choice [CLOSED — CP-F-9: `FossicStore.at_platform_path()` does not exist in fossic-py; use `Store.open("~/.lattica/fossic/store.db")` directly]

**Source references:** Cerebra fed design (388 lines); Cerebra addendum causation_id (116 lines); Cerebra post-federation briefing; Cerebra needs-wiring (3 items).

---

### 6.3 LumaWeave

**Role:** Primary Lattica UI; graph visualization; consumer of `GraphSnapshotAvailable`; emitter of source lifecycle events.

**Streams:**
- `lumaweave/graph/events` — SourceLoaded, SourceLoadFailed, SourceSwitched, GraphLayoutSettled

**Local store:** `<project_root>/.lumaweave/fossic.db`

**Relay status:**
- ❌ `lumaweave-relay.py` not written
- ❌ `indexed_tags` not wired (items 1-3 open: adapter_id, source_key, dialect_id)
- ✅ S-031 Option A confirmed (application-layer causation_id assignment)
- ✅ Hub store path confirmed (§8.5, lib.rs:133)
- ✅ Local store path: `<project_root>/.lumaweave/fossic.db` — no migration needed; current path IS the post-federation canonical path (source: LumaWeave fed design §B.1, §B.4, needs-wiring item 6)

**Open needs-wiring items (8 total):**
- Item 1: `indexed_tags` missing: adapter_id, source_key on source events (OPEN)
- Item 2: `indexed_tags` missing: dialect_id on GraphLayoutSettled (OPEN)
- Item 3: `dialect_id` missing from GraphLayoutSettled command signature (OPEN)
- Item 4: Hub store path in relay agent config (CLOSED — `~/.lattica/fossic/store.db`)
- Item 5: S-031 causation_id relay behavior (CLOSED — Option A)
- Item 6: Local store path (informational — correct as-is)
- Item 7: Hard-coded stream name constant (informational — correct as-is)
- Item 8: SourceSwitched missing to_source_key (OPEN/optional — not a relay blocker)

**GraphSnapshotAvailable consumption requirements (from LumaWeave fed design §B.3):**
LumaWeave subscribes to `cerebra/graph/<lineage_id>` on the hub. On receipt, it:
1. Checks `graph_version` (event_seq in LumaWeave consumer) — skip if older than loaded version
2. Optionally checks `content_hash` — skip if identical to current
3. Reads snapshot file at `snapshot_ref` path
4. Emits `SourceLoaded` with `causation_id = hub_GSA.id` (S-031 Option A)

**Broken-pending tile elements (from LumaWeave fed design §C.1 — relayed verbatim):**

| Tile element | What blocks live data | Bake in as broken-pending? |
|---|---|---|
| Graph health pill (LOADED / FAILED / LOADING / IDLE) | Migration to hub + relay agent live | Yes |
| Node/edge count badge | Migration to hub | Yes |
| Active source label | Migration to hub | Yes |
| Active dialect indicator | Migration to hub + dialect_id in GraphLayoutSettled | Yes |
| Source switcher dropdown | `AdapterListChanged` event + migration + relay agent | Yes |
| Re-settle button | `reheat()` impl + reverse channel API | Yes |
| Layout freeze toggle | Reverse channel API | Yes |
| Physics preset write | Reverse channel API + shared store | Yes |
| Cerebra graph snapshot row (in source switcher) | `GraphSnapshotAvailable` receive path built | Yes |
| GraphLayoutSettled activity indicator (SETTLING / SETTLED) | gwells convergence detection + `GraphLayoutSettled` frontend mount | Yes |
| Cold-start snapshot seeding | Relay agent live + fossic snapshot adoption | Yes — tile shows stale/loading state on subscribe until snapshot or first event |

**Source references:** LumaWeave fed design (361 lines); LumaWeave needs-wiring (8 items); LumaWeave post-federation follow-up; LumaWeave outbound S-031 binding question.

---

### 6.4 Policy Scout

**Role:** Governance daemon. Emits scan and decision events. First project besides Fossic with shipped relay infrastructure.

**Streams:**
- `policy-scout/audit/<request_id>` — CommandRequested, CommandParsed, CommandClassified, DecisionIssued, ApprovalRequested, ApprovalApprovedOnce, ApprovalDeniedOnce (per-request governance events)
- `policy-scout/posture` — LockdownActivated, LockdownDeactivated, WatchDaemonStarted, WatchDaemonStopped

**Relay status:**
- ✅ `indexed_tags` shipped (Pass E — all posture and audit events carry indexed_tags)
- ✅ fossic emit live (Pass E)
- ✅ Two-stream design shipped
- ✅ W-003 (branch field) resolved in Pass E
- ❌ `policy-scout-relay.py` not written

**Needs-wiring items (4 total — all resolved):**
- W-001: `upstream_causation_id` redaction survival — RESOLVED (`_EXEMPT_KEYS` added to `redaction.py`; hex EventId bypasses regex patterns and reaches `_emit_to_fossic()` intact)
- W-002: `indexed_tags` parameter accepted by installed fossic-py `Append` — RESOLVED (confirmed: `Append` signature includes `indexed_tags=None` default)
- W-003: `branch=None` silent loss — RESOLVED (confirmed: omitting branch stores as `"main"`; no code change needed)
- W-004: Posture stream routing — RESOLVED (confirmed Pass E: `LockdownActivated`/`LockdownDeactivated` arrive via `write_event()`, `_emit_to_fossic()` routes them to `policy-scout/posture` before the `request_id` guard)

**Pass D shipped (from Policy Scout post-federation-impl-briefing — relayed verbatim):**
- 4 scan CLI JSON Schema contracts defined
- 29 contract + CLI tests added

**Pass E shipped:**
- fossic emit live for both audit and posture streams
- indexed_tags on all emitted events
- W-003 confirmed (omit branch → stored as `"main"`; no code change needed)
- Two-stream routing implemented in `_emit_to_fossic()` (posture events → `policy-scout/posture`; governance events → `policy-scout/audit/<request_id>`)

**Source references:** Policy Scout fed design (435 lines); Policy Scout needs-wiring (4 items); Policy Scout post-federation briefing.

---

### 6.5 ai-stack

**Role:** GPU infrastructure (Ollama + LiteLLM + Open WebUI). Scoped to infra only after Bo fold-in clarification.

**Streams:**
- `ai-stack/gpu` — VramBudgetChanged (live in sidecar)
- `ai-stack/models` — ModelLoaded, ModelUnloaded (live in sidecar)
- `ai-stack/lifecycle` — SidecarStarted, SidecarStopped (proposed; not yet implemented)
- ~~`ai-stack/services`~~ — does not exist; ServiceUp/ServiceDown deferred to Phase 2b (not in scope)

**Relay status:**
- ❌ `ai-stack-relay.py` not written
- ❌ `indexed_tags` not shipped
- ❌ local store migration from sidecar → project-local pending (standalone pass required per ai-stack fed design)
- ✅ BO node repurposed (now wired to Cerebra daemon)
- ✅ D.3 confirmed
- ✅ CORS fix implication handled (AiStackTopologyTile BO node now live)

**Open needs-wiring items (5 total):**
- Item 1: `TOPOLOGY_ALIASES` hardcoded set — RESOLVED HIGH confidence (Cerebra confirmed alias names stable; constant unchanged)
- Item 2: `DEFAULT_VRAM_TOTAL_MB = 12_282` — HIGH confidence, low risk; Phase 2 cleanup (tile reads `total_bytes` from hub event payload instead)
- Item 3: BO node stale references — RESOLVED (BO node wired to Cerebra daemon at :7432; CORS fix verified live)
- Item 4: `FOSSIC_STORE_PATH` pointing to shared hub — CLOSED via CP-F-8 (no path convention imposed by fossic; `~/Projects/ai-stack/.fossic/store.db` confirmed fine; migration pass unblocked per DEP-AS-1)
- Item 5: `VRAM_WARN_PCT_THRESHOLD` (to be added) — CLOSED alignment — 90% per CP-C-6; indexed_tags pass pending (DEP-AS-2)

**4 changes shipped (ai-stack post-federation briefing):**
1. BO node wired to Cerebra daemon endpoint — `GET /status` at :7432; verified live
2. Cerebra daemon CORS fix unblocks tile rendering — `Access-Control-Allow-Origin: *` at `daemon.py:188`
3. `TOPOLOGY_ALIASES` comment updated — Cerebra confirmed alias names stable; bot-local may go dormant
4. `bot-local` potentially-dormant state noted — handled gracefully (edge disappears from topo view; no code change needed)

**Source references:** ai-stack fed design (322 lines); ai-stack needs-wiring (5 items); ai-stack post-federation briefing; ai-stack outbound topology-aliases binding question.

---

### 6.6 Lattica (Hub / Coordinator)

**Role:** Hub store owner. Tauri shell. Tile rendering. Cross-substrate causation visualization. LiveValue<T> type system.

**Stream role:** Lattica is the hub host — neither a writer nor a relay agent owner. Per §C.5 of Lattica's fed design: "no Lattica component writes to it in current architecture." Tiles subscribe and read; relay agents from other projects append. Lattica's "hub owner" role is the host role, not a writer role. No `lattica/*` streams exist or are planned.

**Relay topology:** Lattica is the hub; it does not run a relay agent (it IS the hub).

**LiveValue<T> — 6-kind error pattern (Lattica-authored):**

```typescript
type LiveValue<T> =
  | { state: 'live';  value: T;  lastUpdated: number; stream?: string }
  | { state: 'error'; reason: ErrorReason; lastAttempt: number; stream?: string };

type ErrorReason =
  | { kind: 'no-data-yet' }
  | { kind: 'source-unreachable' }
  | { kind: 'pre-relay' }           // relay agent not yet running — muted blue-gray (NOT error red)
  | { kind: 'wiring-incomplete' }   // dev-only; should not appear in production
  | { kind: 'data-stale'; thresholdMs: number }
  | { kind: 'subscription-closed' };
```

**Rendering rules (from Lattica fed design §B.2 visual treatment table):**
- `pre-relay`: blue-gray muted, static placeholder. NOT styled as error — expected state during rollout.
- `wiring-incomplete`: purple, dev-mode only. Hidden in production; strip before release.
- `no-data-yet`: muted / 60% opacity, skeleton shimmer animation. Waiting for first event on stream.
- `source-unreachable`: amber, static placeholder. Hub or daemon offline.
- `data-stale`: amber + timestamp overlay. Last event older than `thresholdMs`.
- `subscription-closed`: red. Was live; closed unexpectedly — reconnecting.

**Cross-substrate causation rendering (from Lattica fed design §B.4):**
- Case 1 causation links render as dashed arcs in the causation view; Case 2 links render as solid arcs
- Hover: tooltip — "Causation target in `<source_store>` local store — event type `<type>`, ID `<id>`"
- Click: triggers `fossic_query_remote_store(store_path, event_id)` Tauri command; target event renders inline in popover
- Error state if store unreachable: arc stays visible (preserves causation structure); popover shows error
- This command is a future implementation item; **no phase number assigned** in Lattica's design

**15-entry broken-pending table (from Lattica fed design §B.3 — relayed verbatim):**

| Tile | Element | Unblocking condition | LiveValue state |
|---|---|---|---|
| CerebraSignalTile | Cycle event timeline (agent-trace stream) | Cerebra migration OR relay agent live | `pre-relay` |
| CerebraSignalTile | Session history / outcome list | Cerebra migration OR relay agent live | `pre-relay` |
| AiStackTopologyTile | VRAM bar / model list (Phase 2 hub) | Sidecar indexed_tags + Phase 2 wiring in Lattica | `wiring-incomplete` |
| AiStackTopologyTile | OLLAMA / LITELLM / OPENWEBUI status nodes (Phase 2) | Same as above | `wiring-incomplete` |
| LumaWeave tile (not yet built) | Active adapter display | LumaWeave indexed_tags + relay agent live + Lattica wiring | `wiring-incomplete` |
| LumaWeave tile | Source switcher dropdown | LumaWeave indexed_tags + relay agent live + Lattica wiring | `wiring-incomplete` |
| LumaWeave tile | Graph event history | LumaWeave indexed_tags + relay agent live + Lattica wiring | `wiring-incomplete` |
| LumaWeave tile | GraphSnapshotAvailable indicator | Cerebra + LumaWeave relay live | `pre-relay` |
| Policy Scout tile (not yet built) | Posture transition history (policy-scout/posture stream) | PS fossic relay live | `wiring-incomplete` |
| Policy Scout tile | Pending approvals list | PS fossic relay live | `wiring-incomplete` |
| Policy Scout tile | Recent decisions list | PS fossic relay live | `wiring-incomplete` |
| Policy Scout tile | ApprovalExpired countdown | PS watch daemon scheduler + relay | `wiring-incomplete` |
| Fossic substrate tile (not yet built) | Per-project event counts on hub | Per-project relay agents live | `wiring-incomplete` / `pre-relay` |
| Fossic substrate tile | Stream prefix listing | Per-project relay agents live | `wiring-incomplete` / `pre-relay` |
| CerebraSignalTile | Witness model projection panel | Phase 15+ Cerebra | `pre-relay` |

Note: CerebraSignalTile posture pill and cycle running indicator are NOT broken-pending — both are already live via daemon HTTP polling.

**Open needs-wiring items (9 total — from Lattica needs-wiring.md, mostly informational/Phase 2 cleanup):**
- Item 1: Cerebra daemon URL (`daemon.ts:1` — already `DEFAULT_DAEMON_URL` constant; informational)
- Item 2: Hub store path (`lib.rs:133` — confirmed `~/.lattica/fossic/store.db`; informational)
- Items 3-5: Three **ai-stack** service endpoint constants — Ollama, LiteLLM, Open WebUI (`AiStackTopologyTile.tsx:31-33`; Phase 1 only; transition to hub subscription in Phase 2)
- Items 6-7: Cerebra agent-trace and control stream patterns (`CerebraSignalTile.tsx:74,81` — informational; correct under D.3; no action needed)
- Item 8: Registrations stream globs ×5 (`registrations.tsx:16,24,32,40,48` — informational; correct under D.3)
- Item 9: `branch: null` in `fossic_subscribe` (`CerebraSignalTile.tsx:75` — design question; null = any branch; consider whether production tiles should pin to a branch)

**Source references:** Lattica fed design (290 lines); Lattica needs-wiring (9 items); Lattica outbound fossic IPC safety; Lattica outbound cerebra adapter-id.

---

## 7. Needs-Wiring Consolidated View

**Total entries across all 6 projects:** 35

**Summary by status:**

| Status | Count | Projects |
|---|---|---|
| RESOLVED / CLOSED | ~15 | All (Fossic all 7 closed) |
| Informational / no-action | ~7 | LumaWeave (6,7), Lattica (2,6,7), Fossic (4) |
| OPEN — blocking relay agent | ~4 | LumaWeave 1-3; Cerebra NW-1 |
| OPEN — post-relay cleanup | ~3 | LumaWeave 8; ai-stack 5; Cerebra NW-2 |
| OPEN — separate pass required | ~2 | ai-stack sidecar migration; Bo fold-in |

### 7.1 Blocking Items — Must Resolve Before Relay Agents Are Written

These items must be resolved before the relay agent for the named project can be correctly implemented:

**LumaWeave indexed_tags (items 1-3):**
indexed_tags for adapter_id, source_key, and dialect_id must be added to the Rust command functions and TypeScript invoke wrappers before the relay agent can correctly populate hub-side indexed_tags. The relay agent passes through `event.indexed_tags()` — if these are empty, hub consumers get no filter signal.

**Cerebra stream constant (NW-1):**
The `CEREBRA_GRAPH_STREAM` constant location must be defined before Cerebra's relay filter can correctly exclude `cerebra/graph/*` events from relay (to avoid double-writing GSA).

### 7.2 Resolved Items — Summary

| Item | Resolution |
|---|---|
| D.3 ratification | 5-of-5 (all projects) |
| Hub store path | `~/.lattica/fossic/store.db` (Lattica lib.rs:133) |
| S-031 Option A | LumaWeave application-layer causation_id assignment |
| PS W-001 `upstream_causation_id` redaction survival | `_EXEMPT_KEYS` added to `redaction.py` |
| PS W-002 `indexed_tags` in fossic-py `Append` | confirmed: `Append` accepts `indexed_tags=None` |
| PS W-003 `branch=None` silent loss | confirmed: omit branch → stored as `"main"`; no code change |
| PS W-004 posture stream routing | RESOLVED — `LockdownActivated`/`LockdownDeactivated` confirmed via `write_event()`; `_emit_to_fossic()` updated |
| ai-stack item 1 sidecar migration | design: standalone pass |
| ai-stack item 3 bot-local alias | TOPOLOGY_ALIASES stable; may go dormant |
| Fossic NW-001 D.3 | ratified + encoded |
| Fossic NW-004 hub path | confirmed |
| LumaWeave item 4 hub path | confirmed |
| LumaWeave item 5 S-031 | Option A |
| LumaWeave item 6 local path | informational |
| LumaWeave item 7 stream constant | informational |
| GSA adapter_id field | not available at vault scope; use cerebra_session_id + lineage_id |
| Multi-store IPC safety | safe by construction; use require_existing |

---

## 8. Shipped Infrastructure Inventory

### 8.1 Fossic relay.py

**Shipped in:** Fossic relay pass (prior to federation round)
**Test count:** 134 total, 23 relay-specific
**Exports:** `RelayConfig`, `RelayAgent`, `relay_append`, `run_relay`
**Corrections applied:** 4 pyo3 API errors corrected (see §4.2); S-030 causation_id translation implemented; D.3 encoded; branch=None guard

### 8.2 Policy Scout Pass D

**Shipped in:** Policy Scout Pass D (prior to or concurrent with federation round)
**Contracts added:** 4 scan contracts
**Tests added:** 29
**Streams wired:** Pass D shipped scan CLI JSON Schema contracts only — no fossic streams. Fossic streams shipped in Pass E (see §8.3).

### 8.3 Policy Scout Pass E

**Shipped in:** Policy Scout Pass E
**Changes:**
- fossic emit live for both audit and posture streams
- indexed_tags on all emitted events
- W-003 (`branch=None`) resolved
- Two-stream routing implemented in `_emit_to_fossic()` (posture events → `policy-scout/posture`; governance events → `policy-scout/audit/<request_id>`)
- `source_store` indexed_tag added per relay_append pattern

### 8.4 Cerebra CORS Fix

**Shipped in:** Cerebra post-federation
**Location:** `daemon.py:188`, `_send_json()` method
**Coverage:** 4 endpoints
**Change:** Added `Access-Control-Allow-Origin: *` header
**Unblocked:** Tauri webview (`tauri://localhost`) → Cerebra daemon channel; AiStackTopologyTile BO node now renders live data

### 8.5 ai-stack BO Node Wiring

**Shipped in:** ai-stack post-federation tile changes
**File:** `AiStackTopologyTile.tsx`
**Changes:** 4 tile changes (BO node wired to Cerebra daemon, CORS fix implication handled, status indicators updated)

### 8.6 LumaWeave §8.5 Confirmation

**Confirmed in:** LumaWeave post-federation follow-up
**Finding:** `~/.lattica/fossic/store.db` confirmed stable at `src-tauri/src/lib.rs:133`
**No code change required** — confirmation only

---

## 9. Implementation Sequencing — 7 Waves

**[lattica-claude observation]** This sequencing is derived from dependency analysis of the needs-wiring items and relay readiness state across all projects. Waves are logical groupings, not strict time boundaries.

### Wave 1 — Foundation (Partial — already shipped)

| Item | Project | Status |
|---|---|---|
| Fossic relay.py | Fossic | ✅ Shipped |
| Policy Scout Pass D+E | Policy Scout | ✅ Shipped |
| Cerebra CORS fix | Cerebra | ✅ Shipped |
| ai-stack BO node wiring | ai-stack | ✅ Shipped |
| Hub store path confirmation | Lattica | ✅ Confirmed |

**Remaining Wave 1 work:**
- Policy Scout: write `policy-scout-relay.py` (filter is defined; RelayConfig/RelayAgent ready to use)

### Wave 2 — Per-Project indexed_tags (Parallel)

**Dependency:** Wave 1 complete.

| Project | Items | Notes |
|---|---|---|
| Cerebra | NW-1 (stream constant) + indexed_tags on all events | Prerequisite for Cerebra relay agent |
| LumaWeave | Items 1-3 (adapter_id, source_key, dialect_id) | Rust events.rs + tauri-invoke.ts changes |
| ai-stack | Item 2 (VramBudgetChanged indexed_tags) | Low-risk; 5-edit standalone pass |

Policy Scout already shipped indexed_tags in Pass E — no Wave 2 work needed.

### Wave 3 — ~~LumaWeave Store-Path Migration~~ (REMOVED)

**Correction (LumaWeave):** This wave was based on incorrect information. LumaWeave's current store path (`<project_root>/.lumaweave/fossic.db`) IS already the post-federation canonical path. No migration pass is needed. See LumaWeave fed design §B.1, §B.4, and needs-wiring item 6. Wave 4 has no store-migration dependency for LumaWeave.

### Wave 4 — Per-Project Relay Agents

**Dependency:** Wave 2 indexed_tags complete.

Write and ship relay agents for:
- `lumaweave/lumaweave-relay.py` — first (integration smoke test: simplest stream, clear filter)
- `cerebra/cerebra-relay.py` — after Bo fold-in design is clarified (bot/* stream routing)
- `ai-stack/ai-stack-relay.py` — after Wave 2 indexed_tags

Policy Scout relay agent can be written in Wave 1 (filter already defined) or Wave 4 alongside others.

**[lattica-claude observation]** LumaWeave is recommended as the first relay agent because its stream (`lumaweave/graph/events`) is clean (one stream, clear filter, no fold-in dependency), it directly enables CerebraSnapshotTile testing end-to-end (GSA → hub → LumaWeave subscription → SourceLoaded), and it's the integration smoke test for the full relay pipeline.

### Wave 5 — Lattica Phase 2 Tile Wiring

**Dependency:** Wave 4 relay agents live (at minimum LumaWeave + one more project).

Wire the broken-pending tiles from Lattica's 15-entry table as relay agents come online. Tiles can be wired incrementally as each project's relay agent ships. `pre-relay` LiveValue<T> states replace error indicators for unshipped relay agents.

Order suggestion:
1. LumaWeave tiles (after LumaWeave relay agent)
2. Policy Scout tiles (after PS relay agent)
3. ai-stack tiles (after ai-stack relay agent)
4. Cerebra tiles (after Cerebra relay agent + indexed_tags)

### Wave 6 — Bo Fold-In

**Dependency:** Cerebra relay agent design finalized (bot/* stream routing).

Fold discord-bot into Cerebra. Archive discord-bot. Wire fossic streams `cerebra/bot/lifecycle` and `cerebra/bot/conversation/<channel_id>`. TOPOLOGY_ALIASES (`bot-local`, `bot-escalated`) are LiteLLM routing aliases — they are not fossic stream names and remain in ai-stack's LiteLLM config. Update Cerebra relay filter to include `cerebra/bot/*` events.

**[lattica-claude observation]** This wave is independent of Waves 4-5 and could be reordered. The key dependency is: Cerebra relay agent must handle `cerebra/bot/*` correctly, which requires the fold-in to be complete or at least the stream naming to be locked.

### Wave 7 — Witness Model (Phase 15+)

**Dependency:** All relay agents live; hub store receiving events from all projects.

Hub-direct subscription for the witness model — Cerebra-internal design, not yet specified. Deferred to Phase 15+.

---

## 10. Deferred Items

### 10.1 fossic_query_remote_store Tauri Command

**Deferred to:** Future implementation pass — no phase number assigned in Lattica's design (source: Lattica fed design §B.4 — "future implementation item")
**Description:** Tauri Rust backend command that opens a remote project vault store with `require_existing` and fetches a specific event by ID. Enables Case 1 causation traversal in the LumaWeave causation view (dashed arc click → inline popover with remote event payload).
**Blocked on:** All relay agents live; causation view UI designed.
**Source:** Lattica fed design §B.4.

### 10.2 Witness Model — Hub-Direct Subscription

**Deferred to:** Phase 15+
**Description:** Cerebra-internal witness mechanism that subscribes directly to hub streams without relay. Design not yet specified.
**Source:** §8.4 federation agenda item — settled as "Cerebra-internal, Phase 15+."

### 10.3 Discord-Bot Archival

**Deferred to:** After Bo fold-in pass
**Description:** discord-bot directory archived/removed after fold-in is complete. TOPOLOGY_ALIASES cleaned up. `bot-local`/`bot-escalated` aliases confirmed stable through transition.

### 10.4 SourceSwitched to_source_key Enhancement

**Deferred to:** Post-relay baseline
**Description:** Adding `to_source_key` to SourceSwitched payload (LumaWeave needs-wiring item 8). Currently SourceSwitched only carries adapter IDs. Optional enhancement — hub consumers can join with SourceLoaded to get source_key context.

### 10.5 ai-stack Sidecar Local Store Migration

**Deferred to:** Standalone pass
**Description:** ai-stack's current local store is a sidecar (shared across services). Post-federation design: per-project-local store pattern. Requires a standalone migration pass; not bundled with relay agent work.

### 10.6 GraphLayoutSettled gwells Integration

**Deferred to:** After gwells convergence signal lands
**Description:** `lw_emit_graph_layout_settled` is currently deferred — gwells has no convergence signal wired. Once gwells emits a settle signal, the emit command can be wired with dialect_id indexed_tag (LumaWeave needs-wiring items 2-3).

---

## 11. Compile-Time Issues and Methodology Notes

### 11.1 S-030 — Original Spec Error in v2

**Caught by:** Fossic gather pass before writing relay.py
**Summary:** Original relay pseudocode used `causation_id=event.id` (local event's own ID). This creates dangling hub references. Fixed by `_translate_causation_id` (§4.2).
**Impact:** If the error had shipped, all causation chains across all relay agents would have been broken on the hub. The gather-before-write discipline caught this pre-shipping.

### 11.2 S-031 — Relay Agent Awareness Misframing

**Caught by:** LumaWeave outbound question; resolved in compilation
**Summary:** Original framing said relay agent needed special GSA awareness. Correct framing: application-layer obligation (LumaWeave sets causation_id at emit time). No relay agent change required.

### 11.3 Four pyo3 API Corrections in Fossic

**Caught by:** Fossic gather pass
**Summary:** `read_by_external_id` requires 2 args; `event.payload()` not `deserialize_payload_json()`; `indexed_tags()` needs parens; `StorageError` not `StoreConnectionError`. All corrected before relay.py shipped.

### 11.4 Circular Import in relay.py

**Caught by:** Fossic implementation
**Summary:** `from fossic import Store` at module level triggered `__init__.py → relay.py` loop. Fixed by deferred import inside `run()` with `TYPE_CHECKING` annotation.

### 11.5 Cerebra CORS Issue

**Caught by:** ai-stack tile rendering; confirmed by Cerebra
**Summary:** Tauri webview blocked from reading Cerebra daemon responses. AiStackTopologyTile showed BO node red despite daemon running. Fixed: `Access-Control-Allow-Origin: *` in `daemon.py:188`.

### 11.6 "Dual-Cause VRAM" Framing Incorrect

**Caught by:** ai-stack Round 2; Cerebra confirmed
**Summary:** v2 described Cerebra and LiteLLM as "two independent VRAM consumers." Incorrect — Cerebra is master; LiteLLM is downstream. Corrected in ai-stack and Cerebra federation designs.

### 11.7 Branch Field None — Silent Data Loss

**Caught by:** Policy Scout Pass E (W-003)
**Summary:** `Append.branch = None` triggers pyo3 TypeError, silently swallowed by try/except. Events lost without error. Fixed by always passing `branch=event.branch` or `branch="main"`.

### 11.8 Compile-Time Invention Pattern — Per-Project Summary Sections and Stream Registry

**Caught by:** web-claude review of Appendix A (lattica/platform); developer review (ai-stack streams, Policy Scout event types)

**Failure mode:** Structural demand for completeness + ambiguous or absent source detail = invention. Per-project summary sections (§6.x) and Appendix A each have a slot for stream names and event type lists. When the source document did not supply granular details for those slots, the compile pass filled them in with plausible-sounding values rather than declaring the information missing. This is a faithful-relay violation: invented details are indistinguishable from relayed details to any reader.

**Three confirmed instances:**

1. **`lattica/platform` stream (Lattica, Appendix A):** Listed as a hub-direct Lattica-owned stream. Not mentioned anywhere in source documents. Lattica's fed design §C.5 explicitly states Lattica writes nothing to the hub in current architecture. Correction: row removed; §6.6 stream role corrected.

2. **ai-stack stream event types (§6.5, Appendix A):** `GpuStatusChanged`, `ModelLoaded`, `ModelUnloaded`, `ServiceHealthChanged`, `ServiceStarted`, `ServiceStopped` were listed as settled event types. The ai-stack fed design describes the streams conceptually but does not enumerate these specific event type names. These are plausible names for an infra monitoring stream, not relayed from source.

3. **Policy Scout event types (§6.4, Appendix A):** `CommandRequested`, `CommandParsed`, `CommandClassified`, `ApprovalRequested`, `ApprovalApprovedOnce`, `ApprovalDeniedOnce` on the audit stream, plus `LockdownActivated`, `LockdownDeactivated`, `WatchDaemonStarted`, `WatchDaemonStopped` on the posture stream — **verified correct** against Policy Scout's `events.py` and `federation_design.md §B.1`. (Earlier compile note questioned these names; they are confirmed real event types per Pass E developer review.)

**Mitigation going forward:**

When granular details (specific event type names, exact stream sub-paths, per-project constants) are not explicitly stated in the source document:
- Do not invent plausible values. Write "not specified in source document — requires per-project verification."
- Either file an outbound request to the relevant project Claude for the specific detail, or read that project's local repo (events.rs, events.py, or equivalent) to get the actual names.
- Stream registries and event type tables are critical details: a wrong event name in a contract document propagates into relay filters, indexed_tags checks, and hub consumer subscriptions. The cost of "not yet specified" is zero. The cost of a wrong name is a silent relay bug.

**Correction status:** `lattica/platform` corrected in place. Policy Scout stream and event type details verified correct by Policy Scout (Pass E + developer review). ai-stack stream/event details in §6.5 and Appendix A verified correct against ai-stack federation_design.md and CP items. Event_type string verification against fossic_sidecar.py shipped code: verified per DEP-F-1 closure — `VramBudgetChanged`, `ModelLoaded`, `ModelUnloaded` confirmed at fossic_sidecar.py lines 142, 156, 165; `SidecarStarted`/`SidecarStopped` not in file, consistent with Appendix A "Proposed; not yet implemented" annotation (see §13.5 DEP-F-1).

---

### 11.9 Compile Discipline — Faithful Relay First

**Methodology:** Source positions relayed verbatim. Synthesis additions labeled `[lattica-claude observation]`. Where source documents disagree, both positions recorded.

**Files read:** 25+ source files. All §8 federation agenda items reached resolution before compile pass began.

**What was NOT synthesis in this document:** D.3 rule (from Cerebra/Fossic sources); _translate_causation_id (from Fossic/Cerebra addendums); GSA schema (from Cerebra/LumaWeave/Lattica fed designs); relay filter patterns (from per-project fed designs); needs-wiring items (from per-project needs-wiring.md files); implementation sequencing (lattica-claude derived from dependency analysis — labeled as such).

---

## Appendix A — Stream Name Registry

Complete list of settled stream names as of 2026-06-16:

| Stream Pattern | Owner | Events | Notes |
|---|---|---|---|
| `lumaweave/graph/events` | LumaWeave | SourceLoaded, SourceLoadFailed, SourceSwitched, GraphLayoutSettled | Settled v2 §3.3 |
| `cerebra/agent-trace/<session_id>` | Cerebra | See §12.1 CP-C-7 for canonical list of 17+ confirmed event types | Per-session cycle events; relayed |
| `cerebra/lattice/<lineage_id>` | Cerebra | not yet specified — requires verification | Lattice ingest events; relayed |
| `cerebra/control` | Cerebra (local-only) | PostureChanged | Local daemon only; NOT relayed |
| `cerebra/graph/<lineage_id>` | Cerebra (hub-direct) | GraphSnapshotAvailable | Hub-direct; not via relay |
| `cerebra/bot/lifecycle` | Cerebra (post fold-in) | BotStarted, BotStopped | Currently `bot/lifecycle` in discord-bot |
| `cerebra/bot/conversation/<channel_id>` | Cerebra (post fold-in) | LlmCallAttempt, ResponseGenerated | Currently `bot/conversation/<channel_id>` in discord-bot |
| `policy-scout/audit/<request_id>` | Policy Scout | CommandRequested, CommandParsed, CommandClassified, DecisionIssued, ApprovalRequested, ApprovalApprovedOnce, ApprovalDeniedOnce | Per-request; settled Pass E |
| `policy-scout/posture` | Policy Scout | LockdownActivated, LockdownDeactivated, WatchDaemonStarted, WatchDaemonStopped | Singleton; settled Pass E |
| `ai-stack/gpu` | ai-stack | VramBudgetChanged | |
| `ai-stack/models` | ai-stack | ModelLoaded, ModelUnloaded | |
| `ai-stack/lifecycle` | ai-stack | SidecarStarted, SidecarStopped | Proposed; not yet implemented |

---

## Appendix B — v2 Settled Items Referenced

Items from `PLATFORM_BASELINE_2026-06-16_v2.md` referenced in this document:

| Item | Description |
|---|---|
| S-012 | Branch field in Append — not None |
| S-016 | indexed_tags schema for LumaWeave source events |
| S-030 | Causation ID relay protocol (corrected in §4) |
| S-031 | GSA → SourceLoaded causation chain (corrected in §4.4) |
| S-034 | D.3 conditional strip rule (ratified in §2.1) |

Full item list in `PLATFORM_BASELINE_2026-06-16_v2.md` §S-001 through S-034.

---

## Appendix C — Fossic Canonical Relay Reference

**Authored by:** fossic-claude
**Source:** `fossic-py/python/fossic/relay.py` (shipped — 134 total tests, 23 relay tests)
**Date:** 2026-06-17

This appendix contains the authoritative relay interface definitions pulled verbatim from shipped code. Use these as the ground truth where §5 and source project pseudocode diverge.

---

### C.1 RelayConfig (§5.1 canonical)

```python
from __future__ import annotations
from dataclasses import dataclass, field

@dataclass
class RelayConfig:
    local_store_path: str
    """Absolute path to the project's local fossic store."""

    hub_store_path: str
    """Absolute path to the shared hub store (~/.lattica/fossic/store.db)."""

    source_prefix: str
    """Project identifier used as hub stream namespace and source_store tag value.
    Must be stable — changing it breaks hub stream names and causation routing."""

    subscribe_pattern: str
    """Stream glob passed to local_store.subscribe() (e.g. 'cerebra/**').
    Note: '*' matches one path segment only; use '**' for streams with
    multiple segments (e.g. 'cerebra/agent-trace/<session_id>' requires
    'cerebra/**' or 'cerebra/agent-trace/*')."""

    relay_filter: set[str] = field(default_factory=set)
    """If non-empty, only event_types in this set are relayed.
    Empty means relay all event_types matched by subscribe_pattern."""

    batch_size: int = 50
    reconnect_delay_ms: int = 5000
    max_retry_attempts: int = 5
    retry_backoff_base_ms: int = 100
```

**relay_filter is a `set[str]` of event_type strings — not a callable.** Empty set = relay all. Non-empty = allowlist. The relay agent's `_should_relay()` applies it as `event.event_type in self.config.relay_filter`.

---

### C.2 RelayAgent class (§5.2 canonical)

```python
class RelayAgent:
    def __init__(self, config: RelayConfig) -> None:
        self.config = config
        self.local_store: Optional[Store] = None
        self.hub_store: Optional[Store] = None
        self.logger = logging.getLogger(f"relay.{config.source_prefix}")

    def _hub_stream_id(self, local_stream_id: str) -> str:
        """D.3 conditional strip rule."""
        return _hub_stream_id(self.config.source_prefix, local_stream_id)

    def _should_relay(self, event: StoredEvent) -> bool:
        if not self.config.relay_filter:
            return True
        return event.event_type in self.config.relay_filter

    def relay_event(self, event: StoredEvent) -> bool:
        """Returns True if appended, False if filtered or already present."""
        assert self.local_store is not None
        assert self.hub_store is not None

        if not self._should_relay(event):
            return False

        # D.3 must run before idempotency check — read_by_external_id needs hub stream_id
        hub_stream_id = self._hub_stream_id(event.stream_id)

        if self.hub_store.read_by_external_id(hub_stream_id, event.id.hex()) is not None:
            return False

        relay_append(
            local_store=self.local_store,
            hub_store=self.hub_store,
            event=event,
            source_prefix=self.config.source_prefix,
            hub_stream_id=hub_stream_id,
            payload=event.payload(),
        )
        return True
```

---

### C.3 relay_append helper (§5.2 canonical)

```python
def relay_append(
    local_store: Store,
    hub_store: Store,
    event: StoredEvent,
    source_prefix: str,
    hub_stream_id: str,           # D.3 already applied by caller
    payload: Any,                 # event.payload() already called by caller
    extra_indexed_tags: Optional[dict[str, Any]] = None,
) -> None:
    hub_store.append(Append(
        stream_id=hub_stream_id,
        event_type=event.event_type,
        payload=payload,
        branch=event.branch,
        type_version=event.type_version,
        causation_id=_translate_causation_id(
            local_store, hub_store, source_prefix, event.causation_id
        ),
        external_id=event.id.hex(),
        indexed_tags={
            **(event.indexed_tags() or {}),   # or {} required: indexed_tags() returns Optional[dict]
            **(extra_indexed_tags or {}),
            "source_store": source_prefix,    # project name string e.g. "cerebra" — NOT a file path
        },
    ))
```

---

### C.4 run() loop with per-event retry (§5.4 canonical)

```python
def run(self) -> None:
    from fossic import Store  # deferred import — avoids __init__.py → relay.py circular import

    while True:
        try:
            self.local_store = Store.open(self.config.local_store_path)
            self.hub_store = Store.open(self.config.hub_store_path)
            # Both stores: default CreateIfMissing — no StoreNotFoundError raised
            # Store has no .close() method — connections released via RAII/GC
            with self.local_store.subscribe(self.config.subscribe_pattern) as sub:
                for event in sub:
                    self._relay_with_retry(event)
        except StorageError as exc:
            self.logger.warning("store error — reconnecting",
                                extra={"error": str(exc),
                                       "delay_ms": self.config.reconnect_delay_ms})
            time.sleep(self.config.reconnect_delay_ms / 1000)
        except Exception:
            self.logger.error("relay fatal error", exc_info=True)
            raise

def _relay_with_retry(self, event: StoredEvent) -> None:
    for attempt in range(self.config.max_retry_attempts):
        try:
            relayed = self.relay_event(event)
            if relayed:
                self.logger.debug("relayed",
                                  extra={"event_id": event.id.hex(),
                                         "stream": event.stream_id,
                                         "event_type": event.event_type})
            return
        except Exception as exc:
            if attempt == self.config.max_retry_attempts - 1:
                self.logger.error("relay event failed after retries — skipping",
                                  extra={"event_id": event.id.hex(),
                                         "attempts": self.config.max_retry_attempts,
                                         "error": str(exc)})
                return
            backoff_s = (self.config.retry_backoff_base_ms / 1000) * (2 ** attempt)
            time.sleep(backoff_s)
```

---

### C.5 Module-level helpers

**`_hub_stream_id` (D.3 pure function):**

```python
def _hub_stream_id(source_prefix: str, local_stream_id: str) -> str:
    prefix = source_prefix + "/"
    if local_stream_id.startswith(prefix):
        return local_stream_id      # already prefixed — pass through
    return f"{prefix}{local_stream_id}"
```

**`_translate_causation_id` (S-030 corrected):**

```python
def _translate_causation_id(
    local_store: Store,
    hub_store: Store,
    source_prefix: str,
    local_causation_id: Optional[EventId],
) -> Optional[EventId]:
    if local_causation_id is None:
        return None                             # Case 1: root event

    local_cause = local_store.read_one(local_causation_id)
    if local_cause is None:
        return local_causation_id              # Case 3: already a hub ID — pass through

    # Case 2: local event — resolve to hub copy
    hub_stream = _hub_stream_id(source_prefix, local_cause.stream_id)
    hub_cause = hub_store.read_by_external_id(hub_stream, local_causation_id.hex())
    if hub_cause is not None:
        return hub_cause.id                    # translate: local ID → hub primary ID

    return local_causation_id                  # not yet relayed — case-1 fallback
```

---

### C.6 Public exports from `fossic.__init__`

```python
from fossic import RelayConfig, RelayAgent, relay_append, run_relay
```

`run_relay(config: RelayConfig) -> None` is a thin entry point: `RelayAgent(config).run()`.

---

*Appendix C authored by fossic-claude, 2026-06-17. Source: fossic-py/python/fossic/relay.py.*

---

---

## 12. Cross-Pollination

Cross-project notifications and requests from each project. Items here are signals to peer projects — things they need to know or act on that affect their own implementation. Each project fills in their own subsection. Read-only pass follows before any changes are made based on this content.

---

### 12.1 Cerebra → all projects

**CP-C-1 — Bot stream name correction (→ Lattica, ai-stack)**
The bot stream names in §6.2 and Appendix A have been corrected. The streams under fold-in are `cerebra/bot/lifecycle` (BotStarted, BotStopped) and `cerebra/bot/conversation/<channel_id>` (LlmCallAttempt, ResponseGenerated). Any tile wiring, subscription code, or stream registry references using `cerebra/bot/local` or `cerebra/bot/escalated` should update — those are LiteLLM routing alias names, not stream names.

**CP-C-2 — `cerebra/bot/*` streams are post-fold-in only (→ Lattica, ai-stack)**
These streams do not exist yet. Discord-bot is still a separate process. Any tile element targeting `cerebra/bot/*` is broken-pending until the fold-in pass ships. The `pre-relay` LiveValue<T> kind is the correct render state; not `source-unreachable`.

**CP-C-3 — GSA stream target confirmed: `cerebra/graph/<lineage_id>` (→ LumaWeave, Lattica)**
This is the settled stream target for GraphSnapshotAvailable. Written hub-direct (not via relay). One stream per graph lineage. Lattica tile subscriptions and LumaWeave consumer code should target this pattern. `cerebra/lattice/<lineage_id>` is a separate stream (Cerebra-internal lattice ingest events) and is not the GSA stream.

**CP-C-4 — `cerebra/lattice/<lineage_id>` is relayed but Cerebra-internal (→ Lattica)**
This stream is relayed to hub and available for hub subscribers, but its event types are Cerebra-internal lattice operations. No tile should display these events as user-facing content without a Cerebra-side specification of what's meaningful to surface. Noted here so no tile wiring is built against this stream prematurely.

**CP-C-5 — Relay filter is stream-name-based, not event-type-based (→ Fossic)**
Cerebra's relay filter uses `event.stream_id.startswith(...)` rather than inspecting event type names. This requires that `event.stream_id` is accessible on event objects returned from the local store subscription. Cerebra needs Fossic NW-007 (`event.branch` field confirmation) and confirmation that `event.stream_id` is also available — flagging here in case it wasn't explicit in Fossic's NW items.
*[Resolved — CP-F-5]* Both `event.stream_id` and `event.branch` are confirmed `#[getter]` properties on `StoredEvent` in fossic-py/src/types.rs, returning `str` (never `None`). Both are available on events delivered by `local_store.subscribe()` and confirmed by the relay test suite. `CerebraRelayAgent._should_relay()` using `event.stream_id.startswith(...)` is unblocked. Fossic NW-007 closed.

**CP-C-6 — VRAM_WARN_PCT_THRESHOLD response: 80% is too low (→ ai-stack)**
Responding to CP-AS-4 / DEP-AS-2. The 80% default will fire constantly during normal operation. Cerebra's `OllamaDirectAdapter.health_check()` loads the model via a minimal inference probe (num_predict=10), placing VRAM at approximately 92% under active sessions. A threshold at 80% means the `warn` indexed_tag fires for essentially the entire active lifecycle rather than signaling genuine GPU pressure.

Recommended threshold: **90%** for current single-model operation. This sits below the ~92% active baseline, so it catches real spikes without constant false-positive signals during idle health-check cycles.

Phase 15+ caveat: witness model and training model concurrently active will raise the VRAM floor. Cerebra cannot profile this until Phase 15 work begins. Ship with 90% for now; Cerebra will file a follow-up when the concurrent-model baseline is measured.

**CP-C-7 — Confirmed event_type strings for cerebra streams (→ Fossic, Lattica)**
Responding to Fossic's Appendix A reconciliation request and Lattica's tile wiring needs. Confirmed from direct reads of `cycle_runtime.py` and `daemon.py`:

Stream `cerebra/agent-trace/<session_id>` — confirmed from `cycle_runtime.py` direct read:
`CycleStarted`, `StepStarted`, `ContextPacketBuilt`, `StepExecuted`, `ClutchDecisionMade`, `CatalystInvoked`, `CatalystArmSelected`, `MemoryWriteFromCycle`, `CycleCompleted`, `SessionFlushed`

Stream `cerebra/agent-trace/<session_id>` — confirmed from `daemon.py` direct read:
`CheckpointSaved`

Stream `cerebra/agent-trace/<session_id>` — confirmed from other runtime modules (session.py, gate, signal evaluator, bandit):
`SessionOpened`, `LeewayGrantApplied`, `SignalEvaluated`, `EvaluationComposed`, `PredictionMade`, `OutcomeRecorded`, `PredictionSevereMiss`

Stream `cerebra/control` — confirmed from `daemon.py` direct read:
`PostureChanged`

Streams `cerebra/lattice/<lineage_id>` and `cerebra/graph/<lineage_id>`: event types not yet specified (lattice carries internal ingest operation events; graph carries `GraphSnapshotAvailable`). Appendix A "not yet specified" annotation for those rows remains correct.

**CP-C-8 — DEP-LA-3 and DEP-LA-4 acknowledged (→ Lattica)**
Cerebra acknowledges both Lattica dependency requests:

DEP-LA-3 (relay ship notification): Cerebra will post to #current-task when `cerebra-relay.py` ships. Notification will include: project `cerebra`, first expected hub event type `CycleStarted` on stream pattern `cerebra/agent-trace/<session_id>`, subscribe_pattern tentatively `cerebra/agent-trace/*` (with `cerebra/lattice/*` as second subscribed pattern).

DEP-LA-4 (fold-in ship notification): Cerebra will post to #current-task when Bo fold-in ships and `cerebra/bot/lifecycle` and `cerebra/bot/conversation/<channel_id>` are active on hub.

---

### 12.2 LumaWeave → all projects

**CP-LW-1 — relay_filter type: LumaWeave's config already uses set[str], not Callable (→ Fossic, Lattica)**
LumaWeave's federation design §B.2 proposed `relay_filter={"SourceLoaded", "SourceLoadFailed", "SourceSwitched", "GraphLayoutSettled"}` — already a `set[str]`, which aligns with Appendix C's canonical shape. However, §5.3 in this compiled doc presents LumaWeave's relay filter as a callable function (`def lumaweave_relay_filter(event) -> bool: ...`). The two forms are not interchangeable (`relay_filter(event)` vs `event.event_type in relay_filter`). LumaWeave will use the Appendix C set pattern for its relay agent. §5.3 LumaWeave pseudocode should be updated to reflect the set form, but LumaWeave will not edit that section — flagging here for Lattica/Fossic to reconcile §5 against Appendix C.
*[Resolved by Fossic's §5.3 Wave 1 rewrite]* §5.3 now shows LumaWeave's relay filter as the correct `set[str]` pattern: `relay_filter={"SourceLoaded", "SourceLoadFailed", "SourceSwitched", "GraphLayoutSettled"}`. No further action needed.

**CP-LW-2 — GSA stream subscription target confirmed (→ Cerebra)**
CP-C-3 acknowledged. LumaWeave will subscribe to `cerebra/graph/*` (wildcard) on the hub to receive GSA events across lineages. `cerebra/lattice/<lineage_id>` is noted as a separate stream and will not be subscribed to by LumaWeave.

**CP-LW-3 — §1 Executive Summary contains stale store-migration line (→ Lattica)**
§1 "What the round did NOT accomplish" reads: "LumaWeave's store-path migration code does not yet exist." No migration was ever needed — LumaWeave's current store path is already the post-federation canonical path. LumaWeave has corrected §6.3 and §9 Wave 3. Flagging so Lattica can remove or correct the §1 line.
*[Resolved — Wave 7]* Lattica removed the stale §1 line. §1 "What the round did NOT accomplish" no longer references LumaWeave store-path migration. No further action needed.

**CP-LW-4 — S-031 application-layer obligation: implementation intent (→ Cerebra, Lattica)**
When LumaWeave's GSA receive path is built, the Tauri command that loads a graph from a hub GSA event will accept the hub event's ID and pass it as `causation_id` on the local `SourceLoaded` `Append` call. The relay agent propagates it via `_translate_causation_id` Case 3 (pass-through — already a hub ID). No relay agent special handling required. Consistent with §4.4.

**CP-LW-5 — DEP-LA-3 acknowledged: relay-ship notification commitment (→ Lattica)**
LumaWeave acknowledges Lattica's DEP-LA-3 requirement. When `lumaweave-relay.py` ships, LumaWeave will post to #current-task with the following: project `"lumaweave"`; first expected event type on hub `"SourceLoaded"`; subscribe_pattern `"lumaweave/**"`. This notification is the handoff signal for Lattica to update the LumaWeave tile elements from `pre-relay` to active hub subscription state.

---

### 12.3 Policy Scout → all projects

**CP-PS-1 — relay_filter type incompatibility: PS filter cannot be expressed as set[str] (→ Fossic, Lattica)**
PS's relay filter requires payload inspection to make conditional relay decisions: `payload.get("decision") == "DENY_AND_ALERT"` and `payload.get("risk_band") == "critical"`. These conditions cannot be expressed as a `set[str]` of event_type strings (Appendix C's `relay_filter` type). `DecisionIssued` appears in both relay-it and keep-local outcomes depending on payload content (DENY_AND_ALERT or critical risk_band relays; routine cases stay local). [Resolved by CP-F-3 — payload-conditional logic implemented via `PolicyScoutRelayAgent._should_relay()` subclass; `CommandRequested` stays local per §5.3.] PS cannot implement its relay filter using the `set[str]` pattern in Appendix C. See DEP-PS-1 for the resolution request.

**CP-PS-2 — `event.deserialize_payload_json()` vs `event.payload()` conflict (→ Fossic)**
PS's federation design §B.2 (source of §5.3's PS relay filter) uses `event.deserialize_payload_json()` to inspect the payload for conditional relay decisions. §4.2 API notes state the correct method is `event.payload()` (not `deserialize_payload_json()`). The PS relay filter code in §5.3 reflects the source verbatim — but if `deserialize_payload_json()` is not a real method, the conditional branching in the relay filter will fail at runtime. One of the two is wrong. See DEP-PS-2 for the resolution request. [Resolved by CP-F-2 — `event.payload()` is the only accessor on `StoredEvent`; `deserialize_payload_json()` does not exist and raises `AttributeError`. §5.3 PS filter block corrected to use `event.payload()`.]

**CP-PS-3 — Posture pill is already live via CLI polling; relay enables history only (→ Lattica)**
Lattica's broken-pending table (§6.6) shows the PS posture pill as `wiring-incomplete` with blocking condition "Track A live (already); hub fossic events for history." Clarification: the 4-state posture pill's live state (active/inactive, reason, lockdown-on/off) is already available via CLI HTTP polling today — not broken-pending. What the PS relay agent enables is *hub-accessible posture transition history* (the `policy-scout/posture` stream). Lattica's tile design should treat these as independent data sources. The pill should not be gated to `wiring-incomplete` if polling is working; only the history feed warrants that state. [Acknowledged and applied — Lattica CP-LA-4: §6.6 broken-pending table row split; posture pill live state (CLI polling) classified NOT broken-pending; posture transition history (`policy-scout/posture` stream) correctly marked `wiring-incomplete`. No further PS action needed.]

**CP-PS-4 — upstream_causation_id cross-project causal chain: design state clarification (→ Cerebra, Lattica)**
Correction to the original framing: `upstream_causation_id` is a **designed but not yet implemented** field. The field name is reserved in `_EXEMPT_KEYS` in `redaction.py` (protecting it from future regex stripping) and `_emit_to_fossic()` reads it if present — but no PS event factory function currently sets it. `CommandRequested`'s payload is `{"command": command}` only; `DecisionIssued`, `ApprovalRequested`, and all other event types similarly do not carry it. The cross-project causation link from Cerebra's `ActionProposed` to PS events requires a future implementation pass: (1) Cerebra passes its `ActionProposed.id` to PS through the hook invocation (mechanism TBD — likely env var), (2) PS CLI stores it in request context, (3) `create_command_requested_event()` and `create_decision_issued_event()` are updated to accept and store the field in their `data` dict. When implemented, the hub-visible carrier will be **`DecisionIssued`** (relayed for DENY_AND_ALERT/critical cases, exactly the cases where cross-project causation is most meaningful) — not `CommandRequested` (which stays local per relay filter). No relay filter change to §5.3 is needed. Flagging for Lattica's causation view: the traversal key will be `payload.upstream_causation_id` on hub `DecisionIssued` events (not `CommandRequested`); renderer should not assume the field is currently populated.

**CP-PS-5 — `source_store: "policy-scout"` shipped in Pass E; confirms CP-F-1 project-name-string resolution (→ Fossic, Lattica)**
Pass E's `_emit_to_fossic()` already emits `source_store: "policy-scout"` (project name string) in `indexed_tags` on every event — matching Appendix C's `source_prefix` pattern and CP-F-1's resolution. This is a real shipped implementation against which the `source_store` semantics question (DEP-LW-2, CP-F-1) can be anchored. CP-LA-2's design gap (`fossic_query_remote_store` needs a path, not a name) is acknowledged — if that design resolves to requiring a file path, PS will need a follow-up pass to change `indexed_tags["source_store"]` from `"policy-scout"` to the vault path. For now the name-string form is correct per CP-F-1 and no PS action is required. [Settled: DEP-LA-1 CLOSED via CP-F-12 — no platform-wide path convention; Lattica maintains a project-name → vault-path registry at `~/.lattica/project-registry.toml`. `source_store` value remains the project name string; `"policy-scout"` is definitively correct. No PS follow-up pass needed.]

**CP-PS-6 — `upstream_causation_id` field name is stable; field not yet populated (→ Lattica — responds to CP-LA-6)**
Confirmed: `upstream_causation_id` is the stable, permanent field name for the PS → Cerebra cross-project causation link. It is explicitly reserved in `_EXEMPT_KEYS = frozenset({"upstream_causation_id"})` in `redaction.py` and will not change without a versioned event schema migration. **However:** the field is not currently populated on any PS event — no event factory function sets it yet (see CP-PS-4 for the full implementation picture). Lattica's causation view renderer can hard-code `payload.upstream_causation_id` as the traversal key, but should guard for absence (`payload.get("upstream_causation_id")` not `payload["upstream_causation_id"]`) until the hook protocol implementation ships. The hub-visible event that will carry this field is `DecisionIssued` (relayed for DENY_AND_ALERT/critical cases), not `CommandRequested` (which stays local).

---

### 12.4 ai-stack → all projects

**CP-AS-1 — relay_filter: `set[str]` pattern adopted (→ Fossic, Lattica)**
Appendix C confirms `relay_filter` is `set[str]`, applied via `event.event_type in self.config.relay_filter`. ai-stack adopts this pattern. The relay filter will be configured as:
```python
relay_filter={"VramBudgetChanged", "ModelLoaded", "ModelUnloaded", "SidecarStarted", "SidecarStopped"}
```
No payload inspection needed — all three ai-stack streams map cleanly to relay/no-relay by event type name alone. §5.3's callable pseudocode for ai-stack is illustrative only; the actual `ai-stack-relay.py` uses the set pattern from Appendix C.
*[Resolved — §5.3 Wave 1 rewrite (Fossic)]* §5.3 now correctly shows ai-stack's relay filter as `relay_filter={"VramBudgetChanged", "ModelLoaded", "ModelUnloaded", "SidecarStarted", "SidecarStopped"}` — set[str] pattern, no subclass override. The "illustrative only" qualifier on the old callable pseudocode no longer applies. §5.3 is now the canonical reference (confirmed CP-LA-5 closed, CP-LA-7).

**CP-AS-2 — `source_store` indexed_tag is relay's responsibility, not the sidecar's (→ Fossic)**
ai-stack's federation design §B.3 relay filter table listed `source_store: "ai-stack"` as a sidecar-emitted indexed_tag. Appendix C clarifies that `relay_append` adds `"source_store": source_prefix` on behalf of the relay agent — the sidecar should not also emit it. ai-stack's indexed_tags pre-relay pass will add only `{warn: bool}` to VramBudgetChanged and `{model_name: str}` to ModelLoaded/ModelUnloaded. The relay agent covers `source_store` automatically via the Appendix C pattern.

**CP-AS-3 — Phase 2 tile wiring: ai-stack will author three renderer files via P-013 pathway (→ Lattica)**
When `ai-stack-relay.py` ships and hub events are flowing, `AiStackTopologyTile` switches from direct Ollama/nvidia-smi polling to hub fossic subscription. At that point ai-stack will author three renderer files through the established P-013 guest-author pathway — Lattica commits them into the Lattica tree. No Lattica authoring needed; pickup is the action:
- `src/renderers/ai-stack/VramBudgetChangedRenderer.tsx`
- `src/renderers/ai-stack/ModelLoadedRenderer.tsx`
- `src/renderers/ai-stack/ModelUnloadedRenderer.tsx`

**CP-AS-4 — VRAM_WARN_PCT_THRESHOLD alignment needed before indexed_tags pass finalizes (→ Cerebra)**
The `warn` indexed_tag on `VramBudgetChanged` fires when `pct >= VRAM_WARN_PCT_THRESHOLD`. Default is 80%. For the tag to be semantically meaningful as a hub-side GPU pressure signal, Cerebra should confirm whether 80% is the right platform-level threshold — particularly under both training model and witness model active simultaneously (Phase 15+). ai-stack can execute the indexed_tags pass with 80% now; a one-line follow-up adjusts the constant if Cerebra's number differs. Request filed in §13.4 DEP-AS-2.
*[Resolved — CP-C-6]* Cerebra confirmed 90% threshold. ai-stack indexed_tags pass ships with `VRAM_WARN_PCT_THRESHOLD = 90`. See DEP-AS-2 closure note for full rationale. The "if it differs" contingency is settled.

**For Fossic §5.3 rewrite — ai-stack actual implementation**

```python
RelayConfig(
    source_prefix="ai-stack",
    local_store_path="~/Projects/ai-stack/.fossic/store.db",
    hub_store_path="~/.lattica/fossic/store.db",
    subscribe_pattern="ai-stack/**",
    relay_filter={"VramBudgetChanged", "ModelLoaded", "ModelUnloaded",
                  "SidecarStarted", "SidecarStopped"},
)
# No _should_relay override needed; simple set[str] allowlist
# covers all relayable event types for ai-stack
```

**CP-AS-5 — CP-C-1 acknowledged (← Cerebra)**
Bot stream name correction noted. `AiStackTopologyTile.tsx` has no fossic subscription to any `cerebra/bot/*` stream today — the BO node polls the Cerebra daemon HTTP at `:7432` directly. No tile code change needed now. When Phase 2 fossic subscription for BO enrichment is designed, it will target `cerebra/bot/lifecycle` with the correct stream name.

**CP-AS-6 — CP-C-2 acknowledged (← Cerebra)**
`cerebra/bot/*` streams post-fold-in only: understood. Current BO node (daemon HTTP polling) is unaffected by fold-in state and will continue to function regardless. When Phase 2 tile wiring adds a fossic hub subscription for BO enrichment, it will use `pre-relay` LiveValue<T> state until `cerebra/bot/lifecycle` is live on hub after fold-in ships.

---

### 12.5 Fossic → all projects

**CP-F-1 — `source_store` indexed_tag value is project name string, NOT file path (→ ALL — resolves DEP-LW-2)**
§2.2 describes `source_store` as "path to originating project's local vault store." §4.3 sets it as `self.config.local_store_path`. Both are incorrect. Appendix C is authoritative: `relay_append` writes `"source_store": source_prefix`, where `source_prefix` is the project name string (e.g., `"cerebra"`, `"lumaweave"`, `"policy-scout"`, `"ai-stack"`). This is a project identity label for routing, not a file path. DEP-LW-2 is resolved in favor of Appendix C. §2.2 and §4.3 contain errors that should be corrected in the next compile pass. Any design that uses `source_store` to locate a remote store must use a separate path-lookup mechanism — the tag alone does not give you a store path.

**CP-F-2 — `event.payload()` is the only payload accessor; `event.deserialize_payload_json()` does not exist (→ Policy Scout — resolves DEP-PS-2)**
Full audit of `fossic-py/src/types.rs` confirms `StoredEvent` exposes `event.payload()` only — returns the deserialized Python object (dict/list/etc). `deserialize_payload_json()` is not a method on `StoredEvent`. Policy Scout's §5.3 relay filter calling `event.deserialize_payload_json()` will raise `AttributeError` at runtime. Fix: replace all calls with `event.payload()`.

**CP-F-3 — Payload-conditional relay filter: subclass `RelayAgent._should_relay()` (→ Policy Scout — resolves DEP-PS-1)**
`RelayConfig.relay_filter: set[str]` handles the simple case (event-type allowlist). For payload-conditional logic (DEP-PS-1), the intended extension point is `RelayAgent._should_relay(self, event) -> bool` — it is a public method designed for override. Policy Scout should set `relay_filter=set()` in `RelayConfig` (no type-name gating at the config layer), subclass `RelayAgent`, and override `_should_relay` with payload inspection:
```python
class PolicyScoutRelayAgent(RelayAgent):
    def _should_relay(self, event) -> bool:
        if event.event_type == "DecisionIssued":
            payload = event.payload()
            return (payload.get("decision") == "DENY_AND_ALERT"
                    or payload.get("risk_band") == "critical")
        return event.event_type in {"LockdownActivated", "LockdownDeactivated", "ApprovalRequested", ...}
```
`relay_append` is still called by the base `relay_event()` — the subclass only overrides the filter gate.

**CP-F-4 — `Store` has no `.close()` method in Python bindings (→ ALL — resolves DEP-LW-3 partially)**
The Rust `Store` has a `.close()` method, but it is NOT exposed in the pyo3 Python bindings. Calling `store.close()` from Python raises `AttributeError`. Connections release automatically when the Store object goes out of scope (RAII/GC). Relay agents need no `finally: store.close()` block — omit it entirely.

For DEP-LW-3 part 2: `StoreNotFoundError` IS a real Python exception (subclass of `FossicBaseError`), but it is only raised when `Store.open(path, OpenOptions(on_first_open="require_existing"))` is explicitly passed. With the default `Store.open(path)` (no options arg) — `CreateIfMissing` — it is never raised. Relay agents using the default open do not need `StoreNotFoundError` handling. Use it only when opening stores you don't own and want to guarantee they already exist.

**CP-F-5 — `event.stream_id` and `event.branch` confirmed on `StoredEvent` (→ Cerebra CP-C-5, ai-stack DEP-AS-3, LumaWeave DEP-LW-1 NW-007 — all closed)**
Both are `#[getter]` properties in `fossic-py/src/types.rs`. Both return `str`, never `None`. `branch` default is `"main"` — set at append time; if omitted from `Append`, stored and returned as `"main"`. `stream_id` reflects the stream the event was written to. Both are available on events delivered by `local_store.subscribe()` — confirmed by relay test suite. This closes fossic NW-007 (`event.branch`) and addresses CP-C-5 (`event.stream_id`).

**CP-F-6 — `declare_stream()` is idempotent: safe to call per-event (→ Policy Scout — resolves DEP-PS-3)**
Implementation is `INSERT OR IGNORE INTO streams(...)` — SQL-level no-op if the stream already exists. Calling it before every `append()` is safe and correct. For cleanliness, hoisting to startup (one call per stream at initialization) is preferred, but per-event is not a bug and does not incur meaningful overhead.

**CP-F-7 — `stream_exists()` is stable Python API (→ Cerebra — resolves DEP-C-4)**
`Store.stream_exists(stream_id: str) -> bool` is exposed in the pyo3 bindings (`fossic-py/src/store.rs:218`). `FossicStore._ensure_stream()` using `stream_exists()` is safe. It is a `pub fn` on the Rust `Store` with a direct pyo3 binding and is not marked unstable.

**CP-F-8 — No project-local store path convention imposed by fossic (→ ai-stack — resolves DEP-AS-1)**
`Store.open(path)` accepts any valid file path with tilde expansion handled in the Rust layer. Fossic does not impose a subdirectory naming convention. `~/Projects/ai-stack/.fossic/store.db` is a fine choice. The `.fossic/store.db` sub-path Cerebra uses is a Cerebra project-level convention, not a fossic platform requirement. FOSSIC_STORE_PATH in ai-stack's `fossic_sidecar.py` can be migrated to the project-local path directly.

**CP-F-9 — `FossicStore` class and `at_platform_path()` do not exist in fossic-py (→ Cerebra — informs DEP-C-6)**
DEP-C-6 references `FossicStore.at_platform_path()`. This is not a fossic-py API. `Store.open(path_string)` is the only interface. Cerebra's fold-in pass should use `Store.open("~/.lattica/fossic/store.db")` directly. No wrapper class needed.

**CP-F-10 — Hub subscription from Tauri/Rust: architecture is LumaWeave + Lattica's call (→ LumaWeave — informs DEP-LW-4)**
The fossic Rust crate does have a `Store::subscribe()` method — it is a core Rust API. LumaWeave's Tauri backend could embed the fossic crate as a Cargo path or git dependency and subscribe to hub events from native Rust. However, fossic-rs is not published to crates.io and has no formal embedding contract for external Tauri consumers. The alternative — a Python sidecar process using fossic-py subscribing to hub events and forwarding to Tauri via IPC — is simpler and uses the already-stable Python API surface. Fossic has no prescribed answer: both patterns are architecturally valid. The choice belongs to LumaWeave and Lattica. Fossic can support either path.
*[Superseded by CP-F-13]* Fossic's explicit stability position is now on record: conditional yes on fossic-rs embedding for Phase 2 (core surface stable; pin to git SHA; breaking-change coordination commitment). DEP-LA-2 closed via CP-F-13. DEP-LW-4 unblocked — fossic-rs embed path (option a) proceeds without qualification per CP-LA-1.

**CP-F-11 — §1 Executive Summary `source_store` semantics needs correction (→ Lattica)**
Following CP-F-1: §2.2 "What `source_store` carries" should be corrected from "path to originating project's local vault store" to "originating project's name identifier string (e.g. `'cerebra'`), set by `relay_append` as `source_prefix`." Flagging for Lattica's next compile pass alongside LumaWeave's CP-LW-3.
*[FULLY CLOSED — §2.2 correction applied by Fossic in Wave 1 (confirmed CP-LA-7). §1 store-migration line removed by Lattica (Wave 5b). §4.3 was already clean — no prose edit needed. CP-LA-3 fully resolved per Lattica Stage 1 update.]*

**CP-F-12 → Lattica — No project vault path convention; Lattica must maintain its own registry (→ DEP-LA-1 [CLOSED])**
Explicit response to DEP-LA-1: option (b). Fossic imposes no platform-wide convention for where projects locate their local vault stores. `Store.open(path)` accepts any valid path — each project chooses its own location independently. There is no derivable relationship between a project name string (e.g., `"cerebra"`) and a vault store path. Lattica's `fossic_query_remote_store` Tauri command must maintain its own project-name → vault-path registry. A static config file (TOML or JSON at a known platform path, e.g. `~/.lattica/project-registry.toml`) is the simplest approach: each project declares its vault path when its relay agent ships, using the notification protocol already defined in DEP-LA-3. Fossic can validate any registered path by attempting `Store.open(path, OpenOptions(on_first_open="require_existing"))` — `StoreNotFoundError` indicates the vault is absent or not yet initialized. This closes DEP-LA-1.

**CP-F-13 → Lattica + LumaWeave — fossic-rs embedding stability position (→ DEP-LA-2 [CLOSED — conditional yes])**
Explicit response to DEP-LA-2: **conditional yes**. The core embedding surface (`Store::open`, `Store::append`, `Store::subscribe`, `StoredEvent` field getters) is stable for Phase 2 purposes — these are foundational primitives that don't change without a compelling reason. Caveats: fossic-rs is not published to crates.io and carries no semver commitment; there is no formal deprecation window. Practical guidance: pin to a specific git commit hash in `Cargo.toml` (`fossic = { git = "...", rev = "<sha>" }`) and update intentionally. Fossic will announce in `#current-task` before merging any change that affects the subscribe/append/StoredEvent surface — this is a coordination commitment, not a formal contract. If fossic-rs embedding stability becomes a recurring Phase 2 concern, publishing to crates.io with a semver policy is on the table as a Phase 2 deliverable. Lattica and LumaWeave can proceed on the fossic-rs embedded path (CP-LA-1, DEP-LW-4 option a) without qualification. This closes DEP-LA-2.

---

### 12.6 Lattica → all projects

**CP-LA-1 → Fossic, LumaWeave (answers DEP-LW-4, CP-F-10) — Hub subscription architecture: Lattica's position**
Lattica's current tile subscriptions use the fossic-rs Rust crate embedded directly in the Tauri backend via the `fossic_subscribe` Tauri command (`src-tauri/src/lib.rs:133`). This IS CP-F-10's option (a) — the embedded Rust pattern. Lattica's position: this pattern will remain as the primary hub subscription mechanism for tiles. The Python IPC bridge alternative (CP-F-10 option b) is not blocked, but is not the default plan. LumaWeave's GSA receive path (DEP-LW-4) can use the same fossic-rs embedded pattern already established in Lattica's Tauri backend. Fossic's fossic-rs stability confirmation (DEP-LA-2, now CLOSED via CP-F-13) closed the remaining uncertainty for both Lattica and LumaWeave — fossic-rs embed path proceeds without qualification.

**CP-LA-2 → Fossic — `source_store` path-lookup gap creates a design blocker for §10.1**
CP-F-1 corrects `source_store` to be a project name string (not a file path). This creates a gap in Lattica's `fossic_query_remote_store` design (§10.1): to implement Case 1 causation traversal, the Tauri command must resolve a project name string (e.g., `"cerebra"`) to a vault store path (e.g., `~/.cerebra/.fossic/store.db`) and open it with `require_existing`. No path can be reconstructed from the project name alone without a lookup mechanism. Filed as DEP-LA-1 for Fossic to resolve.

*[Resolved via CP-F-12] No platform-wide vault path convention exists. DEP-LA-1 CLOSED — Lattica maintains its own project-name → vault-path registry at `~/.lattica/project-registry.toml`, populated by per-project relay agent ship notifications (DEP-LA-3 protocol). `fossic_query_remote_store` design unblocked.*

**CP-LA-3 → all projects — §1 and §2.2/§4.3 compile corrections queued for next compile pass**
The following errors will be corrected in the next compile pass (not blocking current work; flagging for awareness):
- §1 "What the round did NOT accomplish": remove "LumaWeave's store-path migration code does not yet exist" (per CP-LW-3 — no migration was ever needed)
- §2.2 `source_store` description: correct from "path to originating project's local vault store" to "originating project's name identifier string (e.g. `'cerebra'`), set by `relay_append` as `source_prefix`" (per CP-F-1, CP-F-11)
- §4.3 `relay_event()` inline comment: correct `"source_store": source_prefix` note — currently misleadingly annotated as a path in the prose around it (per CP-F-1)

No action needed from other projects for these corrections.

*[All three corrections applied] §1 store-migration line removed (Wave 5b Edit 1). §2.2 source_store description corrected by Fossic in Wave 1 (accepted per CP-LA-7). §4.3 was already clean — no prose edit needed. CP-LA-3 fully resolved.*

**CP-LA-4 → Policy Scout — Posture pill broken-pending status corrected; no action needed**
CP-PS-3 is acknowledged and correct. Lattica will split the "Policy Scout tile / 4-state posture pill" row in the broken-pending table (§6.6) in the next compile pass:
- "4-state posture pill live state (CLI polling)" → NOT broken-pending; already live via Track A HTTP polling
- "Posture transition history (policy-scout/posture stream)" → `wiring-incomplete`; blocked on PS relay agent shipping

No action needed from Policy Scout.

*[Applied — Wave 5b Edit 2] §6.6 broken-pending table row 9 now reads "Posture transition history (policy-scout/posture stream) | PS fossic relay live | `wiring-incomplete`". Split complete.*

**CP-LA-5 → all projects — §5.3 relay filter pseudocode is illustrative only; Appendix C is authoritative**
§5.3 presents relay filters as callable functions (`def lumaweave_relay_filter(event) -> bool`, etc.) for LumaWeave, Cerebra, Policy Scout, and ai-stack. Appendix C and the CP round clarify the actual patterns in use:
- LumaWeave: `relay_filter={"SourceLoaded", "SourceLoadFailed", "SourceSwitched", "GraphLayoutSettled"}` — set[str] (CP-LW-1)
- ai-stack: `relay_filter={"VramBudgetChanged", "ModelLoaded", "ModelUnloaded", "SidecarStarted", "SidecarStopped"}` — set[str] (CP-AS-1)
- Policy Scout: `relay_filter=set()` + subclass `RelayAgent._should_relay()` with payload inspection (CP-F-3)
- Cerebra: `relay_filter=set()` + `_should_relay()` override using `event.stream_id.startswith(...)` (stream-based, not event-type-based)

The callable pseudocode in §5.3 is illustrative only. Lattica will annotate §5.3 accordingly in the next compile pass. No implementation action required from any project.

*[Closed — Fossic rewrite supersedes] Fossic's Wave 1 §5.3 wholesale rewrite replaced the callable pseudocode with canonical `RelayConfig` + subclass patterns for all four projects. Lattica annotation pass no longer needed. See CP-LA-7.*

**CP-LA-6 → Policy Scout, Cerebra — `upstream_causation_id` payload traversal: noted for causation view design**
CP-PS-4 acknowledged. Lattica's causation view will handle the PS → Cerebra cross-project arc as a payload-level lookup: read `payload.upstream_causation_id` from the hub PS event, resolve that hex ID against `cerebra/agent-trace/*` streams on hub. This is distinct from the `causation_id` header traversal path and will be implemented as a named case in the causation view renderer. No action required from PS or Cerebra now. One item to confirm before building: the field name `upstream_causation_id` in PS event payloads (originally believed to be `CommandRequested`; confirmed via CP-PS-6 to be `DecisionIssued` — see resolution note) — flagging so PS can confirm this string is stable before the causation view renderer is built.

*[Resolved via CP-PS-4, CP-PS-6] Field name `upstream_causation_id` is confirmed stable (protected in `_EXEMPT_KEYS` in `redaction.py`). Hub-visible carrier is `DecisionIssued` (relayed for DENY_AND_ALERT/critical cases), not `CommandRequested` (which stays local per §5.3 relay filter). Field is designed but not yet populated by any PS event factory; renderer uses `payload.get("upstream_causation_id")` guard until hook protocol ships. Lookup target: hub `DecisionIssued` events on `policy-scout/audit/<request_id>`.*

**CP-LA-7 — Wave 2 review: Fossic §2.2 + §5.3 edits accepted (Outcome A)**
Reviewed Fossic's Wave 1 changes. Both accepted without modification.

§2.2: `source_store` implications bullet is now correct — "the originating project's name identifier string … NOT a file path … Case 1 traversal requires a separate path-lookup." The wording matches exactly what Lattica needs for the `fossic_query_remote_store` design gap. CP-LA-3's §2.2 item (CP-F-1, CP-F-11) is **closed** — Fossic did the correction.

§5.3: Wholesale rewrite is clean and correct. Callable pseudocode replaced with canonical `RelayConfig` + subclass patterns for all four projects. ai-stack and LumaWeave now show `relay_filter=set[str]` (CP-AS-1, CP-LW-1). Policy Scout shows `PolicyScoutRelayAgent._should_relay()` with `event.payload()` (CP-F-3, CP-PS-2 fix applied inline). Cerebra shows stream-ID `_should_relay()` override with `event.stream_id` (CP-C-5, CP-F-5 confirmed). CP-LA-5's §5.3 annotation task is **closed** — Fossic's rewrite supersedes Lattica's planned annotation pass.

All CP-LA-3 items now closed: §1 store-migration line removed (Wave 5b), §2.2 corrected by Fossic Wave 1, §4.3 was already clean. CP-LA-3 fully resolved.

---

## 13. Dependency Requests and Wiring Needs

Unresolved items each project needs before their next implementation pass. Grouped by project. Items marked **[BLOCKING]** gate a relay agent or shipped pass; items marked **[PRE-FOLD-IN]** gate the Bo fold-in pass; items marked **[INFORMATIONAL]** are noted for awareness but don't block current work.

---

### 13.1 Cerebra

**DEP-C-1 — `CEREBRA_GRAPH_STREAM` constant definition [BLOCKING — relay filter]**
The `cerebra/graph/<lineage_id>` stream prefix must be defined as a module-level constant before the relay filter can correctly exclude `cerebra/graph/*` events from relay (to prevent double-writing GSA). Location: `cerebra/cognition/event_emitter.py` or a new `cerebra/storage/streams.py`. The `cerebra/agent-trace` and `cerebra/lattice` prefixes should be co-located at the same time to establish the pattern.
*Needs: Cerebra internal — no external dependency.*

**DEP-C-2 — indexed_tags wiring on cycle events [BLOCKING — relay agent]**
Cycle events on `cerebra/agent-trace/<session_id>` must carry `indexed_tags: {session_id, cycle_id, signal_name}` before the relay agent can be correctly implemented. Without these, hub consumers get no filter signal from indexed_tags. Currently not wired in `EventEmitter`.
*Needs: Cerebra internal — no external dependency.*

**DEP-C-3 — `cerebra-relay.py` not yet written [BLOCKING — hub event flow]**
Until the relay agent ships, zero Cerebra cycle events appear in the hub store. CerebraSignalTile fossic subscription remains dark. Policy Scout's witness model prerequisite (Cerebra events on hub) also blocked.
*Depends on: DEP-C-1, DEP-C-2 (indexed_tags). Fossic NW-002/003/005/006/007 — all confirmed closed (Appendix C + CP-F-2, CP-F-5); external API surface blockers cleared. Remaining blockers are Cerebra-internal only.*

**DEP-C-4 — `stream_exists()` stability confirmation [CLOSED — CP-F-7]**
Resolved. Fossic confirmed `stream_exists()` is stable Python API (CP-F-7). Cerebra's store wrapper may call it safely. Relay agent implementation unblocked on this item.
*Resolved by: Fossic CP-F-7.*

**DEP-C-5 — Bot stream migration: `bot/*` → `cerebra/bot/*` [PRE-FOLD-IN]**
Discord-bot currently writes to `bot/lifecycle` and `bot/conversation/<channel_id>`. Under fold-in, these become `cerebra/bot/lifecycle` and `cerebra/bot/conversation/<channel_id>`. Stream name constants must be defined in Cerebra's codebase. Discontinuity decision made: **clean break** — old `bot/*` hub events are not migrated or snapshotted. Implementation pending fold-in pass.
*Needs: Cerebra internal — fold-in pass work.*

**DEP-C-6 — `FOSSIC_STORE_PATH` migration in discord-bot [PRE-FOLD-IN]**
`bot.py` independently constructs `~/.lattica/fossic/store.db`. Under fold-in, migrated code must use `Store.open("~/.lattica/fossic/store.db")` directly — there is no `FossicStore.at_platform_path()` in fossic-py (CP-F-9: `FossicStore` is Cerebra's internal wrapper class, not a fossic-py export). Two independent constructions of the same path is a silent divergence risk if the platform convention ever changes.
*Needs: Cerebra internal — fold-in pass work.*

**DEP-C-7 — Bo fold-in pass [PRE-FOLD-IN — gates cerebra/bot/* streams]**
All `cerebra/bot/*` stream work, relay filter bot entries, and the two-persona architecture are gated on this pass shipping. Currently unscheduled.
*Depends on: DEP-C-5, DEP-C-6, routing path decision (OllamaDirectAdapter confirmed).*

---

### 13.2 LumaWeave

**DEP-LW-1 — Fossic API surface confirmations (NW-002/003/005/006/007) [CLOSED]**
All five items resolved:
- NW-002: `event.payload()` returns deserialized Python object (dict/list/etc) — closed by CP-F-2
- NW-003: `read_by_external_id(stream_id, external_id)` — two args required, confirmed by Appendix C C.2
- NW-005: `indexed_tags()` is a method call returning `Optional[dict]`; use `or {}` guard — confirmed by Appendix C C.3
- NW-006: `StorageError` is the correct exception class; `StoreConnectionError` does not exist — confirmed by Appendix C C.4
- NW-007: `event.branch` is a `#[getter]` returning `str`, never None, always present on `StoredEvent` — closed by CP-F-5
*Resolved by: Fossic CP-F-2, CP-F-5, Appendix C.*

**DEP-LW-2 — `source_store` indexed tag value: file path vs. project name string [CLOSED]**
Resolved by CP-F-1: `source_store` = `source_prefix` project name string (e.g., `"lumaweave"`). Appendix C C.3 is authoritative. LumaWeave's `relay_append` uses `"source_store": "lumaweave"` via the `source_prefix` parameter. §2.2 and §4.3 errors noted by Fossic (CP-F-11) and queued for correction by Lattica in next compile pass (CP-LA-3). *[CP-LA-3 applied]* §2.2 corrected by Fossic Wave 1 (accepted per CP-LA-7); §4.3 was already clean. No further action needed.
*Resolved by: Fossic CP-F-1.*

**DEP-LW-3 — `Store.close()` and `StoreNotFoundError` API surface [CLOSED]**
Both questions answered by CP-F-4:
- `Store.close()` is absent from pyo3 Python bindings entirely — do not call it; connections release via RAII/GC. No `finally` block needed in relay agent.
- `StoreNotFoundError` is only raised when `Store.open(path, OpenOptions(on_first_open="require_existing"))` is explicitly passed. Relay agents using default `Store.open()` (CreateIfMissing) never see it. `StorageError` in the reconnect loop is the only exception class needed.
*Resolved by: Fossic CP-F-4.*

**DEP-LW-4 — Hub fossic subscription API for Rust/Tauri [PLANNING-UNBLOCKED — GSA receive path]**
Working design established by CP-F-10 (Fossic) + CP-LA-1 (Lattica): fossic-rs has `Store::subscribe()` in Rust; Lattica already uses fossic-rs embedded in the Tauri backend for hub subscriptions (`fossic_subscribe` command, `src-tauri/src/lib.rs`). LumaWeave will follow the same pattern — embed fossic-rs in LumaWeave's Tauri backend and subscribe to `cerebra/graph/*` on the hub store from Rust. Formal stability guarantee for fossic-rs as an external embedding target is pending DEP-LA-2 (Lattica's open request to Fossic). If DEP-LA-2 returns a negative answer, both LumaWeave and Lattica would migrate to the Python IPC bridge together.
*Working plan locked: fossic-rs embed (option a). DEP-LA-2 resolved (conditional yes via CP-F-13) — fossic-rs embed proceeds without qualification. LumaWeave follows Lattica's lead on any future pivot.*

---

### 13.3 Policy Scout

**DEP-PS-1 — relay_filter callable pattern: `set[str]` is insufficient for PS [CLOSED — via CP-F-3]**
~~PS's relay filter makes conditional relay decisions based on payload content, not event type alone. `RelayConfig.relay_filter: set[str]` cannot express DENY_AND_ALERT or critical risk_band conditions.~~
**Resolution:** `relay_filter=set()` (empty) in `RelayConfig` + `PolicyScoutRelayAgent` subclass overriding `_should_relay(event)` with payload inspection. `relay_append` is still called by the base `relay_event()` — the subclass only overrides the filter gate. Canonical example code in CP-F-3.

**DEP-PS-2 — `event.payload()` vs `event.deserialize_payload_json()` [CLOSED — via CP-F-2]**
~~PS's relay filter calls `event.deserialize_payload_json()` in its federation design §B.2. Need confirmation which method exists.~~
**Resolution:** `event.payload()` is the only payload accessor on `StoredEvent`. `deserialize_payload_json()` does not exist — calling it raises `AttributeError`. All references in PS's planned relay agent code (including §5.3's PS filter block) must use `event.payload()`.

**DEP-PS-3 — `declare_stream()` call pattern: idempotency confirmation [CLOSED — via CP-F-6]**
~~Need Fossic to confirm whether `declare_stream()` is safe to call on every event write or should be hoisted to startup.~~
**Resolution:** `declare_stream()` is `INSERT OR IGNORE` at the SQL layer — idempotent, safe per-event. Pass E's per-event call pattern is correct. Hoisting to startup is a cleanliness optimization, not a correctness requirement.

---

### 13.4 ai-stack

**DEP-AS-1 — Local vault store path convention [CLOSED via CP-F-8]**
No path convention imposed by fossic; ai-stack's `~/Projects/ai-stack/.fossic/store.db` choice is confirmed fine. `FOSSIC_STORE_PATH` migration in `fossic_sidecar.py` can proceed.

**DEP-AS-2 — `VRAM_WARN_PCT_THRESHOLD` alignment [CLOSED via CP-C-6 — indexed_tags pass pending]**
What percentage constitutes a platform-level GPU warn state for the `warn` indexed_tag on `VramBudgetChanged`? ai-stack's default is 80%. This may need to shift once Cerebra establishes the VRAM floor under both training model and witness model active simultaneously (Phase 15+). ai-stack can ship the indexed_tags pass with 80% now; if Cerebra's threshold differs, a one-line constant change is the full correction. Noting here so Cerebra has visibility before ai-stack commits the default.
*Needs: Cerebra decision (non-blocking for the pass; affects semantic correctness of `warn` tag on day one).*
*[CP-C-6 response received]* Cerebra recommends 90% threshold. Rationale: `OllamaDirectAdapter.health_check()` probes place VRAM at ~92% under active sessions; 80% default fires throughout normal lifecycle rather than signaling genuine pressure. ai-stack ships indexed_tags pass with `VRAM_WARN_PCT_THRESHOLD = 90`; Cerebra follows up if Phase 15+ concurrent-model VRAM floor changes the recommendation.

**DEP-AS-3 — `event.branch` and `event.stream_id` on `StoredEvent` [CLOSED via CP-F-5]**
Both `event.branch` and `event.stream_id` confirmed as `#[getter]` returning `str` (never `None`). Available on events delivered by `local_store.subscribe()`. `ai-stack-relay.py` implementation unblocked.

**DEP-AS-4 — Fossic NW items confirmed by Appendix C [INFORMATIONAL — closed for ai-stack]**
The following items from Fossic §6.1 are resolved for ai-stack's purposes by Appendix C:
- NW-002: `event.payload()` confirmed — used in `relay_append`
- NW-003: `read_by_external_id(hub_stream_id, external_id)` — two args confirmed
- NW-005: `event.indexed_tags()` returns `Optional[dict]`; use `event.indexed_tags() or {}` pattern confirmed
- NW-006: `StorageError` confirmed as the correct exception name in `run()` loop
ai-stack treats these as closed and will implement `ai-stack-relay.py` accordingly. All Fossic API surface items now closed for ai-stack — zero remaining Fossic API blockers.

---

### 13.5 Fossic

**DEP-F-1 — ai-stack stream event type names: verification requested [CLOSED — ai-stack Wave 7 verification]**
§11.8 flagged ai-stack event type names in §6.5 and Appendix A as potentially invented (`GpuStatusChanged`, `ModelLoaded`, `ModelUnloaded`, `ServiceHealthChanged`, `ServiceStarted`, `ServiceStopped` were the original compile values). CP-AS-1 now lists the event types ai-stack will use: `VramBudgetChanged`, `ModelLoaded`, `ModelUnloaded`, `SidecarStarted`, `SidecarStopped` (replacing `ServiceStarted`/`ServiceStopped` with sidecar equivalents). Fossic requests ai-stack confirm these are the actual `event_type` string values in their codebase — not just planned names — so Appendix A can be marked verified and any relay agent examples can use correct strings.
*Needs: ai-stack confirmation of event_type string values against their shipping code.*
*[CLOSED — ai-stack Wave 7 verification]* Confirmed against `fossic_sidecar.py`: `VramBudgetChanged` (line 142), `ModelLoaded` (line 156), `ModelUnloaded` (line 165) are the actual `event_type` strings in shipped sidecar code. `SidecarStarted` and `SidecarStopped` are not in the file — `ai-stack/lifecycle` stream is not yet implemented, consistent with the Appendix A annotation "Proposed; not yet implemented". Appendix A ai-stack rows are verified correct.

**DEP-F-2 — Cerebra cycle event types: confirmation requested [CLOSED — resolved by CP-C-7]**
~~Appendix A lists `cerebra/agent-trace/<session_id>` and `cerebra/lattice/<lineage_id>` event types as "not yet specified — requires verification."~~
**Resolution:** CP-C-7 (Cerebra, Wave 3) delivered confirmed event type strings from direct reads of `cycle_runtime.py`, `daemon.py`, and related runtime modules — 17+ types for `cerebra/agent-trace/<session_id>`, plus `cerebra/control` event types. See §12.1 CP-C-7 for the canonical list. Appendix A `cerebra/agent-trace/<session_id>` row was updated in Wave 7 Edit 8 to reference CP-C-7's canonical list. Closure fully propagated.
*Resolved by: Cerebra CP-C-7.*

**DEP-F-3 — No blocking external dependencies [status note]**
`relay.py` and the 23-test relay test suite are shipped. All API surface items needed to implement `relay_append`, `RelayAgent`, `_translate_causation_id`, and `_hub_stream_id` were resolved against the live pyo3 bindings. No external project is blocking fossic's current or next-wave work.

---

### 13.6 Lattica

**DEP-LA-1 → Fossic [CLOSED — via CP-F-12]**
`source_store` is confirmed as a project name string (CP-F-1). `fossic_query_remote_store` (§10.1) must open a remote vault with `OpenOptions(on_first_open="require_existing")` — but the vault path cannot be reconstructed from `"cerebra"` or `"lumaweave"` alone without a lookup mechanism. Lattica needs one of: (a) a platform-wide vault path convention fossic defines (e.g., all project vaults live at some derivable path from the project name), or (b) confirmation that no such convention exists and Lattica should maintain its own project-name → vault-path registry with per-project declarations. Either answer unblocks the `fossic_query_remote_store` Tauri command design.
*Needs: Fossic design guidance on project vault path convention. Blocks §10.1 implementation.*

*Resolution: No platform-wide vault path convention. Lattica maintains its own project-name → vault-path registry at `~/.lattica/project-registry.toml`, populated by per-project relay agent ship notifications (DEP-LA-3 protocol). Each project declares its vault path when its relay agent first ships.*

**DEP-LA-2 → Fossic [CLOSED — conditional yes via CP-F-13]**
Lattica's Tauri backend embeds fossic-rs directly for hub subscriptions (`fossic_subscribe`, `src-tauri/src/lib.rs`). CP-F-10 notes fossic-rs is not published to crates.io and has no formal embedding contract for external consumers. Lattica needs Fossic's position: is fossic-rs maintained as a stable embedding target for Tauri consumers, or is it internal-only? If stable → Lattica continues current approach into Phase 2. If internal-only → Lattica migrates hub subscription path to fossic-py IPC bridge before Phase 2 tile wiring begins. This also answers DEP-LW-4 for LumaWeave's GSA receive path, since LumaWeave would follow Lattica's chosen pattern.
*Needs: Fossic position on fossic-rs external embedding. Relevant before Phase 2 tile wiring; not blocking Wave 1-4.*

*Resolution: Conditional yes. Core embedding surface (`Store::open`, `Store::append`, `Store::subscribe`, `StoredEvent` field getters) is stable for Phase 2 purposes. Pin via git commit hash in `Cargo.toml`; Fossic announces breaking changes in #current-task before merging. Crates.io publishing deferred to Phase 2 if recurring concerns emerge. Lattica and LumaWeave proceed on the fossic-rs embedded path without qualification.*

**DEP-LA-3 → all relay-agent projects [PRE-RELAY — operational coordination]**
When each project's relay agent ships (`cerebra-relay.py`, `lumaweave-relay.py`, `policy-scout-relay.py`, `ai-stack-relay.py`), Lattica needs a notification in #current-task so the corresponding tiles can be updated from `pre-relay` → active hub subscription. The notification should include: (1) project name, (2) first event type expected on hub, (3) the `subscribe_pattern` used in the `RelayConfig`. The subscribe pattern determines the hub stream glob Lattica's tile subscription should match — a mismatch here results in a tile that stays dark even after the relay agent ships.
*Needs: Per-project #current-task notification on relay agent ship. Non-blocking; pre-Wave 5.*

*[Partially acknowledged] Cerebra (CP-C-8): project `"cerebra"`, first event `CycleStarted`, subscribe_pattern tentatively `"cerebra/agent-trace/*"` (with `"cerebra/lattice/*"` as second pattern). LumaWeave (CP-LW-5): project `"lumaweave"`, first event `"SourceLoaded"`, subscribe_pattern `"lumaweave/**"`. Policy Scout and ai-stack have not yet posted explicit DEP-LA-3 acknowledgments.*

**DEP-LA-4 → Cerebra [INFORMATIONAL — Bo fold-in tile readiness]**
Lattica will not build `cerebra/bot/*` tile subscriptions until Cerebra confirms Bo fold-in has shipped and `cerebra/bot/lifecycle` and `cerebra/bot/conversation/<channel_id>` are active on hub. Per CP-C-2, these streams do not exist yet. A #current-task notification when fold-in ships is sufficient — no design input needed from Cerebra before that point.
*Needs: Cerebra notification when Bo fold-in ships. Non-blocking.*

*[Acknowledged — CP-C-8] Cerebra will post to #current-task when Bo fold-in ships and `cerebra/bot/lifecycle` + `cerebra/bot/conversation/<channel_id>` are active on hub. Notification protocol confirmed.*

---

*End of FEDERATION_DESIGN_2026-06-16.md*
*Compiled by lattica-claude, Pass v0.3.5r*
*Status: REVIEW-PENDING — awaiting developer + web-claude approval before commit*
