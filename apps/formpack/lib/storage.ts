import { createStarterProfiles } from './starters';
import { STORAGE_KEY, type FormPackState, type FormProfile, type PackNiche } from './types';

function empty(): FormPackState {
  return {
    version: 1,
    profiles: createStarterProfiles(),
    settings: { pro: { enabled: false } },
  };
}

export async function loadState(): Promise<FormPackState> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const stored = raw[STORAGE_KEY] as FormPackState | undefined;
  if (!stored || stored.version !== 1) {
    const seeded = empty();
    await browser.storage.local.set({ [STORAGE_KEY]: seeded });
    return seeded;
  }
  return stored;
}

export async function saveState(state: FormPackState): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

export async function listProfiles(): Promise<FormProfile[]> {
  return (await loadState()).profiles;
}

export async function upsertProfile(input: {
  id?: string;
  name: string;
  niche: PackNiche;
  fieldsText: string;
}): Promise<FormProfile> {
  const state = await loadState();
  const fields = input.fieldsText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf('=');
      if (i === -1) return { key: line, value: '' };
      return { key: line.slice(0, i).trim(), value: line.slice(i + 1).trim() };
    })
    .filter((f) => f.key && f.value);
  if (!input.name.trim() || !fields.length) throw new Error('Name and fields required');
  const now = Date.now();
  if (input.id) {
    const existing = state.profiles.find((p) => p.id === input.id);
    if (!existing) throw new Error('Profile not found');
    const next: FormProfile = {
      id: existing.id,
      createdAt: existing.createdAt,
      name: input.name.trim(),
      niche: input.niche,
      fields,
      updatedAt: now,
    };
    state.profiles = state.profiles.map((p) => (p.id === next.id ? next : p));
    await saveState(state);
    return next;
  }
  const created: FormProfile = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    niche: input.niche,
    fields,
    createdAt: now,
    updatedAt: now,
  };
  state.profiles.unshift(created);
  await saveState(state);
  return created;
}

export async function deleteProfile(id: string): Promise<void> {
  const state = await loadState();
  state.profiles = state.profiles.filter((p) => p.id !== id);
  await saveState(state);
}

export function fieldsToText(fields: { key: string; value: string }[]): string {
  return fields.map((f) => `${f.key}=${f.value}`).join('\n');
}
