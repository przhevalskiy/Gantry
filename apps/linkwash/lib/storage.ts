import { DEFAULT_SETTINGS, STORAGE_KEY, type LinkWashSettings, type LinkWashState } from './types';

function empty(): LinkWashState {
  return { version: 1, settings: { ...DEFAULT_SETTINGS }, lastCleaned: null };
}

export async function loadState(): Promise<LinkWashState> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const stored = raw[STORAGE_KEY] as LinkWashState | undefined;
  if (stored?.version !== 1) return empty();
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS, ...stored.settings },
    lastCleaned: stored.lastCleaned ?? null,
  };
}

export async function saveSettings(settings: LinkWashSettings): Promise<void> {
  const state = await loadState();
  state.settings = settings;
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

export async function setLastCleaned(url: string): Promise<void> {
  const state = await loadState();
  state.lastCleaned = url;
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}
