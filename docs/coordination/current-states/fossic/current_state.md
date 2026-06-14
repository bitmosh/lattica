# Fossic — Current State

**Last updated:** 2026-06-14
**Version:** v1.0.0o (vocab doc) / Cargo.toml bindings at 0.1.0

---

## What shipped recently

- **v1.0.0o** (this pass) — `AGENT_TRACE_VOCABULARY.md` corrections: stream key `<cycle_id>` → `<session_id>` throughout §7.1, §7.2; Correction A (`CatalystArmSelected` `score_components` v0.2 gap documented); Correction B (`ReinjectionTriggered` stale schema replaced — `trigger_predicate`, `continuation_bundle_id`, `recursion_depth`, causation fixed to `SessionFlushed`); §8.2 OTel attributes corrected; sibling vocab scope note added
- **v1.0.0p** — prior vocab pass (DEVIATION.md last_reviewed)
- **v0.10.0r** — Justfile + unified test surface, CI fix

## Core capabilities (stable)

- Append-only CCE event store (Rust, SQLite+WAL, `std::thread` + `crossbeam-channel`)
- Python binding (`fossic-py`), Node binding (`fossic-node`, package name: `"fossic"`), Tauri plugin (`fossic-tauri`)
- `just test` — canonical full-suite command
- Glob subscriptions, snapshot caching, CCE encoder exposed to Python

## Platform store topology (confirmed)

- Single platform store at `~/.lattica/fossic/store.db` (per Lattica ADR-012)
- `fossic-tauri` opens via `app.path().home_dir()?.join(".lattica/fossic/store.db")`
- `fossic-node` install key: `"fossic": "file:../../fossic/fossic-node"` (not `"fossic-node"`)

## Open action items

- **Policy Scout round 2** — fossic round 2 response to policy-scout drafted (this pass)
- **fossic-tauri integration pass** — waiting for Lattica Phase 1 Rust shell setup
- **`fossic_subscription_status` Tauri command** — ships before LumaWeave R-F-004
- **PD-007** — blake3 install approved, `compute_event_id()` via PyO3 pending

## Open tech debt

- TD-001 (MEDIUM): PyO3 bridge latency at high event counts — mitigation: snapshot every 10 events
- TD-003 (LOW): `time = "=0.3.37"` exact pin in fossic-tauri
- TD-004 (MEDIUM): `SimilaritySearchProvider` declared in spec, absent from code
- PD-005 (LOW): snake_case vs PascalCase naming convention note needed in vocab §9
- PD-007 (LOW): blake3 not in Python test env — `event_id` derivation untested at Python level

## Dependencies on other projects

- Cerebra: passes cross-pollination files for vocab updates; v0.2 will add `ActionProposed` event (no current action)
- Policy Scout: Phase 2 fossic-py emit pending developer approval of fossic-py install
- LumaWeave: R-F-004, R-F-006 integration pending fossic-tauri pass
