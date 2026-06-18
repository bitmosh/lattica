/**
 * ModelUnloaded payload renderer — ai-stack guest author (P-013).
 *
 * Payload shape (fossic_sidecar.py · _emit ModelUnloaded):
 *   name: str — model name (e.g. "llama3:70b")
 *
 * indexed_tags: { model_name: str }
 *
 * Phase 2 — blocked on ai-stack-relay.py running live.
 */

import type { PayloadRendererProps } from "../../control-plane/payload-renderer/payloadRendererRegistry";
import "./ModelUnloadedRenderer.css";

interface ModelUnloadedPayload {
  name: string;
}

function isModelUnloadedPayload(v: unknown): v is ModelUnloadedPayload {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return typeof p.name === "string";
}

export function ModelUnloadedRenderer({ payload, event_id }: PayloadRendererProps) {
  if (!isModelUnloadedPayload(payload)) {
    return (
      <div
        className="aistack-model-unloaded aistack-model-unloaded--invalid"
        data-renderer="ModelUnloaded"
      >
        <span className="aistack-model-unloaded__label">ModelUnloaded</span>
        <span className="aistack-model-unloaded__error">invalid payload</span>
      </div>
    );
  }

  const { name } = payload;

  return (
    <div
      className="aistack-model-unloaded"
      data-renderer="ModelUnloaded"
      data-event-id={event_id}
    >
      <span className="aistack-model-unloaded__label">MODEL UNLOADED</span>
      <span className="aistack-model-unloaded__name">{name}</span>
    </div>
  );
}
