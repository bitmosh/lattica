---
title: Lattica Now — Live State
status: Phase 0 — v0.3.0 UP-001 EXECUTE complete
last_updated: 2026-06-14
---

# Lattica Now

This file holds live state. Everything in `docs/` other than this file is
timeless or aspirational. When in doubt about what is currently true, this
file wins.

## Version

`v0.3.0` — UP-001 EXECUTE: live Cerebra `SignalEvaluated` event renders in
the UI via Cerebra's contributed React component and the `payloadRendererRegistry`
pipeline.

## Current phase

**Phase 0 — Platform Bootstrap.** Architecture locked at v0.1.0 via ADR-009
(hybrid composition + selective webview embedding). ADR-011 through ADR-014
extend the locked architecture for the v0.2.0 scaffold.

Round-1, round-2, and round-3 advocate coordination complete for all six
projects. ADR-010 (cross-webview IPC two-channel split) locked.

## What exists right now

**Source code (v0.3.0 — new this pass):**
- `src/registrations.ts` — startup registrations: Cerebra `SignalEvaluated`
  renderer + `cerebra-signal-feed` tile metadata
- `src/renderers/cerebra/SignalEvaluatedRenderer.tsx` — Cerebra-authored
  renderer (guest-author-in-host-repo pattern); `data-cerebra-renderer` marker
- `src/renderers/cerebra/SignalEvaluatedRenderer.css` — renderer styles
- `src/tiles/cerebra-signal/CerebraSignalTile.tsx` — subscribes
  `cerebra/agent-trace/*`, routes via `payloadRendererRegistry`
- `src/tiles/cerebra-signal/CerebraSignalTile.css` — tile styles
- `src/App.tsx` — updated: `<CerebraSignalTile />` alongside `<HelloTile />`
- `src/main.tsx` — updated: `import "./registrations"` before React mount

**Source code (v0.2.x and earlier — still present):**
- `src-tauri/` — Tauri 2 Rust backend (v0.2.1u: three scaffold bugs fixed)
  - `src/lib.rs` — fossic store setup, canary event, `lattica_store_status` command
  - `src/main.rs` — entry point
  - `Cargo.toml` — fossic + fossic-tauri path deps, tauri 2
  - `tauri.conf.json` — port 1421, window 1280×800
  - `capabilities/default.json` — core:default
  - `icons/` — RGBA placeholder icons (v0.2.1u)
- `src/` — React frontend
  - `control-plane/registry/RegistryContract.ts` — verbatim copy from LumaWeave
  - `control-plane/tile-section/types.ts` — verbatim copy (path-adjusted import)
  - `control-plane/tile-section/tileSectionRegistry.ts` — fresh, empty entries
  - `control-plane/payload-renderer/payloadRendererRegistry.ts` — verbatim copy
  - `styles/portfolio-tokens.css` — 10 cross-project CSS tokens (verbatim copy)
  - `ipc/postMessageBridge.ts` — ADR-010 Class 1 stub
  - `tiles/HelloTile.tsx` + `HelloTile.css` — fossic subscribe + store status + postMessage demo
- `package.json` — lattica v0.2.0, React 19, Vite 7, TypeScript 5.8
- `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`

**Documentation:**
- `docs/adr/ADR-011` through `ADR-014`, `ADR-009`, `ADR-010` — locked architecture
- `docs/coordination/unified-passage/UP-001/` — UP-001 passage files including POST_FLIGHT.md
- `docs/research/` — Mode B research, LumaWeave patterns reference

**Infrastructure:**
- `docs/aseptic/` — living reports (TECH_DEBT, POLISH_DEBT, DEVIATION) at v0.3.0

## What does NOT exist yet

- Mode B child webview (deferred v0.3+ — Linux positioning bug open)
- LumaWeave postMessage listener (deferred — no Mode B tile yet)
- Playwright test suite
- ADR-001 through ADR-008 status field cleanup (still open — TD-001, PD-001 still open)

## To run locally

```bash
cd ~/Projects/lattica
npm run tauri dev   # starts vite on :1421 + tauri dev window
```

Note: `tauri dev` will trigger a `cargo build` which compiles fossic and fossic-tauri
from their path dependencies. First build takes ~2–5 minutes; incremental rebuilds
~0.12s.

## Known bugs

None in code. POST_FLIGHT manual smoke test (live Cerebra cycle → tile render)
requires developer to run manually — see
`docs/coordination/unified-passage/UP-001/POST_FLIGHT.md`.

## Fossic API ground truth (as of 2026-06-14)

- Store at `~/.lattica/fossic/store.db` — created on first launch
- `fossic_subscribe({ streamPattern, branch, includeSystem, queueSize })` → `string` (sub ID)
- `fossic_unsubscribe({ subscriptionId })` — cancels subscription
- fossic:event payload: `{ subscription_id: string; event: SerializedEvent }`
- 10 read commands via Tauri IPC (see ADR-012)
- `fossic_append` is NOT a Tauri command — write-only from Rust

## Next moves

1. Developer manual smoke test — trigger a Cerebra cycle and verify `SignalEvaluated`
   renders in `CerebraSignalTile` per POST_FLIGHT.md checks 1–4
2. ADR-001 through ADR-008 status field cleanup (PD-001, TD-001 resolution)
3. PD-001 resolution: naming reconciliation pass (ES toolkit / lattica-es → fossic)
4. Design discussion: platform identity, workspace composition, navigation
5. Second real tile: fossic R-F-001 (live event stream view) or next UP milestone
