export type ItemColor = 'mint' | 'sky' | 'amber' | 'coral' | 'violet';

export interface SavedItem {
  id: string;
  label: string;
  url: string;
  handle: string;
  kind: string;
  color: ItemColor;
  notes: string;
  createdAt: number;
  lastOpenedAt: number;
}

export interface AppState {
  version: 1;
  items: SavedItem[];
  settings: { pro: { enabled: boolean } };
}

export const STORAGE_KEY = 'helpdeskhop_state_v1' as const;

export const COLORS: Record<ItemColor, string> = {
  mint: '#3dcaa0',
  sky: '#3aa0ff',
  amber: '#f5a524',
  coral: '#ff6b4a',
  violet: '#8b6bff',
};
