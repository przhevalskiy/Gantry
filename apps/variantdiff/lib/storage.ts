import { STORAGE_KEY, type FieldDiff, type ProductSnapshot, type VariantDiffState } from './types';

function empty(): VariantDiffState {
  return {
    version: 1,
    baseline: null,
    lastCompare: null,
    settings: { pro: { enabled: false } },
  };
}

export async function loadState(): Promise<VariantDiffState> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const stored = raw[STORAGE_KEY] as VariantDiffState | undefined;
  return stored?.version === 1 ? stored : empty();
}

export async function saveState(state: VariantDiffState): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

export async function saveBaseline(snapshot: ProductSnapshot): Promise<void> {
  const state = await loadState();
  state.baseline = snapshot;
  await saveState(state);
}

export async function saveCompare(input: {
  productLabel: string;
  url: string;
  diffs: FieldDiff[];
}): Promise<void> {
  const state = await loadState();
  state.lastCompare = { at: Date.now(), ...input };
  await saveState(state);
}

export async function clearAll(): Promise<void> {
  await saveState(empty());
}
