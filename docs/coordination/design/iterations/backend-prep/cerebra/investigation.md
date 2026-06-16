# Backend Prep Investigation — Cerebra

**Filed by:** cerebra-claude
**Date:** 2026-06-15
**Source [API-NEW] items:** from control surface spec filed during iteration 3 review

---

## Per-item analysis

### Item: Posture / HOLD mechanism

- **What it does (from control surface spec):** `AUTO` ↔ `HOLD` toggle in
  tile chrome. When HOLD is active, new cycles queue but don't start. Lattica
  shows `HOLD` (amber) in the agent state pill; returning to AUTO resumes.

- **Backend work required:**

  Cerebra currently has no daemon, no long-running process, and no IPC
  surface. `cerebra run-cycle` is a fully synchronous one-shot CLI command
  that opens a session, runs a cycle, and exits. There is no process to
  signal, and no queue to hold.

  The simplest viable implementation is a **file-based hold flag**:

  1. New CLI commands: `cerebra posture hold` and `cerebra posture release`
     — write/delete a sentinel file at a well-known path (e.g.,
     `~/.lattica/cerebra_hold` or `$CEREBRA_PLATFORM_STORE_DIR/posture`).
  2. Modify `run-cycle` to check for the sentinel at startup before opening
     a session. If the sentinel exists: exit immediately with a specific exit
     code (e.g., 4 = HOLD active), without starting any work.
  3. Emit a `PostureChanged` event to the platform fossic store on
     hold/release so Lattica can derive `HOLD` state from the event stream
     instead of polling the file.
  4. Agent state pill derives `HOLD` state from `PostureChanged` events on
     `[STREAM]`; the HOLD pill state in iter-4 is already marked deferred
     pending this work (iter-4 renders RUNNING/IDLE/ERROR only).

  The "queue but don't start" behavior from the control surface spec is
  actually not achievable without a daemon (there's no process to hold a
  queue in). In practice, `run-cycle` invocations that arrive during HOLD
  would exit with code 4; the caller (user, script, or Lattica Tauri layer)
  is responsible for retry logic. This is semantically equivalent for the
  tile's purposes: the tile shows HOLD, no cycles run, user releases, next
  invocation proceeds. True queueing is a daemon concern — flag here if
  that's load-bearing.

- **Touching:**
  - `cerebra/cli/main.py` — new `posture` subgroup + `hold`/`release`
    commands; `run-cycle` startup check
  - `cerebra/cognition/event_emitter.py` — `emit_posture_changed()` helper
    (or inline in CLI)
  - New: `cerebra/storage/posture.py` — sentinel file read/write/path
    resolution (thin module, ~30 lines)

- **Cost estimate:** M (1–2 passes)

- **Dependencies:**
  - Needs agreement on sentinel path convention — should it live under
    `$CEREBRA_PLATFORM_STORE` directory (already env-controlled) or a
    separate well-known location? Lattica needs to know the path to set/read
    it if it ever issues posture commands directly rather than via CLI.
  - `PostureChanged` event stream key: `cerebra/agent-trace/<session_id>`
    is per-session; posture is global. A platform-level stream
    `cerebra/posture` or `cerebra/control` would be more appropriate. Needs
    coordination with Lattica on which stream to watch.

- **Blockers:** None outright today. Sentinel path convention needs a
  decision before writing.

- **Could ship in one pass alone?** yes (file-flag + hold/release CLI +
  PostureChanged event; no daemon required)

- **Notes:** True "queue and hold" requires a daemon — that's a different
  architectural scope (L). The file-flag approach delivers the observable
  behavior the tile needs (HOLD state + AUTO state + PostureChanged events)
  without that complexity. If "queue" is non-negotiable, flag to developer
  before starting.

---

### Item: New cycle trigger

- **What it does (from control surface spec):** Button in tile chrome that
  triggers a new cycle in the current session without the user dropping to
  terminal.

