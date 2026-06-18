import { LiveValueChip } from '../../components/livevalue/LiveValueChip';
import './LumaWeaveTile.css';

export function LumaWeaveTile() {
  return (
    <div className="lw-tile" data-testid="lumaweave-tile">
      <div className="lw-tile__header">
        <span className="lw-tile__title">LumaWeave</span>
        <LiveValueChip state="pre-relay" label="graph" />
      </div>
      <div className="lw-tile__body">
        <div className="lw-tile__prelay-block">
          <LiveValueChip state="pre-relay" label="graph stream" />
          <span className="lw-tile__prelay-note">
            graph/events integration pending
          </span>
        </div>
        <div className="lw-tile__meta-grid">
          <div className="lw-tile__meta-cell">
            <span className="lw-tile__meta-label">STREAMS</span>
            <span className="lw-tile__meta-value">1 configured</span>
          </div>
          <div className="lw-tile__meta-cell">
            <span className="lw-tile__meta-label">RELAY</span>
            <span className="lw-tile__meta-value">pre-relay</span>
          </div>
        </div>
      </div>
    </div>
  );
}
