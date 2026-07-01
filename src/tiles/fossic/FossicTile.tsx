import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useFossicSubscription } from "../../hooks/useFossicSubscription";
import { LiveValueChip, type LvStateKind } from "../../components/livevalue/LiveValueChip";
import "./FossicTile.css";

interface StoreStatus {
  ok: boolean;
  stream_count: number;
}

interface LaneEvent {
  id: string;
  timestamp_ms: number;
  event_type: string;
}

interface LaneConfig {
  id: string;
  label: string;
  detail: string;
  color: string;
  prefix: string;
  relayStatus: LvStateKind;
  bundled?: boolean;
  degraded?: boolean;
  subs: Array<{ name: string; healthy: boolean }>;
}

const WINDOW_MS = 90_000;
const RATE_WINDOW_MS = 10_000;
const RELAY_WINDOW_MS = 60_000;
const MAX_EVENTS_PER_LANE = 300;

const LANES: LaneConfig[] = [
  {
    id: "lattica",
    label: "lattica/*",
    detail: "host events",
    color: "#F2A85C",
    prefix: "lattica/",
    relayStatus: "live",
    subs: [{ name: "lattica/canary", healthy: true }],
  },
  {
    id: "cerebra",
    label: "cerebra/agent-trace/**",
    detail: "pre-relay",
    color: "#22E0C4",
    prefix: "cerebra/",
    relayStatus: "pre-relay",
    subs: [{ name: "cerebra-tile", healthy: false }],
  },
  {
    id: "lumaweave",
    label: "lumaweave/graph/events",
    detail: "pre-relay",
    color: "#A6F35A",
    prefix: "lumaweave/",
    relayStatus: "pre-relay",
    degraded: true,
    subs: [{ name: "lumaweave-tile", healthy: false }],
  },
  {
    id: "policy",
    label: "policy-scout/audit/**",
    detail: "pre-relay",
    color: "#B46CFF",
    prefix: "policy-scout/",
    relayStatus: "pre-relay",
    bundled: true,
    subs: [{ name: "policy-tile", healthy: false }],
  },
  {
    id: "fossic",
    label: "fossic/system",
    detail: "substrate meta",
    color: "#4CC9FF",
    prefix: "fossic/",
    relayStatus: "live",
    subs: [],
  },
  {
    id: "aistack",
    label: "ai-stack/gpu · models",
    detail: "pre-relay",
    color: "#FF5BC7",
    prefix: "ai-stack/",
    relayStatus: "pre-relay",
    bundled: true,
    subs: [{ name: "aistack-tile", healthy: false }],
  },
];

function routeToLane(stream_id: string): string | null {
  for (const lane of LANES) {
    if (stream_id.startsWith(lane.prefix)) return lane.id;
  }
  return null;
}

type Buffers = Record<string, LaneEvent[]>;

function emptyBuffers(): Buffers {
  return Object.fromEntries(LANES.map((l) => [l.id, []]));
}

// ── Sub-component: lane row ───────────────────────────────────────────────────

interface LaneProps {
  lane: LaneConfig;
  events: LaneEvent[];
  now: number;
  healthy: boolean;
}

