# Lattica Coordination Status

**Sweep date:** 2026-06-14
**Sweep type:** Read-only inventory
**Lattica version on disk:** v0.2.0 (all living reports, README, blast-radius, pass-complete)

---

## Section 7 — At-a-Glance Dashboard

| Item | State | Next action | Owner |
|---|---|---|---|
| AGENT_TRACE_VOCABULARY canonicalization | **Resolved** — no Lattica copy exists; fossic canonical (919 lines, v1.0.0p) | None | — |
| Cerebra pass-9.4 routing | **Partial** — routed to fossic ✓; Lattica→Cerebra ack missing; cross-pollination mirror missing | Write `lattica_to_cerebra_pass-9.4-acknowledgment.md` | Lattica Claude |
| Contract ADRs (015/016/017) | **Missing** — none exist on disk | Draft when contracts are ready | Lattica Claude |
| ADR-009 dangling refs | **9 ADR-L- refs** across lines 26/28/42/46–50/93/94/100/101/118 | Replace with ADR-015–017 (or equivalent) when contract ADRs land | Lattica Claude |
| Pending Lattica responses | **1** (pass-9.4 ack to Cerebra) | `lattica_to_cerebra_pass-9.4-acknowledgment.md` | Lattica Claude |
| Pending external responses | **1** (fossic reply to `ActionProposed` clarification) | Awaiting fossic | Fossic Claude |

---

## Section 1 — AGENT_TRACE_VOCABULARY Canonicalization

**Lattica copy:** Does not exist. Searched:
- `~/Projects/lattica/docs/canonical/AGENT_TRACE_VOCABULARY.md` — directory does not exist
- `~/Projects/lattica/docs/AGENT_TRACE_VOCABULARY.md` — file does not exist

**Fossic copy:** `~/Projects/fossic/docs/implement/AGENT_TRACE_VOCABULARY.md`
- Size: 40218 bytes, 919 lines
- Last modified: 2026-06-13 23:58

**State:** Fossic-side canonical is the only copy. The session-2 declaration ("fossic canonical, Lattica is stale mirror") is already the reality — no stale mirror to delete. No action required.

---

## Section 2 — ADR Inventory

**Present (001–014, all `**Status:** Accepted`):**

| File | Title |
|---|---|
| ADR-001 | Lattica IS LumaWeave Extended |
| ADR-002 | Event Fabric via ES Toolkit, Not NATS |
| ADR-003 | eval-core as Standalone Package |
| ADR-004 | Policy Scout Governance Scope |
| ADR-005 | Cerebra API Surface — CLI Shell-Out Now, Unix Domain Socket Daemon in Phase 7 |
| ADR-006 | Monorepo Structure from Phase 0 |
| ADR-007 | LumaShell UX Patterns Absorbed into Lattica Design |
| ADR-008 | Phase 12 — Research Exploration, Not Engineering Deliverables |
| ADR-009 | Federated Frontend Hosting — Hybrid Composition + Selective Webview Embedding |
| ADR-010 | Cross-Webview IPC — Two-Channel Split |
| ADR-011 | Tauri 2 + Vite 7 + React 19 Scaffold |
| ADR-012 | fossic as Platform Store |
| ADR-013 | Port Allocation |
| ADR-014 | Canary Event on Startup |

**Absent:** ADR-015, ADR-016, ADR-017 — none exist on disk.

These correspond to the `ADR-L-NNN` namespace referenced in ADR-009 (see below): platform design token namespace, tile registration contract, and payload renderer registry.

**ADR-009 dangling `ADR-L-` references:**

```
Line 26:  ADR-L-002 (tileSectionRegistry kind discriminator)
Line 28:  ADR-L-001 (--portfolio-* tokens propagate across webview boundaries)
Line 42:  ADR-L-002 (LumaWeave tileSectionRegistry contract shape)
Line 46:  ADR-L-001 (Platform Design Token Namespace)
Line 47:  ADR-L-002 (Tile Registration Contract)
Line 48:  ADR-L-003 (Payload Renderer Registry)
Line 49:  ADR-L-004 (Platform Fossic Store Topology)
Line 50:  ADR-L-005 (Canonical vs. Live Graph Layer Ownership)
Line 93:  ADR-L-002
Line 94:  ADR-L-001
Line 100: ADR-L-002
Line 101: ADR-L-001
Line 118: ADR-L-004
```

