# LumaWeave Patterns Reference
**Purpose:** Scaffold reference for Lattica v0.2.0 — what LumaWeave does and which parts to copy vs. reimagine.
**Investigated:** `/home/boop/Projects/lumaweave/` (read-only)

---

## 1. Quick Reference — Registry Inventory

| Registry | File | T1/T2 | Entry shape (key fields) | ~Entries |
|---|---|---|---|---|
| `tileSectionRegistry` | `src/control-plane/panels/tileSectionRegistry.ts` | T1* | id, label, category, defaultWidth/Height, collapsible, content, defaultAnchor, defaultVisible, defaultExpanded, kind? | 12 |
| `commandRegistry` | `src/control-plane/commands/command-registry.ts` | T1 | id + command fields | ~32 |
| `payloadRendererRegistry` | `src/control-plane/payload-renderer/payloadRendererRegistry.ts` | T2 | project, event_type, component, label?, stream_glob? | 0 (empty, ready) |
| `sourceAdapterRegistry` | `src/source-adapter/sourceAdapterRegistry.ts` | T2 | adapterId, type, loaderFn, metadata | 4 |
| `physicsDialectRegistry` | `src/graph/physics/physicsDialectRegistry.ts` | T2 | dialectId, label, seedParams, runFn | ~4 |
| `inspectorSpokeRegistry` | `src/themes/inspectorSpokeRegistry.ts` | T2 | id, label, order, component | 8 |
| `featureRegistry` | `src/control-plane/features/feature-registry.ts` | T1 | featureId, enabled | ~10 |
| `hotkeyRegistry` | `src/control-plane/hotkeys/hotkey-registry.ts` | T1 | id, keys, action | ~20 |
| `lensRegistry` | `src/lens/lensRegistry.ts` | T2 | id, label, compute, visualize | ~7 |
| `edgeStyleRegistry` | `src/graph/edges/edgeStyleRegistry.ts` | T1 | id, style | ~5 |
| `assetRegistry` | `src/themes/assetRegistry.ts` | T2 | id, url, type | varies |
| `typographyRegistry` | `src/themes/typographyRegistry.ts` | T2 | id, fontDef | ~6 |

**T1** = `register`, `list`, `getById`, `filterByCategory`, `validateShape` — no `subscribe()`.
**T2** = all T1 methods **plus** `subscribe(listener) → unsubscribe`. Triggers re-renders in consumers.

*`tileSectionRegistry` implements the `RegistryContract<TileSectionEntry>` interface. That interface marks `subscribe?` as optional — the tile registry does NOT implement it, making it effectively T1 despite implementing the full contract otherwise.

Base contract: `src/themes/registryContract.types.ts`
```ts
export interface RegistryContract<TEntry, TQuery = Partial<TEntry>> {
  list(): TEntry[];
  getById(id: string): TEntry | undefined;
  filterByCategory(query: TQuery): TEntry[];
  validateShape(entry: unknown): { valid: boolean; errors?: string[] };
  register(entry: TEntry): void;
  subscribe?(listener: (entries: TEntry[]) => void): () => void; // optional → T2
}
```

---

## 2. `tileSectionRegistry` Deep-Dive

**File:** `src/control-plane/panels/tile.types.ts` (types) + `src/control-plane/panels/tileSectionRegistry.ts` (impl)

### `TileSectionEntry` — full shape

```ts
interface TileSectionEntry {
  // @required — cross-project contract (ADR-L-002 / ADR-009)
  id: string;
  label: string;
  category: "left-panel" | "control-dock" | "right-panel";
  defaultWidth: number;          // px, floating tile
  defaultHeight: number;         // px, floating tile
  collapsible: boolean;
  defaultAnchor: TileAnchor;     // { edge, slot? } for docked; { edge, offset? } legacy
  defaultVisible: boolean;       // appears on first load
  defaultExpanded: boolean;      // expanded vs. title-bar-only on first load

  // @lwInternal — LumaWeave-specific; external registrations may omit
  content?: () => ReactNode;     // omit for kind: "webview" tiles
  contentTestId?: string;
  sourceTestId?: string;
  iconGlyph?: string;
  requiresDevMode?: boolean;     // hide unless developer.devMode === true

  // ADR-009 / ADR-L-002 — Tile hosting mode
  kind?: "component" | "webview"; // absent = "component"
  webviewUrl?: string;           // required when kind === "webview"
}
```

