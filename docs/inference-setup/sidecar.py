#!/usr/bin/env python3
"""
Inference monitoring sidecar — reference implementation.

Polls Ollama and NVIDIA GPU state, emits fossic events describing:
  ai-stack/gpu     → VramBudgetChanged
  ai-stack/models  → ModelLoaded, ModelUnloaded

Consumed by Lattica's Inference tile via the relay (see relay.py).

Run:
    python3 sidecar.py

Stop:
    Ctrl+C  (or SIGTERM — shuts down cleanly)

Adapting for your provider:
    - If your model server isn't Ollama, replace the `_ollama_ps()` function
      with your provider's equivalent. Return a list of dicts with 'name' and
      'size_vram' keys.
    - If your GPU isn't NVIDIA, replace `_nvidia_smi()` with your equivalent
      (e.g., ROCm's `rocm-smi` for AMD). Return (used_bytes, total_bytes).
    - Adjust FOSSIC_STORE_PATH to point at a writable location for your setup.

Known contract drift:
    The event field names emitted here (`model_name`, `size_vram`) currently
    do not match what Lattica's Phase 2 renderers expect (`name`, `size_bytes`).
    Phase 2 renderers are currently disabled in Lattica; this drift will be
    resolved when Phase 2 is enabled. See Lattica's TECH_DEBT.md.
"""

from __future__ import annotations

import json
import logging
import signal
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional

from fossic import Append, Store

# ── config ────────────────────────────────────────────────────────────────────

# Adjust these constants for your setup.

OLLAMA_BASE = "http://localhost:11434"
"""Ollama endpoint. Change if your model server runs on a different port,
or replace `_ollama_ps()` entirely for a non-Ollama provider."""

FOSSIC_STORE_PATH = Path.home() / "Projects" / "ai-stack" / ".fossic" / "store.db"
"""Where this sidecar writes fossic events. The relay reads from here and
mirrors to Lattica's hub store at ~/.lattica/fossic/store.db. Change if you
want the local store somewhere else."""

POLL_INTERVAL = 10
"""Seconds between poll cycles. Lower = more responsive tile, higher = less
CPU and log spam. 10s is a reasonable default."""

VRAM_DELTA_THRESHOLD = 10 * 1024 * 1024
"""Only emit VramBudgetChanged events when used VRAM changes by at least
this many bytes. Prevents event spam from small fluctuations. 10 MB is
enough to filter noise while catching real load/unload transitions.
Tune down for finer granularity."""

VRAM_WARN_PCT_THRESHOLD = 90
"""Percentage at which VramBudgetChanged events include `warn: true` in
indexed_tags. Lattica's tile and renderers use this to highlight events
where the GPU is near capacity."""

HTTP_TIMEOUT = 4
"""Seconds to wait for HTTP requests to the model server. Short is fine
because the sidecar retries every POLL_INTERVAL seconds."""

# Stream identifiers. These are the fossic stream IDs the tile subscribes to.
# The `ai-stack/` prefix is a legacy naming choice predating the tile's rename
# to "Inference"; it will be renamed to `inference/` in a future release.
STREAM_GPU = "ai-stack/gpu"
STREAM_MODELS = "ai-stack/models"

# ── logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
log = logging.getLogger("inference-sidecar")

# ── fossic helpers ────────────────────────────────────────────────────────────

_store: Optional[Store] = None
_declared: set[str] = set()


def _init_store() -> None:
    """Open the fossic store. Failures are logged but non-fatal — the sidecar
    will keep polling and just silently drop events. This preserves observability
    of the GPU state via logs even when fossic is unavailable."""
    global _store
    try:
        FOSSIC_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
        _store = Store.open(str(FOSSIC_STORE_PATH))
        log.info("fossic store open at %s", FOSSIC_STORE_PATH)
    except Exception:
        log.exception("fossic store unavailable — events will be dropped")


def _emit(stream_id: str, event_type: str, payload: dict,
          indexed_tags: Optional[dict] = None) -> None:
    """Append an event to the given fossic stream. Streams are declared on
    first use — a fossic requirement to associate a stream with its owner
    for auditability."""
    if _store is None:
        return
    if stream_id not in _declared:
        try:
            _store.declare_stream(stream_id, declared_by="inference-sidecar")
            _declared.add(stream_id)
        except Exception:
            log.exception("failed to declare stream %s", stream_id)
            return
    try:
        _store.append(Append(
            stream_id=stream_id,
            event_type=event_type,
            payload=payload,
            causation_id=None,
            indexed_tags=indexed_tags or {},
        ))
        log.debug("emitted %s/%s", stream_id, event_type)
    except Exception:
        log.exception("append failed (%s/%s)", stream_id, event_type)


