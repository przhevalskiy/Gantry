import { COLORS } from '@/lib/types';
import { loadState, parsePortalUrl } from '@/lib/storage';

const BAR_ID = 'portalswitch-bar';

async function paint() {
  const parsed = parsePortalUrl(location.href);
  const existing = document.getElementById(BAR_ID);
  if (!parsed) {
    existing?.remove();
    return;
  }
  const state = await loadState();
  const portal = state.portals.find(
    (p) =>
      p.kind === parsed.kind &&
      (p.handle.toLowerCase() === parsed.handle.toLowerCase() ||
        location.href.toLowerCase().includes(p.handle.toLowerCase())),
  );
  if (!portal) {
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
  bar.style.background = COLORS[portal.color];
  bar.title = `PortalSwitch: ${portal.label} (${portal.kind})`;
}

export default defineContentScript({
  matches: [
    'https://app.qbo.intuit.com/*',
    'https://qbo.intuit.com/*',
    'https://go.xero.com/*',
    'https://*.xero.com/*',
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
