# Baseline — fossic (2026-06-16)

> **Historical snapshot — 2026-06-16.** References to [redacted], [redacted], and discord-bot reflect their status at that date; those modules are now deprecated and removed from the platform.

---

## federation_design

# Fossic Federation Design Response

**Filed by:** fossic-claude
**Date:** 2026-06-16
**Input documents read:**
- `PLATFORM_BASELINE_2026-06-16_v2.md`
- `LATTICA_RECONCILIATION_BRIEF.md`
**Companion file:** `fossic/needs-wiring.md`

---

## Section A — Input Confirmation

Both input documents have been read in full.

**v2 §2.5 (Fossic reconciled state):** Accurate. The relay agent spec, stream naming options, two-case causation model, indexed_tags table, snapshot cold-start cases, and relay agent process location framing all match fossic's reconciliation file. No corrections needed.

**v2 §4.X (34 settled items, S-001 through S-034):** All 34 items are accurate and cross-attributed correctly. The settled log in fossic's reconciliation file is the canonical source; v2 §4.X faithfully preserves it.

**v2 §8 (9 federation interview items):** Relayed correctly from reconciliation. Fossic's responses to §8.1, §8.3, §8.6, and §8.7 are in Section B below.

---

## Section B — Fossic Federation Design

### B.1 — Canonical Relay Agent Interface

This is the protocol conformance specification that every per-project relay agent must satisfy. Projects may extend it but must not omit any required element.

```python
from __future__ import annotations
from dataclasses import dataclass, field
import time
import logging
from typing import Optional

# ── Configuration ─────────────────────────────────────────────────────────────

@dataclass
class RelayConfig:
    local_store_path: str
    """Absolute path to the project's local fossic store (e.g., '.fossic/store.db')."""

    hub_store_path: str
    """Absolute path to the shared hub store ('~/.lattica/fossic/store.db')."""

    source_prefix: str
    """Project identifier used as hub stream namespace and source_store tag value.
    Examples: 'cerebra', 'lumaweave', 'policy-scout', 'ai-stack'.
    Must be stable — changing this breaks hub stream names and causation routing."""

    subscribe_pattern: str
    """Stream glob for local store subscription (e.g., 'cerebra/*', 'lumaweave/*').
    Should cover all streams the relay is responsible for; use '*' only for whole-store relay."""

    relay_filter: set[str] = field(default_factory=set)
    """If non-empty, only event_types in this set are relayed.
    Empty set means relay all event_types matched by subscribe_pattern."""

    batch_size: int = 50
    """Max events to process per subscription flush before yielding. Not a hard cap — the
    subscribe() iterator controls flow; this is a hint for batched-append implementations."""

    reconnect_delay_ms: int = 5000
    """Delay in milliseconds before reconnecting after a store connection failure."""

    max_retry_attempts: int = 5
    """Maximum retry attempts per event before logging the failure and skipping the event.
    Do not set to 0 — transient hub lock contention should be retried."""

    retry_backoff_base_ms: int = 100
    """Initial backoff for per-event retry. Each attempt doubles (exponential backoff)."""


# ── Agent ─────────────────────────────────────────────────────────────────────

class RelayAgent:
    """
    Conformant relay agent. Projects may subclass to override _should_relay()
    for complex filter logic or relay_event() for post-relay side effects.
    All protocol requirements are non-negotiable and must not be removed by subclasses.

    Protocol conformance requirements:
      - D.3 stream naming: conditional strip rule applied to every hub stream_id
      - source_store indexed_tag: added to every relayed event (S-013)
      - branch field: passed through from source event verbatim (S-012)
      - external_id: source event hex ID used as idempotency key (S-014)
      - causation_id: source event's ID for derived events; None for root events (S-030)
      - payload: deserialized to JSON at local relay boundary before hub write (S-015)
    """

    def __init__(self, config: RelayConfig) -> None:
        self.config = config
        self.local_store: Optional[Store] = None
        self.hub_store: Optional[Store] = None
        self.logger = logging.getLogger(f"relay.{config.source_prefix}")

    # ── D.3 stream naming ─────────────────────────────────────────────────────

    def _hub_stream_id(self, local_stream_id: str) -> str:
        """Apply D.3 conditional strip rule.

        If the local stream_id already starts with '<source_prefix>/', use it as-is
        on the hub. Otherwise prepend '<source_prefix>/'.

        Examples (source_prefix = 'cerebra'):
          'cerebra/agent-trace/abc123' → 'cerebra/agent-trace/abc123'  (no change)
          'agent-trace/abc123'        → 'cerebra/agent-trace/abc123'  (prefixed)
        """
        prefix = self.config.source_prefix + "/"
        if local_stream_id.startswith(prefix):
            return local_stream_id
        return f"{prefix}{local_stream_id}"

    # ── Filter ────────────────────────────────────────────────────────────────

    def _should_relay(self, event: StoredEvent) -> bool:
        """True if this event passes the relay filter.
        Empty relay_filter = relay all. Subclass to add content-based routing."""
        if not self.config.relay_filter:
            return True
        return event.event_type in self.config.relay_filter

    # ── Core relay ────────────────────────────────────────────────────────────

    def relay_event(self, event: StoredEvent) -> bool:
        """Relay one event from local store to hub.

        Returns True if the event was appended to hub, False if filtered or
        already present. Raises StoreError on unrecoverable append failure
        (caller is responsible for retry).

        Required protocol steps (in order):
        1. Filter check (_should_relay)
        2. Idempotency check (read_by_external_id)
        3. D.3 stream id mapping (_hub_stream_id)
        4. Payload deserialization (deserialize_payload_json — at local boundary)
        5. Append with all required fields
        """
        if not self._should_relay(event):
            return False

        external_id = event.id.hex()
        if self.hub_store.read_by_external_id(external_id) is not None:
            return False  # Already relayed — idempotent on relay agent restart

        hub_stream_id = self._hub_stream_id(event.stream_id)
        payload = event.deserialize_payload_json()  # Upcast at local boundary (S-015)

        self.hub_store.append(Append(
            stream_id=hub_stream_id,
            event_type=event.event_type,
            type_version=event.type_version,
            payload=payload,
            causation_id=event.id,          # S-030: local source event ID for case-2 chains
            external_id=external_id,        # S-014: idempotency key
            branch=event.branch,            # S-012: must not be omitted
            indexed_tags={
                **event.indexed_tags,       # S-016: project-specific fields (see §2.6 table)
                "source_store": self.config.source_prefix,  # S-013: case-1 causation routing key
            },
        ))
        return True

    # ── Run loop ──────────────────────────────────────────────────────────────

    def run(self) -> None:
        """Main relay loop. Runs forever; exits only on unrecoverable error.

        Connection failure (StoreConnectionError): log, wait reconnect_delay_ms, retry.
        Per-event failure: retry up to max_retry_attempts with exponential backoff,
        then log event ID + error and skip. Never halt the relay for a single bad event.
        """
        while True:
            try:
                self.local_store = Store.open(self.config.local_store_path)
                self.hub_store = Store.open(self.config.hub_store_path)
                self.logger.info(
                    "relay started",
                    extra={
                        "source": self.config.source_prefix,
                        "pattern": self.config.subscribe_pattern,
                    },
                )
                for event in self.local_store.subscribe(self.config.subscribe_pattern):
                    self._relay_with_retry(event)
            except StoreConnectionError as exc:
                self.logger.warning(
                    "store connection lost — reconnecting",
                    extra={
                        "error": str(exc),
                        "delay_ms": self.config.reconnect_delay_ms,
                    },
                )
                time.sleep(self.config.reconnect_delay_ms / 1000)
            except Exception as exc:
                self.logger.error(
                    "relay fatal error",
                    extra={"error": str(exc)},
                    exc_info=True,
                )
                raise

    def _relay_with_retry(self, event: StoredEvent) -> None:
        """Per-event retry with exponential backoff. Skips after max_retry_attempts."""
        for attempt in range(self.config.max_retry_attempts):
            try:
                relayed = self.relay_event(event)
                if relayed:
                    self.logger.debug(
                        "relayed",
                        extra={
                            "event_id": event.id.hex(),
                            "stream": event.stream_id,
                            "event_type": event.event_type,
                        },
                    )
                return
            except Exception as exc:
                if attempt == self.config.max_retry_attempts - 1:
                    self.logger.error(
                        "relay event failed after retries — skipping",
                        extra={
                            "event_id": event.id.hex(),
                            "stream": event.stream_id,
                            "event_type": event.event_type,
                            "error": str(exc),
                            "attempts": self.config.max_retry_attempts,
                        },
                    )
                    return
                backoff_s = (self.config.retry_backoff_base_ms / 1000) * (2 ** attempt)
                self.logger.debug(
                    "relay event failed — retrying",
                    extra={
                        "event_id": event.id.hex(),
                        "attempt": attempt + 1,
                        "backoff_s": backoff_s,
                        "error": str(exc),
                    },
                )
                time.sleep(backoff_s)
```

**Required indexed_tags by project (pre-relay prerequisite, S-016):**

| Project | Event type | Required indexed_tags |
|---|---|---|
| Cerebra | emit_cycle_event, emit_lattice_event | session_id, cycle_id, signal_name |
| LumaWeave | SourceLoaded, SourceFailed, SourceSwitched | adapter_id, source_key |
| LumaWeave | GraphLayoutSettled | dialect_id |
| Policy Scout | CommandRequested, DecisionIssued | request_id, risk_band, decision |
| Policy Scout | ApprovalRequested, Approved | request_id, approval_id |
| Policy Scout | LockdownActivated, LockdownDeactivated | reason |
| ai-stack | ModelLoaded, ModelUnloaded | model_name |
| ai-stack | VramBudgetChanged | warn (bool) |

**causation_id handling — the two cases:**

- **Case 2 (standard relay):** When relaying a local event that was derived from a hub event (e.g., `SourceLoaded` caused by `GraphSnapshotAvailable`), the relay agent must set `causation_id=<local_source_event.id>`. This creates the hub-traversable causal chain. This is the standard case; relay_event() implements it by default.
- **Root events:** Events without an upstream cause at relay time set `causation_id=None`. The relay agent does not synthesize causation — it passes through what the local event carries.
- **Case 1 routing (via source_store):** For hub events whose causation_id targets a local event that was NOT relayed, `walk_causation` fails at `EventNotFound`. The consumer uses the `source_store` indexed_tag to identify the originating store and query it directly. The relay agent's only obligation here is ensuring `source_store` is set correctly on every relayed event (already enforced by this spec).

**Error handling and retry policy summary:**

- Store connection failures: reconnect loop with `reconnect_delay_ms` delay; no event loss (subscription resumes from last position).
- Per-event failures (hub append errors, transient lock contention): exponential backoff starting at `retry_backoff_base_ms`, up to `max_retry_attempts`; event is skipped and logged after exhausting retries. The relay loop continues.
- Fatal errors (store corruption, config errors, unrecoverable API failure): exception propagates from `run()`; the caller (process supervisor) is responsible for restart.
- Idempotency: `external_id = event.id.hex()` means relay agent restarts never produce duplicates on hub.

---

### B.2 — D.3 Stream Naming Convention Ratification (§8.1)

**Fossic explicitly ratifies D.3.**

The conditional strip rule is correct at the protocol level. Fossic's role is as the spec author and substrate — ratifying D.3 means the rule is now encoded in the canonical `RelayAgent._hub_stream_id()` implementation above. Any conformant relay agent inherits it automatically.

**D.3 applied to all four emitting projects:**

| Project | Local stream example | Hub stream under D.3 | Without D.3 |
|---|---|---|---|
| Cerebra | `cerebra/agent-trace/<session_id>` | `cerebra/agent-trace/<session_id>` | `cerebra/cerebra/agent-trace/<session_id>` |
| LumaWeave | `lumaweave/graph/events` | `lumaweave/graph/events` | `lumaweave/lumaweave/graph/events` |
| Policy Scout | `policy-scout/audit/<request_id>` | `policy-scout/audit/<request_id>` | (already correct — streams start with `policy-scout/`) |
| ai-stack | `ai-stack/gpu` | `ai-stack/gpu` | `ai-stack/ai-stack/gpu` |

