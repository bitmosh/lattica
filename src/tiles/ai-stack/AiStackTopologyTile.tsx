import { useState, useEffect, useCallback, useRef } from "react";
import { LiveValueChip } from "../../components/livevalue/LiveValueChip";
import "./AiStackTopologyTile.css";

// ---- types ----------------------------------------------------------------

type NodeStatus = "up" | "down" | "unknown";

interface RunningModel {
  name: string;
  size_vram: number;
}

interface LocalModel {
  name: string;
  size: number;
}

interface TopologySnapshot {
  ollama: NodeStatus;
  litellm: NodeStatus;
  openwebui: NodeStatus;
  cerebra: NodeStatus;
  runningModels: RunningModel[];
  localModels: LocalModel[];
  totalVramBytes: number;
  aliases: string[];
  lastPolled: number;
}

// ---- constants ------------------------------------------------------------

const OLLAMA = "http://localhost:11434";
const LITELLM = "http://localhost:4000";
const OPENWEBUI = "http://localhost:3000";
const CEREBRA = "http://localhost:7432";
const POLL_MS = 10_000;

// RTX 4070 Super — no Ollama API source for total VRAM; override via
// localStorage key aistack.vramTotalMb if hardware changes.
const DEFAULT_VRAM_TOTAL_MB = 12_282;

// Cerebra routing aliases with topology edges. bot-local may go dormant if
// Cerebra routes via OllamaDirectAdapter directly; bot-escalated stays if
// escalation path uses LiteLLM.
const TOPOLOGY_ALIASES = new Set(["bot-local", "bot-escalated"]);

// Per-node accent colors (iter-4 palette).
const NODE_COLORS = {
  bo:        "#7aa2ff",
  litellm:   "#FF5BC7",
  ollama:    "#22E0C4",
  openwebui: "#A6F35A",
  tts:       "#8A96A3",
} as const;

// ---- localStorage prefs ---------------------------------------------------

function loadPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function savePref<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded — ignore */
  }
}

// ---- fetch helpers --------------------------------------------------------

async function fetchWithTimeout(url: string, ms: number, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

async function pollTopology(): Promise<TopologySnapshot> {
  const [psResult, tagsResult, modelsResult, webuiResult, cerebraResult] = await Promise.allSettled([
    fetchWithTimeout(`${OLLAMA}/api/ps`, 4_000).then((r) => r.json()),
    fetchWithTimeout(`${OLLAMA}/api/tags`, 4_000).then((r) => r.json()),
    fetchWithTimeout(`${LITELLM}/v1/models`, 4_000).then((r) => r.json()),
    fetchWithTimeout(OPENWEBUI, 4_000, { method: "HEAD" }),
    fetchWithTimeout(`${CEREBRA}/status`, 4_000),
  ]);

  const ollama: NodeStatus = psResult.status === "fulfilled" ? "up" : "down";
  const litellm: NodeStatus = modelsResult.status === "fulfilled" ? "up" : "down";
  const openwebui: NodeStatus = webuiResult.status === "fulfilled" ? "up" : "down";
  const cerebra: NodeStatus = cerebraResult.status === "fulfilled" ? "up" : "down";

  const runningModels: RunningModel[] =
    psResult.status === "fulfilled" &&
    Array.isArray((psResult.value as Record<string, unknown>).models)
      ? ((psResult.value as Record<string, unknown[]>).models as Record<string, unknown>[]).map(
          (m) => ({
            name: String(m["name"] ?? ""),
            size_vram: Number(m["size_vram"] ?? 0),
          }),
        )
      : [];

  const localModels: LocalModel[] =
    tagsResult.status === "fulfilled" &&
    Array.isArray((tagsResult.value as Record<string, unknown>).models)
      ? ((tagsResult.value as Record<string, unknown[]>).models as Record<string, unknown>[]).map(
          (m) => ({
            name: String(m["name"] ?? ""),
            size: Number(m["size"] ?? 0),
          }),
        )
      : [];

  const aliases: string[] =
    modelsResult.status === "fulfilled" &&
    Array.isArray((modelsResult.value as Record<string, unknown>).data)
      ? ((modelsResult.value as Record<string, unknown[]>).data as Record<string, unknown>[]).map(
          (m) => String(m["id"] ?? ""),
        )
      : [];

  const totalVramBytes = runningModels.reduce((sum, m) => sum + m.size_vram, 0);

  return {
    ollama,
    litellm,
    openwebui,
    cerebra,
    runningModels,
    localModels,
    totalVramBytes,
    aliases,
    lastPolled: Date.now(),
  };
}

// ---- Ollama model actions -------------------------------------------------

async function ollamaLoad(model: string): Promise<void> {
  const r = await fetchWithTimeout(
    `${OLLAMA}/api/generate`,
    30_000,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: "", keep_alive: "10m" }),
    },
  );
  if (!r.ok) throw new Error(`Ollama load failed: ${r.status}`);
}

