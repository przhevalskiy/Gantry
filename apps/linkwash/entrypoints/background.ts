import { cleanUrl } from '@/lib/clean';
import { loadState, setLastCleaned } from '@/lib/storage';

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: 'linkwash-copy',
      title: 'Copy clean link',
      contexts: ['link'],
    });
    browser.contextMenus.create({
      id: 'linkwash-page',
      title: 'Copy clean page URL',
      contexts: ['page'],
    });
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    const state = await loadState();
    const raw =
      info.menuItemId === 'linkwash-copy'
        ? info.linkUrl
        : info.menuItemId === 'linkwash-page'
          ? info.pageUrl || tab?.url
          : undefined;
    if (!raw) return;
    const { cleaned } = cleanUrl(raw, state.settings.aggressive);
    await setLastCleaned(cleaned);
    if (tab?.id) {
      try {
        await browser.tabs.sendMessage(tab.id, { type: 'linkwash:copy', url: cleaned });
      } catch {
        // content script may be missing on restricted pages
      }
    }
  });
});
