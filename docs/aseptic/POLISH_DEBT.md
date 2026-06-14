---
title: Polish Debt — Living Report (Lattica)
last_reviewed: v0.0.0x
---

# Polish Debt — Living Report

Correct but feels-wrong; mechanical to fix. See `LIVING_REPORTS.md` for entry
format and resolution conventions.

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
