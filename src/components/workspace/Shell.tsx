import { useEffect, useRef, useState, type ReactNode, type JSX } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { routeToScope } from '../../lib/routing';
import './Shell.css';

interface Props {
  children: ReactNode;
}

interface SerializedEvent {
  id: string;
  stream_id: string;
  timestamp_us: number;
  event_type: string;
}

interface FossicEventPayload {
  subscription_id: string;
  event: SerializedEvent;
}

interface LaneEvent {
  id: string;
  timestamp_ms: number;
}

type Buffers = Record<string, LaneEvent[]>;

const SCOPE_PROJECTS: Array<{ key: string; label: string; color: string; bg: string }> = [
  { key: 'lattica',   label: 'lattica',   color: '#F2A85C', bg: 'rgba(242,168,92,0.07)' },
  { key: 'cerebra',   label: 'cerebra',   color: '#22E0C4', bg: 'rgba(34,224,196,0.07)' },
  { key: 'lumaweave', label: 'lumaweave', color: '#A6F35A', bg: 'rgba(166,243,90,0.07)' },
  { key: 'policy',    label: 'policy',    color: '#B46CFF', bg: 'rgba(180,108,255,0.07)' },
  { key: 'fossic',    label: 'fossic',    color: '#4CC9FF', bg: 'rgba(76,201,255,0.07)' },
  { key: 'aistack',   label: 'ai-stack',  color: '#FF5BC7', bg: 'rgba(255,91,199,0.07)' },
];

const WINDOW_MS = 90_000;
const RATE_WINDOW_MS = 10_000;
const MAX_EVENTS = 200;

function emptyBuffers(): Buffers {
  return Object.fromEntries(SCOPE_PROJECTS.map(p => [p.key, []]));
}

// ─── PillarSvg ────────────────────────────────────────────────────────────────

function PillarSvg() {
  const TAU = Math.PI * 2;
  const cx = 130, r = 42, yTop = 32, H = 160, yBot = yTop + H, turns = 1.7, N = 180;

  function buildStrand(color: string, phase: number, dir: number): JSX.Element[] {
    const pts: Array<{ x: number; y: number; front: boolean }> = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const theta = phase + dir * TAU * turns * t;
      pts.push({ x: cx + r * Math.cos(theta), y: yTop + t * H, front: Math.sin(theta) > 0 });
    }
    type Run = { front: boolean; pts: typeof pts };
    const runs: Run[] = [];
    let cur: Run | null = null;
    for (const p of pts) {
      if (!cur || cur.front !== p.front) { cur = { front: p.front, pts: [] }; runs.push(cur); }
      cur.pts.push(p);
    }
    runs.forEach((run, idx) => { if (idx < runs.length - 1) run.pts.push(runs[idx + 1].pts[0]); });
    return runs.map((run, idx) => {
      const d = run.pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      const key = `${color}-${idx}`;
      if (run.front) {
        return (
          <path key={key} d={d} fill="none" stroke={color} strokeWidth={1.8} strokeOpacity={0.95}
            strokeLinecap="round" strokeDasharray="14 4">
            <animate attributeName="stroke-dashoffset" from="0" to={dir > 0 ? '-18' : '18'}
              dur={dir > 0 ? '3.2s' : '2.6s'} repeatCount="indefinite" />
          </path>
        );
      }
      return <path key={key} d={d} fill="none" stroke={color} strokeWidth={1}
        strokeOpacity={0.3} strokeLinecap="round" strokeDasharray="3 4" />;
    });
  }

  return (
    <svg width="100%" viewBox="0 0 280 240" preserveAspectRatio="xMidYMid meet" className="la-drawer-pillar-svg">
      <rect x={cx - r} y={yTop} width={r * 2} height={H}
        fill="rgba(76,201,255,0.08)" stroke="rgba(76,201,255,0.28)" strokeWidth={1} />
      <ellipse cx={cx} cy={yBot} rx={r} ry={8}
        fill="rgba(11,15,18,0.6)" stroke="rgba(76,201,255,0.18)" strokeWidth={1} />
      {buildStrand('#A6F35A', 0, 1)}
      {buildStrand('#B46CFF', Math.PI, 1)}
      {buildStrand('#22E0C4', Math.PI / 2, -1)}
      <ellipse cx={cx} cy={yTop} rx={r} ry={8}
        fill="rgba(76,201,255,0.18)" stroke="rgba(76,201,255,0.5)" strokeWidth={1} />
      <text x={cx} y={yTop - 12} textAnchor="middle"
        fontFamily="Geist Mono, monospace" fontSize={9} fill="#4CC9FF" letterSpacing={1}>FOSSIC</text>
      <g fontFamily="Geist Mono, monospace" fontSize={8}>
        <text x={14} y={38} fill="#22E0C4">↺ cerebra</text>
        <text x={200} y={38} fill="#A6F35A">↻ lumaweave</text>
        <text x={200} y={50} fill="#B46CFF">↻ policy</text>
        <text x={cx} y={yBot + 24} textAnchor="middle" fill="#6B7A8A">cerebra crosses on every half-turn</text>
      </g>
    </svg>
  );
}

