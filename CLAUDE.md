# CLAUDE.md — Lattica Platform Guide for Claude Code

## What Lattica is

Lattica is a local-first platform OS that unifies all portfolio projects under one Tauri desktop application. It is not a new project layered on top of LumaWeave — **Lattica IS LumaWeave extended** (ADR-001). LumaWeave's codebase becomes Lattica; LumaWeave's identity is preserved as the graph module within the platform.

The governing philosophy is **constraint design**: don't detect mistakes, make them structurally impossible. Policy Scout's tighten-only YAML overrides, eval-core's regression baselines, and the registry-driven architecture with zero-core-change extensibility are all expressions of the same principle. Every architectural decision should ask: which invariants are structurally enforced vs. merely monitored?

The long-horizon vision is a **Reflective Twin Architecture**: Graph A (canonical snapshot — stable, versioned, reproducible) and Graph B (live state — current observations, current agent activity) rendered simultaneously in LumaWeave, connected by a semantic diff layer (the ES toolkit event fabric). The portfolio projects are organs of a larger organism; Lattica is the body.

**Live state — current phase, status, known bugs — lives in `docs/LATTICA_NOW.md`.** This file holds only timeless operating rules.

## Monorepo structure

Lattica is a monorepo from Phase 0 (ADR-006): npm for TypeScript/Rust packages, uv workspaces for Python packages.

```
lattica/
  src/                  — Tauri app shell + LumaWeave graph module (TypeScript/React)
  src-tauri/            — Rust backend
  lattica/eval-core/    — standalone eval package, stdlib only, zero runtime deps (ADR-003)
  packages/gwells/      — n-body physics engine (TypeScript, extraction target)
  packages/es-toolkit/  — event sourcing library (Rust core, PyO3, napi-rs)
  cerebra/              — memory/knowledge layer + Bo live agent (Python 3.12+)
  policy-scout/         — governance daemon (Python 3.12+)
  ai-stack/             — inference layer (Docker-composed)
  docs/
    LATTICA_NOW.md      — live state (version, roadmap, known bugs)
    DESIGN.md           — platform architecture
    PHASES.md           — phase definitions and exit criteria
    EVENT_FABRIC.md     — ES toolkit architecture and event contracts
    ADR/                — all locked architectural decisions
    agent/              — operating protocols (see Reference docs below)
    canonical/          — domain reference docs
```

Each module with its own complexity has a `CLAUDE.md` in its subdirectory. Read the module-level CLAUDE.md before working in that subtree.

## Module index

| Module | Language | Purpose |
|---|---|---|
| LumaWeave (src/) | TypeScript, React 19, Sigma.js | Graph visualization — primary Lattica UI |
| Cerebra | Python 3.12+ | Memory/knowledge layer, SQLite + embeddings |
| Policy Scout | Python 3.12+ | Governance daemon, shell/package/file/HITL gates |
| ai-stack | Docker | Ollama + LiteLLM + Open WebUI, GPU inference |
| gwells | TypeScript | n-body physics engine, npm extraction target |
| eval-core | TypeScript | Shared eval infrastructure, zero runtime deps |
| es-toolkit | Rust/Python/TS | Event sourcing — the event fabric substrate |

## Working relationship

A planning Claude (chat interface) drafts structured prompts; you (Claude Code) execute them. You also take direct requests from the developer. You and the planning Claude share training and reasoning — its prompts are written for you specifically; the disciplines they encode were learned through real debugging cycles here.

When scope or intent is unclear, **ask rather than guess.** You can pause mid-task. Don't push through uncertainty.

## CRITICAL — Package Installation Safeguard

**No package may be installed without the developer's explicit per-install approval.** This covers every package manager (npm/yarn/pnpm/bun, pip/uv/poetry, apt/dpkg, snap/flatpak, brew, cargo, gem, `npx <new-package>` — all of them).

**Why:** active 2025–2026 supply-chain attacks (self-replicating worms through legitimate maintainer accounts) mean even canonical packages can carry credential-stealing payloads. One unsupervised install can leak GitHub tokens, SSH keys, cloud creds, session cookies.

