import './FreezeOverlay.css';

interface Props {
  queuedCount: number;
  onThaw: () => void;
}

export function FreezeOverlay({ queuedCount, onThaw }: Props) {
  return (
    <div className="la-freeze-overlay">
      <div className="la-freeze-badge">
        <span className="la-freeze-icon">❄</span>
        <span className="la-freeze-title">FROZEN</span>
        <span className="la-freeze-sep">·</span>
        <span className="la-freeze-count">{queuedCount}</span>
        <span className="la-freeze-queued">events queued</span>
        <span className="la-freeze-sep">·</span>
        <button className="la-freeze-thaw" onClick={onThaw}>thaw →</button>
      </div>
    </div>
  );
}
