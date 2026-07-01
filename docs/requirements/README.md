# Lattica — Advocate Requirements Coordination

This directory is where per-project advocate Claudes deposit their requirements and
where Lattica Claude synthesizes cross-project decisions. It is the primary mechanism
for structured inter-project coordination during pre-Phase-0 planning.

---

## How it works

Each of Lattica's eight adjacent projects has a dedicated subdirectory. An "advocate
Claude" — a Claude instance working in that project's repo with full context of that
project's current state — files a `requirements.md` describing what the project needs
from Lattica to make integration work.

Lattica Claude reads all deposits, identifies conflicts and dependencies, and publishes
`group-rounds/round-NN.md` synthesizing decisions. Decisions that survive synthesis are
locked in the relevant project's `decisions.md`.

```
Round flow:
  1. Lattica Claude opens a round (this README is updated; projects are notified)
  2. Advocate Claudes deposit requirements.md in their subdirectory
  3. Lattica Claude reads all deposits, runs cross-project synthesis
  4. Lattica Claude publishes group-rounds/round-NN.md
  5. Decisions flow back to projects as responses.md entries
  6. Lattica Claude locks decisions in decisions.md
  7. Repeat for round N+1 if unresolved items remain
```

---

## Directory structure

```
requirements/
  README.md               — this file
  REQUEST_TEMPLATE.md     — format for requirements.md files
  RESPONSE_TEMPLATE.md    — format for responses.md entries
  fossic/
    requirements.md       — deposited by fossic advocate
    responses.md          — Lattica Claude's responses to fossic's requests
    decisions.md          — locked decisions affecting fossic integration
  lumaweave/
    requirements.md       — (pending round 1)
    responses.md
    decisions.md
  cerebra/ ...
  policy-scout/ ...
  bo/ ...
  ai-stack/ ...
  group-rounds/
    round-01.md           — (pending; created when 3+ deposits arrive)
```

---

## Current round status

**Round 1 — OPEN (ready for synthesis)**

Deposits received:
- [x] fossic — `fossic/requirements.md` filed 2026-06-13
- [x] ai-stack — `ai-stack/requirements.md` filed 2026-06-13
- [x] bo — `bo/requirements.md` filed 2026-06-13
- [x] lumaweave — `lumaweave/requirements.md` filed 2026-06-13
- [x] policy-scout — `policy-scout/requirements.md` filed 2026-06-13
- [x] cerebra — `cerebra/requirements.md` filed 2026-06-13

Round 1 synthesis quorum met. All active projects deposited. Lattica Claude
may proceed to `group-rounds/round-01.md`.

---

## Conventions

- **File naming:** `requirements.md`, `responses.md`, `decisions.md` — lowercase.
  (Note: fossic's initial deposit is named `REQUIREMENTS.md` uppercase — treat as
  equivalent; a renaming pass may normalize this.)
- **Request IDs:** `R-<PROJECT>-NNN` (e.g., `R-F-001` for fossic, `R-LW-001` for
  lumaweave). Three-digit zero-padded.
- **Decision IDs:** `D-<PROJECT>-NNN` — locked after Lattica Claude's synthesis.
- **Stability rule:** A `decisions.md` entry is locked when Lattica Claude marks it
  `status: locked`. Locked entries do not change without opening a new requirements
  round. Advocates may rely on locked decisions.
