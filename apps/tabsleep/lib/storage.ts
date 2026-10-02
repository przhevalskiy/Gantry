import {
  DEFAULT_SETTINGS,
  STORAGE_KEY,
  type SavedSession,
  type TabSleepSettings,
  type TabSleepState,
} from './types';

function empty(): TabSleepState {
  return { version: 1, settings: { ...DEFAULT_SETTINGS }, sessions: [] };
}

export async function loadState(): Promise<TabSleepState> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const stored = raw[STORAGE_KEY] as TabSleepState | undefined;
  if (stored?.version !== 1) return empty();
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS, ...stored.settings },
    sessions: stored.sessions ?? [],
  };
}

export async function saveState(state: TabSleepState): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

export async function saveSettings(settings: TabSleepSettings): Promise<void> {
  const state = await loadState();
  state.settings = settings;
  await saveState(state);
}

export async function addSession(name: string, urls: string[]): Promise<SavedSession> {
  const state = await loadState();
  const session: SavedSession = {
    id: crypto.randomUUID(),
    name: name.trim() || `Session ${new Date().toLocaleString()}`,
    createdAt: Date.now(),
    urls: urls.filter(Boolean).slice(0, 80),
  };
  state.sessions.unshift(session);
  state.sessions = state.sessions.slice(0, 20);
  await saveState(state);
  return session;
}

export async function deleteSession(id: string): Promise<void> {
  const state = await loadState();
  state.sessions = state.sessions.filter((s) => s.id !== id);
  await saveState(state);
}

export function clampIdleMinutes(n: number): number {
  return Math.min(240, Math.max(1, Math.round(n)));
}
