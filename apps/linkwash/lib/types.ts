export interface LinkWashSettings {
  enabled: boolean;
  aggressive: boolean;
}

export interface LinkWashState {
  version: 1;
  settings: LinkWashSettings;
  lastCleaned: string | null;
}

export const STORAGE_KEY = 'linkwash_state_v1' as const;

export const DEFAULT_SETTINGS: LinkWashSettings = {
  enabled: true,
  aggressive: false,
};
