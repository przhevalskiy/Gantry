export type SnippetNiche = 'upwork' | 'email' | 'support' | 'general';

export interface Snippet {
  id: string;
  title: string;
  /** Trigger text, e.g. ";intro" — expanded in focused fields */
  shortcut: string;
  body: string;
  niche: SnippetNiche;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  usageCount: number;
}

export interface ReplyKitSettings {
  /** Expand shortcuts while typing in text fields */
  expandShortcuts: boolean;
  /** Show niche starter pack on first run */
  seeded: boolean;
  /** Reserved for Lemon Squeezy / Stripe Pro sync */
  pro: {
    enabled: boolean;
    customerId: string | null;
    syncEnabled: boolean;
  };
}

export interface ReplyKitState {
  version: 1;
  snippets: Snippet[];
  settings: ReplyKitSettings;
}

export type InsertMessage = {
  type: 'REPLYKIT_INSERT';
  body: string;
};

export type InsertResultMessage = {
  type: 'REPLYKIT_INSERT_RESULT';
  ok: boolean;
  reason?: string;
};

export const STORAGE_KEY = 'replykit_state_v1' as const;

export const DEFAULT_SETTINGS: ReplyKitSettings = {
  expandShortcuts: true,
  seeded: false,
  pro: {
    enabled: false,
    customerId: null,
    syncEnabled: false,
  },
};
