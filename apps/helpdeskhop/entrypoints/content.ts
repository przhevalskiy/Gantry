import { COLORS } from '@/lib/types';
import { loadState, parseTargetUrl } from '@/lib/storage';

const BAR_ID = 'helpdeskhop-bar';

async function paint() {
  const parsed = parseTargetUrl(location.href);
  const existing = document.getElementById(BAR_ID);
  if (!parsed) {
    existing?.remove();
    return;
  }
  const state = await loadState();
  const item = state.items.find(
    (i) =>
      i.kind === parsed.kind &&
      (i.handle.toLowerCase() === parsed.handle.toLowerCase() ||
        location.href.toLowerCase().includes(i.handle.toLowerCase())),
  );
  if (!item) {
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
  bar.style.background = COLORS[item.color];
  bar.title = `HelpdeskHop: ${item.label}`;
}

export default defineContentScript({
  matches: [
    'https://*.gorgias.com/*',
    'https://*.zendesk.com/*',
    'https://app.intercom.com/*',
    'https://*.intercom.io/*'
  ],
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
