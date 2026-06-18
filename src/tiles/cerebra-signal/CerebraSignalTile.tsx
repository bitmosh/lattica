import { useEffect, useRef, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { LiveValueChip, type LvStateKind } from "../../components/livevalue/LiveValueChip";
import { SignalPanel } from "./SignalPanel";
import {
  getStatus,
  setPosture as postureRequest,
  triggerCheckpoint,
  type DaemonHealth,
  type DaemonStatus,
} from "./daemon";
import { deriveAgentState, type FossicEvent } from "./state";
import "./CerebraSignalTile.css";

interface SerializedEvent {
  id: string;
  stream_id: string;
  branch: string;
  version: number;
  timestamp_us: number;
  causation_id: string | null;
  correlation_id: string | null;
  event_type: string;
  type_version: number;
  payload: unknown;
  external_id: string | null;
  indexed_tags: unknown;
}

interface FossicEventPayload {
  subscription_id: string;
  event: SerializedEvent;
}

// ─── cycle color helpers ────────────────────────────────────────────────────

const CYCLE_COLORS = ["#22E0C4", "#A6F35A", "#4CC9FF", "#B46CFF", "#FF5BC7"];

function cycleColorFor(cycleId: string): string {
  let h = 0;
  for (let i = 0; i < cycleId.length; i++) h = ((h * 31) + cycleId.charCodeAt(i)) >>> 0;
  return CYCLE_COLORS[h % CYCLE_COLORS.length];
}

// ─── payload field extractors ────────────────────────────────────────────────

function asStr(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object") return null;
  const v = (payload as Record<string, unknown>)[key];
  return typeof v === "string" ? v : null;
}

function asNum(payload: unknown, key: string): number | null {
  if (!payload || typeof payload !== "object") return null;
  const v = (payload as Record<string, unknown>)[key];
  return typeof v === "number" ? v : null;
}

function getCycleId(payload: unknown): string | null {
  return asStr(payload, "cycle_id");
}

function getStepId(payload: unknown): string | null {
  return asStr(payload, "step_id");
}

// ─── derived state helpers ────────────────────────────────────────────────────

interface SessionInfo {
  sessionId: string | null;
  cycleConfig: string | null;
  goal: string | null;
}

function extractSessionInfo(
  events: SerializedEvent[],
  daemonStatus: DaemonStatus | null,
): SessionInfo {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.event_type === "SessionOpened") {
      return {
        sessionId: asStr(e.payload, "session_id") ?? daemonStatus?.active_session_id ?? null,
        cycleConfig: asStr(e.payload, "cycle_config"),
        goal: asStr(e.payload, "goal"),
      };
    }
  }
  return {
    sessionId: daemonStatus?.active_session_id ?? null,
    cycleConfig: null,
    goal: null,
  };
}

function extractLatestSignals(events: SerializedEvent[]): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.event_type !== "SignalEvaluated") continue;
    const name = asStr(e.payload, "signal_name");
    const score = asNum(e.payload, "signal_score");
    if (name && score !== null && !m.has(name)) m.set(name, score);
    if (m.size === 6) break;
  }
  return m;
}

function extractLastSignalStepId(events: SerializedEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].event_type === "SignalEvaluated") return getStepId(events[i].payload);
  }
  return null;
}

function extractCompositeScore(events: SerializedEvent[]): number | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.event_type === "OutcomeRecorded") {
      const s = asNum(e.payload, "actual_composite_score");
      if (s !== null) return s;
    }
  }
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.event_type === "PredictionMade") {
      const s = asNum(e.payload, "expected_composite_score");
      if (s !== null) return s;
    }
  }
  return null;
}

interface ClutchInfo {
  action: string;
  ruleMatched: string | null;
  escalated: boolean;
}

function extractLastClutch(events: SerializedEvent[]): ClutchInfo | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.event_type === "ClutchDecisionMade") {
      const action = asStr(e.payload, "action");
      if (!action) continue;
      return {
        action,
        ruleMatched: asStr(e.payload, "rule_matched"),
        escalated:
          (e.payload as Record<string, unknown>)["escalate_to_catalyst"] === true,
      };
    }
  }
  return null;
}

// ─── cycle groups ─────────────────────────────────────────────────────────────

interface CycleGroup {
  cycleId: string;
  color: string;
  items: SerializedEvent[];
}

