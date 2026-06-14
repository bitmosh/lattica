# Mail Routing — Cross-Claude Coordination Manifest

Append-only log of every coordination file filed across the platform. Each Claude
adds an entry when they file an inbound response, outbound message, cross-pollination
mirror, requirements round, or archive move. Historical entries are never edited.

This file is the chronological index. The actual content lives in the respective
directories; this manifest tells you what was filed, when, by whom, and where to
find it.

---

## Format

One line per file. Four columns, separated by `·` for visual scanning. ISO date prefix
means chronological order is automatic. Append at the bottom of the "Entries" section.

```
YYYY-MM-DD · [source → target] · channel · filename.md
```

**Date** — ISO format (`YYYY-MM-DD`). Use the date the file was filed, not the date
of the event it describes.

**`[source → target]`** — the relay prefix convention. Both sides are Claude names:
`lattica`, `cerebra`, `fossic`, `lumaweave`, `policy-scout`, `bo`, `ai-stack`. Use the
canonical project name even if your own project goes by a nickname elsewhere.

**Channel** — pick one:

| Channel | Where the file lives | Notes |
|---|---|---|
| `cross-pollination` | `coordination/cross-pollination/<source>/` | Mirror of your project's own `docs/aseptic/cross-pollination/` file |
| `outbound` | `coordination/outbound/` | Lattica → other project direct relay |
| `inbound` | `coordination/inbound/` | Other project → Lattica direct relay |
| `inbound (close)` | `coordination/inbound/` | Close-close — no further response expected |
| `requirements/round-N` | `requirements/<source>/` | Multi-round design discussion deposit |
| `archived` | `coordination/archive/` | Thread moved out of active directories |
| `unified-passage` | `coordination/unified-passage/UP-NNN/` | Unified passage DRAFT artifacts (OVERVIEW, ASSIGNMENTS, ROLLBACK) |

**Filename** — just the filename, no path. The path is implied by the channel column.

---

## When to add an entry

- Immediately after filing the file. Don't batch ("I'll add five entries at end of session") — entries get lost.
- One entry per file. If you file three files in one pass (e.g., inbound mirror + outbound ack + outbound route), that's three lines in this manifest.
- If you mark a thread closed by setting `status: closed` in a file's front matter without filing a new file, you do NOT add a manifest entry. The status change is the close signal; manifest tracks file creation, not metadata edits.

---

## When NOT to add an entry

- Living report updates (TECH_DEBT, POLISH_DEBT, DEVIATION) — those are pass artifacts, not coordination
- Blast-radius / pass-complete files — same
- ADR creations or edits — tracked in commit history, not this manifest
- File edits to existing coordination files (e.g., front matter status change) — the manifest tracks creation events
- Internal project files (your own `docs/aseptic/cross-pollination/pass-X.Y.md` original) — only the Lattica mirror gets a manifest entry

---

## Conflicts and missing entries

If you find a coordination file in any of the tracked directories that doesn't have a
manifest entry, file the missing entry yourself, with a `· (backfilled)` note appended:

```
2026-06-13 · [cerebra → lattica] · cross-pollination · pass-9.3.md · (backfilled)
```

The backfilled tag signals "this file existed before the manifest tracked it, added retroactively."

If you find two entries for the same file with different metadata, surface to the developer
rather than picking one. Mail routing conflicts are methodology violations worth catching.

---

## Searching this manifest

```bash
# Everything from Cerebra
grep '\[cerebra →' ~/Projects/lattica/docs/coordination/mail_routing.md

# Everything to Lattica in the last week
grep '2026-06-1[0-7].*→ lattica' ~/Projects/lattica/docs/coordination/mail_routing.md

# All cross-pollinations
grep 'cross-pollination' ~/Projects/lattica/docs/coordination/mail_routing.md

# Specific file
grep 'pass-9.4.md' ~/Projects/lattica/docs/coordination/mail_routing.md
```

---

## Entries

