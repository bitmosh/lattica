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
