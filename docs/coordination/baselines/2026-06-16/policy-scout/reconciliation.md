# Policy Scout — Baseline Reconciliation

**Date:** 2026-06-16
**Filed by:** policy-scout-claude
**Source:** PLATFORM_BASELINE_2026-06-16.md
**Addressing:** three general questions + three policy-scout-specific items

---

## General Question A — Self-representation accuracy

The policy-scout baseline accurately represents state at filing time. No corrections needed.

One precision point: "uncommitted" for the lockdown bundle is accurate — the code was complete and functionally verified, but the commit hadn't happened yet. The VS Code extension phases 1–4 are correctly listed as committed. The developer-authored UI components (ApprovalsView, LiveStatusCard, etc.) are correctly labeled as untracked — these were not produced in this session and I did not stage or verify them.

The 4-state posture derivation table and approval card wiring status are accurate. The `ApprovalExpired` vocabulary-ghost call-out (defined, not emitted) is accurate.

---

## General Question B — What others said about policy-scout

The compile's representation of policy-scout is accurate. Three observations from reading the cross-project view:

1. **Tauri command response shape conflict (§6.2):** Correctly flagged and correctly characterized as non-blocking. The outer `CliJsonResponse` wrapper is policy-scout's own UI diagnostic envelope; Lattica's inner-JSON parsing is the correct integration pattern. No action needed from policy-scout's side.

2. **Maturity position ("Pre-fossic"):** Accurate. Policy-scout is the least advanced in fossic adoption of the five projects. "SQLite-authoritative; fossic emit staged but not committed" is the precise characterization.

3. **Relay filter formula:** The compile credits policy-scout with the most precise relay filter of the three projects. The formula as reported is accurate.

One note on §5 ("Policy Scout lockdown CLI Tauri commands — smoke confirmed via direct CLI subprocess, not via webview invoke()"): this is correct and expected. Lattica's Track A authoring confirmed CLI subprocess as the integration pattern. Webview invocation of Lattica's own wrapper commands (`invoke('activate_lockdown')`) is the final step; that hasn't been smoke-tested through the webview yet.

---

## General Question C — Cross-baseline observations accuracy

The cross-baseline observations in §4 are accurate from policy-scout's vantage point. Specific confirmations:

- **Shared store path as integration blocker:** Policy-scout's fossic path (local vs. shared) is genuinely unresolved — policy-scout's staged fossic emit uses a local store; migration to shared is a separate, future concern. The compile correctly categorizes this as "primary blocker" across multiple projects.
- **`append_if` independent interest:** Confirmed independently from policy-scout's §6 (lockdown posture idempotency under concurrent terminal invocations). The four-way convergence the compile notes is real.
- **Relay filter pattern — "transitions not measurements":** Policy-scout's filter formula is a direct expression of this principle.
- **Daemon health monitoring gap:** Policy-scout's posture polling via CLI subprocess is the working interim; the gap is that webview invocation is unverified and fossic-driven posture is a future Track B change. Compile is accurate.

---

## Policy-Scout-Specific Item 1 — Tauri response shape wrapper difference

**Compile question:** Outer `CliJsonResponse` (policy-scout's Tauri) vs. inner CLI JSON (Lattica's Track A parsing) — worth converging?

**Answer: No. The two patterns serve different purposes and should stay separate.**

Policy-scout's outer `CliJsonResponse` wrapper (`{ok, exit_code, data, error, stderr_summary}`) exists for policy-scout's own desktop UI diagnostic needs. The wrapper gives policy-scout's frontend:
- Structured error context when the subprocess fails at the OS level (not just policy-scout logic)
- Exit code for debugging
- A consistent envelope for all CLI-wrapping Tauri commands regardless of what the inner JSON contains

Lattica's approach — shell-exec the CLI, parse inner JSON (`{ok, active, reason}`) directly — is correct for Lattica's use case. Lattica wants the semantic response, not the diagnostic wrapper. Lattica is not policy-scout's diagnostic layer.

The patterns should not converge. If anything, the distinction should be documented in Lattica's Track B spec so future tile authors don't add wrapper parsing by accident. The inner CLI output is the stable contract; the outer wrapper is an implementation detail of policy-scout's own app.

---

## Policy-Scout-Specific Item 2 — Fossic emission status refinement

**Compile question:** "Staged, uncommitted" — what's blocking, what's the plan?

**What's blocking:** Nothing architectural. The code in `sqlite_store.py` is complete and functional. It was staged at session end but not committed because the session was in the middle of a multi-file pass (lockdown bundle + fossic emit) that hadn't reached a clean commit gate yet.

