---
title: Backend-Prep Investigation Compile Report
pass: v0.3.5v
compiled_by: lattica-claude
date: 2026-06-15
status: draft — awaiting developer review
discipline: faithful-relay-first (no re-evaluation of source estimates, no added items,
  no editorial reframing; cross-investigation observations clearly separated and
  labelled as Lattica-compile-level observations, not source findings)
---

# Backend-Prep Investigation Compile Report

---

## §1 — Investigations Included

| Project | Filed by | Date | Items analyzed | Bytes |
|---|---|---|---|---|
| cerebra | cerebra-claude | 2026-06-15 | 3 | 13 291 |
| lumaweave | lumaweave-claude | 2026-06-15 | 5 + 1 hidden | 12 106 |
| policy-scout | policy-scout-claude | 2026-06-15 | 8 | 15 271 |
| ai-stack-bo | ai-stack-bo-claude | 2026-06-15 | 7 | 16 301 |

All four investigations were present. None were missing or incomplete at compile time. Issue log: §6.

---

## §2 — Items by Tier

Tiers assigned by source investigation. Where an investigation provided a range (S–M, M–L), the range is preserved. "?" marks items whose cost cannot be confirmed until a prerequisite audit or design decision is resolved. Items marked [API-EXISTS] were labeled [API-NEW] in the original spec; see §6.

### S — One pass, self-contained

| Project | Item | Source note |
|---|---|---|
| cerebra | Checkpoint (save-only) | Most existing machinery; highest readiness. |
| cerebra | New cycle trigger (Cerebra side) | CLI already exists; minimal alias/env-var change only. Bulk of work is Lattica IPC — see §6-C1. |
| policy-scout | LOCK DOWN | Tauri IPC handler only; CLI layer complete. |
| policy-scout | CLEAR LOCKDOWN | Tauri IPC handler only; CLI layer complete. Bundle with LOCK DOWN. |
| policy-scout | RESTART WATCH | Tauri IPC handler only; CLI layer complete. Bundle with LOCK DOWN. |
| ai-stack-bo | VRAM WARN threshold | Client-side preference only; no backend. See §6-C3. |
| ai-stack-bo | ALIAS MUTE | Client-side view preference only; no backend. See §6-C3. |
| ai-stack-bo | LOAD MODEL | [API-EXISTS] — Ollama `/api/pull` + `/api/generate`; Tauri webview can call directly. See §6-C2. |
| ai-stack-bo | UNLOAD ALL | [API-EXISTS] — Ollama `/api/ps` + `keep_alive: 0`. Bundle with LOAD MODEL. See §6-C2. |
| ai-stack-bo | SLEEP TIMER (basic client-side) | Composes UNLOAD ALL; client-side scheduler only. |

### S–M — One pass if prerequisite exists; M if prerequisite must be built

| Project | Item | Prerequisite |
|---|---|---|
| policy-scout | Approval timeout setting | Config layer may not exist; if it does → S; if not → M (config infra is the hidden cost). |
| lumaweave | Source switcher | Shared platform fossic store (hard blocker) + AdapterListChanged emission (hidden [API-NEW]). |
| lumaweave | Layout freeze | Shared platform fossic store (hard blocker) + gwells control surface. |

### M — Multi-pass or new infrastructure required

| Project | Item | Source note |
|---|---|---|
| cerebra | Checkpoint (save + restore) | Save-only is S; restore adds M scope (implement `--continue` stub). |
| cerebra | HOLD mechanism | File-flag + sentinel path decision + PostureChanged event. Self-contained within Cerebra. |
| policy-scout | ALLOW SESSION (model/parser layer) | Model + parser + DB round-trip; enforcement path is separate (see M–L below). |
| policy-scout | Default scope setting | Trivial once ALLOW SESSION enforcement exists; blocked until then. See §6-C4. |
| ai-stack-bo | RESTART node | Management sidecar (Option 2) or Tauri Rust backend (Option 1). Scoping decision required. |
| ai-stack-bo | FORCE FAILOVER | Incremental S on top of RESTART sidecar; M total. External fallback endpoint decision required. |
| ai-stack-bo | SLEEP TIMER (system-level) | ai-stack sidecar watchdog version; Phase 2 fossic dep for high-precision idle detection. |

### M–L — Two passes minimum, design decisions unresolved

| Project | Item | Source note |
|---|---|---|
| policy-scout | ALLOW SESSION (enforcement path) | Session registry + `PolicyEngine.decide()` hot-path modification. Session ID source and lifecycle signals unresolved. |
| lumaweave | Retry | S once reverse channel exists; blocked on same hard blocker as source switcher. |

### L — Multiple passes, significant design decisions required

| Project | Item | Source note |
|---|---|---|
| policy-scout | ALLOW PATTERN (+ rule engine hook) | Pattern store + engine hot-path + audit trail + pattern matching semantics decision. Modifies enforcement hot path. |
| policy-scout | Rule mute mechanism | No `rules` CLI subcommand exists. New CLI + mute store + engine hook + listing command. Mute semantics (TTL, persistent/session) unresolved. Governance implications noted. |

### ? — Cost uncertain pending audit or decision

| Project | Item | Blocking unknown |
|---|---|---|
| lumaweave | Re-settle | gwells restart behavior with position preservation unknown. S if position-preserving; M–L if positions reset to seed values (scatters graph). |
| lumaweave | Physics preset write | Blocked on shared store. Low priority per investigation; deferral recommended. |

---

## §3 — Cross-Project Dependencies

Relayed verbatim from source investigations.

### From cerebra investigation

- **HOLD mechanism → stream key decision (Lattica)**: `PostureChanged` events should land on a platform-level stream (`cerebra/control` or `cerebra/posture`), not `cerebra/agent-trace/<session_id>` (per-session). Lattica must subscribe to that stream. Decision required before writing.
- **New cycle trigger → Tauri shell-exec confirmation (Lattica)**: The integration work is Lattica-side IPC (`tauri::process::Command` or `@tauri-apps/plugin-shell`). Cerebra's side is optional ergonomics. Lattica must confirm shell-exec capability before this is actionable.
- **Checkpoint → P-013 renderer (Lattica + Cerebra)**: `CheckpointSaved` event needs a renderer filed by Cerebra via P-013; Lattica commits it. Low dependency — renderer can follow the save command by one pass.

### From lumaweave investigation

