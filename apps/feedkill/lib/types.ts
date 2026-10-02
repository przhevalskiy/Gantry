export type SiteId = 'youtube' | 'instagram' | 'x';

export interface FeedKillSettings {
  youtube: boolean;
  instagram: boolean;
  x: boolean;
  redirectShorts: boolean;
}

export interface FeedKillState {
  version: 1;
  settings: FeedKillSettings;
}

export const STORAGE_KEY = 'feedkill_state_v1' as const;

export const DEFAULT_SETTINGS: FeedKillSettings = {
  youtube: true,
  instagram: true,
  x: true,
  redirectShorts: true,
};
