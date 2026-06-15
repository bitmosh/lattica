/**
 * SignalEvaluated payload renderer — authored by Cerebra Claude (guest author).
 * Committed by Lattica Claude Code per UP-001 guest-author-in-host-repo pattern.
 *
 * Payload shape (cerebra/cognition/evaluation.py):
 *   session_id, cycle_id, step_id: string identifiers
 *   signal_name: "COHERENCE" | "GROUNDEDNESS" | "GENERATIVITY" |
 *                "RELEVANCE" | "PRECISION" | "EPISTEMIC_HUMILITY"
 *   signal_score: float 0.0–1.0
 *   signal_strength: float 0.0–1.0 (confidence in the score)
 *   evaluated_at: millisecond timestamp
 *   low_confidence: boolean
 *   evaluator_prompt_version: string
 *   checklist_details: unknown (structured checklist data from LLM)
 */

import type { PayloadRendererProps } from "../../control-plane/payload-renderer/payloadRendererRegistry";
import "./SignalEvaluatedRenderer.css";

interface SignalEvaluatedPayload {
  session_id: string;
  cycle_id: string;
  step_id: string;
  signal_name: string;
  signal_score: number;
  signal_strength: number;
  evaluated_at: number;
  low_confidence: boolean;
  evaluator_prompt_version: string;
  checklist_details: unknown;
}

function isSignalEvaluatedPayload(v: unknown): v is SignalEvaluatedPayload {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.signal_name === "string" &&
    typeof p.signal_score === "number" &&
    typeof p.session_id === "string"
  );
}

function scoreBar(score: number): string {
  const filled = Math.round(score * 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

export function SignalEvaluatedRenderer({ payload, event_id }: PayloadRendererProps) {
  if (!isSignalEvaluatedPayload(payload)) {
    return (
      <div
        className="cerebra-signal-evaluated cerebra-signal-evaluated--invalid"
        data-cerebra-renderer="SignalEvaluated"
      >
        <span className="cerebra-signal-evaluated__label">SignalEvaluated</span>
        <span className="cerebra-signal-evaluated__error">invalid payload</span>
      </div>
    );
  }

  const {
    signal_name,
    signal_score,
    signal_strength,
    session_id,
    cycle_id,
    step_id,
    low_confidence,
    evaluated_at,
  } = payload;

  const pct = Math.round(signal_score * 100);
  const strengthPct = Math.round(signal_strength * 100);
  const ts = new Date(evaluated_at).toLocaleTimeString();

  return (
    <div
      className={`cerebra-signal-evaluated${low_confidence ? " cerebra-signal-evaluated--low-confidence" : ""}`}
      data-cerebra-renderer="SignalEvaluated"
      data-event-id={event_id}
    >
      <div className="cerebra-signal-evaluated__header">
        <span className="cerebra-signal-evaluated__signal-name">{signal_name}</span>
        {low_confidence && (
          <span className="cerebra-signal-evaluated__badge cerebra-signal-evaluated__badge--warn">
            low confidence
          </span>
        )}
      </div>

      <div className="cerebra-signal-evaluated__score-row">
        <span className="cerebra-signal-evaluated__bar">{scoreBar(signal_score)}</span>
        <span className="cerebra-signal-evaluated__pct">{pct}%</span>
      </div>

      <div className="cerebra-signal-evaluated__meta">
        <span>strength {strengthPct}%</span>
        <span className="cerebra-signal-evaluated__sep">·</span>
        <span title={`cycle: ${cycle_id} · step: ${step_id}`}>
          {session_id.slice(0, 16)}
        </span>
        <span className="cerebra-signal-evaluated__sep">·</span>
        <span>{ts}</span>
      </div>
    </div>
  );
}
