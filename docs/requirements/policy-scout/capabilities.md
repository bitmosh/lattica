# Policy Scout — Capabilities for Lattica

**Project:** policy-scout
**Author:** Policy Scout Claude
**Date:** 2026-06-13
**Version at time of writing:** 0.3.6

This document catalogs what policy-scout can expose or perform that is
relevant to Lattica — either as visualization data or as callable
actions. Organized by domain.

---

## 1. Command governance pipeline

Every command processed by policy-scout flows through a typed event
pipeline. Each stage is an `AuditEvent` with a shared `request_id`
correlation key, stored in `~/.policy_scout/audit.db`.

**Pipeline stages (in order):**
```
CommandRequested → CommandParsed → CommandClassified
  → PolicyMatched → DecisionIssued
  → ApprovalRequested? → ApprovalResolved?   (HITL gate, if triggered)
  → SandboxRequested? → SandboxInstallCompleted?  (sandbox path)
  → CommandExecutionStarted → CommandExecutionCompleted | Blocked | Failed
```

**Decision values:** `ALLOW`, `ALLOW_LOGGED`, `REQUIRE_APPROVAL`,
`SANDBOX_FIRST`, `DENY`, `DENY_AND_ALERT`

**Visualization opportunity:** Per-request pipeline diagram — stages as
nodes, decision as the color-coded outcome, timeline deltas between
stages. This is the primary governance artifact policy-scout produces.

**IPC:** `list_audit_events_filtered` (list), `show_audit_event`
(detail), both available as Tauri invoke commands today.

---

## 2. Real-time classification (check)

**Capability:** Submit any command string → receive a structured
classification in under ~100ms.

**Output fields:** `command`, `decision`, `risk_score` (0–10),
`risk_band` (low/medium/high/critical), `category`, `capabilities[]`,
`reasons[]`, `confidence`, `registry_hits[]`, `policy_hits[]`,
`recommended_next_action`, `request_id`

**IPC:** `check_command` (Tauri invoke)

**Visualization opportunity:** Live command classifier widget — type
a command, get an instant colored decision badge + risk score. The
most interactive, low-latency capability policy-scout has.

---

## 3. Policy rule simulation (full trace)

**Capability:** Run every policy rule against a command and return
the full evaluation trace — which rules matched, which was decisive,
why each fired or didn't.

**Output fields per rule:** `rule_id`, `priority`, `matched`,
`decisive`, `decision`, `reasons[]`, `source`

**Summary fields:** `decision`, `risk_score`, `risk_band`,
`matched_rule`, `categories[]`, `capabilities[]`,
`total_rules_checked`, `project_override_loaded`,
`project_override_path`

**IPC:** `run_policy_simulate` (Tauri invoke)

**Visualization opportunity:** Rule trace waterfall — ordered list of
all rules checked, with the decisive rule highlighted and non-matching
rules dimmed. Shows why a command was classified the way it was.

---

## 4. HITL approval gate

**Capability:** List, approve, and deny pending approval requests.
Approvals are one-time, command-scoped, and time-bounded.

**Approval record fields:** `approval_id`, `command`, `cwd`,
`status` (pending/approved/denied/expired), `expires_at`,
`requested_at`, `requester` (agent name), `decision_rule`

**Bulk patterns:** Many approvals for the same command can accumulate
(dedup-by-command is the correct display pattern). Expired entries
keep `status: "pending"` and must be filtered client-side via
`expires_at`.

**IPC:** `list_approvals`, `approve_request`, `deny_request`
(all Tauri invoke)

**Visualization opportunity:** Live approval queue widget with
group-by-command dedup, expiry countdown, and one-click approve/deny.
The central human decision surface in the platform.

---

## 5. Sandbox isolation

**Capability:** Run a package install command in an isolated workspace,
capture all changes (files, lifecycle scripts, manifest diffs), produce
a structured report, and optionally migrate reviewed changes back to
the host project.

**Launch output fields:** `sandbox_id`, `request_id`, `command`,
`exit_code`, `duration_ms`, `files_changed[]`, `lifecycle_scripts[]`,
`manifest_changed`, `lockfile_changed`, `findings[]`,
`credential_exposure_assessment`, `summary`, `migration_available`

**Migration output fields:** `migration_id`, `sandbox_id`,
`files_planned[]`, `files_migrated[]`, `files_skipped[]`,
`backups_created[]`, `blocked`, `block_reasons[]`, `success`

**IPC:** `run_sandbox_install`, `list_sandbox_results`,
`show_sandbox_result`, `run_sandbox_migrate_dry_run`,
`run_sandbox_migrate` (all Tauri invoke)

**Visualization opportunity:** Sandbox result card — lifecycle script
preview, file diff summary, migration dry-run flow with confirm step.

---

## 6. Supply chain sweep

**Capability:** Scan a directory or the current project for suspicious
packages, typosquats, dependency confusion candidates, and injected
scripts. Produces structured findings with severity, confidence,
evidence, and recommended actions.

**Finding fields:** `title`, `category`, `severity`
(critical/high/medium/low/info), `confidence`, `location`,
`evidence`, `why_it_matters`, `recommended_action`

**Sweep summary fields:** `findings[]`, `could_not_verify[]`,
`packages_scanned`, `duration_ms`, `scan_type`

**IPC:** `run_sweep_quick`, `run_sweep_project` (Tauri invoke)

**Visualization opportunity:** Findings list with severity-colored
badges, expandable evidence, and per-finding recommended action.

---

## 7. Audit event stream

**Capability:** The full audit trail — 70+ named event types across
all domains. Queryable by type, time range, request_id, and
pagination.

**Complete event type vocabulary** (from `policy_scout/audit/events.py`):

