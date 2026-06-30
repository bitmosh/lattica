# Federation Visual Round — CORE.md
## Lattica Integration Reference

**Round date:** 2026-06-17
**Authors:** Lattica (this file); LumaWeave, Cerebra, Policy Scout, ai-stack (worker tile specs)

---

## §1 — Round metadata

**Purpose:** Specification gathering round. Each worker project authors a
`tile_spec.md` describing the tile(s) it wants built in Lattica's shell. Lattica
authors this integration reference. The bundle hands off to Anthropic's
claude-design product (current design platform) to inform iter-4 (or the next
scheduled iteration).

This is not a coordination round. No §12/§13 federation protocol applies. No
wave verification. Worker project tile specs are design briefs, not cross-project
contracts — they describe desired content and data bindings, not interface
commitments to other projects.

**Projects involved:**

| Project | Role in this round |
|---|---|
| LumaWeave | Worker — tile spec author |
| Cerebra | Worker — tile spec author |
| Policy Scout | Worker — tile spec author |
| ai-stack | Worker — tile spec author |
| Lattica | Integration touchpoints + visual vocabulary (this file) |
| Fossic | Data flow primitives (substrate); no tile spec in this round |

**Output target:** Hand-off bundle to claude-design. Bundle = this file + four
`tile_spec.md` files in subdirectories.

---

## §2 — Index of tile specs

All four specs filed 2026-06-17 (Stage 1a complete):

| Project | File | Status |
|---|---|---|
| LumaWeave | [`lumaweave/tile_spec.md`](lumaweave/tile_spec.md) | filed 2026-06-17 |
| Cerebra | [`cerebra/tile_spec.md`](cerebra/tile_spec.md) | filed 2026-06-17 |
| Policy Scout | [`policy-scout/tile_spec.md`](policy-scout/tile_spec.md) | filed 2026-06-17 |
| ai-stack | [`ai-stack/tile_spec.md`](ai-stack/tile_spec.md) | filed 2026-06-17 |

---

## §3 — Lattica integration touchpoints

The following contracts are live in Lattica's codebase as of 2026-06-17. Worker
project tile specs should describe desired tile content; Lattica wires the
registrations. This section tells worker projects what constraints apply to the
wiring.

---

### §3.1 — LiveValue\<T\> type pattern

**Design status:** Live. `src/types/live-value.ts` implemented 2026-06-17.
Exports `LiveValue<T>` and `ErrorReason`. CSS treatment tokens also live (§3.3).

**Type shape (`src/types/live-value.ts`):**

```typescript
type LiveValue<T> =
  | { state: 'live';  value: T;  lastUpdated: number; stream?: string }
  | { state: 'error'; reason: ErrorReason; lastAttempt: number; stream?: string };

type ErrorReason =
  | { kind: 'no-data-yet' }           // subscription open; no events received yet
  | { kind: 'source-unreachable' }    // hub, daemon, or connection lost
  | { kind: 'pre-relay' }             // wiring correct; upstream relay not live yet
  | { kind: 'wiring-incomplete' }     // subscription not yet coded in Lattica (dev-only)
  | { kind: 'data-stale'; thresholdMs: number }  // last event older than threshold
  | { kind: 'subscription-closed' };  // was live; closed unexpectedly
```

**Placement model:** one `LiveValue<T>` per data source connection, not per
element. A tile with two data sources (e.g. daemon HTTP + fossic subscription)
gets two LiveValues. Elements backed by a given source render from that source's
`LiveValue.value`; its error state propagates only to those elements.

**`wiring-incomplete` is dev-mode only.** In production, tile elements in
`wiring-incomplete` state should either not render or fall back to `pre-relay`
as a conservative display. The distinction: `pre-relay` means "wiring exists,
upstream not live yet"; `wiring-incomplete` means "wiring not yet coded."

**Key UX constraint:** `pre-relay` must not look like an error. It is the
expected state for most broken-pending elements. Visual treatment is blue-gray
muted (see §3.3), not amber or red.

---

### §3.2 — Project accent CSS tokens

**File:** `src/styles/project-accents.css` (live)

One token per active project. Consumed by tile chrome, stream badges, substrate
chips in causation arcs, and any other per-project visual differentiation.

```css
--project-accent-fossic:        #4cc9ff;   /* sky */
--project-accent-ai-stack:      #0d979e;   /* teal */
--project-accent-lattica:       #e3931b;   /* amber-orange */
--project-accent-bo:            #0729b0;   /* deep blue */
--project-accent-lumaweave:     #96f35a;   /* lime green */
--project-accent-cerebra:       #540fa8;   /* deep violet */
--project-accent-policy-scout:  #cf0a5c;   /* crimson */
```

bons.ai and rhyzome are benched and have no tokens. If they un-bench, add one
line each.

---

### §3.3 — LiveValue treatment color tokens

**File:** `src/styles/live-value-tokens.css` (live)

```css
--lv-no-data-yet:          #4a5568;                               /* muted slate */
--lv-source-unreachable:   var(--portfolio-color-warning, #e0a800); /* amber */
--lv-pre-relay:            #4a7a9b;                               /* steel blue */
--lv-wiring-incomplete:    #9b59b6;                               /* purple — dev only */
--lv-data-stale:           #c97b00;                               /* dark amber */
--lv-subscription-closed:  var(--portfolio-color-danger, #e05c5c);  /* red */
```