- **All five items → shared platform fossic store (Lattica + fossic)**: The hard blocker for all LumaWeave [API-NEW] work. Option A (fossic bidirectional bus) is the confirmed architecture; it cannot be built until `~/.lattica/fossic/store.db` path is confirmed and the shared store is operational.
- **Source switcher → AdapterListChanged emission (LumaWeave)**: Dropdown cannot be populated without LumaWeave emitting available adapter list to fossic. Not in the original spec; flagged as hidden [API-NEW]. Prerequisite to source switcher.
- **Re-settle → gwells internals audit (LumaWeave)**: gwells restart with position preservation is unknown. Audit must happen before committing to implementation to avoid the graph-scatter failure mode.

### From policy-scout investigation

- **ALLOW SESSION → session lifecycle signals (Cerebra, optional)**: If session-scoped approvals are to expire when the Cerebra session ends, policy-scout needs lifecycle signals (`SessionOpened`/`SessionClosed` events). Could subscribe to `cerebra/agent-trace/*`. First-cut alternative: manual `approvals clear-session` CLI command avoids the cross-project dep.
- **Approval timeout → write-back path (Lattica)**: Under iter-4 read-only tile constraint, the tile cannot write back a new timeout value. CLI is the only write path. If the design surface ever exposes timeout as editable from the tile, a write-back path must be defined.

### From ai-stack-bo investigation

- **RESTART (Option 1) → Tauri `src-tauri/` (Lattica)**: If using Tauri Rust backend path, Lattica's `src-tauri/` needs modification and needs to know ai-stack's docker-compose path. Cross-project coupling smell noted.
- **RESTART (Option 2) → ai-stack sidecar ownership**: ai-stack owns the management sidecar; Lattica calls it via HTTP. Clean architectural boundary; no Lattica codebase change.
- **FORCE FAILOVER → RESTART sidecar + external endpoint decision**: Shares sidecar infrastructure with RESTART. Incremental cost on top of RESTART is S. External fallback endpoint (e.g., Anthropic direct, specific model alias) is a developer configuration decision required before implementation.
- **FORCE FAILOVER + RESTART → sidecar builds shared foundation**: The management sidecar built for RESTART becomes the natural home for future ai-stack operational APIs (health probes, model management, LiteLLM config management).

---

## §4 — Cross-Investigation Observations

These observations emerge from looking across all four investigations simultaneously. They are Lattica-compile-level observations — not present in any single investigation, not adding or removing items. Labelled explicitly as such.

### C-OBS-01 · Daemon convergence in Cerebra

Noted by Cerebra investigation; reinforced here. Three separate Cerebra [API-NEW] items (HOLD-with-true-queue, cycle-trigger-via-fossic-subscription, remote-checkpoint-restore) independently converge on needing a `cerebra serve` or `cerebra daemon` long-running process. No individual item requires it. Collectively they suggest a future daemon as a longer-horizon architectural item. Cerebra investigation explicitly flags this; compile confirms the pattern holds across all three.

### C-OBS-02 · [API-EXISTS] mislabeling in ai-stack/Bo spec

ai-stack investigation finds that LOAD MODEL and UNLOAD ALL were labeled [API-NEW] in the original control surface spec; they are effectively [API-EXISTS] (Ollama HTTP API covers both; Tauri webview can call localhost:11434 directly without new backend). VRAM WARN and ALIAS MUTE were also labeled [API-NEW] but are pure client-side preferences with no backend requirement. Four of seven ai-stack [API-NEW] items do not need new backend infrastructure.

### C-OBS-03 · [API-NEW] mislabeling for Cerebra's "new cycle trigger"

Cerebra investigation recommends re-labeling "new cycle trigger" as a Lattica-side IPC item. Cerebra's backend contribution (stdin/env goal alias) is optional ergonomics, not a new capability. The original [API-NEW] label on Cerebra's side inaccurately implies backend work on Cerebra's behalf.

### C-OBS-04 · Policy Scout enforcement hot path: three items, one risk concentration

ALLOW SESSION enforcement, ALLOW PATTERN, and Rule mute all modify `PolicyEngine.decide()`. Each introduces a new store or registry that the engine must consult before classifying a command. The hot-path modification is the highest-risk piece across all three items. Policy Scout investigation notes this; compile confirms the concentration across the three L/M-L items. Governance implications (ALLOW PATTERN and Rule mute) increase the stakes.

### C-OBS-05 · First-pass readiness signal by project

Synthesized from per-project "recommended ordering" sections:

| Project | First-pass candidate(s) | Readiness | Blocker |
|---|---|---|---|
| cerebra | Checkpoint (save-only) | High | None |
| policy-scout | LOCK DOWN + CLEAR LOCKDOWN + RESTART WATCH + Approval timeout | High | None (CLI complete) |
| ai-stack-bo | VRAM WARN + ALIAS MUTE + LOAD MODEL + UNLOAD ALL | High | None |
| lumaweave | None | Blocked | Shared platform fossic store not yet operational |

LumaWeave has no first-pass candidates that can ship today. All five items require the shared store to be operational before starting.

### C-OBS-06 · Shared sidecar compound value (ai-stack)

ai-stack investigation notes the management sidecar (built for RESTART) becomes the natural home for future ai-stack operational APIs. FORCE FAILOVER is immediately addable once the sidecar exists (incremental cost S). This is a classic "build the foundation, collect compound return" architecture; compile confirms the pattern given that RESTART and FORCE FAILOVER are the only two items that require it.

---

## §5 — Per-Project Summaries

Faithful relay. All assessments, cost estimates, and orderings are as filed by the source investigation. No modifications.

---

### 5.1 — Cerebra

**Filed by:** cerebra-claude · 2026-06-15 · 3 items analyzed

**Item summary:**

| Item | Cost | Ships alone? | Key finding |
|---|---|---|---|
| Checkpoint (save-only) | S | yes | Most shippable. `BundleDistiller`, `write_bundle`, `FossicStore.at_platform_path` all exist. New `cerebra session checkpoint` command (30–50 lines). Emits `CheckpointSaved` to platform fossic. |
| Checkpoint (restore) | M | yes (second pass) | `--continue SESSION_ID` stub exists but is not implemented. Restore = read bundle + inject as continuation prefix + `link_child_session()`. Scoped apart from save. |
| HOLD mechanism | M | yes (file-flag approach) | No daemon or queue required for the tile's behavioral needs. File-sentinel (`posture hold`/`release` CLI). `run-cycle` checks sentinel at startup; exits code 4 if HOLD active. `PostureChanged` event to `cerebra/control` stream (stream key needs Lattica agreement). True queueing is L scope / daemon concern. |
| New cycle trigger (Cerebra side) | S | yes | CLI entry point already exists (`cerebra run-cycle`). Cerebra contribution = optional stdin/env goal alias. Bulk of work is Lattica IPC. See §6-C1. |

