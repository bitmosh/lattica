# Inference Setup

Lattica displays live status and events from your local inference stack — a model server, a router, a chat UI, and (optionally) the Cerebra daemon — via its **Inference** tile. This directory contains everything you need to get that tile populated with real data.

**Lattica does not run inference itself.** It subscribes to fossic events written by a small Python sidecar and displays them alongside live HTTP status polling. You bring your own inference services; Lattica watches and displays them.

## Quick summary

The reference setup uses:

| Role | Reference implementation | Port |
|---|---|---|
| Model server (Inference) | [Ollama](https://ollama.com) | 11434 |
| Router | [LiteLLM](https://github.com/BerriAI/litellm) | 4000 |
| Chat UI | [Open WebUI](https://openwebui.com) | 3000 |
| Cognitive daemon | [Cerebra](https://github.com/bitmosh/cerebra) | 7432 |

Router, Chat UI, and Cerebra are optional. Only the model server is required for Lattica to show useful status.

## Documents in this directory

- **[quickstart.md](./quickstart.md)** — install-and-run instructions with two paths (Ollama-only minimal, or full stack via Docker Compose).
- **[sidecar.py](./sidecar.py)** — reference Python sidecar that polls Ollama and writes fossic events. Copy to your working directory and run it as a background service.
- **[relay.py](./relay.py)** — reference relay that mirrors sidecar events into Lattica's hub store at `~/.lattica/fossic/store.db`.
- **[docker-compose.example.yml](./docker-compose.example.yml)** — reference Docker Compose file for running Ollama + LiteLLM + Open WebUI together.

## Design principles

- **Lattica doesn't know about your inference stack.** It reads fossic events and polls configured HTTP endpoints. Swap providers freely; Lattica doesn't care what's behind the URLs.
- **The sidecar and relay are separate.** The sidecar writes to a local fossic store scoped to your inference project. The relay copies events into Lattica's hub store. This separation means you can run inference monitoring without ever wiring up Lattica, and you can wire up Lattica against multiple sidecars from multiple machines.
- **Live status polling is Ollama-compatible.** Lattica's Rust `poll_ai_stack` command hits Ollama's `/api/ps` and `/api/tags` endpoints. If you use a different model server, live polling will show "down" but the fossic event stream from your custom sidecar will still populate the tile.

## Known limitations

Lattica is currently in alpha. The inference tile has known issues you should be aware of:

- **Phase 2 event renderers are disabled.** The `VramBudgetChangedRenderer`, `ModelLoadedRenderer`, `ModelUnloadedRenderer`, `SidecarStartedRenderer`, and `SidecarStoppedRenderer` are registered but currently commented out in `src/registrations.tsx`. Live event data flows through the sidecar and relay but is not yet rendered in the tile's event feed. The tile shows current model list and VRAM status from HTTP polling instead.
- **Payload contract drift.** The reference sidecar emits some fields (`model_name`, `size_vram`) that don't match what the disabled renderers expect (`name`, `size_bytes`, `digest`). Contract cleanup is deferred until Phase 2 is enabled. See [Lattica's TECH_DEBT.md](../../TECH_DEBT.md) for details.
- **Stream IDs use the legacy `ai-stack/*` prefix.** These streams predate the tile rename to "Inference" and are not yet renamed to `inference/*`. Any sidecar you write must use the `ai-stack/*` prefix until the coordinated rename lands.
- **Live polling assumes Ollama-compatible endpoints.** LM Studio, vLLM, and other providers will show "down" in status polling. Event streams from a custom sidecar will still work once Phase 2 is enabled.
- **Provider ports are currently hardcoded in Lattica's Rust command.** User-configurable ports via Lattica settings are planned but not shipped.

Contributions to any of these are welcome.