**Design rationale:**

- `no-data-yet` (`#4a5568`): muted slate; component applies 0.6 opacity + shimmer
  animation on top. Not an error color.
- `source-unreachable`: aliases `--portfolio-color-warning`; static amber, no
  animation.
- `pre-relay` (`#4a7a9b`): steel blue — the load-bearing design choice. Calm,
  "pending", clearly distinct from all amber/red error states. Users see this
  constantly while relay agents are pre-ship; it must not feel alarming.
- `wiring-incomplete` (`#9b59b6`): purple; visible only in dev mode. Gate on a
  build flag or `import.meta.env.DEV`.
- `data-stale` (`#c97b00`): darker amber than `source-unreachable`. Reads as
  "degraded but present" vs. "offline." Shows stale value with overlay warning.
- `subscription-closed`: aliases `--portfolio-color-danger`; red, reconnection
  indicator.

---

### §3.4 — tileSectionRegistry contract

**File:** `src/control-plane/tile-section/tileSectionRegistry.ts` (live)
**Types:** `src/control-plane/tile-section/types.ts`

A T2 registry (register + subscribe). External projects call
`tileSectionRegistry.register(entry)`. Registration throws if required fields
are missing. Live examples: `src/registrations.tsx`.

**Required fields for all external registrations:**

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Unique across all registered tiles |
| `label` | `string` | Display name in the Tiles popover |
| `category` | `"left-panel" \| "control-dock" \| "right-panel"` | Drives default anchor edge |
| `defaultWidth` | `number` | Floating tile width in px |
| `defaultHeight` | `number` | Floating tile height in px |
| `collapsible` | `boolean` | Whether the tile body can collapse to its title bar |
| `defaultVisible` | `boolean` | Whether tile appears on first app load |
| `defaultExpanded` | `boolean` | Whether tile body is expanded on first load |
| `content` | `() => ReactNode` | Render function for tile body (Mode A / "component" tiles) |

**Optional fields:**

| Field | Type | Notes |
|---|---|---|
| `kind` | `"component" \| "webview"` | Defaults to `"component"` when absent |
| `webviewUrl` | `string` | Mode B only; required when `kind === "webview"` |
| `requiresDevMode` | `boolean` | If true, tile only appears when developer devMode is on |

**`defaultAnchor` is application-side only.** The `TileSectionEntry` type includes a `defaultAnchor: TileAnchor` field that Lattica populates when wiring registrations in `src/registrations.tsx`. Worker project specs do not declare it — first-placement is a workspace concern, not a tile-content concern. The compositor resolves initial positioning from `category` and Lattica's own placement logic.

**Live registrations (from `src/registrations.tsx`):**

```typescript
// Cerebra Signal Feed
tileSectionRegistry.register({
  id: "cerebra-signal-feed",
  label: "Cerebra Signal Feed",
  category: "right-panel",
  defaultWidth: 420, defaultHeight: 320,
  collapsible: true,
  defaultAnchor: { edge: "right", offset: 0 },
  defaultVisible: true, defaultExpanded: true,
  content: () => <CerebraSignalTile />,
});

// AI Stack Topology
tileSectionRegistry.register({
  id: "ai-stack-topology",
  label: "AI Stack Topology",
  category: "right-panel",
  defaultWidth: 480, defaultHeight: 520,
  collapsible: true,
  defaultAnchor: { edge: "right", offset: 420 },
  defaultVisible: true, defaultExpanded: true,
  content: () => <AiStackTopologyTile />,
});
```

---

### §3.5 — registerPayloadRenderer contract

**File:** `src/control-plane/payload-renderer/payloadRendererRegistry.ts` (live)
**ADR:** `docs/adr/ADR-017-payload-renderer-registry.md`

A T2 registry for per-event-type payload renderers. Lattica's fossic event feed
calls `getPayloadRenderer({ project, event_type })` at render time. Worker
projects register a React component per event type.

**Registration shape:**

```typescript
interface PayloadRendererEntry {
  project: string;        // e.g. "cerebra", "policy-scout"
  event_type: string;     // fossic event_type string, e.g. "SignalEvaluated"
  component: ComponentType<PayloadRendererProps>;
  label?: string;         // human-readable, used in dev tooling
  stream_glob?: string;   // narrows to a stream prefix, e.g. "cerebra/agent-trace/*"
                          // absent = matches any stream
}

interface PayloadRendererProps {
  payload: unknown;   // treat as opaque; your renderer knows its own schema
  event_id: string;   // fossic event ID (blake3 hex)
}
```

**Constraints (ADR-017):**
- One renderer per `{ project, event_type }` pair. Duplicate registration fails loudly.
- Renderer components must be defensive: treat `payload` as `unknown`, fall back
  to JSON pretty-print for unrecognized fields.
- Unknown event types fall through to JSON pretty-print — not an error, not a blank.
- A renderer that throws shows an error boundary in its tile; other tiles are unaffected.

**Live examples:** `src/renderers/cerebra/` — five Cerebra renderers registered in
`src/registrations.tsx`:
`SignalEvaluatedRenderer`, `PredictionMadeRenderer`, `OutcomeRecordedRenderer`,
`ClutchDecisionMadeRenderer`, `CheckpointSavedRenderer`.

---

