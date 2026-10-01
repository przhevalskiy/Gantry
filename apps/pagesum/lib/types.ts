export type SummaryMode = 'bullets' | 'short' | 'eli5';

export interface PageSumSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  mode: SummaryMode;
}

export interface PageSumState {
  version: 1;
  settings: PageSumSettings;
  lastSummary: { url: string; title: string; at: number; text: string } | null;
}

export const STORAGE_KEY = 'pagesum_state_v1' as const;

export const DEFAULT_SETTINGS: PageSumSettings = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  mode: 'bullets',
};
