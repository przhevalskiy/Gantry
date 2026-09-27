import { expandShortcutInField, insertTextAtCaret } from '@/lib/insert';
import { listSnippets, getSettings, recordUsage } from '@/lib/storage';
import type { InsertMessage, InsertResultMessage } from '@/lib/types';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    browser.runtime.onMessage.addListener((message: InsertMessage) => {
      if (message?.type !== 'REPLYKIT_INSERT') return;
      const result = insertTextAtCaret(message.body);
      const response: InsertResultMessage = {
        type: 'REPLYKIT_INSERT_RESULT',
        ok: result.ok,
        reason: result.reason,
      };
      return Promise.resolve(response);
    });

    let debounce: number | undefined;
    document.addEventListener(
      'keyup',
      (event) => {
        if (event.key !== ' ' && event.key !== 'Enter' && event.key !== 'Tab') {
          return;
        }
        window.clearTimeout(debounce);
        debounce = window.setTimeout(() => {
          void tryExpand();
        }, 10);
      },
      true,
    );
  },
});

async function tryExpand() {
  const settings = await getSettings();
  if (!settings.expandShortcuts) return;

  const snippets = await listSnippets();
  // Longest shortcut first so ";intro" wins over ";in"
  const ordered = [...snippets]
    .filter((s) => s.shortcut)
    .sort((a, b) => b.shortcut.length - a.shortcut.length);

  for (const snip of ordered) {
    if (expandShortcutInField(snip.shortcut, snip.body)) {
      await recordUsage(snip.id);
      break;
    }
  }
}
