import { applySettings, collectMedia, wireMedia } from '@/lib/apply';
import { clampBoost, clampSpeed, loadState, saveSettings } from '@/lib/storage';
import type { MediaBoostSettings } from '@/lib/types';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  allFrames: true,
  runAt: 'document_idle',
  async main() {
    let settings = (await loadState()).settings;
    const wired = new WeakSet<HTMLMediaElement>();

    const sync = () => {
      const media = collectMedia();
      for (const el of media) {
        if (!wired.has(el)) {
          wireMedia(el, () => settings);
          wired.add(el);
        }
      }
      applySettings(settings, media);
    };
    sync();

    const obs = new MutationObserver(() => sync());
    obs.observe(document.documentElement, { childList: true, subtree: true });

    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.mediaboost_state_v1) return;
      const next = changes.mediaboost_state_v1.newValue as { settings?: MediaBoostSettings } | undefined;
      if (!next?.settings) return;
      settings = next.settings;
      sync();
    });

    browser.runtime.onMessage.addListener((msg: { type?: string; delta?: number }) => {
      if (msg?.type === 'mediaboost:nudge-speed') {
        settings = { ...settings, speed: clampSpeed(settings.speed + (msg.delta || 0)) };
        void saveSettings(settings);
        sync();
      }
      if (msg?.type === 'mediaboost:toggle-boost') {
        settings = { ...settings, boost: settings.boost > 1 ? 1 : clampBoost(2) };
        void saveSettings(settings);
        sync();
      }
    });
  },
});
