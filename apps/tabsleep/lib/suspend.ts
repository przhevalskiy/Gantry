import type { TabSleepSettings } from './types';

export function shouldSuspendTab(
  tab: {
    id?: number;
    active?: boolean;
    pinned?: boolean;
    audible?: boolean;
    discarded?: boolean;
    url?: string;
    lastAccessed?: number;
  },
  settings: TabSleepSettings,
  now = Date.now(),
): boolean {
  if (!settings.enabled) return false;
  if (!tab.id || tab.active || tab.discarded) return false;
  if (settings.keepPinned && tab.pinned) return false;
  if (settings.keepAudible && tab.audible) return false;
  const url = tab.url || '';
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  const last = tab.lastAccessed ?? now;
  const idleMs = settings.idleMinutes * 60_000;
  return now - last >= idleMs;
}
