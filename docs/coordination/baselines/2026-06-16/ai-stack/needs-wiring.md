# ai-stack — Needs Wiring / Hard-coded Values Log

**Date:** 2026-06-16
**Filed by:** ai-stack-claude
**Purpose:** Catalogue hard-coded values and binding ambiguities in ai-stack and ai-stack-authored Lattica files.

---

## 1. TOPOLOGY_ALIASES hardcoded Set

**Element / binding location:**
`TOPOLOGY_ALIASES = new Set(["bot-local", "bot-escalated"])`
`src/tiles/ai-stack/AiStackTopologyTile.tsx:42`

**Assumed correct token/variable:**
Aliases named `bot-local` and `bot-escalated` in LiteLLM routing config. Used to filter which LiteLLM aliases render as graph edges in the topology view.

**Who needs to confirm:**
~~Cerebra-claude~~ — **ANSWERED 2026-06-16.** Aliases stay in LiteLLM config unchanged. Routing destination shifts from `bot.py` to Cerebra's `ProxyLLMAdapter`. `bot-local` may go dormant if Cerebra routes via `OllamaDirectAdapter` directly; `bot-escalated` stays relevant if escalation path uses LiteLLM. Cerebra will confirm routing path before fold-in implementation. No ai-stack config change needed.

**Confidence level:**
HIGH — alias names confirmed stable by Cerebra. Tile comment updated; constant unchanged.

**Brief context:**
The tile fetches all LiteLLM aliases dynamically via `/v1/models`, then filters to those in `TOPOLOGY_ALIASES` for edge rendering. If `bot-local` becomes dormant (removed from LiteLLM config), it simply won't appear in `snap.aliases` and no edge will render — the tile handles this gracefully without code changes. The `isDormant` styling on `bot-escalated` (tile line ~415) remains appropriate. Tile comment updated to reflect Cerebra as routing master.

---

## 2. DEFAULT_VRAM_TOTAL_MB hardcoded

**Element / binding location:**
`const DEFAULT_VRAM_TOTAL_MB = 12_282`
`src/tiles/ai-stack/AiStackTopologyTile.tsx:38`

**Assumed correct token/variable:**
VRAM total for NVIDIA GeForce RTX 4070 Super = 12,282 MB (from nvidia-smi). Comment in code documents the hardware.

**Who needs to confirm:**
Developer — confirms this machine's GPU. Can be overridden at runtime via `localStorage["aistack.vramTotalMb"]`.

**Confidence level:**
HIGH — verified against `nvidia-smi` output in sidecar log (12282 MB confirmed at 2026-06-16 10:32:49). Override mechanism exists. Low risk.

**Brief context:**
Ollama does not expose total VRAM via API; nvidia-smi is the authoritative source. The sidecar has access to nvidia-smi and already captures `total_bytes` in `VramBudgetChanged` events. Under Phase 2 tile wiring (hub subscription), the tile could read `total_bytes` from the hub event payload instead of using this constant — eliminating the hardcoded value entirely. Flagged as a Phase 2 cleanup opportunity.

---

## 3. BO node stale references in tile

**Element / binding location:**
- `NodeCard name="BO"` in topo view: `AiStackTopologyTile.tsx:409`
- `{ key: "bo", name: "BO", status: "unknown", detail: "heartbeat: phase 2 pending" }` in list view: `AiStackTopologyTile.tsx:311`
- `"heartbeat: phase 2 pending"` string: same file

**Assumed correct token/variable:**
N/A — these references are architecturally stale. Bo as a standalone service no longer exists (discord connectivity migrates to Cerebra).

**Who needs to confirm:**
~~Developer~~ — **RESOLVED 2026-06-16.** Decision: keep BO node, point at Cerebra discord module via `GET /status` at port 7432.

**Confidence level:**
RESOLVED — tile updated.

**Brief context:**
BO node polls `http://localhost:7432/status`. Status derives from whether the Cerebra daemon responds (`up`/`down`). CORS fix applied at `daemon.py:188` (`_send_json`) — all four endpoints (status, posture, cycles, checkpoint) return `Access-Control-Allow-Origin: *`. Verified live: BO node flips green with daemon running. `TOPOLOGY_ALIASES` edges from BO toward LiteLLM remain valid (see item 1 — alias names confirmed stable).

---

## 4. FOSSIC_STORE_PATH pointing to shared hub (pre-federation)

**Element / binding location:**
`FOSSIC_STORE_PATH = Path.home() / ".lattica" / "fossic" / "store.db"`
`/home/boop/Projects/ai-stack/fossic_sidecar.py:33`

**Assumed correct token/variable:**
Under federation: `Path.home() / "Projects" / "ai-stack" / ".fossic" / "store.db"` (ai-stack local store, vault-scoped, consistent with Cerebra's `.fossic/store.db` pattern).

**Who needs to confirm:**
Developer / Fossic-claude — confirm that the local store path convention for ai-stack should be `~/<project>/.fossic/store.db` or an alternative like `~/.lattica/ai-stack/fossic.db`. The path change is a one-line edit once confirmed.

**Confidence level:**
MEDIUM — the local store path pattern needs to be confirmed against the platform convention. Current path is the shared hub, which is correct for pre-federation but wrong under federation.

**Brief context:**
Currently the sidecar writes directly to the shared hub (`~/.lattica/fossic/store.db`). Under federation the sidecar writes to a local store; a relay agent bridges to hub. The path change is the only mechanical change in `fossic_sidecar.py` for the local store migration (besides the indexed_tags additions in §B.5 of federation_design.md).

---

## 5. VRAM_WARN_PCT_THRESHOLD (to be added)

**Element / binding location:**
Proposed constant in `fossic_sidecar.py` (does not exist yet; to be added in indexed_tags pass).
Will be used as: `indexed_tags={"warn": (pct >= VRAM_WARN_PCT_THRESHOLD)}`

**Assumed correct token/variable:**
Default `80` (percent), matching tile's `DEFAULT_VRAM_WARN_PCT = 80` pattern. But under Cerebra master model — both training and witness model active simultaneously — the "safe headroom" floor changes. Cerebra should define what percentage constitutes a warning state.

**Who needs to confirm:**
Developer, with Cerebra. The tile's warn threshold is a user-configurable UI preference; the hub-side `warn` indexed_tag is for platform-level query filtering (e.g., Cerebra witness model asking "is GPU under pressure?"). They may not need to match.

**Confidence level:**
LOW — correct default unknown until Cerebra's both-models-active VRAM floor is established.

**Brief context:**
The `warn` indexed_tag on `VramBudgetChanged` enables hub consumers to SQL-filter for warn-state transitions without decoding every payload (S-016). The threshold needs to be meaningful at the platform level, not just the tile UI level.

---

*End of needs-wiring.md — 2026-06-16*
