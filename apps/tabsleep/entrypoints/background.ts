import { loadState } from '@/lib/storage';
import { shouldSuspendTab } from '@/lib/suspend';
import { ALARM_NAME } from '@/lib/types';

const lastAccess = new Map<number, number>();

async function tick() {
  const { settings } = await loadState();
  if (!settings.enabled) return;
  const tabs = await browser.tabs.query({});
  const now = Date.now();
  for (const tab of tabs) {
    if (!tab.id) continue;
    const accessed = lastAccess.get(tab.id) ?? tab.lastAccessed ?? now;
    const candidate = {
      id: tab.id,
      active: tab.active,
      pinned: tab.pinned,
      audible: tab.audible,
      discarded: tab.discarded,
      url: tab.url,
      lastAccessed: accessed,
    };
    if (shouldSuspendTab(candidate, settings, now)) {
      try {
        await browser.tabs.discard(tab.id);
      } catch {
        /* ignore */
      }
    }
  }
}

export default defineBackground(() => {
  void browser.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  browser.alarms.onAlarm.addListener((a) => {
    if (a.name === ALARM_NAME) void tick();
  });

  browser.tabs.onActivated.addListener(({ tabId }) => {
    lastAccess.set(tabId, Date.now());
  });
  browser.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status === 'complete') lastAccess.set(tabId, Date.now());
  });
  browser.tabs.onRemoved.addListener((tabId) => lastAccess.delete(tabId));

  browser.runtime.onMessage.addListener((msg: { type?: string }) => {
    if (msg?.type === 'tabsleep:suspend-others') {
      void (async () => {
        const [active] = await browser.tabs.query({ active: true, currentWindow: true });
        const tabs = await browser.tabs.query({ currentWindow: true });
        for (const tab of tabs) {
          if (!tab.id || tab.id === active?.id || tab.pinned || tab.audible) continue;
          if (tab.url?.startsWith('http')) {
            try {
              await browser.tabs.discard(tab.id);
            } catch {
              /* ignore */
            }
          }
        }
      })();
    }
  });
});
