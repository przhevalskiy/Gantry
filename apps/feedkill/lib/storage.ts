import { DEFAULT_SETTINGS, STORAGE_KEY, type FeedKillState, type FeedKillSettings } from './types';

function empty(): FeedKillState {
  return { version: 1, settings: { ...DEFAULT_SETTINGS } };
}

export async function loadState(): Promise<FeedKillState> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const stored = raw[STORAGE_KEY] as FeedKillState | undefined;
  if (stored?.version !== 1) return empty();
  return { version: 1, settings: { ...DEFAULT_SETTINGS, ...stored.settings } };
}

export async function saveSettings(settings: FeedKillSettings): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: { version: 1, settings } satisfies FeedKillState });
}
