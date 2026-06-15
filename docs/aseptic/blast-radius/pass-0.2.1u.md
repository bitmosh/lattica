---
pass: 0.2.1u
version: v0.2.1u
sha: 23587c3
date: 2026-06-14
summary: Lattica src-tauri build fix — three latent v0.2.0 scaffold bugs fixed; first-run npm run tauri dev succeeded end-to-end; UP-001 ARM unblocked
---

# Blast Radius — Pass 0.2.1u (v0.2.1u)

Bug fix pass. UP-001 ARM phase Fossic-side pre-flight was blocked on Lattica's
Tauri instance running. First-run `npm run tauri dev` surfaced three real
compilation/runtime errors in v0.2.0's `src-tauri/src/lib.rs` scaffold plus
missing icon files. All three fixed and verified by successful end-to-end build
(exit code 0).

This is the methodology working: real-run verification surfaced three bugs that
code-read review missed entirely. TD-003 banks the lesson.

## The bugs (all three)

1. **E0599 on `app.path()` and `app.manage(store)`:** `src-tauri/src/lib.rs`
   called these methods without `use tauri::Manager;` in scope. Tauri's compiler
   error explicitly pointed at the fix. Fixed: import added at line 2.

2. **Proc macro panic on `tauri::generate_context!()`:**
   `src-tauri/tauri.conf.json` declared five icon paths that didn't exist in
   `src-tauri/icons/`. Also: icons must be RGBA format — a second iteration was
   required after the first batch was generated as palette/indexed mode. Fixed:
   five placeholder RGBA icons generated (Python PIL for PNG/ICNS, ImageMagick
   for ICO). Proper icon design is post-MVP.

3. **Runtime panic on `store.append()` — "stream not declared: lattica/canary":**
   fossic's `Store::append()` requires `Store::declare_stream()` to be called
   before the first write to a stream. The setup hook called `append()` directly
   without declaring the stream first. Fixed: `store.declare_stream(...)` added
   immediately before `store.append(...)`.

The third bug was not in the original pass scope; the developer extended scope
in-session after the third bug surfaced during build verification.

## Verification

End-to-end build executed:

```
cd ~/Projects/lattica
npm run tauri dev
```

Build completed successfully (exit code 0). Vite dev server up on port 1421.
Rust compilation finished in ~2.55s (incremental; prior passes compiled deps).
Binary ran without panic. WAL files at `~/.lattica/fossic/store.db-wal` confirmed
write activity at 20:17 (setup hook ran, `declare_stream` + `append` succeeded).
Platform store at `~/.lattica/fossic/store.db` confirmed present.

Process ran headless (DISPLAY=:1, no visual verification possible from this
session). No panics in output. Exit code 0.

## Files

### Modified
- `src-tauri/src/lib.rs` — added `use tauri::Manager;` (line 2) +
  `store.declare_stream(...)` call before `store.append(...)`
- Living reports + README — version bumps to v0.2.1u; TECH_DEBT gains TD-003

### Created
- `src-tauri/icons/32x32.png` (RGBA placeholder)
- `src-tauri/icons/128x128.png` (RGBA placeholder)
- `src-tauri/icons/128x128@2x.png` (RGBA placeholder, 256×256)
- `src-tauri/icons/icon.icns` (ICNS placeholder, Python-generated, 4 sizes)
- `src-tauri/icons/icon.ico` (ICO placeholder, ImageMagick-generated)
- `docs/aseptic/blast-radius/pass-0.2.1u.md` — this file

## Living report updates

### New entries this pass
- TECH_DEBT TD-003 — v0.2.0 Tauri scaffold had three latent bugs that escaped
  review without a single `npm run tauri dev`; methodology lesson banked;
  entry marked resolved (all three fixed in this pass)
- POLISH_DEBT: No new entries.
- DEVIATION: No new entries.

### Methodology learning
Code-read review caught zero of three bugs. All three caught by `npm run tauri dev`.
Build verification is now required for build-relevant passes as a pre-merge-gate
check, not just a documentation checklist item.

## Adjacent project impact

UP-001 ARM phase Fossic pre-flight is now unblocked. Fossic Claude can verify
checks 1–3 (store existence, `fossic_list_streams()`, `fossic_subscribe`)
against the Lattica platform store and upgrade pre-flight to `status: pass`.
Once Fossic upgrades, ARM closes and EXECUTE opens.

## For fossic:
- File: ~/Projects/lattica/docs/coordination/unified-passage/UP-001/pre-flight/fossic.md
- From: Lattica
- Action: Lattica dev instance now builds and runs cleanly. Platform store exists
  at `~/.lattica/fossic/store.db` with canary stream `lattica/canary` declared.
  Please verify pre-flight checks 1–3 against the live store and upgrade
  `fossic.md` to `status: pass`. This closes ARM phase.

## For cerebra:
- File: ~/Projects/lattica/docs/aseptic/TECH_DEBT.md
- From: Lattica
- Action: Informational. TD-003 banks the lesson that build-relevant changes need
  end-to-end build verification before merge. Future Cerebra passes shipping
  build-relevant code (e.g., the renderer in UP-001 EXECUTE) should include
  equivalent verification.

## For lumaweave / policy-scout / bo / ai-stack:
No direct action.
