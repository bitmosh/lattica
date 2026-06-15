# Design Request — Policy Scout

> Filed per `docs/coordination/design/REQUEST_TEMPLATE.md`

## Section 1 — Project identity

- **Project name:** policy-scout
- **Filed by:** policy-scout-claude
- **Date:** 2026-06-15
- **Observability/diagnostics balance:** balanced (see §4 for the split)

---

## Section 2 — What this project contributes visually

Streams: `policy-scout/audit/<request_id>` (one per governance check),
`policy-scout/approval/<approval_id>` (one per HITL approval request).

The generalized event-feed tile subscribes to `policy-scout/audit/*` and
`policy-scout/approval/*` (two glob subscriptions, or one tile per stream,
or one tile with two subscriptions — Lattica's call).

### Primary visual events

| Event type | Payload highlights | What it communicates |
|---|---|---|
| `DecisionIssued` | `decision`, `risk_score`, `risk_band`, `command`, `reasons[0]` | The governance verdict — what was decided and why (high signal, always visible) |
| `ApprovalRequested` | `command`, `risk_band`, `expires_at` | Human action required — agent is blocked waiting for approval |
| `ApprovalApprovedOnce` | `approved_by`, `command` | Approval granted; agent may proceed |
| `ApprovalDeniedOnce` | `denied_by`, `command` | Approval denied; agent blocked |
| `ApprovalExpired` | `command`, `expired_at` | Approval window closed without resolution |

### Secondary visual events

| Event type | Payload highlights | What it communicates |
|---|---|---|
| `CommandRequested` | `command`, `actor_type`, `actor_name` | What came in and who sent it; context for the DecisionIssued that follows |
| `CommandExecutionCompleted` | `command`, `exit_code`, `duration_ms` | Command ran; outcome |
| `CommandExecutionBlocked` | `command`, `decision` | Command was stopped at the run gate |

### Ambient health metrics (not individual events — derived from stream)

- **Decisions per minute** — gating activity rate; tells user if the system
  is actively governing
- **Pending approvals count** — if >0, something needs the user's attention
- **Leeway/lockdown state** — global policy posture (locked down / active /
  leeway mode); this comes from `lockdown status` + `watch status` on the
  system side

---

## Section 3 — Visual priority hierarchy

- **Highest priority (must register at-a-glance):**
  - Decision outcome color band for `DecisionIssued`
    (ALLOW=green, ALLOW_LOGGED=teal, REQUIRE_APPROVAL=amber, SANDBOX_FIRST=orange,
    DENY=red, DENY_AND_ALERT=deep red)
  - `ApprovalRequested` escalation — visually distinct, attention-demanding
    (something is waiting for the user; blocked agent)
  - Pending approvals count (badge, always visible when >0)

- **Medium priority (visible without effort):**
  - Risk band for each decision (low / medium / high / critical)
  - Command summary (truncated, enough to identify what was checked)
  - Actor (who submitted: agent name, human, system)
  - Approval resolution (`ApprovalApprovedOnce` / `ApprovalDeniedOnce` with actor)

- **Low priority (deep-read / expand-to-see):**
  - Full `reasons` array (show first item at glance; expand for all)
  - `matched_rule` string
  - `risk_score` integer (band color already communicates the category)
  - `cwd` (context; not needed at glance)
  - Full causation chain per request_id
  - Cross-stream link to Cerebra `ActionProposed`
  - `request_id`, `event_id` (technical identifiers, never at glance)

---

## Section 4 — What a glance should communicate

**Observability surface (live tail — ambient):**

Within ~2 seconds:
- "Policy gate is active — N decisions in the last minute"
- "Last decision: ALLOW / DENY / flagged for approval" with command summary
- "2 approvals pending" — escalated if nonzero; invisible (no badge) if zero
- "Lockdown active" or "Watch running" — global policy posture as a persistent
  indicator (not per-event; derived from health status)

The live tail shows the most recent 5–10 `DecisionIssued` events with
color-coded decision bands. `ApprovalRequested` events are visually escalated
(amber, persistent until resolved). Approval resolutions (`Approved`,
`Denied`, `Expired`) appear inline in the live tail as resolution tags on the
pending approval card.

Streaming rate: 200–500ms for typical active governance; up to 2000ms for
low-frequency context. 50ms cap available for high-frequency scan session
monitoring (during package scan or supply chain sweep).

**Diagnostic surface (archive / on-demand):**

On-demand from the live tail (open per-request chain from a DecisionIssued card):
- Full governance pipeline for a single `request_id`: CommandRequested →
  CommandParsed → CommandClassified → PolicyMatched → DecisionIssued → (optional)
  ApprovalRequested → ApprovalApprovedOnce | DeniedOnce | Expired
- Full `reasons` array
- Risk score details
- Cross-stream causation link to Cerebra `ActionProposed` (when present; opens
  the Cerebra session context for the agent that triggered this governance check)

---

## Section 5 — What doesn't matter at-a-glance

- `request_id`, `decision_id`, `approval_id` — ULIDs; never surface to users
- `event_id` (Blake3 hash) — never surface to users
- `matched_rule` string — technical policy rule name; show in diagnostic only
- `risk_score` as a number — the band color already encodes it; integer is
  redundant at glance
- `cwd` (working directory) — context for diagnostics, not live tail
- Full `reasons` array — show `reasons[0]` at glance; expand for the rest
- `schema_version` — internal versioning field; suppress everywhere
- `actor_type` when it's `"agent"` and `actor_name` is already shown — redundant

---

## Section 6 — Cross-project visual relationships

**Cerebra causation link:**
When `CommandRequested.upstream_causation_id` is present, the governance check
was triggered by a Cerebra agent action. The `DecisionIssued` card for that
check should show a "↑ Cerebra" indicator linking to the originating Cerebra
session (opens the Cerebra event feed filtered to that session_id, if the
generalized tile supports cross-stream navigation).

Escalation implication: `ApprovalRequested` events that have a Cerebra
upstream link are particularly high-value to escalate visually — a blocked
agent is waiting, not just a human CLI user.

**No other cross-project relationships at current scope.**

---

## Section 7 — Current implementation (reference only)

- No renderer files exist in Lattica yet (pending `payloadRendererRegistry`
  availability for registration)
- Planned location: `src/renderers/policy-scout/` in Lattica's tree (P-013)
- Policy Scout's desktop app (`ui/desktop/`) has its own audit views
  (`AuditEventsListCard`, `AuditVerifyChainCard`, `DecisionCheckCard`) but
  these are Tauri/React components in the policy-scout repo — not in Lattica
- Event data shape in fossic: `policy-scout/audit/<request_id>` streams with
  `DecisionIssued`, `CommandRequested`, etc. as described in
  `~/Projects/fossic/docs/implement/POLICY_SCOUT_EVENT_VOCABULARY.md`

Frontend-design is free to diverge from the policy-scout desktop app's
existing visual treatments. The desktop app is reference, not constraint.

---

## Section 8 — Constraints

**Hard constraints:**

- `PayloadRendererProps` shape: `{ payload: unknown, event_id: string }` per
  ADR-017
- `--portfolio-*` token namespace for cross-project colors/surfaces
- Decision outcome colors should be semantically distinct and accessible
  (ALLOW vs DENY vs amber REQUIRE_APPROVAL vs orange SANDBOX_FIRST). These
  are safety-relevant states — colorblind-accessible differentiation matters.
- Monospace preferred for `command` text (it's a shell command, not prose)

**Non-blocking operational item:**

Policy Scout's fossic store is at `~/.local/share/policy-scout/fossic.db` by
default (configurable via `POLICY_SCOUT_FOSSIC_DB_PATH`). For events to flow
into Lattica's shared platform store, Policy Scout needs to be configured to
write there instead. Same operational-flag pattern as LumaWeave's §8 note.

---

## Section 9 — Open questions for frontend-design

**Q1 — Live tail event density for multi-agent governance**

In a session where a Cerebra agent is actively running (proposing one action
every 5–10 seconds), `DecisionIssued` events arrive at ~6–12 per minute.
The live tail needs to handle this rate without overwhelming. Options:

- **A: Deduplicate by recency** — show only the most recent DecisionIssued
  per actor in the live tail; older ones roll off. Count badge shows total.
- **B: Grouping by actor** — if the same actor is producing repeated ALLOW
  decisions (expected flow), collapse into a summary card ("Cerebra: 12 × ALLOW
  in last 60s") until something non-ALLOW appears
- **C: Rate indicator + sparse events** — live tail shows only non-routine
  events (DENY, REQUIRE_APPROVAL, DENY_AND_ALERT); a rate counter shows routine
  decisions numerically. This aligns with observability-first: the baseline
  is "everything is fine" communicated as a number, not a scroll of green cards.

Policy Scout has no preference; this is a UX question about information density.
Option C feels most consistent with observability-first positioning (ambient
health indicator, escalation only on anomaly).

**Q2 — Approval pending — persistent or event-in-feed?**

`ApprovalRequested` is different from all other events: it requires user action
and may stay unresolved for seconds to minutes. Options:

- **A: Persistent approval panel** — a fixed section above the event feed
  showing all unresolved approvals with approve/deny affordance inline
- **B: Escalated event card in feed** — `ApprovalRequested` renders as a
  full-width card in the feed with approve/deny buttons; resolved by inline
  interaction; resolved state transitions it to a dimmed resolved card

Option A (persistent panel) is probably better for governance UX — pending
approvals should never scroll out of view.

**Q3 — Lockdown/leeway state: where does it live?**

Global policy posture (lockdown active / watch running / leeway mode) is
system health, not per-event data. Options:

- **A: Status bar indicator** — a persistent status pill in the tile's chrome
  (always visible, no scroll)
- **B: Pinned card at top of feed** — a "system health" card that always
  appears at the top of the policy-scout event feed, showing current
  lockdown/watch state

Either works; A feels more lightweight and less noisy.
