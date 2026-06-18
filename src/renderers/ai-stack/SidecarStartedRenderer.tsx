/**
 * SidecarStarted payload renderer — ai-stack guest author (P-013).
 *
 * Payload shape (fossic_sidecar.py · _emit SidecarStarted):
 *   proposed; event type not yet implemented in sidecar.
 *   Scaffold only — no live events expected until lifecycle stream ships.
 *
 * Phase 2 — blocked on ai-stack-relay.py running live.
 */

import type { PayloadRendererProps } from "../../control-plane/payload-renderer/payloadRendererRegistry";
import "./SidecarStartedRenderer.css";

export function SidecarStartedRenderer({ payload: _payload, event_id }: PayloadRendererProps) {
  return (
    <div
      className="aistack-sidecar-started"
      data-renderer="SidecarStarted"
      data-event-id={event_id}
    >
      <span className="aistack-sidecar-started__label">SIDECAR STARTED</span>
      <span className="aistack-sidecar-started__note">fossic_sidecar.py online</span>
    </div>
  );
}
