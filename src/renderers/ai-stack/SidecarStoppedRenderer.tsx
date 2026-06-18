/**
 * SidecarStopped payload renderer — ai-stack guest author (P-013).
 *
 * Payload shape (fossic_sidecar.py · _emit SidecarStopped):
 *   proposed; event type not yet implemented in sidecar.
 *   Scaffold only — no live events expected until lifecycle stream ships.
 *
 * Phase 2 — blocked on ai-stack-relay.py running live.
 */

import type { PayloadRendererProps } from "../../control-plane/payload-renderer/payloadRendererRegistry";
import "./SidecarStoppedRenderer.css";

export function SidecarStoppedRenderer({ payload: _payload, event_id }: PayloadRendererProps) {
  return (
    <div
      className="aistack-sidecar-stopped"
      data-renderer="SidecarStopped"
      data-event-id={event_id}
    >
      <span className="aistack-sidecar-stopped__label">SIDECAR STOPPED</span>
      <span className="aistack-sidecar-stopped__note">fossic_sidecar.py offline</span>
    </div>
  );
}
