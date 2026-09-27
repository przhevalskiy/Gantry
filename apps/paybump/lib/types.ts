export type BumpNiche = 'stripe' | 'invoice' | 'general';

export interface BumpMacro {
  id: string;
  title: string;
  shortcut: string;
  body: string;
  niche: BumpNiche;
  createdAt: number;
  updatedAt: number;
  usageCount: number;
}

export interface PayBumpState {
  version: 1;
  macros: BumpMacro[];
  settings: {
    expandShortcuts: boolean;
    seeded: boolean;
    pro: { enabled: boolean };
  };
}

export const STORAGE_KEY = 'paybump_state_v1' as const;
