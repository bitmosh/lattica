/**
 * PredictionMade payload renderer — authored by Cerebra Claude (guest author).
 * Committed by Lattica Claude Code per P-013 guest-author-in-host-repo pattern.
 *
 * Payload shape (cerebra/cognition/predictions.py · emit_prediction_made):
 *   session_id, cycle_id, step_id: string identifiers
 *   expected_composite_score: float 0.0–1.0
 *   expected_per_signal: { [signal_name]: score } for all six signals
 *   prediction_basis: "prior_step_trajectory" | "cycle_config_default" | "static_baseline"
 *   confidence: float 0.0–1.0
 *   made_at: millisecond timestamp
 */

import type { PayloadRendererProps } from "../../control-plane/payload-renderer/payloadRendererRegistry";
import "./PredictionMadeRenderer.css";

interface PredictionMadePayload {
  session_id: string;
  cycle_id: string;
  step_id: string;
  expected_composite_score: number;
  expected_per_signal: Record<string, number>;
  prediction_basis: string;
  confidence: number;
  made_at: number;
}

function isPredictionMadePayload(v: unknown): v is PredictionMadePayload {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.session_id === "string" &&
    typeof p.expected_composite_score === "number" &&
    typeof p.prediction_basis === "string"
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

const BASIS_LABEL: Partial<Record<string, string>> = {
  prior_step_trajectory: "trajectory",
  cycle_config_default: "config",
  static_baseline: "baseline",
};

function scoreBar(score: number): string {
  const filled = Math.round(score * 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

export function PredictionMadeRenderer({ payload, event_id }: PayloadRendererProps) {
  if (!isPredictionMadePayload(payload)) {
    return (
      <div
        className="cerebra-prediction-made cerebra-prediction-made--invalid"
        data-cerebra-renderer="PredictionMade"
      >
        <span className="cerebra-prediction-made__label">PredictionMade</span>
        <span className="cerebra-prediction-made__error">invalid payload</span>
      </div>
    );
  }

  const {
    session_id,
    cycle_id,
    step_id,
    expected_composite_score,
    expected_per_signal,
    prediction_basis,
    confidence,
    made_at,
  } = payload;

  const pct = Math.round(expected_composite_score * 100);
  const confidencePct = Math.round(confidence * 100);
  const ts = new Date(made_at).toLocaleTimeString();
  const basisLabel = BASIS_LABEL[prediction_basis] ?? prediction_basis;
  const isBaseline = prediction_basis === "static_baseline";

  return (
    <div
      className={`cerebra-prediction-made${isBaseline ? " cerebra-prediction-made--baseline" : ""}`}
      data-cerebra-renderer="PredictionMade"
      data-event-id={event_id}
    >
      <div className="cerebra-prediction-made__header">
        <span className="cerebra-prediction-made__label">PREDICTION</span>
        <span className={`cerebra-prediction-made__basis cerebra-prediction-made__basis--${basisLabel}`}>
          {basisLabel}
        </span>
      </div>

      <div className="cerebra-prediction-made__score-row">
        <span className="cerebra-prediction-made__bar">{scoreBar(expected_composite_score)}</span>
        <span className="cerebra-prediction-made__pct">{pct}%</span>
      </div>

      <div
        className="cerebra-prediction-made__signals"
        title={`cycle: ${cycle_id} · step: ${step_id}`}
      >
        {SIGNAL_ORDER.map((name) => (
          <span key={name} className="cerebra-prediction-made__signal">
            <span className="cerebra-prediction-made__signal-name">
              {SIGNAL_ABBREV[name] ?? name.slice(0, 3)}
            </span>
            <span className="cerebra-prediction-made__signal-score">
              {Math.round(expected_per_signal[name] * 100)}%
            </span>
          </span>
        ))}
      </div>

      <div className="cerebra-prediction-made__meta">
        <span>conf {confidencePct}%</span>
        <span className="cerebra-prediction-made__sep">·</span>
        <span>{session_id.slice(0, 16)}</span>
        <span className="cerebra-prediction-made__sep">·</span>
        <span>{ts}</span>
      </div>
    </div>
  );
}
