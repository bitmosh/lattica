# Policy Scout — Current State

**Project:** policy-scout
**Maintainer:** Policy Scout Claude (living doc — update on each
significant state change)
**Last updated:** 2026-06-13
**Version:** 0.3.6

This is a living document for Lattica Claude to track policy-scout's
current development state, integration readiness, and open items.
Update this file whenever meaningful progress or blockers change the
picture.

---

## What is built and stable

### Python CLI (mature)
The Python backend is the most complete layer. All core subsystems
are implemented and tested:

- **Policy engine** — YAML rule loading, command classification,
  risk scoring, `ALLOW`/`ALLOW_LOGGED`/`REQUIRE_APPROVAL`/
  `SANDBOX_FIRST`/`DENY`/`DENY_AND_ALERT` decisions
- **Policy simulator** — full rule trace, showing which rules
  matched, which was decisive, and why (`policy simulate <cmd>`)
- **HITL approval gate** — request, list, approve, deny, expiry
  management
- **Sandbox isolation** — npm/pnpm/yarn/bun aware; package manager
  detection; transitive dependency analysis; lifecycle script
  capture; result JSON output
- **Sandbox migration** — dry-run plan → confirm → apply;
  host project detection; backup creation
- **Supply chain sweep** — JS/Python AST analysis, typosquat
  detection, dep confusion heuristics, transitive tree scanning
- **Audit trail** — 70+ named event types, SQLite-backed,
  `request_id` correlated, ULID event IDs, `redact_dict()` PII
  scrub at write time
- **Watch daemon** — inotify-based filesystem monitor for
  project directories
- **Lockdown** — system-wide execution block with reason string
- **Data cleanup** — retention-aware deletion path with `--apply`
  flag and confirmation
- **Audit chain verification** — tamper-evident chain check
  (CLI command exists; Tauri handler not yet wired)
- **Scan commands** — `scan dir`, `scan staged`, `scan history`,
  `scan injection` (CLI commands exist; Tauri handlers not yet
  wired)
- **MCP server** — tool call gateway for agent integration (exists;
  not surfaced in desktop UI)

### Tauri desktop app (actively being built — v0.3.x)
The desktop app is a Tauri 2 + React 19 + TypeScript shell that
invokes the Python CLI as subprocesses and renders results. As of
2026-06-13, 27 Tauri invoke handlers are wired and the following
views are functional:

| View | Status |
|------|--------|
| Overview | Complete — doctor, data status, recent audit review rows, quick sweep |
| Check | Complete — `check_command` + tabs: Check / Simulate |
| Reports | Complete — paginated list, detail card |
| Audit | Complete — type-filtered list, detail card, pagination |
| Approvals | Complete — group-by-command, expiry filter, bulk approve/deny |
| Sweeps | Complete — quick sweep + project sweep |
| Sandbox | Complete — launch card, results list, detail card, migration flow |
| System | Complete — lockdown status, watch daemon status, doctor, data, eval, cleanup |
| Policy | Complete — overview, validate, simulate |

**Pending UI passes (not yet in app):**
- **Pass D** — Scan view: new nav entry with 4 action cards
  (`scan dir`, `scan staged`, `scan history`, `scan injection`)
  — needs 4 Rust handlers
- **Pass E** — Audit chain verify button in Audit view +
  `run <cmd>` execute-through-policy-gate (safety-scoped to
  ALLOW/ALLOW_LOGGED only)

---

## Architecture

```
[Python CLI]  ←─── subprocess ───  [Tauri Rust shell]  ←─── IPC ───  [React UI]
     │                                      │
  audit.db                          27 invoke handlers
  (SQLite)                          (each shells to CLI --json)
```

- CLI speaks JSON via `CliJsonResponse<T>` envelope on stdout
- Rust handlers parse stdout, return structured data to React
- React renders with mock fallback when Tauri is not available
  (browser dev mode)
- No streaming — all data is request/response polling

---

## Data layer

**Primary store:** `~/.policy_scout/audit.db` — SQLite, single
writer per `request_id` stream, concurrent at the store level
(CLI + watch daemon both write)

