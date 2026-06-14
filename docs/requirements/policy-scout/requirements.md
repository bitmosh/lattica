# Policy Scout — Lattica Requirements

**Project:** policy-scout
**Author:** Policy Scout Claude (acting as policy-scout advocate)
**Date:** 2026-06-13
**Status:** Initial requirements deposit

Policy Scout is a local-first safety harness for agent command execution.
It intercepts package installs, shell commands, and file changes; runs them
through a policy engine; and emits a structured governance audit trail.
What it needs from Lattica is primarily observability and interaction
surface for its governance pipeline — specifically the HITL approval gate,
the request causal chain, and cross-project causation when Cerebra is the
action initiator.

---

## Capabilities policy-scout offers Lattica

Before stating requirements, this is what policy-scout brings as a
visualization source:

**Governance pipeline events.** Every agent command flows through a
structured pipeline with named stages:

```
CommandRequested → CommandClassified → PolicyMatched → DecisionIssued
  → (ApprovalRequested → ApprovalResolved)     ← HITL gate, optional
  → SandboxInstall → SandboxCompleted
  → ExecutionCompleted | ExecutionBlocked
```

Each stage is a typed `AuditEvent` with `request_id` correlation, stored
in `~/.policy_scout/audit.db`. There are ~25 named event types in
`policy_scout/audit/events.py`.

**HITL decision record.** When a policy rule fires and a human decision
is required, `ApprovalRequested` captures the proposed command, the
matched rule, the approval expiry, and the requestor. `ApprovalResolved`
captures the decision (approved/denied), who resolved it, and when. This
is the only place in the platform where human-in-the-loop governance is
recorded.

**Lockdown and watch daemon state.** Policy Scout knows whether the
system lockdown is active (and why), and whether the watch daemon is
running (PID, staleness). These are low-frequency but high-signal status
events for any cross-project view.

**Sweep and supply chain findings.** Sweep runs produce structured
findings (SweepStarted, per-finding SweepFinding events, SweepCompleted
with the transitive dependency tree). These are the richest payloads and
the most useful for security-lens visualization.

**Cross-project causation anchor.** When Cerebra proposes an action,
Policy Scout's gate fires on that proposal. The causal chain
`cerebra/agent-trace/* → policy-scout/audit/*` is the cross-project link
that makes governance tracing possible. Policy Scout is the natural
downstream anchor for those chains.

---

## Requirements

---
id: R-PS-001
category: tile-design
priority: must-have
---

## R-PS-001 — Governance pipeline tile (per-request causal chain view)

**Category:** tile-design
**Priority:** must-have

**Specific need:**
A tile that renders the full lifecycle of a single `request_id` as a
pipeline diagram: each stage name, outcome, timestamp delta, and key
payload fields (command, decision, matched rule, sandbox exit code).
Lattica must be able to either (a) query policy-scout's fossic stream
for `policy-scout/audit/<request_id>` events in causal order, or (b)
query audit.db via a bridge adapter. The tile should be selectable from
a list of recent requests.

**Why it matters:**
Today `audit list --request-id <id>` is the only way to see the full
pipeline for a request. It's a CLI dump. A visual pipeline tile turns
this into the primary debugging and audit surface — both for the
developer and eventually for understanding what an agent did and why
it was allowed or blocked. Without this, Lattica adds no observability
value over the existing CLI.

**Constraints:**
- Events within a `request_id` must be shown in causal order (ascending
  by timestamp), not insertion order
- The tile must gracefully handle incomplete pipelines (e.g., a request
  that reached `PolicyMatched` but was never executed — common for
  blocked or expired approvals)
- Payload rendering for `DecisionIssued` must show the decision value
  prominently (ALLOW / ALLOW_LOGGED / DENY / SANDBOX / HITL) with
  semantic color coding

