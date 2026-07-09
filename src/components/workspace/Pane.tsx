// SPDX-License-Identifier: Apache-2.0
import { useState, useEffect, type ReactElement } from 'react';
import './Pane.css';
import { TilePicker, TileKey, PaneId, TILE_INFO } from './TilePicker';
import { FreezeOverlay } from './FreezeOverlay';
import { EmptyPane } from './EmptyPane';
import { CerebraSignalTile } from '../../tiles/cerebra-signal/CerebraSignalTile';
import { PolicyScoutTile } from '../../tiles/policy-scout/PolicyScoutTile';
import { AiStackTopologyTile } from '../../tiles/ai-stack/AiStackTopologyTile';
import { LumaWeaveTile } from '../../tiles/lumaweave/LumaWeaveTile';
import { FossicTile } from '../../tiles/fossic/FossicTile';

type TileRendererProps = { frozen: boolean; onQueuedCountChange: (n: number) => void };
type TileRenderer = (props: TileRendererProps) => ReactElement;

const TILE_RENDERERS: Record<Exclude<TileKey, null>, TileRenderer> = {
  cerebra:   p => <CerebraSignalTile {...p} />,
  policy:    p => <PolicyScoutTile {...p} />,
  fossic:    p => <FossicTile {...p} />,
  lumaweave: p => <LumaWeaveTile {...p} />,
  aistack:   p => <AiStackTopologyTile {...p} />,
};

interface Props {
  paneId: PaneId;
  tileKey: TileKey;
  frozen: boolean;
  pickerOpen: boolean;
  onOpenPicker: () => void;
  onClosePicker: () => void;
  onSelectTile: (key: TileKey) => void;
  onFreeze: () => void;
  onThaw: () => void;
}

export function Pane({
  paneId,
  tileKey,
  frozen,
  pickerOpen,
  onOpenPicker,
  onClosePicker,
  onSelectTile,
  onFreeze,
  onThaw,
}: Props) {
  const info = tileKey ? TILE_INFO[tileKey] : null;
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    if (!frozen) setQueuedCount(0);
  }, [frozen]);
  const anchorRight = paneId !== 'left';

  return (
    <div className={`la-pane${frozen ? ' la-frozen' : ''}`}>
      {info && (
        <div
          className="la-pane-header"
          style={{ borderBottom: `1px solid ${info.color}2e` }}
        >
          {/* breathing accent bar */}
          <div
            className="la-pane-header-bar"
            style={{ background: `linear-gradient(90deg, ${info.color}, ${info.color}2e 60%, transparent)` }}
          />
          <div className="la-pane-header-inner">
            <div className="la-pane-header-left">
              <span
                className="la-pane-header-dot"
                style={{
                  background: info.color,
                  boxShadow: `0 0 6px ${info.color}99`,
                  animation: 'la-pulse-slow 2.6s ease-in-out infinite',
                }}
              />
              <span className="la-pane-header-name" style={{ color: info.color }}>
                {info.name}
              </span>
              <span className="la-pane-header-sub">{info.sub}</span>
            </div>
            <div />
            <div className="la-pane-header-right">
              <button
                className={`la-pane-freeze-btn${frozen ? ' la-pane-freeze-btn--frozen' : ''}`}
                onClick={frozen ? onThaw : onFreeze}
                title={frozen ? 'thaw' : 'freeze motion'}
              >
                ❄ {frozen ? 'frozen' : 'freeze'}
              </button>
              <button
                className="la-pane-picker-btn"
                onClick={onOpenPicker}
                title="change tile"
              >
                ▾
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="la-pane-content">
        {tileKey === null ? (
          <EmptyPane onOpenPicker={onOpenPicker} />
        ) : (
          <div className="la-pane-tile-slot">
            {TILE_RENDERERS[tileKey]({ frozen, onQueuedCountChange: setQueuedCount })}
          </div>
        )}
      </div>

      {frozen && <FreezeOverlay queuedCount={queuedCount} onThaw={onThaw} />}

      {pickerOpen && (
        <TilePicker
          paneId={paneId}
          currentTile={tileKey}
          anchorRight={anchorRight}
          onSelect={onSelectTile}
          onClose={onClosePicker}
        />
      )}
    </div>
  );
}
