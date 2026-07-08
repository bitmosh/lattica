# Quickstart

Two setup paths depending on how much of the stack you want to run.

- **[Minimal](#minimal-path-ollama-only)**: just Ollama, native install, ~5 minutes. Gives Lattica live model status and VRAM info but no chat frontend or router.
- **[Full stack](#full-stack-path-ollama--litellm--open-webui-via-docker)**: Ollama + LiteLLM + Open WebUI via Docker Compose. Adds chat frontend, model aliasing, and provider routing. ~15 minutes.

Both paths end with running the same Python sidecar and relay.

## Prerequisites (both paths)

- **Python 3.12+** — required for the sidecar and relay. Install via [python.org](https://www.python.org/downloads/), `uv`, `pyenv`, or your OS package manager.
- **NVIDIA GPU with drivers installed** — the sidecar uses `nvidia-smi` to report VRAM. Non-NVIDIA GPUs will still work but VRAM data will be zero. AMD/Intel GPU support requires modifying the sidecar; see comments in `sidecar.py`.
- **Lattica installed** — you're reading its docs, so presumably done. If not, follow Lattica's main README.

## Minimal path (Ollama only)

### 1. Install Ollama

Follow the [official Ollama install guide](https://ollama.com/download). This handles OS-specific setup (native app on macOS, systemd service on Linux, native app on Windows).

Verify:

```sh
ollama --version
```

### 2. Pull a model

Any model works. For a first-run demo, `llama3.2:3b` is small (~2 GB) and quick:

```sh
ollama pull llama3.2:3b
```

Verify Ollama is running and the model is available:

```sh
curl http://localhost:11434/api/tags
```

Should return JSON listing your pulled models.

### 3. Install the fossic Python package

```sh
pip install fossic
```

Or if you're using `uv`:

```sh
uv pip install fossic
```

### 4. Set up the sidecar

Copy `sidecar.py` from this directory to a working location — anywhere you're comfortable running a background Python script:

```sh
mkdir -p ~/inference-monitor
cp sidecar.py ~/inference-monitor/
cp relay.py ~/inference-monitor/
```

### 5. Run the sidecar and relay

Two terminals, or use `tmux`/`screen`:

```sh
# Terminal 1
cd ~/inference-monitor
python3 sidecar.py
```

```sh
# Terminal 2
cd ~/inference-monitor
python3 relay.py
```

Both will log to stdout. The sidecar polls every 10 seconds and prints when it emits events. The relay logs each event it mirrors.

### 6. Launch Lattica

Open Lattica. Find the **Inference** tile. It should now show:

- **INFERENCE** (Ollama at :11434) — green dot
- Router, Chat UI, Cerebra daemon — red dots (not running in minimal setup)
- Live VRAM percentage and total
- Loaded model list when you have models in memory

Load a model into VRAM (Ollama unloads models after 5 minutes of idle by default):

```sh
ollama run llama3.2:3b "hello"
```

Refresh the tile within 10 seconds — the model should appear in the loaded list.

That's it for minimal setup. Skip to [Running as a service](#running-as-a-service) below.

## Full stack path (Ollama + LiteLLM + Open WebUI via Docker)

### 1. Install Docker and Docker Compose

Follow the [official Docker install guide](https://docs.docker.com/get-docker/). For Linux, also install the Compose plugin if it isn't included: `sudo apt install docker-compose-plugin` on Debian/Ubuntu.

Verify:

```sh
docker --version
docker compose version
```

### 2. Set up the stack

Copy `docker-compose.example.yml` from this directory to your working location:

```sh
mkdir -p ~/inference-monitor
cp docker-compose.example.yml ~/inference-monitor/docker-compose.yml
```

Edit `docker-compose.yml` to review port mappings, volume paths, and GPU settings. The reference file assumes an NVIDIA GPU with the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) installed. Without it, remove the `deploy.resources.reservations.devices` blocks — Ollama will fall back to CPU (slow).

### 3. Configure LiteLLM

LiteLLM needs a config file describing which models it routes to. Create `litellm-config.yaml` in the same directory:

```yaml
model_list:
  - model_name: local-fast
    litellm_params:
      model: ollama/llama3.2:3b
      api_base: http://ollama:11434

  - model_name: local-heavy
    litellm_params:
      model: ollama/llama3.1:70b
      api_base: http://ollama:11434
```

Adjust model names to match what you have in Ollama. Note the `api_base` uses `http://ollama:11434` (the Docker service name), not `localhost`.

### 4. Start the stack

```sh
cd ~/inference-monitor
docker compose up -d
```

Verify all services are up:

```sh
curl http://localhost:11434/api/tags   # Ollama
curl http://localhost:4000/v1/models   # LiteLLM
curl http://localhost:3000             # Open WebUI (returns HTML)
```

### 5. Pull a model into Ollama

Even though Ollama runs in Docker, you can pull models through the container:

```sh
docker exec ollama ollama pull llama3.2:3b
```

Or use the Open WebUI at `http://localhost:3000` to pull models through its interface.

### 6. Install fossic, run sidecar and relay, launch Lattica

Same as [minimal path](#3-install-the-fossic-python-package) steps 3-6. The sidecar and relay run on your host, not in Docker — they need direct access to `nvidia-smi` and the fossic hub store.

## Running as a service

Manually running two Python processes in terminals isn't sustainable. On Linux, use systemd. Create `~/.config/systemd/user/inference-sidecar.service`:

```ini
[Unit]
Description=Inference monitoring sidecar
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 %h/inference-monitor/sidecar.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
```

And `~/.config/systemd/user/inference-relay.service`:

```ini
[Unit]
Description=Inference event relay to Lattica hub
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 %h/inference-monitor/relay.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
```

Enable and start:

```sh
systemctl --user daemon-reload
systemctl --user enable --now inference-sidecar inference-relay
```

Check status:

```sh
systemctl --user status inference-sidecar inference-relay
```

On macOS, use `launchd`. On Windows, use Task Scheduler or [NSSM](https://nssm.cc/) to wrap the Python scripts as services.

## Troubleshooting

**Tile shows all services down.** Check that the services are actually listening on the expected ports. Firewalls or Docker networking issues can prevent Lattica from reaching them.

```sh
curl -sv http://localhost:11434/api/tags | head -5
curl -sv http://localhost:4000/v1/models | head -5
```

**Sidecar logs "nvidia-smi failed".** Either you don't have NVIDIA drivers installed, or `nvidia-smi` isn't in your `PATH`. On Linux, ensure the `nvidia-driver` package is installed. Non-NVIDIA GPUs are not currently supported by the reference sidecar.

**Sidecar logs "fossic store unavailable".** The sidecar tries to open `~/Projects/ai-stack/.fossic/store.db` by default. Either create that directory, or edit `FOSSIC_STORE_PATH` at the top of `sidecar.py` to point somewhere writable.

**Relay logs "hub store not found".** Lattica must have been launched at least once to create `~/.lattica/fossic/store.db`. Launch Lattica once, close it, then start the relay.

**Tile shows "polled" timestamp but no live model data.** Ollama has no models loaded in VRAM. Run `ollama run <model-name> "hello"` to load one, or use Open WebUI to send a request.

**Sidecar runs but Lattica shows no events.** Phase 2 event renderers are currently disabled (see main README's Known Limitations section). The sidecar is emitting events correctly; Lattica just isn't rendering them in the event feed yet. Live HTTP polling data (which is what the tile primarily shows today) does not depend on the sidecar.

## Uninstalling

Stop services:

```sh
systemctl --user disable --now inference-sidecar inference-relay
docker compose down   # if using full stack
```

Remove the fossic data:

```sh
rm -rf ~/Projects/ai-stack/.fossic   # or wherever your sidecar writes
```

Do NOT delete `~/.lattica/fossic/store.db` unless you want to lose all Lattica hub events, including from other integrations.
