---
pass: 0.2.0
version: v0.2.0
sha: 73adebc (commit 1, content) / 549256c (commit 2, blast-radius)
date: 2026-06-14
summary: First real code commit — Tauri 2 + Vite 7 + React 19 + fossic scaffold
---

# Blast Radius — Pass 0.2.0 (v0.2.0)

First code commit. Platform scaffold with fossic store integration, canary event
on startup, HelloTile proving the full subscription pipeline, verbatim registry
type copies, and four locked ADRs (011–014).

## Files

### Created

**Source code (new — no prior code existed):**
- `package.json` — lattica v0.2.0, React 19, Vite 7, TypeScript 5.8, @tauri-apps/api ^2
- `vite.config.ts` — port 1421 strictPort, react + tailwindcss plugins (no selfGraphWatcher)
- `tsconfig.json` — ES2020, strict, noEmit, jsx: react-jsx (matches LumaWeave)
- `tsconfig.node.json` — composite, ESNext, include vite.config.ts
- `index.html` — Lattica title, root div
- `src/vite-env.d.ts` — vite/client reference
- `src/main.tsx` — ReactDOM.createRoot entry
- `src/App.tsx` — thin shell: renders HelloTile
- `src/App.css` — imports portfolio-tokens.css, base reset
- `src/styles/portfolio-tokens.css` — 10 cross-project CSS tokens (verbatim from LumaWeave)
- `src/control-plane/registry/RegistryContract.ts` — verbatim from LumaWeave registryContract.types.ts
- `src/control-plane/tile-section/types.ts` — verbatim from LumaWeave tile.types.ts (one import path adjusted)
- `src/control-plane/tile-section/tileSectionRegistry.ts` — fresh T2 registry, empty entries
- `src/control-plane/payload-renderer/payloadRendererRegistry.ts` — verbatim from LumaWeave
- `src/ipc/postMessageBridge.ts` — ADR-010 Class 1 postMessage stub
- `src/tiles/HelloTile.tsx` — fossic subscribe + store status + postMessage demo + registry list
- `src/tiles/HelloTile.css` — portfolio-token-styled layout
- `src-tauri/Cargo.toml` — fossic + fossic-tauri path deps, tauri 2, serde/serde_json
- `src-tauri/build.rs` — tauri_build::build()
- `src-tauri/src/main.rs` — entry point
- `src-tauri/src/lib.rs` — fossic store setup, canary event, lattica_store_status command
- `src-tauri/tauri.conf.json` — port 1421, identifier com.boop.lattica, 1280×800
- `src-tauri/capabilities/default.json` — core:default

**Documentation:**
- `docs/adr/ADR-011-tauri-vite-react-scaffold.md` — scaffold stack decision (Tauri 2 + Vite 7 + React 19)
- `docs/adr/ADR-012-fossic-platform-store.md` — single fossic store at ~/.lattica/fossic/store.db
- `docs/adr/ADR-013-port-allocation.md` — port 1421 Lattica, 1420 LumaWeave, strictPort both
- `docs/adr/ADR-014-canary-event-startup.md` — startup_ping canary event on every launch

**Aseptic (this commit):**
- `docs/aseptic/blast-radius/pass-0.2.0.md` — this file

### Modified

- `.gitignore` — added Vite (.vite/, dist-ssr/), Tauri gen (src-tauri/gen/, WixTools/)
- `docs/LATTICA_NOW.md` — v0.2.0; scaffold landed; what exists and what's next
- `docs/aseptic/TECH_DEBT.md` — TD-001 note updated (round-3a arrived); TD-002 opened
- `docs/aseptic/POLISH_DEBT.md` — last_reviewed → v0.2.0
- `docs/aseptic/DEVIATION.md` — last_reviewed → v0.2.0
- `docs/aseptic/README.md` — version → v0.2.0

### Deleted

None.

### Moved

None.

## Public APIs

### Added (Rust — Tauri commands)

| Command | Signature |
|---|---|
| `lattica_store_status` | `() → Result<{ ok: bool, stream_count: usize }, String>` |
| `fossic_list_streams` | via fossic-tauri (no signature change) |
| `fossic_list_branches` | via fossic-tauri |
| `fossic_read_range` | via fossic-tauri |
| `fossic_read_one` | via fossic-tauri |
| `fossic_read_by_external_id` | via fossic-tauri |
| `fossic_read_state_at_version` | via fossic-tauri |
| `fossic_subscribe` | via fossic-tauri |
| `fossic_unsubscribe` | via fossic-tauri |
| `fossic_read_by_correlation` | via fossic-tauri |
| `fossic_walk_causation` | via fossic-tauri |