**Adjacent project awareness:**
Cerebra is the upstream initiator for agent-originated requests. If
Cerebra sets `causation_id` on its action proposal event, the pipeline
tile should optionally show the Cerebra event as the root of the chain
(R-F-003 dependency). Coordination with Cerebra Claude on what causation
ID to set is needed before this is fully implementable.

**Outstanding questions:**
- Is the fossic stream path `policy-scout/audit/<request_id>` or
  `policy-scout/<request_id>/audit`? Need naming convention from Lattica
  Claude before committing stream paths in code.
- When using a bridge adapter over audit.db, how does Lattica express
  the query — via a registered read adapter, or a fossic-native bridge
  that makes the table look like a stream?

---
id: R-PS-002
category: tile-design
priority: must-have
---

## R-PS-002 — HITL approval widget (in-Lattica approval/deny)

**Category:** tile-design
**Priority:** must-have

**Specific need:**
A tile (or tile panel) that shows all pending HITL approvals —
`ApprovalRequested` events not yet resolved — and lets the developer
approve or deny each one directly from the Lattica UI. Each row must
show: the proposed command, the matched policy rule, the requestor
(agent name), and the expiry timestamp. Approve/deny actions must call
back into policy-scout to record the resolution.

**Why it matters:**
The current approval mechanism is Discord-message-based, which is too
slow for interactive repair sessions. Policy Scout's desktop app already
has a prototype Approvals view, but it's scoped to that app only. A
Lattica approval widget surfaces HITL decisions in context — visible
alongside the Cerebra agent trace and the governance pipeline tile that
shows what's pending and why. The HITL gate is the central human
decision point in the platform; it should be a first-class Lattica
surface.

**Constraints:**
- Approve/deny actions require IPC back to policy-scout (not just a
  fossic write — the approval resolution updates audit.db and unblocks
  a waiting CLI process). This is a write-back requirement, not just
  a read.
- Expired approvals must be filtered out client-side (approval records
  keep `status: "pending"` even after expiry; expiry is in `expires_at`
  ISO timestamp on the ApprovalRequested payload)
- Identical commands can generate many pending approvals (N approvals
  for the same `rm -rf node_modules` is a real case from testing);
  the widget must group by command and support "approve all N" / "deny
  all N" bulk actions
- Approval resolution is not idempotent: once approved, re-approving
  is a no-op but should not error

**Adjacent project awareness:**
Cerebra is the primary submitter of HITL requests in agent sessions.
The approval widget's primary user story is "Cerebra proposed something;
can I approve it without leaving Lattica?" This is tightly coupled to
Cerebra's action proposal flow and Phase 8 of the platform plan.

**Outstanding questions:**
- Does the approval write-back go through a Tauri command that shells
  out to `policy-scout approve <id>`, or should policy-scout expose a
  direct IPC endpoint? The former is simpler to implement now; the
  latter is more principled long-term.
- Should Lattica subscribe to `policy-scout/approval/*` events via
  fossic (PostCommit mode) to get live approval updates, or poll the
  approval list? Given policy-scout's current architecture (no fossic
  integration yet), polling is the pragmatic v1 answer.

---
id: R-PS-003
category: tile-design
priority: must-have
---

## R-PS-003 — Lockdown + watch daemon live status tile

**Category:** tile-design
**Priority:** must-have

**Specific need:**
A compact status tile showing two live signals: (1) lockdown state —
active or inactive, and if active, the reason string; (2) watch daemon
state — running (with PID) or not running (with stale-PID-file
distinction). Both should show as colored badges with a refresh trigger
and a timestamp of last check.

**Why it matters:**
These are the two system-wide safety signals. If lockdown is active and
the developer doesn't notice, all commands are blocked without visible
reason. If the watch daemon is stale-PID (crashed without cleanup),
new filesystem changes are not being monitored. A Lattica status tile
surfaces both without requiring the developer to run `policy-scout
lockdown status` and `policy-scout watch status` separately.

**Constraints:**
- Lockdown state comes from `policy-scout lockdown status --json`;
  watch daemon state from `policy-scout watch status --json`