*Governance pipeline:* CommandRequested, CommandParsed,
CommandClassified, PolicyMatched, DecisionIssued, PolicyError

*HITL approvals:* ApprovalRequested, ApprovalShown,
ApprovalApprovedOnce, ApprovalDeniedOnce, ApprovalExpired,
ApprovalError, ApprovalExecutionStarted, ApprovalExecutionCompleted,
ApprovalExecutionFailed

*Sandbox:* SandboxRequested, SandboxWorkspaceCreated,
SandboxInstallStarted, SandboxInstallCompleted,
LifecycleScriptsInspected, SandboxResultWritten, SandboxError,
SandboxMigrationRequested, SandboxMigrationPlanned,
SandboxMigrationStarted, SandboxMigrationCompleted,
SandboxMigrationBlocked, SandboxMigrationFailed,
GeneralSandboxStarted, GeneralSandboxCompleted,
SandboxBehaviorFinding

*Sweep:* SweepStarted, SweepFindingCreated, SweepCompleted,
SweepError, SecretScanCompleted, SecretFindingCreated

*Execution:* CommandExecutionStarted, CommandExecutionCompleted,
CommandExecutionBlocked, CommandExecutionFailed

*Policy management:* PolicySimulated, PolicyValidated,
PolicyHistoryTested, ProjectOverrideLoaded, ProjectOverrideViolated

*Audit integrity:* ChainVerificationCompleted, IntegrityCheckFailed,
IntegrityCheckPassed, ScoutReportGenerated

*Incident response:* LockdownActivated, LockdownDeactivated,
EvidencePreserved, ClearanceCheckRun

*Watch daemon:* WatchTriggerDetected, WatchDaemonStarted,
WatchDaemonStopped, WatchDaemonHeartbeat

*Threat intel:* IntelLookupCompleted, IntelCacheHit,
IntelLookupFailed

*MCP server:* McpServerStarted, McpToolCallReceived,
McpToolCallCompleted, McpSessionEnded

*Injection detection:* InjectionPatternFound

**IPC:** `list_audit_events_filtered` (type + pagination),
`show_audit_event` (detail)

**Visualization opportunity:** Scrollable audit timeline with
type-filter, type-colored event rows, and drill-down to full
payload detail.

---

## 8. System health signals

**Capability:** Two live status reads that represent system-wide
safety state:

**Lockdown status:** `active` (bool), `reason` (string | null).
When active, all command execution is blocked platform-wide.
Source: `policy-scout lockdown status --json`

**Watch daemon status:** `running` (bool), `pid` (int | null),
`pid_file` (path), `stale` (bool — PID file exists but process
is dead). Source: `policy-scout watch status --json`

**IPC:** `get_lockdown_status`, `get_watch_status` (Tauri invoke)

**Visualization opportunity:** Persistent status badges — lockdown
state is a candidate for global chrome (always visible), watch
daemon for a system tile.

---

## 9. Policy overview and validation

**Capability:** Inspect the loaded policy set (rules count, project
override presence, active rule names) and run a validation pass
that returns error and warning counts with detail messages.

**IPC:** `get_policy_overview`, `run_policy_validate` (Tauri invoke)

**Visualization opportunity:** Policy health summary — rule count,
override active indicator, validation error/warning badges.

---

## 10. Reports

**Capability:** Paginated list of generated Scout reports (post-sweep,
post-sandbox, post-scan) with type filter. Full report detail
includes findings, recommended actions, credential exposure
assessment, host mutation status.

**IPC:** `list_reports_filtered`, `show_report` (Tauri invoke)

---

## 11. Data management

**Capability:** Dry-run and apply cleanup of stored data (audit
events, sandbox workspaces, reports) by target type (demo/all/aged).
Returns planned items, total bytes, and verification status.

**IPC:** `get_cleanup_dry_run`, `run_cleanup_apply` (Tauri invoke)

---

## IPC surface summary

All 27 Tauri invoke commands currently registered:

| Command | Domain | Read/Write |
|---------|---------|------------|
| `check_command` | Governance | read |
| `run_policy_simulate` | Policy | read |
| `get_policy_overview` | Policy | read |
| `run_policy_validate` | Policy | read |
| `list_approvals` | HITL | read |
| `approve_request` | HITL | write |
| `deny_request` | HITL | write |
| `run_sandbox_install` | Sandbox | write |
| `list_sandbox_results` | Sandbox | read |
| `show_sandbox_result` | Sandbox | read |
| `run_sandbox_migrate_dry_run` | Sandbox | read |
| `run_sandbox_migrate` | Sandbox | write |
| `run_sweep_quick` | Sweep | write |
| `run_sweep_project` | Sweep | write |
| `list_reports_filtered` | Reports | read |
| `show_report` | Reports | read |
| `list_audit_events_filtered` | Audit | read |
| `show_audit_event` | Audit | read |
| `get_lockdown_status` | System | read |
| `get_watch_status` | System | read |
| `get_doctor_status` | System | read |
| `get_data_status` | System | read |
| `get_audit_stats` | System | read |
| `get_cleanup_dry_run` | Data | read |
| `run_cleanup_apply` | Data | write |
| `run_eval` | Eval | read |
| `open_terminal` | Shell | write |

All commands accept/return JSON via `CliJsonResponse<T>`:
`{ ok: boolean, exit_code: number, data: T, error: string | null,
stderr_summary: string | null }`

---

## What policy-scout does NOT expose

- No streaming / push events — all reads are on-demand (polling)
- No fossic integration yet — audit.db is the canonical store
- No write API for creating policy rules (policy files are YAML,
  edited externally)
- No multi-project or multi-user isolation (single developer, single
  machine)