async function ollamaUnload(model: string): Promise<void> {
  const r = await fetchWithTimeout(
    `${OLLAMA}/api/generate`,
    10_000,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: "", keep_alive: 0 }),
    },
  );
  if (!r.ok) throw new Error(`Ollama unload failed: ${r.status}`);
}

// ---- formatters -----------------------------------------------------------

function fmtGb(bytes: number): string {
  return (bytes / (1024 * 1024 * 1024)).toFixed(1);
}

function vramPct(usedBytes: number, totalMb: number): number {
  if (totalMb <= 0) return 0;
  return Math.round((usedBytes / (totalMb * 1024 * 1024)) * 100);
}

// ---- sub-components -------------------------------------------------------

function StatusDot({ status }: { status: NodeStatus }) {
  return <span className={`aistack-dot aistack-dot--${status}`} aria-label={status} />;
}

function NodeCard({
  name,
  port,
  status,
  color,
  children,
  note,
}: {
  name: string;
  port?: string;
  status: NodeStatus;
  color?: string;
  children?: React.ReactNode;
  note?: string;
}) {
  const borderColor =
    status === "up" && color ? `${color}66`
    : status === "down" ? "rgba(224,92,92,0.5)"
    : "var(--la-surface, #1C2530)";

  return (
    <div
      className="aistack-node"
      style={{ borderColor }}
      data-testid={`aistack-node-${name.toLowerCase()}`}
    >
      <div className="aistack-node__header">
        <StatusDot status={status} />
        <span
          className="aistack-node__name"
          style={color ? { color } : undefined}
        >
          {name}
        </span>
        {port && <span className="aistack-mono aistack-node__port">{port}</span>}
        {note && <span className="aistack-node__note">{note}</span>}
      </div>
      {children}
    </div>
  );
}

// ---- main tile ------------------------------------------------------------