- Both are low-frequency reads (refresh on demand or every 30s)
- No fossic integration needed for v1 — direct Tauri invoke is fine

**Adjacent project awareness:**
If Lattica has a global system health bar or header, lockdown state is
a candidate for a persistent indicator across all tiles (not just this
tile). Worth coordinating with Lattica Claude on whether a cross-tile
status bar exists or is planned.

**Outstanding questions:**
- Should lockdown state be pinned as a persistent global indicator in
  Lattica's chrome (always visible regardless of tile), or scoped to
  the policy-scout tile panel? Given its safety significance, global
  seems right, but that's a Lattica layout question.

---
id: R-PS-004
category: event-subscription
priority: nice-to-have
---

## R-PS-004 — Cross-project causation trace (Cerebra → policy-scout)

**Category:** event-subscription
**Priority:** nice-to-have (depends on R-F-003 and Cerebra's deposit)

**Specific need:**
When R-F-003 (cross-stream causation visualization) is implemented,
policy-scout's governance events must be reachable from Cerebra's
agent-trace events via `walk_causation`. This requires: (a) Cerebra
setting `causation_id` on its action proposal event when submitting to
policy-scout's gate, (b) policy-scout's `CommandRequested` event
referencing that `causation_id` when the request originates from
Cerebra. The Lattica tile would then show the full chain:
`Cerebra:AgentStep → Cerebra:ActionProposed → PS:CommandRequested
→ PS:DecisionIssued → PS:ExecutionCompleted`.

**Why it matters:**
Without cross-project causation, "what did the agent do and did policy
allow it?" requires switching between the Cerebra trace view and the
policy-scout pipeline view manually. With it, the chain is one click
from either end — the central value of R-F-003 applied to the
governance use case.

**Constraints:**
- Requires fossic integration on both policy-scout and Cerebra (the
  bridge adapter approach for policy-scout would need to synthesize
  causation IDs from existing `request_id` correlation data)
- The `causation_id` convention between Cerebra and policy-scout
  needs to be agreed before either project starts emitting fossic
  events — this is a naming/contract decision for Lattica Claude
  to facilitate

**Adjacent project awareness:**
Directly depends on Cerebra's fossic integration. Cannot implement
without Cerebra Claude's agreement on causation ID conventions.
Recommend a joint decision in the first group round.

**Outstanding questions:**
- What is the fossic-level contract for cross-project causation? Does
  Cerebra set `causation_id` to policy-scout's `CommandRequested`
  event ID, or vice versa? Or does correlation happen at the
  `correlation_id` level rather than `causation_id`?

---
id: R-PS-005
category: registry-extension
priority: nice-to-have
---

## R-PS-005 — Payload renderers for governance event types

**Category:** registry-extension
**Priority:** nice-to-have (depends on R-F-006 renderer registry)

**Specific need:**
When Lattica implements a type-aware payload renderer registry (per
R-F-006), policy-scout wants to contribute renderers for its high-value
event types. Minimum set:
- `DecisionIssued`: decision value as colored badge (ALLOW=green,
  DENY=red, SANDBOX=amber, HITL=blue), matched rule name, command
- `ApprovalRequested`: command, policy rule, expiry countdown, requestor
- `SandboxCompleted`: exit code, files changed count, findings summary
- `SweepCompleted`: finding count by severity, highest-severity badge

**Why it matters:**
Without type-aware rendering, governance events show as raw JSON.
Colored decision badges and expiry countdowns are the difference between
glanceable information and raw data. The governance pipeline tile
(R-PS-001) is most useful when each stage renders its key payload
fields at a glance.

**Constraints:**
- Renderers must be registerable without modifying Lattica core
  (per R-F-006's plugin-registration requirement)
- Renderers should respect Lattica's theme tokens (color-danger,
  color-success, color-warning, color-info) for semantic coloring

**Adjacent project awareness:**
The renderer registration mechanism is defined by R-F-006; policy-scout
is a consumer of whatever fossic and Lattica Claude agree on there.

**Outstanding questions:**
- What is the renderer registration format? A TypeScript module export?
  A JSON schema? An entry in LumaWeave's registry? Need Lattica Claude's
  answer before implementing.

---
id: R-PS-006
category: phase-dependency
priority: must-have
---

## R-PS-006 — Fossic bridge adapter (audit.db → fossic stream)

**Category:** phase-dependency
**Priority:** must-have (blocks R-PS-001 and R-PS-004)

**Specific need:**
Policy-scout's existing audit trail lives in `~/.policy_scout/audit.db`
(flat SQLite, ~25 event types, `request_id` correlation). Before Lattica
can subscribe to policy-scout governance events via fossic, there needs
to be a read bridge that makes the existing table visible as a fossic
stream. Preference stated in the fossic profile: bridge adapter first,
migrate later. Lattica must either (a) support a non-fossic data source
via a registered read adapter, or (b) accept that policy-scout's fossic
integration will use a bridge adapter that wraps the existing table.

**Why it matters:**
Without this, R-PS-001 (governance pipeline tile) can only work via
direct Tauri invoke to the CLI — which works but bypasses fossic
entirely and makes cross-project causation (R-PS-004) impossible.
The bridge adapter is the minimum viable integration path that preserves
the existing audit trail without a flag-day migration.

**Constraints:**
- The bridge adapter must preserve `request_id` as the stream
  correlation key (mapping to fossic's stream identity concept)
- `redact_dict()` pass must remain applied to all event payloads
  entering the fossic layer — cannot bypass it
- Migration to direct fossic emission is future work (after bridge
  adapter is validated)
- The existing audit.db schema maps `event_type` + `request_id` +
  `data_json` — these three fields are the minimum the bridge must
  expose

**Adjacent project awareness:**
Fossic Claude has already noted the bridge-first approach in the fossic
profile extract. This requirement formalizes it as a Lattica-side
concern: Lattica must be able to consume bridged streams, not only
native fossic streams.

**Outstanding questions:**
- Does the bridge adapter live in policy-scout's codebase (a fossic
  Store subclass in Python), in fossic's codebase (a generic SQLite
  bridge utility), or in Lattica (a registered source adapter)? This
  is a scope decision for the first group round.