# ── data sources ──────────────────────────────────────────────────────────────

def _fetch_json(url: str) -> Optional[dict]:
    """HTTP GET with JSON parsing. Returns None on any failure — timeout,
    connection refused, non-JSON response, etc. — so callers can handle
    'provider down' as a normal state."""
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            return json.loads(resp.read())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
        log.debug("fetch %s failed: %s", url, e)
        return None


def _nvidia_smi() -> tuple[int, int]:
    """Return (used_bytes, total_bytes) from nvidia-smi. Returns (0, 0) on
    failure, which the tile displays as an unknown/empty VRAM state.

    To support AMD GPUs: replace this with a `rocm-smi` invocation.
    To support Apple Silicon: return (0, 0) — VRAM is unified memory and
    doesn't map to this concept cleanly."""
    try:
        out = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=memory.used,memory.total",
             "--format=csv,noheader,nounits"],
            timeout=4,
            text=True,
        ).strip()
        parts = [p.strip() for p in out.split(",")]
        used_mb, total_mb = int(parts[0]), int(parts[1])
        return used_mb * 1024 * 1024, total_mb * 1024 * 1024
    except Exception as e:
        log.debug("nvidia-smi failed: %s", e)
        return 0, 0


def _ollama_ps() -> list[dict]:
    """Return currently loaded models as list of {name, size_vram} dicts.
    Ollama's /api/ps endpoint reports only models currently in VRAM, not
    all pulled models. Ollama unloads models after 5 minutes of idle by
    default, which will surface here as a ModelUnloaded event.

    For non-Ollama providers: replace with your equivalent. Return an empty
    list if the provider doesn't distinguish loaded vs. available."""
    data = _fetch_json(f"{OLLAMA_BASE}/api/ps")
    if not data or not isinstance(data.get("models"), list):
        return []
    return [
        {"name": str(m.get("name", "")), "size_vram": int(m.get("size_vram", 0))}
        for m in data["models"]
        if m.get("name")
    ]


# ── poll loop ─────────────────────────────────────────────────────────────────

def _poll(
    prev_models: dict[str, int],
    prev_used_bytes: int,
) -> tuple[dict[str, int], int]:
    """Single poll cycle: read GPU state and loaded models, emit events for
    material changes. Returns updated (models_by_name, used_bytes) for the
    next poll to diff against."""
    now_ms = int(time.time() * 1000)

    # GPU VRAM
    used_bytes, total_bytes = _nvidia_smi()
    running = _ollama_ps()
    model_vram_bytes = sum(m["size_vram"] for m in running)

    if abs(used_bytes - prev_used_bytes) >= VRAM_DELTA_THRESHOLD:
        pct = round(used_bytes / total_bytes * 100, 1) if total_bytes else 0
        _emit(STREAM_GPU, "VramBudgetChanged", {
            "used_bytes": used_bytes,
            "total_bytes": total_bytes,
            "model_vram_bytes": model_vram_bytes,
            "pct": pct,
            "models": running,
            "sampled_at": now_ms,
        }, indexed_tags={"warn": pct >= VRAM_WARN_PCT_THRESHOLD})

    # Model load/unload diff
    current_models = {m["name"]: m["size_vram"] for m in running}

    for name, size_vram in current_models.items():
        if name not in prev_models:
            _emit(STREAM_MODELS, "ModelLoaded", {
                "model_name": name,
                "size_vram": size_vram,
                "loaded_at": now_ms,
            }, indexed_tags={"model_name": name})
            log.info("ModelLoaded: %s (%d MB)", name, size_vram // (1024 * 1024))

    for name in prev_models:
        if name not in current_models:
            _emit(STREAM_MODELS, "ModelUnloaded", {
                "model_name": name,
                "unloaded_at": now_ms,
            }, indexed_tags={"model_name": name})
            log.info("ModelUnloaded: %s", name)

    return current_models, used_bytes


# ── main ──────────────────────────────────────────────────────────────────────

_running = True


def _handle_signal(sig, _frame):
    global _running
    log.info("signal %s received — shutting down", sig)
    _running = False


def main() -> None:
    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    _init_store()

    log.info("inference sidecar starting (poll interval %ds)", POLL_INTERVAL)

    # Initial GPU reading for baseline
    _, total_bytes = _nvidia_smi()
    log.info("GPU total VRAM: %d MB", total_bytes // (1024 * 1024))

    prev_models: dict[str, int] = {}
    prev_used_bytes: int = 0

    while _running:
        try:
            prev_models, prev_used_bytes = _poll(prev_models, prev_used_bytes)
        except Exception:
            log.exception("poll cycle error")
        if _running:
            time.sleep(POLL_INTERVAL)

    log.info("inference sidecar stopped")


if __name__ == "__main__":
    main()