**Recommended ordering (verbatim from investigation):**
1. First pass: Checkpoint (save-only)
2. Second pass: HOLD mechanism
3. Later / parallel Lattica work: New cycle trigger

**Daemon note (verbatim):** "Daemon concern is latent across all three items. HOLD-with-true-queue, new-cycle-via-fossic-subscription, and checkpoint-triggered-remotely all converge on needing a Cerebra daemon. None of these items individually require it; collectively they suggest a future `cerebra serve` or `cerebra daemon` as a longer-horizon architectural item worth flagging to the developer."

---

### 5.2 — LumaWeave

**Filed by:** lumaweave-claude · 2026-06-15 · 5 items analyzed + 1 hidden [API-NEW] surfaced

**Note (verbatim from investigation):** "Investigation is optional per Lattica's relay (LumaWeave deferred to Option B read-only tile for v1). Filed for future planning — this is not blocking iteration 4."

**Reverse channel decision (verbatim):**

> Option A (fossic bidirectional bus) is the correct architecture. The only reason to avoid it is the shared-store blocker. When that blocker resolves, build Option A. Do not invest in a custom socket server. Honest assessment: there is no "simpler" Option B. Every concrete implementation either requires Lattica to manage LumaWeave's process lifecycle (sidecar model, significant arch change) or introduces custom socket code with all its auth/framing/error-handling overhead. Option B is NOT simpler — it's more complex than Option A for less auditability.

**Hard blocker (verbatim):** "fossic bidirectional bus requires the shared platform store. LumaWeave currently writes to `<project_root>/.lumaweave/fossic.db`. This cannot be built today."

**Item summary:**

| Item | Cost | Ships alone? | Key finding |
|---|---|---|---|
| Source switcher | M (→ S if store in place) | no | Reverse channel + `SwitchSource` command handler → `settings.sources.active` write. Blocked on shared store + adapter-list emission. |
| Retry | S (once channel exists) | partial | `settings.sources.refreshToken` increment; one-liner once channel exists. Bundle with source switcher. |
| Layout freeze | S–M | no | `lw_set_layout_frozen(frozen: bool)` Tauri command → gwells `GWRuntimeState` pause/resume. `LayoutFreezeChanged` event. gwells has `paused`/`running` already. |
| Re-settle | S or M–L (?) | no | `lw_retrigger_settle()` Tauri command. gwells restart behavior with position preservation unknown; must audit before committing. Cost uncertain. |
| Physics preset write | M | no | Low priority. Define ORGANIC/TIGHT/SPARSE preset configs + `ApplyPhysicsPreset` command + settings schema migration. Investigation recommends deferral indefinitely — `↗ OPEN` covers the case. |
| AdapterListChanged (hidden [API-NEW]) | S (implied) | — | Not in original spec. Source switcher dropdown requires LumaWeave to emit available adapter list to fossic. Prerequisite to source switcher. |

**Recommended ordering (verbatim):**
1. First pass (after shared store resolves): Reverse channel infra → Source switcher + Retry (+ adapter-list emission as prerequisite)
2. Second pass: Layout freeze + Re-settle (after gwells audit)
3. Later / reconsider: Physics preset write

---

### 5.3 — Policy Scout

**Filed by:** policy-scout-claude · 2026-06-15 · 8 items analyzed

**4-state posture model confirmation (verbatim):**

> The iteration 4 REQUEST.md's ACTIVE / LOCKDOWN / WATCH-DOWN / STALE model is correct and matches the code exactly.
> - **ACTIVE** → `daemon_status().running == True` AND lockdown not active
> - **LOCKDOWN** → lockdown flag active (regardless of watch state)
> - **WATCH-DOWN** → `daemon_status().running == False` AND `stale` key absent (clean stop — no PID file, or PID file cleared)
> - **STALE** → `daemon_status().running == False` AND `stale == True` (PID file present, process dead — crashed or killed externally)
> No clarification needed on the posture model; use it verbatim.

**Item summary:**

| Item | Cost | Ships alone? | Key finding |
|---|---|---|---|
| LOCK DOWN | S | yes | `lockdown on --reason "..."` CLI complete. New Tauri handler only. `LockdownActivated` audit event already emitted. |
| CLEAR LOCKDOWN | S | yes (bundle with LOCK DOWN) | `lockdown off` CLI complete. Same Tauri handler gap. `LockdownDeactivated` already emitted. |
| RESTART WATCH | S | yes (bundle with LOCK DOWN) | `watch start`/`watch stop` CLI complete. `daemon_status().stale` key derivable from watch daemon status. STALE posture already derivable. |
| Approval timeout | S–M | yes | `expires_at` hardcoded to 24h in `approvals/models.py:16`. New config entry + `approvals set-timeout <n>` CLI. Config layer state unknown — need to read `core/`. If exists: S; if not: M. |
| Default scope | M | partial | Config entry is S; meaningless until ALLOW SESSION enforcement exists. Ships in same pass as ALLOW SESSION enforcement to avoid half-wired config knob. |
| ALLOW SESSION (model/parser) | M | partial | `ApprovalScope.SESSION` constant + `--scope` parser arg + DB round-trip. Scope stored but no enforcement yet. Parser change is trivial; enforcement is separate pass. |
| ALLOW SESSION (enforcement) | M–L | no | Session registry + `PolicyEngine.decide()` hot-path modification. Session ID source (agent: `actor.session_id`; human/CLI: undefined). Session lifecycle signals not wired. |
| ALLOW PATTERN | L | no | Pattern store + engine hot-path + audit trail + pattern matching semantics (glob vs. regex, scope of match). Modifies enforcement hot path. Highest-risk item. |
| Rule mute | L | no | No `rules` CLI subcommand exists. New CLI + mute store + engine hook + listing command. Mute semantics (TTL, persistent vs. session) unresolved. Governance implications: every mute should write audit event; `rules list-muted` must bundle; TTL required. |

**Recommended ordering (verbatim):**
1. First pass: LOCK DOWN + CLEAR LOCKDOWN + RESTART WATCH + Approval timeout
2. Second pass: ALLOW SESSION (model/parser layer) + Default scope setting
3. Later: ALLOW SESSION (enforcement) → ALLOW PATTERN → Rule mute

---

### 5.4 — ai-stack / Bo

**Filed by:** ai-stack-bo-claude · 2026-06-15 · 7 items analyzed

**Option recommendation (verbatim):**

