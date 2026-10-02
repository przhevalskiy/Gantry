import { loadState } from '@/lib/storage';
import { SITE_CSS, siteFromHost, youtubeShortsWatchId } from '@/lib/sites';
import type { FeedKillSettings } from '@/lib/types';

export default defineContentScript({
  matches: [
    'https://www.youtube.com/*',
    'https://m.youtube.com/*',
    'https://www.instagram.com/*',
    'https://instagram.com/*',
    'https://x.com/*',
    'https://twitter.com/*',
  ],
  runAt: 'document_start',
  async main() {
    const site = siteFromHost(location.hostname);
    if (!site) return;

    let settings = (await loadState()).settings;
    const style = document.createElement('style');
    style.id = 'feedkill-style';
    (document.documentElement || document).appendChild(style);

    const applyCss = (s: FeedKillSettings) => {
      style.textContent = s[site] ? SITE_CSS[site] : '';
    };
    applyCss(settings);

    const redirectShorts = () => {
      if (!settings.redirectShorts || site !== 'youtube' || !settings.youtube) return;
      const id = youtubeShortsWatchId(location.pathname);
      if (id) {
        location.replace(`https://www.youtube.com/watch?v=${id}`);
      }
    };
    redirectShorts();

    const markInstagram = () => {
      if (site !== 'instagram' || !settings.instagram) return;
      document.querySelectorAll('a[href="/reels/"], a[href*="/reels/"]').forEach((a) => {
        const row = a.closest('div[role="menuitem"], a, div') as HTMLElement | null;
        if (row) row.setAttribute('data-feedkill', 'hide');
      });
      // Explore / Reels tab in bottom nav
      document.querySelectorAll('a[href="/explore/"]').forEach((a) => {
        // keep explore; only reels
      });
      if (location.pathname.startsWith('/reels')) {
        // soft redirect to home feed
        history.replaceState(null, '', '/');
        location.reload();
      }
    };

    const markX = () => {
      if (site !== 'x' || !settings.x) return;
      // Hide "For you" tab button when present
      document.querySelectorAll('[role="tab"]').forEach((tab) => {
        const t = (tab.textContent || '').trim().toLowerCase();
        if (t === 'for you' || t === 'para ti') {
          (tab as HTMLElement).setAttribute('data-feedkill', 'hide');
        }
      });
      // Prefer Following: if on home with For you selected, click Following when available
      if (location.pathname === '/home') {
        const following = [...document.querySelectorAll('[role="tab"]')].find((tab) =>
          /^(following|siguiendo)$/i.test((tab.textContent || '').trim()),
        ) as HTMLElement | undefined;
        if (following && following.getAttribute('aria-selected') !== 'true') {
          following.click();
        }
      }
    };

    const sweep = () => {
      markInstagram();
      markX();
      redirectShorts();
    };
    sweep();

    const obs = new MutationObserver(() => sweep());
    obs.observe(document.documentElement, { childList: true, subtree: true });

    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.feedkill_state_v1) return;
      const next = changes.feedkill_state_v1.newValue as { settings?: FeedKillSettings } | undefined;
      if (!next?.settings) return;
      settings = next.settings;
      applyCss(settings);
      sweep();
    });

    // YouTube SPA navigations
    document.addEventListener('yt-navigate-finish', () => {
      redirectShorts();
      sweep();
    });
  },
});
