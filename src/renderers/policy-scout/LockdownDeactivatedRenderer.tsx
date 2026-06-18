import type { PayloadRendererProps } from '../../control-plane/payload-renderer/payloadRendererRegistry';
import './LockdownDeactivatedRenderer.css';

export function LockdownDeactivatedRenderer({ event_id }: PayloadRendererProps) {
  return (
    <div
      className="ps-lockdown-off"
      data-ps-renderer="LockdownDeactivated"
      data-event-id={event_id}
    >
      <span className="ps-lockdown-off__label">○ LOCKDOWN DEACTIVATED</span>
    </div>
  );
}
