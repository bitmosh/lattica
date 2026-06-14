# Bo — Lattica Requirements

**Project:** bo (discord-bot)
**Author:** Bo Claude (acting as bo advocate)
**Date:** 2026-06-13
**Status:** Initial requirements deposit

Bo is a Discord bot (Phase 0) that routes @mention messages through a local
LiteLLM stack to Ollama-served models, with a structured retry/synthesis
pipeline, thinking-trace threading, and an explicit seam in `gather_context()`
for future Cerebra memory integration. Bo's Lattica presence is an operational
dashboard tile plus — when fossic integration lands — a conversation pipeline
visualization that makes the retry chain and future Cerebra causation chain
visible.

---

---
id: R-BO-001
category: tile-design
priority: must-have
---

## R-BO-001 — Bot operational status tile

**Category:** tile-design
**Priority:** must-have

**Specific need:**
Lattica must provide a tile showing Bo's current operational state: process
up/down, model alias in use (`bot-local` → Ollama/qwen3.5), backend reachable
(LiteLLM health), recent message count, and last active timestamp. The tile is
the operational equivalent of a bot dashboard — confirm Bo is running and
connected before troubleshooting a missing response.

**Why it matters:**
Bo is a long-running process (`python bot.py`) with no existing health surface.
When it's quiet in Discord, it's hard to tell if Bo is healthy-and-idle or has
crashed. This tile makes that distinction immediate. It's also the logical home
for the current tier state (primary `bot-local` vs. escalated `bot-escalated` →
Anthropic), which matters for knowing whether responses are from Ollama or the
cloud.

**Constraints:**
- Bo currently has no health endpoint — the tile would need to be backed by
  either a fossic lifecycle event stream (`bot/lifecycle`) or a lightweight
  sidecar/probe
- If fossic-backed, Bo emits `BotStarted` / `BotStopped` on `bot/lifecycle`
  and Lattica subscribes; last-seen timestamp derives from the stream head
- The bot runs as a plain Python process, not a Docker service — no Docker
  health check is available

**Adjacent project awareness:**
The `bot-local` alias maps through LiteLLM → Ollama on ai-stack. The operational
tile for Bo and the service health tile for ai-stack (R-AS-001) are complementary
— when Bo shows "backend unreachable," the ai-stack tile should show what's down.
A user glancing at Lattica can immediately see the failure chain.

**Outstanding questions:**
Should `BotStarted` / `BotStopped` be fossic lifecycle events, or is there a
simpler Lattica mechanism for process-level heartbeat that doesn't require Bo to
integrate fossic? Fossil integration is the right long-term answer; polling a
heartbeat file or HTTP probe may be acceptable short-term.

---

---
id: R-BO-002
category: tile-design
priority: must-have
---

## R-BO-002 — Conversation metadata timeline (privacy-safe)

**Category:** tile-design
**Priority:** must-have

**Specific need:**
A tile showing conversation metadata over time: when messages arrived, response
latency (Discord message received → reply sent), context window size (how many
history messages were included), and status tags (_retried_, _synthesized from
reasoning_, _no response_). Content (actual message text) must not appear in
Lattica — only metadata.

**Why it matters:**
Bo's response pipeline has three stages (first attempt → retry with nudge →
synthesis from thinking), and failures are silent in Discord — they show only
the eventual reply or a graceful error. Seeing retry/synthesis events in Lattica
makes the pipeline observable: "responses took 45s and all went through synthesis"
tells a different story than "responses took 5s and all succeeded on first
attempt."

**Constraints:**
- Discord message content is explicitly out of scope — Lattica renders
  metadata only (latency, context size, status tag, channel ID)
- Event stream: `bot/conversation` per EVENT_FABRIC.md proposal. Events:
  `MessageReceived`, `ContextGathered`, `TierSelected`, `ResponseGenerated`
- Latency measurement: wall time from `MessageReceived` to `ResponseGenerated`
- The `status_tag` field in Bo's reply ("_retried_", "_synthesized from
  reasoning_") is exactly the signal for retry/synthesis events — it should
  become a payload field on `ResponseGenerated`

**Adjacent project awareness:**
When Cerebra memory integration lands (Phase 9 per the platform plan), the
`ContextGathered` event will include a Cerebra query causation ID. The
conversation timeline tile should be able to show that causation link
(Discord message → Cerebra context query → response) without hardcoding it —
the causation chain in fossic handles this generically.

