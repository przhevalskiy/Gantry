import {
  DEFAULT_SETTINGS,
  STORAGE_KEY,
  type ReplyKitSettings,
  type ReplyKitState,
  type Snippet,
} from './types';
import { createStarterSnippets } from './starters';
import { normalizeShortcut } from './shortcuts';

export { normalizeShortcut };


function emptyState(): ReplyKitState {
  return {
    version: 1,
    snippets: [],
    settings: { ...DEFAULT_SETTINGS, pro: { ...DEFAULT_SETTINGS.pro } },
  };
}

export async function loadState(): Promise<ReplyKitState> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const stored = raw[STORAGE_KEY] as ReplyKitState | undefined;

  if (!stored || stored.version !== 1) {
    const seeded: ReplyKitState = {
      version: 1,
      snippets: createStarterSnippets(),
      settings: {
        ...DEFAULT_SETTINGS,
        seeded: true,
        pro: { ...DEFAULT_SETTINGS.pro },
      },
    };
    await saveState(seeded);
    return seeded;
  }

  if (!stored.settings.seeded && stored.snippets.length === 0) {
    stored.snippets = createStarterSnippets();
    stored.settings.seeded = true;
    await saveState(stored);
  }

  return stored;
}

export async function saveState(state: ReplyKitState): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

export async function listSnippets(): Promise<Snippet[]> {
  const state = await loadState();
  return [...state.snippets].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function upsertSnippet(
  input: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'> & {
    id?: string;
  },
): Promise<Snippet> {
  const state = await loadState();
  const now = Date.now();

  if (input.id) {
    const idx = state.snippets.findIndex((s) => s.id === input.id);
    const existing = idx >= 0 ? state.snippets[idx] : undefined;
    if (!existing) throw new Error('Snippet not found');
    const next: Snippet = {
      id: existing.id,
      createdAt: existing.createdAt,
      usageCount: existing.usageCount,
      title: input.title,
      shortcut: normalizeShortcut(input.shortcut),
      body: input.body,
      niche: input.niche,
      tags: input.tags,
      updatedAt: now,
    };
    state.snippets[idx] = next;
    await saveState(state);
    return next;
  }

  const created: Snippet = {
    id: crypto.randomUUID(),
    title: input.title,
    shortcut: normalizeShortcut(input.shortcut),
    body: input.body,
    niche: input.niche,
    tags: input.tags,
    createdAt: now,
    updatedAt: now,
    usageCount: 0,
  };
  state.snippets.unshift(created);
  await saveState(state);
  return created;
}

export async function deleteSnippet(id: string): Promise<void> {
  const state = await loadState();
  state.snippets = state.snippets.filter((s) => s.id !== id);
  await saveState(state);
}

export async function recordUsage(id: string): Promise<void> {
  const state = await loadState();
  const snip = state.snippets.find((s) => s.id === id);
  if (!snip) return;
  snip.usageCount += 1;
  snip.updatedAt = Date.now();
  await saveState(state);
}

export async function getSettings(): Promise<ReplyKitSettings> {
  const state = await loadState();
  return state.settings;
}

export async function updateSettings(
  patch: Partial<ReplyKitSettings>,
): Promise<ReplyKitSettings> {
  const state = await loadState();
  state.settings = {
    ...state.settings,
    ...patch,
    pro: { ...state.settings.pro, ...(patch.pro ?? {}) },
  };
  await saveState(state);
  return state.settings;
}

export async function exportState(): Promise<string> {
  const state = await loadState();
  return JSON.stringify(state, null, 2);
}

export async function importState(json: string): Promise<ReplyKitState> {
  const parsed = JSON.parse(json) as ReplyKitState;
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.snippets)) {
    throw new Error('Invalid ReplyKit export');
  }
  const next: ReplyKitState = {
    version: 1,
    snippets: parsed.snippets,
    settings: {
      ...DEFAULT_SETTINGS,
      ...parsed.settings,
      seeded: true,
      pro: {
        ...DEFAULT_SETTINGS.pro,
        ...(parsed.settings?.pro ?? {}),
      },
    },
  };
  await saveState(next);
  return next;
}

export async function resetWithStarters(): Promise<ReplyKitState> {
  const next: ReplyKitState = {
    version: 1,
    snippets: createStarterSnippets(),
    settings: {
      ...DEFAULT_SETTINGS,
      seeded: true,
      pro: { ...DEFAULT_SETTINGS.pro },
    },
  };
  await saveState(next);
  return next;
}

export function emptyStateForTests(): ReplyKitState {
  return emptyState();
}
