---
title: Tech Debt — Living Report (Lattica)
last_reviewed: v0.0.0y
---

# Tech Debt — Living Report

Functional but known-bad implementation choices. Every entry has a trigger condition.
See `LIVING_REPORTS.md` for entry format and resolution conventions.

---

---
id: TD-001
type: tech_debt
status: open
pass_opened: v0.1.0
severity: LOW
---

### TD-001 — LumaWeave capabilities.md claims commandRegistry and moduleRegistry that don't exist on disk

**What it is:** LumaWeave's `docs/requirements/lumaweave/capabilities.md` (filed
round 1) claims `commandRegistry` and `moduleRegistry` exist as live T2
registries. The Lattica reality-check investigation (round 0) found neither file
in LumaWeave's codebase. Inconsistency in the deposit, not a Lattica synthesis
error.

**Why it was necessary:** N/A — this is debt in the cross-project deposit
process, not Lattica-side architectural debt. ADR-009 doesn't require these
registries to exist (they're no longer assumed extension points), so this is
informational debt rather than blocking.

**Known cost:** If LumaWeave Claude is asked to implement cross-project commands
or module registration referencing these registries, they'd need to build them.
For now the work is unscoped. The cost is: future planning may reference
non-existent infrastructure without realizing it.

**Trigger:** When the LumaWeave Claude relay ([Lattica → LumaWeave] DV-001
inquiry, drafted this pass) gets a response confirming the state and the
decision (build, remove from claims, or mark planned), this entry either
resolves (claim removed) or transforms into a real implementation task (build
needed).

**Evidence:** `docs/requirements/lumaweave/capabilities.md` claim;
reality-check investigation report at the v0.0.0 bootstrap pass (see
LATTICA_NOW.md naming drift section for context).