function FossicLane({ lane, events, now, healthy }: LaneProps) {
  const visible = events.filter((e) => now - e.timestamp_ms < WINDOW_MS);
  const rate = events.filter((e) => now - e.timestamp_ms < RATE_WINDOW_MS).length / (RATE_WINDOW_MS / 1000);
  const relayStatus: LvStateKind = lane.degraded ? "pre-relay" : healthy ? "live" : "no-data-yet";

  return (
    <div className="ft-lane">
      <div className="ft-lane__header">
        <span className="ft-lane__label" style={{ color: lane.color }}>
          {lane.label}
        </span>
        <span className={`ft-lane__detail${lane.degraded ? " ft-lane__detail--degraded" : ""}`}>
          · {lane.detail}
        </span>
        {lane.bundled && (
          <span
            className="ft-lane__bundle"
            style={{ color: lane.color, borderColor: `${lane.color}44` }}
          >
            BUNDLE ▾
          </span>
        )}
        {lane.subs.map((s) => (
          <span
            key={s.name}
            className="ft-lane__sub-pill"
            style={{
              color: healthy ? "#6B7A8A" : "#FF5BC7",
              borderColor: healthy ? "#1C2530" : "rgba(255,91,199,0.35)",
            }}
          >
            {healthy ? "●" : "⚠"} {s.name}
          </span>
        ))}
        <span className="ft-lane__count">
          {visible.length} ev{rate > 0 && ` · ${rate.toFixed(1)}/s`}
        </span>
        {relayStatus !== "live" && (
          <LiveValueChip state={relayStatus} label={`${lane.id}-relay`} />
        )}
      </div>

      <div className="ft-lane__track-row">
        <svg className="ft-lane__track" width="100%" height="8" preserveAspectRatio="none">
          <rect width="100%" height="8" rx="1" fill="rgba(28,37,48,0.45)" />
          <line
            x1="0" y1="4" x2="100%" y2="4"
            stroke={lane.degraded ? "rgba(255,91,199,0.3)" : lane.color}
            strokeWidth="1"
            opacity="0.3"
          />
          {visible.slice(0, 120).map((ev) => {
            const ageFrac = (now - ev.timestamp_ms) / WINDOW_MS;
            const cx = ((1 - ageFrac) * 100).toFixed(2);
            return (
              <circle key={ev.id} cx={`${cx}%`} cy="4" r="1.8" fill={lane.color} />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── Main tile ─────────────────────────────────────────────────────────────────

interface Props {
  frozen?: boolean;
  onQueuedCountChange?: (n: number) => void;
}

export function FossicTile({ frozen = false, onQueuedCountChange = () => {} }: Props) {
  const [buffers, setBuffers] = useState<Buffers>(emptyBuffers);
  const [now, setNow] = useState(() => Date.now());
  const [hubState, setHubState] = useState<LvStateKind>("no-data-yet");

  // Freeze wiring
  const frozenRef = useRef(frozen);
  frozenRef.current = frozen;
  const onQueuedCountChangeRef = useRef(onQueuedCountChange);
  onQueuedCountChangeRef.current = onQueuedCountChange;
  const localCountRef = useRef(0);
  const latestBuffersRef = useRef<Buffers>(emptyBuffers());
  latestBuffersRef.current = buffers;
  const [frozenBuffers, setFrozenBuffers] = useState<Buffers | null>(null);

  useEffect(() => {
    if (frozen) {
      setFrozenBuffers({ ...latestBuffersRef.current });
      localCountRef.current = 0;
    } else {
      setFrozenBuffers(null);
      localCountRef.current = 0;
      onQueuedCountChangeRef.current(0);
    }
  }, [frozen]);

  // Hub readiness
  useEffect(() => {
    invoke<StoreStatus>("lattica_store_status")
      .then((s) => setHubState(s.ok ? "live" : "source-unreachable"))
      .catch(() => setHubState("source-unreachable"));
  }, []);

  // 1 Hz clock drives event position animation — pauses when frozen
  useEffect(() => {
    const id = setInterval(() => {
      if (!frozenRef.current) setNow(Date.now());
    }, 1_000);
    return () => clearInterval(id);
  }, []);

  // Prune stale events every 15 s
  useEffect(() => {
    const id = setInterval(() => {
      const cutoff = Date.now() - WINDOW_MS;
      setBuffers((prev) => {
        let changed = false;
        const next: Buffers = {};
        for (const lid of Object.keys(prev)) {
          const pruned = prev[lid].filter((e) => e.timestamp_ms > cutoff);
          next[lid] = pruned.length !== prev[lid].length ? (changed = true, pruned) : prev[lid];
        }
        return changed ? next : prev;
      });
    }, 15_000);
    return () => clearInterval(id);
  }, []);

  useFossicSubscription("**", (ev) => {
    const lid = routeToLane(ev.stream_id);
    if (!lid) return;
    const entry: LaneEvent = {
      id: ev.id,
      timestamp_ms: ev.timestamp_us / 1_000,
      event_type: ev.event_type,
    };
    setBuffers((prev) => ({
      ...prev,
      [lid]: [entry, ...prev[lid]].slice(0, MAX_EVENTS_PER_LANE),
    }));
    if (frozenRef.current) {
      localCountRef.current++;
      onQueuedCountChangeRef.current(localCountRef.current);
    }
  });

  // laneHealth uses live buffers — health reflects reality even when display is frozen
  const laneHealth = useMemo(
    () => Object.fromEntries(
      LANES.map((l) => [l.id, buffers[l.id].some((e) => now - e.timestamp_ms < RELAY_WINDOW_MS)])
    ),
    [buffers, now],
  );

  const displayBuffers = frozenBuffers ?? buffers;

  const totalVisible = LANES.reduce(
    (s, l) => s + displayBuffers[l.id].filter((e) => now - e.timestamp_ms < WINDOW_MS).length,
    0,
  );

  return (
    <div className="fossic-tile">
      {/* Info bar */}
      <div className="fossic-tile__bar">
        <LiveValueChip state={hubState} label="hub" />
        <span className="fossic-tile__bar-count">{totalVisible} ev</span>
        <span className="fossic-tile__bar-badge">6 lanes · 90 s</span>
      </div>

      {/* Visualization canvas */}
      <div className="fossic-tile__vis">
        {/* Gold→pink center beam */}
        <div className="fossic-tile__beam" />

        {/* Left flare — LATTICA entry */}
        <div className="fossic-tile__flare fossic-tile__flare--left">
          <div className="fossic-tile__flare-node">
            <div className="fossic-tile__flare-glow fossic-tile__flare-glow--lattica" />
            <div
              className="fossic-tile__flare-dot"
              style={{ background: "#F2A85C", boxShadow: "0 0 8px rgba(242,168,92,0.65)" }}
            />
            <span className="fossic-tile__flare-label" style={{ color: "#F2A85C" }}>
              LATTICA
            </span>
          </div>
          <span className="fossic-tile__flare-sub">entry</span>
        </div>

        {/* Right flares — BO + WEBUI consumers */}
        <div className="fossic-tile__flare fossic-tile__flare--right">
          <div className="fossic-tile__flare-node fossic-tile__flare-node--right">
            <span className="fossic-tile__flare-label" style={{ color: "#FF5BC7" }}>
              BO
            </span>
            <div
              className="fossic-tile__flare-dot"
              style={{ background: "#FF5BC7", boxShadow: "0 0 8px rgba(255,91,199,0.65)" }}
            />
            <div className="fossic-tile__flare-glow fossic-tile__flare-glow--bo" />
          </div>
          <div className="fossic-tile__flare-node fossic-tile__flare-node--right">
            <span className="fossic-tile__flare-label" style={{ color: "#6B7A8A" }}>
              WEBUI
            </span>
            <div
              className="fossic-tile__flare-dot"
              style={{ background: "rgba(107,122,138,0.7)" }}
            />
          </div>
          <span className="fossic-tile__flare-sub fossic-tile__flare-sub--right">consumers</span>
        </div>

        {/* Lane tracks */}
        <div className="fossic-tile__lanes">
          {LANES.map((lane) => (
            <FossicLane key={lane.id} lane={lane} events={displayBuffers[lane.id]} now={now} healthy={laneHealth[lane.id]} />
          ))}
        </div>

        {/* Time axis */}
        <div className="fossic-tile__axis">
          <span>−90 s</span>
          <span>−60 s</span>
          <span>−30 s</span>
          <span className="fossic-tile__axis-now">now</span>
        </div>
      </div>
    </div>
  );
}
