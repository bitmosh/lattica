---
title: Deviation — Living Report (Lattica)
last_reviewed: v0.0.0z
---

# Deviation — Living Report

Where implementation diverged from spec or ADR. Information log, not failure log.
See `LIVING_REPORTS.md` for entry format and resolution conventions.

---

---
id: DV-001
type: deviation
status: open
pass_opened: v0.0.0
severity: MEDIUM
---

### DV-001 — ADR-001 registry hooks assumed to exist but do not

**Spec said:** ADR-001 ("Lattica IS LumaWeave extended"): "The transport:'live'
slot and database-schema adapter slot in LumaWeave's source adapter registry are
precisely the extension points Lattica phases 2–5 need. ... No new protocol is
needed; the slots are already named and waiting."

**Implementation did:** LumaWeave's `sourceAdapterRegistry` (`SourceAdapterEntry`
type) does not declare `transport: "live"` — there is no transport dimension on
the entry type at all. `commandRegistry` and `moduleRegistry` do not exist.
`tileSectionRegistry` exists with 12 entries but lacks `minimumViableSize`,
`preferredSize`, and `priority` fields (ADR-007 multi-pass layout — design-deferred).
The `database-schema` adapter exists but is `status: "candidate"`, not active.

**Why:** Reality check investigation (2026-06-13) confirmed the registry layer
has not been extended for Lattica integration. LumaWeave's registries serve
LumaWeave's current needs; Lattica-specific slots will need to be added as part
of Phase 2 / Phase 4 work, not assumed.

**Status:** `OPEN — implementation should catch up`. Slot additions become a
Phase 0 or Phase 2 deliverable. ADR-001 described the future shape correctly;
LATTICA_NOW.md captures the actual state.

**Adjacent impact:** LumaWeave advocate's requirements round must include the
registry extensions as explicit requests, not assumed infrastructure.
