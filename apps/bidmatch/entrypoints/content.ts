import { applyHighlights, type HighlightRule } from '@/lib/highlight';
import { loadState } from '@/lib/storage';

async function run() {
  const state = await loadState();
  const rules: HighlightRule[] = state.sets
    .filter((s) => s.enabled)
    .flatMap((s) =>
      s.keywords
        .map((k) => k.trim())
        .filter(Boolean)
        .map((keyword) => ({ keyword, color: s.color, setName: s.name })),
    );
  const count = applyHighlights(rules, {
    caseSensitive: state.settings.caseSensitive,
    wholeWord: state.settings.wholeWord,
  });
  await browser.runtime.sendMessage({ type: 'BIDMATCH_COUNT', count }).catch(() => undefined);
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    void run();
    browser.storage.onChanged.addListener(() => void run());
    browser.runtime.onMessage.addListener((msg) => {
      if (msg?.type === 'BIDMATCH_REFRESH') {
        void run();
      }
    });

    let last = location.href;
    setInterval(() => {
      if (location.href !== last) {
        last = location.href;
        void run();
      }
    }, 1500);
  },
});
