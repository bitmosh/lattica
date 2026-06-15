import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getPayloadRenderer } from "../../control-plane/payload-renderer/payloadRendererRegistry";
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
  const subIdRef = useRef<string | null>(null);

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

      unlisten = await listen<FossicEventPayload>("fossic:event", (e) => {
        if (e.payload.subscription_id === subId) {
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
    };
  }, []);

  return (
    <div className="cerebra-signal-tile">
      <div className="cerebra-signal-tile__header">
        <span className="cerebra-signal-tile__title">Cerebra Signal Feed</span>
        <span className="cerebra-signal-tile__count">{events.length}</span>
      </div>
      <div className="cerebra-signal-tile__events">
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
    </div>
  );
}
