// SPDX-License-Identifier: Apache-2.0
/**
 * OutcomeRecorded payload renderer — authored by Cerebra Claude (guest author).
 * Committed by Lattica Claude Code per P-013 guest-author-in-host-repo pattern.
 *
 * Payload shape (cerebra/cognition/predictions.py · emit_outcome_recorded):
 *   session_id, cycle_id, step_id: string identifiers
 *   outcome_id, prediction_id: string identifiers
 *   actual_composite_score: float 0.0–1.0
 *   prediction_error: float, signed (actual − expected); positive = exceeded, negative = fell short
 *   error_classification: "noise" | "notable" | "severe"
 *   per_signal_error: { [signal_name]: signed_error } for all six signals
 *   recorded_at: millisecond timestamp
 */

import type { PayloadRendererProps } from "../../control-plane/payload-renderer/payloadRendererRegistry";
import "./OutcomeRecordedRenderer.css";

interface OutcomeRecordedPayload {
  session_id: string;
  cycle_id: string;
  step_id: string;
  actual_composite_score: number;
  prediction_error: number;
  error_classification: string;
  per_signal_error: Record<string, number>;
  recorded_at: number;
}

function isOutcomeRecordedPayload(v: unknown): v is OutcomeRecordedPayload {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.session_id === "string" &&
    typeof p.actual_composite_score === "number" &&
    typeof p.error_classification === "string"
  );
}

const SIGNAL_ABBREV: Partial<Record<string, string>> = {
  COHERENCE: "COH",
  GROUNDEDNESS: "GND",
  GENERATIVITY: "GEN",
  RELEVANCE: "REL",
  PRECISION: "PRE",
  EPISTEMIC_HUMILITY: "EPH",
};

const SIGNAL_ORDER = [
  "COHERENCE",
  "GROUNDEDNESS",
  "GENERATIVITY",
  "RELEVANCE",
  "PRECISION",
  "EPISTEMIC_HUMILITY",
];

function scoreBar(score: number): string {
  const filled = Math.round(score * 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

function signedPct(error: number): string {
  const pct = Math.round(error * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

export function OutcomeRecordedRenderer({ payload, event_id }: PayloadRendererProps) {
  if (!isOutcomeRecordedPayload(payload)) {
    return (
      <div
        className="cerebra-outcome-recorded cerebra-outcome-recorded--invalid"
        data-cerebra-renderer="OutcomeRecorded"
      >
        <span className="cerebra-outcome-recorded__label">OutcomeRecorded</span>
        <span className="cerebra-outcome-recorded__error">invalid payload</span>
      </div>
    );
  }

  const {
    session_id,
    cycle_id,
    step_id,
    actual_composite_score,
    prediction_error,
    error_classification,
    per_signal_error,
    recorded_at,
  } = payload;

  const pct = Math.round(actual_composite_score * 100);
  const ts = new Date(recorded_at).toLocaleTimeString();
  const isSevere = error_classification === "severe";
  const isNotable = error_classification === "notable";
  const errorSign = prediction_error >= 0 ? "above" : "below";

  return (
    <div
      className={`cerebra-outcome-recorded cerebra-outcome-recorded--${error_classification}`}
      data-cerebra-renderer="OutcomeRecorded"
      data-event-id={event_id}
    >
      <div className="cerebra-outcome-recorded__header">
        <span className="cerebra-outcome-recorded__label">OUTCOME</span>
        <span className={`cerebra-outcome-recorded__classification cerebra-outcome-recorded__classification--${error_classification}`}>
          {error_classification}
        </span>
        {(isSevere || isNotable) && (
          <span className={`cerebra-outcome-recorded__delta cerebra-outcome-recorded__delta--${errorSign}`}>
            {signedPct(prediction_error)}
          </span>
        )}
      </div>

      <div className="cerebra-outcome-recorded__score-row">
        <span className="cerebra-outcome-recorded__bar">{scoreBar(actual_composite_score)}</span>
        <span className="cerebra-outcome-recorded__pct">{pct}%</span>
      </div>

      <div
        className="cerebra-outcome-recorded__signals"
        title={`cycle: ${cycle_id} · step: ${step_id}`}
      >
        {SIGNAL_ORDER.map((name) => {
          const err = per_signal_error[name] ?? 0;
          const isPos = err >= 0;
          return (
            <span key={name} className="cerebra-outcome-recorded__signal">
              <span className="cerebra-outcome-recorded__signal-name">
                {SIGNAL_ABBREV[name] ?? name.slice(0, 3)}
              </span>
              <span className={`cerebra-outcome-recorded__signal-error cerebra-outcome-recorded__signal-error--${isPos ? "pos" : "neg"}`}>
                {signedPct(err)}
              </span>
            </span>
          );
        })}
      </div>

      <div className="cerebra-outcome-recorded__meta">
        <span>{session_id.slice(0, 16)}</span>
        <span className="cerebra-outcome-recorded__sep">·</span>
        <span>{ts}</span>
      </div>
    </div>
  );
}