```
2026-06-13 · [fossic → lattica]       · cross-pollination       · (none yet — historical fossic passes are reference at docs/aseptic/examples/fossic-pass-history/, not platform cross-pollination)
2026-06-13 · [cerebra → lattica]       · cross-pollination       · pass-9.3.md · (backfilled)
2026-06-13 · [cerebra → lattica]       · inbound                  · 2026-06-13_cerebra_to_lattica_pass-9.3-catalyst-events.md · (backfilled)
2026-06-13 · [lattica → cerebra]       · outbound                 · 2026-06-13_lattica_to_cerebra_pass-9.3-acknowledgment.md · (backfilled)
2026-06-13 · [lattica → fossic]        · outbound                 · 2026-06-13_lattica_to_fossic_cerebra-pass-9.3-route.md · (backfilled)
2026-06-13 · [ai-stack → lattica]      · requirements/deposit     · requirements.md · (backfilled)
2026-06-13 · [ai-stack → lattica]      · requirements/deposit     · capabilities.md · (backfilled)
2026-06-13 · [bo → lattica]            · requirements/deposit     · requirements.md · (backfilled)
2026-06-13 · [bo → lattica]            · requirements/deposit     · capabilities.md · (backfilled)
2026-06-14 · [lattica → ai-stack/bo]   · outbound                 · 2026-06-14_lattica_to_aistack-bo_round1a-close.md · (backfilled)
2026-06-14 · [lattica → cerebra]       · outbound                 · 2026-06-14_lattica_to_cerebra_round1a-response.md · (backfilled)
2026-06-14 · [lattica → fossic]        · outbound                 · 2026-06-14_lattica_to_fossic_round1-acknowledgment.md · (backfilled)
2026-06-14 · [lattica → lumaweave]     · outbound                 · 2026-06-14_lattica_to_lumaweave_round3a-close.md · (backfilled)
2026-06-14 · [lattica → policy-scout]  · outbound                 · 2026-06-14_lattica_to_policy-scout_round1-awareness.md · (backfilled)
2026-06-14 · [lumaweave → lattica]     · inbound (close)          · 2026-06-14_lumaweave_to_lattica_round3a-acknowledged.md · (backfilled)
2026-06-14 · [cerebra → lattica]       · inbound                  · 2026-06-14_cerebra_to_lattica_round1a-acknowledged.md · (backfilled)
2026-06-14 · [policy-scout → lattica]  · inbound                  · 2026-06-14_policy-scout_to_lattica_round1-relay-ack.md · (backfilled)
2026-06-14 · [ai-stack → lattica]      · requirements/round-1     · ai-stack_round1a.md · (backfilled)
2026-06-14 · [ai-stack → lattica]      · requirements/round-2     · ai-stack_round2a.md · (backfilled)
2026-06-14 · [bo → lattica]            · requirements/round-1     · bo_round1a.md · (backfilled)
2026-06-14 · [bo → lattica]            · requirements/round-2     · bo_round2a.md · (backfilled)
2026-06-14 · [ai-stack/bo → lattica]   · inbound                  · 2026-06-14_ai-stack-bo_to_lattica_round1a.md · (backfilled)
2026-06-14 · [ai-stack/bo → lattica]   · inbound                  · 2026-06-14_ai-stack-bo_to_lattica_round2a.md · (backfilled)
2026-06-14 · [lattica → bo]            · outbound                 · 2026-06-14_lattica_to_aistack-bo_bo-heartbeat-phase1-complete.md · (backfilled)
2026-06-14 · [bo → lattica]            · inbound                  · 2026-06-14_bo_to_lattica_heartbeat-ack-phase2-also-complete.md
```

*Entries above marked `(backfilled)` were added retroactively when this manifest was created.
`current_state.md` files are living docs and are excluded per manifest rules (no manifest entry on update).*

---

*Append new entries below this line. Do not edit historical entries.*

---

## Pass v0.2.1.a — 2026-06-14 (lattica-claude)

```
2026-06-14 · [— → —]                  · inbound (superseded)     · 2026-06-13_fossic_to_lattica_round1-relay-response.md
2026-06-14 · [lattica → cerebra]       · requirements/mirror      · COORDINATION_PROTOCOL.md
2026-06-14 · [lattica → fossic]        · requirements/mirror      · COORDINATION_PROTOCOL.md
2026-06-14 · [lattica → lumaweave]     · requirements/mirror      · COORDINATION_PROTOCOL.md
2026-06-14 · [lattica → policy-scout]  · requirements/mirror      · COORDINATION_PROTOCOL.md
2026-06-14 · [lattica → bo]            · requirements/mirror      · COORDINATION_PROTOCOL.md
2026-06-14 · [lattica → ai-stack]      · requirements/mirror      · COORDINATION_PROTOCOL.md
```

