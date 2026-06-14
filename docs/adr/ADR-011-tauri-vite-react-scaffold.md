# ADR-011: Tauri 2 + Vite 7 + React 19 Scaffold

**Status:** Accepted
**Date:** 2026-06-14
**Version:** v0.2.0 (first code commit)
**Depends on:** ADR-009 (hybrid composition), ADR-013 (port allocation)

---

## Decision

Lattica's frontend application is bootstrapped with Tauri 2, Vite 7, React 19, and TypeScript 5.8.
This mirrors LumaWeave's current stack exactly — same major versions, same tsconfig pattern,
same tailwindcss v4 integration.

---

## Rationale

**Why match LumaWeave's stack?**

LumaWeave is the reference implementation for Lattica's UI conventions. Matching its stack means:
- Same type system, same JSX target, same module resolution — zero friction copying types verbatim
- `tileSectionEntry`, `RegistryContract`, `PayloadRendererEntry` types copied without modification
- Future Mode A tiles developed in LumaWeave can be transferred to Lattica with no toolchain gaps

**Why not use a different version?**

Lattica has no existing codebase to migrate. Using the latest compatible versions of the same stack
ensures the longest support horizon and avoids divergence debt from day one.

---

## Stack versions (locked at v0.2.0)

| Package | Version |
|---|---|
| `react` / `react-dom` | ^19.1.0 |
| `vite` | ^7.0.4 |
| `typescript` | ~5.8.3 |
| `tailwindcss` | ^4.2.4 |
| `@tailwindcss/vite` | ^4.2.4 |
| `@vitejs/plugin-react` | ^4.6.0 |
| `@tauri-apps/api` | ^2 |
| `@tauri-apps/cli` | ^2 |

---

## What Lattica does NOT include (vs. LumaWeave)

- No Sigma.js / graphology — graph visualization is LumaWeave's domain
- No Playwright test suite — Lattica has no E2E tests at v0.2.0
- No self-graph watcher Vite plugin — LumaWeave-specific
- No `zustand` — Lattica has no app state store at v0.2.0 (fossic is the state substrate)
- No `zod` — no runtime schema validation at v0.2.0

These packages can be added when the need arises; the absence is deliberate.

---

## tsconfig pattern

Identical to LumaWeave:
- `target: ES2020`, `strict: true`, `noUnusedLocals/Parameters: true`
- `moduleResolution: bundler`, `jsx: react-jsx`, `noEmit: true`

---

## Constraints

- Port 1421 is `strictPort: true`. If 1421 is unavailable, `tauri dev` fails visibly rather than
  silently binding to a random port and confusing the Tauri configuration. See ADR-013.
- The selfGraphWatcherPlugin from LumaWeave is intentionally absent. Lattica has no self-graph
  fixture to maintain.
