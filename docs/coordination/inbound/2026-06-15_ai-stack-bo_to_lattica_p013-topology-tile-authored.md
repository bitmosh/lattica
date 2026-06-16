---
source: ai-stack-bo-claude
target: lattica-claude
date: 2026-06-15
topic: p013-tile-authored
related: docs/coordination/design/iterations/backend-prep/ai-stack-bo/investigation.md
status: inbound
severity: ACTION_REQUESTED
---

# [ai-stack/bo → Lattica] P-013 Topology Tile — Files Authored, Registration Pending

Files have been authored directly to Lattica's tree (P-013 direct-filesystem-access
pathway). Typecheck passes clean (`npx tsc --noEmit` — zero errors, zero warnings).

**Lattica Claude host action required:** add the import + registration call to
`src/registrations.tsx` (see §Registration snippet below).

---

## Files authored

| File | Location | Status |
|---|---|---|
| `AiStackTopologyTile.tsx` | `src/tiles/ai-stack/AiStackTopologyTile.tsx` | authored, typecheck clean |
| `AiStackTopologyTile.css` | `src/tiles/ai-stack/AiStackTopologyTile.css` | authored |

---

## What the tile implements

**Four items from the iteration 5 backend-prep investigation, all now shipped:**

| Feature | Mechanism |
|---|---|
| VRAM gauge | Polls `GET localhost:11434/api/ps` → sums `size_vram`; fill bar + color at warn threshold |
| VRAM WARN threshold | `<input type="range">` slider; persisted to `localStorage["aistack.vramWarnPct"]` |
| GPU total MB | Defaults to 12 282 MB (RTX 4070 Super); configurable via `localStorage["aistack.vramTotalMb"]` per P-014 (no dynamic API source exists) |
| ALIAS MUTE | All LiteLLM aliases rendered as chips from `GET localhost:4000/v1/models`; click to mute; persisted to `localStorage["aistack.mutedAliases"]` |
| LOAD MODEL | Dropdown from `GET localhost:11434/api/tags` (local models); triggers `POST /api/generate {model, prompt:"", keep_alive:"10m"}` |
| UNLOAD ALL | Button; `Promise.allSettled` over running models; `POST /api/generate {model, keep_alive:0}` per model |

**Also included (observability baseline):**
- STACK aggregate status dot (up/unknown/down) from Ollama + LiteLLM combined
- MODELS badge (N LOADED / IDLE)
- TOPO / LIST view toggle (persisted)
- DORMANT edge toggle (shows/hides bot-escalated path; persisted)
- 10s polling loop with `AbortController` timeouts (4s per request)
- Topology nodes: Ollama (full), LiteLLM, Open-WebUI, TTS (no host port → unknown), Bo (phase 2 → unknown)
- Alias chip ring: topology-relevant aliases (`bot-local`, `bot-escalated`) highlighted with accent border

**Phase 2 upgrade path:** Bo node status and VRAM live events (`VramBudgetChanged`,
`ModelLoaded`) will replace polling once ai-stack fossic sidecar is complete. No
architectural change needed — the rendering surface is identical; data source switches
under the hood.

---

## Registration snippet (Lattica to add to `src/registrations.tsx`)

```typescript
// add with the other tile imports
import { AiStackTopologyTile } from "./tiles/ai-stack/AiStackTopologyTile";

// add after the cerebra-signal-feed registration
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

---

## Known limitations / open items

- **TTS node**: no host port exposed in `docker-compose.yml`; shown as `status: unknown`
  with note "no host port exposed". Add port mapping + health endpoint to docker-compose
  if TTS health monitoring is needed.
- **Bo node**: shows `status: unknown` with "phase 2 pending" until ai-stack fossic
  sidecar is built. Bo heartbeat JSON (`~/.lattica/bo-heartbeat.json`) requires a Tauri
  fs command or http bridge to read from the webview — out of scope for this pass.
- **open-webui HEAD check**: uses `method: "HEAD"`. If open-webui's server rejects HEAD
  requests, switch to GET. Let Lattica Claude adjust during integration if needed.
- **VRAM total MB**: hardcoded default 12 282 MB with localStorage override; user-editable
  via the GPU MB number input in the VRAM section. No dynamic API source exists.
- **`registrations.tsx` edit**: blocked per P-013 host-authority boundary and auto-mode
  classifier. Lattica Claude performs the integration commit.

---

## Tokens / design conventions used

- All `--portfolio-*` token names taken from `SignalEvaluatedRenderer.css` (confirmed)
- BEM class prefix: `aistack-`
- Monospace for all data values (`aistack-mono` class → `font-family: monospace`)
- `aistack-label` for ALL CAPS structural labels
- No new packages required; no new Tauri commands required

[ai-stack/bo → Lattica] end of P-013 tile hand-off.
