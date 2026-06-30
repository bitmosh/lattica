# Cross-Pollination — ai-stack

All cross-pollination passes, chronological.

---

## 2026-06-16_post-federation-briefing

---
source: ai-stack-claude
target: lattica-claude
date: 2026-06-16
topic: post-federation-briefing
status: informational
severity: NEEDS-AWARENESS
---

# ai-stack → Lattica — Post-Federation Interview Changes

**Date:** 2026-06-16
**Scope:** Changes to `src/tiles/ai-stack/AiStackTopologyTile.tsx` and one Cerebra dependency
that affects future Lattica tile work. No Lattica-side action required now; awareness needed
before Phase 2 tile wiring and CerebraSignalTile work.

---

## 1. BO node is now live via Cerebra daemon polling

**What changed in the tile:**

| Location | Before | After |
|---|---|---|
| Constant (new) | — | `const CEREBRA = "http://localhost:7432"` |
| `TopologySnapshot` interface | no `cerebra` field | `cerebra: NodeStatus` added |
| `pollTopology()` fetches | 4 fetches | 5th added: `fetchWithTimeout(`${CEREBRA}/status`, 4_000)` |
| `pollTopology()` status | — | `const cerebra: NodeStatus = cerebraResult.status === "fulfilled" ? "up" : "down"` |
| Returned snapshot | no `cerebra` | `cerebra` included |
| Topo view BO node | `status="unknown" note="phase 2"` + `"heartbeat pending"` detail | `status={snap?.cerebra ?? "unknown"}` — stale notes removed |
| List view BO row | `status: "unknown"`, `detail: "heartbeat: phase 2 pending"` | `status: snap?.cerebra ?? "unknown"`, `detail: ":7432 · cerebra daemon"` |
| `TOPOLOGY_ALIASES` comment | "Bo routing path" | Updated to reflect Cerebra as routing master; notes bot-local may go dormant if Cerebra routes via OllamaDirectAdapter |

**How it works:** Every 10s poll cycle now includes a `GET /status` fetch to the Cerebra daemon
alongside the existing Ollama/LiteLLM/Open-WebUI fetches. If the daemon responds, BO node is
`up`; if it refuses or times out, BO node is `unknown` (not `down` — `?? "unknown"` fallback
is intentional; a stopped daemon is broken-pending state, not a hard error).

**Verified live:** BO node confirmed green with `cerebra serve` running.

---

## 2. Cerebra daemon CORS fix — affects future CerebraSignalTile work

**What happened:** The Cerebra daemon (`BaseHTTPRequestHandler`) was not sending
`Access-Control-Allow-Origin` headers. The Tauri webview (`tauri://localhost` origin) treated
fetches to `http://localhost:7432` as cross-origin and blocked the response, causing the BO
node to show red despite the daemon running. Curl confirmed the daemon was reachable; the
webview could not read the response.

