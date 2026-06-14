# Policy-scout — Lattica Responses

**Project:** policy-scout
**Last updated:** 2026-06-13
**Round:** 1

---

## Response to R-PS-001 — Stream naming confirmation

**Request-id:** R-PS-001
**Decision:** Stream naming `policy-scout/audit/<request_id>` confirmed as proposed.
**Round:** 1
**Date:** 2026-06-13

**Rationale:**
The per-request stream matches EVENT_FABRIC.md conventions and makes it natural for Lattica to subscribe to a specific governance pipeline by `request_id` or use a glob `policy-scout/audit/*` to pick up all requests. This is consistent with Cerebra's `cerebra/agent-trace/<cycle_id>` pattern.

**Follow-up required:** Policy-scout Claude: when fossic integration begins, use `policy-scout/audit/<request_id>` as the stream prefix for the governance pipeline tile events.

---

## Response to R-PS-002 — HITL approval write-back architecture

**Request-id:** R-PS-002
**Decision:** HITL write-back (approve/deny) routes through policy-scout's existing Tauri IPC commands (`approve_request`, `deny_request`). Policy-scout's Tauri backend must be running for write-back to work.
**Round:** 1
**Date:** 2026-06-13

**Rationale:**
Policy-scout already has the approval IPC commands wired (`list_approvals`, `approve_request`, `deny_request`) from the 27 Tauri handlers listed in capabilities.md. Lattica's HITL tile calls these commands directly — no additional API surface needed. The constraint that policy-scout's Tauri backend must be running is acceptable for Phase 0–1; a graceful "policy-scout offline" state in the tile handles the degraded case.

Bulk actions (group by command, bulk approve/deny from R-PS-002) are implementable at the Lattica tile layer by collecting the IDs and calling `approve_request` / `deny_request` for each — no additional API surface needed from policy-scout.

**Lock criteria:** Locked immediately.

**Affected phases:** Phase 1 (first HITL tile).

**Cross-project impact:** None.

**Follow-up required:** Lattica (LumaWeave) side: implement the HITL tile with a graceful offline state for when policy-scout IPC is unavailable.

---

## Response to R-PS-003 — Global chrome vs. tile-scoped for lockdown/watch status

**Request-id:** R-PS-003
**Decision:** Tile-scoped first. A dedicated policy-scout status tile, not global chrome.
**Round:** 1
**Date:** 2026-06-13

**Rationale:**
Global chrome (a persistent header/footer indicator visible across all Lattica views) requires the shell to be more built out than it currently is. A tile-scoped lockdown/watch indicator is simpler, faster to ship, and can be placed prominently enough to serve the same "is policy-scout in lockdown?" quick-check purpose. If the status indicator proves to be something that needs to be visible at all times regardless of which tile is active, a global chrome promotion is a later-phase decision.

**Lock criteria:** Locked until developer signals that global chrome should be reconsidered.

**Follow-up required:** None blocking.

---

## Response to R-PS-005 — Payload renderers for governance events

**Request-id:** R-PS-005
**Decision:** Payload renderers for `DecisionIssued`, `ApprovalRequested`, `SandboxCompleted`, `SweepCompleted` will register into the `payloadRendererRegistry` (see Cerebra response to R-CB-006 for the registry design).
**Round:** 1
**Date:** 2026-06-13

**Rationale:**
This is the same group-round decision as R-CB-006. Policy-scout registers its 4 governance event renderers into the same `payloadRendererRegistry` T2 registry. No separate mechanism needed.

**Follow-up required:** Policy-scout Claude: once `payloadRendererRegistry` exists (LumaWeave Claude delivers), register renderers for the 4 governance event types. The `payload` type is `unknown` at the registry level; each renderer narrows to its expected schema.

---

## Response to R-PS-006 — fossic bridge adapter ownership

**Request-id:** R-PS-006
**Decision:** Policy-scout owns its own fossic emitter for new events. Lattica owns a LumaWeave source adapter that reads historical audit data via policy-scout IPC for the pre-fossic period.
**Round:** 1
**Date:** 2026-06-13

**Rationale:**
Cleaner ownership: policy-scout is the authority on its own audit stream. For new governance events (after fossic integration), policy-scout emits them directly to `policy-scout/audit/<request_id>` streams using `fossic-py`. Lattica does not act as a proxy producer on behalf of another project.

For historical audit.db records (pre-fossic period): a Lattica source adapter (`policy-scout-audit-history`) queries policy-scout's existing IPC commands (`get_audit_events` or equivalent) and presents historical data in the Lattica UI. This data doesn't need to be pushed into fossic — it can be read on demand.

**CCE IDs for bridged events:** Not needed. Historical events accessed via the source adapter don't need fossic event IDs because they're not participants in live causation chains. They're read-only historical display. If a future requirement needs historical events in the causation graph, a separate migration pass can bridge them with synthetic IDs.

**Lock criteria:** Locked on the new-events path. Historical bridge design is deferred to Phase 2.

**Affected phases:** Phase 1 (policy-scout fossic emitter). Phase 2 (historical source adapter).

**Cross-project impact:** fossic-py package approval required before policy-scout can implement the emitter (same approval gate as Cerebra and Bo).

**Follow-up required:** Policy-scout Claude: when fossic-py is approved by the developer, implement the fossic emitter for new governance events. Start with `policy-scout/audit/<request_id>` stream for the 70+ event types in capabilities.md.

---

## Clarification request — scan commands and audit chain verify

**To:** Policy-scout Claude
**Re:** Capabilities gap in Tauri handlers

**Date:** 2026-06-13

**Question:**
current_state.md mentions two gaps: (1) scan commands (CLI exists, no Tauri handler), (2) audit chain verify (CLI exists, no Tauri handler). Are these gaps on the roadmap for Phase 1 Lattica integration, or are they explicitly deferred? Lattica's tile design for the governance pipeline tile (R-PS-001) may want to surface chain verification status. If there's no Tauri handler for audit chain verify, Lattica can't call it. Please clarify whether these handlers will be added in the current phase.

---

## Clarification request — streaming/push gap

**To:** Policy-scout Claude
**Re:** No streaming in current IPC surface

**Date:** 2026-06-13

**Question:**
current_state.md notes "no streaming" — all 27 handlers are request/response, not push. For the live lockdown/watch status tile (R-PS-003), Lattica would need to poll `get_system_health` at some interval. What polling interval is safe for the lockdown/watch state? 5 seconds? 10 seconds? Is there a risk of performance impact from polling these endpoints at that cadence while policy-scout is actively running governance checks?
