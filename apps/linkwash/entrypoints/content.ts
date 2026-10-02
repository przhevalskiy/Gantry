import { cleanUrl, isProbablyUrl } from '@/lib/clean';
import { loadState, setLastCleaned } from '@/lib/storage';
import type { LinkWashSettings } from '@/lib/types';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  async main() {
    let settings: LinkWashSettings = (await loadState()).settings;

    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.linkwash_state_v1) return;
      const next = changes.linkwash_state_v1.newValue as { settings?: LinkWashSettings } | undefined;
      if (next?.settings) settings = next.settings;
    });

    document.addEventListener(
      'copy',
      (event) => {
        if (!settings.enabled) return;
        const sel = document.getSelection()?.toString() ?? '';
        const fromEvent = event.clipboardData?.getData('text/plain') || sel;
        if (!fromEvent || !isProbablyUrl(fromEvent)) return;
        const { cleaned, removed } = cleanUrl(fromEvent, settings.aggressive);
        if (!removed.length && cleaned === fromEvent.trim()) return;
        event.clipboardData?.setData('text/plain', cleaned);
        event.preventDefault();
        void setLastCleaned(cleaned);
      },
      true,
    );

    browser.runtime.onMessage.addListener((msg: { type?: string; url?: string }) => {
      if (msg?.type === 'linkwash:copy' && msg.url) {
        void navigator.clipboard.writeText(msg.url);
      }
    });
  },
});
