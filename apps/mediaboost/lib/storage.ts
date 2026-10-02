import { DEFAULT_SETTINGS, STORAGE_KEY, type MediaBoostSettings, type MediaBoostState } from './types';

function empty(): MediaBoostState {
  return { version: 1, settings: { ...DEFAULT_SETTINGS } };
}

export async function loadState(): Promise<MediaBoostState> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const stored = raw[STORAGE_KEY] as MediaBoostState | undefined;
  if (stored?.version !== 1) return empty();
  return { version: 1, settings: { ...DEFAULT_SETTINGS, ...stored.settings } };
}

export async function saveSettings(settings: MediaBoostSettings): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: { version: 1, settings } satisfies MediaBoostState });
}

export function clampSpeed(n: number): number {
  return Math.min(3, Math.max(0.25, Math.round(n * 100) / 100));
}

export function clampVolume(n: number): number {
  return Math.min(1, Math.max(0, Math.round(n * 100) / 100));
}

export function clampBoost(n: number): number {
  return Math.min(4, Math.max(1, Math.round(n * 10) / 10));
}