### Added (TypeScript — exported functions and types)

| Export | File |
|---|---|
| `RegistryContract<TEntry, TQuery>` | `src/control-plane/registry/RegistryContract.ts` |
| `TileSectionEntry`, `TileSectionRegistry`, `TileAnchor`, etc. | `src/control-plane/tile-section/types.ts` |
| `tileSectionRegistry` | `src/control-plane/tile-section/tileSectionRegistry.ts` |
| `PayloadRendererEntry`, `registerPayloadRenderer`, etc. | `src/control-plane/payload-renderer/payloadRendererRegistry.ts` |
| `LatticeCommand`, `sendToEmbedded`, `onMessageFromEmbedded` | `src/ipc/postMessageBridge.ts` |
| `HelloTile` | `src/tiles/HelloTile.tsx` |

### Modified / Removed

None — no prior code existed.

## Schema changes

**fossic stream created on startup:**
- Stream: `lattica/canary`, Branch: `main`
- Event type: `startup_ping`, type_version: 1
- Payload: `{ "version": "0.2.0" }`

## Configuration changes

- Tauri 2 app at port 1421 (see ADR-013)
- fossic store at `~/.lattica/fossic/store.db` (see ADR-012)

## Dependency changes

### Added (npm — not yet installed, requires `npm install`)

| Package | Version | Type |
|---|---|---|
| react | ^19.1.0 | dep |
| react-dom | ^19.1.0 | dep |
| tailwindcss | ^4.2.4 | dep |
| @tauri-apps/api | ^2 | dep |
| @tailwindcss/vite | ^4.2.4 | devDep |
| @tauri-apps/cli | ^2 | devDep |
| @types/node | ^25.6.1 | devDep |
| @types/react | ^19.1.8 | devDep |
| @types/react-dom | ^19.1.6 | devDep |
| @vitejs/plugin-react | ^4.6.0 | devDep |
| typescript | ~5.8.3 | devDep |
| vite | ^7.0.4 | devDep |

### Added (Cargo — resolved on first build)

| Crate | Source |
|---|---|
| `fossic` | `{ path = "../../fossic" }` |
| `fossic-tauri` | `{ path = "../../fossic/crates/fossic-tauri" }` |
| `tauri` | `"2"` |
| `serde` | `"1"` |
| `serde_json` | `"1"` |
| `tauri-build` (build-dep) | `"2"` |

## Behavior changes

Lattica now:
1. Launches a Tauri 2 window at 1280×800
2. Opens (or creates) fossic store at `~/.lattica/fossic/store.db` on startup
3. Appends `startup_ping` to `lattica/canary` on every launch
4. Exposes 10 fossic read commands + `lattica_store_status` via Tauri IPC
5. Renders HelloTile showing store status, canary subscription count, tile registry, and postMessage demo

## Living report updates

### New entries this pass

- **TECH_DEBT:** TD-002 opened — `postMessage targetOrigin "*"` placeholder in postMessageBridge (Mode B deferred to v0.3+)

### Updates this pass

- **TECH_DEBT:** TD-001 annotated — LumaWeave round-3a correction arrived; close in next cleanup pass

### Entries resolved this pass

None.

## Adjacent project impact

None — no cross-project API changes. The verbatim copies (RegistryContract, TileSectionEntry,
payloadRendererRegistry, portfolio-tokens.css) mirror LumaWeave exactly; no LumaWeave-side
changes required.

## Notes

This is Lattica's identity commit: the first time code exists. All prior commits were docs and
planning. The scaffold is minimal by design — the first real feature tile (fossic R-F-001 or
Cerebra R-CB-002) comes in the next load-bearing pass after `npm install` and first `tauri dev`
run verification.

**Manual verification required:**
1. `npm install` — installs all JS deps listed above
2. `npm run tauri:dev` — first Cargo build (~2–5 min), then Vite on :1421 + Tauri window
3. HelloTile must show: "fossic store online · N stream(s)" + canary event count > 0

`npm run typecheck` will error until `npm install` completes (no node_modules). Post-install
typecheck is the baseline for future passes.
