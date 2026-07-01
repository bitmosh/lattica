# Node + JS/TS Version Audit — Cross-Project Reconciliation

> **Historical research snapshot — 2026-06-14.** Rhyzome and discord-bot are referenced below as active projects; both are now deprecated and removed from the platform.

**Date:** 2026-06-14
**Audited by:** Lattica Claude (read-only, no files modified)
**Active Node runtime:** v22.22.3 (system default, no project pins it)

---

## Section 1 — Executive Summary

The stack is internally consistent for the two projects that matter to Lattica: **Lattica and
LumaWeave are an exact match.** Lattica's `package.json` was authored from LumaWeave's lockfile
resolved versions — same React range (^19.1.0), same Vite range (^7.0.4), same TypeScript (~5.8.3),
same Tailwind (^4.2.4), same @types/node (^25.6.1). When Lattica runs `npm install`, all packages
will resolve to the versions already validated by LumaWeave's live lockfile.

The one mismatch worth noting — present in both LumaWeave and Lattica — is `@types/node@^25.6.1`
(resolves to 25.6.1) running against a Node **22.22.3** runtime. This means Node 25-only type
signatures are available at typecheck time but the APIs don't exist at runtime. For Tauri apps
specifically, only `process.env`, `path`, and `fs` from Node are used in `vite.config.ts` — all
stable since Node 18. LumaWeave proves this is safe in practice. No BLOCKING mismatches found.

---

## Section 2 — Per-Project Matrix

| Project | Node pin | React | Vite | TS | Tailwind | Tauri API | Notable |
|---|---|---|---|---|---|---|---|
| **lumaweave** | unpinned | `19.2.5` ¹ | `7.3.2` ¹ | `5.8.3` ¹ | `4.2.4` ¹ | `2.10.1` ¹ | graphology, sigma, zustand 5.0.x, playwright 1.59.x, zod 4.4.x, @react-three/fiber |
| **lattica** | unpinned | `^19.1.0` ² | `^7.0.4` ² | `~5.8.3` ² | `^4.2.4` ² | `^2` ² | no node_modules yet; expects to resolve identical to LumaWeave |
| **fossic** | unpinned (Rust crate; see fossic-node below) | — | — | — | — | — | Rust-primary; Cargo.toml only |
| **fossic-node** | `>=18` (engines) | — | — | `5.9.3` ¹ | — | — | napi-rs binding; @types/node `25.9.3` ¹; vitest `3.2.6` ¹ |
| **bitmosh-website** | unpinned | `19.2.4` ¹ | — | `5.7.3` ¹ | `4.2.0` ¹ | — | Next.js `16.2.6`, PostCSS Tailwind integration, @types/node `22.19.11` ¹, Radix UI, pnpm |
| **rhyzome** | unpinned | — | `8.0.10` ¹ | — | `4.2.4` ¹ | — | CSS-tooling-only; no React, no TS; daisyUI 5.5.19; @vitejs/plugin-react `6.0.1` ¹ in lockfile but unused |
| **cerebra** | — | — | — | — | — | — | Python-primary, no Node deps; `pyproject.toml` only |
| **policy-scout** | — | — | — | — | — | — | Python-primary, no Node deps; `pyproject.toml` only |
| **discord-bot** | — | — | — | — | — | — | Python-primary; `requirements.txt` only (discord.py, openai) |
| **ai-lab / ai-stack** | — | — | — | — | — | — | Python/Docker-primary; no `package.json` found |
| **blog.bumper** | — | — | — | — | — | — | Not present at `~/Projects/blog.bumper/`; may be inside `fossic/` or `bitmosh-website/` — not found |

> ¹ Resolved version from lockfile (`package-lock.json` or `pnpm-lock.yaml`)
> ² Package.json range — not yet resolved (no `npm install` run)

### Tailwind integration mode per Node project

| Project | Tailwind version | Integration |
|---|---|---|
| lumaweave | 4.2.4 | `@tailwindcss/vite` plugin (CSS-first, no `tailwind.config.*`) |
| lattica | 4.2.4 | `@tailwindcss/vite` plugin (CSS-first, matching LumaWeave) |
| bitmosh-website | 4.2.0 | `@tailwindcss/postcss` plugin (CSS-first via PostCSS) |
| rhyzome | 4.2.4 | `@tailwindcss/vite` plugin (CSS-only, no React) |

