// SPDX-License-Identifier: Apache-2.0
/**
 * v86c Tile System Type Definitions
 * Extended in post-v97 pass 1 with anchor system types.
 * Copied verbatim from LumaWeave src/control-plane/panels/tile.types.ts.
 * One path adjustment: RegistryContract import from ../registry/RegistryContract.
 */

import type { ReactNode } from "react";
import type { RegistryContract } from "../registry/RegistryContract";

/** Which viewport edge a tile is anchored to, or "free" for explicit coords. */
export type TileAnchorEdge = "left" | "right" | "top" | "bottom" | "free";

/**
 * Describes where a tile lives when "returned to anchor".
 * Edge anchors use an offset from the top (left/right) or left (top/bottom).
 * Free anchors use explicit x/y viewport coords.
 *
 * Docked tiles (v103.1.0+): use { edge: "left"|"right", slot: number }.
 * slot is the zero-based index down the edge; position is derived from slot + viewport.
 */
export interface TileAnchor {
  edge: TileAnchorEdge;
  /** Pixel offset from the top of the viewport (left/right edges) or left (top/bottom). */
  offset?: number;
  /** Used when edge === "free" — explicit horizontal position. */
  x?: number;
  /** Used when edge === "free" — explicit vertical position. */
  y?: number;
  /**
   * Slot index (0, 1, 2…) for docked tiles. Tiles on the same edge are stacked
   * in slot order from top to bottom. Derived-position tiles only.
   */
  slot?: number;
}

/**
 * Tile section registry entry.
 * Defines a section that can be torn off into a floating tile.
 *
 * Cross-project registration contract (ADR-L-002 / ADR-009):
 *   @required  id, label, category, defaultWidth, defaultHeight, collapsible,
 *              defaultAnchor, defaultVisible, defaultExpanded
 *   @lwInternal  content, contentTestId, sourceTestId, iconGlyph, requiresDevMode
 *               (LumaWeave-internal; external registrations may omit these)
 */
export interface TileSectionEntry {
  /** @required Unique identifier for the section. */
  id: string;
  /** @required Display label for the section. */
  label: string;
  /** @required Category for grouping/filtering. */
  category: "left-panel" | "control-dock" | "right-panel";
  /** @required Default width (px) when floating. */
  defaultWidth: number;
  /** @required Default height (px) when floating. */
  defaultHeight: number;
  /** @required Whether the tile body can be collapsed to its title bar. */
  collapsible: boolean;
  /**
   * @lwInternal Render function for the tile body. Called by FloatingTile
   * when this section is tiled out. v86c-B onward.
   * Omit for Mode B webview tiles (kind: "webview") — webviewUrl drives rendering.
   */
  content?: () => ReactNode;

  /**
   * @lwInternal Testid that must be visible inside the tile body when this
   * section's content() is called. The regression test in
   * v86c-tile-system.spec.ts asserts this testid is visible
   * after tear-off. REQUIRED to be set when content is wired.
   * Undefined for sections whose content() is not yet wired.
   */
  contentTestId?: string;

  /**
   * @lwInternal Testid of the source slot's outer container in the docked
   * (not-tiled-out) state. Used by tests to locate the tear-off
   * handle and verify the slot's tiled-out indicator state.
   * Should be set for all entries in this registry.
   */
  sourceTestId?: string;

  /** Where the tile sits when "returned to anchor". Optional — compositor assigns position when absent. */
  defaultAnchor?: TileAnchor;
  /** @required Whether the tile appears on first app load. Toggleable via Tiles popover. */
  defaultVisible: boolean;
  /** @required Whether the tile body is expanded (vs. collapsed to title bar) on first load. */
  defaultExpanded: boolean;
  /** @lwInternal Glyph shown in the Tiles popover checkbox list. */
  iconGlyph?: string;
  /** @lwInternal If true, tile only appears in the Tiles popover when developer.devMode is enabled. */
  requiresDevMode?: boolean;
  /**
   * Tile hosting mode (ADR-009 / ADR-L-002).
   *   "component" — native React component tile (Mode A). Default when absent.
   *   "webview"   — Tauri child webview embedding (Mode B). Requires webviewUrl.
   */
  kind?: "component" | "webview";
  /**
   * Mode B only — URL of the Tauri child webview to embed.
   * Required when kind === "webview"; must be omitted for kind === "component".
   * Validated at register-time by tileSectionRegistry.validateShape.
   */
  webviewUrl?: string;
}

/**
 * Snap guide state — edge lines shown ONLY when a snap is armed (findSnap returns non-null).
 */
export interface SnapGuide {
  /** Screen X of vertical guide line; null if no X snap armed */
  edgeX: number | null;
  /** Screen Y of horizontal guide line; null if no Y snap armed */
  edgeY: number | null;
}

/**
 * Tile group (runtime-computed, not persisted)
 * Represents a group of snapped-together tiles
 */
export interface TileGroup {
  tileIds: string[];
  topRow: string[];
  topX: number;
  topW: number;
  topY: number;
  bbox: {
    x: number;
    y: number;
    x2: number;
    y2: number;
  };
}

/**
 * Tile context state
 */
export interface TileContextState {
  tiles: Map<string, TileLayoutEntry>;
  maxZ: number;
  groups: TileGroup[];
  tileToGroup: Record<string, string>;
  snapGuide: SnapGuide | null;
  draggingTileId: string | null;
}

/**
 * Tile context actions
 */
export interface TileContextActions {
  tileOut: (sectionKey: string, atPos?: { x: number; y: number }) => string | null;
  closeTile: (tileId: string) => void;
  closeGroup: (groupIds: string[]) => void;
  updateTile: (tileId: string, updates: Partial<TileLayoutEntry>) => void;
  bringToFront: (tileId: string) => void;
  toggleCollapsed: (tileId: string) => void;
  isTiledOut: (sectionKey: string) => boolean;
  setSnapGuide: (guide: SnapGuide | null) => void;
  setTileVisibility: (tileId: string, visible: boolean) => void;
  setTileAnchor: (tileId: string) => void;
  returnToAnchor: (tileId: string) => void;
  getLiveTiles: () => TileLayoutEntry[];
  getLiveTile: (tileId: string) => TileLayoutEntry | undefined;
  setDraggingTileId: (id: string | null) => void;
}

/**
 * Tile layout entry (persisted in settings)
 */
export interface TileLayoutEntry {
  id: string;
  sectionKey: string;
  x: number;
  y: number;
  w: number;
  h: number;
  collapsed: boolean;
  z: number;
  prevH?: number;
  visible?: boolean;
  anchor?: TileAnchor;
  groupId?: string;
  mode?: "docked" | "floating";
}

/**
 * Tile section registry type
 */
export type TileSectionRegistry = RegistryContract<TileSectionEntry, Partial<TileSectionEntry>>;

/**
 * Snap constants
 */
export const SNAP_GRID_SIZE = 16; // px
export const EDGE_MAGNETISM_TOLERANCE = 75; // px (strong magnetic snap)
