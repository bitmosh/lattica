export const LANE_PREFIX: Record<string, string> = {
  lattica:   'lattica/',
  cerebra:   'cerebra/',
  lumaweave: 'lumaweave/',
  policy:    'policy-scout/',
  fossic:    'fossic/',
  aistack:   'ai-stack/',
};

export function routeToScope(stream_id: string): string | null {
  for (const [key, prefix] of Object.entries(LANE_PREFIX)) {
    if (stream_id.startsWith(prefix)) return key;
  }
  return null;
}