export function AiStackTopologyTile() {
  const [snap, setSnap] = useState<TopologySnapshot | null>(null);
  const [polling, setPolling] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // preferences — persisted in localStorage
  const [vramWarnPct, setVramWarnPct] = useState(() => loadPref("aistack.vramWarnPct", 90));
  const [vramTotalMb, setVramTotalMb] = useState(() =>
    loadPref("aistack.vramTotalMb", DEFAULT_VRAM_TOTAL_MB),
  );
  const [mutedAliases, setMutedAliases] = useState<Set<string>>(
    () => new Set(loadPref<string[]>("aistack.mutedAliases", [])),
  );
  const [view, setView] = useState<"topo" | "list">(() =>
    loadPref<"topo" | "list">("aistack.view", "topo"),
  );
  const [showDormant, setShowDormant] = useState(() => loadPref("aistack.showDormant", true));

  // action state
  const [loadingModel, setLoadingModel] = useState<string | null>(null);
  const [unloadingAll, setUnloadingAll] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const runPoll = useCallback(async () => {
    setPolling(true);
    try {
      const result = await pollTopology();
      setSnap(result);
      setPollError(null);
    } catch (e: unknown) {
      setPollError(e instanceof Error ? e.message : String(e));
    } finally {
      setPolling(false);
    }
  }, []);

  useEffect(() => {
    void runPoll();
    intervalRef.current = setInterval(() => void runPoll(), POLL_MS);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [runPoll]);

  // pref setters with persistence
  const updateVramWarnPct = (v: number) => { setVramWarnPct(v); savePref("aistack.vramWarnPct", v); };
  const updateVramTotalMb = (v: number) => { setVramTotalMb(v); savePref("aistack.vramTotalMb", v); };
  const updateView = (v: "topo" | "list") => { setView(v); savePref("aistack.view", v); };
  const updateShowDormant = (v: boolean) => { setShowDormant(v); savePref("aistack.showDormant", v); };

  const toggleAliasMute = (alias: string) => {
    setMutedAliases((prev) => {
      const next = new Set(prev);
      if (next.has(alias)) next.delete(alias);
      else next.add(alias);
      savePref("aistack.mutedAliases", [...next]);
      return next;
    });
  };

  const handleLoadModel = async (modelName: string) => {
    setLoadingModel(modelName);
    setActionError(null);
    try {
      await ollamaLoad(modelName);
      await runPoll();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingModel(null);
    }
  };

  const handleUnloadAll = async () => {
    if (!snap || snap.runningModels.length === 0) return;
    setUnloadingAll(true);
    setActionError(null);
    try {
      const results = await Promise.allSettled(snap.runningModels.map((m) => ollamaUnload(m.name)));
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      if (failed.length > 0) {
        throw new Error((failed[0].reason as Error).message ?? "unload failed");
      }
      await runPoll();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setUnloadingAll(false);
    }
  };

  // derived
  const hasRunning = (snap?.runningModels.length ?? 0) > 0;
  const usedPct = snap ? vramPct(snap.totalVramBytes, vramTotalMb) : 0;
  const vramExceeded = usedPct >= vramWarnPct;
  const stackStatus: NodeStatus =
    !snap ? "unknown"
    : snap.ollama === "down" && snap.litellm === "down" ? "down"
    : snap.ollama === "down" || snap.litellm === "down" ? "unknown"
    : "up";

  const topoAliases = snap?.aliases.filter((a) => TOPOLOGY_ALIASES.has(a)) ?? [];
  const allAliases = snap?.aliases ?? [];

  // list-view rows — stable shape avoids anonymous object in render
  const listRows: Array<{ key: string; name: string; status: NodeStatus; detail: string }> = [
    { key: "ollama", name: "OLLAMA", status: snap?.ollama ?? "unknown", detail: `:11434 · ${snap?.runningModels.length ?? 0} model${(snap?.runningModels.length ?? 0) !== 1 ? "s" : ""} running` },
    { key: "litellm", name: "LITELLM", status: snap?.litellm ?? "unknown", detail: `:4000 · ${allAliases.length} alias${allAliases.length !== 1 ? "es" : ""}` },
    { key: "openwebui", name: "OPEN-WEBUI", status: snap?.openwebui ?? "unknown", detail: ":3000" },
    { key: "tts", name: "TTS", status: "unknown", detail: "no host port exposed" },
    { key: "bo", name: "BO", status: snap?.cerebra ?? "unknown", detail: ":7432 · cerebra daemon" },
  ];

  const lastPolledTime = snap
    ? new Date(snap.lastPolled).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="aistack-tile" data-testid="aistack-topology-tile">
      {/* ── header chrome ── */}
      <header className="aistack-tile__header">
        <div className="aistack-tile__header-left">
          <StatusDot status={stackStatus} />
          <span className="aistack-tile__title">AI STACK</span>
          {hasRunning && (
            <span className="aistack-badge aistack-mono">
              {snap!.runningModels.length} LOADED
            </span>
          )}
          {!hasRunning && snap?.ollama === "up" && (
            <span className="aistack-badge aistack-badge--idle aistack-mono">IDLE</span>
          )}
        </div>
        <div className="aistack-tile__header-right">
          <button
            className={`aistack-pill aistack-mono ${view === "topo" ? "aistack-pill--active" : ""}`}
            onClick={() => updateView(view === "topo" ? "list" : "topo")}
          >
            {view === "topo" ? "TOPO" : "LIST"}
          </button>
          <button
            className={`aistack-pill aistack-mono ${showDormant ? "aistack-pill--active" : ""}`}
            onClick={() => updateShowDormant(!showDormant)}
          >
            DORMANT
          </button>
          {polling && <span className="aistack-tile__spinner" aria-label="polling" />}
        </div>
      </header>

      {pollError && (
        <div className="aistack-error" role="alert">
          POLL ERR · {pollError}
        </div>
      )}

      {/* ── VRAM gauge ── */}
      {snap && (
        <div className="aistack-vram">
          <div className="aistack-vram__bar-row">
            <span className="aistack-label">VRAM</span>
            <div className="aistack-vram__track-wrap">
              <div className="aistack-vram__track" aria-label={`VRAM ${usedPct}%`}>
                <div
                  className={`aistack-vram__fill ${vramExceeded ? "aistack-vram__fill--warn" : ""}`}
                  style={{ width: `${Math.min(usedPct, 100)}%` }}
                />
                <div
                  className="aistack-vram__warn-marker"
                  style={{ left: `${vramWarnPct}%` }}
                />
              </div>
            </div>
            <span className="aistack-mono aistack-vram__label">
              <span className={vramExceeded ? "aistack-vram__pct--warn" : ""}>
                {fmtGb(snap.totalVramBytes)} / {(vramTotalMb / 1024).toFixed(1)} GB
              </span>
              {" "}
              <span className={`aistack-vram__pct ${vramExceeded ? "aistack-vram__pct--warn" : ""}`}>
                {usedPct}%
              </span>
            </span>
          </div>
          <div className="aistack-vram__controls">
            <label className="aistack-vram__slider-label">
              <span className="aistack-label">WARN</span>
              <input
                type="range"
                min={50}
                max={95}
                step={5}
                value={vramWarnPct}
                onChange={(e) => updateVramWarnPct(Number(e.target.value))}
                className="aistack-slider"
              />
              <span className="aistack-mono aistack-vram__warn-val">{vramWarnPct}%</span>
            </label>
            <label className="aistack-vram__slider-label">
              <span className="aistack-label">GPU MB</span>
              <input
                type="number"
                min={1024}
                max={49152}
                step={256}
                value={vramTotalMb}
                onChange={(e) => updateVramTotalMb(Number(e.target.value))}
                className="aistack-input aistack-mono"
              />
            </label>
          </div>
        </div>
      )}

      {/* ── topology / list view ── */}
      {view === "topo" ? (
        <div className="aistack-topo">
          {/* Bo → LiteLLM → Ollama main flow */}
          <div className="aistack-topo__flow">
            <NodeCard
              name="BO"
              port=":7432"
              status={snap?.cerebra ?? "unknown"}
              color={NODE_COLORS.bo}
            />

            <div className="aistack-topo__edges">
              {topoAliases.map((alias) => {
                const isDormant = alias === "bot-escalated";
                if (isDormant && !showDormant) return null;
                const isMuted = mutedAliases.has(alias);
                return (
                  <div
                    key={alias}
                    className={`aistack-edge ${isDormant ? "aistack-edge--dormant" : ""} ${isMuted ? "aistack-edge--muted" : ""}`}
                  >
                    <span className="aistack-mono aistack-edge__label">{alias}</span>
                    <span className="aistack-edge__arrow">→</span>
                  </div>
                );
              })}
              {topoAliases.length === 0 && snap?.litellm === "up" && (
                <div className="aistack-edge aistack-edge--dormant">
                  <span className="aistack-mono aistack-edge__label">awaiting aliases</span>
                </div>
              )}
            </div>

            <NodeCard
              name="LITELLM"
              port=":4000"
              status={snap?.litellm ?? "unknown"}
              color={NODE_COLORS.litellm}
            >
              {allAliases.length > 0 && (
                <span className="aistack-node__detail aistack-mono">
                  {allAliases.length} alias{allAliases.length !== 1 ? "es" : ""}
                </span>
              )}
            </NodeCard>

            <div className="aistack-topo__edges">
              <div className="aistack-edge">
                <span className="aistack-mono aistack-edge__label">local</span>
                <span className="aistack-edge__arrow">→</span>
              </div>
            </div>

            <NodeCard
              name="OLLAMA"
              port=":11434"
              status={snap?.ollama ?? "unknown"}
              color={NODE_COLORS.ollama}
            />
          </div>

          {/* Running models — below main flow per iter-4 design */}
          {hasRunning ? (
            <ul className="aistack-running-models">
              {snap!.runningModels.map((m) => (
                <li key={m.name} className="aistack-running-models__row aistack-mono">
                  <span className="aistack-running-models__dot" />
                  <span className="aistack-running-models__name">{m.name}</span>
                  <span className="aistack-running-models__vram">{fmtGb(m.size_vram)} GB</span>
                </li>
              ))}
            </ul>
          ) : (
            snap?.ollama === "up" && (
              <div className="aistack-running-models--empty aistack-mono">no models in VRAM</div>
            )
          )}

          {/* Secondary nodes */}
          <div className="aistack-topo__secondary">
            <NodeCard
              name="OPEN-WEBUI"
              port=":3000"
              status={snap?.openwebui ?? "unknown"}
              color={NODE_COLORS.openwebui}
            />
            <NodeCard
              name="TTS"
              status="unknown"
              color={NODE_COLORS.tts}
              note="no host port"
            />
          </div>
        </div>
      ) : (
        <table className="aistack-list" data-testid="aistack-list-view">
          <tbody>
            {listRows.map((row) => (
              <tr key={row.key} className="aistack-list__row">
                <td className="aistack-list__dot"><StatusDot status={row.status} /></td>
                <td className="aistack-node__name">{row.name}</td>
                <td className="aistack-mono aistack-list__detail">{row.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── model actions ── */}
      <section className="aistack-actions">
        {snap?.ollama === "up" && snap.localModels.length > 0 && (
          <div className="aistack-actions__load">
            <span className="aistack-label">LOAD</span>
            <select
              className="aistack-select aistack-mono"
              value=""
              onChange={(e) => {
                if (e.target.value) void handleLoadModel(e.target.value);
              }}
              disabled={loadingModel !== null}
            >
              <option value="" disabled>model…</option>
              {snap.localModels.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
            {loadingModel !== null && (
              <span className="aistack-mono aistack-actions__status">loading {loadingModel}…</span>
            )}
          </div>
        )}

        {hasRunning && (
          <button
            className="aistack-btn aistack-btn--danger"
            onClick={() => void handleUnloadAll()}
            disabled={unloadingAll}
          >
            {unloadingAll ? "UNLOADING…" : "UNLOAD ALL"}
          </button>
        )}

        {actionError !== null && (
          <div className="aistack-error" role="alert">{actionError}</div>
        )}
      </section>

      {/* ── alias chips ── */}
      {allAliases.length > 0 && (
        <section className="aistack-aliases">
          <span className="aistack-label">LITELLM ALIASES</span>
          <div className="aistack-aliases__chips">
            {allAliases.map((alias) => {
              const isTopology = TOPOLOGY_ALIASES.has(alias);
              const isDormant = alias === "bot-escalated";
              const isMuted = mutedAliases.has(alias);
              return (
                <button
                  key={alias}
                  className={[
                    "aistack-chip",
                    "aistack-mono",
                    isTopology ? "aistack-chip--topology" : "",
                    isDormant ? "aistack-chip--dormant" : "",
                    isMuted ? "aistack-chip--muted" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => toggleAliasMute(alias)}
                  title={isMuted ? "unmute" : "mute in topology"}
                >
                  {alias}{isDormant ? " · dormant" : ""}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Phase 2 footer — pre-relay event feeds (blocked on ai-stack-relay.py running live) ── */}
      <footer className="aistack-phase2">
        <span className="aistack-label">PHASE 2</span>
        <LiveValueChip state="pre-relay" label="VramBudgetChanged" />
        <LiveValueChip state="pre-relay" label="ModelLoaded" />
        <span className="aistack-phase2__ts aistack-mono">
          {lastPolledTime ? `polled ${lastPolledTime}` : ""}
        </span>
      </footer>
    </div>
  );
}
