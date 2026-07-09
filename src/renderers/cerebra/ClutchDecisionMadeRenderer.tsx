// SPDX-License-Identifier: Apache-2.0
/**
 * ClutchDecisionMade payload renderer — authored by Cerebra Claude (guest author).
 * Committed by Lattica Claude Code per P-013 guest-author-in-host-repo pattern.
 *
 * Payload shape (cerebra/cognition/cycle_runtime.py · emit_cycle_event("ClutchDecisionMade")):
 *   session_id, cycle_id, step_id, decision_id: string identifiers
 *   action: "accept" | "refine" | "stop"
 *   rule_matched: string — name of rule that fired, or "default_no_match"
 *   cascade_depth: number — 0-indexed position of matching rule; len(rules) when no match
 *   escalate_to_catalyst: boolean — true when no rule matched and catalyst engine was invoked
 *   decided_at: millisecond timestamp
 */

import type { PayloadRendererProps } from "../../control-plane/payload-renderer/payloadRendererRegistry";
import "./ClutchDecisionMadeRenderer.css";

interface ClutchDecisionMadePayload {
  session_id: string;
  cycle_id: string;
  step_id: string;
  decision_id: string;
  action: string;
  rule_matched: string;
  cascade_depth: number;
  escalate_to_catalyst: boolean;
  decided_at: number;
}

function isClutchDecisionMadePayload(v: unknown): v is ClutchDecisionMadePayload {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.session_id === "string" &&
    typeof p.action === "string" &&
    typeof p.rule_matched === "string" &&
    typeof p.cascade_depth === "number"
  );
}

const ACTION_LABEL: Partial<Record<string, string>> = {
  accept: "ACCEPT",
  refine: "REFINE",
  stop: "STOP",
};

export function ClutchDecisionMadeRenderer({ payload, event_id }: PayloadRendererProps) {
  if (!isClutchDecisionMadePayload(payload)) {
    return (
      <div
        className="cerebra-clutch-decision cerebra-clutch-decision--invalid"
        data-cerebra-renderer="ClutchDecisionMade"
      >
        <span className="cerebra-clutch-decision__label">ClutchDecisionMade</span>
        <span className="cerebra-clutch-decision__error">invalid payload</span>
      </div>
    );
  }

  const {
    session_id,
    cycle_id,
    step_id,
    action,
    rule_matched,
    cascade_depth,
    escalate_to_catalyst,
    decided_at,
  } = payload;

  const ts = new Date(decided_at).toLocaleTimeString();
  const noMatch = rule_matched === "default_no_match";
  const actionLabel = ACTION_LABEL[action] ?? action.toUpperCase();

  return (
    <div
      className={`cerebra-clutch-decision cerebra-clutch-decision--${action}`}
      data-cerebra-renderer="ClutchDecisionMade"
      data-event-id={event_id}
    >
      <div className="cerebra-clutch-decision__header">
        <span className="cerebra-clutch-decision__label">CLUTCH</span>
        <span className={`cerebra-clutch-decision__action cerebra-clutch-decision__action--${action}`}>
          {actionLabel}
        </span>
        {escalate_to_catalyst && (
          <span className="cerebra-clutch-decision__catalyst-badge">→ catalyst</span>
        )}
      </div>

      <div className="cerebra-clutch-decision__rule" title={`cycle: ${cycle_id} · step: ${step_id}`}>
        <span className="cerebra-clutch-decision__rule-depth">
          [{cascade_depth}]
        </span>
        <span className={`cerebra-clutch-decision__rule-name${noMatch ? " cerebra-clutch-decision__rule-name--no-match" : ""}`}>
          {noMatch ? "no match" : rule_matched}
        </span>
      </div>

      <div className="cerebra-clutch-decision__meta">
        <span>{session_id.slice(0, 16)}</span>
        <span className="cerebra-clutch-decision__sep">·</span>
        <span>{ts}</span>
      </div>
    </div>
  );
}