**Secondary stores:**
- `~/.policy_scout/sandbox/workspaces/` — sandbox isolation dirs
- `~/.policy_scout/sandbox/results/` — JSON result files
- `~/.policy_scout/reports/` — generated report JSON files
- `~/.policy_scout/approvals/` — approval request files

**Fossic integration:** Not started. `audit.db` is canonical.
When fossic integration begins, the plan is bridge adapter first
(read-only ES view over the existing table), full migration later.
See `requirements.md` R-PS-006 for the integration shape.

---

## Lattica integration readiness

| Capability | IPC ready | Fossic ready | Notes |
|------------|-----------|--------------|-------|
| Command check | ✓ | — | `check_command` wired |
| Policy simulate | ✓ | — | `run_policy_simulate` wired |
| HITL approvals | ✓ | — | list/approve/deny wired |
| Sandbox results | ✓ | — | launch, list, detail, migrate wired |
| Audit stream | ✓ | — | type-filtered list + detail wired |
| Lockdown status | ✓ | — | `get_lockdown_status` wired |
| Watch status | ✓ | — | `get_watch_status` wired |
| Sweeps | ✓ | — | quick + project sweep wired |
| Scan commands | ✗ | — | CLI exists, Tauri handlers not yet wired |
| Audit chain verify | ✗ | — | CLI exists, Tauri handler not yet wired |
| Run through gate | ✗ | — | in Pass E scope |
| Fossic stream | ✗ | ✗ | no fossic integration yet |

**Practical implication for Lattica:** All read capabilities above
are available via Tauri invoke today. Lattica can call policy-scout
through the same IPC surface the desktop app uses — no additional
work needed for a first integration. The fossic stream path (for
cross-project causation and live subscriptions) requires the bridge
adapter design to be resolved first.

---

## Known gaps and constraints

- **No push / streaming:** All data is polled on demand. The desktop
  app refreshes on button press or view switch. A Lattica tile
  wanting live updates would need to poll (acceptable given write
  volume: 0–20 events/min).

- **Approval write-back architecture:** The current approve/deny
  path goes `Lattica invoke → Tauri handler → CLI subprocess →
  updates approval file + audit.db`. This works but means policy-
  scout's Tauri app must be running for the write-back to succeed.
  If Lattica wants to approve without the policy-scout app running,
  a direct CLI call path is needed (not yet designed).

- **Watch daemon scope:** The daemon watches specific project
  directories registered at daemon start, not system-wide. A
  `npm install` from `~` will not be caught. This is intentional
  and is a known limitation in the docs.

- **scan / audit chain verify:** These CLI commands are complete and
  tested but have no Tauri handlers yet. They're Pass D and E scope
  in the current UI roadmap.

- **MCP server:** The MCP gateway exists (for agent-to-policy-scout
  tool calls) but is not surfaced in the desktop UI and not
  described in detail here. It has its own event type vocabulary
  (`McpServerStarted`, `McpToolCallReceived`, etc.).

---

## Recent changes (v0.3.x changelog summary)

- **0.3.6** — version bump
- **0.3.5** — data cleanup deletion path (`--apply` flag,
  confirmation prompt, path-safe execute)
- **0.3.4** — pnpm/yarn/bun sandbox execution; PM-aware snapshots;
  pnpm transitive analysis
- **0.3.3** — supply chain detection depth: JS/Python AST analysis,
  dep confusion, transitive tree scan
- **0.3.x (UI)** — Tauri desktop app: all 9 views functional;
  HITL approval view with expiry filter and group-by-command dedup;
  sandbox migration flow; lockdown/watch status; Check view now has
  Check/Simulate tab pair

---

## How to update this doc

Update when:
- A new Tauri handler is wired (update the IPC table and view
  status table)
- A UI pass is completed (update "Pending UI passes")
- Fossic integration begins (update data layer and readiness table)
- Version bumps (update version header and changelog summary)
- Architecture changes (subprocess model, store location, etc.)