**Outstanding questions:**
What is the right granularity for the conversation timeline? A per-message
scatter plot with latency as y-axis? A chronological list with expandable
metadata? Deferring to Lattica Claude on visualization approach, but the
underlying event shape is clear.

---

---
id: R-BO-003
category: event-subscription
priority: must-have
---

## R-BO-003 — fossic integration for the retry/synthesis causation chain

**Category:** event-subscription
**Priority:** must-have

**Specific need:**
Bo needs to emit fossic events that make the three-attempt pipeline visible
as a causation chain. The proposed shape:

```
MessageReceived (stream: bot/conversation/<channel_id>)
  └─ causation → ContextGathered (history window size, Cerebra stub or live)
      └─ causation → LlmCallAttempt (attempt=1, alias=bot-local)
          └─ causation → ResponseGenerated (status=success|empty)
              └─ causation → LlmCallAttempt (attempt=2, alias=bot-local, nudge=true)
                  └─ causation → ResponseGenerated (status=success|empty)
                      └─ causation → LlmCallAttempt (attempt=3, synthesis=true)
                          └─ causation → ResponseGenerated (status=success|graceful_error)
```

Lattica subscribes to `bot/conversation/*` and renders this causation chain
as a visual pipeline whenever a conversation is selected.

**Why it matters:**
The retry/synthesis logic in `ask_local_model()` is the most operationally
interesting behavior Bo has, and it's currently invisible. Knowing "this response
came from synthesis of empty-output thinking" vs. "first attempt succeeded" is
the difference between "everything is fine" and "Ollama is struggling." The
causation chain makes this legible across all conversations, not just ones where
boop happened to notice a delay.

**Constraints:**
- Must use the standard `llm_call` / `llm_response` event vocabulary from
  `fossic/docs/implement/AGENT_TRACE_VOCABULARY.md` where applicable
- Retry attempts should be correlated under a single `correlation_id` per
  triggering Discord message — so the full pipeline for one response is
  queryable as a unit
- Content (message text) stays out of fossic — payloads carry only structural
  metadata (attempt number, latency, status, alias used, context size)

**Adjacent project awareness:**
When Cerebra integration lands, `ContextGathered` will include a cross-stream
causation reference to `cerebra/agent-trace/<session>`. The fossic `walk_causation`
API then traces the full chain: Discord message → Cerebra query → Cerebra
reasoning → Bo response. This is the specific integration visualization the
fossic seed flagged as high value. Bo's fossic events need to be structured for
this from the start — retrofitting causation IDs later is painful.

**Outstanding questions:**
1. Does the standard `llm_call` event vocabulary (AGENT_TRACE_VOCABULARY.md)
   accommodate a "retry with nudge" semantic, or does Bo need a custom
   `LlmRetryAttempt` event type?
2. Should the `bot/conversation` stream be per-channel, per-user, or flat?
   Per-channel (`bot/conversation/<channel_id>`) seems right but creates many
   streams in a busy server.

---

---
id: R-BO-004
category: tile-design
priority: nice-to-have
---

## R-BO-004 — Thinking-trace visibility tile

**Category:** tile-design
**Priority:** nice-to-have

**Specific need:**
When Bo produces thinking output (`<think>...</think>` or `reasoning_content`
from the Ollama direct path), expose a tile that shows recent thinking traces
— length, whether they led to a usable response, and (optionally) content
preview if the user enables it. This is the observability surface for the
thinking-display toggle that boop currently controls via the `thinking on/off`
command in Discord.

**Why it matters:**
The thinking path (`ask_via_ollama` direct) is slower and only used when
`SHOW_THINKING=true`. When boop enables it, the thinking traces go into Discord
threads — but there's no aggregate view of how long thinking runs, how often
synthesis is triggered, or whether thinking is improving response quality.
A Lattica tile fills this gap without requiring boop to scroll Discord threads.

**Constraints:**
- Content of thinking traces is sensitive — expose length/structure metadata
  by default, with an explicit opt-in to preview content (mirroring the
  Discord `||spoiler||` pattern)
- The thinking path only fires when `show_thinking` state is `True` in the
  bot process — the tile should indicate whether the thinking path is currently
  active
- Low priority: the thinking feature is a toggle for boop's curiosity; it's
  not on the critical operational path

