/**
 * ModelLoaded payload renderer — ai-stack guest author (P-013).
 *
 * Payload shape (fossic_sidecar.py · _emit ModelLoaded):
 *   name:       str — model name (e.g. "llama3:70b")
 *   size_bytes: int — model size in bytes
 *   digest:     str — model digest hash
 *
 * indexed_tags: { model_name: str }
 *
 * Phase 2 — blocked on ai-stack-relay.py running live.
 */

import type { PayloadRendererProps } from "../../control-plane/payload-renderer/payloadRendererRegistry";
import "./ModelLoadedRenderer.css";

interface ModelLoadedPayload {
  name: string;
  size_bytes: number;
  digest: string;
}

function isModelLoadedPayload(v: unknown): v is ModelLoadedPayload {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return typeof p.name === "string" && typeof p.size_bytes === "number";
}

function fmtGb(bytes: number): string {
  return (bytes / (1024 * 1024 * 1024)).toFixed(1);
}

export function ModelLoadedRenderer({ payload, event_id }: PayloadRendererProps) {
  if (!isModelLoadedPayload(payload)) {
    return (
      <div
        className="aistack-model-loaded aistack-model-loaded--invalid"
        data-renderer="ModelLoaded"
      >
        <span className="aistack-model-loaded__label">ModelLoaded</span>
        <span className="aistack-model-loaded__error">invalid payload</span>
      </div>
    );
  }

  const { name, size_bytes, digest } = payload;

  return (
    <div
      className="aistack-model-loaded"
      data-renderer="ModelLoaded"
      data-event-id={event_id}
    >
      <div className="aistack-model-loaded__header">
        <span className="aistack-model-loaded__label">MODEL LOADED</span>
      </div>
      <div className="aistack-model-loaded__name">{name}</div>
      <div className="aistack-model-loaded__meta">
        <span>{fmtGb(size_bytes)} GB</span>
        {digest && (
          <>
            <span className="aistack-model-loaded__sep">·</span>
            <span className="aistack-model-loaded__digest">{digest.slice(0, 12)}</span>
          </>
        )}
      </div>
    </div>
  );
}
