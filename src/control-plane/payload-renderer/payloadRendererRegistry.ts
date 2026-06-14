/**
 * Payload Renderer Registry
 *
 * T2 registry (register + subscribe) for type-aware fossic event payload
 * renderers. LumaWeave is the composition host (ADR-009); this registry
 * lives here permanently. External project tile initialization code
 * calls registerPayloadRenderer() to contribute renderers for their
 * event types — no Lattica core or LumaWeave core modification needed.
 *
 * Entry shape confirmed in Lattica round-1 / round-2 coordination.
 */

import type { ComponentType } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PayloadRendererProps {
  /** The raw fossic event payload (opaque — renderer knows its own schema). */
  payload: unknown;
  /** The fossic event ID (blake3 content-addressed). */
  event_id: string;
}

export interface PayloadRendererEntry {
  /** Lattica project identifier — e.g. "cerebra", "policy-scout", "bo". */
  project: string;
  /**
   * Fossic event_type string this renderer handles — e.g. "SignalEvaluated".
   * Matched against incoming fossic events. Case-sensitive.
   */
  event_type: string;
  /** React component that renders the payload. */
  component: ComponentType<PayloadRendererProps>;
  /** Human-readable label for registry browsers / dev tools. */
  label?: string;
  /**
   * Optional glob pattern for the fossic stream this renderer applies to.
   * Narrows matching when the same event_type appears in multiple streams.
   * Examples: "cerebra/agent-trace/*", "policy-scout/audit/*".
   * Absent = matches any stream.
   */
  stream_glob?: string;
}

// ---------------------------------------------------------------------------
// Registry internals
// ---------------------------------------------------------------------------

const entries: PayloadRendererEntry[] = [];
const listeners: Array<() => void> = [];

// ---------------------------------------------------------------------------
// Registration API
// ---------------------------------------------------------------------------

export function registerPayloadRenderer(entry: PayloadRendererEntry): void {
  entries.push(entry);
  listeners.forEach((l) => l());
}

export function subscribePayloadRenderers(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

// ---------------------------------------------------------------------------
// Query API
// ---------------------------------------------------------------------------

export function getAllPayloadRenderers(): readonly PayloadRendererEntry[] {
  return entries;
}

/**
 * Find the best-matching renderer for a given event_type and stream path.
 * Prefers a stream_glob match over a wildcard (absent stream_glob) match.
 * Returns undefined if no renderer is registered for this event_type.
 */
export function getPayloadRenderer(
  event_type: string,
  stream_path?: string,
): PayloadRendererEntry | undefined {
  const candidates = entries.filter((e) => e.event_type === event_type);
  if (candidates.length === 0) return undefined;

  if (stream_path) {
    const specific = candidates.find(
      (e) => e.stream_glob !== undefined && matchesGlob(stream_path, e.stream_glob),
    );
    if (specific) return specific;
  }

  return candidates.find((e) => e.stream_glob === undefined) ?? candidates[0];
}

export function getPayloadRenderersByProject(project: string): PayloadRendererEntry[] {
  return entries.filter((e) => e.project === project);
}

// ---------------------------------------------------------------------------
// Glob matching — minimal: supports * (single segment) and ** (any depth)
// ---------------------------------------------------------------------------

function matchesGlob(path: string, glob: string): boolean {
  const regexStr = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "(.+)")
    .replace(/\*/g, "([^/]+)");
  return new RegExp(`^${regexStr}$`).test(path);
}
