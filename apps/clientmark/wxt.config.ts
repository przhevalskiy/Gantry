import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'ClientMark',
    description:
      'Color-label client ad accounts and rename tabs — for Meta Ads & Google Ads agencies.',
    version: '0.1.0',
    permissions: ['storage', 'tabs', 'activeTab', 'scripting'],
    host_permissions: [
      'https://ads.google.com/*',
      'https://business.facebook.com/*',
      'https://adsmanager.facebook.com/*',
      'https://www.facebook.com/adsmanager/*',
      'https://*/*',
    ],
    action: { default_title: 'ClientMark' },
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
  },
});
