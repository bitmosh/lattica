// SPDX-License-Identifier: Apache-2.0
const DEFAULT_DAEMON_URL = "http://127.0.0.1:7432";

export function daemonUrl(): string {
  return (import.meta.env.VITE_CEREBRA_DAEMON_URL as string | undefined) ?? DEFAULT_DAEMON_URL;
}

export interface DaemonStatus {
  posture: "auto" | "hold";
  cycle_running: boolean;
  active_session_id: string | null;
  cycle_count: number;
  last_outcome?: string;
}

export type DaemonHealth = "online" | "offline";

export async function getStatus(): Promise<DaemonStatus | null> {
  try {
    const res = await fetch(`${daemonUrl()}/status`, {
      signal: AbortSignal.timeout(500),
    });
    if (!res.ok) return null;
    return (await res.json()) as DaemonStatus;
  } catch {
    return null;
  }
}

export async function setPosture(state: "hold" | "auto"): Promise<boolean> {
  try {
    const res = await fetch(`${daemonUrl()}/posture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function triggerCheckpoint(): Promise<boolean> {
  try {
    const res = await fetch(`${daemonUrl()}/checkpoint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
