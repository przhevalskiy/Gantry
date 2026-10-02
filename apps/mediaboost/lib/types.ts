export interface MediaBoostSettings {
  speed: number;
  volume: number;
  /** Multiplier above 1.0 uses Web Audio gain when possible. */
  boost: number;
  enabled: boolean;
}

export interface MediaBoostState {
  version: 1;
  settings: MediaBoostSettings;
}

export const STORAGE_KEY = 'mediaboost_state_v1' as const;

export const DEFAULT_SETTINGS: MediaBoostSettings = {
  speed: 1,
  volume: 1,
  boost: 1,
  enabled: true,
};
