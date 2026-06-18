import type { PayloadRendererProps } from '../../control-plane/payload-renderer/payloadRendererRegistry';
import './ApprovalRequestedRenderer.css';

interface ApprovalRequestedPayload {
  approval_id: string;
  cmd: string;
  band?: 'critical' | 'high' | 'medium' | 'low';
  score?: number;
  expires_at?: number;
  caused_by?: string | null;
}

const BAND_COLORS: Record<string, string> = {
  critical: '#b91c1c',
  high:     '#c97b00',
  medium:   '#b45309',
  low:      '#166534',
};

function isApprovalRequestedPayload(v: unknown): v is ApprovalRequestedPayload {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return typeof p.approval_id === 'string' && typeof p.cmd === 'string';
}

function fmtExpiry(ms: number): string {
  const secs = Math.floor((ms - Date.now()) / 1000);
  if (secs <= 0) return 'expired';
  const m = Math.floor(secs / 60);
  return m > 0 ? `in ${m}m` : `in ${secs}s`;
}

export function ApprovalRequestedRenderer({ payload, event_id }: PayloadRendererProps) {
  if (!isApprovalRequestedPayload(payload)) {
    return (
      <div
        className="ps-appr ps-appr--invalid"
        data-ps-renderer="ApprovalRequested"
        data-event-id={event_id}
      >
        <span className="ps-appr__label">ApprovalRequested</span>
        <span className="ps-appr__error">invalid payload</span>
      </div>
    );
  }

  const bandColor = payload.band ? (BAND_COLORS[payload.band] ?? '#6B7A8A') : '#6B7A8A';

  return (
    <div
      className="ps-appr"
      data-ps-renderer="ApprovalRequested"
      data-event-id={event_id}
    >
      <div className="ps-appr__row1">
        {payload.band && (
          <span
            className="ps-appr__band"
            style={{ background: bandColor }}
          >
            {payload.band.toUpperCase()}
          </span>
        )}
        <span className="ps-appr__cmd">{payload.cmd}</span>
      </div>
      <div className="ps-appr__row2">
        {payload.score !== undefined && (
          <span>
            score{' '}
            <span style={{ color: bandColor }}>{payload.score}</span>
          </span>
        )}
        {payload.expires_at !== undefined && (
          <span>
            · expires{' '}
            <span>{fmtExpiry(payload.expires_at)}</span>
          </span>
        )}
        {payload.caused_by && (
          <span className="ps-appr__cause">↑ {payload.caused_by}</span>
        )}
      </div>
    </div>
  );
}
