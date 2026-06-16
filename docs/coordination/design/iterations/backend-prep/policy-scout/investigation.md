# Backend Prep Investigation — policy-scout

**Filed by:** policy-scout-claude
**Date:** 2026-06-15
**Source [API-NEW] items:** from control surface spec filed during iteration 3 review

---

## Per-item analysis

### Item: LOCK DOWN button

- **What it does (from control surface spec):** Hold-to-confirm + optional reason input; fires `lockdown on --reason "..."` to activate lockdown mode, denying all non-read operations.
- **Backend work required:** `lockdown on --reason "..."` already exists at full depth — CLI parser at `main.py:416-421`, handler calls `activate_lockdown(reason=reason, audit_store=audit_store)` in `response/lockdown.py:34`. Only missing: Tauri IPC handler (`lib.rs`) that invokes the CLI command and returns structured JSON. Pass E already established the pattern via `get_system_health`.
- **Touching:** `ui/desktop/src-tauri/src/lib.rs` (new Tauri command), `ui/desktop/src/App.tsx` or component (wire invoke call)
- **Cost estimate:** S
- **Dependencies:** None — CLI layer complete.
- **Blockers:** None.
- **Could ship in one pass alone?** yes
- **Notes:** `--reason` flag takes a plain string; UI hold-to-confirm is frontend-only and has no backend implication. The audit event `LockdownActivated` is already emitted by `activate_lockdown()`.

---

### Item: CLEAR LOCKDOWN button

- **What it does (from control surface spec):** Single confirm; fires `lockdown off`.
- **Backend work required:** `lockdown off` already exists — parser at `main.py:422`, handler calls `deactivate_lockdown(cleared_by="cli", audit_store=audit_store)` in `response/lockdown.py:57`. Same Tauri handler gap as LOCK DOWN.
- **Touching:** `ui/desktop/src-tauri/src/lib.rs`, `ui/desktop/src/App.tsx` or component
- **Cost estimate:** S
- **Dependencies:** None.
- **Blockers:** None.
- **Could ship in one pass alone?** yes (can be bundled with LOCK DOWN in one pass)
- **Notes:** `LockdownDeactivated` audit event already emitted. Confirm-before-execute is frontend-only.

---

### Item: RESTART WATCH button

- **What it does (from control surface spec):** Fires `watch start`; handles transition to ACTIVE or STALE on failure.
- **Backend work required:** `watch start` already exists — parser at `main.py:786-804`, `handle_watch_command()` at `main.py:3970`. `daemon_status()` in `watch/daemon.py` returns `{"running": bool, "pid": int|None, "stale": bool, "pid_file": str}` — the `stale` key is present only when a PID file exists but the process is dead. STALE posture is thus already derivable from the watch daemon status. Tauri IPC handler needed.
- **Touching:** `ui/desktop/src-tauri/src/lib.rs`, component
- **Cost estimate:** S
- **Dependencies:** None.
- **Blockers:** None.
- **Could ship in one pass alone?** yes (can be bundled with LOCK DOWN and CLEAR LOCKDOWN)
- **Notes:** RESTART WATCH should call `watch stop` (if running/stale) then `watch start`. Stop is also already present (`main.py:805`). Sequencing logic is straightforward.

---

### Item: Approval timeout setting

- **What it does (from control surface spec):** Needs `approvals set-timeout <n>` — a user-configurable default expiry window for approval requests.
- **Backend work required:** `expires_at` is hardcoded in `approvals/models.py:16` as `lambda: utcnow_plus_hours_iso(24)`. No `approvals set-timeout` CLI command exists. Work required: (a) add a config entry (e.g. `~/.config/policy-scout/config.toml` or existing config file) for `approval_timeout_hours`; (b) add `approvals set-timeout <n>` CLI subparser; (c) plumb the config value into `ApprovalRequest` constructor so the default varies. The `from_dict` path (`models.py:47-65`) can stay as-is since `expires_at` is already serialized.
- **Touching:** `approvals/models.py`, `cli/main.py`, config layer (location TBD — need to read existing config module)
- **Cost estimate:** S–M (S if config layer already exists; M if config persistence needs to be added)
- **Dependencies:** Existing config infrastructure — need to read `core/` or config module before estimating. If no config file layer exists yet, that's the bulk of the work.
- **Blockers:** None.
- **Could ship in one pass alone?** yes
- **Notes:** Per-approval override (e.g. `approvals approve <id> --expires-in <n>`) is a natural extension but out of scope here.

---

### Item: Default scope setting