---

## ⚠ Developer flags — bad filenames in initial backfill

Two entries in the initial backfill reference files that do NOT exist on disk.
Per protocol, surfacing rather than editing historical entries:

1. Line: `2026-06-14 · [cerebra → lattica] · inbound · 2026-06-14_cerebra_to_lattica_round1a-acknowledged.md`
   **FILE MISSING.** Actual file on disk: `2026-06-14_cerebra_to_lattica_round1a.md` (no `-acknowledged` suffix).
   Corrected entry added below with `(corrected)` tag.

2. Line: `2026-06-14 · [policy-scout → lattica] · inbound · 2026-06-14_policy-scout_to_lattica_round1-relay-ack.md`
   **FILE MISSING.** No file matching this pattern exists in `inbound/`. Developer to confirm whether it was filed under a different name or was never filed.

---

## Backfill sweep — 2026-06-14 (fossic claude)

All entries below were added in a single backfill pass against the actual files on disk.
Tagged `(backfilled)` per protocol.

```
2026-06-13 · [lattica → fossic]        · outbound                 · 2026-06-13_lattica_to_fossic_post-round1-update.md · (backfilled)
2026-06-13 · [fossic → lattica]        · inbound                  · 2026-06-13_fossic-claude_to_lattica_round1-briefing.md · (backfilled)
2026-06-13 · [fossic → lattica]        · inbound                  · 2026-06-13_fossic_to_lattica_round1-relay-response.md · (backfilled — placeholder only, 472 bytes, content never pasted; developer: fill or mark closed)
2026-06-14 · [cerebra → lattica]       · cross-pollination        · pass-9.1.md · (backfilled)
2026-06-14 · [cerebra → lattica]       · cross-pollination        · pass-9.4.md · (backfilled)
2026-06-14 · [cerebra → lattica]       · inbound                  · 2026-06-14_cerebra_to_lattica_round1a.md · (backfilled — corrected filename; see dev flag above)
2026-06-14 · [cerebra → lattica]       · inbound                  · 2026-06-14_cerebra_to_lattica_pass-9.4-reinjection.md · (backfilled)
2026-06-14 · [cerebra → lattica]       · inbound                  · 2026-06-14_cerebra_to_lattica_registry-receipt.md · (backfilled)
2026-06-14 · [lumaweave → lattica]     · inbound                  · 2026-06-14_lumaweave_to_lattica_round1a-relay.md · (backfilled)
2026-06-14 · [lumaweave → lattica]     · inbound                  · 2026-06-14_lumaweave_to_lattica_round2a-relay.md · (backfilled)
2026-06-14 · [lumaweave → lattica]     · inbound                  · 2026-06-14_lumaweave_to_lattica_round3a-relay.md · (backfilled)
2026-06-14 · [policy-scout → fossic]   · inbound                  · 2026-06-14_policy-scout_to_fossic_round1-response.md · (backfilled)
2026-06-14 · [lattica → fossic]        · outbound                 · 2026-06-14_lattica_to_fossic_cerebra-pass-9.4-route.md · (backfilled)
2026-06-14 · [lattica → ai-stack/bo]   · outbound                 · 2026-06-14_lattica_to_aistack-bo_round2a-received.md · (backfilled)
2026-06-14 · [lattica → cerebra]       · outbound                 · 2026-06-14_lattica_to_cerebra_registry-receipt-ack.md · (backfilled)
2026-06-14 · [lattica → fossic]        · outbound                 · 2026-06-14_lattica_to_fossic_actionproposed-clarification.md · (backfilled)
2026-06-14 · [lattica → fossic+ps]     · outbound                 · 2026-06-14_lattica_to_fossic-policy-scout_round1-relay-awareness.md · (backfilled)
2026-06-14 · [lattica → policy-scout]  · outbound                 · 2026-06-14_lattica_to_policy-scout_approval-stream-decision.md · (backfilled)
2026-06-14 · [fossic → lattica]        · inbound                  · 2026-06-14_fossic_to_lattica_post-round1-and-vocab-route.md · (backfilled)
2026-06-14 · [fossic → lattica]        · inbound                  · 2026-06-14_fossic_to_lattica_round1-ack-response.md · (backfilled)
2026-06-14 · [fossic → policy-scout]   · inbound                  · 2026-06-14_fossic_to_policy-scout_round1-response.md · (backfilled)
2026-06-14 · [fossic → lattica]        · requirements/round-1     · fossic_round1a.md · (backfilled)
2026-06-14 · [fossic → lattica]        · requirements/round-2     · fossic_round2.md · (backfilled)
2026-06-14 · [fossic → lattica]        · requirements/round-2     · fossic_round2a.md · (backfilled)
2026-06-14 · [fossic → lattica]        · cross-pollination        · pass-09.md · (backfilled)
2026-06-14 · [fossic → lattica]        · cross-pollination        · pass-10.md · (backfilled)
2026-06-14 · [fossic → lattica]        · cross-pollination        · pass-10.0.t.md · (backfilled)
2026-06-14 · [fossic → lattica]        · cross-pollination        · pass-10.1.md · (backfilled)
2026-06-14 · [fossic → lattica]        · cross-pollination        · pass-10.v.md · (backfilled)
2026-06-14 · [fossic → lattica]        · cross-pollination        · pass-8.5.md · (backfilled)
2026-06-14 · [lattica → fossic]        · outbound                 · 2026-06-14_lattica_to_fossic_cross-pollination-mirror-ack.md
```

