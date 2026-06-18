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

interface ApprovalItem {
  approval_id: string;
  request_id: string;
  decision_id: string;
  created_at: string;
  expires_at: string;
  status: string;
  actor: string | null;
  command: string;
  cwd: string;
  risk_score: number;
  decision: string;
  reasons: string[];
  recommended_action: string;
  scope: string;
  schema_version: number;
}

interface ApprovalsListResponse {
  approvals: ApprovalItem[];
}

type WatchState = 'running' | 'stopped' | 'stale' | 'unknown';

// ── Constants + helpers ──────────────────────────────────────────────────────

const POLL_MS = 15_000;

function riskBand(score: number): string {
  if (score >= 8) return 'critical';
  if (score >= 6) return 'high';
  if (score >= 3) return 'medium';
  if (score >= 1) return 'low';
  return 'none';
}

const RISK_BAND_STYLE: Record<string, { bg: string; text: string }> = {
  critical: { bg: '#b91c1c', text: '#fff' },
  high:     { bg: '#c97b00', text: '#fff' },
  medium:   { bg: '#b45309', text: '#fff' },
  low:      { bg: '#166534', text: '#fff' },
  none:     { bg: 'var(--la-surface, #1C2530)', text: 'inherit' },
};

function relExpiry(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const past = diff < 0;
  if (abs < 60_000) return past ? 'just expired' : 'in <1 min';
  if (abs < 3_600_000) {
    const m = Math.floor(abs / 60_000);
    return past ? `expired ${m}m ago` : `in ${m} min`;
  }
  if (abs < 86_400_000) {
    const h = Math.floor(abs / 3_600_000);
    return past ? `expired ${h}h ago` : `in ${h} h`;
  }
  const d = Math.floor(abs / 86_400_000);
  return past ? `expired ${d}d ago` : `in ${d} d`;
}

// ── Component ────────────────────────────────────────────────────────────────

export function PolicyScoutTile() {
  // Track A: CLI poll. Starts no-data-yet; transitions to live/source-unreachable.
  const [trackAState, setTrackAState] = useState<LvStateKind>('no-data-yet');

  // Track B: fossic subscribe. Always pre-relay until policy-scout-relay.py ships.
  const trackBState: LvStateKind = 'pre-relay';

  // Posture state — updated by ps_watch_status poll and action results
  const [lockdown, setLockdown] = useState(false);
  const [lockdownReason, setLockdownReason] = useState('');
  const [watchState, setWatchState] = useState<WatchState>('unknown');
  const [watchRestarting, setWatchRestarting] = useState(false);

  // Approvals state
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [inFlightIds, setInFlightIds] = useState<string[]>([]);

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
    try {
      const resp = await invoke<ApprovalsListResponse>('ps_approvals_list');
      setApprovals(resp.approvals.filter(a => a.status === 'pending'));
    } catch {
      // non-fatal — approval list stays stale on error
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

  const handleApproveOnce = async (approvalId: string) => {
    setInFlightIds(prev => [...prev, approvalId]);
    try {
      const resp = await invoke<CliJsonResponse>('ps_approve_once', { approvalId });
      if (resp.ok) {
        setApprovals(prev => prev.filter(a => a.approval_id !== approvalId));
        void pollTrackA();
      }
      setActionError(resp.error ?? null);
    } catch (e) {
      setActionError(String(e));
    } finally {
      setInFlightIds(prev => prev.filter(id => id !== approvalId));
    }
  };

  const handleDenyApproval = async (approvalId: string) => {
    setInFlightIds(prev => [...prev, approvalId]);
    try {
      const resp = await invoke<CliJsonResponse>('ps_deny', { approvalId });
      if (resp.ok) {
        setApprovals(prev => prev.filter(a => a.approval_id !== approvalId));
        void pollTrackA();
      }
      setActionError(resp.error ?? null);
    } catch (e) {
      setActionError(String(e));
    } finally {
      setInFlightIds(prev => prev.filter(id => id !== approvalId));
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
              style={{ color: lockdown ? 'var(--project-accent-policy-scout, #B46CFF)' : '#6B7A8A' }}
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

        {/* Pending approvals */}
        <div className="ps-tile__section">
          <div className="ps-tile__section-hd">
            <span className="ps-tile__section-label">PENDING APPROVALS</span>
            <span className="ps-tile__section-meta" style={{ color: '#4a7a9b' }}>
              {trackAState === 'live' ? `${approvals.length} waiting` : 'loading…'}
            </span>
          </div>
          {trackAState === 'source-unreachable' ? (
            <div className="ps-tile__prelay-row">
              <LiveValueChip state="source-unreachable" label="approvals" />
              <span className="ps-tile__prelay-note">CLI unreachable</span>
            </div>
          ) : trackAState === 'live' && approvals.length === 0 ? (
            <div className="ps-tile__empty-note">No pending approvals</div>
          ) : trackAState === 'live' ? (
            <div className="ps-tile__approvals-list">
              {approvals.map(a => {
                const band = riskBand(a.risk_score);
                const bandStyle = RISK_BAND_STYLE[band];
                const inFlight = inFlightIds.includes(a.approval_id);
                const expired = new Date(a.expires_at).getTime() < Date.now();
                return (
                  <div key={a.approval_id} className="ps-tile__approval-row">
                    <div className="ps-tile__approval-top">
                      <span
                        className="ps-tile__risk-chip"
                        style={{ background: bandStyle.bg, color: bandStyle.text }}
                      >
                        {band}
                      </span>
                      <span className="ps-tile__approval-cmd" title={a.command}>
                        {a.command.length > 48 ? a.command.slice(0, 47) + '…' : a.command}
                      </span>
                    </div>
                    <div className="ps-tile__approval-meta">
                      <span>score: {a.risk_score}</span>
                      <span style={{ color: expired ? 'var(--lv-source-unreachable, #e0a800)' : '#6B7A8A' }}>
                        {relExpiry(a.expires_at)}
                      </span>
                    </div>
                    <div className="ps-tile__approval-actions">
                      <button
                        className="ps-tile__action-btn ps-tile__action-btn--approve"
                        onClick={() => void handleApproveOnce(a.approval_id)}
                        disabled={inFlight}
                      >
                        {inFlight ? '…' : 'Approve'}
                      </button>
                      <button
                        className="ps-tile__action-btn ps-tile__action-btn--deny"
                        onClick={() => void handleDenyApproval(a.approval_id)}
                        disabled={inFlight}
                      >
                        {inFlight ? '…' : 'Deny'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="ps-tile__prelay-row">
              <LiveValueChip state="no-data-yet" label="approvals" />
              <span className="ps-tile__prelay-note">loading…</span>
            </div>
          )}
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
