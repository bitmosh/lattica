export interface ScopeConfig {
  key: string;
  label: string;
  color: string;
  bg: string;
}

export const SCOPE_PROJECTS: ScopeConfig[] = [
  { key: 'lattica',   label: 'lattica',    color: '#F2A85C', bg: 'rgba(242,168,92,0.07)' },
  { key: 'cerebra',   label: 'cerebra',    color: '#22E0C4', bg: 'rgba(34,224,196,0.07)' },
  { key: 'lumaweave', label: 'lumaweave',  color: '#A6F35A', bg: 'rgba(166,243,90,0.07)' },
  { key: 'policy',    label: 'policy',     color: '#B46CFF', bg: 'rgba(180,108,255,0.07)' },
  { key: 'fossic',    label: 'fossic',     color: '#4CC9FF', bg: 'rgba(76,201,255,0.07)' },
  { key: 'aistack',   label: 'inference',  color: '#FF5BC7', bg: 'rgba(255,91,199,0.07)' },
];
