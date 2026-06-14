---
title: Aseptic Methodology — Lattica Working Copy
status: live
version: v0.2.0
---

# Aseptic — Lattica Working Files

Aseptic is a methodology for multi-agent code execution that treats coordination
drift as a contamination problem — prevented through continuous discipline at the
work boundary, not cleaned up retrospectively after damage accumulates. The core
instrument is three accumulating living reports, maintained by every passing agent,
that make the project's known debt and divergence legible at a glance.

> **This is Lattica's working copy of the Aseptic methodology.** fossic is the
> first reference implementation. Lattica is the second. The two working copies
> are independent — entries do not transfer between them. The spec files here
> (INTRODUCTION.md, LIVING_REPORTS.md, etc.) are shared methodology; the living
> reports and blast-radius entries are Lattica-specific.

---

## File structure

| File | Purpose |
|---|---|
| `INTRODUCTION.md` | Methodology overview — start here |
| `LIVING_REPORTS.md` | Entry format conventions for all three living reports |
| `TECH_DEBT.md` | Living report — functional but known-bad |
| `POLISH_DEBT.md` | Living report — correct but feels-wrong |
| `DEVIATION.md` | Living report — implementation vs. spec divergence |
| `BLAST_RADIUS.md` | Per-pass blast-radius file format spec |
| `CROSS_POLLINATION.md` | Per-pass adjacent-project impact notification spec |
| `ADR_FORMAT.md` | Agent-friendly ADR template (Lattica namespace: ADR-L-NNN) |
| `PASS_REPORTING.md` | Structured pass report format |
| `SUPERVISOR_PROTOCOL.md` | Supervisor/developer review protocol |
| `AGENT_BRIEFING.md` | Copy-pasteable system-prompt fragment for passing agents |
| `VERSION_CONVENTION.md` | Versioning rules — load-bearing vs. cleanup |
| `blast-radius/` | Per-pass blast-radius files (Lattica passes start at pass-00) |
| `cross-pollination/` | Per-pass adjacent-project notification files |

The `blast-radius/` directory also contains fossic's historical blast-radius entries
(pass-01 through pass-11) as reference material from the first Aseptic implementation.
Lattica's entries begin at pass-00.

---

## Three living reports at a glance

| Report | What goes here | Entry format |
|---|---|---|
| `TECH_DEBT.md` | Functional but known-bad choices. Code works; the design is wrong. | TD-NNN |
| `POLISH_DEBT.md` | Correct but imprecise. Purely mechanical to fix; no behavioral change. | PD-NNN |
| `DEVIATION.md` | Where implementation diverged from spec or ADR. Information log, not failure log. | DV-NNN |

Every passing agent reads all three before writing code, and updates them before
posting PASS COMPLETE. An open TD entry may explain why code looks wrong. A DV
entry tells you the spec and code disagree — trust the code unless stated otherwise.

---

## What to do

- **Starting a pass:** Read `TECH_DEBT.md`, `POLISH_DEBT.md`, `DEVIATION.md` first.
  Read `AGENT_BRIEFING.md` for the system-prompt fragment.
- **Ending a pass:** Update living reports, write `blast-radius/pass-NN.md`, write
  cross-pollination file if warranted, write the pass report per `PASS_REPORTING.md`.
- **Versioning:** Consult `VERSION_CONVENTION.md` to determine whether this is a
  load-bearing (forward) or cleanup (descending-letter) version.
- **Architecture decisions:** Use `ADR_FORMAT.md`. Lattica implementation-time ADRs
  use the `ADR-L-NNN` namespace; planning ADRs live in `docs/adr/`.
