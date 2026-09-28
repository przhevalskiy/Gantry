export type GuardColor = 'coral' | 'amber' | 'lime' | 'sky' | 'violet' | 'slate';

export interface ClientGuard {
  id: string;
  /** Match against tab URL (substring) */
  urlMatch: string;
  label: string;
  color: GuardColor;
  createdAt: number;
}

export interface BillGuardState {
  version: 1;
  clients: ClientGuard[];
  settings: {
    enabled: boolean;
    requireTypedConfirm: boolean;
    pro: { enabled: boolean };
  };
}

export const STORAGE_KEY = 'billguard_state_v1' as const;

export const COLORS: Record<GuardColor, { hex: string; label: string }> = {
  coral: { hex: '#ff6b4a', label: 'Coral' },
  amber: { hex: '#f5a524', label: 'Amber' },
  lime: { hex: '#9fd40f', label: 'Lime' },
  sky: { hex: '#3aa0ff', label: 'Sky' },
  violet: { hex: '#8b6bff', label: 'Violet' },
  slate: { hex: '#64748b', label: 'Slate' },
};

/** URL path/query cues that look like billing / payment surfaces */
export const BILLING_HINTS = [
  'billing',
  'payment',
  'payments',
  'invoice',
  'invoices',
  'credit',
  'card',
  'wallet',
  'funding',
  'budget',
  'account-settings',
  'billing_account',
  'billingaccount',
] as const;
