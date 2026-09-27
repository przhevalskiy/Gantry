export type PortalColor = 'mint' | 'sky' | 'amber' | 'coral' | 'violet';
export type PortalKind = 'quickbooks' | 'xero';

export interface ClientPortal {
  id: string;
  label: string;
  portalUrl: string;
  kind: PortalKind;
  handle: string;
  color: PortalColor;
  notes: string;
  createdAt: number;
  lastOpenedAt: number;
}

export interface PortalSwitchState {
  version: 1;
  portals: ClientPortal[];
  settings: { pro: { enabled: boolean } };
}

export const STORAGE_KEY = 'portalswitch_state_v1' as const;

export const COLORS: Record<PortalColor, string> = {
  mint: '#3dcaa0',
  sky: '#3aa0ff',
  amber: '#f5a524',
  coral: '#ff6b4a',
  violet: '#8b6bff',
};
