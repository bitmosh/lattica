# Cerebra — Needs Wiring
**Filed by:** cerebra-claude
**Date:** 2026-06-16
**Purpose:** Hard-coded value ambiguities and wiring migrations flagged during federation design (D.2 audit).

These are not implementation blockers for the compile — they are pre-implementation notes for the relay and fold-in passes.

---

## NW-1 — `cerebra/graph/<lineage_id>` stream name must be a constant

**Current state:** Not yet implemented.
**Risk:** When `GraphSnapshotAvailable` hub-direct write is added to `EventEmitter`, the stream name `"cerebra/graph"` will likely be inlined as a string literal at the call site. Same pattern as `"cerebra/agent-trace"` and `"cerebra/lattice"` which are currently inline strings in `event_emitter.py`.

**Required wiring:** Define `CEREBRA_GRAPH_STREAM_PREFIX = "cerebra/graph"` as a module-level constant (either in `event_emitter.py` or a new `cerebra/storage/streams.py` constants file). The lattice and agent-trace prefixes should be extracted to the same location at the same time to establish the pattern.

**File:** `cerebra/cognition/event_emitter.py`

---

## NW-2 — Bot.py `bot/lifecycle` and `bot/conversation/*` stream names

**Current state:** `bot.py` writes to stream `"bot/lifecycle"` and `f"bot/conversation/{message.channel.id}"`.
**Under fold-in:** These streams must migrate to `"cerebra/bot/lifecycle"` and `f"cerebra/bot/conversation/{message.channel.id}"` to sit within Cerebra's stream namespace.

**Risk:** The current `FOSSIC_STORE_PATH` in bot.py writes directly to `~/.lattica/fossic/store.db` (the shared hub store). Hub events under the `"bot/*"` namespace exist today in the hub store. If the fold-in migration renames to `"cerebra/bot/*"`, there will be a stream name discontinuity in hub history. Any hub consumer (tiles, witness model) reading `"bot/*"` will not see fold-in events.

**Required wiring:**
1. Decide: snapshot old `"bot/*"` streams before migration, or accept discontinuity (clean break)
2. Define stream constants in Cerebra's codebase: `CEREBRA_BOT_LIFECYCLE_STREAM` and `CEREBRA_BOT_CONVERSATION_STREAM_PREFIX`
3. Replace inline stream strings in migrated bot.py code with these constants

**Files:** `discord-bot/bot.py` (lines 652–664 for lifecycle; `ask_local_model()` for conversation events); new cerebra plugin file (fold-in target)

---

## NW-3 — Bot.py `FOSSIC_STORE_PATH` vs `FossicStore.at_platform_path()`

**Current state:** `bot.py` line 79 defines:
```python
FOSSIC_STORE_PATH = Path.home() / ".lattica" / "fossic" / "store.db"
```
This is identical to the path `FossicStore.at_platform_path()` resolves to in `cerebra/storage/fossic_store.py`. Correct by coincidence — two independent constructions of the same path.

**Risk:** If the platform convention for hub store path changes (e.g., configurable via env var, or a different XDG path), `bot.py`'s independent path construction diverges silently. No test would catch the divergence.

**Required wiring:** Under fold-in, the discord plugin code must use `FossicStore.at_platform_path()` — the single authoritative path constructor — rather than any independently constructed path. Remove `FOSSIC_STORE_PATH` from migrated code entirely.

**Files:** `discord-bot/bot.py` (line 79); migrated plugin code

---

*End of needs-wiring.md*