- How does fossic assign content-addressed event IDs to bridged events
  that already have ULid-based `event_id` values? Hash of the original
  ID? Verbatim passthrough? Needs fossic Claude's answer.

---

## What policy-scout does NOT need from Lattica

- **Real-time streaming / PostCommit mode**: polling is fine; write
  volume is very low (see fossic profile extract)
- **Branching visualization**: policy-scout has no branching or
  counterfactual workflow
- **Agent trace adapter**: policy-scout has its own `request_id`
  correlation scheme; OTel export is not on the roadmap
- **Multi-tenant or multi-user surfaces**: this is a single-developer
  local tool

---

## Fossic integration summary (for Lattica + fossic Claude)

Per the fossic profile filed previously (`adjacent-project-info/
policy_scout_extract.md`):

- **Language:** Python 3.12 write path; PyO3 bindings preferred
- **Integration shape:** bridge adapter over audit.db first; direct
  emission later
- **Write rate:** very low, bursty (5–20 events/min active; 0 at idle)
- **Key event types:** CommandRequested, DecisionIssued,
  ApprovalRequested, ApprovalResolved, SandboxCompleted, SweepCompleted
- **Stream naming (proposed):** `policy-scout/audit/<request_id>` for
  per-request streams; `policy-scout/approval/<approval_id>` for
  approval events; `policy-scout/sweep/<sweep_id>` for sweep streams
  — **needs Lattica Claude naming-convention confirmation**
- **Single writer per `request_id` stream**; concurrent at the store
  level (CLI + watch daemon both write to audit.db)

---

*End of policy-scout requirements deposit. Status: open for Lattica
Claude review and round 1 synthesis.*