`kind` **DOES exist** — added in ADR-009. Values: `"component"` (React, default) or `"webview"` (Tauri child webview, Mode B). The `validateShape` method enforces `webviewUrl` is present when `kind === "webview"`.

`TileAnchor` shape:
```ts
interface TileAnchor {
  edge: "left" | "right" | "top" | "bottom" | "free";
  offset?: number;  // px from top (left/right edges) or left (top/bottom)
  x?: number;       // used when edge === "free"
  y?: number;
  slot?: number;    // 0-based index for docked tiles (v103.1.0+)
}
```

Docked tiles use `{ edge: "left"|"right", slot: 0|1|2... }`. Position is derived from slot + viewport at render time — x/y are NOT persisted for docked tiles.

---

## 3. Shell Architecture

**Entry point:** `src/App.tsx` → `<AppShell />` (`src/app/AppShell.tsx`)

**Top-level component tree (3 levels):**
```
<ErrorBoundary>
  <I18nProvider>
    <TileProvider>                     ← tile context (Zustand-driven)
      <main>                           ← CSS token injection via inline style
        <div.grid.grid-rows-[auto_1fr_auto]>
          <Topbar />                   ← row 1: menu bar
          <section data-testid="graph-viewport">   ← row 2: main canvas
            <SolarBackdrop />          ← cosmetic background
            <SigmaGraphView />         ← graph renderer
            <ClickHalo />, <GlitterField />, <BookmarkLayer />, <Minimap />
          </section>
          <StatusBar />                ← row 3: status bar
        </div>
        <ThemeTargetInspectorOverlay />
        <InspectorMiniGraph />
        <TileLayer />                  ← floating tiles, position:fixed, outside grid
        <SettingsPanelHost />          ← settings drawer (modal, ref-driven)
        <CommandPaletteHost />         ← command palette overlay
      </main>
    </TileProvider>
  </I18nProvider>
</ErrorBoundary>
```

There is **no static left/right sidebar panel** in the DOM. Tiles are all floating via `<TileLayer />`. "Left panel" and "right panel" are categories in the registry — they drive default anchor positions, not layout slots. The `settings.ui.leftPanelCollapsed` flag exists but controls a keyboard shortcut toggle (Ctrl+\), not a DOM panel.

`<TileProvider>` owns tile state. `<TileLayer>` reads `useTileContext()` and renders `<FloatingTile>` components. Group snapping and docking are handled in `tileUtils.ts` + `resolvedTilesArray()`.

---

## 4. Theming Layer

### Token definitions

**Core app tokens** — set via inline `style` on `<main>` in AppShell (JS-driven, crossfaded on theme switch):
```
--lw-app-background       --lw-panel-background     --lw-panel-border
--lw-text-primary         --lw-text-muted           --lw-accent
--lw-visual-accent        --lw-app-glow
--lw-color-flare-500      --lw-color-magenta-500    --lw-color-purple-500
--lw-color-gold-500
--lw-inspector-radial-spoke-color  --lw-inspector-radial-root-color
--lw-inspector-radial-root-border  --lw-inspector-radial-text
```

**Static CSS tokens** — defined on `:root` in `src/App.css` and `src/styles/lumaweave-visual-handles.css`:

Typography (3):
```
--lw-font-display   --lw-font-body   --lw-font-mono
```

Visual handle defaults (~20) — in `lumaweave-visual-handles.css`:
```
--lw-visual-accent             --lw-visual-accent-soft        --lw-visual-accent-hover
--lw-visual-panel-bg           --lw-visual-panel-border
--lw-visual-card-bg            --lw-visual-card-border
--lw-visual-badge-bg           --lw-visual-badge-text
--lw-visual-divider-color
--lw-visual-button-bg          --lw-visual-button-border      --lw-visual-button-text
--lw-visual-button-hover-bg    --lw-visual-button-active-bg
--lw-visual-graph-frame-bg     --lw-visual-graph-frame-border
--lw-visual-glow-color         --lw-visual-glow-spread
```

Semantic status (4) — also in `lumaweave-visual-handles.css`:
```
--lw-color-danger  --lw-color-success  --lw-color-warning  --lw-color-info
```

**Total: ~40 `--lw-*` tokens** across CSS files. An additional ~20 component-scoped tokens exist in individual CSS files (`--lw-settings-bg-opacity`, `--lw-panel-bg-solid`, etc.).

**TypeScript theme definition:** `src/themes/tokenPrimitives.ts` (not read in full) + `getThemeRuntimeTokens()` in `src/themes/index.ts`. Runtime tokens are plain JS objects passed into inline styles — not CSS custom properties at the TS layer.

