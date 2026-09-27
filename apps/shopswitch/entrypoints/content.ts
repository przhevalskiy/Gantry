import { COLORS } from '@/lib/types';
import { loadState, parseShopifyAdmin } from '@/lib/storage';

const BAR_ID = 'shopswitch-bar';

async function paint() {
  const parsed = parseShopifyAdmin(location.href);
  const existing = document.getElementById(BAR_ID);
  if (!parsed) {
    existing?.remove();
    return;
  }
  const state = await loadState();
  const store = state.stores.find((s) => s.handle.toLowerCase() === parsed.handle.toLowerCase());
  if (!store) {
    existing?.remove();
    return;
  }
  let bar = existing;
  if (!bar) {
    bar = document.createElement('div');
    bar.id = BAR_ID;
    Object.assign(bar.style, {
      position: 'fixed',
      left: '0',
      right: '0',
      top: '0',
      height: '4px',
      zIndex: '2147483647',
      pointerEvents: 'none',
    });
    document.documentElement.appendChild(bar);
  }
  bar.style.background = COLORS[store.color];
  bar.title = `ShopSwitch: ${store.label}`;
}

export default defineContentScript({
  matches: ['https://admin.shopify.com/*', 'https://*.myshopify.com/*'],
  runAt: 'document_idle',
  main() {
    void paint();
    browser.storage.onChanged.addListener(() => void paint());
    let last = location.href;
    setInterval(() => {
      if (location.href !== last) {
        last = location.href;
        void paint();
      }
    }, 1200);
  },
});