Policy Scout's streams pass through under both D.3 and the naive rule — D.3 is consistent and correct for all four.

**Protocol-level concern: stream_exists() interaction (Cerebra D.8)**

Cerebra calls `stream_exists()` before `read_events()` in `FossicStore.read_events()`. This is a read-path concern; it does not interact with D.3. Relay agents use `read_by_external_id()` for idempotency and `append()` for writes — neither call site is affected by D.3. The `stream_exists()` stability risk (D.8) is independent: it is about whether Cerebra can safely depend on the API not changing, not about stream naming.

The one subtle note for Lattica (the tile consumer): under D.3, hub stream names are identical to local stream names for all four projects. Stream prefix chips in the Fossic substrate tile can display stream names directly without stripping a relay prefix. Design should proceed on this assumption.

**With fossic's ratification the count is now 4 of 5 explicit endorsements** (Cerebra proposer, ai-stack Round 2, LumaWeave C.8, Fossic ratification). Lattica's position is the remaining input for full canonical status.

---

### B.3 — relay_append Convenience Helper

**Recommendation: ship before the first relay agent.**

Rationale: if relay agents ship first, each project writes `hub_store.append(Append(...))` inline with the full field list. Small inconsistencies will accumulate — a project forgets `branch`, another omits `source_store` from indexed_tags, a third uses a different retry pattern. The helper enforces the protocol at the call site and makes non-conformance visible rather than silent.

The helper is a small fossic-py addition, not a redesign. It wraps the `append()` call with enforced protocol fields:

```python
def relay_append(
    hub_store: Store,
    event: StoredEvent,
    source_prefix: str,
    hub_stream_id: str,           # Already D.3-processed by RelayAgent._hub_stream_id()
    payload: dict,                # Already deserialized by deserialize_payload_json()
    extra_indexed_tags: dict = None,
) -> None:
    """Enforces: source_store tag, branch field, external_id idempotency key,
    causation_id=event.id. Caller handles the read_by_external_id check before calling."""
    hub_store.append(Append(
        stream_id=hub_stream_id,
        event_type=event.event_type,
        type_version=event.type_version,
        payload=payload,
        causation_id=event.id,
        external_id=event.id.hex(),
        branch=event.branch,
        indexed_tags={
            **(extra_indexed_tags or {}),
            **event.indexed_tags,
            "source_store": source_prefix,
        },
    ))
```

`RelayAgent.relay_event()` can call `relay_append()` internally; per-project extensions call it too. The `RelayAgent` class above is the primary interface — `relay_append` is a lower-level building block for projects that don't subclass `RelayAgent`.

**Size:** one-pass, fossic-py only, no Rust changes. Can ship as part of the Fossic relay preparation pass immediately.

---

### B.4 — In-Process Relay Subscription Primitive

**Recommendation: defer.**

There is no current Rust-to-Rust relay need. All five emitting projects have Python relay agents as the leading model. An in-process relay primitive would require changes to fossic's Rust core (exposing a subscribe-and-forward channel pair across store handles) for a use case that hasn't materialized.

The cost of adding it later is low — the `subscribe()` API is already stable; wrapping it in a relay primitive is a small addition. The cost of adding it now is non-trivial: it expands fossic's API surface, requires documentation, and may constrain future internal refactors.

**Defer until a concrete project with a Rust relay requirement surfaces.** If ai-stack's sidecar moves from Python to Rust at some point, that would be the moment to revisit.

---

### B.5 — Protocol-Level Open Questions

#### §8.3 — Relay Agent Process Model

**Fossic recommendation: standalone Python process per project (option a).**

Correctness argument: relay agents are per-project; their failure modes are per-project. A cerebra relay agent failing because `.fossic/store.db` is locked should not affect the lumaweave relay agent. With a shared orchestrator or hub-launched coordinator, one agent's error handling can cascade. Standalone processes fail independently.

Observability argument: each standalone process has its own logs, its own PID, its own restart history. A `systemd` unit or `supervisord` config per relay agent gives the developer independent visibility into each project's relay health without cross-project noise.

Performance argument: five Python processes at idle consume negligible resources. The subscribe() call blocks on SQLite WAL reads; no busy loop. Per-project relay agents are not a meaningful memory or CPU cost at this scale.

Fossic-side implication: the store's WAL mode supports N concurrent readers; multiple relay agents reading from the shared hub store simultaneously is already supported. No fossic changes needed for either model — this is purely a process topology decision.

If the developer chooses a Lattica-managed coordinator in the future, the `RelayConfig` / `RelayAgent` spec remains compatible — each project's config object is simply instantiated and run inside the coordinator.

#### §8.6 — Hub-Side Snapshot Coordination

**Fossic recommendation: snapshot-on-subscribe (consumer requests snapshot at subscription start).**

The three canonical cold-start cases from S-026 are all consumer-side gaps, not emitter-side gaps:
- ai-stack tile subscribes; up to 10s of GPU state already happened → tile requests snapshot on subscribe.
- LumaWeave tile subscribes; LumaWeave already in loaded state → tile requests snapshot at last `SourceLoaded` on subscribe.
- Policy Scout tile subscribes; pending approvals exist → tile requests snapshot at last `DecisionIssued` on subscribe.

In all three cases the correct behavior is: at subscription start, the consumer asks fossic for the most recent snapshot on the relevant stream. The emitting project does not need to know or care when consumers subscribe.

Snapshot-on-emit (writer publishes snapshot when event count reaches a threshold) creates write-side coupling: the emitting project must track consumer timing concerns, choose a snapshot interval, and emit extra events that are only useful for cold-start. For a small subscriber pool (tiles + witness model), this is overhead without benefit.

Fossic's snapshot API is already shaped for snapshot-on-subscribe. Adoption is a per-project tile change in Lattica's subscription setup code, not a fossic-core change.

**One open question for the federation interview:** does fossic need to expose a convenience API for "subscribe and seed from latest snapshot atomically"? The current approach (request snapshot, then start subscribe) has a race window if a new event arrives between the snapshot request and the subscription start. This is typically acceptable for state-seeding (the subscription will catch the event), but worth confirming with Lattica tile authors.

#### §8.7 — Cross-Substrate Causation Rendering (Case 1)

**Fossic recommendation: direct fossic-tauri command.**

Expose: `fossic_read_event_from_store(store_path: String, event_id: String) -> Result<Option<SerializedEvent>, Error>`.

This command opens the specified store (read-only), reads the event by ID, and returns it. The call sites look like:

```typescript
// In Lattica tile, after walk_causation fails with EventNotFound:
const sourceStore = event.indexed_tags.source_store; // "cerebra" | "lumaweave" | ...
const storePath = resolveStorePathForProject(sourceStore); // Tile-side path registry
const causalEvent = await invoke("fossic_read_event_from_store", {
  storePath,
  eventId: event.causation_id.hex(),
});
```

Why direct Tauri command over Lattica-proxied:
- Store topology knowledge belongs in Lattica's tile layer, not in fossic's Rust core. Fossic should not need to know that "cerebra" maps to `/home/boop/Projects/cerebra/.fossic/store.db`. Lattica already knows this to configure tiles.
- A Lattica proxy adds an indirection layer with no benefit — Lattica's Tauri backend already has direct filesystem access.
- Direct command is already consistent with how tiles query the hub store (`fossic_read_batch`, etc.). Adding `fossic_read_event_from_store` is a natural extension of the existing Tauri command surface.

**Size:** small fossic-tauri addition. Can be filed as a federation pass deliverable, not a blocker for relay agent work.

---

### B.6 — Witness Model Hub Projection Wiring (§8.4)

**Architecture recommendation: hub subscription with reducer (witness model subscribes to hub store directly as a hub consumer).**

The relay agent's job is to bridge local store → hub. The relay agent does not know or care who reads from the hub. The witness model's job is to project hub events into Cerebra's memory layer for cognitive cycle enrichment.

