import { buildHideCss, HIDE_SELECTORS, isRejectLabel } from '@/lib/selectors';
import { loadState } from '@/lib/storage';
import type { BannerAwaySettings } from '@/lib/types';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_start',
  async main() {
    let settings = (await loadState()).settings;
    const style = document.createElement('style');
    style.id = 'banneraway-style';
    document.documentElement.appendChild(style);

    const apply = (s: BannerAwaySettings) => {
      style.textContent = s.enabled ? buildHideCss(HIDE_SELECTORS) : '';
    };
    apply(settings);

    const clickReject = () => {
      if (!settings.enabled || !settings.clickReject) return;
      const candidates = document.querySelectorAll<HTMLElement>(
        'button, a, [role="button"], input[type="button"]',
      );
      for (const el of candidates) {
        const label = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('value') || '').trim();
        if (!label || label.length > 48) continue;
        if (isRejectLabel(label)) {
          try {
            el.click();
          } catch {
            /* ignore */
          }
          break;
        }
      }
      // unlock scroll often left behind
      document.documentElement.style.removeProperty('overflow');
      document.body?.style.removeProperty('overflow');
    };

    const sweep = () => clickReject();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', sweep, { once: true });
    } else sweep();

    const obs = new MutationObserver(() => sweep());
    obs.observe(document.documentElement, { childList: true, subtree: true });

    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.banneraway_state_v1) return;
      const next = changes.banneraway_state_v1.newValue as { settings?: BannerAwaySettings } | undefined;
      if (!next?.settings) return;
      settings = next.settings;
      apply(settings);
      sweep();
    });
  },
});
