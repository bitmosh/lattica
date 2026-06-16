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