### §3.6 — File path conventions for P-013 renderer files

Worker project Claudes author renderer and tile files under Lattica's tree per
the P-013 guest-author protocol:

```
src/renderers/<project>/<EventTypeName>Renderer.tsx
src/renderers/<project>/<EventTypeName>Renderer.css   (companion styles)
src/tiles/<project>/<ProjectName>Tile.tsx
src/tiles/<project>/<ProjectName>Tile.css
```

**Examples (live):**
```
src/renderers/cerebra/SignalEvaluatedRenderer.tsx
src/renderers/cerebra/SignalEvaluatedRenderer.css
src/tiles/cerebra-signal/CerebraSignalTile.tsx
src/tiles/cerebra-signal/CerebraSignalTile.css
src/tiles/ai-stack/AiStackTopologyTile.tsx
src/tiles/ai-stack/AiStackTopologyTile.css
```

Registration of the tile and renderers goes in `src/registrations.tsx` —
this file is the single entry point for all cross-project registrations.

---

### §3.7 — fossic_query_remote_store Tauri command

**File:** `src-tauri/src/lib.rs` (live as of 2026-06-17)
**Purpose:** Query a specific event from a remote project's local fossic vault by
event ID. Used for Case-1 cross-substrate causation traversal (federation design §B.4).

**Signature:**

```typescript
// TypeScript invoke shape
invoke("fossic_query_remote_store", {
  source_store: string,   // project name key in registry, e.g. "cerebra"
  event_id: string,       // blake3 hex event ID
}) -> Promise<SerializedEvent | null>
   // throws RemoteStoreError on failure
```

**Error variants (serialized as `{ kind: "...", ...fields }`):**

| `kind` | Fields | Meaning |
|---|---|---|
| `registry_not_found` | — | `~/.lattica/project-registry.json` absent |
| `project_not_registered` | `project: string` | Key not in registry |
| `store_not_found` | `path: string` | Registry entry points to a non-existent vault |
| `event_not_found` | `id: string` | Reserved; current command returns `null` for missing events |
| `store_error` | `message: string` | I/O or parse error from the fossic store |

**Registry file:** `~/.lattica/project-registry.json`

```json
{
  "projects": {
    "cerebra": "~/.cerebra/.fossic/store.db",
    "lumaweave": "<developer-supplied — path is <project-root>/.lumaweave/fossic.db where project-root is the directory LumaWeave has open; check ide::get_project_root_inner() output>",
    "policy-scout": "~/.config/policy-scout/.fossic/store.db",
    "ai-stack": "~/Projects/ai-stack/.fossic/store.db"
  }
}
```

**Current state:** The registry file does not exist. The command returns
`registry_not_found` until a relay agent ships and the developer creates the
file. Tile specs that reference cross-substrate causation traversal should
declare which error variants they display visually — at minimum:
`registry_not_found` (show dashed arc with "vault registry not populated")
and `store_not_found` (show dashed arc with path attribution).

Registry write logic (automatic population when relay agents declare themselves)
is deferred. For now the developer maintains the file manually as relay agents ship.

---

## §4 — Cross-cutting visual vocabulary

### §4.1 — Relationship to existing claude-design iteration

The existing claude-design iteration's layout and composition are preserved. Worker
projects describe tile **content** (what data to show, what interactions to support,
what error states to handle). claude-design handles tile positioning, overall layout
composition, and visual hierarchy when iter-4 lands.

Worker project tile specs should not propose changes to the global layout, panel
composition, or navigation structure. Describe the tile's internal contents.

---

### §4.2 — Theme tokens (portfolio-tokens.css)

**File:** `src/styles/portfolio-tokens.css` (live)

The canonical 10 shared semantic tokens. All tile components should use these
rather than hardcoded hex values where they apply:

```css
--portfolio-bg:             #0f1420       /* app background */
--portfolio-surface:        rgba(15,23,42,0.72) /* panel/card background */
--portfolio-text-primary:   #e9e4f5       /* primary text */
--portfolio-text-secondary: #a28fc0       /* muted/secondary text */
--portfolio-accent:         #ffb347       /* platform accent (amber-orange) */
--portfolio-border:         rgba(255,179,71,0.18) /* panel border */
--portfolio-color-danger:   #e05c5c       /* error / destructive */
--portfolio-color-success:  #5eba7d       /* success / healthy */
--portfolio-color-warning:  #e0a800       /* warning / degraded */
--portfolio-color-info:     #4da6ff       /* informational */
```

All tokens fall back to hardcoded hex if the LumaWeave `--lw-*` tokens are
absent (which they will be while Lattica runs standalone without Mode B embedding).

---

### §4.3 — Project accent tokens

See §3.2. Use `var(--project-accent-<project>)` for per-project color differentiation:
stream badges, substrate arc chips, tile header accents. Seven active tokens.

---

### §4.4 — Typography conventions

No dedicated typography token file in tree. Current conventions observed in
live tile components:

- Body text: `font-size: 13px`, `font-family` inherits from body (system monospace
  in the current scaffold).
- Label/heading text: 11–12px, `font-weight: 600`, `letter-spacing: 0.04em`,
  `text-transform: uppercase` for section labels.
- Monospace data (event IDs, stream paths, timestamps): inherit body font-family.