const FEED_EVENT_TYPES = new Set([
  "StepStarted",
  "PredictionMade",
  "SignalEvaluated",
  "OutcomeRecorded",
  "ClutchDecisionMade",
]);

function buildCycleGroups(events: SerializedEvent[]): CycleGroup[] {
  const feedEvents = events.filter(
    (e) =>
      e.stream_id.startsWith("cerebra/agent-trace/") &&
      FEED_EVENT_TYPES.has(e.event_type),
  );
  const sorted = [...feedEvents].reverse(); // newest first
  const groupMap = new Map<string, CycleGroup>();
  const order: string[] = [];
  for (const e of sorted) {
    const cid = getCycleId(e.payload) ?? "__none__";
    if (!groupMap.has(cid)) {
      groupMap.set(cid, { cycleId: cid, color: cycleColorFor(cid), items: [] });
      order.push(cid);
    }
    groupMap.get(cid)!.items.push(e);
  }
  return order.map((id) => groupMap.get(id)!);
}

// ─── footer sparkline ─────────────────────────────────────────────────────────

const EVENT_BAR_HEIGHT: Partial<Record<string, number>> = {
  OutcomeRecorded: 80,
  ClutchDecisionMade: 70,
  PredictionMade: 60,
  SignalEvaluated: 40,
  StepStarted: 25,
};

interface SparkEntry {
  height: number;
  color: string;
}

function buildSparkline(events: SerializedEvent[]): SparkEntry[] {
  const feedEvents = events
    .filter(
      (e) =>
        e.stream_id.startsWith("cerebra/agent-trace/") &&
        FEED_EVENT_TYPES.has(e.event_type),
    )
    .slice(-24);
  return feedEvents.map((e) => ({
    height: EVENT_BAR_HEIGHT[e.event_type] ?? 20,
    color: cycleColorFor(getCycleId(e.payload) ?? "__none__"),
  }));
}

// ─── inline card renderers ────────────────────────────────────────────────────

