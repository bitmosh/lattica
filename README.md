# Lattica

Lattica is a local-first platform OS that unifies a portfolio of AI and tooling
projects under a single Tauri desktop application.

**Status: Phase 0 — Bootstrap.** No source code exists yet. This repository
currently holds planning documentation, architectural decisions, and the
advocate-coordination scaffolding for inter-project requirements gathering.

---

## What Lattica is

Lattica extends LumaWeave (a graph-based architecture-visualization workbench)
into a full platform: multiple project modules — Cerebra, Policy Scout, fossic,
Bo, rhyzome, bons.ai, ai-stack — are surfaced as tiles in a unified Tauri shell.
The substrate connecting them is fossic, a local-first event sourcing library.

The governing philosophy is **constraint design**: don't detect mistakes, make
them structurally impossible. Every architectural decision asks which invariants
are structurally enforced vs. merely monitored.

---

## Where to start

| Document | Contents |
|---|---|
| [`docs/LATTICA_NOW.md`](docs/LATTICA_NOW.md) | Live state — current phase, what exists, what doesn't |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Platform architecture and module interaction model *(not yet written)* |
| [`docs/PHASES.md`](docs/PHASES.md) | Phase definitions and exit criteria *(not yet written)* |
| [`docs/adr/`](docs/adr/) | Locked architectural decisions ADR-001 through ADR-008 |
| [`docs/aseptic/README.md`](docs/aseptic/README.md) | Aseptic methodology — multi-agent coordination discipline |
| [`docs/requirements/README.md`](docs/requirements/README.md) | Advocate coordination — per-project requirements gathering |

---

## Repository structure (planned)

```
lattica/
  src/                  — Tauri app shell + LumaWeave graph module (TypeScript/React)
  src-tauri/            — Rust backend
  packages/gwells/      — n-body physics engine (TypeScript)
  packages/fossic/      — event sourcing library (external dep, not a monorepo pkg)
  cerebra/              — memory/knowledge layer (Python)
  policy-scout/         — governance daemon (Python)
  discord-bot/          — Bo comms interface (Python)
  rhyzome/              — code repair agent (Python)
  bons-ai/              — multi-agent cognitive system (Python)
  ai-stack/             — inference layer (Docker-composed)
  docs/                 — platform docs, ADRs, aseptic methodology, requirements
```

None of the `src/` tree exists yet. See `docs/LATTICA_NOW.md` for current state.
