---
title: Deviation — Living Report (Lattica)
last_reviewed: v0.2.1u
---

# Deviation — Living Report

Where implementation diverged from spec or ADR. Information log, not failure log.
See `LIVING_REPORTS.md` for entry format and resolution conventions.

---

---
id: DV-001
type: deviation
status: resolved
pass_opened: v0.0.0
pass_resolved: v0.1.0
severity: MEDIUM
---

### ~~DV-001 — ADR-001 registry hooks assumed to exist but do not~~

> **Resolved in v0.1.0** — superseded by ADR-009 (federated frontend hosting,
> hybrid composition). The registry hooks ADR-001 assumed exist (`transport:"live"`,
> `commandRegistry`, `moduleRegistry`, multi-pass layout fields on
> `tileSectionRegistry`) are no longer load-bearing for Lattica's integration model.
> ADR-009 specifies that Lattica owns its own composition shell; LumaWeave's
> registries are used for Mode A tile registration (specifically `tileSectionRegistry`
> and the new `payloadRendererRegistry`) but the missing hooks (`commandRegistry`,
> `moduleRegistry`) are no longer assumed extension points. A separate inquiry
> ([Lattica → LumaWeave] DV-001 relay, this pass) asks LumaWeave Claude to confirm
> the actual state and decide whether to build or remove the claims from
> capabilities.md.

<details>
<summary>Original entry (preserved for history)</summary>

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

**Status at open:** `OPEN — implementation should catch up`. Slot additions
become a Phase 0 or Phase 2 deliverable. ADR-001 described the future shape
correctly; LATTICA_NOW.md captures the actual state.

**Adjacent impact:** LumaWeave advocate's requirements round must include the
registry extensions as explicit requests, not assumed infrastructure.

</details>

---

---
id: DV-002
type: deviation
status: open
pass_opened: v0.1.0
severity: LOW
---

### DV-002 — Architectural pivot from ADR-001 codebase-absorption to ADR-009 hybrid composition

**Spec said:** ADR-001 ("Lattica IS LumaWeave Extended") chose codebase
absorption: "The LumaWeave codebase becomes Lattica's codebase."

**Implementation did:** Lattica became its own repo at `~/Projects/lattica/`
(GitHub: bitmosh/lattica). LumaWeave continues unchanged at `~/Projects/lumaweave/`.
ADR-009 (this pass) formalized the architecture as hybrid composition: Lattica
hosts cross-project synthesis tiles in its own bundle; projects with rich
standalone frontends (LumaWeave, future Cerebra) are accessible via Tauri
webview embedding.

**Why:** ADR-001 was starting material, not a locked decision. Developer input
during round-1 close clarified that modules stay standalone. The "codebase
becomes Lattica" framing was incompatible with the standalone invariant.

**Status:** `OPEN — informational`. ADR-001 is preserved as historical record
but is functionally superseded by ADR-009. A separate cleanup pass updates the
earlier ADRs' Status fields to "starting material — superseded in part by
ADR-009 family" rather than "Accepted."

**Adjacent impact:** All six project advocates received responses against the
ADR-009 model in this pass (lattica_round1.md files). Their original
requirements deposits assumed the implicit single-bundle model; ADR-009 hybrid
is compatible with that assumption for projects without standalone frontends
and additive for projects with them.
