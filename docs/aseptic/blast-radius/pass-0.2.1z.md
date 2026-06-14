---
pass: 0.2.1z
version: v0.2.1z
sha: 40817bc
date: 2026-06-14
summary: Cleanup — contract ADRs 015/016/017 backfilled; ADR-009 dangling refs swept; VERSION_CONVENTION drift note added
---

# Blast Radius — Pass 0.2.1z (v0.2.1z)

Documentation cleanup. The contracts implemented in v0.2.0 (token namespace, tile
registration, payload renderer registry) now have formal ADRs. ADR-009's dangling
`ADR-L-NNN` references are resolved. VERSION_CONVENTION documents the recent
format drift.

First pass on the resumed Blog Bumper changelog pipeline.

## Files

### Created
- `docs/adr/ADR-015-platform-design-token-namespace.md` — formalizes the `--portfolio-*` decision
- `docs/adr/ADR-016-tile-registration-contract.md` — formalizes `TileSectionEntry` with `kind` discriminator
- `docs/adr/ADR-017-payload-renderer-registry.md` — formalizes the T2 registry pattern for renderer extensibility
- `docs/aseptic/blast-radius/pass-0.2.1z.md` — this file

### Modified
- `docs/adr/ADR-009-federated-frontend-hosting.md` — `ADR-L-NNN` references swept to sequential ADR numbers (5 references resolved)
- `docs/aseptic/VERSION_CONVENTION.md` — format drift note appended
- `docs/aseptic/TECH_DEBT.md`, `POLISH_DEBT.md`, `DEVIATION.md` — `last_reviewed: v0.2.1z`
- `docs/aseptic/README.md` — `version: v0.2.1z`

### Deleted
None.

## ADR-L reference resolution map

| Old reference | Resolved to | Status |
|---|---|---|
| ADR-L-001 | ADR-015 | Filed this pass |
| ADR-L-002 | ADR-016 | Filed this pass |
| ADR-L-003 | ADR-017 | Filed this pass |
| ADR-L-004 | ADR-012 | Already filed (fossic store topology) |
| ADR-L-005 | ADR-018 | Forward reference — planned, not yet filed |

## Living report updates

- TECH_DEBT: No new entries.
- POLISH_DEBT: No new entries.
- DEVIATION: No new entries.

## Adjacent project impact

None directly. ADRs 015/016/017 document decisions already in code; no consumer
project needs to act on them. ADR-009 references are now navigable to actual ADR
files; future readers won't hit dangling references.

## For cerebra:
ADR-017 (Payload Renderer Registry) is now formally filed at
`~/Projects/lattica/docs/adr/ADR-017-payload-renderer-registry.md`. Same contract
you've been using since the v0.1.0 round-1a response; the ADR is the durable
record. No action needed.

## For fossic:
ADR-009's reference to `ADR-L-004` (fossic store topology) is updated to `ADR-012`
(the actually-filed ADR). Reference hygiene only; no content change.

## For lumaweave:
ADR-015 (Platform Design Token Namespace) documents that `--portfolio-*` tokens
come from LumaWeave's `src/styles/portfolio-tokens.css` source of truth, copied
verbatim to Lattica. Informational; no action needed.

## For policy-scout / bo / ai-stack:
No direct action.