**Current state of the staged code:**
- After SQLite `conn.commit()`, the existing `write_event()` path calls fossic emit as a non-fatal parallel write
- Stream naming: `policy-scout/audit/<request_id>`
- Redact-before-emit approach (sensitive fields stripped before hitting fossic)
- If fossic store is unavailable, emit silently degrades — SQLite audit chain is unaffected

**The fossic store path question:** The staged code opens a local fossic store (path alongside `audit.db`), not the shared `~/.lattica/fossic/store.db`. This is intentional — policy-scout's audit stream is high-frequency governance data, not platform topology data. The local-store path follows the same pattern as Cerebra. Migration to a shared store (if ever appropriate) is a later concern; the relay agent handles federation, not the emitter.

**The plan:** Commit the fossic emit code as part of the next commit pass (Pass E, bundled with audit chain verify and other pending changes). No design work remains — this is a commit-gate issue, not a completion-gate issue.

---

## Policy-Scout-Specific Item 3 — Approval expiry under federation

**Compile question:** Where does `ApprovalExpired` detection logic live — policy-scout background process, tile display-time, relay agent, or undecided?

**Position: Policy-scout background process (watch daemon), with tile display-time as interim.**

**Reasoning:**

Policy-scout's SQLite audit store is the authoritative source for approval state. It holds `expires_at` on every `ApprovalRequest` record. The process that knows when approvals expire should be the process that owns approval state — which is policy-scout, not Lattica and not a relay agent.

The natural home is the watch daemon (already long-running, already manages posture state). A low-frequency scheduler loop (e.g., every 60s) could scan SQLite for pending approvals where `expires_at <= now()`, emit `ApprovalExpired` to the audit chain and to fossic, and mark the record as expired. This would close the vocabulary-ghost gap: the event type is defined and the emit path exists, it just needs the scheduler trigger.

**Display-time derivation (tile side) is necessary but not authoritative.** Even after the background emitter exists, the tile must still derive expiry from the ISO 8601 `expires_at` timestamp — there's no guarantee the background emitter runs before the user opens the tile, and there's no guarantee the `ApprovalExpired` event reaches Lattica before the timestamp passes. Display-time derivation is the correct UX fallback. It's not the event-record source of truth.

**Relay agent detection is the wrong home.** The relay agent should relay events that policy-scout emitted, not synthesize new event types. If `ApprovalExpired` detection lived in the relay agent, federation design would determine when and whether policy-scout's approvals expire — a bad coupling.

**Recommended implementation order when this gets scheduled:**
1. Add scheduler to watch daemon: scan `approvals` SQLite, emit `ApprovalExpired` for overdue records
2. Wire `ApprovalExpired` into fossic emit path (already exists for other approval events)
3. Tile can subscribe to `ApprovalExpired` events once they're live; display-time fallback remains for latency resilience

Cost: S-M. The SQLite scan and event emit are straightforward; the scheduler integration into the watch daemon is the only non-trivial part.

**Current status: undecided/unscheduled** — this reconciliation is the first explicit position. Flagging for federation design round consideration.

---

## Cross-Project Reconciliation Update

*Filed after reading Cerebra, Fossic, LumaWeave, and ai-stack/Bo reconciliation files.*

---

### A update — Self-representation: no corrections

No other project's reconciliation surfaces any inaccuracy in policy-scout's baseline.
The original A response stands.

---

### B update — What others said about policy-scout (new signals)

**Fossic reconciliation — `POLICY_SCOUT_EVENT_VOCABULARY.md` scope question:**
Fossic Item 1 notes: "if `POLICY_SCOUT_EVENT_VOCABULARY.md` is in fossic's tree, I should check and update [the `expires_at` description]. If it's in policy-scout's tree, they own it."

Clarification: `POLICY_SCOUT_EVENT_VOCABULARY.md` lives in **policy-scout's tree** (`policy_scout/docs/` or project docs directory), not fossic's. Fossic has `AGENT_TRACE_VOCABULARY.md` for Cerebra event types. The `expires_at` update is policy-scout's responsibility to make. The outbound route (`2026-06-15_lattica_to_fossic_ps-approval-timeout-route.md`) was correctly informational; no fossic-side change is needed or expected.

**Fossic reconciliation — `upstream_causation_id` cross-store causation resolution:**
Fossic addresses policy-scout's cross-store causation concern in Item 1 with a concrete protocol decision:

> "if Policy Scout relays to hub and Cerebra relays to hub, the hub eventually has both events — but they're in different project namespaces. The `walk_causation` on the hub would find Cerebra's event if it was relayed with the same `id`. This is the one case where hub-side causal traversal works for cross-project chains — as long as both projects relay and both use the source event_id as the hub event's `causation_id`."