### `--portfolio-*` namespace (already exists in LumaWeave)

**File:** `src/styles/portfolio-tokens.css` — already committed, maps 10 `--portfolio-*` tokens to `--lw-*` with hex fallbacks:

```css
:root {
  /* Structural (6) */
  --portfolio-bg:             var(--lw-app-background,   #0f1420);
  --portfolio-surface:        var(--lw-panel-background, rgba(15, 23, 42, 0.72));
  --portfolio-text-primary:   var(--lw-text-primary,     #e9e4f5);
  --portfolio-text-secondary: var(--lw-text-muted,       #a28fc0);
  --portfolio-accent:         var(--lw-accent,           #ffb347);
  --portfolio-border:         var(--lw-panel-border,     rgba(255, 179, 71, 0.18));

  /* Semantic (4) */
  --portfolio-color-danger:   var(--lw-color-danger,  #e05c5c);
  --portfolio-color-success:  var(--lw-color-success, #5eba7d);
  --portfolio-color-warning:  var(--lw-color-warning, #e0a800);
  --portfolio-color-info:     var(--lw-color-info,    #4da6ff);
}
```

Lattica should import this file verbatim. The `--portfolio-*` namespace IS already the abstraction layer for cross-project renderers — it's not something Lattica invents, it's something LumaWeave has already scaffolded.

---

## 5. Zustand Store Pattern

**Convention:** one concern per store, `create<StoreType>()`, file named `*.store.ts`, lives under the domain folder.

### Settings store (the main store) — `src/control-plane/settings/settings.store.ts`

```ts
export type SettingsStore = {
  settings: LumaWeaveSettings;
  setSetting: (path: string, value: unknown) => void;  // dotted path mutation
  resetSettings: () => void;
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: loadSettings(),  // localStorage + migration on init
  setSetting: (path, value) =>
    set((state) => ({ settings: setNestedValue(state.settings, path, value) })),
  resetSettings: () => set({ settings: defaultSettings }),
}));

// Auto-persist to localStorage via subscribe
useSettingsStore.subscribe((state) => {
  localStorage.setItem("lumaweave-settings", JSON.stringify(state.settings));
});

export const settingsStore = useSettingsStore;  // raw store exposed for test helpers
```

Settings schema is versioned (`CURRENT_SCHEMA_VERSION = 95`) with a migration chain in `settings.migrations.ts`.

### Minimal stores (domain-scoped)

```ts
// themeInspectorStore.ts — simple boolean toggle
export const useThemeInspectorStore = create<ThemeInspectorState>((set) => ({
  enabled: false,
  toggle: () => set((state) => ({ enabled: !state.enabled })),
  setEnabled: (value) => set({ enabled: value }),
}));
```

Pattern: state + actions co-located in the `create()` call. No middleware (no `immer`, no `devtools` in current code). Selector usage: `useStore((s) => s.field)` for fine-grained subscriptions.

---

## 6. What to Copy vs. Reimagine

| Item | Copy pattern | Reimagine | Notes |
|---|---|---|---|
| `RegistryContract<T>` base interface | Copy verbatim | — | `src/themes/registryContract.types.ts` is 26 lines, stable |
| `TileSectionEntry` type | Copy required fields verbatim | Add Lattica-specific fields to the same interface | `kind`, `webviewUrl` already exist — copy those too |
| `tileSectionRegistry` impl shape | Copy (list/getById/filterByCategory/validateShape/register) | Lattica's entries will differ | T1 is fine for static tiles; add T2 if Lattica needs dynamic registration |
| `payloadRendererRegistry` | Copy verbatim | — | Already in LumaWeave at `src/control-plane/payload-renderer/payloadRendererRegistry.ts`; Lattica can re-export or duplicate |
| `--portfolio-tokens.css` | Copy verbatim | — | Already exists as `src/styles/portfolio-tokens.css`; this IS Lattica's token bridge |
| Zustand store pattern | Copy (create + subscribe for persistence) | Schema version + migration chain (simpler at v0.2) | Don't import immer/devtools unless needed |
| AppShell grid layout | Copy grid-rows-[auto_1fr_auto] for shell | Main content area: Lattica has no graph canvas initially | Use same 3-row layout; swap graph viewport for a content slot |
| TileProvider + TileLayer | Copy for floating tile system | Entry set will differ | `src/control-plane/panels/TileProvider.tsx` is the context provider |
| `lumaweave-visual-handles.css` | Copy the token definitions (`:root` block) | Lattica may rename prefix or extend | This is the static CSS fallback layer; safe to copy |
| Typography tokens (`--lw-font-*`) | Copy the 3 font tokens | Rename to `--lw-font-*` or `--portfolio-font-*` | Font faces (Space Grotesk, IBM Plex) are already in LumaWeave |
| Self-graph Vite plugin | Skip | Lattica has no self-graph fixture at v0.2 | Remove `selfGraphWatcherPlugin` from vite.config |
| Settings migration chain | Reimagine from v1 | — | Start fresh; copy the `setNestedValue` dotted-path helper |
| Tauri config structure | Copy structure | Update productName, identifier, devUrl | `devUrl: :1420` is confirmed; Lattica should keep same port if co-dev not needed, or use `:1421` |

