import { addEntry } from '@/lib/storage';

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: 'promptledger-prompt',
      title: 'PromptLedger: save as prompt',
      contexts: ['selection'],
    });
    browser.contextMenus.create({
      id: 'promptledger-output',
      title: 'PromptLedger: save as output',
      contexts: ['selection'],
    });
    browser.contextMenus.create({
      id: 'promptledger-note',
      title: 'PromptLedger: save as note',
      contexts: ['selection'],
    });
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    const text = info.selectionText?.trim();
    if (!text) return;
    const kind =
      info.menuItemId === 'promptledger-output'
        ? 'output'
        : info.menuItemId === 'promptledger-note'
          ? 'note'
          : 'prompt';
    await addEntry({
      kind,
      text,
      sourceUrl: tab?.url ?? info.pageUrl ?? '',
      sourceTitle: tab?.title ?? '',
    });
  });
});
