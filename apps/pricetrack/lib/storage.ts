import { STORAGE_KEY, type PricePoint, type PriceTrackState, type WatchedItem } from './types';

function empty(): PriceTrackState {
  return { version: 1, items: [], settings: { pro: { enabled: false } } };
}

function normalizeItem(item: WatchedItem): WatchedItem {
  return {
    ...item,
    note: item.note ?? '',
    targetPrice: item.targetPrice ?? null,
    history: item.history ?? [],
  };
}

export async function loadState(): Promise<PriceTrackState> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const stored = raw[STORAGE_KEY] as PriceTrackState | undefined;
  if (stored?.version !== 1) return empty();
  return { ...stored, items: stored.items.map(normalizeItem) };
}

export async function saveState(state: PriceTrackState): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

export async function upsertWatch(input: {
  url: string;
  title: string;
  point: PricePoint;
  note?: string;
}): Promise<WatchedItem> {
  const state = await loadState();
  const existing = state.items.find((i) => i.url === input.url);
  const now = Date.now();
  if (existing) {
    existing.title = input.title || existing.title;
    existing.lastCheckedAt = now;
    existing.history = [...existing.history, input.point].slice(-40);
    if (input.note != null) existing.note = input.note;
    await saveState(state);
    return existing;
  }
  const created: WatchedItem = {
    id: crypto.randomUUID(),
    url: input.url,
    title: input.title || input.url,
    createdAt: now,
    lastCheckedAt: now,
    history: [input.point],
    note: input.note?.trim() ?? '',
    targetPrice: null,
  };
  state.items.unshift(created);
  state.items = state.items.slice(0, 50);
  await saveState(state);
  return created;
}

export async function setTargetPrice(id: string, targetPrice: number | null): Promise<void> {
  const state = await loadState();
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  item.targetPrice = targetPrice != null && Number.isFinite(targetPrice) && targetPrice > 0 ? targetPrice : null;
  await saveState(state);
}

export async function deleteWatch(id: string): Promise<void> {
  const state = await loadState();
  state.items = state.items.filter((i) => i.id !== id);
  await saveState(state);
}