- **What it does (from control surface spec):** CLI work to set the default for approve buttons; determines whether `approve` defaults to `once`, `session`, or `pattern`.
- **Backend work required:** `ApprovalScope` class (`models.py:80-83`) currently defines only `ONCE = "once"`. The `approve` subparser (`main.py:134-138`) has no `--scope` argument. The execute path (`main.py:2465`) hard-rejects any scope that isn't `"once"` with an error. Work required before this is meaningful: ALLOW SESSION (see below) must be implemented first so `scope="session"` is a valid resolvable value. Once that exists, a default scope config entry is an S addition on top.
- **Touching:** `cli/main.py` (new `--scope` arg on `approve`), `approvals/models.py` (new scope constants), config layer
- **Cost estimate:** M (blocked on ALLOW SESSION; trivial once that lands)
- **Dependencies:** **Blocked on ALLOW SESSION.** The execute path will error on any non-`"once"` scope; default scope setting is only useful once at least `session` scope has a working enforcement path.
- **Blockers:** ALLOW SESSION must ship first.
- **Could ship in one pass alone?** partial (config entry is S, but meaningless until ALLOW SESSION enforcement exists)
- **Notes:** Recommend shipping default scope setting in the same pass as ALLOW SESSION to avoid a half-wired config knob.

---

### Item: ALLOW SESSION

- **What it does (from control surface spec):** `approvals approve <id> --scope session` — approve a specific command for the duration of the current session, not just once.
- **Backend work required:**
  1. Add `--scope` argument to `approve` parser (`main.py:134-138`)
  2. Add `ApprovalScope.SESSION = "session"` constant (`approvals/models.py`)
  3. Update execute path (`main.py:2465`) — currently hard-errors on non-`"once"` scope
  4. Define "session" semantics in enforcement: the policy engine (`policy/engine.py`) currently evaluates each command independently with no session state. A session scope would require a session registry (in-memory or SQLite) keyed by session ID that records "command X was approved for this session by approval Y." The engine needs to consult this registry before escalating to REQUIRE_APPROVAL.
  5. Session ID source: `CommandRequested` events already carry `actor.session_id` when the actor is an agent. For human/CLI actors, session concept may be undefined — needs a decision.
  6. Expiry: session-scoped approvals expire when the session ends. Session lifecycle signals are not yet wired to policy-scout's enforcement path.
- **Touching:** `cli/main.py`, `approvals/models.py`, `policy/engine.py`, new session-registry module
- **Cost estimate:** M–L (registry and enforcement path are the unknown; parser change is trivial)
- **Dependencies:** None external; internal session lifecycle definition is the non-trivial design question.
- **Blockers:** Session ID source and lifecycle signals need a design decision before implementation.
- **Could ship in one pass alone?** partial (model + parser changes yes; enforcement path likely needs two passes)
- **Notes:** The model layer is almost ready (scope field exists and round-trips through `from_dict`/`to_dict`). The enforcement layer is the real work. Could ship the model/CLI layer first (scope stored, no enforcement yet) and follow with enforcement in a second pass.

---

### Item: ALLOW PATTERN (+ rule engine hook)

- **What it does (from control surface spec):** `approvals approve <id> --scope pattern --pattern "..."` — approve all commands matching a glob/regex pattern, and hook this into the rule engine so future matching commands skip the approval gate.
- **Backend work required:**
  1. Everything in ALLOW SESSION (parser, constants, execute path) plus `--pattern` argument
  2. Pattern storage: approved patterns need a persistent store (SQLite table or TOML file) — not currently present
  3. Rule engine hook: `PolicyEngine.decide()` must consult the active pattern-exception table before classifying a command as REQUIRE_APPROVAL. Currently `engine.py` has no concept of temporary exceptions
  4. Pattern matching logic: glob or regex? Needs decision. Shell commands have complex quoting; naive substring match will over-match
  5. Expiry: pattern-scoped approvals need TTL (tied to session? time-based? explicit clear command?)
  6. Audit trail: each time a pattern exception fires, an audit event should record that the command matched the approved pattern
- **Touching:** `cli/main.py`, `approvals/models.py`, `policy/engine.py`, new pattern-exception storage module, `audit/events.py` (new event type)
- **Cost estimate:** L
- **Dependencies:** ALLOW SESSION (shares model/parser work). Pattern store is independent of session registry.
- **Blockers:** Pattern matching semantics need a design decision (glob vs. regex; scope of match — full command string, base command only, or structured token match).
- **Could ship in one pass alone?** no
- **Notes:** The rule engine hook is the highest-risk piece — it modifies the enforcement hot path that every command decision runs through. Recommend careful test coverage before shipping. The pattern-exception store and audit trail add meaningful surface area. This is the largest single item in the list.

---

### Item: Rule mute mechanism

