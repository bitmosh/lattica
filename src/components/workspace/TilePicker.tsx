import './TilePicker.css';

export type TileKey = 'cerebra' | 'policy' | 'fossic' | 'lumaweave' | 'aistack' | null;
export type PaneId = 'left' | 'topRight' | 'bottomRight';

export interface TileOption {
  key: TileKey;
  color: string;
  title: string;
  sub: string;
}

export const TILE_OPTIONS: TileOption[] = [
  { key: 'cerebra',   color: '#22E0C4', title: 'Cerebra signal feed',  sub: 'agent-trace · live tail + archive' },
  { key: 'policy',    color: '#B46CFF', title: 'Policy Scout',         sub: 'audit · approval · posture' },
  { key: 'fossic',    color: '#4CC9FF', title: 'Fossic substrate',     sub: 'horizontal flow lanes · 15 streams' },
  { key: 'lumaweave', color: '#A6F35A', title: 'LumaWeave graph',      sub: 'graph/events · 1 stream' },
  { key: 'aistack',   color: '#FF5BC7', title: 'ai-stack topology',    sub: 'Bo · LiteLLM · Ollama' },
  { key: null,        color: '#6B7A8A', title: 'Empty pane',           sub: 'unmount tile · pulse for new' },
];

export const TILE_INFO: Record<string, { color: string; name: string; sub: string }> = {
  cerebra:   { color: '#22E0C4', name: 'cerebra',      sub: 'agent-trace · live tail + archive' },
  policy:    { color: '#B46CFF', name: 'policy scout', sub: 'audit · approval · posture' },
  fossic:    { color: '#4CC9FF', name: 'fossic',       sub: 'substrate · 15 streams' },
  lumaweave: { color: '#A6F35A', name: 'lumaweave',    sub: 'graph/events · 1 stream' },
  aistack:   { color: '#FF5BC7', name: 'ai-stack',     sub: 'Bo · LiteLLM · Ollama' },
};

const PANE_LABEL: Record<PaneId, string> = {
  left:        'left',
  topRight:    'top-right',
  bottomRight: 'bottom-right',
};

interface Props {
  paneId: PaneId;
  currentTile: TileKey;
  anchorRight?: boolean;
  onSelect: (key: TileKey) => void;
  onClose: () => void;
}

export function TilePicker({ paneId, currentTile, anchorRight = true, onSelect, onClose }: Props) {
  return (
    <div
      className="la-tile-picker"
      style={{ right: anchorRight ? 12 : 'auto', left: anchorRight ? 'auto' : 12 }}
      onClick={e => e.stopPropagation()}
    >
      <div className="la-tile-picker-header">
        <span className="la-tile-picker-heading">SELECT TILE FOR THIS PANE</span>
        <span className="la-tile-picker-pane-id">{PANE_LABEL[paneId]}</span>
      </div>
      {TILE_OPTIONS.map(o => (
        <button
          key={o.key ?? 'empty'}
          className={`la-tile-picker-option${currentTile === o.key ? ' la-tile-picker-option--active' : ''}`}
          onClick={() => { onSelect(o.key); onClose(); }}
        >
          <span
            className="la-tile-picker-dot"
            style={{ background: o.color, boxShadow: `0 0 6px ${o.color}66` }}
          />
          <div className="la-tile-picker-option-text">
            <div
              className="la-tile-picker-option-title"
              style={{ color: currentTile === o.key ? '#22E0C4' : '#E8ECF0' }}
            >
              {o.title}
            </div>
            <div className="la-tile-picker-option-sub">{o.sub}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
