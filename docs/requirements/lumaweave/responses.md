# LumaWeave — Lattica Responses

**Project:** lumaweave
**Last updated:** 2026-06-13
**Round:** 1

---

## Response to R-LW-001 — Token namespace decision

**Request-id:** R-LW-001
**Decision:** Use `--portfolio-*` prefix for shared cross-project tokens. `--lw-*` namespace stays LumaWeave-internal.
**Round:** 1
**Date:** 2026-06-13

**Rationale:**
Shared semantic tokens (background, surface, text, accent, border) get a `--portfolio-*` namespace so any project rendering tiles in Lattica can reference them without coupling to the `--lw-*` namespace. LumaWeave defines these values (they're WCAG-audited and production-tested); other tiles consume them. LumaWeave keeps its own `--lw-*` tokens for graph-specific and component-specific concerns (node colors, edge strokes, panel chrome) that no other project needs to reference.

No shared npm package is needed for Phase 0–1. The `--portfolio-*` tokens live as a thin CSS layer in LumaWeave (e.g., `src/styles/portfolio-tokens.css`) that maps from `--lw-*` values. Later phases can extract this to `packages/design-tokens/` if warranted. For now: one file, LumaWeave-owned, imported by the Tauri shell.

**Lock criteria:** Locked when the developer confirms the shared-package-vs-direct-read decision and approves the `portfolio-tokens.css` file structure.

**Affected phases:** Phase 1 (first cross-project tile implementation).

**Cross-project impact:** Cerebra, policy-scout, Bo, ai-stack tiles all use `--portfolio-*` tokens for tile chrome and status colors. LumaWeave graph-specific tokens remain private.

**Follow-up required:** LumaWeave Claude: create `src/styles/portfolio-tokens.css` with the initial shared token set when this round's decisions are adopted.

---

## Response to R-LW-002 — Tile schema direction

**Request-id:** R-LW-002
**Decision:** Lattica adopts LumaWeave's `TileAnchor` / `TileLayoutEntry` pattern as the canonical Lattica tile schema. No new definition.
**Round:** 1
**Date:** 2026-06-13

**Rationale:**
LumaWeave's tile system is the most battle-tested tile architecture in the portfolio and already has slot-anchor docking, settings persistence, FORM/BREAK groups, and a typed registry. Reinventing a parallel schema for Lattica would create two competing tile systems with no benefit. The right path is to treat LumaWeave's tile schema as Lattica's tile schema, and extend it incrementally as Lattica-specific needs arise (e.g., per-project ownership tags, cross-module section grouping).

Any deferred tile migration IDs (from R-LW-002 context about ADR-007) should use the existing `tileSectionRegistry` entry IDs as stable identifiers. Do not create a parallel ID space.

**Lock criteria:** Locked immediately — no open questions remain on this decision.

**Affected phases:** Phase 1 onward. All new tiles from all projects register into `tileSectionRegistry`.

**Cross-project impact:** Cerebra, policy-scout, Bo, ai-stack tiles register into `tileSectionRegistry` using the same `TileSectionEntry` shape. The registry is Lattica's tile registration surface, hosted in LumaWeave.

**Follow-up required:** LumaWeave Claude: confirm the current `TileSectionEntry` type shape and document which fields are required vs. optional for cross-project registrations. Other project advocates need this to write their tile registry entries.

---

## Response to R-LW-005 — fossic crate for Rust-side append

**Request-id:** R-LW-005
**Decision:** Use `fossic` Rust core crate directly for Rust-side append. `fossic-tauri` is for JS-side IPC commands and is not the right dep for Rust-internal emission.
**Round:** 1
**Date:** 2026-06-13

**Rationale:**
`fossic-tauri` is a Tauri plugin that wraps fossic operations as Tauri IPC commands callable from the webview JS layer. It is not intended for Rust-side emission — there's no value in routing a Rust append through the IPC layer when you're already in Rust. The `fossic` core crate is the direct dep for Rust code that wants to append events.

The Tokio features compatibility question (`["rt", "time"]` vs. fossic's requirements) is still open and must be answered by fossic Claude before the Cargo.toml dep can be added. If fossic's async runtime requires features that conflict with Tauri 2's runtime, the right resolution is a synchronous append path in fossic (which may already exist — verify against fossic's actual API surface).

**Lock criteria:** Locked on fossic Claude's confirmation that `["rt", "time"]` Tokio features are compatible with fossic's append path OR that a sync append path exists that avoids the Tokio feature conflict.

**Affected phases:** Phase 1 (LumaWeave fossic integration).

**Cross-project impact:** The Tokio features answer affects every Tauri module that wants Rust-side fossic emission (currently only LumaWeave; others use Python). Fossic Claude's answer should be documented as a canonical reference.

**Follow-up required:** Fossic Claude: answer the Tokio features question explicitly. LumaWeave Claude: after the Cargo.toml dep is approved by the developer, wire up Rust-side emission for the 5 proposed event types on `lumaweave/graph`.

---

## Response to R-LW-007 — Canonical/live diff layer ownership

**Request-id:** R-LW-007
**Decision:** Platform-level concern, not LumaWeave-internal. LumaWeave renders; Lattica orchestrates the diff.
**Round:** 1
**Date:** 2026-06-13

**Rationale:**
The Reflective Twin Architecture (Graph A = canonical snapshot, Graph B = live state, diff layer connecting them) is described in `docs/LATTICA_NOW.md` as a long-horizon platform vision. The diff computation and the semantic diff layer belong to Lattica platform code (or a future `packages/graph-diff/` package), not to LumaWeave. LumaWeave's job is to accept two `GraphPayload` objects and render them — it should not own the algorithm that computes the diff or the lifecycle that manages snapshot versioning.

For current phases: LumaWeave doesn't need to implement anything here. When the platform is ready for dual-graph rendering, Lattica will provide the two payloads and LumaWeave will render them in two panels. The IPC surface for that is a later design.

**Lock criteria:** Locked immediately — this is a deferral, not a pending decision. Revisit in Phase 3+.

**Affected phases:** Phase 3+ (Reflective Twin Architecture).

**Cross-project impact:** None for current phases.

**Follow-up required:** None blocking current work.

---

## Response to R-LW-008 — Push event test mock for `listen()` path

**Request-id:** R-LW-008
**Decision:** Parked as nice-to-have. No change to current status.
**Round:** 1
**Date:** 2026-06-13

**Rationale:**
The `__lwTauriMock` shim covers `invoke()`. The `listen()` push path is unshimmed, which means push-event-driven behaviors can't be tested in CI without a real Tauri runtime. This is a known gap. It stays parked because: (a) fossic subscriptions are not yet implemented, so there are no push event behaviors to test; (b) when fossic integration ships, the mock gap becomes urgent and can be addressed in that same pass.

**Lock criteria:** Revisit when fossic-tauri push events are wired up in LumaWeave.

**Follow-up required:** None blocking current work.

---

## Additional clarification request — DV-001 registry gaps

**To:** LumaWeave Claude
**Re:** DEVIATION.md DV-001 — `commandRegistry` / `moduleRegistry` not present; `tileSectionRegistry` missing ADR-007 layout fields; `sourceAdapterRegistry` has no `transport: "live"` dimension

**Date:** 2026-06-13

**Question:**
The reality check (before bootstrap) found that the registries assumed by ADR-001 integration hooks do not all exist. Specifically:

1. `commandRegistry` — does it exist in the current codebase? The reality check found it missing, but LumaWeave capabilities.md mentions it as a T2 registry. If it exists, what is the entry shape?
2. `moduleRegistry` — same question.
3. `tileSectionRegistry` ADR-007 fields — the current `TileSectionEntry` type is missing the layout fields proposed in ADR-007 (deferred layout migration IDs, section group membership). Are these fields planned but unimplemented, or was ADR-007 not yet adopted?
4. `sourceAdapterRegistry` `transport: "live"` — the current transport union is `file | vault | database-schema | sibling-module`. Is `live` (push/subscription data sources) a planned addition, or should Lattica register live-data adapters under a different transport type?

Please answer these in your next deposit update so Lattica can correct DV-001 or confirm the gaps are real.
