import { COLORS } from '@/lib/types';
import { findMarkForUrl, loadState } from '@/lib/storage';

const BAR_ID = 'slackspacemark-bar';

async function paint() {
  const state = await loadState();
  const mark = findMarkForUrl(state.marks, location.href);
  const existing = document.getElementById(BAR_ID);

  if (!mark) {
    existing?.remove();
    const cleaned = document.title.replace(/^【.*?】\s*/, '');
    if (cleaned !== document.title) document.title = cleaned;
    return;
  }

  if (state.settings.renameTabs) {
    const base = document.title.replace(/^【.*?】\s*/, '');
    const next = `【${mark.label}】 ${base}`;
    if (document.title !== next) document.title = next;
  }

  const color = COLORS[mark.color].hex;
  let bar = existing;
  if (!bar) {
    bar = document.createElement('div');
    bar.id = BAR_ID;
    Object.assign(bar.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      height: '4px',
      zIndex: '2147483647',
      pointerEvents: 'none',
    });
    document.documentElement.appendChild(bar);
  }
  bar.style.background = color;
  bar.title = `SlackSpaceMark: ${mark.label}`;
}

export default defineContentScript({
  matches: [
    'https://app.slack.com/*'
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
