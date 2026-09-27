export type EntryKind = 'prompt' | 'output' | 'note';

export interface AuditEntry {
  id: string;
  kind: EntryKind;
  text: string;
  sourceUrl: string;
  sourceTitle: string;
  clientTag: string;
  createdAt: number;
}

export interface PromptLedgerState {
  version: 1;
  entries: AuditEntry[];
  settings: {
    defaultClientTag: string;
    pro: { enabled: boolean };
  };
}

export const STORAGE_KEY = 'promptledger_state_v1' as const;