`ADR-L-004` has a real counterpart (ADR-012, fossic platform store). `ADR-L-001`, `ADR-L-002`, `ADR-L-003` are the missing contract ADRs (token namespace, tile contract, payload renderer registry). `ADR-L-005` (Reflective Twin) has no current counterpart.

---

## Section 3 — Coordination Directory Inventory

### Inbound (17 files + .gitkeep)

| File | Source | Topic | Status |
|---|---|---|---|
| `2026-06-13_cerebra_to_lattica_pass-9.3-catalyst-events.md` | cerebra-claude | pass-9.3-cross-pollination-catalyst-events | inbound |
| `2026-06-13_fossic-claude_to_lattica_round1-briefing.md` | *(no front matter)* | — | **⚠ NO FRONT MATTER** |
| `2026-06-13_fossic_to_lattica_round1-relay-response.md` | fossic-claude | round1-relay-response | **⚠ placeholder — content pending user paste** |
| `2026-06-14_ai-stack-bo_to_lattica_round1a.md` | ai-stack-claude + bo-claude | round-1a-responses | inbound |
| `2026-06-14_ai-stack-bo_to_lattica_round2a.md` | ai-stack-claude + bo-claude | round-1a-close-acknowledged + round-2a-filed | inbound |
| `2026-06-14_cerebra_to_lattica_pass-9.4-reinjection.md` | cerebra-claude | pass-9.4-cross-pollination-reinjection-triggered | inbound |
| `2026-06-14_cerebra_to_lattica_registry-receipt.md` | cerebra-claude | payloadRendererRegistry-receipt-renderers-unblocked | inbound |
| `2026-06-14_cerebra_to_lattica_round1a.md` | cerebra-claude | round-1a-phase9-step4-shipped-reinjection-live | inbound |
| `2026-06-14_fossic_to_lattica_post-round1-and-vocab-route.md` | fossic-claude | post-round1-acknowledgment + vocab-route-close + otel-correction | inbound |
| `2026-06-14_fossic_to_lattica_round1-ack-response.md` | fossic-claude | round1-acknowledgment-response | inbound |
| `2026-06-14_fossic_to_policy-scout_round1-response.md` | fossic-claude | round1-consumer-readiness-response | inbound *(relay copy; target = policy-scout)* |
| `2026-06-14_lumaweave_to_lattica_round1a-relay.md` | lumaweave-claude | round-1a-dv-001-resolution-and-action-items | inbound |
| `2026-06-14_lumaweave_to_lattica_round2a-relay.md` | lumaweave-claude | round-2a-acknowledgment | inbound |
| `2026-06-14_lumaweave_to_lattica_round3a-acknowledged.md` | lumaweave-claude | round-3a-close-acknowledged | inbound |
| `2026-06-14_lumaweave_to_lattica_round3a-relay.md` | lumaweave-claude | round-3a-implementation-confirmations | inbound |
| `2026-06-14_policy-scout_to_fossic_round1-response.md` | policy-scout-claude | round1-consumer-readiness-response | inbound *(relay copy; target = fossic)* |
| `2026-06-14_policy-scout_to_lattica_approval-stream-and-relay-ack.md` | policy-scout-claude | approval-stream-option-b-confirmed + relay-awareness-ack | inbound |
| `2026-06-14_policy-scout_to_lattica_round1-relay-ack.md` | policy-scout-claude | round1-relay-acknowledgment | inbound |

### Outbound (15 files)