- **What it does (from control surface spec):** `rules mute <rule-name>` — temporarily suppress a named policy rule so it doesn't fire in decisions.
- **Backend work required:** No `rules` CLI subcommand exists anywhere. No rule mute concept in `policy/engine.py`. Work required:
  1. New `rules` CLI subparser with `mute` and (presumably) `unmute` / `list-muted` subcommands
  2. Muted-rules store (persistent, since mutes should survive policy-scout restarts — session mutes that don't persist are a different, simpler feature)
  3. `PolicyEngine` must consult the muted-rules list at decision time and skip matched rules; rules currently evaluated via `PolicyRegistry` which reads YAML rule definitions — mutes would bypass a rule without modifying the YAML
  4. Rule names: currently defined in `registry/` YAML files. The `matched_rule` field in decisions is the rule ID string. A mute mechanism references these IDs — needs a listing command (`rules list`) to be useful
  5. Expiry / audit: how long does a mute last? Indefinite mutes that accumulate silently are a governance anti-pattern; recommend TTL or at least explicit listing
- **Touching:** `cli/main.py`, `policy/engine.py`, `registry/` (rule listing), new mute-store module
- **Cost estimate:** L
- **Dependencies:** None external. Internal: rule ID schema is stable (YAML rule `id` fields are already used as `matched_rule` values in audit events).
- **Blockers:** Mute semantics (session vs. persistent, TTL, audit trail) need a design decision.
- **Could ship in one pass alone?** no
- **Notes:** Rule mute has meaningful governance risk — a muted rule is a silenced enforcement gate. If this ships, recommend: (a) every mute writes an audit event, (b) `rules list-muted` is bundled in the same pass, (c) TTL is required (no indefinite mutes without explicit renewal). This is roughly equivalent in complexity to ALLOW PATTERN.

---

## Cross-project dependencies

- **ALLOW SESSION** has a soft dependency on Cerebra's session lifecycle signals: if session scope is to expire when the Cerebra session ends, policy-scout needs to know when sessions open/close. Could be addressed by subscribing to fossic `cerebra/agent-trace/*` for `SessionOpened`/`SessionClosed` events — but this is optional; could also use a manual `approvals clear-session` CLI command as a simpler first cut.
- **ALLOW PATTERN + rule engine hook** — no external dependencies, but the pattern-exception store is conceptually similar to what a shared policy-exceptions bus on fossic might offer. If Lattica envisions cross-project policy exception coordination, this is where that would hook in. No decision needed now.
- **Approval timeout** — if Lattica's design surface exposes timeout as a tile-level setting (editable from the UI), that setting needs a write-back path. Under iter-4's read-only tile constraint, no write-back exists yet; the CLI command (`approvals set-timeout`) is the only write path.

---

## Recommended ordering within your project

**First pass (S-cost items — low risk, high payoff):**
- LOCK DOWN button (Tauri handler)
- CLEAR LOCKDOWN button (Tauri handler, same pass)
- RESTART WATCH button (Tauri handler, same pass)
- Approval timeout setting (add config entry + CLI command; small surface area)

These four can likely ship in a single pass. The CLI work is already done; Tauri wiring is well-understood from Pass E.

**Second pass (M-cost items — model + partial enforcement):**
- ALLOW SESSION: model/parser layer (stores scope, round-trips through DB, no enforcement yet)
- Default scope setting: lands in the same pass once session scope is a valid stored value

**Later (L-cost items — design decisions needed first):**
- ALLOW SESSION enforcement path (session registry + engine hook)
- ALLOW PATTERN (pattern store + engine hook + audit trail)
- Rule mute mechanism (mute store + engine hook + listing command)

---

## Notes for Lattica Claude

**Items that are surprisingly easy:** LOCK DOWN, CLEAR LOCKDOWN, RESTART WATCH. These look like [API-NEW] but the CLI layer is complete. They're purely Tauri-wiring work.

**Items that look small but have non-obvious complexity:** Default scope setting. The config entry is trivial; it's blocked on ALLOW SESSION enforcement existing first. Don't ship the config knob without the enforcement path — a setting that does nothing is worse than no setting.

**Approval timeout** is the one genuine S–M item with real backend work. The config layer may not exist yet (need to read `core/` config module to confirm). If it does exist, this is S. If not, the config infrastructure is the hidden cost.

**Items that are L-cost with governance implications:** ALLOW PATTERN and Rule mute. Both modify the enforcement hot path and both have audit trail requirements. Recommend treating these as separate iteration scope items, not bundled with the S/M items. Both need design decisions on mute/exception semantics before implementation starts.

**4-state posture model confirmation:** The iteration 4 REQUEST.md's ACTIVE / LOCKDOWN / WATCH-DOWN / STALE model is correct and matches the code exactly.
- **ACTIVE** → `daemon_status().running == True` AND lockdown not active
- **LOCKDOWN** → lockdown flag active (regardless of watch state)
- **WATCH-DOWN** → `daemon_status().running == False` AND `stale` key absent (clean stop — no PID file, or PID file cleared)
- **STALE** → `daemon_status().running == False` AND `stale == True` (PID file present, process dead — crashed or killed externally)

No clarification needed on the posture model; use it verbatim.
