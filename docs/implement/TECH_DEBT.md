### Lattica Tech Debt

### Inference tile — Phase 2 event renderers

The `VramBudgetChangedRenderer`, `ModelLoadedRenderer`, `ModelUnloadedRenderer`,
`SidecarStartedRenderer`, and `SidecarStoppedRenderer` are commented out in
`src/registrations.tsx`. The reference sidecar in `docs/inference-setup/sidecar.py`
emits events that would populate them, but is currently used only for HTTP
polling state, not event rendering.

Known issues to resolve before enabling Phase 2:
- Payload field name drift: sidecar emits `model_name`/`size_vram`,
  renderers expect `name`/`size_bytes`. Contract needs to be canonicalized.
- Stream prefix: currently `ai-stack/*` for legacy reasons. Renaming to
  `inference/*` is a coordinated change across sidecar, relay, Lattica
  subscription patterns, and any downstream consumers.

### Inference tile — hardcoded provider ports

`poll_ai_stack` in `src-tauri/src/lib.rs` hardcodes localhost URLs for Ollama,
LiteLLM, Open WebUI, and the Cerebra daemon. User-configurable ports via
Lattica settings are planned. Requires: settings schema addition, UI panel,
Tauri command signature change to accept URLs as parameters.

### Inference tile — Ollama-specific polling logic

`poll_ai_stack` assumes Ollama's `/api/ps` and `/api/tags` shape. Non-Ollama
providers (LM Studio, vLLM, remote OpenAI-compatible endpoints) will show
"down" in live polling even when their sidecar emits fossic events correctly.
Provider adapter interface (one polling implementation per provider type) is
future work.
