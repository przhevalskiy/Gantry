import { createStarterMacros } from './starters';
import { STORAGE_KEY, type BumpMacro, type BumpNiche, type PayBumpState } from './types';

function empty(): PayBumpState {
  return {
    version: 1,
    macros: createStarterMacros(),
    settings: { expandShortcuts: true, seeded: true, pro: { enabled: false } },
  };
}

export function normalizeShortcut(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!t) return '';
  return t.startsWith(';') ? t : `;${t}`;
}

export async function loadState(): Promise<PayBumpState> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const stored = raw[STORAGE_KEY] as PayBumpState | undefined;
  if (!stored || stored.version !== 1) {
    const seeded = empty();
    await browser.storage.local.set({ [STORAGE_KEY]: seeded });
    return seeded;
  }
  return stored;
}

export async function saveState(state: PayBumpState): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

export async function listMacros(): Promise<BumpMacro[]> {
  return [...(await loadState()).macros].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function upsertMacro(input: {
  id?: string;
  title: string;
  shortcut: string;
  body: string;
  niche: BumpNiche;
}): Promise<BumpMacro> {
  const state = await loadState();
  const now = Date.now();
  if (input.id) {
    const existing = state.macros.find((m) => m.id === input.id);
    if (!existing) throw new Error('Macro not found');
    const next: BumpMacro = {
      id: existing.id,
      createdAt: existing.createdAt,
      usageCount: existing.usageCount,
      title: input.title.trim(),
      shortcut: normalizeShortcut(input.shortcut),
      body: input.body.trim(),
      niche: input.niche,
      updatedAt: now,
    };
    state.macros = state.macros.map((m) => (m.id === next.id ? next : m));
    await saveState(state);
    return next;
  }
  const created: BumpMacro = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    shortcut: normalizeShortcut(input.shortcut),
    body: input.body.trim(),
    niche: input.niche,
    createdAt: now,
    updatedAt: now,
    usageCount: 0,
  };
  state.macros.unshift(created);
  await saveState(state);
  return created;
}

export async function deleteMacro(id: string): Promise<void> {
  const state = await loadState();
  state.macros = state.macros.filter((m) => m.id !== id);
  await saveState(state);
}

export async function recordUsage(id: string): Promise<void> {
  const state = await loadState();
  const m = state.macros.find((x) => x.id === id);
  if (!m) return;
  m.usageCount += 1;
  m.updatedAt = Date.now();
  await saveState(state);
}
