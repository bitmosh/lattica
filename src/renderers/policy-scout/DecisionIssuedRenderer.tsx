import type { PayloadRendererProps } from '../../control-plane/payload-renderer/payloadRendererRegistry';
import './DecisionIssuedRenderer.css';

interface DecisionIssuedPayload {
  verdict: 'ALLOW' | 'SANDBOX_FIRST' | 'DENY';
  cmd: string;
  decision_id?: string;
  decided_at?: number;
}

const BADGE: Record<string, { label: string; color: string }> = {
  ALLOW:         { label: 'ALLOW',   color: '#5eba7d' },
  SANDBOX_FIRST: { label: 'SANDBOX', color: '#c97b00' },
  DENY:          { label: 'DENY',    color: 'var(--project-accent-policy-scout, #B46CFF)' },
};

function isDecisionIssuedPayload(v: unknown): v is DecisionIssuedPayload {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return typeof p.verdict === 'string' && typeof p.cmd === 'string';
}

function fmtAge(ms: number): string {
  const d = Math.floor((Date.now() - ms) / 1000);
  if (d < 1) return 'now';
  if (d < 60) return `${d}s`;
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  return `${Math.floor(d / 3600)}h`;
}

export function DecisionIssuedRenderer({ payload, event_id }: PayloadRendererProps) {
  if (!isDecisionIssuedPayload(payload)) {
    return (
      <div
        className="ps-dec ps-dec--invalid"
        data-ps-renderer="DecisionIssued"
        data-event-id={event_id}
      >
        <span className="ps-dec__label">DecisionIssued</span>
        <span className="ps-dec__error">invalid payload</span>
      </div>
    );
  }

  const badge = BADGE[payload.verdict] ?? { label: payload.verdict, color: '#6B7A8A' };

  return (
    <div
      className="ps-dec"
      data-ps-renderer="DecisionIssued"
      data-event-id={event_id}
      style={{ borderLeftColor: badge.color }}
    >
      <span className="ps-dec__verdict" style={{ color: badge.color }}>
        {badge.label}
      </span>
      <span className="ps-dec__cmd">{payload.cmd}</span>
      {payload.decided_at !== undefined && (
        <span className="ps-dec__age">{fmtAge(payload.decided_at)}</span>
      )}
    </div>
  );
}
