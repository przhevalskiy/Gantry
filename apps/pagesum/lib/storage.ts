import { DEFAULT_SETTINGS, STORAGE_KEY, type PageSumState, type PageSumSettings } from './types';

function empty(): PageSumState {
  return { version: 1, settings: { ...DEFAULT_SETTINGS }, lastSummary: null };
}

export async function loadState(): Promise<PageSumState> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const stored = raw[STORAGE_KEY] as PageSumState | undefined;
  return stored?.version === 1 ? stored : empty();
}

export async function saveState(state: PageSumState): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

export async function saveSettings(settings: PageSumSettings): Promise<void> {
  const state = await loadState();
  state.settings = settings;
  await saveState(state);
}
