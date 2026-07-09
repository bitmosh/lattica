// SPDX-License-Identifier: Apache-2.0
/**
 * VramBudgetChanged payload renderer — ai-stack guest author (P-013).
 *
 * Payload shape (fossic_sidecar.py · _emit VramBudgetChanged):
 *   total_bytes: int   — total VRAM capacity
 *   used_bytes:  int   — bytes currently allocated by running models
 *   pct:         float — used / total as 0.0–100.0
 *
 * indexed_tags: { warn: bool } — true when pct >= VRAM_WARN_PCT_THRESHOLD (90)
 *
 * Phase 2 — blocked on ai-stack-relay.py running live.
 */

import type { PayloadRendererProps } from "../../control-plane/payload-renderer/payloadRendererRegistry";
import "./VramBudgetChangedRenderer.css";

interface VramBudgetChangedPayload {
  total_bytes: number;
  used_bytes: number;
  pct: number;
}

function isVramBudgetChangedPayload(v: unknown): v is VramBudgetChangedPayload {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.total_bytes === "number" &&
    typeof p.used_bytes === "number" &&
    typeof p.pct === "number"
  );
}

function fmtGb(bytes: number): string {
  return (bytes / (1024 * 1024 * 1024)).toFixed(1);
}

function scoreBar(pct: number): string {
  const filled = Math.round(Math.min(pct, 100) / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

export function VramBudgetChangedRenderer({ payload, event_id }: PayloadRendererProps) {
  if (!isVramBudgetChangedPayload(payload)) {
    return (
      <div
        className="aistack-vram-renderer aistack-vram-renderer--invalid"
        data-renderer="VramBudgetChanged"
      >
        <span className="aistack-vram-renderer__label">VramBudgetChanged</span>
        <span className="aistack-vram-renderer__error">invalid payload</span>
      </div>
    );
  }

  const { total_bytes, used_bytes, pct } = payload;
  const warn = pct >= 90;

  return (
    <div
      className={`aistack-vram-renderer${warn ? " aistack-vram-renderer--warn" : ""}`}
      data-renderer="VramBudgetChanged"
      data-event-id={event_id}
    >
      <div className="aistack-vram-renderer__header">
        <span className="aistack-vram-renderer__label">VRAM BUDGET</span>
        {warn && <span className="aistack-vram-renderer__warn-badge">WARN</span>}
      </div>
      <div className="aistack-vram-renderer__bar-row">
        <span className="aistack-vram-renderer__bar">{scoreBar(pct)}</span>
        <span className={`aistack-vram-renderer__pct${warn ? " aistack-vram-renderer__pct--warn" : ""}`}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="aistack-vram-renderer__meta">
        <span>{fmtGb(used_bytes)} GB used</span>
        <span className="aistack-vram-renderer__sep">·</span>
        <span>{fmtGb(total_bytes)} GB total</span>
      </div>
    </div>
  );
}
