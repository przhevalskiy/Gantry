export interface KeywordSet {
  id: string;
  name: string;
  keywords: string[];
  color: string;
  enabled: boolean;
  createdAt: number;
}

export interface BidMatchState {
  version: 1;
  sets: KeywordSet[];
  settings: {
    caseSensitive: boolean;
    wholeWord: boolean;
    pro: { enabled: boolean };
  };
}

export const STORAGE_KEY = 'bidmatch_state_v1' as const;

export const DEFAULT_SETS: Omit<KeywordSet, 'id' | 'createdAt'>[] = [
  {
    name: 'Core skills',
    keywords: ['typescript', 'react', 'python', 'fastapi', 'aws'],
    color: '#c8f135',
    enabled: true,
  },
  {
    name: 'Contract type',
    keywords: ['remote', 'hybrid', 'fixed price', 'hourly', 'W2', '1099'],
    color: '#3aa0ff',
    enabled: true,
  },
  {
    name: 'Clearance / compliance',
    keywords: ['secret clearance', 'TS/SCI', 'NIST', 'FedRAMP', 'HIPAA'],
    color: '#ff6b4a',
    enabled: true,
  },
];
