---
unified-passage: UP-001
project: cerebra
status: pass
date: 2026-06-14
---

# Cerebra ARM Pre-flight — UP-001

## Summary

Two code-level blockers were found and fixed within Cerebra v0.5.0 scope.
A third fix (FTS5 query sanitization) was required to allow a real cycle to
complete to the `accept` outcome. All three fixes are in the working tree.
All checks that can be verified before EXECUTE now pass.

---

## Check 1 — Renderer compiles; type-checks via Lattica build system

**DEFERRED.** Renderer component has not been authored yet. This check is
structurally impossible to run during ARM phase — the renderer doesn't exist
until EXECUTE step 1. Will be verified during EXECUTE.

---

## Check 2 — Manually invoking a Cerebra cycle to completion succeeds

**PASS.**

Dry-run (ARM phase):

```
[dry-run] Config: simple.planning.v0
[dry-run] Goal:   test preflight
[dry-run] Vault:  /home/boop/cerebra-vaults/dev
[dry-run] Setup OK — no cycle executed.
```

Full cycle (post-fix):

```
Session: sess_6a9133171f5d
Goal:    Verify SignalEvaluated emission to platform store for UP-001 ARM pre-flight
Config:  simple.planning.v0
Cycle:   cycle_0284195b2c34
Outcome: accept
Steps:   5
```

Vault at `/home/boop/cerebra-vaults/dev` is valid. Ollama reachable with
`huggingface.co/unsloth/granite-4.1-3b-GGUF:Q4_K_M` available.

---

## Check 3 — `SignalEvaluated` lands in platform store under `cerebra/agent-trace/<session_id>`

**PASS.**

Platform store at `~/.lattica/fossic/store.db` contains:

```
cerebra/agent-trace/sess_6a9133171f5d  (79 events)
  SessionOpened, CycleStarted, StepStarted, ContextPacketBuilt, PredictionMade,
  StepExecuted, SignalEvaluated ×6, EvaluationComposed, OutcomeRecorded,
  ClutchDecisionMade, LeewayGrantApplied, MemoryWriteFromCycle  [× 5 steps],
  CycleCompleted, SessionFlushed
```

`SignalEvaluated` events confirmed in platform store under
`cerebra/agent-trace/<session_id>`. Stream key and platform store path both
correct.

### Blockers resolved

#### Blocker A — Stream key used `cycle_id` instead of `session_id`

`cerebra/cognition/event_emitter.py:40`: changed
`f"cerebra/agent-trace/{self.cycle_id}"` →
`f"cerebra/agent-trace/{self.session_id}"`.

Cascade: ~40 stream assertions across 10 test files updated to use session_id
strings. 1501 unit tests pass, 232 integration tests pass.

#### Blocker B — No mechanism to write to platform store path

Added `FossicStore.at_platform_path(cls, db_path: Path)` classmethod.
Updated `cli/main.py` to read `CEREBRA_PLATFORM_STORE` env var; when set,
constructs store via `FossicStore.at_platform_path(Path(env).expanduser())`.

#### Fix C — FTS5 query sanitization

LLM output (used as part of the retrieval query on multi-step cycles) contains
punctuation that FTS5 interprets as syntax operators (`*`, `.`, `-`, etc.),
causing `fts5: syntax error near "X"` on real cycle runs.

Fixed in `cerebra/storage/lexical.py:_sanitize_fts_query`: strips all
non-alphanumeric characters from query before passing to FTS5 MATCH. Applied
at the search boundary so callers don't need to sanitize.

---

## Check 4 — `payloadRendererRegistry` registration call doesn't throw

**DEFERRED.** Registration runs in Lattica's startup. Verifiable only after
renderer is authored and Lattica's build includes it. Will be verified during
EXECUTE.

---

## Check 5 — Renderer structural marker verifiable via DOM inspection

**DEFERRED.** Renderer doesn't exist yet. Will be verified during EXECUTE.

---

## Test results

```
Unit tests (excl. pre-existing Click failures):  1501 passed
Integration tests (excl. pre-existing vault/Click failures):  232 passed
Pre-existing failures (unchanged):
  test_memory_cli.py:32 fail — Click mix_stderr compat
  test_abstention.py:3 fail — Click mix_stderr compat
  test_lattice_against_vault.py:1 fail — vault state (350 records / lattice mismatch)
  test_memory_cli_against_vault.py:7 fail — Click mix_stderr compat
```
