// SPDX-License-Identifier: Apache-2.0
export const LANE_PREFIX: Record<string, string> = {
  lattica:   'lattica/',
  cerebra:   'cerebra/',
  lumaweave: 'lumaweave/',
  policy:    'policy-scout/',
  fossic:    'fossic/',
  aistack:   'ai-stack/',
};

export const SCOPE_KEYS = Object.keys(LANE_PREFIX);

export const WINDOW_MS = 90_000;
export const RATE_WINDOW_MS = 10_000;

export function routeToScope(stream_id: string): string | null {
  for (const [key, prefix] of Object.entries(LANE_PREFIX)) {
    if (stream_id.startsWith(prefix)) return key;
  }
  return null;
}
