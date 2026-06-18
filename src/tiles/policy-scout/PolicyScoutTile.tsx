import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { LiveValueChip, type LvStateKind } from '../../components/livevalue/LiveValueChip';
import './PolicyScoutTile.css';

// ── Types ────────────────────────────────────────────────────────────────────

interface CliJsonResponse {
  ok: boolean;
  active?: boolean;
  reason?: string;
  already_active?: boolean;
  already_inactive?: boolean;
  error?: string;
}

interface WatchStatusResponse {
  running: boolean;
  pid?: number;
  stale?: boolean;
  pid_file: string;
}

type WatchState = 'running' | 'stopped' | 'stale' | 'unknown';

// ── Constants ────────────────────────────────────────────────────────────────

const POLL_MS = 15_000;

// ── Component ────────────────────────────────────────────────────────────────

export function PolicyScoutTile() {
  // Track A: CLI poll. ps_watch_status not yet in lib.rs — transitions to
  // source-unreachable on first failed invoke.
  const [trackAState, setTrackAState] = useState<LvStateKind>('no-data-yet');

  // Track B: fossic subscribe. Always pre-relay until policy-scout-relay.py ships.
  const trackBState: LvStateKind = 'pre-relay';

  // Posture state — updated by action results
  const [lockdown, setLockdown] = useState(false);
  const [lockdownReason, setLockdownReason] = useState('');
  const [watchState, setWatchState] = useState<WatchState>('unknown');
  const [watchRestarting, setWatchRestarting] = useState(false);

  // UI
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [pendingReason, setPendingReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // ── Track A poll ─────────────────────────────────────────────────────────

  const pollTrackA = useCallback(async () => {
    try {
      const resp = await invoke<WatchStatusResponse>('ps_watch_status');
      setWatchState(resp.stale ? 'stale' : resp.running ? 'running' : 'stopped');
      setTrackAState('live');
    } catch {
      setTrackAState('source-unreachable');
      setWatchState('unknown');
    }
  }, []);

  useEffect(() => {
    void pollTrackA();
    const id = setInterval(() => void pollTrackA(), POLL_MS);
    return () => clearInterval(id);
  }, [pollTrackA]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleActivateLockdown = async () => {
    const reason = pendingReason.trim() || undefined;
    try {
      const resp = await invoke<CliJsonResponse>('activate_lockdown', {
        reason: reason ?? null,
      });
      if (resp.ok || resp.already_active) {
        setLockdown(true);
        if (reason) setLockdownReason(reason);
        setTrackAState('live');
      }
      setActionError(resp.error ?? null);
    } catch (e) {
      setActionError(String(e));
      setTrackAState('source-unreachable');
    }
    setShowReasonInput(false);
    setPendingReason('');
  };

  const handleDeactivateLockdown = async () => {
    try {
      const resp = await invoke<CliJsonResponse>('deactivate_lockdown');
      if (resp.ok || resp.already_inactive) {
        setLockdown(false);
        setLockdownReason('');
        setTrackAState('live');
      }
      setActionError(resp.error ?? null);
    } catch (e) {
      setActionError(String(e));
      setTrackAState('source-unreachable');
    }
  };

  const handleRestartWatch = async () => {
    setWatchRestarting(true);
    setWatchState('stopped');
    try {
      const resp = await invoke<CliJsonResponse>('restart_watch');
      if (resp.ok) {
        setWatchState('running');
        setTrackAState('live');
      }
      setActionError(resp.error ?? null);
    } catch (e) {
      setActionError(String(e));
      setTrackAState('source-unreachable');
    } finally {
      setWatchRestarting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const watchColor =
    watchState === 'running' ? '#5eba7d' :
    watchState === 'stale'   ? '#c97b00' : '#6B7A8A';

  const watchLabel =
    watchState === 'running' ? '⬤ Watch running' :
    watchState === 'stale'   ? '⚠ Watch stale'   :
    watchState === 'stopped' ? '○ Watch stopped'  :
                               '○ Watch unknown';

  return (
    <div className="ps-tile" data-testid="policy-scout-tile">

      {/* ── Tracks row + posture strip ── */}
      <div className="ps-tile__top-strip">
        <div className="ps-tile__tracks-row">
          <span className="ps-tile__mono-label">TRACKS</span>
          <LiveValueChip state={trackAState} label="A·CLI" />
          <LiveValueChip state={trackBState} label="B·fossic" />
        </div>

        <div className="ps-tile__posture-grid">
          {/* Lockdown cell */}
          <div
            className={`ps-tile__posture-cell${lockdown ? ' ps-tile__posture-cell--lockdown' : ''}`}
          >
            <span
              className="ps-tile__posture-name"
              style={{ color: lockdown ? '#cf0a5c' : '#6B7A8A' }}
            >
              {lockdown ? '⬤ LOCKDOWN' : '○ Unlocked'}
            </span>
            {lockdown && lockdownReason && (
              <span className="ps-tile__posture-sub">{lockdownReason}</span>
            )}
          </div>

          {/* Watch cell */}
          <div className="ps-tile__posture-cell">
            <span className="ps-tile__posture-name" style={{ color: watchColor }}>
              {watchLabel}
            </span>
            {watchRestarting && (
              <span className="ps-tile__posture-sub">restarting…</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="ps-tile__body">

        {/* Pending approvals — pre-relay until ps_approvals_list lands in lib.rs (Phase 3) */}
        <div className="ps-tile__section">
          <div className="ps-tile__section-hd">
            <span className="ps-tile__section-label">PENDING APPROVALS</span>
          </div>
          <div className="ps-tile__prelay-row">
            <LiveValueChip state="pre-relay" label="approvals" />
            <span className="ps-tile__prelay-note">ps_approvals_list wiring pending — Phase 3</span>
          </div>
        </div>

        {/* Recent decisions */}
        <div className="ps-tile__section">
          <div className="ps-tile__section-hd">
            <span className="ps-tile__section-label">RECENT DECISIONS</span>
            <span className="ps-tile__section-meta">
              CLI history · fossic feed pre-relay
            </span>
          </div>
          <div className="ps-tile__empty-note">
            no decisions — waiting for Track B fossic feed
          </div>
        </div>

        {/* Track B feed placeholder */}
        <div className="ps-tile__prelay-row ps-tile__prelay-row--block">
          <LiveValueChip state="pre-relay" label="Track B feed" />
          <span className="ps-tile__prelay-note">
            hidden until policy-scout-relay.py ships
          </span>
        </div>

      </div>

      {/* ── Action bar ── */}
      <div className="ps-tile__action-bar">
        {showReasonInput && (
          <div className="ps-tile__reason-row">
            <input
              className="ps-tile__reason-input"
              autoFocus
              placeholder="reason (optional, max 200)"
              maxLength={200}
              value={pendingReason}
              onChange={e => setPendingReason(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') void handleActivateLockdown();
                if (e.key === 'Escape') { setShowReasonInput(false); setPendingReason(''); }
              }}
            />
            <button
              className="ps-tile__action-btn ps-tile__action-btn--danger"
              onClick={() => void handleActivateLockdown()}
            >
              Confirm
            </button>
            <button
              className="ps-tile__action-btn"
              onClick={() => { setShowReasonInput(false); setPendingReason(''); }}
            >
              Cancel
            </button>
          </div>
        )}

        <div className="ps-tile__btn-row">
          {lockdown ? (
            <button
              className="ps-tile__action-btn ps-tile__action-btn--flex"
              onClick={() => void handleDeactivateLockdown()}
            >
              Deactivate
            </button>
          ) : (
            <button
              className="ps-tile__action-btn ps-tile__action-btn--flex ps-tile__action-btn--danger"
              onClick={() => setShowReasonInput(true)}
              disabled={showReasonInput}
            >
              Activate lockdown
            </button>
          )}
          <button
            className="ps-tile__action-btn ps-tile__action-btn--flex"
            onClick={() => void handleRestartWatch()}
            disabled={watchRestarting}
          >
            {watchRestarting ? 'Restarting…' : 'Restart watch'}
          </button>
        </div>

        {actionError !== null && (
          <div className="ps-tile__error">{actionError}</div>
        )}
      </div>

    </div>
  );
}
