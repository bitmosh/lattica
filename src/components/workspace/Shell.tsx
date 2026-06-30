import { useEffect, useRef, useState, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
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

const LANE_PREFIX: Record<string, string> = {
  lattica:   'lattica/',
  cerebra:   'cerebra/',
  lumaweave: 'lumaweave/',
  policy:    'policy-scout/',
  fossic:    'fossic/',
  aistack:   'ai-stack/',
};

const WINDOW_MS = 90_000;
const RATE_WINDOW_MS = 10_000;
const MAX_EVENTS = 200;

function routeToScope(stream_id: string): string | null {
  for (const [key, prefix] of Object.entries(LANE_PREFIX)) {
    if (stream_id.startsWith(prefix)) return key;
  }
  return null;
}

function emptyBuffers(): Buffers {
  return Object.fromEntries(SCOPE_PROJECTS.map(p => [p.key, []]));
}

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
          <div className="la-shell-drawer-inner">
            <span className="la-shell-drawer-stub">
              Module map · Phase 1 stub — full dependency view in later phase
            </span>
          </div>
        </div>
      )}

      <main className="la-shell-main">
        {children}
      </main>
    </div>
  );
}
