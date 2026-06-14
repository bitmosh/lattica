# ADR-013: Port Allocation

**Status:** Accepted
**Date:** 2026-06-14
**Version:** v0.2.0

---

## Decision

Lattica and LumaWeave use fixed, non-overlapping ports for their Vite dev servers. Ports
are `strictPort: true` in both projects — any collision fails loudly at startup rather than
silently rebinding.

---

## Port assignments

| App | Dev server | HMR (remote dev only) |
|---|---|---|
| LumaWeave | 1420 | 1421 |
| Lattica | 1421 | 1422 |

---

## Why these ports

LumaWeave claimed 1420 first (established codebase). Lattica uses the next sequential port,
1421. These are in the Vite/Tauri convention range (Tauri's default scaffold uses 1420) and
avoid conflicts with common system services.

---

## HMR port note

LumaWeave's HMR is on 1421 only when `TAURI_DEV_HOST` is set (remote/mobile development
mode). In standard desktop development, LumaWeave's HMR is not active, so there is no
conflict. If both apps run simultaneously in remote dev mode, Lattica's HMR must be on a
non-colliding port — 1422 satisfies this.

---

## Invariant

These port assignments are **not configurable** at runtime. Changing either port requires
updating both `vite.config.ts` and `src-tauri/tauri.conf.json` together. The `strictPort`
flag makes misconfiguration visible immediately.

Do not change Lattica's port to 1420 — LumaWeave holds that port with `strictPort: true`
and both apps are intended to run simultaneously.
