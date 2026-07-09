// SPDX-License-Identifier: Apache-2.0
export interface SerializedEvent {
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

export interface FossicEventPayload {
  subscription_id: string;
  event: SerializedEvent;
}
