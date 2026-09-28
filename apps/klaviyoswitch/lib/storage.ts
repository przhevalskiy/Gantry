import { STORAGE_KEY, type AppState, type ItemColor, type SavedItem } from './types';

function empty(): AppState {
  return { version: 1, items: [], settings: { pro: { enabled: false } } };
}

export function parseTargetUrl(
  url: string,
): { url: string; handle: string; kind: string } | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === 'www.klaviyo.com' || host.endsWith('.klaviyo.com')) {
      const company = u.searchParams.get('company')
        || u.pathname.match(/\/company\/([^/]+)/)?.[1]
        || u.pathname.split('/').filter(Boolean)[0]
        || 'klaviyo';
      return {
        kind: 'klaviyo',
        handle: company,
        url: host === 'www.klaviyo.com' ? 'https://www.klaviyo.com/' : `https://${host}/`,
      };
    }
    return null;
  } catch {
    return null;
  }
}


export async function loadState(): Promise<AppState> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const stored = raw[STORAGE_KEY] as AppState | undefined;
  return stored?.version === 1 ? stored : empty();
}

export async function saveState(state: AppState): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

export async function upsertItem(input: {
  id?: string;
  label: string;
  url: string;
  color: ItemColor;
  notes?: string;
}): Promise<SavedItem> {
  const parsed = parseTargetUrl(input.url);
  if (!parsed) throw new Error('URL is not a supported admin host for this extension');
  const state = await loadState();
  const now = Date.now();
  if (input.id) {
    const existing = state.items.find((i) => i.id === input.id);
    if (!existing) throw new Error('Item not found');
    const next: SavedItem = {
      ...existing,
      label: input.label.trim() || parsed.handle,
      url: parsed.url,
      handle: parsed.handle,
      kind: parsed.kind,
      color: input.color,
      notes: input.notes?.trim() ?? existing.notes,
    };
    state.items = state.items.map((i) => (i.id === next.id ? next : i));
    await saveState(state);
    return next;
  }
  const created: SavedItem = {
    id: crypto.randomUUID(),
    label: input.label.trim() || parsed.handle,
    url: parsed.url,
    handle: parsed.handle,
    kind: parsed.kind,
    color: input.color,
    notes: input.notes?.trim() ?? '',
    createdAt: now,
    lastOpenedAt: 0,
  };
  state.items.unshift(created);
  await saveState(state);
  return created;
}

export async function deleteItem(id: string): Promise<void> {
  const state = await loadState();
  state.items = state.items.filter((i) => i.id !== id);
  await saveState(state);
}

export async function touchOpened(id: string): Promise<void> {
  const state = await loadState();
  const item = state.items.find((x) => x.id === id);
  if (!item) return;
  item.lastOpenedAt = Date.now();
  await saveState(state);
}
