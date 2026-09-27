export interface Citation {
  id: string;
  citeKey: string;
  title: string;
  authors: string;
  year: string;
  journal: string;
  doi: string;
  url: string;
  publisher: string;
  note: string;
  capturedAt: number;
}

export interface CiteBrowseState {
  version: 1;
  citations: Citation[];
  settings: { pro: { enabled: boolean } };
}

export const STORAGE_KEY = 'citebrowse_state_v1' as const;