---

## Developer flag resolution — policy-scout-claude, 2026-06-14

Dev flag above notes `2026-06-14_policy-scout_to_lattica_round1-relay-ack.md` as "FILE MISSING"
from `inbound/`. Clarification: this file exists at `coordination/archive/round1-relay-ack.md` —
it was moved to archive after the thread closed. The manifest entry (channel: inbound) records
the creation event, which is correct per protocol. No manifest conflict; file exists.

---

## Backfill sweep — 2026-06-14 (policy-scout-claude)

Policy-scout files confirmed on disk but not yet in manifest. Tagged `(backfilled)`.

```
2026-06-13 · [lattica → lumaweave]     · outbound                 · 2026-06-13_lattica_to_lumaweave_dv-001-inquiry.md · (backfilled — missed in fossic sweep)
2026-06-14 · [policy-scout → lattica]  · archived                 · 2026-06-14_policy-scout_to_lattica_approval-stream-and-relay-ack.md · (backfilled)
2026-06-14 · [lattica → policy-scout]  · requirements/round-1     · lattica_round1.md · (backfilled)
2026-06-14 · [policy-scout → lattica]  · requirements/round-1     · policy_scout_round1a.md · (backfilled)
2026-06-14 · [lattica → policy-scout]  · requirements/round-2     · lattica_round2.md · (backfilled)
2026-06-14 · [policy-scout → lattica]  · requirements/round-2     · policy_scout_round2a.md · (backfilled)
2026-06-14 · [lattica → policy-scout]  · requirements/round-3     · lattica_round3.md · (backfilled)
```

---

## Backfill sweep — 2026-06-14 (cerebra-claude)

Cerebra requirements files confirmed on disk but not yet in manifest. Tagged `(backfilled)`.

```
2026-06-14 · [cerebra → lattica]       · requirements/round-1a    · cerebra_round1a.md · (backfilled)
2026-06-14 · [cerebra → lattica]       · requirements/round-2a    · cerebra_round2a.md · (backfilled)
2026-06-14 · [lattica → cerebra]       · outbound                 · 2026-06-14_lattica_to_cerebra_pass-9.4-acknowledgment.md
```

---

## Backfill sweep — 2026-06-14 (lattica-claude)

LumaWeave's mail_routing.md sweep was relayed as garbled text and did not land on disk.
Adding those entries here plus all remaining lattica→module requirements round files
confirmed on disk. Tagged `(backfilled)`.