These are observed from the Cerebra and ai-stack tile implementations, not declared
in a token file. Worker project tile specs may propose typography tokens if needed;
those get absorbed into a token file in a future pass.

---

### §4.5 — Spacing and border conventions

No declared spacing token file. Observed from live components:

- Tile internal padding: `12px` sides, `8px` top/bottom.
- Section separator: `1px solid var(--portfolio-border)`.
- Card/chip border-radius: `4px` for chips, `6px` for cards.
- Gap between stacked items: `8px`.

As with typography, these are inferred rather than declared. Worker project tile
specs may propose spacing tokens; they land in a future token pass.

---

### §4.6 — Divisible pane workspace status

**Not yet implemented.** The current app shell renders `<HelloTile />` as an
inline dev scaffold. `TileProvider + TileLayer + FloatingTile` (the floating tile
compositor from LumaWeave) have not yet been extracted and wired.

**What this means for tile specs:** Worker projects describe tile registration
shape (the `TileSectionEntry` fields in §3.4) without depending on specific
layout positions or pane structure. When the compositor lands as a future pass,
tiles will render as floating panels at their `defaultAnchor` positions. The
registration contract is stable; the compositor arrival doesn't change it.

Tile specs may propose `defaultWidth`, `defaultHeight`, and `defaultAnchor` edge
preference — these are design inputs, not commitments. The compositor pass will
validate them against the actual viewport.

---

## §5 — Fossic data flow primitives

*Authored by Fossic. This section is the authoritative reference for tile spec
data binding declarations. Verify actual pyo3 signatures against
`fossic-py/src/store.rs` and `fossic-py/src/types.rs` — function signatures
below are from those files.*

---

### §5.1 — Store.open

**Python call:**

```python
from fossic import Store
store = Store.open("/absolute/path/to/store.db")  # CreateIfMissing default
```

**Behavior:** `CreateIfMissing` is the default `FirstOpenPolicy`. `Store.open()`
calls `create_dir_all(parent_dir)` and creates the SQLite file if absent. WAL
journal mode and `busy_timeout = 30 000 ms` are set on open. A WAL watcher
thread starts automatically for cross-process subscription delivery.

**No hub readiness handshake required.** The first caller to `Store.open()` on
the hub path initializes the schema; subsequent callers (other relay agents,
Lattica) open an already-initialized store. Hub path:
`~/.lattica/fossic/store.db`.

**`FirstOpenPolicy::RequireExisting`** is used by `fossic_query_remote_store`
(see §6.1) — it returns `store_not_found` if the vault is absent rather than
creating an empty one.

---

### §5.2 — subscribe() API

**Python signature (from `fossic-py/src/store.rs`):**

```python
handle = store.subscribe(
    stream_pattern,            # str — required; glob treated by Rust layer
    branch="main",             # str — NEVER None; TypeError at Rust boundary
    mode=None,                 # None → PostCommit(queue_size=1024)
)
# Returns: SubscriptionHandle (context manager + iterator)
```

**From-now delivery.** `subscribe()` seeds the cursor from `MAX(version)` at
subscribe time. No historical replay. First event delivered is the next event
written after subscription opens.

**Glob semantics (from `fossic/src/subscriptions.rs`):**

| Pattern | Matches |
|---|---|
| `cerebra/signals` | Exact stream |
| `cerebra/*` | One segment: `cerebra/signals`, `cerebra/lattice` |
| `cerebra/**` | Zero or more: all streams beginning with `cerebra/` |
| `**` | All streams |

`*` matches exactly one path segment. `cerebra/agent-trace/*` does NOT match
`cerebra/agent-trace/abc123/substream` — use `cerebra/agent-trace/**` for
streams with variable-depth suffixes.

**`include_system` parameter**: exists in the pyo3 binding but is NOT forwarded
by the Python `Store` wrapper — system streams are always filtered in
Python-side subscriptions.

**Using the handle:**

```python
with store.subscribe("cerebra/**") as sub:
    for event in sub:                      # blocks until event arrives
        process(event)                     # StoredEvent (see §5.3)

# or with timeout:
event = handle.wait_for_next_event(timeout_secs=5.0)  # None on timeout
```

---

### §5.3 — StoredEvent fields

All fields from `fossic-py/src/types.rs`:

| Field / method | Type | Notes |
|---|---|---|
| `event.id` | `EventId` | blake3 hex; use `event.id.hex()` for string form |
| `event.stream_id` | `str` | Full stream path |
| `event.branch` | `str` | Always a concrete string; default `"main"` |
| `event.version` | `int` | Monotonic per-stream sequence number |
| `event.timestamp_us` | `int` | Unix microseconds |
| `event.event_type` | `str` | Application-defined type name |
| `event.type_version` | `str` | Schema version string |
| `event.causation_id` | `EventId \| None` | Causal parent event ID (may be None) |
| `event.correlation_id` | `EventId \| None` | Correlation chain ID (may be None) |
| `event.external_id` | `str \| None` | Idempotency key; set by relay to `local_event.id.hex()` |
| `event.payload()` | `Any` | Method (call with parens); deserializes msgpack→Python |
| `event.payload_bytes()` | `bytes` | Method; raw msgpack bytes |
| `event.indexed_tags()` | `dict \| None` | Method (call with parens); returns None if no tags set |