---

## 7. Tauri + Build Config

**Tauri version:** `2` (both `tauri` and `tauri-build` spec `version = "2"` in `Cargo.toml`; no minor pin)

**Rust dependencies of note:**
- `tauri = { version = "2", features = [] }` — no extra feature flags
- `tauri-plugin-opener = "2"` — file/URL open plugin
- `reqwest = { version = "0.12", features = ["rustls-tls", "json"] }` — HTTP client (for source adapters)
- `tokio = { version = "1", features = ["rt", "time"] }`

**Vite config:**
- Framework: `@vitejs/plugin-react` (Babel-based, not SWC) + `@tailwindcss/vite`
- Custom plugin: `selfGraphWatcherPlugin` — watches `docs/**/*.md`, regenerates self-graph JSON on change; also self-heals missing fixture on startup. Lattica should omit this.
- Build-time define: `__PLAYWRIGHT__: JSON.stringify(process.env.PLAYWRIGHT === "true")` — used in AppShell to switch fixture vs. real data
- Server port: **`:1420`**, `strictPort: true` — hard requirement for Tauri dev mode
- `fs.allow: [".."]` — allows Vite to import from `docs/` directory

**`devUrl`:** `http://localhost:1420` — confirmed. Lattica Mode B embedding depends on this.

**React version:** `^19.1.0` (React 19). Zustand `^5.0.12`.

**Key deps to replicate for scaffold:**
- `zustand ^5`, `react ^19`, `tailwindcss ^4` (Vite plugin variant), `@tauri-apps/api ^2`, `typescript ~5.8`, `vite ^7`
- Optional at v0.2: sigma, graphology, three (graph-only deps — skip until LumaWeave module is active)

---

## 8. Surprises or Blockers

1. **`--portfolio-tokens.css` already exists in LumaWeave** — This was described as a "new namespace Lattica introduces" but it already lives at `src/styles/portfolio-tokens.css` and is imported in `App.css`. All 10 tokens (`--portfolio-bg` through `--portfolio-color-info`) are defined and wired to `--lw-*` values. Lattica's scaffold pass should copy this file verbatim — no design work needed.

2. **`payloadRendererRegistry` also already exists in LumaWeave** — `src/control-plane/payload-renderer/payloadRendererRegistry.ts` is a complete T2 registry with full entry shape, `registerPayloadRenderer()`, `subscribePayloadRenderers()`, `getPayloadRenderer()` (with glob matching), and `getPayloadRenderersByProject()`. The comment confirms it was "confirmed in Lattica round-1 / round-2 coordination." Lattica can use this directly or copy it; no scaffold work required.

3. **`kind` field is already in `TileSectionEntry`** — `kind?: "component" | "webview"` exists in `tile.types.ts:L97` and is validated in `tileSectionRegistry.validateShape`. Mode B (`kind: "webview"`) requires `webviewUrl`. No Lattica additions needed to the shape.

4. **No static sidebar panels** — There is no `LeftPanel.tsx` or `RightPanel.tsx`. The tile system is entirely floating/docked via `TileLayer`. "left-panel" and "right-panel" are registry categories, not DOM structure. Lattica's scaffold should not expect sidebar divs to extract.

5. **Tauri feature flags are empty** — `tauri = { version = "2", features = [] }`. No plugins beyond `tauri-plugin-opener`. Lattica will need to add `tauri-plugin-fs` or others as Phase 1 storage work begins — each requires a DEPENDENCY REQUEST per the safeguard protocol.

6. **Settings schema at version 95** — LumaWeave's migration chain is deep (95 versions). Lattica starts from scratch at v1; do not copy the migration chain, only the `setNestedValue` helper and the `subscribe`-to-persist pattern.