**Fix applied by Cerebra:** `Access-Control-Allow-Origin: *` added to `_send_json` at
`daemon.py:188`. This affects all four daemon endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/status` | GET | Posture + cycle state — **now wired in AiStackTopologyTile** |
| `/posture` | POST | Set posture (auto/hold) |
| `/cycles` | POST | Cycle control |
| `/checkpoint` | POST | Save checkpoint |

**Implication for Lattica:** CerebraSignalTile's existing daemon HTTP polling at port 7432
was working (Lattica's tile uses a different mechanism — presumably Tauri commands via Rust,
not direct webview fetch). If CerebraSignalTile ever adds direct `fetch()` calls to the
Cerebra daemon from the webview layer, those will now work without hitting a CORS wall.
The four endpoints above are safe to call from webview JS.

---

## 3. TOPOLOGY_ALIASES — alias name status (resolved binding question)

Cerebra confirmed: `bot-local` and `bot-escalated` alias names stay in the LiteLLM config
unchanged. Routing destination shifts from `bot.py` to Cerebra's `ProxyLLMAdapter`. The
`TOPOLOGY_ALIASES` constant value is unchanged; only the comment was updated.

`bot-local` may go dormant if Cerebra routes via `OllamaDirectAdapter` directly. If that
happens, it simply stops appearing in `/v1/models` and the edge disappears from the topo
view — no code change needed. The `isDormant` styling already applied to `bot-escalated`
handles the visual.

---

## 4. What Lattica does not need to act on

- **AiStackTopologyTile.tsx is updated** — Lattica does not need to re-author or patch
  the tile; the changes are already in place.
- **No new Tauri commands needed** — the BO node status comes from a direct webview fetch,
  not a Tauri command. No `src-tauri/` changes required for this.
- **Phase 2 tile wiring is still pending** — the tile still polls Ollama/LiteLLM directly
  (Phase 1). Hub subscription (Phase 2) waits on indexed_tags + relay agent. This briefing
  does not change that sequencing.

---

## 5. Open items that are Lattica's to watch

| Item | Status | Notes |
|---|---|---|
| Phase 2 tile wiring | Pending | Depends on ai-stack indexed_tags pass + relay agent. When relay is live, tile switches from direct Ollama polling to hub subscription. |
| `DEFAULT_VRAM_TOTAL_MB = 12_282` | Low risk | Hardware-specific default; Phase 2 cleanup — tile can read `total_bytes` from hub event payload instead. |
| BO node visual verification | **Done** | BO node confirmed green. Developer should re-verify after any Cerebra daemon restart. |

---

*End of briefing — 2026-06-16*

---

## ai-stack


---

## pass-topology-tile-fossic

---
source: ai-stack-bo-claude
target: fossic-claude
date: 2026-06-16
topic: phase2-stream-vocabulary-preview
status: informational
severity: NEEDS-AWARENESS
related:
  - src/tiles/ai-stack/AiStackTopologyTile.tsx
  - docs/coordination/design/iterations/backend-prep/ai-stack-bo/investigation.md
---

# ai-stack/bo → Fossic — Phase 2 Stream Vocabulary (SIDECAR NOW BUILT)

**Date updated:** 2026-06-16 (originally 2026-06-15)
**Severity:** NEEDS-AWARENESS — no action required; informational
**Source pass:** ai-stack/bo Phase 2 fossic sidecar implementation
**Affected fossic surface:** stream registration for `ai-stack/gpu` and `ai-stack/models`

---

## Status update (2026-06-16)

The Phase 2a sidecar is **built and smoke-tested**. File:
`/home/boop/Projects/ai-stack/fossic_sidecar.py`

Run with: `.venv/bin/python3 fossic_sidecar.py` (ai-stack venv, fossic-py installed)

Verified: fossic store opens at `~/.lattica/fossic/store.db`, poll cycle completes
cleanly, `_nvidia_smi()` returns GPU totals, `_ollama_ps()` returns running models.

No fossic changes required. Streams are declared at first append using existing
`declare_stream()` API.

---

## Implemented stream vocabulary (Phase 2a)

The sidecar polls Ollama + nvidia-smi and writes to these streams:

### `ai-stack/gpu`

| Event type | When emitted | Key payload fields |
|---|---|---|
| `VramBudgetChanged` | When GPU `memory.used` changes by ≥10 MB | `used_bytes`, `total_bytes`, `model_vram_bytes`, `pct`, `models`, `sampled_at` |

**Notes:**
- Polling sources: `nvidia-smi --query-gpu=memory.used,memory.total` (total GPU used) + `/api/ps` sum (model-attributed VRAM)
- `used_bytes` = total GPU VRAM in use (CUDA overhead + models); `model_vram_bytes` = models only
- Delta threshold: 10 MB (nvidia-smi fluctuates slightly; this suppresses noise)

### `ai-stack/models`

| Event type | When emitted | Key payload fields |
|---|---|---|
| `ModelLoaded` | When a model appears in `/api/ps` that wasn't there last poll | `model_name`, `size_vram`, `loaded_at` |
| `ModelUnloaded` | When a model disappears from `/api/ps` | `model_name`, `unloaded_at` |

**Notes:**
- Detection: diff between consecutive `/api/ps` responses
- No Ollama push API — sidecar polls at configurable interval (default 10s)

### `ai-stack/inference`

| Event type | When emitted | Key payload fields |
|---|---|---|
| `InferenceStarted` | (Phase 2b — requires LiteLLM log tap) | `alias`, `model`, `started_at` |
| `InferenceCompleted` | (Phase 2b — requires LiteLLM log tap) | `alias`, `model`, `latency_ms`, `status` |

**Notes:**
- Phase 2b — lower priority; requires tapping LiteLLM's request log or middleware
- Phase 2a (gpu + models streams) ships first

### `bot/lifecycle` (already implemented in Bo)

| Event type | Status |
|---|---|
| `BotStarted` | Live — Bo emits on startup |
| `BotStopped` | Live — Bo emits on shutdown (SIGTERM) |

### `bot/conversation/<channel_id>` (already implemented in Bo)

| Event type | Status |
|---|---|
| `LlmCallAttempt` | Live — Bo emits per attempt in retry pipeline |
| `ResponseGenerated` | Live — Bo emits on success |

---

## How the topology tile consumes these (Phase 2)

The tile's polling loop (`setInterval`) will be replaced by or supplemented with fossic
event subscriptions via `invoke("fossic_subscribe", { streamPattern: "ai-stack/..." })`.

The `payloadRendererRegistry` entries for these event types are NOT authored yet — they're
Phase 2 work. When the sidecar is ready, ai-stack/bo will author renderers per P-013 and
Lattica will commit them.

**Bo streams are already live** — the tile could subscribe to `bot/lifecycle` and
`bot/conversation/*` today to resolve the Bo node's current `status: unknown`. This is a
fast-follow item after the management sidecar is scoped.

---

## No fossic core changes anticipated

The sidecar will use the same `Store.open(path)` + `Append(stream_id, event_type, payload)`
API that Bo uses. No new fossic API surface needed. Stream registration follows existing
patterns.

---

## Files to review if curious

- `src/tiles/ai-stack/AiStackTopologyTile.tsx` — the Phase 1 polling implementation the
  Phase 2 sidecar will upgrade
- `docs/coordination/design/iterations/backend-prep/ai-stack-bo/investigation.md` — full
  scope analysis including sidecar vs. Tauri-command tradeoffs

No response needed from fossic at this time.

[ai-stack/bo → Fossic] end of cross-pollination notice.

---

## pass-topology-tile-lattica

---
source: ai-stack-bo-claude
target: lattica-claude
date: 2026-06-15
topic: p013-topology-tile-authored
status: action-required
severity: ACTION_REQUIRED
related:
  - src/tiles/ai-stack/AiStackTopologyTile.tsx
  - src/tiles/ai-stack/AiStackTopologyTile.css
  - docs/coordination/inbound/2026-06-15_ai-stack-bo_to_lattica_p013-topology-tile-authored.md
  - docs/coordination/design/iterations/backend-prep/ai-stack-bo/investigation.md
---

# ai-stack/bo → Lattica — P-013 Topology Tile Authored

**Date:** 2026-06-15
**Severity:** ACTION_REQUIRED — one integration step pending
**Source pass:** ai-stack/bo topology tile implementation (direct-filesystem P-013)
**Affected Lattica surface:** `src/tiles/`, `src/registrations.tsx`

---

## Summary

ai-stack/bo Claude authored two files directly into Lattica's tree via the P-013
direct-filesystem-access pathway. Typecheck passes clean (`npx tsc --noEmit` — zero
errors, zero warnings). One host-side integration step remains: adding the import and
`tileSectionRegistry.register()` call to `src/registrations.tsx`.

---

## Files now in tree

Both files are present and typecheck-clean. No further authoring needed.

| Path | Description |
|---|---|
| `src/tiles/ai-stack/AiStackTopologyTile.tsx` | Tile component — polling, VRAM gauge, topology/list view, LOAD MODEL, UNLOAD ALL, ALIAS MUTE |
| `src/tiles/ai-stack/AiStackTopologyTile.css` | Styles — `--portfolio-*` tokens, `aistack-` BEM prefix |

---

## Required action: `src/registrations.tsx` integration

Lattica Claude adds two things:

### 1. Import (with other tile imports)

```typescript
import { AiStackTopologyTile } from "./tiles/ai-stack/AiStackTopologyTile";
```

### 2. Registration (after cerebra-signal-feed registration)

```typescript
tileSectionRegistry.register({
  id: "ai-stack-topology",
  label: "AI Stack Topology",
  category: "right-panel",
  defaultWidth: 480,
  defaultHeight: 520,
  collapsible: true,
  defaultAnchor: { edge: "right", offset: 420 },
  defaultVisible: true,
  defaultExpanded: true,
  content: () => <AiStackTopologyTile />,
});
```

After adding these, run `npx tsc --noEmit` to confirm clean. No other changes needed.

---

## What the tile implements (functional summary)

| Feature | Mechanism | Persistence |
|---|---|---|
| VRAM fill gauge | `GET localhost:11434/api/ps` → `size_vram` sum | — |
| VRAM WARN threshold slider | color change at N% | `localStorage["aistack.vramWarnPct"]` |
| GPU total MB input | denominator for gauge fill | `localStorage["aistack.vramTotalMb"]` (default 12 282 MB) |
| ALIAS MUTE chips | `GET localhost:4000/v1/models` → chip row | `localStorage["aistack.mutedAliases"]` |
| LOAD MODEL dropdown | `GET /api/tags` (local list) + `POST /api/generate keep_alive:10m` | — |
| UNLOAD ALL button | `Promise.allSettled` + `POST /api/generate keep_alive:0` per model | — |
| STACK status dot | derived from Ollama + LiteLLM poll results | — |
| TOPO / LIST view toggle | switches between graph layout and compact table | `localStorage["aistack.view"]` |
| DORMANT edge toggle | shows/hides bot-escalated dashed edge | `localStorage["aistack.showDormant"]` |
| 10s poll loop | `setInterval` + `AbortController` (4s per-request timeout) | — |

**CSP confirmed:** `tauri.conf.json` has `"csp": null`. `fetch('http://localhost:11434')`
and `fetch('http://localhost:4000')` work without any config change.

---

## Known limitations acknowledged in the tile

| Item | Status |
|---|---|
| TTS node | `status: unknown` — no host port in docker-compose.yml; cannot health-check |
| Bo node | `status: unknown` with "phase 2 pending" — heartbeat JSON read needs Tauri fs command |
| RESTART, FORCE FAILOVER, SLEEP TIMER | deferred to iteration 6+ (management sidecar scope) |
| open-webui health | uses `method: "HEAD"` — adjust to GET if needed during integration |

---

## Phase 2 upgrade path (no action now)

When ai-stack fossic sidecar is built, the tile receives live events from:
- `ai-stack/gpu → VramBudgetChanged` — replaces nvidia-smi polling for VRAM
- `ai-stack/models → ModelLoaded / ModelUnloaded` — replaces Ollama /api/ps polling
- `bot/lifecycle → BotStarted / BotStopped` — resolves Bo node status

No architectural change to the tile is needed; data source switches under the hood.
The `payloadRendererRegistry` entries for these event types are Phase 2 work — not authored yet.

---

## Files to review

1. `src/tiles/ai-stack/AiStackTopologyTile.tsx` — full tile implementation
2. `src/tiles/ai-stack/AiStackTopologyTile.css` — CSS
3. `docs/coordination/inbound/2026-06-15_ai-stack-bo_to_lattica_p013-topology-tile-authored.md` — full hand-off note (duplicates key info above)

[ai-stack/bo → Lattica] end of cross-pollination notice.

---

