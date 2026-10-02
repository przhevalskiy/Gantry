export interface BannerAwaySettings {
  enabled: boolean;
  clickReject: boolean;
}

export interface BannerAwayState {
  version: 1;
  settings: BannerAwaySettings;
}

export const STORAGE_KEY = 'banneraway_state_v1' as const;

export const DEFAULT_SETTINGS: BannerAwaySettings = {
  enabled: true,
  clickReject: true,
};
