import { DEFAULT_SETS, STORAGE_KEY, type BidMatchState, type KeywordSet } from './types';

function empty(): BidMatchState {
  const now = Date.now();
  return {
    version: 1,
    sets: DEFAULT_SETS.map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      createdAt: now,
    })),
    settings: { caseSensitive: false, wholeWord: false, pro: { enabled: false } },
  };
}

export async function loadState(): Promise<BidMatchState> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const stored = raw[STORAGE_KEY] as BidMatchState | undefined;
  if (!stored || stored.version !== 1) {
    const seeded = empty();
    await browser.storage.local.set({ [STORAGE_KEY]: seeded });
    return seeded;
  }
  return stored;
}

export async function saveState(state: BidMatchState): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

export async function listSets(): Promise<KeywordSet[]> {
  return (await loadState()).sets;
}

export async function upsertSet(
  input: Omit<KeywordSet, 'id' | 'createdAt'> & { id?: string },
): Promise<KeywordSet> {
  const state = await loadState();
  if (input.id) {
    const existing = state.sets.find((s) => s.id === input.id);
    if (!existing) throw new Error('Set not found');
    const next: KeywordSet = {
      id: existing.id,
      createdAt: existing.createdAt,
      name: input.name,
      keywords: input.keywords,
      color: input.color,
      enabled: input.enabled,
    };
    state.sets = state.sets.map((s) => (s.id === next.id ? next : s));
    await saveState(state);
    return next;
  }
  const created: KeywordSet = {
    id: crypto.randomUUID(),
    name: input.name,
    keywords: input.keywords,
    color: input.color,
    enabled: input.enabled,
    createdAt: Date.now(),
  };
  state.sets.unshift(created);
  await saveState(state);
  return created;
}

export async function deleteSet(id: string): Promise<void> {
  const state = await loadState();
  state.sets = state.sets.filter((s) => s.id !== id);
  await saveState(state);
}

export async function toggleSet(id: string, enabled: boolean): Promise<void> {
  const state = await loadState();
  const set = state.sets.find((s) => s.id === id);
  if (!set) return;
  set.enabled = enabled;
  await saveState(state);
}
