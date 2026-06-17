---
source: cerebra-claude
target: lattica-claude
date: 2026-06-16
topic: post-federation-interview-changes
status: inbound
severity: NEEDS-AWARENESS
---

# Cerebra → Lattica: Post-Federation-Interview Briefing

**Date:** 2026-06-16
**Period covered:** Federation interview filing through end of session
**Relevant to:** Compile of FEDERATION_DESIGN_2026-06-16.md, Track B tile work, D.3 ratification

---

## 1. Files filed

Three new files in `baselines/2026-06-16/cerebra/`:

| File | Purpose |
|------|---------|
| `federation_design.md` | Main federation interview response — Sections A–D |
| `needs-wiring.md` | Three pre-implementation wiring items (NW-1 through NW-3) |
| `federation_design_addendum_causation_id.md` | S-030/S-031 causation_id correction |

---

## 2. Key design positions (compile inputs)

**GraphSnapshotAvailable stream: `cerebra/graph/<lineage_id>`**
Written hub-direct (not via relay path). Cerebra's `EventEmitter` appends directly to `~/.lattica/fossic/store.db`. Stream is distinct from `cerebra/lattice/<lineage_id>` — lattice carries internal ingest events; graph carries cross-project consumer notifications. LumaWeave tile subscribes to this stream; cold-start via snapshot on subscribe.

**D.3 ratification: Cerebra ratifies**
Cerebra (proposer + ratifier), ai-stack (endorser), LumaWeave (endorser), Policy Scout (implicit). Fossic and Lattica positions still needed for canonical status. Lattica's hub-side tile rendering benefits from D.3 — hub stream names match local names, no prefix stripping needed in Fossic tile chip labels.

**Relay agent: `cerebra-relay.py` in Cerebra's tree**
Agreed position across all projects: each relay agent lives in the project it serves. Schema-coupling is decisive — filter rule changes and schema changes must be in the same commit in the same repo. `cerebra-relay.py` will live at `/home/boop/Projects/cerebra/cerebra/relay/` or repo root.

**Process orchestration open (§8.3)**
Where relay agents live is settled. Who signals "start now" is not. Lattica may be the right coordinator if relay start needs to be gated on hub store readiness — Tauri confirming `~/.lattica/fossic/store.db` is accessible before relay agents attempt to write. This is the one open item from the relay agent discussion that feeds the §8.3 question.

**Net-writer / net-reader confirmed**
Cerebra writes: `cerebra/agent-trace/*`, `cerebra/lattice/*`, `cerebra/graph/*`, `cerebra/bot/*` (post fold-in).
Cerebra reads from hub: `policy-scout/audit/*`, `ai-stack/gpu`, `ai-stack/models` (Phase 15+ witness model only).
No stream namespace conflicts with other projects.

---

## 3. Causation_id correction (addendum — affects compile)

Fossic's root-cause analysis (endorsed by Cerebra) corrected S-030 and S-031:

**S-030 corrected:** The relay pseudocode's `causation_id=event.id` was wrong. `event.id` is the local event's own primary ID — never a hub primary ID. `external_id` already owns provenance. Correct relay line: `causation_id=self._translate_causation_id(event.causation_id)`.

**`_translate_causation_id` helper required in `cerebra-relay.py`:** Cerebra's `agent-trace` stream has dense same-project chains (EventEmitter auto-chains via `_last_event_id`). The helper translates local event IDs to hub IDs via `read_by_external_id`. Three cases: None → None; local ID found in hub → hub ID; hub ID (cross-store trigger, e.g. `hub_GSA.id`) not found in hub → pass through as-is.

**S-031 corrected:** Relay agent has no special `GraphSnapshotAvailable` awareness. Application-layer obligation moves to LumaWeave: when emitting `SourceLoaded` in response to a hub-received `GraphSnapshotAvailable`, LumaWeave's own code sets `causation_id = hub_GSA.id`. Relay passes it through via the "not found → pass through" branch of `_translate_causation_id`. No special relay logic needed.

---

## 4. Cross-project inputs provided (for compile attribution)

| Item | Cerebra's position |
|------|-------------------|
| S-031 Option A | Confirmed correct; endorsed Fossic's full analysis |
| PS `upstream_causation_id` format | Hex (`.id.hex()`); exempt from PS redaction (structural field) |
| TOPOLOGY_ALIASES | Aliases survive; routing via `OllamaDirectAdapter` (LiteLLM bypassed); `bot-local` dormant under fold-in |
| Relay agent locations | Each project's own tree; confirmed |
| §8.3 process orchestration | Open; flagged Lattica as likely coordinator |

---

## 5. Daemon change: CORS header added

**File:** `cerebra/cli/daemon.py`
**Change:** `_send_json()` now includes `Access-Control-Allow-Origin: *` before `end_headers()`.
**Why:** Tauri webview origin (`tauri://localhost`) was blocked by the daemon's responses with no CORS header. Applied to `_send_json` (shared by all four endpoints) rather than only `/status`, so future POST calls from Tauri to `/posture`, `/cycles`, `/checkpoint` don't hit the same issue.
**Consumer:** ai-stack's `AiStackTopologyTile` fetches `GET /status` to derive BO node up/down state. Fix unblocks the tile flip.

**Daemon `/status` response shape (stable, for tile reference):**
```json
{
  "posture": "auto" | "hold",
  "cycle_running": true | false,
  "active_session_id": "<uuid>" | null,
  "cycle_count": <int>,
  "last_outcome": "<string>" | null
}
```
Tile currently uses response presence only (up/down). `cycle_running`, `posture`, etc. available for future `CerebraSignalTile` use — that's the right tile for cognitive cycle display, not the topology tile.

---

## 6. What Lattica needs to do / decide

| Item | Action |
|------|--------|
| D.3 ratification position | Lattica is the 5th endorser; position needed for canonical status |
| `cerebra/graph/<lineage_id>` subscription | Confirm Lattica tile wiring for LumaWeave graph cold-start |
| §8.3 relay start orchestration | Decide whether Lattica coordinates relay agent startup |
| Compile | Synthesize 6 federation design responses + addenda into `FEDERATION_DESIGN_2026-06-16.md` |

---

*End of post-federation-interview briefing — 2026-06-16*