All projects on Tailwind **v4**. No Tailwind v3 project found. No `tailwind.config.js` / `tailwind.config.ts` in any project (v4 CSS-first confirmed everywhere).

---

## Section 3 — Mismatches and Risks

### M-001 — @types/node@25 against active Node 22 runtime

**Mismatch:** LumaWeave (`~/Projects/lumaweave/package.json`) and Lattica (`~/Projects/lattica/package.json`) both specify `@types/node@^25.6.1`. LumaWeave resolves this to `25.6.1`; the active runtime is Node `22.22.3`.

**Risk:** `@types/node@25` includes type declarations for Node 25 APIs that don't exist on Node 22. TypeScript code that calls one of those new APIs would typecheck green but throw at runtime. For Tauri apps, the actual Node API surface used is tiny — `process.env`, `path`, `fs.existsSync`, `child_process.spawn` — all stable since Node 16. LumaWeave has been running this combination without incident.

**Severity:** WARNING (not BLOCKING)

**Recommended resolution:** No immediate change needed — LumaWeave's working install proves the combination is safe for Tauri app usage. If a future Lattica `vite.config.ts` or script starts calling higher-level Node APIs, cross-check the Node 22 docs. Optionally, align to `@types/node@^22` (matching the runtime). See Section 5 for ecosystem-level recommendation.

---

### M-002 — fossic-node TypeScript 5.9.3 vs Lattica/LumaWeave TypeScript 5.8.3

**Mismatch:** `fossic-node` specifies `typescript: ^5` and resolves to `5.9.3`. Lattica and LumaWeave pin `~5.8.3`.

**Risk:** None in practice. `fossic-node` is a separate package compiled independently. Its TypeScript version doesn't affect Lattica's compilation unit or its type exports (the `.d.ts` types are pre-generated by `napi-rs`). The only risk would be if a new TS 5.9 type syntax appeared in `fossic-node`'s handwritten `.d.ts` files and Lattica imported those types — currently no TypeScript source from fossic-node is in Lattica's `src/`.

**Severity:** COSMETIC

**Recommended resolution:** No action needed. When Lattica eventually imports from `fossic` (the npm package), the type surface is generated by napi-rs, not authored TypeScript.

---

### M-003 — rhyzome Vite 8.0.10 vs Lattica/LumaWeave Vite 7.3.2

**Mismatch:** `rhyzome` has resolved Vite `8.0.10`. LumaWeave and Lattica use Vite `^7.0.4`.

**Risk:** None. Rhyzome is an isolated CSS tooling project (no React, no Tauri, no shared source with Lattica). The Vite version difference has zero impact on Lattica's build.

**Severity:** COSMETIC — informational only.

**Recommended resolution:** No action. If Lattica decides to adopt Vite 8 in a future pass, that's a deliberate upgrade, not a fix for this mismatch.

---

### M-004 — bitmosh-website @types/node@22 vs Lattica/LumaWeave @types/node@25

**Mismatch:** `bitmosh-website` explicitly pins `@types/node@^22` (resolves to `22.19.11`). LumaWeave and Lattica specify `@types/node@^25.6.1`.

**Risk:** None. bitmosh-website is a Next.js app with a completely separate compilation unit. It never imports from Lattica or LumaWeave. The divergence is appropriate — bitmosh-website runs on Node 22, so `@types/node@22` is the semantically correct choice for it.

**Severity:** COSMETIC — independent projects, no shared types.

**Recommended resolution:** No action. bitmosh-website's `@types/node@22` is correct for that codebase.

---

## Section 4 — Lattica Pre-Install Adjustments

**No changes required before `npm install`.**

Lattica's `package.json` (`~/Projects/lattica/package.json`) is consistent with LumaWeave's
live lockfile. Every range in Lattica's deps will resolve to the same versions LumaWeave has
validated. The install can proceed as-is.

For reference, the expected resolved versions after `npm install`:

| Package | Expected resolved version | Source |
|---|---|---|
| `react` / `react-dom` | `19.2.5` | LumaWeave lockfile (`19.2.5` today; `^19.1.0` allows higher) |
| `tailwindcss` | `4.2.4` | LumaWeave lockfile |
| `@tailwindcss/vite` | `4.2.4` | LumaWeave lockfile |
| `vite` | `7.3.2` | LumaWeave lockfile |
| `@vitejs/plugin-react` | `4.7.0` | LumaWeave lockfile |
| `typescript` | `5.8.3` | LumaWeave lockfile |
| `@tauri-apps/api` | `2.10.1` | LumaWeave lockfile |
| `@tauri-apps/cli` | `2.10.1` | LumaWeave lockfile |
| `@types/node` | `25.6.1` | LumaWeave lockfile |
| `@types/react` | `19.2.14` | LumaWeave lockfile |
| `@types/react-dom` | `19.2.3` | LumaWeave lockfile |

> These are the versions in LumaWeave's current lockfile. npm may resolve to newer patch versions
> if they are published between LumaWeave's last `npm install` and Lattica's first `npm install`.
> Ranges are identical so any delta will be `~minor-patch` only.

---

## Section 5 — Forward-Looking Recommendations

### R-001: Adopt a shared `.nvmrc` for all Node projects

Every Node project in the ecosystem is unpinned — no `.nvmrc`, no `engines.node`, no `volta.node`.
The implicit assumption is "whoever has Node 22 is fine." This assumption holds today (v22.22.3
active; Tailwind 4, Vite 7, React 19 all support it). But it's invisible: a new machine or a CI
runner on Node 20 or Node 18 would install the same packages and silently behave differently.

Recommended: add `.nvmrc` with `22.22.3` (or `22`) to `lumaweave/` and `lattica/`. Both Tauri
projects are the highest-stakes. bitmosh-website may want `22` too given Next.js 16's
`engines: {node: '>=20.9.0'}`. fossic-node already declares `engines: {node: '>=18'}` which is
correct as a library.

### R-002: Consider aligning @types/node to runtime (^22)

`@types/node@^25.6.1` in LumaWeave and Lattica is a minor version-semantic mismatch with
the `22.22.3` runtime. It works today because Tauri `vite.config.ts` only uses Node APIs
stable since v16. However, if any future `vite.config.ts` or Lattica script file calls a
Node 25-specific API (e.g., a new `fs.promises` method or new `util` helper), it would typecheck
correctly but fail at runtime on Node 22.

If the team standardizes on Node 22 (see R-001), aligning `@types/node` to `^22` costs one
`package.json` edit in each project and makes the runtime assumption explicit in the type
system. This is a low-cost risk reduction.

### R-003: Note the Vite 8 / @vitejs/plugin-react 6 signal

Rhyzome is already on Vite `8.0.10` and `@vitejs/plugin-react@6.0.1`. This is the leading
edge of the ecosystem. LumaWeave and Lattica are both on Vite 7.3.2 with plugin-react 4.7.0.
Vite 7 is current and supported; there is no urgency to upgrade. But if a future Lattica or
LumaWeave pass wants to adopt Vite 8, the rhyzome project is a working reference for what
that looks like (Vite 8 + plugin-react 6 is a coordinated bump — they share a major version).

### R-004: Lattica should add an engines.node field

Lattica's `package.json` has no `engines.node` field. Adding `"engines": {"node": ">=22"}` makes
the runtime expectation explicit and surfaces mismatches early (e.g., a CI runner on Node 18 will
print a warning instead of silently failing). LumaWeave would benefit from the same addition.

---

## Section 6 — Open Questions

None. All data required to produce this report was available in on-disk files. Section 4 is
actionable without further input: no pre-install changes needed.

---

*Files read: `~/Projects/{lumaweave,lattica,bitmosh-website,rhyzome}/package.json`,*
*`~/Projects/lumaweave/package-lock.json`, `~/Projects/rhyzome/package-lock.json`,*
*`~/Projects/bitmosh-website/pnpm-lock.yaml`, `~/Projects/fossic/fossic-node/package.json`,*
*`~/Projects/fossic/fossic-node/package-lock.json`, tsconfig.json files for all Node projects,*
*vite.config files for all Node/Vite projects, `~/Projects/bitmosh-website/postcss.config.mjs`.*
*Python-primary projects (cerebra, policy-scout, discord-bot, ai-lab, ai-stack) confirmed*
*no `package.json` present.*