- **Backend work required:**

  `cerebra run-cycle <config_name> --goal "..."` already does exactly what
  this control needs. The CLI entry point exists. The backend gap is **not**
  a new Cerebra API — it's IPC: how does a click in Lattica's Tauri webview
  invoke `cerebra run-cycle`?

  Lattica's Tauri layer can use `tauri::process::Command` (or the `shell`
  plugin) to shell-exec `cerebra run-cycle`. This is entirely a Lattica-side
  implementation concern. Cerebra's contribution to making this practical:

  1. A `cerebra trigger` command alias (or `--goal-from-stdin` flag on
     `run-cycle`) that accepts goal and config from stdin or environment
     variables rather than CLI arguments — makes it easier for Lattica to
     invoke without constructing a complex argument string.
  2. A structured JSON exit payload on stdout (already partially present:
     the `--quiet` + exit code convention in `run-cycle`). Making the exit
     payload machine-readable ensures Lattica can detect success/failure
     without parsing human-readable text.
  3. Alternatively, if goal/config come from the tile's current state (the
     tile knows the active session's config and goal), Lattica can construct
     the full CLI invocation directly — no Cerebra-side change needed.

  There is also a **fossic-subscription approach**: a control stream
  `cerebra/control` where Lattica publishes `TriggerCycleRequested` events,
  and a long-running Cerebra process subscribes and fires cycles in response.
  This is architecturally cleaner but requires a daemon — same daemon concern
  as HOLD. Flag as L if that path is preferred.

- **Touching (minimal path):**
  - `cerebra/cli/main.py` — optional: `trigger` command alias or
    `--goal-from-stdin` flag on `run-cycle` (10–20 lines)
  - No changes to `CycleRuntime`, `SessionManager`, or storage layer

- **Touching (fossic-subscription path):**
  - New: `cerebra/daemon/` or `cerebra/cli/daemon.py` — long-running process
  - New: fossic subscription to `cerebra/control` stream
  - This is L scope and likely iteration 6+ territory

- **Cost estimate:** S on Cerebra's side (CLI already exists; minimal alias
  or env-var changes). The bulk of the work is on Lattica's Tauri layer
  (IPC / shell exec). Flag this clearly to Lattica: the backend-prep cost
  for Cerebra is S, but Lattica owns the integration work.

- **Dependencies:**
  - Lattica Tauri shell-exec capability — needs `@tauri-apps/plugin-shell`
    or equivalent; Lattica Claude would confirm whether this is already
    present
  - Goal text must come from somewhere in the tile state — tile needs to
    know what goal/config to pass. Either: hardcoded to active session's last
    goal, or user enters it in the tile (text input, out of scope for iter 4)

- **Blockers:** Lattica Tauri shell-exec capability unknown from Cerebra's
  side — needs Lattica to confirm before planning.

