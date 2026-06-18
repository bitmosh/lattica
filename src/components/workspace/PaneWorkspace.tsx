import { useState } from 'react';
import './PaneWorkspace.css';
import { Pane } from './Pane';
import { TileKey, PaneId } from './TilePicker';

type TileMap = Record<PaneId, TileKey>;
type FrozenMap = Record<PaneId, boolean>;

export function PaneWorkspace() {
  const [tiles, setTiles] = useState<TileMap>({
    left: 'cerebra',
    topRight: 'policy',
    bottomRight: null,
  });

  const [frozen, setFrozen] = useState<FrozenMap>({
    left: false,
    topRight: false,
    bottomRight: false,
  });

  const [pickerOpenFor, setPickerOpenFor] = useState<PaneId | null>(null);

  function handleOpenPicker(paneId: PaneId) {
    setPickerOpenFor(p => (p === paneId ? null : paneId));
  }

  function handleClosePicker() {
    setPickerOpenFor(null);
  }

  function handleSelectTile(paneId: PaneId, key: TileKey) {
    setTiles(t => ({ ...t, [paneId]: key }));
    setPickerOpenFor(null);
  }

  function handleFreeze(paneId: PaneId) {
    setFrozen(f => ({ ...f, [paneId]: true }));
  }

  function handleThaw(paneId: PaneId) {
    setFrozen(f => ({ ...f, [paneId]: false }));
  }

  return (
    <div
      className="la-workspace"
      onClick={pickerOpenFor !== null ? handleClosePicker : undefined}
    >
      {/* Left pane */}
      <Pane
        paneId="left"
        tileKey={tiles.left}
        frozen={frozen.left}
        pickerOpen={pickerOpenFor === 'left'}
        onOpenPicker={() => handleOpenPicker('left')}
        onClosePicker={handleClosePicker}
        onSelectTile={k => handleSelectTile('left', k)}
        onFreeze={() => handleFreeze('left')}
        onThaw={() => handleThaw('left')}
      />

      {/* Vertical divider */}
      <div className="la-workspace-divider la-workspace-divider--col">
        <div className="la-workspace-divider-handle" />
      </div>

      {/* Right column: topRight + horizontal divider + bottomRight */}
      <div className="la-workspace-right">
        <Pane
          paneId="topRight"
          tileKey={tiles.topRight}
          frozen={frozen.topRight}
          pickerOpen={pickerOpenFor === 'topRight'}
          onOpenPicker={() => handleOpenPicker('topRight')}
          onClosePicker={handleClosePicker}
          onSelectTile={k => handleSelectTile('topRight', k)}
          onFreeze={() => handleFreeze('topRight')}
          onThaw={() => handleThaw('topRight')}
        />
        <div className="la-workspace-divider la-workspace-divider--row" />
        <Pane
          paneId="bottomRight"
          tileKey={tiles.bottomRight}
          frozen={frozen.bottomRight}
          pickerOpen={pickerOpenFor === 'bottomRight'}
          onOpenPicker={() => handleOpenPicker('bottomRight')}
          onClosePicker={handleClosePicker}
          onSelectTile={k => handleSelectTile('bottomRight', k)}
          onFreeze={() => handleFreeze('bottomRight')}
          onThaw={() => handleThaw('bottomRight')}
        />
      </div>

      {/* Backdrop to close picker when clicking outside */}
      {pickerOpenFor !== null && (
        <div
          className="la-workspace-picker-backdrop"
          onClick={handleClosePicker}
        />
      )}
    </div>
  );
}