**When a dependency seems needed:** STOP the pass, post a `[DEPENDENCY REQUEST — REQUIRES MANUAL APPROVAL]` to #current-task (package, version, source, purpose, alternatives considered), and wait for the developer to install + confirm after their own vetting. No exceptions — "tiny dev dep", "already in lockfile", "well-known maintainer", "user installs later" all still STOP. A substitute that also needs a new package is still a dependency request.

**Allowed without approval:** using packages already in `node_modules/` or installed Python envs, reading lockfiles, noting in docs that a dep *might* help later (without acting). If this blocks progress: good. The pass waits. Security over velocity.

## Engineering principles

Honor these unless explicitly told otherwise. Project-specific incidents are in `docs/agent/KNOWN_SHARP_EDGES.md` and `docs/agent/PROJECT_CONVENTIONS.md`.

- **Evidence before fix.** Never patch from a hypothesis. Gather diagnostics → diagnose → confirm → fix.
- **Two-attempt cap.** If a fix and one retry both fail, STOP and report. Three rounds on one theory means the theory is wrong.
- **Cascade halt.** 5+ simultaneous test failures almost always share one root cause. STOP, classify the shared signature, report — don't patch them one by one.
- **Honor STOP gates exactly.** When a prompt says stop-and-report, stop. No "small fixes while I'm here." Report verbatim, wait.
- **Verbatim reporting.** Paste real output — don't summarize or skip "the long parts." Surface caveats unprompted. A truthful stopped report beats a false clean one.
- **Copy verbatim when extracting.** Moving code to a new module or file? Copy byte-for-byte first; refactor in a separate commit. Refactoring during extraction silently changes semantics.
- **Remove instrumentation before commit.** Diagnostic `console.log`/stack traces and `page.on("console")` come out before committing. Grep for them.
- **Prefer the registry over hardcoded lists.** When tempted to write `const MODULES = [...]`, check for a registry to iterate instead. Don't create parallel taxonomies.
- **One commit, one concern.** Don't combine unrelated changes; split them. Commit bodies explain *why*, not just *what*.
- **Verify against on-disk code, not audit docs.** Audit/summary docs are starting points; the tree is truth.
- **Flag manual verification for visual work.** Automated tests miss layout, animation, and interaction feel. Never claim "ready for review" on visual changes without noting the developer must check with `npm run dev`.
- **Constraint design over monitoring.** When adding a new invariant, ask: can this be structurally impossible to violate? If yes, enforce at the type or schema level rather than adding a runtime check.
- **Cross-module consistency.** IPC contracts, event type names, registry shapes, and eval-core interfaces are shared across language boundaries. A change in one module's contract is a breaking change for all consumers. Treat them as public API.
- **Phase dependency awareness.** Don't begin Phase N work if Phase N-1 exit criteria (defined in `docs/PHASES.md`) are unmet. If the gap is discovered mid-pass, STOP and report — don't paper over it.

## Event fabric discipline (ES toolkit)

The ES toolkit event log is append-only and content-addressed. These rules are non-negotiable:

- **Never mutate or delete events.** Correction is a new event, not an edit.
- **Reducers are pure and synchronous.** No I/O, no promises, no side effects inside a reducer. This is enforced at the type level; don't work around it.
- **Snapshots are an optimization, never a source of truth.** Every state must be reconstructable from the raw event log.
- **Schema changes to existing event types are migration events.** Bump `type_version`, write a migration reducer, document in `docs/EVENT_FABRIC.md`. Never silently change payload shape in place.
- **Standard agent trace event types** (`llm_call`, `tool_call`, `tool_result`, `reasoning_step`) are shared across all modules. Changes to these types require a cross-module review — post to #approve-this before touching them.

## STOP-gate triggers

Stop and post a Situation Report (format in `docs/agent/DIAGNOSTICS.md`) when:

