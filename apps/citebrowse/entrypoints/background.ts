import { extractCitationMeta } from '@/lib/extract';
import { addCitation } from '@/lib/storage';

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: 'citebrowse-capture',
      title: 'CiteBrowse: capture page citation',
      contexts: ['page', 'selection'],
    });
  });

  browser.contextMenus.onClicked.addListener(async (_info, tab) => {
    if (!tab?.id) return;
    try {
      const results = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractCitationMeta,
      });
      const meta = results?.[0]?.result;
      if (!meta?.title) return;
      await addCitation({ ...meta, note: '' });
    } catch {
      // ignore restricted pages
    }
  });
});