**Tile binding note:** tile specs that reference `indexed_tags` must call
`event.indexed_tags()` not `event.indexed_tags` — it is a method, not a
property. A bare property access returns the method object.

---

### §5.4 — Cold-start pattern

`subscribe()` delivers from-now only. A tile that needs to display historical
state on load must use `read_range()` first, then subscribe for incremental
updates. The two-phase pattern:

```python
from fossic import Store, ReadQuery

store = Store.open(path)

# Phase 1: snapshot
past_events = store.read_range(ReadQuery("cerebra/signals"))

# Phase 2: subscribe from now (no gap if subscribing immediately after read)
with store.subscribe("cerebra/signals") as sub:
    for event in sub:
        apply_increment(event)
```

**Lattica tile wiring:** tiles backed by a fossic subscription should set
`LiveValue.state = 'no-data-yet'` until the first event arrives post-subscribe.
If a snapshot is needed, present the snapshot data with `state = 'live'`
immediately; the `no-data-yet` state is only appropriate when the tile genuinely
cannot render until a real-time event lands.

**Additional cold-start variants** (§9.3): fold-to-last-event is the base
pattern. Also supported: state-reconstruction cold-start (apply event sequence
to derive current accumulated state) and partial cold-start (per-element rather
than per-tile — event feed rows intentionally skip cold-start).

---

### §5.5 — StorageError and degraded state

**Exception class:** `fossic.StorageError` (not `StoreConnectionError`).

`RelayAgent.run()` catches `StorageError` and reconnects after
`reconnect_delay_ms` (default 5 000 ms). Any other exception propagates as
fatal.

**`store.is_degraded()`** returns `True` when the WAL watcher has died (e.g.
file system issue) while the store handle is still open. Relay agents should
call `is_degraded()` periodically or after `StorageError` to decide whether to
close and reopen rather than retry.

---

### §5.6 — fossic-rs embedding (Tauri)

Lattica embeds `fossic` (the Rust crate) directly via Cargo dependency —
`fossic-py` is NOT used in Lattica's Tauri backend. The Rust API (`Store::open`,
`Store::append`, `Store::subscribe`) mirrors the Python API semantically but is
not identical in signature.

For tile specs: Lattica's subscription wiring uses the Rust fossic crate.
The `StoredEvent` shape (fields, types) is the same; `payload` is deserialized
to `serde_json::Value` on the Rust side and serialized to JSON for the TypeScript
frontend layer. Lattica's `SerializedEvent` type (used by
`fossic_query_remote_store`) reflects this serialization boundary.

---

## §6 — Cross-substrate causation status

### §6.1 — fossic_query_remote_store

**Status: implemented** (confirmed in `src-tauri/src/lib.rs`, 2026-06-17).
See also §3.7 for the full contract documented by Lattica.

**Summary:** synchronous Tauri command that opens a named project's local fossic
vault (via the project registry), reads one event by ID, and returns it as
`SerializedEvent | null`. Used for Case-1 causation traversal: a tile resolves
`causation_id` on a relayed hub event back to its origin event in the source
project's vault.

**Fossic perspective on the command:**

- Uses `FirstOpenPolicy::RequireExisting` — will not create a vault; returns
  `store_not_found` if the registry path points to an absent file.
- Calls `store.close()` after read — no persistent handle, no connection held.
- `EventNotFound` is reserved in the error enum; the current implementation
  returns `null` (not an error) for a missing event ID.
- The store opened is a local fossic store — WAL mode, same file format as all
  other fossic stores in the federation. No special inter-process protocol.

---

### §6.2 — Registry state

**Current state:** `~/.lattica/project-registry.json` does not exist.
`fossic_query_remote_store` returns `{ kind: "registry_not_found" }` until the
developer creates it. Registry write logic (automatic population on relay agent
startup) is deferred.

**Format:**

```json
{
  "projects": {
    "cerebra":      "/home/<user>/.cerebra/.fossic/store.db",
    "lumaweave":    "<developer-supplied — path is <project-root>/.lumaweave/fossic.db where project-root is the directory LumaWeave has open; check ide::get_project_root_inner() output>",
    "policy-scout": "/home/<user>/.config/policy-scout/.fossic/store.db",
    "ai-stack":     "/home/<user>/Projects/ai-stack/.fossic/store.db"
  }
}
```

Tilde paths (`~/…`) are supported — `expand_tilde()` is implemented in the
command handler.

**Registry population timeline:** developer creates the file manually as relay
agents ship per-project. No automatic write from the relay side in this round.

---

### §6.3 — Tile spec guidance for Case-1 causation

A tile that wants to render a causation arc crossing project boundaries:

1. The `causation_id` on a relayed hub event is the **hub-side** ID of the
   causal parent (translated at relay time by `_translate_causation_id`). The
   parent event may live on a different hub stream than the child.

2. If the causal parent is on the hub, read it from the hub store directly
   (standard fossic `read_one` call). No remote query needed.

3. If the causal parent traces back to a **specific origin event in a source
   vault** (i.e. the tile wants to show provenance depth > 1, or verify the
   original payload), invoke `fossic_query_remote_store` with
   `source_store = "<project>"` and `event_id = causation_id.hex()`.

