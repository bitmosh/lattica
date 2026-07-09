# Lattica

A local Tauri workspace that connects five ecosystem services — Cerebra,
Policy Scout, AI Stack, LumaWeave, Fossic — through a shared event-sourcing
substrate and surfaces their live state as tiles in a split-pane desktop shell.

**Status: Active development — Phase 0.** Core shell, five live tiles, and the
Fossic event hub are in place. LumaWeave graph relay is the remaining Phase 0
milestone.

---

## Demo

![Lattica demo](https://raw.githubusercontent.com/bitmosh/lattica/main/docs/assets/demo.gif)

Mock Data Demo available @ https://www.bitmosh.dev/labs/lattica-prototype/index.html

---

## Why this exists

Running six AI services from separate terminals with no shared view of what any
of them are doing was untenable. Lattica gives them one shell and a shared event
substrate so state from any module shows up in the right tile in real time.

---

## What it does

Lattica opens a Tauri desktop window with a three-pane layout. Each pane holds
a tile chosen from the registry:

| Tile | What it shows |
|------|---------------|
| **CerebraSignalTile** | Rolling history of `SignalEvaluated` events from the Cerebra memory system, with backfill on mount |
| **PolicyScoutTile** | Live posture state and approval queue from Policy Scout's governance daemon (30 s CLI poll + Fossic subscription) |
| **FossicTile** | Per-module event rates across the six hub streams |
| **AiStackTile** | Live topology of Ollama, LiteLLM, and Open WebUI containers |
| **LumaWeaveTile** | Static stub — graph relay is Phase 2 work |

Events arrive through a Fossic hub store at `~/.lattica/fossic/store.db`. All
tiles except AiStack subscribe via `useFossicSubscription`. AiStack polls
service endpoints directly. The topbar shows a six-lane real-time event
visualization and a platform drawer with module health.

---

## Install and run

**Prerequisites:** Node 22+, Rust stable, Tauri system dependencies
([see Tauri docs](https://tauri.app/start/prerequisites/)).

```bash
npm install
npm run tauri:dev     # opens the desktop app in dev mode
```

First build compiles Fossic and fossic-tauri (~2–5 min). Incremental builds: ~0.1 s.

**Tests:**

```bash
npm run typecheck     # TypeScript type check
npm test              # Vitest unit tests
npm run test:e2e      # Playwright E2E (dev server must be running)
```

---

## Repository layout

```
lattica/
  src/              — Tauri app shell (TypeScript, React 19)
  src-tauri/        — Rust backend — Tauri commands, Fossic wiring
  fossic/           — Fossic event sourcing substrate (vendored in-tree)
  docs/adr/         — 17 locked architectural decisions
  docs/             — Architecture, coordination, and methodology docs
```

Cerebra, Policy Scout, AI Stack, and LumaWeave are separate repositories.
Lattica is the unified shell.

---

## Documentation

| Document | Contents |
|---|---|
| [`docs/LATTICA_NOW.md`](docs/LATTICA_NOW.md) | Live state — current version, what exists, what's next |
| [`docs/adr/`](docs/adr/) | ADR-001 through ADR-017 — locked architectural decisions |
| [`docs/EVENT_FABRIC.md`](docs/EVENT_FABRIC.md) | ES toolkit event contracts and `LATTICA_FOSSIC_STORE` |
| [`docs/aseptic/README.md`](docs/aseptic/README.md) | Multi-agent coordination methodology |

---

## Ecosystem modules

| Module | Role |
|--------|------|
| **LumaWeave** | Graph-based architecture-visualization workbench (Sigma.js, React, Tauri) |
| **Cerebra** | Memory management system and live agent harness |
| **Policy Scout** | Governance daemon — command classification and approval queue |
| **AI Stack** | Docker-composed local inference (Ollama + LiteLLM + Open WebUI) |
| **Fossic** | Local-first event sourcing library (vendored in this repo) |

---

## License

Apache-2.0 — see [LICENSE](LICENSE) for the full text.