const SIGNAL_ABBREV: Record<string, string> = {
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

function blockBar10(score: number): string {
  const f = Math.round(score * 10);
  return "█".repeat(Math.max(0, f)) + "░".repeat(Math.max(0, 10 - f));
}

function ageLabel(tsUs: number): string {
  const diffS = Math.floor((Date.now() - tsUs / 1000) / 1000);
  if (diffS < 60) return `${diffS}s`;
  if (diffS < 3600) return `${Math.floor(diffS / 60)}m`;
  return `${Math.floor(diffS / 3600)}h`;
}

function StepStartedCard({ e }: { e: SerializedEvent }) {
  const stepId = getStepId(e.payload) ?? "?";
  return (
    <div className="cst-card cst-card--step">
      <span className="cst-card__dot cst-card__dot--muted" />
      <span className="cst-card__step-label">StepStarted · {stepId}</span>
      <span className="cst-card__age">{ageLabel(e.timestamp_us)}</span>
    </div>
  );
}

function PredictionMadeCard({ e }: { e: SerializedEvent }) {
  const p = e.payload as Record<string, unknown>;
  const composite = asNum(e.payload, "expected_composite_score") ?? 0;
  const perSignal =
    typeof p.expected_per_signal === "object" && p.expected_per_signal !== null
      ? (p.expected_per_signal as Record<string, number>)
      : {};
  const basis = asStr(e.payload, "prediction_basis") ?? "";
  const basisShort =
    basis === "prior_step_trajectory"
      ? "trajectory"
      : basis === "cycle_config_default"
      ? "config"
      : "baseline";
  const pct = Math.round(composite * 100);

  return (
    <div className="cst-card cst-card--prediction">
      <div className="cst-card__prediction-header">
        <span className="cst-card__prediction-label">PREDICTION</span>
        <span className="cst-card__basis-tag">{basisShort}</span>
        <span className="cst-card__causes">causes → policy</span>
      </div>
      <div className="cst-card__bar-row">
        <span className="cst-card__block-bar">{blockBar10(composite)}</span>
        <span className="cst-card__pct">{pct}%</span>
      </div>
      <div className="cst-card__signal-grid">
        {SIGNAL_ORDER.map((n) => (
          <span key={n} className="cst-card__signal-chip">
            <span className="cst-card__signal-abbr">
              {SIGNAL_ABBREV[n] ?? n.slice(0, 3)}
            </span>
            <span className="cst-card__signal-score">
              {perSignal[n] !== undefined
                ? `${Math.round(perSignal[n] * 100)}%`
                : "--"}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function SignalEvaluatedCard({ e }: { e: SerializedEvent }) {
  const name = asStr(e.payload, "signal_name") ?? "?";
  const score = asNum(e.payload, "signal_score") ?? 0;
  const abbr = SIGNAL_ABBREV[name] ?? name.slice(0, 3);
  const pct = Math.round(score * 100);
  const lowConf =
    (e.payload as Record<string, unknown>)["low_confidence"] === true;

  return (
    <div className="cst-card cst-card--signal">
      <span className="cst-card__signal-evaluated-label">SIGNAL EVAL</span>
      <span className="cst-card__signal-name">{abbr}</span>
      <span className="cst-card__block-bar cst-card__block-bar--signal">
        {blockBar10(score)}
      </span>
      <span className="cst-card__pct">{pct}%</span>
      {lowConf && <span className="cst-card__low-conf">low-conf</span>}
    </div>
  );
}

function OutcomeRecordedCard({ e }: { e: SerializedEvent }) {
  const composite = asNum(e.payload, "actual_composite_score") ?? 0;
  const errClass = asStr(e.payload, "error_classification") ?? "noise";
  const predErr = asNum(e.payload, "prediction_error");
  const pct = Math.round(composite * 100);
  const errSign = predErr !== null ? (predErr >= 0 ? "+" : "") : "";

  return (
    <div
      className={`cst-card cst-card--outcome cst-card--outcome-${errClass}`}
    >
      <div className="cst-card__outcome-header">
        <span className="cst-card__outcome-label">OUTCOME</span>
        <span className={`cst-card__err-class cst-card__err-class--${errClass}`}>
          {errClass}
        </span>
        {predErr !== null && (
          <span className="cst-card__pred-delta">
            {errSign}
            {Math.round(predErr * 100)}%Δ
          </span>
        )}
      </div>
      <div className="cst-card__bar-row">
        <span className="cst-card__block-bar">{blockBar10(composite)}</span>
        <span className="cst-card__pct">{pct}%</span>
      </div>
    </div>
  );
}

function renderCard(e: SerializedEvent): ReactNode {
  switch (e.event_type) {
    case "StepStarted":
      return <StepStartedCard key={e.id} e={e} />;
    case "PredictionMade":
      return <PredictionMadeCard key={e.id} e={e} />;
    case "SignalEvaluated":
      return <SignalEvaluatedCard key={e.id} e={e} />;
    case "OutcomeRecorded":
      return <OutcomeRecordedCard key={e.id} e={e} />;
    default:
      return null;
  }
}

// ─── main component ───────────────────────────────────────────────────────────

export function CerebraSignalTile() {
  const [events, setEvents] = useState<SerializedEvent[]>([]);
  const [daemonHealth, setDaemonHealth] = useState<DaemonHealth>("offline");
  const [daemonStatus, setDaemonStatus] = useState<DaemonStatus | null>(null);
  const [posture, setPosture] = useState<"auto" | "hold">("auto");
  const [checkpointFlash, setCheckpointFlash] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const subIdRef = useRef<string | null>(null);
  const controlSubIdRef = useRef<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // 30s daemon health poll; immediate on mount
  useEffect(() => {
    let mounted = true;
    async function poll() {
      const status = await getStatus();
      if (!mounted) return;
      if (status !== null) {
        setDaemonHealth("online");
        setDaemonStatus(status);
        setPosture(status.posture);
      } else {
        setDaemonHealth("offline");
        setDaemonStatus(null);
      }
    }
    poll();
    const interval = setInterval(poll, 30_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Subscribe to cerebra/agent-trace/* and cerebra/control (explicit — not covered by wildcard)
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    async function setup() {
      const subId = await invoke<string>("fossic_subscribe", {
        streamPattern: "cerebra/agent-trace/*",
        branch: null,
        includeSystem: false,
        queueSize: null,
      });
      subIdRef.current = subId;

      const controlSubId = await invoke<string>("fossic_subscribe", {
        streamPattern: "cerebra/control",
        branch: null,
        includeSystem: false,
        queueSize: null,
      });
      controlSubIdRef.current = controlSubId;

      unlisten = await listen<FossicEventPayload>("fossic:event", (e) => {
        if (
          e.payload.subscription_id === subId ||
          e.payload.subscription_id === controlSubId
        ) {
          setEvents((prev) => [...prev, e.payload.event]);
        }
      });
    }

    setup().catch((e: unknown) =>
      console.error("[CerebraSignalTile] fossic subscribe:", e),
    );

    return () => {
      unlisten?.();
      if (subIdRef.current) {
        invoke("fossic_unsubscribe", {
          subscriptionId: subIdRef.current,
        }).catch(() => {});
      }
      if (controlSubIdRef.current) {
        invoke("fossic_unsubscribe", {
          subscriptionId: controlSubIdRef.current,
        }).catch(() => {});
      }
    };
  }, []);

  // ─── derived state ──────────────────────────────────────────────────────────

  const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
  const recentFossicEvents: FossicEvent[] = events
    .filter((e) => e.timestamp_us / 1000 > fiveMinsAgo)
    .map((e) => ({
      event_type: e.event_type,
      stream_id: e.stream_id,
      payload: e.payload,
      timestamp: e.timestamp_us / 1000,
    }));

  const agentState = deriveAgentState({
    recentEvents: recentFossicEvents,
    daemonHealth,
    daemonStatus,
  });

  const sessionInfo = extractSessionInfo(events, daemonStatus);
  const latestSignals = extractLatestSignals(events);
  const lastSignalStepId = extractLastSignalStepId(events);
  const compositeScore = extractCompositeScore(events);
  const lastClutch = extractLastClutch(events);
  const cycleGroups = buildCycleGroups(events);
  const sparkline = buildSparkline(events);

  const isPreRelay = !events.some((e) =>
    e.stream_id.startsWith("cerebra/agent-trace/"),
  );

  const daemonLvState: LvStateKind =
    daemonHealth === "online" ? "live" : "source-unreachable";
  const traceLvState: LvStateKind = isPreRelay ? "pre-relay" : "live";
  const graphLvState: LvStateKind = events.some((e) =>
    e.stream_id.startsWith("cerebra/graph/"),
  )
    ? "live"
    : "no-data-yet";

  // ─── handlers ───────────────────────────────────────────────────────────────

  async function handleCheckpoint() {
    const ok = await triggerCheckpoint();
    if (!ok) console.warn("[CerebraSignalTile] checkpoint request failed");
    setCheckpointFlash(true);
    setTimeout(() => setCheckpointFlash(false), 400);
  }

  async function handleHoldToggle() {
    const next: "hold" | "auto" = posture === "hold" ? "auto" : "hold";
    const ok = await postureRequest(next);
    if (ok) setPosture(next);
    else console.warn("[CerebraSignalTile] setPosture request failed");
  }

  function handleBodyScroll() {
    setAtTop((bodyRef.current?.scrollTop ?? 0) < 4);
  }

  const cycleCount = daemonStatus?.cycle_count ?? 0;
  const sessionLabel = sessionInfo.sessionId
    ? `${sessionInfo.sessionId.slice(0, 8)}…`
    : "no session";
  const goalPreview = sessionInfo.goal
    ? sessionInfo.goal.length > 40
      ? `${sessionInfo.goal.slice(0, 37)}…`
      : sessionInfo.goal
    : null;

  return (
    <div className="cst-root" data-testid="cerebra-signal-tile">

      {/* ─── Control band ──────────────────────────────────────────────────── */}
      <div className="cst-control-band">

        {/* Row 1: state pill + posture + checkpoint + LV chips */}
        <div className="cst-control-band__row1">
          <span
            className={`cst-state-pill cst-state-pill--${agentState.toLowerCase()}`}
          >
            {agentState === "RUNNING" && (
              <span className="cst-state-pill__dot" />
            )}
            {agentState}
          </span>

          <button
            className={`cst-posture-toggle${posture === "hold" ? " cst-posture-toggle--hold" : ""}`}
            onClick={handleHoldToggle}
            title={posture === "hold" ? "switch to auto" : "switch to hold"}
          >
            {posture === "hold" ? "HOLD" : "AUTO"}
          </button>

          <button
            className={`cst-checkpoint-btn${checkpointFlash ? " cst-checkpoint-btn--flash" : ""}`}
            onClick={handleCheckpoint}
            title="trigger checkpoint"
          >
            ▸ checkpoint
          </button>

          <div className="cst-lv-chips">
            <LiveValueChip state={daemonLvState} label="daemon" />
            <LiveValueChip state={traceLvState} label="agent-trace" />
            <LiveValueChip state={graphLvState} label="graph" />
          </div>
        </div>

        {/* Row 2: session meta */}
        <div className="cst-control-band__row2">
          <span className="cst-session-id">{sessionLabel}</span>
          {sessionInfo.cycleConfig && (
            <>
              <span className="cst-meta-sep">·</span>
              <span className="cst-cycle-config">{sessionInfo.cycleConfig}</span>
            </>
          )}
          {goalPreview && (
            <>
              <span className="cst-meta-sep">·</span>
              <span
                className="cst-goal-preview"
                title={sessionInfo.goal ?? undefined}
              >
                {goalPreview}
              </span>
            </>
          )}
          <span className="cst-meta-sep">·</span>
          <span className="cst-cycle-count">cyc {cycleCount}</span>
        </div>

        {/* Signal panel */}
        <SignalPanel
          signals={latestSignals}
          composite={compositeScore}
          lastStepId={lastSignalStepId}
          isPreRelay={isPreRelay}
        />

        {/* Clutch strip */}
        <div className={`cst-clutch-strip${!lastClutch ? " cst-clutch-strip--empty" : ""}`}>
          <span className="cst-clutch-label">Clutch</span>
          {lastClutch ? (
            <>
              <span
                className={`cst-clutch-action cst-clutch-action--${lastClutch.action}`}
              >
                {lastClutch.action.toUpperCase()}
              </span>
              {lastClutch.ruleMatched &&
                lastClutch.ruleMatched !== "default_no_match" && (
                  <span
                    className="cst-clutch-rule"
                    title={lastClutch.ruleMatched}
                  >
                    rule:{" "}
                    {lastClutch.ruleMatched.length > 20
                      ? `${lastClutch.ruleMatched.slice(0, 18)}…`
                      : lastClutch.ruleMatched}
                  </span>
                )}
              {lastClutch.escalated && (
                <span className="cst-clutch-catalyst">→ catalyst</span>
              )}
            </>
          ) : (
            <span className="cst-clutch-awaiting">awaiting decision</span>
          )}
        </div>
      </div>

      {/* ─── Scrollable event feed ──────────────────────────────────────────── */}
      <div className="cst-body-wrapper">
        <div
          className="cst-body"
          ref={bodyRef}
          onScroll={handleBodyScroll}
        >
          {cycleGroups.length === 0 ? (
            <div className="cst-body__empty">
              {isPreRelay
                ? "pre-relay — awaiting Cerebra stream"
                : "no events"}
            </div>
          ) : (
            cycleGroups.map((group) => (
              <div key={group.cycleId} className="cst-cycle-group">
                <div
                  className="cst-cycle-stripe"
                  style={{ background: group.color }}
                />
                <div className="cst-cycle-events">
                  {group.items.map((e) => renderCard(e))}
                </div>
              </div>
            ))
          )}
        </div>

        {atTop && cycleGroups.length > 0 && (
          <div className="cst-scroll-affordance" aria-hidden="true">
            <span className="cst-scroll-affordance__label">
              SCROLL FOR OLDER ↓
            </span>
          </div>
        )}
      </div>

      {/* ─── Footer sparkline ───────────────────────────────────────────────── */}
      <div className="cst-footer">
        <div className="cst-sparkline">
          {sparkline.map((bar, i) => (
            <div
              key={i}
              className="cst-sparkline__bar"
              style={{
                height: `${bar.height}%`,
                background: bar.color,
                opacity: 0.5 + (i / Math.max(sparkline.length - 1, 1)) * 0.5,
              }}
            />
          ))}
          {sparkline.length < 24 &&
            Array.from({ length: 24 - sparkline.length }, (_, i) => (
              <div
                key={`empty-${i}`}
                className="cst-sparkline__bar cst-sparkline__bar--empty"
              />
            ))}
        </div>
        <div className="cst-footer__meta">
          <span className="cst-footer__count">← {events.length}</span>
          <span className="cst-footer__now">now</span>
        </div>
      </div>
    </div>
  );
}