| File | Target | Topic | Status |
|---|---|---|---|
| `2026-06-13_lattica_to_cerebra_pass-9.3-acknowledgment.md` | cerebra-claude | pass-9.3-acknowledgment | outbound |
| `2026-06-13_lattica_to_fossic_cerebra-pass-9.3-route.md` | fossic-claude | cerebra-pass-9.3-vocabulary-route | outbound |
| `2026-06-13_lattica_to_fossic_post-round1-update.md` | fossic-claude | post-round1-update | outbound |
| `2026-06-13_lattica_to_lumaweave_dv-001-inquiry.md` | lumaweave-claude | dv-001-registry-gap-inquiry | outbound |
| `2026-06-14_lattica_to_aistack-bo_round1a-close.md` | ai-stack + bo | round-1a-acknowledgment-and-close | outbound |
| `2026-06-14_lattica_to_aistack-bo_round2a-received.md` | ai-stack + bo | round-2a-received-waiting-state-confirmed | outbound |
| `2026-06-14_lattica_to_cerebra_registry-receipt-ack.md` | cerebra-claude | registry-receipt-ack-renderer-plan-confirmed | outbound |
| `2026-06-14_lattica_to_cerebra_round1a-response.md` | cerebra-claude | round-1a-response-registry-shape-and-decisions | outbound |
| `2026-06-14_lattica_to_fossic_actionproposed-clarification.md` | fossic-claude | actionproposed-new-event-type-clarification | outbound |
| `2026-06-14_lattica_to_fossic_cerebra-pass-9.4-route.md` | fossic-claude | cerebra-pass-9.4-vocabulary-route | outbound |
| `2026-06-14_lattica_to_fossic-policy-scout_round1-relay-awareness.md` | fossic + policy-scout | fossic-to-policy-scout-round1-relay-receipt | outbound |
| `2026-06-14_lattica_to_fossic_round1-acknowledgment.md` | fossic-claude | post-round1-acknowledgment-and-vocab-route-close | **⚠ missing `status: outbound` field** |
| `2026-06-14_lattica_to_lumaweave_round3a-close.md` | lumaweave-claude | round-3a-confirmation-and-close | outbound |
| `2026-06-14_lattica_to_policy-scout_approval-stream-decision.md` | policy-scout-claude | approval-stream-option-b-decision | outbound |
| `2026-06-14_lattica_to_policy-scout_round1-awareness.md` | policy-scout-claude | round1-relay-receipt-and-lattica-relevant-decisions | outbound |

### Thread classification

| Thread | Inbound | Outbound | Classification |
|---|---|---|---|
| Cerebra pass-9.3 cross-pollination | 1 | 2 (ack + fossic route) | **Closed** |
| Fossic round-1 briefing | 1 (no front matter) | 1 | **Unknown** — inbound is malformed; relay-response placeholder never filled |
| ai-stack + Bo rounds 1a/2a | 2 | 2 | **Closed** — waiting state confirmed both sides |
| Cerebra round-1a (registry shape + R-CB-003/Q3) | 2 | 2 | **Closed** — renderers unblocked |
| Cerebra pass-9.4 cross-pollination | 1 | 1 (fossic route only) | **⚠ Pending Lattica response** — no ack sent back to Cerebra |
| Fossic post-round-1 + vocab route close | 2 | 2 | **⚠ Pending external response** — awaiting fossic reply to `ActionProposed` clarification |
| Fossic→Policy-Scout relay (copy) | 1 | 1 | **Closed** — awareness filed |
| LumaWeave DV-001 + rounds 1a/2a/3a | 4 | 1 | **Closed** — final ack received, no further rounds |
| Policy Scout relay ack + approval stream | 3 | 2 | **Closed** — Option B confirmed and carried to fossic round-2 |

### Cross-pollination directories

All six subdirectories (`cerebra/`, `fossic/`, `lumaweave/`, `policy-scout/`, `bo/`, `ai-stack/`) exist but are **empty**. The directory structure was created; no cross-pollination files have been filed here. (The pass-9.3 and pass-9.4 route files went to `coordination/outbound/`, not here.)

---

## Section 4 — Cerebra Pass-9.4 Routing Status

| File | Expected path | Exists? |
|---|---|---|
| Inbound from Cerebra | `inbound/2026-06-14_cerebra_to_lattica_pass-9.4-reinjection.md` | ✓ **YES** |
| Lattica→Cerebra acknowledgment | `outbound/2026-06-14_lattica_to_cerebra_pass-9.4-acknowledgment.md` | ✗ **MISSING** |
| Lattica→Fossic vocab route | `outbound/2026-06-14_lattica_to_fossic_cerebra-pass-9.4-route.md` | ✓ **YES** |
| Cross-pollination mirror | `cross-pollination/cerebra/pass-9.4.md` | ✗ **MISSING** |

