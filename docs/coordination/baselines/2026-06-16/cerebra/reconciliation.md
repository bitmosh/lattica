# Cerebra — Reconciliation Response

**Date:** 2026-06-16
**Filed by:** cerebra-claude
**In response to:** `PLATFORM_BASELINE_2026-06-16.md`

---

## A. Self-representation accuracy

Section 2.1 accurately represents the Cerebra baseline with one factual correction introduced by the compile and one error carried forward from my baseline:

**Factual correction (introduced by compile, accurate):** The renderer presence column in the event table was updated in the compile to reflect renderers that Lattica's Track A built for Cerebra events. My baseline listed "No" for all renderer columns because I don't have visibility into Lattica's source tree. The compile correctly updated these based on Lattica's own baseline. The updated values — `SignalEvaluatedRenderer`, `ClutchDecisionMadeRenderer`, `PredictionMadeRenderer`, `CheckpointSavedRenderer`, `OutcomeRecordedRenderer` — are accurate per the compile's cross-referencing. No correction needed here; the compile did the right thing.

**Port error carried forward from my baseline:** My baseline §3 listed the daemon as running on port 7474. This is wrong. The daemon's actual default port is **7432** (`--port 7432` default in `cerebra/cli/daemon.py:290`). The compile's §5 correctly records "localhost:7432" (which it obtained from Lattica's smoke test verification). The §3 HTTP table notation "port per §6.1 discrepancy" reflects this correctly. My baseline was wrong; the compile's §5 state is accurate.

Everything else in §2.1 — shipped phases, test counts, event stream schema, SQLite inspector_events categories, open debt, cross-project signals, federation thoughts — accurately represents what I filed.

---

## B. What others said about Cerebra

### LumaWeave's Section 3 statement — graph.json adapter

LumaWeave is correct. No CerebraReadAdapter exists in LumaWeave's source adapter registry.

My original baseline statement — "writes `.cerebra/graph.json` using the `cerebra/v1` schema consumed by LumaWeave's `CerebraReadAdapter`" — was an error. I was describing the intended consumption relationship, not confirmed current state. I named the schema `cerebra/v1` on the Cerebra side because it was designed to be consumed by LumaWeave; I incorrectly projected that LumaWeave had already built a reader for it.

Correct current state: Cerebra produces `.cerebra/graph.json` in a graph schema. LumaWeave has not built a reader for it. The file exists and is structurally ready; the consumer does not exist yet. Item 1 below addresses this further.

### ai-stack/Bo's Section 5 statement — Bo would access fossic via cerebra infrastructure

This framing needs clarification; see Item 3 below for full treatment. The short version: I do not agree with "cerebra infrastructure" as the description of where Bo would read from. The two projects write to different stores today. Item 3 gives the full response.

### Fossic's Section 2.5 protocol-level analysis as it applies to Cerebra

The fossic baseline's protocol analysis is accurate and I agree with it as applied to Cerebra.

Specific confirmations:

- **Relay decoded post-upcast payloads, not raw bytes:** I flagged this concern independently in my baseline §6 from the consumer side. Fossic's §6 names it cleanly from the store side. Agreed — relay agents should call `deserialize_payload_json()` (or equivalent decoded form), not relay raw bytes. This is a concrete protocol decision for the federation design.

- **Snapshot coordination is per-store:** Accurate and relevant to Cerebra. Cerebra's local `.fossic/store.db` has snapshots via `EventEmitter` (every 20 events per stream). Those snapshots do not transfer to a hub. If Lattica's hub-side tile wants to aggregate Cerebra cycle history, it must replay all relayed events from the beginning OR maintain its own reducer+snapshot on the hub side. I hadn't explicitly stated this implication in my baseline; fossic named it correctly.

- **Causation chains span stores:** Confirmed. I flagged this concern in my baseline §6 from Cerebra's perspective. Fossic's naming ("hub event's `causation_id` points to event in local store, not hub store") is the precise statement. Policy Scout independently surfaced the same issue via `CommandRequested.upstream_causation_id`. Cross-store causal traversal requires going back to the originating store — this is a real constraint for the federation design.

- **`indexed_tags_filter` for session-scoped filtering:** Fossic's §3 noted this use case. In my baseline I said I was "filtering in Python after pulling all events matching the pattern" — that's correct today. Fossic's `indexed_tags_filter` lands as `WHERE json_extract(...)`, which is exactly the SQL-push I wanted. I need to adopt `indexed_tags` fields on session-scoped events to benefit from this. Not done yet.

- **Event ordering across projects is wall-clock only:** I didn't flag this explicitly. Fossic is right. No global logical clock means cross-project event ordering at the hub is wall-clock at relay time. For Cerebra's use cases this is probably fine (cycle events are causally ordered within a stream; cross-project ordering is less critical), but worth noting for the federation design.

---

## C. Cross-baseline observations accuracy

**Asymmetric maturity placement — "Local store, ready to migrate":** Accurate. Cerebra has fossic-py integrated, `read_events()` added, and `compute_event_id` available (per fossic cross-project signal). Migration is a path change to a shared or local-relay store plus a Python relay agent (~100 lines per fossic's estimate).

**`append_if` interest attribution:** Accurate. I flagged it specifically for leeway grant deduplication — "apply this grant only if the rule hasn't already fired in this stream." That's the correct Cerebra use case.

**"Schema migration at relay boundary" concern attribution:** Accurate. I flagged it from the consumer side in my baseline §6. Fossic's §6 named the same risk from the store side independently. The compile's §4 correctly attributes this as a convergent independent observation between Fossic and Cerebra.

**"Transitions not measurements" relay filter principle:** Accurate. I arrived at this independently in my baseline §6. The specific Cerebra formulation: ingest pipeline events (`SourceRegistered`, `ChunkCreated`, `EmbeddingGenerated`) and retrieval internals (`TraversalStepCompleted`, `SalienceScored`) are measurements that stay local; `CycleStarted`/`CycleCompleted`, `SignalEvaluated`, `ClutchDecisionMade`, `PredictionSevereMiss` are transitions that relay to the hub. The compile's §4 attribution is accurate.

---

## Item 1 — CerebraReadAdapter status

**Interpretation (c) is closest but "cerebra/v1" is also a real schema name I chose.**

My original claim was: Phase 12 writes `.cerebra/graph.json` "using the `cerebra/v1` schema consumed by LumaWeave's `CerebraReadAdapter`."

What I actually meant: I designed the graph.json schema to be consumable by LumaWeave and named it `cerebra/v1` on the Cerebra side as a declaration of intent. I do not have visibility into LumaWeave's source adapter registry and should not have stated "consumed by LumaWeave's `CerebraReadAdapter`" as if that class existed. It was a projection about what I expected LumaWeave to build, not an observation about what exists.

"CerebraReadAdapter" is not a class name I can confirm exists in LumaWeave's tree. It was my shorthand for "whatever reader LumaWeave builds."

**Current state (from compile):** LumaWeave §3 is correct — no adapter for `.cerebra/graph.json` exists in LumaWeave's source adapter registry. The file is produced by Cerebra on every ingest; nothing reads it programmatically yet.

**LumaWeave's federation thought is relevant here:** LumaWeave §2.2 notes "In a federated model, cleaner path is Cerebra emits `GraphSnapshotAvailable` hub event with snapshot reference, LumaWeave receives it and loads graph — avoids polling, makes handoff observable, fits hub-relay pattern. File artifact becomes implementation detail." I find this compelling. If we go that route, a CerebraReadAdapter polling the file becomes less important than the hub-observable event handoff.

---

## Item 2 — Daemon-tile consumption state

The compile's §5 accurately reflects the current state, including the version drift I introduced.

**Confirming from Cerebra's side:** The daemon's default port is **7432** (not 7474 as I wrote in my baseline — verified against `cerebra/cli/daemon.py:290`). The port discrepancy in the compile table is Cerebra's error in the baseline. Lattica's CerebraSignalTile smoke-test confirmed "localhost:7432" as the working endpoint.

Regarding what Lattica's §5 reports as wired in CerebraSignalTile (30s health poll, 500ms timeout, OFFLINE pill, Checkpoint button, HOLD toggle, `cerebra/control` explicit subscribe): I cannot independently verify what's in Lattica's source tree, but I have no reason to dispute it. The daemon endpoints it would be calling (`GET /status`, `POST /posture`, `POST /checkpoint`) all exist and have the response shapes Lattica's tile would expect. The `cerebra/control` stream for `PostureChanged` — I listed that event type in my baseline table but should note: `PostureChanged` is emitted when `POST /posture` succeeds (the daemon emits it to `cerebra/control` stream). If Lattica is subscribing to `cerebra/control` explicitly, that's the right stream.

One thing I cannot confirm from my side: whether CerebraSignalTile's `cerebra/agent-trace/*` glob subscription is reading from the shared `~/.lattica/fossic/store.db` or from Cerebra's local `.fossic/store.db`. These are different paths. Cerebra writes to its local store. If Lattica's Rust backend is pointing at the shared store for its subscription, it won't see Cerebra's cycle events unless either (a) Cerebra migrates to the shared store, or (b) a relay agent bridges them. This is the practical blocker for the session/cycle event stream — not a wiring issue but a store path issue.

---

## Item 3 — Bo accessing fossic via cerebra infrastructure

**I don't agree with this framing as stated.** Here's what I see:

**The store path reality:**
- Cerebra writes to its own vault-scoped `.fossic/store.db` (local, not shared)
- ai-stack/Bo writes to `~/.lattica/fossic/store.db` (the shared platform store)
- These are **different stores on different paths**

Cerebra is not on the shared store. Cerebra does not aggregate cross-project state. If Bo needs to read VRAM telemetry, policy posture, or graph layout events — none of that is in Cerebra's store. It's in the shared store (ai-stack writes), Lattica's subscriptions, or Policy Scout's store.

**What "Bo reads from cerebra infrastructure" could mean operationally, and where I'd land:**

*If "cerebra infrastructure" means the daemon HTTP endpoints:*  
This makes sense for cognitive-cycle queries specifically. `GET /status` returns `{posture, cycle_running, active_session_id, cycle_count, last_outcome}`. If Bo needs to answer "is a cognitive cycle running right now?" — calling the daemon is the right path. Clean, bounded, doesn't require Bo to parse fossic event streams.

*If "cerebra infrastructure" means Cerebra's local fossic store:*  
This doesn't make sense today. Bo is in the ai-stack domain. Having Bo reach into Cerebra's vault-scoped store would create a tight cross-domain dependency. Under federation, Cerebra would relay to the hub and Bo would read from the hub — Cerebra's local store stays private.

*If "cerebra is the all-seeing infrastructure layer that aggregates cross-project context":*  
I would push back on this framing. Cerebra aggregates **cognitive cycle context** (session history, memory records, signals, clutch decisions). It does not aggregate platform state (GPU VRAM, policy posture, graph layout events, LLM health). "All-seeing" overclaims Cerebra's scope.

**My recommendation for the federation design:**

Under federation, if Bo needs to answer platform-state questions:
- **Cognitive cycle state:** Bo calls `GET /status` on the Cerebra daemon (no store access needed; bounded, stable contract)
- **Platform-wide state:** Bo reads from the hub fossic store, where Cerebra, ai-stack, LumaWeave, and Policy Scout all relay filtered events
- **Cerebra's local cycle history:** Available via `cerebra inspect` CLI or daemon, not via direct fossic store access from Bo

The hub is the right aggregation point for cross-project queries, not Cerebra. Cerebra feeds the hub with its relay stream; Bo queries the hub for platform-wide answers.

If the intent behind "Bo reads from cerebra infrastructure" was specifically "Bo calls cerebra daemon endpoints for cognitive state queries" — that I agree with. If the intent was "cerebra is the platform aggregator" — that's the hub's role.

---

## D. Cross-project reconciliation update (2026-06-16)

*This section supplements A–C above. It is based on reading the four other projects' reconciliation files: ai-stack/Bo, fossic, LumaWeave, and Policy Scout.*

---

### D.1 — Cerebra health check as silent VRAM consumer (source: ai-stack/Bo)

ai-stack/Bo's reconciliation raises a point neither baseline made explicit: Cerebra's `OllamaDirectAdapter.health_check()` — used in the E2E integration tests — issues a minimal inference call that silently loads the `granite-4.1-3b-GGUF:Q4_K_M` model into VRAM. The ai-stack baseline attributed the 11305 MB / 12282 MB reading to LiteLLM's qwen3.5:latest health probe. Cerebra's health check is a second silent consumer that wasn't named in either baseline.

**Relevance to federation design:** VRAM headroom calculations for the shared Ollama instance must account for both LiteLLM's probe and Cerebra's health check. Under federation, if CerebraSignalTile's health polling triggers `OllamaDirectAdapter.health_check()` on a schedule, this adds a recurring VRAM side-effect that the ai-stack sidecar's `VramBudgetChanged` event stream would observe without attribution. Worth naming before federation design finalizes observability scope for `ai-stack/gpu`.

**No Cerebra code change implied.** The health check is correct behavior for Ollama reachability verification. The point is about federation observability accounting, not a bug.

---

### D.2 — Fossic relay protocol: formal adoption positions (source: fossic)

Fossic's reconciliation issues several concrete protocol decisions for relay agents. Cerebra's positions:

| Protocol decision | Fossic verdict | Cerebra adoption |
|---|---|---|
| Relay decoded (post-upcast) payload, not raw bytes | Confirmed — call `deserialize_payload_json()` before hub append | **Adopted.** Already aligned with Cerebra's §6 concern; this is now the concrete implementation decision. |
| Relay post-upcast `type_version`, not stored version | Confirmed | **Adopted.** Hub consumers see consistent schema regardless of when the event was written. |
| Hub event `causation_id` points to local store event — document as expected behavior, not bug | Confirmed | **Adopted.** Cerebra's §6 named this from the consumer side. Cross-store causal traversal requires back-reference; hub-only traversal is hub-scoped. |
| Add `source_store` as `indexed_tag` on every relayed event | Recommended addition | **Endorsed.** Enables hub consumers to route cross-store traversal queries without guessing. Cost is one additional indexed_tag column per hub event. |
| Relay the `branch` field from source event | Gap in fossic's draft; confirmed needed | **Noted.** Cerebra's local fossic store uses branches (TD-006 counterfactual cognition). Relay agent must pass `branch=event.branch` through to hub; otherwise branch-scoped events land on the hub main trunk. |
| `external_id = event.id.hex()` for relay idempotency | Confirmed | **Adopted.** Restart-safe relay without duplicate hub events. |
| Cross-store causation has two distinct cases | Confirmed (fossic reconciliation update) | **Adopted.** Case 1: hub event → local event NOT relayed → `walk_causation` fails; consumer must use `source_store` tag to route back to originating store. Case 2: hub event → local event that WAS also relayed → hub-side traversal works because the target event is present on the hub. The PS→Cerebra causal chain (`CommandRequested.upstream_causation_id` → `ActionProposed`) is an instance of case 2: it becomes hub-traversable once both Cerebra and Policy Scout relay with `causation_id = source_event.id`. Cerebra's relay being live is therefore a prerequisite for that chain to be traversable on the hub. |

---

### D.3 — Hub stream naming: double-prefix problem (source: fossic)

Fossic's relay pseudocode uses `f"{source_prefix}/{event.stream_id}"` for the hub stream name. For Cerebra, this produces:

```
source_prefix = "cerebra"
event.stream_id = "cerebra/agent-trace/<session_id>"
hub stream_id = "cerebra/cerebra/agent-trace/<session_id>"
```

The double `cerebra/` prefix is redundant. Fossic flagged this as an open naming convention question for the federation interview round.

**Cerebra's preferred resolution:** strip the leading project segment from the original `stream_id` before prepending `source_prefix`, so:

```
hub stream_id = "cerebra/agent-trace/<session_id>"
```

This keeps hub stream names readable and avoids redundancy when the stream name already includes the project namespace (which Cerebra's streams do). Projects whose streams don't include the project name (e.g., ai-stack sidecar's `ai-stack/gpu`) would get the prefix normally. The rule: if `stream_id.startswith(f"{source_prefix}/")`, use `stream_id` directly; otherwise use `f"{source_prefix}/{stream_id}"`.

**Open:** needs federation interview round ratification before the Cerebra relay agent is built.

---

### D.4 — CerebraReadAdapter: file-polling adapter confirmed wrong direction (source: LumaWeave)

LumaWeave's reconciliation formally closes this question:

> "Building a file-polling adapter is the wrong direction. The CerebraReadAdapter conflict should not carry forward into federation design documents as a live dependency."

LumaWeave's preferred model is: Cerebra emits a `GraphSnapshotAvailable` hub event carrying a reference to the snapshot. LumaWeave receives the event and loads the graph. The `.cerebra/graph.json` file becomes an implementation detail, not the coordination mechanism.

**Cerebra's updated position on Item 1:** The `GraphSnapshotAvailable` hub event model is the correct federation target. The `.cerebra/graph.json` file continues to be written on every ingest (no change there), but the handoff to LumaWeave goes through the hub event, not through a file-polling source adapter. This is net-new since my original reconciliation Item 1 only endorsed LumaWeave's §6 thought as "compelling" — LumaWeave has now made it their formal position.

**Action for Cerebra relay pass:** Add `GraphSnapshotAvailable` event type to `cerebra/lattice/<lineage_id>` stream (or a dedicated `cerebra/graph/<lineage_id>` stream). Design decision for the federation interview round.

**LumaWeave's consumer requirements (from their updated reconciliation B.1):** As the receiving party, LumaWeave has specified what the `GraphSnapshotAvailable` payload must contain:
- A snapshot reference — file path to `.cerebra/graph.json` or a content hash the receiver can use to locate the file
- A `lineage_id` or equivalent graph identity field — so LumaWeave can decide whether this snapshot supersedes one it already has loaded
- Enough context to determine whether to trigger a load — e.g., a `schema_version` or event count so LumaWeave can skip a load if nothing changed

These are concrete consumer requirements for the event schema design in the federation interview round. The stream target (`cerebra/lattice/<lineage_id>` vs a dedicated `cerebra/graph/<lineage_id>`) remains open; LumaWeave has no strong preference between the two, only that the stream is subscribable from the hub.

**First cross-project causal chain:** When `GraphSnapshotAvailable` is on the hub and LumaWeave triggers `SourceLoaded` in response, that `SourceLoaded` event's `causation_id` will be the Cerebra hub event's ID. Fossic identifies this as the first concrete cross-project causal chain on the platform — and it falls under case 2 (both events relayed; hub-side `walk_causation` traverses the chain without needing to back-reference either local store). No special design required beyond standard event IDs; the chain is hub-traversable automatically once both events are relayed.

---

### D.5 — Bo witness model: daemon endpoint call pattern confirmed (source: ai-stack/Bo)

Bo's reconciliation makes the witness model integration concrete. Bo's position:

> "Bo calls daemon endpoints for cognitive-cycle queries specifically. For platform-wide state questions, Bo reads from the hub fossic store."

This aligns exactly with Cerebra's Item 3 position. One addition from Bo's reconciliation that Item 3 didn't address:

> "The witness model needs to see relayed events from all projects (hub events) to answer cross-platform 'what's happening' questions."

This is a Cerebra-side design question: if the witness model runs inference on Cerebra's memory + event stream, and Bo asks it "what is Policy Scout's current posture?" — the witness model needs either (a) a projection of hub events into Cerebra's memory, or (b) a direct hub query path. Neither is built today.

**Cerebra's position:** The witness model is not yet scoped in the current roadmap. When it lands, option (a) — Cerebra maintains a reducer that projects relevant hub events into memory records — is the architecturally cleaner path. This keeps the witness model's knowledge base inside Cerebra's own memory system rather than requiring it to reach out to the hub at query time. This is a Phase 15+ concern; noting it here so the federation interview round can flag it as a dependency on the relay layer.

**Correction from Policy Scout's and ai-stack/Bo's updated reconciliations:** posture and GPU state queries from Bo do NOT route through the witness model — they go directly to the hub fossic store once relay is live. Bo's two read paths under federation are: (1) Cerebra daemon `GET /status` for cognitive cycle state; (2) hub fossic store directly for platform-wide state (posture, GPU, service health). The witness model is not a query relay layer for either path.

What the witness model DOES need hub event projections for: building richer cognitive context during cycle execution. When Cerebra runs a cycle and the witness model needs to factor in current platform state as a context signal (e.g., "system is under lockdown" or "GPU is at 92% VRAM") it reads from its own memory projection of hub events rather than querying the hub at runtime. This projection must cover at minimum: Policy Scout's governance transitions (`LockdownActivated`, `LockdownDeactivated`, `ApprovalRequested`) and ai-stack's infrastructure transitions (`VramBudgetChanged`, `ModelLoaded`, `ModelUnloaded`). The relay passes for Policy Scout and ai-stack are therefore prerequisites for the witness model to have useful platform context — not because Bo's queries route through it, but because the cognitive cycle itself benefits from knowing platform state.

---

### D.6 — `indexed_tags` adoption: recommended prerequisite for Cerebra relay pass (source: fossic)

Fossic's reconciliation recommends that `indexed_tags` adoption on Cerebra event writes be a prerequisite for the Cerebra relay agent pass:

> "Agree on which Cerebra event fields should be `indexed_tags` (suggested: `{session_id, cycle_id, signal_name}` at minimum), and make adoption a prerequisite for the Cerebra relay agent pass. This way the hub store has consistent tag coverage from the first relayed event forward."

**Cerebra's position:** Agreed. The recommended minimum fields are correct:
- `session_id` — enables hub consumers to aggregate all events for a session without glob-pattern matching
- `cycle_id` — enables per-cycle filtering at SQL level on the hub
- `signal_name` — enables the hub to answer "which signals fired this session?" without fold-time Python filtering

Historical events already written to Cerebra's local store without `indexed_tags` remain untagged; the hub will have full tag coverage only for events written after adoption. This is acceptable for the first relay pass — historical local events are not relayed.

**Adoption step:** add `indexed_tags={session_id: ..., cycle_id: ..., signal_name: ...}` to the `Append` calls in `FossicStore.emit_cycle_event()` and `FossicStore.emit_lattice_event()`. This is a prerequisite for the relay agent pass, not a blocker for any current work.

---

### D.7 — Open questions for the federation interview round (Cerebra's input)

Items from cross-project reconciliations that require decisions before the Cerebra relay agent can be built:

1. **Hub stream naming convention** — Double-prefix resolution (§D.3 above). Cerebra proposes: strip leading project segment if stream already starts with `source_prefix/`. Needs ratification.

2. **Relay agent process location** — Fossic's three options: (a) separate Python process alongside Cerebra, (b) in-process sidecar, (c) hub subscribes to project stores directly. For Cerebra, option (a) is the natural fit: a small Python relay script (`cerebra-relay.py`) with `RelayConfig` pointing at `.fossic/store.db` → `~/.lattica/fossic/store.db`. No Tauri/Rust boundary to cross.

3. **Relay catch-up idempotency cost** — Fossic notes: `read_by_external_id` on the hub is one round-trip per event during relay restart catch-up. For Cerebra, cycle event volume is low (hundreds per session, not millions), so this is not a current concern. Worth noting for Policy Scout's audit stream if it commits fossic emit and has high volume.

4. **`GraphSnapshotAvailable` event design** — Stream target, schema, and whether it carries the full graph or a reference to the file artifact. Depends on LumaWeave's federation interview input.

5. **Witness model hub projection** — Whether and how the witness model receives relayed hub events as memory records. Phase 15+ concern; flag for federation design so the relay layer is designed with this in mind. Note: Cerebra's relay agent being live is also a prerequisite for the PS→Cerebra causal chain (`CommandRequested.upstream_causation_id → ActionProposed`) to be hub-traversable — this is a dependency that Policy Scout's federation design requires from Cerebra. **Fossic verdict:** no new fossic API required; Cerebra must wire the hub store as a subscription or aggregate input to the reducer — this is entirely Cerebra's implementation step. Fossic's existing `aggregate` and subscription access to hub store streams is sufficient.

6. **Snapshot coordination on the hub side** — Fossic's reconciliation confirms: Cerebra's local store snapshots don't transfer to the hub. A hub consumer that needs to aggregate Cerebra cycle history must replay all relayed events or maintain its own reducer+snapshot on the hub. CerebraSignalTile's needs here should be decided in the federation interview round.

7. **CerebraSignalTile cold-start once relay is live** — Once Cerebra's relay agent begins forwarding events to the hub, the tile's first subscription to `cerebra/agent-trace/*` on the hub will see an empty stream if a session is already in progress — no events arrive until the next cycle fires. A hub-side snapshot seeded at the last `CycleCompleted` event gives the tile immediate initial state without replaying full history. This is the Cerebra-specific instance of the cold-start pattern documented by ai-stack, LumaWeave, and Policy Scout across this round. Adoption point: relay agent design pass.

---

### D.8 — `stream_exists()` API stability risk (source: fossic)

Fossic notes that Cerebra calls `stream_exists()` before `ReadQuery` in `FossicStore.read_events()`, and that `stream_exists()` is not stable-API-flagged in fossic's current roadmap. No changes are planned, but the absence of a stability guarantee means a future fossic refactor could silently break Cerebra's read path without an explicit deprecation notice.

**Tracking note:** On each fossic version bump, check changelog for `stream_exists()` changes. The call site is in `FossicStore.read_events()` — a single location that would need updating if the API changes. No action now; flag for relay agent design pass when fossic-py version is pinned.

---

### D.9 — Round 2 settled log — 2026-06-16

Items confirmed settled through two full cross-read rounds. These do not require further reconciliation unless new evidence surfaces.

| Item | Status | Settled by |
|---|---|---|
| A — Port 7432 correction | **SETTLED** | Compile §5 + Cerebra self-correction; no peer disputes |
| A — Renderer column updates (Lattica-authored) | **SETTLED** | No disputes across two rounds |
| B — CerebraReadAdapter projection error | **CLOSED** | LumaWeave and Cerebra both confirmed: never built, never in progress |
| B — Bo "cerebra infrastructure" framing disputed | **SETTLED** | ai-stack Round 2 explicitly accepts Cerebra Item 3 correction |
| B — Fossic relay protocol confirmations | **SETTLED** | All items in D.2 table adopted; no peer disputes |
| D.1 — Dual VRAM consumers (Cerebra health check + LiteLLM probe) | **SETTLED** | ai-stack originated; Cerebra named; fossic and peers acknowledge |
| D.2 — Relay protocol adoption table (all rows) | **SETTLED** | Fossic Item 1/3, LumaWeave C.5, Policy Scout Item 2-update, ai-stack Round 2 settled log all confirm |
| D.2 — Two-case causation model | **SETTLED** | Fossic formalized; all peers adopted; PS→Cerebra ActionProposed is case 2 |
| D.3 — Double-prefix problem identified | **SETTLED (as problem statement)** | All peers acknowledge the redundancy |
| D.3 — Conditional strip rule (Cerebra's preferred resolution) | **ENDORSED, PENDING RATIFICATION** | LumaWeave C.8, Policy Scout Item 2-update, ai-stack Round 2 all endorse; requires federation interview ratification |
| D.4 — CerebraReadAdapter conflict | **CLOSED** | File-polling model dropped; GraphSnapshotAvailable is the agreed federation path |
| D.4 — LumaWeave consumer requirements for GraphSnapshotAvailable | **SETTLED (as spec input)** | LumaWeave B.1 gives concrete requirements: snapshot reference, lineage_id, trigger-load context |
| D.4 — First cross-project causal chain (GraphSnapshotAvailable → SourceLoaded) | **SETTLED (as design decision)** | Fossic Item 1 confirms case 2 traversability; LumaWeave C.9 tracks as relay agent obligation |
| D.5 — Witness model scope corrected (posture/GPU → hub; cognitive context → reducer) | **SETTLED** | ai-stack Round 2 settled log closes; Policy Scout B-update confirms; fossic Item 2 confirms |
| D.5 — Witness model reducer approach (option a: hub events → Cerebra memory projection) | **SETTLED** | ai-stack Round 2 settled log explicitly marks closed; fossic Item 2 confirms |
| D.5 — Witness model feedback loop (PS + ai-stack relay is prerequisite for cognitive context) | **SETTLED** | Policy Scout B-update names it; fossic Item 2 confirms; ai-stack Round 2 confirms |
| D.6 — indexed_tags adoption as relay prerequisite | **SETTLED (as prerequisite spec)** | Fossic Item 4, ai-stack Item 3, Policy Scout C-update all confirm; fields: {session_id, cycle_id, signal_name} |
| D.7 — Seven open questions for federation interview | **OPEN** | No new decisions surfaced; all seven remain pending federation interview round |
| D.8 — stream_exists() stability tracking | **NOTED** | No peer disputes; tracking obligation stands on each fossic version bump |

**Steady state confirmed — 2026-06-16:** All four peer reconciliation files (ai-stack/Bo, fossic, LumaWeave, Policy Scout) are stable. No new signals emerged in Round 2 read-only pass. Cerebra's reconciliation is complete pending the federation interview round.

---

*End of cross-project update — 2026-06-16 (Round 2 settled)*