**Adjacent project awareness:**
If Cerebra adopts the same thinking/reasoning trace pattern (likely, given
shared model infrastructure), a shared thinking-trace tile format would serve
both. Worth noting, not requiring.

**Outstanding questions:**
None blocking.

---

---
id: R-BO-005
category: phase-dependency
priority: must-have
---

## R-BO-005 — Cerebra causation linkage readiness (Phase 9 coordination)

**Category:** phase-dependency
**Priority:** must-have

**Specific need:**
Bo's `gather_context()` function is explicitly documented as the seam for future
memory/Cerebra integration ("Replace or wrap it to plug in persistent memory,
retrieval, summarization, etc., without touching the rest of bot.py"). When
Phase 9 lands and `gather_context()` is replaced by a Cerebra query, Bo's fossic
events need to carry the causation ID from that Cerebra query so Lattica can
render the cross-stream chain.

This is not a current requirement — it's a structural constraint that should
inform how Lattica designs its cross-project causation tile. Lattica should not
assume Bo's causation chain terminates at LiteLLM; it will extend through
Cerebra in Phase 9.

**Why it matters:**
If Lattica's causation rendering hardcodes a Bo-only chain (Discord → LiteLLM →
response), the Phase 9 Cerebra extension becomes a Lattica refactor. If Lattica
renders causation chains generically (following fossic's `walk_causation` API
without assuming depth), the Cerebra extension adds a new chain segment without
Lattica changes.

**Constraints:**
- This is a design constraint, not a current implementation requirement
- The fossic `walk_causation` API already supports arbitrary-depth traversal —
  Lattica just needs to use it generically

**Adjacent project awareness:**
Cerebra advocate should coordinate on the cross-stream causation ID convention
(specifically: what does Cerebra's `ContextRetrieved` event look like, and how
does Bo reference it as causation in `ContextGathered`?).

**Outstanding questions:**
When does Phase 9 land? The platform plan implies memory migration is a
later-stage concern; the precise timing affects whether R-BO-005 is
pre-Phase-0 planning or Phase 2+ coordination.

---

## What Bo doesn't need from Lattica

- Lattica is not a Discord client and should not post messages or reactions on
  Bo's behalf — all Discord interaction goes through the MCP server or the bot
  process itself
- Lattica does not manage Bo's system prompt, model alias configuration, or
  environment variables — those are static files in the repo
- Lattica doesn't need to implement the thinking-display toggle — that's a
  Discord runtime command (`thinking on/off`) and lives in the bot process
- Lattica is not in the hot path of any Discord message — Bo processes and
  responds independently; Lattica observes after the fact

---

## On privacy and content handling

Discord conversation content (what boop and others say) should not appear in
Lattica tiles without explicit opt-in. The default posture for all Bo tiles is
metadata-only: timestamps, latencies, status tags, context sizes, stream IDs.
Content preview (e.g., first 50 chars of a message for identification) may be
acceptable as an opt-in feature, but should not be on by default.

This is a soft constraint from Bo's advocate — the final call is Lattica Claude's
to make in round synthesis. Flagged here so it doesn't get missed.

---

## Open questions for Lattica Claude

1. **fossic integration timing.** Bo has no fossic emitter today. For R-BO-001
   and R-BO-002 to be fossic-subscribed tiles, Bo needs to add PyO3-based event
   emission. Is there a simpler interim path (polling a heartbeat, reading a
   log file) while fossic integration is being built?

2. **Stream granularity.** `bot/conversation/<channel_id>` creates a stream
   per Discord channel. Is that the right fan-out, or should all conversations
   go to a flat `bot/conversation` stream with a `channel_id` payload field
   and filtered by Lattica subscriptions?

3. **Bot lifecycle events.** Bo is a plain Python process without a supervisor.
   `BotStarted` is easy to emit in `on_ready`. `BotStopped` is harder — it
   would need a signal handler for SIGTERM/Ctrl+C to emit reliably before exit.
   Worth implementing, but flagged as a potential gap.

4. **Coordination with ai-stack on `bot-escalated`.** The `bot-escalated`
   alias routes to Anthropic's cloud API (not Ollama). If Bo uses this tier,
   the VRAM pressure story changes (no local GPU load). Should escalated
   responses be tagged differently in the conversation metadata tile to
   distinguish local vs. cloud responses?

---

*End of bo requirements deposit. Status: open for Lattica Claude review.*
