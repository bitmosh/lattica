import "./SignalPanel.css";

const SIGNAL_ORDER: Array<[string, string]> = [
  ["COHERENCE", "COH"],
  ["GROUNDEDNESS", "GND"],
  ["GENERATIVITY", "GEN"],
  ["RELEVANCE", "REL"],
  ["PRECISION", "PRE"],
  ["EPISTEMIC_HUMILITY", "EPH"],
];

const COMPOSITE_FLOOR = 0.6;

interface Props {
  signals: Map<string, number>;
  composite: number | null;
  lastStepId: string | null;
  isPreRelay: boolean;
}

function blockBar(score: number | null, preRelay: boolean): string {
  if (preRelay || score === null) return "░".repeat(10);
  const filled = Math.round(score * 10);
  return "█".repeat(Math.max(0, filled)) + "░".repeat(Math.max(0, 10 - filled));
}

export function SignalPanel({ signals, composite, lastStepId, isPreRelay }: Props) {
  const floorPct = Math.round(COMPOSITE_FLOOR * 100);
  const compositePct = composite !== null ? Math.round(composite * 100) : null;
  const floorViolated = compositePct !== null && compositePct < floorPct;

  return (
    <div className={`la-signal-panel${isPreRelay ? " la-signal-panel--pre-relay" : ""}`}>
      <div className="la-signal-panel__header">
        <span className="la-signal-panel__title">SIGNALS</span>
        <span className="la-signal-panel__sub">
          {isPreRelay
            ? "pre-relay"
            : lastStepId
            ? lastStepId
            : "no eval yet"}
        </span>
      </div>

      {SIGNAL_ORDER.map(([full, abbr]) => {
        const v = signals.get(full);
        const pct = v !== undefined ? Math.round(v * 100) : null;
        return (
          <div key={abbr} className="la-signal-panel__row">
            <span className="la-signal-panel__name">{full}</span>
            <span className="la-signal-panel__bar">
              {blockBar(v ?? null, isPreRelay)}
            </span>
            <span className="la-signal-panel__pct">
              {pct !== null ? `${pct}%` : "--"}
            </span>
          </div>
        );
      })}

      <div className="la-signal-panel__composite-row">
        <span
          className={`la-signal-panel__composite-label${
            floorViolated ? " la-signal-panel__composite-label--violated" : ""
          }`}
        >
          COMPOSITE
        </span>
        <div className="la-signal-panel__composite-track">
          {!isPreRelay && compositePct !== null && (
            <div
              className={`la-signal-panel__composite-fill${
                floorViolated ? " la-signal-panel__composite-fill--violated" : ""
              }`}
              style={{ width: `${compositePct}%` }}
            />
          )}
          <div
            className="la-signal-panel__floor-marker"
            style={{ left: `${floorPct}%` }}
            title={`floor: ${floorPct}%`}
          />
        </div>
        <span
          className={`la-signal-panel__composite-pct${
            floorViolated ? " la-signal-panel__composite-pct--violated" : ""
          }`}
        >
          {isPreRelay ? "--" : compositePct !== null ? `${compositePct}%` : "--"}
        </span>
      </div>
    </div>
  );
}
