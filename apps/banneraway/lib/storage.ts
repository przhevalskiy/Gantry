import { DEFAULT_SETTINGS, STORAGE_KEY, type BannerAwaySettings, type BannerAwayState } from './types';

function empty(): BannerAwayState {
  return { version: 1, settings: { ...DEFAULT_SETTINGS } };
}

export async function loadState(): Promise<BannerAwayState> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const stored = raw[STORAGE_KEY] as BannerAwayState | undefined;
  if (stored?.version !== 1) return empty();
  return { version: 1, settings: { ...DEFAULT_SETTINGS, ...stored.settings } };
}

export async function saveSettings(settings: BannerAwaySettings): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: { version: 1, settings } satisfies BannerAwayState });
}
