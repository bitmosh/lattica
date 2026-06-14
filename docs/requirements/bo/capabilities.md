# Bo — Capabilities Inventory

**Project:** bo (discord-bot)
**Author:** Bo Claude
**Date:** 2026-06-13
**Purpose:** What Bo offers that is relevant for display or utilization in Lattica.

Bo is a Discord bot (Phase 0) with a structured inference pipeline, explicit
context seam for future Cerebra integration, and thinking-trace capabilities.
Its Lattica-relevant capabilities are primarily **conversation pipeline metadata**
and **operational lifecycle signals** — not content.

---

## Core capabilities

### Message handling
- Responds to `@mention` or name trigger (`Bo`, case-insensitive, whole-word)
- Strips mention tokens before passing to model
- Handles both regular channel messages and thread messages
- Skips bot messages to prevent loops
- Configurable: `BOT_TRIGGER_NAME`, `DISCORD_TOKEN`, `LITELLM_BASE_URL`

### Inference routing — two paths
1. **LiteLLM path** (`ask_via_litellm`) — fast, standard OpenAI-compat call
   to LiteLLM at `LITELLM_BASE_URL:4000`. Strips thinking output. Default path
   when `show_thinking=False`.
2. **Direct Ollama path** (`ask_via_ollama`) — slower, surfaces thinking as a
   separate field from the model response. Active when `show_thinking=True`.

Both paths are controlled by the `state["show_thinking"]` flag, toggled via
the `thinking on/off` command.

### Three-attempt retry/synthesis pipeline
When the model returns empty content, Bo tries three times before giving up:
1. First attempt — standard prompt
2. Retry — prompt + nudge text `"(I need an actual answer here, briefly...)"`;
   tagged `_(retried)_`
3. Synthesis — uses accumulated thinking trace to generate a summary response
   from the thinking even when the main output is empty; tagged
   `_(synthesized from reasoning)_`
4. Graceful fallback — `"I'm drawing a blank on that one — could you rephrase?"`
   tagged `_(no response)_`

The `status_tag` field is the only signal that distinguishes these outcomes in
Discord. It maps directly to a payload field in a `ResponseGenerated` fossic
event.

### Context gathering (`gather_context`)
- Fetches last `CONTEXT_HISTORY_SIZE` (default 10) messages from the channel
- Filters: humans always included, Bo itself always included, other bots only
  if in `CONTEXT_BOT_ALLOWLIST`
- Strips Bo's own status tags before re-feeding as context
- **This function is the explicit seam for Cerebra integration.** Documented
  in code: "Replace or wrap it to plug in persistent memory, retrieval,
  summarization, etc., without touching the rest of bot.py."
- Returns OpenAI-format `[{role, content}]` message list, oldest first

### Thinking trace handling
- Extracts `<think>...</think>` tags from model output
- Also checks `reasoning_content` and `thinking` attributes on the message object
- When `show_thinking=True`: posts reply in main channel, dumps thinking in a
  Discord thread anchored on the user message (or inline if already in a thread)
- Thread title auto-generated from prompt words (stopword-filtered, ≤5 words,
  ≤50 chars)
- Thinking wrapped in `||spoiler||` for inline posts; unwrapped in threads

### Runtime commands
- `thinking` / `thinking status` / `thinking ?` — report current show_thinking state
- `thinking on` — enable direct Ollama path + thinking display
- `thinking off` — disable, revert to LiteLLM path
- Commands are matched before model call (instant response, no inference cost)

### Response chunking
- Discord 2000-char limit handled by `chunk_for_discord()`: splits on paragraph
  boundaries first, falls back to hard cut. Sends multiple messages for long
  responses.

---

## Observable metadata Bo exposes (without content)

These are privacy-safe signals — no Discord message text, just structural data:

| Signal | Source | Notes |
|---|---|---|
| Message arrival time | `message.created_at` | When the trigger fired |
| Context window size | `len(context)` from `gather_context()` | How many history messages included |
| Response latency | wall time: message received → reply sent | Measure of inference + pipeline time |
| Status tag | `_retried_` / `_synthesized from reasoning_` / `_(no response)_` | Which attempt path succeeded |
| Thinking path active | `state["show_thinking"]` | Whether direct Ollama path is on |
| Channel ID | `message.channel.id` | Discord channel (no content) |
| Backend used | LiteLLM vs. direct Ollama | Derivable from show_thinking state |
| Model alias | `MODEL_ALIAS` env var, default `bot-local` | Which LiteLLM alias was queried |

---

## Events Bo could emit (when fossic-integrated)

Stream prefix: `bot/conversation/<channel_id>` and `bot/lifecycle`

- `BotStarted` — emitted in `on_ready()` handler; payload: bot user ID, model
  alias, LiteLLM base URL
- `BotStopped` — emitted on SIGTERM/SIGINT (requires signal handler addition)
- `MessageReceived` — emitted when a triggering message is detected; payload:
  channel ID, message ID, is_mention (bool), context_history_size
- `ContextGathered` — emitted after `gather_context()` returns; payload:
  context_message_count, includes_bot_history (bool)
  - **Future:** when Cerebra integration lands, this event will carry a
    `causation_id` pointing to the Cerebra `ContextRetrieved` event
- `LlmCallAttempt` — emitted before each inference call; payload: attempt number
  (1/2/3), path (litellm|ollama_direct), alias, has_nudge (bool),
  is_synthesis (bool)
- `ResponseGenerated` — emitted after a successful response; payload:
  status_tag, response_latency_ms, thinking_length_chars, used_thinking_path
- `GracefulError` — emitted when all three attempts fail; payload: had_thinking
- `ThinkingStateChanged` — emitted when `thinking on/off` command fires;
  payload: new_state (bool)

---

## What Bo does NOT offer Lattica

- **Content** — Discord message text, user names, thinking trace text are all
  out of scope for Lattica display by default (opt-in only, not default)
- **Autonomous escalation** — Bo is in shadow mode; it surfaces escalation
  candidates to boop but does not route to a second model. No escalation events
  to observe yet.
- **Persistent memory** — all context comes from Discord history window.
  No memory store to inspect today (Cerebra integration is Phase 9).
- **Web presence or HTTP API** — Bo is a Discord bot, not a server; nothing
  to poll. Lattica observability requires either fossic events or a heartbeat
  side-channel.
- **Multi-channel or multi-server** — single bot instance, single Discord
  server context. Stream per-channel is the right granularity.

---

## Fossic integration readiness

**None today.** No fossic events are emitted.

Integration is straightforward in principle:
- Python environment with `.venv` present; fossic-py would install there
- The event emission points are clear: `on_ready`, signal handlers, and four
  locations in `ask_local_model()` (before each attempt, after success, after
  graceful error)
- Blocked on: developer approval for fossic-py package install; fossic-py
  `append` API confirmation

The `gather_context()` seam is the structural prerequisite for Cerebra
causation — no additional refactoring needed to add a Cerebra query there.
