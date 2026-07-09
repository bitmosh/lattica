// SPDX-License-Identifier: Apache-2.0
export type ErrorReason =
  | { kind: "no-data-yet" }
  | { kind: "source-unreachable" }
  | { kind: "pre-relay" }
  | { kind: "wiring-incomplete" }
  | { kind: "data-stale"; thresholdMs: number }
  | { kind: "subscription-closed" };

export type LiveValue<T> =
  | { state: "live";  value: T;  lastUpdated: number; stream?: string }
  | { state: "error"; reason: ErrorReason; lastAttempt: number; stream?: string };
