import { COLORS } from '@/lib/types';
import { findMarkForUrl, loadState } from '@/lib/storage';

async function applyBadge(tabId: number, url?: string) {
  if (!url || url.startsWith('chrome')) {
    await browser.action.setBadgeText({ tabId, text: '' });
    return;
  }
  const state = await loadState();
  if (!state.settings.showBadge) {
    await browser.action.setBadgeText({ tabId, text: '' });
    return;
  }
  const mark = findMarkForUrl(state.marks, url);
  if (!mark) {
    await browser.action.setBadgeText({ tabId, text: '' });
    return;
  }
  await browser.action.setBadgeText({ tabId, text: mark.label.slice(0, 3).toUpperCase() });
  await browser.action.setBadgeBackgroundColor({ tabId, color: COLORS[mark.color].hex });
}

export default defineBackground(() => {
  const refresh = (tabId: number, url?: string) => void applyBadge(tabId, url);

  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' || changeInfo.url) {
      refresh(tabId, changeInfo.url || tab.url);
    }
  });

  browser.tabs.onActivated.addListener(({ tabId }) => {
    void browser.tabs.get(tabId).then((tab) => refresh(tabId, tab.url));
  });

  browser.storage.onChanged.addListener(() => {
    void browser.tabs.query({}).then((tabs) => {
      for (const tab of tabs) {
        if (tab.id != null) refresh(tab.id, tab.url);
      }
    });
  });
});
