// SPDX-License-Identifier: Apache-2.0
import type { DaemonHealth, DaemonStatus } from "./daemon";

export type AgentState = "RUNNING" | "IDLE" | "ERROR" | "OFFLINE" | "UNKNOWN";

export interface FossicEvent {
  event_type: string;
  stream_id: string;
  payload: unknown;
  timestamp: number; // milliseconds
}

export interface StateDerivationInput {
  recentEvents: FossicEvent[];
  daemonHealth: DaemonHealth;
  daemonStatus: DaemonStatus | null;
}

export function deriveAgentState(input: StateDerivationInput): AgentState {
  if (input.daemonHealth === "offline") return "OFFLINE";

  const hasRecentError = input.recentEvents.some(
    (e) =>
      e.event_type === "SessionFlushed" &&
      (e.payload as Record<string, unknown> | null)?.final_outcome === "error",
  );
  if (hasRecentError) return "ERROR";

  if (input.daemonStatus?.cycle_running === true) return "RUNNING";

  const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
  const hasRecentActivity = input.recentEvents.some((e) => e.timestamp > fiveMinsAgo);
  if (hasRecentActivity) return "IDLE";

  return "UNKNOWN";
}