> Recommendation: (c) hybrid, with a concrete split. The key finding from this investigation is that the seven [API-NEW] items are not uniform in backend cost. Two require nothing new (client-side config). Two more need only existing Ollama HTTP API calls that Tauri's webview can reach directly today — they are marked [API-NEW] in the control surface spec but are effectively [API-EXISTS]. The remaining three genuinely require new infrastructure (management sidecar or new Tauri commands). Bundling all seven as "operational controls to defer" throws away the cheap half.

**Item summary:**

| Item | Cost | Ships alone? | Key finding |
|---|---|---|---|
| VRAM WARN threshold | S | yes | Client-side preference; no backend. Over-marked [API-NEW]. Threshold stored in Lattica local state; color change is pure render decision. |
| ALIAS MUTE | S | yes | Client-side view preference; no backend. Over-marked [API-NEW]. Visual-filter interpretation only — does NOT modify LiteLLM routing. |
| LOAD MODEL | S | yes | [API-EXISTS]. Ollama `/api/tags` + `/api/pull` + `/api/generate`; Tauri webview can call localhost:11434 directly. Frontend picker UX + fetch calls only. Model picker scope: locally-available-only for iter 5; pull-from-registry is separate. |
| UNLOAD ALL | S | yes (bundle with LOAD MODEL) | [API-EXISTS]. Ollama `/api/ps` → `keep_alive: 0` for each loaded model. Same Ollama API client as LOAD MODEL. Optimistic local VRAM gauge update recommended. |
| SLEEP TIMER (basic) | S | yes | Client-side timer + UNLOAD ALL composition. Last-inference time from polling `/api/ps` (Phase 1) or fossic `LlmCallAttempt` events (Phase 2). Works at Phase 1 with lower precision. |
| SLEEP TIMER (system-level) | M | no | ai-stack sidecar watchdog; Phase 2 fossic dep for high-precision idle. Scope: VRAM conservation even when Lattica is closed. Future enhancement; basic version covers the use case. |
| RESTART node | M | yes (option 2) / no (option 1) | Option 2 (management sidecar): ai-stack owns restart logic; Lattica calls HTTP. Option 1 (Tauri Rust backend): Lattica needs to know docker-compose path — cross-project coupling smell. Option 2 recommended. |
| FORCE FAILOVER | M (incremental S on sidecar) | yes if sidecar exists | LiteLLM native fallback config (`fallbacks` entry in `litellm-config.yaml`) + toggle endpoint in management sidecar. LiteLLM `/reload` at port 4000 already exists. External fallback endpoint is a developer configuration decision required before implementation starts. Dormant config entry can be added now without the button. |

**Recommended ordering (verbatim):**
1. Iteration 5: VRAM WARN + ALIAS MUTE + LOAD MODEL + UNLOAD ALL (one pass, zero new infrastructure)
2. Iteration 6: SLEEP TIMER (basic) + management sidecar foundation (RESTART first)
3. Iteration 7+: FORCE FAILOVER + SLEEP TIMER (system-level)

---

## §6 — Compile-Time Issues

Issues noticed at compile time. Labelled C1–C5. Recommendations are compile-level observations only; source estimates and labels are preserved verbatim in §5 and §2.

### C1 · "New cycle trigger" [API-NEW] label inaccurate on Cerebra side

Cerebra investigation recommends re-labeling as a Lattica-side IPC item. `cerebra run-cycle` already provides the CLI entry point. Cerebra's optional contribution (stdin/env goal alias, ~10–20 lines) is ergonomics, not new backend capability. The original [API-NEW] label on Cerebra suggests backend work that is not load-bearing. Recommend updating label in subsequent planning documents.

### C2 · "LOAD MODEL" and "UNLOAD ALL" [API-NEW] labels inaccurate (ai-stack)

ai-stack investigation classifies both as [API-EXISTS]. Ollama's HTTP API covers both endpoints; Tauri webview can reach localhost:11434 directly. These could be iteration 5 scope without new infrastructure. The [API-NEW] label overstates the backend work required. Recommend updating label.

### C3 · "VRAM WARN" and "ALIAS MUTE" [API-NEW] labels inaccurate (ai-stack)

Investigation confirms both are client-side preferences with no backend requirement. Labeled [API-NEW] in the original spec. No new API of any kind is needed. Recommend updating label.

### C4 · Default scope setting should not ship without ALLOW SESSION enforcement

Policy Scout investigation notes: "A setting that does nothing is worse than no setting." The config knob for default scope is meaningless until `session` scope has a working enforcement path in `PolicyEngine.decide()`. First-pass of default scope + ALLOW SESSION should be the model/parser layer only; neither should be presented as functional until enforcement ships.

### C5 · Re-settle cost is officially uncertain

LumaWeave investigation cannot confirm cost until gwells internals are audited. "Cost uncertain pending gwells audit" is the correct current label. The two outcomes are substantially different: S if gwells restart preserves node positions; M–L if it resets to seed values (which would scatter the graph — opposite of the feature's intent). Recommend the gwells audit as a lightweight prerequisite (read-only code investigation) before any Re-settle implementation planning.

---

## §7 — Snapshot Metadata

| Field | Value |
|---|---|
| Compile pass | v0.3.5v |
| Compiled by | lattica-claude |
| Compile date | 2026-06-15 |
| Source files read | cerebra/investigation.md, lumaweave/investigation.md, policy-scout/investigation.md, ai-stack-bo/investigation.md |
| Total source bytes | 56 969 |
| Items tabulated | 23 (22 from spec + 1 hidden [API-NEW] surfaced by LumaWeave) |
| Compile-time issues logged | 5 (C1–C5) |
| Cross-investigation observations | 6 (C-OBS-01 – C-OBS-06) |
| Discipline | faithful-relay-first: source estimates relayed verbatim; no items added or removed; cross-investigation observations labelled as compile-level only |
| Next action | Developer review; then §5 summaries feed iteration 5 scoping |

---

## Per-Project Investigations

### cerebra

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

---


### lumaweave

# Backend Prep Investigation — LumaWeave

**Filed by:** lumaweave-claude
**Date:** 2026-06-15
**Source [API-NEW] items:** from control surface spec — Section 11 of
`docs/coordination/design/requests/lumaweave/design-request.md`
**Note:** Investigation is optional per Lattica's relay (LumaWeave
deferred to Option B read-only tile for v1). Filed for future planning —
this is not blocking iteration 4.

---

## Context: the reverse-channel problem

All five [API-NEW] items require Lattica to send commands TO LumaWeave.
This is the inverse of the current architecture: LumaWeave emits to
fossic, Lattica reads. A command channel runs the other direction.

