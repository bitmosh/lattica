# Needs-Wiring Log — Lattica

**Filed by:** lattica-claude (federation interview pass)
**Date:** 2026-06-16
**Purpose:** Log of existing hard-coded values in Lattica's tree that should be replaced with live-wired LiveValue<T> bindings or moved to config constants. A sweep pass will act on these.

Entries confirmed from on-disk code inspection. This is not an exhaustive audit — a future sweep pass will cover the full tree.

---

## Format

| Element / binding | Location | Hard-coded value | Who confirms | Confidence | Notes |
|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... |

---

## Entries

| Element / binding | Location | Hard-coded value | Who confirms | Confidence | Notes |
|---|---|---|---|---|---|
| Cerebra daemon URL | `src/tiles/cerebra-signal/daemon.ts:1` | `"http://127.0.0.1:7432"` | Cerebra (port); Lattica (IP) | High | Already a named constant `DEFAULT_DAEMON_URL`; good pattern. Move to shared config if daemon port ever becomes user-configurable. No immediate action needed. |
| Hub store path | `src-tauri/src/lib.rs:133` | `home.join(".lattica/fossic/store.db")` | Lattica | Confirmed | Hard-coded in Rust. Stable path. §8.5 resolved. Consider extracting to a named constant in lib.rs for discoverability. Not urgent. |
| Ollama endpoint | `src/tiles/ai-stack/AiStackTopologyTile.tsx:31` | `"http://localhost:11434"` | ai-stack | High | Phase 1 direct-poll constant. Will become a `wiring-incomplete` LiveValue in Phase 2 when tile switches to hub subscription. Keep for now; sweep when Phase 2 wiring is written. |
| LiteLLM endpoint | `src/tiles/ai-stack/AiStackTopologyTile.tsx:32` | `"http://localhost:4000"` | ai-stack | High | Same as above. Phase 1 only. |
| Open WebUI endpoint | `src/tiles/ai-stack/AiStackTopologyTile.tsx:33` | `"http://localhost:3000"` | ai-stack | High | Same as above. Phase 1 only. |
| Cerebra agent-trace stream pattern | `src/tiles/cerebra-signal/CerebraSignalTile.tsx:74` | `"cerebra/agent-trace/*"` | Cerebra (D.3 ratification) | High | Stream name under D.3 is correct as-is (no double-prefix). No change needed if D.3 ratified. Log in case naming convention changes. |
| Cerebra control stream pattern | `src/tiles/cerebra-signal/CerebraSignalTile.tsx:81` | `"cerebra/control"` | Cerebra | High | Same as above. |
| Registrations stream globs (×5) | `src/registrations.tsx:16,24,32,40,48` | `"cerebra/agent-trace/*"` | Cerebra | High | Five separate `stream_glob` entries in payload renderer registrations. All identical. Under D.3, all correct. No change needed unless naming convention changes; log for post-ratification check. |
| fossic_subscribe branch null | `src/tiles/cerebra-signal/CerebraSignalTile.tsx:75` | `branch: null` | Lattica / Fossic | Medium | Null branch means "any branch." Fine for dev use. Consider whether production tiles should pin to a branch. Future design question, not immediate sweep item. |

---

## Sweep status

- **Completed:** On-disk inspection of `src/tiles/cerebra-signal/`, `src/tiles/ai-stack/`, `src-tauri/src/lib.rs`, `src/registrations.tsx`
- **Pending sweep:** `src/tiles/policy-scout/` (not yet built), `src/tiles/lumaweave/` (not yet built), full `src/` tree scan for additional endpoint literals
- **Action gating:** Sweep pass for Phase 1 → Phase 2 transitions; `LiveValue<T>` type introduction pass

---

## Notes

- The ai-stack endpoint constants (`OLLAMA`, `LITELLM`, `OPENWEBUI`) are well-named and file-scoped. The issue is not the naming — it's that they're static values that will need to transition to hub-event-backed display in Phase 2. The transition is `wiring-incomplete → pre-relay → live` as Phase 2 tile wiring lands.
- The daemon URL constant is already a good pattern (`DEFAULT_DAEMON_URL`). No change needed unless daemon becomes user-configurable.
- Hub store path is the highest-priority item for extractability — if a developer ever needs to change it, they need to find `lib.rs:133`. A named constant like `const HUB_STORE_FILENAME: &str = ".lattica/fossic/store.db"` would improve discoverability. Low priority; note for next Rust pass.
