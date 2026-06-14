/**
 * postMessage IPC bridge — ADR-010, Class 1 (ephemeral UI commands).
 *
 * Sends structured commands to an embedded LumaWeave (or other Mode B) webview.
 * Origin check on the receiving side is the embedded webview's responsibility.
 * All messages use the "lattica.command" type envelope.
 *
 * v0.2.0: stub — no Mode B webview exists yet (Linux positioning bug, deferred to v0.3+).
 */

export interface LatticeCommand {
  type: "lattica.command";
  action: string;
  payload: unknown;
  requestId?: string;
}

/**
 * Send a UI command to an embedded webview.
 *
 * At v0.2.0 this is a no-op stub when target is null — Mode B does not yet exist.
 * Replace target with the actual WebviewWindow reference when Mode B integration lands.
 */
export function sendToEmbedded(
  target: Window | null,
  action: string,
  payload: unknown,
  requestId?: string,
): void {
  const msg: LatticeCommand = {
    type: "lattica.command",
    action,
    payload,
    requestId,
  };
  if (target) {
    target.postMessage(msg, "*");
  }
}

/**
 * Register a listener for postMessage commands arriving from an embedded webview.
 * Returns an unsubscribe function.
 */
export function onMessageFromEmbedded(
  handler: (msg: LatticeCommand) => void,
): () => void {
  const listener = (event: MessageEvent) => {
    const data = event.data as unknown;
    if (
      typeof data === "object" &&
      data !== null &&
      (data as Record<string, unknown>)["type"] === "lattica.command"
    ) {
      handler(data as LatticeCommand);
    }
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
