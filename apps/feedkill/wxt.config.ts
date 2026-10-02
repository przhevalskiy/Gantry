import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'FeedKill',
    description:
      'Hide Shorts, Reels, and For You distraction feeds. Keep Search, Subscriptions, and DMs.',
    version: '1.0.0',
    permissions: ['storage'],
    host_permissions: [
      'https://www.youtube.com/*',
      'https://m.youtube.com/*',
      'https://www.instagram.com/*',
      'https://instagram.com/*',
      'https://x.com/*',
      'https://twitter.com/*',
    ],
    action: { default_title: 'FeedKill' },
    icons: { 16: '/icon/16.png', 32: '/icon/32.png', 48: '/icon/48.png', 96: '/icon/96.png', 128: '/icon/128.png' },
  },
});