Route to fossic was filed (pass-9.4 vocab batch queued for v1.0.0o). Acknowledgment to Cerebra was never written. Cross-pollination mirror was not filed (cross-pollination dirs are entirely unused).

---

## Section 5 — Living Reports + Pass History

### Version state

All four living reports and the README are at **v0.2.0**. Consistent.

| Report | `last_reviewed` |
|---|---|
| `docs/aseptic/TECH_DEBT.md` | v0.2.0 |
| `docs/aseptic/POLISH_DEBT.md` | v0.2.0 |
| `docs/aseptic/DEVIATION.md` | v0.2.0 |
| `docs/aseptic/README.md` | version: v0.2.0 |

### Blast-radius files

```
docs/aseptic/blast-radius/
  pass-0.0.0x.md
  pass-0.0.0y.md
  pass-0.0.0z.md
  pass-00.md
  pass-0.1.0.md
  pass-0.2.0.md   ← most recent; SHA 73adebc/549256c, date 2026-06-14
```

### Pass-complete files

```
docs/aseptic/pass-complete/
  pass-0.1.0.md
  pass-0.2.0.md   ← most recent
```

**Note:** Passes 0.0.0x, 0.0.0y, 0.0.0z, and pass-00 have blast-radius files but no pass-complete counterparts. Likely pre-methodology passes; not an error if those passes pre-date the pass-complete protocol.

---

## Section 6 — Mode B / Linux Positioning Bug Status

Source: `docs/research/mode-b-webview-embedding.md` — authored 2026-06-14, `status: Research complete — no code implemented`.

- **Upstream issue:** Tauri issue #13071 (duped to #10420). Both open as of the research file's authoring date. No "last checked" field in the doc beyond the file date.
- **Constraint:** `window.add_child()` requires `features = ["unstable"]` in Cargo.toml. On Linux, webviews stack vertically instead of positioning correctly. Not a cosmetic issue — positions are wrong.
- **Lattica decision:** Mode B deferred past bug resolution. No workaround is tracked; the accepted path is "wait for upstream fix." No timeline.
- **Nothing time-sensitive** in this doc — it is a research artifact, not a tracked issue with a status that changes.

---

## Section 8 — Additional Flags

**F-001 — `2026-06-13_fossic-claude_to_lattica_round1-briefing.md` has no YAML front matter.**
36163 bytes. The file starts without `---` delimiters. Methodology violation; cannot be classified by the front matter scanner.

**F-002 — `2026-06-13_fossic_to_lattica_round1-relay-response.md` is a placeholder.**
472 bytes. Front matter `status: placeholder — content pending user paste`. The round-1 relay response content was never pasted in. The corresponding outbound `lattica_to_fossic_post-round1-update.md` was sent, so Lattica responded to the briefing without receiving this relay response. Unclear whether the missing content matters at this point (fossic round-1 arc is considered closed).

**F-003 — `2026-06-14_lattica_to_fossic_round1-acknowledgment.md` is missing `status: outbound`.**
All other outbound files have this field. One file is missing it.

**F-004 — Cross-pollination directories are entirely unused.**
Six subdirectories (`cerebra/`, `fossic/`, `lumaweave/`, `policy-scout/`, `bo/`, `ai-stack/`) exist under `docs/coordination/cross-pollination/` but contain no files. Both the pass-9.3 and pass-9.4 Cerebra cross-pollination routes landed in `outbound/` rather than `cross-pollination/cerebra/`. No established filing convention.

**F-005 — ADR-L-004 was superseded by ADR-012 but the reference remains.**
ADR-009 line 49 and 118 reference `ADR-L-004 (Platform Fossic Store Topology)`. ADR-012 is the real decision covering this. The ADR-L-004 reference is not just dangling — it points to content that does exist, but under a different number.