4. `fossic_query_remote_store` may return any of the five error variants. Tile
   specs must declare at minimum which variants they display visually:

   | Variant | Recommended tile treatment |
   |---|---|
   | `registry_not_found` | Dashed arc; "vault registry not populated" |
   | `project_not_registered` | Dashed arc; project name + "not in registry" |
   | `store_not_found` | Dashed arc; path attribution |
   | `store_error` | Arc with amber warning chip; message field |
   | null return | Arc shown; origin payload unavailable |

5. **pre-relay state:** while a project's relay agent has not yet shipped, the
   hub carries no events from that project. Tiles should render the
   `LiveValue.state = 'pre-relay'` treatment (steel blue, §3.3) for causation
   arcs that would require a relay that isn't live yet.

---

### §6.4 — Relay infrastructure status

| Symbol | Exported from | Status |
|---|---|---|
| `RelayConfig` | `fossic` (fossic-py) | Shipped |
| `RelayAgent` | `fossic` (fossic-py) | Shipped |
| `relay_append` | `fossic` (fossic-py) | Shipped |
| `run_relay` | `fossic` (fossic-py) | Shipped |
| `ai-stack-relay.py` | `ai-stack/` | Authored |
| `cerebra-relay.py` | `cerebra/` | Not yet authored |
| `lumaweave-relay.py` | `lumaweave/` | Not yet authored |
| `policy-scout-relay.py` | `policy-scout/` | Not yet authored |
| Hub store at `~/.lattica/fossic/store.db` | Lattica (Tauri backend opens it) | Exists when Lattica app has run once |
| Project registry at `~/.lattica/project-registry.json` | Developer-maintained | Does not yet exist |

**Consequence for hub subscriptions:** Lattica's fossic subscription wiring
will receive zero relayed events from any project until that project's relay
agent ships and the developer has populated the registry. This is the expected
`pre-relay` state for relay-dependent streams.