Before per-item analysis, the channel options must be understood since
they govern cost for every item below.

### Option A — fossic bidirectional bus

LumaWeave declares a `lumaweave/tile/commands` stream in the shared
platform fossic store. Lattica appends command events (e.g.,
`{ event_type: "SwitchSource", payload: { adapter_id: "..." } }`).
LumaWeave polls this stream at a short interval (~200ms) and applies
commands by writing to its settings store or calling gwells control APIs.
LumaWeave confirms execution by emitting a response event back to
`lumaweave/graph/events`.

**Pros:**
- Decoupled: Lattica writes events, doesn't need to know LumaWeave's
  internals
- Auditable: command history lives in fossic alongside event history
- Architecturally consistent with the event-sourcing model
- Command + response pair is the natural fossic pattern

**Cons:**
- Polling latency (~200ms round-trip minimum) — noticeable for
  interactive controls like the source switcher
- LumaWeave needs a command-poll loop running alongside event emission
- Blocked on shared platform store (the Section 8 operational flag);
  cannot build until `~/.lattica/fossic/store.db` is the confirmed path

**Hard blocker:** fossic bidirectional bus requires the shared platform
store. LumaWeave currently writes to `<project_root>/.lumaweave/fossic.db`.
This cannot be built today.

### Option B — direct Tauri IPC (as "direct IPC" was intended in Section 11)

LumaWeave and Lattica are separate OS processes (both Tauri 2 apps).
"Direct IPC" in practice means one of:
- Tauri 2 `emit_all()` / `emit_to()` — works if Lattica manages LumaWeave
  as a Tauri sidecar (LumaWeave spawned as a child); not the current model
- Unix domain socket / named pipe — LumaWeave runs an IPC server;
  Lattica connects as a client
- Shared SQLite file (a lightweight fossic, effectively) — which
  collapses back into Option A with extra steps

Honest assessment: there is no "simpler" Option B. Every concrete
implementation either requires Lattica to manage LumaWeave's process
lifecycle (sidecar model, significant arch change) or introduces custom
socket code with all its auth/framing/error-handling overhead. Option B
is NOT simpler — it's more complex than Option A for less auditability.

**Recommendation:** Option A (fossic bus) is the correct architecture.
The only reason to avoid it is the shared-store blocker. When that blocker
resolves, build Option A. Do not invest in a custom socket server.

---

## Per-item analysis

### Item: Source switcher

- **What it does:** dropdown in tile chrome lets user swap LumaWeave's
  active data source without opening LumaWeave
- **Backend work required:** (1) Reverse channel (Option A: poll
  `lumaweave/tile/commands` stream for `SwitchSource` events). (2)
  Command handler that writes `settings.sources.active` via the settings
  store on LumaWeave's side — the source-load effect follows automatically
  since `useGraphSourceSummary` already reacts to `settings.sources.active`
  changes.
- **Touching:** `src-tauri/src/` (new command-poll mechanism or Tauri
  listener), `src/graph/ingest/useGraphSourceSummary.ts` (no changes
  needed — already reactive to store), `useSettingsStore` (write
  `sources.active`)
- **Cost estimate:** M — the command receipt loop is the work; source
  switch application is trivial (1 store write). If shared store is
  already in place, closer to S.
- **Dependencies:** shared platform fossic store (hard blocker). Source
  switcher also needs the tile to know which adapters are configured —
  currently an internal LumaWeave concern. Adapter list would need to be
  emitted to a fossic stream (new event type: `AdapterListChanged`) for
  Lattica to populate the dropdown.
- **Blockers:** shared store; adapter-list emission (undiscovered
  [API-NEW] — not in the original spec)
- **Could ship in one pass alone?** no — blocked on shared store
- **Notes:** the adapter-list dependency was not in the original
  control surface spec. The dropdown cannot be populated without LumaWeave
  emitting what adapters are available. This is a hidden [API-NEW] item
  worth flagging to Lattica.

### Item: Retry

- **What it does:** `↺ RETRY` button visible only on SourceLoadFailed —
  triggers a source reload in LumaWeave
- **Backend work required:** command handler for `RetryLoad` event.
  Application is a single `settings.sources.refreshToken` increment in
  the settings store, which already triggers `useGraphSourceSummary` to
  re-run.
- **Touching:** same command receipt infrastructure as source switcher;
  `useSettingsStore` (increment `sources.refreshToken`)
- **Cost estimate:** S — once the reverse channel exists, retry is a
  one-liner. No new Rust needed.
- **Dependencies:** same reverse channel as source switcher. Ships after
  source switcher infrastructure is in place.
- **Blockers:** shared store (same as source switcher)
- **Could ship in one pass alone?** partial — trivial implementation,
  but cannot function without the shared reverse channel
- **Notes:** the cheapest [API-NEW] item by a wide margin once the
  channel is built. Should bundle with source switcher in the same pass.

### Item: Layout freeze

- **What it does:** LIVE/FROZEN toggle pauses/resumes gwells physics
  engine from the tile
- **Backend work required:** (1) Reverse channel (same as above). (2)
  Tauri command `lw_set_layout_frozen(frozen: bool)` that calls gwells
  pause/resume. (3) LumaWeave emits a `LayoutFreezeChanged` event to
  fossic so the tile state pill stays in sync with actual gwells state.
- **Touching:** `src-tauri/src/events.rs` (new Tauri command +
  `LayoutFreezeChanged` emit), `src/physics/` (gwells control API — need
  to confirm pause/resume surface; gwells already has `GWRuntimeState`
  with `paused` and `running` variants)
- **Cost estimate:** S–M — gwells pause/resume exists (`GWRuntimeState`
  already tracks it); the Tauri command surface is small. Cost is in the
  channel, same as above.
- **Dependencies:** reverse channel; gwells control surface needs review
  to confirm the right API (gwells has `pause()` equivalent but the hook
  is internal to `src/physics/`)
- **Blockers:** shared store; gwells control API audit
- **Could ship in one pass alone?** no
- **Notes:** gwells has no "settled" GWRuntimeState variant in v0.1.5
  (noted in the GraphLayoutSettled deferral), but it does have `paused`
  and `running`. Freeze/thaw maps cleanly onto these. No gwells changes
  needed, only a new Tauri command that reaches the gwells control surface.

### Item: Re-settle

- **What it does:** `⟳ SETTLE` button re-triggers gwells physics
  convergence from current node positions (resets momentum, restarts
  simulation)
