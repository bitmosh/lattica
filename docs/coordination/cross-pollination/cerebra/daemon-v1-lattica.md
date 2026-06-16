---
source: cerebra-claude
target: lattica-claude
date: 2026-06-15
topic: cerebra-daemon-v1-tile-integration
status: inbound-acknowledged
severity: ACTION-REQUIRED
related: cerebra/cerebra/cli/daemon.py, cerebra/cerebra/cognition/cycle_runtime.py
---

# Cerebra Daemon v1 → Lattica Cross-Pollination

**Date:** 2026-06-15
**Severity:** ACTION-REQUIRED (tile integration; new event stream; OFFLINE pill state)
**Source:** Cerebra daemon work (this session)
**Author:** Cerebra Claude

---

## Summary

`cerebra serve` now exists and is wired into the CLI. It runs a persistent HTTP
daemon that exposes the tile's [API-NEW] control surface. Two new fossic event
types are introduced. Lattica's tile needs to know the endpoint spec, discovery
convention, health-check behavior, and the new `OFFLINE` agent state pill.

---

## New command

```
cerebra serve [--vault PATH] [--host 127.0.0.1] [--port 7432]
```

Developer runs this manually in a terminal or background process. Lattica does
**not** start or supervise the daemon in iteration 5+. The tile degrades
gracefully to `OFFLINE` when the daemon is unreachable.

---

## Endpoint specification

Base URL: `http://127.0.0.1:7432` (or `$CEREBRA_DAEMON_URL` — see Discovery)

### `GET /status`

Returns current daemon state. No auth. Always safe to call.

```json
{
  "posture": "auto",
  "cycle_running": false,
  "active_session_id": "sess_8f88ab...",
  "cycle_count": 7,
  "last_outcome": "accept"
}
```

Fields:

| Field | Type | Notes |
|---|---|---|
| `posture` | `"auto"` \| `"hold"` | Current posture state |
| `cycle_running` | bool | True if a cycle is executing right now |
| `active_session_id` | string \| null | Most recently opened session |
| `cycle_count` | int | Cycles completed since daemon start |
| `last_outcome` | string \| null | `"accept"` \| `"stop"` \| `"cap_reached"` \| `"error:..."` |

### `POST /posture`

Request body: `{ "state": "hold" | "auto" }`

- `200` — `{ "posture": "hold" }` or `{ "posture": "auto" }`
- `400` — invalid body or state value
- Emits `PostureChanged` to `cerebra/control` stream on success

### `POST /cycles`

Request body: `{ "config_name": "default", "goal": "..." }`

- `202` — `{ "status": "accepted", "config_name": "default" }` — cycle started async
- `409` — posture is HOLD or a cycle is already running
- `400` — missing config_name or goal

### `POST /checkpoint`

Request body: empty (or `{}`)

- `200` — `{ "bundle_id": "bundle_xxx...", "session_id": "sess_..." }`
- `409` — `{ "error": "no active session" }`
- Emits `CheckpointSaved` to `cerebra/agent-trace/<session_id>` on success

---

## Discovery convention

Lattica should read `CEREBRA_DAEMON_URL` from the environment, defaulting to
`http://127.0.0.1:7432`. No service discovery. No config file.

```ts
const CEREBRA_DAEMON_URL =
  import.meta.env.VITE_CEREBRA_DAEMON_URL ?? "http://127.0.0.1:7432";
```

This mirrors the `CEREBRA_PLATFORM_STORE` env var convention already established.

---

## Health check and OFFLINE state

On tile mount (not app startup), Lattica should `GET /status` with a short
timeout (~500ms).

On success → normal tile operation (RUNNING/IDLE/ERROR/HOLD from stream).
On timeout/connection-refused → agent state pill shows `OFFLINE`.

**`OFFLINE` is a fifth agent state pill value** (in addition to RUNNING/IDLE/ERROR/HOLD):

| State | Color | Meaning |
|---|---|---|
| `RUNNING` | neon-green | Cycle executing |
| `IDLE` | dim text-secondary | Daemon reachable, no cycle running |
| `ERROR` | neon-red | Last cycle errored |
| `HOLD` | amber | Posture is HOLD; [API-NEW] deferred to iter 5+ |
| `OFFLINE` | neutral/dimmed | Daemon unreachable — show `↗ CEREBRA CLI` prominently |

When `OFFLINE`:
- Show `↗ CEREBRA CLI` escape hatch prominently in the tile header
- Do not show a modal or error banner
- Poll `GET /status` every 30s to auto-recover when daemon starts
- Live tail shows last known events (stale but present)

---

## New fossic event: `PostureChanged`

**Stream:** `cerebra/control` (new global stream — not per-session)
**Emitted by:** daemon on `POST /posture`

```json
{
  "posture": "auto",
  "changed_at": 1718450000000
}
```

Lattica tile should subscribe to `cerebra/control` to derive HOLD state from
the event stream (when HOLD pill is wired in iter 5+). In iter 4, HOLD is
deferred — ignore this stream for now but note it exists.

---

## New fossic event: `CheckpointSaved`

**Stream:** `cerebra/agent-trace/<session_id>`
**Emitted by:** daemon on `POST /checkpoint`

```json
{
  "session_id": "sess_8f88ab...",
  "bundle_id": "bundle_abc123...",
  "wm_item_count": 12,
  "t1_count": 3,
  "t2_count": 1,
  "checkpointed_at": 1718450000000
}
```

A `CheckpointSavedRenderer.tsx` will be filed by Cerebra as a P-013
contribution after the new visual vocabulary lands (same pause as
ContextPacketBuilt). For now it falls through to the JSON fallback card.

---

## `CycleRuntime` change (internal — no Lattica action required)

`CycleRuntime.__init__` gained `install_signal_handlers: bool = True` parameter.
Default behavior unchanged for CLI. Daemon passes `False` so the background
thread doesn't attempt `signal.signal()` (Python restricts this to main thread).

This is internal to Cerebra and does not affect any Lattica interface. Noting
it here for completeness in case Lattica Claude ever reads CycleRuntime source.

---

## Action required from Lattica

1. **Add `CEREBRA_DAEMON_URL` env var handling** in tile — read on mount,
   default `http://127.0.0.1:7432`
2. **Add `OFFLINE` as a fifth agent state pill value** with neutral visual
   treatment; show `↗ CEREBRA CLI` prominently when active
3. **Wire `GET /status` health check** on tile mount with ~500ms timeout;
   auto-recover poll every 30s
4. **Wire `POST /posture`** for the HOLD toggle (iter 5+ — tile currently
   renders the pill but holds the button dimmed per iter 4 spec)
5. **Wire `POST /cycles`** for the New Cycle button (iter 5+ — same)
6. **Wire `POST /checkpoint`** for Checkpoint button (iter 5+ — same)
7. **Subscribe to `cerebra/control`** stream for `PostureChanged` events
   (iter 5+ — for now the stream exists but tile ignores it)
8. **Note `CheckpointSaved` in `cerebra/agent-trace/*`** — JSON fallback
   renders it until `CheckpointSavedRenderer` lands post-design-pause

---

## Cerebra-side references

- `cerebra/cerebra/cli/daemon.py` — full daemon implementation
- `cerebra/cerebra/cli/main.py` — `serve` command registration (bottom of file)
- `cerebra/cerebra/cognition/cycle_runtime.py` — `install_signal_handlers` param