**Exception — hub-direct writes (§9.6):** streams written directly to the hub
store (e.g. Cerebra's `cerebra/graph/**` for `GraphSnapshotAvailable`) are
live as soon as the originating project emits them, independent of any relay
agent. Tile specs should distinguish relay-dependent streams from hub-direct
streams when declaring expected `pre-relay` scope.

---

## §7 — Performance and scale guidance

### §7.1 — Write path

A single `Mutex<Connection>` serializes all writes within one process. Fossic is
designed for **control-plane event frequencies** — state transitions, decisions,
evaluations — not high-frequency telemetry (thousands of events/second). Relay
agents and Lattica tile wiring operate well within this envelope.

Practical write budget: hundreds of events per second per store is fine; tens of
thousands per second per store is not the design target. Each project's relay
agent writes to the hub store; relay agents from different projects contend on
the hub store's write mutex. With three to five active relay agents at normal
control-plane rates, contention is negligible.

---

### §7.2 — Read path

WAL mode means readers never block writers and writers never block readers.
Multiple concurrent `read_range()` calls (e.g. snapshot reads during tile
cold-start) are safe. `read_one()` and `read_by_external_id()` are indexed point
reads — fast regardless of store size.

---

### §7.3 — Subscription queue

Default `PostCommit(queue_size=1024)` — events queue in memory between commits
and subscription delivery. At normal control-plane rates, the queue is never
full. If a relay agent processes events slower than they arrive (e.g. hub append
is slow), the queue fills and the oldest undelivered event is dropped. Design
relay agents to process events quickly; do not perform blocking I/O inside the
event callback.

---

### §7.4 — Payload size

No hard limit imposed by fossic. Practical constraint: payloads are msgpack'd
Python objects stored in SQLite `BLOB` columns. Keep individual event payloads
under ~64 KB for predictable performance. Large binary artifacts (graphs,
snapshots, rendered images) belong in separate files; the fossic event carries
a path or content-addressed reference, not the artifact itself.

---

### §7.5 — Tile spec implications

- **Snapshot reads at tile open**: `read_range()` is a blocking call; run it off
  the main thread or use Lattica's async invoke pattern. For moderate stream
  sizes (< 10 000 events), latency is imperceptible.
- **Subscribe is from-now**: don't count on `subscribe()` to backfill missed
  events if the tile is closed and reopened. A cold-start read + subscribe is
  the correct pattern (§5.4).
- **indexed_tags queries**: `read_range()` supports tag-filtered queries via
  `ReadQuery`. Tile specs that filter events by session ID, cycle ID, or similar
  should declare their tag keys — relay agents preserve source-event tags and add
  `source_store`.
- **Timestamp resolution**: `timestamp_us` is Unix microseconds. Convert to
  milliseconds (`// 1000`) for JavaScript `Date` compatibility.

---

## §8 — Lattica refinements (Stage 1b)

*Added after reading all four worker tile specs.*

---

### §8.1 — Cross-tile interaction patterns

Identified from worker specs. All are pre-relay or deferred unless noted.

| From tile | To tile | Pattern | Status |
|---|---|---|---|
| LumaWeave | Cerebra | Causation arc click: hub-traversable `SourceLoaded` ← `GraphSnapshotAvailable`; no `fossic_query_remote_store` needed (both events on hub) | Deferred (causation arc in Lattica shell) — LumaWeave S-031 receive path not built; lumaweave-relay.py not live. Note: `cerebra-snapshot` source adapter implemented in LumaWeave (2026-06-17); `snapshot_ref` read path ready on both sides. Hub causation arc awaits S-031. |
| Policy Scout | Cerebra | Causation arc — provenance: `DecisionIssued.upstream_causation_id` → `fossic_query_remote_store("cerebra", id)` → origin payload shown inline in PS tile (no Cerebra tile participation needed) | Deferred — CP-PS-6 (`upstream_causation_id` not yet populated) + policy-scout-relay.py not live |
| Policy Scout | Cerebra | Causation arc — navigate: on successful provenance read, emit `tile:focus-event` for Cerebra tile to scroll+highlight matching event | Deferred — iter-5+ (developer decision; no cross-tile protocol in scope for iter-4) |
| ai-stack | Cerebra | `bo_node_card` status derives from `GET :7432/status` (Cerebra daemon). Both tiles independently poll the same endpoint. No shared state; no tile-to-tile link. | Live (Phase 1) |

**`tile:focus-event` protocol** — proposed by Policy Scout (§7.1 of PS spec). Developer decision applied in Stage 2: **deferred to iter-5+**. Both tiles work independently for iter-4. No cross-tile `tile:focus-event` protocol is in scope for this round. Payload shape and listener contract remain unresolved; do not implement unilaterally. (PS §9.7 records the same decision.)

**Duplicate daemon poll** — ai-stack and Cerebra both poll `GET http://localhost:7432/status`. This is intentional for Phase 1 independence. ai-stack's §7 notes a potential future shared `LiveValue` or Zustand slice — that's a Lattica integration decision for a post-relay pass.

---

### §8.2 — Pending lib.rs additions (Policy Scout)

Policy Scout §8.4 proposes five new Tauri commands not yet in `src-tauri/src/lib.rs`. They follow the existing `run_cli_json()` pattern. Signatures are proposals; Lattica reviews before adding.

```rust
fn ps_lockdown_status() -> CliJsonResponse
    // policy-scout lockdown status --json → { ok, active: bool, reason?: string }

fn ps_watch_status() -> Result<WatchStatusResponse, String>
    // Note: ps watch status --json returns { running, pid?, stale?, pid_file }
    // No `ok` field — needs its own response struct (not CliJsonResponse)

fn ps_approvals_list() -> ApprovalsListResponse
    // policy-scout approvals list --json → { approvals: ApprovalItem[] }

fn ps_approve_once(approval_id: String) -> CliJsonResponse
    // policy-scout approvals approve <id> --json

fn ps_deny(approval_id: String) -> CliJsonResponse
    // policy-scout approvals deny <id> --json
    // Note: --json flag support on `deny` subcommand needs confirmation (PS §9.6)
```

New structs needed: `ApprovalItem`, `ApprovalsListResponse`, `WatchStatusResponse`.
`activate_lockdown`, `deactivate_lockdown`, `restart_watch` are already live.

---

### §8.3 — Coverage gaps and corrections

**`registerPayloadRenderer` call signature — resolved in Stage 2**

Policy Scout's original spec used positional arguments; the correct form is a single
`PayloadRendererEntry` object. PS applied the object form to all four renderer
registrations in Stage 2 (see PS §8.3 / §5.5). ✓

**Missing token aliases (Policy Scout §2.2 / §3.3) — resolved in Stage 2**

Policy Scout's original spec referenced `--portfolio-color-text-muted` and
`--portfolio-color-muted`, neither of which exist in `portfolio-tokens.css`. PS
applied corrections in Stage 2: `--portfolio-color-text-muted` → `--portfolio-text-secondary`;
`--portfolio-color-muted` → `--portfolio-surface`. ✓

**`vramWarnPct` default (ai-stack §1) — resolved in Stage 2**

Developer decision: align UI default to 90%, consistent with CP-C-6 and the
foundation pass fix to `AiStackTopologyTile.tsx:213`. ai-stack §1 updated in Stage 2
(`default 90`). The "80 UI / 90 platform" distinction argument was considered and
overruled — a single threshold removes a class of user confusion. ✓

**ai-stack anchor offset coupling (LumaWeave cross-note, Wave 3) — not present in spec**

LumaWeave cross-noted that ai-stack's Stage 3 content might contain "Cerebra
defaultHeight: 560 affects ai-stack anchor offset" language that re-introduces
layout coupling. Verified against ai-stack/tile_spec.md: no such text exists.
ai-stack §6 declares `defaultAnchor: { edge: "right" }` with no offset value;
Stage 2 corrections contain no layout-coupling language. Cross-note does not
correspond to load-bearing spec content. No action required. ✓

**CerebraSignalTile.tsx cold-start (Cerebra §9.1 + Fossic §9.5)**

Cerebra flags that reconstructing the last step's 6-signal bundle from cold-start
requires correlating `SignalEvaluated` events to the most recent `EvaluationComposed`
by causation chain or timestamp proximity. `SignalEvaluated` indexed_tags carry
`signal_name` and `low_confidence` only — no `step_id`. This correlation pattern
is unresolved. Additionally, Fossic §9.5 flags that `ReadQuery` wildcard glob
support (e.g. `ReadQuery("cerebra/agent-trace/**")`) is **unverified** — `read_range`
may only accept exact stream IDs. Cerebra's cold-start multi-stream read must
resolve both gaps before signal score seeding ships.

---

## §9 — Fossic refinements (Stage 1b)

*Added after reading all four worker tile specs. Documents patterns workers
used that were absent or underspecified in §5–§7.*

---

### §9.1 — Exact stream subscriptions

§5.2 covers glob patterns. Workers also subscribed to **exact stream names**
where the stream path is fixed and a wildcard would over-match:

```python
store.subscribe("cerebra/control")       # single control stream
store.subscribe("ai-stack/gpu")          # single GPU telemetry stream
store.subscribe("ai-stack/models")       # single model lifecycle stream
store.subscribe("policy-scout/posture")  # single posture stream
```

Exact stream names are matched by the same Rust subscription layer as globs.
Prefer exact names when the stream is well-defined and no session-scoped
variants exist.

---

### §9.2 — Multiple subscriptions per tile

Workers opened multiple independent fossic subscriptions within a single tile
(Cerebra: three streams; Policy Scout: two Track B streams). Each
`store.subscribe()` call returns an independent `SubscriptionHandle` with its
own cursor. There is no built-in event merge — combining events from multiple
handles into one feed is the application layer's responsibility.

Each handle is a separate Python context manager. In threaded relay agent code,
spin one thread per handle. In async tile wiring (Tauri Rust side), open each
subscription in its own async task.

---

### §9.3 — Cold-start pattern variants

§5.4 documented fold-to-last-event. Workers introduced two additional variants:

**Variant 2 — State-reconstruction cold-start** (ai-stack §3 Phase 2):
When state is an accumulation of transitions (e.g. currently loaded models
derived from `ModelLoaded`/`ModelUnloaded` history), apply events in sequence:

```python
past = store.read_range(ReadQuery("ai-stack/models"))
loaded = {}
for event in past:   # read_range returns ascending by version
    if event.event_type == "ModelLoaded":
        loaded[event.payload()["model_name"]] = event.payload()
    elif event.event_type == "ModelUnloaded":
        loaded.pop(event.payload()["model_name"], None)
# loaded now reflects current state; then subscribe from-now
```

**Variant 3 — Partial cold-start** (LumaWeave §3):
Some tile elements intentionally skip cold-start and show from-now only.
A rolling event feed that displays "events since tile open" is correct
behavior without cold-start. Cold-start is per-element, not per-tile.
Design each element's data binding independently: "current value" elements
need cold-start; "recent activity" feeds do not.

---

### §9.4 — Path expansion in Store.open()

**Python `Store.open()` does NOT expand `~`**. The pyo3 binding passes the
string directly to Rust's `Path::from()`, which treats `~` as a literal
path component.

```python
# Wrong — tilde is not expanded:
store = Store.open("~/.lattica/fossic/store.db")

# Correct:
import os
store = Store.open(os.path.expanduser("~/.lattica/fossic/store.db"))
```

`RelayConfig` callers must pass expanded absolute paths. Tilde expansion in
`~/.lattica/project-registry.json` registry entries is handled by Lattica's
Rust `expand_tilde()` at the Tauri boundary — Python relay agents cannot
rely on this.

---

### §9.5 — ReadQuery glob support (unverified gap)

Workers used wildcard patterns in `ReadQuery` for cold-start:

```python
# Cerebra §9.1:
past = store.read_range(ReadQuery("cerebra/agent-trace/**"))
```

Whether `ReadQuery` supports the same glob semantics as `subscribe()` is
**unconfirmed**. The glob matching in `subscribe()` is implemented in the
Rust subscription registry; `read_range` uses a separate query path and may
only accept exact stream IDs.

**Safe pattern until confirmed:** use an exact stream name, or issue one
`read_range` per known stream. Cerebra's Stage 2 update to §9.1 applied the
safe workaround: cold-start now targets the exact session stream
(`cerebra/agent-trace/{active_session_id}`) rather than a wildcard
`ReadQuery`. The broader ReadQuery glob question remains unverified and open.

---

### §9.6 — Hub-direct writes (no relay required)

Relay agents are not the only path to the hub store. Any process with
filesystem access to the hub store path can call `Store.open(hub_path)` and
`store.append()` directly.

Cerebra uses this for `GraphSnapshotAvailable` events on `cerebra/graph/**`
(Cerebra tile spec §3 source D): "Hub-direct writes — does NOT require
cerebra-relay.py to ship." The event is written directly to the hub store
at snapshot export time. Implemented 2026-06-17 in `cerebra/graph/exporter.py:export_graph()`.
Hub store path is configured via the `CEREBRA_PLATFORM_STORE` environment variable;
no hub write occurs if the variable is unset.
LumaWeave's `cerebra-snapshot` source adapter (also implemented 2026-06-17,
`src/source-adapter/adapters/cerebraSnapshotAdapter.ts`) reads `snapshot_ref`
directly via the existing `read_user_file` Tauri command — no new commands required.
Both ends of the snapshot data path are now live.

**Hub-direct is appropriate when:**
- The originating process can hold an open fossic store handle directly.
- The event does not need to live in a local store first.
- Immediate hub-side availability is more important than local provenance.

**Relay is required when:**
- The event must survive hub-store restarts (relay reconnects automatically).
- The event needs to exist in the project's local store for local queries.
- The originating process should not hold a persistent hub handle.

**Protocol fields for hub-direct writes:** `external_id`, `source_store`
tag, and causation translation are **relay-protocol fields**. Hub-direct
events written by the originating project do not need them. Hub-direct
events are first-class hub events — not copies of local events.
