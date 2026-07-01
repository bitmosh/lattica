import { describe, it, expect, beforeEach } from 'vitest';
import { loadTiles, saveTiles, DEFAULT_TILES, TILES_KEY } from '../lib/tileStorage';

beforeEach(() => {
  localStorage.clear();
});

describe('loadTiles', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadTiles()).toEqual(DEFAULT_TILES);
  });

  it('returns a stored layout', () => {
    const layout = { left: 'fossic', topRight: 'cerebra', bottomRight: 'policy' } as const;
    localStorage.setItem(TILES_KEY, JSON.stringify(layout));
    expect(loadTiles()).toEqual(layout);
  });

  it('falls back to defaults on corrupt JSON', () => {
    localStorage.setItem(TILES_KEY, 'not valid json{{{');
    expect(loadTiles()).toEqual(DEFAULT_TILES);
  });

  it('falls back to defaults on null stored value', () => {
    localStorage.removeItem(TILES_KEY);
    expect(loadTiles()).toEqual(DEFAULT_TILES);
  });
});

describe('saveTiles', () => {
  it('persists a layout to localStorage', () => {
    const layout = { left: 'aistack', topRight: 'fossic', bottomRight: 'cerebra' } as const;
    saveTiles(layout);
    expect(JSON.parse(localStorage.getItem(TILES_KEY)!)).toEqual(layout);
  });

  it('round-trips through save then load', () => {
    const layout = { left: 'policy', topRight: 'aistack', bottomRight: 'lumaweave' } as const;
    saveTiles(layout);
    expect(loadTiles()).toEqual(layout);
  });

  it('overwrites a previously saved layout', () => {
    saveTiles({ left: 'cerebra', topRight: 'cerebra', bottomRight: 'cerebra' });
    const updated = { left: 'fossic', topRight: 'policy', bottomRight: 'aistack' } as const;
    saveTiles(updated);
    expect(loadTiles()).toEqual(updated);
  });
});
