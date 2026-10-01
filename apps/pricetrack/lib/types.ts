export interface PricePoint {
  at: number;
  price: number;
  currency: string;
  raw: string;
}

export interface WatchedItem {
  id: string;
  url: string;
  title: string;
  createdAt: number;
  lastCheckedAt: number;
  history: PricePoint[];
  note: string;
  /** Alert when latest price is at or below this (local only). */
  targetPrice: number | null;
}

export interface PriceTrackState {
  version: 1;
  items: WatchedItem[];
  settings: { pro: { enabled: boolean } };
}

export const STORAGE_KEY = 'pricetrack_state_v1' as const;