// ─── PlatformDrawer ───────────────────────────────────────────────────────────

interface PlatformDrawerProps {
  buffers: Buffers;
  now: number;
}

function PlatformDrawer({ buffers, now }: PlatformDrawerProps) {
  const rates: Record<string, number> = {};
  for (const p of SCOPE_PROJECTS) {
    rates[p.key] = buffers[p.key].filter(e => now - e.timestamp_ms < RATE_WINDOW_MS).length / (RATE_WINDOW_MS / 1_000);
  }
  const platformRate = SCOPE_PROJECTS.reduce((s, p) => s + rates[p.key], 0);

  const modules = [
    {
      key: 'lattica', label: 'lattica', color: '#F2A85C',
      subInfo: 'v0.3.6 · host shell',
      badge: 'running', badgeColor: '#A6F35A', pulsing: false, degraded: false,
    },
    {
      key: 'fossic', label: 'fossic', color: '#4CC9FF',
      subInfo: 'substrate · event log',
      badge: 'healthy', badgeColor: '#A6F35A', pulsing: false, degraded: false,
    },
    {
      key: 'cerebra', label: 'cerebra', color: '#22E0C4',
      subInfo: `${rates.cerebra.toFixed(1)}/s · memory layer`,
      badge: rates.cerebra > 0 ? 'live' : 'connected',
      badgeColor: rates.cerebra > 0 ? '#A6F35A' : '#6B7A8A',
      pulsing: rates.cerebra > 0, degraded: false,
    },
    {
      key: 'lumaweave', label: 'lumaweave', color: '#A6F35A',
      subInfo: 'graph stream · pre-relay',
      badge: 'pre-relay', badgeColor: '#6B7A8A', pulsing: false, degraded: false,
    },
    {
      key: 'policy', label: 'policy-scout', color: '#B46CFF',
      subInfo: `${rates.policy.toFixed(1)}/s · governance`,
      badge: rates.policy > 0 ? 'live' : 'connected',
      badgeColor: rates.policy > 0 ? '#A6F35A' : '#6B7A8A',
      pulsing: rates.policy > 0, degraded: false,
    },
    {
      key: 'aistack', label: 'ai-stack / bo', color: '#FF5BC7',
      subInfo: `${rates.aistack.toFixed(1)}/s · inference`,
      badge: rates.aistack > 0 ? 'live' : 'connected',
      badgeColor: rates.aistack > 0 ? '#A6F35A' : '#6B7A8A',
      pulsing: rates.aistack > 0, degraded: false,
    },
  ];

  const healthyCount = modules.filter(m => !m.degraded).length;
  const degradedCount = modules.filter(m => m.degraded).length;

  return (
    <div className="la-drawer-grid">
      <div className="la-drawer-modules">
        <div className="la-drawer-section-header">
          <span className="la-drawer-section-title">Modules · {platformRate.toFixed(1)}/s</span>
          <span className="la-drawer-health-summary" style={{ color: degradedCount > 0 ? '#FF5BC7' : '#A6F35A' }}>
            {healthyCount} healthy{degradedCount > 0 ? ` · ${degradedCount} degraded` : ''}
          </span>
        </div>
        <div className="la-drawer-module-list">
          {modules.map(m => (
            <div key={m.key} className={`la-drawer-module-row${m.degraded ? ' la-drawer-module-row--degraded' : ''}`}>
              <span
                className="la-drawer-module-dot"
                style={{
                  background: m.badgeColor,
                  animationName: m.pulsing ? 'la-pulse-fast' : 'none',
                }}
              />
              <span className="la-drawer-module-name" style={{ color: m.color }}>{m.label}</span>
              <span className="la-drawer-module-sub">{m.subInfo}</span>
              <span className="la-drawer-module-badge" style={{ color: m.badgeColor }}>{m.badge}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="la-drawer-pillar">
        <div className="la-drawer-section-header">
          <span className="la-drawer-section-title">Substrate &amp; streams</span>
        </div>
        <PillarSvg />
      </div>
    </div>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export function Shell({ children }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [buffers, setBuffers] = useState<Buffers>(emptyBuffers);
  const [now, setNow] = useState(() => Date.now());
  const subIdRef = useRef<string | null>(null);

  // 1 Hz clock drives tick position animation
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Prune events older than WINDOW_MS every 15 s
  useEffect(() => {
    const id = setInterval(() => {
      const cutoff = Date.now() - WINDOW_MS;
      setBuffers(prev => {
        let changed = false;
        const next: Buffers = {};
        for (const key of Object.keys(prev)) {
          const pruned = prev[key].filter(e => e.timestamp_ms > cutoff);
          next[key] = pruned.length !== prev[key].length ? (changed = true, pruned) : prev[key];
        }
        return changed ? next : prev;
      });
    }, 15_000);
    return () => clearInterval(id);
  }, []);

  // Subscribe to all hub streams
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    let cancelled = false;

    async function setup() {
      const subId = await invoke<string>('fossic_subscribe', {
        streamPattern: '**',
        branch: null,
        includeSystem: false,
        queueSize: null,
      });
      if (cancelled) {
        invoke('fossic_unsubscribe', { subscriptionId: subId }).catch(() => {});
        return;
      }
      subIdRef.current = subId;

      unlisten = await listen<FossicEventPayload>('fossic:event', e => {
        if (e.payload.subscription_id !== subId) return;
        const ev = e.payload.event;
        const key = routeToScope(ev.stream_id);
        if (!key) return;
        const entry: LaneEvent = { id: ev.id, timestamp_ms: ev.timestamp_us / 1_000 };
        setBuffers(prev => ({
          ...prev,
          [key]: [entry, ...prev[key]].slice(0, MAX_EVENTS),
        }));
      });
    }

    setup().catch(e => console.error('[Shell] subscribe:', e));

    return () => {
      cancelled = true;
      unlisten?.();
      if (subIdRef.current) {
        invoke('fossic_unsubscribe', { subscriptionId: subIdRef.current }).catch(() => {});
        subIdRef.current = null;
      }
    };
  }, []);

  const rate = SCOPE_PROJECTS.reduce(
    (s, p) => s + buffers[p.key].filter(e => now - e.timestamp_ms < RATE_WINDOW_MS).length,
    0,
  ) / (RATE_WINDOW_MS / 1_000);

  return (
    <div className="la-shell">
      <header className="la-shell-topbar">
        {/* Brand */}
        <div className="la-shell-brand">
          <span className="la-shell-brand-icon">L</span>
          <span className="la-shell-brand-name">Lattica</span>
          <span className="la-shell-brand-version">v0.3.6</span>
        </div>

        {/* Activity scope — 6-lane event visualization */}
        <div className="la-shell-activity">
          <div className="la-shell-activity-scope">
            <div className="la-shell-activity-labels">
              {SCOPE_PROJECTS.map(p => (
                <span key={p.key} className="la-shell-activity-label" style={{ color: p.color }}>
                  {p.label}
                </span>
              ))}
            </div>
            <div className="la-shell-activity-lanes">
              {SCOPE_PROJECTS.map(p => {
                const visible = buffers[p.key].filter(e => now - e.timestamp_ms < WINDOW_MS);
                return (
                  <div
                    key={p.key}
                    className="la-shell-activity-lane"
                    style={{ background: p.bg }}
                  >
                    <svg width="100%" height="7" preserveAspectRatio="none" style={{ display: 'block' }}>
                      {visible.slice(0, 80).map(ev => {
                        const ageFrac = (now - ev.timestamp_ms) / WINDOW_MS;
                        const cx = ((1 - ageFrac) * 100).toFixed(2);
                        return (
                          <circle key={ev.id} cx={`${cx}%`} cy="3.5" r="1.5" fill={p.color} />
                        );
                      })}
                    </svg>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Platform controls */}
        <div className="la-shell-platform">
          <span className="la-shell-rate">{rate.toFixed(1)}/s</span>
          <button
            className="la-shell-platform-btn"
            onClick={() => setDrawerOpen(o => !o)}
          >
            <span className="la-shell-platform-dot" />
            <span className="la-shell-platform-label">platform OK</span>
            <span className="la-shell-drawer-arrow">{drawerOpen ? '▴' : '▾'}</span>
          </button>
        </div>
      </header>

      {drawerOpen && (
        <div className="la-shell-drawer">
          <PlatformDrawer buffers={buffers} now={now} />
        </div>
      )}

      <main className="la-shell-main">
        {children}
      </main>
    </div>
  );
}
