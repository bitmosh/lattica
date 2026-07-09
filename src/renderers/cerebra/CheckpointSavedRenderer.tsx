// SPDX-License-Identifier: Apache-2.0
/**
 * CheckpointSaved payload renderer — authored by Cerebra Claude (guest author).
 * Committed by Lattica Claude Code per P-013 guest-author-in-host-repo pattern.
 *
 * Payload shape (cerebra/cli/daemon.py · POST /checkpoint):
 *   session_id: string
 *   bundle_id: string — persisted ContinuationBundle identifier
 *   wm_item_count: number — working memory items at checkpoint time
 *   t1_count: number — TruthTower T1 items
 *   t2_count: number — TruthTower T2 items
 *   checkpointed_at: millisecond timestamp
 *
 * Stream: cerebra/agent-trace/<session_id>
 */

import type { PayloadRendererProps } from "../../control-plane/payload-renderer/payloadRendererRegistry";
import "./CheckpointSavedRenderer.css";

interface CheckpointSavedPayload {
  session_id: string;
  bundle_id: string;
  wm_item_count: number;
  t1_count: number;
  t2_count: number;
  checkpointed_at: number;
}

function isCheckpointSavedPayload(v: unknown): v is CheckpointSavedPayload {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.session_id === "string" &&
    typeof p.bundle_id === "string" &&
    typeof p.wm_item_count === "number" &&
    typeof p.t1_count === "number" &&
    typeof p.t2_count === "number"
  );
}

export function CheckpointSavedRenderer({ payload, event_id }: PayloadRendererProps) {
  if (!isCheckpointSavedPayload(payload)) {
    return (
      <div
        className="cerebra-checkpoint cerebra-checkpoint--invalid"
        data-cerebra-renderer="CheckpointSaved"
      >
        <span className="cerebra-checkpoint__label">CHECKPOINT</span>
        <span className="cerebra-checkpoint__error">invalid payload</span>
      </div>
    );
  }

  const { session_id, bundle_id, wm_item_count, t1_count, t2_count, checkpointed_at } = payload;
  const ts = new Date(checkpointed_at).toLocaleTimeString();

  return (
    <div
      className="cerebra-checkpoint"
      data-cerebra-renderer="CheckpointSaved"
      data-event-id={event_id}
    >
      <div className="cerebra-checkpoint__header">
        <span className="cerebra-checkpoint__label">CHECKPOINT</span>
        <span className="cerebra-checkpoint__bundle-id" title={bundle_id}>
          {bundle_id.slice(0, 20)}
        </span>
      </div>

      <div className="cerebra-checkpoint__counts">
        <span>wm:<strong>{wm_item_count}</strong></span>
        <span className="cerebra-checkpoint__sep">·</span>
        <span>T1:<strong>{t1_count}</strong></span>
        <span className="cerebra-checkpoint__sep">·</span>
        <span>T2:<strong>{t2_count}</strong></span>
      </div>

      <div className="cerebra-checkpoint__meta">
        <span>{session_id.slice(0, 16)}</span>
        <span className="cerebra-checkpoint__sep">·</span>
        <span>{ts}</span>
      </div>
    </div>
  );
}
