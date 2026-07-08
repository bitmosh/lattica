#!/usr/bin/env python3
"""
Inference event relay — reference implementation.

Mirrors fossic events from a local inference sidecar store into Lattica's
hub store, where the Inference tile can render them.

Relayed streams:
  ai-stack/gpu       → VramBudgetChanged
  ai-stack/models    → ModelLoaded, ModelUnloaded
  ai-stack/lifecycle → SidecarStarted, SidecarStopped (proposed; not yet
                       emitted by reference sidecar)

Run:
    python3 relay.py

Stop:
    Ctrl+C  (or SIGTERM)

Why a separate relay:
    The sidecar writes to a project-local fossic store. This keeps
    inference monitoring independent of Lattica — you can run the sidecar
    without ever installing Lattica, and inspect events with any fossic
    tool. The relay bridges that local store to Lattica's hub, so events
    show up in the tile only when both sides are running.

    Running two processes lets you restart Lattica without losing events
    (they buffer in the local store) and lets you run the sidecar on a
    machine that isn't the one running Lattica (with an appropriate hub
    store path override).

Adapting for your setup:
    - `local_store_path` should match the FOSSIC_STORE_PATH in your sidecar.
    - `hub_store_path` should be Lattica's hub store. The default is correct
      for a standard Lattica install on the same machine. If you set the
      `LATTICA_FOSSIC_STORE` env var in Lattica's environment, update this
      value to match.
    - `source_prefix` and `subscribe_pattern` should use the same stream
      namespace your sidecar emits under. The reference uses `ai-stack/*`
      for legacy compatibility.
"""

import os

from fossic import RelayConfig, run_relay

cfg = RelayConfig(
    # Where the local sidecar writes. Must match the sidecar's
    # FOSSIC_STORE_PATH exactly.
    local_store_path=os.path.expanduser("~/Projects/ai-stack/.fossic/store.db"),

    # Where Lattica reads its hub events. The default is Lattica's standard
    # hub store path. Override if you set LATTICA_FOSSIC_STORE in Lattica.
    hub_store_path=os.path.expanduser("~/.lattica/fossic/store.db"),

    # Prefix used to attribute relayed events to this source. Shows up in
    # Lattica's event feed as the origin project name.
    source_prefix="ai-stack",

    # Glob pattern of streams to subscribe to and mirror. `ai-stack/**`
    # matches every stream under the ai-stack namespace.
    subscribe_pattern="ai-stack/**",

    # Event types to relay. Others (if any exist) are ignored. Explicitly
    # listing types prevents accidental mirroring of internal events.
    relay_filter={
        "VramBudgetChanged",
        "ModelLoaded",
        "ModelUnloaded",
        "SidecarStarted",
        "SidecarStopped",
    },
)

if __name__ == "__main__":
    run_relay(cfg)
