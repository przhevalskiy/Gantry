import {
  STORAGE_KEY,
  type ClientMark,
  type ClientMarkState,
  type MarkColor,
} from './types';

function empty(): ClientMarkState {
  return {
    version: 1,
    marks: [],
    settings: { renameTabs: true, showBadge: true, pro: { enabled: false } },
  };
}

export async function loadState(): Promise<ClientMarkState> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const stored = raw[STORAGE_KEY] as ClientMarkState | undefined;
  return stored?.version === 1 ? stored : empty();
}

export async function saveState(state: ClientMarkState): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

export async function listMarks(): Promise<ClientMark[]> {
  return (await loadState()).marks;
}

export async function upsertMark(input: {
  id?: string;
  urlMatch: string;
  label: string;
  color: MarkColor;
}): Promise<ClientMark> {
  const state = await loadState();
  const urlMatch = input.urlMatch.trim();
  const label = input.label.trim();
  if (!urlMatch || !label) throw new Error('URL match and label required');

  if (input.id) {
    const existing = state.marks.find((m) => m.id === input.id);
    if (!existing) throw new Error('Mark not found');
    const next: ClientMark = {
      id: existing.id,
      createdAt: existing.createdAt,
      urlMatch,
      label,
      color: input.color,
    };
    state.marks = state.marks.map((m) => (m.id === next.id ? next : m));
    await saveState(state);
    return next;
  }

  const created: ClientMark = {
    id: crypto.randomUUID(),
    urlMatch,
    label,
    color: input.color,
    createdAt: Date.now(),
  };
  state.marks.unshift(created);
  await saveState(state);
  return created;
}

export async function deleteMark(id: string): Promise<void> {
  const state = await loadState();
  state.marks = state.marks.filter((m) => m.id !== id);
  await saveState(state);
}

export function findMarkForUrl(marks: ClientMark[], url: string): ClientMark | undefined {
  const lower = url.toLowerCase();
  return marks.find((m) => lower.includes(m.urlMatch.toLowerCase()));
}
