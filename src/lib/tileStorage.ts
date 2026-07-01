import type { TileKey, PaneId } from '../components/workspace/TilePicker';

export type { PaneId };
export type TileMap = Record<PaneId, TileKey>;

export const TILES_KEY = 'lattica.pane.tiles';
export const DEFAULT_TILES: TileMap = { left: 'cerebra', topRight: 'policy', bottomRight: 'fossic' };

export function loadTiles(): TileMap {
  try {
    const raw = localStorage.getItem(TILES_KEY);
    return raw ? (JSON.parse(raw) as TileMap) : DEFAULT_TILES;
  } catch {
    return DEFAULT_TILES;
  }
}

export function saveTiles(t: TileMap): void {
  try { localStorage.setItem(TILES_KEY, JSON.stringify(t)); } catch { /* quota */ }
}
