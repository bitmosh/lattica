import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getPayloadRenderer } from "../../control-plane/payload-renderer/payloadRendererRegistry";
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

export function CerebraSignalTile() {
  const [events, setEvents] = useState<SerializedEvent[]>([]);
  const [daemonHealth, setDaemonHealth] = useState<DaemonHealth>("offline");
  const [daemonStatus, setDaemonStatus] = useState<DaemonStatus | null>(null);
  const [posture, setPosture] = useState<"auto" | "hold">("auto");
  const subIdRef = useRef<string | null>(null);
  const controlSubIdRef = useRef<string | null>(null);

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
        invoke("fossic_unsubscribe", { subscriptionId: subIdRef.current }).catch(
          () => {},
        );
      }
      if (controlSubIdRef.current) {
        invoke("fossic_unsubscribe", {
          subscriptionId: controlSubIdRef.current,
        }).catch(() => {});
      }
    };
  }, []);

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

  async function handleCheckpoint() {
    const ok = await triggerCheckpoint();
    if (!ok) console.warn("[CerebraSignalTile] checkpoint request failed");
  }

  async function handleHoldToggle() {
    const next: "hold" | "auto" = posture === "hold" ? "auto" : "hold";
    const ok = await postureRequest(next);
    if (ok) setPosture(next);
    else console.warn("[CerebraSignalTile] setPosture request failed");
  }

  return (
    <div className="cerebra-signal-tile">
      <div className="cerebra-signal-tile__chrome">
        <span
          className={`cerebra-agent-state-pill cerebra-state-${agentState.toLowerCase()}`}
        >
          {agentState}
        </span>
        <button className="cerebra-checkpoint-btn" onClick={handleCheckpoint}>
          Checkpoint
        </button>
        <button
          className={`cerebra-hold-toggle${posture === "hold" ? " cerebra-hold-toggle--active" : ""}`}
          onClick={handleHoldToggle}
        >
          {posture === "hold" ? "HOLD" : "AUTO"}
        </button>
      </div>
      {events.length === 0 ? (
        <div className="cerebra-signal-tile__empty">
          Waiting for Cerebra signals…
        </div>
      ) : (
        events.map((event) => {
          const entry = getPayloadRenderer(event.event_type, event.stream_id);
          if (entry) {
            const Renderer = entry.component;
            return (
              <Renderer
                key={event.id}
                payload={event.payload}
                event_id={event.id}
              />
            );
          }
          return (
            <div key={event.id} className="cerebra-signal-tile__event-raw">
              <span className="cerebra-signal-tile__event-type">
                {event.event_type}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