- **Validation:** typecheck fails after a nontrivial change · Playwright failures exceed 5 (cascade) · a new `test.skip` appears or skip count rises unexpectedly · a Python test suite regresses without an obvious local cause.
- **Identity:** QA-key surfaces disagree · report key ≠ active checklist key.
- **Contract:** active control count changes unexpectedly · registry shape changes without consumer updates · eval-core interface changes (breaks multiple module consumers) · ES toolkit event schema changes without a `type_version` bump · IPC contract shape changes without updating all language bindings.
- **Phase gate:** Phase N work requires Phase N-1 exit criteria that are not yet met · a pass discovers a prior phase's artifact is absent or incomplete.
- **Scope:** fix needs files outside the declared change list · a docs-only pass starts needing runtime edits · a change propagates across more than two modules unexpectedly.
- **Safety:** a command needs sudo/system changes · a destructive git action would be required · a tool needs access outside the repo.

Full conditions: `docs/agent/survival-manual/06_STOP_CONDITIONS.md`.

## Approval gates (Discord)

All approvals go through Discord, via the **MCP server only** (never raw HTTP). Full protocol, message formats, and the load-bearing PASS COMPLETE template are in `docs/agent/DISCORD_PROTOCOL.md`.

**Ping #approve-this before:** any commit, any merge, any push, any destructive git action, any cross-module IPC or event schema change. **Don't ping for:** reads, typechecks, test runs, diagnostics, in-scope edits not yet being committed. **In-between/unsure:** ask in #current-task.

**Channel IDs** (never guess these):
- #approve-this — `1506441138612080680`
- #current-task — `1506440945128701955`
- #changelog — `1509728570367283250`
- #notifications — `1506441052826107964`
- #brainstorm — `1506441106869583932`

Per-pass flow: confirm MCP connected (else HALT) → brief START to #current-task → work + verify foreground → brief END to #current-task → MERGE GATE (#approve-this) → commit → PASS COMPLETE report to #changelog (the `── PASS COMPLETE ·` delimiter is the bump trigger) → BUMP+PUSH GATE (#approve-this).

## How to work

**Structured prompt from planning Claude:** read the whole thing first (note phases, STOP gates, the "Don't" list) → execute phase by phase → at each boundary check actual state vs. expected; match → continue, mismatch → report and pause → report verbatim at the end → don't continue past the final phase without direction.

**Less-structured request from the developer:** quick + well-defined → do it. Multi-file, multi-module, or test-affecting → ask "structured pass, or dive in?" Unclear → ask. For any meaningful change: typecheck → relevant tests → mention manual verification if visual → commit (at the gate). Don't skip steps.

**Working in a specific module:** read that module's CLAUDE.md first. The platform CLAUDE.md (this file) takes precedence on cross-cutting rules; the module CLAUDE.md covers module-specific patterns and known sharp edges.

## Reference docs (load when relevant)

Not required every pass — consult when the domain is in play:

- `docs/agent/DISCORD_PROTOCOL.md` — Discord channels, message formats, Discord Mode, PASS COMPLETE template, bump gate
- `docs/agent/DIAGNOSTICS.md` — failure classification, situation report template
- `docs/agent/PROJECT_CONVENTIONS.md` — registries, settings store, React/CSS patterns, file organization, commits, test discipline
- `docs/agent/KNOWN_SHARP_EDGES.md` — known traps, test flakes, stale-closure pattern, Playwright cache self-heal
- `docs/LATTICA_NOW.md` — live version, current phase, roadmap, known bugs
- `docs/DESIGN.md` — platform architecture and module interaction model
- `docs/PHASES.md` — all 12 phases with exit criteria and confidence levels
- `docs/EVENT_FABRIC.md` — ES toolkit architecture, event contracts, migration protocol
- `docs/ADR/` — all locked architectural decisions (ADR-001 through ADR-008 and beyond)
- `docs/canonical/` — domain reference docs (registry, theme, graph, physics, source-adapter, control-plane, tile-layout)
- `docs/agent/survival-manual/` — diagnostics + debugging deep-dives (01–08)
- `docs/agent/protocols/` + `docs/agent/onboarding/` — governance, QA-key lifecycle, multi-agent policy
- `docs/quest/QUEST_TEMPLATE.md` — situation-report template