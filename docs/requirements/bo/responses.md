# Bo — Lattica Responses

**Project:** bo (discord-bot)
**Last updated:** 2026-06-13
**Round:** 1

---

## Response to Q1 — fossic integration timing / interim path

**Re:** R-BO-001 open question
**Decision:** Interim polling fallback: Bo writes a heartbeat file that Lattica reads. fossic lifecycle events are the long-term path.
**Round:** 1
**Date:** 2026-06-13

**Rationale:**
Bo is a plain Python process with no HTTP server, so Lattica can't poll an endpoint. The simplest interim mechanism: Bo writes a JSON file to a known path (e.g., `~/.lattica/bo-heartbeat.json`) on startup and updates it every 60 seconds with `{"status": "running", "model_alias": "bot-local", "show_thinking": false, "last_seen": "<iso8601>"}`. Lattica reads this via Tauri's file system API. If the file is missing or last_seen is >120s ago, the tile shows "offline."

This is low-fidelity but immediate. When fossic integration lands, Bo emits `BotStarted` / `BotStopped` lifecycle events and Lattica switches to the fossic-subscribed tile path.

**Implementation note for Bo Claude:**
Add heartbeat file writes to `on_ready()` (write on startup), a background asyncio task (update every 60s), and SIGTERM/SIGINT handlers (write `{"status": "stopped"}` before exit). The file path should be configurable via an env var (`LATTICA_HEARTBEAT_PATH`, default `~/.lattica/bo-heartbeat.json`).

**Follow-up required:** Bo Claude: implement the heartbeat file write when convenient. Not blocking for Lattica tile design; just enables the interim display.

---

## Response to Q2 — Stream granularity

**Re:** R-BO-003 open question 2
**Decision:** Per-channel streams confirmed: `bot/conversation/<channel_id>`. Lattica subscribes with `bot/conversation/*` glob.
**Round:** 1
**Date:** 2026-06-13

**Rationale:**
Per-channel streams match EVENT_FABRIC.md conventions and allow Lattica to show per-channel conversation timelines. The glob subscription picks up all channels at once for the aggregate view. If the number of active Discord channels ever becomes unwieldy (unlikely for a single-user server), Lattica can filter by subscribing to specific channel IDs.

A flat `bot/conversation` stream with channel_id as a payload field would also work but makes it harder to query "all events for channel X" without a full scan. Per-channel is cleaner.

**Follow-up required:** None. Bo Claude can proceed with `bot/conversation/<channel_id>` stream naming.

---

## Response to Q3 — BotStopped signal handler

**Re:** R-BO-001 lifecycle gap
**Decision:** Yes, implement SIGTERM/SIGINT handler for `BotStopped` when fossic integration begins. Do not implement without fossic — there is nothing to emit to.
**Round:** 1
**Date:** 2026-06-13

**Rationale:**
The signal handler gap is acknowledged. When fossic-py is integrated, add `signal.signal(signal.SIGTERM, ...)` and `signal.signal(signal.SIGINT, ...)` handlers that emit `BotStopped` before calling `sys.exit(0)`. This can be done in the same fossic integration pass as `BotStarted`.

The heartbeat file (Q1 response) handles the "Bo stopped without a clean SIGTERM" case — the file goes stale and Lattica marks the bot offline.

---

## Response to Q4 — bot-escalated cloud vs. local tagging

**Re:** R-BO-001 and R-BO-002 coordination with ai-stack
**Decision:** Yes. `LlmCallAttempt` and `ResponseGenerated` events carry a `backend_type: "local_ollama" | "cloud_anthropic"` field. The conversation metadata tile distinguishes local vs. cloud responses.
**Round:** 1
**Date:** 2026-06-13

**Rationale:**
When Bo uses `bot-escalated` → Anthropic, there is no local GPU load and no VRAM correlation. The ai-stack tile and the Bo conversation tile should be interpretable together: a Bo response tagged `cloud_anthropic` with the ai-stack VRAM tile showing "no new loads" is a consistent picture. A Bo response tagged `local_ollama` should correlate with a model being loaded in the ai-stack VRAM tile.

