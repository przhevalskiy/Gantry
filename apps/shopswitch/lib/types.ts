export type StoreColor = 'mint' | 'sky' | 'amber' | 'coral' | 'violet';

export interface ShopStore {
  id: string;
  label: string;
  /** admin.shopify.com/store/<handle> or *.myshopify.com/admin */
  adminUrl: string;
  handle: string;
  color: StoreColor;
  notes: string;
  createdAt: number;
  lastOpenedAt: number;
}

export interface ShopSwitchState {
  version: 1;
  stores: ShopStore[];
  settings: { pro: { enabled: boolean } };
}

export const STORAGE_KEY = 'shopswitch_state_v1' as const;

export const COLORS: Record<StoreColor, string> = {
  mint: '#3dcaa0',
  sky: '#3aa0ff',
  amber: '#f5a524',
  coral: '#ff6b4a',
  violet: '#8b6bff',
};
