import { describe, it, expect } from 'vitest';
import { routeToScope } from '../lib/routing';

describe('routeToScope', () => {
  it('routes cerebra streams', () => {
    expect(routeToScope('cerebra/agent-trace/abc')).toBe('cerebra');
  });

  it('routes policy-scout streams to the policy key', () => {
    expect(routeToScope('policy-scout/audit/123')).toBe('policy');
    expect(routeToScope('policy-scout/decisions')).toBe('policy');
  });

  it('routes fossic streams', () => {
    expect(routeToScope('fossic/internal')).toBe('fossic');
  });

  it('routes ai-stack streams to the aistack key', () => {
    expect(routeToScope('ai-stack/topology')).toBe('aistack');
  });

  it('routes lumaweave streams', () => {
    expect(routeToScope('lumaweave/graph/nodes')).toBe('lumaweave');
  });

  it('routes lattica system streams', () => {
    expect(routeToScope('lattica/canary')).toBe('lattica');
  });

  it('returns null for an unknown prefix', () => {
    expect(routeToScope('unknown/stream')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(routeToScope('')).toBeNull();
  });

  it('does not match a prefix that is only a partial segment', () => {
    // "cerebranope" starts with "cerebra" but the prefix is "cerebra/" — no slash match
    expect(routeToScope('cerebranope/stream')).toBeNull();
  });

  it('matches a stream that is exactly the prefix (no trailing content)', () => {
    // "lattica/" is a valid stream root — matches lattica
    expect(routeToScope('lattica/')).toBe('lattica');
  });
});