These are two independent concerns. Coupling them (relay agent also pushes to witness model directly, or witness model taps into relay agent's subscription) would require relay agents to have Cerebra-internal knowledge and would make the witness model's startup sequence depend on relay agent availability.

Clean architecture:

```
[Cerebra local store]
      │
      ▼ (relay agent — local → hub)
[~/.lattica/fossic/store.db (hub)]
      │
      ├──► Lattica tiles (fossic-tauri commands)
      └──► Cerebra witness model reducer (direct hub subscription)
               │
               ▼ (projection into Cerebra's memory layer)
         [Cerebra cognitive cycle context]
```

Witness model reducer is just another `store.subscribe()` call on the hub store, filtered to the minimum projection scope (S-008): `LockdownActivated`, `LockdownDeactivated`, `ApprovalRequested`, `VramBudgetChanged`, `ModelLoaded`, `ModelUnloaded`. The subscribe pattern would be something like `policy-scout/*` + `ai-stack/*` (or using `relay_filter` on event_type equivalently).

**Prerequisites remain unchanged from S-008:** Policy Scout relay + ai-stack relay must be live before the witness model has any data to project.

No fossic-side changes needed for this architecture. The hub subscription API already supports this pattern.

---

### B.7 — Bo Discord Persona Under Federation

**Confirmed.** `bot/lifecycle` and `bot/conversation/<channel_id>` streams become Cerebra relay streams under the ai-stack/Bo federation model.

Specifically:
- Bo is being folded into Cerebra (per reconciliation §2.5 Bo + ai-stack shared relay design)
- The shared ai-stack+Bo relay agent will carry two filter rule sets: one for `ai-stack/*` streams, one for `bot/*` streams
- When Bo persona is absorbed into Cerebra's relay agent, the bot/* filter rules transfer to Cerebra's relay agent configuration
- Cerebra's relay agent is responsible for deciding which `bot/*` streams relay to hub (federation interview item §8.8 — not yet decided, but that's Cerebra's design question)

**No fossic-side change needed.** Fossic's hub store accepts any stream prefix; `bot/*` streams already land there from Bo's direct writes today. Under federation, they continue to land there through the relay agent. The `source_store` tag will be `"ai-stack"` (or `"bo"` — to be decided by Cerebra's relay agent design). Fossic doesn't hard-code project identifiers.

---

## Section C — Cross-Cutting Items

### C.1 — Broken-Pending UI Discipline (Fossic Substrate Tile)

| Tile element | What provides live data | Blocks live data | Bake in as broken-pending? |
|---|---|---|---|
| Store path display | Lattica Tauri backend static config | Nothing — config is known | **No — live today** |
| Subscriber list (`fossic_list_subscribers`) | Works against any store, no relay needed | Nothing | **No — live today** |
| Subscription health pill | `fossic_subscription_status` (working) | Nothing | **No — live today** |
| Hub event total count | Store row count (any events present) | Nothing — ai-stack+Bo events present | **No — partially live** (ai-stack+Bo only) |
| Per-stream last event timestamp | Store query by stream | Nothing for ai-stack+Bo streams | **No — partially live** (ai-stack+Bo streams only) |
| Event rate gauge (platform-wide) | `_fossic/system` stream + full relay coverage | All relay agents live | **Yes — broken-pending until full relay** |
| Per-project event counts | Relay agents live for each project | All relay agents live | **Yes — broken-pending** (shows 0 for Cerebra, LumaWeave, PS) |
| Active relay agents panel | Relay agent process health reporting | Relay agents + health reporting protocol | **Yes — broken-pending** (no relay agents yet) |
| Cerebra cycle events in hub | Cerebra relay agent | Cerebra relay pass | **Yes — broken-pending** (S-017: CerebraSignalTile dark) |
| Case-2 causation chain visualization | Both ends relayed to hub | Per-chain relay coverage | **Yes — broken-pending until both chain endpoints relayed** |
| Case-1 causation link rendering | `fossic_read_event_from_store` command + tile routing | B.5 §8.7 command exposed | **Yes — broken-pending** (command not yet exposed) |
| GraphSnapshotAvailable subscription | Cerebra relay + event schema decided | §8.2 schema + Cerebra relay | **Yes — broken-pending** |

**Summary:** Store introspection elements (path, subscribers, subscription health) are live today. Data-coverage elements (event counts, rates, per-project streams) are broken-pending until relay agents are live. Causation chain elements are broken-pending until both relay coverage and the `fossic_read_event_from_store` command exist.

---

### C.2 — No Hard-Coded Values Discipline

Ambiguities logged in: `~/Projects/lattica/docs/coordination/baselines/2026-06-16/fossic/needs-wiring.md`

Filed concurrently with this document.

---

### C.3 — Cross-Claude Question Protocol

Outbound path:
```
~/Projects/lattica/docs/coordination/outbound/<date>_fossic_to_<target>_<topic>.md
```

Use prefix `binding-question-` for wiring questions:
```
~/Projects/lattica/docs/coordination/outbound/2026-06-16_fossic_to_lattica_binding-question-store-path-confirmation.md
```

Use prefix `design-question-` for architectural questions:
```
~/Projects/lattica/docs/coordination/outbound/2026-06-16_fossic_to_cerebra_design-question-graphsnapshotavailable-schema.md
```

---

### C.4 — File Ownership Boundaries

**Fossic-owned files (Rust core, fossic-py, fossic-tauri):**

| File / directory | Owner | Notes |
|---|---|---|
| `/home/boop/Projects/fossic/src/` | fossic-claude / fossic-rust | Core store implementation |
| `/home/boop/Projects/fossic/fossic-py/` | fossic-claude | Python bindings + RelayAgent class |
| `/home/boop/Projects/fossic/fossic-py/fossic/relay.py` | fossic-claude | RelayConfig + RelayAgent canonical spec (to be created) |
| `src-tauri/src/fossic/` (in Lattica tree) | fossic-claude + lattica-claude | fossic-tauri Rust commands; fossic owns the API shape, Lattica owns the Tauri wiring |
| `~/.lattica/fossic/store.db` | runtime artifact | Not source-controlled; owned by Lattica's Tauri backend at runtime |

**Files in Lattica's tree that are fossic-authored (or jointly owned):**

| File / directory | Primary owner | Notes |
|---|---|---|
| `src-tauri/src/fossic/commands.rs` | fossic-claude (API shape) + lattica-claude (wiring) | fossic defines command signatures; Lattica wires them into Tauri |
| `src/components/fossic/` (substrate tile) | lattica-claude | Fossic substrate tile — Lattica owns; fossic provides API contract |
| Any `_fossic/system` stream renderer | lattica-claude | fossic defines event schema; Lattica renders |

**claude-design export mapping:**

When fossic's design is exported for the claude-design registry, the primary surfaces are:
1. `RelayConfig` + `RelayAgent` class (fossic-py) — the relay agent protocol spec
2. `Store` API: `open`, `append`, `subscribe`, `read_by_external_id`, `snapshot`, `walk_causation` — the store surface that relay agents and tiles depend on
3. `fossic-tauri` command signatures: `fossic_read_batch`, `fossic_list_subscribers`, `fossic_subscription_status`, and the forthcoming `fossic_read_event_from_store`
4. `_fossic/system` event schema — the store self-observability stream

---

### C.5 — Net-Writer / Net-Reader Role Confirmation

Confirmed, with one clarification:

| Role | Entity | Net-writer? | Net-reader? |
|---|---|---|---|
| fossic-the-substrate | The store itself (Rust core) | Neither | Neither |
| fossic-self-observability | `_fossic/system` stream (store emits internal events) | Yes — net-writer | No |
| fossic-py relay agents | Python relay processes (per project) | Yes — write to hub on behalf of local projects | Yes — read from local project stores |
| Fossic substrate tile (in Lattica) | `src/components/fossic/` | No | Yes — net-reader |

**Clarification on relay agents:** relay agents are technically both readers (of the local project store) and writers (to the hub). Their net flow is local → hub, so they are net-writers at the hub level and net-readers at the local-store level. The fossic spec authors relay agents; the relay agents are not "fossic" itself — they are fossic-protocol-conformant per-project processes.

**fossic-the-substrate** is neither writer nor reader in the hub topology sense. It provides the store; other processes write to it and read from it.

---

## Section D — Deliverable Confirmation

`federation_design.md` is filed at:
```
~/Projects/lattica/docs/coordination/baselines/2026-06-16/fossic/federation_design.md
```

`needs-wiring.md` is filed at:
```
~/Projects/lattica/docs/coordination/baselines/2026-06-16/fossic/needs-wiring.md
```

**Open items surfaced in this response that require cross-project action:**

| Item | What's needed | Who |
|---|---|---|
| D.3 full ratification | Lattica position (fossic now explicitly ratified) | Lattica |
| `fossic_read_event_from_store` Tauri command | Design + implementation for §8.7 case-1 rendering | fossic-tauri (small pass) |
| relay_append helper | fossic-py addition before first relay agent ships | fossic-py (small pass) |
| Snapshot-on-subscribe race window | Confirm atomicity requirement with Lattica tile authors | Lattica + fossic |
| §8.3 process model ratification | Standalone Python confirmed by each emitting project | All emitting projects |
| §8.8 bot/* relay filter spec | Which streams relay to hub; filter rules for ai-stack+Bo relay agent | ai-stack/Bo (under Cerebra) |

End of fossic federation design.

---

## reconciliation

# Fossic — Baseline Reconciliation

**Date:** 2026-06-16 (updated after reading all project reconciliations)
**Filed by:** fossic-claude
**Responding to:** `PLATFORM_BASELINE_2026-06-16.md` (lattica-claude compile, v0.3.5t)
**My baseline:** `baselines/2026-06-16/fossic/current_state.md`
**Cross-read:** all four peer reconciliations (`cerebra/`, `lumaweave/`, `policy-scout/`, `ai-stack-bo/`)

---

## General Question A — Self-representation accuracy (Section 2.5)

Section 2.5 is accurate. The compile faithfully relayed the fossic baseline without distortion or omission. Specific checks:

- **Version v1.0.0aa / commit b3a4527** — correct
- **Phases 1–6b enumeration** — all seven shipping phases listed correctly with accurate summaries
- **v1.0.0x–v1.0.0aa** — registry reconciliation → TD-008 → PD-009 → PD-007 registry close: all four correctly listed
- **Open tech debt table** — TD-001/TD-003/TD-004/TD-007 with correct severities and triggers
- **Open polish debt: None** — correct; all PD items resolved as of v1.0.0aa
- **Tauri command table** — `fossic_list_subscribers`, `fossic_subscription_status`, `fossic_read_batch` all correctly described
- **Relay protocol pseudocode** — transcribed verbatim from baseline §6; the `external_id + causation_id + namespaced stream_id` shape is correct
- **Risks section** — all five risks (schema migration, snapshot coordination, causation chains, wall-clock ordering, `read_pool_timeout_ms` tuning) faithfully relayed

One note: the compile accurately flags that `relay_append` and in-process relay subscription are not yet built. That matches current state — both remain in the "not-yet-built federation items" list.

No corrections needed to Section 2.5.

---

## General Question B — What others said about fossic

Reading the other projects' baselines and their reconciliations surfaced several fossic-relevant signals. Updated with corrections from peer reconciliations.

### Cerebra (§2.1 + cerebra reconciliation)

- **`stream_exists()` concern** — Cerebra calls `stream_exists()` before `ReadQuery`. No changes planned to `stream_exists()` in the current roadmap; it's not stable-API-flagged. Worth tracking for future refactors.

- **Critical store path gap (surfaced by Cerebra reconciliation)** — Cerebra's reconciliation confirms what my baseline implied but didn't make explicit: CerebraSignalTile in Lattica subscribes to `cerebra/agent-trace/*` on the **shared** `~/.lattica/fossic/store.db`, but Cerebra writes all its events to its **local** `.fossic/store.db`. These are different paths on the same filesystem. The tile currently sees zero Cerebra cycle events from fossic subscriptions. This is not a wiring bug — it's the expected state before migration or relay. But it needs to be explicit in the federation design: the tile's fossic subscription is effectively a no-op until (a) Cerebra migrates to the shared store, or (b) a relay agent bridges the local store to the shared hub store. The daemon HTTP polling in CerebraSignalTile works correctly (different path), but the fossic subscription path is dark.

- **Daemon port note** — Cerebra's reconciliation confirms their baseline had a port error (7474 was wrong; 7432 is correct). My reconciliation and the compile's §5 both use 7432 correctly. No action from fossic's side; noted for completeness.

- **Snapshot cadence** — Cerebra snapshots every 20 events via `EventEmitter`. My baseline recommended 10 for TD-001 mitigation. The gap (10 vs 20) is not alarming — snapshots are idempotent and Cerebra is snapshotting. If they observe latency with the PyO3 bridge, tightening to 10 is a one-line change. Not a fossic issue.

- **`inspector_events` SQLite fold-in path** — Cerebra notes that `indexed_tags_filter` (Phase 4A) partially addresses the `inspector_events` collapse question. The full path requires Cerebra to write new events with `indexed_tags` fields first, then a historical migration pass for older events. Fossic's end is already done.

- **`indexed_tags` adoption gap** — Cerebra's reconciliation confirms they haven't adopted `indexed_tags` on event writes yet. They're still doing Python fold-time filtering post-aggregate. The adoption step is on Cerebra, not fossic. Recommend making it a prerequisite for the Cerebra relay pass.

- **`stream_exists()` API stability risk (Cerebra D.8)** — Cerebra's `FossicStore.read_events()` calls `stream_exists()` before `ReadQuery`. `stream_exists()` is not stable-API-flagged in fossic's current roadmap; no deprecation notices would precede a breaking change. If a future fossic refactor renames or removes it, Cerebra's read path breaks silently. The call site is a single location in `FossicStore.read_events()`. Tracking note: on each fossic version bump, check the changelog for `stream_exists()` changes. No action now; flag for relay agent design pass when fossic-py version is pinned for Cerebra's relay.

- **Bo accessing fossic via "cerebra infrastructure" — position from Cerebra** — Cerebra's reconciliation explicitly disagrees with this framing if it means "Cerebra is the platform aggregator." Their position: Bo calls daemon endpoints for cognitive-cycle queries specifically; the hub is the right aggregation point for cross-project answers; Cerebra feeds the hub via relay stream but does not aggregate cross-project state. This aligns with the fossil substrate design. See ai-stack section below for the full picture.

### LumaWeave (§2.2 + lumaweave reconciliation)

- **Project-local store path** — confirmed. LumaWeave writes to `<project_root>/.lumaweave/fossic.db`. The shared store migration is their primary blocker for all Track B work. From fossic's side, this migration requires nothing new — it's a config path change in their Tauri backend. Their reconciliation confirms: "one-line path change" once Lattica confirms the shared store path is stable.

- **Branches for layout experiments** — LumaWeave's reconciliation confirms they want branches for layout experiments from day one of the relay. They explicitly want to relay branch-scoped events correctly. I noted in my initial draft that `branch` was missing from my relay pseudocode — this is confirmed as a real gap to fix (see Item 3 below).

- **Settings hub-observability** — LumaWeave's reconciliation adds precision to the partition:
  - *Hub-observable*: `settings.sources.active` (which adapter is loaded) and `settings.physics.activeDialect` (which gwells dialect is running)
  - *Strictly local*: `helixTwist` (rendering parameter), pin state (per-session interaction), UI layout prefs (panel widths)
  This is a clean partition. No fossic change needed; it informs what event types LumaWeave would add to `lumaweave/settings` stream if they go that route.

- **CerebraReadAdapter conflict resolved** — LumaWeave's reconciliation is unequivocal: "does not exist in any form (not stale, not in a subdirectory, not behind a feature flag). It is simply unbuilt." The compile's three interpretations (a/b/c) are all wrong — the adapter was never built and was never in progress. Cerebra's reconciliation confirms the same from their side: it was a projection of intended state, not observed current state. The conflict is resolved: **drop the file-polling model from federation design entirely**. The agreed path is event-based (Cerebra emits `GraphSnapshotAvailable` to hub; LumaWeave receives it and loads the graph). File artifact becomes implementation detail.

- **`GraphSnapshotAvailable` as federation design thread** — both LumaWeave and Cerebra independently converge on this. LumaWeave's reconciliation calls it one of the two design threads they most want to address in the federation interview. Fossic has no API gap here — the event type is a design decision for those two projects. Noting it because it shapes what Cerebra's relay filter list should include when they relay to hub. LumaWeave's stated consumer requirements for the event: a snapshot reference (file path or content hash), a `lineage_id` or equivalent graph identity field, and enough context to determine whether to trigger a load. Neither the event schema nor the stream location is settled; both are flagged for the federation interview.

- **`causation_id=None` is correct for all current LumaWeave event types** — LumaWeave's reconciliation (C.5) makes this explicit: all five types (`SourceLoaded`, `SourceLoadFailed`, `SourceSwitched`, `ThemeChanged`, `GraphLayoutSettled`) are triggered by Tauri frontend actions, not by incoming fossic events. No upstream fossic `event_id` exists to link them to. The relay agent should pass `causation_id: None` for all current LumaWeave events. This changes in the future: when `GraphSnapshotAvailable` integration lands and a LumaWeave `SourceLoaded` is directly caused by a Cerebra hub event, that hub event's ID becomes the correct `causation_id` to carry forward. This is the first concrete cross-project causal chain in the LumaWeave event surface.

- **Relay agent `causation_id` upgrade obligation (LumaWeave C.9)** — LumaWeave formalizes this as a planned relay agent design requirement, not just a forward-looking note. When `GraphSnapshotAvailable` receive is wired into LumaWeave, the relay agent must add a conditional branch: if a `SourceLoaded` was triggered by a hub event (i.e., LumaWeave received a `GraphSnapshotAvailable` and responded by loading a graph), carry `causation_id = <hub_event_id>`; otherwise pass `None`. This is the first relay agent logic that is NOT a simple pass-through — all other relay agent fields are applied uniformly to every event. The upgrade makes the Cerebra→LumaWeave causal chain (`GraphSnapshotAvailable` → `SourceLoaded`) hub-traversable under case 2 (both events relayed; no back-reference needed). Design obligation for the relay agent pass; not a current action item.

### ai-stack / Bo (§2.4 + ai-stack-bo reconciliation)

- **Cerebra health check as second silent VRAM consumer (net-new from ai-stack reconciliation)** — the ai-stack reconciliation flags that Cerebra's granite-4.1-3b health check (from E2E integration tests) silently loads a model and consumes VRAM, in addition to LiteLLM's qwen3.5:latest health probe. My baseline attributed the 11305 MB / 12282 MB VRAM reading only to LiteLLM. Both are silent consumers. Any federation design that surfaces VRAM headroom calculations needs to account for both. This is an observability gap in the current `VramBudgetChanged` event — the payload shows total VRAM used but does not identify *why* (user-initiated load vs health-probe side effect vs Cerebra health check).

- **Bo and ai-stack are distinct repositories (correction from ai-stack reconciliation)** — the compile's single-row maturity table conflates two separate codebases: ai-stack sidecar at `/home/boop/Projects/ai-stack/fossic_sidecar.py` and Bo at `/home/boop/Projects/discord-bot/bot.py`. They share a fossic store today but they have different event vocabularies, different codebases, and distinct relay filter logic. Under federation the ai-stack reconciliation recommends one shared local store (co-resident, tightly coupled at the service level) with a single relay agent carrying two filter rules — one per stream prefix. Fossic's substrate supports this without any changes.

- **Bo is currently net-writer only in fossic** — Bo writes to `bot/lifecycle` and `bot/conversation/<channel_id>` but does not subscribe to or read from any fossic stream. It's write-only in its current implementation. This is expected given current state but worth naming precisely: "Bo and ai-stack are already on the shared store" does not mean Bo is leveraging fossic for reads.

- **Bo's read path under federation (corrected from both Cerebra Item 3 and ai-stack revised Item 2)** — Bo's reads split across two endpoints, not one aggregator:
  - *Cognitive cycle state* ("is a cycle running? what was the last outcome?") → **Cerebra daemon HTTP `GET /status`** — a bounded, stable contract; no store access required
  - *Platform-wide state* ("what is the GPU doing? what is the policy posture?") → **Hub fossic store** — once relay is live, Bo reads the hub directly for cross-project questions
  The witness model is a **Cerebra-internal** mechanism for augmenting Cerebra's own cognitive processing (Phase 15+). It is not Bo's query interface. When Bo calls the Cerebra daemon in the future, the daemon's answers may be enriched by the witness model internally — but Bo never calls the witness model directly. This matters for fossic: Bo WILL need hub fossic read access under federation for platform-wide state queries, not only the cerebra daemon. The hub is both Bo's write destination (via relay) and its read source for platform state.

- **Phase 2 tile wiring targets hub streams, not local store** — the ai-stack reconciliation is explicit: the tile should subscribe to hub-namespaced streams (`ai-stack/ai-stack/gpu`, `ai-stack/ai-stack/models`), not the local store directly. The sidecar and tile have zero knowledge of each other — relay agent is the bridge. Fossic's subscription API supports this without changes.

- **Snapshot concrete use case confirmed** — cold-start problem: when AiStackTopologyTile switches from direct Ollama polling to hub subscription, there's up to a 10-second gap before the first `VramBudgetChanged` fires. A snapshot on `ai-stack/gpu` seeded at the last event gives the tile immediate initial state. This is the concrete case for fossic snapshots on ai-stack streams. The snapshot API is available now; adoption is on ai-stack's side.

### Policy Scout (§2.3 + policy-scout reconciliation)

- **fossic emit staged, not committed** — policy-scout's reconciliation confirms nothing architectural is blocking the commit. The fossic emit code in `sqlite_store.py` is complete and functional. The store path is intentionally local (same pattern as Cerebra). Commit is deferred to their next pass.

- **`append_if` for lockdown posture** — confirmed independently in their reconciliation. The dual-terminal race scenario they described is the exact use case the primitive was designed for.

- **`ApprovalExpired` resolution (net-new from policy-scout reconciliation)** — the vocabulary-ghost is now resolved: the watch daemon (long-running, already manages posture state) should own the expiry scheduler loop (every ~60s, scan SQLite for pending approvals where `expires_at <= now()`, emit `ApprovalExpired`). Display-time derivation is necessary but not authoritative — the tile must still derive expiry from the ISO 8601 timestamp as a UX fallback. Relay agent detection is explicitly the wrong home (relay agents relay, they don't synthesize). Cost: S-M. Currently unscheduled. This is a policy-scout item; no fossic changes needed.

- **`POLICY_SCOUT_EVENT_VOCABULARY.md` scope** — if this doc lives in fossic's tree (alongside `AGENT_TRACE_VOCABULARY.md`), the `expires_at` description update (from "24h from creation" → "configurable via `approvals set-timeout`, default 24h") is an outbound for fossic to apply. I should verify the doc location and update it. If it's in policy-scout's tree, they own it.

---

## General Question C — Cross-baseline observations accuracy

### Four convergent themes (Section 4)

All four themes are accurate. Updates from peer reconciliations:

**Theme 1: Shared fossic store path as primary integration blocker**
Accurate. LumaWeave's reconciliation adds precision: their migration is literally one line once Lattica confirms the shared store path. Cerebra's reconciliation adds the critical detail: Lattica's CerebraSignalTile fossic subscription is currently dark (shared store, but Cerebra writes to local store). The blocker is real and specific.

**Theme 2: `append_if` interest is widespread and independent**
Accurate. All four interested projects (Cerebra, Policy Scout, LumaWeave, ai-stack) confirm their independent use case descriptions. Policy Scout's reconciliation reconfirms the dual-terminal race design.

**Theme 3: Relay filter "transitions not measurements"**
Accurate. All three reconciliations confirm this principle. ai-stack adds a useful precision: their filter has two layers (≥10 MB delta before local emit, then relay filter for hub), not just one. The principle is the same but the implementation is cascade-filtered.

**Theme 4: Daemon/sidecar health monitoring gaps**
Accurate with a correction from ai-stack: their three gaps are not equivalent:
- Bo-unknown: Phase 2 wiring problem (solvable via `bot/lifecycle` subscription)
- TTS-unknown: configuration problem (host port in docker-compose.yml, outside ai-stack's scope)
- LiteLLM health-probe VRAM: observability quality problem (not a health monitoring gap per se)
These are three different problems grouped under the same symptom. The compile's theme captures the symptom; the reconciliation clarifies the root causes.

### CerebraReadAdapter conflict — resolved

The compile's §6.3 listed three possible interpretations. All are superseded. The reconciliations from both sides are unambiguous:
- LumaWeave: "does not exist in any form. It is simply unbuilt."
- Cerebra: "was an error. I was describing the intended consumption relationship, not confirmed current state."

**Resolved: the adapter was never built and was never in progress.** The file-polling model should not appear in any future federation design document as a live dependency or planned path. The agreed replacement: Cerebra emits a `GraphSnapshotAvailable` hub event; LumaWeave receives it and loads the graph. Both projects have independently converged on this design.

### Asymmetric maturity table — one correction

The compile's single-row "ai-stack sidecar + Bo" entry conflates two distinct repositories. The corrected table:

| Project | Current fossic position |
|---|---|
| ai-stack sidecar | **Most advanced**: writing to shared `~/.lattica/fossic/store.db` directly. No migration needed. |
| Bo (discord-bot) | **Most advanced (writer)**: writing to shared `~/.lattica/fossic/store.db` directly. Net-writer only; reads come from cerebra witness model, not fossic. |
| Lattica (Rust backend) | **Consumer only**: reads via fossic-tauri Tauri commands. No writes except canary ping. |
| Cerebra | **Local store, ready to migrate**: fossic-py integrated; compute_event_id available. Migration = path change + relay agent. CerebraSignalTile fossic subscription is currently dark (store path mismatch). |
| LumaWeave | **Local store, blocked on migration**: fossic-tauri integrated; R-LW-005 events live. Migration is a one-line path change once shared store path is confirmed. |
| Policy Scout | **Pre-fossic**: SQLite-authoritative; fossic emit staged but not committed. Fossic is a parallel write, not yet in the primary audit trail. |

### Independent flagging

**Schema migration risk at relay boundary** — now confirmed by both Cerebra and fossic independently, and LumaWeave adopted the protocol recommendation without further design work (per their reconciliation).

**`indexed_tags` adoption gap** — Cerebra's reconciliation confirms they need to adopt `indexed_tags` fields. The compile correctly attributed this gap. The prerequisite for Cerebra's relay pass: add `{session_id, cycle_id, signal_name}` to new event writes.

---

## Item 1 — Protocol decisions: schema migration at relay boundary + causation chain handling

### Schema migration at relay boundary

**Decision: relay agents MUST relay the decoded payload (post-upcast), not raw bytes.**

Both fossic and Cerebra flagged this independently, and both reconciliations confirm agreement. The mechanism:

```python
# In the relay loop
payload = event.deserialize_payload_json()   # triggers upcasters in local store
type_version = event.type_version            # post-upcast version
```

The hub store has no upcasters for project-specific event types. Relaying raw bytes permanently locks the hub consumer to the schema version at relay time. Relaying decoded payloads means upcasting happens at the local store boundary, and hub consumers always receive current canonical schema.

**LumaWeave note:** LumaWeave has no upcasters registered at this time. For their relay, `deserialize_payload_json()` returns the payload as-is. As they register upcasters in the future, the relay agent picks them up automatically — no relay agent change needed.

### Causation chains across store boundaries

**Decision: cross-store causal traversal requires explicit back-references; hub-only traversal is hub-scoped. Document as expected behavior, not a bug.**

Updated with new signal from Cerebra's reconciliation: Policy Scout's `CommandRequested.upstream_causation_id` carries Cerebra's `ActionProposed` event_id. If both Policy Scout and Cerebra relay to hub, and both relay using `causation_id = source_event.id`, then the hub eventually has both events. In this case `walk_causation` on the hub CAN traverse the cross-project chain — because the target event (Cerebra's `ActionProposed`) was itself relayed to hub with a known ID. This is the one case where cross-store traversal works on the hub without going back to the originating store.

This means the causation chain problem has two distinct cases:
1. **Hub event → local event that was NOT relayed**: `walk_causation` fails at `EventNotFound`. Requires going back to originating store.
2. **Hub event → local event that WAS relayed**: traversal works on the hub because the hub has the target event. This is the Policy Scout → Cerebra case if both relay.

The `source_store` indexed_tag recommendation still stands as a routing hint for case (1). For case (2), no action needed — it works.

---

## Item 2 — Net-writer/net-reader federation roles framing

The corrected picture after reading all reconciliations:

| Project | Write path | Read path | Notes |
|---|---|---|---|
| ai-stack sidecar | local store → (future) relay → hub | none (write-only) | direct hub write today; relay after federation |
| Bo | local store → (future) relay → hub | cerebra daemon (cognitive state) + hub (platform state) | writes go to hub via relay; reads split: cycle state → daemon, platform state → hub |
| Lattica hub | ingestion point for relayed events | Tauri commands for tiles | both ingestion point and reader; not "consumer only" in federation target state |
| Cerebra | local store → relay → hub | local read_events() | local-only for cognitive cycle; hub for platform-wide |
| LumaWeave | local store → relay → hub | none planned beyond tile | tiles subscribe to hub |
| Policy Scout | local store → relay → hub | none planned beyond tile | tiles subscribe to hub |

**Key clarification:** Lattica's hub store is NOT consumer-only in the federation target. It is both an ingestion point (relay agents append to it) and a read substrate (tiles subscribe from it). The "consumer only" label in the maturity table describes Lattica's *current* fossic usage, not the target architecture.

**Bo's read path is split, not aggregated through one layer:** Bo writes to the hub (via relay) and reads from two separate endpoints — Cerebra daemon for cognitive cycle state, hub fossic store for platform-wide state. This is NOT "cerebra as the all-seeing aggregator" and NOT "the witness model is Bo's query interface." Both Cerebra's reconciliation (Item 3) and ai-stack's revised Item 2 are explicit on this.

**Witness model feedback loop — Cerebra-internal, not Bo's query interface:** Bo's hub-relayed events (`BotStarted`, conversation events) are visible to the witness model's hub projection reducer once relay is live. Policy Scout's relayed events feed the same reducer. This closes a Cerebra-internal loop: hub events → witness model projects into Cerebra memory → Cerebra daemon's responses become more contextually informed. When Bo calls the Cerebra daemon in the future, it may receive richer answers as a result. But Bo never queries the witness model directly — the loop is inside Cerebra, not in Bo's call graph. The relay pass for ai-stack and policy-scout is therefore load-bearing for Cerebra's cognitive quality, and indirectly for Bo's responses via the daemon, but Bo's own read path still goes to the daemon and the hub — not through the witness model.

No new fossic API needed to support these roles. The asymmetry is at the application integration layer, not the substrate layer.

---

## Item 3 — Concrete relay agent interface spec

Updated from my initial draft based on peer reconciliation signals.

### Config shape (Python relay agent)

```python
@dataclass
class RelayConfig:
    local_store_path: str           # e.g., "~/.cerebra/store.db"
    hub_store_path: str             # e.g., "~/.lattica/fossic/store.db"
    source_prefix: str              # e.g., "cerebra" — prepended to stream_id on hub
    subscribe_pattern: str          # e.g., "cerebra/**"
    relay_filter: set[str]          # event_types to relay; empty = relay all
    batch_size: int = 50
    reconnect_delay_ms: int = 5000
```

### Core relay loop (Python) — corrected from initial draft

```python
def run_relay(config: RelayConfig) -> None:
    local_store = Store.open(config.local_store_path)
    hub_store = Store.open(config.hub_store_path)

    for event in local_store.subscribe(config.subscribe_pattern):
        # Filter: skip events not in the relay set
        if config.relay_filter and event.event_type not in config.relay_filter:
            continue

        # Idempotency: skip if already relayed
        if hub_store.read_by_external_id(event.id.hex()) is not None:
            continue

        # Upcast at local store boundary before relay
        payload = event.deserialize_payload_json()

        hub_store.append(Append(
            stream_id=f"{config.source_prefix}/{event.stream_id}",
            event_type=event.event_type,
            type_version=event.type_version,        # post-upcast version
            payload=payload,                        # post-upcast payload
            causation_id=event.id,                  # causal link back to source
            external_id=event.id.hex(),             # idempotency key
            branch=event.branch,                    # ADDED: relay branch (LumaWeave needs this)
            indexed_tags={
                **event.indexed_tags,               # pass through for hub aggregates
                "source_store": config.source_prefix,  # routing hint for cross-store traversal
            },
        ))
```

**Correction from initial draft:** `branch=event.branch` was missing. LumaWeave's reconciliation confirms they want branch-scoped events relayed correctly from day one. The `branch` field must be passed through.

### Stream naming on hub — open question narrowed

My initial draft flagged the double-prefix problem: `source_prefix="cerebra"` + `stream_id="cerebra/agent-trace/<session_id>"` → hub stream `"cerebra/cerebra/agent-trace/<session_id>"`. This is redundant.

**Correction from ai-stack Round 2:** An earlier reading of the ai-stack reconciliation inferred they may have been accepting the double-prefix because they referenced `"ai-stack/ai-stack/gpu"` without flagging it. Their Round 2 update is explicit: that was a misread. The double-prefix form appears in their file only to name the problem. It is NOT their accepted hub stream name. ai-stack explicitly endorses Cerebra's D.3 conditional rule as their preferred resolution — under which `"ai-stack/gpu"` and `"ai-stack/models"` already start with `"ai-stack/"` and pass through unchanged with no prefix added.

**My recommendation:** strip the leading project segment from the original stream_id to avoid the double-prefix:

```python
# Instead of: f"{config.source_prefix}/{event.stream_id}"
# Use:
stream_suffix = event.stream_id.lstrip(f"{config.source_prefix}/")
hub_stream_id = f"{config.source_prefix}/{stream_suffix}"
# Result: "cerebra/agent-trace/<session_id>" instead of "cerebra/cerebra/agent-trace/<session_id>"
```

However, this requires the relay agent to know the local store's stream naming convention. A cleaner approach: projects name their local streams WITHOUT a project prefix (e.g., `agent-trace/<session_id>` not `cerebra/agent-trace/<session_id>`), and the relay agent adds the prefix at relay time. This requires changing existing stream naming at the project level and is a breaking change for current implementations.

**For the federation interview round:** agree on a convention before the first relay agent ships. Options:
1. Accept double-prefix (`cerebra/cerebra/agent-trace/...`) — ugly but consistent
2. Strip leading segment at relay time — correct but fragile if stream names don't follow the convention
3. Require local streams to NOT include project prefix (new convention, breaking) — cleanest but requires Cerebra/ai-stack to rename existing streams
4. **Conditional rule (Cerebra's preference from their reconciliation D.3):** if `stream_id.startswith(f"{source_prefix}/")`, use `stream_id` as-is on the hub; otherwise prepend `f"{source_prefix}/"`. Projects that already namespace their streams (Cerebra, LumaWeave, Policy Scout) get clean hub names. Projects that don't would get the prefix added. This is the most pragmatic option given current stream naming without requiring breaking changes.

### Event flow

```
local store (e.g., Cerebra)
  → subscribe("cerebra/**")
    → for each event:
        1. filter: is event_type in relay_filter?
        2. idempotency: read_by_external_id(event.id) on hub → skip if found
        3. upcast: event.deserialize_payload_json() in local store
        4. hub_store.append(
               stream_id: namespaced,
               payload: decoded post-upcast,
               causation_id: event.id,
               external_id: event.id.hex(),
               branch: event.branch,             ← was missing in initial draft
               indexed_tags: {**original, source_store: ...}
           )

hub store (~/.lattica/fossic/store.db)
  → tiles subscribe to hub-namespaced streams
  → causation_id points to local store event (cross-store link)
  → external_id enables idempotency on relay restart
```

### Open questions for the federation interview round

1. **Stream naming convention** — double-prefix vs strip vs new local naming convention (see above)
2. **Where relay agent runs** — three options: (a) separate process (simplest), (b) in-process Tauri sidecar (Rust projects), (c) hub-side (Lattica subscribes to project stores directly). **Cerebra's stated preference (D.7 #2): option (a)** — a small standalone Python process (`cerebra-relay.py`) with `RelayConfig` pointing `.fossic/store.db` → `~/.lattica/fossic/store.db`. For LumaWeave and Policy Scout, option (a) is similarly the natural fit (Python environments already present). Needs ratification at the federation interview.
3. **Relay lag + batch idempotency** — `read_by_external_id` per event on hub is a single read per event on catchup; acceptable for first relay, needs batch variant for high-volume projects
4. **`GraphSnapshotAvailable` event shape** — Cerebra and LumaWeave have converged on this as the CerebraReadAdapter replacement; needs concrete payload design. Cerebra's reconciliation (D.4) proposes stream target: `cerebra/lattice/<lineage_id>` or a dedicated `cerebra/graph/<lineage_id>`. Stream choice and payload schema (full graph vs. file reference) are federation interview decisions.
5. **Bo's witness model access to hub events** — Cerebra's reconciliation (D.5) has answered this: the witness model will maintain a reducer that projects relevant hub events into Cerebra's own memory records (option a — in-memory, not direct hub query at runtime). This keeps the witness model's knowledge base inside Cerebra's memory system. Implication for fossic: no new API required. Cerebra must wire the hub store as a subscription or aggregate input to the reducer — the existing `aggregate` and subscription access to hub store streams is sufficient (Cerebra confirmed this in D.7 #5).

  **Witness model minimum projection scope (Cerebra D.5 update):** Cerebra's updated D.5 specifies the minimum hub event coverage the witness model needs to be useful during cognitive cycle execution: Policy Scout's governance transitions (`LockdownActivated`, `LockdownDeactivated`, `ApprovalRequested`) and ai-stack's infrastructure transitions (`VramBudgetChanged`, `ModelLoaded`, `ModelUnloaded`). Without these, the witness model cannot answer platform-state questions like "is the system in lockdown?" or "is VRAM headroom safe?" during a cycle. The relay passes for Policy Scout and ai-stack are therefore prerequisites for the witness model to have useful platform context — not because Bo's queries route through it, but because the cognitive cycle itself benefits from knowing current platform state.

---

## Item 4 — Convergence themes informing fossic roadmap

### Branches (LumaWeave + Cerebra)

LumaWeave's reconciliation confirms they want branches from day one of their relay. The relay agent spec now includes `branch=event.branch` to handle this. No additional fossic API work needed.

Cerebra's TD-006 (counterfactual cognition via branches) is still open. They haven't started using branches on their local store yet. The API is available.

### Snapshots (Cerebra using, LumaWeave + ai-stack interested)

ai-stack reconciliation adds a concrete use case with a specific trigger: the cold-start problem when AiStackTopologyTile switches from direct Ollama polling to hub subscriptions. Without a snapshot, the tile waits up to 10 seconds for the first `VramBudgetChanged`. A snapshot on `ai-stack/gpu` gives immediate initial state on subscribe.

This is the clearest, most actionable snapshot use case across all projects. The snapshot API is complete; adoption is on ai-stack's side for their Phase 2 wiring.

LumaWeave's reconciliation (C.7) names the same cold-start problem for the Lattica tile subscribing to `lumaweave/graph/events`: when the tile first subscribes, it sees zero events if LumaWeave is already in a loaded state and the user doesn't trigger a new source load. A snapshot seeded at the last `SourceLoaded` event gives the tile immediate initial state. Policy Scout flags an equivalent concern for the approval queue — a snapshot at `DecisionIssued` time would seed the tile's pending-approval list on first subscribe. All three cold-start cases are solvable with the existing snapshot API. Adoption is per-project, not a fossic roadmap item.

### TD-004: SimilaritySearchProvider ([redacted])

No update. Trigger condition unchanged: fires when [redacted] requests vector search. Until that request is made, no action.

### `indexed_tags_filter` adoption gap (Cerebra)

Cerebra's reconciliation confirms the gap and the path: add `indexed_tags` to new event writes (`{session_id, cycle_id, signal_name}` at minimum), historical migration pass for older events. Specific Cerebra sites: `FossicStore.emit_cycle_event()` and `FossicStore.emit_lattice_event()`. This should be a prerequisite for Cerebra's relay pass — otherwise Lattica's hub-side queries over Cerebra events can't use the SQL filter for events written before adoption.

LumaWeave's cross-project update (C.5) also identifies concrete `indexed_tags` fields for their R-LW-005 events: `{adapter_id, source_key}` on `SourceLoaded`/`SourceLoadFailed`/`SourceSwitched`, and `{dialect_id}` on `GraphLayoutSettled`. These should be added to the R-LW-005 emit calls before or during the LumaWeave relay pass.

Policy Scout's cross-project update identifies planned fields: `{request_id, risk_band, decision}` on `CommandRequested`/`DecisionIssued`, and `{request_id, approval_id}` on approval lifecycle events. These should be added to `sqlite_store.py` before the Pass E commit — small cost, and ensures hub-side SQL filtering is usable from the first relayed event.

ai-stack's reconciliation (Item 3, relay protocol section) identifies the same adoption gap for the sidecar: no `indexed_tags` are currently set on any `Append` call. Minimum fields before the relay pass: `{model_name: str}` on `ModelLoaded`/`ModelUnloaded` (enables hub consumers to SQL-filter by specific model without fold-time Python filtering), and `{warn: bool}` on `VramBudgetChanged` (whether `pct >= warn_threshold` at emit time — enables hub to filter for warn-state transitions without decoding every payload). Bo lifecycle events (`bot/lifecycle`) are simpler; exact `indexed_tags` fields are TBD when Bo's relay is designed. This is a sidecar-side change; fossic has no gap here.

### Policy Scout: `ApprovalExpired` scheduling

Policy Scout's reconciliation resolves this: watch daemon owns the scheduler (not relay agent, not tile). This is a policy-scout roadmap item (S-M cost, unscheduled). No fossic changes needed — the emit path already exists for other approval events.

Policy Scout's cross-project update adds one more detail: the expiry scheduler should use `append_if` as a duplicate-emission guard — the condition closure checks that no `ApprovalExpired` for this `approval_id` already exists in the stream before committing. This prevents double-emission if the 60s scheduler loop fires twice before a database update commits. `append_if` is already available in fossic-py; adoption is an implementation detail of the scheduler pass.

### `POLICY_SCOUT_EVENT_VOCABULARY.md` update — resolved, no fossic action

Policy Scout's reconciliation confirms: `POLICY_SCOUT_EVENT_VOCABULARY.md` lives in **policy-scout's tree**, not fossic's. Fossic has `AGENT_TRACE_VOCABULARY.md` for Cerebra event types; these are separate documents. The `expires_at` update ("24h from creation" → "configurable via `approvals set-timeout`, default 24h") is policy-scout's responsibility to apply to their own doc. No fossic outbound needed.

---

## Net-new signals not in my initial baseline or first reconciliation draft

Signals that emerged only after reading all peer reconciliations:

1. **CerebraSignalTile fossic subscription is currently dark** — Cerebra writes to local store; Lattica subscribes to shared store. The tile's fossic subscription sees nothing until migration or relay. Daemon HTTP polling works fine (different mechanism).

2. **Cerebra's health check is a second silent VRAM consumer** — in addition to LiteLLM's health probe. Any VRAM headroom analysis needs to account for both. Current `VramBudgetChanged` payload doesn't surface the cause.

3. **Bo's read path under federation is split across two endpoints** — cognitive cycle state → Cerebra daemon HTTP; platform-wide state → hub fossic store. The witness model is Cerebra-internal (Phase 15+), not Bo's query interface. Hub is both Bo's write destination (via relay) and its read source for platform state. Earlier drafts of this reconciliation incorrectly described Bo's read path as "the cerebra witness model" — this is corrected.

4. **Bo and ai-stack are distinct repositories** — single-row maturity table conflates them. Separate codebases, separate vocabularies, separate relay filter logic, but shared local store (co-resident, tightly coupled).

5. **`branch` was missing from relay pseudocode** — corrected in Item 3. LumaWeave needs branch-scoped relay from day one.

6. **CerebraReadAdapter conflict is fully resolved** — both sides confirm: never built, never in progress. File-polling model dropped. Event-based handoff (`GraphSnapshotAvailable`) is the agreed path.

7. **Policy Scout's `ApprovalExpired` is resolved** — watch daemon owns the scheduler. Policy-scout roadmap item (unscheduled). No fossic gap.

---

## Summary: protocol decisions ready for adoption

| Decision | Verdict | Adoption step |
|---|---|---|
| Relay decoded (post-upcast) payloads, not raw bytes | **Confirmed** (fossic + Cerebra independently, LumaWeave adopted) | Relay agents call `deserialize_payload_json()` before hub append; relay post-upcast `type_version` |
| `branch` field must be relayed | **Confirmed (was a gap in my initial draft)** | Add `branch=event.branch` to relay agent Append |
| Hub event `causation_id` → local store (case 1) or relayed hub event (case 2) | **Two distinct cases now documented** | Case 1: `source_store` indexed_tag for routing; Case 2: hub traversal works if both events were relayed |
| `source_store` as indexed_tag | **Recommended** | Add to relay agent; costs one tag per hub event |
| Stream naming convention (double-prefix problem) | **Open — needs federation interview ratification** | Cerebra proposes D.3 conditional rule; ai-stack (Round 2) explicitly endorses D.3; LumaWeave and Policy Scout both confirmed their streams pass through cleanly under D.3. Leading proposal has cross-project buy-in; needs platform-wide ratification. |
| LumaWeave first relay candidate | **Confirmed** | Unblocked after shared store path confirmed by Lattica |
| `indexed_tags` adoption as Cerebra relay prerequisite | **Recommended** | `{session_id, cycle_id, signal_name}` on new event writes before relay pass |
| CerebraReadAdapter: drop file-polling model | **Resolved** | Replace with `GraphSnapshotAvailable` hub event design |
| `ApprovalExpired` scheduling home | **Resolved** | Watch daemon owns the scheduler; no fossic change |
| Bo's read path under federation | **Corrected** — cognitive state → cerebra daemon; platform state → hub fossic store. Witness model is Cerebra-internal, not Bo's interface. | Bo WILL need hub fossic read access for platform-wide state queries; cerebra daemon for cognitive cycle state |
| Phase 2 tile targets hub streams | **Confirmed** | AiStackTopologyTile subscribes to hub-namespaced `ai-stack/*` streams, not local store |

---

---

## Settled Items Log — 2026-06-16

Items confirmed settled through three cross-read rounds. Do not require further reconciliation unless new evidence surfaces.

| Item | Status | Settled by |
|---|---|---|
| **A — Section 2.5 accuracy** | **SETTLED** | No peer disputes across three rounds |
| **B — CerebraSignalTile store path gap (tile dark until relay or migration)** | **SETTLED** | Cerebra Item 2 confirmed; documented as practical blocker for federation design |
| **B — Cerebra health check as second silent VRAM consumer** | **SETTLED** | ai-stack originated; Cerebra D.1 confirmed; all peers acknowledged |
| **B — Bo and ai-stack are distinct repositories** | **SETTLED** | ai-stack Item 1 confirmed; fossic maturity table corrected to two rows |
| **B — Bo is currently net-writer only in fossic** | **SETTLED** | ai-stack Item 2 confirmed across all rounds |
| **B — Bo read-path under federation: daemon (cognitive state) + hub (platform state)** | **SETTLED** | Cerebra Item 3 / D.5, ai-stack Item 2 revised + Round 3, LumaWeave C.6, Policy Scout B-update all confirm |
| **B — "Bo reads through witness model" framing retracted** | **SETTLED** | ai-stack Round 3 formal retraction; fossic Item 2 corrected |
| **B — Phase 2 tile targets hub streams, not local store** | **SETTLED** | ai-stack Item 3 confirmed; no peer disputes |
| **B — Snapshot cold-start (ai-stack: up to 10s gap; use snapshot API)** | **SETTLED** | ai-stack confirmed; fossic API complete; pattern extended to LumaWeave + Policy Scout |
| **B — LumaWeave migration is one-line path change (awaits shared store path confirmation)** | **SETTLED** | LumaWeave C.1 confirmed; no peer disputes |
| **B — LumaWeave `causation_id=None` correct for all five current event types** | **SETTLED** | LumaWeave C.5 confirmed; future change tracked separately (C.9 obligation) |
| **B — LumaWeave relay agent `causation_id` upgrade obligation (when `GraphSnapshotAvailable` lands)** | **NOTED (future)** | LumaWeave C.9 formalized; first non-pass-through relay agent logic; not a current action item |
| **B — `stream_exists()` API stability risk** | **NOTED (tracking)** | Cerebra D.8 surfaced; check changelog on each fossic version bump; call site is single location in `FossicStore.read_events()` |
| **B — `ApprovalExpired` detection lives in watch daemon (not relay agent, not tile)** | **SETTLED** | Policy Scout Item 3 confirmed; relay agent must NOT synthesize event types |
| **B — `POLICY_SCOUT_EVENT_VOCABULARY.md` lives in policy-scout's tree** | **SETTLED** | Policy Scout B-update confirmed; no fossic action needed |
| **B — Witness model is Cerebra-internal; relay passes are prerequisite for cognitive context** | **SETTLED** | Cerebra D.5, ai-stack Round 2/3, Policy Scout B-update all confirm |
| **B — Witness model minimum projection scope (PS governance + ai-stack infrastructure transitions)** | **SETTLED** | Cerebra D.5 update confirmed; `{LockdownActivated, LockdownDeactivated, ApprovalRequested}` and `{VramBudgetChanged, ModelLoaded, ModelUnloaded}` as minimum hub coverage |
| **C — Four convergent themes (§4) accurate** | **SETTLED** | All peers confirmed across rounds |
| **C — CerebraReadAdapter conflict** | **CLOSED** | Both Cerebra and LumaWeave: never built, never in progress; file-polling model dropped |
| **C — Asymmetric maturity table: two rows for ai-stack + Bo** | **SETTLED** | ai-stack Item 1 confirmed; corrected in fossic reconciliation |
| **C — ai-stack misread of double-prefix ("accepted pattern") retracted** | **SETTLED** | ai-stack Round 2 explicit correction; fossic Item 3 corrected |
| **C — `GraphSnapshotAvailable` as agreed Cerebra→LumaWeave federation path** | **SETTLED (as direction)** | Both Cerebra D.4 and LumaWeave B.1 converged; stream target + schema pending federation interview |
| **C — LumaWeave consumer requirements for `GraphSnapshotAvailable`** | **SETTLED (as spec input)** | LumaWeave B.1: snapshot reference, `lineage_id`, trigger-load context; Cerebra D.4 confirmed |
| **C — `GraphSnapshotAvailable → SourceLoaded` is case 2 causation (hub-traversable, no back-reference)** | **SETTLED** | Cerebra D.4 Round 2; LumaWeave C.9; `source_store` tag not needed for case 2 traversal |
| **Item 1 — Relay decoded (post-upcast) payloads, not raw bytes** | **SETTLED** | Cerebra D.2, LumaWeave C.5, Policy Scout Item 2-update, ai-stack Item 3 all adopted |
| **Item 1 — Two-case causation model** | **SETTLED** | All peers adopted; Cerebra D.2 formally confirmed; PS→Cerebra chain is case 2 |
| **Item 2 — Net-writer/net-reader roles table (with corrected Bo row)** | **SETTLED** | No disputes; Bo read-path correction absorbed in all peer files |
| **Item 3 — Relay agent core spec (pseudocode, `branch` field, `source_store` tag, `external_id`, post-upcast payload)** | **SETTLED (as spec)** | All peers adopted relay protocol decisions; no open disputes on the spec itself |
| **Item 3 — Stream naming D.3 conditional rule: endorsed by Cerebra + ai-stack + LumaWeave (3 of 5)** | **ENDORSED, PENDING RATIFICATION** | Three projects explicitly back D.3; PS and fossic streams also compatible under the rule; federation interview ratification required before relay agents ship |
| **Item 3 — Relay agent process location: Cerebra prefers option (a) separate Python process** | **NOTED (preference)** | Cerebra D.7 #2; natural fit for Python projects; not yet decided platform-wide |
| **Item 4 — `indexed_tags` adoption is a relay prerequisite for all projects** | **SETTLED (as prerequisite spec)** | Cerebra D.6, ai-stack Item 3, Policy Scout C-update, LumaWeave C.5 all confirmed the gap and the plan |
| **Item 4 — Per-project minimum `indexed_tags` fields** | **SETTLED (as prerequisite spec)** | Cerebra: `{session_id, cycle_id, signal_name}`; LumaWeave: `{adapter_id, source_key}` + `{dialect_id}`; Policy Scout: `{request_id, risk_band, decision}` + `{request_id, approval_id}` + `{reason}`; ai-stack: `{model_name}` + `{warn}` |
| **Item 4 — Snapshot cold-start: three canonical cases all solvable with existing API** | **SETTLED** | ai-stack, LumaWeave (C.7), and Policy Scout all confirmed; fossic snapshot API complete; adoption is per-project |
| **Item 4 — `ApprovalExpired` + `append_if` as duplicate-emission guard** | **SETTLED** | Policy Scout Item 3 update confirmed; fossic primitive available; adoption in scheduler pass |

**Still open (pending federation interview round):**

| Open item | Blocked on |
|---|---|
| Stream naming convention final ratification | Federation interview — D.3 is leading proposal with 3 of 5 explicit endorsements |
| Relay agent process location (platform-wide decision) | Federation interview |
| `GraphSnapshotAvailable` event design: stream target + payload schema | Federation interview — LumaWeave requirements filed as formal input |
| Witness model hub projection implementation | Phase 15+ Cerebra roadmap item; relay layer must accommodate |
| LumaWeave shared store path confirmation | Lattica confirming `~/.lattica/fossic/store.db` is stable + Tauri-accessible |
| Phase 2 tile wiring (ai-stack + LumaWeave + Policy Scout) | Lattica-side; relay agents must exist first |
| Per-project `indexed_tags` implementation | Each project's own pre-relay pass |
| Bo relay filter spec for `bot/*` streams | ai-stack relay agent design pass |
| LumaWeave relay agent `causation_id` conditional branch | When `GraphSnapshotAvailable` receive path is wired in LumaWeave |

**Steady state confirmed — 2026-06-16:** All four peer reconciliation files (Cerebra, LumaWeave, Policy Scout, ai-stack/Bo) have reached steady state. No new content surfaced in Round 3 read-only pass. Fossic's reconciliation is complete pending the federation interview round.

---

*End of fossic reconciliation — 2026-06-16 (three cross-read rounds; settled log added Round 3)*

---

## needs-wiring

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

---

## current_state

# Fossic — Current State Baseline

**Date:** 2026-06-16
**Filed by:** fossic-claude

---

## Section 1 — Current version + identity

**Current version:** v1.0.0aa

**Identity:** Fossic is a local-first, append-only, content-addressed event store — a substrate that application projects embed to get durable, causally-linked event histories with concurrent read performance, optimistic write guarding, and a subscription model that scales to glob patterns.

---

## Section 2 — What just shipped since last baseline

Chronological order from approximately WEB_CLAUDE_BRIEF_ITER5.md forward:

**Phase 1 — Upcaster consistency + transform `**` glob fix**
Upcasters now fire on all read paths that were missing them (`aggregate`, `walk_causation`, `read_by_correlation`). The `**` transform pattern was fixed to match all streams correctly. Previously, some read paths returned un-upcasted events silently.

**Phase 2 — Tauri observability: `fossic_list_subscribers`, `fossic_subscription_status`**
Two new Tauri commands expose the live subscription registry to LumaWeave's frontend: list all active subscribers with their stream patterns, modes, and cursor positions; query a single subscriber's degraded status. Required for LumaWeave's graph tile to show what's being watched.

**Phase 3 — PD-007: `compute_event_id` via PyO3 (commit d6d4a06)**
`compute_event_id(event_type, payload, type_version, causation_id)` exposed from fossic-py. Routes through fossic's own blake3 path — no Python-side blake3 dependency. 8 tests in `test_event_id.py` confirm byte identity between pre-computed IDs and what `Store.append()` assigns. Closes the Python-level CCE verification gap. Required for Cerebra's relay agent to verify hub event IDs.

**Phase 4A — `indexed_tags` SQL filter + glob semantic fix in `aggregate`**
`AggregateQuery.indexed_tags_filter` now pushes a flat AND exact-match filter into SQL rather than post-filtering in fold. Glob patterns in `aggregate` stream matching fixed. `_fossic/*` streams excluded from glob aggregates unless `include_system = true`.

**Phase 4B — `read_batch`: fetch multiple events by CCE ID in one query**
`Store::read_batch(ids: &[EventId])` returns a `Vec<StoredEvent>` for a batch of event IDs in a single SQL `IN (...)` query. Available via `fossic_read_batch` Tauri command. Enables efficient causal-graph traversal without N round-trips.

**Phase 5 — Glob subscription cursor seeding (v1.0.0u)**
Glob subscriptions previously initialized cursors to -1, causing full history replay on every new subscriber. Fixed: at subscribe time, `MAX(version)` per matching stream is snapshot into `stream_cursors`, so only future events are delivered. New streams created after subscription still receive their first event correctly via `unwrap_or(&-1)`. 2 new integration tests confirm no replay and correct new-stream delivery.

**Phase 6a — `append_if`: optimistic-concurrency append (v1.0.0v)**
`Store::append_if(a: Append, condition: FnOnce(&Connection) -> Result<bool, Error>)` — condition closure runs inside an `IMMEDIATE` transaction. Returns `Ok(None)` without committing if condition returns false. Enables version-guard patterns, idempotency checks, and state-machine transitions without external locking. 7 integration tests.

**Phase 6b — Read connection pool (v1.0.0w)**
`StoreInner` now holds a crossbeam-channel bounded pool of N read connections (default `read_pool_size: 4`). All pure-read methods (`read_range`, `aggregate`, `walk_causation`, `read_batch`, `snapshot_info`, etc. — 16 methods) draw from the pool rather than the write mutex. Pool connections are opened with `PRAGMA query_only = ON` as write-accident guard. `ReadGuard` RAII struct returns connection on drop. `Error::PoolExhausted` returned after configurable timeout (`read_pool_timeout_ms`, default 30s). Zero new dependencies — crossbeam-channel was already in the workspace.

**v1.0.0x — Registry reconciliation**
TD-007/TD-008/PD-009 added to canonical registries; PD-005 marked resolved. Blast-radius ID collision from pass-1.0.0w corrected.

**v1.0.0y — TD-008 resolved: subscribe seed queries moved to read pool**
Both seed queries in `Store::subscribe` (glob `MAX(version) GROUP BY stream_id` and exact-stream `MAX(version)`) moved from write connection to `read_conn()`. Subscribe setup no longer contends with concurrent appends.

**v1.0.0z — PD-009 resolved: `PoolExhausted` integration test + configurable timeout**
`OpenOptions::read_pool_timeout_ms` added. `test-helpers` feature exposes `Store::_test_hold_read_conn` for integration tests. `pool_exhausted_returns_error` test verifies the error variant fires correctly.

**v1.0.0aa — PD-007 registry close**
POLISH_DEBT.md updated to reflect PD-007 resolved (implementation was already in d6d4a06, registry entry was stale).

---

## Section 3 — Visual elements / capabilities available for Lattica

### Tauri commands (new since last baseline)

| Command | What it does |
|---|---|
| `fossic_list_subscribers` | Returns all live PostCommit subscribers: ID, stream pattern, branch, cursor position, degraded flag. Lattica's tile system can surface this as a "what is being watched" inspector. |
| `fossic_subscription_status` | Returns degraded status + cursor for a single subscriber ID. Useful for health checks. |
| `fossic_read_batch` | Fetches multiple events by CCE ID in one SQL query. Enables causal graph traversal tiles — given a root event, walk causation_id chains in batches rather than N sequential reads. |

### Query capabilities

**`indexed_tags_filter` on `AggregateQuery`** — flat AND exact-match, SQL-pushed. Lattica can aggregate across streams (e.g., all `cerebra/*`) and filter by `{session_id: "abc"}` or `{cycle_id: "xyz"}` without loading every event into fold. Useful for cross-project rollup tiles once hub streams are populated.

**`read_batch`** — multi-event fetch by CCE ID. Pairs with causation_id traversal for reconstructing event lineage in a single render cycle.

**Glob subscriptions without history replay** — Lattica can subscribe to `cerebra/**` on the hub store without replaying all historical Cerebra events. Only new events land after subscription.

### Write capabilities

**`append_if`** — optimistic-concurrency append available to all embedding projects. Enables version guards, idempotency checks, and state-machine transitions. The condition closure sees the live database state inside the transaction.

### Observability — `_fossic/system` stream

The `_fossic/system` stream currently emits one event type:

- **`SubscriptionDegraded`** — fired when a subscriber's handler returns an error and the subscription is marked degraded. Payload includes `subscription_id` and error context. Lattica can subscribe to `_fossic/system` (requires `include_system: true` on the `SubscribeQuery`) to monitor store health and surface degraded subscriptions in a tile.

Note: `_fossic/system` is excluded from glob matches and aggregate queries unless `include_system` is explicitly set. This prevents system noise from leaking into application-level event streams.

### Read performance

The read connection pool means concurrent read operations (multiple tile queries firing simultaneously) no longer queue behind each other or behind the write path. At `read_pool_size: 4` (default), four concurrent reads can run in parallel. LumaWeave's dashboard rendering benefits immediately without any API changes.

---

## Section 4 — Open items / known follow-ups

### Open Tech Debt (all externally triggered)

| ID | Severity | Trigger |
|---|---|---|
| TD-001 | MEDIUM | Python DynReducer bridge cost (~47μs/event over PyO3). Trigger: Cerebra witness layer + measurable user-facing latency. Mitigation: aggressive snapshot cadence (every 10 events). |
| TD-003 | LOW | `time = "=0.3.37"` exact pin in fossic-tauri. Trigger: Tauri bumps cookie version. |
| TD-004 | MEDIUM | `SimilaritySearchProvider` trait stub absent from code (feature flag is a placeholder). Trigger: [redacted] requests vector search. |
| TD-007 | LOW | `take_snapshot` dual-acquisition TOCTOU (read conn released before write conn acquired). Snapshots are idempotent so not a data-loss risk. Trigger: snapshot staleness observed under high concurrent write load. |

### Open Polish Debt

None. All PD items resolved.

### Not-yet-built federation items

From the feasibility analysis:

- **`relay_append` convenience helper** — a method that accepts a source `EventId` and sets both `external_id` and `causation_id` correctly for relay. Not built; the protocol works with raw `Append` fields today.
- **In-process relay subscription** — a `subscribe_to_store(remote: &Store, pattern: &str)` primitive that eliminates a separate relay process when both stores are in the same runtime. Not built; relay agents are out-of-process today.

---

## Section 5 — Cross-project signal

**Read concurrency is now non-blocking.** The pool (Phase 6b) means all projects embedding fossic get concurrent read performance without API changes. Multiple tile queries, subscription dispatches, and aggregate computations run in parallel. Previously they queued behind the write mutex.

**`append_if` unlocks state-machine patterns.** Projects that need to guard appends on current state (version checks, duplicate detection, condition-gated transitions) now have a clean primitive. The condition sees the live transaction — no external locking needed.

**`indexed_tags_filter` is SQL-pushed.** Projects using `aggregate` or planning hub-level cross-stream queries should prefer `indexed_tags` for filterable fields. The filter is now a `WHERE json_extract(...)` clause, not a fold-time filter. For high-cardinality streams (thousands of events), this is a significant throughput difference.

**Glob subscriptions no longer replay history.** Any project that creates glob subscriptions (e.g., Cerebra subscribing to `lattice_nodes/**`) gets correct from-now semantics automatically. No code changes needed; it's in the subscription setup path.

**`compute_event_id` is available in Python.** Cerebra's relay agent can pre-compute the hub-store event_id from (event_type, payload, causation_id) before appending to the hub. This enables round-trip verification: append to hub, read back, confirm event_id matches the pre-computed value.

---

## Section 6 — Pre-federation exploratory thoughts

### The relay agent interface — current best draft

The relay protocol is simple because fossic already has the primitives:

```
subscribe(local_store, "project/**", branch="main")
  → on each event:
      if hub_store.read_by_external_id(event.id.to_hex()) is Some:
          continue  # already relayed, idempotent
      hub_store.append(Append {
          stream_id: format!("project/{}", event.stream_id),  # namespaced
          event_type: event.event_type,
          payload: event.payload,
          causation_id: Some(event.id),     # preserves causal chain
          external_id: Some(event.id.to_hex()),  # idempotency key
          indexed_tags: event.indexed_tags,  # pass through for hub aggregates
          ..Default::default()
      })
```

Key properties:
- **Idempotent**: `external_id` check prevents double-relay on restart
- **Causal**: `causation_id = source_event.id` so hub events trace back to source
- **Filtered**: relay agent decides which event types cross the boundary (not all events should relay — only hub-relevant ones)
- **Namespaced**: `stream_id` is prefixed with the project name on the hub

The `relay_append` helper would encapsulate the `external_id` + `causation_id` pattern. Worth building before the second relay agent (after the first one proves the protocol), not before the first.

### Per-project local store shapes — do they hold up?

The shapes from the feasibility analysis hold. Minor refinements:

**Cerebra** — high snapshot cadence (every 10 events) is correct given TD-001. The relay filter list should be explicit: only `SessionOpened`, `MemoryWriteFromCycle`, `ClutchDecisionMade`, `CycleCompleted` relay to hub. All internal step-level events stay local. This keeps the hub clean.

**[redacted]** — still the most straightforward. Rust-native, no bridge overhead, fast `read_state` for bandit arm selection. Small pool size (2) is appropriate since reads are fast. Relay: `strategy_selected` events only.

**[redacted]** — one addition: `indexed_tags` should carry `{idea_id, query_id, session_id}` on every event. The hub's `indexed_tags_filter` then makes [redacted] queries filterable from Lattica without round-trips into [redacted]'s local store.

**LumaWeave** — still the most interesting use of `branch`. Layout experiments (`layouts/experiment-*`) should live on a non-main branch; only promoted layouts relay to hub as `main` events. `append_if` is useful here: "append this node mutation only if the node still exists" is a natural state-machine guard for the graph.

### Recommended order of project migrations

1. **LumaWeave first** — it's already on fossic-tauri (already embedded). The relay is just adding a second store handle (the Lattica hub) and filtering which events forward. No new embedding work. Benefit: Lattica immediately gets an architectural event stream to visualize.

2. **Cerebra second** — fossic-py is already integrated. `compute_event_id` is live. The relay agent is a Python script (~100 lines). Benefit: hub gets the richest event stream; cross-project causal chains become real.

3. **[redacted] third** — simpler event shape, faster to wire. Rust-native, straightforward relay.

4. **[redacted] last** — depends on TD-004 (SimilaritySearchProvider) for its most interesting local capabilities. Can embed fossic now, but the full local store shape isn't final until vector search is unblocked.

### Risks other projects may not see

**Schema migration across store boundaries.** When Cerebra upcasts an event (say, `MemoryWriteFromCycle` v1 → v2), the hub store holds the original v1 bytes (relayed before the upcast existed). The hub has no upcaster for Cerebra's event types — it doesn't know about them. This means: hub consumers of Cerebra events must tolerate schema evolution independently, OR the relay agent must relay the already-upcasted payload. Recommendation: relay agents should relay `stored_event.deserialize_payload_json()` (the decoded payload, which triggers upcasters at read time in the local store) rather than the raw `stored_event.payload` bytes. This pushes upcasting to the local store boundary before relay.

**Snapshot coordination is per-store.** Snapshots on the local store don't transfer to the hub. If Lattica wants to aggregate Cerebra state via the hub, it has to replay all relayed Cerebra events from the beginning — no snapshot seeding from the local store is possible. For Cerebra's lattice nodes (which can have thousands of events), this matters. Mitigation: Lattica should maintain its own reducer+snapshot for hub-visible event types, or limit hub-side aggregation to summary events rather than full state reconstruction.

**Causation chains span stores.** A hub event's `causation_id` points to an event in the local store, not in the hub store. `read_one(causation_id)` on the hub will return `EventNotFound`. This is expected but consumers need to know: causal traversal across the hub/local boundary requires going back to the originating store. `walk_causation` on the hub only walks hub-internal chains.

**Event ordering across projects is wall-clock only.** The hub has no global logical clock. Events from Cerebra and [redacted] are ordered by `timestamp_us` (wall clock at relay time), which may not reflect actual causation order if the relay agents have different latencies. If strict ordering matters for a cross-project workflow, the relay agent should set `causation_id` explicitly to the hub event that triggered it (not just the local source event).

**`read_pool_timeout_ms` should be tuned per project.** The default 30s is conservative. Projects with tight latency requirements (LumaWeave UI rendering, [redacted] bandit selection) should set a shorter timeout with a fast fallback rather than waiting 30s for pool exhaustion.

### The `relay_append` helper — before or after first relay?

**After** the first relay. The raw protocol (`external_id` + `causation_id` + namespaced `stream_id`) is simple enough to wire by hand for the first relay agent. Building `relay_append` before the first relay means designing an abstraction without concrete usage to validate it. Let LumaWeave's relay agent prove the protocol, then extract `relay_append` as a convenience helper when writing the second one (Cerebra). That's when the pattern duplication becomes obvious.

---

---

## federation_design_addendum_causation_id

# Fossic Federation Design — Addendum: causation_id Correction

**Filed by:** fossic-claude
**Date:** 2026-06-16
**Amends:** `fossic/federation_design.md` Section B.1
**Trigger:** LumaWeave surfaced a genuine inconsistency in S-031; analysis confirmed it implicates S-030 and the B.1 relay_event() spec as well.

---

## What is being corrected

In `federation_design.md` B.1, `RelayAgent.relay_event()` contains:

```python
causation_id=event.id,          # S-030: local source event ID for case-2 chains
```

This line is wrong. `event.id` is the local event's own ID. When the relay writes the hub event with `causation_id = local_event.id`, `walk_causation` on the hub follows `causation_id` by matching hub events' primary IDs. The local event's ID is never a hub primary ID — the hub assigns its own content-addressed IDs. The causation link is a dangling reference regardless of relay coverage. S-030's "case-2" framing does not produce hub-traversable chains under this implementation.

`external_id = event.id.hex()` already records "which local event am I a relay copy of." `causation_id` should carry application-semantic cause, not re-express provenance that `external_id` already holds.

---

## Correct implementation

Replace `relay_event()` in B.1 with the following (diff shown, then full corrected method):

**Change 1 — add `_translate_causation_id` helper to `RelayAgent`:**

```python
def _translate_causation_id(self, local_causation_id) -> Optional[EventId]:
    """Translate a local causation ID to its hub equivalent where possible.

    Three cases:
      - None              → None (root event; no cause)
      - local event ID    → hub_event.id via read_by_external_id (same-project chain)
      - hub event ID      → pass through (cross-store trigger already a hub ID)

    If read_by_external_id returns None, the cause is either a hub ID (cross-store
    trigger, e.g. hub_GSA_id stored by LumaWeave when reacting to GraphSnapshotAvailable)
    or a local-only event that was never relayed. Both fall back to passing through the
    ID as-is. In the local-only case, walk_causation will fail on the hub — which is
    correct case-1 behaviour; the consumer uses source_store to route back to the
    originating store.
    """
    if local_causation_id is None:
        return None
    hub_cause = self.hub_store.read_by_external_id(local_causation_id.hex())
    if hub_cause is not None:
        return hub_cause.id          # local ID → hub ID
    return local_causation_id        # already a hub ID, or local-only (case-1 fallback)
```

**Change 2 — update the `hub_store.append()` call inside `relay_event()`:**

```python
# Before (wrong):
causation_id=event.id,

# After (correct):
causation_id=self._translate_causation_id(event.causation_id),
```

**Full corrected `relay_event()`:**

```python
def relay_event(self, event: StoredEvent) -> bool:
    if not self._should_relay(event):
        return False

    external_id = event.id.hex()
    if self.hub_store.read_by_external_id(external_id) is not None:
        return False

    hub_stream_id = self._hub_stream_id(event.stream_id)
    payload = event.deserialize_payload_json()

    self.hub_store.append(Append(
        stream_id=hub_stream_id,
        event_type=event.event_type,
        type_version=event.type_version,
        payload=payload,
        causation_id=self._translate_causation_id(event.causation_id),  # corrected
        external_id=external_id,
        branch=event.branch,
        indexed_tags={
            **event.indexed_tags,
            "source_store": self.config.source_prefix,
        },
    ))
    return True
```

---

## Why this works for the GraphSnapshotAvailable → SourceLoaded chain

1. Cerebra relays `GraphSnapshotAvailable` to hub → hub assigns it `hub_GSA_id`
2. LumaWeave receives `hub_GSA_id` from its hub subscription
3. **LumaWeave application code** emits local `SourceLoaded` with `causation_id = hub_GSA_id`
   — LumaWeave knows what triggered it; it stores the hub event ID directly
4. LumaWeave relay agent calls `_translate_causation_id(hub_GSA_id)`:
   `read_by_external_id(hub_GSA_id.hex())` returns None (hub_GSA_id is a hub primary ID, not an external_id)
   → falls through to `return local_causation_id` → passes `hub_GSA_id` as-is
5. Hub `SourceLoaded` gets `causation_id = hub_GSA_id`
6. `walk_causation` from hub `SourceLoaded` → finds `GraphSnapshotAvailable` → case-2 confirmed

No special relay agent awareness of `GraphSnapshotAvailable` is needed. The relay is generic. The application-semantic causation is established in step 3, by LumaWeave's own code.

## Same-project causation chains (e.g., local A → local B, both relayed)

1. Relay processes local A first (fossic append ordering guarantees A before B)
2. hub A is written with `external_id = local_A.id.hex()`
3. Relay processes local B: `_translate_causation_id(local_A.id)` →
   `read_by_external_id(local_A.id.hex())` → returns hub A → returns `hub_A.id`
4. Hub B gets `causation_id = hub_A.id`
5. `walk_causation` from hub B → finds hub A → case-2 within same project

The ordering race (B processed before A across different streams) is not a real concern: B cannot causally depend on A unless A was appended first to the local store; fossic's subscribe() delivers events in append order; A is guaranteed to be relayed before B within any relay session.

---

## S-030 and S-031 correction

**S-030 correction:** Replace "causation_id=event.id (the local source event's ID)" with:
> causation_id is translated via `_translate_causation_id(event.causation_id)`: local event IDs are resolved to their hub counterparts via `read_by_external_id`; hub event IDs (cross-store triggers) pass through as-is; None passes through as None. `external_id = event.id.hex()` already carries provenance; `causation_id` carries application-semantic cause only.

**S-031 correction:** The relay agent requires no special awareness of `GraphSnapshotAvailable`. The obligation moves to LumaWeave's application layer: when emitting `SourceLoaded` in response to a hub-received `GraphSnapshotAvailable`, LumaWeave must store `causation_id = hub_GSA_id` in the local event at emit time. The relay then passes it through naturally via `_translate_causation_id`.

The relay_append convenience helper (B.3) should call `_translate_causation_id` internally rather than accepting a raw causation_id — this ensures all relay authors get the translation for free.

---

## Impact on other relay agents

All four emitting projects (Cerebra, LumaWeave, Policy Scout, ai-stack) are affected by the S-030 correction to the relay pseudocode. In practice:

- **Cerebra:** Local cycle events are typically root events (`causation_id=None`) or caused by other local Cerebra events — translation path is straightforward.
- **LumaWeave:** Has the `GraphSnapshotAvailable → SourceLoaded` cross-store trigger — this is the primary case that motivated the correction; application-layer obligation applies here.
- **Policy Scout:** `CommandRequested.upstream_causation_id` points to a Cerebra `ActionProposed` — a hub event ID stored by PS at local-emit time. Translation returns it as-is (not found via external_id → pass through).
- **ai-stack:** Current events are root events; no causation chain work needed in phase 1.

No emitting project needs to change their local event emission logic unless they already store causation_ids incorrectly. The relay_event() correction is mechanical and confined to fossic-py.

End of addendum.

---

