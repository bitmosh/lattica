---
pass: 0.3.1
version: v0.3.1
sha: d7f5086
date: 2026-06-14
summary: Pattern B — registry-driven render slot; CerebraSignalTile rendered via tileSectionRegistry.content; visual language matched to dashboard cards
---

# Blast Radius — Pass 0.3.1 (v0.3.1)

Completion pass for UP-001. v0.3.0 shipped Pattern A (CerebraSignalTile hardcoded
directly in App.tsx). v0.3.1 corrects to Pattern B: the tile renders via the
`tileSectionRegistry` content pipeline, proving the registry is the source of truth
for what appears in the shell.

## What changed

### Modified files

- `src/registrations.ts` → `src/registrations.tsx` — renamed to `.tsx` so the
  `content` function can use JSX. Added `content: () => <CerebraSignalTile />` to
  the `tileSectionRegistry.register()` call. Now imports `CerebraSignalTile`.

- `src/App.tsx` — reverted to `<HelloTile />` only. Direct `<CerebraSignalTile />`
  import and render removed.

- `src/tiles/HelloTile.tsx` — three changes:
  1. Added `import type { TileSectionEntry }` for typed state
  2. Replaced `tileCount: number` state with `tileEntries: TileSectionEntry[]` state
     (initialized from `tileSectionRegistry.list()`; updated via `subscribe?`)
  3. Added registered-tile render section below the status grid: filters entries with
     a `content` function and renders each inside `.hello-tile__registered-card`

- `src/tiles/HelloTile.css` — added `.hello-tile__registered-card` and its `h2`
  style, matching the existing `.hello-tile__card` visual language (same padding,
  background, border, radius, uppercase h2, text-secondary, letter-spacing).

- `src/tiles/cerebra-signal/CerebraSignalTile.tsx` — removed outer card container
  and header/count row. Now a pure content component; card chrome comes from the
  `hello-tile__registered-card` wrapper.

- `src/tiles/cerebra-signal/CerebraSignalTile.css` — simplified to content-only
  styles. Removed `.cerebra-signal-tile__header`, `__title`, `__count`,
  `__events` classes that belonged to the now-removed outer card.

- `docs/coordination/unified-passage/UP-001/POST_FLIGHT.md` — smoke-test command
  corrected from `python -m cerebra.cli.main run --config simple.planning.v0`
  to `uv run cerebra run-cycle --goal "..." simple.planning.v0`.

## Living report updates

No new TECH_DEBT, POLISH_DEBT, or DEVIATION entries.

## Verification

- `npx tsc --noEmit` — clean.
- `npm run tauri dev --no-watch` — Vite 112ms, Rust 0.13s, binary clean.

## Adjacent project impact

**For cerebra:**
- File: `~/Projects/lattica/docs/coordination/unified-passage/UP-001/POST_FLIGHT.md`
- From: Lattica
- Action: Smoke-test command corrected in POST_FLIGHT.md. Now use:
  `CEREBRA_PLATFORM_STORE=~/.lattica/fossic/store.db uv run cerebra run-cycle --goal "..." simple.planning.v0`

**For fossic / lumaweave / policy-scout / bo / ai-stack:**
No direct action.
