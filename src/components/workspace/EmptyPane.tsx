import './EmptyPane.css';

interface Props {
  onOpenPicker: () => void;
}

export function EmptyPane({ onOpenPicker }: Props) {
  return (
    <div className="la-empty-pane" onClick={onOpenPicker}>
      <div className="la-empty-pane-inner">
        <span className="la-empty-pane-label">EMPTY PANE</span>
        <button className="la-empty-pane-select" onClick={e => { e.stopPropagation(); onOpenPicker(); }}>
          Select a tile <span>▾</span>
        </button>
        <span className="la-empty-pane-hint">fossic · lumaweave · ai-stack · …</span>
      </div>
    </div>
  );
}
