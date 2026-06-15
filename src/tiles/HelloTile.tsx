import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { tileSectionRegistry } from "../control-plane/tile-section/tileSectionRegistry";
import type { TileSectionEntry } from "../control-plane/tile-section/types";
import { sendToEmbedded } from "../ipc/postMessageBridge";
import { getAllPayloadRenderers } from "../control-plane/payload-renderer/payloadRendererRegistry";
import pkg from "../../package.json";
import "./HelloTile.css";

interface StoreStatus {
  ok: boolean;
  stream_count: number;
}

interface FossicEventPayload {
  subscription_id: string;
  event: unknown;
}

export function HelloTile() {
  const [storeStatus, setStoreStatus] = useState<StoreStatus | null>(null);
  const [canaryCount, setCanaryCount] = useState(0);
  const [tileEntries, setTileEntries] = useState<TileSectionEntry[]>(() => tileSectionRegistry.list());
  const [rendererCount] = useState(() => getAllPayloadRenderers().length);
  const [postMessageLog, setPostMessageLog] = useState<string[]>([]);

  useEffect(() => {
    invoke<StoreStatus>("lattica_store_status")
      .then(setStoreStatus)
      .catch((e: unknown) => console.error("[HelloTile] store status:", e));
  }, []);

  useEffect(() => {
    let subId: string | null = null;
    let unlisten: (() => void) | null = null;

    async function setup() {
      subId = await invoke<string>("fossic_subscribe", {
        streamPattern: "lattica/canary",
        branch: null,
        includeSystem: false,
        queueSize: null,
      });

      unlisten = await listen<FossicEventPayload>("fossic:event", (e) => {
        if (e.payload.subscription_id === subId) {
          setCanaryCount((n) => n + 1);
        }
      });
    }

    setup().catch((e: unknown) => console.error("[HelloTile] fossic subscribe:", e));

    return () => {
      unlisten?.();
      if (subId) {
        invoke("fossic_unsubscribe", { subscriptionId: subId }).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    return tileSectionRegistry.subscribe?.((updated) => {
      setTileEntries(updated);
    });
  }, []);

  function handlePostMessageDemo() {
    sendToEmbedded(null, "demo.ping", { from: "HelloTile", ts: Date.now() });
    setPostMessageLog((prev) => [
      ...prev,
      `demo.ping sent (no target — Mode B not yet live)`,
    ]);
  }

  return (
    <div className="hello-tile">
      <h1 className="hello-tile__title">Lattica <span className="hello-tile__version">v{pkg.version}</span></h1>
      <p className="hello-tile__subtitle">Tauri + Vite + React + fossic</p>

      <div className="hello-tile__grid">
        <section className="hello-tile__card">
          <h2>fossic store</h2>
          {storeStatus === null ? (
            <p className="hello-tile__status">checking…</p>
          ) : (
            <p className={`hello-tile__status hello-tile__status--${storeStatus.ok ? "ok" : "err"}`}>
              {storeStatus.ok
                ? `online · ${storeStatus.stream_count} stream(s)`
                : "error — store unreachable"}
            </p>
          )}
        </section>

        <section className="hello-tile__card">
          <h2>canary stream</h2>
          <p className="hello-tile__status">
            <code>lattica/canary</code> · {canaryCount} event(s) received
          </p>
        </section>

        <section className="hello-tile__card">
          <h2>tile registry</h2>
          <p className="hello-tile__status">
            {tileEntries.length} tile(s) · {rendererCount} payload renderer(s)
          </p>
        </section>

        <section className="hello-tile__card">
          <h2>postMessage (ADR-010)</h2>
          <button className="hello-tile__btn" onClick={handlePostMessageDemo}>
            send demo.ping
          </button>
          {postMessageLog.length > 0 && (
            <ul className="hello-tile__log">
              {postMessageLog.map((entry, i) => (
                <li key={i}>{entry}</li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {tileEntries.filter((e) => e.content).map((entry) => (
        <section key={entry.id} className="hello-tile__registered-card">
          <h2>{entry.label}</h2>
          {entry.content!()}
        </section>
      ))}
    </div>
  );
}