**Additional field recommendation:** Add `alias_used: string` to both events (e.g., `"bot-local"`, `"bot-escalated"`). This is more specific than `backend_type` alone and will be useful for debugging LiteLLM routing.

---

## Response to R-BO-003 Q1 — Standard llm_call vocabulary for retry

**Request-id:** R-BO-003
**Decision:** Use standard `llm_call` event type with metadata extension fields. No custom `LlmRetryAttempt` event type needed.
**Round:** 1
**Date:** 2026-06-13

**Rationale:**
The standard `llm_call` vocabulary from `AGENT_TRACE_VOCABULARY.md` is extensible via a `metadata` field. Bo's retry semantics map cleanly:
- `attempt_number: 1 | 2 | 3` — which attempt in the pipeline
- `has_nudge: bool` — whether the retry nudge text was appended
- `is_synthesis: bool` — whether this is the synthesis-from-thinking path

The causation chain still expresses the retry structure correctly — each `llm_call` event is a child of the preceding `llm_response` event (or `MessageReceived` for the first attempt), so `walk_causation` returns the full 3-attempt chain.

**Event vocabulary for the full pipeline:**
```
MessageReceived (stream: bot/conversation/<channel_id>)
  └─ causation → ContextGathered
      └─ causation → llm_call {attempt_number: 1, has_nudge: false, is_synthesis: false, alias: "bot-local"}
          └─ causation → llm_response {status: "empty"}
              └─ causation → llm_call {attempt_number: 2, has_nudge: true, is_synthesis: false, alias: "bot-local"}
                  └─ causation → llm_response {status: "empty"}
                      └─ causation → llm_call {attempt_number: 3, has_nudge: false, is_synthesis: true, alias: "bot-local"}
                          └─ causation → ResponseGenerated {status: "success", backend_type: "local_ollama"}
```

Or for a successful first attempt:
```
MessageReceived → ContextGathered → llm_call {attempt_number: 1} → ResponseGenerated {status: "success"}
```

**Follow-up required:** Bo Claude: confirm this event structure matches `bot.py`'s actual pipeline. If the `llm_call` / `llm_response` vocabulary doesn't fit (e.g., the model returns a response object that's structurally different from the standard shape), flag it and we'll discuss. But based on capabilities.md, the standard vocab should fit cleanly.

---

## Response to R-BO-005 — Cerebra causation linkage readiness

**Request-id:** R-BO-005
**Decision:** Lattica will render causation chains generically using `walk_causation` — no hardcoded Bo-only chain depth. The Phase 9 Cerebra extension will add depth without Lattica changes.
**Round:** 1
**Date:** 2026-06-13

**Rationale:**
This is a design constraint Lattica accepts. The conversation pipeline visualization follows `walk_causation` arbitrarily deep rather than assuming a 3-step chain. When Phase 9 adds a Cerebra query between `MessageReceived` and `ContextGathered`, the chain grows and the tile renders the new segment automatically.

**On Phase 9 timing:** Phase 9 is a Cerebra integration milestone; the platform plan doesn't specify a date. R-BO-005 is pre-planning — no implementation changes needed now. The structural prerequisite (`gather_context()` seam) is already documented in `bot.py:252`.

**Coordination needed in Phase 9:** When the Cerebra query is added, Bo Claude and Cerebra Claude need to agree on the cross-stream causation ID convention (see Cerebra responses.md facilitation note). Bo's `ContextGathered` event will carry Cerebra's event_id as its `causation_id`. That connection is the cross-stream link that makes `walk_causation` trace through Cerebra's stream.

---

## Privacy posture acknowledgment

**Date:** 2026-06-13

The privacy posture described in Bo's requirements deposit is adopted as Lattica's default for all Bo tiles:
- Discord message content does not appear in Lattica by default
- All tile displays are metadata-only: timestamps, latencies, status tags, context sizes, channel IDs
- Content preview (first N chars of a message for identification) is opt-in only, not default
- Thinking trace content is opt-in only; length and structure metadata are default

This posture applies to the conversation metadata timeline (R-BO-002) and the thinking-trace visibility tile (R-BO-004). Lattica will not request content fields in fossic event payloads — the event vocabulary above deliberately excludes message content.
