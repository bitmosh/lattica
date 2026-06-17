---
title: Polish Debt — Living Report (Lattica)
last_reviewed: v0.3.5r
---

# Polish Debt — Living Report

Correct but feels-wrong; mechanical to fix. See `LIVING_REPORTS.md` for entry
format and resolution conventions.

---

---
id: PD-002
type: polish_debt
status: open
pass_opened: v0.3.5u
---

### PD-002 — Iter-4 visual treatment for Cerebra tile chrome (OFFLINE pill / Checkpoint button / HOLD toggle)

Placeholder visual treatments shipped in v0.3.5u functional wiring pass. Three new UI
elements use placeholder CSS classes only:

- `cerebra-agent-state-pill cerebra-state-{offline|running|idle|error|unknown}` — state pill
- `cerebra-checkpoint-btn` — checkpoint button
- `cerebra-hold-toggle` / `cerebra-hold-toggle--active` — HOLD/AUTO toggle

These classes are not yet defined in `CerebraSignalTile.css`. Elements render with browser
default button/span styles. Functional but unstyled.

**Trigger:** iter-4 design output available (claude-design visual vocabulary pass). When
iter-4 lands, skinning pass adds CSS rules for these classes per the canonical visual
vocabulary.

---

---
id: PD-001
type: polish_debt
status: open
pass_opened: v0.0.0
---

### PD-001 — "ES toolkit" / "lattica-es" naming drift across planning docs

**What it is:** ADR-002, EVENT_FABRIC.md, ADR-006, and possibly others refer to
the event sourcing library by stale names. Canonical name across all layers
(Rust crate, npm, PyPI, git commits) is `fossic`.

**Where:**
- `docs/adr/ADR-002-es-toolkit-over-nats.md` (filename includes the stale name)
- `docs/adr/ADR-006-monorepo-structure.md` (refers to `packages/es-toolkit/`)
- `docs/EVENT_FABRIC.md` (multiple references)
- Run `grep -ri "es.toolkit\|lattica-es" docs/` for the full set

**Fix:** Scrub stale names to `fossic`. Rename ADR-002 filename. Update monorepo
path in ADR-006 from `packages/es-toolkit/` to `packages/fossic/` or drop the
path reference (fossic is an external dependency, not a monorepo package). This
is a dedicated naming reconciliation pass — do not slip it into a feature pass.

**Severity:** Low. Docs-only. No code exists to be confused.
