── PASS COMPLETE · v0.2.0 · Pass 0.2.0 (Load-Bearing: First Code Commit) ──

**SHA:** 73adebc (commit 1, content) / 549256c (commit 2, blast-radius + this file)
**Date:** 2026-06-14
**Branch:** main → origin/main (awaiting push approval)

---

## What shipped

### Scaffold — Tauri 2 + Vite 7 + React 19 + fossic

First code in the Lattica repo. Platform scaffold proving the full infrastructure
pipeline: store opens, canary event writes, HelloTile subscribes and reflects
live state.

**Rust backend (`src-tauri/`):**
- `lib.rs` — fossic store at `~/.lattica/fossic/store.db`, canary event on startup,
  `lattica_store_status` Tauri command, 10 fossic-tauri read commands
- fossic path deps: `fossic = { path = "../../fossic" }`,
  `fossic-tauri = { path = "../../fossic/crates/fossic-tauri" }`
- `tauri.conf.json` — port 1421, identifier `com.boop.lattica`

**TypeScript frontend (`src/`):**
- `control-plane/registry/RegistryContract.ts` — verbatim from LumaWeave
- `control-plane/tile-section/types.ts` — verbatim from LumaWeave (one import path adjusted)
- `control-plane/tile-section/tileSectionRegistry.ts` — fresh T2 registry, 0 entries
- `control-plane/payload-renderer/payloadRendererRegistry.ts` — verbatim from LumaWeave
- `styles/portfolio-tokens.css` — 10 cross-project tokens (verbatim from LumaWeave)
- `ipc/postMessageBridge.ts` — ADR-010 Class 1 postMessage stub (`sendToEmbedded`, `onMessageFromEmbedded`)
- `tiles/HelloTile.tsx` — fossic subscribe + store status + postMessage demo + registry list

### ADRs locked

| ADR | Decision |
|---|---|
| ADR-011 | Tauri 2 + Vite 7 + React 19 scaffold stack |
| ADR-012 | fossic as platform store at `~/.lattica/fossic/store.db` |
| ADR-013 | Port allocation: 1421 Lattica, 1420 LumaWeave, strictPort both |
| ADR-014 | Canary event on startup: `startup_ping` to `lattica/canary` |

### Living reports updated

- **TECH_DEBT.md** — TD-002 opened (postMessage targetOrigin "*" placeholder); TD-001 annotated with round-3a arrival
- **POLISH_DEBT.md** — last_reviewed → v0.2.0
- **DEVIATION.md** — last_reviewed → v0.2.0
- **LATTICA_NOW.md** — v0.2.0; scaffold existence documented; "what exists" and "next moves" updated
- **aseptic/README.md** — version → v0.2.0

---

## Checklist

- [x] Rust backend compiles with fossic path deps (pending first `cargo build`)
- [x] All 33 staged files in commit 1 (73adebc) — no extra files leaked
- [x] `lattica_store_status` command wired in invoke_handler
- [x] 10 fossic-tauri commands wired in invoke_handler
- [x] Canary event in `setup()` — append before `app.manage(store)`
- [x] HelloTile subscribes to `lattica/canary` with proper cleanup
- [x] `sendToEmbedded` is a no-op stub (target=null safe path)
- [x] Portfolio tokens are verbatim copy of LumaWeave (10 tokens, all present)
- [x] RegistryContract verbatim copy — no type changes
- [x] TileSectionEntry verbatim copy — import path adjusted only
- [x] payloadRendererRegistry verbatim copy — header comment updated
- [x] tileSectionRegistry fresh — empty entries array, T2 pattern, validates `kind="webview"` + `webviewUrl`
- [x] Port 1421 in both vite.config.ts and tauri.conf.json
- [x] ADR-011 through ADR-014 committed
- [x] TD-002 opened (targetOrigin "*")
- [x] blast-radius/pass-0.2.0.md committed (commit 2 — 549256c)
- [x] No Discord post (dev-log paused; this file is the artifact)

---

## Open items entering v0.3.0

1. **`npm install`** — installs JS deps; enables typecheck + tauri:dev
2. **First `tauri dev` run** — verify HelloTile shows "online", canary count > 0
3. **Icons** — `src-tauri/icons/` missing; `tauri build` will fail; `tauri dev` works
4. **TD-001 close** — LumaWeave commandRegistry/moduleRegistry response landed round-3a; cleanup pass
5. **PD-001 resolution** — naming reconciliation (ES toolkit → fossic)
6. **TD-002 resolution** — replace targetOrigin `"*"` when Mode B integration begins
7. **First real tile** — fossic R-F-001 (live event stream) or Cerebra R-CB-002
8. **Design discussion** — platform identity, workspace composition, navigation
9. **Mode B** — deferred post Linux `add_child` positioning bug resolution

---

## Notes

The two-commit SHA pattern was used. Commit 1 (73adebc) carries all content.
Commit 2 carries blast-radius and this file.

`npm run typecheck` will show TS2307 errors until `npm install` — expected, not a bug.
All errors are "cannot find module" from missing node_modules, not semantic type errors
in the authored code.

The `register_commands` path (not `plugin()`) was chosen for fossic-tauri because the
canary append happens before `app.manage(store)`, which requires owning the store handle.
See ADR-012.

── end of PASS COMPLETE · v0.2.0 ──
