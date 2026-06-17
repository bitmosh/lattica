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
