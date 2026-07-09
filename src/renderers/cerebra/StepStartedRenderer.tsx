// SPDX-License-Identifier: Apache-2.0
import type { PayloadRendererProps } from "../../control-plane/payload-renderer/payloadRendererRegistry";
import "./StepStartedRenderer.css";

interface StepStartedPayload {
  session_id: string;
  cycle_id: string;
  step_id: string;
  started_at?: number;
}

function isStepStartedPayload(v: unknown): v is StepStartedPayload {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return typeof p.session_id === "string" && typeof p.step_id === "string";
}

export function StepStartedRenderer({ payload, event_id }: PayloadRendererProps) {
  const p = isStepStartedPayload(payload) ? payload : null;
  const stepId = p?.step_id ?? "unknown";
  const cycleId = p?.cycle_id ?? null;
  const ts = p?.started_at ? new Date(p.started_at).toLocaleTimeString() : null;

  return (
    <div
      className="cs-step-started"
      data-cerebra-renderer="StepStarted"
      data-event-id={event_id}
    >
      <span className="cs-step-started__dot" />
      <span className="cs-step-started__text">StepStarted · {stepId}</span>
      {ts && <span className="cs-step-started__ts">{ts}</span>}
      {cycleId && (
        <span className="cs-step-started__cycle" title={cycleId}>
          {cycleId.slice(0, 8)}
        </span>
      )}
    </div>
  );
}