- **Backend work required:** Tauri command `lw_retrigger_settle()` →
  calls gwells reset equivalent (stop + restart from current positions).
  Emits a `LayoutResettled` event so the tile knows convergence restarted.
- **Touching:** `src-tauri/src/events.rs`, `src/physics/` (gwells
  reset/restart API — need to audit whether "restart from current
  positions" is a supported mode or requires seed-position preservation)
- **Cost estimate:** S once channel exists; however there is an unknown:
  gwells restart may reset node positions to seed values rather than
  preserving current positions. If it does, Re-settle would scatter the
  graph (opposite of intent). Needs gwells internals audit before
  committing.
- **Dependencies:** reverse channel; gwells restart behavior audit
- **Blockers:** shared store; gwells audit (this is an unknown risk)
- **Could ship in one pass alone?** no — gwells audit is a prerequisite
- **Notes:** **gwells audit recommended before building this.** If gwells
  restart resets positions to seed values, this item needs gwells-level
  work to preserve or restore positions, which elevates cost to M-L. Flag
  to Lattica as "cost uncertain pending gwells audit."

### Item: Physics preset write (ORGANIC / TIGHT / SPARSE)

- **What it does:** settings panel preset selector writes a gwells
  physics configuration from the tile
- **Backend work required:** (1) Define three named preset configs
  (spring constant, repulsion, damping, etc. for each of ORGANIC / TIGHT /
  SPARSE). (2) Reverse channel command `ApplyPhysicsPreset`. (3)
  LumaWeave applies the preset by writing gwells parameters to
  `useSettingsStore`. (4) Emit `PhysicsPresetChanged` to fossic.
- **Touching:** `src-tauri/src/events.rs`, `useSettingsStore` (new
  gwells preset settings keys), `src/physics/` (preset parameter
  definitions), `src/control-plane/settings/` (schema and migration for
  new preset field)
- **Cost estimate:** M — settings schema migration + three preset
  definitions + Tauri command. Not complex but touches more files than the
  other items. Also lowest priority: physics presets affect developer
  experience, not operational state.
- **Dependencies:** reverse channel; settings store schema migration
- **Blockers:** shared store
- **Could ship in one pass alone?** no
- **Notes:** Lowest priority of the five items. Consider deferring
  indefinitely — physics presets are already adjustable in LumaWeave
  proper, and the tile's `↗ OPEN` escape hatch covers this case. Only
  valuable if users frequently adjust physics from Lattica without opening
  LumaWeave (unclear if that's a real usage pattern).

---

## Cross-project dependencies

- All five items depend on **shared platform fossic store resolution
  (Lattica + fossic)** — this is the hard blocker for Option A
- Source switcher additionally depends on **adapter-list emission**
  (new LumaWeave fossic event type: `AdapterListChanged`) — not in the
  current spec; flagged as hidden [API-NEW]
- Re-settle depends on **gwells internals audit** before cost can be
  confirmed — independent of cross-project work

---

## Recommended ordering within LumaWeave

**First pass (after shared store resolves):**
- Reverse channel infrastructure (shared across all items — build once)
- Source switcher + Retry (bundle; retry is trivial once switcher works)
- Requires: adapter-list emission as prerequisite

**Second pass:**
- Layout freeze + Re-settle (bundle; share gwells control surface)
- Requires: gwells audit on Re-settle behavior before starting

**Later / reconsider:**
- Physics preset write — low usage value; `↗ OPEN` covers the case

---

## Notes for Lattica Claude

- **Hidden [API-NEW]:** source switcher requires LumaWeave to emit
  available adapter list to fossic (so Lattica can populate the dropdown).
  This wasn't in the original control surface spec. Adds a small
  prerequisite to source switcher.
- **Re-settle cost is uncertain:** gwells restart behavior with position
  preservation is unknown. Recommend flagging as "S if position-preserving,
  M-L if not" until gwells audit happens.
- **Physics preset write is indefinitely deferrable:** the `↗ OPEN`
  escape hatch covers the gap adequately. Only worth building if user
  testing shows frequent cross-app physics adjustment.
- **Option A vs B decision is clear:** Option A (fossic bus) when shared
  store lands. No custom socket server or sidecar architecture needed.
  The shared-store blocker is the single critical path item.
- **Iteration 4 impact: none.** LumaWeave's read-only tile needs no
  backend work. This investigation is purely forward-looking for iter 5+.

---


### policy-scout

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

---


### ai-stack-bo

# Backend Prep Investigation — ai-stack / bo

**Filed by:** ai-stack-bo-claude
**Date:** 2026-06-15
**Source [API-NEW] items:** from control surface spec filed during iteration 3 review

---

## Framing: option assessment first

The outbound brief asks whether to:

- **(a) Defer all operational controls** — observability-only tile
- **(b) Build a minimal control plane** — load/unload/restart as first targets
- **(c) Some hybrid**

**Recommendation: (c) hybrid, with a concrete split.**

The key finding from this investigation is that the seven [API-NEW] items are not uniform in backend cost. Two require nothing new (client-side config). Two more need only existing Ollama HTTP API calls that Tauri's webview can reach directly today — they are marked [API-NEW] in the control surface spec but are effectively [API-EXISTS]. The remaining three genuinely require new infrastructure (management sidecar or new Tauri commands). Bundling all seven as "operational controls to defer" throws away the cheap half.

**Proposed staging:**

| Tier | Items | Why |
|---|---|---|
| Iteration 5 (low cost) | VRAM WARN, ALIAS MUTE, LOAD MODEL, UNLOAD ALL | S cost each; zero or existing backend |
| Iteration 6+ (infrastructure first) | SLEEP TIMER, RESTART, FORCE FAILOVER | M cost; need sidecar or Tauri shell-command work |

Developer priority call: ai-stack observability is "already at-par for current needs" (per outbound brief), so even the iteration 5 tier is non-urgent. This investigation is filed to support iteration 5+ planning, not to push for immediate work.

---

## Per-item analysis

### Item: VRAM WARN threshold

- **What it does:** Persist a warn threshold N% (default 80%); VRAM bar changes color when VRAM usage exceeds it
- **Backend work required:** None. The threshold is a client-side preference. Lattica's local state (Tauri's persistent storage or a local JSON config) can hold it. The VRAM data already arrives via polling (`nvidia-smi` / Ollama `/api/ps`); the color change is a pure render decision.
- **Touching:** Lattica frontend only — state store + topology renderer for the Ollama node
- **Cost estimate:** S
- **Dependencies:** None
- **Blockers:** None
- **Could ship in one pass alone?** yes
- **Notes:** This item was over-marked [API-NEW]. It needs no new API. It's a visual threshold preference stored locally. Could arguably ship in iteration 4 as client-side config if frontend-design exposes the input — but the collapsible settings panel is explicitly out of scope for iter 4, so iteration 5 is the right home.

---

### Item: ALIAS MUTE

- **What it does:** Per-alias toggle (bot-local, bot-escalated, etc.); muted aliases show dashed in topology — does NOT actually modify LiteLLM routing
- **Backend work required:** None, if interpreted as a topology view filter (which the control surface spec implies — "muted aliases show dashed in topology"). This is a client-side display preference: store which alias slugs are "muted"; topology renderer renders those edges dashed/dimmed instead of solid.
- **Touching:** Lattica frontend only — local state + topology edge renderer
- **Cost estimate:** S
- **Dependencies:** Alias list comes from LiteLLM `/v1/models` or `/model/info` polling, which is already in scope for the topology tile's data layer
- **Blockers:** None
- **Could ship in one pass alone?** yes
- **Notes:** Explicitly does NOT route LiteLLM traffic differently. If future scope wants actual routing mute (disable alias at the LiteLLM level), that's a different and larger item. This investigation addresses the visual-filter interpretation only. If the developer wants true routing mute, flag for separate spec.

---

### Item: LOAD MODEL

- **What it does:** Opens a model picker; triggers `ollama pull` if not cached, then loads model into VRAM
- **Backend work required:** Ollama already exposes all needed endpoints:
  - `GET localhost:11434/api/tags` — list models available locally (already pulled)
  - `POST localhost:11434/api/pull {"model": "<name>"}` — pull from registry if not cached
  - `POST localhost:11434/api/generate {"model": "<name>", "prompt": ""}` — loads model into VRAM (Ollama lazy-loads on first request)
  Tauri's webview can fetch `localhost:11434` without restrictions (local HTTP). No new backend is needed; the control wires to existing Ollama API directly from the frontend.
- **Touching:** Lattica frontend — model picker component + Ollama API client calls; no ai-stack files touched
- **Cost estimate:** S (the API is already there; work is frontend picker UX + fetch calls)
- **Dependencies:** Ollama must be up (guarded by STACK / Ollama node health state before enabling the button)
- **Blockers:** None. This is [API-EXISTS], not [API-NEW].
- **Could ship in one pass alone?** yes
- **Notes:** The "model picker" UX needs a design decision: show only locally-available models (from `/api/tags`), or also allow typing an Ollama registry name to pull fresh? For iteration 5, locally-available-only is simpler and avoids pull progress UX complexity. Pull-from-registry can be a separate scope item.

---

### Item: UNLOAD ALL

- **What it does:** Sends unload request to Ollama API; frees VRAM immediately
- **Backend work required:** Ollama exposes `POST /api/generate {"model": "<name>", "keep_alive": 0}` to unload a specific model from VRAM. No delete — just evicts from memory. "Unload all" means: fetch running models from `/api/ps`, then send `keep_alive: 0` for each.
  Two calls:
  1. `GET localhost:11434/api/ps` → get list of loaded models
  2. For each: `POST localhost:11434/api/generate {"model": "...", "keep_alive": 0}`
  Tauri webview can do this directly.
- **Touching:** Lattica frontend only — button action + Ollama API client
- **Cost estimate:** S
- **Dependencies:** Requires LOAD MODEL's Ollama API client to be in place (shared code — same module)
- **Blockers:** None. [API-EXISTS], not [API-NEW].
- **Could ship in one pass alone?** yes (same pass as LOAD MODEL; they share the Ollama API client module)
- **Notes:** After UNLOAD ALL completes, the VRAM gauge should update visually within the next polling cycle (~5-10s). If the polling interval is slow, consider a local optimistic update (set gauge to near-zero immediately, confirm on next poll).

---

### Item: SLEEP TIMER

- **What it does:** Auto-unload all models after N minutes of idle (0 = disabled); shows countdown
- **Backend work required:**
  - Tracking "last inference" time: Phase 2 fossic events (`LlmCallAttempt`) are the clean signal; Phase 1 requires polling Ollama `/api/ps` and watching for model activity, or relying on Bo's heartbeat for conversation activity.
  - The timer itself: a client-side interval that compares current time to last-known inference time and fires UNLOAD ALL when threshold exceeded.
  - The countdown: client-side display.
  - No ai-stack backend changes needed for a basic implementation — it's a client-side scheduler that calls the same Ollama unload API as UNLOAD ALL.
- **Touching:** Lattica frontend — timer logic + UNLOAD ALL composition
- **Cost estimate:** S for basic client-side timer; M if we want reliable cross-session persistence (timer surviving Lattica window close/reopen) or system-level enforcement (ai-stack sidecar that runs even when Lattica is not open)
- **Dependencies:** UNLOAD ALL (composes directly); Phase 2 fossic sidecar for the cleanest "last inference" signal. Works at Phase 1 via polling but with lower precision.
- **Blockers:** None for basic implementation. Phase 2 sidecar is a dependency for high-precision idle detection.
- **Could ship in one pass alone?** yes (basic client-side version); no (system-level sidecar version)
- **Notes:** The developer's use case ("keep VRAM free overnight") is well-served by the basic client-side version. System-level enforcement (timer runs even when Lattica is closed) would need the ai-stack Phase 2 sidecar to also act as a watchdog — that's a meaningful scope expansion. File as a future enhancement rather than blocking the basic version.

---

### Item: RESTART node

- **What it does:** Triggers Docker service restart for a specific degraded node (e.g., `docker compose restart ollama`)
- **Backend work required:** Tauri's frontend cannot run Docker commands directly. Options:
  1. **Tauri Rust backend command** — add a new `#[tauri::command]` in Lattica's Rust backend that shells out to `docker compose -f <path> restart <service>`. Requires modifying Lattica's `src-tauri/` (Lattica codebase work, not ai-stack).
  2. **ai-stack management sidecar** — a small Python/Bash HTTP server in ai-stack that exposes `POST /management/restart/{service}` and runs the Docker command locally. ai-stack owns this; Lattica calls it.
  3. **Tauri `shell` plugin** — Tauri v2's `tauri-plugin-shell` allows executing shell commands from the frontend directly. If already included, this reduces the Rust work.
  
  Option 2 (sidecar) is architecturally cleaner: ai-stack owns its restart logic; Lattica just makes an HTTP call. Option 1 requires Lattica to know ai-stack's docker-compose path, which is a cross-project coupling smell.
- **Touching:** Either Lattica's `src-tauri/` (option 1) or a new `management-sidecar/` in ai-stack (option 2)
- **Cost estimate:** M (either path involves new code outside the current ai-stack/bo scope; management sidecar is the cleaner M)
- **Dependencies:** None for implementation; but this is the only item that genuinely needs new infrastructure
- **Blockers:** None blocking today; needs a scoping decision on option 1 vs. option 2 before starting
- **Could ship in one pass alone?** yes (option 2 — sidecar is self-contained); no for option 1 (requires Lattica code changes)
- **Notes:** The management sidecar also becomes the natural home for FORCE FAILOVER (see below). If building, scope it to cover both. The sidecar is intentionally minimal — just HTTP endpoints that shell out to Docker and LiteLLM config operations. No database; no auth (localhost-only is the threat model for a local-first stack).

---

### Item: FORCE FAILOVER

- **What it does:** Temporarily reroutes local LiteLLM aliases to an external endpoint when Ollama is down; reverts when Ollama recovers
- **Backend work required:** LiteLLM's routing config is in `litellm/litellm-config.yaml`. Two approaches:
  1. **Manual config edit + reload:** modify the yaml to add/change the fallback upstream for the affected alias; call `POST localhost:4000/reload` to apply. LiteLLM supports runtime config reload.
  2. **LiteLLM native fallback:** LiteLLM's config supports `fallbacks` natively — if the primary model returns 503, it automatically routes to the fallback. If configured upfront, failover becomes automatic (no button needed). The button would just toggle a pre-configured fallback rule on/off.
  
  Option 2 (native fallback) is architecturally superior and makes the "button" a simple config toggle rather than a live config editor. The prerequisite: add a `fallbacks` entry to `litellm-config.yaml` pointing `bot-local → claude-haiku-4-5-20251001` (or similar) as the external fallback. Then the toggle activates/deactivates that entry.
  
  Requires either the management sidecar (see RESTART) or direct file manipulation + LiteLLM reload call.
- **Touching:** `litellm/litellm-config.yaml` (add fallback entry now); management sidecar (for toggle at runtime); or manual config edit is the Phase 1 fallback
- **Cost estimate:** M (shares sidecar infrastructure with RESTART; incremental cost on top of RESTART is S)
- **Dependencies:** RESTART's management sidecar (or Tauri shell plugin) — shares infrastructure. LiteLLM must be running for `/reload` to work.
- **Blockers:** Need to decide what the external fallback endpoint is (Anthropic direct? A specific model alias?) — that's a developer configuration decision, not a code question.
- **Could ship in one pass alone?** yes, if management sidecar exists; no otherwise
- **Notes:** The fallback entry in `litellm-config.yaml` can be added as a dormant config change now (iteration 4 or 5) without the button — just document the manual procedure. The button enables/disables it at runtime without editing the file. This is a good candidate for "add the config entry now, build the button when the sidecar exists."

---

## Cross-project dependencies

- **LOAD MODEL, UNLOAD ALL** — no cross-project deps; direct Ollama API calls from Lattica frontend
- **SLEEP TIMER** — soft dependency on ai-stack Phase 2 fossic sidecar for high-precision idle detection; basic version has no cross-project dep
- **RESTART node** — if using management sidecar (option 2): no Lattica dep; ai-stack owns the sidecar; Lattica calls it via HTTP. If using Tauri shell plugin (option 1): requires Lattica codebase change.
- **FORCE FAILOVER** — shared infrastructure with RESTART sidecar; LiteLLM config.yaml edit (ai-stack codebase); LiteLLM `/reload` endpoint (already exists at port 4000)
- **VRAM WARN, ALIAS MUTE** — no cross-project deps

---

## Recommended ordering within ai-stack/bo

### First pass (iteration 5)

1. **VRAM WARN threshold** — S, pure client-side config, zero backend
2. **ALIAS MUTE** — S, pure client-side view preference, zero backend
3. **LOAD MODEL + UNLOAD ALL** — S, one pass covering both (shared Ollama API client); these are the highest operational value items at lowest cost

Rationale: these four items cost one pass and deliver the two most frequently-needed operational actions (load a model, free VRAM) plus the two client-side config items. No new infrastructure required.

### Second pass (iteration 6)

4. **SLEEP TIMER** — basic client-side version (S), composes UNLOAD ALL
5. **management sidecar foundation** — M, scoped to RESTART first; the sidecar is the prerequisite for FORCE FAILOVER too

### Later (iteration 7+)

6. **FORCE FAILOVER** — builds on sidecar + requires developer decision on external fallback endpoint
7. **SLEEP TIMER system-level** — ai-stack watchdog version, if developer needs VRAM conservation even when Lattica is closed

---

## Notes for Lattica Claude

**Surprising findings:**

- **LOAD MODEL and UNLOAD ALL are effectively [API-EXISTS]**, not [API-NEW]. Ollama's HTTP API covers both; Tauri's webview can call localhost:11434 directly. These could be iteration 5 scope without any new backend infrastructure.
- **VRAM WARN and ALIAS MUTE need no backend at all.** They were over-marked. Both are client-side preferences that the frontend can implement with local state.

**Non-obvious complexity:**

- **RESTART via Tauri Rust backend** creates a cross-project coupling (Lattica's `src-tauri/` needs ai-stack's docker-compose path). The management sidecar pattern is the right architectural boundary — ai-stack owns its restart API. This is a scope/ownership decision, not a technical blocker.
- **FORCE FAILOVER depends on a developer configuration decision** (what's the external fallback endpoint?). Code is ready to build once that's answered; don't start implementation until the config question is answered.

**Indefinite deferral candidates:**

- None of the items are clearly "never build." RESTART and FORCE FAILOVER are M cost with management sidecar; the question is priority, not feasibility.

**Hidden cross-cutting value:**

- The **management sidecar** (needed for RESTART + FORCE FAILOVER) becomes the natural home for future ai-stack operational APIs — health probes, model management, LiteLLM config management. Building it cleanly in iteration 6 gives a reusable foundation for anything else that needs to interact with ai-stack services programmatically.
- **SLEEP TIMER** has value proportional to how often the developer runs heavy models that they forget to unload. If the RTX 4070 Super's 12 GB is routinely constrained, this pays for itself immediately. If VRAM is rarely the bottleneck, low urgency.

**Recommended iteration 5 scope signal:**

Given that observability is already at-par, the first-pass items (VRAM WARN, ALIAS MUTE, LOAD MODEL, UNLOAD ALL) are the ones worth surfacing as "these are surprisingly cheap and deliver real operational value." The remaining three can wait until the management sidecar is a prioritized scope item.

---