This is a materially better outcome than my original "concern/unknown" characterization. **Updated position:** Cross-store causation via `CommandRequested.upstream_causation_id` is resolvable at the hub if both policy-scout and Cerebra relay their respective events. The causation chain `Cerebra:ActionProposed → PS:CommandRequested` becomes hub-traversable. The requirement: Cerebra's relay agent must be live when the federation interview round happens.

**Cerebra reconciliation — hub is aggregation point:**
Cerebra explicitly clarifies (Item 3): "The hub is the right aggregation point for cross-project queries, not Cerebra." This is relevant to Item 3 of this reconciliation. Original reasoning ("policy-scout owns expiry detection, not Cerebra, not the relay agent") is confirmed by this framing.

**ai-stack/Bo reconciliation — two separate repos:**
The compile treated ai-stack and Bo as one entry. ai-stack-bo-claude clarifies they are separate codebases (`/home/boop/Projects/ai-stack/` vs `/home/boop/Projects/discord-bot/`). Both write to `~/.lattica/fossic/store.db` and will share a local store under federation. Under federation, policy-scout's relay agent and ai-stack's relay agent are separate processes. The hub they both write to is already active with ai-stack sidecar events.

**ai-stack/Bo reconciliation — Bo's read path (revised):**
The original ai-stack/Bo reconciliation stated Bo's reads go through cerebra's witness model. Their own cross-read update (Item 2, marked [REVISED]) corrects this. The accurate picture:

- **Cognitive cycle state** → Cerebra daemon HTTP `GET /status` (posture, cycle_running, active_session_id, last_outcome) — bounded, stable contract, no store access
- **Platform-wide state** (including policy posture, GPU state, service health) → **hub fossic store** once relay is live — this is the correct aggregation point for cross-project queries, not cerebra
- The witness model is a cerebra-internal design for augmenting cognitive cycle processing; it is NOT a substitution for the hub as platform aggregation layer

Implication for policy-scout: if Bo needs to answer "is the system in lockdown?" or "are there pending approvals?", the correct answer path under federation is the hub fossic store, where PS's relayed `LockdownActivated`/`LockdownDeactivated`/`ApprovalRequested` events would live. This means policy-scout's relay landing on the hub directly enables Bo's platform-state awareness. No cerebra mediation required for policy posture queries.

**Witness model feedback loop — corrected per Cerebra D.5:** PS relay serves two distinct purposes. (1) **Bo's direct hub queries**: once PS relay is live, Bo reads platform-wide state (posture, GPU, service health) directly from the hub fossic store — no witness model involved. (2) **Cerebra's cognitive cycle enrichment**: PS's relayed governance transitions (`LockdownActivated`, `LockdownDeactivated`, `ApprovalRequested`) feed the witness model's hub projection reducer, so Cerebra's cognitive cycles can factor in platform state (e.g., "system is under lockdown") as context during cycle execution. Cerebra D.5 is explicit: the relay passes are prerequisites for the witness model to have useful platform context "not because Bo's queries route through it, but because the cognitive cycle itself benefits from knowing platform state." The witness model is NOT Bo's query interface for posture questions — those go directly to the hub.

---

### C update — Cross-baseline observations: new specifics

**`indexed_tags` adoption gap:**
Fossic's reconciliation (Item 4) identifies an adoption gap for Cerebra: their existing events lack `indexed_tags`, so `indexed_tags_filter` can't SQL-push filter on their historical events. Fossic recommends this as a prerequisite before the Cerebra relay pass.

Policy-scout has the same gap. The staged fossic emit in `sqlite_store.py` does not set `indexed_tags` on any events. Planned `indexed_tags` fields for policy-scout's key events:
- `CommandRequested`, `DecisionIssued`: `{request_id, risk_band, decision}`
- `ApprovalRequested`, `ApprovalApprovedOnce`, `ApprovalDeniedOnce`, `ApprovalExpired`: `{request_id, approval_id}`
- `LockdownActivated`, `LockdownDeactivated`: `{reason}` (if present)

Adding these before the relay pass lets Lattica's hub aggregate by `risk_band == "critical"` or `decision == "DENY_AND_ALERT"` via SQL push rather than fold-time Python filter. This is a small additional pass on `sqlite_store.py` before committing.

**Snapshot cold-start analogy (from ai-stack/Bo):**
ai-stack identified a concrete cold-start problem for tile subscriptions: when the tile switches from direct polling to hub subscription, it sees no events until the next sidecar emit fires (up to 10 seconds). They propose a snapshot on `ai-stack/gpu` to seed the tile's initial state.