- **Could ship in one pass alone?** yes (for the Cerebra-side alias/flag;
  the integration work is Lattica's)

- **Notes:** This item is mis-categorized as [API-NEW] on Cerebra's side.
  The CLI already provides the entry point. Recommend re-labeling as a
  Lattica-side IPC item. Cerebra's contribution is optional ergonomics
  (stdin/env goal) rather than new backend capability.

---

### Item: Checkpoint

- **What it does (from control surface spec):** Button that snapshots
  current session state to fossic; creates a recoverable pin point before
  config experiments or risky operations.

- **Backend work required:**

  This is the closest to existing machinery. `BundleDistiller` in
  `cerebra/cognition/continuation_bundle.py` already distills session
  state into a `ContinuationBundle` (goal, step outputs, tower snapshot,
  insights, next focus, open questions, constraints). `write_bundle()`
  persists it to SQLite. The stub implementations in `BundleDistiller`
  are v0.1 placeholders that Phase 9 was meant to replace with
  LLM-driven summarization.

  A checkpoint command is:

  1. New `cerebra session checkpoint` subcommand (30–50 lines in `main.py`)
  2. Reads active session + working memory + tower state from SQLite
  3. Calls `BundleDistiller.distill()` with current session context
  4. Calls `write_bundle()` to persist to the vault SQLite
  5. Emits a `CheckpointSaved` event to the platform fossic store
     (so Lattica can surface it in the tile and show the snapshot in archive)
  6. Outputs checkpoint bundle_id to stdout

  The `CheckpointSaved` event payload would carry: `session_id`, `bundle_id`,
  `wm_item_count`, `t1_count`, `t2_count`, `goal_summary`, `checkpointed_at`.
  Lattica subscribes on `cerebra/agent-trace/*` and shows a checkpoint card
  in the event feed.

  **The "recoverable" half** (restoring from a checkpoint) is harder.
  `--continue SESSION_ID` is already stubbed in `run-cycle` but not
  implemented. Restoring would require: reading the bundle, injecting it
  as the continuation prefix for a new session, and linking via
  `link_child_session()`. This is M-L additional work. Recommend scoping
  checkpoint to "save only" in first pass; restore in second pass or later.

- **Touching:**
  - `cerebra/cli/main.py` — new `cerebra session checkpoint` command
  - `cerebra/cognition/continuation_bundle.py` — already has the machinery;
    no structural changes needed, only call-site additions
  - `cerebra/cognition/event_emitter.py` — `CheckpointSaved` event type
    (or inline in CLI)
  - `cerebra/storage/fossic_store.py` — checkpoint event written via
    `FossicStore.at_platform_path()` (already exists)

- **Cost estimate:** S (save-only, one pass) / M (save + restore, two passes)

- **Dependencies:**
  - `CEREBRA_PLATFORM_STORE` env var must be set for the event to land in
    Lattica's store — already wired in `run-cycle`; `session checkpoint`
    needs the same env var handling
  - `CheckpointSaved` event stream key — `cerebra/agent-trace/<session_id>`
    is correct (checkpoint is per-session)

- **Blockers:** None. All prerequisite machinery exists.

- **Could ship in one pass alone?** yes (save-only; restore deferred)

- **Notes:** This is the most immediately shippable item. `BundleDistiller`
  exists, `write_bundle` exists, `FossicStore.at_platform_path` exists.
  The v0.1 stub distillation (goal pass-through + step output concatenation)
  is good enough for a checkpoint — the user gets a bundle they can inspect
  and that the restore path can use. LLM-quality distillation is a later
  improvement. Surface a `CheckpointSaved` renderer (P-013 contribution)
  when the event lands.

---

## Cross-project dependencies

- **Posture/HOLD:** stream key for `PostureChanged` events needs agreement
  with Lattica — `cerebra/agent-trace/<session_id>` is per-session; a
  global posture event belongs on a different stream (`cerebra/control` or
  `cerebra/posture`). Lattica needs to subscribe to that stream.
- **New cycle trigger:** primarily Lattica-side IPC work (Tauri shell exec).
  Cerebra's contribution is optional. Lattica needs to confirm shell-exec
  capability in Tauri before this is actionable.
- **Checkpoint:** `CheckpointSaved` event needs a renderer (P-013); Cerebra
  authors it, Lattica commits it. Low dependency — renderer can follow the
  command by one pass.

---

## Recommended ordering within your project

**First pass:**
- **Checkpoint (save-only)** — most existing machinery, clear scope, renders
  immediately in the tile as a `CheckpointSaved` event card. No cross-project
  blocking. Highest readiness.

**Second pass:**
- **Posture/HOLD** — file-flag approach is self-contained within Cerebra.
  Needs sentinel path convention decision before starting. PostureChanged
  events unblock the tile pill.

**Later (or parallel Lattica work):**
- **New cycle trigger** — Cerebra's backend change is minimal (optional CLI
  alias). The real work is Lattica's Tauri shell-exec integration. Defer
  Cerebra's contribution until Lattica confirms the IPC approach.

---

## Notes for Lattica Claude

- **Checkpoint is surprisingly easy.** `BundleDistiller` already exists and
  produces a structured state snapshot. The save-half is 1 CLI command +
  1 fossic event. Restore is separate and harder; recommend scoping them
  apart.

- **New cycle trigger looks like [API-NEW] but isn't really.** The CLI
  already provides the entry point. The work is Lattica-side IPC. Recommend
  re-labeling in the backend-prep report as a Lattica infrastructure item,
  not a Cerebra backend item. Cerebra's optional contribution (stdin goal)
  is a convenience, not a blocker.

- **HOLD mechanism needs a posture stream decision.** Before starting the
  HOLD pass, Lattica and Cerebra need to agree on: (a) sentinel file path
  convention, (b) whether posture events go on `cerebra/agent-trace/*` or
  a new `cerebra/control` stream, (c) whether true queueing is needed or
  exit-code-4 is sufficient. These decisions are cheap to make and expensive
  to undo later.

- **Daemon concern is latent across all three items.** HOLD-with-true-queue,
  new-cycle-via-fossic-subscription, and checkpoint-triggered-remotely all
  converge on needing a Cerebra daemon. None of these items individually
  require it; collectively they suggest a future `cerebra serve` or
  `cerebra daemon` as a longer-horizon architectural item worth flagging
  to the developer.
