export interface TabSleepSettings {
  enabled: boolean;
  /** Minutes of inactivity before discard. */
  idleMinutes: number;
  keepAudible: boolean;
  keepPinned: boolean;
}

export interface SavedSession {
  id: string;
  name: string;
  createdAt: number;
  urls: string[];
}

export interface TabSleepState {
  version: 1;
  settings: TabSleepSettings;
  sessions: SavedSession[];
}

export const STORAGE_KEY = 'tabsleep_state_v1' as const;
export const ALARM_NAME = 'tabsleep-tick';

export const DEFAULT_SETTINGS: TabSleepSettings = {
  enabled: true,
  idleMinutes: 15,
  keepAudible: true,
  keepPinned: true,
};
