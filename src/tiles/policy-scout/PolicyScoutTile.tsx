import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
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

interface SerializedEvent {
  id: string;
  stream_id: string;
  timestamp_us: number;
  event_type: string;
  payload: unknown;
}

interface FossicEventPayload {
  subscription_id: string;
  event: SerializedEvent;
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

const VERDICT_STYLE: Record<string, { bg: string; color: string }> = {
  ALLOW:         { bg: 'rgba(94,186,125,0.15)',  color: '#5eba7d' },
  SANDBOX_FIRST: { bg: 'rgba(201,123,0,0.15)',   color: '#c97b00' },
  DENY:          { bg: 'rgba(180,108,255,0.15)', color: 'var(--project-accent-policy-scout, #B46CFF)' },
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

function fmtAge(ms: number): string {
  const d = Math.floor((Date.now() - ms) / 1000);
  if (d < 1) return 'now';
  if (d < 60) return `${d}s`;
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  return `${Math.floor(d / 3600)}h`;
}

// ── Component ────────────────────────────────────────────────────────────────

export function PolicyScoutTile() {
  // Track A: CLI poll
  const [trackAState, setTrackAState] = useState<LvStateKind>('no-data-yet');
  // Track B: fossic subscribe
  const [trackBState, setTrackBState] = useState<LvStateKind>('no-data-yet');

  // Posture state — fast-pathed by Track B on event arrival; Track A reconciles on 15s tick
  const [lockdown, setLockdown] = useState(false);
  const [lockdownReason, setLockdownReason] = useState('');
  const [watchState, setWatchState] = useState<WatchState>('unknown');
  const [watchRestarting, setWatchRestarting] = useState(false);

  // Approvals state (Track A)
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [inFlightIds, setInFlightIds] = useState<string[]>([]);

  // Track B event accumulation
  const [psEvents, setPsEvents] = useState<SerializedEvent[]>([]);

  // UI
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [pendingReason, setPendingReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // Refs
  const subIdRef = useRef<string | null>(null);
  const bootTimeMs = useRef(Date.now());

  // ── Track B subscription ──────────────────────────────────────────────────

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    const boot = bootTimeMs.current;

    async function setup() {
      try {
        const subId = await invoke<string>('fossic_subscribe', {
          streamPattern: 'policy-scout/**',
          branch: null,
          includeSystem: false,
          queueSize: null,
        });
        if (cancelled) {
          invoke('fossic_unsubscribe', { subscriptionId: subId }).catch(() => {});
          return;
        }
        subIdRef.current = subId;

        unlisten = await listen<FossicEventPayload>('fossic:event', (msg) => {
          if (msg.payload.subscription_id !== subId) return;
          const ev = msg.payload.event;

          // Fast-path posture updates — boot guard prevents replay from flipping state
          const evMs = ev.timestamp_us / 1000;
          if (evMs > boot) {
            if (ev.event_type === 'LockdownActivated') {
              const p = ev.payload as { reason?: string | null };
              setLockdown(true);
              setLockdownReason(p.reason ?? '');
            } else if (ev.event_type === 'LockdownDeactivated') {
              setLockdown(false);
              setLockdownReason('');
            }
          }

          setPsEvents(prev => [...prev, ev]);
          setTrackBState('live');
        });

        // Backfill historical events from hub store
        try {
          const allStreams = await invoke<{ id: string }[]>('fossic_list_streams');
          const psStreams = allStreams.filter(s => s.id.startsWith('policy-scout/'));
          const batches = await Promise.all(
            psStreams.map(s =>
              invoke<SerializedEvent[]>('fossic_read_range', {
                streamId: s.id,
                branch: null,
                fromVersion: null,
                toVersion: null,
                limit: 100,
                eventTypeFilter: null,
              })
            )
          );
          const historical = batches.flat();
          if (historical.length > 0) {
            setPsEvents(prev => {
              const liveIds = new Set(prev.map(e => e.id));
              const fresh = historical.filter(e => !liveIds.has(e.id));
              return [...fresh, ...prev].sort((a, b) => a.timestamp_us - b.timestamp_us);
            });
            setTrackBState('live');
          }
        } catch {
          // backfill failure is non-fatal — live events still arrive
        }
      } catch {
        setTrackBState('source-unreachable');
      }
    }

    void setup();

    return () => {
      cancelled = true;
      unlisten?.();
      if (subIdRef.current) {
        invoke('fossic_unsubscribe', { subscriptionId: subIdRef.current }).catch(() => {});
        subIdRef.current = null;
      }
    };
  }, []);

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

  // ── Derived ───────────────────────────────────────────────────────────────

  const recentDecisions = [...psEvents]
    .filter(e => e.event_type === 'DecisionIssued')
    .reverse()
    .slice(0, 20);

  const watchColor =
    watchState === 'running' ? '#5eba7d' :
    watchState === 'stale'   ? '#c97b00' : '#6B7A8A';

  const watchLabel =
    watchState === 'running' ? '⬤ Watch running' :
    watchState === 'stale'   ? '⚠ Watch stale'   :
    watchState === 'stopped' ? '○ Watch stopped'  :
                               '○ Watch unknown';

  // ── Render ───────────────────────────────────────────────────────────────

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

        {/* Recent decisions (Track B) */}
        <div className="ps-tile__section">
          <div className="ps-tile__section-hd">
            <span className="ps-tile__section-label">RECENT DECISIONS</span>
            <span className="ps-tile__section-meta">
              {trackBState === 'live'
                ? `${recentDecisions.length} events`
                : 'fossic feed · loading…'}
            </span>
          </div>
          {trackBState === 'source-unreachable' ? (
            <div className="ps-tile__prelay-row">
              <LiveValueChip state="source-unreachable" label="B·fossic" />
              <span className="ps-tile__prelay-note">hub store unreachable</span>
            </div>
          ) : recentDecisions.length === 0 ? (
            <div className="ps-tile__empty-note">
              {trackBState === 'live' ? 'no decisions yet' : 'awaiting fossic feed…'}
            </div>
          ) : (
            <div className="ps-tile__decisions-list">
              {recentDecisions.map(ev => {
                const p = ev.payload as { verdict?: string; cmd?: string; decided_at?: number };
                const verdict = p.verdict ?? '?';
                const vs = VERDICT_STYLE[verdict] ?? { bg: 'rgba(107,122,138,0.15)', color: '#6B7A8A' };
                const ageMs = p.decided_at ?? ev.timestamp_us / 1000;
                return (
                  <div key={ev.id} className="ps-tile__decision-row">
                    <span
                      className="ps-tile__verdict-chip"
                      style={{ background: vs.bg, color: vs.color }}
                    >
                      {verdict}
                    </span>
                    <span className="ps-tile__decision-cmd" title={p.cmd ?? ''}>
                      {(p.cmd ?? '').length > 44
                        ? (p.cmd ?? '').slice(0, 43) + '…'
                        : (p.cmd ?? '—')}
                    </span>
                    <span className="ps-tile__decision-age">{fmtAge(ageMs)}</span>
                  </div>
                );
              })}
            </div>
          )}
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
