# ADR-010: Cross-Webview IPC — Two-Channel Split

**Status:** Accepted
**Date:** 2026-06-14
**Version:** v0.2.0 (the pass at which this decision is first scaffolded)
**Depends on:** ADR-009 (hybrid composition), ADR-L-004 (single fossic store)

---

## Decision

Lattica uses two distinct IPC channels for communication between the shell and Mode B embedded
webviews (LumaWeave today, Cerebra post-Phase 11). The channel used is determined by message
class, not by convention or preference.

**Channel 1 — `window.postMessage` for ephemeral UI commands (Class 1)**

Messages that instruct an embedded webview to change UI state belong on `postMessage`. These
are not events in the substrate sense — they don't represent things that happened in the world,
they represent requests from the shell to the embedded frontend.

Examples:
- "Switch to workspace X"
- "Highlight node Y"
- "Open the inspector for entity Z"
- "Apply this workspace filter"

Protocol: a JSON envelope on the sending side:
```typescript
{ type: "lattica.command", action: string, payload: unknown, requestId?: string }
```

The embedded webview listens with an `origin`-checked `message` event listener. No correlation
ID infrastructure needed at v0.2.0 — commands are fire-and-forget at this stage.

Both webviews live inside Lattica's Tauri process (the embedded LumaWeave frontend is a child
webview in Lattica's window). `postMessage` between two webviews in the same Tauri process
works as standard browser `postMessage`. This is why `window.postMessage` is viable — it does
NOT require the two processes to share a Tauri app context.

**Channel 2 — fossic subscriptions for events and state-as-event (Classes 2 and 3)**

Messages that represent things that happened (observability events, state changes) and
queryable current state belong in fossic. These are durable, content-addressed, and queryable.

- **Class 2 (state queries):** Rather than asking LumaWeave "what's the current selection?"
  via a request/response channel, LumaWeave emits `lumaweave/ui/selection_changed` to fossic
  when selection changes. Lattica subscribes and reads the latest. No request/response needed.
- **Class 3 (events):** LumaWeave emits to `lumaweave/*` streams when things happen (workspace
  created, source adapter loaded, graph layout completed). Lattica reads via subscription.

Lattica's shell is **read-only** on LumaWeave's fossic streams. It subscribes and observes;
it does not append to `lumaweave/*` streams. Lattica appends only to its own `lattica/*`
streams for its own state persistence.

---

## What is NOT an IPC channel for this purpose

**HTTP endpoints** — would require LumaWeave to run an HTTP server alongside its Tauri backend.
Adds a security surface, port conflict risk, and debugging overhead. Rejected.

**Unix sockets / named pipes** — platform-specific. Adds transport code neither Tauri nor
fossic ships. Rejected.

**Tauri event bus across processes** — `app.emit_to(label, event, payload)` from Rust only
routes events within a single Tauri `App` instance. Lattica and LumaWeave are separate `App`
instances. Tauri events do NOT cross process boundaries. This is the root cause of the two-
channel design: the standard Tauri IPC substrate is insufficient for cross-process embedding.

---

## Message class summary

| Class | Description | Channel | Durability |
|---|---|---|---|
| 1 | Ephemeral UI commands (switch workspace, highlight node) | `postMessage` | Ephemeral — not logged |
| 2 | State queries (current selection, dirty buffers) | fossic subscription (latest event) | Durable via fossic |
| 3 | World events (workspace created, layout done) | fossic subscription | Durable via fossic |

---

## Invariants (enforceable)

- UI commands are **never** appended to fossic. Workspace switches, node highlights, and
  inspector opens are ephemeral shell directives — not observable platform events. A command
  that goes through fossic is a design error, not a feature.
- LumaWeave's fossic emitter writes only to `lumaweave/*` streams. Lattica's shell never
  appends to `lumaweave/*`. Cross-stream writes are a breaking change requiring ADR revision.
- `postMessage` handlers on the embedded side check `event.origin` before processing. An
  unchecked origin is a security violation.

---

## Constraints on LumaWeave

This decision requires **one change to LumaWeave's bootstrap** when Mode B integration arrives
(not required for v0.2.0 scaffold):

```typescript
// Minimal LumaWeave bootstrap addition (one listener, passive)
window.addEventListener("message", (event) => {
  if (event.origin !== LATTICA_ORIGIN) return; // origin check
  const msg = event.data;
  if (msg?.type !== "lattica.command") return;
  dispatch(msg.action, msg.payload);           // routes to existing reducers
});
```

This listener fires only when Lattica sends a message. When LumaWeave runs standalone, it
never fires. The constraint from ADR-009 ("no conditional behavior keyed on 'am I in Lattica'")
is preserved — the listener is passive, not a mode switch.

This does NOT constitute a LumaWeave-side change for v0.2.0. It's a prerequisite for the first
Mode B tile that sends commands, which is a v0.3+ concern.

---

## Forward-compatibility for Cerebra Mode B

When Cerebra acquires a Tauri frontend (post-Phase 11), the same two-channel split applies:
- Cerebra's `postMessage` listener accepts `lattica.command` messages
- Cerebra already emits to `cerebra/*` fossic streams (in production today)

No new IPC infrastructure needed at the second Mode B project. The channels scale to N projects.

---

## What v0.2.0 scaffolds

- The `postMessage` sending function in Lattica's shell TS (a stub that constructs the
  `{ type: "lattica.command", ... }` envelope and calls `webview.postMessage`). No receiver
  because no Mode B webview exists yet.
- fossic-tauri in Lattica's Rust backend, subscribed to the platform store, proving the
  subscription pipeline is wired. Actual LumaWeave stream subscriptions arrive when Mode B
  integration begins.

---

## What v0.2.0 does NOT scaffold

- The Mode B child webview itself (deferred; platform-positioning Linux bug still open)
- LumaWeave's `message` event listener (deferred; no Mode B tile to trigger it yet)
- fossic stream subscriptions to `lumaweave/*` (deferred until Mode B integration)
- Request/response correlation ID layer on `postMessage` (deferred; commands are fire-and-
  forget at this stage)

---

*This ADR is a direct consequence of the Mode B embedding research (docs/research/mode-b-webview-embedding.md) and the IPC class analysis from the v0.2.0 pre-scaffold design session.*
