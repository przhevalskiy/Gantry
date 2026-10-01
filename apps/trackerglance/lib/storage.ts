import { STORAGE_KEY_LAST } from './types';

export async function saveLastScan(scan: unknown): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY_LAST]: scan });
}

export async function loadLastScan<T>(): Promise<T | null> {
  const raw = await browser.storage.local.get(STORAGE_KEY_LAST);
  return (raw[STORAGE_KEY_LAST] as T) ?? null;
}