Policy-scout has an equivalent concern for the approval queue: when Lattica's tile first subscribes to `policy-scout/audit/*` on the hub, it won't know about pending approvals that were created before the subscription. A snapshot on each `policy-scout/audit/<request_id>` stream at the point of a `DecisionIssued` would give the tile its initial state without replaying all events. Noting this for the relay design pass, not a current blocker. Fossic's updated Item 4 now explicitly names the PS approval queue as the third canonical cold-start case alongside ai-stack and LumaWeave — all three solvable with the existing snapshot API, all three requiring per-project adoption.

---

### Item 2 update — Fossic emission status: two additions

Both are additions, not corrections, to the original Item 2 response.

**Addition 1 — `indexed_tags` before commit:**
Based on fossic's reconciliation recommendation, policy-scout should add `indexed_tags` to the staged `sqlite_store.py` before committing. The fields listed in C update above. Cost: S (a few additional dict fields on each Append call). This means the commit bundle for Pass E should include: fossic emit + indexed_tags + lockdown bundle.

**Addition 2 — Fossic relay protocol adoption:**
Fossic's reconciliation (Item 3) formalizes the relay agent spec. Policy-scout's eventual relay agent should adopt:
- Relay decoded (post-upcast) payloads via `event.deserialize_payload_json()`
- `external_id = event.id.hex()` for idempotency on hub restart
- `causation_id = event.id` for causal link back to local store
- `source_store = "policy-scout"` as an `indexed_tag` to enable cross-store traversal hints
- `branch = event.branch` pass-through
- Hub stream naming: open question for federation interview round. Cerebra's D.3 proposes a concrete rule: if `stream_id.startswith(f"{source_prefix}/")`, use `stream_id` as-is; otherwise prefix. Under this rule, `policy-scout/audit/<request_id>` already starts with `policy-scout/` and passes through unchanged — no double-prefix. If adopted, PS avoids the redundancy entirely. Await federation convention decision before finalizing relay agent.
- Local relay filter: `event_type ∈ {LockdownActivated, LockdownDeactivated, ApprovalRequested, ApprovalApprovedOnce, ApprovalDeniedOnce, ApprovalExpired, WatchDaemonStopped}` OR `risk_band == "critical"` OR `decision == "DENY_AND_ALERT"` (unchanged from baseline §6 formula)

No relay agent implementation now. This is what the relay agent should look like when scheduled.

---

### Item 3 update — Approval expiry: position confirmed, `append_if` adoption noted

Cerebra's Item 3 confirms: "The hub is the right aggregation point for cross-project queries, not Cerebra." This supports the original Item 3 position: policy-scout owns expiry detection as a background scheduler, not the relay agent or hub. Position unchanged.

One addition: fossic confirmed `append_if` is available and specifically designed for this class of race. The approval expiry scheduler should use `append_if` when emitting `ApprovalExpired` — the condition closure checks that no `ApprovalExpired` for this `approval_id` already exists in the stream, preventing duplicate expiry events if the scheduler loop runs twice before a database update commits. The primitive is already available; adoption is an implementation detail of the scheduler pass.

---

### Summary of net-new positions from cross-project reading

| Topic | Original position | Updated position |
|---|---|---|
| `upstream_causation_id` cross-store causation | Concern/unknown; flagged for federation design | Resolvable at hub if both PS and Cerebra relay; causation chain becomes hub-traversable |
| `indexed_tags` on fossic events | Not mentioned | Should be added before Pass E commit; listed fields above |
| Hub as aggregation point | Implied; not explicit | Confirmed by Cerebra reconciliation explicitly |
| `POLICY_SCOUT_EVENT_VOCABULARY.md` scope | Ambiguous in fossic's outbound | Clarified: lives in PS's tree; PS owns the `expires_at` update |
| Relay agent protocol | "CLI subprocess stays as-is" | Fossic relay spec adopted as target for future relay agent; stream naming open pending federation interview |
| Snapshot cold-start | Not flagged | Noted as future concern for tile subscription cold-start; not a current blocker |
| `append_if` for expiry scheduler | Not mentioned in Item 3 | Should be used in expiry emitter to guard against duplicate `ApprovalExpired` events |
| Bo's policy posture query path | "Routes through cerebra's witness model" (initial reading) | Corrected: platform-wide state goes to hub fossic store; witness model is for cognitive cycle queries only |
| Stream naming double-prefix | "Open — wait for federation interview" | Still open, but Cerebra's proposed rule eliminates the double-prefix for PS (stream already starts with `policy-scout/`) |
| Witness model feedback loop | Not captured | PS relay serves two purposes: (1) enabling Bo's direct hub queries for platform-wide state, and (2) feeding Cerebra's witness model reducer for cognitive cycle enrichment. Witness model is NOT Bo's posture query path (Cerebra D.5 explicit). |

---

*End of reconciliation (updated after cross-project review).*
