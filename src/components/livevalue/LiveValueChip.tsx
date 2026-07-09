// SPDX-License-Identifier: Apache-2.0
import './LiveValueChip.css';

export type LvStateKind =
  | 'live'
  | 'pre-relay'
  | 'no-data-yet'
  | 'source-unreachable'
  | 'data-stale'
  | 'subscription-closed'
  | 'wiring-incomplete';

interface Props {
  state: LvStateKind;
  label: string;
}

const LV_MAP: Record<LvStateKind, { color: string; dot: string; tag: string }> = {
  'live':                { color: '#5eba7d', dot: '●',  tag: 'live' },
  'pre-relay':           { color: '#4a7a9b', dot: '◐',  tag: 'pre-relay' },
  'no-data-yet':         { color: '#4a5568', dot: '○',  tag: 'no data' },
  'source-unreachable':  { color: '#e0a800', dot: '—',  tag: 'offline' },
  'data-stale':          { color: '#c97b00', dot: '◑',  tag: 'stale' },
  'subscription-closed': { color: '#e05c5c', dot: '×',  tag: 'closed' },
  'wiring-incomplete':   { color: '#9b59b6', dot: '▫',  tag: 'wiring' },
};

export function LiveValueChip({ state, label }: Props) {
  const m = LV_MAP[state] ?? LV_MAP['no-data-yet'];
  return (
    <span
      className="lv-chip"
      style={{
        color: m.color,
        border: `1px solid ${m.color}55`,
        background: `${m.color}14`,
      }}
    >
      <span className="lv-chip-dot">{m.dot}</span>
      {label} · {m.tag}
    </span>
  );
}
