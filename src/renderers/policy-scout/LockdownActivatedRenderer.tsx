import type { PayloadRendererProps } from '../../control-plane/payload-renderer/payloadRendererRegistry';
import './LockdownActivatedRenderer.css';

interface LockdownActivatedPayload {
  reason?: string | null;
  activated_at?: number;
}

function isLockdownActivatedPayload(v: unknown): v is LockdownActivatedPayload {
  return typeof v === 'object' && v !== null;
}

export function LockdownActivatedRenderer({ payload, event_id }: PayloadRendererProps) {
  if (!isLockdownActivatedPayload(payload)) {
    return (
      <div
        className="ps-lockdown-on ps-lockdown-on--invalid"
        data-ps-renderer="LockdownActivated"
        data-event-id={event_id}
      >
        <span>LockdownActivated · invalid payload</span>
      </div>
    );
  }

  return (
    <div
      className="ps-lockdown-on"
      data-ps-renderer="LockdownActivated"
      data-event-id={event_id}
    >
      <span className="ps-lockdown-on__label">⬤ LOCKDOWN ACTIVATED</span>
      {payload.reason && (
        <span className="ps-lockdown-on__reason">{payload.reason}</span>
      )}
    </div>
  );
}