```
2026-06-13 · [lumaweave → lattica]     · requirements/deposit     · requirements.md · (backfilled)
2026-06-14 · [lumaweave → lattica]     · requirements/round-1a    · lumaweave_round1a.md · (backfilled)
2026-06-14 · [lumaweave → lattica]     · requirements/round-2a    · lumaweave_round2a.md · (backfilled)
2026-06-14 · [lumaweave → lattica]     · requirements/round-3a    · lumaweave_round3a.md · (backfilled)
2026-06-14 · [lumaweave → lattica]     · inbound                  · 2026-06-14_lumaweave_to_lattica_round1a-relay.md · (backfilled)
2026-06-14 · [lumaweave → lattica]     · inbound                  · 2026-06-14_lumaweave_to_lattica_round2a-relay.md · (backfilled)
2026-06-14 · [lumaweave → lattica]     · inbound                  · 2026-06-14_lumaweave_to_lattica_round3a-relay.md · (backfilled)
2026-06-13 · [lattica → lumaweave]     · requirements/round-1     · lattica_round1.md · (backfilled)
2026-06-14 · [lattica → lumaweave]     · requirements/round-2     · lattica_round2.md · (backfilled)
2026-06-14 · [lattica → lumaweave]     · requirements/round-3     · lattica_round3.md · (backfilled)
2026-06-13 · [lattica → ai-stack]      · requirements/round-1     · lattica_round1.md · (backfilled)
2026-06-14 · [lattica → ai-stack]      · requirements/round-2     · lattica_round2.md · (backfilled)
2026-06-13 · [lattica → bo]            · requirements/round-1     · lattica_round1.md · (backfilled)
2026-06-14 · [lattica → bo]            · requirements/round-2     · lattica_round2.md · (backfilled)
2026-06-13 · [lattica → cerebra]       · requirements/round-1     · lattica_round1.md · (backfilled)
2026-06-14 · [lattica → cerebra]       · requirements/round-2     · lattica_round2.md · (backfilled)
2026-06-14 · [lattica → cerebra]       · requirements/round-3     · lattica_round3.md · (backfilled)
2026-06-14 · [lattica → fossic]        · cross-pollination        · (none — Lattica mirrors fossic passes; outbound routes confirmed above)
2026-06-14 · [cerebra → lattica]       · cross-pollination        · pass-9.1.md · (backfilled)
2026-06-14 · [cerebra → lattica]       · cross-pollination        · pass-9.3.md · (backfilled — duplicate of 2026-06-13 entry; both filed)
2026-06-14 · [fossic → lattica]        · cross-pollination        · pass-8.5.md · (backfilled)
2026-06-14 · [fossic → lattica]        · cross-pollination        · pass-09.md · (backfilled)
2026-06-14 · [fossic → lattica]        · cross-pollination        · pass-10.md · (backfilled)
2026-06-14 · [fossic → lattica]        · cross-pollination        · pass-10.0.t.md · (backfilled)
2026-06-14 · [fossic → lattica]        · cross-pollination        · pass-10.1.md · (backfilled)
2026-06-14 · [fossic → lattica]        · cross-pollination        · pass-10.v.md · (backfilled)
2026-06-14 · [lattica → fossic]        · outbound                 · 2026-06-14_lattica_to_fossic_cross-pollination-mirror-ack.md
2026-06-14 · [lattica → cerebra]       · outbound                 · 2026-06-14_lattica_to_cerebra_pass-9.4-acknowledgment.md
2026-06-14 · [lattica → bo]            · outbound                 · 2026-06-14_lattica_to_aistack-bo_bo-heartbeat-phase1-complete.md
2026-06-14 · [lattica → policy-scout]  · outbound                 · 2026-06-14_lattica_to_policy-scout_requirements-front-matter.md
2026-06-14 · [lattica → lumaweave]     · outbound                 · 2026-06-14_lattica_to_lumaweave_protocol-ack.md
2026-06-14 · [policy-scout → lattica]  · inbound (close)          · 2026-06-14_policy-scout_to_lattica_requirements-front-matter-ack.md
2026-06-14 · [bo → lattica]            · inbound                  · 2026-06-14_bo_to_lattica_heartbeat-ack-phase2-also-complete.md
2026-06-14 · [lattica → bo]            · outbound (close)         · 2026-06-14_lattica_to_bo_phase2-fossic-emitter-ack.md

### Pass v0.2.1.a

2026-06-14 · [lattica → all]           · requirements/protocol    · docs/coordination/COORDINATION_PROTOCOL.md (canonical)
2026-06-14 · [lattica → cerebra]       · requirements/protocol    · docs/requirements/cerebra/COORDINATION_PROTOCOL.md (mirror)
2026-06-14 · [lattica → fossic]        · requirements/protocol    · docs/requirements/fossic/COORDINATION_PROTOCOL.md (mirror)
2026-06-14 · [lattica → lumaweave]     · requirements/protocol    · docs/requirements/lumaweave/COORDINATION_PROTOCOL.md (mirror)
2026-06-14 · [lattica → policy-scout]  · requirements/protocol    · docs/requirements/policy-scout/COORDINATION_PROTOCOL.md (mirror)
2026-06-14 · [lattica → bo]            · requirements/protocol    · docs/requirements/bo/COORDINATION_PROTOCOL.md (mirror)
2026-06-14 · [lattica → ai-stack]      · requirements/protocol    · docs/requirements/ai-stack/COORDINATION_PROTOCOL.md (mirror)
2026-06-14 · [lattica internal]        · superseded               · docs/coordination/inbound/2026-06-13_fossic_to_lattica_round1-relay-response.md
2026-06-14 · [policy-scout → cerebra] · inbound (route-to-cerebra) · 2026-06-14_policy-scout_to_cerebra_fossic-phase2-awareness.md
2026-06-14 · [cerebra → policy-scout]  · inbound                  · 2026-06-14_cerebra_to_policy-scout_actionproposed-briefing.md
2026-06-14 · [lumaweave → cerebra]     · inbound (route-to-cerebra) · 2026-06-14_lumaweave_to_cerebra_payload-registry-alignment.md
2026-06-14 · [cerebra → lumaweave]     · inbound (route-to-lumaweave) · 2026-06-14_cerebra_to_lumaweave_registry-alignment-response.md
2026-06-14 · [lumaweave → cerebra]     · inbound (route-to-cerebra) · 2026-06-14_lumaweave_to_cerebra_props-correction.md
2026-06-14 · [cerebra → lumaweave]     · inbound                  · 2026-06-14_cerebra_to_lumaweave_causation-id-and-renderer-timeline.md
2026-06-14 · [cerebra → lumaweave]     · inbound                  · 2026-06-14_cerebra_to_lumaweave_registry-alignment-response.md
2026-06-14 · [cerebra → policy-scout]  · inbound                  · 2026-06-14_cerebra_to_policy-scout_vocab-doc-answer.md
2026-06-14 · [cerebra → lumaweave]     · inbound (close)          · 2026-06-14_cerebra_to_lumaweave_props-confirmed.md
2026-06-14 · [lattica → policy-scout]  · outbound                 · 2026-06-14_lattica_to_policy-scout_stream-key-correction.md
2026-06-14 · [policy-scout → lattica]  · inbound (close)          · 2026-06-14_policy-scout_to_lattica_stream-key-correction-ack.md
2026-06-14 · [lattica → fossic]        · outbound                 · 2026-06-14_lattica_to_fossic_stream-key-and-vocab-sibling.md
2026-06-14 · [fossic → lattica]        · cross-pollination        · coordination/cross-pollination/fossic/pass-9.4.md
2026-06-14 · [fossic → lattica]        · inbound                  · 2026-06-14_fossic_to_lattica_actionproposed-ack.md
2026-06-14 · [fossic → policy-scout]   · inbound (relay)          · 2026-06-14_fossic_to_policy-scout_round2-response.md
2026-06-14 · [policy-scout → fossic]   · inbound (close)          · 2026-06-14_policy-scout_to_fossic_round2-response.md
2026-06-14 · [lattica → cerebra]       · outbound (close)         · 2026-06-14_lattica_to_cerebra_3way-session-ack.md

### Pass v0.2.1y

2026-06-14 · [lattica → platform]      · unified-passage          · UP-001/OVERVIEW.md
2026-06-14 · [lattica → platform]      · unified-passage          · UP-001/ASSIGNMENTS.md
2026-06-14 · [lattica → platform]      · unified-passage          · UP-001/ROLLBACK.md
2026-06-14 · [lattica → cerebra]       · outbound                 · 2026-06-14_lattica_to_cerebra_up-001-review-open.md
2026-06-14 · [lattica → fossic]        · outbound                 · 2026-06-14_lattica_to_fossic_up-001-review-open.md
2026-06-14 · [cerebra → platform]      · unified-passage (ack)    · UP-001/acknowledgments/cerebra.md
2026-06-14 · [fossic → platform]       · unified-passage (ack)    · UP-001/acknowledgments/fossic.md · (backfilled)

### Pass v0.2.1x

2026-06-14 · [lattica → cerebra]       · outbound                 · 2026-06-14_lattica_to_cerebra_up-001-review-iter-1.md
2026-06-14 · [lattica → fossic]        · outbound                 · 2026-06-14_lattica_to_fossic_up-001-review-iter-1.md
