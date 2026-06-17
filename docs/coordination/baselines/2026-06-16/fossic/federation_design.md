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
