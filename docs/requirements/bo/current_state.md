# Bo — Current State

**Project:** bo (discord-bot)
**Last updated:** 2026-06-13
**Living doc:** yes — update when phase advances, configuration changes, or
integration milestones land.

---

## Phase

**Phase 0 — minimal listener.** Bo responds to @mentions and name triggers by
querying the local Qwen model via LiteLLM. No escalation logic, no channel-
specific behavior, no persistent memory, no autonomous decisions.

Shadow mode is active: escalation-worthy decisions are surfaced to boop with
the full answer + a shadow-mode note, but Bo does not autonomously route to a
second model.

---

## Deployment

- **Process:** plain Python process (`python bot.py`), no supervisor
- **Runtime:** Python 3.12 via `.venv`
- **Start:** manual (`python bot.py` in the repo directory)
- **Stop:** Ctrl+C
- **No Docker container**, no systemd unit, no restart-on-crash mechanism

---

## Active configuration (from .env)

| Variable | Current value / default |
|---|---|
| `DISCORD_BOT_TOKEN` | set in `.env` (private) |
| `LITELLM_BASE_URL` | `http://localhost:4000` |
| `LITELLM_API_KEY` | `sk-fake` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` |
| `OLLAMA_MODEL` | `qwen3.5:latest` |
| `BOT_MODEL` (alias) | `bot-local` |
| `SHOW_THINKING` | `false` (default; togglable via command) |
| `BOT_TRIGGER_NAME` | `Bo` |
| `CONTEXT_HISTORY_SIZE` | `10` |
| `CONTEXT_BOT_ALLOWLIST` | empty (only humans + Bo for context) |

---

## Inference routing (current)

- **Default path:** LiteLLM → `bot-local` alias → Ollama `qwen3.5:latest`
- **Thinking path (when enabled):** direct Ollama at `:11434` → `qwen3.5:latest`
- **`bot-escalated` alias:** `anthropic/claude-sonnet-4-6` — defined in
  LiteLLM config but **not yet used**. Escalation routing is a future phase;
  Bo currently does not call `bot-escalated` autonomously.

---

## Memory / context

- **All context from Discord channel history** — last 10 messages, newest-first
  fetched and reversed to oldest-first
- **No persistent memory** — Bo has no memory of conversations across restarts
  or across channels
- **Cerebra integration seam** — `gather_context()` in `bot.py:252` is
  explicitly documented as the replacement point for Cerebra-based retrieval.
  No Cerebra queries happen today.

---

## Fossic integration status

**None.** No fossic events emitted.

- No stream exists for `bot/conversation` or `bot/lifecycle`
- No BotStarted/MessageReceived/ResponseGenerated events
- Blocked on: developer approval for fossic-py package; fossic-py API surface
  confirmation from fossic team

---

## System prompt

Lives at `prompts/system.md`. Key characteristics:
- Bo is a general-purpose assistant ("boop's Discord server")
- Knows about Bandit (Claude Code instance that posts coding updates)
- Shadow mode: surfaces escalation-worthy decisions with explanation, does
  not escalate autonomously
- Warm conversational tone; match the register; accuracy over friendliness
  for technical content
- Confidence-calibrated: distinguishes "I know", "I think", "I'd guess"

---

## Known limitations / gaps

| Gap | Impact | When resolved |
|---|---|---|
| No fossic integration | Lattica has nothing to subscribe to for Bo | When fossic-py approved + sidecar built |
| No persistent memory | context resets every restart; no cross-session recall | Phase 9 (Cerebra integration) |
| No process supervisor | Bo crashes = offline until manually restarted | Future phase |
| No escalation routing | `bot-escalated` alias unused; shadow mode only | Future phase |
| BotStopped signal handler | SIGTERM doesn't emit a lifecycle event | Small addition when fossic integration begins |
| No health endpoint | Lattica cannot poll Bo directly (not an HTTP server) | Fossic events are the preferred path |

---

## What's next for Bo (in Lattica integration order)

1. **Fossic-py package approval** — gate on developer vetting + approval
2. **fossic emit in `on_ready()` and signal handler** — BotStarted + BotStopped
3. **fossic emit in `ask_local_model()`** — LlmCallAttempt + ResponseGenerated
   at each retry step
4. **fossic emit in `on_message()`** — MessageReceived + ContextGathered
5. **Lattica polling-fallback tile** (interim, no fossic): read a heartbeat file
   or check Discord bot status via API — lower fidelity but immediate value
6. **Phase 9: Cerebra integration** — replace `gather_context()` with a Cerebra
   retrieval call; add causation_id to ContextGathered event

---

*Update this file when: Bot phase advances, configuration changes, fossic
integration lands, Cerebra integration begins, or escalation routing activates.*
