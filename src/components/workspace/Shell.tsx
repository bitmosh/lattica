import { useState, type ReactNode } from 'react';
import './Shell.css';

interface Props {
  children: ReactNode;
}

const SCOPE_PROJECTS: Array<{ key: string; label: string; color: string; bg: string }> = [
  { key: 'lattica',   label: 'lattica',   color: '#F2A85C', bg: 'rgba(242,168,92,0.07)' },
  { key: 'cerebra',   label: 'cerebra',   color: '#22E0C4', bg: 'rgba(34,224,196,0.07)' },
  { key: 'lumaweave', label: 'lumaweave', color: '#A6F35A', bg: 'rgba(166,243,90,0.07)' },
  { key: 'policy',    label: 'policy',    color: '#B46CFF', bg: 'rgba(180,108,255,0.07)' },
  { key: 'fossic',    label: 'fossic',    color: '#4CC9FF', bg: 'rgba(76,201,255,0.07)' },
  { key: 'aistack',   label: 'ai-stack',  color: '#FF5BC7', bg: 'rgba(255,91,199,0.07)' },
];

export function Shell({ children }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="la-shell">
      <header className="la-shell-topbar">
        {/* Brand */}
        <div className="la-shell-brand">
          <span className="la-shell-brand-icon">L</span>
          <span className="la-shell-brand-name">Lattica</span>
          <span className="la-shell-brand-version">v0.3.4</span>
        </div>

        {/* Activity scope — 6-lane event visualization (Phase 1: static empty lanes) */}
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
              {SCOPE_PROJECTS.map(p => (
                <div
                  key={p.key}
                  className="la-shell-activity-lane"
                  style={{ background: p.bg }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Platform controls */}
        <div className="la-shell-platform">
          <span className="la-shell-rate">0.0/s</span>
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
