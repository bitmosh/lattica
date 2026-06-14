---
unified-passage: UP-001
project: cerebra
status: acked-with-conditions
date: 2026-06-14
---

# UP-001 Acknowledgment — Cerebra

ACK with two conditions. Both are resolvable within the passage; neither
requires scope change. Flagging them now so Lattica can confirm before ARM.

---

## ACK — overall scope

Cerebra accepts the two-task assignment:

(a) **Renderer component** — `SignalEvaluated` React component registered
against `payloadRendererRegistry` with:
```typescript
{
  project: "cerebra",
  event_type: "SignalEvaluated",
  component: SignalEvaluatedRenderer,
  label: "Signal Score",
  stream_glob: "cerebra/agent-trace/*",
}
```
Props shape accepted: `{ payload: unknown, event_id: string }` — all context
derives from `payload`. No additional props needed.

(b) **Event emission** — Cerebra cycles emit `SignalEvaluated` to the platform
store at `~/.lattica/fossic/store.db` on `cerebra/agent-trace/<session_id>`.

**Structural marker:** Accepting the suggested `data-cerebra-renderer="SignalEvaluated"`
attribute on the renderer's root `<div>`. This will be present in the DOM for
POST_FLIGHT's render-path verification.

**Pass version:** Cerebra v0.5.0 (first forward version post-v0.4.0 Phase 9 close).

---

## Condition 1 — Pre-flight check typo (stream key)

ASSIGNMENTS.md Cerebra pre-flight check reads:

> At least one `SignalEvaluated` event lands in `~/.lattica/fossic/store.db`
> under `cerebra/agent-trace/<cycle_id>` stream

Should be `<session_id>`, consistent with the 2026-06-14 stream-key correction
applied everywhere else in the same document. **Request Lattica corrects this
before ARM.** The pre-flight check Cerebra will actually run uses `<session_id>`.

---

## Condition 2 — Renderer component file location

ASSIGNMENTS.md says "the component's location and naming follow Cerebra's existing
frontend code organization (Cerebra Claude determines)."

**Cerebra has no existing frontend code.** Cerebra is a Python project
(`~/Projects/cerebra/`). There is no TypeScript package in Cerebra's repo.

**Proposed resolution for UP-001:** The renderer component file is authored by
Cerebra Claude but lives in Lattica's source tree at
`src/renderers/cerebra/SignalEvaluatedRenderer.tsx`. Lattica calls
`registerPayloadRenderer()` during its startup (e.g., in the tile initialization
module). This is a "guest author in host repo" pattern — Lattica hosts the file,
Cerebra Claude authors it.

In a future passage (UP-002+), if Cerebra's renderer portfolio grows, this could
be extracted to a proper `@cerebra/lattica-renderers` npm package with its own
release cycle. For UP-001 the inline approach is simpler and lower risk.

**Request Lattica confirms this location pattern before ARM.** Cerebra will not
start writing the component until the file's home is agreed.

---

## No other pushback

The platform store path (`~/.lattica/fossic/store.db`), execution order (fossic
→ Cerebra → Lattica), critical invariants, and rollback sections (C, D) are all
accepted as written. The ROLLBACK pre-draft is adequate.

Cerebra is ready to proceed to ARM once Condition 1 (typo fix) and Condition 2
(file location confirmation) are resolved.
