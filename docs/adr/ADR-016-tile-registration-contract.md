# ADR-016: Tile Registration Contract

**Status:** Accepted
**Date:** 2026-06-14
**Version:** v0.2.1z

---

## Decision

`TileSectionEntry` is the canonical contract for tile registration in Lattica's
`tileSectionRegistry`. The type is copied from LumaWeave's source of truth at v0.2.0
with one Lattica-side addition: a `kind: "component" | "webview"` discriminator
supporting the ADR-009 Mode A / Mode B split.

## Constraints

- All tiles registered with `tileSectionRegistry` conform to `TileSectionEntry`
- Mode A tiles (`kind: "component"`) carry the `component` field with a React
  component reference
- Mode B tiles (`kind: "webview"`) carry the fields needed for Tauri child webview
  creation (target URL, fallback state, etc. — full schema lands when the first
  Mode B integration ships)
- Every registered entry's `id` is unique within the registry
- The registry contract type lives at `src/control-plane/tile-section/types.ts`
  (copied verbatim from LumaWeave with the `kind` discriminator added)

## Boundaries

- Modifications to `src/control-plane/tile-section/types.ts` require revisiting
  this ADR
- New `kind` values require an ADR amendment (e.g., adding `"iframe"` or
  `"native"`)
- The registry's `register()` and `subscribe()` patterns inherit from LumaWeave's
  T2 registry pattern (RegistryContract<T>); ADR-009 references that contract

## Invariants

- Duplicate `id` registration fails loudly (registry rejects at registration time)
- Every entry has a valid `kind` value; entries without `kind` are rejected
- Mode B entries without required webview fields are rejected at registration

## Context

LumaWeave's `TileSectionEntry` is the source of truth. Lattica copied verbatim at
v0.2.0 and added the `kind` discriminator deliberately to support ADR-009. ADR-009
had referenced this decision as `ADR-L-002`; this ADR formalizes it under sequential
numbering.

## Failure mode

If a malformed entry is registered, the registry throws at registration time — the
component author sees the failure immediately. The registry doesn't silently drop
malformed entries; loud-contained failure per ADR-009 failure-mode preference.
