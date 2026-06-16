---
pass: 0.3.5u
version: v0.3.5u
sha: 75f4a9b
date: 2026-06-16
summary: Iteration 5 Track A functional wiring — Lattica src-tauri Tauri commands for Policy Scout CLI, Cerebra daemon connection + cerebra/control subscription + state derivation + placeholder UI, CheckpointSavedRenderer registration; four-phase smoke verification
---

# Blast Radius — Pass 0.3.5u (v0.3.5u)

First pass where the platform runs all pieces together. Functional wiring across three
code tracks plus end-to-end smoke verification. Developer-approved after pre-review pause.

## Why this matters

The backend-prep investigation round (v0.3.5w) plus per-project work (Cerebra daemon,
Policy Scout LOCK DOWN bundle, ai-stack tile via P-013) all produced code that didn't yet
talk to each other. This pass connects the pieces.

Discipline: functional correctness now, visual polish in iter-4. Every new UI element is
a placeholder treatment awaiting iter-4 design output.

## Files

### Created (Lattica-authored)
- `src/tiles/cerebra-signal/daemon.ts` — daemon connection module (daemonUrl, getStatus, setPosture, triggerCheckpoint)
- `src/tiles/cerebra-signal/state.ts` — agent state derivation (AgentState, deriveAgentState)
- `docs/coordination/outbound/2026-06-16_lattica_to_cerebra_track-a-wired.md`
- `docs/coordination/outbound/2026-06-16_lattica_to_policy-scout_track-a-wired.md`
- `docs/coordination/outbound/2026-06-16_lattica_to_ai-stack-bo_track-a-wired.md`
- `docs/coordination/outbound/2026-06-16_lattica_to_lumaweave_track-a-status.md`
- `docs/coordination/outbound/2026-06-16_lattica_to_fossic_cerebra-phase10.md` (route)
- `docs/aseptic/blast-radius/pass-0.3.5u.md` — this file

### Modified (Lattica-authored)
- `src-tauri/src/lib.rs` — `use std::process::Command`; `CliJsonResponse` struct; `run_cli_json()` + `validate_reason()` helpers; `activate_lockdown`, `deactivate_lockdown`, `restart_watch` Tauri commands; all registered in `invoke_handler!`
- `src/tiles/cerebra-signal/CerebraSignalTile.tsx` — 30s daemon health poll; `cerebra/control` explicit subscribe; state derivation; OFFLINE pill placeholder; Checkpoint button placeholder; HOLD toggle placeholder
- `src/registrations.tsx` — `CheckpointSavedRenderer` import + `registerPayloadRenderer()` call
- `docs/aseptic/POLISH_DEBT.md` — PD-002 (Cerebra tile chrome placeholder treatments)
- `docs/aseptic/README.md` — bumped to v0.3.5u
- `docs/coordination/mail_routing.md` — Phase 10 route entries + Pass v0.3.5u section

### Absorbed (authored by project Claudes, committed by Lattica host)
- `src/renderers/cerebra/CheckpointSavedRenderer.tsx` — Cerebra Claude (P-013)
- `src/renderers/cerebra/CheckpointSavedRenderer.css` — Cerebra Claude (P-013)
- `docs/coordination/cross-pollination/cerebra/phase10-lattica.md` — Cerebra (status: closed)
- `docs/coordination/cross-pollination/cerebra/phase10-fossic.md` — Cerebra (routed to Fossic)
- `docs/coordination/cross-pollination/cerebra/daemon-v1-lattica.md` — status: inbound-acknowledged
- `docs/coordination/current-states/cerebra/current_state.md` — Cerebra v0.4.0 snapshot
- `docs/coordination/current-states/fossic.md` — Fossic current state (new commands, API surface)
- `docs/coordination/inbound/2026-06-15_lattica_to_lumaweave_backend-prep-compiled.md`
- `docs/coordination/inbound/2026-06-16_cerebra_to_lattica_phase10-loop-closure.md`

## Smoke verification results

**Phase A (Build): PASS**
- `npx tsc --noEmit` — zero errors
- `cargo check` — zero errors, Finished dev profile
- `npm run build` — clean, 574ms, 55 modules

**Phase B (Cerebra daemon): PARTIAL**
- Daemon starts and all endpoints respond correctly via venv binary
- `GET /status` → DaemonStatus shape confirmed; `POST /posture` toggle confirmed; `POST /checkpoint` → expected "no active session" error confirmed
- Daemon offline detection confirmed: curl exit 7 → `getStatus()` returns null → OFFLINE path
- ISSUE (pre-existing, not introduced here): `/home/boop/.local/bin/cerebra` uses `#!/usr/bin/python3`; fossic module not found. Must invoke via `/home/boop/Projects/cerebra/.venv/bin/cerebra`. Cerebra current-state notes a PATH fix was applied — may need re-applying on this machine.
- Tauri webview visual inspection: MANUAL REQUIRED

**Phase C (ai-stack tile): DEGRADED**
- Ollama reachable; LiteLLM not reachable
- Tile registration confirmed in code; visual inspection MANUAL REQUIRED

**Phase D (Lockdown CLI): PASS (Option 2 — direct CLI)**
- `activate_lockdown` → `{"ok":true,"active":true,"reason":"smoke test v0.3.5u"}` ✅
- `deactivate_lockdown` → `{"ok":true,"active":false}` ✅
- `CliJsonResponse` struct shape confirmed correct

## Living report updates

- `POLISH_DEBT.md` PD-002 added: Cerebra tile chrome placeholder visual treatments (OFFLINE pill, Checkpoint button, HOLD toggle). Trigger: iter-4 design output.

## Adjacent project impact

- Cerebra: daemon now wired; CheckpointSavedRenderer registered; cerebra/control subscribed; PATH issue noted
- Policy Scout: three Tauri commands shell-executing lockdown/watch CLI; smoke confirmed
- ai-stack-bo: tile registered; building clean; visual inspection manual-required
- LumaWeave: items still blocked on shared store; gwells audit acknowledged
- Fossic: Phase 10 Cerebra cross-pollination routed; current-state absorbed (new commands noted for future use)
